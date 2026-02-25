/**
 * Routing Policy plugin — policy-driven model routing, task classification,
 * and composable prompt pipeline.
 *
 * Hooks:
 *   before_model_resolve  — match routing policies, override model/provider
 *   before_prompt_build   — compose system prompt from contributors
 *
 * Gateway methods:
 *   routing.classify             — classify input text
 *   routing.policies.list        — list routing policies
 *   routing.policies.set         — create/update routing policies
 *   routing.contributors.list    — list prompt contributors
 *   routing.contributors.set     — create/update prompt contributors
 */

import { join } from "node:path";
import type { GatewayRequestHandlerOptions, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emitAgentEvent } from "openclaw/plugin-sdk";
import { classify } from "./src/classifier.js";
import { resolveConfig } from "./src/config.js";
import { buildMatchContext, buildModelRouteResult, selectPolicy } from "./src/model-router.js";
import {
  loadContributors,
  loadPolicies,
  saveContributors,
  savePolicies,
} from "./src/policy-store.js";
import { buildPromptContext, composePrompt } from "./src/prompt-pipeline.js";
import type { ClassifierInput, PromptContributor, RoutingPolicy } from "./src/types.js";

export default function register(api: OpenClawPluginApi) {
  const config = resolveConfig(api.pluginConfig as Record<string, unknown> | undefined);
  const stateDir = api.runtime.state.resolveStateDir();

  const policyFilePath = join(stateDir, config.policyFile);
  const contributorsFilePath = join(stateDir, config.contributorsFile);

  api.logger.info(
    `routing-policy: loaded (classifierModel=${config.classifierModel}, threshold=${config.heuristicConfidenceThreshold})`,
  );

  // -------------------------------------------------------------------------
  // Hook: before_model_resolve
  // -------------------------------------------------------------------------
  api.on("before_model_resolve", async (event, ctx) => {
    const policies = loadPolicies(policyFilePath);
    if (policies.length === 0 && !config.defaultModel) {
      return;
    }

    // Classify the prompt
    const classification = await classify({ text: event.prompt } satisfies ClassifierInput, config);

    emitAgentEvent({
      runId: ctx.sessionKey ?? "unknown",
      stream: "lifecycle",
      data: {
        family: "model",
        type: "model.classification",
        label: classification.label,
        confidence: classification.confidence,
        method: classification.method,
      },
    });

    // Build match context and find the best policy
    const matchCtx = buildMatchContext(event, ctx, classification);
    const policy = selectPolicy(policies, matchCtx);
    const result = buildModelRouteResult(policy, config);

    emitAgentEvent({
      runId: ctx.sessionKey ?? "unknown",
      stream: "lifecycle",
      data: {
        family: "model",
        type: "model.resolve",
        policyId: policy?.id,
        resolvedModel: result?.modelOverride,
      },
    });

    if (result) {
      api.logger.info(
        `routing-policy: model-route classification=${classification.label} ` +
          `policy=${result.policyId ?? "default"} model=${result.modelOverride ?? "(none)"}`,
      );
      return {
        modelOverride: result.modelOverride,
        providerOverride: result.providerOverride,
      };
    }
  });

  // -------------------------------------------------------------------------
  // Hook: before_prompt_build
  // -------------------------------------------------------------------------
  api.on("before_prompt_build", async (_event, ctx) => {
    const contributors = loadContributors(contributorsFilePath);
    if (contributors.length === 0) {
      return;
    }

    // Build prompt context from hook context
    // Classification is not re-run here; if the prompt pipeline needs it,
    // the contributor conditions can match on agent/channel instead.
    const promptCtx = buildPromptContext(ctx);
    const composed = composePrompt(contributors, promptCtx);

    emitAgentEvent({
      runId: ctx.sessionKey ?? "unknown",
      stream: "lifecycle",
      data: {
        family: "prompt",
        type: "prompt.composed",
        contributorIds: contributors.map((c) => c.id),
      },
    });

    if (composed) {
      api.logger.info(
        `routing-policy: prompt-pipeline composed ${contributors.length} contributor(s)`,
      );
      return { systemPrompt: composed };
    }
  });

  // -------------------------------------------------------------------------
  // Gateway method: routing.classify
  // -------------------------------------------------------------------------
  api.registerGatewayMethod(
    "routing.classify",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const text = typeof params?.text === "string" ? params.text : "";
        if (!text.trim()) {
          respond(false, { error: "Missing required parameter: text" });
          return;
        }

        const input: ClassifierInput = {
          text,
          toolsAvailable:
            typeof params?.toolsAvailable === "number" ? params.toolsAvailable : undefined,
          sessionDepth: typeof params?.sessionDepth === "number" ? params.sessionDepth : undefined,
          hasMedia: typeof params?.hasMedia === "boolean" ? params.hasMedia : undefined,
        };

        const result = await classify(input, config);
        respond(true, result);
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  // -------------------------------------------------------------------------
  // Gateway method: routing.policies.list
  // -------------------------------------------------------------------------
  api.registerGatewayMethod(
    "routing.policies.list",
    ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const policies = loadPolicies(policyFilePath);
        respond(true, { policies });
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  // -------------------------------------------------------------------------
  // Gateway method: routing.policies.set
  // -------------------------------------------------------------------------
  api.registerGatewayMethod(
    "routing.policies.set",
    ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const policies = params?.policies;
        if (!Array.isArray(policies)) {
          respond(false, { error: "Missing required parameter: policies (array)" });
          return;
        }

        // Validate each policy minimally
        for (const policy of policies) {
          if (!policy || typeof policy !== "object") {
            respond(false, { error: "Each policy must be an object" });
            return;
          }
          const p = policy as Record<string, unknown>;
          if (typeof p.id !== "string" || !p.id.trim()) {
            respond(false, { error: "Each policy must have a non-empty string id" });
            return;
          }
          if (!Array.isArray(p.conditions)) {
            respond(false, { error: `Policy "${p.id}": conditions must be an array` });
            return;
          }
          if (typeof p.priority !== "number") {
            respond(false, { error: `Policy "${p.id}": priority must be a number` });
            return;
          }
          if (!p.target || typeof p.target !== "object") {
            respond(false, { error: `Policy "${p.id}": target must be an object` });
            return;
          }
        }

        savePolicies(policyFilePath, policies as RoutingPolicy[]);
        respond(true, { saved: policies.length });
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  // -------------------------------------------------------------------------
  // Gateway method: routing.contributors.list
  // -------------------------------------------------------------------------
  api.registerGatewayMethod(
    "routing.contributors.list",
    ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const contributors = loadContributors(contributorsFilePath);
        respond(true, { contributors });
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  // -------------------------------------------------------------------------
  // Gateway method: routing.contributors.set
  // -------------------------------------------------------------------------
  api.registerGatewayMethod(
    "routing.contributors.set",
    ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const contributors = params?.contributors;
        if (!Array.isArray(contributors)) {
          respond(false, { error: "Missing required parameter: contributors (array)" });
          return;
        }

        // Validate each contributor minimally
        for (const contributor of contributors) {
          if (!contributor || typeof contributor !== "object") {
            respond(false, { error: "Each contributor must be an object" });
            return;
          }
          const c = contributor as Record<string, unknown>;
          if (typeof c.id !== "string" || !c.id.trim()) {
            respond(false, { error: "Each contributor must have a non-empty string id" });
            return;
          }
          if (typeof c.priority !== "number") {
            respond(false, { error: `Contributor "${c.id}": priority must be a number` });
            return;
          }
          if (!Array.isArray(c.conditions)) {
            respond(false, { error: `Contributor "${c.id}": conditions must be an array` });
            return;
          }
          if (typeof c.optional !== "boolean") {
            respond(false, { error: `Contributor "${c.id}": optional must be a boolean` });
            return;
          }
          if (typeof c.content !== "string") {
            respond(false, { error: `Contributor "${c.id}": content must be a string` });
            return;
          }
        }

        saveContributors(contributorsFilePath, contributors as PromptContributor[]);
        respond(true, { saved: contributors.length });
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    },
  );
}
