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

  it("filters to <final> and suppresses output without a start tag", () => {
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
      enforceFinalTag: true,
      streamMiddleware: mw,
    });

    handler?.({ type: "message_start", message: { role: "assistant" } });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "<final>Hi there</final>",
      },
    });

    const partialReplies = events.filter((e) => e.kind === "partial_reply");
    expect(partialReplies.length).toBeGreaterThan(0);
    const firstPayload = partialReplies[0];
    if (firstPayload.kind === "partial_reply") {
      expect(firstPayload.text).toBe("Hi there");
    }

    // Clear events for next part of the test
    events.length = 0;

    handler?.({ type: "message_start", message: { role: "assistant" } });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "</final>Oops no start",
      },
    });

    const partialReplies2 = events.filter((e) => e.kind === "partial_reply");
    expect(partialReplies2).toHaveLength(0);

    unsub();
    mw.destroy();
  });
  it("emits agent events on message_end even without <final> tags", () => {
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
      enforceFinalTag: true,
      streamMiddleware: mw,
    });

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello world" }],
    } as AssistantMessage;

    handler?.({ type: "message_start", message: assistantMessage });
    handler?.({ type: "message_end", message: assistantMessage });

    const agentEvents = events.filter((e) => e.kind === "agent_event");
    const payloads = agentEvents
      .map((e) => (e.kind === "agent_event" ? e.data : undefined))
      .filter((value): value is Record<string, unknown> => Boolean(value));
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.text).toBe("Hello world");
    expect(payloads[0]?.delta).toBe("Hello world");

    unsub();
    mw.destroy();
  });
  it("does not require <final> when enforcement is off", () => {
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
    });

    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "Hello world",
      },
    });

    const partialReplies = events.filter((e) => e.kind === "partial_reply");
    expect(partialReplies.length).toBeGreaterThan(0);
    if (partialReplies[0].kind === "partial_reply") {
      expect(partialReplies[0].text).toBe("Hello world");
    }

    unsub();
    mw.destroy();
  });
  it("emits block replies on message_end", () => {
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

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello block" }],
    } as AssistantMessage;

    handler?.({ type: "message_end", message: assistantMessage });

    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies.length).toBeGreaterThan(0);
    if (blockReplies[0].kind === "block_reply") {
      expect(blockReplies[0].text).toBe("Hello block");
    }

    unsub();
    mw.destroy();
  });
});
