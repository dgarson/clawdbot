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

  it.each(THINKING_TAG_CASES)(
    "streams <%s> reasoning via onReasoningStream without leaking into final text",
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
        reasoningMode: "stream",
      });

      handler?.({
        type: "message_update",
        message: { role: "assistant" },
        assistantMessageEvent: {
          type: "text_delta",
          delta: `${open}\nBecause`,
        },
      });

      handler?.({
        type: "message_update",
        message: { role: "assistant" },
        assistantMessageEvent: {
          type: "text_delta",
          delta: ` it helps\n${close}\n\nFinal answer`,
        },
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
      expect(blockReplies).toHaveLength(1);
      if (blockReplies[0].kind === "block_reply") {
        expect(blockReplies[0].text).toBe("Final answer");
      }

      // Reasoning events are pushed as thinking_delta -> emitted as "reasoning"
      const reasoningEvents = events.filter((e) => e.kind === "reasoning");
      const streamTexts = reasoningEvents
        .map((e) => (e.kind === "reasoning" ? e.text : undefined))
        .filter((value): value is string => typeof value === "string");
      expect(streamTexts.at(-1)).toBe("Reasoning:\n_Because it helps_");

      expect(assistantMessage.content).toEqual([
        { type: "thinking", thinking: "Because it helps" },
        { type: "text", text: "Final answer" },
      ]);

      unsub();
      mw.destroy();
    },
  );
  it.each(THINKING_TAG_CASES)(
    "suppresses <%s> blocks across chunk boundaries",
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
        blockReplyBreak: "text_end",
        blockReplyChunking: {
          minChars: 5,
          maxChars: 50,
          breakPreference: "newline",
        },
      });

      handler?.({ type: "message_start", message: { role: "assistant" } });

      handler?.({
        type: "message_update",
        message: { role: "assistant" },
        assistantMessageEvent: {
          type: "text_delta",
          delta: `${open}Reasoning chunk that should not leak`,
        },
      });

      const blockRepliesEarly = events.filter((e) => e.kind === "block_reply");
      expect(blockRepliesEarly).toHaveLength(0);

      handler?.({
        type: "message_update",
        message: { role: "assistant" },
        assistantMessageEvent: {
          type: "text_delta",
          delta: `${close}\n\nFinal answer`,
        },
      });

      handler?.({
        type: "message_update",
        message: { role: "assistant" },
        assistantMessageEvent: { type: "text_end" },
      });

      const blockReplies = events.filter((e) => e.kind === "block_reply");
      const payloadTexts = blockReplies
        .map((e) => (e.kind === "block_reply" ? e.text : undefined))
        .filter((value): value is string => typeof value === "string");
      expect(payloadTexts.length).toBeGreaterThan(0);
      for (const text of payloadTexts) {
        expect(text).not.toContain("Reasoning");
        expect(text).not.toContain(open);
      }
      const combined = payloadTexts.join(" ").replace(/\s+/g, " ").trim();
      expect(combined).toBe("Final answer");

      unsub();
      mw.destroy();
    },
  );

  it("emits delta chunks in agent events for streaming assistant text", () => {
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

    handler?.({ type: "message_start", message: { role: "assistant" } });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: { type: "text_delta", delta: "Hello" },
    });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: { type: "text_delta", delta: " world" },
    });

    const agentEvents = events.filter((e) => e.kind === "agent_event");
    const payloads = agentEvents
      .map((e) => (e.kind === "agent_event" ? (e.data as Record<string, unknown>) : undefined))
      .filter((value): value is Record<string, unknown> => Boolean(value));
    expect(payloads[0]?.text).toBe("Hello");
    expect(payloads[0]?.delta).toBe("Hello");
    expect(payloads[1]?.text).toBe("Hello world");
    expect(payloads[1]?.delta).toBe(" world");

    unsub();
    mw.destroy();
  });

  it("emits agent events on message_end for non-streaming assistant text", () => {
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

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello world" }],
    } as AssistantMessage;

    handler?.({ type: "message_start", message: assistantMessage });
    handler?.({ type: "message_end", message: assistantMessage });

    const agentEvents = events.filter((e) => e.kind === "agent_event");
    const payloads = agentEvents
      .map((e) => (e.kind === "agent_event" ? (e.data as Record<string, unknown>) : undefined))
      .filter((value): value is Record<string, unknown> => Boolean(value));
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.text).toBe("Hello world");
    expect(payloads[0]?.delta).toBe("Hello world");

    unsub();
    mw.destroy();
  });

  it("does not emit duplicate agent events when message_end repeats", () => {
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

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello world" }],
    } as AssistantMessage;

    handler?.({ type: "message_start", message: assistantMessage });
    handler?.({ type: "message_end", message: assistantMessage });
    handler?.({ type: "message_end", message: assistantMessage });

    const agentEvents = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "assistant",
    );
    const payloads = agentEvents
      .map((e) => (e.kind === "agent_event" ? (e.data as Record<string, unknown>) : undefined))
      .filter((value): value is Record<string, unknown> => Boolean(value));
    expect(payloads).toHaveLength(1);

    unsub();
    mw.destroy();
  });

  it("skips agent events when cleaned text rewinds mid-stream", () => {
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

    handler?.({ type: "message_start", message: { role: "assistant" } });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: { type: "text_delta", delta: "MEDIA:" },
    });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: { type: "text_delta", delta: " https://example.com/a.png\nCaption" },
    });

    const agentEvents = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "assistant",
    );
    const payloads = agentEvents
      .map((e) => (e.kind === "agent_event" ? (e.data as Record<string, unknown>) : undefined))
      .filter((value): value is Record<string, unknown> => Boolean(value));
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.text).toBe("MEDIA:");

    unsub();
    mw.destroy();
  });

  it("emits agent events when media arrives without text", () => {
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

    handler?.({ type: "message_start", message: { role: "assistant" } });
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: { type: "text_delta", delta: "MEDIA: https://example.com/a.png" },
    });

    const agentEvents = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "assistant",
    );
    const payloads = agentEvents
      .map((e) => (e.kind === "agent_event" ? (e.data as Record<string, unknown>) : undefined))
      .filter((value): value is Record<string, unknown> => Boolean(value));
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.text).toBe("");
    expect(payloads[0]?.mediaUrls).toEqual(["https://example.com/a.png"]);

    unsub();
    mw.destroy();
  });
});
