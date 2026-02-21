import {
  buildMessagingTarget,
  ensureTargetId,
  parseTargetMention,
  parseTargetPrefixes,
  requireTargetKind,
  type MessagingTarget,
  type MessagingTargetKind,
  type MessagingTargetParseOptions,
} from "../channels/targets.js";

export type SlackTargetKind = MessagingTargetKind;

export type SlackTarget = MessagingTarget;

type SlackTargetParseOptions = MessagingTargetParseOptions;

/**
 * Returns true if the value looks like a Slack channel/user ID (e.g. C01234ABCDE)
 * rather than a human-readable name (e.g. "general").
 *
 * Slack IDs start with C, G, D, or W and always contain at least one digit.
 */
function isSlackId(candidate: string): boolean {
  return /^[CGDW][A-Z0-9]*[0-9][A-Z0-9]*$/i.test(candidate);
}

export function parseSlackTarget(
  raw: string,
  options: SlackTargetParseOptions = {},
): SlackTarget | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const mentionTarget = parseTargetMention({
    raw: trimmed,
    mentionPattern: /^<@([A-Z0-9]+)>$/i,
    kind: "user",
  });
  if (mentionTarget) {
    return mentionTarget;
  }
  const prefixedTarget = parseTargetPrefixes({
    raw: trimmed,
    prefixes: [
      { prefix: "user:", kind: "user" },
      { prefix: "channel:", kind: "channel" },
      { prefix: "slack:", kind: "user" },
    ],
  });
  if (prefixedTarget) {
    return prefixedTarget;
  }
  if (trimmed.startsWith("@")) {
    const candidate = trimmed.slice(1).trim();
    const id = ensureTargetId({
      candidate,
      pattern: /^[A-Z0-9]+$/i,
      errorMessage: "Slack DMs require a user id (use user:<id> or <@id>)",
    });
    return buildMessagingTarget("user", id, trimmed);
  }
  if (trimmed.startsWith("#")) {
    const candidate = trimmed.slice(1).trim();
    if (!candidate) {
      return undefined;
    }
    // If it looks like a Slack channel ID, uppercase and return directly.
    // Otherwise treat as a channel name — the caller is responsible for async lookup.
    if (isSlackId(candidate)) {
      return buildMessagingTarget("channel", candidate.toUpperCase(), trimmed);
    }
    return buildMessagingTarget("channel", candidate, trimmed);
  }
  if (options.defaultKind) {
    return buildMessagingTarget(options.defaultKind, trimmed, trimmed);
  }
  return buildMessagingTarget("channel", trimmed, trimmed);
}

export function resolveSlackChannelId(raw: string): string {
  const target = parseSlackTarget(raw, { defaultKind: "channel" });
  const id = requireTargetKind({ platform: "Slack", target, kind: "channel" });
  // Uppercase if it looks like a Slack channel ID (e.g. c123 → C123).
  return isSlackId(id) ? id.toUpperCase() : id;
}
