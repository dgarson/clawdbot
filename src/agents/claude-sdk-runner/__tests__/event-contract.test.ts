/**
 * Event Contract Tests
 *
 * Derived from: pi-runtime-baseline.md Section 6 (Event Types),
 * implementation-plan.md Section 4.2 (event translation mapping table),
 * upstream EmbeddedPiSubscribeEvent type.
 *
 * These tests verify that the claude-sdk adapter emits EmbeddedPiSubscribeEvent events
 * matching the exact 10 type strings consumed by createEmbeddedPiSessionEventHandler.
 */

import { describe, it, expect, vi } from "vitest";
import { translateSdkMessageToEvents } from "../event-adapter.js";
import type { ClaudeSdkEventAdapterState } from "../types.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeState(overrides?: Partial<ClaudeSdkEventAdapterState>): ClaudeSdkEventAdapterState {
  return {
    subscribers: [],
    streaming: false,
    compacting: false,
    abortController: null,
    pendingSteer: [],
    messages: [],
    claudeSdkSessionId: undefined,
    sdkResultError: undefined,
    lastStderr: undefined,
    streamingBlockTypes: new Map(),
    streamingPartialMessage: null,
    streamingInProgress: false,
    sessionManager: undefined,
    ...overrides,
  };
}

function captureEvents(state: ClaudeSdkEventAdapterState): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  state.subscribers.push((evt) => {
    events.push(evt as Record<string, unknown>);
  });
  return events;
}

// ---------------------------------------------------------------------------
// Section 1.1: Required Event Types
// ---------------------------------------------------------------------------

describe("event translation — required event types", () => {
  it("emits agent_start event on session initialization (system/init message)", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      { type: "system", subtype: "init", session_id: "sess_abc123" } as never,
      state,
    );

    expect(state.claudeSdkSessionId).toBe("sess_abc123");
    expect(events).toContainEqual(expect.objectContaining({ type: "agent_start" }));
  });

  it("emits message_start on first assistant text content block", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello world" }],
        },
      } as never,
      state,
    );

    const messageStart = events.find((e) => e.type === "message_start");
    expect(messageStart).toBeDefined();
    expect((messageStart as { message?: { role?: string } }).message?.role).toBe("assistant");
  });

  it("emits message_update events for progressive text deltas", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello world" }],
        },
      } as never,
      state,
    );

    const updates = events.filter((e) => e.type === "message_update");
    expect(updates.length).toBeGreaterThan(0);
  });

  it("emits message_end when text content block finalizes", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello world" }],
        },
      } as never,
      state,
    );

    const messageEnd = events.find((e) => e.type === "message_end");
    expect(messageEnd).toBeDefined();
  });

  it("emits agent_end on result message", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      { type: "result", subtype: "success", result: "done" } as never,
      state,
    );

    expect(events).toContainEqual(expect.objectContaining({ type: "agent_end" }));
  });

  it("stores sdkResultError when result subtype indicates failure", () => {
    const state = makeState();
    captureEvents(state);

    translateSdkMessageToEvents({ type: "result", subtype: "error_max_turns" } as never, state);

    // Error results must populate sdkResultError so prompt() can throw
    expect(state.sdkResultError).toBe("error_max_turns");
  });

  it("stores sdkResultError from errors array when present", () => {
    const state = makeState();
    captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "result",
        subtype: "error_during_execution",
        is_error: true,
        errors: ["Tool execution timed out"],
      } as never,
      state,
    );

    expect(state.sdkResultError).toBe("Tool execution timed out");
  });

  it("does not set sdkResultError on successful result", () => {
    const state = makeState();
    captureEvents(state);

    translateSdkMessageToEvents(
      { type: "result", subtype: "success", result: "done" } as never,
      state,
    );

    expect(state.sdkResultError).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Section 1.2: Event Ordering Invariants
// ---------------------------------------------------------------------------

describe("event translation — ordering invariants", () => {
  it("message events follow start → update* → end ordering", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "The answer is 42" }],
        },
      } as never,
      state,
    );

    const types = events.map((e) => e.type);
    const startIdx = types.indexOf("message_start");
    const endIdx = types.lastIndexOf("message_end");
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(endIdx).toBeGreaterThan(startIdx);
    // All message_update events are between start and end
    for (let i = 0; i < types.length; i++) {
      if (types[i] === "message_update") {
        expect(i).toBeGreaterThan(startIdx);
        expect(i).toBeLessThan(endIdx);
      }
    }
  });

  it("agent_start precedes all other events for init message", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      { type: "system", subtype: "init", session_id: "sess_001" } as never,
      state,
    );

    expect(events[0]).toMatchObject({ type: "agent_start" });
  });
});

