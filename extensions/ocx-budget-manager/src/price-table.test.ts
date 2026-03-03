import { describe, expect, it } from "vitest";
import { PriceTable } from "./price-table.js";

describe("PriceTable", () => {
  it("returns correct cost for known model (gpt-4.1)", () => {
    const table = new PriceTable();
    // gpt-4.1: input $0.002/1k, output $0.008/1k
    const cost = table.estimateCost("gpt-4.1", 1000, 1000);
    // 1000/1000 * 0.002 + 1000/1000 * 0.008 = 0.01
    expect(cost).toBeCloseTo(0.01, 5);
  });

  it("returns correct cost for claude-opus-4", () => {
    const table = new PriceTable();
    // claude-opus-4: input $0.015/1k, output $0.075/1k
    const cost = table.estimateCost("claude-opus-4", 2000, 500);
    // 2000/1000 * 0.015 + 500/1000 * 0.075 = 0.03 + 0.0375 = 0.0675
    expect(cost).toBeCloseTo(0.0675, 5);
  });

  it("uses prefix matching for versioned model names", () => {
    const table = new PriceTable();
    // "gpt-4.1-2025-04-14" should match "gpt-4.1" prefix
    const cost = table.estimateCost("gpt-4.1-2025-04-14", 1000, 0);
    // 1000/1000 * 0.002 = 0.002
    expect(cost).toBeCloseTo(0.002, 5);
  });

  it("prefix matches gpt-4.1-mini variants", () => {
    const table = new PriceTable();
    // "gpt-4.1-mini-2025-04-14" starts with "gpt-4.1-mini"
    const cost = table.estimateCost("gpt-4.1-mini-2025-04-14", 1000, 1000);
    // gpt-4.1-mini: input $0.0004/1k, output $0.0016/1k
    // 0.0004 + 0.0016 = 0.002
    expect(cost).toBeCloseTo(0.002, 5);
  });

  it("returns 0 for unknown model", () => {
    const table = new PriceTable();
    const cost = table.estimateCost("totally-unknown-model-xyz", 5000, 5000);
    expect(cost).toBe(0);
  });

  it("merges custom prices with defaults", () => {
    const table = new PriceTable({
      "custom-model": { inputPer1k: 0.01, outputPer1k: 0.05 },
    });
    const cost = table.estimateCost("custom-model", 1000, 1000);
    // 0.01 + 0.05 = 0.06
    expect(cost).toBeCloseTo(0.06, 5);

    // Default models still work
    const defaultCost = table.estimateCost("gpt-4.1", 1000, 0);
    expect(defaultCost).toBeCloseTo(0.002, 5);
  });

  it("custom prices override defaults for the same model", () => {
    const table = new PriceTable({
      "gpt-4.1": { inputPer1k: 0.1, outputPer1k: 0.2 },
    });
    const cost = table.estimateCost("gpt-4.1", 1000, 1000);
    // 0.1 + 0.2 = 0.3
    expect(cost).toBeCloseTo(0.3, 5);
  });

  it("handles zero tokens correctly", () => {
    const table = new PriceTable();
    const cost = table.estimateCost("gpt-4.1", 0, 0);
    expect(cost).toBe(0);
  });
});
