import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import { resolveClaudeSdkConfig } from "../../claude-sdk-runner/prepare-session.js";
import {
  resolveAttemptFsWorkspaceOnly,
  resolvePromptBuildHookResult,
  resolvePromptModeForSession,
  resolveRuntime,
  selectSdkPrompt,
} from "./attempt.js";
import type { EmbeddedRunAttemptParams } from "./types.js";

describe("resolvePromptBuildHookResult", () => {
  function createLegacyOnlyHookRunner() {
    return {
      hasHooks: vi.fn(
        (hookName: "before_prompt_build" | "before_agent_start") =>
          hookName === "before_agent_start",
      ),
      runBeforePromptBuild: vi.fn(async () => undefined),
      runBeforeAgentStart: vi.fn(async () => ({ prependContext: "from-hook" })),
    };
  }

  it("reuses precomputed legacy before_agent_start result without invoking hook again", async () => {
    const hookRunner = createLegacyOnlyHookRunner();
    const result = await resolvePromptBuildHookResult({
      prompt: "hello",
      messages: [],
      hookCtx: {},
      hookRunner,
      legacyBeforeAgentStartResult: { prependContext: "from-cache", systemPrompt: "legacy-system" },
    });

    expect(hookRunner.runBeforeAgentStart).not.toHaveBeenCalled();
    expect(result).toEqual({
      prependContext: "from-cache",
      systemPrompt: "legacy-system",
    });
  });

  it("calls legacy hook when precomputed result is absent", async () => {
    const hookRunner = createLegacyOnlyHookRunner();
    const messages = [{ role: "user", content: "ctx" }];
    const result = await resolvePromptBuildHookResult({
      prompt: "hello",
      messages,
      hookCtx: {},
      hookRunner,
    });

    expect(hookRunner.runBeforeAgentStart).toHaveBeenCalledTimes(1);
    expect(hookRunner.runBeforeAgentStart).toHaveBeenCalledWith({ prompt: "hello", messages }, {});
    expect(result.prependContext).toBe("from-hook");
  });
});

describe("resolvePromptModeForSession", () => {
  it("uses minimal mode for subagent sessions", () => {
    expect(resolvePromptModeForSession("agent:main:subagent:child")).toBe("minimal");
  });

  it("uses full mode for cron sessions", () => {
    expect(resolvePromptModeForSession("agent:main:cron:job-1")).toBe("full");
    expect(resolvePromptModeForSession("agent:main:cron:job-1:run:run-abc")).toBe("full");
  });
});

describe("resolveAttemptFsWorkspaceOnly", () => {
  it("uses global tools.fs.workspaceOnly when agent has no override", () => {
    const cfg: OpenClawConfig = {
      tools: {
        fs: { workspaceOnly: true },
      },
    };

    expect(
      resolveAttemptFsWorkspaceOnly({
        config: cfg,
        sessionAgentId: "main",
      }),
    ).toBe(true);
  });

  it("prefers agent-specific tools.fs.workspaceOnly override", () => {
    const cfg: OpenClawConfig = {
      tools: {
        fs: { workspaceOnly: true },
      },
      agents: {
        list: [
          {
            id: "main",
            tools: {
              fs: { workspaceOnly: false },
            },
          },
        ],
      },
    };

    expect(
      resolveAttemptFsWorkspaceOnly({
        config: cfg,
        sessionAgentId: "main",
      }),
    ).toBe(false);
  });
});

