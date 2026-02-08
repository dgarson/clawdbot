import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ExecutionRequest } from "../../execution/types.js";
import type { TemplateContext } from "../templating.js";
import type { FollowupRun, QueueSettings } from "./queue.js";
import { loadSessionStore, saveSessionStore, type SessionEntry } from "../../config/sessions.js";
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

function createRun(
  messageProvider = "slack",
  opts: { storePath?: string; sessionKey?: string } = {},
) {
  const typing = createMockTypingController();
  const sessionKey = opts.sessionKey ?? "main";
  const sessionCtx = {
    Provider: messageProvider,
    OriginatingTo: "channel:C1",
    AccountId: "primary",
    MessageSid: "msg",
  } as unknown as TemplateContext;
  const resolvedQueue = { mode: "interrupt" } as unknown as QueueSettings;
  const followupRun = {
    prompt: "hello",
    summaryLine: "hello",
    enqueuedAt: Date.now(),
    run: {
      sessionId: "session",
      sessionKey,
      messageProvider,
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
  } as unknown as FollowupRun;

  return runReplyAgent({
    commandBody: "hello",
    followupRun,
    queueKey: "main",
    resolvedQueue,
    shouldSteer: false,
    shouldFollowup: false,
    isActive: false,
    isStreaming: false,
    typing,
    sessionCtx,
    sessionKey,
    storePath: opts.storePath,
    defaultModel: "anthropic/claude-opus-4-5",
    resolvedVerboseLevel: "off",
    isNewSession: false,
    blockStreamingEnabled: false,
    resolvedBlockStreamingBreak: "message_end",
    shouldInjectGroupIntro: false,
    typingMode: "instant",
  });
}

describe("runReplyAgent messaging tool suppression", () => {
  it("drops replies when a messaging tool sent via the same provider + target", async () => {
    kernelExecuteMock.mockImplementationOnce(async (_req: ExecutionRequest) => {
      return makeExecutionResult({
        payloads: [{ text: "hello world!" }],
        messagingToolSentTexts: ["different message"],
        messagingToolSentTargets: [{ tool: "slack", provider: "slack", to: "channel:C1" }],
      });
    });

    const result = await createRun("slack");

    expect(result).toBeUndefined();
  });

  it("delivers replies when tool provider does not match", async () => {
    kernelExecuteMock.mockImplementationOnce(async (_req: ExecutionRequest) => {
      return makeExecutionResult({
        payloads: [{ text: "hello world!" }],
        messagingToolSentTexts: ["different message"],
        messagingToolSentTargets: [{ tool: "discord", provider: "discord", to: "channel:C1" }],
      });
    });

    const result = await createRun("slack");

    expect(result).toMatchObject({ text: "hello world!" });
  });

  it("delivers replies when account ids do not match", async () => {
    kernelExecuteMock.mockImplementationOnce(async (_req: ExecutionRequest) => {
      return makeExecutionResult({
        payloads: [{ text: "hello world!" }],
        messagingToolSentTexts: ["different message"],
        messagingToolSentTargets: [
          {
            tool: "slack",
            provider: "slack",
            to: "channel:C1",
            accountId: "alt",
          },
        ],
      });
    });

    const result = await createRun("slack");

    expect(result).toMatchObject({ text: "hello world!" });
  });

  it("persists usage even when replies are suppressed", async () => {
    const storePath = path.join(
      await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-session-store-")),
      "sessions.json",
    );
    const sessionKey = "main";
    const entry: SessionEntry = { sessionId: "session", updatedAt: Date.now() };
    await saveSessionStore(storePath, { [sessionKey]: entry });

    kernelExecuteMock.mockImplementationOnce(async (_req: ExecutionRequest) => {
      return makeExecutionResult({
        payloads: [{ text: "hello world!" }],
        messagingToolSentTexts: ["different message"],
        messagingToolSentTargets: [{ tool: "slack", provider: "slack", to: "channel:C1" }],
        runtime: {
          kind: "pi",
          provider: "anthropic",
          model: "claude-opus-4-5",
          fallbackUsed: false,
        },
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          durationMs: 100,
        },
      });
    });

    const result = await createRun("slack", { storePath, sessionKey });

    expect(result).toBeUndefined();
    const store = loadSessionStore(storePath, { skipCache: true });
    expect(store[sessionKey]?.totalTokens ?? 0).toBeGreaterThan(0);
    expect(store[sessionKey]?.model).toBe("claude-opus-4-5");
  });
});
