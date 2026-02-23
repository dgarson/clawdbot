import fs from "node:fs/promises";
import path from "node:path";
import type { EvaluationReportOutput, EvaluationRunReport } from "./types.js";

export function buildEvaluationRunId(now = new Date()): string {
  const compact = now.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
  return `eval-${compact}`;
}

export function resolveEvaluationReportPath(output: EvaluationReportOutput, runId: string): string {
  if (output.filePath) {
    return output.filePath;
  }
  return path.join(output.baseDir, "reports", "evals", `${runId}.json`);
}

export async function writeEvaluationReport(
  report: EvaluationRunReport,
  output: EvaluationReportOutput,
): Promise<string> {
  const reportPath = resolveEvaluationReportPath(output, report.runId);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  return reportPath;
}
