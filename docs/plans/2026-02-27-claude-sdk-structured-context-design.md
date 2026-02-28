# Claude SDK Structured Context Design

**Date:** 2026-02-27
**Branch:** `claude-sdk-context-attachment-optimizations`
**Scope:** Cross-channel context assembly for Claude SDK sessions (Slack reference implementation)

## Goals

1. Maximize answer quality by providing adjacent channel context + full thread content.
2. Avoid token bloat: keep always-in-context payloads small, use tools for deeper exploration.
3. Deterministic context assembly: no hidden LLM calls for summaries or selection.
4. Scalable to large threads without overflowing the context window.
5. Media deduplication across turns with persistence across gateway restarts.

## Constraints

- **Claude SDK only.** Pi Agent continues using the existing `ThreadHistoryBody`/`ThreadStarterBody` approach. All new code lives in `src/agents/claude-sdk-runner/` or beneath it.
- **Tools scoped to current channel only.** No cross-channel search. Access control is structural (channel ID baked into tool closure at session creation).
- **Quality over speed.** 5-10s for first response is acceptable. Tool round-trips are OK.
- **Media is opt-in, never auto-attached by default.** Explicit inclusion only.

## Architecture: Approach A (Compact Pre-attach + Scoped Tools)

Attach a compact context package once at SDK session creation. Provide two channel-scoped tools for on-demand deeper exploration. Never re-send context on subsequent turns (SDK server-side history handles persistence).

### Context Assembly Pipeline

```
Channel event arrives
    |
Stage 1: Channel intake (per-channel code, unchanged)
    -> Resolves: current message, thread, adjacent messages, media
    -> Existing code: src/slack/monitor/, src/discord/monitor/, etc.
    |
Stage 2: Context budgeting (new, in claude-sdk-runner)
    -> Token budget applied to decide what gets inlined vs. referenced
    -> Current thread: inline fully (up to budget)
    -> Adjacent messages: compact index always
    -> Adjacent thread content: reference only (available via tool)
    -> Media: inline for current thread (opt-in), reference for adjacent
    -> Produces: ChannelSnapshot + ThreadContext + content blocks
    |
Stage 3: SDK session creation (create-session.ts)
    -> Attach ChannelSnapshot + ThreadContext as content blocks (once)
    -> Register channel.context + channel.messages tools
    -> Subsequent turns: only the new user message (no context re-send)
```

**Integration point:** `StructuredContext` replaces `ThreadStarterBody` + `ThreadHistoryBody` in `MsgContext`/`FinalizedMsgContext`. The thread prefix logic in `get-reply-run.ts` becomes a no-op for SDK sessions.

## Data Model

### ChannelSnapshot (always attached, ~500-1500 tokens)

The anchor message (full text) plus a compact adjacency window of nearby channel messages.

```ts
interface ChannelSnapshot {
  schema_version: "1.0"
  channel: {
    id: string
    name: string
    platform: "slack" | "discord" | "telegram" | ...
  }

  /** The message being responded to - always full text */
  anchor: {
    message_id: string
    ts: string              // ISO 8601
    author: Author
    text: string            // full, never truncated
    media: MediaRef[]
    thread_id: string | null
  }

  /** Adjacent channel messages (compact) */
  adjacent: AdjacentMessage[]
}

interface AdjacentMessage {
  message_id: string
  ts: string
  author: Author
  snippet: string           // first ~150 chars, deterministic truncation
  thread_activity: {
    reply_count: number
    replies_last_1h: number
    last_reply_ts: string | null
  } | null
  has_media: boolean
  reactions: string[]       // e.g. [":white_check_mark: 3", ":eyes: 2"]
}

interface Author {
  user_id: string
  display_name: string
  is_bot: boolean
}

interface MediaRef {
  artifact_id: string
  media_type: string        // "image/png", "audio/mpeg", etc.
  filename: string | null
  byte_length: number
}
```

**Key design decisions:**

- No `thread_bundle_ref` pointers - Claude fetches threads via tools, not pre-attached bundles.
- No configurable `snippet_policy` - one strategy (first N chars), hardcoded. YAGNI.
- Reactions included (free context, near-zero token cost).
- Anchor is inline (no separate SlackEventContext artifact).
- `has_media` is a boolean signal, not full artifact refs.

### ThreadContext (conditional, ~1-8K tokens)

Present only when the anchor message is in a thread or has replies.

```ts
interface ThreadContext {
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

interface ThreadReply {
  message_id: string;
  ts: string;
  author: Author;
  text: string; // full if fits budget, truncated with "..." if not
  is_truncated: boolean;
  media: MediaRef[];
}
```

**Budgeting rule:** Start from most recent replies, work backward until hitting the token budget (default 8K). Root message always included in full. The budgeting logic is factored out into a standalone function for easy tuning/replacement.

### Tools

Two tools, split by intent:

#### `channel.context` - Exploratory search

Claude uses this when it needs broader context beyond the provided snapshot.

