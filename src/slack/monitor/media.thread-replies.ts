import type { SlackThreadMessage } from "./media.js";

interface ThreadRepliesCacheEntry {
  replies: SlackThreadMessage[];
  cachedAt: number;
}

const THREAD_REPLIES_CACHE = new Map<string, ThreadRepliesCacheEntry>();
const THREAD_REPLIES_CACHE_TTL_MS = 5 * 60_000;
const THREAD_REPLIES_CACHE_MAX = 500;

function evictThreadRepliesCache(): void {
  const now = Date.now();
  for (const [key, entry] of THREAD_REPLIES_CACHE.entries()) {
    if (now - entry.cachedAt > THREAD_REPLIES_CACHE_TTL_MS) {
      THREAD_REPLIES_CACHE.delete(key);
    }
  }
  if (THREAD_REPLIES_CACHE.size <= THREAD_REPLIES_CACHE_MAX) {
    return;
  }
  const excess = THREAD_REPLIES_CACHE.size - THREAD_REPLIES_CACHE_MAX;
  let removed = 0;
  for (const key of THREAD_REPLIES_CACHE.keys()) {
    THREAD_REPLIES_CACHE.delete(key);
    if (++removed >= excess) {
      break;
    }
  }
}

export function cacheThreadReply(
  channelId: string,
  threadTs: string,
  replies: SlackThreadMessage[],
): void {
  evictThreadRepliesCache();
  const key = `${channelId}:${threadTs}`;
  THREAD_REPLIES_CACHE.set(key, { replies, cachedAt: Date.now() });
}

export function getCachedThreadReplies(
  channelId: string,
  threadTs: string,
): ThreadRepliesCacheEntry | undefined {
  const key = `${channelId}:${threadTs}`;
  const entry = THREAD_REPLIES_CACHE.get(key);
  if (!entry) {
    return undefined;
  }
  if (Date.now() - entry.cachedAt > THREAD_REPLIES_CACHE_TTL_MS) {
    THREAD_REPLIES_CACHE.delete(key);
    return undefined;
  }
  return entry;
}

/** @internal test only */
export function resetThreadRepliesCacheForTest(): void {
  THREAD_REPLIES_CACHE.clear();
}
