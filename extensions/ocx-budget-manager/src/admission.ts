import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emitAgentEvent } from "openclaw/plugin-sdk";
import type { BudgetManagerConfig } from "./config.js";
import type { Ledger } from "./ledger.js";
import type { ScopeResolver } from "./scope-resolver.js";
import type { AdmissionDecision } from "./types.js";

/**
 * Evaluate admission for an agent run by checking all applicable budget scopes
 * bottom-up (agent -> team -> org -> system).
 */
async function evaluateAdmission(
  agentId: string,
  scopeResolver: ScopeResolver,
  ledger: Ledger,
  config: BudgetManagerConfig,
  sessionKey?: string,
): Promise<AdmissionDecision> {
  const allocations = scopeResolver.resolveScopes(agentId, sessionKey);

  // In read-only mode, always allow
  if (config.enforcement === "read-only") {
    return { decision: "allow" };
  }

  for (const allocation of allocations) {
    const usage = await ledger.getCurrentUsage(allocation);

    // Check if any dimension has hit or exceeded 100%
    const maxUtilization = Math.max(0, ...Object.values(usage.utilizationPct));
    if (maxUtilization < 1.0) continue;

    switch (allocation.breachAction) {
      case "block":
        // In soft mode, degrade instead of blocking
        if (config.enforcement === "soft") {
          if (allocation.degradeModel) {
            return {
              decision: "degrade",
              limitScope: allocation.scope,
              degradeModel: allocation.degradeModel,
            };
          }
          // No degrade model configured; allow with warning
          return { decision: "allow" };
        }
        return { decision: "block", blockingScope: allocation.scope };

      case "degrade":
        if (allocation.degradeModel) {
          return {
            decision: "degrade",
            limitScope: allocation.scope,
            degradeModel: allocation.degradeModel,
          };
        }
        // No degrade model configured; fall through to allow
        return { decision: "allow" };

      case "warn":
        // Warn-only: allow the run, logging is handled by the hook
        continue;
    }
  }

  return { decision: "allow" };
}

/**
 * Register the before_model_resolve hook for admission control.
 * Runs at priority 200 — before routing policy.
 */
export function registerAdmissionHook(
  api: OpenClawPluginApi,
  scopeResolver: ScopeResolver,
  ledger: Ledger,
  config: BudgetManagerConfig,
): void {
  const emitAdmissionEvent = (params: {
    runId?: string;
    agentId: string;
    admission: AdmissionDecision;
  }) => {
    if (!params.runId) return;
    const scopeInfo =
      params.admission.decision === "block"
        ? params.admission.blockingScope
        : params.admission.decision === "degrade"
          ? params.admission.limitScope
          : undefined;
    emitAgentEvent({
      runId: params.runId,
      stream: "budget",
      data: {
        family: "budget",
        type: "budget.admission",
        decision: params.admission.decision,
        agentId: params.agentId,
        ...(scopeInfo ? { scope: `${scopeInfo.level}/${scopeInfo.id}` } : {}),
        ...(params.admission.decision === "degrade"
          ? { degradeModel: params.admission.degradeModel }
          : {}),
      },
    });
  };

  // Model-stage routing can only perform degradations (model override).
  api.on(
    "before_model_resolve",
    async (event, ctx) => {
      const agentId = ctx.agentId ?? "default";
      const sessionKey = ctx.sessionKey;
      const admission = await evaluateAdmission(agentId, scopeResolver, ledger, config, sessionKey);

      if (admission.decision === "degrade") {
        api.logger.info(
          `budget-manager: degrading model for agent "${agentId}" to "${admission.degradeModel}" — ` +
            `limit reached at ${admission.limitScope.level}/${admission.limitScope.id}`,
        );
        return { modelOverride: admission.degradeModel };
      }

      // Blocking is handled in before_agent_run to hard-reject deterministically.
      void event;
    },
    { priority: 200 },
  );

  // Run-stage gating performs deterministic hard blocks.
  api.on(
    "before_agent_run",
    async (event, ctx) => {
      const agentId = ctx.agentId ?? event.agentId ?? "default";
      const admission = await evaluateAdmission(
        agentId,
        scopeResolver,
        ledger,
        config,
        ctx.sessionKey,
      );
      emitAdmissionEvent({ runId: ctx.runId, agentId, admission });

      if (admission.decision !== "block") {
        return;
      }

      const scope = `${admission.blockingScope.level}/${admission.blockingScope.id}`;
      const reason = `Budget exhausted at ${scope}`;
      api.logger.warn(`budget-manager: blocked run for agent "${agentId}" — ${reason}`);
      return {
        reject: true,
        rejectReason: reason,
        rejectUserMessage: `This request is blocked because budget is exhausted for ${scope}.`,
      };
    },
    { priority: 200 },
  );
}
