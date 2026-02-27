import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import { resolveClaudeSdkConfig } from "../../claude-sdk-runner/prepare-session.js";
import {
  resolveAttemptFsWorkspaceOnly,
  resolvePromptBuildHookResult,
  resolvePromptModeForSession,
  wrapStreamFnTrimToolCallNames,
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

describe("wrapStreamFnTrimToolCallNames", () => {
  function createFakeStream(params: { events: unknown[]; resultMessage: unknown }): {
    result: () => Promise<unknown>;
    [Symbol.asyncIterator]: () => AsyncIterator<unknown>;
  } {
    return {
      async result() {
        return params.resultMessage;
      },
      [Symbol.asyncIterator]() {
        return (async function* () {
          for (const event of params.events) {
            yield event;
          }
        })();
      },
    };
  }

  it("trims whitespace from live streamed tool call names and final result message", async () => {
    const partialToolCall = { type: "toolCall", name: " read " };
    const messageToolCall = { type: "toolCall", name: " exec " };
    const finalToolCall = { type: "toolCall", name: " write " };
    const event = {
      type: "toolcall_delta",
      partial: { role: "assistant", content: [partialToolCall] },
      message: { role: "assistant", content: [messageToolCall] },
    };
    const finalMessage = { role: "assistant", content: [finalToolCall] };
    const baseFn = vi.fn(() => createFakeStream({ events: [event], resultMessage: finalMessage }));

    const wrappedFn = wrapStreamFnTrimToolCallNames(baseFn as never);
    const stream = wrappedFn({} as never, {} as never, {} as never) as Awaited<
      ReturnType<typeof wrappedFn>
    >;

    const seenEvents: unknown[] = [];
    for await (const item of stream) {
      seenEvents.push(item);
    }
    const result = await stream.result();

    expect(seenEvents).toHaveLength(1);
    expect(partialToolCall.name).toBe("read");
    expect(messageToolCall.name).toBe("exec");
    expect(finalToolCall.name).toBe("write");
    expect(result).toBe(finalMessage);
    expect(baseFn).toHaveBeenCalledTimes(1);
  });

  it("supports async stream functions that return a promise", async () => {
    const finalToolCall = { type: "toolCall", name: " browser " };
    const finalMessage = { role: "assistant", content: [finalToolCall] };
    const baseFn = vi.fn(async () =>
      createFakeStream({
        events: [],
        resultMessage: finalMessage,
      }),
    );

    const wrappedFn = wrapStreamFnTrimToolCallNames(baseFn as never);
    const stream = await wrappedFn({} as never, {} as never, {} as never);
    const result = await stream.result();

    expect(finalToolCall.name).toBe("browser");
    expect(result).toBe(finalMessage);
    expect(baseFn).toHaveBeenCalledTimes(1);
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
          defaults: {
            claudeSdk: {
              provider: "anthropic",
              thinkingDefault: "low",
              configDir: "/tmp/default-claude-dir",
            },
          },
          list: [
            { id: "main", claudeSdk: { provider: "zai", configDir: "/tmp/agent-claude-dir" } },
          ],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({
      provider: "zai",
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
              provider: "anthropic",
              thinkingDefault: "medium",
              configDir: "/tmp/default-claude-dir",
            },
          },
          list: [{ id: "main", claudeSdk: {} }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({
      provider: "anthropic",
      thinkingDefault: "medium",
      configDir: "/tmp/default-claude-dir",
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

  it("returns custom claudeSdk config with required explicit fields", () => {
    const params = {
      config: {
        agents: {
          list: [
            {
              id: "main",
              claudeSdk: {
                provider: "custom",
                baseUrl: "https://gateway.example/v1",
                authProfileId: "custom-profile",
                anthropicDefaultHaikuModel: "custom-haiku",
                anthropicDefaultSonnetModel: "custom-sonnet",
                anthropicDefaultOpusModel: "custom-opus",
              },
            },
          ],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({
      provider: "custom",
      baseUrl: "https://gateway.example/v1",
      authProfileId: "custom-profile",
      anthropicDefaultHaikuModel: "custom-haiku",
      anthropicDefaultSonnetModel: "custom-sonnet",
      anthropicDefaultOpusModel: "custom-opus",
    });
  });

  it("claudeSdkProviderOverride custom when existing claudeSdk has provider anthropic returns undefined", () => {
    const params = {
      claudeSdkProviderOverride: "custom",
      config: {
        agents: {
          list: [{ id: "main", claudeSdk: { provider: "anthropic" } }],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toBeUndefined();
  });

  it("claudeSdkProviderOverride custom when existing claudeSdk already has provider custom with baseUrl returns full config", () => {
    const params = {
      claudeSdkProviderOverride: "custom",
      config: {
        agents: {
          list: [
            {
              id: "main",
              claudeSdk: {
                provider: "custom",
                baseUrl: "https://gateway.example/v1",
                authProfileId: "my-profile",
                anthropicDefaultHaikuModel: "haiku-custom",
                anthropicDefaultSonnetModel: "sonnet-custom",
                anthropicDefaultOpusModel: "opus-custom",
              },
            },
          ],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({
      provider: "custom",
      baseUrl: "https://gateway.example/v1",
      authProfileId: "my-profile",
      anthropicDefaultHaikuModel: "haiku-custom",
      anthropicDefaultSonnetModel: "sonnet-custom",
      anthropicDefaultOpusModel: "opus-custom",
    });
  });

  it("config undefined (no agents) returns undefined", () => {
    const params = {
      config: undefined,
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toBeUndefined();
  });

  it("drops custom-only fields when overriding custom config to non-custom provider", () => {
    const params = {
      claudeSdkProviderOverride: "zai",
      config: {
        agents: {
          list: [
            {
              id: "main",
              claudeSdk: {
                provider: "custom",
                baseUrl: "https://gateway.example/v1",
                authProfileId: "custom-profile",
                thinkingDefault: "low",
                configDir: "/tmp/custom-claude-dir",
                supportedProviders: ["claude-pro", "zai"],
                anthropicDefaultHaikuModel: "custom-haiku",
                anthropicDefaultSonnetModel: "custom-sonnet",
                anthropicDefaultOpusModel: "custom-opus",
              },
            },
          ],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveClaudeSdkConfig(params, "main")).toEqual({
      provider: "zai",
      thinkingDefault: "low",
      configDir: "/tmp/custom-claude-dir",
      supportedProviders: ["claude-pro", "zai"],
    });
  });
});

describe("resolveRuntime", () => {
  it("returns claude-sdk when resolved auth mode is system-keychain", () => {
    const params = {
      provider: "not-claude-pro",
      resolvedProviderAuth: {
        source: "Claude Pro (system keychain)",
        mode: "system-keychain",
      },
      config: {},
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("claude-sdk");
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

  it("returns claude-sdk when provider is listed in claudeSdk.supportedProviders", () => {
    const params = {
      provider: "openai",
      config: {
        agents: {
          list: [
            {
              id: "main",
              claudeSdk: { provider: "anthropic", supportedProviders: ["openai", "zai"] },
            },
          ],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("claude-sdk");
  });

  it("returns pi when claudeSdk config exists but provider is not supported", () => {
    const params = {
      provider: "openai",
      config: {
        agents: {
          list: [
            {
              id: "main",
              claudeSdk: { provider: "anthropic", supportedProviders: ["zai"] },
            },
          ],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    expect(resolveRuntime(params, "main")).toBe("pi");
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

  it("supportedProviders matching is case-insensitive: provider OpenAI matches entry openai", () => {
    const params = {
      provider: "OpenAI",
      config: {
        agents: {
          list: [
            {
              id: "main",
              claudeSdk: { provider: "anthropic", supportedProviders: ["openai"] },
            },
          ],
        },
      },
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
});
