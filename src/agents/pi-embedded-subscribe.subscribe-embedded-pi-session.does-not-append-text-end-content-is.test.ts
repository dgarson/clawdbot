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

  it("does not append when text_end content is a prefix of deltas", () => {
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
        delta: "Hello world",
      },
    });

    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_end",
        content: "Hello",
      },
    });

    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies).toHaveLength(1);
    expect(subscription.assistantTexts).toEqual(["Hello world"]);

    unsub();
    mw.destroy();
  });
  it("does not append when text_end content is already contained", () => {
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
        delta: "Hello world",
      },
    });

    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_end",
        content: "world",
      },
    });

    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies).toHaveLength(1);
    expect(subscription.assistantTexts).toEqual(["Hello world"]);

    unsub();
    mw.destroy();
  });
  it("appends suffix when text_end content extends deltas", () => {
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
        delta: "Hello",
      },
    });

    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_end",
        content: "Hello world",
      },
    });

    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies).toHaveLength(1);
    expect(subscription.assistantTexts).toEqual(["Hello world"]);

    unsub();
    mw.destroy();
  });
});
