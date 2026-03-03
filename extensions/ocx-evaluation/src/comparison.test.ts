import { describe, expect, test } from "vitest";
import { aggregateModelComparison } from "./comparison.js";
import type { Scorecard } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScorecard(overrides: Partial<Scorecard>): Scorecard {
  return {
    runId: "run-" + Math.random().toString(36).slice(2, 8),
    agentId: "agent-1",
    sessionKey: "sess-1",
    judgeProfileId: "judge-1",
    judgeProfileVersion: 1,
    overallScore: 75,
    criteriaScores: {},
    confidence: 0.9,
    disqualified: false,
    scoredAt: "2026-02-20T12:00:00.000Z",
    model: "gpt-4.1",
    provider: "openai",
    classificationLabel: "coding",
    costUsd: 0.01,
    totalTokens: 1000,
    durationMs: 5000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("aggregateModelComparison", () => {
  test("aggregates by model for a given label", () => {
    const scorecards: Scorecard[] = [
      makeScorecard({
        model: "gpt-4.1",
        provider: "openai",
        classificationLabel: "coding",
        overallScore: 80,
        costUsd: 0.02,
        totalTokens: 1200,
        durationMs: 4000,
        scoredAt: "2026-02-20T10:00:00.000Z",
      }),
      makeScorecard({
        model: "gpt-4.1",
        provider: "openai",
        classificationLabel: "coding",
        overallScore: 90,
        costUsd: 0.04,
        totalTokens: 1800,
        durationMs: 6000,
        scoredAt: "2026-02-20T14:00:00.000Z",
      }),
      makeScorecard({
        model: "claude-sonnet-4",
        provider: "anthropic",
        classificationLabel: "coding",
        overallScore: 95,
        costUsd: 0.03,
        totalTokens: 1500,
        durationMs: 3000,
        scoredAt: "2026-02-20T12:00:00.000Z",
      }),
    ];

    const result = aggregateModelComparison(scorecards, {
      classificationLabel: "coding",
      from: "2026-02-20",
      to: "2026-02-21",
    });

    expect(result.classificationLabel).toBe("coding");
    expect(result.models).toHaveLength(2);

    // Sorted by avgScore descending, so claude first
    const claude = result.models.find((m) => m.model === "claude-sonnet-4");
    const gpt = result.models.find((m) => m.model === "gpt-4.1");

    expect(claude).toBeDefined();
    expect(claude!.runCount).toBe(1);
    expect(claude!.avgScore).toBe(95);
    expect(claude!.provider).toBe("anthropic");

    expect(gpt).toBeDefined();
    expect(gpt!.runCount).toBe(2);
    expect(gpt!.avgScore).toBe(85); // (80 + 90) / 2
    expect(gpt!.avgCostUsd).toBeCloseTo(0.03, 5); // (0.02 + 0.04) / 2
    expect(gpt!.avgTokens).toBe(1500); // (1200 + 1800) / 2
    expect(gpt!.avgDurationMs).toBe(5000); // (4000 + 6000) / 2
  });

  test("scorePerDollar calculation", () => {
    const scorecards: Scorecard[] = [
      makeScorecard({
        model: "cheap-model",
        provider: "provider-a",
        classificationLabel: "general",
        overallScore: 80,
        costUsd: 0.01,
        scoredAt: "2026-02-20T12:00:00.000Z",
      }),
    ];

    const result = aggregateModelComparison(scorecards, {
      classificationLabel: "general",
      from: "2026-02-20",
      to: "2026-02-21",
    });

    expect(result.models).toHaveLength(1);
    // scorePerDollar = avgScore / avgCostUsd = 80 / 0.01 = 8000
    expect(result.models[0]!.scorePerDollar).toBe(8000);
  });

  test("scorePerDollar is 0 when cost is 0", () => {
    const scorecards: Scorecard[] = [
      makeScorecard({
        model: "free-model",
        provider: "local",
        classificationLabel: "general",
        overallScore: 60,
        costUsd: 0,
        scoredAt: "2026-02-20T12:00:00.000Z",
      }),
    ];

    const result = aggregateModelComparison(scorecards, {
      classificationLabel: "general",
      from: "2026-02-20",
      to: "2026-02-21",
    });

    expect(result.models).toHaveLength(1);
    expect(result.models[0]!.scorePerDollar).toBe(0);
  });

  test("empty data returns empty comparison", () => {
    const result = aggregateModelComparison([], {
      classificationLabel: "coding",
      from: "2026-02-20",
      to: "2026-02-21",
    });

    expect(result.classificationLabel).toBe("coding");
    expect(result.timeRange).toEqual({ from: "2026-02-20", to: "2026-02-21" });
    expect(result.models).toHaveLength(0);
  });

  test("filters by classification label", () => {
    const scorecards: Scorecard[] = [
      makeScorecard({
        classificationLabel: "coding",
        scoredAt: "2026-02-20T12:00:00.000Z",
      }),
      makeScorecard({
        classificationLabel: "general",
        scoredAt: "2026-02-20T12:00:00.000Z",
      }),
    ];

    const result = aggregateModelComparison(scorecards, {
      classificationLabel: "coding",
      from: "2026-02-20",
      to: "2026-02-21",
    });

    expect(result.models).toHaveLength(1);
  });

  test("filters by time range", () => {
    const scorecards: Scorecard[] = [
      makeScorecard({
        classificationLabel: "coding",
        scoredAt: "2026-02-19T12:00:00.000Z", // Before range
      }),
      makeScorecard({
        classificationLabel: "coding",
        scoredAt: "2026-02-20T12:00:00.000Z", // In range
      }),
    ];

    const result = aggregateModelComparison(scorecards, {
      classificationLabel: "coding",
      from: "2026-02-20",
      to: "2026-02-21",
    });

    expect(result.models).toHaveLength(1);
  });
});
