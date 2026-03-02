import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  estimateUsageCost,
  formatTokenCount,
  formatUsd,
  resolveModelCostConfig,
} from "./usage-format.js";

describe("usage-format", () => {
  it("formats token counts", () => {
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(1234)).toBe("1.2k");
    expect(formatTokenCount(12000)).toBe("12k");
    expect(formatTokenCount(2_500_000)).toBe("2.5m");
  });

  it("formats USD values", () => {
    expect(formatUsd(1.234)).toBe("$1.23");
    expect(formatUsd(0.5)).toBe("$0.50");
    expect(formatUsd(0.0042)).toBe("$0.0042");
  });

  it("resolves model cost config and estimates usage cost", () => {
    const config = {
      models: {
        providers: {
          test: {
            models: [
              {
                id: "m1",
                cost: { input: 1, output: 2, cacheRead: 0.5, cacheWrite: 0 },
              },
            ],
          },
        },
      },
    } as unknown as OpenClawConfig;

    const cost = resolveModelCostConfig({
      provider: "test",
      model: "m1",
      config,
    });

    expect(cost).toEqual({
      input: 1,
      output: 2,
      cacheRead: 0.5,
      cacheWrite: 0,
    });

    const total = estimateUsageCost({
      usage: { input: 1000, output: 500, cacheRead: 2000 },
      cost,
    });

    expect(total).toBeCloseTo(0.003);
  });

  describe("anthropic built-in costs", () => {
    it("resolves haiku cost for any generation", () => {
      for (const model of ["claude-haiku-4-5", "claude-haiku-3-5"]) {
        const cost = resolveModelCostConfig({ provider: "anthropic", model });
        expect(cost).toEqual({ input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 });
      }
    });

    it("resolves sonnet cost for any generation", () => {
      for (const model of ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-sonnet-4"]) {
        const cost = resolveModelCostConfig({ provider: "anthropic", model });
        expect(cost).toEqual({ input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 });
      }
    });

    it("resolves opus cost for any generation", () => {
      for (const model of ["claude-opus-4-6", "claude-opus-4-5", "claude-opus-4"]) {
        const cost = resolveModelCostConfig({ provider: "anthropic", model });
        expect(cost).toEqual({ input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 });
      }
    });

    it("returns undefined for unknown claude models", () => {
      expect(
        resolveModelCostConfig({ provider: "anthropic", model: "claude-unknown-1" }),
      ).toBeUndefined();
    });

    it("applies to claude- models on any provider", () => {
      const cost = resolveModelCostConfig({ provider: "openrouter", model: "claude-sonnet-4-6" });
      expect(cost).toEqual({ input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 });
    });

    it("does not apply to non-claude models on non-anthropic providers", () => {
      expect(
        resolveModelCostConfig({ provider: "openrouter", model: "deepseek-chat" }),
      ).toBeUndefined();
    });

    it("explicit config overrides built-in cost", () => {
      const customCost = { input: 99, output: 99, cacheRead: 99, cacheWrite: 99 };
      const config = {
        models: {
          providers: {
            anthropic: {
              models: [{ id: "claude-sonnet-4-6", cost: customCost }],
            },
          },
        },
      } as unknown as OpenClawConfig;
      const cost = resolveModelCostConfig({
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        config,
      });
      expect(cost).toEqual(customCost);
    });

    it("computes correct cost for a sonnet run", () => {
      const cost = resolveModelCostConfig({ provider: "anthropic", model: "claude-sonnet-4-6" });
      // 10k input + 2k output + 5k cache read = $3*10k + $15*2k + $0.3*5k = 30k+30k+1.5k = 61,500 per 1M
      const total = estimateUsageCost({
        usage: { input: 10_000, output: 2_000, cacheRead: 5_000 },
        cost,
      });
      expect(total).toBeCloseTo(0.0615);
    });
  });
});
