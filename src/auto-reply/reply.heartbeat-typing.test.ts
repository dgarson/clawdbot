import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";

const executeKernelMock = vi.fn();

vi.mock("../agents/model-fallback.js", () => ({
  runWithModelFallback: async ({
    provider,
    model,
    run,
  }: {
    provider: string;
    model: string;
    run: (provider: string, model: string) => Promise<unknown>;
  }) => ({
    result: await run(provider, model),
    provider,
    model,
  }),
}));

vi.mock("../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  resolveEmbeddedSessionLane: (key: string) => `session:${key.trim() || "main"}`,
  isEmbeddedPiRunActive: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunStreaming: vi.fn().mockReturnValue(false),
}));
vi.mock("../execution/kernel.js", () => ({
  createDefaultExecutionKernel: vi.fn().mockReturnValue({
    execute: (request: unknown) => executeKernelMock(request),
    abort: vi.fn(),
    getActiveRunCount: vi.fn().mockReturnValue(0),
  }),
}));

const webMocks = vi.hoisted(() => ({
  webAuthExists: vi.fn().mockResolvedValue(true),
  getWebAuthAgeMs: vi.fn().mockReturnValue(120_000),
  readWebSelfId: vi.fn().mockReturnValue({ e164: "+1999" }),
}));

vi.mock("../web/session.js", () => webMocks);

import { getReplyFromConfig } from "./reply.js";

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(
    async (home) => {
      executeKernelMock.mockClear();
      return await fn(home);
    },
    { prefix: "openclaw-typing-" },
  );
}

function makeCfg(home: string) {
  return {
    agents: {
      defaults: {
        model: "anthropic/claude-opus-4-5",
        workspace: join(home, "openclaw"),
      },
    },
    channels: {
      whatsapp: {
        allowFrom: ["*"],
      },
    },
    session: { store: join(home, "sessions.json") },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getReplyFromConfig typing (heartbeat)", () => {
  it("starts typing for normal runs", async () => {
    await withTempHome(async (home) => {
      executeKernelMock.mockResolvedValueOnce({
        success: true,
        aborted: false,
        reply: "ok",
        payloads: [{ text: "ok" }],
        runtime: { kind: "pi", provider: "anthropic", model: "claude", fallbackUsed: false },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          durationMs: 1,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        events: [],
        toolCalls: [],
        didSendViaMessagingTool: false,
      });
      const onReplyStart = vi.fn();

      await getReplyFromConfig(
        { Body: "hi", From: "+1000", To: "+2000", Provider: "whatsapp" },
        { onReplyStart, isHeartbeat: false },
        makeCfg(home),
      );

      expect(onReplyStart).toHaveBeenCalled();
    });
  });

  it("does not start typing for heartbeat runs", async () => {
    await withTempHome(async (home) => {
      executeKernelMock.mockResolvedValueOnce({
        success: true,
        aborted: false,
        reply: "ok",
        payloads: [{ text: "ok" }],
        runtime: { kind: "pi", provider: "anthropic", model: "claude", fallbackUsed: false },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          durationMs: 1,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        events: [],
        toolCalls: [],
        didSendViaMessagingTool: false,
      });
      const onReplyStart = vi.fn();

      await getReplyFromConfig(
        { Body: "hi", From: "+1000", To: "+2000", Provider: "whatsapp" },
        { onReplyStart, isHeartbeat: true },
        makeCfg(home),
      );

      expect(onReplyStart).not.toHaveBeenCalled();
    });
  });
});
