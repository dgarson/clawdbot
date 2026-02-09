import type { ReactionEscalationSignalConfig } from "../config/types.reaction-escalation.js";
import type { SignalReaction } from "./types.js";

export const DEFAULT_SIGNAL_REACTIONS: SignalReaction[] = [
  {
    emoji: "star",
    aliases: ["star2", "glowing_star"],
    intent: "prioritize",
    description: "Elevate to high priority in work queue",
    spawnsSession: false,
    defaultPriority: "high",
  },
  {
    emoji: "brain",
    intent: "deep-dive",
    description: "Spawn deep analysis session",
    spawnsSession: true,
    defaultPriority: "high",
    agentPrompt:
      "Perform a thorough deep-dive analysis on the following message/topic. " +
      "Examine it from multiple angles, identify key insights, potential issues, " +
      "and actionable recommendations. Be comprehensive but concise in your output.",
  },
  {
    emoji: "inbox_tray",
    intent: "ingest",
    description: "Ingest into long-term memory",
    spawnsSession: false,
    defaultPriority: "medium",
  },
  {
    emoji: "pushpin",
    aliases: ["round_pushpin"],
    intent: "bookmark",
    description: "Save as reference bookmark",
    spawnsSession: false,
    defaultPriority: "low",
  },
  {
    emoji: "memo",
    aliases: ["pencil"],
    intent: "summarize",
    description: "Generate thread summary",
    spawnsSession: true,
    defaultPriority: "medium",
    agentPrompt:
      "Summarize the following message/thread concisely. " +
      "Extract key points, decisions, and action items.",
  },
  {
    emoji: "fire",
    intent: "urgent",
    description: "Immediate high-priority processing",
    spawnsSession: true,
    defaultPriority: "critical",
    agentPrompt:
      "This has been flagged as URGENT. Process immediately with highest priority. " +
      "Analyze the content, determine what action is needed, and execute it.",
  },
  {
    emoji: "microscope",
    intent: "evaluate",
    description: "Detailed evaluation and critique",
    spawnsSession: true,
    defaultPriority: "high",
    agentPrompt:
      "Perform a detailed evaluation and critique of the following content. " +
      "Assess quality, identify gaps, and suggest improvements.",
  },
];

function normalizeEmoji(raw: string) {
  return raw
    .trim()
    .replace(/^:+|:+$/g, "")
    .toLowerCase();
}

function mergeSignal(
  base: SignalReaction,
  override: ReactionEscalationSignalConfig,
): SignalReaction {
  return {
    ...base,
    emoji: normalizeEmoji(override.emoji),
    intent: override.intent ?? base.intent,
    aliases: override.aliases ?? base.aliases,
    description: override.description ?? base.description,
    spawnsSession: override.spawnsSession ?? base.spawnsSession,
    defaultPriority: override.defaultPriority ?? base.defaultPriority,
    agentPrompt: override.agentPrompt ?? base.agentPrompt,
  };
}

export function resolveSignalVocabulary(
  overrides: ReactionEscalationSignalConfig[] | undefined,
): SignalReaction[] {
  if (!overrides || overrides.length === 0) {
    return DEFAULT_SIGNAL_REACTIONS.slice();
  }
  const byEmoji = new Map(DEFAULT_SIGNAL_REACTIONS.map((entry) => [entry.emoji, entry]));
  for (const override of overrides) {
    const emoji = normalizeEmoji(override.emoji);
    if (!emoji || !override.intent) {
      continue;
    }
    const existing = byEmoji.get(emoji);
    if (existing) {
      byEmoji.set(emoji, mergeSignal(existing, { ...override, emoji }));
      continue;
    }
    byEmoji.set(emoji, {
      emoji,
      intent: override.intent,
      aliases: override.aliases,
      description: override.description ?? "Custom reaction escalation",
      spawnsSession: override.spawnsSession ?? false,
      defaultPriority: override.defaultPriority ?? "medium",
      agentPrompt: override.agentPrompt,
    });
  }
  return Array.from(byEmoji.values());
}
