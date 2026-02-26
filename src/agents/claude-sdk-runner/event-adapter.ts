/**
 * Event Adapter: Claude Agent SDK SDKMessage → EmbeddedPiSubscribeEvent
 *
 * Translates Claude Agent SDK `query()` async generator messages into the
 * EmbeddedPiSubscribeEvent format consumed by subscribeEmbeddedPiSession
 * and its 6 handler modules.
 *
 * Event mapping (from implementation-plan.md Section 4.2.1):
 *   system/init             → store claudeSdkSessionId + emit agent_start
 *   stream_event            → real-time token streaming (text_delta, thinking_delta, etc.)
 *   assistant text content  → message_start + message_update (text_delta) + message_end
 *   result                  → agent_end
 *
 * NOTE: tool_execution_* events are emitted from mcp-tool-server.ts, NOT here.
 * This adapter handles text, thinking, lifecycle, streaming, and compaction events only.
 */

import type { EmbeddedPiSubscribeEvent } from "../pi-embedded-subscribe.handlers.types.js";
import type { ClaudeSdkEventAdapterState } from "./types.js";

// ---------------------------------------------------------------------------
// SDKMessage type definitions (from @anthropic-ai/claude-agent-sdk)
// We define minimal structural types to avoid depending on uninstalled pkg.
// ---------------------------------------------------------------------------

type SdkSystemInitMessage = {
  type: "system";
  subtype: "init";
  session_id: string;
};

type SdkContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

type SdkAssistantMessage = {
  type: "assistant";
  message: {
    role: "assistant";
    content: SdkContentBlock[];
    usage?: { input_tokens?: number; output_tokens?: number };
    model?: string;
    stop_reason?: string;
  };
};

type SdkResultMessage = {
  type: "result";
  subtype: string;
  result?: unknown;
};

// SDKCompactBoundaryMessage — emitted when the SDK compacts the conversation context.
// Confirmed in the official TypeScript reference. Handled in Phase 4.
type SdkCompactBoundaryMessage = {
  type: "system";
  subtype: "compact_boundary";
  session_id: string;
  compact_metadata: {
    trigger: "manual" | "auto";
    pre_tokens: number;
  };
};

// SdkResultErrorMessage — emitted when SDK execution fails with an error subtype.
// The subtype starts with "error_" (e.g. "error_during_execution", "error_max_turns").
type SdkResultErrorMessage = {
  type: "result";
  subtype: string;
  is_error?: boolean;
  errors?: unknown[];
};

// ---------------------------------------------------------------------------
// Stream event types (Anthropic streaming API events via includePartialMessages)
// ---------------------------------------------------------------------------

type SdkStreamEvent =
  | {
      type: "message_start";
      message: { role: "assistant"; content: unknown[]; usage?: unknown; model?: string };
    }
  | {
      type: "content_block_start";
      index: number;
      content_block: { type: string; id?: string; name?: string };
    }
  | {
      type: "content_block_delta";
      index: number;
      delta: { type: string; text?: string; thinking?: string; partial_json?: string };
    }
  | { type: "content_block_stop"; index: number }
  | { type: "message_delta"; delta: { stop_reason?: string }; usage?: unknown }
  | { type: "message_stop" };

type SdkPartialAssistantMessage = {
  type: "stream_event";
  event: SdkStreamEvent;
};

export type SdkMessage =
  | SdkSystemInitMessage
  | SdkAssistantMessage
  | SdkPartialAssistantMessage
  | SdkResultMessage
  | SdkResultErrorMessage
  | SdkCompactBoundaryMessage
  | Record<string, unknown>;

// ---------------------------------------------------------------------------
// Main translation function
// ---------------------------------------------------------------------------

/**
 * Translates a single Claude Agent SDK SDKMessage into one or more
 * EmbeddedPiSubscribeEvent events, emitted to all subscribers in state.
 *
 * This function is called for each message yielded by the query() generator.
 */
