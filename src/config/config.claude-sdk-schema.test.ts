import { describe, expect, it } from "vitest";
import { OpenClawSchema } from "./zod-schema.js";

describe("claudeSdk config schema", () => {
  it("accepts claude-code provider in agents.defaults", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { runtime: "claude-sdk", claudeSdk: { provider: "claude-code" } } },
    });
    expect(result.success).toBe(true);
  });

  it("accepts anthropic provider", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { claudeSdk: { provider: "anthropic" } } },
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimax / zai / openrouter providers (no extra fields needed)", () => {
    for (const provider of ["minimax", "zai", "openrouter"] as const) {
      const result = OpenClawSchema.safeParse({
        agents: { defaults: { claudeSdk: { provider } } },
      });
      expect(result.success, `provider=${provider}`).toBe(true);
    }
  });

  it("accepts custom provider with baseUrl", () => {
    const result = OpenClawSchema.safeParse({
      agents: {
        defaults: {
          claudeSdk: { provider: "custom", baseUrl: "https://my-gateway.internal/v1" },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects custom provider without baseUrl", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { claudeSdk: { provider: "custom" } } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown provider", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { claudeSdk: { provider: "cohere" } } },
    });
    expect(result.success).toBe(false);
  });

  it("accepts per-agent runtime and claudeSdk override", () => {
    const result = OpenClawSchema.safeParse({
      agents: {
        list: [{ id: "my-agent", runtime: "claude-sdk", claudeSdk: { provider: "zai" } }],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown runtime value", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { runtime: "gemini" } },
    });
    expect(result.success).toBe(false);
  });

  it("accepts thinkingDefault values on any provider", () => {
    for (const thinkingDefault of ["none", "low", "medium", "high"] as const) {
      const result = OpenClawSchema.safeParse({
        agents: { defaults: { claudeSdk: { provider: "anthropic", thinkingDefault } } },
      });
      expect(result.success, `thinkingDefault=${thinkingDefault}`).toBe(true);
    }
  });

  it("accepts legacy thinkingLevel key for compatibility", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { claudeSdk: { provider: "anthropic", thinkingLevel: "medium" } } },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid thinkingDefault value", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { claudeSdk: { provider: "anthropic", thinkingDefault: "extreme" } } },
    });
    expect(result.success).toBe(false);
  });

  it("accepts thinkingDefault on custom provider", () => {
    const result = OpenClawSchema.safeParse({
      agents: {
        defaults: {
          claudeSdk: {
            provider: "custom",
            baseUrl: "https://my-gateway.internal/v1",
            thinkingDefault: "high",
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched thinkingDefault and thinkingLevel when both are set", () => {
    const result = OpenClawSchema.safeParse({
      agents: {
        defaults: {
          claudeSdk: { provider: "anthropic", thinkingDefault: "low", thinkingLevel: "high" },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown provider in agents.list entry", () => {
    const result = OpenClawSchema.safeParse({
      agents: {
        list: [{ id: "my-agent", claudeSdk: { provider: "cohere" } }],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects custom provider without baseUrl in agents.list entry", () => {
    const result = OpenClawSchema.safeParse({
      agents: {
        list: [{ id: "my-agent", claudeSdk: { provider: "custom" } }],
      },
    });
    expect(result.success).toBe(false);
  });
});
