import { describe, expect, it, vi } from "vitest";
import type { ExecutionRequest } from "../../execution/types.js";
import type { TemplateContext } from "../templating.js";
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

vi.mock("../../agents/cli-runner.js", () => ({
  runCliAgent: vi.fn(),
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

function createRun() {
  const typing = createMockTypingController();
  const sessionCtx = {
    Provider: "webchat",
    OriginatingTo: "session:1",
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
      sessionKey: "main",
      messageProvider: "webchat",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      config: {},
      skillsSnapshot: {},
      provider: "claude-cli",
      model: "opus-4.5",
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
    defaultModel: "claude-cli/opus-4.5",
    resolvedVerboseLevel: "off",
    isNewSession: false,
    blockStreamingEnabled: false,
    resolvedBlockStreamingBreak: "message_end",
    shouldInjectGroupIntro: false,
    typingMode: "instant",
  });
}

describe("runReplyAgent claude-cli routing", () => {
  it("uses kernel for claude-cli provider and returns result", async () => {
    kernelExecuteMock.mockImplementationOnce(async (_req: ExecutionRequest) => {
      return makeExecutionResult({
        payloads: [{ text: "ok" }],
        runtime: {
          kind: "cli",
          provider: "claude-cli",
          model: "opus-4.5",
          fallbackUsed: false,
        },
      });
    });

    const result = await createRun();

    // All providers (including claude-cli) now go through the kernel
    expect(kernelExecuteMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ text: "ok" });
  });
});
