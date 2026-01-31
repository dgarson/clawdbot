/**
 * Tests for Claude SDK session utilities.
 */

import { describe, it, expect } from "vitest";
import { mapModelToSdkTier, resolveThinkingBudget } from "./session.js";

describe("mapModelToSdkTier", () => {
  describe("opus tier detection", () => {
    it("maps anthropic/claude-opus-4-5 to opus", () => {
      expect(mapModelToSdkTier("anthropic/claude-opus-4-5")).toBe("opus");
    });

    it("maps claude-opus-4 to opus", () => {
      expect(mapModelToSdkTier("claude-opus-4")).toBe("opus");
    });

    it("maps opus to opus", () => {
      expect(mapModelToSdkTier("opus")).toBe("opus");
    });

    it("handles case insensitively", () => {
      expect(mapModelToSdkTier("OPUS")).toBe("opus");
      expect(mapModelToSdkTier("Claude-OPUS-4")).toBe("opus");
    });
  });

  describe("sonnet tier detection", () => {
    it("maps anthropic/claude-sonnet-4 to sonnet", () => {
      expect(mapModelToSdkTier("anthropic/claude-sonnet-4")).toBe("sonnet");
    });

    it("maps claude-sonnet-4-5 to sonnet", () => {
      expect(mapModelToSdkTier("claude-sonnet-4-5")).toBe("sonnet");
    });

    it("maps sonnet to sonnet", () => {
      expect(mapModelToSdkTier("sonnet")).toBe("sonnet");
    });

    it("handles case insensitively", () => {
      expect(mapModelToSdkTier("SONNET")).toBe("sonnet");
      expect(mapModelToSdkTier("Claude-SONNET-4")).toBe("sonnet");
    });
  });

  describe("haiku tier detection", () => {
    it("maps anthropic/claude-haiku-4 to haiku", () => {
      expect(mapModelToSdkTier("anthropic/claude-haiku-4")).toBe("haiku");
    });

    it("maps claude-haiku-3 to haiku", () => {
      expect(mapModelToSdkTier("claude-haiku-3")).toBe("haiku");
    });

    it("maps haiku to haiku", () => {
      expect(mapModelToSdkTier("haiku")).toBe("haiku");
    });

    it("handles case insensitively", () => {
      expect(mapModelToSdkTier("HAIKU")).toBe("haiku");
      expect(mapModelToSdkTier("Claude-HAIKU-4")).toBe("haiku");
    });
  });

  describe("fallback behavior", () => {
    it("defaults to sonnet for unknown models", () => {
      expect(mapModelToSdkTier("gpt-4")).toBe("sonnet");
      expect(mapModelToSdkTier("unknown-model")).toBe("sonnet");
    });

    it("defaults to sonnet for empty string", () => {
      expect(mapModelToSdkTier("")).toBe("sonnet");
    });
  });

  describe("provider-prefixed models", () => {
    it("handles zai/ prefix", () => {
      expect(mapModelToSdkTier("zai/claude-sonnet-4")).toBe("sonnet");
      expect(mapModelToSdkTier("zai/claude-opus-4-5")).toBe("opus");
    });

    it("handles openrouter/ prefix", () => {
      expect(mapModelToSdkTier("openrouter/anthropic/claude-sonnet-4")).toBe("sonnet");
    });
  });
});

describe("resolveThinkingBudget", () => {
  describe("default budgets", () => {
    it("returns undefined for 'off'", () => {
      expect(resolveThinkingBudget("off")).toBeUndefined();
    });

    it("returns undefined for undefined thinkLevel", () => {
      expect(resolveThinkingBudget(undefined)).toBeUndefined();
    });

    it("returns 1000 for 'minimal'", () => {
      expect(resolveThinkingBudget("minimal")).toBe(1000);
    });

    it("returns 4000 for 'low'", () => {
      expect(resolveThinkingBudget("low")).toBe(4000);
    });

    it("returns 16000 for 'medium'", () => {
      expect(resolveThinkingBudget("medium")).toBe(16000);
    });

    it("returns 64000 for 'high'", () => {
      expect(resolveThinkingBudget("high")).toBe(64000);
    });

    it("returns 128000 for 'xhigh'", () => {
      expect(resolveThinkingBudget("xhigh")).toBe(128000);
    });
  });

  describe("custom budgets", () => {
    it("uses custom budget when provided", () => {
      expect(resolveThinkingBudget("low", { low: 8000 })).toBe(8000);
    });

    it("uses default when custom budget not provided for level", () => {
      expect(resolveThinkingBudget("low", { high: 100000 })).toBe(4000);
    });

    it("uses custom budget for all levels", () => {
      const custom = {
        minimal: 500,
        low: 2000,
        medium: 8000,
        high: 32000,
        xhigh: 64000,
      };
      expect(resolveThinkingBudget("minimal", custom)).toBe(500);
      expect(resolveThinkingBudget("low", custom)).toBe(2000);
      expect(resolveThinkingBudget("medium", custom)).toBe(8000);
      expect(resolveThinkingBudget("high", custom)).toBe(32000);
      expect(resolveThinkingBudget("xhigh", custom)).toBe(64000);
    });

    it("still returns undefined for 'off' even with custom budgets", () => {
      expect(resolveThinkingBudget("off", { low: 8000 })).toBeUndefined();
    });
  });
});
