import node_fs from "node:fs";
import node_os from "node:os";
import node_path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlobWriter } from "./blob-writer.js";
import { registerCollector } from "./collector.js";
import type { TelemetryEvent, TelemetryEventKind } from "./types.js";

// ---------------------------------------------------------------------------
// Minimal mock for OpenClawPluginApi
// ---------------------------------------------------------------------------

type HookHandler = (...args: unknown[]) => unknown;

function makeApi(pluginConfig: Record<string, unknown> = {}): {
  api: Parameters<typeof registerCollector>[0];
  triggerHook: (name: string, event: unknown, ctx?: unknown) => unknown;
  capturedEvents: TelemetryEvent[];
} {
  const handlers = new Map<string, HookHandler>();
  const capturedEvents: TelemetryEvent[] = [];

  // Write function that stores the partial then fills in bookkeeping fields
  const write = vi.fn((partial: Partial<TelemetryEvent> & { kind: TelemetryEventKind }) => {
    capturedEvents.push({
      id: "evt_test",
      ts: Date.now(),
      seq: capturedEvents.length,
      agentId: partial.agentId ?? "unknown",
      sessionKey: partial.sessionKey ?? "unknown",
      sessionId: partial.sessionId ?? "unknown",
      runId: partial.runId,
      kind: partial.kind,
      stream: partial.stream,
      data: partial.data ?? {},
      error: partial.error,
      source: partial.source ?? "hook",
      hookName: partial.hookName,
      blobRefs: partial.blobRefs,
    });
  });

  const api = {
    id: "telemetry",
    name: "OpenClaw Telemetry",
    source: "workspace",
    config: {} as never,
    pluginConfig,
    runtime: {} as never,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    registerTool: vi.fn(),
    registerHook: vi.fn(),
    registerHttpHandler: vi.fn(),
    registerHttpRoute: vi.fn(),
    registerChannel: vi.fn(),
    registerGatewayMethod: vi.fn(),
    registerCli: vi.fn(),
    registerService: vi.fn(),
    registerProvider: vi.fn(),
    registerCommand: vi.fn(),
    resolvePath: (p: string) => p,
    on: vi.fn((hookName: string, handler: HookHandler) => {
      handlers.set(hookName, handler);
    }),
  } as unknown as Parameters<typeof registerCollector>[0];

  const triggerHook = (name: string, event: unknown, ctx: unknown = {}): unknown => {
    const handler = handlers.get(name);
    if (!handler) throw new Error(`No handler registered for hook: ${name}`);
    return handler(event, ctx);
  };

  return { api, triggerHook, capturedEvents };
}

