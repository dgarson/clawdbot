import { describe, expect, it } from "vitest";
import { BasicEvaluationRunner } from "./runner.js";
import type { EvaluationCase } from "./types.js";

describe("BasicEvaluationRunner", () => {
  it("runs cases and returns aggregate pass/fail counts", async () => {
    const runner = new BasicEvaluationRunner({ now: () => new Date("2026-02-23T07:00:00.000Z") });

    const cases: EvaluationCase[] = [
      {
        id: "suite-a.pass",
        suite: "suite-a",
        title: "Passing case",
        run: async () => ({ pass: true, summary: "ok", score: 1 }),
      },
      {
        id: "suite-a.fail",
        suite: "suite-a",
        title: "Failing case",
        run: async () => ({ pass: false, summary: "not ok", score: 0 }),
      },
    ];

    const report = await runner.run(cases);

    expect(report.total).toBe(2);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.cases).toHaveLength(2);
    expect(report.cases[0]).toMatchObject({ id: "suite-a.pass", pass: true });
    expect(report.cases[1]).toMatchObject({ id: "suite-a.fail", pass: false });
  });

  it("captures thrown errors as failed case results", async () => {
    const runner = new BasicEvaluationRunner({ now: () => new Date("2026-02-23T07:00:00.000Z") });

    const report = await runner.run([
      {
        id: "suite-b.throw",
        suite: "suite-b",
        title: "Throws",
        run: async () => {
          throw new Error("boom");
        },
      },
    ]);

    expect(report.failed).toBe(1);
    expect(report.cases[0]?.pass).toBe(false);
    expect(report.cases[0]?.summary).toContain("boom");
  });
});