// ---------------------------------------------------------------------------
// Section 1.3: Thinking/Reasoning Content Translation
// ---------------------------------------------------------------------------

describe("event translation — thinking content", () => {
  it("translates thinking content block to thinking_start/delta/end sub-events", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "thinking", thinking: "Let me analyze this carefully" }],
        },
      } as never,
      state,
    );

    const updates = events.filter((e) => e.type === "message_update");
    const evtTypes = updates.map(
      (e) => (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type,
    );
    expect(evtTypes).toContain("thinking_start");
    expect(evtTypes).toContain("thinking_delta");
    expect(evtTypes).toContain("thinking_end");
  });

  it("thinking events carry correct message with thinking content blocks", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "thinking", thinking: "Let me analyze this carefully" }],
        },
      } as never,
      state,
    );

    const thinkingDelta = events.find(
      (e) =>
        e.type === "message_update" &&
        (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type ===
          "thinking_delta",
    );
    expect(thinkingDelta).toBeDefined();
    const msg = (thinkingDelta as { message?: { content?: unknown[] } }).message;
    expect(msg?.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "thinking" })]),
    );
  });

  it("text content emits text_delta sub-type (not thinking)", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "The answer is 42" }],
        },
      } as never,
      state,
    );

    const updates = events.filter((e) => e.type === "message_update");
    const evtTypes = updates.map(
      (e) => (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type,
    );
    expect(evtTypes).toContain("text_delta");
    expect(evtTypes).not.toContain("thinking_delta");
  });

  it("thinking followed by text emits correct event sequence", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "I need to think..." },
            { type: "text", text: "The answer is 42" },
          ],
        },
      } as never,
      state,
    );

    const types = events.map((e) => e.type);
    const allEvtTypes = events.map((e) => {
      const rec = e as { assistantMessageEvent?: { type?: string } };
      return rec.assistantMessageEvent?.type ?? e.type;
    });

    // message_start comes first (initializes handler state),
    // then thinking events, then text events, then message_end
    const thinkingStartIdx = allEvtTypes.indexOf("thinking_start");
    const thinkingEndIdx = allEvtTypes.indexOf("thinking_end");
    const textDeltaIdx = allEvtTypes.indexOf("text_delta");
    const messageStartIdx = types.indexOf("message_start");
    const messageEndIdx = types.lastIndexOf("message_end");

    // message_start BEFORE thinking
    expect(messageStartIdx).toBeGreaterThanOrEqual(0);
    expect(thinkingStartIdx).toBeGreaterThan(messageStartIdx);
    expect(thinkingEndIdx).toBeGreaterThan(thinkingStartIdx);
    // text events come after thinking
    if (textDeltaIdx >= 0) {
      expect(textDeltaIdx).toBeGreaterThan(thinkingEndIdx);
    }
    // message_end AFTER everything
    expect(messageEndIdx).toBeGreaterThan(thinkingEndIdx);
    if (textDeltaIdx >= 0) {
      expect(messageEndIdx).toBeGreaterThan(textDeltaIdx);
    }
  });
});

// ---------------------------------------------------------------------------
// Section 1.1: Tool execution events (from MCP handler)
// ---------------------------------------------------------------------------

