import { truncateSnippet } from "./budget.js";
import type {
  AdjacentMessage,
  Author,
  ChannelSnapshot,
  MediaRef,
  StructuredContextInput,
} from "./types.js";

function buildAuthor(input: {
  authorId: string;
  authorName: string;
  authorIsBot: boolean;
}): Author {
  return {
    user_id: input.authorId,
    display_name: input.authorName,
    is_bot: input.authorIsBot,
  };
}

function buildMediaRefs(files?: StructuredContextInput["anchor"]["files"]): MediaRef[] {
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

export function buildChannelSnapshot(input: StructuredContextInput): ChannelSnapshot {
  const anchorAuthor = buildAuthor(input.anchor);
  const anchorMedia = buildMediaRefs(input.anchor.files);

  const adjacent: AdjacentMessage[] = input.adjacentMessages
    .filter((m) => m.messageId !== input.anchor.messageId)
    .map((m) => ({
      message_id: m.messageId,
      ts: m.ts,
      author: buildAuthor(m),
      snippet: truncateSnippet(m.text),
      thread_activity:
        m.replyCount > 0
          ? {
              reply_count: m.replyCount,
              replies_last_1h: 0, // best-effort; not in event stream
              last_reply_ts: null,
            }
          : null,
      has_media: m.hasMedia,
      reactions: m.reactions,
    }));

  return {
    schema_version: "1.0",
    channel: {
      id: input.channelId,
      name: input.channelName,
      platform: input.platform,
    },
    anchor: {
      message_id: input.anchor.messageId,
      ts: input.anchor.ts,
      author: anchorAuthor,
      text: input.anchor.text,
      media: anchorMedia,
      thread_id: input.anchor.threadId,
    },
    adjacent,
  };
}
