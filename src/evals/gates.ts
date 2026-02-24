/**
 * Quality Gates for Evaluation Runs
 *
 * Defines threshold-based quality gates that determine CI pass/fail.
 * Gates can be configured per-suite, per-category, per-difficulty, and globally.
 */

import type { EvaluationRunReport } from "./types.js";

/**
 * Threshold configuration for a single gate
 */
export type GateThreshold = {
  /** Minimum pass rate required (0-100) */
  minPassRate?: number;
  /** Maximum allowed duration in ms for the entire run */
  maxDurationMs?: number;
  /** Maximum allowed failures (absolute count) */
  maxFailures?: number;
};

/**
 * Full gate configuration with hierarchical thresholds
 */
export type GateConfig = {
  /** Global thresholds (apply to entire run) */
  global: GateThreshold;
  /** Per-suite thresholds (keyed by suite name) */
  suites?: Record<string, GateThreshold>;
  /** Per-category thresholds (keyed by category name) */
  categories?: Record<string, GateThreshold>;
  /** Per-difficulty thresholds (keyed by difficulty level) */
  difficulties?: Record<string, GateThreshold>;
  /** Whether to fail fast on first gate violation */
  failFast?: boolean;
};

/**
 * Result of evaluating a single gate
 */
export type GateResult = {
  /** Gate name/identifier */
  gate: string;
  /** Whether the gate passed */
  passed: boolean;
  /** Actual measured value */
  actual: number;
  /** Threshold that was applied */
  threshold: number;
  /** Human-readable message */
  message: string;
};

/**
 * Full gate evaluation result
 */
export type GateEvaluationResult = {
  /** Overall pass/fail */
  passed: boolean;
  /** Individual gate results */
  gates: GateResult[];
  /** Summary message */
  summary: string;
  /** Exit code for CI (0 = pass, 1 = fail) */
  exitCode: number;
};

/**
 * Default gate configuration for CI
 * Conservative thresholds that should pass on healthy codebase
 */
export const DEFAULT_CI_GATE_CONFIG: GateConfig = {
  global: {
    minPassRate: 100, // All cases must pass
    maxDurationMs: 300000, // 5 minutes max
    maxFailures: 0,
  },
  suites: {},
  categories: {
    // HITL scenarios may be flaky in CI, allow some tolerance
    hitl: { minPassRate: 80, maxFailures: 1 },
  },
  difficulties: {
    // e2e tests may have environmental issues
    e2e: { minPassRate: 80, maxFailures: 2 },
  },
  failFast: false,
};

/**
 * Relaxed gate config for PR checks (allows some flake tolerance)
 */
export const PR_CHECK_GATE_CONFIG: GateConfig = {
  global: {
    minPassRate: 90,
    maxDurationMs: 600000, // 10 minutes
    maxFailures: 2,
  },
  suites: {},
  categories: {
    hitl: { minPassRate: 70, maxFailures: 2 },
    integration: { minPassRate: 80, maxFailures: 1 },
  },
  difficulties: {
    e2e: { minPassRate: 70, maxFailures: 3 },
  },
  failFast: false,
};

/**
 * Strict gate config for main branch merges
 */
export const MAIN_BRANCH_GATE_CONFIG: GateConfig = {
  global: {
    minPassRate: 100,
    maxDurationMs: 300000,
    maxFailures: 0,
  },
  suites: {},
  categories: {},
  difficulties: {},
  failFast: true,
};

/**
 * Compute pass rate from counts
 */
function computePassRate(passed: number, total: number): number {
  return total > 0 ? Math.round((passed / total) * 10000) / 100 : 100;
}

/**
 * Evaluate a single threshold against actual values
 */
function evaluateThreshold(
  gateName: string,
  actual: number,
  threshold: number | undefined,
  comparison: "min" | "max",
  unit: string,
): GateResult | null {
  if (threshold === undefined) {
    return null;
  }

  const passed = comparison === "min" ? actual >= threshold : actual <= threshold;

  return {
    gate: gateName,
    passed,
    actual,
    threshold,
    message: passed
      ? `${gateName}: ${actual}${unit} meets ${comparison === "min" ? "minimum" : "maximum"} ${threshold}${unit}`
      : `${gateName}: ${actual}${unit} ${comparison === "min" ? "below" : "exceeds"} ${comparison === "min" ? "minimum" : "maximum"} ${threshold}${unit}`,
  };
}

