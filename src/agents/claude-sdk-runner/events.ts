/**
 * SDK event bridging layer: Claude Agent SDK streaming messages -> Pi embedded event system.
 *
 * Converts SDK messages (SDKAssistantMessage, SDKPartialAssistantMessage, SDKStatusMessage)
 * to callbacks that match the pi-embedded subscription system for full parity.
 */

import type { ReasoningLevel } from "../../auto-reply/thinking.js";
import { parseReplyDirectives } from "../../auto-reply/reply/reply-directives.js";
import { emitAgentEvent } from "../../infra/agent-events.js";
import {
  extractThinkingFromTaggedStream,
  extractThinkingFromTaggedText,
  formatReasoningMessage,
  stripThinkingTagsFromText,
} from "../pi-embedded-utils.js";
import {
  isMessagingToolDuplicateNormalized,
  normalizeTextForComparison,
} from "../pi-embedded-helpers.js";
import { appendRawStream } from "../pi-embedded-subscribe.raw-stream.js";
import type { ClaudeSdkRunState } from "./types.js";
import { log } from "./logger.js";

/**
 * SDK message types from @anthropic-ai/claude-agent-sdk.
 * We define minimal interfaces for type safety without importing runtime deps.
 */

/** Content block types in SDK messages */
type SdkTextBlock = { type: "text"; text: string };
type SdkThinkingBlock = { type: "thinking"; thinking: string };
type SdkToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
type SdkContentBlock = SdkTextBlock | SdkThinkingBlock | SdkToolUseBlock | { type: string };

/** Stream event types from Anthropic SDK (BetaRawMessageStreamEvent) */
type StreamEventType =
  | "message_start"
  | "message_delta"
  | "message_stop"
  | "content_block_start"
  | "content_block_delta"
  | "content_block_stop";

type ContentBlockDelta =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; thinking: string }
  | { type: "input_json_delta"; partial_json: string };

type SdkStreamEvent = {
  type: StreamEventType;
  index?: number;
  content_block?: SdkContentBlock;
  delta?: ContentBlockDelta | { type: string; stop_reason?: string };
  message?: { id: string; role: string; content: SdkContentBlock[] };
};

/** Partial streaming message from SDK */
export type SdkPartialMessage = {
  type: "stream_event";
  event: SdkStreamEvent;
  parent_tool_use_id: string | null;
  uuid: string;
  session_id: string;
};

/** Complete assistant message from SDK */
export type SdkAssistantMessage = {
  type: "assistant";
  message: {
    id: string;
    type: "message";
    role: "assistant";
    content: SdkContentBlock[];
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: { input_tokens: number; output_tokens: number };
  };
  parent_tool_use_id: string | null;
  error?: { type: string; message: string };
  uuid: string;
  session_id: string;
};

/** Status message from SDK */
export type SdkStatusMessage = {
  type: "system";
  subtype: "status";
  status: "compacting" | null;
  permissionMode?: string;
  uuid: string;
  session_id: string;
};

/** Result message from SDK */
export type SdkResultMessage = {
  type: "result";
  result: unknown;
  uuid: string;
  session_id: string;
};

/** Union of SDK message types we handle */
export type SdkMessage =
  | SdkPartialMessage
  | SdkAssistantMessage
  | SdkStatusMessage
  | SdkResultMessage
  | { type: string; [key: string]: unknown };

/** Parameters for SDK event handler */
export type SdkEventHandlerParams = {
  runId: string;
  sessionId: string;
  state: ClaudeSdkRunState;
  reasoningMode: ReasoningLevel;
  shouldEmitPartialReplies?: boolean;
  onPartialReply?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  onAssistantMessageStart?: () => void | Promise<void>;
  onBlockReply?: (payload: {
    text?: string;
    mediaUrls?: string[];
    audioAsVoice?: boolean;
    replyToId?: string;
    replyToTag?: boolean;
    replyToCurrent?: boolean;
  }) => void | Promise<void>;
  onBlockReplyFlush?: () => void | Promise<void>;
  onReasoningStream?: (payload: { text?: string }) => void | Promise<void>;
  onAgentEvent?: (evt: { stream: string; data: Record<string, unknown> }) => void | Promise<void>;
};

