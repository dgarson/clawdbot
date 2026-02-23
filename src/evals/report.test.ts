import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { EvaluationRunReport } from "./types.js";
import { resolveEvaluationReportPath, writeEvaluationReport } from "./report.js";

const cleanupDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe("evaluation report output", () => {
  it("uses the default report path when filePath is not provided", () => {
    const reportPath = resolveEvaluationReportPath(
      { baseDir: "/tmp/eval-workspace" },
      "eval-20260223-070000000",
    );

    expect(reportPath).toBe("/tmp/eval-workspace/reports/evals/eval-20260223-070000000.json");
  });

  it("writes a JSON report file and returns its path", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-evals-"));
    cleanupDirs.push(baseDir);

    const report: EvaluationRunReport = {
      runId: "eval-20260223-070000000",
      startedAt: "2026-02-23T07:00:00.000Z",
      completedAt: "2026-02-23T07:00:01.000Z",
      durationMs: 1000,
      total: 1,
      passed: 1,
      failed: 0,
      cases: [
        {
          id: "sample.pass",
          suite: "sample",
          title: "Sample",
          pass: true,
          summary: "ok",
          durationMs: 1,
        },
      ],
    };

    const filePath = await writeEvaluationReport(report, { baseDir });
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as EvaluationRunReport;

    expect(filePath).toBe(path.join(baseDir, "reports", "evals", "eval-20260223-070000000.json"));
    expect(parsed.runId).toBe(report.runId);
    expect(parsed.total).toBe(1);
    expect(parsed.cases[0]?.id).toBe("sample.pass");
  });
});
