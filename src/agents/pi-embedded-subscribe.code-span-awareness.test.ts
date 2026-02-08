import { describe, expect, it } from "vitest";
import { subscribeEmbeddedPiSession } from "./pi-embedded-subscribe.js";
import { StreamingMiddleware, type AgentStreamEvent } from "./stream/index.js";

type StubSession = {
  subscribe: (fn: (evt: unknown) => void) => () => void;
};

describe("subscribeEmbeddedPiSession thinking tag code span awareness", () => {
  it("does not strip thinking tags inside inline code backticks", () => {
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
        delta: "The fix strips leaked `<thinking>` tags from messages.",
      },
    });

    const partialReplies = events.filter((e) => e.kind === "partial_reply");
    expect(partialReplies.length).toBeGreaterThan(0);
    const lastPartial = partialReplies[partialReplies.length - 1];
    expect(lastPartial.kind === "partial_reply" && lastPartial.text).toContain("`<thinking>`");

    unsub();
    mw.destroy();
  });

  it("does not strip thinking tags inside fenced code blocks", () => {
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
        delta: "Example:\n  ````\n<thinking>code example</thinking>\n  ````\nDone.",
      },
    });

    const partialReplies = events.filter((e) => e.kind === "partial_reply");
    expect(partialReplies.length).toBeGreaterThan(0);
    const lastPartial = partialReplies[partialReplies.length - 1];
    expect(lastPartial.kind === "partial_reply" && lastPartial.text).toContain(
      "<thinking>code example</thinking>",
    );

    unsub();
    mw.destroy();
  });

  it("still strips actual thinking tags outside code spans", () => {
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
        delta: "Hello <thinking>internal thought</thinking> world",
      },
    });

    const partialReplies = events.filter((e) => e.kind === "partial_reply");
    expect(partialReplies.length).toBeGreaterThan(0);
    const lastPartial = partialReplies[partialReplies.length - 1];
    if (lastPartial.kind === "partial_reply") {
      expect(lastPartial.text).not.toContain("internal thought");
      expect(lastPartial.text).toContain("Hello");
      expect(lastPartial.text).toContain("world");
    }

    unsub();
    mw.destroy();
  });
});