/** SDK event handler state for tracking content blocks */
type ContentBlockState = {
  index: number;
  type: "text" | "thinking" | "tool_use" | "unknown";
  content: string;
};

/**
 * Create an SDK event handler that bridges SDK messages to pi-embedded callbacks.
 */
export function createSdkEventHandler(params: SdkEventHandlerParams) {
  const {
    runId,
    sessionId,
    state,
    reasoningMode,
    shouldEmitPartialReplies = true,
    onPartialReply,
    onAssistantMessageStart,
    onBlockReply,
    onReasoningStream,
    onAgentEvent,
  } = params;

  // Internal state for tracking message progress
  let assistantMessageStarted = false;
  let currentThinkingContent = "";
  let lastStreamedReasoning = "";
  let lastBlockReplyText = "";
  let lastReasoningSent = "";
  let isCompacting = false;

  // Track content blocks by index
  const contentBlocks = new Map<number, ContentBlockState>();

  const includeReasoning = reasoningMode === "on";
  const streamReasoning = reasoningMode === "stream";

  /**
   * Strip thinking tags and extract clean text for display.
   */
  function stripAndCleanText(text: string): string {
    return stripThinkingTagsFromText(text).trim();
  }

  /**
   * Emit reasoning stream callback when new reasoning content arrives.
   */
  function emitReasoningStream(reasoning: string) {
    if (!reasoning || reasoning === lastStreamedReasoning) {
      return;
    }
    lastStreamedReasoning = reasoning;
    void onReasoningStream?.({ text: reasoning });
  }

  /**
   * Handle stream_event messages (partial streaming content).
   */
  function handleStreamEvent(msg: SdkPartialMessage) {
    const event = msg.event;
    const eventType = event.type;

    log.trace(`stream event: ${eventType} index=${event.index ?? "-"}`);

    appendRawStream({
      ts: Date.now(),
      event: "sdk_stream_event",
      runId,
      sessionId,
      eventType,
      index: event.index,
    });

    switch (eventType) {
      case "message_start":
        handleMessageStart(event);
        break;
      case "content_block_start":
        handleContentBlockStart(event);
        break;
      case "content_block_delta":
        handleContentBlockDelta(event);
        break;
      case "content_block_stop":
        handleContentBlockStop(event);
        break;
      case "message_delta":
        // Message delta contains stop_reason; handled at message_stop
        break;
      case "message_stop":
        // Message complete; final handling in handleAssistantMessage
        break;
    }
  }

  /**
   * Handle message_start event - beginning of a new assistant message.
   */
  function handleMessageStart(_event: SdkStreamEvent) {
    if (!assistantMessageStarted) {
      assistantMessageStarted = true;
      log.debug(`assistant message started: runId=${runId}`);
      void onAssistantMessageStart?.();

      emitAgentEvent({
        runId,
        stream: "lifecycle",
        data: { phase: "assistant_message_start" },
      });
      void onAgentEvent?.({
        stream: "lifecycle",
        data: { phase: "assistant_message_start" },
      });
    }

    // Reset per-message state
    state.deltaBuffer = "";
    state.lastStreamedAssistant = undefined;
    currentThinkingContent = "";
    contentBlocks.clear();
  }

  /**
   * Handle content_block_start - beginning of a new content block.
   */
  function handleContentBlockStart(event: SdkStreamEvent) {
    const index = event.index ?? 0;
    const block = event.content_block;
    if (!block) {
      return;
    }

    let blockType: ContentBlockState["type"] = "unknown";
    let initialContent = "";

    if (block.type === "text") {
      blockType = "text";
      initialContent = (block as SdkTextBlock).text || "";
    } else if (block.type === "thinking") {
      blockType = "thinking";
      initialContent = (block as SdkThinkingBlock).thinking || "";
    } else if (block.type === "tool_use") {
      blockType = "tool_use";
    }

    contentBlocks.set(index, {
      index,
      type: blockType,
      content: initialContent,
    });
  }

  /**
   * Handle content_block_delta - incremental update to a content block.
   */
  function handleContentBlockDelta(event: SdkStreamEvent) {
    const index = event.index ?? 0;
    const delta = event.delta;
    if (!delta) {
      return;
    }

    const blockState = contentBlocks.get(index);
    if (!blockState) {
      return;
    }

    if (delta.type === "text_delta" && "text" in delta) {
      const textDelta = delta.text;
      blockState.content += textDelta;
      state.deltaBuffer += textDelta;

      // Handle partial <think> tags in streaming text
      if (streamReasoning) {
        const partialThinking = extractThinkingFromTaggedStream(state.deltaBuffer);
        if (partialThinking) {
          emitReasoningStream(partialThinking);
        }
      }

      // Emit partial reply with cleaned text
      const cleanedText = stripAndCleanText(state.deltaBuffer);
      if (cleanedText && cleanedText !== state.lastStreamedAssistant) {
        const previousText = state.lastStreamedAssistant ?? "";
        const { text: currentClean, mediaUrls } = parseReplyDirectives(cleanedText);
        const { text: previousClean } = parseReplyDirectives(previousText);

        if (currentClean.startsWith(previousClean)) {
          const deltaText = currentClean.slice(previousClean.length);
          state.lastStreamedAssistant = cleanedText;

          emitAgentEvent({
            runId,
            stream: "assistant",
            data: {
              text: currentClean,
              delta: deltaText,
              mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
            },
          });
          void onAgentEvent?.({
            stream: "assistant",
            data: {
              text: currentClean,
              delta: deltaText,
              mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
            },
          });

          if (onPartialReply && shouldEmitPartialReplies) {
            void onPartialReply({
              text: currentClean,
              mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
            });
          }
        }
      }
    } else if (delta.type === "thinking_delta" && "thinking" in delta) {
      const thinkingDelta = delta.thinking;
      blockState.content += thinkingDelta;
      currentThinkingContent += thinkingDelta;

      if (streamReasoning) {
        emitReasoningStream(currentThinkingContent);
      }
    }
  }

  /**
   * Handle content_block_stop - end of a content block.
   */
  function handleContentBlockStop(event: SdkStreamEvent) {
    const index = event.index ?? 0;
    const blockState = contentBlocks.get(index);
    if (!blockState) {
      return;
    }

    appendRawStream({
      ts: Date.now(),
      event: "sdk_content_block_stop",
      runId,
      sessionId,
      index,
      blockType: blockState.type,
      contentLength: blockState.content.length,
    });
  }

  /**
   * Handle complete assistant message from SDK.
   */
  function handleAssistantMessage(msg: SdkAssistantMessage) {
    const message = msg.message;
    if (!message || message.role !== "assistant") {
      return;
    }

    log.debug(
      `assistant message complete: runId=${runId} stopReason=${message.stop_reason ?? "none"} contentBlocks=${message.content.length}`,
    );

    // Extract text and thinking from content blocks
    const textBlocks: string[] = [];
    const thinkingBlocks: string[] = [];

    for (const block of message.content) {
      if (block.type === "text") {
        const textContent = stripAndCleanText((block as SdkTextBlock).text || "");
        if (textContent) {
          textBlocks.push(textContent);
        }
      } else if (block.type === "thinking") {
        const thinkingContent = ((block as SdkThinkingBlock).thinking || "").trim();
        if (thinkingContent) {
          thinkingBlocks.push(thinkingContent);
        }
      }
    }

    const rawText = textBlocks.join("\n").trim();
    const rawThinking =
      includeReasoning || streamReasoning
        ? thinkingBlocks.join("\n").trim() || extractThinkingFromTaggedText(rawText)
        : "";

    appendRawStream({
      ts: Date.now(),
      event: "sdk_assistant_message_end",
      runId,
      sessionId,
      rawText,
      rawThinking,
    });

    const text = rawText;
    const formattedReasoning = rawThinking ? formatReasoningMessage(rawThinking) : "";

    // Update assistant texts
    if (text && !state.assistantTexts.includes(text)) {
      state.assistantTexts.push(text);
    }

    // Emit reasoning before answer if includeReasoning mode
    const shouldEmitReasoning = Boolean(
      includeReasoning &&
      formattedReasoning &&
      onBlockReply &&
      formattedReasoning !== lastReasoningSent,
    );

    if (shouldEmitReasoning && formattedReasoning) {
      lastReasoningSent = formattedReasoning;
      void onBlockReply?.({ text: formattedReasoning });
    }

    // Emit final block reply (dedupe check against messaging tool sends)
    if (text && onBlockReply && text !== lastBlockReplyText) {
      const normalizedText = normalizeTextForComparison(text);
      if (
        isMessagingToolDuplicateNormalized(normalizedText, state.messagingToolSentTextsNormalized)
      ) {
        // Skip: already sent via messaging tool
      } else {
        lastBlockReplyText = text;
        const result = parseReplyDirectives(text);
        const { text: cleanedText, mediaUrls, audioAsVoice, replyToId, replyToCurrent } = result;
        if (cleanedText || (mediaUrls && mediaUrls.length > 0) || audioAsVoice) {
          void onBlockReply({
            text: cleanedText,
            mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
            audioAsVoice,
            replyToId,
            replyToTag: result.replyToTag,
            replyToCurrent,
          });
        }
      }
    }

    // Emit reasoning stream at end if streaming mode
    if (streamReasoning && rawThinking) {
      emitReasoningStream(rawThinking);
    }

    // Reset message state
    state.deltaBuffer = "";
    state.lastStreamedAssistant = undefined;
    assistantMessageStarted = false;
  }

  /**
   * Handle status message from SDK (e.g., compacting).
   */
  function handleStatusMessage(msg: SdkStatusMessage) {
    const newCompacting = msg.status === "compacting";

    if (newCompacting !== isCompacting) {
      isCompacting = newCompacting;
      const phase = newCompacting ? "compacting_start" : "compacting_end";

      log.debug(`compaction ${newCompacting ? "started" : "ended"}: runId=${runId}`);

      emitAgentEvent({
        runId,
        stream: "lifecycle",
        data: { phase },
      });
      void onAgentEvent?.({
        stream: "lifecycle",
        data: { phase },
      });

      appendRawStream({
        ts: Date.now(),
        event: "sdk_status",
        runId,
        sessionId,
        status: msg.status,
      });
    }
  }

  return {
    /**
     * Handle an SDK message of any type.
     */
    handleMessage(msg: SdkMessage): void {
      if (!msg || typeof msg !== "object") {
        return;
      }

      const msgType = msg.type;
      log.trace(`SDK message: type=${msgType}`);

      switch (msgType) {
        case "stream_event":
          handleStreamEvent(msg as SdkPartialMessage);
          break;
        case "assistant":
          handleAssistantMessage(msg as SdkAssistantMessage);
          break;
        case "system":
          if ((msg as SdkStatusMessage).subtype === "status") {
            handleStatusMessage(msg as SdkStatusMessage);
          }
          break;
        case "result":
          // Result messages are handled by the runner, not events
          break;
        default:
          // Unknown message type; log for debugging
          appendRawStream({
            ts: Date.now(),
            event: "sdk_unknown_message",
            runId,
            sessionId,
            msgType,
          });
      }
    },

    /**
     * Get accumulated assistant texts from the run.
     */
    getAssistantTexts(): string[] {
      return [...state.assistantTexts];
    },

    /**
     * Check if an assistant message is currently in progress.
     */
    isMessageInProgress(): boolean {
      return assistantMessageStarted;
    },

    /**
     * Reset handler state for a new run.
     */
    reset(): void {
      assistantMessageStarted = false;
      currentThinkingContent = "";
      lastStreamedReasoning = "";
      lastBlockReplyText = "";
      lastReasoningSent = "";
      isCompacting = false;
      contentBlocks.clear();
      state.deltaBuffer = "";
      state.lastStreamedAssistant = undefined;
    },
  };
}

/**
 * Extract text content from SDK assistant message content blocks.
 */
export function extractSdkAssistantText(content: SdkContentBlock[]): string {
  const textBlocks = content
    .filter((block): block is SdkTextBlock => block.type === "text")
    .map((block) => stripThinkingTagsFromText(block.text).trim())
    .filter(Boolean);
  return textBlocks.join("\n").trim();
}

/**
 * Extract thinking content from SDK assistant message content blocks.
 */
export function extractSdkAssistantThinking(content: SdkContentBlock[]): string {
  const thinkingBlocks = content
    .filter((block): block is SdkThinkingBlock => block.type === "thinking")
    .map((block) => block.thinking.trim())
    .filter(Boolean);
  return thinkingBlocks.join("\n").trim();
}
