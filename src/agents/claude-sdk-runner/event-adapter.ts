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
 * NOTE: tool_execution_start/end events are emitted from mcp-tool-server.ts.
 * This adapter emits tool_execution_update for SDK-native tool progress/summary
 * messages, plus text/thinking/lifecycle/streaming/compaction events.
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
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
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
    willRetry?: boolean;
    will_retry?: boolean;
  };
  willRetry?: boolean;
  will_retry?: boolean;
};

// SdkResultErrorMessage — emitted when SDK execution fails with an error subtype.
// The subtype starts with "error_" (e.g. "error_during_execution", "error_max_turns").
type SdkResultErrorMessage = {
  type: "result";
  subtype: string;
  is_error?: boolean;
  errors?: unknown[];
  result?: unknown;
};

type SdkToolProgressMessage = {
  type: "tool_progress";
  tool_use_id: string;
  tool_name: string;
  parent_tool_use_id: string | null;
  elapsed_time_seconds: number;
  task_id?: string;
};

type SdkToolUseSummaryMessage = {
  type: "tool_use_summary";
  summary: string;
  preceding_tool_use_ids: string[];
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
  | SdkToolProgressMessage
  | SdkToolUseSummaryMessage
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

  if (msgType === "tool_progress") {
    const progress = message as SdkToolProgressMessage;
    const toolCallId = progress.tool_use_id;
    const toolName = progress.tool_name;
    if (toolCallId) {
      state.toolNameByUseId.set(toolCallId, toolName);
      emit({
        type: "tool_execution_update",
        toolName,
        toolCallId,
        partialResult: {
          sdkType: "tool_progress",
          elapsedTimeSeconds: progress.elapsed_time_seconds,
          taskId: progress.task_id,
          parentToolUseId: progress.parent_tool_use_id,
        },
      } as EmbeddedPiSubscribeEvent);
    }
    return;
  }

  if (msgType === "tool_use_summary") {
    const summary = message as SdkToolUseSummaryMessage;
    for (const toolCallId of summary.preceding_tool_use_ids ?? []) {
      if (!toolCallId) {
        continue;
      }
      emit({
        type: "tool_execution_update",
        toolName: state.toolNameByUseId.get(toolCallId) ?? "unknown_tool",
        toolCallId,
        partialResult: {
          sdkType: "tool_use_summary",
          summary: summary.summary,
          precedingToolUseIds: summary.preceding_tool_use_ids,
        },
      } as EmbeddedPiSubscribeEvent);
    }
    return;
  }

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
      const willRetry = extractCompactionWillRetry(compactMsg);
      state.compacting = true;
      emit({ type: "auto_compaction_start", pre_tokens, trigger } as EmbeddedPiSubscribeEvent);
      state.compacting = false;
      emit({
        type: "auto_compaction_end",
        willRetry,
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
      translateAssistantContent(
        content,
        assistantMsg,
        emit,
        allocateMessageId(state, assistantMsg),
        state,
      );
    }

    // Persist to JSONL in both cases.
    persistAssistantMessage(message as SdkAssistantMessage, content, state);
    rememberPendingToolUses(state, content);

    // Append assistant message to state.messages so that attempt.ts snapshots
    // (activeSession.messages.slice()) contain the current turn's output.
    const agentMsg = buildAgentMessage(
      assistantMsg,
      content,
      state.streamingMessageId ?? allocateMessageId(state, assistantMsg),
      state,
    );
    state.messages.push(agentMsg as never);
    state.streamingMessageId = null;
    return;
  }

  // -------------------------------------------------------------------------
  // result — emit agent_end; propagate error when subtype is "error_*"
  // -------------------------------------------------------------------------
  if (msgType === "result") {
    const resultMsg = message as SdkResultErrorMessage;
    // Detect error results: SDK sets subtype to "error_*" or is_error: true.
    if (resultMsg.subtype?.startsWith("error_") || resultMsg.is_error) {
      const firstErrorMsg = extractSdkResultErrorMessage(resultMsg);
      // Store error message so prompt() throws after the for-await loop.
      // This prevents SDK failures from resolving successfully.
      state.sdkResultError = firstErrorMsg;
      state.messages.push(
        buildAgentMessage(
          {
            role: "assistant",
            content: [{ type: "text", text: firstErrorMsg }],
            stop_reason: "error",
            errorMessage: firstErrorMsg,
          },
          [{ type: "text", text: firstErrorMsg }],
          allocateMessageId(state),
          state,
        ) as never,
      );
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

function allocateMessageId(state: ClaudeSdkEventAdapterState, message?: unknown): string {
  const explicitId =
    message && typeof message === "object" ? (message as { id?: unknown }).id : undefined;
  if (typeof explicitId === "string" && explicitId.length > 0) {
    return explicitId;
  }
  state.messageIdCounter += 1;
  return `sdk-msg-${state.messageIdCounter}`;
}

function extractCompactionWillRetry(message: SdkCompactBoundaryMessage): boolean {
  const directWillRetry =
    typeof message.willRetry === "boolean"
      ? message.willRetry
      : typeof message.will_retry === "boolean"
        ? message.will_retry
        : undefined;
  if (typeof directWillRetry === "boolean") {
    return directWillRetry;
  }
  const metadataWillRetry =
    typeof message.compact_metadata?.willRetry === "boolean"
      ? message.compact_metadata.willRetry
      : typeof message.compact_metadata?.will_retry === "boolean"
        ? message.compact_metadata.will_retry
        : undefined;
  return Boolean(metadataWillRetry);
}

function rememberPendingToolUses(
  state: ClaudeSdkEventAdapterState,
  content: SdkContentBlock[],
): void {
  for (const block of content) {
    if (block.type !== "tool_use") {
      continue;
    }
    state.pendingToolUses.push({
      id: block.id,
      name: block.name,
      input: block.input,
    });
    state.toolNameByUseId.set(block.id, block.name);
  }
}

function extractSdkResultErrorMessage(resultMsg: SdkResultErrorMessage): string {
  if (Array.isArray(resultMsg.errors) && resultMsg.errors.length > 0) {
    const first = resultMsg.errors[0];
    if (typeof first === "string" && first.trim().length > 0) {
      return first.trim();
    }
    if (first && typeof first === "object") {
      const nestedMessage = (first as { message?: unknown }).message;
      if (typeof nestedMessage === "string" && nestedMessage.trim().length > 0) {
        return nestedMessage.trim();
      }
    }
    return String(first);
  }

  if (typeof resultMsg.result === "string" && resultMsg.result.trim().length > 0) {
    return resultMsg.result.trim();
  }
  if (resultMsg.result && typeof resultMsg.result === "object") {
    const nestedMessage = (resultMsg.result as { message?: unknown }).message;
    if (typeof nestedMessage === "string" && nestedMessage.trim().length > 0) {
      return nestedMessage.trim();
    }
  }

  if (typeof resultMsg.subtype === "string" && resultMsg.subtype.startsWith("error_")) {
    return resultMsg.subtype;
  }
  return "SDK execution error";
}

// ---------------------------------------------------------------------------
// Assistant content block translation
// ---------------------------------------------------------------------------

function translateAssistantContent(
  content: SdkContentBlock[],
  fullMessage: {
    role: string;
    content: SdkContentBlock[];
    usage?: unknown;
    model?: string;
    stop_reason?: string;
  },
  emit: (evt: EmbeddedPiSubscribeEvent) => void,
  messageId: string,
  state: ClaudeSdkEventAdapterState,
): void {
  // ALWAYS emit message_start for every assistant message.
  // handleMessageStart calls resetAssistantMessageState() which MUST fire
  // before any handleMessageUpdate (thinking or text) events.
  emitMessageStart(fullMessage, emit, messageId, state);

  for (const block of content) {
    if (block.type === "thinking") {
      translateThinkingBlock(block, fullMessage, emit, messageId, state);
    } else if (block.type === "text") {
      translateTextBlock(block, fullMessage, emit, messageId, state);
    }
    // tool_use blocks: events are emitted by MCP tool server handler, not here.
    // The handler's handleToolExecutionStart calls flushBlockReplyBuffer() +
    // onBlockReplyFlush() when it receives tool_execution_start, so no flush
    // event needs to be emitted here.
  }

  // ALWAYS emit message_end to close the message lifecycle.
  // This ensures text is finalized BEFORE any tool_execution_start from the
  // MCP handler (which runs after the async generator yields the next message).
  emitMessageEnd(fullMessage, emit, messageId, state);
}

// ---------------------------------------------------------------------------
// Thinking block translation
// ---------------------------------------------------------------------------

function translateThinkingBlock(
  block: { type: "thinking"; thinking: string },
  fullMessage: {
    role: string;
    content: SdkContentBlock[];
    usage?: unknown;
    model?: string;
    stop_reason?: string;
  },
  emit: (evt: EmbeddedPiSubscribeEvent) => void,
  messageId: string,
  state: ClaudeSdkEventAdapterState,
): void {
  const thinkingText = block.thinking ?? "";

  // Build AgentMessage-compatible object with structured thinking content
  const thinkingMessage = buildAgentMessage(
    fullMessage,
    [{ type: "thinking", thinking: thinkingText }],
    messageId,
    state,
  );

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
  fullMessage: {
    role: string;
    content: SdkContentBlock[];
    usage?: unknown;
    model?: string;
    stop_reason?: string;
  },
  emit: (evt: EmbeddedPiSubscribeEvent) => void,
  messageId: string,
  state: ClaudeSdkEventAdapterState,
): void {
  const text = block.text ?? "";
  const textMessage = buildAgentMessage(fullMessage, [{ type: "text", text }], messageId, state);

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
  fullMessage: {
    role: string;
    content: SdkContentBlock[];
    usage?: unknown;
    model?: string;
    stop_reason?: string;
  },
  emit: (evt: EmbeddedPiSubscribeEvent) => void,
  messageId: string,
  state: ClaudeSdkEventAdapterState,
): void {
  const message = buildAgentMessage(fullMessage, fullMessage.content, messageId, state);
  emit({
    type: "message_start",
    message,
  } as EmbeddedPiSubscribeEvent);
}

function emitMessageEnd(
  fullMessage: {
    role: string;
    content: SdkContentBlock[];
    usage?: unknown;
    model?: string;
    stop_reason?: string;
  },
  emit: (evt: EmbeddedPiSubscribeEvent) => void,
  messageId: string,
  state: ClaudeSdkEventAdapterState,
): void {
  const message = buildAgentMessage(fullMessage, fullMessage.content, messageId, state);
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
  sdkMessage: {
    role: string;
    content?: unknown;
    usage?: unknown;
    model?: string;
    stop_reason?: string;
    stopReason?: string;
    errorMessage?: string;
  },
  content: unknown[],
  messageId: string,
  state: Pick<ClaudeSdkEventAdapterState, "transcriptProvider" | "transcriptApi">,
): unknown {
  const stopReason = sdkMessage.stop_reason ?? sdkMessage.stopReason;
  return {
    role: sdkMessage.role,
    content,
    usage: sdkMessage.usage,
    id: messageId,
    provider: state.transcriptProvider,
    api: state.transcriptApi,
    model: sdkMessage.model,
    stopReason,
    errorMessage: sdkMessage.errorMessage,
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
      const messageId = allocateMessageId(state, event.message);
      state.streamingPartialMessage = {
        role: "assistant",
        content: [],
        usage: event.message.usage,
        model: event.message.model,
      };
      state.streamingMessageId = messageId;
      state.streamingBlockTypes.clear();
      state.streamingInProgress = true;
      const message = buildAgentMessage(state.streamingPartialMessage, [], messageId, state);
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
          state.streamingMessageId ?? allocateMessageId(state),
          state,
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
          state.streamingMessageId ?? allocateMessageId(state),
          state,
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
          state.streamingMessageId ?? allocateMessageId(state),
          state,
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
          state.streamingMessageId ?? allocateMessageId(state),
          state,
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
          state.streamingMessageId ?? allocateMessageId(state),
          state,
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
        const priorUsage =
          state.streamingPartialMessage.usage &&
          typeof state.streamingPartialMessage.usage === "object"
            ? (state.streamingPartialMessage.usage as Record<string, unknown>)
            : undefined;
        const deltaUsage =
          event.usage && typeof event.usage === "object"
            ? (event.usage as Record<string, unknown>)
            : undefined;
        if (priorUsage && deltaUsage) {
          state.streamingPartialMessage.usage = { ...priorUsage, ...deltaUsage };
        } else {
          state.streamingPartialMessage.usage = event.usage;
        }
      }
      break;
    }

    case "message_stop": {
      const message = buildAgentMessage(
        state.streamingPartialMessage ?? { role: "assistant" },
        state.streamingPartialMessage?.content ?? [],
        state.streamingMessageId ?? allocateMessageId(state),
        state,
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
      | {
          input_tokens?: number;
          output_tokens?: number;
          cache_read_input_tokens?: number;
          cache_creation_input_tokens?: number;
        }
      | undefined;
    const inputTokens = sdkUsage?.input_tokens ?? 0;
    const outputTokens = sdkUsage?.output_tokens ?? 0;
    const cacheReadTokens = sdkUsage?.cache_read_input_tokens ?? 0;
    const cacheWriteTokens = sdkUsage?.cache_creation_input_tokens ?? 0;
    const usageCost = state.modelCost
      ? {
          input: (inputTokens * state.modelCost.input) / 1_000_000,
          output: (outputTokens * state.modelCost.output) / 1_000_000,
          cacheRead: (cacheReadTokens * state.modelCost.cacheRead) / 1_000_000,
          cacheWrite: (cacheWriteTokens * state.modelCost.cacheWrite) / 1_000_000,
        }
      : undefined;
    const usageCostTotal = usageCost
      ? usageCost.input + usageCost.output + usageCost.cacheRead + usageCost.cacheWrite
      : undefined;

    const piMessage = {
      role: "assistant" as const,
      content: piContent,
      api: state.transcriptApi,
      provider: state.transcriptProvider,
      model: sdkMessage.message.model ?? "",
      stopReason: sdkMessage.message.stop_reason ?? "end_turn",
      usage: {
        input: inputTokens,
        output: outputTokens,
        cacheRead: cacheReadTokens,
        cacheWrite: cacheWriteTokens,
        totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens,
        ...(usageCost
          ? {
              cost: {
                input: usageCost.input,
                output: usageCost.output,
                cacheRead: usageCost.cacheRead,
                cacheWrite: usageCost.cacheWrite,
                total: usageCostTotal,
              },
            }
          : {}),
      },
      timestamp: Date.now(),
    };

    state.sessionManager.appendMessage(piMessage);
  } catch {
    // Persistence failure is non-fatal
  }
}
