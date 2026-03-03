/**
 * Append-only JSONL storage for event envelopes.
 *
 * Layout: {stateDir}/event-ledger/{agentId}/{YYYY-MM-DD}.jsonl
 * Summaries: {stateDir}/event-ledger/summaries/{YYYY-MM-DD}.jsonl
 *
 * Writes are buffered. The buffer is flushed when:
 *  - flushIntervalMs elapses, or
 *  - maxBufferSize events are queued, or
 *  - close() is called.
 *
 * fsync is called after each flush for durability.
 */

import { openSync, closeSync, mkdirSync, fsyncSync, writeSync, existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { EventLedgerConfig } from "./config.js";
import type { EventEnvelope, RunSummary } from "./types.js";

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateStr(iso: string): string {
  // Extract YYYY-MM-DD from an ISO-8601 timestamp
  return iso.slice(0, 10);
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// FileHandle cache — reuse open file descriptors within the same day
// ---------------------------------------------------------------------------

type OpenFile = { fd: number; path: string };

// ---------------------------------------------------------------------------
// EventStorage
// ---------------------------------------------------------------------------

export class EventStorage {
  private buffer: EventEnvelope[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private openFiles = new Map<string, OpenFile>();
  private closed = false;

  constructor(
    private readonly stateDir: string,
    private readonly config: EventLedgerConfig,
    private readonly logger: Logger,
  ) {}

  /** Begin the periodic flush timer. */
  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
    // Allow the process to exit even if the timer is active
    if (this.flushTimer && typeof this.flushTimer === "object" && "unref" in this.flushTimer) {
      this.flushTimer.unref();
    }
  }

  /** Append an event to the write buffer. Non-blocking. */
  appendEvent(envelope: EventEnvelope): void {
    if (this.closed) return;
    this.buffer.push(envelope);
    if (this.buffer.length >= this.config.maxBufferSize) {
      this.flush();
    }
  }

  /** Append a run summary to the summaries ledger. */
  appendSummary(summary: RunSummary): void {
    if (this.closed) return;
    const day = dateStr(summary.endedAt);
    const dir = join(this.stateDir, "event-ledger", "summaries");
    ensureDir(dir);
    const filePath = join(dir, `${day}.jsonl`);
    const line = JSON.stringify(summary) + "\n";
    try {
      const fd = openSync(filePath, "a");
      try {
        writeSync(fd, line);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    } catch (err) {
      this.logger.error(`[event-ledger] Failed to write summary: ${String(err)}`);
    }
  }

  /** Flush all buffered events to disk synchronously. */
  flush(): void {
    if (this.buffer.length === 0) return;
    const events = this.buffer;
    this.buffer = [];

    // Group events by their target file (agentId + day)
    const groups = new Map<string, { dir: string; file: string; lines: string[] }>();
    for (const evt of events) {
      const agentId = evt.agentId ?? "_default";
      const day = dateStr(evt.ts);
      const key = `${agentId}/${day}`;
      let group = groups.get(key);
      if (!group) {
        const dir = join(this.stateDir, "event-ledger", agentId);
        group = { dir, file: `${day}.jsonl`, lines: [] };
        groups.set(key, group);
      }
      group.lines.push(JSON.stringify(evt));
    }

    for (const [key, { dir, file, lines }] of groups) {
      try {
        ensureDir(dir);
        const filePath = join(dir, file);
        const fd = this.getOrOpenFile(key, filePath);
        const chunk = lines.join("\n") + "\n";
        writeSync(fd, chunk);
        fsyncSync(fd);
      } catch (err) {
        this.logger.error(`[event-ledger] Flush error for ${key}: ${String(err)}`);
      }
    }
  }

  /** Stop the timer and flush remaining events. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
    // Close all open file descriptors
    for (const { fd } of this.openFiles.values()) {
      try {
        closeSync(fd);
      } catch {
        // best-effort
      }
    }
    this.openFiles.clear();
  }

  // -----------------------------------------------------------------------
  // Read helpers (used by query and summarizer)
  // -----------------------------------------------------------------------

  /** Read all events from a specific day file for a given agentId. */
  async readDayEvents(agentId: string, day: string): Promise<EventEnvelope[]> {
    const filePath = join(this.stateDir, "event-ledger", agentId, `${day}.jsonl`);
    return this.parseJsonlFile<EventEnvelope>(filePath);
  }

  /** List available day files for a given agentId. */
  async listDays(agentId: string): Promise<string[]> {
    const dir = join(this.stateDir, "event-ledger", agentId);
    try {
      const entries = await readdir(dir);
      return entries
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => f.replace(".jsonl", ""))
        .sort();
    } catch {
      return [];
    }
  }

  /** List all agentId directories. */
  async listAgentIds(): Promise<string[]> {
    const dir = join(this.stateDir, "event-ledger");
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && e.name !== "summaries")
        .map((e) => e.name)
        .sort();
    } catch {
      return [];
    }
  }

  /** Read all summaries from a specific day file. */
  async readDaySummaries(day: string): Promise<RunSummary[]> {
    const filePath = join(this.stateDir, "event-ledger", "summaries", `${day}.jsonl`);
    return this.parseJsonlFile<RunSummary>(filePath);
  }

  /** List available summary day files. */
  async listSummaryDays(): Promise<string[]> {
    const dir = join(this.stateDir, "event-ledger", "summaries");
    try {
      const entries = await readdir(dir);
      return entries
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => f.replace(".jsonl", ""))
        .sort();
    } catch {
      return [];
    }
  }

  /** Return the base directory for retention operations. */
  get baseDir(): string {
    return join(this.stateDir, "event-ledger");
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private getOrOpenFile(key: string, filePath: string): number {
    const existing = this.openFiles.get(key);
    if (existing && existing.path === filePath) return existing.fd;
    // Close stale descriptor if the key was reused with a different path
    if (existing) {
      try {
        closeSync(existing.fd);
      } catch {
        // best-effort
      }
    }
    const fd = openSync(filePath, "a");
    this.openFiles.set(key, { fd, path: filePath });
    return fd;
  }

  private async parseJsonlFile<T>(filePath: string): Promise<T[]> {
    try {
      const content = await readFile(filePath, "utf-8");
      const results: T[] = [];
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          results.push(JSON.parse(trimmed) as T);
        } catch {
          // Skip malformed lines
        }
      }
      return results;
    } catch {
      return [];
    }
  }
}
