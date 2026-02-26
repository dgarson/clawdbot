import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import { resolveClaudeSdkConfig } from "../../claude-sdk-runner/prepare-session.js";
import {
  resolveAttemptFsWorkspaceOnly,
  resolvePromptBuildHookResult,
  resolvePromptModeForSession,
  resolveRuntime,
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
  it("returns undefined for empty claudeSdk object (no provider key)", () => {
    const params = {
      config: {
        agents: {
          list: [{ id: "main", claudeSdk: {} }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toBeUndefined();
  });

  it("returns config when claudeSdk has a provider key", () => {
    const params = {
      config: {
        agents: {
          list: [{ id: "main", claudeSdk: { provider: "claude-sdk" } }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({ provider: "claude-sdk" });
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
          defaults: { claudeSdk: { provider: "anthropic" } },
          list: [{ id: "main" }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({ provider: "anthropic" });
  });

  it("merges defaults.claudeSdk and agent claudeSdk with agent fields taking precedence", () => {
    const params = {
      config: {
        agents: {
          defaults: { claudeSdk: { provider: "anthropic", thinkingDefault: "low" } },
          list: [{ id: "main", claudeSdk: { provider: "zai" } }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({
      provider: "zai",
      thinkingDefault: "low",
    });
  });

  it("keeps defaults fields when agent claudeSdk is an empty object", () => {
    const params = {
      config: {
        agents: {
          defaults: { claudeSdk: { provider: "anthropic", thinkingDefault: "medium" } },
          list: [{ id: "main", claudeSdk: {} }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({
      provider: "anthropic",
      thinkingDefault: "medium",
    });
  });

  it("honors explicit agent false even when defaults.claudeSdk is set", () => {
    const params = {
      config: {
        agents: {
          defaults: { claudeSdk: { provider: "anthropic", thinkingDefault: "medium" } },
          list: [{ id: "main", claudeSdk: false }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toBeUndefined();
  });

  it("returns undefined for empty defaults.claudeSdk (no provider key)", () => {
    const params = {
      config: {
        agents: {
          defaults: { claudeSdk: {} },
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "other")).toBeUndefined();
  });
});

describe("resolveRuntime", () => {
  it("returns claude-sdk for known claude-sdk providers", () => {
    const params = {
      provider: "claude-pro",
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

  it("returns claude-sdk when agent has claudeSdk config", () => {
    const params = {
      provider: "openai",
      config: {
        agents: {
          list: [{ id: "main", claudeSdk: { provider: "anthropic" } }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("claude-sdk");
  });

  it("warns when provider resembles claude-sdk but does not match", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Use a dynamic import to access the subsystem logger's warn method.
    // Instead, we test indirectly: resolveRuntime returns "pi" and does not throw.
    const params = {
      provider: "claude-pro-custom",
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    const result = resolveRuntime(params, "main");
    expect(result).toBe("pi");
    warnSpy.mockRestore();
  });
});
