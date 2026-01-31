/**
 * Tests for SDK event handler bridging layer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClaudeSdkRunState } from "./types.js";
import {
  createSdkEventHandler,
  extractSdkAssistantText,
  extractSdkAssistantThinking,
  type SdkPartialMessage,
  type SdkAssistantMessage,
  type SdkStatusMessage,
} from "./events.js";

// Mock dependencies
vi.mock("../../infra/agent-events.js", () => ({
  emitAgentEvent: vi.fn(),
}));

vi.mock("../pi-embedded-subscribe.raw-stream.js", () => ({
  appendRawStream: vi.fn(),
}));

function createMockState(): ClaudeSdkRunState {
  return {
    assistantTexts: [],
    toolMetas: [],
    messagingToolSentTexts: [],
    messagingToolSentTextsNormalized: [],
    messagingToolSentTargets: [],
    didSendViaMessagingTool: false,
    lastToolError: undefined,
    accumulatedThinking: undefined,
    deltaBuffer: "",
    lastStreamedAssistant: undefined,
  };
}

describe("createSdkEventHandler", () => {
  let state: ClaudeSdkRunState;
  let callbacks: {
    onPartialReply: ReturnType<typeof vi.fn>;
    onAssistantMessageStart: ReturnType<typeof vi.fn>;
    onBlockReply: ReturnType<typeof vi.fn>;
    onBlockReplyFlush: ReturnType<typeof vi.fn>;
    onReasoningStream: ReturnType<typeof vi.fn>;
    onAgentEvent: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    state = createMockState();
    callbacks = {
      onPartialReply: vi.fn(),
      onAssistantMessageStart: vi.fn(),
      onBlockReply: vi.fn(),
      onBlockReplyFlush: vi.fn(),
      onReasoningStream: vi.fn(),
      onAgentEvent: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe("handleMessage", () => {
    it("ignores null or undefined messages", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      // Should not throw
      handler.handleMessage(null as unknown as Parameters<typeof handler.handleMessage>[0]);
      handler.handleMessage(undefined as unknown as Parameters<typeof handler.handleMessage>[0]);
      expect(callbacks.onPartialReply).not.toHaveBeenCalled();
    });

    it("ignores unknown message types", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      handler.handleMessage({ type: "unknown_type" });
      expect(callbacks.onPartialReply).not.toHaveBeenCalled();
      expect(callbacks.onBlockReply).not.toHaveBeenCalled();
    });
  });

  describe("stream_event handling", () => {
    it("fires onAssistantMessageStart on message_start", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      const msg: SdkPartialMessage = {
        type: "stream_event",
        event: { type: "message_start" },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      };

      handler.handleMessage(msg);
      expect(callbacks.onAssistantMessageStart).toHaveBeenCalledTimes(1);
    });

    it("only fires onAssistantMessageStart once per message", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      const msg: SdkPartialMessage = {
        type: "stream_event",
        event: { type: "message_start" },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      };

      handler.handleMessage(msg);
      handler.handleMessage(msg);
      expect(callbacks.onAssistantMessageStart).toHaveBeenCalledTimes(1);
    });

    it("tracks content blocks from content_block_start", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      // Start message first
      handler.handleMessage({
        type: "stream_event",
        event: { type: "message_start" },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      } as SdkPartialMessage);

      // Add content block
      handler.handleMessage({
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
        parent_tool_use_id: null,
        uuid: "uuid-2",
        session_id: "session-1",
      } as SdkPartialMessage);

      // Verify handler doesn't throw (internal state tracking works)
      expect(callbacks.onAssistantMessageStart).toHaveBeenCalled();
    });

    it("accumulates text deltas and fires onPartialReply", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        shouldEmitPartialReplies: true,
        ...callbacks,
      });

      // Start message
      handler.handleMessage({
        type: "stream_event",
        event: { type: "message_start" },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      } as SdkPartialMessage);

      // Start content block
      handler.handleMessage({
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
        parent_tool_use_id: null,
        uuid: "uuid-2",
        session_id: "session-1",
      } as SdkPartialMessage);

      // Send text delta
      handler.handleMessage({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello" },
        },
        parent_tool_use_id: null,
        uuid: "uuid-3",
        session_id: "session-1",
      } as SdkPartialMessage);

      expect(callbacks.onPartialReply).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Hello" }),
      );
    });

    it("does not fire onPartialReply when shouldEmitPartialReplies is false", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        shouldEmitPartialReplies: false,
        ...callbacks,
      });

      // Start message
      handler.handleMessage({
        type: "stream_event",
        event: { type: "message_start" },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      } as SdkPartialMessage);

      // Start content block
      handler.handleMessage({
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
        parent_tool_use_id: null,
        uuid: "uuid-2",
        session_id: "session-1",
      } as SdkPartialMessage);

      // Send text delta
      handler.handleMessage({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello" },
        },
        parent_tool_use_id: null,
        uuid: "uuid-3",
        session_id: "session-1",
      } as SdkPartialMessage);

      expect(callbacks.onPartialReply).not.toHaveBeenCalled();
    });

    it("handles thinking deltas in stream mode", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "stream",
        ...callbacks,
      });

      // Start message
      handler.handleMessage({
        type: "stream_event",
        event: { type: "message_start" },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      } as SdkPartialMessage);

      // Start thinking block
      handler.handleMessage({
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "thinking", thinking: "" },
        },
        parent_tool_use_id: null,
        uuid: "uuid-2",
        session_id: "session-1",
      } as SdkPartialMessage);

      // Send thinking delta
      handler.handleMessage({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "Let me think..." },
        },
        parent_tool_use_id: null,
        uuid: "uuid-3",
        session_id: "session-1",
      } as SdkPartialMessage);

      expect(callbacks.onReasoningStream).toHaveBeenCalledWith({ text: "Let me think..." });
    });

    it("does not emit reasoning stream when mode is off", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      // Start message
      handler.handleMessage({
        type: "stream_event",
        event: { type: "message_start" },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      } as SdkPartialMessage);

      // Start thinking block
      handler.handleMessage({
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "thinking", thinking: "" },
        },
        parent_tool_use_id: null,
        uuid: "uuid-2",
        session_id: "session-1",
      } as SdkPartialMessage);

      // Send thinking delta
      handler.handleMessage({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "Let me think..." },
        },
        parent_tool_use_id: null,
        uuid: "uuid-3",
        session_id: "session-1",
      } as SdkPartialMessage);

      expect(callbacks.onReasoningStream).not.toHaveBeenCalled();
    });
  });

  describe("assistant message handling", () => {
    it("extracts text from assistant message and fires onBlockReply", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      const msg: SdkAssistantMessage = {
        type: "assistant",
        message: {
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Hello, world!" }],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      };

      handler.handleMessage(msg);
      expect(callbacks.onBlockReply).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Hello, world!" }),
      );
      expect(state.assistantTexts).toContain("Hello, world!");
    });

    it("accumulates multiple text blocks", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      const msg: SdkAssistantMessage = {
        type: "assistant",
        message: {
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [
            { type: "text", text: "First paragraph." },
            { type: "text", text: "Second paragraph." },
          ],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      };

      handler.handleMessage(msg);
      expect(callbacks.onBlockReply).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "First paragraph.\nSecond paragraph.",
        }),
      );
    });

    it("emits reasoning before answer when reasoningMode is on", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "on",
        ...callbacks,
      });

      const msg: SdkAssistantMessage = {
        type: "assistant",
        message: {
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [
            { type: "thinking", thinking: "Let me consider this..." },
            { type: "text", text: "The answer is 42." },
          ],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 15 },
        },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      };

      handler.handleMessage(msg);

      // Should emit reasoning first, then answer
      expect(callbacks.onBlockReply).toHaveBeenCalledTimes(2);
      expect(callbacks.onBlockReply).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ text: expect.stringContaining("Let me consider this...") }),
      );
      expect(callbacks.onBlockReply).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ text: "The answer is 42." }),
      );
    });

    it("skips duplicate text already sent via messaging tool", () => {
      // Use text that matches when normalized (min 10 chars for duplicate detection)
      state.messagingToolSentTextsNormalized = ["this is a test message for duplicate detection"];
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      const msg: SdkAssistantMessage = {
        type: "assistant",
        message: {
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "This is a TEST message for duplicate detection" }],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      };

      handler.handleMessage(msg);
      // Text matches normalized version, so onBlockReply should not be called
      expect(callbacks.onBlockReply).not.toHaveBeenCalled();
    });

    it("ignores assistant message with non-assistant role", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      const msg = {
        type: "assistant",
        message: {
          id: "msg-1",
          type: "message",
          role: "user", // Wrong role
          content: [{ type: "text", text: "Hello!" }],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      };

      handler.handleMessage(msg);
      expect(callbacks.onBlockReply).not.toHaveBeenCalled();
    });
  });

  describe("system status handling", () => {
    it("emits compacting_start event when compacting starts", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      const msg: SdkStatusMessage = {
        type: "system",
        subtype: "status",
        status: "compacting",
        uuid: "uuid-1",
        session_id: "session-1",
      };

      handler.handleMessage(msg);
      expect(callbacks.onAgentEvent).toHaveBeenCalledWith({
        stream: "lifecycle",
        data: { phase: "compacting_start" },
      });
    });

    it("emits compacting_end event when compacting ends", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      // Start compacting
      handler.handleMessage({
        type: "system",
        subtype: "status",
        status: "compacting",
        uuid: "uuid-1",
        session_id: "session-1",
      } as SdkStatusMessage);

      // End compacting
      handler.handleMessage({
        type: "system",
        subtype: "status",
        status: null,
        uuid: "uuid-2",
        session_id: "session-1",
      } as SdkStatusMessage);

      expect(callbacks.onAgentEvent).toHaveBeenCalledWith({
        stream: "lifecycle",
        data: { phase: "compacting_end" },
      });
    });

    it("does not emit duplicate compacting events", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      const msg: SdkStatusMessage = {
        type: "system",
        subtype: "status",
        status: "compacting",
        uuid: "uuid-1",
        session_id: "session-1",
      };

      handler.handleMessage(msg);
      handler.handleMessage(msg);

      const compactingCalls = callbacks.onAgentEvent.mock.calls.filter(
        (call) => call[0].data.phase === "compacting_start",
      );
      expect(compactingCalls).toHaveLength(1);
    });

    it("ignores system messages without status subtype", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      handler.handleMessage({
        type: "system",
        subtype: "other",
        uuid: "uuid-1",
        session_id: "session-1",
      } as unknown as SdkStatusMessage);

      expect(callbacks.onAgentEvent).not.toHaveBeenCalled();
    });
  });

  describe("helper methods", () => {
    it("getAssistantTexts returns accumulated texts", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      const msg: SdkAssistantMessage = {
        type: "assistant",
        message: {
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "First response" }],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      };

      handler.handleMessage(msg);
      expect(handler.getAssistantTexts()).toEqual(["First response"]);
    });

    it("isMessageInProgress returns correct state", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      expect(handler.isMessageInProgress()).toBe(false);

      // Start message
      handler.handleMessage({
        type: "stream_event",
        event: { type: "message_start" },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      } as SdkPartialMessage);

      expect(handler.isMessageInProgress()).toBe(true);
    });

    it("reset clears internal state", () => {
      const handler = createSdkEventHandler({
        runId: "run-1",
        sessionId: "session-1",
        state,
        reasoningMode: "off",
        ...callbacks,
      });

      // Start message
      handler.handleMessage({
        type: "stream_event",
        event: { type: "message_start" },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      } as SdkPartialMessage);

      expect(handler.isMessageInProgress()).toBe(true);

      handler.reset();

      expect(handler.isMessageInProgress()).toBe(false);
      expect(state.deltaBuffer).toBe("");
      expect(state.lastStreamedAssistant).toBeUndefined();
    });
  });
});

describe("extractSdkAssistantText", () => {
  it("extracts text from text blocks", () => {
    const content = [
      { type: "text", text: "Hello" },
      { type: "text", text: "World" },
    ];
    expect(extractSdkAssistantText(content)).toBe("Hello\nWorld");
  });

  it("ignores non-text blocks", () => {
    const content = [
      { type: "thinking", thinking: "Let me think..." },
      { type: "text", text: "Answer" },
      { type: "tool_use", id: "tool-1", name: "calc", input: {} },
    ];
    expect(extractSdkAssistantText(content)).toBe("Answer");
  });

  it("strips thinking tags from text", () => {
    const content = [{ type: "text", text: "<think>reasoning</think>Answer" }];
    expect(extractSdkAssistantText(content)).toBe("Answer");
  });

  it("returns empty string for empty content", () => {
    expect(extractSdkAssistantText([])).toBe("");
  });

  it("trims whitespace", () => {
    const content = [{ type: "text", text: "  spaced  " }];
    expect(extractSdkAssistantText(content)).toBe("spaced");
  });
});

describe("extractSdkAssistantThinking", () => {
  it("extracts thinking from thinking blocks", () => {
    const content = [
      { type: "thinking", thinking: "First thought" },
      { type: "thinking", thinking: "Second thought" },
    ];
    expect(extractSdkAssistantThinking(content)).toBe("First thought\nSecond thought");
  });

  it("ignores non-thinking blocks", () => {
    const content = [
      { type: "text", text: "Answer" },
      { type: "thinking", thinking: "The reasoning" },
      { type: "tool_use", id: "tool-1", name: "calc", input: {} },
    ];
    expect(extractSdkAssistantThinking(content)).toBe("The reasoning");
  });

  it("returns empty string when no thinking blocks", () => {
    const content = [{ type: "text", text: "Just text" }];
    expect(extractSdkAssistantThinking(content)).toBe("");
  });

  it("trims whitespace", () => {
    const content = [{ type: "thinking", thinking: "  spaced thinking  " }];
    expect(extractSdkAssistantThinking(content)).toBe("spaced thinking");
  });
});
