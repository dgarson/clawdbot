/**
 * Evaluation Plugin
 *
 * Async evaluation system for task quality scoring, model comparison,
 * and tool intelligence analysis. Scores completed runs using configurable
 * judge profiles and emits feedback events for routing optimization.
 */

import type {
  GatewayRequestHandlerOptions,
  OpenClawPluginApi,
  OpenClawPluginServiceContext,
} from "openclaw/plugin-sdk";
import { emitAgentEvent } from "openclaw/plugin-sdk";
import { aggregateModelComparison } from "./src/comparison.js";
import { resolveEvaluationConfig } from "./src/config.js";
import { createEvaluationService, type EvaluatorDeps, type PendingRun } from "./src/evaluator.js";
import { JudgeStore } from "./src/judge-store.js";
import { ScorecardStore } from "./src/scorecard-store.js";
import { buildToolIntelligenceReport } from "./src/tool-analyzer.js";
import type { JudgeProfile, ToolEvent } from "./src/types.js";

export default function register(api: OpenClawPluginApi) {
  const pluginCfg = resolveEvaluationConfig(
    api.pluginConfig as Record<string, unknown> | undefined,
  );
  const logger = api.logger;

  // Stores are lazily initialized when the service starts (need stateDir)
  let scorecardStore: ScorecardStore | undefined;
  let judgeStore: JudgeStore | undefined;

  // Pending runs collected via hooks (until event ledger is available)
  const pendingRuns = new Map<string, Partial<PendingRun>>();
  const completedUnscored: PendingRun[] = [];

  // -------------------------------------------------------------------------
  // Hooks: collect run data from agent lifecycle events
  // -------------------------------------------------------------------------

  api.on("llm_input", (event, ctx) => {
    const runId = event.runId;
    if (!runId) return;

    const existing = pendingRuns.get(runId) ?? {};
    existing.runId = runId;
    existing.agentId = ctx.agentId;
    existing.sessionKey = ctx.sessionKey;
    existing.prompt = event.prompt;
    existing.model = event.model;
    existing.provider = event.provider;
    existing.toolEvents = existing.toolEvents ?? [];

    // Classification label: the routing-policy plugin emits model.classification
    // events via emitAgentEvent. Once the evaluation plugin subscribes to
    // onAgentEvent for those events, classificationLabel will be populated here.
    // Until then, the "general" fallback is applied in agent_end.

    pendingRuns.set(runId, existing);
  });

  api.on("llm_output", (event, ctx) => {
    const runId = event.runId;
    if (!runId) return;

    const existing = pendingRuns.get(runId) ?? {};
    existing.toolEvents = existing.toolEvents ?? [];
    existing.response = event.assistantTexts?.join("\n") ?? "";
    existing.inputTokens = event.inputTokens ?? event.usage?.input ?? 0;
    existing.outputTokens = event.outputTokens ?? event.usage?.output ?? 0;
    existing.totalTokens = event.totalTokens ?? event.usage?.total ?? 0;
    existing.costUsd = event.estimatedCostUsd ?? 0;
    pendingRuns.set(runId, existing);
  });

  api.on("after_tool_call", (event, ctx) => {
    const runId = ctx.runId;
    if (!runId) return;
    const runEntry = pendingRuns.get(runId);
    if (!runEntry) return;

    const toolEvents = runEntry.toolEvents ?? [];
    toolEvents.push({
      eventId: `tool-${runId}-${toolEvents.length + 1}`,
      toolName: event.toolName,
      params: event.params,
      success: !event.error,
      error: event.error,
      timestamp: new Date().toISOString(),
    });
    runEntry.toolEvents = toolEvents;
  });

  api.on("agent_end", (event, ctx) => {
    const runId = event.runId ?? ctx.runId;
    if (!runId) return;
    const runEntry = pendingRuns.get(runId);
    if (!runEntry) return;

    runEntry.durationMs = event.durationMs ?? 0;
    // Default classification label (routing plugin would set this via events)
    runEntry.classificationLabel = runEntry.classificationLabel ?? "general";
    runEntry.toolEvents = runEntry.toolEvents ?? [];

    // Validate completeness and move to completed queue
    if (isCompletePendingRun(runEntry)) {
      completedUnscored.push(runEntry as PendingRun);
    }

    pendingRuns.delete(runId);
  });

  /** Check that all required fields are present. */
  function isCompletePendingRun(run: Partial<PendingRun>): run is PendingRun {
    return !!(
      run.runId &&
      run.agentId &&
      run.sessionKey &&
      run.classificationLabel &&
      run.model &&
      run.provider &&
      run.prompt !== undefined &&
      run.response !== undefined &&
      Array.isArray(run.toolEvents) &&
      typeof run.durationMs === "number" &&
      typeof run.inputTokens === "number" &&
      typeof run.outputTokens === "number" &&
      typeof run.totalTokens === "number" &&
      typeof run.costUsd === "number"
    );
  }

  // -------------------------------------------------------------------------
  // Background service
  // -------------------------------------------------------------------------

  const deps: EvaluatorDeps = {
    config: pluginCfg,
    get scorecardStore(): ScorecardStore {
      if (!scorecardStore) throw new Error("evaluation: scorecardStore not initialized");
      return scorecardStore;
    },
    get judgeStore(): JudgeStore {
      if (!judgeStore) throw new Error("evaluation: judgeStore not initialized");
      return judgeStore;
    },
    logger,

    /**
     * Placeholder LLM invocation.
     *
     * This is a structural limitation of the current plugin API: plugins cannot
     * directly invoke LLMs through the runtime yet. The interface is designed so
     * that when runtime LLM access is added to the plugin API (e.g. via a
     * `ctx.invokeLlm()` method on the service context), only this callback
     * needs to be updated -- the evaluator, judge profiles, and scoring logic
     * remain unchanged.
     *
     * Until then, the LLM judge returns low-confidence fallback scores and the
     * heuristic judge is the recommended scoring method.
     */
    async invokeLlm(_prompt: string, _model: string): Promise<string> {
      logger.warn("evaluation: LLM judge invocation not yet wired to provider infrastructure");
      return JSON.stringify({
        criteriaScores: {},
        confidence: 0.1,
        reasoning: "LLM judge not available",
        disqualified: false,
      });
    },

    emitEvent(event) {
      // Emit via the real agent event bus so downstream plugins (e.g. routing-policy)
      // can subscribe to evaluation feedback events via onAgentEvent.
      emitAgentEvent({
        runId: event.data.runId ? String(event.data.runId) : "eval:global",
        stream: event.family,
        data: { family: event.family, type: event.type, ...event.data },
      });
      logger.info(`evaluation: event ${event.type} — ${JSON.stringify(event.data)}`);
    },

    async findUnscoredRuns(batchSize: number): Promise<PendingRun[]> {
      // Drain from the hook-collected queue
      const batch = completedUnscored.splice(0, batchSize);
      return batch;
    },
  };

  // Wrap in a service that initializes stores from stateDir
  api.registerService({
    id: "evaluation-worker",
    async start(ctx) {
      scorecardStore = new ScorecardStore(ctx.stateDir);
      judgeStore = new JudgeStore(ctx.stateDir, pluginCfg.judgeProfilesFile);

      // Purge old scorecards on startup
      const purged = scorecardStore.purgeOlderThan(pluginCfg.scorecardRetentionDays);
      if (purged > 0) {
        logger.info(`evaluation: purged ${purged} expired scorecard file(s)`);
      }

      const inner = createEvaluationService(deps);
      await inner.start(ctx);

      // Stash the inner service stop for cleanup
      (this as Record<string, unknown>)._innerStop = inner.stop;
    },
    async stop(ctx) {
      const innerStop = (this as Record<string, unknown>)._innerStop as
        | ((ctx: OpenClawPluginServiceContext) => Promise<void>)
        | undefined;
      if (innerStop) {
        await innerStop(ctx);
      }
    },
  });

  // -------------------------------------------------------------------------
  // Gateway methods
  // -------------------------------------------------------------------------

  // evaluation.scorecards.query — query scorecards by runId, agentId, time range
  api.registerGatewayMethod("evaluation.scorecards.query", (opts: GatewayRequestHandlerOptions) => {
    const { params, respond } = opts;
    if (!scorecardStore) {
      respond(false, undefined, {
        code: "SERVICE_UNAVAILABLE",
        message: "Evaluation service not started",
      });
      return;
    }

    const results = scorecardStore.query({
      runId: asString(params.runId),
      agentId: asString(params.agentId),
      from: asString(params.from),
      to: asString(params.to),
      classificationLabel: asString(params.classificationLabel),
      model: asString(params.model),
      limit: asNumber(params.limit),
    });

    respond(true, { scorecards: results });
  });

  // evaluation.scorecards.override — human override with annotator, reason, score
  api.registerGatewayMethod(
    "evaluation.scorecards.override",
    (opts: GatewayRequestHandlerOptions) => {
      const { params, respond } = opts;
      if (!scorecardStore) {
        respond(false, undefined, {
          code: "SERVICE_UNAVAILABLE",
          message: "Evaluation service not started",
        });
        return;
      }

      const runId = asString(params.runId);
      const overrideScore = asNumber(params.overrideScore);
      const annotator = asString(params.annotator);
      const reason = asString(params.reason);

      if (!runId || overrideScore === undefined || !annotator || !reason) {
        respond(false, undefined, {
          code: "INVALID_PARAMS",
          message: "Required: runId, overrideScore, annotator, reason",
        });
        return;
      }

      const updated = scorecardStore.updateByRunId(runId, (card) => ({
        ...card,
        humanOverride: {
          overrideScore,
          annotator,
          reason,
          overriddenAt: new Date().toISOString(),
        },
      }));

      if (!updated) {
        respond(false, undefined, {
          code: "NOT_FOUND",
          message: `Scorecard not found for run ${runId}`,
        });
        return;
      }

      respond(true, { updated: true });
    },
  );

  // evaluation.judges.list — list all judge profiles
  api.registerGatewayMethod("evaluation.judges.list", (opts: GatewayRequestHandlerOptions) => {
    const { respond } = opts;
    if (!judgeStore) {
      respond(false, undefined, {
        code: "SERVICE_UNAVAILABLE",
        message: "Evaluation service not started",
      });
      return;
    }

    respond(true, { profiles: judgeStore.list() });
  });

  // evaluation.judges.set — create or update a judge profile
  api.registerGatewayMethod("evaluation.judges.set", (opts: GatewayRequestHandlerOptions) => {
    const { params, respond } = opts;
    if (!judgeStore) {
      respond(false, undefined, {
        code: "SERVICE_UNAVAILABLE",
        message: "Evaluation service not started",
      });
      return;
    }

    const profile = params.profile as JudgeProfile | undefined;
    if (!profile || !profile.id || !profile.name || !Array.isArray(profile.criteria)) {
      respond(false, undefined, {
        code: "INVALID_PARAMS",
        message: "Required: profile with id, name, criteria",
      });
      return;
    }

    judgeStore.set(profile);
    respond(true, { saved: true, profileId: profile.id });
  });

  // evaluation.model_comparison — A/B comparison results
  api.registerGatewayMethod("evaluation.model_comparison", (opts: GatewayRequestHandlerOptions) => {
    const { params, respond } = opts;
    if (!scorecardStore) {
      respond(false, undefined, {
        code: "SERVICE_UNAVAILABLE",
        message: "Evaluation service not started",
      });
      return;
    }

    const classificationLabel = asString(params.classificationLabel);
    const from = asString(params.from);
    const to = asString(params.to);

    if (!classificationLabel || !from || !to) {
      respond(false, undefined, {
        code: "INVALID_PARAMS",
        message: "Required: classificationLabel, from, to",
      });
      return;
    }

    // Fetch all scorecards in the time range
    const allCards = scorecardStore.query({ from, to });
    const comparison = aggregateModelComparison(allCards, { classificationLabel, from, to });
    respond(true, comparison);
  });

  // evaluation.tool_report — tool intelligence report for a run
  api.registerGatewayMethod("evaluation.tool_report", (opts: GatewayRequestHandlerOptions) => {
    const { params, respond } = opts;
    if (!scorecardStore) {
      respond(false, undefined, {
        code: "SERVICE_UNAVAILABLE",
        message: "Evaluation service not started",
      });
      return;
    }

    const runId = asString(params.runId);
    if (!runId) {
      respond(false, undefined, { code: "INVALID_PARAMS", message: "Required: runId" });
      return;
    }

    // Check if we have a stored scorecard with tool intelligence
    const card = scorecardStore.getByRunId(runId);
    if (card?.toolIntelligence) {
      respond(true, card.toolIntelligence);
      return;
    }

    // If tool events are provided in params, compute on-demand
    const toolEvents = params.toolEvents as ToolEvent[] | undefined;
    if (Array.isArray(toolEvents) && toolEvents.length > 0) {
      const report = buildToolIntelligenceReport(runId, toolEvents);
      respond(true, report);
      return;
    }

    respond(false, undefined, {
      code: "NOT_FOUND",
      message: `No tool intelligence report found for run ${runId}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Parameter helpers
// ---------------------------------------------------------------------------

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
