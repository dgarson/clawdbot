/**
 * Model comparison aggregation.
 *
 * Aggregates scorecards by model + classification label to produce
 * A/B comparison data: avgScore, avgCost, avgTokens, avgDuration, scorePerDollar.
 */

import type { Scorecard, ModelComparison, ModelComparisonEntry } from "./types.js";

export type ComparisonQuery = {
  classificationLabel: string;
  from: string;
  to: string;
};

/**
 * Aggregate scorecards into a model comparison report.
 * Groups by model+provider, computes averages for each group.
 */
export function aggregateModelComparison(
  scorecards: Scorecard[],
  query: ComparisonQuery,
): ModelComparison {
  // Group by "provider/model" key
  const groups = new Map<string, Scorecard[]>();

  for (const card of scorecards) {
    if (!card.model) continue;

    // Filter to matching classification label and time range
    if (card.classificationLabel !== query.classificationLabel) continue;
    if (card.scoredAt < query.from || card.scoredAt > query.to) continue;

    const key = `${card.provider ?? "unknown"}/${card.model}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(card);
    } else {
      groups.set(key, [card]);
    }
  }

  const models: ModelComparisonEntry[] = [];

  for (const [key, cards] of groups) {
    const [provider, ...modelParts] = key.split("/");
    const model = modelParts.join("/");

    const runCount = cards.length;
    const avgScore = average(cards.map((c) => c.overallScore));
    const avgCostUsd = average(cards.map((c) => c.costUsd ?? 0));
    const avgTokens = average(cards.map((c) => c.totalTokens ?? 0));
    const avgDurationMs = average(cards.map((c) => c.durationMs ?? 0));
    const scorePerDollar = avgCostUsd > 0 ? avgScore / avgCostUsd : 0;

    models.push({
      model,
      provider: provider ?? "unknown",
      runCount,
      avgScore: round2(avgScore),
      avgCostUsd: round6(avgCostUsd),
      avgTokens: Math.round(avgTokens),
      avgDurationMs: Math.round(avgDurationMs),
      scorePerDollar: round2(scorePerDollar),
    });
  }

  // Sort by avgScore descending
  models.sort((a, b) => b.avgScore - a.avgScore);

  return {
    classificationLabel: query.classificationLabel,
    timeRange: { from: query.from, to: query.to },
    models,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