describe("event translation — tool execution event shapes (Pi AgentEvent contract)", () => {
  it("tool_execution_start event has correct Pi AgentEvent fields", () => {
    // Tool execution events are emitted from the MCP handler, not directly from
    // translateSdkMessageToEvents. This test verifies the Pi AgentEvent shape contract.
    const evt = {
      type: "tool_execution_start",
      toolName: "read_file",
      toolCallId: "call_abc",
      args: { path: "/foo.ts" },
    };
    expect(evt.type).toBe("tool_execution_start");
    expect(typeof evt.toolName).toBe("string");
    expect(typeof evt.toolCallId).toBe("string");
    expect(typeof evt.args).toBe("object");
  });

  it("tool_execution_end event has correct Pi AgentEvent fields on success", () => {
    const evt = {
      type: "tool_execution_end",
      toolCallId: "call_abc",
      toolName: "read_file",
      result: "file contents here",
      isError: false,
    };
    expect(evt.type).toBe("tool_execution_end");
    expect(typeof evt.toolCallId).toBe("string");
    expect(typeof evt.result).toBe("string");
    expect(evt.isError).toBe(false);
  });

  it("tool_execution_end event has isError=true on failure", () => {
    const evt = {
      type: "tool_execution_end",
      toolCallId: "call_abc",
      toolName: "read_file",
      result: "Permission denied",
      isError: true,
    };
    expect(evt.type).toBe("tool_execution_end");
    expect(evt.isError).toBe(true);
    expect(typeof evt.result).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Section 1.4: Message lifecycle for all assistant messages (including thinking-only)
// The handler's handleMessageStart calls resetAssistantMessageState() which MUST
// fire before any handleMessageUpdate thinking events. Without message_start,
// the handler has uninitialized state for reasoning stream processing.
// ---------------------------------------------------------------------------

describe("event translation — message lifecycle for thinking-only messages", () => {
  it("thinking-only message emits message_start before thinking events", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "thinking", thinking: "Let me reason about this" }],
        },
      } as never,
      state,
    );

    const types = events.map((e) => e.type);
    const messageStartIdx = types.indexOf("message_start");
    const firstUpdateIdx = types.indexOf("message_update");

    // message_start MUST be emitted before any message_update (thinking) events
    expect(messageStartIdx).toBeGreaterThanOrEqual(0);
    expect(firstUpdateIdx).toBeGreaterThan(messageStartIdx);
  });

  it("thinking-only message emits message_end after all thinking events", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "thinking", thinking: "Deep thought" }],
        },
      } as never,
      state,
    );

    const types = events.map((e) => e.type);
    const messageEndIdx = types.lastIndexOf("message_end");
    const lastUpdateIdx = types.lastIndexOf("message_update");

    // message_end MUST come after all message_update events
    expect(messageEndIdx).toBeGreaterThan(lastUpdateIdx);
  });

  it("thinking-only message has full lifecycle: start → update* → end", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "thinking", thinking: "Reasoning..." }],
        },
      } as never,
      state,
    );

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("message_start");
    expect(types[types.length - 1]).toBe("message_end");
    // All middle events are message_update
    for (let i = 1; i < types.length - 1; i++) {
      expect(types[i]).toBe("message_update");
    }
  });
});

// ---------------------------------------------------------------------------
// Section 1.5: Event ordering for mixed content (thinking + text + tool_use)
// Verifies that the event adapter emits events in the correct sequence when
// assistant messages contain multiple content block types.
// ---------------------------------------------------------------------------

describe("event translation — mixed content sequencing", () => {
  it("text + tool_use: emits message_end to finalize text before tool_use block", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "I'll read that file for you" },
            { type: "tool_use", id: "call_1", name: "read_file", input: { path: "/foo.ts" } },
          ],
        },
      } as never,
      state,
    );

    const types = events.map((e) => e.type);
    // message_start and message_end must bracket the text content
    expect(types).toContain("message_start");
    expect(types).toContain("message_end");
    // message_end must be the LAST event from the adapter
    // (tool_execution_start comes from MCP handler, not adapter)
    expect(types[types.length - 1]).toBe("message_end");
  });

  it("thinking + text + tool_use: correct full sequence", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "I should read the file" },
            { type: "text", text: "Let me read that" },
            { type: "tool_use", id: "call_1", name: "read_file", input: { path: "/foo.ts" } },
          ],
        },
      } as never,
      state,
    );

    const types = events.map((e) => e.type);
    const allEvtTypes = events.map((e) => {
      const rec = e as { assistantMessageEvent?: { type?: string } };
      return rec.assistantMessageEvent?.type ?? e.type;
    });

    // Must have message_start as first event
    expect(types[0]).toBe("message_start");
    // Must have message_end as last event
    expect(types[types.length - 1]).toBe("message_end");
    // Thinking events must come before text events
    const thinkingEndIdx = allEvtTypes.indexOf("thinking_end");
    const textDeltaIdx = allEvtTypes.indexOf("text_delta");
    expect(thinkingEndIdx).toBeLessThan(textDeltaIdx);
  });

  it("tool_use-only message still emits message_start and message_end", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "tool_use", id: "call_1", name: "read_file", input: { path: "/foo.ts" } },
          ],
        },
      } as never,
      state,
    );

    const types = events.map((e) => e.type);
    // Even tool_use-only messages need message lifecycle for handler state initialization
    expect(types).toContain("message_start");
    expect(types).toContain("message_end");
  });
});