/**
 * Compute per-category metrics from report
 */
function computeCategoryMetrics(
  report: EvaluationRunReport,
): Record<string, { passed: number; failed: number; total: number; passRate: number }> {
  const metrics: Record<
    string,
    { passed: number; failed: number; total: number; passRate: number }
  > = {};

  for (const testCase of report.cases) {
    // Derive category from case ID pattern (category.difficulty.id or suite.id)
    const parts = testCase.id.split(".");
    const category = parts[0] || "unknown";

    if (!metrics[category]) {
      metrics[category] = { passed: 0, failed: 0, total: 0, passRate: 0 };
    }
    metrics[category].total++;
    if (testCase.pass) {
      metrics[category].passed++;
    } else {
      metrics[category].failed++;
    }
  }

  for (const key of Object.keys(metrics)) {
    metrics[key].passRate = computePassRate(metrics[key].passed, metrics[key].total);
  }

  return metrics;
}

/**
 * Compute per-suite metrics from report
 */
function computeSuiteMetrics(
  report: EvaluationRunReport,
): Record<string, { passed: number; failed: number; total: number; passRate: number }> {
  const metrics: Record<
    string,
    { passed: number; failed: number; total: number; passRate: number }
  > = {};

  for (const testCase of report.cases) {
    const suite = testCase.suite;

    if (!metrics[suite]) {
      metrics[suite] = { passed: 0, failed: 0, total: 0, passRate: 0 };
    }
    metrics[suite].total++;
    if (testCase.pass) {
      metrics[suite].passed++;
    } else {
      metrics[suite].failed++;
    }
  }

  for (const key of Object.keys(metrics)) {
    metrics[key].passRate = computePassRate(metrics[key].passed, metrics[key].total);
  }

  return metrics;
}

/**
 * Evaluate all gates against a run report
 */
