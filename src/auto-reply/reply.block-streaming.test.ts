import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionRequest, ExecutionResult } from "../execution/types.js";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";
import { loadModelCatalog } from "../agents/model-catalog.js";
import { getReplyFromConfig } from "./reply.js";
import { makeExecutionResult } from "./reply/test-helpers.js";

// Mock kernel — the production code calls createDefaultExecutionKernel().execute()
const kernelExecuteMock = vi.fn<(request: ExecutionRequest) => Promise<ExecutionResult>>();
vi.mock("../execution/kernel.js", () => ({
  createDefaultExecutionKernel: () => ({
    execute: (req: ExecutionRequest) => kernelExecuteMock(req),
    abort: vi.fn(),
    getActiveRunCount: () => 0,
  }),
}));

// Keep simplified pi-embedded mock for state-check functions (isEmbeddedPiRunActive, etc.)
vi.mock("../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: vi.fn(),
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  resolveEmbeddedSessionLane: (key: string) => `session:${key.trim() || "main"}`,
  isEmbeddedPiRunActive: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunStreaming: vi.fn().mockReturnValue(false),
}));
vi.mock("../agents/model-catalog.js", () => ({
  loadModelCatalog: vi.fn(),
}));
vi.mock("../agents/auth-profiles.js", () => ({
  ensureAuthProfileStore: vi.fn(() => ({
    profiles: {
      "anthropic-default": {
        id: "anthropic-default",
        provider: "anthropic",
        type: "api_key",
        key: "test-key",
      },
      "openai-default": {
        id: "openai-default",
        provider: "openai",
        type: "api_key",
        key: "test-key",
      },
    },
    usageStats: {},
  })),
  resolveAuthProfileOrder: vi.fn((params: { provider: string }) => {
    if (params.provider === "anthropic") {
      return ["anthropic-default"];
    }
    if (params.provider === "openai") {
      return ["openai-default"];
    }
    return ["default"];
  }),
  isProfileInCooldown: vi.fn(() => false),
}));

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(fn, { prefix: "openclaw-stream-" });
}

