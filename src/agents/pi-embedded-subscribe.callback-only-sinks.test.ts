import { describe, expect, it, vi } from "vitest";
import { subscribeEmbeddedPiSession } from "./pi-embedded-subscribe.js";

type StubSession = {
  subscribe: (fn: (evt: unknown) => void) => () => void;
};

describe("subscribeEmbeddedPiSession callback-only sinks", () => {
  it("emits callback sinks without stream middleware", async () => {
    let handler: ((evt: unknown) => void) | undefined;
    const session: StubSession = {
      subscribe: (fn) => {
        handler = fn;
        return () => {};
      },
    };

    const onBlockReply = vi.fn();
    const onReasoningStream = vi.fn();
    const onToolResult = vi.fn();
    const onBlockReplyFlush = vi.fn();

    subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run-callback-only",
      reasoningMode: "stream",
      blockReplyBreak: "text_end",
      verboseLevel: "full",
      onBlockReply,
      onReasoningStream,
      onToolResult,
      onBlockReplyFlush,
    });

    handler?.({ type: "message_start", message: { role: "assistant" } });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "<think>Because</think>\nFinal answer",
      },
    });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_end",
      },
    });
    handler?.({
      type: "tool_execution_start",
      toolName: "bash",
      toolCallId: "tool-1",
      args: { command: "echo hello" },
    });
    handler?.({
      type: "tool_execution_end",
      toolName: "bash",
      toolCallId: "tool-1",
      isError: false,
      result: "hello",
    });

    await Promise.resolve();

    expect(onBlockReply).toHaveBeenCalled();
    expect(onReasoningStream).toHaveBeenCalled();
    expect(onToolResult).toHaveBeenCalled();
    expect(onBlockReplyFlush).toHaveBeenCalled();
  });

  it("does not treat assistant events as tool result callbacks", async () => {
    let handler: ((evt: unknown) => void) | undefined;
    const session: StubSession = {
      subscribe: (fn) => {
        handler = fn;
        return () => {};
      },
    };

    const onToolResult = vi.fn();

    subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run-callback-only-negative",
      onToolResult,
    });

    handler?.({ type: "message_start", message: { role: "assistant" } });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "regular assistant text",
      },
    });
    handler?.({
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "regular assistant text" }],
      },
    });

    await Promise.resolve();

    expect(onToolResult).not.toHaveBeenCalled();
  });
});
