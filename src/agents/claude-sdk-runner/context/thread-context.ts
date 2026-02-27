import { applyThreadBudget, estimateTokens } from "./budget.js";
import type {
  Author,
  MediaRef,
  StructuredContextInput,
  ThreadContext,
  ThreadReply,
} from "./types.js";

function buildAuthor(input: {
  authorId: string;
  authorName: string;
  authorIsBot: boolean;
}): Author {
  return { user_id: input.authorId, display_name: input.authorName, is_bot: input.authorIsBot };
}

function buildMediaRefs(
  files?: Array<{ artifactId: string; mimeType: string; filename?: string; byteLength: number }>,
): MediaRef[] {
  if (!files || files.length === 0) {
    return [];
  }
  return files.map((f) => ({
    artifact_id: f.artifactId,
    media_type: f.mimeType,
    filename: f.filename ?? null,
    byte_length: f.byteLength,
  }));
}

const REPLY_TOKEN_BUDGET = 300;

export function buildThreadContext(
  thread: NonNullable<StructuredContextInput["thread"]> | null,
  budgetTokens?: number,
): ThreadContext | null {
  if (!thread) {
    return null;
  }

  const { included, truncation } = applyThreadBudget({
    replies: thread.replies,
    budgetTokens,
  });

  const replies: ThreadReply[] = included.map((r) => {
    const tokens = estimateTokens(r.text);
    const isTruncated = tokens > REPLY_TOKEN_BUDGET;
    const text = isTruncated ? r.text.slice(0, REPLY_TOKEN_BUDGET * 4 - 1) + "…" : r.text;
    return {
      message_id: r.messageId,
      ts: r.ts,
      author: buildAuthor(r),
      text,
      is_truncated: isTruncated,
      media: buildMediaRefs(r.files),
    };
  });

  return {
    schema_version: "1.0",
    thread_id: thread.rootTs, // thread_id === root message ts (platform convention)
    root: {
      message_id: thread.rootMessageId,
      ts: thread.rootTs,
      author: buildAuthor({
        authorId: thread.rootAuthorId,
        authorName: thread.rootAuthorName,
        authorIsBot: thread.rootAuthorIsBot,
      }),
      text: thread.rootText,
      media: buildMediaRefs(thread.rootFiles),
    },
    replies,
    truncation: {
      ...truncation,
      total_replies: thread.totalReplyCount,
    },
  };
}
