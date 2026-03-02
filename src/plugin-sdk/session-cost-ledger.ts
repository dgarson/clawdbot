/**
 * Session Cost Ledger
 *
 * A typed, append-only cost tracking ledger for session-scoped and
 * system-wide API cost recording. Built on AsyncWriteQueue for
 * non-blocking disk I/O.
 *
 * Features:
 * - Synchronous `record()` — captures timestamp before async write.
 * - Out-of-order tolerant — entries sorted by timestamp at query time.
 * - Extension-contributed entries via `source: "custom"`.
 * - Optional diagnostic event emission on each record.
 * - In-memory summarisation by session, source, provider.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AsyncWriteQueue } from "./async-write-queue.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * What subsystem produced this cost entry.
 * Extensions use `"custom"` and distinguish via `meta.type` or similar.
 */
export type CostSource =
  | "llm.completion"
  | "llm.auxiliary"
  | "tts.synthesis"
  | "embedding.query"
  | "embedding.batch"
  | "transcription.audio"
  | "media.vision"
  | "custom";

/** A single cost entry in the ledger. */
export type CostEntry = {
  /** Unique ID for dedup (auto-generated if not provided). */
  id: string;
  /** When the cost was incurred — captured by the caller before enqueue. */
  timestamp: number;
  /** What subsystem produced this cost. */
  source: CostSource;
  /** Cost in USD. Undefined if unknown or free. */
  costUsd?: number;
  /** Session association (when available). */
  sessionKey?: string;
  runId?: string;
  agentId?: string;
  toolCallId?: string;
  /** Provider and model for API calls. */
  provider?: string;
  model?: string;
  /** Token usage for token-based billing. */
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  /** How long the API call took. */
  durationMs?: number;
  /** Extension-defined structured metadata. */
  meta?: Record<string, unknown>;
};

/** Input for recording — `id` and `timestamp` are auto-filled if omitted. */
export type CostEntryInput = Omit<CostEntry, "id" | "timestamp"> & {
  id?: string;
  timestamp?: number;
};

/** Aggregated cost summary. */
export type CostSummary = {
  totalCostUsd: number;
  entryCount: number;
  bySource: Map<CostSource, number>;
  byProvider: Map<string, number>;
  entries: CostEntry[];
};