export function translateSdkMessageToEvents(
  message: SdkMessage,
  state: ClaudeSdkEventAdapterState,
): void {
  const emit = (evt: EmbeddedPiSubscribeEvent): void => {
    for (const subscriber of state.subscribers) {
      subscriber(evt);
    }
  };

  const msgType = (message as { type?: string }).type;

  // -------------------------------------------------------------------------
  // system/* — init and compact_boundary subtypes
  // -------------------------------------------------------------------------
  if (msgType === "system") {
    const subtype = (message as { subtype?: string }).subtype;

    if (subtype === "init") {
      // system/init — store session_id and emit agent_start
      const sessionId = (message as SdkSystemInitMessage).session_id;
      if (sessionId) {
        state.claudeSdkSessionId = sessionId;
      }
      emit({ type: "agent_start" } as EmbeddedPiSubscribeEvent);
    } else if (subtype === "compact_boundary") {
      // system/compact_boundary — server-side compaction signal.
      // SDKCompactBoundaryMessage confirmed in the official TypeScript API reference.
      // Emit synthetic auto_compaction_start/end for hook parity.
      // Include compact_metadata fields so handlers can populate tokenCount and
      // trigger in before_compaction/after_compaction hooks and onAgentEvent.
      const compactMsg = message as SdkCompactBoundaryMessage;
      const pre_tokens = compactMsg.compact_metadata?.pre_tokens;
      const trigger = compactMsg.compact_metadata?.trigger;
      state.compacting = true;
      emit({ type: "auto_compaction_start", pre_tokens, trigger } as EmbeddedPiSubscribeEvent);
      state.compacting = false;
      emit({
        type: "auto_compaction_end",
        willRetry: false,
        pre_tokens,
        trigger,
      } as EmbeddedPiSubscribeEvent);
    }
    // Other system subtypes are ignored
    return;
  }

  // -------------------------------------------------------------------------
  // stream_event — real-time streaming deltas (includePartialMessages: true)
  // -------------------------------------------------------------------------
  if (msgType === "stream_event") {
    const streamMsg = message as SdkPartialAssistantMessage;
    handleStreamEvent(streamMsg.event, state, emit);
    return;
  }

  // -------------------------------------------------------------------------
  // assistant — translate content blocks to message events
  // -------------------------------------------------------------------------
  if (msgType === "assistant") {
    const assistantMsg = (message as SdkAssistantMessage).message;
    if (!assistantMsg || assistantMsg.role !== "assistant") {
      return;
    }

    const content = assistantMsg.content ?? [];

    if (state.streamingInProgress) {
      // Stream events already emitted real-time events — skip re-emitting.
      state.streamingInProgress = false;
      state.streamingPartialMessage = null;
    } else {
      // Non-streaming fallback — keep existing event emission logic.
      translateAssistantContent(content, assistantMsg, emit);
    }

    // Persist to JSONL in both cases.
    persistAssistantMessage(message as SdkAssistantMessage, content, state);

    // Append assistant message to state.messages so that attempt.ts snapshots
    // (activeSession.messages.slice()) contain the current turn's output.
    const agentMsg = buildAgentMessage(assistantMsg, content);
    state.messages.push(agentMsg as never);
    return;
  }

  // -------------------------------------------------------------------------
  // result — emit agent_end; propagate error when subtype is "error_*"
  // -------------------------------------------------------------------------
  if (msgType === "result") {
    const resultMsg = message as SdkResultErrorMessage;
    // Detect error results: SDK sets subtype to "error_*" or is_error: true.
    if (resultMsg.subtype?.startsWith("error_") || resultMsg.is_error) {
      const firstErrorMsg =
        Array.isArray(resultMsg.errors) && resultMsg.errors.length > 0
          ? String(resultMsg.errors[0])
          : (resultMsg.subtype ?? "SDK execution error");
      // Store error message so prompt() throws after the for-await loop.
      // This prevents SDK failures from resolving successfully.
      state.sdkResultError = firstErrorMsg;
      // Also include error details on the agent_end event so subscribers
      // (e.g. hooks, monitoring) can inspect the failure without awaiting prompt().
      emit({
        type: "agent_end",
        error: { subtype: resultMsg.subtype, message: firstErrorMsg },
      } as EmbeddedPiSubscribeEvent);
    } else {
      emit({ type: "agent_end" } as EmbeddedPiSubscribeEvent);
    }
    return;
  }

  // Unknown message types are ignored
}

