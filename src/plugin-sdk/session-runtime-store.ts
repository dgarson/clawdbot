/**
 * Session Runtime Store
 *
 * A bounded, crash-recoverable state container for plugins that need to
 * accumulate per-session (or per-run) data across multiple hook invocations.
 *
 * Features:
 * - LRU eviction to bound memory (configurable capacity)
 * - Periodic flush of dirty entries to per-key JSON files
 * - Automatic recovery from disk on startup or cache-miss
 * - Atomic writes via temp-file + rename
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionRuntimeStoreOptions<T> = {
  /** Directory for per-key state files (e.g. `<stateDir>/cost-tracker`) */
  stateDir: string;
  /** Maximum entries to keep in memory (LRU eviction). Default: 128. */
  maxEntries?: number;
  /** Factory for creating fresh state when a key is accessed for the first time. */
  create: () => T;
  /** Flush interval in ms. 0 = flush on every update. Default: 5000. */
  flushIntervalMs?: number;
  /** Called when an entry is evicted from memory (after file write). */
  onEvict?: (key: string, state: T) => void;
  /** Called on startup for each recovered entry. */
  onRecover?: (key: string, state: T) => void;
};

type Entry<T> = {
  key: string;
  state: T;
  dirty: boolean;
  createdAt: number;
  updatedAt: number;
};