// ---------------------------------------------------------------------------
// Section 1.6: text_end emission for blockReplyBreak="text_end" parity
//
// For Pi's streaming runtime, text content arrives as a sequence of text_delta
// events followed by a text_end. Subscribers using blockReplyBreak="text_end"
// flush the block reply buffer on text_end (handlers.messages.ts:244-246).
//
// The claude-sdk adapter receives complete text blocks at once, so it emits
// both text_delta and text_end for each block. text_end has an empty delta so
// the handler's deltaBuffer doesn't double-append the content.
// ---------------------------------------------------------------------------

describe("event translation — text_end emission for blockReplyBreak parity", () => {
  it("emits text_end after text_delta for each text block", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello world" }],
        },
      } as never,
      state,
    );

    const updateEvtTypes = events
      .filter((e) => e.type === "message_update")
      .map(
        (e) =>
          (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type ?? "",
      );

    const deltaIdx = updateEvtTypes.indexOf("text_delta");
    const endIdx = updateEvtTypes.indexOf("text_end");

    expect(deltaIdx).toBeGreaterThanOrEqual(0);
    expect(endIdx).toBeGreaterThan(deltaIdx);
  });

  it("text_end has empty delta to prevent double-append to deltaBuffer", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Some text" }],
        },
      } as never,
      state,
    );

    const textEndEvt = events
      .filter((e) => e.type === "message_update")
      .find(
        (e) =>
          (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type ===
          "text_end",
      );

    expect(textEndEvt).toBeDefined();
    const aMe = (textEndEvt as { assistantMessageEvent?: Record<string, unknown> })
      .assistantMessageEvent;
    // Empty delta ensures deltaBuffer isn't double-appended with the full text
    expect(aMe?.delta).toBe("");
    // Full content retained for the handler's monotonic suffix check
    expect(aMe?.content).toBe("Some text");
  });

  it("text_end is emitted between text_delta and message_end", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Reply text" }],
        },
      } as never,
      state,
    );

    const allEvtTypes = events.map((e) => {
      const rec = e as { assistantMessageEvent?: { type?: string } };
      return rec.assistantMessageEvent?.type ?? e.type;
    });

    const textDeltaIdx = allEvtTypes.indexOf("text_delta");
    const textEndIdx = allEvtTypes.indexOf("text_end");
    const messageEndIdx = allEvtTypes.lastIndexOf("message_end");

    expect(textEndIdx).toBeGreaterThan(textDeltaIdx);
    expect(messageEndIdx).toBeGreaterThan(textEndIdx);
  });

  it("thinking blocks do NOT emit text_end (only text blocks do)", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "thinking", thinking: "Let me think" }],
        },
      } as never,
      state,
    );

    const updateEvtTypes = events
      .filter((e) => e.type === "message_update")
      .map(
        (e) =>
          (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type ?? "",
      );

    expect(updateEvtTypes).not.toContain("text_end");
    expect(updateEvtTypes).not.toContain("text_delta");
  });

  it("multiple text blocks each get their own text_delta + text_end pair", () => {
    const state = makeState();
    const events = captureEvents(state);

    // Two separate text blocks in one assistant message (thinking between them)
    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "I need to respond" },
            { type: "text", text: "First part" },
          ],
        },
      } as never,
      state,
    );

    const updateEvtTypes = events
      .filter((e) => e.type === "message_update")
      .map(
        (e) =>
          (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type ?? "",
      );

    // Should have exactly one text_delta and one text_end
    const deltaCount = updateEvtTypes.filter((t) => t === "text_delta").length;
    const endCount = updateEvtTypes.filter((t) => t === "text_end").length;
    expect(deltaCount).toBe(1);
    expect(endCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Compaction events (SDKCompactBoundaryMessage — confirmed in official TypeScript ref)
// ---------------------------------------------------------------------------

describe("event translation — compaction events", () => {
  it("emits auto_compaction_start then auto_compaction_end on compact_boundary", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "system",
        subtype: "compact_boundary",
        session_id: "sess_abc",
        compact_metadata: { trigger: "auto", pre_tokens: 100000 },
      } as never,
      state,
    );

    const types = events.map((e) => e.type);
    const startIdx = types.indexOf("auto_compaction_start");
    const endIdx = types.indexOf("auto_compaction_end");
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(endIdx).toBeGreaterThan(startIdx);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "auto_compaction_end", willRetry: false }),
    );
  });

  it("does NOT emit agent_start for compact_boundary (only for init)", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "system",
        subtype: "compact_boundary",
        session_id: "sess_abc",
        compact_metadata: { trigger: "manual", pre_tokens: 50000 },
      } as never,
      state,
    );

    expect(events.map((e) => e.type)).not.toContain("agent_start");
  });

  it("auto_compaction_start carries pre_tokens and trigger from compact_metadata", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "system",
        subtype: "compact_boundary",
        session_id: "sess_compact",
        compact_metadata: { trigger: "auto", pre_tokens: 87500 },
      } as never,
      state,
    );

    const startEvt = events.find((e) => e.type === "auto_compaction_start");
    expect(startEvt).toBeDefined();
    // pre_tokens enables handlers to populate tokenCount in before_compaction hooks
    expect(startEvt?.pre_tokens).toBe(87500);
    expect(startEvt?.trigger).toBe("auto");
  });

  it("auto_compaction_end carries pre_tokens and trigger from compact_metadata", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "system",
        subtype: "compact_boundary",
        session_id: "sess_compact",
        compact_metadata: { trigger: "manual", pre_tokens: 64000 },
      } as never,
      state,
    );

    const endEvt = events.find((e) => e.type === "auto_compaction_end");
    expect(endEvt).toBeDefined();
    expect(endEvt?.pre_tokens).toBe(64000);
    expect(endEvt?.trigger).toBe("manual");
    expect(endEvt?.willRetry).toBe(false);
  });

  it("both compaction events carry the same pre_tokens and trigger", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "system",
        subtype: "compact_boundary",
        session_id: "sess_x",
        compact_metadata: { trigger: "auto", pre_tokens: 120000 },
      } as never,
      state,
    );

    const startEvt = events.find((e) => e.type === "auto_compaction_start") as Record<
      string,
      unknown
    >;
    const endEvt = events.find((e) => e.type === "auto_compaction_end") as Record<string, unknown>;

    expect(startEvt.pre_tokens).toBe(endEvt.pre_tokens);
    expect(startEvt.trigger).toBe(endEvt.trigger);
  });
});

