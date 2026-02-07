/**
 * Weight Advisor — computes suggested backend weight adjustments
 * based on rolling aggregated feedback data.
 *
 * Phase 1: advisory only (surfaced via CLI/status).
 * Phase 2: optional auto-adjustment within bounded range (+/- 0.2 from base).
 */

import type { FeedbackStore } from "./feedback-store.js";
import type { WeightSuggestion } from "./types.js";

/** Minimum evaluations needed per backend for any confidence. */
const MIN_SAMPLE_SIZE = 10;

/** High confidence threshold. */
const HIGH_CONFIDENCE_THRESHOLD = 50;

/** Maximum weight adjustment per cycle. */
const MAX_WEIGHT_DELTA = 0.2;

/** Target precision — backends above this are performing well. */
const TARGET_PRECISION = 0.6;

export type WeightAdvisorOptions = {
  feedbackStore: FeedbackStore;
  windowDays?: number;
};

/**
 * Compute suggested weight adjustments based on feedback aggregates.
 */
export function computeSuggestedWeights(params: {
  feedbackStore: FeedbackStore;
  currentWeights: Record<string, number>;
  windowDays?: number;
}): WeightSuggestion[] {
  const windowDays = params.windowDays ?? 7;
  const aggregates = params.feedbackStore.getBackendAggregates(windowDays);
  const suggestions: WeightSuggestion[] = [];

  for (const agg of aggregates) {
    const currentWeight = params.currentWeights[agg.backend];
    if (currentWeight === undefined) {
      continue;
    }

    const confidence = computeConfidence(agg.evalCount);
    if (confidence === 0) {
      continue;
    }

    const suggestedWeight = computeNewWeight(currentWeight, agg.avgPrecision, confidence);

    const delta = suggestedWeight - currentWeight;
    if (Math.abs(delta) < 0.01) {
      continue; // no meaningful change
    }

    suggestions.push({
      backend: agg.backend,
      currentWeight,
      suggestedWeight,
      confidence,
      rationale: buildRationale(
        agg.backend,
        agg.avgPrecision,
        currentWeight,
        suggestedWeight,
        agg.evalCount,
      ),
      sampleSize: agg.evalCount,
      avgPrecision: agg.avgPrecision,
    });
  }

  return suggestions;
}

function computeConfidence(sampleSize: number): number {
  if (sampleSize < MIN_SAMPLE_SIZE) {
    return 0;
  }
  if (sampleSize >= HIGH_CONFIDENCE_THRESHOLD) {
    return 1;
  }
  // Linear interpolation between thresholds
  return (sampleSize - MIN_SAMPLE_SIZE) / (HIGH_CONFIDENCE_THRESHOLD - MIN_SAMPLE_SIZE);
}

function computeNewWeight(currentWeight: number, avgPrecision: number, confidence: number): number {
  // Precision delta from target
  const precisionDelta = avgPrecision - TARGET_PRECISION;

  // Scale adjustment by confidence and cap at MAX_WEIGHT_DELTA
  const rawDelta = precisionDelta * confidence * 0.5;
  const cappedDelta = Math.max(-MAX_WEIGHT_DELTA, Math.min(MAX_WEIGHT_DELTA, rawDelta));

  // Apply and clamp to valid range [0.1, 1.0]
  return Math.max(0.1, Math.min(1.0, currentWeight + cappedDelta));
}

function buildRationale(
  backend: string,
  avgPrecision: number,
  currentWeight: number,
  suggestedWeight: number,
  sampleSize: number,
): string {
  const direction = suggestedWeight > currentWeight ? "increase" : "decrease";
  const pctPrecision = (avgPrecision * 100).toFixed(0);
  const targetPct = (TARGET_PRECISION * 100).toFixed(0);

  if (avgPrecision >= TARGET_PRECISION) {
    return `${backend} has ${pctPrecision}% precision (>= ${targetPct}% target) over ${sampleSize} evaluations. Suggesting ${direction} from ${currentWeight.toFixed(2)} to ${suggestedWeight.toFixed(2)}.`;
  }

  return `${backend} has ${pctPrecision}% precision (< ${targetPct}% target) over ${sampleSize} evaluations. Suggesting ${direction} from ${currentWeight.toFixed(2)} to ${suggestedWeight.toFixed(2)}.`;
}