describe("resolveClaudeSdkConfig", () => {
  it("returns empty config for empty claudeSdk object", () => {
    const params = {
      config: {
        agents: {
          list: [{ id: "main", claudeSdk: {} }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({});
  });

  it("returns config when claudeSdk has valid options", () => {
    const params = {
      config: {
        agents: {
          list: [{ id: "main", claudeSdk: { thinkingDefault: "low" } }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({ thinkingDefault: "low" });
  });

  it("returns undefined when claudeSdk is explicitly false", () => {
    const params = {
      config: {
        agents: {
          list: [{ id: "main", claudeSdk: false }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toBeUndefined();
  });

  it("falls back to defaults.claudeSdk when agent has no override", () => {
    const params = {
      config: {
        agents: {
          defaults: { claudeSdk: { thinkingDefault: "medium" } },
          list: [{ id: "main" }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({ thinkingDefault: "medium" });
  });

  it("merges defaults.claudeSdk and agent claudeSdk with agent fields taking precedence", () => {
    const params = {
      config: {
        agents: {
          defaults: {
            claudeSdk: {
              thinkingDefault: "low",
              configDir: "/tmp/default-claude-dir",
            },
          },
          list: [
            {
              id: "main",
              claudeSdk: { configDir: "/tmp/agent-claude-dir" },
            },
          ],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({
      thinkingDefault: "low",
      configDir: "/tmp/agent-claude-dir",
    });
  });

  it("keeps defaults fields when agent claudeSdk is an empty object", () => {
    const params = {
      config: {
        agents: {
          defaults: {
            claudeSdk: {
              thinkingDefault: "medium",
              configDir: "/tmp/default-claude-dir",
            },
          },
          list: [{ id: "main", claudeSdk: {} }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({
      thinkingDefault: "medium",
      configDir: "/tmp/default-claude-dir",
    });
  });

  it("honors explicit agent false even when defaults.claudeSdk is set", () => {
    const params = {
      config: {
        agents: {
          defaults: { claudeSdk: { thinkingDefault: "medium" } },
          list: [{ id: "main", claudeSdk: false }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toBeUndefined();
  });

  it("returns defaults when defaults.claudeSdk is an empty object", () => {
    const params = {
      config: {
        agents: {
          defaults: { claudeSdk: {} },
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "other")).toEqual({});
  });

  it("returns undefined when claudeSdk has non-sdk provider (validation rejects it)", () => {
    const params = {
      config: {
        agents: {
          list: [{ id: "main", claudeSdk: { provider: "anthropic" } }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    // Non-sdk providers are no longer valid — safeParse fails and returns undefined.
    expect(resolveClaudeSdkConfig(params, "main")).toBeUndefined();
  });

  it("config undefined (no agents) returns undefined", () => {
    const params = {
      config: undefined,
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toBeUndefined();
  });
});

describe("resolveRuntime", () => {
  it("returns pi when resolvedProviderAuth says system-keychain but provider is not claude-pro or claude-max", () => {
    const params = {
      provider: "not-claude-pro",
      resolvedProviderAuth: {
        source: "Claude Pro (system keychain)",
        mode: "system-keychain",
      },
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    // resolvedProviderAuth is no longer consulted; routing is driven solely by provider name.
    expect(resolveRuntime(params, "main")).toBe("pi");
  });

  it("returns claude-sdk for known claude-sdk providers", () => {
    const params = {
      provider: "claude-pro",
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("claude-sdk");
  });

  it("returns claude-sdk for claude-max alias", () => {
    const params = {
      provider: "claude-max",
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("claude-sdk");
  });

  it("returns pi for non-claude-sdk providers", () => {
    const params = {
      provider: "openai",
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("pi");
  });

  it("returns pi for any provider that is not exactly claude-pro or claude-max", () => {
    const params = {
      provider: "claude-pro-custom",
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("pi");
  });

  it("runtimeOverride pi forces pi even when provider is a known claude-sdk provider", () => {
    const params = {
      provider: "claude-pro",
      runtimeOverride: "pi",
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("pi");
  });

  it("runtimeOverride claude-sdk forces claude-sdk even when provider is openai with no supportedProviders", () => {
    const params = {
      provider: "openai",
      runtimeOverride: "claude-sdk",
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("claude-sdk");
  });

  it("config undefined with a non-sdk provider returns pi", () => {
    const params = {
      provider: "gemini",
      config: undefined,
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("pi");
  });

  it("returns pi for non-Claude model even when runtimeOverride is claude-sdk", () => {
    const params = {
      provider: "zai",
      modelId: "GLM-4.7",
      runtimeOverride: "claude-sdk",
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("pi");
  });

  it("returns pi for non-Claude model ID regardless of provider", () => {
    const params = {
      provider: "minimax",
      modelId: "MiniMax-M2.5",
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("pi");
  });

  it("returns claude-sdk for Claude model with claude-pro provider", () => {
    const params = {
      provider: "claude-pro",
      modelId: "claude-sonnet-4-5",
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("claude-sdk");
  });
});

describe("selectSdkPrompt", () => {
  it("returns rawBodyForSdk when structuredContextInput and rawBodyForSdk are both present", () => {
    expect(
      selectSdkPrompt({
        structuredContextInput: { platform: "slack" },
        rawBodyForSdk: "raw body without thread prefix",
        prompt: "Thread history prefix\n\nraw body without thread prefix",
      }),
    ).toBe("raw body without thread prefix");
  });

  it("returns prompt unchanged when structuredContextInput is absent", () => {
    const prompt = "full prefixed body";
    expect(selectSdkPrompt({ prompt })).toBe(prompt);
  });

  it("returns prompt unchanged when rawBodyForSdk is absent even if structuredContextInput present", () => {
    const prompt = "full prefixed body";
    expect(
      selectSdkPrompt({
        structuredContextInput: { platform: "slack" },
        prompt,
      }),
    ).toBe(prompt);
  });

  it("returns prompt unchanged when rawBodyForSdk is empty string", () => {
    const prompt = "full prefixed body";
    expect(
      selectSdkPrompt({
        structuredContextInput: { platform: "slack" },
        rawBodyForSdk: "",
        prompt,
      }),
    ).toBe(prompt);
  });
});