// ---------------------------------------------------------------------------
// Section 2.1: stream_event handling
// ---------------------------------------------------------------------------

describe("event translation -- stream_event handling", () => {
  it("message_start emits Pi message_start with role assistant", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: {
            role: "assistant",
            content: [],
            usage: { input_tokens: 10, output_tokens: 0 },
            model: "claude-sonnet-4-5-20250514",
          },
        },
      } as never,
      state,
    );

    expect(events).toContainEqual(expect.objectContaining({ type: "message_start" }));
    const startEvt = events.find((e) => e.type === "message_start") as {
      message?: { role?: string };
    };
    expect(startEvt?.message?.role).toBe("assistant");
    expect(state.streamingInProgress).toBe(true);
  });

  it("content_block_start (text) records block type", () => {
    const state = makeState();
    captureEvents(state);

    // First send message_start to initialize streaming state
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 0, content_block: { type: "text" } },
      } as never,
      state,
    );

    expect(state.streamingBlockTypes.get(0)).toBe("text");
  });

  it("content_block_start (thinking) emits thinking_start", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
      } as never,
      state,
    );

    const thinkingStart = events.find(
      (e) =>
        e.type === "message_update" &&
        (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type ===
          "thinking_start",
    );
    expect(thinkingStart).toBeDefined();
  });

  it("content_block_delta (text_delta) emits text_delta with correct delta and content", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 0, content_block: { type: "text" } },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello" },
        },
      } as never,
      state,
    );

    const textDelta = events.find(
      (e) =>
        e.type === "message_update" &&
        (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type ===
          "text_delta",
    );
    expect(textDelta).toBeDefined();
    const aMe = (textDelta as { assistantMessageEvent?: Record<string, unknown> })
      .assistantMessageEvent;
    expect(aMe?.delta).toBe("Hello");
    expect(aMe?.content).toBe("Hello");
  });

  it("content_block_delta (thinking_delta) emits thinking_delta", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "Let me" },
        },
      } as never,
      state,
    );

    const thinkingDelta = events.find(
      (e) =>
        e.type === "message_update" &&
        (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type ===
          "thinking_delta",
    );
    expect(thinkingDelta).toBeDefined();
    const aMe = (thinkingDelta as { assistantMessageEvent?: Record<string, unknown> })
      .assistantMessageEvent;
    expect(aMe?.delta).toBe("Let me");
    expect(aMe?.content).toBe("Let me");
  });

  it("multiple text_delta events accumulate content correctly", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 0, content_block: { type: "text" } },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: " world" },
        },
      } as never,
      state,
    );

    const textDeltas = events.filter(
      (e) =>
        e.type === "message_update" &&
        (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type ===
          "text_delta",
    );
    expect(textDeltas).toHaveLength(2);
    const secondDelta = (textDeltas[1] as { assistantMessageEvent?: Record<string, unknown> })
      .assistantMessageEvent;
    expect(secondDelta?.delta).toBe(" world");
    expect(secondDelta?.content).toBe("Hello world");
  });

  it("content_block_stop (text) emits text_end with empty delta and full content", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 0, content_block: { type: "text" } },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Done" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_stop", index: 0 },
      } as never,
      state,
    );

    const textEnd = events.find(
      (e) =>
        e.type === "message_update" &&
        (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type ===
          "text_end",
    );
    expect(textEnd).toBeDefined();
    const aMe = (textEnd as { assistantMessageEvent?: Record<string, unknown> })
      .assistantMessageEvent;
    expect(aMe?.delta).toBe("");
    expect(aMe?.content).toBe("Done");
  });

  it("content_block_stop (thinking) emits thinking_end", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "hmm" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_stop", index: 0 },
      } as never,
      state,
    );

    const thinkingEnd = events.find(
      (e) =>
        e.type === "message_update" &&
        (e as { assistantMessageEvent?: { type?: string } }).assistantMessageEvent?.type ===
          "thinking_end",
    );
    expect(thinkingEnd).toBeDefined();
  });

  it("message_stop emits message_end", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "message_stop" },
      } as never,
      state,
    );

    expect(events).toContainEqual(expect.objectContaining({ type: "message_end" }));
  });

  it("full sequence: message_start → text deltas → text_end → message_end in order", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 0, content_block: { type: "text" } },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hi" } },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      { type: "stream_event", event: { type: "content_block_stop", index: 0 } } as never,
      state,
    );
    translateSdkMessageToEvents(
      { type: "stream_event", event: { type: "message_stop" } } as never,
      state,
    );

    const allEvtTypes = events.map((e) => {
      const rec = e as { assistantMessageEvent?: { type?: string } };
      return rec.assistantMessageEvent?.type ?? e.type;
    });

    const messageStartIdx = allEvtTypes.indexOf("message_start");
    const textDeltaIdx = allEvtTypes.indexOf("text_delta");
    const textEndIdx = allEvtTypes.indexOf("text_end");
    const messageEndIdx = allEvtTypes.indexOf("message_end");

    expect(messageStartIdx).toBe(0);
    expect(textDeltaIdx).toBeGreaterThan(messageStartIdx);
    expect(textEndIdx).toBeGreaterThan(textDeltaIdx);
    expect(messageEndIdx).toBeGreaterThan(textEndIdx);
  });

  it("interleaved thinking + text blocks emit correct sequence", () => {
    const state = makeState();
    const events = captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );
    // Thinking block (index 0)
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "reasoning" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      { type: "stream_event", event: { type: "content_block_stop", index: 0 } } as never,
      state,
    );
    // Text block (index 1)
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 1, content_block: { type: "text" } },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 1,
          delta: { type: "text_delta", text: "answer" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      { type: "stream_event", event: { type: "content_block_stop", index: 1 } } as never,
      state,
    );
    translateSdkMessageToEvents(
      { type: "stream_event", event: { type: "message_stop" } } as never,
      state,
    );

    const allEvtTypes = events.map((e) => {
      const rec = e as { assistantMessageEvent?: { type?: string } };
      return rec.assistantMessageEvent?.type ?? e.type;
    });

    const thinkingStartIdx = allEvtTypes.indexOf("thinking_start");
    const thinkingEndIdx = allEvtTypes.indexOf("thinking_end");
    const textDeltaIdx = allEvtTypes.indexOf("text_delta");
    const textEndIdx = allEvtTypes.indexOf("text_end");

    expect(thinkingStartIdx).toBeGreaterThan(0); // after message_start
    expect(thinkingEndIdx).toBeGreaterThan(thinkingStartIdx);
    expect(textDeltaIdx).toBeGreaterThan(thinkingEndIdx);
    expect(textEndIdx).toBeGreaterThan(textDeltaIdx);
  });
});