```ts
interface ChannelContextInput {
  /** What you're trying to understand or find context for */
  intent: string;
  /** Optional: narrow to a time window */
  since?: string;
  /** Optional: boost results from specific authors */
  authors?: string[];
  max_results?: number; // default 8
}

interface ChannelContextOutput {
  results: Array<{
    message_id: string;
    thread_id: string | null;
    ts: string;
    author: Author;
    text: string;
    thread_summary: {
      reply_count: number;
      last_reply_ts: string;
      participant_names: string[];
    } | null;
    relevance_signal: string; // "keyword:rollout", "recent_activity", etc.
  }>;
  coverage: {
    messages_scanned: number;
    time_range: [string, string];
  };
}
```

**Implementation:** Keyword extraction from `intent`, BM25/substring match over channel message store, ranked by relevance + recency + activity. Deterministic, no LLM calls.

#### `channel.messages` - Precise data fetch

Claude uses this when it knows exactly what it wants.

```ts
interface ChannelMessagesInput {
  /** Fetch a specific thread (root + all replies) */
  thread_id?: string;
  /** Fetch specific messages by ID */
  message_ids?: string[];
  /** Fetch a media artifact as a content block */
  media_artifact_id?: string;
  /** For threads: max replies to return (most recent first) */
  max_replies?: number; // default 50
}

interface ChannelMessagesOutput {
  thread?: ThreadContext;
  messages?: Array<{
    message_id: string;
    ts: string;
    author: Author;
    text: string;
    media: MediaRef[];
  }>;
  media?: {
    artifact_id: string;
    media_type: string;
    content: ContentBlock;
  };
}
```

**Both tools** are registered at session creation with the channel ID baked into their closure. Internally they query the channel message cache (see Caching section).

## Caching

Builds on existing infrastructure. Only one new cache layer is needed.

### Existing (no changes needed)

| Layer             | Implementation                            | Cache behavior                                                                                  |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Channel adjacency | `channelHistories` Map in monitor context | Event-stream write-through. Every incoming message is recorded. Zero API calls in steady state. |
| Thread starters   | `THREAD_STARTER_CACHE` in `media.ts`      | TTL cache (6h), max 2000 entries. API call only on miss.                                        |

### New: Thread Reply Cache

`resolveSlackThreadHistory()` currently calls `conversations.replies` on every thread reply event. Add a cache with the same pattern as the existing thread starter cache:

```ts
const THREAD_REPLIES_CACHE = new Map<string, ThreadRepliesCacheEntry>();
const THREAD_REPLIES_CACHE_TTL_MS = 5 * 60_000; // 5 min (replies change more than starters)
const THREAD_REPLIES_CACHE_MAX = 500;

interface ThreadRepliesCacheEntry {
  replies: SlackThreadMessage[];
  replyCount: number;
  cachedAt: number;
}
```

**Incremental update:** When a `message` event arrives with a `thread_ts` and the thread is in cache, append the new reply instead of re-fetching. Full re-fetch only on cache miss or TTL expiry.

### New: Media Content Cache

On-demand LRU cache for downloaded media. Media is immutable after upload, so no invalidation needed except LRU eviction.

```ts
// LRU cache, keyed by artifact_id, max ~50MB total size
interface MediaContentCache {
  entries: LRUMap<string, CachedMedia>;
}

interface CachedMedia {
  artifact_id: string;
  media_type: string;
  content: Buffer;
  byte_length: number;
  fetched_at: number;
}
```

### API call analysis

| Scenario                                         | API calls                                      |
| ------------------------------------------------ | ---------------------------------------------- |
| Steady state, message in active channel          | **0** (window + thread cache warm from events) |
| Process restart / cold start                     | 1x `conversations.history` per active channel  |
| Tool: `channel.context` search                   | **0** (searches in-memory window)              |
| Tool: `channel.messages` for cached thread       | **0**                                          |
| Tool: `channel.messages` for uncached old thread | 1x `conversations.replies`                     |
| Tool: `channel.messages` for media               | 0-1 (cached after first fetch)                 |

### Rate limit protection

```ts
interface RateLimitConfig {
  /** Max Slack API calls per minute per workspace */
  max_calls_per_min: number; // default 40 (Slack tier 3 is 50+)
  /** Queue excess calls instead of dropping */
  overflow_strategy: "queue" | "degrade";
  /** If degrading: serve stale cache */
  stale_serve_ttl: number;
}
```

If rate limited: serve stale cache data and surface a note in the tool response.

## Attachment Manifest (Media Deduplication)

Tracks every media attachment included in the conversation to prevent re-sending identical content across turns.

### Data model

```ts
interface AttachmentManifest {
  entries: Record<string, AttachmentRecord>; // keyed by artifact_id
}

interface AttachmentRecord {
  artifact_id: string;
  display_name: string; // human-readable name used when presenting to Claude
  media_type: string;
  content_hash: string; // SHA-256 of content bytes
  source_message_id: string;
  source_thread_id: string | null; // null = top-level channel message
  included_at_turn: number;
}
```

### Lifecycle

