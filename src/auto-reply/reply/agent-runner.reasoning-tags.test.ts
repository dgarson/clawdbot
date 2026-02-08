import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionEntry } from "../../config/sessions.js";
import type { ExecutionRequest } from "../../execution/types.js";
import type { TemplateContext } from "../templating.js";
import type { FollowupRun, QueueSettings } from "./queue.js";
import { DEFAULT_MEMORY_FLUSH_PROMPT } from "./memory-flush.js";
import { createMockTypingController, makeExecutionResult } from "./test-helpers.js";

const kernelExecuteMock = vi.fn();
const runWithModelFallbackMock = vi.fn();

vi.mock("../../execution/kernel.js", () => ({
  createDefaultExecutionKernel: () => ({
    execute: kernelExecuteMock,
    abort: vi.fn(),
    getActiveRunCount: () => 0,
  }),
}));

vi.mock("../../agents/model-fallback.js", () => ({
  hasConfiguredModelFallback: vi.fn().mockReturnValue(true),
  runWithModelFallback: (params: {
    provider: string;
    model: string;
    run: (provider: string, model: string) => Promise<unknown>;
  }) => runWithModelFallbackMock(params),
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

function createRun(params?: {
  sessionEntry?: SessionEntry;
  sessionKey?: string;
  agentCfgContextTokens?: number;
}) {
  const typing = createMockTypingController();
  const sessionCtx = {
    Provider: "whatsapp",
    OriginatingTo: "+15550001111",
    AccountId: "primary",
    MessageSid: "msg",
  } as unknown as TemplateContext;
  const resolvedQueue = { mode: "interrupt" } as unknown as QueueSettings;
  const sessionKey = params?.sessionKey ?? "main";
  const followupRun = {
    prompt: "hello",
    summaryLine: "hello",
    enqueuedAt: Date.now(),
    run: {
      agentId: "main",
      agentDir: "/tmp/agent",
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
    sessionEntry: params?.sessionEntry,
    sessionKey,
    defaultModel: "anthropic/claude-opus-4-5",
    agentCfgContextTokens: params?.agentCfgContextTokens,
    resolvedVerboseLevel: "off",
    isNewSession: false,
    blockStreamingEnabled: false,
    resolvedBlockStreamingBreak: "message_end",
    shouldInjectGroupIntro: false,
    typingMode: "instant",
  });
}

describe("runReplyAgent fallback reasoning tags", () => {
  beforeEach(() => {
    kernelExecuteMock.mockReset();
    runWithModelFallbackMock.mockReset();
  });

  it("enforces <final> when the fallback provider requires reasoning tags", async () => {
    kernelExecuteMock.mockImplementation(async (_req: ExecutionRequest) => {
      return makeExecutionResult({ payloads: [{ text: "ok" }] });
    });
    runWithModelFallbackMock.mockImplementationOnce(
      async ({ run }: { run: (provider: string, model: string) => Promise<unknown> }) => ({
        result: await run("google-antigravity", "gemini-3"),
        provider: "google-antigravity",
        model: "gemini-3",
      }),
    );

    await createRun();

    // The kernel should have received a request with enforceFinalTag in runtimeHints
    const req = kernelExecuteMock.mock.calls[0]?.[0] as ExecutionRequest | undefined;
    expect(req?.runtimeHints?.enforceFinalTag).toBe(true);
  });

  it("enforces <final> during memory flush on fallback providers", async () => {
    kernelExecuteMock.mockImplementation(async (_req: ExecutionRequest) => {
      return makeExecutionResult({ payloads: [{ text: "ok" }] });
    });
    runWithModelFallbackMock.mockImplementation(
      async ({ run }: { run: (provider: string, model: string) => Promise<unknown> }) => ({
        result: await run("google-antigravity", "gemini-3"),
        provider: "google-antigravity",
        model: "gemini-3",
      }),
    );

    await createRun({
      sessionEntry: {
        sessionId: "session",
        updatedAt: Date.now(),
        totalTokens: 1_000_000,
        compactionCount: 0,
      },
    });

    // Find the memory flush kernel call by checking for the flush prompt
    const flushCall = kernelExecuteMock.mock.calls.find(
      ([req]: [ExecutionRequest]) => req.prompt === DEFAULT_MEMORY_FLUSH_PROMPT,
    )?.[0] as ExecutionRequest | undefined;

    expect(flushCall?.runtimeHints?.enforceFinalTag).toBe(true);
  });
});
