/**
 * StreamingMiddleware — per-event-kind normalization pipeline.
 *
 * Replaces the uniform `normalizeStreamText()` gate with differentiated
 * handling: text_delta is gated by reasoning level, but block_reply and
 * tool results always pass through.
 */

import type { MessagingToolSend } from "../pi-embedded-messaging.js";
import type {
  RawStreamEvent,
  AgentStreamEvent,
  StreamMiddlewareConfig,
  DeliveryState,
  StreamEventListener,
} from "./types.js";
import { stripHeartbeatToken } from "../../auto-reply/heartbeat.js";
import { isSilentReplyText } from "../../auto-reply/tokens.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { stripReasoningTagsFromText } from "../../shared/text/reasoning-tags.js";
import { EmbeddedBlockChunker } from "../pi-embedded-block-chunker.js";
import { sanitizeUserFacingText } from "../pi-embedded-helpers/errors.js";
import {
  normalizeTextForComparison,
  isMessagingToolDuplicateNormalized,
} from "../pi-embedded-helpers/messaging-dedupe.js";
import { stripCompactionHandoffText } from "../pi-embedded-utils.js";
import { TypedEventEmitter } from "./emitter.js";

const log = createSubsystemLogger("agent/stream-middleware");

// ---------------------------------------------------------------------------
// StreamingMiddleware
// ---------------------------------------------------------------------------

export class StreamingMiddleware {
  readonly #config: StreamMiddlewareConfig;
  readonly #emitter = new TypedEventEmitter<AgentStreamEvent>();
  #chunker: EmbeddedBlockChunker | null = null;

  // Messaging tool dedup tracking
  #pendingMessagingTexts = new Map<string, string>();
  #pendingMessagingTargets = new Map<string, MessagingToolSend>();

  // Accumulated delivery state
  #delivery: DeliveryState = freshDeliveryState();

  constructor(config: StreamMiddlewareConfig) {
    this.#config = config;
    if (config.blockReplyChunking) {
      this.#chunker = new EmbeddedBlockChunker(config.blockReplyChunking);
    }
  }

  /** Accept a raw event from the runner and normalize it. */
  push(event: RawStreamEvent): void {
    log.trace("push: received raw event", {
      feature: "streaming",
      kind: event.kind,
      textLen: "text" in event && typeof event.text === "string" ? event.text.length : undefined,
    });
    switch (event.kind) {
      case "text_delta":
        this.#handleTextDelta(event);
        break;
      case "thinking_delta":
        this.#handleThinkingDelta(event);
        break;
      case "block_reply":
        this.#handleBlockReply(event);
        break;
      case "block_reply_flush":
        this.#handleBlockReplyFlush();
        break;
      case "tool_end":
        this.#handleToolEnd(event);
        break;
      case "tool_start":
        this.#emit({ kind: "tool_start", name: event.name, id: event.id });
        break;
      case "messaging_tool_start":
        this.#handleMessagingToolStart(event);
        break;
      case "messaging_tool_end":
        this.#handleMessagingToolEnd(event);
        break;
      case "message_start":
        this.#handleMessageStart();
        break;
      case "message_end":
        this.#handleMessageEnd();
        break;
      case "lifecycle":
        this.#emit(event);
        break;
      case "agent_event":
        this.#emit(event);
        break;
    }
  }

  subscribe(listener: StreamEventListener<AgentStreamEvent>): () => void {
    return this.#emitter.subscribe(listener);
  }

