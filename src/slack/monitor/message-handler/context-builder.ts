import { promises as fs } from "node:fs";
import type { WebClient as SlackWebClient } from "@slack/web-api";
import type {
  ChannelFetcher,
  StructuredContextInput,
} from "../../../agents/claude-sdk-runner/context/types.js";
import type { HistoryEntry } from "../../../auto-reply/reply/history.js";
import type { SlackMessageEvent } from "../../types.js";
import {
  resolveSlackThreadHistory,
  resolveSlackThreadStarter,
  resolveSlackMedia,
} from "../media.js";
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
      authorIsBot: entry.isBot ?? false,
      text: entry.body,
      threadId: null,
      replyCount: 0,
      hasMedia: entry.hasMedia ?? false,
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
        files: r.files?.map((f) => ({
          artifactId: f.id ?? "",
          mimeType: f.mimetype ?? "application/octet-stream",
          filename: f.name,
          byteLength: f.size ?? 0,
        })),
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
      rootFiles: threadStarter.files?.map((f) => ({
        artifactId: f.id ?? "",
        mimeType: f.mimetype ?? "application/octet-stream",
        filename: f.name,
        byteLength: f.size ?? 0,
      })),
      replies,
      totalReplyCount: replies.length,
    };
  }

  const slackFetcher: ChannelFetcher = {
    async fetchThread(threadId: string, maxReplies: number) {
      const [msgs, starter] = await Promise.all([
        resolveSlackThreadHistory({
          channelId,
          threadTs: threadId,
          client,
          limit: maxReplies,
        }),
        resolveSlackThreadStarter({
          channelId,
          threadTs: threadId,
          client,
        }),
      ]);
      const replies = msgs
        .filter((m) => m.ts !== threadId)
        .map((m) => ({
          messageId: m.ts ?? "",
          ts: m.ts ?? "",
          authorId: m.userId ?? m.botId ?? "",
          authorName: m.userId ?? m.botId ?? "Unknown",
          authorIsBot: Boolean(m.botId),
          text: m.text,
          files: m.files?.map((f) => ({
            artifactId: f.id ?? "",
            mimeType: f.mimetype ?? "application/octet-stream",
            filename: f.name,
            byteLength: f.size ?? 0,
          })),
        }));
      return {
        root: starter
          ? {
              messageId: threadId,
              ts: threadId,
              authorId: starter.userId ?? "",
              authorName: starter.userId ?? "Unknown",
              authorIsBot: false,
              text: starter.text,
              files: starter.files?.map((f) => ({
                artifactId: f.id ?? "",
                mimeType: f.mimetype ?? "application/octet-stream",
                filename: f.name,
                byteLength: f.size ?? 0,
              })),
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
    async fetchMedia(artifactId: string) {
      if (!client.token) {
        throw new Error("No client token available to fetch media.");
      }
      const info = await client.files.info({ file: artifactId });
      if (!info.file) {
        throw new Error("File not found or not downloadable.");
      }
      const resolved = await resolveSlackMedia({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        files: [info.file as any],
        token: client.token,
        maxBytes: 20 * 1024 * 1024,
      });
      if (!resolved || resolved.length === 0 || !resolved[0]) {
        throw new Error("Failed to resolve media");
      }
      const data = await fs.readFile(resolved[0].path, { encoding: "base64" });
      return {
        mimeType: resolved[0].contentType ?? "application/octet-stream",
        data,
      };
    },
    async fetchNewReplies(threadId: string, sinceTs: string) {
      const msgs = await resolveSlackThreadHistory({
        channelId,
        threadTs: threadId,
        client,
        limit: 100, // Reasonable max for new replies since last turn
      });
      return msgs
        .filter((m) => m.ts !== undefined && Number(m.ts) > Number(sinceTs))
        .map((m) => ({
          messageId: m.ts ?? "",
          ts: m.ts ?? "",
          authorId: m.userId ?? m.botId ?? "",
          authorName: m.userId ?? m.botId ?? "Unknown",
          authorIsBot: Boolean(m.botId),
          text: m.text,
          files: m.files?.map((f) => ({
            artifactId: f.id ?? "",
            mimeType: f.mimetype ?? "application/octet-stream",
            filename: f.name,
            byteLength: f.size ?? 0,
          })),
        }));
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
      files: message.files?.map((f) => ({
        artifactId: f.id ?? "",
        mimeType: f.mimetype ?? "application/octet-stream",
        filename: f.name,
        byteLength: f.size ?? 0,
      })),
    },
    adjacentMessages: adjacentMessagesForCtx,
    thread: threadData,
    fetcher: slackFetcher,
  };
}