// ---------------------------------------------------------------------------
// Assistant content block translation
// ---------------------------------------------------------------------------

function translateAssistantContent(
  content: SdkContentBlock[],
  fullMessage: { role: string; content: SdkContentBlock[]; usage?: unknown },
  emit: (evt: EmbeddedPiSubscribeEvent) => void,
): void {
  // ALWAYS emit message_start for every assistant message.
  // handleMessageStart calls resetAssistantMessageState() which MUST fire
  // before any handleMessageUpdate (thinking or text) events.
  emitMessageStart(fullMessage, emit);

  for (const block of content) {
    if (block.type === "thinking") {
      translateThinkingBlock(block, fullMessage, emit);
    } else if (block.type === "text") {
      translateTextBlock(block, fullMessage, emit);
    }
    // tool_use blocks: events are emitted by MCP tool server handler, not here.
    // The handler's handleToolExecutionStart calls flushBlockReplyBuffer() +
    // onBlockReplyFlush() when it receives tool_execution_start, so no flush
    // event needs to be emitted here.
  }

  // ALWAYS emit message_end to close the message lifecycle.
  // This ensures text is finalized BEFORE any tool_execution_start from the
  // MCP handler (which runs after the async generator yields the next message).
  emitMessageEnd(fullMessage, emit);
}

// ---------------------------------------------------------------------------
// Thinking block translation
// ---------------------------------------------------------------------------

function translateThinkingBlock(
  block: { type: "thinking"; thinking: string },
  fullMessage: { role: string; content: SdkContentBlock[]; usage?: unknown },
  emit: (evt: EmbeddedPiSubscribeEvent) => void,
): void {
  const thinkingText = block.thinking ?? "";

  // Build AgentMessage-compatible object with structured thinking content
  const thinkingMessage = buildAgentMessage(fullMessage, [
    { type: "thinking", thinking: thinkingText },
  ]);

  // thinking_start
  emit({
    type: "message_update",
    message: thinkingMessage,
    assistantMessageEvent: { type: "thinking_start" },
  } as EmbeddedPiSubscribeEvent);

  // thinking_delta (full text as single delta — SDK gives us complete block, not streaming)
  emit({
    type: "message_update",
    message: thinkingMessage,
    assistantMessageEvent: {
      type: "thinking_delta",
      delta: thinkingText,
      content: thinkingText,
    },
  } as EmbeddedPiSubscribeEvent);

  // thinking_end
  emit({
    type: "message_update",
    message: thinkingMessage,
    assistantMessageEvent: { type: "thinking_end" },
  } as EmbeddedPiSubscribeEvent);
}

// ---------------------------------------------------------------------------
// Text block translation
// ---------------------------------------------------------------------------

function translateTextBlock(
  block: { type: "text"; text: string },
  fullMessage: { role: string; content: SdkContentBlock[]; usage?: unknown },
  emit: (evt: EmbeddedPiSubscribeEvent) => void,
): void {
  const text = block.text ?? "";
  const textMessage = buildAgentMessage(fullMessage, [{ type: "text", text }]);

  // text_delta — full text as single delta (SDK gives complete block at once)
  emit({
    type: "message_update",
    message: textMessage,
    assistantMessageEvent: {
      type: "text_delta",
      delta: text,
      content: text,
    },
  } as EmbeddedPiSubscribeEvent);

  // text_end — emitted with empty delta so deltaBuffer isn't double-appended.
  // Required for blockReplyBreak="text_end" consumers: handleMessageUpdate in
  // pi-embedded-subscribe.handlers.messages.ts calls flushBlockReplyBuffer() only
  // when evtType === "text_end". Without this, the flush fires at message_end
  // instead — functionally correct but diverges from Pi's streaming timing.
  // The handler's text_end branch sees deltaBuffer === content, computes
  // chunk = "" (no new text added), then executes the flush.
  emit({
    type: "message_update",
    message: textMessage,
    assistantMessageEvent: {
      type: "text_end",
      delta: "", // empty — deltaBuffer already holds the full text from text_delta
      content: text, // full content for the handler's monotonic suffix check
    },
  } as EmbeddedPiSubscribeEvent);
}

// ---------------------------------------------------------------------------
// Lifecycle event helpers
// ---------------------------------------------------------------------------

