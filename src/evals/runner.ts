import type {
  EvaluationCase,
  EvaluationCaseRun,
  EvaluationRunOptions,
  EvaluationRunReport,
  EvaluationRunner,
} from "./types.js";
import { buildEvaluationRunId, writeEvaluationReport } from "./report.js";

export class BasicEvaluationRunner implements EvaluationRunner {
  private readonly now: () => Date;

  constructor(options?: { now?: () => Date }) {
    this.now = options?.now ?? (() => new Date());
  }

  async run(
    cases: readonly EvaluationCase[],
    options: EvaluationRunOptions = {},
  ): Promise<EvaluationRunReport> {
    const startedDate = this.now();
    const runId = buildEvaluationRunId(startedDate);
    const startedAt = startedDate.toISOString();

    const runCases: EvaluationCaseRun[] = [];
    for (const testCase of cases) {
      if (options.signal?.aborted) {
        throw new Error("Evaluation run aborted");
      }
      const caseStart = Date.now();
      try {
        const result = await testCase.run({
          runId,
          startedAt,
          signal: options.signal,
        });
        runCases.push({
          id: testCase.id,
          suite: testCase.suite,
          title: testCase.title,
          pass: result.pass,
          summary: result.summary,
          score: result.score,
          details: result.details,
          durationMs: Date.now() - caseStart,
        });
      } catch (error) {
        runCases.push({
          id: testCase.id,
          suite: testCase.suite,
          title: testCase.title,
          pass: false,
          summary: `Evaluation case threw: ${errorMessage(error)}`,
          durationMs: Date.now() - caseStart,
        });
      }
    }

    const completedAt = this.now().toISOString();
    const passed = runCases.filter((item) => item.pass).length;
    const report: EvaluationRunReport = {
      runId,
      startedAt,
      completedAt,
      durationMs: Date.parse(completedAt) - Date.parse(startedAt),
      total: runCases.length,
      passed,
      failed: runCases.length - passed,
      cases: runCases,
    };

    if (options.reportOutput) {
      report.reportPath = await writeEvaluationReport(report, options.reportOutput);
    }

    return report;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return "unknown error";
}
