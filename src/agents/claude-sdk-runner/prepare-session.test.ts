import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmbeddedRunAttemptParams } from "../pi-embedded-runner/run/types.js";
import { createClaudeSdkSession } from "./create-session.js";
import { prepareClaudeSdkSession, resolveClaudeSdkConfig } from "./prepare-session.js";

vi.mock("./create-session.js", () => ({
  createClaudeSdkSession: vi.fn().mockResolvedValue({ sessionId: "mock-session" }),
}));

const baseParams = {
  modelId: "claude-sonnet-4-5",
  sessionId: "s1",
  sessionFile: "/tmp/s.jsonl",
  model: { cost: undefined },
  thinkLevel: "off",
  streamParams: undefined,
} as unknown as EmbeddedRunAttemptParams;

const baseSessionManager = () => ({
  getEntries: vi.fn(() => [] as Array<{ type: string; customType?: string; data?: unknown }>),
  appendCustomEntry: vi.fn(),
  appendMessage: vi.fn(),
});

const claudeSdkConfig = {};
const resolvedWorkspace = "/tmp/ws";
const agentDir = undefined;
const systemPromptText = "sys";
const builtInTools: [] = [];
const allCustomTools: [] = [];
const resolvedProviderAuth = undefined;

type PrepareSessionManager = Parameters<typeof prepareClaudeSdkSession>[3];

function callPrepare(
  params: EmbeddedRunAttemptParams,
  sessionManager: PrepareSessionManager,
  cfg = claudeSdkConfig,
) {
  return prepareClaudeSdkSession(
    params,
    cfg,
    resolvedProviderAuth,
    sessionManager,
    resolvedWorkspace,
    agentDir,
    systemPromptText,
    builtInTools,
    allCustomTools,
  );
}

describe("prepareClaudeSdkSession — model ID validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects modelId that does not start with 'claude-'", async () => {
    const params = { ...baseParams, modelId: "gpt-4o" } as unknown as EmbeddedRunAttemptParams;
    await expect(callPrepare(params, baseSessionManager())).rejects.toThrow(
      /must start with "claude-"/,
    );
  });

  it("resolves without throwing for a valid claude- modelId", async () => {
    await expect(callPrepare(baseParams, baseSessionManager())).resolves.not.toThrow();
  });
});

describe("prepareClaudeSdkSession — resume session ID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes claudeSdkResumeSessionId from a matching custom entry", async () => {
    const sm = baseSessionManager();
    sm.getEntries.mockReturnValue([
      { type: "custom", customType: "openclaw:claude-sdk-session-id", data: "sess-abc" },
    ]);
    await callPrepare(baseParams, sm);
    const mock = createClaudeSdkSession as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][0].claudeSdkResumeSessionId).toBe("sess-abc");
  });

  it("uses the last matching entry when multiple entries exist", async () => {
    const sm = baseSessionManager();
    sm.getEntries.mockReturnValue([
      { type: "custom", customType: "openclaw:claude-sdk-session-id", data: "old-id" },
      { type: "custom", customType: "openclaw:claude-sdk-session-id", data: "new-id" },
    ]);
    await callPrepare(baseParams, sm);
    const mock = createClaudeSdkSession as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][0].claudeSdkResumeSessionId).toBe("new-id");
  });

  it("sets claudeSdkResumeSessionId to undefined when data is non-string", async () => {
    const sm = baseSessionManager();
    sm.getEntries.mockReturnValue([
      { type: "custom", customType: "openclaw:claude-sdk-session-id", data: 123 },
    ]);
    await callPrepare(baseParams, sm);
    const mock = createClaudeSdkSession as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][0].claudeSdkResumeSessionId).toBeUndefined();
  });

  it("sets claudeSdkResumeSessionId to undefined when no matching entries exist", async () => {
    const sm = baseSessionManager();
    sm.getEntries.mockReturnValue([{ type: "message", data: "irrelevant" }]);
    await callPrepare(baseParams, sm);
    const mock = createClaudeSdkSession as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][0].claudeSdkResumeSessionId).toBeUndefined();
  });

  it("sets claudeSdkResumeSessionId to undefined when getEntries is undefined", async () => {
    const sm = { appendCustomEntry: vi.fn(), appendMessage: vi.fn() };
    await callPrepare(baseParams, sm);
    const mock = createClaudeSdkSession as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][0].claudeSdkResumeSessionId).toBeUndefined();
  });
});

describe("prepareClaudeSdkSession — thinkLevel resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses params thinkLevel when it is not 'off'", async () => {
    const params = { ...baseParams, thinkLevel: "low" } as unknown as EmbeddedRunAttemptParams;
    await callPrepare(params, baseSessionManager());
    const mock = createClaudeSdkSession as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][0].thinkLevel).toBe("low");
  });

  it("uses thinkingDefault from config when thinkLevel is 'off'", async () => {
    const cfg = { thinkingDefault: "medium" as const };
    await callPrepare(baseParams, baseSessionManager(), cfg);
    const mock = createClaudeSdkSession as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][0].thinkLevel).toBe("medium");
  });

  it("keeps 'off' when thinkLevel is 'off' and no thinkingDefault is set", async () => {
    await callPrepare(baseParams, baseSessionManager());
    const mock = createClaudeSdkSession as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][0].thinkLevel).toBe("off");
  });
});

describe("resolveClaudeSdkConfig — thinkingDefault compatibility", () => {
  it("keeps claudeSdk config when thinkingDefault is legacy 'none'", () => {
    const params = {
      config: {
        agents: {
          defaults: {
            claudeSdk: {
              thinkingDefault: "none",
            },
          },
          list: [],
        },
      },
    } as unknown as EmbeddedRunAttemptParams;

    const resolved = resolveClaudeSdkConfig(params, "agent-1");
    expect(resolved).toBeDefined();
    expect(resolved?.thinkingDefault).toBe("none");
  });
});
