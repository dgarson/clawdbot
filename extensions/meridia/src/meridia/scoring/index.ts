/**
 * Memory Relevance Scoring System
 *
 * Multi-factor scoring model for determining which experiences
 * should be promoted to long-term memory.
 *
 * Usage:
 *   import { evaluateMemoryRelevance, shouldCapture } from "./scoring/index.js";
 *
 *   const breakdown = evaluateMemoryRelevance(ctx);
 *   if (shouldCapture(breakdown)) {
 *     // persist to Graphiti / long-term storage
 *   }
 */

// Types
export type {
  ScoringFactor,
  ScoringBreakdown,
  ScoringContext,
  ScoringWeights,
  ScoringConfig,
  ToolOverrideRule,
  PatternOverrideRule,
  ThresholdProfile,
} from "./types.js";

// Factor scorers (individual)
export {
  scoreNovelty,
  scoreImpact,
  scoreRelational,
  scoreTemporal,
  scoreUserIntent,
  computeAllFactors,
} from "./factors.js";

// Main scorer
export {
  evaluateMemoryRelevance,
  shouldCapture,
  isHighValue,
  shouldUseLlmEval,
  getActiveProfile,
  formatBreakdown,
  breakdownToTrace,
} from "./scorer.js";

// Defaults
export { DEFAULT_SCORING_CONFIG, DEFAULT_WEIGHTS, DEFAULT_PROFILES } from "./defaults.js";
