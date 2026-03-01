import node_fs from "node:fs";
import node_path from "node:path";
import type { TelemetryConfig, TelemetryEvent, TelemetryEventKind } from "./types.js";
import { generateEventId } from "./helpers.js";

/**
 * Append-only JSONL writer with daily/weekly rotation.
 *
 * Current log:  <baseDir>/events.jsonl
 * After rotate: <baseDir>/events.YYYY-MM-DD.jsonl  (daily)
 *               <baseDir>/events.YYYY-WNN.jsonl     (weekly, ISO week)
 *
 * The writer maintains a monotonic `seq` counter scoped to the process lifetime.
 * On rotation the counter continues monotonically — it is NOT reset to zero.
 */
export class JsonlWriter {
  private stream: node_fs.WriteStream;
  private seq = 0;
  private currentKey: string;
  private readonly baseDir: string;
  private readonly rotationPolicy: "daily" | "weekly" | "none";

  constructor(baseDir: string, config: Pick<TelemetryConfig, "rotationPolicy">) {
    this.baseDir = baseDir;
    this.rotationPolicy = config.rotationPolicy ?? "daily";
    this.currentKey = this.rotationKey();
    this.stream = this.openStream();
  }

  /**
   * Finalize a partial event record, assign an id/ts/seq, and write it as a
   * JSON line.  The caller provides all domain-specific fields; this method
   * fills in the bookkeeping fields.
   */
  append(partial: Partial<TelemetryEvent> & { kind: TelemetryEventKind }): void {
    this.maybeRotate();
    const event: TelemetryEvent = {
      id: generateEventId(),
      ts: Date.now(),
      seq: this.seq++,
      agentId: partial.agentId ?? "unknown",
      sessionKey: partial.sessionKey ?? "unknown",
      sessionId: partial.sessionId ?? "unknown",
      runId: partial.runId,
      kind: partial.kind,
      stream: partial.stream,
      data: partial.data ?? {},
      error: partial.error,
      source: partial.source ?? "hook",
      hookName: partial.hookName,
      blobRefs: partial.blobRefs,
    };
    // Synchronous write so data survives crashes (WriteStream is append-mode).
    this.stream.write(`${JSON.stringify(event)}\n`);
  }

  /**
   * Flush and close the underlying write stream. Resolves when the stream is
   * fully closed.
   */
  async close(): Promise<void> {
    return new Promise<void>((resolve) => this.stream.end(resolve));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private maybeRotate(): void {
    if (this.rotationPolicy === "none") return;
    const now = this.rotationKey();
    if (now === this.currentKey) return;

    // Close current stream before renaming.
    this.stream.end();

    const currentPath = node_path.join(this.baseDir, "events.jsonl");
    const archivePath = node_path.join(this.baseDir, `events.${this.currentKey}.jsonl`);
    try {
      node_fs.renameSync(currentPath, archivePath);
    } catch {
      // First write or file already absent — harmless.
    }

    this.currentKey = now;
    this.stream = this.openStream();
  }

  private rotationKey(): string {
    if (this.rotationPolicy === "weekly") {
      return isoWeekKey(new Date());
    }
    // Default: daily (YYYY-MM-DD)
    return new Date().toISOString().slice(0, 10);
  }

  private openStream(): node_fs.WriteStream {
    const filePath = node_path.join(this.baseDir, "events.jsonl");
    return node_fs.createWriteStream(filePath, { flags: "a" });
  }
}

/**
 * Factory function for creating a JsonlWriter. Returns a `{ write, close }`
 * interface suitable for injection into the collector.
 */
export function createJsonlWriter(
  baseDir: string,
  config: Pick<TelemetryConfig, "rotationPolicy">,
): { write: (partial: Partial<TelemetryEvent> & { kind: TelemetryEventKind }) => void; close: () => Promise<void> } {
  const writer = new JsonlWriter(baseDir, config);
  return {
    write: (partial) => writer.append(partial),
    close: () => writer.close(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return an ISO 8601 year-week string like "2026-W09" for daily-week grouping.
 */
function isoWeekKey(date: Date): string {
  // Copy date to find Thursday of the same week (ISO week rule)
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Day 4 = Thursday; adjust so Monday=1
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
