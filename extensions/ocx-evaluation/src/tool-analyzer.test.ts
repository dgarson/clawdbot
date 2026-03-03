import { describe, expect, test } from "vitest";
import {
  computeEffectivenessScore,
  detectCorrections,
  detectRepetitions,
} from "./tool-analyzer.js";
import type { ToolEvent } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToolEvent(overrides: Partial<ToolEvent> & Pick<ToolEvent, "toolName">): ToolEvent {
  return {
    eventId: `tool-${Math.random().toString(36).slice(2, 8)}`,
    params: {},
    success: true,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectCorrections
// ---------------------------------------------------------------------------

describe("detectCorrections", () => {
  test("fallback_after_error: tool fails then a different tool is called", () => {
    const events: ToolEvent[] = [
      makeToolEvent({ eventId: "t1", toolName: "file_read", success: false, error: "not found" }),
      makeToolEvent({ eventId: "t2", toolName: "web_search", success: true }),
    ];

    const corrections = detectCorrections(events);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({
      originalCallId: "t1",
      originalToolName: "file_read",
      correctedCallId: "t2",
      correctedToolName: "web_search",
      reason: "fallback_after_error",
    });
  });

  test("retry_with_different_params: same tool called with different params", () => {
    const events: ToolEvent[] = [
      makeToolEvent({
        eventId: "t1",
        toolName: "web_search",
        params: { query: "openai api" },
        success: true,
      }),
      makeToolEvent({
        eventId: "t2",
        toolName: "web_search",
        params: { query: "openai api pricing" },
        success: true,
      }),
    ];

    const corrections = detectCorrections(events);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({
      originalCallId: "t1",
      correctedCallId: "t2",
      reason: "retry_with_different_params",
    });
  });

  test("no corrections when all calls are distinct and successful", () => {
    const events: ToolEvent[] = [
      makeToolEvent({ toolName: "file_read", success: true }),
      makeToolEvent({ toolName: "web_search", success: true }),
      makeToolEvent({ toolName: "code_exec", success: true }),
    ];

    expect(detectCorrections(events)).toHaveLength(0);
  });

  test("empty events returns empty corrections", () => {
    expect(detectCorrections([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detectRepetitions
// ---------------------------------------------------------------------------

describe("detectRepetitions", () => {
  test("same tool called multiple times with similar params", () => {
    const events: ToolEvent[] = [
      makeToolEvent({
        eventId: "r1",
        toolName: "web_search",
        params: { query: "vitest docs", limit: 10 },
      }),
      makeToolEvent({
        eventId: "r2",
        toolName: "web_search",
        params: { query: "vitest docs", limit: 10 },
      }),
      makeToolEvent({
        eventId: "r3",
        toolName: "web_search",
        params: { query: "vitest docs", limit: 10 },
      }),
    ];

    const repetitions = detectRepetitions(events);
    expect(repetitions).toHaveLength(1);
    expect(repetitions[0]!.toolName).toBe("web_search");
    expect(repetitions[0]!.callIds).toContain("r1");
    expect(repetitions[0]!.callIds).toContain("r2");
    expect(repetitions[0]!.callIds).toContain("r3");
    expect(repetitions[0]!.paramSimilarity).toBeGreaterThanOrEqual(0.8);
  });

  test("no repetitions when tools differ", () => {
    const events: ToolEvent[] = [
      makeToolEvent({ toolName: "file_read", params: { path: "/a" } }),
      makeToolEvent({ toolName: "web_search", params: { query: "test" } }),
    ];

    expect(detectRepetitions(events)).toHaveLength(0);
  });

  test("no repetitions when same tool has very different params", () => {
    const events: ToolEvent[] = [
      makeToolEvent({
        toolName: "web_search",
        params: { query: "alpha", region: "us", limit: 5 },
      }),
      makeToolEvent({
        toolName: "web_search",
        params: { query: "completely different", region: "eu", limit: 100 },
      }),
    ];

    // With very different params, Jaccard similarity should be below 0.8
    expect(detectRepetitions(events)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computeEffectivenessScore
// ---------------------------------------------------------------------------

describe("computeEffectivenessScore", () => {
  test("perfect run: all success, no corrections", () => {
    const score = computeEffectivenessScore({
      runId: "run-1",
      totalCalls: 5,
      successfulCalls: 5,
      failedCalls: 0,
      corrections: [],
      wastedCalls: [],
      repeatedCalls: [],
    });

    // 40 (success) + 30 (no corrections) + 20 (no wasted) + 10 (no reps) = 100
    expect(score).toBe(100);
  });

  test("degraded run: failures + corrections", () => {
    const score = computeEffectivenessScore({
      runId: "run-2",
      totalCalls: 4,
      successfulCalls: 2,
      failedCalls: 2,
      corrections: [
        {
          originalCallId: "t1",
          originalToolName: "a",
          correctedCallId: "t2",
          correctedToolName: "b",
          reason: "fallback_after_error",
        },
      ],
      wastedCalls: ["t3"],
      repeatedCalls: [{ toolName: "a", callIds: ["t1", "t2"], paramSimilarity: 0.9 }],
    });

    // successRate = 2/4 = 0.5 => 0.5 * 40 = 20
    // correctionRatio = 1/4 = 0.25 => (1 - 0.25) * 30 = 22.5
    // wastedRatio = 1/4 = 0.25 => (1 - 0.25) * 20 = 15
    // repRatio = 1/4 = 0.25 => (1 - 0.25) * 10 = 7.5
    // Total = 20 + 22.5 + 15 + 7.5 = 65
    expect(score).toBe(65);
  });

  test("zero tool calls returns 100", () => {
    const score = computeEffectivenessScore({
      runId: "run-0",
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      corrections: [],
      wastedCalls: [],
      repeatedCalls: [],
    });
    expect(score).toBe(100);
  });

  test("all calls failed returns low score", () => {
    const score = computeEffectivenessScore({
      runId: "run-fail",
      totalCalls: 3,
      successfulCalls: 0,
      failedCalls: 3,
      corrections: [],
      wastedCalls: ["w1", "w2", "w3"],
      repeatedCalls: [],
    });

    // successRate = 0 => 0
    // correctionRatio = 0 => 30
    // wastedRatio = 1 => 0
    // repRatio = 0 => 10
    // Total = 0 + 30 + 0 + 10 = 40
    expect(score).toBe(40);
  });
});
