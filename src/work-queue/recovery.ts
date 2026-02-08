import fs from "node:fs/promises";
import type { WorkItem } from "./types.js";
import { type WorkQueueStore, getDefaultWorkQueueStore, resolveWorkQueueDbPath } from "./store.js";
import { DEFAULT_HEARTBEAT_TTL_MS } from "./worker-defaults.js";

export type RecoveryResult = {
  recovered: WorkItem[];
  failed: Array<{ itemId: string; error: string }>;
};

export type RecoveryOptions = {
  /** Heartbeat TTL in ms before recovery considers an item stale. */
  heartbeatTtlMs?: number;
  /** Override current time for tests. */
  now?: Date;
};

/**
 * Scan for in_progress work items and reset them to pending.
 * Called on gateway startup to recover from crashes/restarts.
 *
 * Accepts an optional store for testing; defaults to the global singleton.
 * When using the default store, skips recovery if the DB file doesn't exist
 * (avoids creating an empty SQLite DB on gateways that never use the work queue).
 */
export async function recoverOrphanedWorkItems(
  store?: WorkQueueStore,
  options?: RecoveryOptions,
): Promise<RecoveryResult> {
  if (!store) {
    // Skip if the work queue DB has never been created.
    const dbPath = resolveWorkQueueDbPath();
    try {
      await fs.access(dbPath);
    } catch {
      return { recovered: [], failed: [] };
    }
    store = await getDefaultWorkQueueStore();
  }

  const recovered: WorkItem[] = [];
  const failed: Array<{ itemId: string; error: string }> = [];
  const now = options?.now ?? new Date();
  const ttlMs = options?.heartbeatTtlMs ?? DEFAULT_HEARTBEAT_TTL_MS;

  const orphaned = await store.listItems({ status: "in_progress" });
  const stale = orphaned.filter((item) => {
    if (!item.lastHeartbeatAt) {
      return true;
    }
    const parsed = Date.parse(item.lastHeartbeatAt);
    if (Number.isNaN(parsed)) {
      return true;
    }
    return now.getTime() - parsed > ttlMs;
  });

  for (const item of stale) {
    try {
      const previousAssignment =
        item.assignedTo?.sessionKey ?? item.assignedTo?.agentId ?? "unknown";
      const heartbeatNote = item.lastHeartbeatAt ? "stale heartbeat" : "missing heartbeat";
      const updated = await store.updateItem(item.id, {
        status: "pending",
        statusReason: `Recovered after gateway restart (${heartbeatNote}; was assigned to ${previousAssignment})`,
        assignedTo: undefined,
        startedAt: undefined,
        lastHeartbeatAt: undefined,
      });
      recovered.push(updated);
    } catch (err) {
      failed.push({
        itemId: item.id,
        error: String(err),
      });
    }
  }

  return { recovered, failed };
}
