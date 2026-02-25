import { describe, expect, test, vi, beforeEach } from "vitest";
import { truncateString, truncatePayload, shouldCapture, registerCollector } from "./collector.js";
import type { EventLedgerConfig } from "./config.js";
import { DEFAULT_CONFIG } from "./config.js";
import type { EventEnvelope, EventFamily } from "./types.js";

// ---------------------------------------------------------------------------
// Unit tests for exported helpers
// ---------------------------------------------------------------------------

describe("truncateString", () => {
  test("returns original string when within byte limit", () => {
    expect(truncateString("hello", 10)).toBe("hello");
  });

  test("returns original string when exactly at byte limit", () => {
    expect(truncateString("abc", 3)).toBe("abc");
  });

  test("truncates string that exceeds byte limit", () => {
    const result = truncateString("hello world", 5);
    expect(Buffer.byteLength(result, "utf-8")).toBeLessThanOrEqual(5);
    expect(result).toBe("hello");
  });

  test("handles multi-byte UTF-8 characters safely", () => {
    // Each emoji is 4 bytes in UTF-8
    const emoji = "\u{1F600}\u{1F601}\u{1F602}"; // 12 bytes total
    const result = truncateString(emoji, 8);
    // Should include at most 2 emojis (8 bytes)
    expect(Buffer.byteLength(result, "utf-8")).toBeLessThanOrEqual(8);
    expect(result.length).toBeLessThanOrEqual(emoji.length);
  });

  test("returns empty string when maxBytes is 0", () => {
    expect(truncateString("hello", 0)).toBe("");
  });
});

describe("truncatePayload", () => {
  test("truncates long string fields", () => {
    const data = { message: "a".repeat(200), count: 42 };
    const result = truncatePayload(data, 10);
    expect(typeof result.message).toBe("string");
    expect(Buffer.byteLength(result.message as string, "utf-8")).toBeLessThanOrEqual(10);
    // Non-string fields are preserved as-is
    expect(result.count).toBe(42);
  });

  test("preserves short string fields", () => {
    const data = { name: "ok", value: 1 };
    const result = truncatePayload(data, 100);
    expect(result.name).toBe("ok");
  });

  test("preserves non-string fields untouched", () => {
    const nested = { a: 1 };
    const data = { obj: nested, arr: [1, 2], bool: true, nil: null };
    const result = truncatePayload(data, 10);
    expect(result.obj).toBe(nested);
    expect(result.arr).toEqual([1, 2]);
    expect(result.bool).toBe(true);
    expect(result.nil).toBeNull();
  });
});

