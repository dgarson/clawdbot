/**
 * Voice channel normalizer - converts voice call input to MsgContext.
 *
 * This enables voice calls to use the unified agent runtime infrastructure,
 * providing consistent behavior with other channels (history limiting,
 * session management, fallback handling).
 */

import type { MsgContext } from "../../../auto-reply/templating.js";

export type VoiceInputParams = {
  /** Unique call identifier */
  callId: string;
  /** Caller's phone number (E.164 format) */
  from: string;
  /** Transcribed user message */
  transcript: string;
  /** Optional caller name if known */
  callerName?: string;
  /** Optional timestamp (defaults to now) */
  timestamp?: number;
  /** Optional agent ID override */
  agentId?: string;
};

/**
 * Normalize voice call input to standard MsgContext for the unified runtime.
 *
 * Returns a partial MsgContext suitable for voice calls. Voice-specific
 * metadata is stored in the VoiceMetadata field as a typed object.
 */
export function normalizeVoiceInput(params: VoiceInputParams): MsgContext {
  const { callId, from, transcript, callerName, timestamp, agentId } = params;
  const now = timestamp ?? Date.now();
  const messageId = `${callId}:${now}`;

  // Build voice-specific metadata object
  const voiceMetadata = {
    isVoiceCall: true,
    callId,
    ...(agentId && { agentIdOverride: agentId }),
  };

  return {
    // Text content
    Body: transcript,
    BodyForAgent: transcript,
    RawBody: transcript,
    CommandBody: transcript,
    BodyForCommands: transcript,

    // Identity
    From: from,
    SenderId: from,
    SenderE164: from,
    SenderName: callerName ?? from,

    // Session management
    SessionKey: `voice:call:${callId}`,

    // Message identification
    MessageSid: messageId,

    // Channel metadata
    Provider: "voice",
    ChatType: "voice",
    Timestamp: now,

    // Voice-specific metadata stored in UntrustedContext for passthrough
    // (this allows the runtime to identify voice calls without type changes)
    UntrustedContext: [`[voice-metadata]: ${JSON.stringify(voiceMetadata)}`],
  };
}

/**
 * Extract voice metadata from a MsgContext if present.
 */
export function extractVoiceMetadata(
  ctx: MsgContext,
): { isVoiceCall: boolean; callId: string; agentIdOverride?: string } | null {
  const metadataEntry = ctx.UntrustedContext?.find((s) => s.startsWith("[voice-metadata]:"));
  if (!metadataEntry) {
    return null;
  }
  try {
    const json = metadataEntry.slice("[voice-metadata]:".length).trim();
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Check if a MsgContext originated from a voice call.
 */
export function isVoiceCallContext(ctx: MsgContext): boolean {
  return ctx.Provider === "voice" || extractVoiceMetadata(ctx) !== null;
}
