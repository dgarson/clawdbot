import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProviderEnv } from "../provider-env.js";

describe("buildProviderEnv", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-inherited");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("claude-code: returns inherited env with anthropic credentials stripped", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "tok-ant-inherited");
    vi.stubEnv("FOO_KEEP", "keep-me");
    const env = buildProviderEnv({ provider: "claude-code" });
    expect(env).toBeDefined();
    expect(env!["ANTHROPIC_API_KEY"]).toBeUndefined();
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBeUndefined();
    expect(env!["FOO_KEEP"]).toBe("keep-me");
  });

  it("returns undefined for anthropic when no resolvedApiKey", () => {
    expect(buildProviderEnv({ provider: "anthropic" })).toBeUndefined();
  });

  it("anthropic: sets only ANTHROPIC_API_KEY when resolvedApiKey provided", () => {
    const env = buildProviderEnv({ provider: "anthropic" }, "sk-ant-resolved");
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-ant-resolved");
    expect(env!["ANTHROPIC_BASE_URL"]).toBeUndefined();
    expect(env!["ANTHROPIC_TIMEOUT"]).toBeUndefined();
  });

  it("minimax: sets URL, timeout, model vars; API key from resolvedApiKey", () => {
    const env = buildProviderEnv({ provider: "minimax" }, "sk-minimax-auth");
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://api.minimaxi.chat/v1");
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-minimax-auth");
    expect(env!["ANTHROPIC_TIMEOUT"]).toBe("3000000");
    expect(env!["ANTHROPIC_HAIKU_MODEL"]).toBeTruthy();
    expect(env!["ANTHROPIC_SONNET_MODEL"]).toBeTruthy();
    expect(env!["ANTHROPIC_DEFAULT_MODEL"]).toBe(env!["ANTHROPIC_SONNET_MODEL"]);
    expect(env!["ANTHROPIC_OPUS_MODEL"]).toBeTruthy();
  });

  it("minimax: omits ANTHROPIC_API_KEY when no resolvedApiKey", () => {
    const env = buildProviderEnv({ provider: "minimax" });
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://api.minimaxi.chat/v1");
    expect("ANTHROPIC_API_KEY" in env!).toBe(false);
  });

  it("zai: uses hardcoded GLM model names", () => {
    const env = buildProviderEnv({ provider: "zai" }, "sk-zai-auth");
    expect(env!["ANTHROPIC_BASE_URL"]).toContain("z.ai");
    expect(env!["ANTHROPIC_HAIKU_MODEL"]).toBe("GLM-4.7");
    expect(env!["ANTHROPIC_SONNET_MODEL"]).toBe("GLM-4.7");
    expect(env!["ANTHROPIC_OPUS_MODEL"]).toBe("GLM-5");
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-zai-auth");
  });

  it("openrouter: uses anthropic/* prefixed model names", () => {
    const env = buildProviderEnv({ provider: "openrouter" }, "sk-or-auth");
    expect(env!["ANTHROPIC_BASE_URL"]).toContain("openrouter.ai");
    expect(env!["ANTHROPIC_SONNET_MODEL"]).toMatch(/^anthropic\//);
    expect(env!["ANTHROPIC_HAIKU_MODEL"]).toMatch(/^anthropic\//);
    expect(env!["ANTHROPIC_OPUS_MODEL"]).toMatch(/^anthropic\//);
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-or-auth");
  });

  it("custom: uses config.apiKey preferring it over resolvedApiKey", () => {
    const env = buildProviderEnv(
      { provider: "custom", baseUrl: "https://my.gateway/v1", apiKey: "sk-config" },
      "sk-auth-fallback",
    );
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://my.gateway/v1");
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-config");
    expect(env!["ANTHROPIC_TIMEOUT"]).toBe("3000000");
    expect(env!["ANTHROPIC_HAIKU_MODEL"]).toBeUndefined();
  });

  it("custom: falls back to resolvedApiKey when no config.apiKey", () => {
    const env = buildProviderEnv(
      { provider: "custom", baseUrl: "https://my.gateway/v1" },
      "sk-auth-fallback",
    );
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-auth-fallback");
  });

  it("custom without apiKey or resolvedApiKey: omits ANTHROPIC_API_KEY", () => {
    const env = buildProviderEnv({ provider: "custom", baseUrl: "https://my.gateway/v1" });
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://my.gateway/v1");
    expect("ANTHROPIC_API_KEY" in env!).toBe(false);
  });

  it("inherits process.env for non-passthrough providers", () => {
    vi.stubEnv("MY_CUSTOM_VAR", "hello");
    const env = buildProviderEnv({ provider: "zai" }, "sk-zai");
    expect(env!["MY_CUSTOM_VAR"]).toBe("hello");
  });

  it("scrubs ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL from inherited env for known providers", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "tok-anthropic-secret");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://some-proxy.example.com");
    const env = buildProviderEnv({ provider: "minimax" }, "sk-minimax");
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBeUndefined();
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://api.minimaxi.chat/v1"); // overwritten by our value
  });

  it("scrubs ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL for custom provider", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "tok-anthropic-secret");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://some-proxy.example.com");
    const env = buildProviderEnv(
      { provider: "custom", baseUrl: "https://my.gateway/v1" },
      "sk-custom",
    );
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBeUndefined();
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://my.gateway/v1"); // overwritten by our value
  });

  it("anthropic provider: strips ANTHROPIC_AUTH_TOKEN when injecting API key", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "tok-anthropic-oauth");
    const env = buildProviderEnv({ provider: "anthropic" }, "sk-ant-resolved");
    expect(env!["ANTHROPIC_AUTH_TOKEN"]).toBeUndefined();
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-ant-resolved");
  });

  it("anthropic provider: strips ANTHROPIC_BASE_URL when injecting API key", () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://some-proxy.example.com");
    const env = buildProviderEnv({ provider: "anthropic" }, "sk-ant-resolved");
    expect(env!["ANTHROPIC_BASE_URL"]).toBeUndefined();
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-ant-resolved");
  });
});