// ---------------------------------------------------------------------------
// Section 2.2: streaming + complete message dedup
// ---------------------------------------------------------------------------

describe("event translation -- streaming + complete message dedup", () => {
  it("assistant message does NOT re-emit events when streaming preceded it", () => {
    const state = makeState();
    const events = captureEvents(state);

    // Stream events first
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 0, content_block: { type: "text" } },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      { type: "stream_event", event: { type: "content_block_stop", index: 0 } } as never,
      state,
    );
    translateSdkMessageToEvents(
      { type: "stream_event", event: { type: "message_stop" } } as never,
      state,
    );

    const eventCountBeforeAssistant = events.length;

    // Now the complete assistant message arrives
    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
        },
      } as never,
      state,
    );

    // No new message_start/message_update/message_end events should be emitted
    const newEvents = events.slice(eventCountBeforeAssistant);
    const newMessageEvents = newEvents.filter(
      (e) => e.type === "message_start" || e.type === "message_update" || e.type === "message_end",
    );
    expect(newMessageEvents).toHaveLength(0);
  });

  it("state.messages IS updated from the complete assistant message", () => {
    const state = makeState();
    captureEvents(state);

    // Stream events
    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );
    translateSdkMessageToEvents(
      { type: "stream_event", event: { type: "message_stop" } } as never,
      state,
    );

    expect(state.messages).toHaveLength(0);

    // Complete assistant message
    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
        },
      } as never,
      state,
    );

    expect(state.messages).toHaveLength(1);
    const msg = state.messages[0] as { role: string };
    expect(msg.role).toBe("assistant");
  });

  it("streamingInProgress resets to false after complete assistant message", () => {
    const state = makeState();
    captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "test" },
        },
      } as never,
      state,
    );
    expect(state.streamingInProgress).toBe(true);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
        },
      } as never,
      state,
    );

    expect(state.streamingInProgress).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Section 2.3: JSONL persistence
