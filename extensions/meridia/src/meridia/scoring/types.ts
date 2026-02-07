/**
<<<<<<< HEAD
 * Types for the multi-factor memory relevance scoring system.
 *
 * The scoring system evaluates whether an experience should be persisted
 * as a long-term memory based on multiple weighted factors.
 */

/**
 * Individual factor scores, each normalized to [0, 1].
 */
export type ScoringFactors = {
  /** Is this new information or a repetition of known patterns? */
  novelty: number;
  /** Does this change understanding, behavior, or system state? */
  impact: number;
  /** Does this connect to known entities, people, or projects? */
  relational: number;
  /** Is this time-sensitive or evergreen information? */
  temporal: number;
  /** Was this explicitly marked as important by the user or agent? */
  userIntent: number;
};

/**
 * Configuration weights for each scoring factor.
 * Weights are relative — they are normalized to sum to 1.0 during scoring.
=======
 * Memory Relevance Scoring System — Types
 *
 * Multi-factor scoring model for determining which experiences
 * should be promoted to long-term memory (Graphiti episodes).
 */

// ────────────────────────────────────────────────────────────────────────────
// Factor Scores
// ────────────────────────────────────────────────────────────────────────────

/**
 * Individual factor in the relevance scoring breakdown.
 * Each factor is scored 0..1 and contributes a weighted amount to the final score.
 */
export type ScoringFactor = {
  /** Factor name identifier */
  name: string;
  /** Raw score before weighting (0..1) */
  rawScore: number;
  /** Weight applied to this factor */
  weight: number;
  /** Weighted contribution (rawScore * weight) */
  weighted: number;
  /** Human-readable reason for this score */
  reason?: string;
};

/**
 * Complete scoring breakdown for a single evaluation.
 */
