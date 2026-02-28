import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { ClaudeSdkCompatibleTool } from "../types.js";
import { buildThreadContext } from "./thread-context.js";
import type { StructuredContextInput } from "./types.js";

function extractKeywords(intent: string): string[] {
  return intent
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function scoreMessage(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((score, kw) => (lower.includes(kw) ? score + 1 : score), 0);
}

export function buildChannelTools(input: StructuredContextInput): ClaudeSdkCompatibleTool[] {
  const channelContextTool: ClaudeSdkCompatibleTool = {
    name: "channel.context",
    description:
      "Search for relevant messages in the channel message snapshot provided at conversation start. Use when you need broader context beyond the anchor message. Results come from the pre-captured snapshot, not a live search.",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: "What you are trying to understand or find context for",
        },
        since: {
          type: "string",
          description: "Optional: ISO 8601 timestamp to narrow to a time window",
        },
        authors: {
          type: "array",
          items: { type: "string" },
          description: "Optional: boost results from specific authors (display names)",
        },
        max_results: {
          type: "number",
          description: "Max results to return (default 8)",
        },
      },
      required: ["intent"],
    },
    execute: (async (_toolCallId: string, toolInput: unknown) => {
      const params = toolInput as {
        intent: string;
        since?: string;
        authors?: string[];
        max_results?: number;
      };
      const keywords = extractKeywords(params.intent);
      const maxResults = params.max_results ?? 8;

      const candidates = input.adjacentMessages.filter(
        (m) => m.messageId !== input.anchor.messageId,
      );

      const scored = candidates
        .map((m) => ({ m, score: scoreMessage(m.text, keywords) }))
        .filter(({ score }) => score > 0)
        .toSorted((a, b) => b.score - a.score || Number(b.m.ts) - Number(a.m.ts))
        .slice(0, maxResults);

      const results = scored.map(({ m }) => ({
        message_id: m.messageId,
        thread_id: m.threadId,
        ts: m.ts,
        author: { user_id: m.authorId, display_name: m.authorName, is_bot: m.authorIsBot },
        text: m.text,
        thread_summary:
          m.replyCount > 0
            ? { reply_count: m.replyCount, last_reply_ts: null, participant_names: [] }
            : null,
        relevance_signal: `keyword_match:${keywords.join(",")}`,
      }));

      const oldest = candidates.length > 0 ? candidates[0].ts : "";
      const newest = candidates.length > 0 ? candidates[candidates.length - 1].ts : "";

      return JSON.stringify({
        results,
        coverage: {
          messages_scanned: candidates.length,
          time_range: [oldest, newest],
        },
      });
      // Return type is string (JSON), not AgentToolResult — the MCP tool server
      // handles stringification generically, so the cast is safe at the boundary.
    }) as unknown as AgentTool["execute"],
  };

  const channelMessagesTool: ClaudeSdkCompatibleTool = {
    name: "channel.messages",
    description:
      "Fetch specific content by ID — a full thread, specific messages, or a media attachment.",
    parameters: {
      type: "object",
      properties: {
        thread_id: {
          type: "string",
          description: "Fetch a specific thread (root + all replies)",
        },
        message_ids: {
          type: "array",
          items: { type: "string" },
          description: "Fetch specific messages by ID",
        },
        media_artifact_id: {
          type: "string",
          description: "Fetch a media artifact as a content block",
        },
        max_replies: {
          type: "number",
          description: "For threads: max replies to return (most recent first, default 50)",
        },
      },
    },
    execute: (async (_toolCallId: string, toolInput: unknown) => {
      const params = toolInput as {
        thread_id?: string;
        message_ids?: string[];
        media_artifact_id?: string;
        max_replies?: number;
      };

      if (params.thread_id) {
        // Check snapshot first
        if (input.thread && input.thread.rootTs === params.thread_id) {
          const threadCtx = buildThreadContext(input.thread);
          return JSON.stringify({ thread: threadCtx });
        }
        // Lazy API call via fetcher
        try {
          const fetched = await input.fetcher.fetchThread(
            params.thread_id,
            params.max_replies ?? 50,
          );
          // Build thread context from fetched data, using root info when available
          const threadCtx = buildThreadContext({
            rootMessageId: params.thread_id,
            rootTs: params.thread_id,
            rootAuthorId: fetched.root?.authorId ?? "",
            rootAuthorName: fetched.root?.authorName ?? "Unknown",
            rootAuthorIsBot: fetched.root?.authorIsBot ?? false,
            rootText: fetched.root?.text ?? "",
            replies: fetched.replies.map((r) => ({ ...r, files: undefined })),
            totalReplyCount: fetched.totalCount,
          });
          return JSON.stringify({ thread: threadCtx });
        } catch {
          return JSON.stringify({
            error: `Thread ${params.thread_id} not found in channel snapshot`,
          });
        }
      }

      if (params.message_ids && params.message_ids.length > 0) {
        const messages = input.adjacentMessages
          .filter((m) => params.message_ids!.includes(m.messageId))
          .map((m) => ({
            message_id: m.messageId,
            ts: m.ts,
            author: { user_id: m.authorId, display_name: m.authorName, is_bot: m.authorIsBot },
            text: m.text,
            media: [],
          }));
        return JSON.stringify({ messages });
      }

      if (params.media_artifact_id) {
        return JSON.stringify({
          error:
            "Media retrieval requires explicit inclusion via tool. Use media_artifact_id only when you have confirmed the artifact ID from the ChannelSnapshot or ThreadContext.",
        });
      }

      return JSON.stringify({ error: "No valid query parameters provided" });
      // Return type is string (JSON), not AgentToolResult — the MCP tool server
      // handles stringification generically, so the cast is safe at the boundary.
    }) as unknown as AgentTool["execute"],
  };

  return [channelContextTool, channelMessagesTool];
}
