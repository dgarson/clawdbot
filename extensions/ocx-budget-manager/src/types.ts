/**
 * Budget scope within the hierarchy: system -> organization -> team -> agent -> session.
 */
export type BudgetScope = {
  /** Scope level in the hierarchy */
  level: "system" | "organization" | "team" | "agent" | "session";
  /** Identifier within the level */
  id: string;
  /** Parent scope ID (null for system) */
  parentId: string | null;
};

/**
 * Time window for budget allocation periods.
 */
export type BudgetWindow =
  | { kind: "hourly" }
  | { kind: "daily" }
  | { kind: "weekly" }
  | { kind: "monthly" }
  | { kind: "sprint"; sprintId: string }
  | { kind: "rolling"; durationMs: number };

/**
 * Budget limits and enforcement configuration for a scope.
 */
export type BudgetAllocation = {
  scope: BudgetScope;
  /** Budget window */
  window: BudgetWindow;
  /** Limits for this window */
  limits: {
    maxInputTokens?: number;
    maxOutputTokens?: number;
    maxTotalTokens?: number;
    maxCostUsd?: number;
    maxRuns?: number;
  };
  /** Action when limit is reached */
  breachAction: "warn" | "degrade" | "block";
  /** Model to degrade to when breachAction = "degrade" */
  degradeModel?: string;
  /** Alert thresholds (percentage of limit consumed) */
  alertAt: number[];
};

/**
 * Current usage for a scope within a window.
 */
export type BudgetUsage = {
  scope: BudgetScope;
  windowStart: string;
  windowEnd: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  runCount: number;
  /** Derived: usage / limit as percentage per dimension */
  utilizationPct: Record<string, number>;
};

/**
 * Result of evaluating admission for an agent run.
 */
export type AdmissionDecision =
  | { decision: "allow" }
  | { decision: "degrade"; limitScope: BudgetScope; degradeModel: string }
  | { decision: "block"; blockingScope: BudgetScope };

/**
 * Single usage increment from an LLM call.
 */
export type UsageIncrement = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  runId: string;
  agentId: string;
  model?: string;
};

/**
 * A single JSONL ledger entry persisted to disk.
 */
export type LedgerEntry = {
  ts: string;
  scopeLevel: BudgetScope["level"];
  scopeId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  runId: string;
  agentId: string;
};

/**
 * Alert record emitted when a threshold is crossed.
 */
export type BudgetAlert = {
  scope: BudgetScope;
  threshold: number;
  dimension: string;
  currentPct: number;
  timestamp: string;
};
