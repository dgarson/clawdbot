import type { OpenClawConfig } from "../config/config.js";
import type { ReactionEscalationConfig } from "../config/types.reaction-escalation.js";

type OutcomeBase = NonNullable<ReactionEscalationConfig["outcome"]>;

export type ResolvedReactionEscalationConfig = ReactionEscalationConfig & {
  enabled: boolean;
  outcome: Required<Pick<OutcomeBase, "postReply" | "includePermalink">> &
    Pick<OutcomeBase, "digestChannel">;
  rateLimit: Required<NonNullable<ReactionEscalationConfig["rateLimit"]>>;
};

export function resolveReactionEscalationConfig(
  cfg: OpenClawConfig | undefined,
): ResolvedReactionEscalationConfig {
  const raw = cfg?.reactionEscalation ?? {};
  const outcome = raw.outcome ?? {};
  const rateLimit = raw.rateLimit ?? {};
  return {
    ...raw,
    enabled: raw.enabled ?? false,
    outcome: {
      postReply: outcome.postReply ?? true,
      digestChannel: outcome.digestChannel,
      includePermalink: outcome.includePermalink ?? true,
    },
    rateLimit: {
      maxPerMinute: rateLimit.maxPerMinute ?? 5,
      maxPerHour: rateLimit.maxPerHour ?? 30,
      cooldownPerMessageMs: rateLimit.cooldownPerMessageMs ?? 5000,
    },
  };
}
