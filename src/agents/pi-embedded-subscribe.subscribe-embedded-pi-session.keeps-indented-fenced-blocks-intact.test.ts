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

  it("keeps indented fenced blocks intact", () => {
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
      blockReplyChunking: {
        minChars: 5,
        maxChars: 30,
        breakPreference: "paragraph",
      },
    });

    const text = "Intro\n\n  ```js\n  const x = 1;\n  ```\n\nOutro";

    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: text,
      },
    });

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text }],
    } as AssistantMessage;

    handler?.({ type: "message_end", message: assistantMessage });

    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies).toHaveLength(3);
    if (blockReplies[1].kind === "block_reply") {
      expect(blockReplies[1].text).toBe("  ```js\n  const x = 1;\n  ```");
    }

    unsub();
    mw.destroy();
  });
  it("accepts longer fence markers for close", () => {
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
      blockReplyChunking: {
        minChars: 10,
        maxChars: 30,
        breakPreference: "paragraph",
      },
    });

    const text = "Intro\n\n````md\nline1\nline2\n````\n\nOutro";

    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: text,
      },
    });

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text }],
    } as AssistantMessage;

    handler?.({ type: "message_end", message: assistantMessage });

    const blockReplies = events.filter((e) => e.kind === "block_reply");
    const payloadTexts = blockReplies
      .map((e) => (e.kind === "block_reply" ? e.text : undefined))
      .filter((value): value is string => typeof value === "string");
    expect(payloadTexts.length).toBeGreaterThan(0);
    const combined = payloadTexts.join(" ").replace(/\s+/g, " ").trim();
    expect(combined).toContain("````md");
    expect(combined).toContain("line1");
    expect(combined).toContain("line2");
    expect(combined).toContain("````");
    expect(combined).toContain("Intro");
    expect(combined).toContain("Outro");

    unsub();
    mw.destroy();
  });
});
