import { describe, expect, it } from "vitest";
import { ClaudeSdkConfigSchema } from "./zod-schema.agent-runtime.js";

describe("ClaudeSdkConfigSchema custom provider", () => {
  it("accepts custom provider with authProfileId and explicit model mappings", () => {
    const parsed = ClaudeSdkConfigSchema.parse({
      provider: "custom",
      baseUrl: "https://example.gateway/v1",
      authProfileId: "custom-profile",
      anthropicDefaultHaikuModel: "custom-haiku",
      anthropicDefaultSonnetModel: "custom-sonnet",
      anthropicDefaultOpusModel: "custom-opus",
    });
    expect(parsed?.provider).toBe("custom");
  });

  it("accepts custom provider with authHeaderName override", () => {
    const parsed = ClaudeSdkConfigSchema.parse({
      provider: "custom",
      baseUrl: "https://example.gateway/v1",
      authProfileId: "custom-profile",
      authHeaderName: "ANTHROPIC_API_KEY",
      anthropicDefaultHaikuModel: "custom-haiku",
      anthropicDefaultSonnetModel: "custom-sonnet",
      anthropicDefaultOpusModel: "custom-opus",
    });
    expect(parsed?.provider).toBe("custom");
  });

  it("rejects custom provider when authProfileId is missing", () => {
    expect(() =>
      ClaudeSdkConfigSchema.parse({
        provider: "custom",
        baseUrl: "https://example.gateway/v1",
        anthropicDefaultHaikuModel: "custom-haiku",
        anthropicDefaultSonnetModel: "custom-sonnet",
        anthropicDefaultOpusModel: "custom-opus",
      }),
    ).toThrow();
  });

  it("rejects custom provider when any required model mapping is missing", () => {
    expect(() =>
      ClaudeSdkConfigSchema.parse({
        provider: "custom",
        baseUrl: "https://example.gateway/v1",
        authProfileId: "custom-profile",
        anthropicDefaultHaikuModel: "custom-haiku",
        anthropicDefaultSonnetModel: "custom-sonnet",
      }),
    ).toThrow();
  });

  it("rejects invalid authHeaderName", () => {
    expect(() =>
      ClaudeSdkConfigSchema.parse({
        provider: "custom",
        baseUrl: "https://example.gateway/v1",
        authProfileId: "custom-profile",
        authHeaderName: "x-invalid-header",
        anthropicDefaultHaikuModel: "custom-haiku",
        anthropicDefaultSonnetModel: "custom-sonnet",
        anthropicDefaultOpusModel: "custom-opus",
      }),
    ).toThrow();
  });
});

describe("ClaudeSdkConfigSchema provider variants and validation edges", () => {
  it("accepts non-custom providers with optional configDir and supportedProviders", () => {
    const parsed = ClaudeSdkConfigSchema.parse({
      provider: "zai",
      configDir: "/tmp/claude-config",
      supportedProviders: ["claude-pro", "zai"],
    });
    expect(parsed?.provider).toBe("zai");
    expect(parsed?.configDir).toBe("/tmp/claude-config");
    expect(parsed?.supportedProviders).toEqual(["claude-pro", "zai"]);
  });

  it("rejects unknown provider values", () => {
    expect(() =>
      ClaudeSdkConfigSchema.parse({
        provider: "not-a-provider",
      }),
    ).toThrow();
  });

  it("rejects empty supportedProviders entries", () => {
    expect(() =>
      ClaudeSdkConfigSchema.parse({
        provider: "claude-sdk",
        supportedProviders: ["anthropic", ""],
      }),
    ).toThrow();
  });

  it("rejects blank configDir after trimming", () => {
    expect(() =>
      ClaudeSdkConfigSchema.parse({
        provider: "anthropic",
        configDir: "   ",
      }),
    ).toThrow();
  });
});

describe("ClaudeSdkConfigSchema thinkingDefault", () => {
  it("accepts Claude SDK thinking levels", () => {
    const none = ClaudeSdkConfigSchema.parse({
      provider: "claude-sdk",
      thinkingDefault: "none",
    });
    expect(none?.thinkingDefault).toBe("none");

    const low = ClaudeSdkConfigSchema.parse({
      provider: "claude-sdk",
      thinkingDefault: "low",
    });
    expect(low?.thinkingDefault).toBe("low");

    const medium = ClaudeSdkConfigSchema.parse({
      provider: "anthropic",
      thinkingDefault: "medium",
    });
    expect(medium?.thinkingDefault).toBe("medium");

    const high = ClaudeSdkConfigSchema.parse({
      provider: "openrouter",
      thinkingDefault: "high",
    });
    expect(high?.thinkingDefault).toBe("high");
  });

  it("rejects non-Claude-SDK thinking levels", () => {
    expect(() =>
      ClaudeSdkConfigSchema.parse({
        provider: "claude-sdk",
        thinkingDefault: "off",
      }),
    ).toThrow();
  });
});
