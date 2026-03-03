/**
 * Plugin configuration type and defaults for the evaluation system.
 */

export type EvaluationConfig = {
  /** How often to check for unscored runs (ms). Default: 30000. */
  pollIntervalMs: number;
  /** Default LLM model for judge-based scoring. */
  defaultJudgeModel: string;
  /** Maximum runs to evaluate per poll cycle. */
  batchSize: number;
  /** Score threshold below which quality-risk events are emitted. */
  qualityRiskThreshold: number;
  /** How many days to retain scorecards before cleanup. */
  scorecardRetentionDays: number;
  /** Filename (relative to stateDir/evaluation/) for judge profiles. */
  judgeProfilesFile: string;
};

const DEFAULTS: EvaluationConfig = {
  pollIntervalMs: 30_000,
  defaultJudgeModel: "gpt-4.1-mini",
  batchSize: 10,
  qualityRiskThreshold: 40,
  scorecardRetentionDays: 90,
  judgeProfilesFile: "judge-profiles.json",
};

/** Merge partial plugin config with defaults. */
export function resolveEvaluationConfig(
  raw: Record<string, unknown> | undefined,
): EvaluationConfig {
  const src = raw ?? {};
  return {
    pollIntervalMs:
      typeof src.pollIntervalMs === "number" ? src.pollIntervalMs : DEFAULTS.pollIntervalMs,
    defaultJudgeModel:
      typeof src.defaultJudgeModel === "string"
        ? src.defaultJudgeModel
        : DEFAULTS.defaultJudgeModel,
    batchSize: typeof src.batchSize === "number" ? src.batchSize : DEFAULTS.batchSize,
    qualityRiskThreshold:
      typeof src.qualityRiskThreshold === "number"
        ? src.qualityRiskThreshold
        : DEFAULTS.qualityRiskThreshold,
    scorecardRetentionDays:
      typeof src.scorecardRetentionDays === "number"
        ? src.scorecardRetentionDays
        : DEFAULTS.scorecardRetentionDays,
    judgeProfilesFile:
      typeof src.judgeProfilesFile === "string"
        ? src.judgeProfilesFile
        : DEFAULTS.judgeProfilesFile,
  };
}
