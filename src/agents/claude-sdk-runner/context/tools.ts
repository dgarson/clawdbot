import { jsonResult } from "../../tools/common.js";
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
  const apiCallTimestamps: number[] = [];
  const MAX_API_CALLS_PER_MINUTE = 15;

  function checkRateLimit(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    // Remove timestamps older than 1 minute
    while (apiCallTimestamps.length > 0 && apiCallTimestamps[0] < oneMinuteAgo) {
      apiCallTimestamps.shift();
    }

    if (apiCallTimestamps.length >= MAX_API_CALLS_PER_MINUTE) {
      return false;
    }

    apiCallTimestamps.push(now);
    return true;
  }

  const channelContextTool: ClaudeSdkCompatibleTool = {
    name: "channel.context",
    description:
      "Search for relevant messages in the channel message snapshot provided at conversation start. Use when you need broader context beyond the anchor message. Results come from the pre-captured snapshot, not a live search. Required parameter: intent.",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: "(Required) What you are trying to understand or find context for",
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
        offset: {
          type: "number",
          description: "Offset for pagination (default 0)",
        },
      },
      required: ["intent"],
    },
    execute: async (_toolCallId: string, toolInput: unknown) => {
      const params = toolInput as {
        intent: string;
        since?: string;
        authors?: string[];
        max_results?: number;
        offset?: number;
      };
      if (!params.intent || typeof params.intent !== "string") {
        return jsonResult({ error: "Missing required parameter: intent" });
      }
      const keywords = extractKeywords(params.intent);
      const maxResults = params.max_results ?? 8;
      const offset = params.offset ?? 0;

      // Build candidate pool: adjacent channel messages + thread replies (if present)
      const adjacentCandidates = input.adjacentMessages.filter(
        (m) => m.messageId !== input.anchor.messageId,
      );
      const adjacentIds = new Set(adjacentCandidates.map((m) => m.messageId));

      // Include thread root + replies as searchable candidates (dedup against adjacent)
      type Candidate = (typeof adjacentCandidates)[number];
      const threadCandidates: Candidate[] = [];
      if (input.thread) {
        const t = input.thread;
        if (!adjacentIds.has(t.rootMessageId) && t.rootMessageId !== input.anchor.messageId) {
          threadCandidates.push({
            messageId: t.rootMessageId,
            ts: t.rootTs,
            authorId: t.rootAuthorId,
            authorName: t.rootAuthorName,
            authorIsBot: t.rootAuthorIsBot,
            text: t.rootText,
            threadId: t.rootMessageId,
            replyCount: t.totalReplyCount,
            hasMedia: (t.rootFiles?.length ?? 0) > 0,
            reactions: [],
          });
        }
        for (const r of t.replies) {
          if (!adjacentIds.has(r.messageId) && r.messageId !== input.anchor.messageId) {
            threadCandidates.push({
              messageId: r.messageId,
              ts: r.ts,
              authorId: r.authorId,
              authorName: r.authorName,
              authorIsBot: r.authorIsBot,
              text: r.text,
              threadId: t.rootMessageId,
              replyCount: 0,
              hasMedia: (r.files?.length ?? 0) > 0,
              reactions: [],
            });
          }
        }
      }
      const candidates = [...adjacentCandidates, ...threadCandidates];

      const scored = candidates
        .map((m) => ({ m, score: scoreMessage(m.text, keywords) }))
        .filter(({ score }) => score > 0)
        .toSorted((a, b) => b.score - a.score || Number(b.m.ts) - Number(a.m.ts));

      // Also surface recent media-bearing messages that may not match keywords
      // (e.g. an image the user is asking about). Dedup against keyword results.
      const keywordIds = new Set(scored.map(({ m }) => m.messageId));
      const mediaMessages = candidates
        .filter((m) => m.hasMedia && !keywordIds.has(m.messageId))
        .toSorted((a, b) => Number(b.ts) - Number(a.ts))
        .slice(0, 3)
        .map((m) => ({ m, score: 0 }));

      const combined = [...scored, ...mediaMessages];
      const sliced = combined.slice(offset, offset + maxResults);

      const results = sliced.map(({ m, score }) => ({
        message_id: m.messageId,
        thread_id: m.threadId,
        ts: m.ts,
        author: { user_id: m.authorId, display_name: m.authorName, is_bot: m.authorIsBot },
        text: m.text,
        has_media: m.hasMedia || undefined,
        thread_summary:
          m.replyCount > 0
            ? { reply_count: m.replyCount, last_reply_ts: null, participant_names: [] }
            : null,
        relevance_signal: score > 0 ? `keyword_match:${keywords.join(",")}` : "recent_media",
      }));

      const oldest = candidates.length > 0 ? candidates[0].ts : "";
      const newest = candidates.length > 0 ? candidates[candidates.length - 1].ts : "";

      return jsonResult({
        results,
        coverage: {
          messages_scanned: candidates.length,
          time_range: [oldest, newest],
        },
        pagination: {
          total: combined.length,
          offset,
          limit: maxResults,
        },
      });
    },
  };

  const channelMessagesTool: ClaudeSdkCompatibleTool = {
    name: "channel.messages",
    description:
      "Fetch specific content by ID — a full thread, specific messages, or a media attachment. Provide exactly one of: thread_id, message_ids, or media_artifact_id.",
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
    execute: async (_toolCallId: string, toolInput: unknown) => {
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
          return jsonResult({ thread: threadCtx });
        }
        // Lazy API call via fetcher
        if (!checkRateLimit()) {
          return jsonResult({
            error:
              "Rate limit reached. Stop fetching messages and answer using the context you have.",
          });
        }
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
            rootFiles: fetched.root?.files,
            replies: fetched.replies,
            totalReplyCount: fetched.totalCount,
          });
          return jsonResult({ thread: threadCtx });
        } catch {
          return jsonResult({
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
        return jsonResult({ messages });
      }

      if (params.media_artifact_id) {
        if (!input.fetcher || typeof input.fetcher.fetchMedia !== "function") {
          return jsonResult({
            error: "Media retrieval is not supported by this channel fetcher.",
          });
        }
        if (!checkRateLimit()) {
          return jsonResult({
            error:
              "Rate limit reached. Stop fetching messages and answer using the context you have.",
          });
        }
        try {
          const media = await input.fetcher.fetchMedia(params.media_artifact_id);
          return jsonResult({
            media: {
              artifact_id: params.media_artifact_id,
              media_type: media.mimeType,
              content: media.data,
            },
          });
        } catch {
          return jsonResult({
            error: `Failed to fetch media ${params.media_artifact_id}`,
          });
        }
      }

      return jsonResult({ error: "No valid query parameters provided" });
    },
  };

  return [channelContextTool, channelMessagesTool];
}
