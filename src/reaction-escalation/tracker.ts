import type { RuntimeEnv } from "../runtime.js";
import type { ResolvedReactionEscalationConfig } from "./config.js";
import type { EscalationOutcome, ReactionEscalationAdapter } from "./types.js";
import { callGateway } from "../gateway/call.js";
import { fetchOutcomeSummaryFromSession } from "./dispatcher.js";
import { deliverOutcome } from "./outcome-delivery.js";

const DEFAULT_WAIT_TIMEOUT_MS = 20 * 60_000;

const PROCESSING_REACTION = "eyes";
const SUCCESS_REACTION = "white_check_mark";
const FAILURE_REACTION = "x";

type TrackedSession = {
  outcome: EscalationOutcome;
  reactionTarget?: { channelId: string; messageTs: string };
};

export class ReactionEscalationTracker {
  private pending = new Map<string, TrackedSession>();

  constructor(
    private deps: {
      config: ResolvedReactionEscalationConfig;
      adapter: ReactionEscalationAdapter;
      runtime?: RuntimeEnv;
    },
  ) {}

  trackSession(params: {
    outcome: EscalationOutcome;
    sessionKey: string;
    runId: string;
    reactionTarget?: { channelId: string; messageTs: string };
  }) {
    this.pending.set(params.runId, {
      outcome: params.outcome,
      reactionTarget: params.reactionTarget,
    });
    void this.waitForCompletion(params.runId, params.sessionKey).catch((err) => {
      this.deps.runtime?.error?.(`reaction escalation wait failed: ${String(err)}`);
    });
  }

  private async waitForCompletion(runId: string, sessionKey: string) {
    const timeoutMs = DEFAULT_WAIT_TIMEOUT_MS;
    const wait = await callGateway<{ status?: string; error?: string }>({
      method: "agent.wait",
      params: { runId, timeoutMs },
      timeoutMs: timeoutMs + 10_000,
    });
    const tracked = this.pending.get(runId);
    if (!tracked) {
      return;
    }
    this.pending.delete(runId);

    const { outcome, reactionTarget } = tracked;
    const status = wait?.status === "ok" ? "ok" : wait?.status === "error" ? "error" : "partial";
    const summary = await fetchOutcomeSummaryFromSession({
      sessionKey,
      fallback: status === "ok" ? "Work complete." : "Work did not complete.",
    });
    outcome.completedAt = Date.now();
    outcome.status = status === "ok" ? "completed" : "failed";
    outcome.summary = summary;

    let outcomeUrl: string | null = null;
    if (this.deps.adapter.buildPermalink && outcome.sourceChannelId) {
      outcomeUrl = await this.deps.adapter.buildPermalink({
        channelId: outcome.sourceChannelId,
        messageTs: outcome.sourceMessageTs,
        threadTs: outcome.sourceThreadTs,
      });
    }

    const delivered = await deliverOutcome({
      adapter: this.deps.adapter,
      config: this.deps.config,
      intent: outcome.intent,
      channelId: outcome.sourceChannelId,
      messageTs: outcome.sourceMessageTs,
      threadTs: outcome.sourceThreadTs,
      summary,
      outcomeUrl,
      status,
    });
    if (delivered.messageId) {
      outcome.outcomeMessageTs = delivered.messageId;
    }
    if (outcomeUrl) {
      outcome.outcomePermalink = outcomeUrl;
    }

    // Update reactions now that the session has completed
    if (reactionTarget) {
      const { channelId, messageTs } = reactionTarget;
      if (this.deps.adapter.removeReaction) {
        try {
          await this.deps.adapter.removeReaction({
            channelId,
            messageTs,
            reaction: PROCESSING_REACTION,
          });
        } catch {
          // ignore
        }
      }
      if (this.deps.adapter.addReaction) {
        try {
          const reaction = outcome.status === "completed" ? SUCCESS_REACTION : FAILURE_REACTION;
          await this.deps.adapter.addReaction({ channelId, messageTs, reaction });
        } catch {
          // ignore
        }
      }
    }
  }
}
