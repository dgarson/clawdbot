/**
 * Tests for Claude SDK session utilities.
 */

import { describe, it, expect } from "vitest";
import { mapModelToSdkTier } from "./session.js";

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
