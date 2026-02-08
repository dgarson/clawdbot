/**
 * Agent stream event types — Phase 1 of stream normalization.
 *
 * Two event layers:
 * - RawStreamEvent: emitted by provider runners into the middleware
 * - AgentStreamEvent: normalized output consumed by the delivery pipeline
 */

import type { BlockReplyChunking } from "../pi-embedded-block-chunker.js";
import type { MessagingToolSend } from "../pi-embedded-messaging.js";

// ---------------------------------------------------------------------------
// Raw events — what runners produce
// ---------------------------------------------------------------------------

export type RawStreamEvent =
  | { kind: "text_delta"; text: string }
  | { kind: "thinking_delta"; text: string }
  | { kind: "message_start" }
  | { kind: "message_end" }
  | {
      kind: "tool_start";
      name: string;
      id: string;
      args?: Record<string, unknown>;
    }
  | {
      kind: "tool_end";
      name: string;
      id: string;
      isError?: boolean;
      text?: string;
    }
  | {
      kind: "block_reply";
      text: string;
      mediaUrls?: string[];
      replyToId?: string;
      replyToTag?: boolean;
      replyToCurrent?: boolean;
      audioAsVoice?: boolean;
    }
  | { kind: "block_reply_flush" }
  | {
      kind: "messaging_tool_start";
      toolName: string;
      toolCallId: string;
      text?: string;
      target?: MessagingToolSend;
    }
  | {
      kind: "messaging_tool_end";
      toolName: string;
      toolCallId: string;
      isError: boolean;
    }
  | {
      kind: "lifecycle";
      phase: "start" | "end" | "error";
      data: Record<string, unknown>;
    }
  | {
      kind: "agent_event";
      stream: string;
      data: Record<string, unknown>;
    };

// ---------------------------------------------------------------------------
// Normalized events — what consumers receive
// ---------------------------------------------------------------------------

export type AgentStreamEvent =
  | { kind: "partial_reply"; text: string; mediaUrls?: string[] }
  | {
      kind: "block_reply";
      text: string;
      mediaUrls?: string[];
      replyToId?: string;
      replyToTag?: boolean;
      replyToCurrent?: boolean;
      audioAsVoice?: boolean;
    }
  | { kind: "reasoning"; text: string }
  | { kind: "tool_result"; name: string; text: string; isError?: boolean }
  | { kind: "tool_start"; name: string; id: string }
  | { kind: "tool_end"; name: string; id: string; isError?: boolean }
  | { kind: "message_start" }
  | { kind: "message_end" }
  | { kind: "block_reply_flush" }
  | {
      kind: "delivery_receipt";
      text: string;
      target?: MessagingToolSend;
    }
  | {
      kind: "lifecycle";
      phase: "start" | "end" | "error";
      data: Record<string, unknown>;
    }
  | {
      kind: "agent_event";
      stream: string;
      data: Record<string, unknown>;
    };

// ---------------------------------------------------------------------------
// Configuration & state
// ---------------------------------------------------------------------------

export type StreamMiddlewareConfig = {
  /** Controls reasoning/thinking event handling. */
  reasoningLevel?: "off" | "stream" | "tags";
  /** When true, heartbeat token stripping uses "heartbeat" mode. */
  isHeartbeat?: boolean;
  /** When to break accumulated text into block replies. */
  blockReplyBreak?: "text_end" | "message_end";
  /** Block reply chunking config — when set, enables EmbeddedBlockChunker. */
  blockReplyChunking?: BlockReplyChunking;
};

/** Accumulated delivery state — replaces scattered boolean/set flags. */
export type DeliveryState = {
  didStreamBlockReply: boolean;
  messagingToolSentTexts: string[];
  messagingToolSentTargets: MessagingToolSend[];
  messagingToolSentTextsNormalized: string[];
  didSendViaMessagingTool: boolean;
};

export type StreamEventListener<T> = (event: T) => void | Promise<void>;
