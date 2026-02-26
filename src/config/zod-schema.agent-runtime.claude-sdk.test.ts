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
