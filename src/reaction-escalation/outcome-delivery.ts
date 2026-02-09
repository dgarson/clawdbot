import type { ResolvedReactionEscalationConfig } from "./config.js";
import type { EscalationIntent, ReactionEscalationAdapter } from "./types.js";

const STATUS_EMOJI = {
  ok: "✅",
  partial: "⚠️",
  error: "❌",
} as const;

const INTENT_LABELS: Record<EscalationIntent, string> = {
  "deep-dive": "Deep-dive complete",
  evaluate: "Evaluation complete",
  summarize: "Summary complete",
  urgent: "Urgent follow-up complete",
  prioritize: "Prioritized",
  ingest: "Ingested",
  bookmark: "Bookmarked",
};

function oneSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "Work complete.";
  }
  const match = trimmed.match(/(.+?[.!?])\s/);
  if (match?.[1]) {
    return match[1];
  }
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

export function formatOutcomeSummary(params: {
  intent: EscalationIntent;
  summary: string;
  status: "ok" | "partial" | "error";
}): string {
  const label = INTENT_LABELS[params.intent] ?? "Outcome";
  const summary = oneSentence(params.summary);
  return `${STATUS_EMOJI[params.status]} ${label}: ${summary}`;
}

export async function deliverOutcome(params: {
  adapter: ReactionEscalationAdapter;
  config: ResolvedReactionEscalationConfig;
  intent: EscalationIntent;
  channelId: string;
  messageTs: string;
  threadTs?: string;
  summary: string;
  outcomeUrl?: string | null;
  status: "ok" | "partial" | "error";
}): Promise<{ messageId?: string; digestId?: string }> {
  const formatted = formatOutcomeSummary({
    intent: params.intent,
    summary: params.summary,
    status: params.status,
  });
  const summary =
    params.config.outcome.includePermalink && params.outcomeUrl
      ? `${formatted}\n<${params.outcomeUrl}|View full details →>`
      : formatted;
  let messageId: string | undefined;
  if (params.config.outcome.postReply && params.adapter.postOutcome) {
    const result = await params.adapter.postOutcome({
      channelId: params.channelId,
      messageTs: params.messageTs,
      threadTs: params.threadTs,
      summary,
      outcomeUrl: params.outcomeUrl ?? undefined,
    });
    messageId = result?.messageId;
  }
  let digestId: string | undefined;
  if (params.config.outcome.digestChannel && params.adapter.postDigest) {
    const digest = await params.adapter.postDigest({
      channelId: params.config.outcome.digestChannel,
      summary: formatted,
      outcomeUrl: params.outcomeUrl ?? undefined,
    });
    digestId = digest?.messageId;
  }
  return { messageId, digestId };
}
