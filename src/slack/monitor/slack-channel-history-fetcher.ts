import type { WebClient } from "@slack/web-api";
import type { ChannelHistoryFetcher } from "../../auto-reply/reply/channel-snapshot-store.js";
import type { HistoryEntry } from "../../auto-reply/reply/history.js";

/** Build a file placeholder matching the bystander pattern from prepare.ts. */
function buildFilePlaceholder(files: Array<{ id?: string; name?: string; mimetype?: string }>) {
  return files
    .map((f) => {
      const name = f.name?.trim() || "file";
      const idHint = f.id ? ` (id:${f.id})` : "";
      return `[Slack file: ${name}${idHint}]`;
    })
    .join(" ");
}

export function createSlackChannelHistoryFetcher(params: {
  client: WebClient;
  resolveUserName: (userId: string) => Promise<{ name?: string } | null>;
  /** Bot user ID — used to label the bot's own replies with its display name. */
  botUserId?: string;
}): ChannelHistoryFetcher {
  return {
    async fetchRecentMessages(channelId: string, limit: number): Promise<HistoryEntry[]> {
      const result = await params.client.conversations.history({
        channel: channelId,
        limit,
      });

      const messages = result.messages ?? [];

      // Batch resolve user names (includes bot user IDs)
      const uniqueUserIds = [
        ...new Set(messages.map((m) => m.user).filter((id): id is string => Boolean(id))),
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

      // Skip the bot's own messages that match our bot user ID — these are the
      // bot's replies and would be confusing as "adjacent" context. But keep
      // OTHER bot messages (e.g. integrations) since they can carry context.
      const filtered = messages.filter((msg) => {
        if (msg.user && params.botUserId && msg.user === params.botUserId) {
          return false;
        }
        return true;
      });

      const entries: HistoryEntry[] = filtered.map((msg) => {
        const isBot = Boolean(msg.bot_id);
        const senderName =
          (msg.user ? userMap.get(msg.user) : undefined) ??
          msg.username?.trim() ??
          msg.user ??
          (msg.bot_id ? `Bot (${msg.bot_id})` : "unknown");

        const textBody = (msg.text ?? "").trim();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const files = (msg as any).files as
          | Array<{ id?: string; name?: string; mimetype?: string }>
          | undefined;
        const hasFiles = Array.isArray(files) && files.length > 0;
        const filePlaceholder = hasFiles ? buildFilePlaceholder(files) : "";
        const body = [textBody, filePlaceholder].filter(Boolean).join("\n");

        return {
          sender: senderName,
          body,
          timestamp: msg.ts ? Math.round(Number(msg.ts) * 1000) : undefined,
          messageId: msg.ts,
          isBot,
          hasMedia: hasFiles,
        };
      });

      // Slack API returns newest-first; reverse to oldest-first
      entries.reverse();
      return entries;
    },
  };
}
