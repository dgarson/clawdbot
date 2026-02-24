import { describe, expect, it } from "vitest";
import type { EvaluationRunReport } from "./types.js";
import {
  resolveJsonlPath,
  writeEvaluationJsonl,
  writeEvaluationJsonlSummary,
} from "./export-jsonl.js";

describe("resolveJsonlPath", () => {
  it("uses explicit filePath when provided", () => {
    const result = resolveJsonlPath({ filePath: "/custom/path/results.jsonl" }, "eval-123");
    expect(result).toBe("/custom/path/results.jsonl");
  });

  it("constructs path from baseDir", () => {
    const result = resolveJsonlPath({ baseDir: "/workspace" }, "eval-123");
    expect(result).toBe("/workspace/reports/evals/eval-123.jsonl");
  });

  it("throws when neither baseDir nor filePath provided", () => {
    expect(() => resolveJsonlPath({}, "eval-123")).toThrow();
  });
});

describe("writeEvaluationJsonl", () => {
  const mockReport: EvaluationRunReport = {
    runId: "eval-test-001",
    startedAt: "2026-02-23T10:00:00.000Z",
    completedAt: "2026-02-23T10:00:05.000Z",
    durationMs: 5000,
    total: 3,
    passed: 2,
    failed: 1,
    cases: [
      {
        id: "tool.dispatch-success",
        suite: "tool-reliability",
        title: "Tool dispatch success",
        pass: true,
        summary: "Dispatch succeeded",
        durationMs: 100,
      },
      {
        id: "tool.dispatch-unknown",
        suite: "tool-reliability",
        title: "Tool dispatch unknown",
        pass: true,
        summary: "Handled gracefully",
        durationMs: 50,
      },
      {
        id: "agent.basic-spawn",
        suite: "agent-spawning",
        title: "Basic agent spawn",
        pass: false,
        summary: "Spawn failed",
        durationMs: 200,
      },
    ],
  };

  it("writes each case as a separate JSON line", async () => {
    const fs = await import("node:fs/promises");
    const tmpDir = await fs.mkdtemp("/tmp/evals-test-");

    const result = await writeEvaluationJsonl(mockReport, { baseDir: tmpDir });

    const content = await fs.readFile(result, "utf-8");
    const lines = content.trim().split("\n");

    expect(lines).toHaveLength(3);

    // Parse each line and verify structure
    for (const line of lines) {
      const record = JSON.parse(line);
      expect(record.runId).toBe("eval-test-001");
      expect(record.caseId).toBeDefined();
      expect(record.casePass).toBeDefined();
      expect(record.passRate).toBeDefined();
      expect(record.suites).toBeDefined();
    }

    // Verify pass rates
    const records = lines.map((l) => JSON.parse(l));
    const passingRecords = records.filter((r) => r.casePass);
    const failingRecords = records.filter((r) => !r.casePass);

    expect(passingRecords).toHaveLength(2);
    expect(failingRecords).toHaveLength(1);
    expect(records[0].passRate).toBe(66.67); // 2/3 * 100
    expect(records[0].passedCases).toBe(2);
    expect(records[0].failedCases).toBe(1);

    // Verify suite metrics
    expect(records[0].suites["tool-reliability"]).toEqual({
      total: 2,
      passed: 2,
      failed: 0,
      passRate: 100,
    });
    expect(records[0].suites["agent-spawning"]).toEqual({
      total: 1,
      passed: 0,
      failed: 1,
      passRate: 0,
    });

    // Verify category extraction from case ID
    expect(records[0].categories.tool).toBeDefined();
    expect(records[0].categories.agent).toBeDefined();

    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("appends to file when append option is true", async () => {
    const fs = await import("node:fs/promises");
    const tmpDir = await fs.mkdtemp("/tmp/evals-test-append-");

    await writeEvaluationJsonl(mockReport, { baseDir: tmpDir, append: false });
    await writeEvaluationJsonl(mockReport, { baseDir: tmpDir, append: true });
    const result = await writeEvaluationJsonl(mockReport, { baseDir: tmpDir, append: true });

    const content = await fs.readFile(result, "utf-8");
    const lines = content.trim().split("\n");

    // Should have 9 lines (3 + 3 + 3 from the three writes)
    expect(lines).toHaveLength(9);

    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("excludes metrics when includeMetrics is false", async () => {
    const fs = await import("node:fs/promises");
    const tmpDir = await fs.mkdtemp("/tmp/evals-test-");

    const result = await writeEvaluationJsonl(mockReport, {
      baseDir: tmpDir,
      includeMetrics: false,
    });

    const content = await fs.readFile(result, "utf-8");
    const record = JSON.parse(content.split("\n")[0]);

    expect(record.suites).toEqual({});
    expect(record.categories).toEqual({});
    expect(record.difficulties).toEqual({});

    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});

describe("writeEvaluationJsonlSummary", () => {
  const mockReport: EvaluationRunReport = {
    runId: "eval-test-summary",
    startedAt: "2026-02-23T10:00:00.000Z",
    completedAt: "2026-02-23T10:00:03.000Z",
    durationMs: 3000,
    total: 5,
    passed: 4,
    failed: 1,
    cases: [
      {
        id: "smoke.test-1",
        suite: "smoke",
        title: "Smoke test 1",
        pass: true,
        summary: "OK",
        durationMs: 10,
      },
      {
        id: "unit.test-2",
        suite: "unit",
        title: "Unit test 2",
        pass: true,
        summary: "OK",
        durationMs: 50,
      },
      {
        id: "unit.test-3",
        suite: "unit",
        title: "Unit test 3",
        pass: false,
        summary: "Failed",
        durationMs: 50,
      },
      {
        id: "integration.test-4",
        suite: "integration",
        title: "Integration test 4",
        pass: true,
        summary: "OK",
        durationMs: 100,
      },
      {
        id: "e2e.test-5",
        suite: "e2e",
        title: "E2E test 5",
        pass: true,
        summary: "OK",
        durationMs: 500,
      },
    ],
  };

  it("writes single summary line with aggregate metrics", async () => {
    const fs = await import("node:fs/promises");
    const tmpDir = await fs.mkdtemp("/tmp/evals-test-");

    const result = await writeEvaluationJsonlSummary(mockReport, { baseDir: tmpDir });

    const content = await fs.readFile(result, "utf-8");
    const lines = content.trim().split("\n");

    expect(lines).toHaveLength(1);

    const summary = JSON.parse(lines[0]);

    // Verify aggregate metrics
    expect(summary.runId).toBe("eval-test-summary");
    expect(summary.totalCases).toBe(5);
    expect(summary.passedCases).toBe(4);
    expect(summary.failedCases).toBe(1);
    expect(summary.passRate).toBe(80); // 4/5 * 100

    // Verify suite metrics
    expect(summary.suites.smoke.total).toBe(1);
    expect(summary.suites.smoke.passed).toBe(1);
    expect(summary.suites.unit.total).toBe(2);
    expect(summary.suites.unit.passed).toBe(1);
    expect(summary.suites.unit.failed).toBe(1);

    // Verify categories extracted from IDs (using suite as category)
    expect(summary.categories.smoke).toBeDefined();
    expect(summary.categories.unit).toBeDefined();
    expect(summary.categories.integration).toBeDefined();
    expect(summary.categories.e2e).toBeDefined();

    // Verify difficulties - derived from case ID pattern (second part of "suite.id" format)
    // For "smoke.test-1", parts[1] = "test-1", so difficulty is "test-1"
    expect(summary.difficulties["test-1"]).toBeDefined();

    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
