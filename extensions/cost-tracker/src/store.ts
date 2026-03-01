import path from "node:path";
import {
  createSessionRuntimeStore,
  wireSessionLifecycleHooks,
  type SessionRuntimeStore,
} from "../../../src/plugin-sdk/index.js";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import type { CostTrackerRunState, CostTrackerSessionState } from "./types.js";

export type CostTrackerStore = SessionRuntimeStore<CostTrackerSessionState, CostTrackerRunState>;

export function createCostTrackerStore(stateDir: string): CostTrackerStore {
  return createSessionRuntimeStore<CostTrackerSessionState, CostTrackerRunState>({
    stateDir: path.join(stateDir, "cost-tracker"),
    maxEntries: 200,
    ttlMs: 2 * 60 * 60 * 1000, // 2 hours
    create: (): CostTrackerSessionState => ({
      sessionId: "",
      llm: {
        totalCostUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalApiCalls: 0,
        agentCalls: 0,
        compactionCalls: 0,
        toolCalls: 0,
        extensionCalls: 0,
        byModel: [],
      },
      extensions: { totalCostUsd: 0, entries: [], byKind: {} },
      totalCostUsd: 0,
      updatedAt: Date.now(),
    }),
    initialRun: (): CostTrackerRunState => ({
      runId: "",
      provider: undefined,
      model: undefined,
      llmApiCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0,
      totalDurationMs: 0,
      extensionCostUsd: 0,
      startedAt: undefined,
    }),
  });
}

export function wireCostTrackerHooks(api: OpenClawPluginApi, store: CostTrackerStore): void {
  wireSessionLifecycleHooks(api as Parameters<typeof wireSessionLifecycleHooks>[0], store);
}
