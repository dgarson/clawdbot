/**
 * Core types for the evaluation plugin.
 * Mirrors the shapes defined in the plan document (agent-platform-05).
 */

// ---------------------------------------------------------------------------
// Judge Profiles
// ---------------------------------------------------------------------------

export type JudgeCriterion = {
  id: string;
  name: string;
  description: string;
  /** Relative weight (weights are normalized to sum to 1.0). */
  weight: number;
};

export type JudgeProfile = {
  id: string;
  /** Increment when criteria change to keep historical scores comparable. */
  version: number;
  name: string;
  /** Task classification labels this judge applies to. */
  matchLabels: string[];
  method: "llm" | "heuristic" | "hybrid";
  /** For LLM method: model to use for judging. */
  judgeModel?: string;
  criteria: JudgeCriterion[];
  /** Automatic score of 0 if any disqualifier triggers. */
  disqualifiers: string[];
  scale: { min: number; max: number };
};

// ---------------------------------------------------------------------------
// Scorecard
// ---------------------------------------------------------------------------

export type ScorecardHumanOverride = {
  overrideScore: number;
  annotator: string;
  reason: string;
  overriddenAt: string;
};

export type Scorecard = {
  runId: string;
  agentId: string;
  sessionKey: string;
  judgeProfileId: string;
  judgeProfileVersion: number;
  /** Overall score (weighted average of criteria scores). */
  overallScore: number;
  /** Per-criterion scores keyed by criterion id. */
  criteriaScores: Record<string, number>;
  /** Confidence in the scores (0-1). */
  confidence: number;
  /** LLM judge reasoning (if method = "llm" or "hybrid"). */
  reasoning?: string;
  disqualified: boolean;
  disqualifierTriggered?: string;
  humanOverride?: ScorecardHumanOverride;
  toolIntelligence?: ToolIntelligenceReport;
  scoredAt: string;
  /** Model used for the run (for comparison aggregation). */
  model?: string;
  /** Provider used for the run. */
  provider?: string;
  /** Classification label from routing. */
  classificationLabel?: string;
  /** Cost in USD for the run. */
  costUsd?: number;
  /** Total tokens consumed. */
  totalTokens?: number;
  /** Duration in ms. */
  durationMs?: number;
};

// ---------------------------------------------------------------------------
// Tool Intelligence
// ---------------------------------------------------------------------------

export type ToolCorrection = {
  originalCallId: string;
  originalToolName: string;
  correctedCallId: string;
  correctedToolName: string;
  reason: "same_goal_different_tool" | "retry_with_different_params" | "fallback_after_error";
};

export type ToolRepetition = {
  toolName: string;
  callIds: string[];
  /** Similarity of parameters (0-1). */
  paramSimilarity: number;
};

export type ToolIntelligenceReport = {
  runId: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  corrections: ToolCorrection[];
  /** Tool call IDs whose results were never referenced in subsequent output. */
  wastedCalls: string[];
  repeatedCalls: ToolRepetition[];
  /** Effectiveness score (0-100). */
  effectivenessScore: number;
};

// ---------------------------------------------------------------------------
// Model Comparison
// ---------------------------------------------------------------------------

export type ModelComparisonEntry = {
  model: string;
  provider: string;
  runCount: number;
  avgScore: number;
  avgCostUsd: number;
  avgTokens: number;
  avgDurationMs: number;
  /** Score per dollar -- efficiency metric. */
  scorePerDollar: number;
};

export type ModelComparison = {
  classificationLabel: string;
  timeRange: { from: string; to: string };
  models: ModelComparisonEntry[];
};

// ---------------------------------------------------------------------------
// Internal event shape for tool events consumed by the analyzer
// ---------------------------------------------------------------------------

export type ToolEvent = {
  eventId: string;
  toolName: string;
  params: Record<string, unknown>;
  success: boolean;
  error?: string;
  /** ISO timestamp. */
  timestamp: string;
};
