import { describe, expect, it } from "vitest";
import { sampleEchoEvaluationCase } from "./sample-case.js";

describe("sampleEchoEvaluationCase", () => {
  it("returns a passing result for baseline harness validation", async () => {
    const result = await sampleEchoEvaluationCase.run({
      runId: "eval-1",
      startedAt: "2026-02-23T07:00:00.000Z",
    });

    expect(sampleEchoEvaluationCase.id).toBe("sample.echo-smoke");
    expect(sampleEchoEvaluationCase.suite).toBe("sample");
    expect(result.pass).toBe(true);
    expect(result.summary).toContain("completed");
    expect(result.details).toMatchObject({ expected: "pong", actual: "pong" });
  });
});
