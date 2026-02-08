import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CliDeps } from "../cli/deps.js";
import type { OpenClawConfig } from "../config/config.js";
import type { ExecutionResult } from "../execution/types.js";
import type { CronJob } from "./types.js";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";
import { telegramOutbound } from "../channels/plugins/outbound/telegram.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createOutboundTestPlugin, createTestRegistry } from "../test-utils/channel-plugins.js";

const executeKernelMock = vi.fn();

vi.mock("../agents/model-catalog.js", () => ({
  loadModelCatalog: vi.fn(),
}));
vi.mock("../execution/kernel.js", () => ({
  createDefaultExecutionKernel: vi.fn().mockReturnValue({
    execute: (request: unknown) => executeKernelMock(request),
    abort: vi.fn(),
    getActiveRunCount: vi.fn().mockReturnValue(0),
  }),
}));

import { loadModelCatalog } from "../agents/model-catalog.js";
import { runCronIsolatedAgentTurn } from "./isolated-agent.js";

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(fn, { prefix: "openclaw-cron-" });
}

async function writeSessionStore(home: string) {
  const dir = path.join(home, ".openclaw", "sessions");
  await fs.mkdir(dir, { recursive: true });
  const storePath = path.join(dir, "sessions.json");
  await fs.writeFile(
    storePath,
    JSON.stringify(
      {
        "agent:main:main": {
          sessionId: "main-session",
          updatedAt: Date.now(),
          lastProvider: "webchat",
          lastTo: "",
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
  return storePath;
}

function makeCfg(
  home: string,
  storePath: string,
  overrides: Partial<OpenClawConfig> = {},
): OpenClawConfig {
  const base: OpenClawConfig = {
    agents: {
      defaults: {
        model: "anthropic/claude-opus-4-5",
        workspace: path.join(home, "openclaw"),
      },
    },
    session: { store: storePath, mainKey: "main" },
  } as OpenClawConfig;
  return { ...base, ...overrides };
}

function makeJob(payload: CronJob["payload"]): CronJob {
  const now = Date.now();
  return {
    id: "job-1",
    name: "job-1",
    enabled: true,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: { kind: "every", everyMs: 60_000 },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload,
    state: {},
  };
}

function createExecutionResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    success: true,
    aborted: false,
    error: undefined,
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

describe("runCronIsolatedAgentTurn", () => {
  beforeEach(() => {
    executeKernelMock.mockReset();
    executeKernelMock.mockResolvedValue(createExecutionResult());
    vi.mocked(loadModelCatalog).mockResolvedValue([]);
    setActivePluginRegistry(
      createTestRegistry([
        {
          pluginId: "telegram",
          plugin: createOutboundTestPlugin({ id: "telegram", outbound: telegramOutbound }),
          source: "test",
        },
      ]),
    );
  });

  it("delivers when response has HEARTBEAT_OK but includes media", async () => {
    await withTempHome(async (home) => {
      const storePath = await writeSessionStore(home);
      const deps: CliDeps = {
        sendMessageWhatsApp: vi.fn(),
        sendMessageTelegram: vi.fn().mockResolvedValue({
          messageId: "t1",
          chatId: "123",
        }),
        sendMessageDiscord: vi.fn(),
        sendMessageSignal: vi.fn(),
        sendMessageIMessage: vi.fn(),
      };
      // Media should still be delivered even if text is just HEARTBEAT_OK.
      executeKernelMock.mockResolvedValue(
        createExecutionResult({
          payloads: [{ text: "HEARTBEAT_OK", mediaUrl: "https://example.com/img.png" }],
        }),
      );

      const res = await runCronIsolatedAgentTurn({
        cfg: makeCfg(home, storePath),
        deps,
        job: {
          ...makeJob({
            kind: "agentTurn",
            message: "do it",
          }),
          delivery: { mode: "announce", channel: "telegram", to: "123" },
        },
        message: "do it",
        sessionKey: "cron:job-1",
        lane: "cron",
      });

      expect(res.status).toBe("ok");
      expect(deps.sendMessageTelegram).toHaveBeenCalled();
    });
  });

  it("delivers when heartbeat ack padding exceeds configured limit", async () => {
    await withTempHome(async (home) => {
      const storePath = await writeSessionStore(home);
      const deps: CliDeps = {
        sendMessageWhatsApp: vi.fn(),
        sendMessageTelegram: vi.fn().mockResolvedValue({
          messageId: "t1",
          chatId: "123",
        }),
        sendMessageDiscord: vi.fn(),
        sendMessageSignal: vi.fn(),
        sendMessageIMessage: vi.fn(),
      };
      executeKernelMock.mockResolvedValue(
        createExecutionResult({ payloads: [{ text: "HEARTBEAT_OK 🦞" }] }),
      );

      const cfg = makeCfg(home, storePath);
      cfg.agents = {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          heartbeat: { ackMaxChars: 0 },
        },
      };

      const res = await runCronIsolatedAgentTurn({
        cfg,
        deps,
        job: {
          ...makeJob({
            kind: "agentTurn",
            message: "do it",
          }),
          delivery: { mode: "announce", channel: "telegram", to: "123" },
        },
        message: "do it",
        sessionKey: "cron:job-1",
        lane: "cron",
      });

      expect(res.status).toBe("ok");
      expect(deps.sendMessageTelegram).toHaveBeenCalled();
    });
  });
});
