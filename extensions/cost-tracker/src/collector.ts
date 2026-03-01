import { appendBounded, onDiagnosticEvent } from "../../../src/plugin-sdk/index.js";
import type { OpenClawPluginApi, PluginHookLlmApiCallEvent } from "../../../src/plugins/types.js";
import type { CostTrackerStore } from "./store.js";
import type { ExtensionUsageEntry } from "./types.js";

export function registerCostCollector(api: OpenClawPluginApi, store: CostTrackerStore): void {
  // Track run initialization
  api.on("run_start", (event, ctx) => {
    const runEvent = event as Record<string, unknown>;
    const agentCtx = ctx as Record<string, unknown>;
    const sessionId = (agentCtx.sessionId ?? agentCtx.sessionKey) as string | undefined;
    const runId = runEvent.runId as string | undefined;
    if (!sessionId || !runId) {
      return;
    }
    store.updateRun(sessionId, runId, (r) => {
      r.runId = runId;
      r.startedAt = Date.now();
    });
  });

  // Accumulate per-call LLM costs
  api.on("llm_api_call", (event, _ctx) => {
    const e = event as PluginHookLlmApiCallEvent;
    const sessionId = e.sessionId ?? e.sessionKey;
    if (!sessionId) {
      return;
    }

    store.update(sessionId, (s) => {
      s.sessionId = s.sessionId || sessionId;
      s.sessionKey = s.sessionKey || e.sessionKey;
      s.agentId = s.agentId || e.agentId;
      s.llm.totalApiCalls += 1;
      if (e.source === "agent") s.llm.agentCalls += 1;
      else if (e.source === "compaction") s.llm.compactionCalls += 1;
      else if (e.source === "tool") s.llm.toolCalls += 1;
      else if (e.source === "extension") s.llm.extensionCalls += 1;
      s.llm.inputTokens += e.inputTokens ?? 0;
      s.llm.outputTokens += e.outputTokens ?? 0;
      s.llm.cacheReadTokens += e.cacheReadTokens ?? 0;
      s.llm.cacheWriteTokens += e.cacheWriteTokens ?? 0;
      s.llm.totalCostUsd += e.costUsd ?? 0;
      s.totalCostUsd = s.llm.totalCostUsd + s.extensions.totalCostUsd;

      if (e.provider && e.model) {
        let entry = s.llm.byModel.find((m) => m.provider === e.provider && m.model === e.model);
        if (!entry) {
          entry = {
            provider: e.provider,
            model: e.model,
            calls: 0,
            costUsd: 0,
            inputTokens: 0,
            outputTokens: 0,
          };
          s.llm.byModel.push(entry);
        }
        entry.calls += 1;
        entry.costUsd += e.costUsd ?? 0;
        entry.inputTokens += e.inputTokens ?? 0;
        entry.outputTokens += e.outputTokens ?? 0;
      }

      const now = Date.now();
      if (!s.firstActivityAt) s.firstActivityAt = now;
      s.lastActivityAt = now;
      s.updatedAt = now;
    });

    if (e.runId) {
      store.updateRun(sessionId, e.runId, (r) => {
        r.llmApiCalls += 1;
        r.inputTokens += e.inputTokens ?? 0;
        r.outputTokens += e.outputTokens ?? 0;
        r.cacheReadTokens += e.cacheReadTokens ?? 0;
        r.cacheWriteTokens += e.cacheWriteTokens ?? 0;
        r.costUsd += e.costUsd ?? 0;
        r.totalDurationMs += e.durationMs ?? 0;
        if (!r.provider && e.provider) r.provider = e.provider;
        if (!r.model && e.model) r.model = e.model;
      });
    }
  });

  // Accumulate extension usage (from api.recordUsage() / usage.record diagnostic events)
  onDiagnosticEvent((evt) => {
    if (evt.type !== "usage.record") {
      return;
    }
    const sessionId = evt.sessionId ?? evt.sessionKey;
    if (!sessionId) {
      return;
    }

    const costUsd = evt.billing?.costUsd ?? 0;
    const entry: ExtensionUsageEntry = {
      ts: evt.ts,
      kind: evt.kind,
      runId: evt.runId,
      toolCallId: evt.toolCallId,
      provider: evt.provider,
      model: evt.model,
      llm: evt.llm
        ? {
            apiCallCount: evt.llm.apiCallCount,
            totalDurationMs: evt.llm.totalDurationMs,
            inputTokens: evt.llm.inputTokens,
            outputTokens: evt.llm.outputTokens,
            costUsd: evt.llm.costUsd,
          }
        : undefined,
      billing: evt.billing
        ? { units: evt.billing.units, unitType: evt.billing.unitType, costUsd: evt.billing.costUsd }
        : undefined,
      metadata: evt.metadata,
    };

    store.update(sessionId, (s) => {
      // Bounded list — drop oldest when > 500
      appendBounded(s.extensions.entries, entry, 500);

      const kind = evt.kind;
      if (!s.extensions.byKind[kind]) {
        s.extensions.byKind[kind] = { count: 0, totalCostUsd: 0 };
      }
      s.extensions.byKind[kind].count += 1;
      s.extensions.byKind[kind].totalCostUsd += costUsd;
      if (evt.billing?.units !== undefined) {
        s.extensions.byKind[kind].totalUnits =
          (s.extensions.byKind[kind].totalUnits ?? 0) + evt.billing.units;
        s.extensions.byKind[kind].unitType = evt.billing.unitType;
      }
      s.extensions.totalCostUsd += costUsd;
      s.totalCostUsd = s.llm.totalCostUsd + s.extensions.totalCostUsd;
      s.updatedAt = Date.now();
    });

    if (evt.runId) {
      store.updateRun(sessionId, evt.runId, (r) => {
        r.extensionCostUsd += costUsd;
      });
    }
  });

  // Reconcile with model.usage cumulative totals (use as source of truth for session LLM totals)
  onDiagnosticEvent((evt) => {
    if (evt.type !== "model.usage") {
      return;
    }
    const sessionId = evt.sessionId ?? evt.sessionKey;
    if (!sessionId) {
      return;
    }
    store.update(sessionId, (s) => {
      if (evt.costUsd !== undefined) {
        s.llm.totalCostUsd = evt.costUsd;
        s.totalCostUsd = s.llm.totalCostUsd + s.extensions.totalCostUsd;
      }
      if (evt.usage?.input !== undefined) s.llm.inputTokens = evt.usage.input;
      if (evt.usage?.output !== undefined) s.llm.outputTokens = evt.usage.output;
      if (evt.usage?.cacheRead !== undefined) s.llm.cacheReadTokens = evt.usage.cacheRead;
      if (evt.usage?.cacheWrite !== undefined) s.llm.cacheWriteTokens = evt.usage.cacheWrite;
      s.updatedAt = Date.now();
    });
  });
}
