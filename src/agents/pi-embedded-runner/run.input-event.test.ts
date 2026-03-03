import "./run.overflow-compaction.mocks.shared.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../infra/agent-events.js", () => ({
  emitAgentEvent: vi.fn(),
}));

import { emitAgentEvent } from "../../infra/agent-events.js";
import { runEmbeddedPiAgent } from "./run.js";
import { runEmbeddedAttempt } from "./run/attempt.js";

const mockedRunEmbeddedAttempt = vi.mocked(runEmbeddedAttempt);

describe("runEmbeddedPiAgent input stream events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRunEmbeddedAttempt.mockResolvedValue({
      aborted: false,
      promptError: null,
      timedOut: false,
      sessionIdUsed: "test-session",
      assistantTexts: ["ok"],
      lastAssistant: {
        usage: { input: 10, output: 5, total: 15 },
        stopReason: "end_turn",
      },
    } as never);
  });

  it("emits stream=input event before run attempt when prompt and sessionKey are present", async () => {
    await runEmbeddedPiAgent({
      sessionId: "test-session",
      sessionKey: "agent:main:direct",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp/workspace",
      prompt: "hello world",
      timeoutMs: 30000,
      runId: "run-input-event",
    });

    expect(emitAgentEvent).toHaveBeenCalledWith({
      runId: "run-input-event",
      stream: "input",
      data: { prompt: "hello world" },
      sessionKey: "agent:main:direct",
    });

    const emitOrder = vi.mocked(emitAgentEvent).mock.invocationCallOrder[0] ?? 0;
    const attemptOrder = mockedRunEmbeddedAttempt.mock.invocationCallOrder[0] ?? 0;
    expect(emitOrder).toBeGreaterThan(0);
    expect(attemptOrder).toBeGreaterThan(0);
    expect(emitOrder).toBeLessThan(attemptOrder);
  });

  it("does not emit input event when sessionKey is missing", async () => {
    await runEmbeddedPiAgent({
      sessionId: "test-session",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp/workspace",
      prompt: "hello world",
      timeoutMs: 30000,
      runId: "run-no-session-key",
    });

    expect(emitAgentEvent).not.toHaveBeenCalled();
  });

  it("does not emit input event when prompt is empty", async () => {
    await runEmbeddedPiAgent({
      sessionId: "test-session",
      sessionKey: "agent:main:direct",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp/workspace",
      prompt: "",
      timeoutMs: 30000,
      runId: "run-empty-prompt",
    });

    expect(emitAgentEvent).not.toHaveBeenCalled();
  });
});
