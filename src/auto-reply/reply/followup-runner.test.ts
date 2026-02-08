import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ExecutionRequest, ExecutionResult } from "../../execution/types.js";
import type { FollowupRun } from "./queue.js";
import { loadSessionStore, saveSessionStore, type SessionEntry } from "../../config/sessions.js";
import { createMockTypingController } from "./test-helpers.js";

// Mock kernel execute function — tests configure this per-case
const kernelExecuteMock = vi.fn<(request: ExecutionRequest) => Promise<ExecutionResult>>();

vi.mock("../../execution/kernel.js", () => ({
  createDefaultExecutionKernel: () => ({
    execute: (req: ExecutionRequest) => kernelExecuteMock(req),
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
  runEmbeddedPiAgent: vi.fn(),
}));

import { createFollowupRunner } from "./followup-runner.js";

/** Build a minimal successful ExecutionResult for tests. */
function makeExecutionResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    success: true,
    aborted: false,
    reply: "",
    payloads: [],
    runtime: { kind: "pi", provider: "anthropic", model: "claude", fallbackUsed: false },
    usage: { inputTokens: 0, outputTokens: 0, durationMs: 100 },
    events: [],
    toolCalls: [],
    didSendViaMessagingTool: false,
    ...overrides,
  };
}

const baseQueuedRun = (messageProvider = "whatsapp"): FollowupRun =>
  ({
    prompt: "hello",
    summaryLine: "hello",
    enqueuedAt: Date.now(),
    originatingTo: "channel:C1",
    run: {
      sessionId: "session",
      sessionKey: "main",
      messageProvider,
      agentAccountId: "primary",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      config: {},
      skillsSnapshot: {},
      provider: "anthropic",
      model: "claude",
      thinkLevel: "low",
      verboseLevel: "off",
      elevatedLevel: "off",
      bashElevated: {
        enabled: false,
        allowed: false,
        defaultLevel: "off",
      },
      timeoutMs: 1_000,
      blockReplyBreak: "message_end",
    },
  }) as FollowupRun;

describe("createFollowupRunner compaction", () => {
  it("tracks compaction count without user-facing notice", async () => {
    const storePath = path.join(
      await fs.mkdtemp(path.join(tmpdir(), "openclaw-compaction-")),
      "sessions.json",
    );
    const sessionEntry: SessionEntry = {
      sessionId: "session",
      updatedAt: Date.now(),
    };
    const sessionStore: Record<string, SessionEntry> = {
      main: sessionEntry,
    };
    const onBlockReply = vi.fn(async () => {});

    // Mock kernel.execute: push a compaction agent_event through streamMiddleware,
    // then return a result with payloads.
    kernelExecuteMock.mockImplementationOnce(async (req: ExecutionRequest) => {
      // Push the compaction event through the middleware the production code attached
      req.streamMiddleware?.push({
        kind: "agent_event",
        stream: "compaction",
        data: { phase: "end", willRetry: false },
      });
      return makeExecutionResult({
        payloads: [{ text: "final" }],
      });
    });

    const runner = createFollowupRunner({
      opts: { onBlockReply },
      typing: createMockTypingController(),
      typingMode: "instant",
      sessionEntry,
      sessionStore,
      sessionKey: "main",
      storePath,
      defaultModel: "anthropic/claude-opus-4-5",
    });

    const queued = {
      prompt: "hello",
      summaryLine: "hello",
      enqueuedAt: Date.now(),
      run: {
        sessionId: "session",
        sessionKey: "main",
        messageProvider: "whatsapp",
        sessionFile: "/tmp/session.jsonl",
        workspaceDir: "/tmp",
        config: {},
        skillsSnapshot: {},
        provider: "anthropic",
        model: "claude",
        thinkLevel: "low",
        verboseLevel: "on",
        elevatedLevel: "off",
        bashElevated: {
          enabled: false,
          allowed: false,
          defaultLevel: "off",
        },
        timeoutMs: 1_000,
        blockReplyBreak: "message_end",
      },
    } as FollowupRun;

    await runner(queued);

    expect(onBlockReply).toHaveBeenCalledTimes(1);
    expect(onBlockReply).toHaveBeenCalledWith(expect.objectContaining({ text: "final" }));
    expect(sessionStore.main.compactionCount).toBe(1);
  });
});