describe("block streaming", () => {
  beforeEach(() => {
    kernelExecuteMock.mockReset();
    vi.mocked(loadModelCatalog).mockResolvedValue([
      { id: "claude-opus-4-5", name: "Opus 4.5", provider: "anthropic" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai" },
    ]);
  });

  async function waitForCalls(fn: () => number, calls: number) {
    const deadline = Date.now() + 5000;
    while (fn() < calls) {
      if (Date.now() > deadline) {
        throw new Error(`Expected ${calls} call(s), got ${fn()}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  it("waits for block replies before returning final payloads", async () => {
    await withTempHome(async (home) => {
      let releaseTyping: (() => void) | undefined;
      const typingGate = new Promise<void>((resolve) => {
        releaseTyping = resolve;
      });
      const onReplyStart = vi.fn(() => typingGate);
      const onBlockReply = vi.fn().mockResolvedValue(undefined);

      kernelExecuteMock.mockImplementationOnce(async (req: ExecutionRequest) => {
        // Push block_reply event through the stream middleware
        req.streamMiddleware?.push({ kind: "block_reply", text: "hello" });
        return makeExecutionResult({ payloads: [{ text: "hello" }] });
      });

      const replyPromise = getReplyFromConfig(
        {
          Body: "ping",
          From: "+1004",
          To: "+2000",
          MessageSid: "msg-123",
          Provider: "discord",
        },
        {
          onReplyStart,
          onBlockReply,
          disableBlockStreaming: false,
        },
        {
          agents: {
            defaults: {
              model: "anthropic/claude-opus-4-5",
              workspace: path.join(home, "openclaw"),
            },
          },
          channels: { whatsapp: { allowFrom: ["*"] } },
          session: { store: path.join(home, "sessions.json") },
        },
      );

      await waitForCalls(() => onReplyStart.mock.calls.length, 1);
      releaseTyping?.();

      const res = await replyPromise;
      expect(res).toBeUndefined();
      expect(onBlockReply).toHaveBeenCalledTimes(1);
    });
  });

  it("preserves block reply ordering when typing start is slow", async () => {
    await withTempHome(async (home) => {
      let releaseTyping: (() => void) | undefined;
      const typingGate = new Promise<void>((resolve) => {
        releaseTyping = resolve;
      });
      const onReplyStart = vi.fn(() => typingGate);
      const seen: string[] = [];
      const onBlockReply = vi.fn(async (payload) => {
        seen.push(payload.text ?? "");
      });

      kernelExecuteMock.mockImplementationOnce(async (req: ExecutionRequest) => {
        // Push two block_reply events through the stream middleware
        req.streamMiddleware?.push({ kind: "block_reply", text: "first" });
        req.streamMiddleware?.push({ kind: "block_reply", text: "second" });
        return makeExecutionResult({
          payloads: [{ text: "first" }, { text: "second" }],
        });
      });

      const replyPromise = getReplyFromConfig(
        {
          Body: "ping",
          From: "+1004",
          To: "+2000",
          MessageSid: "msg-125",
          Provider: "telegram",
        },
        {
          onReplyStart,
          onBlockReply,
          disableBlockStreaming: false,
        },
        {
          agents: {
            defaults: {
              model: "anthropic/claude-opus-4-5",
              workspace: path.join(home, "openclaw"),
            },
          },
          channels: { telegram: { allowFrom: ["*"] } },
          session: { store: path.join(home, "sessions.json") },
        },
      );

      await waitForCalls(() => onReplyStart.mock.calls.length, 1);
      releaseTyping?.();

      const res = await replyPromise;
      expect(res).toBeUndefined();
      expect(seen).toEqual(["first\n\nsecond"]);
    });
  });

  it("drops final payloads when block replies streamed", async () => {
    await withTempHome(async (home) => {
      const onBlockReply = vi.fn().mockResolvedValue(undefined);

      kernelExecuteMock.mockImplementationOnce(async (req: ExecutionRequest) => {
        req.streamMiddleware?.push({ kind: "block_reply", text: "chunk-1" });
        return makeExecutionResult({
          payloads: [{ text: "chunk-1\nchunk-2" }],
        });
      });

      const res = await getReplyFromConfig(
        {
          Body: "ping",
          From: "+1004",
          To: "+2000",
          MessageSid: "msg-124",
          Provider: "discord",
        },
        {
          onBlockReply,
          disableBlockStreaming: false,
        },
        {
          agents: {
            defaults: {
              model: "anthropic/claude-opus-4-5",
              workspace: path.join(home, "openclaw"),
            },
          },
          channels: { whatsapp: { allowFrom: ["*"] } },
          session: { store: path.join(home, "sessions.json") },
        },
      );

      expect(res).toBeUndefined();
      expect(onBlockReply).toHaveBeenCalledTimes(1);
    });
  });

  it("falls back to final payloads when block reply send times out", async () => {
    await withTempHome(async (home) => {
      let sawAbort = false;
      const onBlockReply = vi.fn((_, context) => {
        return new Promise<void>((resolve) => {
          context?.abortSignal?.addEventListener(
            "abort",
            () => {
              sawAbort = true;
              resolve();
            },
            { once: true },
          );
        });
      });

      kernelExecuteMock.mockImplementationOnce(async (req: ExecutionRequest) => {
        req.streamMiddleware?.push({ kind: "block_reply", text: "streamed" });
        return makeExecutionResult({ payloads: [{ text: "final" }] });
      });

      const replyPromise = getReplyFromConfig(
        {
          Body: "ping",
          From: "+1004",
          To: "+2000",
          MessageSid: "msg-126",
          Provider: "telegram",
        },
        {
          onBlockReply,
          blockReplyTimeoutMs: 10,
          disableBlockStreaming: false,
        },
        {
          agents: {
            defaults: {
              model: "anthropic/claude-opus-4-5",
              workspace: path.join(home, "openclaw"),
            },
          },
          channels: { telegram: { allowFrom: ["*"] } },
          session: { store: path.join(home, "sessions.json") },
        },
      );

      const res = await replyPromise;
      expect(res).toMatchObject({ text: "final" });
      expect(sawAbort).toBe(true);
    });
  });

  it("does not enable block streaming for telegram streamMode block", async () => {
    await withTempHome(async (home) => {
      const onBlockReply = vi.fn().mockResolvedValue(undefined);

      kernelExecuteMock.mockImplementationOnce(async () => {
        return makeExecutionResult({ payloads: [{ text: "final" }] });
      });

      const res = await getReplyFromConfig(
        {
          Body: "ping",
          From: "+1004",
          To: "+2000",
          MessageSid: "msg-126",
          Provider: "telegram",
        },
        {
          onBlockReply,
        },
        {
          agents: {
            defaults: {
              model: "anthropic/claude-opus-4-5",
              workspace: path.join(home, "openclaw"),
            },
          },
          channels: { telegram: { allowFrom: ["*"], streamMode: "block" } },
          session: { store: path.join(home, "sessions.json") },
        },
      );

      expect(res?.text).toBe("final");
      expect(onBlockReply).not.toHaveBeenCalled();
    });
  });
});
