import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { subscribeEmbeddedPiSession } from "./pi-embedded-subscribe.js";
import { StreamingMiddleware, type AgentStreamEvent } from "./stream/index.js";

type StubSession = {
  subscribe: (fn: (evt: unknown) => void) => () => void;
};

describe("subscribeEmbeddedPiSession middleware sink resilience", () => {
  it("emits middleware block_reply when onBlockReply callback throws", () => {
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
    const onBlockReply = vi.fn(() => {
      throw new Error("callback failed");
    });

    subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run-block-reply-throw",
      streamMiddleware: mw,
      blockReplyBreak: "message_end",
      onBlockReply,
    });

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello middleware" }],
    } as AssistantMessage;

    handler?.({ type: "message_end", message: assistantMessage });

    const blockReplies = events.filter((e) => e.kind === "block_reply");
    expect(blockReplies).toHaveLength(1);
    if (blockReplies[0].kind === "block_reply") {
      expect(blockReplies[0].text).toBe("Hello middleware");
    }
    expect(onBlockReply).toHaveBeenCalledTimes(1);

    unsub();
    mw.destroy();
  });

  it("emits middleware tool summary and output when onToolResult callback throws", async () => {
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
    const onToolResult = vi.fn(() => {
      throw new Error("tool callback failed");
    });

    subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run-tool-throw",
      verboseLevel: "full",
      streamMiddleware: mw,
      onToolResult,
    });

    handler?.({
      type: "tool_execution_start",
      toolName: "read",
      toolCallId: "tool-1",
      args: { path: "/tmp/a.txt" },
    });
    await Promise.resolve();

    handler?.({
      type: "tool_execution_end",
      toolName: "read",
      toolCallId: "tool-1",
      isError: false,
      result: { content: [{ type: "text", text: "ok" }] },
    });
    await Promise.resolve();

    const toolSummary = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "tool_summary",
    );
    const toolOutput = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "tool_output",
    );

    expect(toolSummary).toHaveLength(1);
    expect(toolOutput).toHaveLength(1);
    expect(onToolResult).toHaveBeenCalledTimes(2);

    unsub();
    mw.destroy();
  });
});
