import type { SignalReaction } from "./types.js";

export function normalizeReactionName(raw: string): string {
  return raw
    .trim()
    .replace(/^:+|:+$/g, "")
    .toLowerCase();
}

export function classifyReaction(
  reaction: string,
  signals: SignalReaction[],
): SignalReaction | null {
  const normalized = normalizeReactionName(reaction);
  if (!normalized) {
    return null;
  }
  for (const signal of signals) {
    if (signal.emoji === normalized) {
      return signal;
    }
    const aliases = signal.aliases ?? [];
    if (aliases.some((alias) => normalizeReactionName(alias) === normalized)) {
      return signal;
    }
  }
  return null;
}
