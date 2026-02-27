import type { StructuredContextInput } from "./types.js";

export const THREAD_BUDGET_TOKENS = 8_000;
export const SNIPPET_MAX_CHARS = 150;

export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

export function truncateSnippet(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= SNIPPET_MAX_CHARS) {
    return normalized;
  }
  return normalized.slice(0, SNIPPET_MAX_CHARS - 1) + "…";
}

type RawReply = NonNullable<StructuredContextInput["thread"]>["replies"][number];

export function applyThreadBudget(params: { replies: RawReply[]; budgetTokens?: number }): {
  included: RawReply[];
  truncation: {
    total_replies: number;
    included_replies: number;
    strategy: "most_recent";
    omitted_range_ts: [string, string] | null;
  };
} {
  const budget = params.budgetTokens ?? THREAD_BUDGET_TOKENS;
  const replies = params.replies;

  // Work backwards from most recent
  let tokenCount = 0;
  const includedReversed: RawReply[] = [];
  for (let i = replies.length - 1; i >= 0; i--) {
    const reply = replies[i];
    const cost = estimateTokens(reply.text);
    if (tokenCount + cost > budget && includedReversed.length > 0) {
      break;
    }
    tokenCount += cost;
    includedReversed.push(reply);
  }
  const included = includedReversed.toReversed();

  const omittedCount = replies.length - included.length;
  const omitted_range_ts: [string, string] | null =
    omittedCount > 0 && replies.length > 0 && included.length < replies.length
      ? [replies[0].ts, replies[replies.length - included.length - 1].ts]
      : null;

  return {
    included,
    truncation: {
      total_replies: replies.length,
      included_replies: included.length,
      strategy: "most_recent" as const,
      omitted_range_ts,
    },
  };
}
