import { describe, expect, it } from "vitest";
import { buildBenchmarkMatrix, buildBenchmarkReport } from "./benchmark-report.js";

describe("buildBenchmarkMatrix", () => {
  it("aggregates records into benchmark cells", () => {
    const matrix = buildBenchmarkMatrix([
      {
        scenarioId: "case-1",
        suite: "tool-reliability",
        category: "tool-reliability",
        difficulty: "unit",
        taskType: "T1",
        modelId: "openai/gpt-5",
        pass: true,
        score: 0.82,
        durationMs: 100,
      },
      {
        scenarioId: "case-2",
        suite: "tool-reliability",
        category: "tool-reliability",
        difficulty: "unit",
        taskType: "T1",
        modelId: "openai/gpt-5",
        pass: false,
        score: 0.65,
        durationMs: 150,
      },
    ]);

    expect(matrix.cells).toHaveLength(1);
    expect(matrix.cells[0]?.sampleCount).toBe(2);
    expect(matrix.cells[0]?.passRate).toBe(0.5);
    expect(matrix.cells[0]?.meanScore).toBe(0.735);
    expect(matrix.cells[0]?.lowConfidence).toBe(true);
  });
});

describe("buildBenchmarkReport", () => {
  it("builds summary + matrix + regression sections", () => {
    const report = buildBenchmarkReport({
      runId: "eval-20260223-123456",
      records: [
        {
          scenarioId: "case-1",
          suite: "memory",
          category: "memory",
          difficulty: "integration",
          taskType: "T2",
          modelId: "anthropic/claude-sonnet",
          pass: true,
          score: 0.91,
          durationMs: 220,
        },
      ],
      regressions: [
        {
          key: "anthropic/claude-sonnet|T2|memory|integration",
          baselineMean: 0.9,
          candidateMean: 0.91,
          delta: 0.01,
          status: "pass",
          reasons: [],
        },
      ],
    });

    expect(report.schemaVersion).toBe("eval-benchmark-report.v1");
    expect(report.summary.totalCases).toBe(1);
    expect(report.matrix.cells).toHaveLength(1);
    expect(report.regressions).toHaveLength(1);
  });
});
