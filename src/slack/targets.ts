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
 * Slack IDs (channel, user, DM, group) are always uppercase alphanumeric and start
 * with a known prefix letter (C, D, G, U, W). Uppercase the id when it matches that
 * shape so a lowercase id provided by the agent still succeeds. Name references
 * (e.g. "general", "dev-team") do not match this pattern and are left untouched.
 */
function normalizeSlackId(id: string): string {
  return /^[CUWGD][A-Z0-9]{8,}$/i.test(id) ? id.toUpperCase() : id;
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
    return { ...mentionTarget, id: normalizeSlackId(mentionTarget.id) };
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
    return { ...prefixedTarget, id: normalizeSlackId(prefixedTarget.id) };
  }
  if (trimmed.startsWith("@")) {
    const candidate = trimmed.slice(1).trim();
    const id = ensureTargetId({
      candidate,
      pattern: /^[A-Z0-9]+$/i,
      errorMessage: "Slack DMs require a user id (use user:<id> or <@id>)",
    });
    return buildMessagingTarget("user", normalizeSlackId(id), trimmed);
  }
  if (trimmed.startsWith("#")) {
    const candidate = trimmed.slice(1).trim();
    const id = ensureTargetId({
      candidate,
      pattern: /^[A-Z0-9]+$/i,
      errorMessage: "Slack channels require a channel id (use channel:<id>)",
    });
    return buildMessagingTarget("channel", normalizeSlackId(id), trimmed);
  }
  if (options.defaultKind) {
    return buildMessagingTarget(options.defaultKind, normalizeSlackId(trimmed), trimmed);
  }
  return buildMessagingTarget("channel", normalizeSlackId(trimmed), trimmed);
}

export function resolveSlackChannelId(raw: string): string {
  const target = parseSlackTarget(raw, { defaultKind: "channel" });
  return requireTargetKind({ platform: "Slack", target, kind: "channel" });
}