describe("createFollowupRunner messaging tool dedupe", () => {
  it("drops payloads already sent via messaging tool", async () => {
    const onBlockReply = vi.fn(async () => {});
    kernelExecuteMock.mockResolvedValueOnce(
      makeExecutionResult({
        payloads: [{ text: "hello world!" }],
        messagingToolSentTexts: ["hello world!"],
      }),
    );

    const runner = createFollowupRunner({
      opts: { onBlockReply },
      typing: createMockTypingController(),
      typingMode: "instant",
      defaultModel: "anthropic/claude-opus-4-5",
    });

    await runner(baseQueuedRun());

    expect(onBlockReply).not.toHaveBeenCalled();
  });

  it("delivers payloads when not duplicates", async () => {
    const onBlockReply = vi.fn(async () => {});
    kernelExecuteMock.mockResolvedValueOnce(
      makeExecutionResult({
        payloads: [{ text: "hello world!" }],
        messagingToolSentTexts: ["different message"],
      }),
    );

    const runner = createFollowupRunner({
      opts: { onBlockReply },
      typing: createMockTypingController(),
      typingMode: "instant",
      defaultModel: "anthropic/claude-opus-4-5",
    });

    await runner(baseQueuedRun());

    expect(onBlockReply).toHaveBeenCalledTimes(1);
  });

  it("suppresses replies when a messaging tool sent via the same provider + target", async () => {
    const onBlockReply = vi.fn(async () => {});
    kernelExecuteMock.mockResolvedValueOnce(
      makeExecutionResult({
        payloads: [{ text: "hello world!" }],
        messagingToolSentTexts: ["different message"],
        messagingToolSentTargets: [{ tool: "slack", provider: "slack", to: "channel:C1" }],
      }),
    );

    const runner = createFollowupRunner({
      opts: { onBlockReply },
      typing: createMockTypingController(),
      typingMode: "instant",
      defaultModel: "anthropic/claude-opus-4-5",
    });

    await runner(baseQueuedRun("slack"));

    expect(onBlockReply).not.toHaveBeenCalled();
  });

  it("persists usage even when replies are suppressed", async () => {
    const storePath = path.join(
      await fs.mkdtemp(path.join(tmpdir(), "openclaw-followup-usage-")),
      "sessions.json",
    );
    const sessionKey = "main";
    const sessionEntry: SessionEntry = { sessionId: "session", updatedAt: Date.now() };
    const sessionStore: Record<string, SessionEntry> = { [sessionKey]: sessionEntry };
    await saveSessionStore(storePath, sessionStore);

    const onBlockReply = vi.fn(async () => {});
    kernelExecuteMock.mockResolvedValueOnce(
      makeExecutionResult({
        payloads: [{ text: "hello world!" }],
        messagingToolSentTexts: ["different message"],
        messagingToolSentTargets: [{ tool: "slack", provider: "slack", to: "channel:C1" }],
        runtime: {
          kind: "pi",
          provider: "anthropic",
          model: "claude-opus-4-5",
          fallbackUsed: false,
        },
        usage: { inputTokens: 10, outputTokens: 5, durationMs: 100 },
      }),
    );

    const runner = createFollowupRunner({
      opts: { onBlockReply },
      typing: createMockTypingController(),
      typingMode: "instant",
      sessionEntry,
      sessionStore,
      sessionKey,
      storePath,
      defaultModel: "anthropic/claude-opus-4-5",
    });

    await runner(baseQueuedRun("slack"));

    expect(onBlockReply).not.toHaveBeenCalled();
    const store = loadSessionStore(storePath, { skipCache: true });
    expect(store[sessionKey]?.totalTokens ?? 0).toBeGreaterThan(0);
    expect(store[sessionKey]?.model).toBe("claude-opus-4-5");
  });
});
