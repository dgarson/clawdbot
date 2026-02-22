import { describe, it, expect } from "vitest";

/**
 * Unit tests for telemetry CLI core logic.
 * Tests the regression threshold and cost recommendation algorithms
 * without requiring actual telemetry files or a running gateway.
 */

// ─── Inline helpers (mirror of telemetry-cli.ts for testability) ──────────────

function getModelTier(model: string): number {
  if (/haiku|flash|mini|gemini-flash/i.test(model)) {
    return 1;
  }
  if (/sonnet|glm|minimax|grok-3-mini/i.test(model)) {
    return 2;
  }
  if (/opus|gpt-4o|grok-4|gemini-pro/i.test(model)) {
    return 3;
  }
  return 2;
}

function suggestDowngrade(model: string): string | null {
  const tier = getModelTier(model);
  if (tier <= 1) {
    return null;
  }
  if (tier === 3) {
    return "claude-sonnet-4-6";
  }
  if (tier === 2) {
    return "claude-haiku-3-5";
  }
  return null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

function computeRegression(
  baselineValue: number,
  currentValue: number,
  threshold: number,
): { deltaPct: number; regression: boolean } {
  const deltaPct =
    baselineValue !== 0 ? (currentValue - baselineValue) / Math.abs(baselineValue) : 0;
  return { deltaPct, regression: deltaPct > threshold };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getModelTier", () => {
  it("assigns tier 1 to cheap models", () => {
    expect(getModelTier("claude-haiku-3-5")).toBe(1);
    expect(getModelTier("gemini-flash-2")).toBe(1);
  });

  it("assigns tier 2 to mid-range models", () => {
    expect(getModelTier("claude-sonnet-4-6")).toBe(2);
    expect(getModelTier("glm-5")).toBe(2);
  });

  it("assigns tier 3 to expensive models", () => {
    expect(getModelTier("claude-opus-4-6")).toBe(3);
    expect(getModelTier("gpt-4o")).toBe(3);
    expect(getModelTier("grok-4")).toBe(3);
  });

  it("defaults unknown models to tier 2", () => {
    expect(getModelTier("some-unknown-model")).toBe(2);
  });
});

describe("suggestDowngrade", () => {
  it("suggests sonnet for opus-tier models", () => {
    expect(suggestDowngrade("claude-opus-4-6")).toBe("claude-sonnet-4-6");
    expect(suggestDowngrade("gpt-4o")).toBe("claude-sonnet-4-6");
  });

  it("suggests haiku for sonnet-tier models", () => {
    expect(suggestDowngrade("claude-sonnet-4-6")).toBe("claude-haiku-3-5");
  });

  it("returns null for already-cheapest models", () => {
    expect(suggestDowngrade("claude-haiku-3-5")).toBeNull();
    expect(suggestDowngrade("gemini-flash-2")).toBeNull();
  });
});

describe("regression threshold", () => {
  it("flags regression when delta exceeds threshold", () => {
    const result = computeRegression(100, 125, 0.2);
    expect(result.deltaPct).toBeCloseTo(0.25);
    expect(result.regression).toBe(true);
  });

  it("passes when delta is within threshold", () => {
    const result = computeRegression(100, 115, 0.2);
    expect(result.deltaPct).toBeCloseTo(0.15);
    expect(result.regression).toBe(false);
  });

  it("passes on exact threshold boundary (exclusive)", () => {
    const result = computeRegression(100, 120, 0.2);
    expect(result.deltaPct).toBeCloseTo(0.2);
    // 0.2 > 0.2 is false — boundary is exclusive
    expect(result.regression).toBe(false);
  });

  it("handles zero baseline without NaN", () => {
    const result = computeRegression(0, 50, 0.2);
    expect(result.deltaPct).toBe(0);
    expect(result.regression).toBe(false);
  });

  it("does not flag improvements (negative delta)", () => {
    const result = computeRegression(100, 70, 0.2);
    expect(result.deltaPct).toBeCloseTo(-0.3);
    expect(result.regression).toBe(false);
  });
});

describe("percentile computation", () => {
  it("computes p50 and p95 correctly", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // floor(10 * 0.5) = 5 → sorted[5] = 6
    expect(percentile(sorted, 0.5)).toBe(6);
    // floor(10 * 0.95) = 9 → sorted[9] = 10
    expect(percentile(sorted, 0.95)).toBe(10);
  });

  it("handles empty array", () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([], 0.95)).toBe(0);
  });

  it("handles single element", () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.95)).toBe(42);
  });
});
