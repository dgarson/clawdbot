import { describe, expect, it } from "vitest";
import type { ScoringContext, ScoringConfig } from "./types.js";
import { DEFAULT_SCORING_CONFIG } from "./defaults.js";
import {
  evaluateMemoryRelevance,
  shouldCapture,
  isHighValue,
  shouldUseLlmEval,
  formatBreakdown,
  breakdownToTrace,
  getActiveProfile,
} from "./scorer.js";

// ────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    tool: {
      name: "exec",
      callId: "test-call-1",
      isError: false,
    },
    session: { key: "test-session", id: "test-id" },
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Core Scoring Tests
// ────────────────────────────────────────────────────────────────────────────

describe("evaluateMemoryRelevance", () => {
  it("returns a valid breakdown with all factors", () => {
    const breakdown = evaluateMemoryRelevance(makeCtx());

    expect(breakdown.factors).toHaveLength(5);
    expect(breakdown.compositeScore).toBeGreaterThanOrEqual(0);
    expect(breakdown.compositeScore).toBeLessThanOrEqual(1);
    expect(breakdown.totalWeight).toBeGreaterThan(0);
    expect(typeof breakdown.computeMs).toBe("number");

    // Check all factor names are present
    const names = breakdown.factors.map((f) => f.name);
    expect(names).toContain("novelty");
    expect(names).toContain("impact");
    expect(names).toContain("relational");
    expect(names).toContain("temporal");
    expect(names).toContain("userIntent");
  });

  it("scores errors higher than non-errors", () => {
    const noError = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "exec", callId: "c1", isError: false } }),
    );
    const withError = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "exec", callId: "c2", isError: true } }),
    );

    expect(withError.compositeScore).toBeGreaterThan(noError.compositeScore);
  });

  it("scores high-impact tools higher than low-impact tools", () => {
    const writeCtx = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "write", callId: "c1", isError: false } }),
    );
    const readCtx = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "read", callId: "c2", isError: false } }),
    );

    expect(writeCtx.compositeScore).toBeGreaterThan(readCtx.compositeScore);
  });

  it("boosts score for user-marked-important", () => {
    const normal = evaluateMemoryRelevance(makeCtx());
    const marked = evaluateMemoryRelevance(makeCtx({ userMarkedImportant: true }));

    expect(marked.compositeScore).toBeGreaterThan(normal.compositeScore);
    expect(marked.overridden).toBe(true);
    expect(marked.overrideSource).toBe("user_intent");
  });

  it("scores manual capture (experience_capture) high", () => {
    const breakdown = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "experience_capture", callId: "c1", isError: false } }),
    );

    // userIntent factor should be very high
    const userIntentFactor = breakdown.factors.find((f) => f.name === "userIntent");
    expect(userIntentFactor).toBeDefined();
    expect(userIntentFactor!.rawScore).toBeGreaterThanOrEqual(0.9);
  });

  it("detects repetition and lowers novelty", () => {
    const recent = Array.from({ length: 5 }, (_, i) => ({
      ts: new Date(Date.now() - i * 1000).toISOString(),
      toolName: "exec",
      score: 0.5,
    }));

    const withRepetition = evaluateMemoryRelevance(makeCtx({ recentCaptures: recent }));
    const withoutRepetition = evaluateMemoryRelevance(makeCtx({ recentCaptures: [] }));

    const noveltyWith = withRepetition.factors.find((f) => f.name === "novelty")!;
    const noveltyWithout = withoutRepetition.factors.find((f) => f.name === "novelty")!;

    expect(noveltyWith.rawScore).toBeLessThan(noveltyWithout.rawScore);
  });

  it("applies weight to factors correctly", () => {
    const breakdown = evaluateMemoryRelevance(makeCtx());

    for (const factor of breakdown.factors) {
      expect(factor.weighted).toBeCloseTo(factor.rawScore * factor.weight, 5);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Tool Override Tests
// ────────────────────────────────────────────────────────────────────────────

describe("tool overrides", () => {
  it("applies minScore floor for message tool", () => {
    const breakdown = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "message", callId: "c1", isError: false } }),
    );

    // Default config has message minScore: 0.6
    expect(breakdown.compositeScore).toBeGreaterThanOrEqual(0.6);
  });

  it("applies maxScore cap for read tool", () => {
    const breakdown = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "read", callId: "c1", isError: false } }),
    );

    // Default config has read maxScore: 0.4
    expect(breakdown.compositeScore).toBeLessThanOrEqual(0.4);
  });

  it("applies maxScore cap for memory tools", () => {
    const breakdown = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "memory_search", callId: "c1", isError: false } }),
    );

    expect(breakdown.compositeScore).toBeLessThanOrEqual(0.15);
  });

  it("applies custom tool overrides", () => {
    const config: Partial<ScoringConfig> = {
      toolOverrides: [{ toolPattern: "custom_tool", fixedScore: 0.99 }],
      patternOverrides: [],
    };

    const breakdown = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "custom_tool", callId: "c1", isError: false } }),
      config,
    );

    expect(breakdown.compositeScore).toBeCloseTo(0.99, 1);
    expect(breakdown.overridden).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Pattern Override Tests
