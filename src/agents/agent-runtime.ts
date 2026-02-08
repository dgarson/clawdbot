/**
 * AgentRuntime — common interface for agent execution backends.
 *
 * Both the Pi Agent and the Claude Code SDK Agent implement this interface,
 * allowing the dispatch layer to swap runtimes without changing downstream
 * reply pipeline code.
 */

import type { ImageContent } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../config/config.js";
import type { EmbeddedPiRunResult } from "./pi-embedded-runner/types.js";

// ---------------------------------------------------------------------------
// Runtime discriminant
// ---------------------------------------------------------------------------

/** Discriminant for the active agent runtime backend. */
export type AgentRuntimeKind = "pi" | "claude";

/** Multimodal payload with full support for voice, video, and pictures. */
export type AgentRuntimePayload = {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  /** Message ID to reply to (threading support). */
  replyToId?: string;
  /** Tag for reply threading. */
  replyToTag?: boolean;
  /** Reply to current message flag. */
  replyToCurrent?: boolean;
  /** Send audio as voice message (bubble) instead of audio file. Defaults to false. */
  audioAsVoice?: boolean;
  isError?: boolean;
  /** Channel-specific payload data (per-channel envelope). */
  channelData?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Common run parameters
// ---------------------------------------------------------------------------

/** Parameters shared by all agent runtimes for a single run. */
export type AgentRuntimeRunParams = {
  sessionId: string;
  sessionKey?: string;
  sessionFile: string;
  workspaceDir: string;
  agentDir?: string;
  config?: OpenClawConfig;
  prompt: string;
  extraSystemPrompt?: string;
  ownerNumbers?: string[];
  timeoutMs: number;
  runId: string;
  abortSignal?: AbortSignal;
  /** Optional inbound images/audio/video (multimodal input support). */
  images?: ImageContent[];
  /** When true, only content inside `<final>` tags is returned (for non-Claude models). */
  enforceFinalTag?: boolean;
  /** Block reply break mode for streaming block replies during the run. */
  blockReplyBreak?: "text_end" | "message_end";
  /** Chunking configuration for block replies. */
  blockReplyChunking?: {
    minChars: number;
    maxChars: number;
    breakPreference?: "paragraph" | "newline" | "sentence";
    flushOnParagraph?: boolean;
  };
  /** StreamingMiddleware instance for normalized event delivery. */
  streamMiddleware?: import("./stream/index.js").StreamingMiddleware;
  /** Called with partial text chunks as they are generated. */
  onPartialReply?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  /** Called with accumulated text blocks at message/text boundaries. */
  onBlockReply?: (payload: {
    text?: string;
    mediaUrls?: string[];
    replyToId?: string;
    replyToTag?: boolean;
    replyToCurrent?: boolean;
    audioAsVoice?: boolean;
  }) => void | Promise<void>;
  /** Called with reasoning/thinking text as it streams. */
  onReasoningStream?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  /** Whether tool results should be emitted via onToolResult. */
  shouldEmitToolResult?: (() => boolean) | boolean;
  /** Whether tool output text should be emitted via onToolResult. */
  shouldEmitToolOutput?: (() => boolean) | boolean;
  /** Called with tool result output text. */
  onToolResult?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  /** Called with agent lifecycle/diagnostic events. */
  onAgentEvent?: (evt: unknown) => void | Promise<void>;
  /** Called when an assistant message starts. */
  onAssistantMessageStart?: () => void | Promise<void>;
};

// ---------------------------------------------------------------------------
// Result type (same shape for all runtimes)
// ---------------------------------------------------------------------------

/**
 * All runtimes produce `EmbeddedPiRunResult` so the downstream reply
 * pipeline can consume results without knowing which runtime produced them.
 */
export type AgentRuntimeResult = EmbeddedPiRunResult;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Common interface for agent execution backends.
 *
 * Implementations capture runtime-specific configuration at construction
 * time (via factory functions), then expose a single `run()` method that
 * accepts only the common parameters shared across all runtimes.
 */
export interface AgentRuntime {
  /** Discriminant identifying which backend is active. */
  readonly kind: AgentRuntimeKind;

  /** Human-readable name for logging and diagnostics. */
  readonly displayName: string;

  /** Execute the agent with the given parameters. */
  run(params: AgentRuntimeRunParams): Promise<AgentRuntimeResult>;
}
