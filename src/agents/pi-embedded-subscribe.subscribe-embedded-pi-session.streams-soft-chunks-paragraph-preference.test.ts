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

  it("streams soft chunks with paragraph preference", () => {
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
      blockReplyBreak: "message_end",
      blockReplyChunking: {
        minChars: 5,
        maxChars: 25,
        breakPreference: "paragraph",
      },
    });

    const text = "First block line\n\nSecond block line";

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
    expect(blockReplies).toHaveLength(2);
    if (blockReplies[0].kind === "block_reply") {
      expect(blockReplies[0].text).toBe("First block line");
    }
    if (blockReplies[1].kind === "block_reply") {
      expect(blockReplies[1].text).toBe("Second block line");
    }
    expect(subscription.assistantTexts).toEqual(["First block line", "Second block line"]);

    unsub();
    mw.destroy();
  });
  it("avoids splitting inside fenced code blocks", () => {
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
        maxChars: 25,
        breakPreference: "paragraph",
      },
    });

    const text = "Intro\n\n```bash\nline1\nline2\n```\n\nOutro";

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
    if (blockReplies[0].kind === "block_reply") {
      expect(blockReplies[0].text).toBe("Intro");
    }
    if (blockReplies[1].kind === "block_reply") {
      expect(blockReplies[1].text).toBe("```bash\nline1\nline2\n```");
    }
    if (blockReplies[2].kind === "block_reply") {
      expect(blockReplies[2].text).toBe("Outro");
    }

    unsub();
    mw.destroy();
  });
});