describe("registerCollector — hook handlers", () => {
  let tmpDir: string;
  let blobWriter: BlobWriter;

  beforeEach(() => {
    tmpDir = node_fs.mkdtempSync(node_path.join(node_os.tmpdir(), "collector-test-"));
    blobWriter = new BlobWriter(tmpDir);
    blobWriter.ensureDir();
  });

  afterEach(() => {
    node_fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("session_start hook produces a session.start event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "session_start",
      { sessionId: "sid-1", resumedFrom: undefined },
      { sessionId: "sid-1", agentId: "a1" },
    );

    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0].kind).toBe("session.start");
    expect(capturedEvents[0].data.sessionId).toBe("sid-1");
    unsubscribe();
  });

  it("session_end hook produces a session.end event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "session_end",
      { sessionId: "sid-1", messageCount: 10, durationMs: 5000 },
      { sessionId: "sid-1", agentId: "a1" },
    );

    expect(capturedEvents[0].kind).toBe("session.end");
    expect(capturedEvents[0].data.messageCount).toBe(10);
    expect(capturedEvents[0].data.durationMs).toBe(5000);
    unsubscribe();
  });

  it("run_start hook produces a run.start event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "run_start",
      {
        runId: "run-1",
        sessionKey: "sk-1",
        sessionId: "sid-1",
        agentId: "a1",
        model: "claude-opus-4-6",
        provider: "anthropic",
        isHeartbeat: false,
        isFollowup: false,
        messageCount: 3,
        compactionCount: 0,
      },
      {},
    );

    const ev = capturedEvents[0];
    expect(ev.kind).toBe("run.start");
    expect(ev.runId).toBe("run-1");
    expect(ev.data.model).toBe("claude-opus-4-6");
    expect(ev.data.isHeartbeat).toBe(false);
    unsubscribe();
  });

  it("agent_end hook produces a run.end event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "agent_end",
      {
        messages: [],
        success: true,
        runId: "run-1",
        durationMs: 1200,
        toolCallCount: 3,
        stopReason: "end_turn",
      },
      { sessionKey: "sk-1", sessionId: "sid-1", agentId: "a1" },
    );

    const ev = capturedEvents[0];
    expect(ev.kind).toBe("run.end");
    expect(ev.runId).toBe("run-1");
    expect(ev.data.toolCallCount).toBe(3);
    expect(ev.data.stopReason).toBe("end_turn");
    unsubscribe();
  });

  it("agent_end with error includes error field", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "agent_end",
      { messages: [], success: false, error: "Something went wrong", runId: "run-2" },
      { sessionKey: "sk-2", sessionId: "sid-2", agentId: "a1" },
    );

    expect(capturedEvents[0].error?.message).toBe("Something went wrong");
    unsubscribe();
  });

  it("llm_input hook produces an llm.input event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "llm_input",
      {
        runId: "run-1",
        sessionId: "sid-1",
        provider: "anthropic",
        model: "claude-opus-4-6",
        prompt: "Hello",
        historyMessages: [],
        imagesCount: 0,
      },
      { sessionKey: "sk-1", agentId: "a1" },
    );

    expect(capturedEvents[0].kind).toBe("llm.input");
    expect(capturedEvents[0].data.provider).toBe("anthropic");
    expect(capturedEvents[0].data.model).toBe("claude-opus-4-6");
    unsubscribe();
  });

  it("llm_output hook produces an llm.output event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "llm_output",
      {
        runId: "run-1",
        sessionId: "sid-1",
        provider: "anthropic",
        model: "claude-opus-4-6",
        assistantTexts: ["Hi there!", " More text."],
        usage: { input: 100, output: 50, total: 150 },
        durationMs: 800,
        stopReason: "end_turn",
      },
      { sessionKey: "sk-1", agentId: "a1" },
    );

    const ev = capturedEvents[0];
    expect(ev.kind).toBe("llm.output");
    expect(ev.data.durationMs).toBe(800);
    expect(ev.data.assistantTextLength).toBe(20); // "Hi there!" (9) + " More text." (11) = 20
    unsubscribe();
  });

  it("after_tool_call hook produces a tool.end event with filePath metadata", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "after_tool_call",
      {
        toolName: "read",
        toolCallId: "tc-1",
        params: { file_path: "/src/index.ts" },
        result: "file contents here",
        durationMs: 12,
      },
      { runId: "run-1", sessionKey: "sk-1", agentId: "a1" },
    );

    const ev = capturedEvents[0];
    expect(ev.kind).toBe("tool.end");
    expect(ev.data.toolName).toBe("read");
    expect(ev.data.toolCallId).toBe("tc-1");
    expect(ev.data.filePath).toBe("/src/index.ts");
    expect(ev.data.durationMs).toBe(12);
    unsubscribe();
  });

  it("after_tool_call externalizes large results to blob", () => {
    const { api, triggerHook, capturedEvents } = makeApi({ blobThresholdBytes: 10 });
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    const largeResult = "x".repeat(100);
    triggerHook(
      "after_tool_call",
      {
        toolName: "bash",
        params: {},
        result: largeResult,
        durationMs: 5,
      },
      { runId: "run-1", sessionKey: "sk-1", agentId: "a1" },
    );

    const ev = capturedEvents[0];
    // Result should have been externalized
    expect(ev.blobRefs).toBeDefined();
    expect(ev.blobRefs!.length).toBeGreaterThan(0);
    expect(ev.data.result).toBeUndefined();
    unsubscribe();
  });

  it("message_received hook produces a message.inbound event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "message_received",
      { from: "+15551234567", content: "Hello bot!", timestamp: 1700000000 },
      { channelId: "telegram", accountId: "acc-1", conversationId: "chat-1" },
    );

    const ev = capturedEvents[0];
    expect(ev.kind).toBe("message.inbound");
    expect(ev.data.from).toBe("+15551234567");
    expect(ev.data.contentPreview).toBe("Hello bot!");
    expect(ev.data.channel).toBe("telegram");
    unsubscribe();
  });

  it("message_sent hook produces a message.outbound event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "message_sent",
      { to: "+15559999999", content: "Reply text", success: true },
      { channelId: "telegram" },
    );

    const ev = capturedEvents[0];
    expect(ev.kind).toBe("message.outbound");
    expect(ev.data.to).toBe("+15559999999");
    expect(ev.data.success).toBe(true);
    unsubscribe();
  });

  it("subagent_spawned hook produces a subagent.spawn event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "subagent_spawned",
      {
        runId: "run-1",
        childSessionKey: "child-sk",
        agentId: "child-agent",
        label: "worker",
        mode: "run",
        threadRequested: false,
      },
      { requesterSessionKey: "parent-sk" },
    );

    const ev = capturedEvents[0];
    expect(ev.kind).toBe("subagent.spawn");
    expect(ev.data.childSessionKey).toBe("child-sk");
    expect(ev.data.label).toBe("worker");
    unsubscribe();
  });

  it("subagent_ended hook produces a subagent.end event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "subagent_ended",
      {
        targetSessionKey: "child-sk",
        targetKind: "subagent",
        reason: "completed",
        outcome: "ok",
        runId: "run-1",
        endedAt: Date.now(),
        durationMs: 3000,
        entry: { task: "do work", label: "worker", model: "claude-opus-4-6" },
      },
      {},
    );

    const ev = capturedEvents[0];
    expect(ev.kind).toBe("subagent.end");
    expect(ev.data.outcome).toBe("ok");
    expect(ev.data.task).toBe("do work");
    unsubscribe();
  });

  it("before_compaction hook produces a compaction.start event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "before_compaction",
      { messageCount: 200, compactingCount: 150, tokenCount: 80000 },
      { sessionKey: "sk-1", agentId: "a1" },
    );

    expect(capturedEvents[0].kind).toBe("compaction.start");
    expect(capturedEvents[0].data.messageCount).toBe(200);
    unsubscribe();
  });

  it("after_compaction hook produces a compaction.end event", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "after_compaction",
      { messageCount: 200, compactedCount: 150 },
      { sessionKey: "sk-1", agentId: "a1" },
    );

    expect(capturedEvents[0].kind).toBe("compaction.end");
    expect(capturedEvents[0].data.compactedCount).toBe(150);
    unsubscribe();
  });

  it("subagent_stopping hook produces a subagent.stop event without blocking", () => {
    const { api, triggerHook, capturedEvents } = makeApi();
    const unsubscribe = registerCollector(api, (e) => capturedEvents.push(e as TelemetryEvent), blobWriter);

    triggerHook(
      "subagent_stopping",
      {
        runId: "run-1",
        childSessionKey: "child-sk",
        requesterSessionKey: "parent-sk",
        agentId: "a1",
        outcome: "ok",
        reason: "done",
        steerCount: 0,
        maxSteers: 3,
      },
      { runId: "run-1", childSessionKey: "child-sk", requesterSessionKey: "parent-sk", agentId: "a1" },
    );

    expect(capturedEvents[0].kind).toBe("subagent.stop");
    expect(capturedEvents[0].data.outcome).toBe("ok");
    unsubscribe();
  });
});
