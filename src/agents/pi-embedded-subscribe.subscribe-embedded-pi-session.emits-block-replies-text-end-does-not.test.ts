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

  it("emits block replies on text_end and does not duplicate on message_end", () => {
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

    const subscription = subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run",
      streamMiddleware: mw,
      blockReplyBreak: "text_end",
    });

    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "Hello block",
      },
    });

    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_end",
      },
    });

    const blockRepliesAfterTextEnd = events.filter((e) => e.kind === "block_reply");
    expect(blockRepliesAfterTextEnd).toHaveLength(1);
    if (blockRepliesAfterTextEnd[0].kind === "block_reply") {
      expect(blockRepliesAfterTextEnd[0].text).toBe("Hello block");
    }
    expect(subscription.assistantTexts).toEqual(["Hello block"]);

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello block" }],
    } as AssistantMessage;

    handler?.({ type: "message_end", message: assistantMessage });

    const blockRepliesAfterMessageEnd = events.filter((e) => e.kind === "block_reply");
    expect(blockRepliesAfterMessageEnd).toHaveLength(1);
    expect(subscription.assistantTexts).toEqual(["Hello block"]);

    unsub();
    mw.destroy();
  });
  it("does not duplicate when message_end flushes and a late text_end arrives", () => {
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

    const subscription = subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run",
      streamMiddleware: mw,
      blockReplyBreak: "text_end",
    });

    handler?.({ type: "message_start", message: { role: "assistant" } });

    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "Hello block",
      },
    });

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello block" }],
    } as AssistantMessage;

    // Simulate a provider that ends the message without emitting text_end.
    handler?.({ type: "message_end", message: assistantMessage });

    const blockRepliesAfterEnd = events.filter((e) => e.kind === "block_reply");
    expect(blockRepliesAfterEnd).toHaveLength(1);
    expect(subscription.assistantTexts).toEqual(["Hello block"]);

    // Some providers can still emit a late text_end; this must not re-emit.
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_end",
        content: "Hello block",
      },
    });

    const blockRepliesAfterLate = events.filter((e) => e.kind === "block_reply");
    expect(blockRepliesAfterLate).toHaveLength(1);
    expect(subscription.assistantTexts).toEqual(["Hello block"]);

    unsub();
    mw.destroy();
  });
});