function emitMessageStart(
  fullMessage: { role: string; content: SdkContentBlock[]; usage?: unknown },
  emit: (evt: EmbeddedPiSubscribeEvent) => void,
): void {
  const message = buildAgentMessage(fullMessage, fullMessage.content);
  emit({
    type: "message_start",
    message,
  } as EmbeddedPiSubscribeEvent);
}

function emitMessageEnd(
  fullMessage: { role: string; content: SdkContentBlock[]; usage?: unknown },
  emit: (evt: EmbeddedPiSubscribeEvent) => void,
): void {
  const message = buildAgentMessage(fullMessage, fullMessage.content);
  emit({
    type: "message_end",
    message,
  } as EmbeddedPiSubscribeEvent);
}

// ---------------------------------------------------------------------------
// AgentMessage builder
// Constructs an AgentMessage-compatible object from an SDK assistant message.
// The handlers expect AgentMessage shape from @mariozechner/pi-agent-core.
// ---------------------------------------------------------------------------

function buildAgentMessage(
  sdkMessage: { role: string; content?: unknown; usage?: unknown },
  content: unknown[],
): unknown {
  return {
    role: sdkMessage.role,
    content,
    usage: sdkMessage.usage,
    id: `sdk-${Date.now()}`,
  };
}

// ---------------------------------------------------------------------------
// Stream event handler
// Translates Anthropic streaming events to Pi's event format for real-time UI.
// ---------------------------------------------------------------------------

