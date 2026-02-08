import { describe, expect, it, vi } from "vitest";
import type { TemplateContext } from "../templating.js";
import type { FollowupRun } from "./queue.js";

// Use vi.hoisted to avoid "Cannot access before initialization" with vi.mock factories
const mocks = vi.hoisted(() => ({
  runWithModelFallback: vi.fn(),
  hasConfiguredModelFallback: vi.fn().mockReturnValue(false),
  resolveAgentModelFallbacksOverride: vi.fn().mockReturnValue([]),
}));

vi.mock("../../agents/model-fallback.js", () => ({
  hasConfiguredModelFallback: mocks.hasConfiguredModelFallback,
  runWithModelFallback: mocks.runWithModelFallback,
}));

vi.mock("../../agents/agent-scope.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../agents/agent-scope.js")>();
  return {
    ...actual,
    resolveAgentModelFallbacksOverride: mocks.resolveAgentModelFallbacksOverride,
  };
});

// Mock the execution kernel (no longer calling runEmbeddedPiAgent directly)
vi.mock("../../execution/kernel.js", () => ({
  createDefaultExecutionKernel: vi.fn().mockReturnValue({
    execute: vi.fn(),
    abort: vi.fn(),
    getActiveRunCount: vi.fn().mockReturnValue(0),
  }),
}));

// Lazy import after mocks are set up
const { runMemoryFlushIfNeeded } = await import("./agent-runner-memory.js");

function mockFlushResult() {
  mocks.runWithModelFallback.mockImplementation(
    async (params: { provider: string; model: string }) => ({
      result: {
        meta: { durationMs: 5 },
        payloads: [],
      },
      provider: params.provider,
      model: params.model,
      attempts: [],
    }),
  );
}

function createFollowupRun(params: { config?: Record<string, unknown> }): FollowupRun {
  return {
    prompt: "flush",
    summaryLine: "flush",
    enqueuedAt: Date.now(),
    run: {
      agentId: "main",
      agentDir: "/tmp/agent",
      sessionId: "session",
      sessionKey: "main",
      messageProvider: "slack",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      config: params.config ?? {},
      skillsSnapshot: { prompt: "", skills: [] },
      provider: "anthropic",
      model: "claude-opus-4-5",
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
}

describe("runMemoryFlushIfNeeded", () => {
  it("skips memory flush when no non-claude runtime providers are configured", async () => {
    mocks.runWithModelFallback.mockReset();
    mocks.hasConfiguredModelFallback.mockReturnValue(false);
    mocks.resolveAgentModelFallbacksOverride.mockReturnValue([]);

    const sessionEntry = {
      sessionId: "session",
      updatedAt: Date.now(),
      // Token count must exceed the flush threshold (contextWindow - reserve - soft)
      // so the flush pre-check logic reaches hasConfiguredModelFallback
      totalTokens: 500_000,
      compactionCount: 1,
    };

    const cfg = {
      agents: {
        defaults: {
          compaction: {
            reserveTokensFloor: 1000,
            memoryFlush: {
              enabled: true,
              softThresholdTokens: 1000,
            },
          },
        },
      },
    } as Record<string, unknown>;

    const sessionCtx = {
      Provider: "slack",
      OriginatingTo: "C123",
      AccountId: "primary",
      MessageSid: "msg",
    } as unknown as TemplateContext;

    const result = await runMemoryFlushIfNeeded({
      cfg: cfg as unknown as FollowupRun["run"]["config"],
      followupRun: createFollowupRun({ config: cfg }),
      sessionCtx,
      defaultModel: "anthropic/claude-opus-4-5",
      agentCfgContextTokens: 130_000,
      resolvedVerboseLevel: "off",
      sessionEntry,
      sessionStore: { main: sessionEntry },
      sessionKey: "main",
      storePath: "/tmp/sessions.json",
      isHeartbeat: false,
    });

    expect(result).toBe(sessionEntry);
    expect(mocks.hasConfiguredModelFallback).toHaveBeenCalledWith(
      expect.objectContaining({ runtimeKind: "pi" }),
    );
    expect(mocks.runWithModelFallback).not.toHaveBeenCalled();
  });

  it("uses memory.model.primary when selecting the memory flush model", async () => {
    mocks.runWithModelFallback.mockReset();
    mocks.hasConfiguredModelFallback.mockReturnValue(true);
    mocks.resolveAgentModelFallbacksOverride.mockReturnValue([]);
    mockFlushResult();

    const sessionEntry = {
      sessionId: "session",
      updatedAt: Date.now(),
      totalTokens: 500_000,
      compactionCount: 1,
    };

    const cfg = {
      agents: {
        defaults: {
          compaction: {
            reserveTokensFloor: 1000,
            memoryFlush: {
              enabled: true,
              softThresholdTokens: 1000,
            },
          },
        },
      },
      memory: {
        model: {
          primary: "openai/gpt-4o",
        },
      },
    } as Record<string, unknown>;

    const sessionCtx = {
      Provider: "slack",
      OriginatingTo: "C123",
      AccountId: "primary",
      MessageSid: "msg",
    } as unknown as TemplateContext;

    await runMemoryFlushIfNeeded({
      cfg: cfg as unknown as FollowupRun["run"]["config"],
      followupRun: createFollowupRun({ config: cfg }),
      sessionCtx,
      defaultModel: "anthropic/claude-opus-4-5",
      agentCfgContextTokens: 130_000,
      resolvedVerboseLevel: "off",
      sessionEntry,
      sessionStore: { main: sessionEntry },
      sessionKey: "main",
      storePath: "/tmp/sessions.json",
      isHeartbeat: false,
    });

    expect(mocks.runWithModelFallback).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai", model: "gpt-4o" }),
    );
  });

  it("prefers memory.model.fallbacks over agent fallbacks", async () => {
    mocks.runWithModelFallback.mockReset();
    mocks.hasConfiguredModelFallback.mockReturnValue(true);
    mocks.resolveAgentModelFallbacksOverride.mockReturnValue(["anthropic/claude-haiku-3-5"]);
    mockFlushResult();

    const sessionEntry = {
      sessionId: "session",
      updatedAt: Date.now(),
      totalTokens: 500_000,
      compactionCount: 1,
    };

    const cfg = {
      agents: {
        defaults: {
          compaction: {
            reserveTokensFloor: 1000,
            memoryFlush: {
              enabled: true,
              softThresholdTokens: 1000,
            },
          },
        },
      },
      memory: {
        model: {
          fallbacks: ["openai/gpt-4o-mini"],
        },
      },
    } as Record<string, unknown>;

    const sessionCtx = {
      Provider: "slack",
      OriginatingTo: "C123",
      AccountId: "primary",
      MessageSid: "msg",
    } as unknown as TemplateContext;

    await runMemoryFlushIfNeeded({
      cfg: cfg as unknown as FollowupRun["run"]["config"],
      followupRun: createFollowupRun({ config: cfg }),
      sessionCtx,
      defaultModel: "anthropic/claude-opus-4-5",
      agentCfgContextTokens: 130_000,
      resolvedVerboseLevel: "off",
      sessionEntry,
      sessionStore: { main: sessionEntry },
      sessionKey: "main",
      storePath: "/tmp/sessions.json",
      isHeartbeat: false,
    });

    expect(mocks.runWithModelFallback).toHaveBeenCalledWith(
      expect.objectContaining({ fallbacksOverride: ["openai/gpt-4o-mini"] }),
    );
  });
});