export type SessionCostLedgerOptions = {
  /** Directory for cost ledger files. */
  stateDir: string;
  /** Flush interval in ms. Default: 2000. */
  flushIntervalMs?: number;
  /** Maximum in-memory entries to buffer before force-flush. Default: 500. */
  maxBufferSize?: number;
  /**
   * When true, emits a diagnostic event for each recorded cost entry.
   * Requires `emitDiagnosticEvent` from `openclaw/plugin-sdk` to be available.
   * Default: false.
   */
  emitDiagnostic?: boolean;
  /** Custom diagnostic event emitter (for testing or custom wiring). */
  diagnosticEmitter?: (entry: CostEntry) => void;
  /** Called on flush errors. */
  onFlushError?: (error: unknown) => void;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class SessionCostLedger {
  private readonly queue: AsyncWriteQueue<CostEntry>;
  private readonly stateDir: string;
  private readonly emitDiagnostic: boolean;
  private readonly diagnosticEmitter?: (entry: CostEntry) => void;

  /** In-memory index for fast summarisation (optional, bounded). */
  private readonly recentEntries: CostEntry[] = [];
  private readonly maxRecentEntries = 10_000;

  constructor(options: SessionCostLedgerOptions) {
    this.stateDir = options.stateDir;
    this.emitDiagnostic = options.emitDiagnostic ?? false;
    this.diagnosticEmitter = options.diagnosticEmitter;

    this.queue = new AsyncWriteQueue<CostEntry>({
      filePath: path.join(options.stateDir, "cost-ledger.jsonl"),
      flushIntervalMs: options.flushIntervalMs ?? 2000,
      maxBufferSize: options.maxBufferSize ?? 500,
      onFlushError: options.onFlushError,
    });
  }

  /**
   * Record a cost entry. Synchronous, non-blocking.
   *
   * The timestamp should be captured by the caller *before* the API call
   * (or immediately after) — not at write time. If omitted, Date.now()
   * is used as a fallback.
   *
   * @returns The generated entry ID.
   */
  record(input: CostEntryInput): string {
    const entry: CostEntry = {
      id: input.id ?? generateCostId(),
      timestamp: input.timestamp ?? Date.now(),
      source: input.source,
      costUsd: input.costUsd,
      sessionKey: input.sessionKey,
      runId: input.runId,
      agentId: input.agentId,
      toolCallId: input.toolCallId,
      provider: input.provider,
      model: input.model,
      usage: input.usage,
      durationMs: input.durationMs,
      meta: input.meta,
    };

    // Enqueue for async disk write
    this.queue.enqueue(entry);

    // Keep in-memory for fast queries (bounded)
    this.recentEntries.push(entry);
    while (this.recentEntries.length > this.maxRecentEntries) {
      this.recentEntries.shift();
    }

    // Optionally emit diagnostic event
    if (this.emitDiagnostic && this.diagnosticEmitter) {
      this.diagnosticEmitter(entry);
    }

    return entry.id;
  }

  /**
   * Summarise costs, optionally filtered by sessionKey.
   * Sorts entries by timestamp before aggregating.
   */
  summarize(sessionKey?: string): CostSummary {
    let entries = this.recentEntries;
    if (sessionKey) {
      entries = entries.filter((e) => e.sessionKey === sessionKey);
    }

    // Sort by timestamp for consistent ordering
    const sorted = [...entries].toSorted((a, b) => a.timestamp - b.timestamp);

    let totalCostUsd = 0;
    const bySource = new Map<CostSource, number>();
    const byProvider = new Map<string, number>();

    for (const entry of sorted) {
      const cost = entry.costUsd ?? 0;
      totalCostUsd += cost;

      bySource.set(entry.source, (bySource.get(entry.source) ?? 0) + cost);

      if (entry.provider) {
        byProvider.set(entry.provider, (byProvider.get(entry.provider) ?? 0) + cost);
      }
    }

    return {
      totalCostUsd,
      entryCount: sorted.length,
      bySource,
      byProvider,
      entries: sorted,
    };
  }

  /**
   * Load all entries from the on-disk JSONL ledger file.
   * Returns entries sorted by timestamp. Skips corrupted lines.
   */
  loadFromDisk(): CostEntry[] {
    const filePath = path.join(this.stateDir, "cost-ledger.jsonl");
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch {
      return [];
    }

    const entries: CostEntry[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        entries.push(JSON.parse(trimmed) as CostEntry);
      } catch {
        // Corrupted line — skip.
      }
    }

    return entries.toSorted((a, b) => a.timestamp - b.timestamp);
  }

  /** Number of entries pending disk write. */
  pending(): number {
    return this.queue.pending();
  }

  /** Force flush all buffered entries to disk. */
  drain(): number {
    return this.queue.drain();
  }

  /** Drain and stop the periodic flush timer. */
  async close(): Promise<void> {
    await this.queue.close();
  }

  /**
   * Create an OpenClawPluginService for this ledger.
   * Ties the ledger lifecycle to the plugin start/stop.
   */
  toPluginService(id: string): { id: string; start: () => void; stop: () => Promise<void> } {
    return {
      id,
      start: () => {},
      stop: () => this.close(),
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new SessionCostLedger.
 *
 * @example
 * ```ts
 * const ledger = createSessionCostLedger({
 *   stateDir: path.join(ctx.stateDir, "my-extension"),
 *   emitDiagnostic: true,
 * });
 *
 * const timestamp = Date.now();
 * // ... expensive API call ...
 * ledger.record({
 *   timestamp,
 *   source: "tts.synthesis",
 *   costUsd: 0.002,
 *   sessionKey: ctx.sessionKey,
 *   provider: "elevenlabs",
 *   meta: { characters: 1500 },
 * });
 * ```
 */
export function createSessionCostLedger(options: SessionCostLedgerOptions): SessionCostLedger {
  return new SessionCostLedger(options);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateCostId(): string {
  return `cost-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}
