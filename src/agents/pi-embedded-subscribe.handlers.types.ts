import type { AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";
import type { ReplyDirectiveParseResult } from "../auto-reply/reply/reply-directives.js";
import type { ReasoningLevel } from "../auto-reply/thinking.js";
import type { InlineCodeState } from "../markdown/code-spans.js";
import type { EmbeddedBlockChunker } from "./pi-embedded-block-chunker.js";
import type { MessagingToolSend } from "./pi-embedded-messaging.js";
import type {
  BlockReplyChunking,
  SubscribeEmbeddedPiSessionParams,
} from "./pi-embedded-subscribe.types.js";
import type { RawStreamEvent, StreamingMiddleware } from "./stream/index.js";
import type { NormalizedUsage } from "./usage.js";

export type EmbeddedSubscribeLogger = {
  trace: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
};

export type ToolErrorSummary = {
  toolName: string;
  meta?: string;
  error?: string;
};

export type EmbeddedPiSubscribeState = {
  assistantTexts: string[];
  toolMetas: Array<{ toolName?: string; meta?: string }>;
  toolMetaById: Map<string, string | undefined>;
  toolArgsById: Map<string, unknown>;
  toolSummaryById: Set<string>;
  lastToolError?: ToolErrorSummary;

  blockReplyBreak: "text_end" | "message_end";
  reasoningMode: ReasoningLevel;
  includeReasoning: boolean;
  shouldEmitPartialReplies: boolean;
  streamReasoning: boolean;
  /**
   * When true, reasoning is prefixed to block replies instead of using onReasoningStream.
   * This should be false/undefined for channels (Discord, Slack, etc.) to prevent
   * reasoning from leaking into channel messages.
   */
  emitReasoningInBlockReply: boolean;

  deltaBuffer: string;
  blockBuffer: string;
  blockState: { thinking: boolean; final: boolean; inlineCode: InlineCodeState };
  partialBlockState: { thinking: boolean; final: boolean; inlineCode: InlineCodeState };
  lastStreamedAssistant?: string;
  lastStreamedAssistantCleaned?: string;
  emittedAssistantUpdate: boolean;
  lastStreamedReasoning?: string;
  lastBlockReplyText?: string;
  assistantMessageIndex: number;
  lastAssistantTextMessageIndex: number;
  lastAssistantTextNormalized?: string;
  lastAssistantTextTrimmed?: string;
  assistantTextBaseline: number;
  suppressBlockChunks: boolean;
  lastReasoningSent?: string;

  compactionInFlight: boolean;
  pendingCompactionRetry: number;
  compactionRetryResolve?: () => void;
  compactionRetryPromise: Promise<void> | null;

  messagingToolSentTexts: string[];
  messagingToolSentTextsNormalized: string[];
  messagingToolSentTargets: MessagingToolSend[];
  pendingMessagingTexts: Map<string, string>;
  pendingMessagingTargets: Map<string, MessagingToolSend>;
};

export type EmbeddedPiSubscribeContext = {
  params: SubscribeEmbeddedPiSessionParams;
  state: EmbeddedPiSubscribeState;
  log: EmbeddedSubscribeLogger;
  /** True when block reply events have at least one sink (middleware or legacy callback). */
  hasBlockReplySink: boolean;
  /** True when reasoning stream events have at least one sink (middleware or legacy callback). */
  hasReasoningStreamSink: boolean;
  /** True when tool result events have at least one sink (middleware or legacy callback). */
  hasToolResultSink: boolean;
  /** When present, raw stream events are pushed to the middleware alongside legacy callbacks. */
  streamMiddleware?: StreamingMiddleware;
  /** Unified raw stream emitter (middleware first, callback bridge second). */
  emitRawStreamEvent: (event: RawStreamEvent) => void;
  blockChunking?: BlockReplyChunking;
  blockChunker: EmbeddedBlockChunker | null;

  shouldEmitToolResult: () => boolean;
  shouldEmitToolOutput: () => boolean;
  emitToolSummary: (toolName?: string, meta?: string) => void;
  emitToolOutput: (toolName?: string, meta?: string, output?: string) => void;
  stripBlockTags: (
    text: string,
    state: { thinking: boolean; final: boolean; inlineCode?: InlineCodeState },
  ) => string;
  emitBlockChunk: (text: string) => void;
  flushBlockReplyBuffer: () => void;
  emitReasoningStream: (text: string) => void;
  consumeReplyDirectives: (
    text: string,
    options?: { final?: boolean },
  ) => ReplyDirectiveParseResult | null;
  consumePartialReplyDirectives: (
    text: string,
    options?: { final?: boolean },
  ) => ReplyDirectiveParseResult | null;
  resetAssistantMessageState: (nextAssistantTextBaseline: number) => void;
  resetForCompactionRetry: () => void;
  finalizeAssistantTexts: (args: {
    text: string;
    addedDuringMessage: boolean;
    chunkerHasBuffered: boolean;
  }) => void;
  trimMessagingToolSent: () => void;
  ensureCompactionPromise: () => void;
  noteCompactionRetry: () => void;
  resolveCompactionRetry: () => void;
  maybeResolveCompactionWait: () => void;
  recordAssistantUsage: (usage: unknown) => void;
  incrementCompactionCount: () => void;
  getUsageTotals: () => NormalizedUsage | undefined;
  getCompactionCount: () => number;
};

export type EmbeddedPiSubscribeEvent =
  | AgentEvent
  | { type: string; [k: string]: unknown }
  | { type: "message_start"; message: AgentMessage };
