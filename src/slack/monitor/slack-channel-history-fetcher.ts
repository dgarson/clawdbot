import type { WebClient } from "@slack/web-api";
import type { ChannelHistoryFetcher } from "../../auto-reply/reply/channel-snapshot-store.js";
import type { HistoryEntry } from "../../auto-reply/reply/history.js";

export function createSlackChannelHistoryFetcher(params: {
  client: WebClient;
  resolveUserName: (userId: string) => Promise<{ name?: string } | null>;
}): ChannelHistoryFetcher {
  return {
    async fetchRecentMessages(channelId: string, limit: number): Promise<HistoryEntry[]> {
      const result = await params.client.conversations.history({
        channel: channelId,
        limit,
      });

      const messages = result.messages ?? [];
      // Skip bot messages (the bot's own replies aren't channel context)
      const userMessages = messages.filter((msg) => !msg.bot_id);

      // Batch resolve user names
      const uniqueUserIds = [
        ...new Set(userMessages.map((m) => m.user).filter((id): id is string => Boolean(id))),
      ];
      const userMap = new Map<string, string>();
      await Promise.all(
        uniqueUserIds.map(async (userId) => {
          const resolved = await params.resolveUserName(userId);
          if (resolved?.name) {
            userMap.set(userId, resolved.name);
          }
        }),
      );

      const entries: HistoryEntry[] = userMessages.map((msg) => ({
        sender: (msg.user ? userMap.get(msg.user) : undefined) ?? msg.user ?? "unknown",
        body: msg.text ?? "",
        timestamp: msg.ts ? Math.round(Number(msg.ts) * 1000) : undefined,
        messageId: msg.ts,
      }));

      // Slack API returns newest-first; reverse to oldest-first
      entries.reverse();
      return entries;
    },
  };
}
