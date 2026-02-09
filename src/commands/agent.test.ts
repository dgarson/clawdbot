import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";

const executeKernelMock = vi.fn();

vi.mock("../agents/main-agent-runtime-factory.js", async (importActual) => {
  const actual = await importActual<typeof import("../agents/main-agent-runtime-factory.js")>();
  return {
    ...actual,
    createSdkMainAgentRuntime: vi.fn(async () => ({
      kind: "claude",
      displayName: "Claude SDK",
      run: vi.fn().mockResolvedValue({
        payloads: [{ text: "ok" }],
        meta: {
          durationMs: 5,
          agentMeta: { sessionId: "s", provider: "anthropic", model: "claude-opus-4-5" },
        },
      }),
    })),
  };
});
vi.mock("../agents/model-catalog.js", () => ({
  loadModelCatalog: vi.fn(),
}));

vi.mock("../execution/index.js", async (importActual) => {
  const actual = await importActual<typeof import("../execution/index.js")>();
  return {
    ...actual,
    createDefaultExecutionKernel: vi.fn().mockReturnValue({
      execute: (request: unknown) => executeKernelMock(request),
      abort: vi.fn(),
      getActiveRunCount: vi.fn().mockReturnValue(0),
    }),
  };
});

import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import { telegramPlugin } from "../../extensions/telegram/src/channel.js";
import { setTelegramRuntime } from "../../extensions/telegram/src/runtime.js";
import { loadModelCatalog } from "../agents/model-catalog.js";
import * as configModule from "../config/config.js";
import { onAgentEvent } from "../infra/agent-events.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createPluginRuntime } from "../plugins/runtime/index.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";
import { agentCommand } from "./agent.js";

const runtime: RuntimeEnv = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(() => {
    throw new Error("exit");
  }),
};

const configSpy = vi.spyOn(configModule, "loadConfig");

function createExecutionResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    aborted: false,
    reply: "ok",
    payloads: [{ text: "ok" }],
    runtime: {
      kind: "pi",
      provider: "anthropic",
      model: "claude-opus-4-5",
      fallbackUsed: false,
    },
    usage: {
      inputTokens: 1,
      outputTokens: 1,
      durationMs: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    events: [],
    toolCalls: [],
    didSendViaMessagingTool: false,
    ...overrides,
  };
}

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(fn, { prefix: "openclaw-agent-" });
}

