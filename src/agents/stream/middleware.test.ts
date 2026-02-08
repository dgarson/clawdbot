import { describe, it, expect } from "vitest";
import type { AgentStreamEvent, RawStreamEvent, StreamMiddlewareConfig } from "./types.js";
import { TypedEventEmitter } from "./emitter.js";
import { StreamingMiddleware } from "./middleware.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMiddleware(config: StreamMiddlewareConfig = {}) {
  const mw = new StreamingMiddleware(config);
  const events: AgentStreamEvent[] = [];
  mw.subscribe((e) => events.push(e));
  return { mw, events };
}

function pushAll(mw: StreamingMiddleware, events: RawStreamEvent[]) {
  for (const e of events) {
    mw.push(e);
  }
}

// ---------------------------------------------------------------------------
// TypedEventEmitter
// ---------------------------------------------------------------------------

describe("TypedEventEmitter", () => {
  it("emits events to subscribers", () => {
    const emitter = new TypedEventEmitter<string>();
    const received: string[] = [];
    emitter.subscribe((e) => received.push(e));
    emitter.emit("hello");
    emitter.emit("world");
    expect(received).toEqual(["hello", "world"]);
  });

  it("unsubscribe stops delivery", () => {
    const emitter = new TypedEventEmitter<number>();
    const received: number[] = [];
    const unsub = emitter.subscribe((e) => received.push(e));
    emitter.emit(1);
    unsub();
    emitter.emit(2);
    expect(received).toEqual([1]);
  });

  it("swallows listener errors", () => {
    const emitter = new TypedEventEmitter<string>();
    const received: string[] = [];
    emitter.subscribe(() => {
      throw new Error("boom");
    });
    emitter.subscribe((e) => received.push(e));
    emitter.emit("ok");
    expect(received).toEqual(["ok"]);
  });

  it("reports listenerCount", () => {
    const emitter = new TypedEventEmitter<string>();
    expect(emitter.listenerCount).toBe(0);
    const unsub = emitter.subscribe(() => {});
    expect(emitter.listenerCount).toBe(1);
    unsub();
    expect(emitter.listenerCount).toBe(0);
  });

  it("removeAllListeners clears all", () => {
    const emitter = new TypedEventEmitter<string>();
    emitter.subscribe(() => {});
    emitter.subscribe(() => {});
    expect(emitter.listenerCount).toBe(2);
    emitter.removeAllListeners();
    expect(emitter.listenerCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Partial reply normalization
// ---------------------------------------------------------------------------

describe("StreamingMiddleware — partial replies", () => {
  it("emits partial_reply for plain text_delta", () => {
    const { mw, events } = createMiddleware();
    mw.push({ kind: "text_delta", text: "Hello world" });
    expect(events).toEqual([{ kind: "partial_reply", text: "Hello world" }]);
  });

  it("strips heartbeat token from text_delta", () => {
    const { mw, events } = createMiddleware({ isHeartbeat: false });
    mw.push({ kind: "text_delta", text: "HEARTBEAT_OK" });
    // heartbeat-only text should be skipped
    expect(events).toEqual([]);
  });

  it("does not strip heartbeat when isHeartbeat=true", () => {
    const { mw, events } = createMiddleware({ isHeartbeat: true });
    mw.push({ kind: "text_delta", text: "HEARTBEAT_OK and more" });
    // isHeartbeat means the heartbeat token is expected content
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe("partial_reply");
  });

  it("skips silent reply text", () => {
    const { mw, events } = createMiddleware();
    mw.push({ kind: "text_delta", text: "NO_REPLY" });
    expect(events).toEqual([]);
  });

  it("strips reasoning tags from partial text", () => {
    const { mw, events } = createMiddleware();
    mw.push({
      kind: "text_delta",
      text: "<thinking>internal thought</thinking>visible text",
    });
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe("partial_reply");
    expect((events[0] as { text: string }).text).toBe("visible text");
  });

  it("skips text that is all reasoning tags", () => {
    const { mw, events } = createMiddleware();
    mw.push({
      kind: "text_delta",
      text: "<thinking>only internal</thinking>",
    });
    expect(events).toEqual([]);
  });

  it("skips empty text", () => {
    const { mw, events } = createMiddleware();
    mw.push({ kind: "text_delta", text: "" });
    expect(events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Reasoning gating
// ---------------------------------------------------------------------------

describe("StreamingMiddleware — reasoning gating", () => {
  it("suppresses text_delta when reasoningLevel=stream", () => {
    const { mw, events } = createMiddleware({ reasoningLevel: "stream" });
    mw.push({ kind: "text_delta", text: "suppressed text" });
    expect(events).toEqual([]);
  });

  it("passes thinking_delta as reasoning event always", () => {
    const { mw, events } = createMiddleware({ reasoningLevel: "stream" });
    mw.push({ kind: "thinking_delta", text: "thinking out loud" });
    expect(events).toEqual([{ kind: "reasoning", text: "thinking out loud" }]);
  });

  it("passes thinking_delta even when reasoningLevel=off", () => {
    const { mw, events } = createMiddleware({ reasoningLevel: "off" });
    mw.push({ kind: "thinking_delta", text: "still passes" });
    expect(events).toEqual([{ kind: "reasoning", text: "still passes" }]);
  });

  it("allows text_delta when reasoningLevel=off", () => {
    const { mw, events } = createMiddleware({ reasoningLevel: "off" });
    mw.push({ kind: "text_delta", text: "allowed" });
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe("partial_reply");
  });

  it("allows text_delta when reasoningLevel=tags", () => {
    const { mw, events } = createMiddleware({ reasoningLevel: "tags" });
    mw.push({ kind: "text_delta", text: "allowed with tags" });
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe("partial_reply");
  });
});

// ---------------------------------------------------------------------------
// Block reply passthrough
// ---------------------------------------------------------------------------

describe("StreamingMiddleware — block replies", () => {
  it("passes block_reply regardless of reasoningLevel", () => {
    const { mw, events } = createMiddleware({ reasoningLevel: "stream" });
    mw.push({ kind: "block_reply", text: "important reply" });
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe("block_reply");
    expect((events[0] as { text: string }).text).toBe("important reply");
  });

  it("strips reasoning tags from block_reply text", () => {
    const { mw, events } = createMiddleware();
    mw.push({
      kind: "block_reply",
      text: "<thinking>hidden</thinking>visible block",
    });
    expect(events.length).toBe(1);
    expect((events[0] as { text: string }).text).toBe("visible block");
  });

  it("skips block_reply that is all reasoning tags", () => {
    const { mw, events } = createMiddleware();
    mw.push({
      kind: "block_reply",
      text: "<thinking>only thinking</thinking>",
    });
    expect(events).toEqual([]);
  });

  it("preserves block_reply metadata fields", () => {
    const { mw, events } = createMiddleware();
    mw.push({
      kind: "block_reply",
      text: "reply with metadata",
      mediaUrls: ["https://example.com/img.png"],
      replyToId: "msg-123",
      replyToTag: true,
      replyToCurrent: false,
      audioAsVoice: true,
    });
    expect(events.length).toBe(1);
    const evt = events[0] as AgentStreamEvent & { kind: "block_reply" };
    expect(evt.mediaUrls).toEqual(["https://example.com/img.png"]);
    expect(evt.replyToId).toBe("msg-123");
    expect(evt.replyToTag).toBe(true);
    expect(evt.replyToCurrent).toBe(false);
    expect(evt.audioAsVoice).toBe(true);
  });

  it("sets didStreamBlockReply in delivery state", () => {
    const { mw } = createMiddleware();
    expect(mw.getDeliveryState().didStreamBlockReply).toBe(false);
    mw.push({ kind: "block_reply", text: "a block" });
    expect(mw.getDeliveryState().didStreamBlockReply).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tool result passthrough
// ---------------------------------------------------------------------------

describe("StreamingMiddleware — tool results", () => {
  it("emits tool_end and tool_result for tool_end with text", () => {
    const { mw, events } = createMiddleware({ reasoningLevel: "stream" });
    mw.push({
      kind: "tool_end",
      name: "search",
      id: "call-1",
      text: "Found 3 results",
    });
    expect(events.length).toBe(2);
    expect(events[0]).toEqual({
      kind: "tool_end",
      name: "search",
      id: "call-1",
      isError: undefined,
    });
    expect(events[1]).toEqual({
      kind: "tool_result",
      name: "search",
      text: "Found 3 results",
      isError: undefined,
    });
  });

  it("emits only tool_end when no text", () => {
    const { mw, events } = createMiddleware();
    mw.push({ kind: "tool_end", name: "calc", id: "call-2" });
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe("tool_end");
  });

  it("strips reasoning tags from tool result text", () => {
    const { mw, events } = createMiddleware();
    mw.push({
      kind: "tool_end",
      name: "tool",
      id: "c-3",
      text: "<thinking>ignore</thinking>useful output",
    });
    const result = events.find((e) => e.kind === "tool_result") as {
      text: string;
    };
    expect(result.text).toBe("useful output");
  });

  it("passes tool_start through", () => {
    const { mw, events } = createMiddleware();
    mw.push({
      kind: "tool_start",
      name: "search",
      id: "call-1",
      args: { q: "test" },
    });
    expect(events).toEqual([{ kind: "tool_start", name: "search", id: "call-1" }]);
  });
});

// ---------------------------------------------------------------------------
// Block reply chunking
// ---------------------------------------------------------------------------

describe("StreamingMiddleware — block reply chunking", () => {
  it("accumulates text_delta into chunker and drains as block_reply", () => {
    const { mw, events } = createMiddleware({
      blockReplyBreak: "text_end",
      blockReplyChunking: { minChars: 5, maxChars: 50 },
    });
    // Push enough text to trigger a drain
    mw.push({ kind: "text_delta", text: "Hello, this is a test message." });
    // Force drain via message_end
    mw.push({ kind: "message_end" });
    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies.length).toBeGreaterThanOrEqual(1);
    const allText = blockReplies.map((e) => (e as { text: string }).text).join("");
    expect(allText).toContain("Hello");
  });

  it("force drains on block_reply_flush", () => {
    const { mw, events } = createMiddleware({
      blockReplyBreak: "text_end",
      blockReplyChunking: { minChars: 100, maxChars: 200 },
    });
    mw.push({ kind: "text_delta", text: "short text" });
    // Not enough for min, so nothing drained yet
    const beforeFlush = events.filter((e) => e.kind === "block_reply").length;
    mw.push({ kind: "block_reply_flush" });
    const afterFlush = events.filter((e) => e.kind === "block_reply").length;
    expect(afterFlush).toBeGreaterThan(beforeFlush);
  });

  it("drains chunker at message_start boundary", () => {
    const { mw, events } = createMiddleware({
      blockReplyBreak: "text_end",
      blockReplyChunking: { minChars: 100, maxChars: 200 },
    });
    mw.push({ kind: "text_delta", text: "buffered content" });
    mw.push({ kind: "message_start" });
    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies.length).toBe(1);
    expect((blockReplies[0] as { text: string }).text).toBe("buffered content");
  });
});

// ---------------------------------------------------------------------------
// Messaging tool dedup
// ---------------------------------------------------------------------------

describe("StreamingMiddleware — messaging tool dedup", () => {
  it("tracks messaging tool sent texts on success", () => {
    const { mw } = createMiddleware();
    mw.push({
      kind: "messaging_tool_start",
      toolName: "sessions_send",
      toolCallId: "tc-1",
      text: "Hello from tool",
      target: { tool: "sessions_send", provider: "telegram" },
    });
    mw.push({
      kind: "messaging_tool_end",
      toolName: "sessions_send",
      toolCallId: "tc-1",
      isError: false,
    });

    const state = mw.getDeliveryState();
    expect(state.didSendViaMessagingTool).toBe(true);
    expect(state.messagingToolSentTexts).toEqual(["Hello from tool"]);
    expect(state.messagingToolSentTargets).toEqual([
      { tool: "sessions_send", provider: "telegram" },
    ]);
    expect(state.messagingToolSentTextsNormalized.length).toBe(1);
  });

  it("discards pending on error", () => {
    const { mw } = createMiddleware();
    mw.push({
      kind: "messaging_tool_start",
      toolName: "sessions_send",
      toolCallId: "tc-2",
      text: "Will fail",
    });
    mw.push({
      kind: "messaging_tool_end",
      toolName: "sessions_send",
      toolCallId: "tc-2",
      isError: true,
    });

    const state = mw.getDeliveryState();
    expect(state.didSendViaMessagingTool).toBe(false);
    expect(state.messagingToolSentTexts).toEqual([]);
  });

  it("deduplicates block_reply against messaging-sent texts", () => {
    const { mw, events } = createMiddleware();
    // First, send via messaging tool
    mw.push({
      kind: "messaging_tool_start",
      toolName: "sessions_send",
      toolCallId: "tc-3",
      text: "This is a sufficiently long message that exceeds the minimum duplicate length threshold for dedup checking",
    });
    mw.push({
      kind: "messaging_tool_end",
      toolName: "sessions_send",
      toolCallId: "tc-3",
      isError: false,
    });

    // Now push same text as block_reply — should be deduped
    mw.push({
      kind: "block_reply",
      text: "This is a sufficiently long message that exceeds the minimum duplicate length threshold for dedup checking",
    });
    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Delivery receipt
// ---------------------------------------------------------------------------

describe("StreamingMiddleware — delivery receipt", () => {
  it("emits delivery_receipt on successful messaging_tool_end", () => {
    const { mw, events } = createMiddleware();
    mw.push({
      kind: "messaging_tool_start",
      toolName: "sessions_send",
      toolCallId: "tc-4",
      text: "Delivered text",
      target: { tool: "sessions_send", provider: "whatsapp" },
    });
    mw.push({
      kind: "messaging_tool_end",
      toolName: "sessions_send",
      toolCallId: "tc-4",
      isError: false,
    });

    const receipts = events.filter((e) => e.kind === "delivery_receipt");
    expect(receipts.length).toBe(1);
    const receipt = receipts[0] as AgentStreamEvent & {
      kind: "delivery_receipt";
    };
    expect(receipt.text).toBe("Delivered text");
    expect(receipt.target).toEqual({
      tool: "sessions_send",
      provider: "whatsapp",
    });
  });

  it("does not emit delivery_receipt on error", () => {
    const { mw, events } = createMiddleware();
    mw.push({
      kind: "messaging_tool_start",
      toolName: "sessions_send",
      toolCallId: "tc-5",
      text: "Will fail",
    });
    mw.push({
      kind: "messaging_tool_end",
      toolName: "sessions_send",
      toolCallId: "tc-5",
      isError: true,
    });

    const receipts = events.filter((e) => e.kind === "delivery_receipt");
    expect(receipts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Message boundary reset
// ---------------------------------------------------------------------------

describe("StreamingMiddleware — reset", () => {
  it("reset clears delivery state", () => {
    const { mw } = createMiddleware();
    mw.push({
      kind: "messaging_tool_start",
      toolName: "sessions_send",
      toolCallId: "tc-6",
      text: "sent",
    });
    mw.push({
      kind: "messaging_tool_end",
      toolName: "sessions_send",
      toolCallId: "tc-6",
      isError: false,
    });

    expect(mw.getDeliveryState().didSendViaMessagingTool).toBe(true);
    mw.reset();
    expect(mw.getDeliveryState().didSendViaMessagingTool).toBe(false);
    expect(mw.getDeliveryState().messagingToolSentTexts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DeliveryState correctness
// ---------------------------------------------------------------------------

describe("StreamingMiddleware — delivery state", () => {
  it("returns a snapshot (not a reference)", () => {
    const { mw } = createMiddleware();
    const state1 = mw.getDeliveryState();
    mw.push({ kind: "block_reply", text: "new block" });
    const state2 = mw.getDeliveryState();
    // state1 should not be mutated
    expect(state1.didStreamBlockReply).toBe(false);
    expect(state2.didStreamBlockReply).toBe(true);
  });

  it("accumulates across multiple messaging tool calls", () => {
    const { mw } = createMiddleware();

    pushAll(mw, [
      {
        kind: "messaging_tool_start",
        toolName: "sessions_send",
        toolCallId: "tc-a",
        text: "first message",
        target: { tool: "sessions_send", provider: "telegram" },
      },
      {
        kind: "messaging_tool_end",
        toolName: "sessions_send",
        toolCallId: "tc-a",
        isError: false,
      },
      {
        kind: "messaging_tool_start",
        toolName: "sessions_send",
        toolCallId: "tc-b",
        text: "second message",
        target: { tool: "sessions_send", provider: "discord" },
      },
      {
        kind: "messaging_tool_end",
        toolName: "sessions_send",
        toolCallId: "tc-b",
        isError: false,
      },
    ]);

    const state = mw.getDeliveryState();
    expect(state.messagingToolSentTexts).toEqual(["first message", "second message"]);
    expect(state.messagingToolSentTargets).toEqual([
      { tool: "sessions_send", provider: "telegram" },
      { tool: "sessions_send", provider: "discord" },
    ]);
    expect(state.messagingToolSentTextsNormalized.length).toBe(2);
    expect(state.didSendViaMessagingTool).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle & agent_event passthrough
// ---------------------------------------------------------------------------

describe("StreamingMiddleware — passthrough events", () => {
  it("passes lifecycle events through", () => {
    const { mw, events } = createMiddleware();
    mw.push({ kind: "lifecycle", phase: "start", data: { foo: "bar" } });
    expect(events).toEqual([{ kind: "lifecycle", phase: "start", data: { foo: "bar" } }]);
  });

  it("passes agent_event through", () => {
    const { mw, events } = createMiddleware();
    mw.push({
      kind: "agent_event",
      stream: "custom",
      data: { value: 42 },
    });
    expect(events).toEqual([{ kind: "agent_event", stream: "custom", data: { value: 42 } }]);
  });

  it("passes message_start and message_end through", () => {
    const { mw, events } = createMiddleware();
    mw.push({ kind: "message_start" });
    mw.push({ kind: "message_end" });
    expect(events.map((e) => e.kind)).toEqual(["message_start", "message_end"]);
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("StreamingMiddleware — destroy", () => {
  it("stops emitting after destroy", () => {
    const { mw, events } = createMiddleware();
    mw.push({ kind: "text_delta", text: "before" });
    expect(events.length).toBe(1);
    mw.destroy();
    mw.push({ kind: "text_delta", text: "after" });
    expect(events.length).toBe(1);
  });
});
