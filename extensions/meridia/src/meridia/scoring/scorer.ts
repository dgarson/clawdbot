/**
 * Memory Relevance Scoring System — Main Scorer
 *
 * Composes factor scores, applies overrides, and produces
 * the final ScoringBreakdown for capture decisions.
 */

import type {
  PatternOverrideRule,
  ScoringBreakdown,
  ScoringConfig,
  ScoringContext,
  ScoringFactor,
  ThresholdProfile,
  ToolOverrideRule,
} from "./types.js";
import { DEFAULT_SCORING_CONFIG } from "./defaults.js";
import { computeAllFactors, matchesGlob } from "./factors.js";

// ────────────────────────────────────────────────────────────────────────────
// Utility
// ────────────────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function summarizeSize(value: unknown): number {
  if (value === undefined || value === null) return 0;
  try {
    return JSON.stringify(value).length;
  } catch {
    return String(value).length;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Override Application
// ────────────────────────────────────────────────────────────────────────────

function findToolOverride(
  toolName: string,
  overrides: ToolOverrideRule[],
): ToolOverrideRule | undefined {
  const lower = toolName.toLowerCase();
  return overrides.find((rule) => matchesGlob(rule.toolPattern.toLowerCase(), lower));
}

function applyToolOverride(
  score: number,
  rule: ToolOverrideRule,
): { score: number; applied: boolean } {
  let applied = false;
  let result = score;

  if (rule.fixedScore !== undefined) {
    result = rule.fixedScore;
    applied = true;
  }

  if (rule.weightMultiplier !== undefined) {
    result *= rule.weightMultiplier;
    applied = true;
  }

  if (rule.minScore !== undefined && result < rule.minScore) {
    result = rule.minScore;
    applied = true;
  }

  if (rule.maxScore !== undefined && result > rule.maxScore) {
    result = rule.maxScore;
    applied = true;
  }

  return { score: clamp01(result), applied };
}

function evaluatePatternCondition(ctx: ScoringContext, rule: PatternOverrideRule): boolean {
  const cond = rule.condition;
  switch (cond.type) {
    case "error":
      return ctx.tool.isError;
    case "largeResult":
      return summarizeSize(ctx.result) >= cond.minChars;
    case "toolName":
      return matchesGlob(cond.pattern.toLowerCase(), ctx.tool.name.toLowerCase());
    case "hasTag":
      return (ctx.contentTags ?? []).includes(cond.tag);
    default:
      return false;
  }
}

function applyPatternOverride(score: number, rule: PatternOverrideRule): number {
  const action = rule.action;
  switch (action.type) {
    case "set":
      return clamp01(action.score);
    case "boost":
      return clamp01(score + action.amount);
    case "floor":
      return Math.max(score, action.score);
    default:
      return score;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main Scoring Function
// ────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate the memory relevance of an experience.
 *
 * Returns a complete ScoringBreakdown with factor-by-factor analysis,
 * override information, and the final composite score.
 */
export function evaluateMemoryRelevance(
  ctx: ScoringContext,
  config?: Partial<ScoringConfig>,
): ScoringBreakdown {
  const startMs = Date.now();
  const cfg = resolveConfig(config);

  // 1. Compute all factor scores
  const factors = computeAllFactors(ctx, cfg.weights);

  // 2. Calculate weighted composite
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  let compositeScore =
    totalWeight > 0 ? factors.reduce((sum, f) => sum + f.weighted, 0) / totalWeight : 0;

  let overridden = false;
  let overrideSource: ScoringBreakdown["overrideSource"];

  // 3. Apply tool-specific overrides
  const toolOverride = findToolOverride(ctx.tool.name, cfg.toolOverrides);
  if (toolOverride) {
    const result = applyToolOverride(compositeScore, toolOverride);
    if (result.applied) {
      compositeScore = result.score;
      overridden = true;
      overrideSource = "tool_rule";
    }
  }

  // 4. Apply pattern-based overrides
  for (const rule of cfg.patternOverrides) {
    if (evaluatePatternCondition(ctx, rule)) {
      compositeScore = applyPatternOverride(compositeScore, rule);
      overridden = true;
      overrideSource = "pattern_rule";
    }
  }

  // 5. Apply user intent override (highest priority)
  if (ctx.userMarkedImportant) {
    compositeScore = Math.max(compositeScore, 0.9);
    overridden = true;
    overrideSource = "user_intent";
  }

  return {
    factors,
    totalWeight,
    compositeScore: clamp01(compositeScore),
    overridden,
    overrideSource,
    computeMs: Date.now() - startMs,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Threshold Checks
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get the active threshold profile from the config.
 */
export function getActiveProfile(config?: Partial<ScoringConfig>): ThresholdProfile {
  const cfg = resolveConfig(config);
  return cfg.profiles[cfg.activeProfile] ?? cfg.profiles["standard"]!;
}

/**
 * Check whether a score meets the capture threshold.
 */
export function shouldCapture(
  breakdown: ScoringBreakdown,
  config?: Partial<ScoringConfig>,
): boolean {
  const profile = getActiveProfile(config);
  return breakdown.compositeScore >= profile.captureThreshold;
}

/**
 * Check whether a score qualifies as "high value" for priority persistence.
 */
export function isHighValue(breakdown: ScoringBreakdown, config?: Partial<ScoringConfig>): boolean {
  const profile = getActiveProfile(config);
  return (
    profile.highValueThreshold !== undefined &&
    breakdown.compositeScore >= profile.highValueThreshold
  );
}

/**
 * Check whether the LLM evaluator should be invoked for more accurate scoring.
 * Returns true when the heuristic score is in the uncertain zone.
 */
export function shouldUseLlmEval(
  breakdown: ScoringBreakdown,
  config?: Partial<ScoringConfig>,
): boolean {
  const profile = getActiveProfile(config);
  if (profile.llmEvalThreshold === undefined) return false;

  // Use LLM eval when score is in the uncertain band between llmEvalThreshold and captureThreshold + margin
  return (
    breakdown.compositeScore >= profile.llmEvalThreshold &&
    breakdown.compositeScore < profile.captureThreshold + 0.15
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Config Resolution
// ────────────────────────────────────────────────────────────────────────────

function resolveConfig(partial?: Partial<ScoringConfig>): ScoringConfig {
  if (!partial) return DEFAULT_SCORING_CONFIG;

  return {
    weights: partial.weights ?? DEFAULT_SCORING_CONFIG.weights,
    activeProfile: partial.activeProfile ?? DEFAULT_SCORING_CONFIG.activeProfile,
    profiles: partial.profiles ?? DEFAULT_SCORING_CONFIG.profiles,
    toolOverrides: partial.toolOverrides ?? DEFAULT_SCORING_CONFIG.toolOverrides,
    patternOverrides: partial.patternOverrides ?? DEFAULT_SCORING_CONFIG.patternOverrides,
    includeBreakdownInTrace:
      partial.includeBreakdownInTrace ?? DEFAULT_SCORING_CONFIG.includeBreakdownInTrace,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Format a scoring breakdown into a human-readable string.
 * Useful for trace events and debugging.
 */
export function formatBreakdown(breakdown: ScoringBreakdown): string {
  const lines = [
    `Score: ${breakdown.compositeScore.toFixed(3)}${breakdown.overridden ? ` (overridden by ${breakdown.overrideSource})` : ""}`,
  ];

  for (const factor of breakdown.factors) {
    lines.push(
      `  ${factor.name}: ${factor.rawScore.toFixed(2)} × ${factor.weight.toFixed(2)} = ${factor.weighted.toFixed(3)}${factor.reason ? ` (${factor.reason})` : ""}`,
    );
  }

  if (breakdown.computeMs !== undefined) {
    lines.push(`  compute: ${breakdown.computeMs}ms`);
  }

  return lines.join("\n");
}

/**
 * Produce a compact JSON-serializable summary of the scoring breakdown.
 * Suitable for embedding in trace events.
 */
export function breakdownToTrace(breakdown: ScoringBreakdown): Record<string, unknown> {
  return {
    score: breakdown.compositeScore,
    overridden: breakdown.overridden,
    overrideSource: breakdown.overrideSource,
    computeMs: breakdown.computeMs,
    factors: Object.fromEntries(
      breakdown.factors.map((f) => [
        f.name,
        {
          raw: Number(f.rawScore.toFixed(3)),
          w: Number(f.weight.toFixed(2)),
          reason: f.reason,
        },
      ]),
    ),
  };
}