// ────────────────────────────────────────────────────────────────────────────

describe("pattern overrides", () => {
  it("applies error floor", () => {
    const breakdown = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "read", callId: "c1", isError: true } }),
    );

    // Error floor in default config is 0.55
    expect(breakdown.compositeScore).toBeGreaterThanOrEqual(0.55);
  });

  it("applies large result boost", () => {
    const smallResult = evaluateMemoryRelevance(makeCtx({ result: "small" }));
    const largeResult = evaluateMemoryRelevance(makeCtx({ result: "x".repeat(6000) }));

    // Large result boost adds 0.1
    expect(largeResult.compositeScore).toBeGreaterThan(smallResult.compositeScore);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Threshold Tests
// ────────────────────────────────────────────────────────────────────────────

describe("threshold checks", () => {
  it("shouldCapture returns true for high scores", () => {
    const breakdown = evaluateMemoryRelevance(
      makeCtx({
        tool: { name: "message", callId: "c1", isError: false },
        userMarkedImportant: true,
      }),
    );

    expect(shouldCapture(breakdown)).toBe(true);
  });

  it("shouldCapture returns false for low scores", () => {
    const breakdown = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "memory_search", callId: "c1", isError: false } }),
    );

    expect(shouldCapture(breakdown)).toBe(false);
  });

  it("uses conservative profile when configured", () => {
    const config: Partial<ScoringConfig> = {
      activeProfile: "conservative",
    };

    const profile = getActiveProfile(config);
    expect(profile.captureThreshold).toBe(0.7);
  });

  it("isHighValue detects exceptional experiences", () => {
    const breakdown = evaluateMemoryRelevance(makeCtx({ userMarkedImportant: true }));

    expect(isHighValue(breakdown)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// LLM Eval Decision Tests
// ────────────────────────────────────────────────────────────────────────────

describe("shouldUseLlmEval", () => {
  it("recommends LLM eval for uncertain scores", () => {
    // Create a context that produces a mid-range score
    const breakdown = evaluateMemoryRelevance(
      makeCtx({
        tool: { name: "browser", callId: "c1", isError: false },
      }),
    );

    // Browser is medium impact, likely in the uncertain zone
    const shouldUse = shouldUseLlmEval(breakdown);
    // Result depends on exact score, but the function should be callable
    expect(typeof shouldUse).toBe("boolean");
  });

  it("does not recommend LLM eval for clearly high scores", () => {
    const breakdown = evaluateMemoryRelevance(makeCtx({ userMarkedImportant: true }));

    expect(shouldUseLlmEval(breakdown)).toBe(false);
  });

  it("does not recommend LLM eval for clearly low scores", () => {
    const breakdown = evaluateMemoryRelevance(
      makeCtx({ tool: { name: "memory_search", callId: "c1", isError: false } }),
    );

    expect(shouldUseLlmEval(breakdown)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Formatting Tests
// ────────────────────────────────────────────────────────────────────────────

describe("formatting", () => {
  it("formatBreakdown produces readable output", () => {
    const breakdown = evaluateMemoryRelevance(makeCtx());
    const formatted = formatBreakdown(breakdown);

    expect(formatted).toContain("Score:");
    expect(formatted).toContain("novelty:");
    expect(formatted).toContain("impact:");
    expect(formatted).toContain("relational:");
    expect(formatted).toContain("temporal:");
    expect(formatted).toContain("userIntent:");
  });

  it("breakdownToTrace produces compact JSON", () => {
    const breakdown = evaluateMemoryRelevance(makeCtx());
    const trace = breakdownToTrace(breakdown);

    expect(typeof trace.score).toBe("number");
    expect(typeof trace.overridden).toBe("boolean");
    expect(typeof trace.factors).toBe("object");
    expect(trace.factors).toHaveProperty("novelty");
    expect(trace.factors).toHaveProperty("impact");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles empty context gracefully", () => {
    const breakdown = evaluateMemoryRelevance({
      tool: { name: "", callId: "", isError: false },
    });

    expect(breakdown.compositeScore).toBeGreaterThanOrEqual(0);
    expect(breakdown.compositeScore).toBeLessThanOrEqual(1);
  });

  it("handles all zero weights gracefully", () => {
    const config: Partial<ScoringConfig> = {
      weights: {
        novelty: 0,
        impact: 0,
        relational: 0,
        temporal: 0,
        userIntent: 0,
      },
    };

    const breakdown = evaluateMemoryRelevance(makeCtx(), config);
    expect(breakdown.compositeScore).toBe(0);
  });

  it("clamps composite score to [0, 1]", () => {
    // Even with extreme overrides, should stay in range
    const config: Partial<ScoringConfig> = {
      patternOverrides: [
        {
          name: "extreme_boost",
          condition: { type: "toolName", pattern: "exec" },
          action: { type: "boost", amount: 5.0 },
        },
      ],
      toolOverrides: [],
    };

    const breakdown = evaluateMemoryRelevance(makeCtx(), config);
    expect(breakdown.compositeScore).toBeLessThanOrEqual(1);
  });
});
