/**
 * Multi-factor memory relevance scoring system.
 *
 * Evaluates whether an experience should be persisted as a long-term memory
 * based on weighted factors: novelty, impact, relational, temporal, and user intent.
 *
 * @module scoring
 */

export {
  calculateFactors,
  scoreImpact,
  scoreNovelty,
  scoreRelational,
  scoreTemporal,
  scoreUserIntent,
} from "./factors.js";
export {
  DEFAULT_SCORING_CONFIG,
  DEFAULT_SCORING_OVERRIDES,
  DEFAULT_SCORING_THRESHOLDS,
  DEFAULT_SCORING_WEIGHTS,
  normalizeWeights,
  resolveScoringConfig,
  THRESHOLD_PROFILES,
} from "./config.js";
export type {
  ScoringConfig,
  ScoringContext,
  ScoringFactors,
  ScoringOverride,
  ScoringResult,
  ScoringThresholdProfile,
  ScoringWeights,
} from "./types.js";

import type { ScoringConfig, ScoringContext, ScoringOverride, ScoringResult } from "./types.js";
import { normalizeWeights, resolveScoringConfig } from "./config.js";
import { calculateFactors } from "./factors.js";

// ────────────────────────────────────────────────────────────────────────────
// Override Matching
// ────────────────────────────────────────────────────────────────────────────

/**
 * Check if a tool name matches a pattern (case-insensitive, supports exact match).
 * Supports '*' as a wildcard prefix/suffix.
 */
function matchesToolPattern(toolName: string, pattern: string): boolean {
  const name = toolName.toLowerCase();
  const pat = pattern.toLowerCase();

  if (pat === "*") return true;
  if (pat.startsWith("*") && pat.endsWith("*")) {
    return name.includes(pat.slice(1, -1));
  }
  if (pat.startsWith("*")) {
    return name.endsWith(pat.slice(1));
  }
  if (pat.endsWith("*")) {
    return name.startsWith(pat.slice(0, -1));
  }
  return name === pat;
}

/**
 * Find the first matching override for a tool name.
 */
function findOverride(toolName: string, overrides: ScoringOverride[]): ScoringOverride | undefined {
  return overrides.find((o) => matchesToolPattern(toolName, o.toolPattern));
}

// ────────────────────────────────────────────────────────────────────────────
// Main Scoring Function
// ────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate memory relevance for an experience using multi-factor scoring.
 *
 * This is the primary entry point for the scoring system. It:
 * 1. Checks for override rules that bypass factor calculation
 * 2. Calculates individual factor scores
 * 3. Applies normalized weights to compute a final score
 * 4. Applies any min/max score overrides
 * 5. Returns a detailed scoring result with breakdown
 *
 * @param ctx - Context about the experience being evaluated
 * @param config - Optional partial scoring config (defaults applied)
 * @returns Detailed scoring result with factor breakdown
 */
export function evaluateMemoryRelevance(
  ctx: ScoringContext,
  config?: Partial<ScoringConfig>,
): ScoringResult {
  const startMs = Date.now();
  const resolved = resolveScoringConfig(config);
  const weights = normalizeWeights(resolved.weights);

  // Check for overrides first
  const override = findOverride(ctx.tool.name, resolved.overrides);

  if (override?.decision === "always_capture") {
    const factors = calculateFactors(ctx);
    return {
      score: 1.0,
      factors,
      weights,
      overrideApplied: { toolPattern: override.toolPattern, decision: "always_capture" },
      reason: `always_capture override for '${override.toolPattern}'`,
      method: "override",
      durationMs: Date.now() - startMs,
    };
  }

  if (override?.decision === "always_skip") {
    const factors = calculateFactors(ctx);
    return {
      score: 0.0,
      factors,
      weights,
      overrideApplied: { toolPattern: override.toolPattern, decision: "always_skip" },
      reason: `always_skip override for '${override.toolPattern}'`,
      method: "override",
      durationMs: Date.now() - startMs,
    };
  }

  if (override?.fixedScore !== undefined) {
    const factors = calculateFactors(ctx);
    return {
      score: Math.max(0, Math.min(1, override.fixedScore)),
      factors,
      weights,
      overrideApplied: { toolPattern: override.toolPattern },
      reason: `fixed_score override (${override.fixedScore}) for '${override.toolPattern}'`,
      method: "override",
      durationMs: Date.now() - startMs,
    };
  }

  // Calculate individual factor scores
  const factors = calculateFactors(ctx);

  // Compute weighted score
  let score =
    factors.novelty * weights.novelty +
    factors.impact * weights.impact +
    factors.relational * weights.relational +
    factors.temporal * weights.temporal +
    factors.userIntent * weights.userIntent;

  // Apply min/max overrides if present
  let overrideApplied: ScoringResult["overrideApplied"];
  if (override) {
    if (override.minScore !== undefined && score < override.minScore) {
      score = override.minScore;
      overrideApplied = { toolPattern: override.toolPattern };
    }
    if (override.maxScore !== undefined && score > override.maxScore) {
      score = override.maxScore;
      overrideApplied = { toolPattern: override.toolPattern };
    }
  }

  // Clamp final score
  score = Math.max(0, Math.min(1, score));

  // Build reason string
  const topFactors = Object.entries(factors)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([name, val]) => `${name}=${val.toFixed(2)}`)
    .join(", ");

  const reason = overrideApplied
    ? `weighted(${topFactors}) + override(${override!.toolPattern})`
    : `weighted(${topFactors})`;

  return {
    score,
    factors,
    weights,
    overrideApplied,
    reason,
    method: "heuristic",
    durationMs: Date.now() - startMs,
  };
}

/**
 * Check if a score meets the capture threshold.
 */
export function shouldCapture(score: number, config?: Partial<ScoringConfig>): boolean {
  const resolved = resolveScoringConfig(config);
  return score >= resolved.thresholds.captureThreshold;
}

/**
 * Check if a score meets the graph persistence threshold.
 */
export function shouldPersistToGraph(score: number, config?: Partial<ScoringConfig>): boolean {
  const resolved = resolveScoringConfig(config);
  return score >= resolved.thresholds.graphPersistThreshold;
}

/**
 * Check if a score warrants LLM-assisted evaluation for refinement.
 */
export function shouldUseLlmEval(score: number, config?: Partial<ScoringConfig>): boolean {
  const resolved = resolveScoringConfig(config);
  return score >= resolved.thresholds.llmEvalThreshold;
}
