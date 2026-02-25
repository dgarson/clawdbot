import { describe, expect, test } from "vitest";
import type { JudgeProfile } from "../types.js";
import { scoreWithHeuristics, type HeuristicMetrics } from "./heuristic-judge.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(overrides?: Partial<JudgeProfile>): JudgeProfile {
  return {
    id: "test-heuristic",
    version: 1,
    name: "Test Heuristic Judge",
    matchLabels: ["*"],
    method: "heuristic",
    criteria: [
      { id: "response_time", name: "Response Time", description: "Speed", weight: 1 },
      { id: "token_efficiency", name: "Token Efficiency", description: "Efficiency", weight: 1 },
      { id: "tool_count", name: "Tool Count", description: "Tool usage", weight: 1 },
    ],
    disqualifiers: [],
    scale: { min: 0, max: 100 },
    ...overrides,
  };
}

const runMeta = { runId: "run-1", agentId: "agent-1", sessionKey: "sess-1" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreWithHeuristics", () => {
  test("fast response time scores high", () => {
    const metrics: HeuristicMetrics = {
      durationMs: 5_000, // Under 10s threshold
      inputTokens: 100,
      outputTokens: 50,
      toolCallCount: 0,
    };

    const result = scoreWithHeuristics(makeProfile(), metrics, runMeta);

    // response_time: 5000ms <= 10000ms => normalized = 1.0 => score 100
    expect(result.criteriaScores.response_time).toBe(100);
    expect(result.confidence).toBe(0.9);
    expect(result.disqualified).toBe(false);
  });

  test("slow response time scores low", () => {
    const metrics: HeuristicMetrics = {
      durationMs: 120_000, // At or above 120s threshold
      inputTokens: 100,
      outputTokens: 50,
      toolCallCount: 0,
    };

    const result = scoreWithHeuristics(makeProfile(), metrics, runMeta);

    // response_time: 120000ms >= slowResponseMs => normalized = 0 => score 0
    expect(result.criteriaScores.response_time).toBe(0);
  });

  test("mid-range response time linearly interpolates", () => {
    const metrics: HeuristicMetrics = {
      // Midpoint between 10000 and 120000 => 65000ms
      durationMs: 65_000,
      inputTokens: 100,
      outputTokens: 50,
      toolCallCount: 0,
    };

    const result = scoreWithHeuristics(makeProfile(), metrics, runMeta);

    // Should be between 0 and 100
    expect(result.criteriaScores.response_time).toBeGreaterThan(0);
    expect(result.criteriaScores.response_time).toBeLessThan(100);
  });

  test("token efficiency: low ratio scores high", () => {
    const metrics: HeuristicMetrics = {
      durationMs: 5_000,
      inputTokens: 200,
      outputTokens: 50, // ratio = 0.25, under ideal 0.5
      toolCallCount: 0,
    };

    const result = scoreWithHeuristics(makeProfile(), metrics, runMeta);

    // token_efficiency: ratio 0.25 <= idealTokenRatio 0.5 => normalized = 1.0 => 100
    expect(result.criteriaScores.token_efficiency).toBe(100);
  });

  test("token efficiency: high ratio scores low", () => {
    const metrics: HeuristicMetrics = {
      durationMs: 5_000,
      inputTokens: 100,
      outputTokens: 500, // ratio = 5.0, at or above maxTokenRatio
      toolCallCount: 0,
    };

    const result = scoreWithHeuristics(makeProfile(), metrics, runMeta);

    // token_efficiency: ratio 5.0 >= maxTokenRatio 5.0 => normalized = 0 => 0
    expect(result.criteriaScores.token_efficiency).toBe(0);
  });

  test("token efficiency: zero input tokens scores full", () => {
    const metrics: HeuristicMetrics = {
      durationMs: 5_000,
      inputTokens: 0,
      outputTokens: 100,
      toolCallCount: 0,
    };

    const result = scoreWithHeuristics(makeProfile(), metrics, runMeta);
    expect(result.criteriaScores.token_efficiency).toBe(100);
  });

  test("tool count: zero tools scores full", () => {
    const metrics: HeuristicMetrics = {
      durationMs: 5_000,
      inputTokens: 100,
      outputTokens: 50,
      toolCallCount: 0,
    };

    const result = scoreWithHeuristics(makeProfile(), metrics, runMeta);

    // tool_count: 0 calls => normalized = 1.0 => 100
    expect(result.criteriaScores.tool_count).toBe(100);
  });

  test("tool count: many tools scores low", () => {
    const metrics: HeuristicMetrics = {
      durationMs: 5_000,
      inputTokens: 100,
      outputTokens: 50,
      toolCallCount: 10, // At or above maxToolCalls
    };

    const result = scoreWithHeuristics(makeProfile(), metrics, runMeta);

    // tool_count: 10 >= maxToolCalls 10 => normalized = 0 => 0
    expect(result.criteriaScores.tool_count).toBe(0);
  });

  test("overall score is weighted average", () => {
    const profile = makeProfile({
      criteria: [
        { id: "response_time", name: "RT", description: "Speed", weight: 3 },
        { id: "tool_count", name: "TC", description: "Tools", weight: 1 },
      ],
    });

    const metrics: HeuristicMetrics = {
      durationMs: 5_000, // response_time => 100
      inputTokens: 0,
      outputTokens: 0,
      toolCallCount: 10, // tool_count => 0
    };

    const result = scoreWithHeuristics(profile, metrics, runMeta);

    // Weighted: (100 * 3 + 0 * 1) / (3 + 1) = 75
    expect(result.overallScore).toBe(75);
  });
});
