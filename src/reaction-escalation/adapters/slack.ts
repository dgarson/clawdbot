import type { WebClient } from "@slack/web-api";
import type { SlackMonitorContext } from "../../slack/monitor/context.js";
import type { SlackMessageEvent, SlackFile } from "../../slack/types.js";
import type { ReactionEscalationAdapter, ReactionMessageContext } from "../types.js";
import { reactSlackMessage, removeSlackReaction } from "../../slack/actions.js";
import { createSlackWebClient } from "../../slack/client.js";
import { sendMessageSlack } from "../../slack/send.js";

type SlackReactionAdapterOptions = {
  ctx: SlackMonitorContext;
  accountId?: string;
};

function normalizeSlackEmoji(raw: string) {
  return raw.trim().replace(/^:+|:+$/g, "");
}

function mapSlackFiles(files: SlackFile[] | undefined) {
  if (!files || files.length === 0) {
    return [];
  }
  return files.map((file) => ({
    type: file.mimetype ?? "file",
    url: file.url_private ?? file.url_private_download,
    text: file.name,
  }));
}

async function fetchSlackMessage(
  client: WebClient,
  channelId: string,
  messageTs: string,
  threadTs?: string,
): Promise<SlackMessageEvent | null> {
  // Use conversations.replies for thread messages, conversations.history for channel messages.
  // This mirrors the pattern in readSlackMessages (src/slack/actions.ts).
  if (threadTs) {
    const result = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      latest: messageTs,
      inclusive: true,
      limit: 1,
    });
    const message = (result.messages ?? [])[0] as SlackMessageEvent | undefined;
    return message ?? null;
  }

  const result = await client.conversations.history({
    channel: channelId,
    latest: messageTs,
    inclusive: true,
    limit: 1,
  });
  const message = (result.messages ?? [])[0] as SlackMessageEvent | undefined;
  return message ?? null;
}

async function buildPermalink(client: WebClient, channelId: string, messageTs: string) {
  const response = await client.chat.getPermalink({ channel: channelId, message_ts: messageTs });
  return response.permalink ?? null;
}

export function createSlackReactionEscalationAdapter(
  opts: SlackReactionAdapterOptions,
): ReactionEscalationAdapter {
  const client = createSlackWebClient(opts.ctx.botToken);
  return {
    normalizeReaction: normalizeSlackEmoji,
    fetchReactedMessage: async ({
      channelId,
      messageTs,
      threadTs,
    }): Promise<ReactionMessageContext | null> => {
      const message = await fetchSlackMessage(client, channelId, messageTs, threadTs);
      if (!message) {
        return null;
      }
      const authorId = message.user ?? undefined;
      const authorName = authorId ? (await opts.ctx.resolveUserName(authorId)).name : undefined;
      const channelInfo = await opts.ctx.resolveChannelName(channelId);
      const permalink = await buildPermalink(client, channelId, messageTs);
      return {
        text: message.text ?? "",
        authorId,
        authorName,
        channelId,
        channelName: channelInfo?.name,
        messageTs: message.ts ?? messageTs,
        threadTs: message.thread_ts ?? undefined,
        permalink: permalink ?? undefined,
        attachments: mapSlackFiles(message.files),
      };
    },
    postOutcome: async ({ channelId, messageTs, threadTs, summary }) => {
      const result = await sendMessageSlack(`channel:${channelId}`, summary, {
        accountId: opts.accountId,
        threadTs: threadTs ?? messageTs,
        client,
        config: opts.ctx.cfg,
      });
      return result ? { messageId: result.messageId } : null;
    },
    postDigest: async ({ channelId, summary }) => {
      const result = await sendMessageSlack(channelId, summary, {
        accountId: opts.accountId,
        client,
        config: opts.ctx.cfg,
      });
      return result ? { messageId: result.messageId } : null;
    },
    buildPermalink: async ({ channelId, messageTs }) =>
      buildPermalink(client, channelId, messageTs),
    addReaction: async ({ channelId, messageTs, reaction }) => {
      await reactSlackMessage(channelId, messageTs, reaction, {
        accountId: opts.accountId,
        client,
        config: opts.ctx.cfg,
      });
    },
    removeReaction: async ({ channelId, messageTs, reaction }) => {
      await removeSlackReaction(channelId, messageTs, reaction, {
        accountId: opts.accountId,
        client,
        config: opts.ctx.cfg,
      });
    },
  };
}
