import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type {
  EscalationIntent,
  ReactionEscalationAdapter,
  ReactionEscalationDispatch,
} from "./types.js";
import { classifyReaction, normalizeReactionName } from "./classifier.js";
import { resolveReactionEscalationConfig } from "./config.js";
import { dispatchEscalation } from "./dispatcher.js";
import { deliverOutcome } from "./outcome-delivery.js";
import { ReactionRateLimiter } from "./rate-limiter.js";
import { ReactionEscalationTracker } from "./tracker.js";
import { resolveSignalVocabulary } from "./vocabulary.js";

const PROCESSING_REACTION = "eyes";
const SUCCESS_REACTION = "white_check_mark";
const FAILURE_REACTION = "x";

export class ReactionEscalationService {
  private config: ReturnType<typeof resolveReactionEscalationConfig>;
  private signals = resolveSignalVocabulary(undefined);
  private rateLimiter: ReactionRateLimiter;
  private tracker: ReactionEscalationTracker;

  constructor(
    private opts: {
      cfg: OpenClawConfig;
      runtime?: RuntimeEnv;
      channelId: string;
      adapter: ReactionEscalationAdapter;
    },
  ) {
    this.config = resolveReactionEscalationConfig(opts.cfg);
    this.signals = resolveSignalVocabulary(opts.cfg.reactionEscalation?.signals);
    this.rateLimiter = new ReactionRateLimiter(this.config.rateLimit);
    this.tracker = new ReactionEscalationTracker({
      config: this.config,
      adapter: opts.adapter,
      runtime: opts.runtime,
    });
  }

  classify(rawReaction: string): EscalationIntent | null {
    const normalized = this.normalizeReaction(rawReaction);
    const signal = classifyReaction(normalized, this.signals);
    return signal?.intent ?? null;
  }

  private normalizeReaction(rawReaction: string) {
    return this.opts.adapter.normalizeReaction
      ? this.opts.adapter.normalizeReaction(rawReaction)
      : normalizeReactionName(rawReaction);
  }

  private isChannelAllowed() {
    const channels = this.config.channels ?? [];
    if (channels.length === 0) {
      return true;
    }
    return channels.some((channel) => channel.toLowerCase() === this.opts.channelId.toLowerCase());
  }

  private isUserAllowed(userId?: string) {
    const allowed = this.config.allowedUsers ?? [];
    if (allowed.length === 0) {
      return true;
    }
    if (!userId) {
      return false;
    }
    const candidate = String(userId);
    return allowed.some((entry) => String(entry) === candidate);
  }

  async dispatch(params: ReactionEscalationDispatch): Promise<{
    handled: boolean;
    intent?: EscalationIntent;
    reason?: string;
  }> {
    if (!this.config.enabled) {
      return { handled: false, reason: "disabled" };
    }
    if (!this.isChannelAllowed()) {
      return { handled: false, reason: "channel-not-allowed" };
    }
    if (params.botUserId && params.reactorUserId === params.botUserId) {
      return { handled: false, reason: "self-reaction" };
    }
    if (!this.isUserAllowed(params.reactorUserId)) {
      return { handled: false, reason: "user-not-allowed" };
    }
    const normalized = this.normalizeReaction(params.reaction);
    const signal = classifyReaction(normalized, this.signals);
    if (!signal) {
      return { handled: false, reason: "not-signal" };
    }
    const messageContext = await this.opts.adapter.fetchReactedMessage?.({
      channelId: params.channelId,
      messageTs: params.messageTs,
      threadTs: params.threadTs,
    });
    if (!messageContext) {
      return { handled: false, reason: "message-not-found" };
    }

    const rate = this.rateLimiter.allow({
      userId: params.reactorUserId ?? "unknown",
      messageKey: `${messageContext.channelId}:${messageContext.messageTs}`,
      intent: signal.intent,
    });
    if (!rate.ok) {
      return { handled: false, reason: rate.reason };
    }

    if (this.opts.adapter.addReaction) {
      try {
        await this.opts.adapter.addReaction({
          channelId: params.channelId,
          messageTs: params.messageTs,
          reaction: PROCESSING_REACTION,
        });
      } catch {
        // non-fatal
      }
    }

    try {
      const dispatch = await dispatchEscalation({
        cfg: this.opts.cfg,
        signal,
        context: messageContext,
        channel: this.opts.channelId,
        reactorUserId: params.reactorUserId ?? "unknown",
        reactorName: params.reactorName,
      });

      const outcomeUrl = this.config.outcome.includePermalink
        ? await this.opts.adapter.buildPermalink?.({
            channelId: messageContext.channelId,
            messageTs: messageContext.messageTs,
            threadTs: messageContext.threadTs,
          })
        : null;

      if (dispatch.sessionKey && dispatch.runId) {
        this.tracker.trackSession({
          outcome: dispatch.outcome,
          sessionKey: dispatch.sessionKey,
          runId: dispatch.runId,
        });
      } else if (dispatch.summary) {
        await deliverOutcome({
          adapter: this.opts.adapter,
          config: this.config,
          intent: dispatch.outcome.intent,
          channelId: messageContext.channelId,
          messageTs: messageContext.messageTs,
          threadTs: messageContext.threadTs,
          summary: dispatch.summary,
          outcomeUrl,
          status: dispatch.outcome.status === "completed" ? "ok" : "error",
        });
      }

      if (this.opts.adapter.removeReaction) {
        try {
          await this.opts.adapter.removeReaction({
            channelId: params.channelId,
            messageTs: params.messageTs,
            reaction: PROCESSING_REACTION,
          });
        } catch {
          // ignore
        }
      }
      if (this.opts.adapter.addReaction) {
        try {
          await this.opts.adapter.addReaction({
            channelId: params.channelId,
            messageTs: params.messageTs,
            reaction: dispatch.outcome.status === "completed" ? SUCCESS_REACTION : FAILURE_REACTION,
          });
        } catch {
          // ignore
        }
      }

      return { handled: true, intent: signal.intent };
    } catch (err) {
      this.opts.runtime?.error?.(`reaction escalation dispatch failed: ${String(err)}`);
      if (this.opts.adapter.removeReaction) {
        try {
          await this.opts.adapter.removeReaction({
            channelId: params.channelId,
            messageTs: params.messageTs,
            reaction: PROCESSING_REACTION,
          });
        } catch {
          // ignore
        }
      }
      if (this.opts.adapter.addReaction) {
        try {
          await this.opts.adapter.addReaction({
            channelId: params.channelId,
            messageTs: params.messageTs,
            reaction: FAILURE_REACTION,
          });
        } catch {
          // ignore
        }
      }
      return { handled: false, reason: "dispatch-error" };
    }
  }
}
