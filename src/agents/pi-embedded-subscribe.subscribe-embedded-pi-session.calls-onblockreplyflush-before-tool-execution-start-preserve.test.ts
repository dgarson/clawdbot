import { describe, expect, it } from "vitest";
import { subscribeEmbeddedPiSession } from "./pi-embedded-subscribe.js";
import { StreamingMiddleware, type AgentStreamEvent } from "./stream/index.js";

type StubSession = {
  subscribe: (fn: (evt: unknown) => void) => () => void;
};

type SessionEventHandler = (evt: unknown) => void;

describe("subscribeEmbeddedPiSession", () => {
  const _THINKING_TAG_CASES = [
    { tag: "think", open: "<think>", close: "</think>" },
    { tag: "thinking", open: "<thinking>", close: "</thinking>" },
    { tag: "thought", open: "<thought>", close: "</thought>" },
    { tag: "antthinking", open: "<antthinking>", close: "</antthinking>" },
  ] as const;

  it("calls onBlockReplyFlush before tool_execution_start to preserve message boundaries", () => {
    let handler: SessionEventHandler | undefined;
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
      runId: "run-flush-test",
      streamMiddleware: mw,
      blockReplyBreak: "text_end",
    });

    // Simulate text arriving before tool
    handler?.({
      type: "message_start",
      message: { role: "assistant" },
    });

    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "First message before tool.",
      },
    });

    const flushBeforeTool = events.filter((e) => e.kind === "block_reply_flush");
    expect(flushBeforeTool).toHaveLength(0);

    // Tool execution starts - should trigger flush
    handler?.({
      type: "tool_execution_start",
      toolName: "bash",
      toolCallId: "tool-flush-1",
      args: { command: "echo hello" },
    });

    const flushAfterFirst = events.filter((e) => e.kind === "block_reply_flush");
    expect(flushAfterFirst).toHaveLength(1);

    // Another tool - should flush again
    handler?.({
      type: "tool_execution_start",
      toolName: "read",
      toolCallId: "tool-flush-2",
      args: { path: "/tmp/test.txt" },
    });

    const flushAfterSecond = events.filter((e) => e.kind === "block_reply_flush");
    expect(flushAfterSecond).toHaveLength(2);

    unsub();
    mw.destroy();
  });
  it("flushes buffered block chunks before tool execution", () => {
    let handler: SessionEventHandler | undefined;
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
      runId: "run-flush-buffer",
      streamMiddleware: mw,
      blockReplyBreak: "text_end",
      blockReplyChunking: { minChars: 50, maxChars: 200 },
    });

    handler?.({
      type: "message_start",
      message: { role: "assistant" },
    });

    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "Short chunk.",
      },
    });

    const blockRepliesBeforeTool = events.filter((e) => e.kind === "block_reply");
    expect(blockRepliesBeforeTool).toHaveLength(0);

    handler?.({
      type: "tool_execution_start",
      toolName: "bash",
      toolCallId: "tool-flush-buffer-1",
      args: { command: "echo flush" },
    });

    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies).toHaveLength(1);
    if (blockReplies[0].kind === "block_reply") {
      expect(blockReplies[0].text).toBe("Short chunk.");
    }
    const flushEvents = events.filter((e) => e.kind === "block_reply_flush");
    expect(flushEvents).toHaveLength(1);
    // block_reply must come before block_reply_flush
    const blockReplyIdx = events.findIndex((e) => e.kind === "block_reply");
    const flushIdx = events.findIndex((e) => e.kind === "block_reply_flush");
    expect(blockReplyIdx).toBeLessThan(flushIdx);

    unsub();
    mw.destroy();
  });
});
