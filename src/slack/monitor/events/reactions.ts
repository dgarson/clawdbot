import type { SlackEventMiddlewareArgs } from "@slack/bolt";
import { danger } from "../../../globals.js";
import { enqueueSystemEvent } from "../../../infra/system-events.js";
import { getRouterFeedbackLoopStore } from "../../../routing/feedback-loop-store.js";
import { resolveSlackChannelLabel } from "../channel-config.js";
import type { SlackMonitorContext } from "../context.js";
import type { SlackReactionEvent } from "../types.js";

function mapReactionFeedback(
  reaction?: string,
): { expectedAction?: "handle" | "escalate"; expectedTier?: "T1" | "T2" | "T3" | "T4" } | null {
  const normalized = (reaction ?? "").toLowerCase().trim();
  if (!normalized) {
    return null;
  }
  if (["x", "-1", "thumbsdown"].includes(normalized)) {
    return { expectedAction: "handle" };
  }
  if (["rotating_light", "fire", "bangbang"].includes(normalized)) {
    return { expectedAction: "escalate", expectedTier: "T3" };
  }
  return null;
}

export function registerSlackReactionEvents(params: { ctx: SlackMonitorContext }) {
  const { ctx } = params;

  const handleReactionEvent = async (event: SlackReactionEvent, action: string) => {
    try {
      const item = event.item;
      if (!item || item.type !== "message") {
        return;
      }

      const channelInfo = item.channel ? await ctx.resolveChannelName(item.channel) : {};
      const channelType = channelInfo?.type;
      if (
        !ctx.isChannelAllowed({
          channelId: item.channel,
          channelName: channelInfo?.name,
          channelType,
        })
      ) {
        return;
      }

      const channelLabel = resolveSlackChannelLabel({
        channelId: item.channel,
        channelName: channelInfo?.name,
      });
      const actorInfo = event.user ? await ctx.resolveUserName(event.user) : undefined;
      const actorLabel = actorInfo?.name ?? event.user;
      const emojiLabel = event.reaction ?? "emoji";
      const authorInfo = event.item_user ? await ctx.resolveUserName(event.item_user) : undefined;
      const authorLabel = authorInfo?.name ?? event.item_user;
      const baseText = `Slack reaction ${action}: :${emojiLabel}: by ${actorLabel} in ${channelLabel} msg ${item.ts}`;
      const text = authorLabel ? `${baseText} from ${authorLabel}` : baseText;
      const sessionKey = ctx.resolveSlackSystemEventSessionKey({
        channelId: item.channel,
        channelType,
      });
      enqueueSystemEvent(text, {
        sessionKey,
        contextKey: `slack:reaction:${action}:${item.channel}:${item.ts}:${event.user}:${emojiLabel}`,
      });

      const mapped = mapReactionFeedback(event.reaction);
      if (action === "added" && mapped) {
        const store = getRouterFeedbackLoopStore();
        store.captureFeedback({
          source: "reaction",
          actorId: event.user,
          channelId: "slack",
          conversationId: item.channel,
          threadId: item.ts,
          feedbackMessageId: item.ts,
          expectedAction: mapped.expectedAction,
          expectedTier: mapped.expectedTier,
          reaction: event.reaction,
        });
      }
    } catch (err) {
      ctx.runtime.error?.(danger(`slack reaction handler failed: ${String(err)}`));
    }
  };

  ctx.app.event(
    "reaction_added",
    async ({ event, body }: SlackEventMiddlewareArgs<"reaction_added">) => {
      if (ctx.shouldDropMismatchedSlackEvent(body)) {
        return;
      }
      await handleReactionEvent(event as SlackReactionEvent, "added");
    },
  );

  ctx.app.event(
    "reaction_removed",
    async ({ event, body }: SlackEventMiddlewareArgs<"reaction_removed">) => {
      if (ctx.shouldDropMismatchedSlackEvent(body)) {
        return;
      }
      await handleReactionEvent(event as SlackReactionEvent, "removed");
    },
  );
}
