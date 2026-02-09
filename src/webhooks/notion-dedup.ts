/**
 * Webhook event deduplication for Notion.
 *
 * Notion may deliver multiple events for the same entity in rapid succession
 * (e.g. rapid edits aggregated into separate content_updated events).
 * This module prevents duplicate processing within a configurable window.
 */

const DEFAULT_WINDOW_MS = 30_000;
const CLEANUP_THRESHOLD = 1000;

const recentEvents = new Map<string, number>();

/**
 * Returns true if this event should be processed, false if it's a duplicate
 * within the deduplication window.
 */
export function shouldProcessNotionEvent(
  entityId: string,
  eventType: string,
  windowMs = DEFAULT_WINDOW_MS,
): boolean {
  const key = `${entityId}:${eventType}`;
  const now = Date.now();
  const lastSeen = recentEvents.get(key);

  if (lastSeen !== undefined && now - lastSeen < windowMs) {
    return false;
  }

  recentEvents.set(key, now);

  // Periodic cleanup of stale entries
  if (recentEvents.size > CLEANUP_THRESHOLD) {
    const cutoff = now - windowMs;
    for (const [k, v] of recentEvents) {
      if (v < cutoff) {
        recentEvents.delete(k);
      }
    }
  }

  return true;
}

/** Reset all dedup state (for testing). */
export function resetNotionDedup(): void {
  recentEvents.clear();
}
