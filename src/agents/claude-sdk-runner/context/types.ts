export interface Author {
  user_id: string;
  display_name: string;
  is_bot: boolean;
}

export interface MediaRef {
  artifact_id: string;
  media_type: string;
  filename: string | null;
  byte_length: number;
}

export interface AdjacentMessage {
  message_id: string;
  ts: string;
  author: Author;
  snippet: string; // first 150 chars, deterministic truncation
  thread_activity: {
    reply_count: number;
    replies_last_1h: number;
    last_reply_ts: string | null;
  } | null;
  has_media: boolean;
  reactions: string[]; // e.g. [":white_check_mark: 3"]
}

export interface ChannelSnapshot {
  schema_version: "1.0";
  channel: {
    id: string;
    name: string;
    platform: string; // "slack" | "discord" | "telegram" | ...
  };
  anchor: {
    message_id: string;
    ts: string;
    author: Author;
    text: string; // always full
    media: MediaRef[];
    thread_id: string | null;
  };
  adjacent: AdjacentMessage[];
}

export interface ThreadReply {
  message_id: string;
  ts: string;
  author: Author;
  text: string; // full if fits budget, truncated with "..." if not
  is_truncated: boolean;
  media: MediaRef[];
}

export interface ThreadContext {
  schema_version: "1.0";
  thread_id: string;
  root: {
    message_id: string;
    ts: string;
    author: Author;
    text: string; // always full
    media: MediaRef[];
  };
  replies: ThreadReply[];
  truncation: {
    total_replies: number;
    included_replies: number;
    strategy: "most_recent";
    omitted_range_ts: [string, string] | null;
  };
}

/** Raw input from the channel layer (Slack, Discord, etc.) */
export interface StructuredContextInput {
  platform: string;
  channelId: string;
  channelName: string;
  /** "direct" for DMs, "group" for channels/group-DMs. Drives tool registration gating. */
  channelType: "direct" | "group";
  anchor: {
    messageId: string;
    ts: string;
    authorId: string;
    authorName: string;
    authorIsBot: boolean;
    text: string;
    threadId: string | null;
    files?: Array<{
      artifactId: string;
      mimeType: string;
      filename?: string;
      byteLength: number;
    }>;
  };
  /** Snapshot of adjacent channel messages at event time, from channelHistories */
  adjacentMessages: Array<{
    messageId: string;
    ts: string;
    authorId: string;
    authorName: string;
    authorIsBot: boolean;
    text: string;
    threadId: string | null;
    // Best-effort — may be zero/null if not in event-stream store
    replyCount: number;
    hasMedia: boolean;
    reactions: string[];
  }>;
  /** Thread data — present when anchor is a thread reply or has replies */
  thread: {
    rootMessageId: string;
    rootTs: string;
    rootAuthorId: string;
    rootAuthorName: string;
    rootAuthorIsBot: boolean;
    rootText: string;
    rootFiles?: Array<{
      artifactId: string;
      mimeType: string;
      filename?: string;
      byteLength: number;
    }>;
    replies: Array<{
      messageId: string;
      ts: string;
      authorId: string;
      authorName: string;
      authorIsBot: boolean;
      text: string;
      files?: Array<{
        artifactId: string;
        mimeType: string;
        filename?: string;
        byteLength: number;
      }>;
    }>;
    totalReplyCount: number;
  } | null;
  /** Platform-agnostic interface for lazily fetching channel data.
   *  Every platform must provide a fetcher — use a no-op implementation
   *  (returning empty results) if the platform doesn't support on-demand fetching. */
  fetcher: ChannelFetcher;
}

/** Platform-agnostic interface for lazily fetching channel data */
export interface ChannelFetcher {
  fetchThread(
    threadId: string,
    maxReplies: number,
  ): Promise<{
    root?: {
      messageId: string;
      ts: string;
      authorId: string;
      authorName: string;
      authorIsBot: boolean;
      text: string;
    };
    replies: Array<{
      messageId: string;
      ts: string;
      authorId: string;
      authorName: string;
      authorIsBot: boolean;
      text: string;
    }>;
    totalCount: number;
  }>;
  fetchMessages(messageIds: string[]): Promise<
    Array<{
      messageId: string;
      ts: string;
      authorId: string;
      authorName: string;
      authorIsBot: boolean;
      text: string;
    }>
  >;
  fetchMedia?(artifactId: string): Promise<{
    mimeType: string;
    data: string;
  }>;
  fetchNewReplies?(
    threadId: string,
    sinceTs: string,
  ): Promise<
    Array<{
      messageId: string;
      ts: string;
      authorId: string;
      authorName: string;
      authorIsBot: boolean;
      text: string;
    }>
  >;
}
