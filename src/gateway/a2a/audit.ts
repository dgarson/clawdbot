/**
 * Agent-to-Agent (A2A) Communication Protocol — Audit Logger
 *
 * Logs all A2A messages to structured JSONL files for human visibility
 * and auditability. Supports daily rotation and size-based rotation.
 *
 * Log location: ~/.openclaw/a2a-log/
 * File naming: a2a-YYYY-MM-DD.jsonl (daily), a2a-YYYY-MM-DD.N.jsonl (size overflow)
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { A2AMessageLike, AuditEntry, AuditEntryMeta, DeliveryStatus } from "./audit-types.js";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default log directory */
const DEFAULT_LOG_DIR = path.join(os.homedir(), ".openclaw", "a2a-log");

/** Max bytes per daily log file before rotating (50 MB) */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// ─── Lock for concurrent-write safety ────────────────────────────────────────

const writeLocks = new Map<string, Promise<void>>();

/**
 * Serialize writes to the same file path. Node.js is single-threaded but
 * concurrent async writes to the same file can interleave. This ensures
 * each append completes before the next starts.
 */
async function withFileLock(filePath: string, fn: () => Promise<void>): Promise<void> {
  const existing = writeLocks.get(filePath) ?? Promise.resolve();
  const next = existing.then(fn, fn); // run fn after previous settles (success or fail)
  writeLocks.set(filePath, next);
  try {
    await next;
  } finally {
    // Clean up if we're the tail of the chain
    if (writeLocks.get(filePath) === next) {
      writeLocks.delete(filePath);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function logFileName(dateStr: string, index: number = 0): string {
  return index === 0 ? `a2a-${dateStr}.jsonl` : `a2a-${dateStr}.${index}.jsonl`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Find the current log file for a given date. If the current file exceeds
 * MAX_FILE_SIZE_BYTES, rotate to the next index.
 */
async function resolveLogFile(logDir: string, dateStr: string): Promise<string> {
  let index = 0;
  while (true) {
    const filePath = path.join(logDir, logFileName(dateStr, index));
    try {
      const stat = await fs.stat(filePath);
      if (stat.size >= MAX_FILE_SIZE_BYTES) {
        index++;
        continue;
      }
    } catch {
      // File doesn't exist yet — use this one
    }
    return filePath;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface LogOptions {
  /** Override the log directory (default: ~/.openclaw/a2a-log/) */
  logDir?: string;
  /** Override the "now" timestamp (for testing) */
  now?: Date;
  /** Delivery status to record */
  deliveryStatus?: DeliveryStatus;
  /** Processing time in ms */
  processingTimeMs?: number;
  /** Node/host identifier */
  processedBy?: string;
}

/**
 * Log an A2A message to the audit trail.
 *
 * Appends a single JSONL line to the current day's log file.
 * Handles directory creation, daily rotation, and size-based rotation.
 * Serializes concurrent writes to the same file.
 */
export async function logA2AMessage(
  message: A2AMessageLike,
  options: LogOptions = {},
): Promise<void> {
  const logDir = options.logDir ?? DEFAULT_LOG_DIR;
  const now = options.now ?? new Date();

  await ensureDir(logDir);

  const meta: AuditEntryMeta = {
    receivedAt: now.toISOString(),
    deliveryStatus: options.deliveryStatus ?? "delivered",
    processingTimeMs: options.processingTimeMs ?? 0,
    processedBy: options.processedBy,
  };

  const entry: AuditEntry = { message, meta };
  const line = JSON.stringify(entry) + "\n";

  const dateStr = dateString(now);
  const filePath = await resolveLogFile(logDir, dateStr);

  await withFileLock(filePath, async () => {
    await fs.appendFile(filePath, line, "utf-8");
  });
}

/**
 * Read all audit entries from a specific log file.
 * Returns an empty array if the file doesn't exist.
 */
export async function readLogFile(filePath: string): Promise<AuditEntry[]> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    return lines.map((line) => JSON.parse(line) as AuditEntry);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

/**
 * List all log files in the audit directory, sorted by name (chronological).
 */
export async function listLogFiles(logDir: string = DEFAULT_LOG_DIR): Promise<string[]> {
  try {
    const files = await fs.readdir(logDir);
    return files
      .filter((f) => f.startsWith("a2a-") && f.endsWith(".jsonl"))
      .toSorted()
      .map((f) => path.join(logDir, f));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

// Export internals for testing
export const _internals = {
  DEFAULT_LOG_DIR,
  MAX_FILE_SIZE_BYTES,
  dateString,
  logFileName,
  resolveLogFile,
  ensureDir,
  withFileLock,
};
