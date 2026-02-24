import type { EvaluationCase } from "./types.js";

export const sampleEchoEvaluationCase: EvaluationCase = {
  id: "sample.echo-smoke",
  suite: "sample",
  title: "Sample echo smoke case",
  description: "Simple always-green case proving harness wiring and report plumbing.",
  tags: ["smoke", "sample"],
  run: async () => {
    const expected = "pong";
    const actual = "pong";

    return {
      pass: actual === expected,
      summary: "Sample echo check completed",
      score: actual === expected ? 1 : 0,
      details: {
        expected,
        actual,
      },
    };
  },
};