describe("shouldCapture", () => {
  test("captures all families when both lists are empty", () => {
    expect(shouldCapture("model", [], [])).toBe(true);
    expect(shouldCapture("tool", [], [])).toBe(true);
    expect(shouldCapture("system", [], [])).toBe(true);
  });

  test("only captures families in the include list", () => {
    const include: EventFamily[] = ["model", "tool"];
    expect(shouldCapture("model", include, [])).toBe(true);
    expect(shouldCapture("tool", include, [])).toBe(true);
    expect(shouldCapture("session", include, [])).toBe(false);
  });

  test("excludes families in the exclude list", () => {
    const exclude: EventFamily[] = ["budget"];
    expect(shouldCapture("budget", [], exclude)).toBe(false);
    expect(shouldCapture("model", [], exclude)).toBe(true);
  });

  test("exclude takes precedence when family is in both lists", () => {
    const include: EventFamily[] = ["model", "tool"];
    const exclude: EventFamily[] = ["model"];
    expect(shouldCapture("model", include, exclude)).toBe(false);
    expect(shouldCapture("tool", include, exclude)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration tests for registerCollector hook subscriptions
// ---------------------------------------------------------------------------

describe("registerCollector", () => {
  type HookHandler = (...args: unknown[]) => unknown;
  let hookHandlers: Map<string, HookHandler[]>;
  let appendedEvents: EventEnvelope[];
  let mockApi: {
    on: (name: string, handler: HookHandler) => void;
  };
  let mockStorage: { appendEvent: (evt: EventEnvelope) => void };
  let config: EventLedgerConfig;

  beforeEach(() => {
    hookHandlers = new Map();
    appendedEvents = [];

    mockApi = {
      on: vi.fn((name: string, handler: HookHandler) => {
        const list = hookHandlers.get(name) ?? [];
        list.push(handler);
        hookHandlers.set(name, list);
      }),
    };

    mockStorage = {
      appendEvent: vi.fn((evt: EventEnvelope) => {
        appendedEvents.push(evt);
      }),
    };

    config = { ...DEFAULT_CONFIG };
  });

  function fireHook(name: string, event: unknown, ctx: unknown = {}): void {
    const handlers = hookHandlers.get(name);
    if (!handlers) throw new Error(`No handler registered for hook: ${name}`);
    for (const h of handlers) {
      h(event, ctx);
    }
  }

  test("registers handlers for all expected hooks", () => {
    registerCollector(mockApi as never, mockStorage as never, config);

    const expectedHooks = [
      "before_model_resolve",
      "llm_output",
      "before_tool_call",
      "after_tool_call",
      "session_start",
      "session_end",
      "after_compaction",
      "message_received",
      "message_sent",
      "subagent_spawned",
      "subagent_ended",
      "before_prompt_build",
      "gateway_start",
      "gateway_stop",
    ];

    for (const hook of expectedHooks) {
      expect(hookHandlers.has(hook), `expected handler for ${hook}`).toBe(true);
    }
  });

  test("before_model_resolve emits model.resolve event", () => {
    registerCollector(mockApi as never, mockStorage as never, config);
    fireHook("before_model_resolve", { prompt: "hello" }, { agentId: "a1", sessionKey: "s1" });

    expect(appendedEvents).toHaveLength(1);
    const evt = appendedEvents[0]!;
    expect(evt.family).toBe("model");
    expect(evt.type).toBe("model.resolve");
    expect(evt.data.requestedModel).toBe("hello");
    expect(evt.agentId).toBe("a1");
    expect(evt.version).toBe(1);
  });

  test("llm_output emits budget.usage event with token data", () => {
    registerCollector(mockApi as never, mockStorage as never, config);
    fireHook(
      "llm_output",
      {
        runId: "run-1",
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostUsd: 0.01,
        model: "gpt-4",
        provider: "openai",
      },
      { agentId: "a1", sessionKey: "s1" },
    );

    expect(appendedEvents).toHaveLength(1);
    const evt = appendedEvents[0]!;
    expect(evt.family).toBe("budget");
    expect(evt.type).toBe("budget.usage");
    expect(evt.runId).toBe("run-1");
    expect(evt.data.inputTokens).toBe(100);
    expect(evt.data.outputTokens).toBe(50);
    expect(evt.data.model).toBe("gpt-4");
  });

  test("before_tool_call emits tool.invoked event", () => {
    registerCollector(mockApi as never, mockStorage as never, config);
    fireHook(
      "before_tool_call",
      { toolName: "shell", params: { cmd: "ls" } },
      { agentId: "a1", sessionKey: "s1" },
    );

    expect(appendedEvents).toHaveLength(1);
    const evt = appendedEvents[0]!;
    expect(evt.family).toBe("tool");
    expect(evt.type).toBe("tool.invoked");
    expect(evt.data.toolName).toBe("shell");
  });

  test("after_tool_call emits tool.completed event", () => {
    registerCollector(mockApi as never, mockStorage as never, config);
    fireHook(
      "after_tool_call",
      { toolName: "shell", durationMs: 120, result: "ok", error: undefined },
      { agentId: "a1", sessionKey: "s1" },
    );

    expect(appendedEvents).toHaveLength(1);
    const evt = appendedEvents[0]!;
    expect(evt.family).toBe("tool");
    expect(evt.type).toBe("tool.completed");
    expect(evt.data.success).toBe(true);
    expect(evt.data.durationMs).toBe(120);
  });

  test("after_tool_call marks success=false when error present", () => {
    registerCollector(mockApi as never, mockStorage as never, config);
    fireHook("after_tool_call", { toolName: "shell", error: "command failed" }, { agentId: "a1" });

    const evt = appendedEvents[0]!;
    expect(evt.data.success).toBe(false);
  });

  test("session_start emits session.start event", () => {
    registerCollector(mockApi as never, mockStorage as never, config);
    fireHook("session_start", { sessionId: "sess-1" }, { agentId: "a1" });

    const evt = appendedEvents[0]!;
    expect(evt.family).toBe("session");
    expect(evt.type).toBe("session.start");
    expect(evt.sessionKey).toBe("sess-1");
  });

  test("message_received emits message.received event", () => {
    registerCollector(mockApi as never, mockStorage as never, config);
    fireHook(
      "message_received",
      { from: "user", content: "hi there", metadata: { hasMedia: true } },
      { channelId: "discord" },
    );

    const evt = appendedEvents[0]!;
    expect(evt.family).toBe("message");
    expect(evt.type).toBe("message.received");
    expect(evt.data.contentLength).toBe(8);
    expect(evt.data.hasMedia).toBe(true);
  });

  test("payload is truncated when exceeding maxPayloadSize", () => {
    config.maxPayloadSize = 20;
    registerCollector(mockApi as never, mockStorage as never, config);
    fireHook(
      "before_tool_call",
      { toolName: "shell", params: { cmd: "a".repeat(500) } },
      { agentId: "a1" },
    );

    const evt = appendedEvents[0]!;
    // The toolInput field should be truncated
    expect(Buffer.byteLength(evt.data.toolInput as string, "utf-8")).toBeLessThanOrEqual(20);
  });

  test("family include filter prevents non-matching events", () => {
    config.families = ["model"];
    registerCollector(mockApi as never, mockStorage as never, config);

    // tool events should be filtered out
    fireHook("before_tool_call", { toolName: "shell", params: {} }, { agentId: "a1" });
    expect(appendedEvents).toHaveLength(0);

    // model events should pass through
    fireHook("before_model_resolve", { prompt: "hello" }, { agentId: "a1" });
    expect(appendedEvents).toHaveLength(1);
  });

  test("family exclude filter blocks matching events", () => {
    config.excludeFamilies = ["tool"];
    registerCollector(mockApi as never, mockStorage as never, config);

    fireHook("before_tool_call", { toolName: "shell", params: {} }, { agentId: "a1" });
    expect(appendedEvents).toHaveLength(0);

    fireHook("before_model_resolve", { prompt: "hello" }, { agentId: "a1" });
    expect(appendedEvents).toHaveLength(1);
  });

  test("gateway_start emits system.gateway.start event", () => {
    registerCollector(mockApi as never, mockStorage as never, config);
    fireHook("gateway_start", { port: 8080 }, {});

    const evt = appendedEvents[0]!;
    expect(evt.family).toBe("system");
    expect(evt.type).toBe("system.gateway.start");
    expect(evt.data.port).toBe(8080);
  });

  test("subagent_spawned emits subagent.spawned event", () => {
    registerCollector(mockApi as never, mockStorage as never, config);
    fireHook(
      "subagent_spawned",
      {
        runId: "run-sub",
        childSessionKey: "child-s1",
        agentId: "sub-agent",
        mode: "run",
        isolated: true,
      },
      { requesterSessionKey: "parent-s1" },
    );

    const evt = appendedEvents[0]!;
    expect(evt.family).toBe("subagent");
    expect(evt.type).toBe("subagent.spawned");
    expect(evt.runId).toBe("run-sub");
    expect(evt.data.childSessionKey).toBe("child-s1");
    expect(evt.data.isolated).toBe(true);
  });

  test("each event has a unique eventId and ISO timestamp", () => {
    registerCollector(mockApi as never, mockStorage as never, config);
    fireHook("gateway_start", { port: 1 }, {});
    fireHook("gateway_start", { port: 2 }, {});

    expect(appendedEvents).toHaveLength(2);
    expect(appendedEvents[0]!.eventId).not.toBe(appendedEvents[1]!.eventId);
    // ISO timestamp check
    expect(new Date(appendedEvents[0]!.ts).toISOString()).toBe(appendedEvents[0]!.ts);
  });
});
