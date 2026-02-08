import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SessionEntry } from "../../config/sessions.js";
import type { TypingMode } from "../../config/types.js";
import type { ExecutionRequest } from "../../execution/types.js";
import type { TemplateContext } from "../templating.js";
import type { GetReplyOptions } from "../types.js";
import type { FollowupRun, QueueSettings } from "./queue.js";
import { createMockTypingController, makeExecutionResult } from "./test-helpers.js";

const kernelExecuteMock = vi.fn();

vi.mock("../../execution/kernel.js", () => ({
  createDefaultExecutionKernel: () => ({
    execute: kernelExecuteMock,
    abort: vi.fn(),
    getActiveRunCount: () => 0,
  }),
}));

vi.mock("../../agents/model-fallback.js", () => ({
  hasConfiguredModelFallback: vi.fn().mockReturnValue(true),
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

vi.mock("../../agents/pi-embedded.js", () => ({
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: vi.fn(),
}));

vi.mock("./queue.js", async () => {
  const actual = await vi.importActual<typeof import("./queue.js")>("./queue.js");
  return {
    ...actual,
    enqueueFollowupRun: vi.fn(),
    scheduleFollowupDrain: vi.fn(),
  };
});

import { runReplyAgent } from "./agent-runner.js";

function createMinimalRun(params?: {
  opts?: GetReplyOptions;
  resolvedVerboseLevel?: "off" | "on";
  sessionStore?: Record<string, SessionEntry>;
  sessionEntry?: SessionEntry;
  sessionKey?: string;
  storePath?: string;
  typingMode?: TypingMode;
  blockStreamingEnabled?: boolean;
}) {
  const typing = createMockTypingController();
  const opts = params?.opts;
  const sessionCtx = {
    Provider: "whatsapp",
    MessageSid: "msg",
  } as unknown as TemplateContext;
  const resolvedQueue = { mode: "interrupt" } as unknown as QueueSettings;
  const sessionKey = params?.sessionKey ?? "main";
  const followupRun = {
    prompt: "hello",
    summaryLine: "hello",
    enqueuedAt: Date.now(),
    run: {
      sessionId: "session",
      sessionKey,
      messageProvider: "whatsapp",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      config: {},
      skillsSnapshot: {},
      provider: "anthropic",
      model: "claude",
      thinkLevel: "low",
      verboseLevel: params?.resolvedVerboseLevel ?? "off",
      elevatedLevel: "off",
      bashElevated: {
        enabled: false,
        allowed: false,
        defaultLevel: "off",
      },
      timeoutMs: 1_000,
      blockReplyBreak: "message_end",
    },
  } as unknown as FollowupRun;

  return {
    typing,
    opts,
    run: () =>
      runReplyAgent({
        commandBody: "hello",
        followupRun,
        queueKey: "main",
        resolvedQueue,
        shouldSteer: false,
        shouldFollowup: false,
        isActive: false,
        isStreaming: false,
        opts,
        typing,
        sessionEntry: params?.sessionEntry,
        sessionStore: params?.sessionStore,
        sessionKey,
        storePath: params?.storePath,
        sessionCtx,
        defaultModel: "anthropic/claude-opus-4-5",
        resolvedVerboseLevel: params?.resolvedVerboseLevel ?? "off",
        isNewSession: false,
        blockStreamingEnabled: params?.blockStreamingEnabled ?? false,
        resolvedBlockStreamingBreak: "message_end",
        shouldInjectGroupIntro: false,
        typingMode: params?.typingMode ?? "instant",
      }),
  };
}

describe("runReplyAgent typing (heartbeat)", () => {
  it("signals typing on block replies", async () => {
    const onBlockReply = vi.fn();
    kernelExecuteMock.mockImplementationOnce(async (req: ExecutionRequest) => {
      // Push a block_reply raw event through middleware
      req.streamMiddleware?.push({ kind: "block_reply", text: "chunk", mediaUrls: [] });
      return makeExecutionResult({ payloads: [{ text: "final" }] });
    });

    const { run, typing } = createMinimalRun({
      typingMode: "message",
      blockStreamingEnabled: true,
      opts: { onBlockReply },
    });
    await run();

    expect(typing.startTypingOnText).toHaveBeenCalledWith("chunk");
    expect(onBlockReply).toHaveBeenCalled();
    const [blockPayload, blockOpts] = onBlockReply.mock.calls[0] ?? [];
    expect(blockPayload).toMatchObject({ text: "chunk", audioAsVoice: false });
    expect(blockOpts).toMatchObject({
      abortSignal: expect.any(AbortSignal),
      timeoutMs: expect.any(Number),
    });
  });
  it("signals typing on tool results", async () => {
    const onToolResult = vi.fn();
    kernelExecuteMock.mockImplementationOnce(async (req: ExecutionRequest) => {
      // Push a tool_end raw event with result text through middleware
      req.streamMiddleware?.push({ kind: "tool_end", name: "bash", id: "t1", text: "tooling" });
      return makeExecutionResult({ payloads: [{ text: "final" }] });
    });

    const { run, typing } = createMinimalRun({
      typingMode: "message",
      opts: { onToolResult },
    });
    await run();

    expect(typing.startTypingOnText).toHaveBeenCalledWith("tooling");
    expect(onToolResult).toHaveBeenCalledWith({
      text: "tooling",
    });
  });
  it("forwards tool results through the middleware pipeline", async () => {
    // In the kernel architecture, tool_end events with text always emit tool_result
    // events through the middleware. NO_REPLY filtering happens at a higher level.
    const onToolResult = vi.fn();
    kernelExecuteMock.mockImplementationOnce(async (req: ExecutionRequest) => {
      req.streamMiddleware?.push({ kind: "tool_end", name: "bash", id: "t1", text: "NO_REPLY" });
      return makeExecutionResult({ payloads: [{ text: "final" }] });
    });

    const { run, typing } = createMinimalRun({
      typingMode: "message",
      opts: { onToolResult },
    });
    await run();

    // The middleware forwards all tool results (including NO_REPLY) through the pipeline
    expect(onToolResult).toHaveBeenCalledWith({ text: "NO_REPLY" });
  });
  it("tracks compaction count without user-facing notice", async () => {
    const storePath = path.join(
      await fs.mkdtemp(path.join(tmpdir(), "openclaw-compaction-")),
      "sessions.json",
    );
    const sessionEntry = { sessionId: "session", updatedAt: Date.now() };
    const sessionStore = { main: sessionEntry };

    kernelExecuteMock.mockImplementationOnce(async (req: ExecutionRequest) => {
      // Push compaction end event through middleware
      req.streamMiddleware?.push({
        kind: "agent_event",
        stream: "compaction",
        data: { phase: "end", willRetry: false },
      });
      return makeExecutionResult({ payloads: [{ text: "final" }] });
    });

    const { run } = createMinimalRun({
      resolvedVerboseLevel: "on",
      sessionEntry,
      sessionStore,
      sessionKey: "main",
      storePath,
    });
    const res = await run();
    // Single payload is returned as a single object, not an array
    const payload = Array.isArray(res) ? res[0] : res;
    expect(payload?.text).toBe("final");
    expect(sessionStore.main.compactionCount).toBe(1);
  });
});
