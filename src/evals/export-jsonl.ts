/**
 * JSONL Export Adapter for Evaluation Reports
 *
 * Provides JSON Lines format output for CI integration and
 * long-term reliability metric tracking.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { EvaluationRunReport } from "./types.js";

/**
 * JSONL record for a single evaluation case result.
 * Each line in the output file is one JSON object.
 */
export type EvaluationJsonlRecord = {
  // Run metadata
  runId: string;
  runStartedAt: string;
  runCompletedAt: string;
  runDurationMs: number;

  // Aggregate metrics
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;

  // Per-suite metrics
  suites: Record<string, { total: number; passed: number; failed: number; passRate: number }>;

  // Per-category metrics
  categories: Record<string, { total: number; passed: number; failed: number; passRate: number }>;

  // Per-difficulty metrics
  difficulties: Record<string, { total: number; passed: number; failed: number; passRate: number }>;

  // This case details
  caseId: string;
  caseSuite: string;
  caseTitle: string;
  casePass: boolean;
  caseSummary: string;
  caseScore?: number;
  caseDurationMs: number;
  caseDetails?: Record<string, unknown>;
};

/**
 * Options for JSONL export
 */
export type JsonlExportOptions = {
  /** Output directory (mutually exclusive with filePath) */
  baseDir?: string;
  /** Output file path (mutually exclusive with baseDir) */
  filePath?: string;
  /** Whether to append to existing file or overwrite */
  append?: boolean;
  /** Include detailed metrics in each record */
  includeMetrics?: boolean;
};

/**
 * Compute aggregate metrics from a run report
 */
function computeMetrics(report: EvaluationRunReport) {
  const suites: Record<
    string,
    { total: number; passed: number; failed: number; passRate: number }
  > = {};
  const categories: Record<
    string,
    { total: number; passed: number; failed: number; passRate: number }
  > = {};
  const difficulties: Record<
    string,
    { total: number; passed: number; failed: number; passRate: number }
  > = {};

  for (const testCase of report.cases) {
    // Suite metrics
    if (!suites[testCase.suite]) {
      suites[testCase.suite] = { total: 0, passed: 0, failed: 0, passRate: 0 };
    }
    suites[testCase.suite].total++;
    if (testCase.pass) {
      suites[testCase.suite].passed++;
    } else {
      suites[testCase.suite].failed++;
    }

    // Extract category and difficulty from tags or title patterns
    // For now, derive from case ID patterns (suite.category.id format)
    const parts = testCase.id.split(".");
    const category = parts[0] || "unknown";
    const difficulty = parts[1] || "unit"; // Default to unit

    // Category metrics
    if (!categories[category]) {
      categories[category] = { total: 0, passed: 0, failed: 0, passRate: 0 };
    }
    categories[category].total++;
    if (testCase.pass) {
      categories[category].passed++;
    } else {
      categories[category].failed++;
    }

    // Difficulty metrics
    if (!difficulties[difficulty]) {
      difficulties[difficulty] = { total: 0, passed: 0, failed: 0, passRate: 0 };
    }
    difficulties[difficulty].total++;
    if (testCase.pass) {
      difficulties[difficulty].passed++;
    } else {
      difficulties[difficulty].failed++;
    }
  }

  // Compute pass rates
  for (const metric of [suites, categories, difficulties]) {
    for (const key of Object.keys(metric)) {
      const m = metric[key];
      m.passRate = m.total > 0 ? Math.round((m.passed / m.total) * 10000) / 100 : 0;
    }
  }

  return { suites, categories, difficulties };
}

/**
 * Resolve the output path for JSONL export
 */
export function resolveJsonlPath(options: JsonlExportOptions, runId: string): string {
  if (options.filePath) {
    return options.filePath;
  }
  if (options.baseDir) {
    return path.join(options.baseDir, "reports", "evals", `${runId}.jsonl`);
  }
  throw new Error("Either baseDir or filePath must be provided");
}

/**
 * Write evaluation report in JSONL format.
 * Each case result is written as a separate JSON line.
 */
export async function writeEvaluationJsonl(
  report: EvaluationRunReport,
  options: JsonlExportOptions,
): Promise<string> {
  const filePath = resolveJsonlPath(options, report.runId);
  const append = options.append ?? false;

  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const metrics = options.includeMetrics !== false ? computeMetrics(report) : null;
  const passRate = report.total > 0 ? Math.round((report.passed / report.total) * 10000) / 100 : 0;

  const lines: string[] = [];
  for (const testCase of report.cases) {
    const record: EvaluationJsonlRecord = {
      runId: report.runId,
      runStartedAt: report.startedAt,
      runCompletedAt: report.completedAt,
      runDurationMs: report.durationMs,
      totalCases: report.total,
      passedCases: report.passed,
      failedCases: report.failed,
      passRate,
      suites: metrics?.suites ?? {},
      categories: metrics?.categories ?? {},
      difficulties: metrics?.difficulties ?? {},
      caseId: testCase.id,
      caseSuite: testCase.suite,
      caseTitle: testCase.title,
      casePass: testCase.pass,
      caseSummary: testCase.summary,
      caseScore: testCase.score,
      caseDurationMs: testCase.durationMs,
      caseDetails: testCase.details,
    };
    lines.push(JSON.stringify(record));
  }

  const content = lines.join("\n") + "\n";

  if (append) {
    await fs.appendFile(filePath, content, "utf-8");
  } else {
    await fs.writeFile(filePath, content, "utf-8");
  }

  return filePath;
}

/**
 * Write a summary record (single line with aggregate metrics only)
 * Useful for quick CI pass/fail determination.
 */
export async function writeEvaluationJsonlSummary(
  report: EvaluationRunReport,
  options: JsonlExportOptions,
): Promise<string> {
  const filePath = resolveJsonlPath(options, report.runId);
  const metrics = computeMetrics(report);
  const passRate = report.total > 0 ? Math.round((report.passed / report.total) * 10000) / 100 : 0;

  const summary = {
    runId: report.runId,
    runStartedAt: report.startedAt,
    runCompletedAt: report.completedAt,
    runDurationMs: report.durationMs,
    totalCases: report.total,
    passedCases: report.passed,
    failedCases: report.failed,
    passRate,
    suites: metrics.suites,
    categories: metrics.categories,
    difficulties: metrics.difficulties,
  };

  const content = JSON.stringify(summary) + "\n";

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");

  return filePath;
}