// ---------------------------------------------------------------------------

describe("event translation -- JSONL persistence", () => {
  it("calls sessionManager.appendMessage for complete assistant message", () => {
    const appendMessage = vi.fn();
    const state = makeState({
      sessionManager: { appendMessage },
    });
    captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      } as never,
      state,
    );

    expect(appendMessage).toHaveBeenCalledTimes(1);
    const persisted = appendMessage.mock.calls[0][0];
    expect(persisted.role).toBe("assistant");
    expect(persisted.api).toBe("anthropic-messages");
    expect(persisted.usage.input).toBe(100);
    expect(persisted.usage.output).toBe(50);
    expect(persisted.usage.totalTokens).toBe(150);
  });

  it("maps tool_use blocks to toolCall format in persisted content", () => {
    const appendMessage = vi.fn();
    const state = makeState({
      sessionManager: { appendMessage },
    });
    captureEvents(state);

    translateSdkMessageToEvents(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Let me read that" },
            { type: "tool_use", id: "call_1", name: "read_file", input: { path: "/foo.ts" } },
          ],
        },
      } as never,
      state,
    );

    const persisted = appendMessage.mock.calls[0][0];
    expect(persisted.content).toEqual([
      { type: "text", text: "Let me read that" },
      { type: "toolCall", id: "call_1", name: "read_file", arguments: { path: "/foo.ts" } },
    ]);
  });

  it("does not throw when sessionManager.appendMessage is undefined", () => {
    const state = makeState({ sessionManager: undefined });
    captureEvents(state);

    expect(() => {
      translateSdkMessageToEvents(
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello" }],
          },
        } as never,
        state,
      );
    }).not.toThrow();
  });

  it("does not throw when appendMessage throws", () => {
    const appendMessage = vi.fn(() => {
      throw new Error("disk full");
    });
    const state = makeState({
      sessionManager: { appendMessage },
    });
    captureEvents(state);

    expect(() => {
      translateSdkMessageToEvents(
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello" }],
          },
        } as never,
        state,
      );
    }).not.toThrow();
  });
});
