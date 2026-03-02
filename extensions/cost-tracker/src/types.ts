// Extension usage entry (from api.recordUsage() / usage.record diagnostic events)
export type ExtensionUsageEntry = {
  ts: number;
  kind: string;
  runId?: string;
  toolCallId?: string;
  provider?: string;
  model?: string;
  llm?: {
    apiCallCount: number;
    totalDurationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
  };
  billing?: {
    units?: number;
    unitType?: string;
    costUsd?: number;
  };
  metadata?: Record<string, unknown>;
};

// Per-run sub-state stored inside each session entry
export type CostTrackerRunState = {
  runId: string;
  provider?: string;
  model?: string;
  llmApiCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  totalDurationMs: number;
  extensionCostUsd: number;
  startedAt?: number;
};

// Per-session accumulated state
export type CostTrackerSessionState = {
  sessionId: string;
  sessionKey?: string;
  agentId?: string;
  llm: {
    totalCostUsd: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    totalApiCalls: number;
    agentCalls: number;
    compactionCalls: number;
    toolCalls: number;
    extensionCalls: number;
    byModel: Array<{
      provider: string;
      model: string;
      calls: number;
      costUsd: number;
      inputTokens: number;
      outputTokens: number;
    }>;
  };
  extensions: {
    totalCostUsd: number;
    entries: ExtensionUsageEntry[];
    byKind: Record<
      string,
      { count: number; totalCostUsd: number; totalUnits?: number; unitType?: string }
    >;
  };
  totalCostUsd: number;
  firstActivityAt?: number;
  lastActivityAt?: number;
  updatedAt: number;
};
