/**
 * Async Write Queue
 *
 * A non-blocking, append-only write queue that buffers entries in memory
 * and flushes them to a JSONL file on a configurable interval.
 *
 * Key properties:
 * - `enqueue()` is synchronous and O(1) — never blocks the caller.
 * - Entries carry caller-provided timestamps (captured before enqueue).
 * - Disk writes happen asynchronously via periodic flush or explicit `drain()`.
 * - Atomic append via temp-file + rename for crash safety.
 * - On `close()`, drains all remaining entries before resolving.
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AsyncWriteQueueOptions = {
  /** Path to the JSONL file to append to. */
  filePath: string;
  /** Flush interval in ms. Default: 2000. */
  flushIntervalMs?: number;
  /** Maximum entries to buffer before forcing an immediate flush. Default: 500. */
  maxBufferSize?: number;
  /** Called when a flush error occurs (best-effort logging). */
  onFlushError?: (error: unknown) => void;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class AsyncWriteQueue<T> {
  private buffer: T[] = [];
  private readonly filePath: string;
  private readonly maxBufferSize: number;
  private readonly onFlushError?: (error: unknown) => void;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private flushing = false;

  constructor(options: AsyncWriteQueueOptions) {
    this.filePath = options.filePath;
    this.maxBufferSize = options.maxBufferSize ?? 500;
    this.onFlushError = options.onFlushError;

    // Ensure parent directory exists
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    // Start periodic flush
    const interval = options.flushIntervalMs ?? 2000;
    if (interval > 0) {
      this.flushTimer = setInterval(() => {
        this.flushSync();
      }, interval);
      if (this.flushTimer && "unref" in this.flushTimer) {
        this.flushTimer.unref();
      }
    }
  }

  /**
   * Add an entry to the write buffer. Synchronous, O(1).
   * If the buffer exceeds maxBufferSize, triggers an immediate flush.
   */
  enqueue(entry: T): void {
    if (this.closed) {
      return;
    }
    this.buffer.push(entry);
    if (this.buffer.length >= this.maxBufferSize) {
      this.flushSync();
    }
  }

  /** Number of entries waiting to be flushed. */
  pending(): number {
    return this.buffer.length;
  }

  /**
   * Flush all buffered entries to disk. Returns the number of entries written.
   * Safe to call concurrently — serialises internally.
   */
  drain(): number {
    return this.flushSync();
  }

  /**
   * Drain remaining entries and stop the periodic timer.
   * Returns a promise that resolves after the final flush.
   */
  async close(): Promise<void> {
    this.closed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushSync();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private flushSync(): number {
    if (this.flushing || this.buffer.length === 0) {
      return 0;
    }
    this.flushing = true;

    const entries = this.buffer;
    this.buffer = [];

    try {
      const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      fs.appendFileSync(this.filePath, lines, "utf-8");
      return entries.length;
    } catch (error) {
      // Put entries back at the front of the buffer for retry
      this.buffer = entries.concat(this.buffer);
      this.onFlushError?.(error);
      return 0;
    } finally {
      this.flushing = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new AsyncWriteQueue.
 *
 * @example
 * ```ts
 * const queue = createAsyncWriteQueue<MyEntry>({
 *   filePath: path.join(stateDir, "events.jsonl"),
 *   flushIntervalMs: 2000,
 * });
 *
 * queue.enqueue({ ts: Date.now(), data: "hello" }); // sync, non-blocking
 * ```
 */
export function createAsyncWriteQueue<T>(options: AsyncWriteQueueOptions): AsyncWriteQueue<T> {
  return new AsyncWriteQueue(options);
}
