/**
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
 */
export type ScoringWeights = {
  novelty: number;
  impact: number;
  relational: number;
  temporal: number;
  userIntent: number;
};

/**
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
};

/**
 * Complete scoring configuration.
 */
export type ScoringConfig = {
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
};