  /** Returns accumulated delivery state (replaces scattered flags). */
  getDeliveryState(): DeliveryState {
    return { ...this.#delivery };
  }

  /** Reset per-turn state (called between agent turns if needed). */
  reset(): void {
    this.#delivery = freshDeliveryState();
    this.#pendingMessagingTexts.clear();
    this.#pendingMessagingTargets.clear();
    this.#chunker?.reset();
  }

  destroy(): void {
    this.#emitter.removeAllListeners();
    this.#chunker?.reset();
    this.#chunker = null;
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  #handleTextDelta(event: { kind: "text_delta"; text: string }): void {
    const allowPartialStream = this.#config.reasoningLevel !== "stream";

    // When reasoning is streaming, text deltas are suppressed (reasoning
    // events carry the content instead).
    if (!allowPartialStream) {
      log.trace("handleTextDelta: suppressed (reasoning stream mode)", {
        feature: "streaming",
        textLen: event.text.length,
      });
      // Still feed the chunker so block replies accumulate text
      if (this.#chunker && this.#config.blockReplyBreak === "text_end") {
        this.#appendToChunker(event.text);
      }
      return;
    }

    const normalized = this.#normalizePartialText(event.text);
    if (normalized === undefined) {
      log.trace("handleTextDelta: normalized to skip", { feature: "streaming" });
      return;
    }

    // When chunking is active, text goes through the chunker → block_reply
    if (this.#chunker && this.#config.blockReplyBreak === "text_end") {
      log.trace("handleTextDelta: routing to chunker", {
        feature: "streaming",
        normalizedLen: normalized.length,
      });
      this.#appendToChunker(normalized);
      return;
    }

    log.trace("handleTextDelta: emitting partial_reply", {
      feature: "streaming",
      normalizedLen: normalized.length,
    });
    this.#emit({ kind: "partial_reply", text: normalized });
  }

  #handleThinkingDelta(event: { kind: "thinking_delta"; text: string }): void {
    // Reasoning events always pass through — not gated by allowPartialStream
    this.#emit({ kind: "reasoning", text: event.text });
  }

  #handleBlockReply(event: RawStreamEvent & { kind: "block_reply" }): void {
    // Block replies are NOT gated by reasoningLevel
    const text = stripReasoningTagsFromText(event.text, {
      mode: "strict",
      trim: "both",
    });
    if (!text.trim()) {
      log.trace("handleBlockReply: empty after reasoning strip", { feature: "streaming" });
      return;
    }

    // Check against messaging tool dedup
    if (this.#isBlockReplyDuplicate(text)) {
      log.debug("handleBlockReply: skipping duplicate (messaging tool dedup)", {
        feature: "streaming",
        textLen: text.length,
        textPreview: text.slice(0, 60),
      });
      return;
    }

