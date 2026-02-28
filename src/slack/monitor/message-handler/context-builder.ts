import type { WebClient as SlackWebClient } from "@slack/web-api";
import type {
  ChannelFetcher,
  StructuredContextInput,
} from "../../../agents/claude-sdk-runner/context/types.js";
import type { HistoryEntry } from "../../../auto-reply/reply/history.js";
import type { SlackMessageEvent } from "../../types.js";
import { resolveSlackThreadHistory } from "../media.js";
import type { SlackThreadMessage, SlackThreadStarter } from "../media.js";

/**
 * The platform-specific resolved data shape passed through the message_context_build
 * hook's resolvedData field for Slack messages. Subscribers cast event.resolvedData to
 * this type before calling buildSlackStructuredContext().
 */
export type SlackContextBuildData = {
  message: SlackMessageEvent;
  roomLabel: string;
  senderId: string | undefined;
  senderName: string;
  isBotMessage: boolean;
  rawBody: string;
  isThreadReply: boolean;
  threadTs: string | null;
  threadHistory: SlackThreadMessage[];
  threadStarter: SlackThreadStarter | null;
  threadUserMap: Map<string, { name?: string }>;
  client: SlackWebClient;
  adjacentMessages: HistoryEntry[];
  channelType: "direct" | "group";
};

/**
 * Assembles a StructuredContextInput from pre-resolved Slack message data.
 *
 * This is a pure function: it does not make any API calls directly, though the
 * SlackFetcher it constructs will call the Slack API lazily when tools invoke it.
 */
export function buildSlackStructuredContext(
  params: SlackContextBuildData & { channelId: string },
): StructuredContextInput {
  const {
    message,
    channelId,
    roomLabel,
    senderId,
    senderName,
    isBotMessage,
    rawBody,
    isThreadReply,
    threadTs,
    threadHistory,
    threadStarter,
    threadUserMap,
    client,
    adjacentMessages,
    channelType,
  } = params;

  const adjacentMessagesForCtx: StructuredContextInput["adjacentMessages"] = adjacentMessages.map(
    (entry) => ({
      messageId: entry.messageId ?? "",
      ts: entry.messageId ?? "",
      authorId: entry.sender ?? "",
      authorName: entry.sender ?? "",
      authorIsBot: false,
      text: entry.body,
      threadId: null,
      replyCount: 0,
      hasMedia: false,
      reactions: [],
    }),
  );

  let threadData: StructuredContextInput["thread"] = null;
  if (isThreadReply && threadTs && threadStarter) {
    const replies = threadHistory
      .filter((m) => m.ts !== threadTs)
      .map((r) => ({
        messageId: r.ts ?? "",
        ts: r.ts ?? "",
        authorId: r.userId ?? r.botId ?? "",
        authorName: r.userId
          ? (threadUserMap.get(r.userId)?.name ?? r.userId)
          : r.botId
            ? `Bot (${r.botId})`
            : "Unknown",
        authorIsBot: Boolean(r.botId),
        text: r.text,
      }));
    threadData = {
      rootMessageId: threadTs,
      rootTs: threadTs,
      rootAuthorId: threadStarter.userId ?? "",
      rootAuthorName: threadStarter.userId
        ? (threadUserMap.get(threadStarter.userId)?.name ?? threadStarter.userId)
        : "Unknown",
      rootAuthorIsBot: false,
      rootText: threadStarter.text,
      replies,
      totalReplyCount: replies.length,
    };
  }

  const slackFetcher: ChannelFetcher = {
    async fetchThread(threadId: string, maxReplies: number) {
      const msgs = await resolveSlackThreadHistory({
        channelId,
        threadTs: threadId,
        client,
        limit: maxReplies,
      });
      const rootMsg = msgs.find((m) => m.ts === threadId);
      const replies = msgs
        .filter((m) => m.ts !== threadId)
        .map((m) => ({
          messageId: m.ts ?? "",
          ts: m.ts ?? "",
          authorId: m.userId ?? m.botId ?? "",
          authorName: m.userId ?? m.botId ?? "Unknown",
          authorIsBot: Boolean(m.botId),
          text: m.text,
        }));
      return {
        root: rootMsg
          ? {
              messageId: rootMsg.ts ?? "",
              ts: rootMsg.ts ?? "",
              authorId: rootMsg.userId ?? rootMsg.botId ?? "",
              authorName: rootMsg.userId ?? rootMsg.botId ?? "Unknown",
              authorIsBot: Boolean(rootMsg.botId),
              text: rootMsg.text,
            }
          : undefined,
        replies,
        totalCount: replies.length,
      };
    },
    async fetchMessages(_messageIds: string[]) {
      // Slack has no batch message-by-ID API; adjacentMessages cover the snapshot window
      return [];
    },
  };

  return {
    platform: "slack",
    channelId,
    channelName: roomLabel,
    channelType,
    anchor: {
      messageId: message.ts ?? "",
      ts: message.ts ?? "",
      authorId: senderId ?? "",
      authorName: senderName,
      authorIsBot: isBotMessage,
      text: rawBody,
      threadId: isThreadReply && threadTs ? threadTs : null,
    },
    adjacentMessages: adjacentMessagesForCtx,
    thread: threadData,
    fetcher: slackFetcher,
  };
}
