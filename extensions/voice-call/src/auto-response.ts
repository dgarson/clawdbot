import type { CallDirection } from "./types.js";

export type AutoResponseSource = "stream" | "webhook";

export type AutoResponseDecisionInput = {
  direction: CallDirection;
  mode?: string;
  transcript: string;
  hasPendingTranscriptWaiter: boolean;
};

export type AutoResponseDecision = {
  shouldRespond: boolean;
  reason: string;
};

/**
 * Decide whether a recognized transcript should trigger automatic agent response.
 *
 * Rules:
 * - Never auto-respond empty transcripts.
 * - Never auto-respond while an explicit continue-call waiter is pending.
 * - Always auto-respond for inbound calls.
 * - Auto-respond for outbound calls only in conversation mode.
 */
export function resolveAutoResponseDecision(
  input: AutoResponseDecisionInput,
): AutoResponseDecision {
  const transcript = input.transcript.trim();
  if (!transcript) {
    return {
      shouldRespond: false,
      reason: "transcript-empty",
    };
  }

  if (input.hasPendingTranscriptWaiter) {
    return {
      shouldRespond: false,
      reason: "pending-transcript-waiter",
    };
  }

  if (input.direction === "inbound") {
    return {
      shouldRespond: true,
      reason: "inbound-call",
    };
  }

  if (input.mode === "conversation") {
    return {
      shouldRespond: true,
      reason: "outbound-conversation-mode",
    };
  }

  return {
    shouldRespond: false,
    reason: `outbound-mode-${input.mode ?? "unset"}`,
  };
}