    log.debug("handleBlockReply: emitting block_reply", {
      feature: "streaming",
      textLen: text.length,
      textPreview: text.slice(0, 60),
      hasMedia: Boolean(event.mediaUrls?.length),
      didStreamBlockReplyBefore: this.#delivery.didStreamBlockReply,
    });
    this.#delivery.didStreamBlockReply = true;
    this.#emit({
      kind: "block_reply",
      text,
      mediaUrls: event.mediaUrls,
      replyToId: event.replyToId,
      replyToTag: event.replyToTag,
      replyToCurrent: event.replyToCurrent,
      audioAsVoice: event.audioAsVoice,
    });
  }

  #handleBlockReplyFlush(): void {
    // Force drain the chunker, then pass through the event
    if (this.#chunker) {
      this.#drainChunker(true);
    }
    this.#emit({ kind: "block_reply_flush" });
  }

  #handleToolEnd(event: RawStreamEvent & { kind: "tool_end" }): void {
    // Tool results always pass through — not gated
    this.#emit({
      kind: "tool_end",
      name: event.name,
      id: event.id,
      isError: event.isError,
    });
    if (event.text) {
      const text = stripReasoningTagsFromText(event.text, {
        mode: "strict",
        trim: "both",
      });
      if (text.trim()) {
        this.#emit({
          kind: "tool_result",
          name: event.name,
          text,
          isError: event.isError,
        });
      }
    }
  }

  #handleMessagingToolStart(event: RawStreamEvent & { kind: "messaging_tool_start" }): void {
    if (event.text) {
      this.#pendingMessagingTexts.set(event.toolCallId, event.text);
    }
    if (event.target) {
      this.#pendingMessagingTargets.set(event.toolCallId, event.target);
    }
  }

  #handleMessagingToolEnd(event: RawStreamEvent & { kind: "messaging_tool_end" }): void {
    const text = this.#pendingMessagingTexts.get(event.toolCallId);
    const target = this.#pendingMessagingTargets.get(event.toolCallId);

    // Always clean up pending state
    this.#pendingMessagingTexts.delete(event.toolCallId);
    this.#pendingMessagingTargets.delete(event.toolCallId);

    if (event.isError) {
      return;
    }

    // Commit to delivery state on success
    this.#delivery.didSendViaMessagingTool = true;
    if (text) {
      this.#delivery.messagingToolSentTexts.push(text);
      this.#delivery.messagingToolSentTextsNormalized.push(normalizeTextForComparison(text));
    }
    if (target) {
      this.#delivery.messagingToolSentTargets.push(target);
    }

    this.#emit({
      kind: "delivery_receipt",
      text: text ?? "",
      target,
    });
  }

  #handleMessageStart(): void {
    // Flush chunker at message boundary
    const hasBuffered = this.#chunker?.hasBuffered() ?? false;
    log.debug("handleMessageStart: message boundary", {
      feature: "streaming",
      chunkerHasBuffered: hasBuffered,
    });
    if (hasBuffered) {
      this.#drainChunker(true);
    }
    this.#emit({ kind: "message_start" });
  }

  #handleMessageEnd(): void {
    // Drain remaining chunker content at message end
    const hasBuffered = this.#chunker?.hasBuffered() ?? false;
    log.debug("handleMessageEnd: message boundary", {
      feature: "streaming",
      chunkerHasBuffered: hasBuffered,
      deliveryState: {
        didStreamBlockReply: this.#delivery.didStreamBlockReply,
        didSendViaMessagingTool: this.#delivery.didSendViaMessagingTool,
        messagingToolSentCount: this.#delivery.messagingToolSentTexts.length,
      },
    });
    if (hasBuffered) {
      this.#drainChunker(true);
    }
    this.#emit({ kind: "message_end" });
  }

  // -----------------------------------------------------------------------
  // Text normalization (mirrors normalizeStreamText pipeline)
  // -----------------------------------------------------------------------

  /**
   * Normalize partial text — applies the same pipeline as normalizeStreamText:
   * heartbeat strip → silent check → sanitize → compaction strip → reasoning tag strip.
   * Returns undefined if the text should be skipped.
   */
  #normalizePartialText(text: string): string | undefined {
    if (!text) {
      return undefined;
    }

    // 1. Heartbeat token strip
    if (!this.#config.isHeartbeat && text.includes("HEARTBEAT_OK")) {
      const stripped = stripHeartbeatToken(text, { mode: "message" });
      if (stripped.shouldSkip) {
        return undefined;
      }
      text = stripped.text;
    }

    // 2. Silent reply check
    if (isSilentReplyText(text)) {
      return undefined;
    }

    if (!text) {
      return undefined;
    }

    // 3. Sanitize user-facing text
    const sanitized = sanitizeUserFacingText(text);

    // 4. Strip compaction handoff text
    const withoutCompaction = stripCompactionHandoffText(sanitized);
    if (!withoutCompaction.trim()) {
      return undefined;
    }

    // 5. Strip reasoning tags
    const reasoningStripped = stripReasoningTagsFromText(withoutCompaction, {
      mode: "strict",
      trim: "both",
    });
    if (!reasoningStripped.trim()) {
      return undefined;
    }

    return reasoningStripped;
  }

  // -----------------------------------------------------------------------
  // Block reply chunking
  // -----------------------------------------------------------------------

  #appendToChunker(text: string): void {
    if (!this.#chunker) {
      return;
    }
    this.#chunker.append(text);
    this.#drainChunker(false);
  }

  #drainChunker(force: boolean): void {
    if (!this.#chunker) {
      return;
    }
    log.trace("drainChunker: draining", { feature: "streaming", force });
    this.#chunker.drain({
      force,
      emit: (chunk: string) => {
        if (this.#isBlockReplyDuplicate(chunk)) {
          log.debug("drainChunker: skipping duplicate chunk", {
            feature: "streaming",
            chunkLen: chunk.length,
          });
          return;
        }
        log.debug("drainChunker: emitting block_reply from chunk", {
          feature: "streaming",
          chunkLen: chunk.length,
          chunkPreview: chunk.slice(0, 60),
        });
        this.#delivery.didStreamBlockReply = true;
        this.#emit({ kind: "block_reply", text: chunk });
      },
    });
  }

  // -----------------------------------------------------------------------
  // Dedup helpers
  // -----------------------------------------------------------------------

  #isBlockReplyDuplicate(text: string): boolean {
    if (this.#delivery.messagingToolSentTextsNormalized.length === 0) {
      return false;
    }
    const normalized = normalizeTextForComparison(text);
    return isMessagingToolDuplicateNormalized(
      normalized,
      this.#delivery.messagingToolSentTextsNormalized,
    );
  }

  // -----------------------------------------------------------------------
  // Internal emit
  // -----------------------------------------------------------------------

  #emit(event: AgentStreamEvent): void {
    this.#emitter.emit(event);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshDeliveryState(): DeliveryState {
  return {
    didStreamBlockReply: false,
    messagingToolSentTexts: [],
    messagingToolSentTargets: [],
    messagingToolSentTextsNormalized: [],
    didSendViaMessagingTool: false,
  };
}
