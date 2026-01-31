/**
 * Tests for Claude SDK provider configuration.
 */

import { describe, it, expect } from "vitest";
import { resolveModelNameEnvVars, isValidClaudeSdkProvider } from "./provider-config.js";

describe("isValidClaudeSdkProvider", () => {
  it("returns true for anthropic", () => {
    expect(isValidClaudeSdkProvider("anthropic")).toBe(true);
  });

  it("returns true for zai", () => {
    expect(isValidClaudeSdkProvider("zai")).toBe(true);
  });

  it("returns true for openrouter", () => {
    expect(isValidClaudeSdkProvider("openrouter")).toBe(true);
  });

  it("returns true for kimi", () => {
    expect(isValidClaudeSdkProvider("kimi")).toBe(true);
  });

  it("returns false for unknown provider", () => {
    expect(isValidClaudeSdkProvider("unknown")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidClaudeSdkProvider("")).toBe(false);
  });
});

describe("resolveModelNameEnvVars", () => {
  describe("with no models configured", () => {
    it("returns undefined when claudeSdkOptions is undefined", () => {
      expect(resolveModelNameEnvVars("anthropic", undefined)).toBeUndefined();
    });

    it("returns undefined when models is undefined", () => {
      expect(resolveModelNameEnvVars("anthropic", {})).toBeUndefined();
    });

    it("returns undefined when models is empty", () => {
      expect(resolveModelNameEnvVars("anthropic", { models: {} })).toBeUndefined();
    });
  });

  describe("provider prefix stripping for Anthropic", () => {
    it("strips provider prefix for sonnet model", () => {
      const result = resolveModelNameEnvVars("anthropic", {
        models: { sonnet: "anthropic/claude-sonnet-4" },
      });
      expect(result).toEqual({ ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4" });
    });

    it("strips provider prefix for opus model", () => {
      const result = resolveModelNameEnvVars("anthropic", {
        models: { opus: "anthropic/claude-opus-4-5" },
      });
      expect(result).toEqual({ ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-opus-4-5" });
    });

    it("strips provider prefix for haiku model", () => {
      const result = resolveModelNameEnvVars("anthropic", {
        models: { haiku: "anthropic/claude-haiku-4" },
      });
      expect(result).toEqual({ ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4" });
    });

    it("handles already bare model names", () => {
      const result = resolveModelNameEnvVars("anthropic", {
        models: { sonnet: "claude-sonnet-4" },
      });
      expect(result).toEqual({ ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4" });
    });
  });

  describe("provider prefix stripping for z.AI", () => {
    it("strips provider prefix for z.AI models", () => {
      const result = resolveModelNameEnvVars("zai", {
        models: { sonnet: "zai/glm-4.7", opus: "zai/glm-4.7", haiku: "zai/glm-4.5-air" },
      });
      expect(result).toEqual({
        ANTHROPIC_DEFAULT_SONNET_MODEL: "glm-4.7",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "glm-4.7",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "glm-4.5-air",
      });
    });

    it("handles bare z.AI model names", () => {
      const result = resolveModelNameEnvVars("zai", {
        models: { sonnet: "glm-4.7" },
      });
      expect(result).toEqual({ ANTHROPIC_DEFAULT_SONNET_MODEL: "glm-4.7" });
    });
  });

  describe("provider prefix retention for OpenRouter", () => {
    it("keeps full provider/model path for OpenRouter", () => {
      const result = resolveModelNameEnvVars("openrouter", {
        models: { sonnet: "anthropic/claude-sonnet-4" },
      });
      expect(result).toEqual({ ANTHROPIC_DEFAULT_SONNET_MODEL: "anthropic/claude-sonnet-4" });
    });

    it("keeps nested provider paths for OpenRouter", () => {
      const result = resolveModelNameEnvVars("openrouter", {
        models: {
          sonnet: "anthropic/claude-sonnet-4",
          opus: "anthropic/claude-opus-4-5",
          haiku: "anthropic/claude-haiku-4",
        },
      });
      expect(result).toEqual({
        ANTHROPIC_DEFAULT_SONNET_MODEL: "anthropic/claude-sonnet-4",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "anthropic/claude-opus-4-5",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "anthropic/claude-haiku-4",
      });
    });
  });

  describe("provider prefix retention for Kimi", () => {
    it("keeps full provider/model path for Kimi", () => {
      const result = resolveModelNameEnvVars("kimi", {
        models: { sonnet: "moonshot/moonshot-v1-8k" },
      });
      expect(result).toEqual({ ANTHROPIC_DEFAULT_SONNET_MODEL: "moonshot/moonshot-v1-8k" });
    });
  });

  describe("partial model configuration", () => {
    it("only sets env vars for configured models", () => {
      const result = resolveModelNameEnvVars("anthropic", {
        models: { sonnet: "claude-sonnet-4" },
      });
      expect(result).toEqual({ ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4" });
      expect(result).not.toHaveProperty("ANTHROPIC_DEFAULT_OPUS_MODEL");
      expect(result).not.toHaveProperty("ANTHROPIC_DEFAULT_HAIKU_MODEL");
    });

    it("handles multiple but not all models", () => {
      const result = resolveModelNameEnvVars("anthropic", {
        models: { sonnet: "claude-sonnet-4", haiku: "claude-haiku-4" },
      });
      expect(result).toEqual({
        ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4",
      });
      expect(result).not.toHaveProperty("ANTHROPIC_DEFAULT_OPUS_MODEL");
    });
  });
});
