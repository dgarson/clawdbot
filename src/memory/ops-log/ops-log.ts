/**
 * Memory Operations Log — JSONL persistence.
 *
 * Mirrors src/infra/audit/audit-log.ts: monthly rotation, retention policy, pub/sub.
 * Logs are stored at <stateDir>/ops-logs/ (typically ~/.openclaw/ops-logs/).
 */

import crypto from "node:crypto";
import { mkdir, readFile, appendFile, readdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { MemoryOpsEvent, MemoryOpsQueryParams, MemoryOpsQueryResult } from "./types.js";
import { emitMemoryOpsEvent } from "./ops-events.js";
import { MEMORY_OPS_RETENTION_DAYS, MAX_MEMORY_OPS_EVENTS_PER_QUERY } from "./types.js";

/** Subdirectory under stateDir for memory ops data. */
const MEMORY_OPS_SUBDIR = "ops-logs";

/** Get the current month's log file name. */
function getCurrentLogFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `ops-${year}-${month}.jsonl`;
}

/** Resolve the memory ops directory path. */
export function resolveMemoryOpsDir(stateDir: string): string {
  return join(stateDir, MEMORY_OPS_SUBDIR);
}

/** Resolve the current memory ops log file path. */
export function resolveCurrentMemoryOpsLogPath(stateDir: string): string {
  return join(resolveMemoryOpsDir(stateDir), getCurrentLogFileName());
}

/** Append a memory ops event to the log. */
export async function appendMemoryOpsEvent(stateDir: string, event: MemoryOpsEvent): Promise<void> {
  const logPath = resolveCurrentMemoryOpsLogPath(stateDir);
  await mkdir(dirname(logPath), { recursive: true });

  const line = JSON.stringify(event) + "\n";
  await appendFile(logPath, line, "utf-8");

  emitMemoryOpsEvent(event);
}

/** Create and log a memory ops event (adds id + ts). */
export async function logMemoryOpsEvent(
  stateDir: string,
  params: Omit<MemoryOpsEvent, "id" | "ts">,
): Promise<MemoryOpsEvent> {
  const event: MemoryOpsEvent = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    ...params,
  };

  await appendMemoryOpsEvent(stateDir, event);
  return event;
}

/** Query memory ops events with filters. */
export async function queryMemoryOpsEvents(
  stateDir: string,
  params: MemoryOpsQueryParams = {},
): Promise<MemoryOpsQueryResult> {
  const {
    action,
    backend,
    traceId,
    sessionKey,
    status,
    startTs,
    endTs,
    limit = 100,
    offset = 0,
  } = params;

  const opsDir = resolveMemoryOpsDir(stateDir);
  let allEvents: MemoryOpsEvent[] = [];

  try {
    const files = await readdir(opsDir);
    const logFiles = files.filter((f) => f.startsWith("ops-") && f.endsWith(".jsonl"));

    // Sort by date descending (newest first)
    const sortedFiles = logFiles.toSorted().toReversed();

    for (const file of sortedFiles) {
      const filePath = join(opsDir, file);
      const content = await readFile(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as MemoryOpsEvent;
          allEvents.push(event);
        } catch {
          // Skip invalid lines
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to read memory ops log:", error);
    }
    return { events: [], total: 0, hasMore: false };
  }

  // Apply filters
  let filtered = allEvents;

  if (action) {
    filtered = filtered.filter((e) => e.action === action);
  }
  if (backend) {
    filtered = filtered.filter((e) => e.backend === backend);
  }
  if (traceId) {
    filtered = filtered.filter((e) => e.traceId === traceId);
  }
  if (sessionKey) {
    filtered = filtered.filter((e) => e.sessionKey === sessionKey);
  }
  if (status) {
    filtered = filtered.filter((e) => e.status === status);
  }
  if (startTs) {
    filtered = filtered.filter((e) => e.ts >= startTs);
  }
  if (endTs) {
    filtered = filtered.filter((e) => e.ts <= endTs);
  }

  // Sort by timestamp descending
  filtered.sort((a, b) => (b.ts > a.ts ? 1 : a.ts > b.ts ? -1 : 0));

  const total = filtered.length;
  const effectiveLimit = Math.min(limit, MAX_MEMORY_OPS_EVENTS_PER_QUERY);
  const events = filtered.slice(offset, offset + effectiveLimit);
  const hasMore = offset + effectiveLimit < total;

  return { events, total, hasMore };
}

/** Clean up old memory ops log files based on retention policy. */
export async function cleanupOldMemoryOpsLogs(stateDir: string): Promise<number> {
  const opsDir = resolveMemoryOpsDir(stateDir);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MEMORY_OPS_RETENTION_DAYS);

  let deletedCount = 0;

  try {
    const files = await readdir(opsDir);
    const logFiles = files.filter((f) => f.startsWith("ops-") && f.endsWith(".jsonl"));

    for (const file of logFiles) {
      const match = file.match(/ops-(\d{4})-(\d{2})\.jsonl/);
      if (!match) {
        continue;
      }

      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const fileDate = new Date(year, month - 1, 1);

      if (fileDate < cutoffDate) {
        const filePath = join(opsDir, file);
        await unlink(filePath);
        deletedCount++;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to cleanup memory ops logs:", error);
    }
  }

  return deletedCount;
}