type PersistedEnvelope<T> = {
  key: string;
  createdAt: number;
  updatedAt: number;
  state: T;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class SessionRuntimeStore<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly stateDir: string;
  private readonly sessionsDir: string;
  private readonly maxEntries: number;
  private readonly createFn: () => T;
  private readonly onEvict?: (key: string, state: T) => void;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(options: SessionRuntimeStoreOptions<T>) {
    this.stateDir = options.stateDir;
    this.sessionsDir = path.join(options.stateDir, "sessions");
    this.maxEntries = options.maxEntries ?? 128;
    this.createFn = options.create;
    this.onEvict = options.onEvict;

    // Ensure directories exist
    fs.mkdirSync(this.sessionsDir, { recursive: true });

    // Recover existing state from disk
    this.recover(options.onRecover);

    // Start periodic flush
    const interval = options.flushIntervalMs ?? 5000;
    if (interval > 0) {
      this.flushTimer = setInterval(() => {
        void this.flushDirty();
      }, interval);
      // Allow the process to exit even if the timer is still running.
      if (this.flushTimer && "unref" in this.flushTimer) {
        this.flushTimer.unref();
      }
    }
  }

  /** Get state for a key. Loads from disk if evicted, creates if new. */
  get(key: string): T {
    const existing = this.entries.get(key);
    if (existing) {
      // LRU touch: delete and re-insert to move to end of Map iteration order
      this.entries.delete(key);
      this.entries.set(key, existing);
      return existing.state;
    }

    // Try loading from disk
    const loaded = this.loadFromDisk(key);
    if (loaded) {
      this.insertWithEviction(key, loaded);
      return loaded.state;
    }

    // Create new
    const now = Date.now();
    const entry: Entry<T> = {
      key,
      state: this.createFn(),
      dirty: false,
      createdAt: now,
      updatedAt: now,
    };
    this.insertWithEviction(key, entry);
    return entry.state;
  }

  /** Update state with a mutator. Marks the entry as dirty for next flush. */
  update(key: string, mutator: (state: T) => void): void {
    const state = this.get(key);
    mutator(state);
    const entry = this.entries.get(key);
    if (entry) {
      entry.dirty = true;
      entry.updatedAt = Date.now();
    }
  }

  /** Explicitly flush a single key to disk. */
  async flush(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (entry?.dirty) {
      this.writeToDisk(entry);
      entry.dirty = false;
    }
  }

  /** Flush all dirty entries and stop the periodic timer. */
  async close(): Promise<void> {
    this.closed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushDirty();
  }

  /** Remove a key's state from memory and disk. */
  async delete(key: string): Promise<void> {
    this.entries.delete(key);
    const filePath = this.filePathForKey(key);
    try {
      fs.unlinkSync(filePath);
    } catch {
      // File may not exist — harmless.
    }
  }

  /** List all keys (in-memory + on-disk). */
  keys(): string[] {
    const memKeys = new Set<string>();
    for (const entry of this.entries.values()) {
      memKeys.add(entry.key);
    }

    // Scan disk for additional keys
    try {
      const files = fs.readdirSync(this.sessionsDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const raw = fs.readFileSync(path.join(this.sessionsDir, file), "utf-8");
          const envelope = JSON.parse(raw) as PersistedEnvelope<T>;
          if (envelope.key) {
            memKeys.add(envelope.key);
          }
        } catch {
          // Corrupted file — skip.
        }
      }
    } catch {
      // Directory read failure — return what we have.
    }

    return [...memKeys];
  }

  /** Count of in-memory entries. */
  size(): number {
    return this.entries.size;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private recover(onRecover?: (key: string, state: T) => void): void {
    let files: string[];
    try {
      files = fs.readdirSync(this.sessionsDir).filter((f) => f.endsWith(".json"));
    } catch {
      return;
    }

    // Sort by modification time (most recent first) for LRU ordering
    const withMtime = files.map((f) => {
      const fullPath = path.join(this.sessionsDir, f);
      try {
        const stat = fs.statSync(fullPath);
        return { file: f, mtime: stat.mtimeMs };
      } catch {
        return { file: f, mtime: 0 };
      }
    });
    withMtime.sort((a, b) => b.mtime - a.mtime);

    for (const { file } of withMtime) {
      if (this.entries.size >= this.maxEntries) break;
      try {
        const raw = fs.readFileSync(path.join(this.sessionsDir, file), "utf-8");
        const envelope = JSON.parse(raw) as PersistedEnvelope<T>;
        if (!envelope.key) continue;

        const entry: Entry<T> = {
          key: envelope.key,
          state: envelope.state,
          dirty: false,
          createdAt: envelope.createdAt,
          updatedAt: envelope.updatedAt,
        };
        this.entries.set(envelope.key, entry);
        onRecover?.(envelope.key, envelope.state);
      } catch {
        // Corrupted state file — skip.
      }
    }
  }

  private insertWithEviction(key: string, entry: Entry<T>): void {
    this.entries.set(key, entry);

    // Evict LRU entries if over capacity
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      const evicted = this.entries.get(oldest);
      if (evicted) {
        if (evicted.dirty) {
          this.writeToDisk(evicted);
        }
        this.onEvict?.(evicted.key, evicted.state);
      }
      this.entries.delete(oldest);
    }
  }

  private async flushDirty(): Promise<void> {
    for (const entry of this.entries.values()) {
      if (entry.dirty) {
        this.writeToDisk(entry);
        entry.dirty = false;
      }
    }
  }

  private writeToDisk(entry: Entry<T>): void {
    const envelope: PersistedEnvelope<T> = {
      key: entry.key,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      state: entry.state,
    };

    const filePath = this.filePathForKey(entry.key);
    const tmpPath = `${filePath}.${crypto.randomUUID().slice(0, 8)}.tmp`;

    try {
      fs.writeFileSync(tmpPath, `${JSON.stringify(envelope, null, 2)}\n`, "utf-8");
      fs.renameSync(tmpPath, filePath);
    } catch {
      // Best-effort — don't crash the plugin for a state write failure.
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Temp file cleanup — harmless if it fails.
      }
    }
  }

  private loadFromDisk(key: string): Entry<T> | undefined {
    const filePath = this.filePathForKey(key);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const envelope = JSON.parse(raw) as PersistedEnvelope<T>;
      return {
        key: envelope.key,
        state: envelope.state,
        dirty: false,
        createdAt: envelope.createdAt,
        updatedAt: envelope.updatedAt,
      };
    } catch {
      return undefined;
    }
  }

  private filePathForKey(key: string): string {
    return path.join(this.sessionsDir, `${this.hashKey(key)}.json`);
  }

  private hashKey(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex").slice(0, 12);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new SessionRuntimeStore. Intended for use in plugin `service.start()`.
 *
 * @example
 * ```ts
 * const store = createSessionRuntimeStore<MyState>({
 *   stateDir: path.join(ctx.stateDir, "my-extension"),
 *   create: () => ({ count: 0 }),
 * });
 * ```
 */
export function createSessionRuntimeStore<T>(
  options: SessionRuntimeStoreOptions<T>,
): SessionRuntimeStore<T> {
  return new SessionRuntimeStore(options);
}