export function evaluateGates(
  report: EvaluationRunReport,
  config: GateConfig = DEFAULT_CI_GATE_CONFIG,
): GateEvaluationResult {
  const gates: GateResult[] = [];
  const failedGates: string[] = [];

  // Global gates
  const globalPassRate = computePassRate(report.passed, report.total);

  const globalPassRateGate = evaluateThreshold(
    "global.passRate",
    globalPassRate,
    config.global.minPassRate,
    "min",
    "%",
  );
  if (globalPassRateGate) {
    gates.push(globalPassRateGate);
    if (!globalPassRateGate.passed) {
      failedGates.push(globalPassRateGate.gate);
    }
  }

  const globalDurationGate = evaluateThreshold(
    "global.duration",
    report.durationMs,
    config.global.maxDurationMs,
    "max",
    "ms",
  );
  if (globalDurationGate) {
    gates.push(globalDurationGate);
    if (!globalDurationGate.passed) {
      failedGates.push(globalDurationGate.gate);
    }
  }

  const globalFailuresGate = evaluateThreshold(
    "global.failures",
    report.failed,
    config.global.maxFailures,
    "max",
    "",
  );
  if (globalFailuresGate) {
    gates.push(globalFailuresGate);
    if (!globalFailuresGate.passed) {
      failedGates.push(globalFailuresGate.gate);
    }
  }

  // Per-suite gates
  const suiteMetrics = computeSuiteMetrics(report);
  for (const [suite, metrics] of Object.entries(suiteMetrics)) {
    const suiteConfig = config.suites?.[suite];
    if (!suiteConfig) {
      continue;
    }

    const suitePassRateGate = evaluateThreshold(
      `suite.${suite}.passRate`,
      metrics.passRate,
      suiteConfig.minPassRate,
      "min",
      "%",
    );
    if (suitePassRateGate) {
      gates.push(suitePassRateGate);
      if (!suitePassRateGate.passed) {
        failedGates.push(suitePassRateGate.gate);
      }
    }

    const suiteFailuresGate = evaluateThreshold(
      `suite.${suite}.failures`,
      metrics.failed,
      suiteConfig.maxFailures,
      "max",
      "",
    );
    if (suiteFailuresGate) {
      gates.push(suiteFailuresGate);
      if (!suiteFailuresGate.passed) {
        failedGates.push(suiteFailuresGate.gate);
      }
    }
  }

  // Per-category gates
  const categoryMetrics = computeCategoryMetrics(report);
  for (const [category, metrics] of Object.entries(categoryMetrics)) {
    const categoryConfig = config.categories?.[category];
    if (!categoryConfig) {
      continue;
    }

    const categoryPassRateGate = evaluateThreshold(
      `category.${category}.passRate`,
      metrics.passRate,
      categoryConfig.minPassRate,
      "min",
      "%",
    );
    if (categoryPassRateGate) {
      gates.push(categoryPassRateGate);
      if (!categoryPassRateGate.passed) {
        failedGates.push(categoryPassRateGate.gate);
      }
    }

    const categoryFailuresGate = evaluateThreshold(
      `category.${category}.failures`,
      metrics.failed,
      categoryConfig.maxFailures,
      "max",
      "",
    );
    if (categoryFailuresGate) {
      gates.push(categoryFailuresGate);
      if (!categoryFailuresGate.passed) {
        failedGates.push(categoryFailuresGate.gate);
      }
    }
  }

  // Per-difficulty gates
  for (const testCase of report.cases) {
    const parts = testCase.id.split(".");
    const difficulty = parts[1] || "unit";
    const difficultyConfig = config.difficulties?.[difficulty];
    if (!difficultyConfig) {
      continue;
    }

    // Compute difficulty metrics
    const difficultyMetrics: Record<
      string,
      { passed: number; failed: number; total: number; passRate: number }
    > = {};

    for (const tc of report.cases) {
      const tcParts = tc.id.split(".");
      const tcDiff = tcParts[1] || "unit";
      if (!difficultyMetrics[tcDiff]) {
        difficultyMetrics[tcDiff] = { passed: 0, failed: 0, total: 0, passRate: 0 };
      }
      difficultyMetrics[tcDiff].total++;
      if (tc.pass) {
        difficultyMetrics[tcDiff].passed++;
      } else {
        difficultyMetrics[tcDiff].failed++;
      }
    }

    for (const key of Object.keys(difficultyMetrics)) {
      difficultyMetrics[key].passRate = computePassRate(
        difficultyMetrics[key].passed,
        difficultyMetrics[key].total,
      );
    }

    // Only add gates for difficulties we haven't processed yet
    const processedDifficulties = new Set<string>();
    for (const [diff, metrics] of Object.entries(difficultyMetrics)) {
      if (processedDifficulties.has(diff)) {
        continue;
      }
      processedDifficulties.add(diff);

      const diffConfig = config.difficulties?.[diff];
      if (!diffConfig) {
        continue;
      }

      const diffPassRateGate = evaluateThreshold(
        `difficulty.${diff}.passRate`,
        metrics.passRate,
        diffConfig.minPassRate,
        "min",
        "%",
      );
      if (diffPassRateGate) {
        gates.push(diffPassRateGate);
        if (!diffPassRateGate.passed) {
          failedGates.push(diffPassRateGate.gate);
        }
      }

      const diffFailuresGate = evaluateThreshold(
        `difficulty.${diff}.failures`,
        metrics.failed,
        diffConfig.maxFailures,
        "max",
        "",
      );
      if (diffFailuresGate) {
        gates.push(diffFailuresGate);
        if (!diffFailuresGate.passed) {
          failedGates.push(diffFailuresGate.gate);
        }
      }
    }

    break; // Only process once
  }

  const passed = failedGates.length === 0;
  const summary = passed
    ? `All ${gates.length} gates passed`
    : `${failedGates.length}/${gates.length} gates failed: ${failedGates.join(", ")}`;

  return {
    passed,
    gates,
    summary,
    exitCode: passed ? 0 : 1,
  };
}

/**
 * Format gate results for CI output
 */
export function formatGateResults(result: GateEvaluationResult): string {
  const lines: string[] = [
    "## Evaluation Gate Results",
    "",
    `**Overall:** ${result.passed ? "✅ PASSED" : "❌ FAILED"}`,
    `**Summary:** ${result.summary}`,
    "",
    "### Gate Details",
    "",
  ];

  for (const gate of result.gates) {
    const icon = gate.passed ? "✅" : "❌";
    lines.push(`- ${icon} ${gate.message}`);
  }

  lines.push("");
  lines.push(`**Exit Code:** ${result.exitCode}`);

  return lines.join("\n");
}
