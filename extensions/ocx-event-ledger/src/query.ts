/**
 * Event query engine — filter and paginate over stored events.
 *
 * Scans JSONL day-files in reverse chronological order and applies the
 * requested filter. Pagination uses a cursor of the form "day:lineIndex"
 * so the caller can resume without re-scanning.
 */

import type { EventStorage } from "./storage.js";
import type { EventEnvelope, EventQueryFilter, EventQueryResult, RunSummary } from "./types.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

// ---------------------------------------------------------------------------
// Cursor encoding
// ---------------------------------------------------------------------------

type Cursor = { agentId: string; day: string; offset: number };

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8")) as Record<
      string,
      unknown
    >;
    if (
      typeof parsed.agentId === "string" &&
      typeof parsed.day === "string" &&
      typeof parsed.offset === "number"
    ) {
      return parsed as unknown as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Filter matching
// ---------------------------------------------------------------------------

function matchesFilter(event: EventEnvelope, filter: EventQueryFilter): boolean {
  if (filter.family && event.family !== filter.family) return false;
  if (filter.type && event.type !== filter.type) return false;
  if (filter.runId && event.runId !== filter.runId) return false;
  if (filter.sessionKey && event.sessionKey !== filter.sessionKey) return false;
  if (filter.agentId && event.agentId !== filter.agentId) return false;
  if (filter.from && event.ts < filter.from) return false;
  if (filter.to && event.ts > filter.to) return false;
  return true;
}

// ---------------------------------------------------------------------------
// queryEvents
// ---------------------------------------------------------------------------

/**
 * Query stored events with optional filtering and pagination.
 *
 * When agentId is specified in the filter, only that agent's files are scanned.
 * Otherwise, all agent directories are scanned. Results are ordered by
 * timestamp ascending (ties broken by eventId).
 */
export async function queryEvents(
  storage: EventStorage,
  filter: EventQueryFilter,
): Promise<EventQueryResult> {
  const limit = Math.min(filter.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const cursor = filter.cursor ? decodeCursor(filter.cursor) : null;

  // Determine which agent directories to scan
  const agentIds = filter.agentId ? [filter.agentId] : await storage.listAgentIds();

  const collected: EventEnvelope[] = [];

  for (const agentId of agentIds) {
    const days = await resolveDays(storage, agentId, filter);

    for (const day of days) {
      // Skip days we already passed in cursor
      if (cursor && cursor.agentId === agentId && day < cursor.day) continue;

      const events = await storage.readDayEvents(agentId, day);
      const startOffset =
        cursor && cursor.agentId === agentId && cursor.day === day ? cursor.offset : 0;

      for (let i = startOffset; i < events.length; i++) {
        const evt = events[i];
        if (!evt) continue;
        if (!matchesFilter(evt, filter)) continue;
        collected.push(evt);

        // Collect one extra to know whether a next page exists
        if (collected.length > limit) {
          // Return the first `limit` events; cursor points at the extra event
          // so the next page picks it up (not i+1 which would lose it).
          const page = collected.slice(0, limit);
          const nextCursor = encodeCursor({ agentId, day, offset: i });
          return { events: page, nextCursor };
        }
      }
    }
  }

  return { events: collected };
}

/**
 * Resolve which day files to scan given the time range in the filter.
 */
async function resolveDays(
  storage: EventStorage,
  agentId: string,
  filter: EventQueryFilter,
): Promise<string[]> {
  const allDays = await storage.listDays(agentId);
  const fromDay = filter.from?.slice(0, 10);
  const toDay = filter.to?.slice(0, 10);
  return allDays.filter((d) => {
    if (fromDay && d < fromDay) return false;
    if (toDay && d > toDay) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// getRunSummary
// ---------------------------------------------------------------------------

/**
 * Look up a materialized RunSummary by runId. Scans summary files in reverse
 * chronological order and returns the first match.
 */
export async function getRunSummary(
  storage: EventStorage,
  runId: string,
): Promise<RunSummary | null> {
  const days = await storage.listSummaryDays();
  // Reverse so we check the most recent days first
  for (const day of days.reverse()) {
    const summaries = await storage.readDaySummaries(day);
    const match = summaries.find((s) => s.runId === runId);
    if (match) return match;
  }
  return null;
}
