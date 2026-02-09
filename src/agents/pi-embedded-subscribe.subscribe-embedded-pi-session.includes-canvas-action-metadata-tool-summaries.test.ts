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

  it("includes canvas action metadata in tool summaries", async () => {
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
      runId: "run-canvas-tool",
      verboseLevel: "on",
      streamMiddleware: mw,
    });

    handler?.({
      type: "tool_execution_start",
      toolName: "canvas",
      toolCallId: "tool-canvas-1",
      args: { action: "a2ui_push", jsonlPath: "/tmp/a2ui.jsonl" },
    });

    // Wait for async handler to complete
    await Promise.resolve();

    const toolEvents = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "tool_summary",
    );
    expect(toolEvents).toHaveLength(1);
    const payload = toolEvents[0];
    if (payload.kind === "agent_event") {
      const data = payload.data;
      const text = data.text as string;
      expect(text).toContain("Canvas");
      expect(text).toContain("A2UI push");
      expect(text).toContain("/tmp/a2ui.jsonl");
    }

    unsub();
    mw.destroy();
  });
  it("skips tool summaries when shouldEmitToolResult is false", () => {
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
      runId: "run-tool-off",
      shouldEmitToolResult: () => false,
      streamMiddleware: mw,
    });

    handler?.({
      type: "tool_execution_start",
      toolName: "read",
      toolCallId: "tool-2",
      args: { path: "/tmp/b.txt" },
    });

    const toolEvents = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "tool_summary",
    );
    expect(toolEvents).toHaveLength(0);

    unsub();
    mw.destroy();
  });
  it("emits tool summaries when shouldEmitToolResult overrides verbose", async () => {
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
      runId: "run-tool-override",
      verboseLevel: "off",
      shouldEmitToolResult: () => true,
      streamMiddleware: mw,
    });

    handler?.({
      type: "tool_execution_start",
      toolName: "read",
      toolCallId: "tool-3",
      args: { path: "/tmp/c.txt" },
    });

    // Wait for async handler to complete
    await Promise.resolve();

    const toolEvents = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "tool_summary",
    );
    expect(toolEvents).toHaveLength(1);

    unsub();
    mw.destroy();
  });
});