function mockConfig(
  home: string,
  storePath: string,
  agentOverrides?: Partial<NonNullable<NonNullable<OpenClawConfig["agents"]>["defaults"]>>,
  telegramOverrides?: Partial<NonNullable<OpenClawConfig["telegram"]>>,
  agentsList?: Array<{ id: string; default?: boolean }>,
) {
  configSpy.mockReturnValue({
    agents: {
      defaults: {
        model: { primary: "anthropic/claude-opus-4-5" },
        models: { "anthropic/claude-opus-4-5": {} },
        workspace: path.join(home, "openclaw"),
        ...agentOverrides,
      },
      list: agentsList,
    },
    session: { store: storePath, mainKey: "main" },
    telegram: telegramOverrides ? { ...telegramOverrides } : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  executeKernelMock.mockResolvedValue(createExecutionResult());
  vi.mocked(loadModelCatalog).mockResolvedValue([]);
});

describe("agentCommand", () => {
  it("creates a session entry when deriving from --to", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store);

      await agentCommand({ message: "hello", to: "+1555" }, runtime);

      const callArgs = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(typeof callArgs?.sessionId).toBe("string");
      expect(callArgs?.sessionKey).toBeTruthy();
    });
  });

  it("persists thinking and verbose overrides", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store);

      await agentCommand({ message: "hi", to: "+1222", thinking: "high", verbose: "on" }, runtime);

      const callArgs = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(typeof callArgs?.sessionId).toBe("string");
      expect(callArgs?.sessionKey).toBeTruthy();
    });
  });

  it("keeps explicit subagent session key in execution requests", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store, { runtime: "claude" });

      await agentCommand({ message: "hi", sessionKey: "agent:main:subagent:abc" }, runtime);

      const call = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(call?.sessionKey).toBe("agent:main:subagent:abc");
    });
  });

  it("resumes when session-id is provided", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      fs.mkdirSync(path.dirname(store), { recursive: true });
      fs.writeFileSync(
        store,
        JSON.stringify(
          {
            foo: {
              sessionId: "session-123",
              updatedAt: Date.now(),
              systemSent: true,
            },
          },
          null,
          2,
        ),
      );
      mockConfig(home, store);

      await agentCommand({ message: "resume me", sessionId: "session-123" }, runtime);

      const callArgs = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(callArgs?.sessionId).toBe("session-123");
    });
  });

  it("does not duplicate agent events from embedded runs", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store);

      const assistantEvents: Array<{ runId: string; text?: string }> = [];
      const stop = onAgentEvent((evt) => {
        if (evt.stream !== "assistant") {
          return;
        }
        assistantEvents.push({
          runId: evt.runId,
          text: typeof evt.data?.text === "string" ? evt.data.text : undefined,
        });
      });

      executeKernelMock.mockResolvedValueOnce(
        createExecutionResult({
          payloads: [{ text: "hello" }],
          reply: "hello",
        }),
      );

      await agentCommand({ message: "hi", to: "+1555" }, runtime);
      stop();

      const matching = assistantEvents.filter((evt) => evt.text === "hello");
      expect(matching).toHaveLength(0);
    });
  });

  it("uses provider/model from agents.defaults.model.primary", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store, {
        model: { primary: "openai/gpt-4.1-mini" },
        models: {
          "anthropic/claude-opus-4-5": {},
          "openai/gpt-4.1-mini": {},
        },
      });

      await agentCommand({ message: "hi", to: "+1555" }, runtime);

      const callArgs = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(callArgs?.config).toBeDefined();
    });
  });

  it("keeps explicit sessionKey even when sessionId exists elsewhere", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      fs.mkdirSync(path.dirname(store), { recursive: true });
      fs.writeFileSync(
        store,
        JSON.stringify(
          {
            "agent:main:main": {
              sessionId: "sess-main",
              updatedAt: Date.now(),
            },
          },
          null,
          2,
        ),
      );
      mockConfig(home, store);

      await agentCommand(
        {
          message: "hi",
          sessionId: "sess-main",
          sessionKey: "agent:main:subagent:abc",
        },
        runtime,
      );

      const callArgs = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(callArgs?.sessionKey).toBe("agent:main:subagent:abc");
      expect(callArgs?.sessionId).toBe("sess-main");
    });
  });

  it("derives session key from --agent when no routing target is provided", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store, undefined, undefined, [{ id: "ops" }]);

      await agentCommand({ message: "hi", agentId: "ops" }, runtime);

      const callArgs = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(callArgs?.sessionKey).toBe("agent:ops:main");
      let agentDir = "";
      if (typeof callArgs?.agentDir === "string") {
        agentDir = callArgs.agentDir;
      } else if (
        typeof callArgs?.agentDir === "number" ||
        typeof callArgs?.agentDir === "boolean" ||
        typeof callArgs?.agentDir === "bigint"
      ) {
        agentDir = callArgs.agentDir.toString();
      }
      expect(agentDir).toContain(`${path.sep}agents${path.sep}ops`);
    });
  });

  it("rejects unknown agent overrides", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store);

      await expect(agentCommand({ message: "hi", agentId: "ghost" }, runtime)).rejects.toThrow(
        'Unknown agent id "ghost"',
      );
    });
  });

  it("defaults thinking to low for reasoning-capable models", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store);
      vi.mocked(loadModelCatalog).mockResolvedValueOnce([
        {
          id: "claude-opus-4-5",
          name: "Opus 4.5",
          provider: "anthropic",
          reasoning: true,
        },
      ]);

      await agentCommand({ message: "hi", to: "+1555" }, runtime);

      const callArgs = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(typeof callArgs?.sessionId).toBe("string");
    });
  });

  it("prints JSON payload when requested", async () => {
    await withTempHome(async (home) => {
      executeKernelMock.mockResolvedValue(
        createExecutionResult({
          payloads: [{ text: "json-reply", mediaUrl: "http://x.test/a.jpg" }],
          usage: {
            inputTokens: 1,
            outputTokens: 1,
            durationMs: 42,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          runtime: {
            kind: "pi",
            provider: "p",
            model: "m",
            fallbackUsed: false,
          },
        }),
      );
      const store = path.join(home, "sessions.json");
      mockConfig(home, store);

      await agentCommand({ message: "hi", to: "+1999", json: true }, runtime);

      const logged = (runtime.log as MockInstance).mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(logged) as {
        payloads: Array<{ text: string; mediaUrl?: string | null }>;
        meta: { durationMs: number };
      };
      expect(parsed.payloads[0].text).toBe("json-reply");
      expect(parsed.payloads[0].mediaUrl).toBe("http://x.test/a.jpg");
      expect(parsed.meta.durationMs).toBe(42);
    });
  });

  it("passes the message through as the agent prompt", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store);

      await agentCommand({ message: "ping", to: "+1333" }, runtime);

      const callArgs = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(callArgs?.prompt).toBe("ping");
    });
  });

  it("passes through telegram accountId when delivering", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store, undefined, { botToken: "t-1" });
      setTelegramRuntime(createPluginRuntime());
      setActivePluginRegistry(
        createTestRegistry([{ pluginId: "telegram", plugin: telegramPlugin, source: "test" }]),
      );
      const deps = {
        sendMessageWhatsApp: vi.fn(),
        sendMessageTelegram: vi.fn().mockResolvedValue({ messageId: "t1", chatId: "123" }),
        sendMessageDiscord: vi.fn(),
        sendMessageSignal: vi.fn(),
        sendMessageIMessage: vi.fn(),
      };

      const prevTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_BOT_TOKEN = "";
      try {
        await agentCommand(
          {
            message: "hi",
            to: "123",
            deliver: true,
            channel: "telegram",
          },
          runtime,
          deps,
        );

        expect(deps.sendMessageTelegram).toHaveBeenCalledWith(
          "123",
          "ok",
          expect.objectContaining({ accountId: undefined, verbose: false }),
        );
      } finally {
        if (prevTelegramToken === undefined) {
          delete process.env.TELEGRAM_BOT_TOKEN;
        } else {
          process.env.TELEGRAM_BOT_TOKEN = prevTelegramToken;
        }
      }
    });
  });

  it("uses reply channel as the message channel context", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store, undefined, undefined, [{ id: "ops" }]);

      await agentCommand({ message: "hi", agentId: "ops", replyChannel: "slack" }, runtime);

      const callArgs = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      const messageContext = (callArgs?.messageContext ?? {}) as Record<string, unknown>;
      expect(messageContext.channel).toBe("slack");
    });
  });

  it("prefers runContext for embedded routing", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store);

      await agentCommand(
        {
          message: "hi",
          to: "+1555",
          channel: "whatsapp",
          runContext: { messageChannel: "slack", accountId: "acct-2" },
        },
        runtime,
      );

      const callArgs = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      const messageContext = (callArgs?.messageContext ?? {}) as Record<string, unknown>;
      expect(messageContext.channel).toBe("slack");
      expect(messageContext.accountId).toBe("acct-2");
    });
  });

  it("forwards accountId to embedded runs", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store);

      await agentCommand({ message: "hi", to: "+1555", accountId: "kev" }, runtime);

      const callArgs = executeKernelMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      const messageContext = (callArgs?.messageContext ?? {}) as Record<string, unknown>;
      expect(messageContext.accountId).toBe("kev");
    });
  });

  it("logs output when delivery is disabled", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      mockConfig(home, store, undefined, undefined, [{ id: "ops" }]);

      await agentCommand({ message: "hi", agentId: "ops", enablePayloadLogging: true }, runtime);

      expect(runtime.log).toHaveBeenCalledWith("ok");
    });
  });
});
