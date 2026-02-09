import { describe, expect, it, vi } from "vitest";
import type { ExecutionRequest } from "./types.js";
import { createExecutionRuntimeCallbackBridge } from "./runtime-callback-bridge.js";

function makeRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    agentId: "agent-test",
    sessionId: "session-test",
    workspaceDir: "/tmp/test",
    prompt: "hello",
    ...overrides,
  };
}

describe("createExecutionRuntimeCallbackBridge", () => {
  it("routes callback-only sinks", async () => {
    const onAssistantMessageStart = vi.fn();
    const onBlockReplyFlush = vi.fn();
    const onReasoningStream = vi.fn();
    const onToolResult = vi.fn();
    const onAgentEvent = vi.fn();

    const bridge = createExecutionRuntimeCallbackBridge({
      request: makeRequest({
        onAssistantMessageStart,
        onBlockReplyFlush,
        onReasoningStream,
        onToolResult,
        onAgentEvent,
      }),
      logger: { error: vi.fn() },
    });

    await bridge.onAssistantMessageStart();
    await bridge.onBlockReplyFlush();
    await bridge.onReasoningStream({ text: "Reasoning:\n_step_" });
    await bridge.onToolResult({ text: "tool output" });
    await bridge.onAgentEvent({ stream: "tool", data: { phase: "start", toolCallId: "t1" } });

    expect(onAssistantMessageStart).toHaveBeenCalledTimes(1);
    expect(onBlockReplyFlush).toHaveBeenCalledTimes(1);
    expect(onReasoningStream).toHaveBeenCalledWith({ text: "Reasoning:\n_step_" });
    expect(onToolResult).toHaveBeenCalledWith({ text: "tool output" });
    expect(onAgentEvent).toHaveBeenCalledWith({
      stream: "tool",
      data: { phase: "start", toolCallId: "t1" },
    });
  });

  it("swallows callback failures and logs them", async () => {
    const logger = { error: vi.fn() };
    const bridge = createExecutionRuntimeCallbackBridge({
      request: makeRequest({
        onAssistantMessageStart: vi.fn(async () => {
          throw new Error("assistant failed");
        }),
        onReasoningStream: vi.fn(() => {
          throw new Error("reasoning failed");
        }),
      }),
      logger,
    });

    await expect(bridge.onAssistantMessageStart()).resolves.toBeUndefined();
    await expect(bridge.onReasoningStream({ text: "x" })).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });

  it("is a no-op when callbacks are missing", async () => {
    const logger = { error: vi.fn() };
    const bridge = createExecutionRuntimeCallbackBridge({
      request: makeRequest(),
      logger,
    });

    await expect(bridge.onAssistantMessageStart()).resolves.toBeUndefined();
    await expect(bridge.onBlockReplyFlush()).resolves.toBeUndefined();
    await expect(bridge.onReasoningStream({ text: "x" })).resolves.toBeUndefined();
    await expect(bridge.onToolResult({ text: "y" })).resolves.toBeUndefined();
    await expect(bridge.onAgentEvent({ stream: "s", data: {} })).resolves.toBeUndefined();

    expect(logger.error).not.toHaveBeenCalled();
  });
});
