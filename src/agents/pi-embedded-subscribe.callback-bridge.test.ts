import { describe, expect, it, vi } from "vitest";
import type { SubscribeEmbeddedPiSessionParams } from "./pi-embedded-subscribe.types.js";
import { createEmbeddedPiLegacyCallbackBridge } from "./pi-embedded-subscribe.callback-bridge.js";

function makeParams(
  overrides: Partial<SubscribeEmbeddedPiSessionParams> = {},
): SubscribeEmbeddedPiSessionParams {
  return {
    session: {
      subscribe: () => () => {},
    } as unknown as SubscribeEmbeddedPiSessionParams["session"],
    runId: "run-test",
    ...overrides,
  };
}

describe("createEmbeddedPiLegacyCallbackBridge", () => {
  it("routes callback-only sinks without stream middleware", () => {
    const onAssistantMessageStart = vi.fn();
    const onPartialReply = vi.fn();
    const onReasoningStream = vi.fn();
    const onBlockReply = vi.fn();
    const onBlockReplyFlush = vi.fn();
    const onAgentEvent = vi.fn();
    const onToolResult = vi.fn();

    const logger = { debug: vi.fn() };
    const bridge = createEmbeddedPiLegacyCallbackBridge(
      makeParams({
        onAssistantMessageStart,
        onPartialReply,
        onReasoningStream,
        onBlockReply,
        onBlockReplyFlush,
        onAgentEvent,
        onToolResult,
      }),
      logger,
    );

    bridge.emitRawStreamEvent({ kind: "message_start" });
    bridge.emitRawStreamEvent({ kind: "text_delta", text: "partial" });
    bridge.emitRawStreamEvent({ kind: "thinking_delta", text: "Reasoning:\n_test_" });
    bridge.emitRawStreamEvent({ kind: "block_reply", text: "block text" });
    bridge.emitRawStreamEvent({ kind: "block_reply_flush" });
    bridge.emitRawStreamEvent({
      kind: "agent_event",
      stream: "assistant",
      data: { text: "assistant", delta: "assistant" },
    });
    bridge.emitRawStreamEvent({
      kind: "agent_event",
      stream: "tool_summary",
      data: { text: "tool event" },
    });
    bridge.emitRawStreamEvent({ kind: "lifecycle", phase: "start", data: { phase: "start" } });

    expect(onAssistantMessageStart).toHaveBeenCalledTimes(1);
    expect(onPartialReply).toHaveBeenCalledWith({ text: "partial" });
    expect(onReasoningStream).toHaveBeenCalledWith({ text: "Reasoning:\n_test_" });
    expect(onBlockReply).toHaveBeenCalledWith({ text: "block text", mediaUrls: undefined });
    expect(onBlockReplyFlush).toHaveBeenCalledTimes(1);
    expect(onAgentEvent).toHaveBeenCalledWith({
      stream: "assistant",
      data: { text: "assistant", delta: "assistant" },
    });
    expect(onAgentEvent).toHaveBeenCalledWith({
      stream: "lifecycle",
      data: { phase: "start" },
    });
    expect(onToolResult).toHaveBeenCalledWith({ text: "tool event", mediaUrls: undefined });
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it("does not emit onToolResult for non-tool streams or empty tool payloads", () => {
    const onToolResult = vi.fn();
    const bridge = createEmbeddedPiLegacyCallbackBridge(
      makeParams({
        onToolResult,
      }),
      { debug: vi.fn() },
    );

    bridge.emitRawStreamEvent({
      kind: "agent_event",
      stream: "assistant",
      data: { text: "hello" },
    });
    bridge.emitRawStreamEvent({
      kind: "agent_event",
      stream: "tool_summary",
      data: {},
    });

    expect(onToolResult).not.toHaveBeenCalled();
  });

  it("swallows callback failures and still forwards to middleware", async () => {
    const push = vi.fn();
    const onBlockReply = vi.fn(async () => {
      throw new Error("block failed");
    });
    const onAgentEvent = vi.fn(() => {
      throw new Error("agent failed");
    });
    const logger = { debug: vi.fn() };

    const bridge = createEmbeddedPiLegacyCallbackBridge(
      makeParams({
        streamMiddleware: {
          push,
        } as unknown as SubscribeEmbeddedPiSessionParams["streamMiddleware"],
        onBlockReply,
        onAgentEvent,
      }),
      logger,
    );

    expect(() =>
      bridge.emitRawStreamEvent({ kind: "block_reply", text: "payload", mediaUrls: ["https://x"] }),
    ).not.toThrow();
    expect(() =>
      bridge.emitRawStreamEvent({
        kind: "agent_event",
        stream: "assistant",
        data: { text: "ok" },
      }),
    ).not.toThrow();

    await Promise.resolve();

    expect(push).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalled();
  });
});
