/**
 * Agent-to-Agent (A2A) Communication Protocol — Audit Query Interface
 *
 * Provides filtering and pagination over the JSONL audit logs.
 * Efficiently scans only relevant daily files based on date range filters.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

import os from "node:os";
import path from "node:path";
import type { AuditEntry, AuditQueryFilters, AuditQueryResult } from "./audit-types.js";
import { readLogFile, listLogFiles } from "./audit.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_LOG_DIR = path.join(os.homedir(), ".openclaw", "a2a-log");
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 10_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the date string from a log file name.
 * e.g., "a2a-2026-02-21.jsonl" → "2026-02-21"
 *       "a2a-2026-02-21.1.jsonl" → "2026-02-21"
 */
function extractDateFromFilename(filename: string): string | null {
  const match = /^a2a-(\d{4}-\d{2}-\d{2})(?:\.\d+)?\.jsonl$/.exec(path.basename(filename));
  return match ? match[1] : null;
}

/**
 * Check if a log file's date falls within the given date range.
 */
function isFileInDateRange(
  filePath: string,
  sinceDate: string | undefined,
  untilDate: string | undefined,
): boolean {
  const fileDate = extractDateFromFilename(filePath);
  if (!fileDate) {
    return false;
  }

  if (sinceDate && fileDate < sinceDate.slice(0, 10)) {
    return false;
  }
  if (untilDate && fileDate > untilDate.slice(0, 10)) {
    return false;
  }

  return true;
}

/**
 * Check if an audit entry matches the given filters.
 */
function matchesFilters(entry: AuditEntry, filters: AuditQueryFilters): boolean {
  const msg = entry.message;

  // agentId — match in from OR to
  if (filters.agentId) {
    if (msg.from.agentId !== filters.agentId && msg.to.agentId !== filters.agentId) {
      return false;
    }
  }

  // type
  if (filters.type && msg.type !== filters.type) {
    return false;
  }

  // since
  if (filters.since && msg.timestamp < filters.since) {
    return false;
  }

  // until
  if (filters.until && msg.timestamp > filters.until) {
    return false;
  }

  // correlationId
  if (filters.correlationId) {
    if (msg.correlationId !== filters.correlationId) {
      return false;
    }
  }

  // priority
  if (filters.priority && msg.priority !== filters.priority) {
    return false;
  }

  return true;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface QueryOptions {
  /** Override the log directory (default: ~/.openclaw/a2a-log/) */
  logDir?: string;
}

/**
 * Query the A2A audit log with filters and pagination.
 *
 * Efficiently reads only daily log files that could contain matching entries
 * (based on date range), then applies all filters in-memory.
 */
export async function queryA2ALog(
  filters: AuditQueryFilters = {},
  options: QueryOptions = {},
): Promise<AuditQueryResult> {
  const logDir = options.logDir ?? DEFAULT_LOG_DIR;
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = filters.offset ?? 0;

  // List available log files
  const allFiles = await listLogFiles(logDir);

  // Filter to only relevant date range
  const relevantFiles = allFiles.filter((f) => isFileInDateRange(f, filters.since, filters.until));

  // Read and filter entries
  const allMatching: AuditEntry[] = [];

  for (const filePath of relevantFiles) {
    const entries = await readLogFile(filePath);
    for (const entry of entries) {
      if (matchesFilters(entry, filters)) {
        allMatching.push(entry);
      }
    }
  }

  // Apply pagination
  const totalCount = allMatching.length;
  const paged = allMatching.slice(offset, offset + limit);

  return {
    entries: paged,
    totalCount,
    filters,
  };
}

// Export internals for testing
export const _queryInternals = {
  extractDateFromFilename,
  isFileInDateRange,
  matchesFilters,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
