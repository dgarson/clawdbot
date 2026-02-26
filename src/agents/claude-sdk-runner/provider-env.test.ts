import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProviderEnv } from "./provider-env.js";

function resolvedAuth(apiKey: string) {
  return {
    apiKey,
    source: "test",
    mode: "api-key" as const,
  };
}

function expectTrafficGuardrails(env: Record<string, string> | undefined) {
  expect(env).toBeDefined();
  expect(env!["CLAUDE_CODE_ENABLE_TELEMETRY"]).toBe("0");
  expect(env!["DISABLE_TELEMETRY"]).toBe("1");
  expect(env!["DISABLE_BUG_COMMAND"]).toBe("1");
  expect(env!["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"]).toBe("1");
}

describe("buildProviderEnv", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-inherited");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("claude-sdk: returns inherited env with anthropic credentials stripped", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "tok-ant-inherited");
    vi.stubEnv("ANTHROPIC_OAUTH_TOKEN", "oauth-ant-inherited");
    vi.stubEnv("FOO_KEEP", "keep-me");
    const env = buildProviderEnv({ provider: "claude-sdk" });
    expect(env).toBeDefined();
    expect(env!["ANTHROPIC_API_KEY"]).toBeUndefined();
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBeUndefined();
    expect(env!["ANTHROPIC_OAUTH_TOKEN"]).toBeUndefined();
    expect(env!["FOO_KEEP"]).toBe("keep-me");
    expectTrafficGuardrails(env);
  });

  it("returns undefined for anthropic when no resolvedApiKey", () => {
    expect(buildProviderEnv({ provider: "anthropic" })).toBeUndefined();
  });

  it("anthropic: sets only ANTHROPIC_API_KEY when resolvedApiKey provided", () => {
    const env = buildProviderEnv({ provider: "anthropic" }, resolvedAuth("sk-ant-resolved"));
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-ant-resolved");
    expect(env!["ANTHROPIC_BASE_URL"]).toBeUndefined();
    expect(env!["API_TIMEOUT_MS"]).toBeUndefined();
    expectTrafficGuardrails(env);
  });

  it("minimax: sets URL, timeout, model vars; auth token from resolvedApiKey", () => {
    const env = buildProviderEnv({ provider: "minimax" }, resolvedAuth("sk-minimax-auth"));
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://api.minimax.io/anthropic");
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBe("sk-minimax-auth");
    expect(env!["ANTHROPIC_API_KEY"]).toBeUndefined();
    expect(env!["API_TIMEOUT_MS"]).toBe("3000000");
    expect(env!["ANTHROPIC_DEFAULT_HAIKU_MODEL"]).toBe("MiniMax-M2.5");
    expect(env!["ANTHROPIC_DEFAULT_SONNET_MODEL"]).toBe("MiniMax-M2.5");
    expect(env!["ANTHROPIC_DEFAULT_OPUS_MODEL"]).toBe("MiniMax-M2.5");
    expect(env!["ANTHROPIC_MODEL"]).toBe(env!["ANTHROPIC_DEFAULT_SONNET_MODEL"]);
    expect(env!["ANTHROPIC_SMALL_FAST_MODEL"]).toBe(env!["ANTHROPIC_DEFAULT_HAIKU_MODEL"]);
    expectTrafficGuardrails(env);
  });

  it("minimax: omits ANTHROPIC_AUTH_TOKEN when no resolvedApiKey", () => {
    const env = buildProviderEnv({ provider: "minimax" });
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://api.minimax.io/anthropic");
    expect("ANTHROPIC_AUTH_TOKEN" in env!).toBe(false);
  });

  it("zai: uses hardcoded GLM model names", () => {
    const env = buildProviderEnv({ provider: "zai" }, resolvedAuth("sk-zai-auth"));
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://api.z.ai/api/anthropic");
    expect(env!["ANTHROPIC_DEFAULT_HAIKU_MODEL"]).toBe("GLM-4.7-Air");
    expect(env!["ANTHROPIC_DEFAULT_SONNET_MODEL"]).toBe("GLM-4.7");
    expect(env!["ANTHROPIC_DEFAULT_OPUS_MODEL"]).toBe("GLM-5");
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBe("sk-zai-auth");
  });

  it("openrouter: uses anthropic/* model names and explicit empty ANTHROPIC_API_KEY", () => {
    const env = buildProviderEnv({ provider: "openrouter" }, resolvedAuth("sk-or-auth"));
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://openrouter.ai/api");
    expect(env!["ANTHROPIC_DEFAULT_SONNET_MODEL"]).toMatch(/^anthropic\//);
    expect(env!["ANTHROPIC_DEFAULT_HAIKU_MODEL"]).toMatch(/^anthropic\//);
    expect(env!["ANTHROPIC_DEFAULT_OPUS_MODEL"]).toMatch(/^anthropic\//);
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBe("sk-or-auth");
    expect(env!["ANTHROPIC_API_KEY"]).toBe("");
  });

  it("custom: defaults auth header to ANTHROPIC_AUTH_TOKEN and requires explicit model env mappings", () => {
    vi.stubEnv("ANTHROPIC_DEFAULT_HAIKU_MODEL", "env-haiku");
    vi.stubEnv("ANTHROPIC_DEFAULT_SONNET_MODEL", "env-sonnet");
    vi.stubEnv("ANTHROPIC_DEFAULT_OPUS_MODEL", "env-opus");
    const env = buildProviderEnv(
      {
        provider: "custom",
        baseUrl: "https://my.gateway/v1",
        authProfileId: "custom-profile",
        anthropicDefaultHaikuModel: "custom-haiku",
        anthropicDefaultSonnetModel: "custom-sonnet",
        anthropicDefaultOpusModel: "custom-opus",
      },
      resolvedAuth("sk-custom-api"),
    );
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://my.gateway/v1");
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBe("sk-custom-api");
    expect(env!["ANTHROPIC_API_KEY"]).toBeUndefined();
    expect(env!["ANTHROPIC_DEFAULT_HAIKU_MODEL"]).toBe("custom-haiku");
    expect(env!["ANTHROPIC_DEFAULT_SONNET_MODEL"]).toBe("custom-sonnet");
    expect(env!["ANTHROPIC_DEFAULT_OPUS_MODEL"]).toBe("custom-opus");
    expect(env!["ANTHROPIC_MODEL"]).toBe("custom-sonnet");
    expect(env!["ANTHROPIC_SMALL_FAST_MODEL"]).toBe("custom-haiku");
    expectTrafficGuardrails(env);
  });

  it("custom: supports authHeaderName override", () => {
    const env = buildProviderEnv(
      {
        provider: "custom",
        baseUrl: "https://my.gateway/v1",
        authProfileId: "custom-profile",
        authHeaderName: "ANTHROPIC_API_KEY",
        anthropicDefaultHaikuModel: "custom-haiku",
        anthropicDefaultSonnetModel: "custom-sonnet",
        anthropicDefaultOpusModel: "custom-opus",
      },
      resolvedAuth("sk-custom-auth-token"),
    );
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-custom-auth-token");
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBeUndefined();
  });

  it("custom: ignores inherited model alias env vars and uses explicit values", () => {
    vi.stubEnv("ANTHROPIC_DEFAULT_HAIKU_MODEL", "env-haiku");
    vi.stubEnv("ANTHROPIC_DEFAULT_SONNET_MODEL", "env-sonnet");
    vi.stubEnv("ANTHROPIC_DEFAULT_OPUS_MODEL", "env-opus");
    const env = buildProviderEnv(
      {
        provider: "custom",
        baseUrl: "https://my.gateway/v1",
        authProfileId: "custom-profile",
        anthropicDefaultHaikuModel: "custom-haiku",
        anthropicDefaultSonnetModel: "custom-sonnet",
        anthropicDefaultOpusModel: "custom-opus",
      },
      resolvedAuth("sk-custom-auth-token"),
    );
    expect(env!["ANTHROPIC_DEFAULT_HAIKU_MODEL"]).toBe("custom-haiku");
    expect(env!["ANTHROPIC_DEFAULT_SONNET_MODEL"]).toBe("custom-sonnet");
    expect(env!["ANTHROPIC_DEFAULT_OPUS_MODEL"]).toBe("custom-opus");
  });

  it("custom: strips inherited anthropic auth env vars", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "tok-anthropic-secret");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-secret");
    const env = buildProviderEnv(
      {
        provider: "custom",
        baseUrl: "https://my.gateway/v1",
        authProfileId: "custom-profile",
        anthropicDefaultHaikuModel: "custom-haiku",
        anthropicDefaultSonnetModel: "custom-sonnet",
        anthropicDefaultOpusModel: "custom-opus",
      },
      resolvedAuth("sk-custom-auth-token"),
    );
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBe("sk-custom-auth-token");
    expect(env!["ANTHROPIC_API_KEY"]).toBeUndefined();
  });

  it("inherits process.env for non-passthrough providers", () => {
    vi.stubEnv("MY_CUSTOM_VAR", "hello");
    const env = buildProviderEnv({ provider: "zai" }, resolvedAuth("sk-zai"));
    expect(env!["MY_CUSTOM_VAR"]).toBe("hello");
  });

  it("scrubs inherited Anthropic auth env for known providers", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "tok-anthropic-secret");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-secret");
    vi.stubEnv("ANTHROPIC_OAUTH_TOKEN", "oauth-ant-secret");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://some-proxy.example.com");
    const env = buildProviderEnv({ provider: "minimax" }, resolvedAuth("sk-minimax"));
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBe("sk-minimax");
    expect(env!["ANTHROPIC_API_KEY"]).toBeUndefined();
    expect(env!["ANTHROPIC_OAUTH_TOKEN"]).toBeUndefined();
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://api.minimax.io/anthropic");
  });

  it("allows model override env vars to replace provider defaults", () => {
    vi.stubEnv("ANTHROPIC_DEFAULT_HAIKU_MODEL", "override-haiku");
    vi.stubEnv("ANTHROPIC_DEFAULT_SONNET_MODEL", "override-sonnet");
    vi.stubEnv("ANTHROPIC_DEFAULT_OPUS_MODEL", "override-opus");
    const env = buildProviderEnv({ provider: "zai" }, resolvedAuth("sk-zai-auth"));
    expect(env!["ANTHROPIC_DEFAULT_HAIKU_MODEL"]).toBe("override-haiku");
    expect(env!["ANTHROPIC_DEFAULT_SONNET_MODEL"]).toBe("override-sonnet");
    expect(env!["ANTHROPIC_DEFAULT_OPUS_MODEL"]).toBe("override-opus");
  });

  it("anthropic provider: strips ANTHROPIC_AUTH_TOKEN when injecting API key", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "tok-anthropic-oauth");
    const env = buildProviderEnv({ provider: "anthropic" }, resolvedAuth("sk-ant-resolved"));
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBeUndefined();
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-ant-resolved");
  });

  it("anthropic provider: strips ANTHROPIC_BASE_URL when injecting API key", () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://some-proxy.example.com");
    const env = buildProviderEnv({ provider: "anthropic" }, resolvedAuth("sk-ant-resolved"));
    expect(env!["ANTHROPIC_BASE_URL"]).toBeUndefined();
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-ant-resolved");
  });

  it("anthropic provider: strips ANTHROPIC_OAUTH_TOKEN when injecting API key", () => {
    vi.stubEnv("ANTHROPIC_OAUTH_TOKEN", "oauth-ant-secret");
    const env = buildProviderEnv({ provider: "anthropic" }, resolvedAuth("sk-ant-resolved"));
    expect(env!["ANTHROPIC_OAUTH_TOKEN"]).toBeUndefined();
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-ant-resolved");
  });

  it("custom: throws if auth profile does not resolve credentials", () => {
    expect(() =>
      buildProviderEnv(
        {
          provider: "custom",
          baseUrl: "https://my.gateway/v1",
          authProfileId: "custom-profile",
          anthropicDefaultHaikuModel: "custom-haiku",
          anthropicDefaultSonnetModel: "custom-sonnet",
          anthropicDefaultOpusModel: "custom-opus",
        },
        { source: "profile:custom-profile", mode: "api-key" },
      ),
    ).toThrow("[claude-sdk] custom provider requires API credentials from claudeSdk.authProfileId");
  });
});
