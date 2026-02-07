/**
 * Text Normalization Utilities for the Agent Execution Layer.
 *
 * Provides consistent text normalization for streaming and final replies.
 * These utilities consolidate logic previously scattered across:
 * - normalizeStreamingText() in src/auto-reply/reply/agent-runner-execution.ts
 * - stripReasoningTagsFromText() in src/shared/text/reasoning-tags.ts
 * - sanitizeUserFacingText() in src/agents/pi-embedded-helpers/errors.ts
 * - stripHeartbeatToken() in src/auto-reply/heartbeat.ts
 *
 * @see docs/design/plans/opus/01-agent-execution-layer.md
 */

import type { ReplyPayload } from "../auto-reply/types.js";
import { sanitizeUserFacingText } from "../agents/pi-embedded-helpers/errors.js";
import { stripCompactionHandoffText } from "../agents/pi-embedded-utils.js";
import { stripHeartbeatToken as legacyStripHeartbeatToken } from "../auto-reply/heartbeat.js";
import { isSilentReplyText, SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";
import { stripReasoningTagsFromText } from "../shared/text/reasoning-tags.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for text normalization.
 */
export interface NormalizationOptions {
  /** Whether to strip heartbeat tokens (default: true). */
  stripHeartbeat?: boolean;
  /** Whether to strip thinking/reasoning tags (default: true). */
  stripThinking?: boolean;
  /** Whether to strip silent reply tokens (default: true). */
  stripSilent?: boolean;
  /** Whether to strip compaction handoff text (default: true). */
  stripCompactionHandoff?: boolean;
  /** Whether to sanitize user-facing text (default: true). */
  sanitize?: boolean;
  /** Whether to normalize whitespace (default: true). */
  normalizeWhitespace?: boolean;
  /** Custom silent reply token. */
  silentToken?: string;
  /** Callback when heartbeat token is stripped. */
  onHeartbeatStrip?: () => void;
}

/**
 * Result of text normalization.
 */
export interface NormalizationResult {
  /** Normalized text (may be empty string). */
  text: string;
  /** Whether the result should be skipped (empty or silent). */
  shouldSkip: boolean;
  /** Whether any normalization was applied. */
  didNormalize: boolean;
  /** Whether heartbeat token was stripped. */
  didStripHeartbeat: boolean;
  /** Whether thinking tags were stripped. */
  didStripThinking: boolean;
}

/**
 * Configuration for block reply chunking.
 */
export interface BlockChunkingConfig {
  /** Minimum characters per chunk. */
  minChars: number;
  /** Maximum characters per chunk. */
  maxChars: number;
  /** Preferred break point: paragraph, newline, or sentence. */
  breakPreference: "paragraph" | "newline" | "sentence";
  /** Whether to flush on paragraph boundaries. */
  flushOnParagraph?: boolean;
}

// ---------------------------------------------------------------------------
// Core Normalization Functions
// ---------------------------------------------------------------------------

/**
 * Strip heartbeat tokens from text.
 *
 * Removes HEARTBEAT_OK tokens from the beginning and end of text,
 * and optionally the entire message if only heartbeat content.
 *
 * @param text - Input text
 * @param onStrip - Callback when token is stripped
 * @returns Object with stripped text and metadata
 */
export function stripHeartbeatTokens(
  text: string,
  onStrip?: () => void,
): { text: string; didStrip: boolean; shouldSkip: boolean } {
  if (!text) {
    return { text: "", didStrip: false, shouldSkip: true };
  }

  if (!text.includes("HEARTBEAT_OK")) {
    return { text, didStrip: false, shouldSkip: false };
  }

  const result = legacyStripHeartbeatToken(text, { mode: "message" });

  if (result.didStrip) {
    onStrip?.();
  }

  return {
    text: result.text,
    didStrip: result.didStrip,
    shouldSkip: result.shouldSkip,
  };
}

/**
 * Strip thinking/reasoning tags from text.
 *
 * Removes <thinking>, <thought>, <antThinking>, and <final> tags
 * while preserving content inside code blocks.
 *
 * @param text - Input text
 * @returns Cleaned text
 */
export function stripThinkingTags(text: string): string {
  if (!text) {
    return text;
  }

  return stripReasoningTagsFromText(text, {
    mode: "strict",
    trim: "both",
  });
}

/**
 * Normalize whitespace in text.
 *
 * Converts whitespace-only text to empty string and trims.
 *
 * @param text - Input text
 * @returns Normalized text (empty string if whitespace-only)
 */
export function normalizeWhitespace(text: string): string {
  if (!text) {
    return "";
  }

  const trimmed = text.trim();
  return trimmed || "";
}

/**
 * Check if text is a silent reply.
 *
 * @param text - Input text
 * @param silentToken - Silent reply token (default: NO_REPLY)
 * @returns True if text is a silent reply
 */
export function isSilentReply(text: string, silentToken?: string): boolean {
  return isSilentReplyText(text, silentToken ?? SILENT_REPLY_TOKEN);
}

/**
 * Deduplicate overlapping content between partial replies and block replies.
 *
 * When streaming, the same content may appear in both partial and block replies.
 * This function removes duplicated content from the final output.
 *
 * @param partials - Array of partial reply texts
 * @param blocks - Array of block reply texts
 * @returns Deduplicated final text
 */
export function deduplicateReplies(partials: string[], blocks: string[]): string {
  if (partials.length === 0 && blocks.length === 0) {
    return "";
  }

  // If no blocks, concatenate partials
  if (blocks.length === 0) {
    return partials.join("");
  }

  // If no partials, concatenate blocks
  if (partials.length === 0) {
    return blocks.join("\n\n");
  }

  // Build a set of normalized block content for deduplication
  const normalizedBlocks = new Set(blocks.map((b) => b.trim().toLowerCase()));

  // Filter partials that aren't already in blocks
  const uniquePartials = partials.filter((p) => {
    const normalized = p.trim().toLowerCase();
    return !normalizedBlocks.has(normalized);
  });

  // Combine unique partials with blocks
  const combined = [...uniquePartials, ...blocks];
  return combined.join("\n\n");
}

/**
 * Apply block chunking to text.
 *
 * Splits long text into chunks according to the configuration,
 * respecting preferred break points.
 *
 * @param text - Input text
 * @param config - Chunking configuration
 * @returns Array of text chunks
 */
export function applyBlockChunking(text: string, config: BlockChunkingConfig): string[] {
  if (!text || !config) {
    return text ? [text] : [];
  }

  const { minChars, maxChars, breakPreference, flushOnParagraph } = config;

  // If text is within limits, return as-is
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // If remaining fits, add and done
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    // Find a break point within maxChars
    let breakPoint = maxChars;

    // Try to find preferred break point
    const searchText = remaining.slice(0, maxChars);

    if (breakPreference === "paragraph" || flushOnParagraph) {
      // Look for double newline (paragraph)
      const paragraphBreak = searchText.lastIndexOf("\n\n");
      if (paragraphBreak >= minChars) {
        breakPoint = paragraphBreak + 2; // Include the newlines
      }
    }

    if (breakPoint === maxChars && breakPreference === "newline") {
      // Look for single newline
      const newlineBreak = searchText.lastIndexOf("\n");
      if (newlineBreak >= minChars) {
        breakPoint = newlineBreak + 1;
      }
    }

    if (breakPoint === maxChars && breakPreference === "sentence") {
      // Look for sentence end (. ! ?)
      const sentenceMatch = searchText.match(/[.!?]\s+(?=[A-Z])/g);
      if (sentenceMatch) {
        const lastSentence = searchText.lastIndexOf(sentenceMatch[sentenceMatch.length - 1]);
        if (lastSentence >= minChars) {
          breakPoint = lastSentence + sentenceMatch[sentenceMatch.length - 1].length;
        }
      }
    }

    // If no preferred break found, fall back to word boundary
    if (breakPoint === maxChars) {
      const spaceBreak = searchText.lastIndexOf(" ");
      if (spaceBreak >= minChars) {
        breakPoint = spaceBreak + 1;
      }
    }

    chunks.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  return chunks.filter((c) => c.length > 0);
}

// ---------------------------------------------------------------------------
// Combined Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize text using all rules in the correct order.
 *
 * Normalization order:
 * 1. Strip heartbeat tokens
 * 2. Strip thinking/reasoning tags
 * 3. Strip compaction handoff text
 * 4. Sanitize user-facing text
 * 5. Normalize whitespace
 * 6. Check for silent reply
 *
 * @param text - Input text
 * @param options - Normalization options
 * @returns Normalization result
 */
export function normalizeText(
  text: string | undefined,
  options: NormalizationOptions = {},
): NormalizationResult {
  const {
    stripHeartbeat = true,
    stripThinking = true,
    stripSilent = true,
    stripCompactionHandoff = true,
    sanitize = true,
    normalizeWhitespace: doNormalizeWhitespace = true,
    silentToken,
    onHeartbeatStrip,
  } = options;

  if (!text) {
    return {
      text: "",
      shouldSkip: true,
      didNormalize: false,
      didStripHeartbeat: false,
      didStripThinking: false,
    };
  }

  let result = text;
  let didNormalize = false;
  let didStripHeartbeat = false;
  let didStripThinking = false;

  // 1. Strip heartbeat tokens
  if (stripHeartbeat && result.includes("HEARTBEAT_OK")) {
    const heartbeatResult = stripHeartbeatTokens(result, onHeartbeatStrip);
    if (heartbeatResult.didStrip) {
      result = heartbeatResult.text;
      didNormalize = true;
      didStripHeartbeat = true;
    }
    if (heartbeatResult.shouldSkip) {
      return {
        text: "",
        shouldSkip: true,
        didNormalize,
        didStripHeartbeat,
        didStripThinking: false,
      };
    }
  }

  // 2. Check for silent reply early
  if (stripSilent && isSilentReply(result, silentToken)) {
    return {
      text: "",
      shouldSkip: true,
      didNormalize,
      didStripHeartbeat,
      didStripThinking: false,
    };
  }

  // 3. Sanitize user-facing text (handles API errors, role ordering, etc.)
  if (sanitize) {
    const sanitized = sanitizeUserFacingText(result);
    if (sanitized !== result) {
      result = sanitized;
      didNormalize = true;
    }
  }

  // 4. Strip compaction handoff text
  if (stripCompactionHandoff) {
    const withoutCompaction = stripCompactionHandoffText(result);
    if (withoutCompaction !== result) {
      result = withoutCompaction;
      didNormalize = true;
    }
  }

  // 5. Strip thinking/reasoning tags
  if (stripThinking) {
    const withoutThinking = stripThinkingTags(result);
    if (withoutThinking !== result) {
      result = withoutThinking;
      didNormalize = true;
      didStripThinking = true;
    }
  }

  // 6. Normalize whitespace
  if (doNormalizeWhitespace) {
    result = normalizeWhitespace(result);
  }

  // Final check - empty after normalization
  const shouldSkip = !result || !result.trim();

  return {
    text: result,
    shouldSkip,
    didNormalize,
    didStripHeartbeat,
    didStripThinking,
  };
}

/**
 * Normalize a reply payload (text + media).
 *
 * @param payload - Reply payload to normalize
 * @param options - Normalization options
 * @returns Normalized payload or null if should skip
 */
export function normalizePayload(
  payload: ReplyPayload,
  options: NormalizationOptions = {},
): ReplyPayload | null {
  const hasMedia = Boolean(payload.mediaUrl || (payload.mediaUrls?.length ?? 0) > 0);
  const hasChannelData = Boolean(
    payload.channelData && Object.keys(payload.channelData).length > 0,
  );

  const result = normalizeText(payload.text, options);

  // If no text and no media, skip
  if (result.shouldSkip && !hasMedia && !hasChannelData) {
    return null;
  }

  return {
    ...payload,
    text: result.text || undefined,
  };
}

// ---------------------------------------------------------------------------
// Streaming Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize streaming text for partial replies.
 *
 * This is the same normalization used during streaming,
 * optimized for incremental text processing.
 *
 * @param text - Streaming text chunk
 * @param options - Normalization options
 * @returns Object with text and skip flag
 */
export function normalizeStreamingText(
  text: string | undefined,
  options: NormalizationOptions = {},
): { text: string | undefined; skip: boolean } {
  const result = normalizeText(text, options);
  return {
    text: result.shouldSkip ? undefined : result.text,
    skip: result.shouldSkip,
  };
}