1. **New session:** Manifest starts empty.
2. **Each turn:** Before attaching media, check manifest by `artifact_id` (exact match) and `content_hash` (re-upload detection). If found, include a text reference instead of bytes.
3. **Persist:** `sessionManager.appendCustomEntry("openclaw:claude-sdk-attachment-manifest", JSON.stringify(manifest))` after each turn with new attachments.
4. **Resume (gateway restart):** Load from JSONL entries, same pattern as `openclaw:claude-sdk-session-id`.

### Post-compaction re-attachment

When compaction is detected (same mechanism as Pi Agent), re-attach media from the current thread only:

1. Filter manifest: `Object.values(manifest.entries).filter(e => e.source_thread_id === currentThreadId)` — captures both root message and all reply attachments since `thread_id` = root `ts` in Slack's model.
2. Enqueue as SDK messages prepended to the next `session.prompt()` call.
3. Include a text preamble: `"[Post-compaction context recovery: re-attaching {N} media items from this thread]"`
4. Do not update manifest — these are re-inclusions, not new attachments.

**Adjacent thread media is NOT re-attached.** If Claude needs it again post-compaction, it can call `channel.messages` via tool.

## System Prompt

~450-500 tokens. Appended to the system message during session creation in `create-session.ts`, only when structured context is attached.

```
CHANNEL CONTEXT

You have structured context about the channel conversation attached to this session.

DATA PROVIDED
1. ChannelSnapshot (JSON): The message you're responding to (anchor) plus adjacent
   channel messages with compact snippets and thread activity signals.
   - anchor.text is always the full message text.
   - adjacent[].snippet is a short preview only. Use the channel.context tool for more.
   - adjacent[].thread_activity shows reply counts and recency.
   - adjacent[].reactions may indicate community consensus or attention.

2. ThreadContext (JSON): If the anchor message is in a thread, the full thread is
   provided - root message plus replies (most recent first if truncated).
   - truncation.total_replies vs truncation.included_replies tells you if replies
     were omitted. Use channel.messages to retrieve omitted replies.

3. Media: Images, audio, and documents from the current thread may be attached as
   content blocks. The attachment manifest tracks what has been included.
   - If media is referenced in the ChannelSnapshot (has_media: true) but not attached,
     use channel.messages with media_artifact_id to retrieve it.

TOOLS
- channel.context: Search for relevant messages and threads in this channel.
  Use when you need broader context beyond the provided snapshot.
  Input: { intent: string, since?: string, authors?: string[] }

- channel.messages: Fetch specific content by ID - a full thread, specific messages,
  or a media attachment.
  Input: { thread_id?: string, message_ids?: string[], media_artifact_id?: string }

HOW TO RESPOND
A) Start from the anchor message. Most questions can be answered from the anchor +
   ThreadContext alone.
B) Check the ChannelSnapshot for related adjacent activity. Prefer threads with
   high reply counts, recent activity, or reactions.
C) If adjacent context seems relevant but the snippet is insufficient, call
   channel.context with a description of what you need.
D) If you need a specific thread or media artifact, call channel.messages with the ID.
E) Cite message sources naturally (e.g., "Sam mentioned earlier..." or "In the thread
   about the rollout plan..."). Do not expose raw message IDs to users.
F) If information is not available in any provided context or tool results, say so.

CONSTRAINTS
- Tools are scoped to the current channel only. You cannot access other channels.
- Media is opt-in. Only request media when it is directly relevant to answering.
- Do not re-request media that is already attached to this conversation.
```

## Code Placement

All new code in `src/agents/claude-sdk-runner/`:

| File                          | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `context/channel-snapshot.ts` | `ChannelSnapshot` type + builder from channel intake data          |
| `context/thread-context.ts`   | `ThreadContext` type + builder with token budgeting                |
| `context/budget.ts`           | Token budgeting logic (factored out for easy tuning)               |
| `context/tools.ts`            | `channel.context` + `channel.messages` tool definitions + handlers |
| `context/cache.ts`            | Thread reply cache + media content cache                           |
| `attachment-manifest.ts`      | `AttachmentManifest` type + persist/load/dedup logic               |
| `create-session.ts`           | Integration: attach context, register tools, manifest lifecycle    |

Channel intake code (`src/slack/monitor/`, etc.) remains unchanged. The existing `channelHistories` and `THREAD_STARTER_CACHE` are consumed as-is.

## What This Replaces

| Current                                         | New                                                        |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `ThreadStarterBody` string in `MsgContext`      | `ThreadContext.root.text` in structured JSON               |
| `ThreadHistoryBody` string prepended every turn | `ThreadContext` attached once at session creation          |
| Thread prefix logic in `get-reply-run.ts`       | No-op for SDK sessions                                     |
| `resolveSlackThreadHistory()` called per event  | Thread reply cache with event-stream append                |
| No media tracking across turns                  | `AttachmentManifest` with dedup + post-compaction recovery |
| No channel adjacency for Claude                 | `ChannelSnapshot` with adjacent message index              |
| No tools for deeper exploration                 | `channel.context` + `channel.messages`                     |
