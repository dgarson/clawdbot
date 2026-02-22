import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

/**
 * Experiment definition — describes a single A/B (or multi-variant) experiment.
 */
export interface Experiment {
  /** Unique experiment identifier, e.g. "model-routing-test-2026-02" */
  id: string;
  /** Human-readable description */
  description: string;
  /** Ordered list of variant names, e.g. ["control", "treatment-a"] */
  variants: string[];
  /** Traffic split percentages (must sum to 100, same order as variants) */
  trafficSplit: number[];
  /** Whether this experiment is currently active */
  enabled: boolean;
  /** ISO-8601 start date (inclusive) */
  startDate?: string;
  /** ISO-8601 end date (inclusive) */
  endDate?: string;
}

/**
 * The resolved experiment assignment for a given subject.
 */
export interface ExperimentContext {
  experimentId: string;
  variant: string;
  /** Stable hash-based cohort identifier derived from (experimentId, subjectId) */
  cohort: string;
}

/**
 * Top-level experiments configuration (matches openclaw.config shape).
 */
export interface ExperimentsConfig {
  /** Path to an external JSON config file (optional) */
  configPath?: string;
  /** Simple boolean feature flags keyed by name */
  flags?: Record<string, boolean>;
  /** List of experiment definitions */
  experiments?: Experiment[];
}

/**
 * Deterministic bucket computation.
 * SHA-256 hash of (experimentId + subjectId), take first 8 hex chars → integer mod 100.
 * This guarantees the same subject always lands in the same bucket for a given experiment.
 */
function computeBucket(experimentId: string, subjectId: string): number {
  const hash = createHash("sha256")
    .update(experimentId + subjectId)
    .digest("hex");
  // First 8 hex chars → 32-bit integer → mod 100
  const value = parseInt(hash.slice(0, 8), 16);
  return value % 100;
}

/**
 * Compute a short cohort identifier from the hash (first 12 hex chars).
 */
function computeCohort(experimentId: string, subjectId: string): string {
  return createHash("sha256")
    .update(experimentId + subjectId)
    .digest("hex")
    .slice(0, 12);
}

/**
 * Map a bucket (0–99) to a variant index based on cumulative traffic split.
 * E.g. trafficSplit [50, 30, 20] → buckets 0–49 → variant 0, 50–79 → variant 1, 80–99 → variant 2
 */
function bucketToVariantIndex(bucket: number, trafficSplit: number[]): number {
  let cumulative = 0;
  for (let i = 0; i < trafficSplit.length; i++) {
    cumulative += trafficSplit[i];
    if (bucket < cumulative) {
      return i;
    }
  }
  // Fallback to last variant (shouldn't happen if splits sum to 100)
  return trafficSplit.length - 1;
}

/**
 * Validates that an experiment definition is well-formed.
 */
function validateExperiment(exp: Experiment): void {
  if (exp.variants.length === 0) {
    throw new Error(`Experiment "${exp.id}" must have at least one variant`);
  }
  if (exp.variants.length !== exp.trafficSplit.length) {
    throw new Error(
      `Experiment "${exp.id}": variants (${exp.variants.length}) and trafficSplit (${exp.trafficSplit.length}) must have the same length`,
    );
  }
  const total = exp.trafficSplit.reduce((sum, pct) => sum + pct, 0);
  if (total !== 100) {
    throw new Error(`Experiment "${exp.id}": trafficSplit must sum to 100 (got ${total})`);
  }
  for (const pct of exp.trafficSplit) {
    if (pct < 0) {
      throw new Error(`Experiment "${exp.id}": trafficSplit values must be non-negative`);
    }
  }
}

/**
 * Manages feature flags and A/B experiments with deterministic, hash-based
 * variant assignment. Configuration is loaded from a JSON file on disk.
 *
 * Usage:
 * ```ts
 * const mgr = new ExperimentManager('~/.openclaw/experiments.json')
 * const ctx = mgr.getVariant('model-routing-test-2026-02', sessionId)
 * if (ctx) console.log(`assigned variant: ${ctx.variant}`)
 * ```
 */
export class ExperimentManager {
  private flags: Record<string, boolean> = {};
  private experiments: Experiment[] = [];

  constructor(configPath: string) {
    this.loadConfig(configPath);
  }

  /**
   * Load configuration from a JSON file. If the file doesn't exist,
   * the manager initializes with empty flags and experiments.
   */
  private loadConfig(configPath: string): void {
    if (!existsSync(configPath)) {
      return;
    }

    const raw = readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw) as ExperimentsConfig;

    if (config.flags) {
      this.flags = config.flags;
    }

    if (config.experiments) {
      for (const exp of config.experiments) {
        validateExperiment(exp);
      }
      this.experiments = config.experiments;
    }
  }

  /**
   * Get the deterministic variant assignment for a subject in a given experiment.
   *
   * Returns null if:
   * - The experiment doesn't exist
   * - The experiment is disabled
   * - The experiment is outside its date range
   */
  getVariant(experimentId: string, subjectId: string): ExperimentContext | null {
    const experiment = this.experiments.find((e) => e.id === experimentId);
    if (!experiment || !experiment.enabled) {
      return null;
    }

    // Check date bounds if specified
    const now = new Date().toISOString().split("T")[0];
    if (experiment.startDate && now < experiment.startDate) {
      return null;
    }
    if (experiment.endDate && now > experiment.endDate) {
      return null;
    }

    const bucket = computeBucket(experimentId, subjectId);
    const variantIndex = bucketToVariantIndex(bucket, experiment.trafficSplit);
    const variant = experiment.variants[variantIndex];
    const cohort = computeCohort(experimentId, subjectId);

    return { experimentId, variant, cohort };
  }

  /**
   * Check whether a simple feature flag is enabled.
   * Returns false for unknown flags.
   */
  isEnabled(featureFlag: string): boolean {
    return this.flags[featureFlag];
  }

  /**
   * List all configured experiments (regardless of enabled state).
   */
  listExperiments(): Experiment[] {
    return [...this.experiments];
  }
}

// Re-export helpers for testing
export { computeBucket as _computeBucket, computeCohort as _computeCohort };
