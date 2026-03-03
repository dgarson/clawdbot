/**
 * Evaluation Scoring & Regression Policy
 *
 * This module is intentionally deterministic and model-agnostic.
 * It provides the substrate for weighted scoring, confidence flags,
 * and baseline regression checks.
 */

export const DEFAULT_QUALITY_FLOOR = 0.7;
export const DEFAULT_MIN_CONFIDENCE_SAMPLES = 5;

export type ScoreFlag =
  | "low_confidence"
  | "format_error"
  | "misclassified_task_type"
  | "missing_dimension";

export type RubricDimension = {
  id: string;
  weight: number;
  min?: number;
  max?: number;
};

export type ScoringRubric = {
  id: string;
  taskType: string;
  qualityFloor?: number;
  formatErrorCap?: number;
  dimensions: RubricDimension[];
};

export type ScoreInput = {
  scenarioId: string;
  rubric: ScoringRubric;
  dimensionScores: Record<string, number>;
  sampleCount?: number;
  formatValid?: boolean;
  misclassifiedTaskType?: boolean;
};

export type ScoreResult = {
  scenarioId: string;
  rubricId: string;
  taskType: string;
  score: number;
  pass: boolean;
  dimensions: Record<string, number>;
  flags: ScoreFlag[];
  qualityFloor: number;
};

export type BaselineSnapshot = {
  key: string;
  meanScore: number;
  passRate: number;
  sampleCount: number;
  updatedAt: string;
};

export type RegressionThresholds = {
  warnDelta: number;
  failDelta: number;
  absoluteFloor?: number;
  minSamples?: number;
};

export type RegressionStatus = "pass" | "warn" | "fail" | "insufficient_data";

export type RegressionAssessment = {
  key: string;
  baselineMean: number;
  candidateMean: number;
  delta: number;
  status: RegressionStatus;
  reasons: string[];
};

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function validateRubricWeights(rubric: ScoringRubric): void {
  const weightSum = rubric.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  if (Math.abs(weightSum - 1) > 1e-6) {
    throw new Error(
      `Rubric ${rubric.id} weights must sum to 1.0 (actual: ${weightSum.toFixed(6)})`,
    );
  }
}

export function scoreOutput(input: ScoreInput): ScoreResult {
  validateRubricWeights(input.rubric);

  const qualityFloor = input.rubric.qualityFloor ?? DEFAULT_QUALITY_FLOOR;
  const formatErrorCap = input.rubric.formatErrorCap ?? 0.5;

  const flags: ScoreFlag[] = [];
  const normalizedDimensions: Record<string, number> = {};

  let weightedScore = 0;
  for (const dimension of input.rubric.dimensions) {
    const raw = input.dimensionScores[dimension.id];
    if (!Number.isFinite(raw)) {
      flags.push("missing_dimension");
      normalizedDimensions[dimension.id] = 0;
      continue;
    }

    const min = Number.isFinite(dimension.min) ? (dimension.min as number) : 0;
    const max = Number.isFinite(dimension.max) ? (dimension.max as number) : 1;
    const normalized = clampUnit((raw - min) / Math.max(max - min, 1e-9));
    normalizedDimensions[dimension.id] = normalized;
    weightedScore += normalized * dimension.weight;
  }

  let score = clampUnit(weightedScore);

  if (input.formatValid === false) {
    flags.push("format_error");
    score = Math.min(score, formatErrorCap);
  }

  if (input.misclassifiedTaskType) {
    flags.push("misclassified_task_type");
  }

  const sampleCount = input.sampleCount ?? 0;
  if (sampleCount < DEFAULT_MIN_CONFIDENCE_SAMPLES) {
    flags.push("low_confidence");
  }

  return {
    scenarioId: input.scenarioId,
    rubricId: input.rubric.id,
    taskType: input.rubric.taskType,
    score,
    pass: score >= qualityFloor,
    dimensions: normalizedDimensions,
    flags: [...new Set(flags)],
    qualityFloor,
  };
}

export function evaluateRegression(
  key: string,
  baseline: BaselineSnapshot,
  candidate: Pick<BaselineSnapshot, "meanScore" | "sampleCount">,
  thresholds: RegressionThresholds,
): RegressionAssessment {
  const reasons: string[] = [];

  const minSamples = thresholds.minSamples ?? DEFAULT_MIN_CONFIDENCE_SAMPLES;
  if (baseline.sampleCount < minSamples || candidate.sampleCount < minSamples) {
    reasons.push(`sample_count_below_minimum:${minSamples}`);
    return {
      key,
      baselineMean: baseline.meanScore,
      candidateMean: candidate.meanScore,
      delta: candidate.meanScore - baseline.meanScore,
      status: "insufficient_data",
      reasons,
    };
  }

  const delta = candidate.meanScore - baseline.meanScore;

  if (thresholds.absoluteFloor !== undefined && candidate.meanScore < thresholds.absoluteFloor) {
    reasons.push(`below_absolute_floor:${thresholds.absoluteFloor}`);
    return {
      key,
      baselineMean: baseline.meanScore,
      candidateMean: candidate.meanScore,
      delta,
      status: "fail",
      reasons,
    };
  }

  if (delta <= -Math.abs(thresholds.failDelta)) {
    reasons.push(`delta_below_fail_threshold:${thresholds.failDelta}`);
    return {
      key,
      baselineMean: baseline.meanScore,
      candidateMean: candidate.meanScore,
      delta,
      status: "fail",
      reasons,
    };
  }

  if (delta <= -Math.abs(thresholds.warnDelta)) {
    reasons.push(`delta_below_warn_threshold:${thresholds.warnDelta}`);
    return {
      key,
      baselineMean: baseline.meanScore,
      candidateMean: candidate.meanScore,
      delta,
      status: "warn",
      reasons,
    };
  }

  return {
    key,
    baselineMean: baseline.meanScore,
    candidateMean: candidate.meanScore,
    delta,
    status: "pass",
    reasons,
  };
}
