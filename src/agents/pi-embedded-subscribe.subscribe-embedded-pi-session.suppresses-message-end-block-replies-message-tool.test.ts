import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { subscribeEmbeddedPiSession } from "./pi-embedded-subscribe.js";
import { StreamingMiddleware, type AgentStreamEvent } from "./stream/index.js";

type StubSession = {
  subscribe: (fn: (evt: unknown) => void) => () => void;
};

describe("subscribeEmbeddedPiSession", () => {
  const _THINKING_TAG_CASES = [
    { tag: "think", open: "<think>", close: "</think>" },
    { tag: "thinking", open: "<thinking>", close: "</thinking>" },
    { tag: "thought", open: "<thought>", close: "</thought>" },
    { tag: "antthinking", open: "<antthinking>", close: "</antthinking>" },
  ] as const;

  it("suppresses message_end block replies when the message tool already sent", async () => {
    let handler: ((evt: unknown) => void) | undefined;
    const session: StubSession = {
      subscribe: (fn) => {
        handler = fn;
        return () => {};
      },
    };

    const mw = new StreamingMiddleware({ reasoningLevel: "off" });
    const events: AgentStreamEvent[] = [];
    const unsub = mw.subscribe((e) => events.push(e));

    subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run",
      streamMiddleware: mw,
      blockReplyBreak: "message_end",
    });

    const messageText = "This is the answer.";

    handler?.({
      type: "tool_execution_start",
      toolName: "message",
      toolCallId: "tool-message-1",
      args: { action: "send", to: "+1555", message: messageText },
    });

    // Wait for async handler to complete
    await Promise.resolve();

    handler?.({
      type: "tool_execution_end",
      toolName: "message",
      toolCallId: "tool-message-1",
      isError: false,
      result: "ok",
    });

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: messageText }],
    } as AssistantMessage;

    handler?.({ type: "message_end", message: assistantMessage });

    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies).toHaveLength(0);

    unsub();
    mw.destroy();
  });
  it("does not suppress message_end replies when message tool reports error", async () => {
    let handler: ((evt: unknown) => void) | undefined;
    const session: StubSession = {
      subscribe: (fn) => {
        handler = fn;
        return () => {};
      },
    };

    const mw = new StreamingMiddleware({ reasoningLevel: "off" });
    const events: AgentStreamEvent[] = [];
    const unsub = mw.subscribe((e) => events.push(e));

    subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run",
      streamMiddleware: mw,
      blockReplyBreak: "message_end",
    });

    const messageText = "Please retry the send.";

    handler?.({
      type: "tool_execution_start",
      toolName: "message",
      toolCallId: "tool-message-err",
      args: { action: "send", to: "+1555", message: messageText },
    });

    // Wait for async handler to complete
    await Promise.resolve();

    handler?.({
      type: "tool_execution_end",
      toolName: "message",
      toolCallId: "tool-message-err",
      isError: false,
      result: { details: { status: "error" } },
    });

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: messageText }],
    } as AssistantMessage;

    handler?.({ type: "message_end", message: assistantMessage });

    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies).toHaveLength(1);

    unsub();
    mw.destroy();
  });
  it("clears block reply state on message_start", () => {
    let handler: ((evt: unknown) => void) | undefined;
    const session: StubSession = {
      subscribe: (fn) => {
        handler = fn;
        return () => {};
      },
    };

    const mw = new StreamingMiddleware({ reasoningLevel: "off" });
    const events: AgentStreamEvent[] = [];
    const unsub = mw.subscribe((e) => events.push(e));

    subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run",
      streamMiddleware: mw,
      blockReplyBreak: "text_end",
    });

    handler?.({ type: "message_start", message: { role: "assistant" } });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: { type: "text_delta", delta: "OK" },
    });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: { type: "text_end" },
    });
    const blockReplies1 = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies1).toHaveLength(1);

    // New assistant message with identical output should still emit.
    handler?.({ type: "message_start", message: { role: "assistant" } });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: { type: "text_delta", delta: "OK" },
    });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: { type: "text_end" },
    });
    const blockReplies2 = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies2).toHaveLength(2);

    unsub();
    mw.destroy();
  });
});