export type ScoringBreakdown = {
  /** Individual factor scores */
  factors: ScoringFactor[];
  /** Sum of all weights (for normalization) */
  totalWeight: number;
  /** Final composite score (0..1) */
  compositeScore: number;
  /** Whether manual override was applied */
  overridden: boolean;
  /** Override source if applied */
  overrideSource?: "user_intent" | "tool_rule" | "pattern_rule";
  /** Time to compute in ms */
  computeMs?: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Factor Computation Context
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extended context for multi-factor scoring.
 * Includes everything from MeridiaToolResultContext plus additional signals.
 */
export type ScoringContext = {
  /** Tool information */
  tool: {
    name: string;
    callId: string;
    meta?: string;
    isError: boolean;
  };
  /** Session context */
  session?: {
    key?: string;
    id?: string;
    runId?: string;
  };
  /** Tool arguments */
  args?: unknown;
  /** Tool result */
  result?: unknown;
  /** Prior capture history for this session (for novelty detection) */
  recentCaptures?: Array<{
    ts: string;
    toolName: string;
    score: number;
  }>;
  /** Whether the user explicitly marked this important */
  userMarkedImportant?: boolean;
  /** Tags from content extraction */
  contentTags?: string[];
  /** Summary text from content extraction */
  contentSummary?: string;
  /** The heuristic evaluation already computed */
  heuristicEval?: {
    score: number;
    reason?: string;
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Scoring Configuration
// ────────────────────────────────────────────────────────────────────────────

/**
 * Weights for each scoring factor. All values 0..1.
 * Factors with weight 0 are effectively disabled.
>>>>>>> origin/main
 */
export type ScoringWeights = {
  novelty: number;
  impact: number;
  relational: number;
  temporal: number;
  userIntent: number;
};

/**
<<<<<<< HEAD
 * A named threshold profile for different use cases.
 */
export type ScoringThresholdProfile = {
  /** Minimum score to capture as experience */
  captureThreshold: number;
  /** Minimum score to persist to graph memory */
  graphPersistThreshold: number;
  /** Minimum score for LLM-assisted evaluation */
  llmEvalThreshold: number;
};

/**
 * Override rules for specific tools or patterns.
 */
export type ScoringOverride = {
  /** Tool name pattern (supports glob-like matching) */
  toolPattern: string;
  /** Fixed score to assign, bypassing factor calculation */
  fixedScore?: number;
  /** Minimum score floor for this pattern */
  minScore?: number;
  /** Maximum score ceiling for this pattern */
  maxScore?: number;
  /** Skip evaluation entirely (always capture or always skip) */
  decision?: "always_capture" | "always_skip";
=======
 * Tool-specific override rule.
 * When a tool matches, its override score replaces the composite score.
 */
export type ToolOverrideRule = {
  /** Tool name pattern (exact match or glob-like with *) */
  toolPattern: string;
  /** Fixed score to assign (0..1), or undefined to use computed score */
  fixedScore?: number;
  /** Minimum score floor for this tool */
  minScore?: number;
  /** Maximum score cap for this tool */
  maxScore?: number;
  /** Additional weight multiplier for this tool */
  weightMultiplier?: number;
};

/**
 * Pattern-based override rule.
 * Matches on content characteristics rather than tool name.
 */
export type PatternOverrideRule = {
  /** Descriptive name for this rule */
  name: string;
  /** Condition to match */
  condition:
    | { type: "error" }
    | { type: "largeResult"; minChars: number }
    | { type: "toolName"; pattern: string }
    | { type: "hasTag"; tag: string };
  /** Score adjustment: "set" replaces, "boost" adds, "floor" sets minimum */
  action:
    | { type: "set"; score: number }
    | { type: "boost"; amount: number }
    | { type: "floor"; score: number };
};

/**
 * Threshold profile for different operational modes.
 */
export type ThresholdProfile = {
  /** Profile name */
  name: string;
  /** Minimum composite score to capture */
  captureThreshold: number;
  /** Score at which LLM evaluation is triggered (below this, heuristic only) */
  llmEvalThreshold?: number;
  /** Score at which record is considered "high value" for priority persistence */
  highValueThreshold?: number;
>>>>>>> origin/main
};

/**
 * Complete scoring configuration.
 */
export type ScoringConfig = {
<<<<<<< HEAD
  /** Relative weights for each factor */
  weights: ScoringWeights;
  /** Threshold profile */
  thresholds: ScoringThresholdProfile;
  /** Override rules for specific tools */
  overrides: ScoringOverride[];
};

/**
 * Result of a multi-factor scoring evaluation.
 */
export type ScoringResult = {
  /** Final weighted score [0, 1] */
  score: number;
  /** Individual factor scores */
  factors: ScoringFactors;
  /** Weights used for this evaluation */
  weights: ScoringWeights;
  /** Whether the score was overridden by a rule */
  overrideApplied?: {
    toolPattern: string;
    decision?: "always_capture" | "always_skip";
  };
  /** Human-readable explanation of the score */
  reason: string;
  /** Scoring method used */
  method: "heuristic" | "llm" | "override";
  /** Duration of scoring evaluation */
  durationMs?: number;
};

/**
 * Context passed to factor scorers for evaluation.
 */
export type ScoringContext = {
  /** Tool invocation details */
  tool: {
    name: string;
    callId: string;
    meta?: string;
    isError: boolean;
  };
  /** Tool arguments */
  args?: unknown;
  /** Tool result */
  result?: unknown;
  /** Session context */
  session?: {
    key?: string;
    id?: string;
    runId?: string;
  };
  /** Known entity names for relational scoring (from memory) */
  knownEntities?: string[];
  /** Whether the user explicitly requested capture */
  explicitCapture?: boolean;
  /** Tags provided by user or agent */
  tags?: string[];
=======
  /** Factor weights */
  weights: ScoringWeights;
  /** Active threshold profile name */
  activeProfile: string;
  /** Available threshold profiles */
  profiles: Record<string, ThresholdProfile>;
  /** Tool-specific override rules */
  toolOverrides: ToolOverrideRule[];
  /** Pattern-based override rules */
  patternOverrides: PatternOverrideRule[];
  /** Whether to include scoring breakdown in trace events */
  includeBreakdownInTrace: boolean;
>>>>>>> origin/main
};
