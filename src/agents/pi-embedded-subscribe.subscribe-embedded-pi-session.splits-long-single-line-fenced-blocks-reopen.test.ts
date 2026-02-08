import type { AssistantMessage } from "@mariozechner/pi-ai";
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

  it("splits long single-line fenced blocks with reopen/close", () => {
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
        maxChars: 40,
        breakPreference: "paragraph",
      },
    });

    const text = `\`\`\`json\n${"x".repeat(120)}\n\`\`\``;

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
    expect(blockReplies.length).toBeGreaterThan(1);
    for (const reply of blockReplies) {
      if (reply.kind === "block_reply") {
        const chunk = reply.text;
        expect(chunk.startsWith("```json")).toBe(true);
        const fenceCount = chunk.match(/```/g)?.length ?? 0;
        expect(fenceCount).toBeGreaterThanOrEqual(2);
      }
    }

    unsub();
    mw.destroy();
  });
  it("waits for auto-compaction retry and clears buffered text", async () => {
    const listeners: SessionEventHandler[] = [];
    const session = {
      subscribe: (listener: SessionEventHandler) => {
        listeners.push(listener);
        return () => {
          const index = listeners.indexOf(listener);
          if (index !== -1) {
            listeners.splice(index, 1);
          }
        };
      },
    } as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"];

    const mw = new StreamingMiddleware({ reasoningLevel: "off" });
    const events: AgentStreamEvent[] = [];
    const unsub = mw.subscribe((e) => events.push(e));

    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: "run-1",
      streamMiddleware: mw,
    });

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "oops" }],
    } as AssistantMessage;

    for (const listener of listeners) {
      listener({ type: "message_end", message: assistantMessage });
    }

    expect(subscription.assistantTexts.length).toBe(1);

    for (const listener of listeners) {
      listener({
        type: "auto_compaction_end",
        willRetry: true,
      });
    }

    expect(subscription.isCompacting()).toBe(true);
    expect(subscription.assistantTexts.length).toBe(0);

    let resolved = false;
    const waitPromise = subscription.waitForCompactionRetry().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    for (const listener of listeners) {
      listener({ type: "agent_end" });
    }

    await waitPromise;
    expect(resolved).toBe(true);

    unsub();
    mw.destroy();
  });
  it("resolves after compaction ends without retry", async () => {
    const listeners: SessionEventHandler[] = [];
    const session = {
      subscribe: (listener: SessionEventHandler) => {
        listeners.push(listener);
        return () => {};
      },
    } as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"];

    const mw = new StreamingMiddleware({ reasoningLevel: "off" });
    const events: AgentStreamEvent[] = [];
    const unsub = mw.subscribe((e) => events.push(e));

    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: "run-2",
      streamMiddleware: mw,
    });

    for (const listener of listeners) {
      listener({ type: "auto_compaction_start" });
    }

    expect(subscription.isCompacting()).toBe(true);

    let resolved = false;
    const waitPromise = subscription.waitForCompactionRetry().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    for (const listener of listeners) {
      listener({ type: "auto_compaction_end", willRetry: false });
    }

    await waitPromise;
    expect(resolved).toBe(true);
    expect(subscription.isCompacting()).toBe(false);

    unsub();
    mw.destroy();
  });
});
