import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { subscribeEmbeddedPiSession } from "./pi-embedded-subscribe.js";
import { StreamingMiddleware, type AgentStreamEvent } from "./stream/index.js";

type StubSession = {
  subscribe: (fn: (evt: unknown) => void) => () => void;
};

describe("subscribeEmbeddedPiSession", () => {
  const THINKING_TAG_CASES = [
    { tag: "think", open: "<think>", close: "</think>" },
    { tag: "thinking", open: "<thinking>", close: "</thinking>" },
    { tag: "thought", open: "<thought>", close: "</thought>" },
    { tag: "antthinking", open: "<antthinking>", close: "</antthinking>" },
  ] as const;

  it("emits reasoning as a separate message when enabled", () => {
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
      reasoningMode: "on",
      // Must explicitly opt-in to emit reasoning via block reply (prevents leaking to channels)
      emitReasoningInBlockReply: true,
    });

    const assistantMessage = {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "Because it helps" },
        { type: "text", text: "Final answer" },
      ],
    } as AssistantMessage;

    handler?.({ type: "message_end", message: assistantMessage });

    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies).toHaveLength(2);
    if (blockReplies[0].kind === "block_reply") {
      expect(blockReplies[0].text).toBe("Reasoning:\n_Because it helps_");
    }
    if (blockReplies[1].kind === "block_reply") {
      expect(blockReplies[1].text).toBe("Final answer");
    }

    unsub();
    mw.destroy();
  });
  it.each(THINKING_TAG_CASES)(
    "promotes <%s> tags to thinking blocks at write-time",
    ({ open, close }) => {
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
        reasoningMode: "on",
        // Must explicitly opt-in to emit reasoning via block reply (prevents leaking to channels)
        emitReasoningInBlockReply: true,
      });

      const assistantMessage = {
        role: "assistant",
        content: [
          {
            type: "text",
            text: `${open}\nBecause it helps\n${close}\n\nFinal answer`,
          },
        ],
      } as AssistantMessage;

      handler?.({ type: "message_end", message: assistantMessage });

      const blockReplies = events.filter((e) => e.kind === "block_reply");
      expect(blockReplies).toHaveLength(2);
      if (blockReplies[0].kind === "block_reply") {
        expect(blockReplies[0].text).toBe("Reasoning:\n_Because it helps_");
      }
      if (blockReplies[1].kind === "block_reply") {
        expect(blockReplies[1].text).toBe("Final answer");
      }

      expect(assistantMessage.content).toEqual([
        { type: "thinking", thinking: "Because it helps" },
        { type: "text", text: "Final answer" },
      ]);

      unsub();
      mw.destroy();
    },
  );
});