function handleStreamEvent(
  event: SdkStreamEvent,
  state: ClaudeSdkEventAdapterState,
  emit: (evt: EmbeddedPiSubscribeEvent) => void,
): void {
  switch (event.type) {
    case "message_start": {
      state.streamingPartialMessage = {
        role: "assistant",
        content: [],
        usage: event.message.usage,
        model: event.message.model,
      };
      state.streamingBlockTypes.clear();
      state.streamingInProgress = true;
      const message = buildAgentMessage(state.streamingPartialMessage, []);
      emit({ type: "message_start", message } as EmbeddedPiSubscribeEvent);
      break;
    }

    case "content_block_start": {
      const blockType = event.content_block.type;
      state.streamingBlockTypes.set(event.index, blockType);
      if (blockType === "thinking") {
        const message = buildAgentMessage(
          state.streamingPartialMessage ?? { role: "assistant" },
          state.streamingPartialMessage?.content ?? [],
        );
        emit({
          type: "message_update",
          message,
          assistantMessageEvent: { type: "thinking_start" },
        } as EmbeddedPiSubscribeEvent);
      } else if (blockType === "text") {
        // text_start is implicit — first text_delta serves as start.
        // No explicit event needed here.
      }
      // tool_use: MCP handler owns tool events — skip.
      break;
    }

    case "content_block_delta": {
      if (!state.streamingPartialMessage) {
        break;
      }
      const deltaType = event.delta.type;

      if (deltaType === "text_delta" && event.delta.text !== undefined) {
        accumulateTextDelta(state.streamingPartialMessage, event.index, event.delta.text);
        const accumulated = getAccumulatedText(state.streamingPartialMessage, event.index);
        const message = buildAgentMessage(
          state.streamingPartialMessage,
          state.streamingPartialMessage.content,
        );
        emit({
          type: "message_update",
          message,
          assistantMessageEvent: {
            type: "text_delta",
            delta: event.delta.text,
            content: accumulated,
          },
        } as EmbeddedPiSubscribeEvent);
      } else if (deltaType === "thinking_delta" && event.delta.thinking !== undefined) {
        accumulateThinkingDelta(state.streamingPartialMessage, event.index, event.delta.thinking);
        const accumulated = getAccumulatedThinking(state.streamingPartialMessage, event.index);
        const message = buildAgentMessage(
          state.streamingPartialMessage,
          state.streamingPartialMessage.content,
        );
        emit({
          type: "message_update",
          message,
          assistantMessageEvent: {
            type: "thinking_delta",
            delta: event.delta.thinking,
            content: accumulated,
          },
        } as EmbeddedPiSubscribeEvent);
      }
      // input_json_delta: skip — MCP handler owns tool events.
      break;
    }

    case "content_block_stop": {
      const blockType = state.streamingBlockTypes.get(event.index);
      if (!state.streamingPartialMessage) {
        break;
      }

      if (blockType === "text") {
        const accumulated = getAccumulatedText(state.streamingPartialMessage, event.index);
        const message = buildAgentMessage(
          state.streamingPartialMessage,
          state.streamingPartialMessage.content,
        );
        emit({
          type: "message_update",
          message,
          assistantMessageEvent: {
            type: "text_end",
            delta: "",
            content: accumulated,
          },
        } as EmbeddedPiSubscribeEvent);
      } else if (blockType === "thinking") {
        const message = buildAgentMessage(
          state.streamingPartialMessage,
          state.streamingPartialMessage.content,
        );
        emit({
          type: "message_update",
          message,
          assistantMessageEvent: { type: "thinking_end" },
        } as EmbeddedPiSubscribeEvent);
      }
      state.streamingBlockTypes.delete(event.index);
      break;
    }

    case "message_delta": {
      if (state.streamingPartialMessage) {
        state.streamingPartialMessage.usage = event.usage;
      }
      break;
    }

    case "message_stop": {
      const message = buildAgentMessage(
        state.streamingPartialMessage ?? { role: "assistant" },
        state.streamingPartialMessage?.content ?? [],
      );
      emit({ type: "message_end", message } as EmbeddedPiSubscribeEvent);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Content accumulation helpers
// Build up partial message content during streaming.
// ---------------------------------------------------------------------------

function accumulateTextDelta(partial: { content: unknown[] }, index: number, text: string): void {
  const existing = partial.content[index] as { type: string; text?: string } | undefined;
  if (existing && existing.type === "text") {
    existing.text = (existing.text ?? "") + text;
  } else {
    partial.content[index] = { type: "text", text };
  }
}

function accumulateThinkingDelta(
  partial: { content: unknown[] },
  index: number,
  thinking: string,
): void {
  const existing = partial.content[index] as { type: string; thinking?: string } | undefined;
  if (existing && existing.type === "thinking") {
    existing.thinking = (existing.thinking ?? "") + thinking;
  } else {
    partial.content[index] = { type: "thinking", thinking };
  }
}

function getAccumulatedText(partial: { content: unknown[] }, index: number): string {
  const block = partial.content[index] as { type: string; text?: string } | undefined;
  return block?.type === "text" ? (block.text ?? "") : "";
}

function getAccumulatedThinking(partial: { content: unknown[] }, index: number): string {
  const block = partial.content[index] as { type: string; thinking?: string } | undefined;
  return block?.type === "thinking" ? (block.thinking ?? "") : "";
}

// ---------------------------------------------------------------------------
// JSONL persistence
// Converts SDK message to Pi AssistantMessage format and persists via sessionManager.
// ---------------------------------------------------------------------------

function persistAssistantMessage(
  sdkMessage: SdkAssistantMessage,
  content: SdkContentBlock[],
  state: ClaudeSdkEventAdapterState,
): void {
  if (!state.sessionManager?.appendMessage) {
    return;
  }

  try {
    const piContent = content.map((block) => {
      if (block.type === "tool_use") {
        return {
          type: "toolCall",
          id: block.id,
          name: block.name,
          arguments: block.input,
        };
      }
      // text and thinking blocks pass through as-is (identical shape)
      return block;
    });

    const sdkUsage = sdkMessage.message.usage as
      | { input_tokens?: number; output_tokens?: number }
      | undefined;
    const inputTokens = sdkUsage?.input_tokens ?? 0;
    const outputTokens = sdkUsage?.output_tokens ?? 0;

    const piMessage = {
      role: "assistant" as const,
      content: piContent,
      api: "anthropic-messages",
      provider: "anthropic",
      model: sdkMessage.message.model ?? "",
      stopReason: sdkMessage.message.stop_reason ?? "end_turn",
      usage: {
        input: inputTokens,
        output: outputTokens,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: inputTokens + outputTokens,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      timestamp: Date.now(),
    };

    state.sessionManager.appendMessage(piMessage);
  } catch {
    // Persistence failure is non-fatal
  }
}
