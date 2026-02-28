import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { HistoryEntry } from "./history.js";
import { evictOldHistoryKeys, MAX_HISTORY_KEYS } from "./history.js";

export interface ChannelHistoryFetcher {
  fetchRecentMessages(channelId: string, limit: number): Promise<HistoryEntry[]>;
}

const log = createSubsystemLogger("channel-snapshot");

/**
 * Rolling snapshot of recent channel messages. Unlike `channelHistories` (which
 * clears after every bot reply dispatch), this store persists across dispatches
 * so `adjacentMessages` in StructuredContextInput always has context.
 */
export class ChannelSnapshotStore {
  private snapshots: Map<string, HistoryEntry[]> = new Map();
  private seeded: Set<string> = new Set();
  private limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  /** Append a single entry (bystander message observed live). */
  record(channelId: string, entry: HistoryEntry): void {
    const existing = this.snapshots.get(channelId) ?? [];
    existing.push(entry);
    while (existing.length > this.limit) {
      existing.shift();
    }
    // Refresh insertion order for LRU eviction
    if (this.snapshots.has(channelId)) {
      this.snapshots.delete(channelId);
    }
    this.snapshots.set(channelId, existing);
    evictOldHistoryKeys(this.snapshots, MAX_HISTORY_KEYS);
  }

  /** Get current snapshot for a channel. */
  get(channelId: string): HistoryEntry[] {
    return this.snapshots.get(channelId) ?? [];
  }

  /** Returns true if this channel has already been seeded. */
  isSeeded(channelId: string): boolean {
    return this.seeded.has(channelId);
  }

  /** Seed from API (once per channel per process). Reconciles with existing live entries. */
  async seedOnce(channelId: string, fetcher: ChannelHistoryFetcher): Promise<void> {
    if (this.seeded.has(channelId)) {
      const entries = this.snapshots.get(channelId) ?? [];
      log.debug(`channel snapshot already seeded channelId=${channelId} entries=${entries.length}`);
      return;
    }
    // Mark before fetch to prevent concurrent double-fetch
    this.seeded.add(channelId);

    try {
      log.debug(`seeding channel snapshot channelId=${channelId} limit=${this.limit}`);
      const fetched = await fetcher.fetchRecentMessages(channelId, this.limit);
      const existing = this.snapshots.get(channelId) ?? [];

      // Reconcile: dedup by messageId, prefer live entries for duplicates
      const liveIds = new Set(existing.map((e) => e.messageId).filter(Boolean));
      const deduped = fetched.filter((e) => !e.messageId || !liveIds.has(e.messageId));
      const merged = [...deduped, ...existing];
      merged.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
      while (merged.length > this.limit) {
        merged.shift();
      }

      this.snapshots.set(channelId, merged);
      evictOldHistoryKeys(this.snapshots, MAX_HISTORY_KEYS);

      for (const entry of fetched) {
        const truncated = entry.body.length > 70 ? `${entry.body.slice(0, 70)}...` : entry.body;
        log.debug(`  [${entry.timestamp}] ${entry.sender}: ${truncated}`);
      }
      log.debug(
        `channel snapshot seeded: channelId=${channelId} fetched=${fetched.length} existing=${existing.length} merged=${merged.length}`,
      );
    } catch (err) {
      log.warn(`channel snapshot seed failed: channelId=${channelId} error=${String(err)}`);
    }
  }
}
