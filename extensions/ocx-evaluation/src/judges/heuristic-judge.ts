/**
 * Heuristic judge -- scores from metrics only (no LLM).
 *
 * Computes scores directly from event data:
 * - Response time: duration from session start to end
 * - Token efficiency: output tokens / input tokens ratio
 * - Tool count: number of tool invocations (fewer = better for simple tasks)
 */

import type { JudgeProfile, Scorecard } from "../types.js";

export type HeuristicMetrics = {
  /** Total run duration in ms. */
  durationMs: number;
  /** Input tokens consumed. */
  inputTokens: number;
  /** Output tokens produced. */
  outputTokens: number;
  /** Number of tool invocations. */
  toolCallCount: number;
};

/** Expected thresholds for heuristic scoring. */
const THRESHOLDS = {
  /** Runs under this duration (ms) get full response_time score. */
  fastResponseMs: 10_000,
  /** Runs over this duration get 0 for response_time. */
  slowResponseMs: 120_000,
  /** Ideal output/input token ratio (lower = more efficient). */
  idealTokenRatio: 0.5,
  /** Ratio above this is penalized fully. */
  maxTokenRatio: 5.0,
  /** Tool calls above this count are penalized. */
  maxToolCalls: 10,
};

/**
 * Score a run using heuristic metrics.
 * Returns per-criterion scores and an overall weighted average.
 */
export function scoreWithHeuristics(
  profile: JudgeProfile,
  metrics: HeuristicMetrics,
  _runMeta: { runId: string; agentId: string; sessionKey: string },
): Pick<Scorecard, "overallScore" | "criteriaScores" | "confidence" | "disqualified"> {
  const criteriaScores: Record<string, number> = {};
  const { min, max } = profile.scale;
  const range = max - min;

  for (const criterion of profile.criteria) {
    let normalized = 0; // 0-1 scale

    switch (criterion.id) {
      case "response_time":
        normalized = scoreResponseTime(metrics.durationMs);
        break;
      case "token_efficiency":
        normalized = scoreTokenEfficiency(metrics.inputTokens, metrics.outputTokens);
        break;
      case "tool_count":
        normalized = scoreToolCount(metrics.toolCallCount);
        break;
      default:
        // Unknown criterion -- score at midpoint
        normalized = 0.5;
        break;
    }

    criteriaScores[criterion.id] = Math.round(min + normalized * range);
  }

  // Weighted average
  const totalWeight = profile.criteria.reduce((sum, c) => sum + c.weight, 0);
  const overallScore =
    totalWeight > 0
      ? Math.round(
          profile.criteria.reduce((sum, c) => {
            const score = criteriaScores[c.id] ?? min;
            return sum + (score * c.weight) / totalWeight;
          }, 0),
        )
      : min;

  return {
    overallScore,
    criteriaScores,
    // Heuristic scores have high confidence since they are deterministic
    confidence: 0.9,
    disqualified: false,
  };
}

// ---------------------------------------------------------------------------
// Individual metric scorers (return 0-1)
// ---------------------------------------------------------------------------

function scoreResponseTime(durationMs: number): number {
  if (durationMs <= THRESHOLDS.fastResponseMs) return 1;
  if (durationMs >= THRESHOLDS.slowResponseMs) return 0;

  // Linear interpolation between fast and slow thresholds
  return (
    1 -
    (durationMs - THRESHOLDS.fastResponseMs) /
      (THRESHOLDS.slowResponseMs - THRESHOLDS.fastResponseMs)
  );
}

function scoreTokenEfficiency(inputTokens: number, outputTokens: number): number {
  if (inputTokens === 0) return 1;

  const ratio = outputTokens / inputTokens;
  if (ratio <= THRESHOLDS.idealTokenRatio) return 1;
  if (ratio >= THRESHOLDS.maxTokenRatio) return 0;

  return (
    1 -
    (ratio - THRESHOLDS.idealTokenRatio) / (THRESHOLDS.maxTokenRatio - THRESHOLDS.idealTokenRatio)
  );
}

function scoreToolCount(toolCalls: number): number {
  if (toolCalls === 0) return 1;
  if (toolCalls >= THRESHOLDS.maxToolCalls) return 0;

  return 1 - toolCalls / THRESHOLDS.maxToolCalls;
}
