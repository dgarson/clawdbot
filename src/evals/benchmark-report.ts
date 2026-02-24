/**
 * Benchmark Matrix & Report Formatting
 */

import type { RegressionAssessment } from "./scoring.js";

export type BenchmarkRecord = {
  scenarioId: string;
  suite: string;
  category: string;
  difficulty: string;
  taskType: string;
  modelId: string;
  pass: boolean;
  score: number;
  durationMs: number;
};

export type BenchmarkCell = {
  key: string;
  suite: string;
  category: string;
  difficulty: string;
  taskType: string;
  modelId: string;
  sampleCount: number;
  passRate: number;
  meanScore: number;
  p95DurationMs: number;
  lowConfidence: boolean;
};

export type BenchmarkMatrix = {
  generatedAt: string;
  cells: BenchmarkCell[];
};

export type BenchmarkRunSummary = {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  meanScore: number;
  passRate: number;
};

export type BenchmarkReport = {
  schemaVersion: string;
  runId: string;
  generatedAt: string;
  summary: BenchmarkRunSummary;
  matrix: BenchmarkMatrix;
  regressions: RegressionAssessment[];
};

const LOW_CONFIDENCE_SAMPLES = 5;

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].toSorted((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1));
  return sorted[index] ?? 0;
}

function toCellKey(record: BenchmarkRecord): string {
  return [record.modelId, record.taskType, record.suite, record.difficulty].join("|");
}

export function buildBenchmarkMatrix(records: readonly BenchmarkRecord[]): BenchmarkMatrix {
  const grouped = new Map<string, BenchmarkRecord[]>();

  for (const record of records) {
    const key = toCellKey(record);
    const existing = grouped.get(key) ?? [];
    existing.push(record);
    grouped.set(key, existing);
  }

  const cells: BenchmarkCell[] = [];
  for (const [key, group] of grouped) {
    const first = group[0];
    if (!first) {
      continue;
    }

    const sampleCount = group.length;
    const passedCount = group.filter((row) => row.pass).length;
    const meanScore = group.reduce((sum, row) => sum + row.score, 0) / sampleCount;
    const passRate = passedCount / sampleCount;
    const p95DurationMs = percentile(
      group.map((row) => row.durationMs),
      0.95,
    );

    cells.push({
      key,
      suite: first.suite,
      category: first.category,
      difficulty: first.difficulty,
      taskType: first.taskType,
      modelId: first.modelId,
      sampleCount,
      passRate: round(passRate),
      meanScore: round(meanScore),
      p95DurationMs,
      lowConfidence: sampleCount < LOW_CONFIDENCE_SAMPLES,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    cells: cells.toSorted((a, b) => a.key.localeCompare(b.key)),
  };
}

export function buildBenchmarkRunSummary(records: readonly BenchmarkRecord[]): BenchmarkRunSummary {
  const totalCases = records.length;
  const passedCases = records.filter((record) => record.pass).length;
  const failedCases = totalCases - passedCases;
  const meanScore =
    totalCases > 0 ? records.reduce((sum, record) => sum + record.score, 0) / totalCases : 0;

  return {
    totalCases,
    passedCases,
    failedCases,
    meanScore: round(meanScore),
    passRate: totalCases > 0 ? round(passedCases / totalCases) : 0,
  };
}

export function buildBenchmarkReport(params: {
  runId: string;
  records: BenchmarkRecord[];
  regressions?: RegressionAssessment[];
}): BenchmarkReport {
  return {
    schemaVersion: "eval-benchmark-report.v1",
    runId: params.runId,
    generatedAt: new Date().toISOString(),
    summary: buildBenchmarkRunSummary(params.records),
    matrix: buildBenchmarkMatrix(params.records),
    regressions: params.regressions ?? [],
  };
}
