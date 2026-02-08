import { describe, expect, it } from "vitest";
import { onAgentEvent } from "../infra/agent-events.js";
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

  it("waits for multiple compaction retries before resolving", async () => {
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
      runId: "run-3",
      streamMiddleware: mw,
    });

    for (const listener of listeners) {
      listener({ type: "auto_compaction_end", willRetry: true });
      listener({ type: "auto_compaction_end", willRetry: true });
    }

    let resolved = false;
    const waitPromise = subscription.waitForCompactionRetry().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    for (const listener of listeners) {
      listener({ type: "agent_end" });
    }

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

  it("emits compaction events on the agent event bus", async () => {
    let handler: ((evt: unknown) => void) | undefined;
    const session: StubSession = {
      subscribe: (fn) => {
        handler = fn;
        return () => {};
      },
    };

    const busEvents: Array<{ phase: string; willRetry?: boolean }> = [];
    const stop = onAgentEvent((evt) => {
      if (evt.runId !== "run-compaction") {
        return;
      }
      if (evt.stream !== "compaction") {
        return;
      }
      const phase = typeof evt.data?.phase === "string" ? evt.data.phase : "";
      busEvents.push({
        phase,
        willRetry: typeof evt.data?.willRetry === "boolean" ? evt.data.willRetry : undefined,
      });
    });

    const mw = new StreamingMiddleware({ reasoningLevel: "off" });
    const events: AgentStreamEvent[] = [];
    const unsub = mw.subscribe((e) => events.push(e));

    subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run-compaction",
      streamMiddleware: mw,
    });

    handler?.({ type: "auto_compaction_start" });
    handler?.({ type: "auto_compaction_end", willRetry: true });
    handler?.({ type: "auto_compaction_end", willRetry: false });

    stop();

    expect(busEvents).toEqual([
      { phase: "start" },
      { phase: "end", willRetry: true },
      { phase: "end", willRetry: false },
    ]);

    unsub();
    mw.destroy();
  });
  it("emits tool summaries at tool start when verbose is on", async () => {
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
      runId: "run-tool",
      verboseLevel: "on",
      streamMiddleware: mw,
    });

    handler?.({
      type: "tool_execution_start",
      toolName: "read",
      toolCallId: "tool-1",
      args: { path: "/tmp/a.txt" },
    });

    // Wait for async handler to complete
    await Promise.resolve();

    const toolEvents = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "tool_summary",
    );
    expect(toolEvents).toHaveLength(1);
    const payload = toolEvents[0];
    if (payload.kind === "agent_event") {
      const data = payload.data as Record<string, unknown>;
      expect(data.text as string).toContain("/tmp/a.txt");
    }

    handler?.({
      type: "tool_execution_end",
      toolName: "read",
      toolCallId: "tool-1",
      isError: false,
      result: "ok",
    });

    // No additional tool summary events after tool_execution_end
    const toolEventsAfter = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "tool_summary",
    );
    expect(toolEventsAfter).toHaveLength(1);

    unsub();
    mw.destroy();
  });
  it("includes browser action metadata in tool summaries", async () => {
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
      runId: "run-browser-tool",
      verboseLevel: "on",
      streamMiddleware: mw,
    });

    handler?.({
      type: "tool_execution_start",
      toolName: "browser",
      toolCallId: "tool-browser-1",
      args: { action: "snapshot", targetUrl: "https://example.com" },
    });

    // Wait for async handler to complete
    await Promise.resolve();

    const toolEvents = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "tool_summary",
    );
    expect(toolEvents).toHaveLength(1);
    const payload = toolEvents[0];
    if (payload.kind === "agent_event") {
      const data = payload.data as Record<string, unknown>;
      const text = data.text as string;
      expect(text).toContain("Browser");
      expect(text).toContain("snapshot");
      expect(text).toContain("https://example.com");
    }

    unsub();
    mw.destroy();
  });

  it("emits exec output in full verbose mode and includes PTY indicator", async () => {
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
      runId: "run-exec-full",
      verboseLevel: "full",
      streamMiddleware: mw,
    });

    handler?.({
      type: "tool_execution_start",
      toolName: "exec",
      toolCallId: "tool-exec-1",
      args: { command: "claude", pty: true },
    });

    await Promise.resolve();

    const summaryEvents = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "tool_summary",
    );
    expect(summaryEvents).toHaveLength(1);
    if (summaryEvents[0].kind === "agent_event") {
      const data = summaryEvents[0].data as Record<string, unknown>;
      const text = data.text as string;
      expect(text).toContain("Exec");
      expect(text).toContain("pty");
    }

    handler?.({
      type: "tool_execution_end",
      toolName: "exec",
      toolCallId: "tool-exec-1",
      isError: false,
      result: { content: [{ type: "text", text: "hello\nworld" }] },
    });

    await Promise.resolve();

    const outputEvents = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "tool_output",
    );
    expect(outputEvents).toHaveLength(1);
    if (outputEvents[0].kind === "agent_event") {
      const data = outputEvents[0].data as Record<string, unknown>;
      const text = data.text as string;
      expect(text).toContain("hello");
      expect(text).toContain("```txt");
    }

    handler?.({
      type: "tool_execution_end",
      toolName: "read",
      toolCallId: "tool-read-1",
      isError: false,
      result: { content: [{ type: "text", text: "file data" }] },
    });

    await Promise.resolve();

    const outputEventsAfter = events.filter(
      (e) => e.kind === "agent_event" && (e as { stream: string }).stream === "tool_output",
    );
    expect(outputEventsAfter).toHaveLength(2);
    if (outputEventsAfter[1].kind === "agent_event") {
      const data = outputEventsAfter[1].data as Record<string, unknown>;
      const text = data.text as string;
      expect(text).toContain("file data");
    }

    unsub();
    mw.destroy();
  });
});
