export type ReactionEscalationIntent =
  | "prioritize"
  | "deep-dive"
  | "ingest"
  | "bookmark"
  | "summarize"
  | "urgent"
  | "evaluate";

export type ReactionEscalationSignalConfig = {
  /** Canonical emoji name (without colons). */
  emoji: string;
  /** Intent to trigger when reaction is detected. */
  intent: ReactionEscalationIntent;
  /** Alternative emoji aliases that map to the same intent. */
  aliases?: string[];
  /** Optional description of what the signal does. */
  description?: string;
  /** Whether this intent spawns an isolated agent session. */
  spawnsSession?: boolean;
  /** Default priority for any work item created. */
  defaultPriority?: "critical" | "high" | "medium" | "low";
  /** Prompt template for spawned agent sessions. */
  agentPrompt?: string;
};

export type ReactionEscalationOutcomeConfig = {
  /** Post summary back as reply in the original thread. */
  postReply?: boolean;
  /** Optional digest channel to post outcomes to (channel id or name). */
  digestChannel?: string;
  /** Include a permalink to the outcome message. */
  includePermalink?: boolean;
};

export type ReactionEscalationRateLimitConfig = {
  /** Maximum reaction escalations per minute (per user). */
  maxPerMinute?: number;
  /** Maximum reaction escalations per hour (per user). */
  maxPerHour?: number;
  /** Cooldown to prevent duplicate processing per message (ms). */
  cooldownPerMessageMs?: number;
};

export type ReactionEscalationConfig = {
  enabled?: boolean;
  /** Channel IDs (e.g. "slack") to monitor; empty/undefined = all supported. */
  channels?: string[];
  /** Allowed user IDs for triggering escalations (empty = all). */
  allowedUsers?: Array<string | number>;
  /** Override or extend default signal reactions. */
  signals?: ReactionEscalationSignalConfig[];
  /** Outcome delivery settings. */
  outcome?: ReactionEscalationOutcomeConfig;
  /** Rate limit settings. */
  rateLimit?: ReactionEscalationRateLimitConfig;
};
