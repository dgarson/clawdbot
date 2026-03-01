/**
 * Core types for the observability plugin.
 * Covers health evaluation, anomaly signals, suppression, and reaper policies.
 */

// =============================================================================
// Health State
// =============================================================================

export type HealthState = "healthy" | "degraded" | "stuck" | "rogue" | "zombie";

export type HealthEvaluation = {
  agentId: string;
  state: HealthState;
  signals: HealthSignal[];
  evaluatedAt: string;
  previousState?: HealthState;
  stateChangedAt?: string;
};

export type HealthSignal = {
  kind: string;
  severity: "info" | "warning" | "critical";
  value: number;
  threshold: number;
  message: string;
};

// =============================================================================
// Health Criteria (Configurable Thresholds)
// =============================================================================

export type HealthCriteria = {
  /** No events for this duration -> "stuck" */
  stuckTimeoutMinutes: number;

  /** Token usage > movingAvg * this factor -> "rogue" signal */
  tokenSpikeMultiplier: number;

  /** Moving average window for token usage */
  tokenMovingAvgWindowMinutes: number;

  /** Error rate (errors / total runs) > this -> "degraded" signal */
  errorRateThreshold: number;

  /** Error rate window */
  errorRateWindowMinutes: number;

  /** Budget utilization > this -> "degraded" signal */
  budgetDegradedThreshold: number;

  /** Consecutive tool failures > this -> "degraded" signal */
  maxConsecutiveToolFailures: number;

  /** Tool loop detection: same tool called > N times in M minutes */
  toolLoopCallThreshold: number;
  toolLoopWindowMinutes: number;

  /** Heartbeat timeout for zombie detection */
  heartbeatTimeoutMinutes: number;
};

// =============================================================================
// Anomaly Detection
// =============================================================================

export type AnomalyRuleKind =
  | "token_spike"
  | "error_burst"
  | "tool_loop"
  | "cost_spike"
  | "session_overflow"
  | "unusual_model";

export type AnomalyRule = {
  kind: AnomalyRuleKind;
  evaluate: (ctx: AnomalyEvalContext) => HealthSignal | undefined;
};

export type AnomalyEvalContext = {
  agentId: string;
  criteria: HealthCriteria;
  stats: AgentStats;
};

// =============================================================================
// Agent Statistics (Collected from Events)
// =============================================================================

export type AgentStats = {
  lastEventAt: number;
  lastHeartbeatAt: number;
  totalTokensWindow: number;
  movingAvgTokens: number;
  errorsInWindow: number;
  totalRunsInWindow: number;
  budgetUtilization: number;
  consecutiveToolFailures: number;
  toolCallsWindow: Map<string, number>;
  costWindow: number;
  previousCostWindow: number;
  activeSessions: number;
  maxSessions: number;
  modelsUsed: Set<string>;
  configuredModels: Set<string>;
};

// =============================================================================
// Suppression
// =============================================================================

export type SuppressionRule = {
  signalKind: string;
  /** Don't re-alert within this window after last alert */
  cooldownMinutes: number;
  /** Maximum alerts per hour for this signal kind */
  maxPerHour: number;
};

// =============================================================================
// Reaper Policies
// =============================================================================

export type ReaperPolicy = {
  /** Health state that triggers this policy */
  triggerState: "stuck" | "rogue" | "zombie";
  /** Actions to take, in order */
  actions: ReaperAction[];
  /** Require human confirmation before destructive actions */
  requireConfirmation: boolean;
};

export type ReaperAction =
  | { kind: "alert"; target: "broadcast" | "webhook"; webhookUrl?: string }
  | { kind: "throttle"; delayMs: number }
  | { kind: "pause"; durationMinutes: number }
  | { kind: "cancel_run"; runId?: string }
  | { kind: "terminate_session"; sessionKey?: string; reason: string };

export type ReaperActionRecord = {
  id: string;
  agentId: string;
  state: HealthState;
  action: ReaperAction;
  executedAt: string;
  confirmed: boolean;
  pendingConfirmation: boolean;
};

// =============================================================================
// Pending Confirmation
// =============================================================================

export type PendingConfirmation = {
  id: string;
  agentId: string;
  state: HealthState;
  action: ReaperAction;
  createdAt: string;
};
