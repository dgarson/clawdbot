/**
 * Session Runtime Store
 *
 * A bounded, crash-recoverable state container for plugins that need to
 * accumulate per-session (or per-run) data across multiple hook invocations.
 *
 * Features:
 * - LRU eviction to bound memory (configurable capacity)
 * - Pluggable flush strategies: periodic, debounce, on-hooks, or manual
 * - Per-run sub-state within each session entry
 * - Typed appendToList with optional bounded-list config
 * - Automatic recovery from disk on startup or cache-miss
 * - Atomic writes via temp-file + rename
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Flush strategy for SessionRuntimeStore.
 * - `periodic`: flush all dirty entries on a fixed interval (default behaviour).
 * - `debounce`: after each mutation, wait `delayMs` before flushing that entry.
 * - `on-hooks`: flush when the listed hook names fire (wired via `wireSessionHooks`).
 * - `manual`: never flush automatically; caller must call `store.flush(key)`.
 */
export type FlushStrategy =
  | { kind: "debounce"; delayMs: number }
  | { kind: "periodic"; intervalMs: number }
  | { kind: "on-hooks"; hooks: string[] }
  | { kind: "manual" };

/**
 * Configuration for a bounded list field within session state.
 * When `appendToList` is called for `key`, the array is trimmed to `maxItems`.
 */
export type BoundedListConfig<TState> = {
  key: keyof TState;
  maxItems: number;
};

export type SessionRuntimeStoreOptions<T, TRunState = void> = {
  /**
   * Directory for per-key state files (e.g. `<stateDir>/cost-tracker`).
   * Ignored when `ephemeral` is true.
   */
  stateDir: string;
  /** Maximum entries to keep in memory (LRU eviction). Default: 128. */
  maxEntries?: number;
  /** Factory for creating fresh state when a key is accessed for the first time. */
  create: () => T;
  /**
   * Flush strategy. Defaults to `{ kind: "periodic", intervalMs: 5000 }`.
   * Can be an array to combine multiple strategies.
   * `on-hooks` entries are wired via `wireSessionHooks`.
   */
  flush?: FlushStrategy | FlushStrategy[];
  /**
   * @deprecated Use `flush: { kind: "periodic", intervalMs: N }` instead.
   * Flush interval in ms. 0 = flush on every update. Default: 5000.
   * Ignored when `flush` is provided.
   */
  flushIntervalMs?: number;
  /** Time-to-live in ms. Entries older than this are evicted during periodic flush. 0 = no TTL. Default: 0. */
  ttlMs?: number;
  /**
   * When true, the store never reads from or writes to disk — purely in-memory.
   * Evicted entries are lost. Useful for extensions that only need intra-process
   * state and want zero I/O overhead. Default: false.
   */
  ephemeral?: boolean;
  /** Called when an entry is evicted from memory (after file write). */
  onEvict?: (key: string, state: T) => void;
  /** Called on startup for each recovered entry. */
  onRecover?: (key: string, state: T) => void;
  /** Factory for new run sub-state. Required if you want per-run tracking. */
  initialRun?: () => TRunState;
  /** Bounded-list configs for typed array fields in T. */
  boundedLists?: BoundedListConfig<T>[];
};

type Entry<T, TRunState> = {
  key: string;
  state: T;
  /** Per-run sub-state keyed by runId. */
  runs: Map<string, TRunState>;
  dirty: boolean;
  createdAt: number;
  updatedAt: number;
};

type PersistedEnvelope<T, TRunState> = {
  key: string;
  createdAt: number;
  updatedAt: number;
  state: T;
  /** Serialised as a plain object; converted back to Map on load. */
  runs?: Record<string, TRunState>;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class SessionRuntimeStore<T, TRunState = void> {
  private readonly entries = new Map<string, Entry<T, TRunState>>();
  private readonly stateDir: string;
  private readonly sessionsDir: string;
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly ephemeral: boolean;
  private readonly createFn: () => T;
  private readonly initialRunFn?: () => TRunState;
  private readonly boundedLists?: BoundedListConfig<T>[];
  private readonly onEvict?: (key: string, state: T) => void;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  // Per-session debounce timers (keyed by sessionId).
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Resolved flush strategies (normalised from options).
  private readonly flushStrategies: FlushStrategy[];

  constructor(options: SessionRuntimeStoreOptions<T, TRunState>) {
    this.stateDir = options.stateDir;
    this.sessionsDir = path.join(options.stateDir, "sessions");
    this.maxEntries = options.maxEntries ?? 128;
    this.ttlMs = options.ttlMs ?? 0;
    this.ephemeral = options.ephemeral ?? false;
    this.createFn = options.create;
    this.initialRunFn = options.initialRun;
    this.boundedLists = options.boundedLists;
    this.onEvict = options.onEvict;

    // Normalise flush strategies
    if (options.flush !== undefined) {
      this.flushStrategies = Array.isArray(options.flush) ? options.flush : [options.flush];
    } else {
      // Legacy flushIntervalMs fallback
      const intervalMs = options.flushIntervalMs ?? 5000;
      this.flushStrategies = [{ kind: "periodic", intervalMs }];
    }

    if (!this.ephemeral) {
      // Ensure directories exist
      fs.mkdirSync(this.sessionsDir, { recursive: true });

      // Recover existing state from disk
      this.recover(options.onRecover);
    }

    // Start periodic timer if a periodic strategy is configured (or for TTL eviction on ephemeral)
    const periodicStrategy = this.flushStrategies.find((s) => s.kind === "periodic");

    const effectiveInterval = periodicStrategy?.intervalMs ?? (this.ephemeral ? 0 : 5000);
    const needsTimer = this.ephemeral ? this.ttlMs > 0 : effectiveInterval > 0 || this.ttlMs > 0;

    if (needsTimer) {
      const timerInterval = effectiveInterval > 0 ? effectiveInterval : this.ttlMs;
      this.flushTimer = setInterval(() => {
        void this.flushDirty();
      }, timerInterval);
      // Allow the process to exit even if the timer is still running.
      if (this.flushTimer && "unref" in this.flushTimer) {
        this.flushTimer.unref();
      }
    }
  }

  /** Get state for a key if it exists (in-memory or on disk). Returns undefined if not found. */
  get(key: string): T | undefined {
    const existing = this.entries.get(key);
    if (existing) {
      // LRU touch: delete and re-insert to move to end of Map iteration order
      this.entries.delete(key);
      this.entries.set(key, existing);
      return existing.state;
    }

    if (!this.ephemeral) {
      // Try loading from disk
      const loaded = this.loadFromDisk(key);
      if (loaded) {
        this.insertWithEviction(key, loaded);
        return loaded.state;
      }
    }

    return undefined;
  }

  /** Get state for a key. Loads from disk if evicted, creates if new. */
  getOrCreate(key: string): T {
    const existing = this.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const now = Date.now();
    const entry: Entry<T, TRunState> = {
      key,
      state: this.createFn(),
      runs: new Map(),
      dirty: false,
      createdAt: now,
      updatedAt: now,
    };
    this.insertWithEviction(key, entry);
    return entry.state;
  }

  /** Check whether a key exists (in memory or on disk). */
  has(key: string): boolean {
    if (this.entries.has(key)) {
      return true;
    }
    if (this.ephemeral) {
      return false;
    }
    // Check disk without loading into memory
    const filePath = this.filePathForKey(key);
    try {
      fs.accessSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /** Update state with a mutator. Marks the entry as dirty for next flush. */
  update(key: string, mutator: (state: T) => void): void {
    const state = this.getOrCreate(key);
    mutator(state);
    const entry = this.entries.get(key);
    if (entry) {
      entry.dirty = true;
      entry.updatedAt = Date.now();
      this.scheduleDebounce(key);
    }
  }

  // ---------------------------------------------------------------------------
  // Per-run state
  // ---------------------------------------------------------------------------

  /**
   * Get per-run sub-state for a session/run pair.
   * Returns undefined if the session or run does not exist.
   */
  getRun(sessionId: string, runId: string): TRunState | undefined {
    const entry = this.entries.get(sessionId);
    if (!entry) {
      return undefined;
    }
    return entry.runs.get(runId);
  }

  /**
   * Update per-run sub-state. Creates the session and run entries if they don't exist.
   * Requires `initialRun` option to be provided.
   */
  updateRun(sessionId: string, runId: string, fn: (draft: TRunState) => void): void {
    // Ensure the session entry exists
    this.getOrCreate(sessionId);
    const entry = this.entries.get(sessionId)!;

    if (!entry.runs.has(runId)) {
      if (this.initialRunFn === undefined) {
        // No factory provided; cannot create run state
        return;
      }
      entry.runs.set(runId, this.initialRunFn());
    }

    const runState = entry.runs.get(runId)!;
    fn(runState);

    entry.dirty = true;
    entry.updatedAt = Date.now();
    this.scheduleDebounce(sessionId);
  }

  /**
   * Delete per-run sub-state for a session/run pair.
   * No-op if the session or run does not exist.
   */
  deleteRun(sessionId: string, runId: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry) {
      return;
    }
    if (entry.runs.delete(runId)) {
      entry.dirty = true;
      entry.updatedAt = Date.now();
      this.scheduleDebounce(sessionId);
    }
  }

  /**
   * Return all per-run sub-states for a session.
   * Returns an empty Map if the session does not exist.
   */
  allRuns(sessionId: string): Map<string, TRunState> {
    const entry = this.entries.get(sessionId);
    return entry ? entry.runs : new Map();
  }

  // ---------------------------------------------------------------------------
  // Typed list append
  // ---------------------------------------------------------------------------

  /**
   * Append an item to an array field in session state.
   * Enforces `maxItems` from the matching `boundedLists` config (if any).
   */
  appendToList<K extends keyof T>(
    sessionId: string,
    key: K,
    item: T[K] extends Array<infer U> ? U : never,
  ): void {
    this.getOrCreate(sessionId);
    const entry = this.entries.get(sessionId);
    if (!entry) {
      return;
    }

    const arr = entry.state[key];
    if (!Array.isArray(arr)) {
      return;
    }

    arr.push(item as unknown);

    const config = this.boundedLists?.find((c) => c.key === key);
    const maxItems = config?.maxItems ?? Infinity;
    while (arr.length > maxItems) {
      arr.shift();
    }

    entry.dirty = true;
    entry.updatedAt = Date.now();
    this.scheduleDebounce(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

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
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    await this.flushDirty();
  }

  /** Remove a key's state from memory and disk. */
  async delete(key: string): Promise<void> {
    this.entries.delete(key);
    if (!this.ephemeral) {
      const filePath = this.filePathForKey(key);
      try {
        fs.unlinkSync(filePath);
      } catch {
        // File may not exist — harmless.
      }
    }
  }

  /** List all keys (in-memory + on-disk). */
  keys(): string[] {
    const memKeys = new Set<string>();
    for (const entry of this.entries.values()) {
      memKeys.add(entry.key);
    }

    if (!this.ephemeral) {
      // Scan disk for additional keys
      try {
        const files = fs.readdirSync(this.sessionsDir);
        for (const file of files) {
          if (!file.endsWith(".json")) {
            continue;
          }
          try {
            const raw = fs.readFileSync(path.join(this.sessionsDir, file), "utf-8");
            const envelope = JSON.parse(raw) as PersistedEnvelope<T, TRunState>;
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
    }

    return [...memKeys];
  }

  /** Count of in-memory entries. */
  size(): number {
    return this.entries.size;
  }

  /**
   * Expose the configured `on-hooks` hook names so `wireSessionHooks` can
   * register flush triggers for them.
   */
  getOnHookNames(): string[] {
    const names: string[] = [];
    for (const s of this.flushStrategies) {
      if (s.kind === "on-hooks") {
        names.push(...s.hooks);
      }
    }
    return names;
  }

  /**
   * Create an OpenClawPluginService that ties this store's lifecycle to the plugin.
   * Registers start (no-op) and stop (flushes + closes) handlers.
   */
  toPluginService(id: string): { id: string; start: () => void; stop: () => Promise<void> } {
    return {
      id,
      start: () => {},
      stop: () => this.close(),
    };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Schedule a debounce flush for a session key, if a debounce strategy is configured.
   * Each mutation resets the debounce timer for that key.
   */
  private scheduleDebounce(key: string): void {
    const debounceStrategy = this.flushStrategies.find((s) => s.kind === "debounce");
    if (!debounceStrategy) {
      return;
    }

    const existing = this.debounceTimers.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      void this.flush(key);
    }, debounceStrategy.delayMs);

    // Allow process to exit if only debounce timers remain.
    if (timer && "unref" in timer) {
      (timer as ReturnType<typeof setTimeout> & { unref: () => void }).unref();
    }

    this.debounceTimers.set(key, timer);
  }

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
      if (this.entries.size >= this.maxEntries) {
        break;
      }
      try {
        const raw = fs.readFileSync(path.join(this.sessionsDir, file), "utf-8");
        const envelope = JSON.parse(raw) as PersistedEnvelope<T, TRunState>;
        if (!envelope.key) {
          continue;
        }

        // Convert persisted runs Record back to Map
        const runs = new Map<string, TRunState>(envelope.runs ? Object.entries(envelope.runs) : []);

        const entry: Entry<T, TRunState> = {
          key: envelope.key,
          state: envelope.state,
          runs,
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

  private insertWithEviction(key: string, entry: Entry<T, TRunState>): void {
    this.entries.set(key, entry);

    // Evict LRU entries if over capacity
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      const evicted = this.entries.get(oldest);
      if (evicted) {
        if (!this.ephemeral && evicted.dirty) {
          this.writeToDisk(evicted);
        }
        this.onEvict?.(evicted.key, evicted.state);
      }
      this.entries.delete(oldest);
    }
  }

  private async flushDirty(): Promise<void> {
    const now = Date.now();
    const toEvict: string[] = [];

    for (const entry of this.entries.values()) {
      if (!this.ephemeral && entry.dirty) {
        this.writeToDisk(entry);
        entry.dirty = false;
      }
      // TTL eviction: mark stale entries for removal
      if (this.ttlMs > 0 && now - entry.updatedAt > this.ttlMs) {
        toEvict.push(entry.key);
      }
    }

    for (const key of toEvict) {
      const entry = this.entries.get(key);
      if (entry) {
        this.onEvict?.(entry.key, entry.state);
        this.entries.delete(key);
      }
    }
  }

  private writeToDisk(entry: Entry<T, TRunState>): void {
    // Convert runs Map to a plain Record for JSON serialisation
    const runsRecord: Record<string, TRunState> = {};
    for (const [runId, runState] of entry.runs) {
      runsRecord[runId] = runState;
    }

    const envelope: PersistedEnvelope<T, TRunState> = {
      key: entry.key,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      state: entry.state,
      runs: Object.keys(runsRecord).length > 0 ? runsRecord : undefined,
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

  private loadFromDisk(key: string): Entry<T, TRunState> | undefined {
    const filePath = this.filePathForKey(key);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const envelope = JSON.parse(raw) as PersistedEnvelope<T, TRunState>;

      const runs = new Map<string, TRunState>(envelope.runs ? Object.entries(envelope.runs) : []);

      return {
        key: envelope.key,
        state: envelope.state,
        runs,
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
export function createSessionRuntimeStore<T, TRunState = void>(
  options: SessionRuntimeStoreOptions<T, TRunState>,
): SessionRuntimeStore<T, TRunState> {
  return new SessionRuntimeStore(options);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Append an item to an array, evicting the oldest entry if the array exceeds
 * `maxItems`. Mutates the array in place.
 *
 * Useful for bounded event logs, recent-tool lists, or any rolling window
 * inside session state.
 */
export function appendBounded<TItem>(arr: TItem[], item: TItem, maxItems: number): void {
  arr.push(item);
  while (arr.length > maxItems) {
    arr.shift();
  }
}

/**
 * Auto-wire common session lifecycle hooks to a SessionRuntimeStore.
 *
 * Registers:
 * - `run_start` — ensures session state exists; calls `onRunStart`.
 * - `agent_end` — flushes session state; calls `onAgentEnd`.
 * - `session_start` — optionally loads from checkpoint when `resumedFrom` is set; calls `onSessionStart`.
 * - `session_end` — flushes session state; calls `onSessionEnd`.
 * - Any `on-hooks` flush triggers configured on the store.
 *
 * @param api - The plugin API from `register()` or `activate()`.
 * @param store - The SessionRuntimeStore to wire.
 * @param opts - Optional callbacks.
 */
export function wireSessionHooks<T, TRunState = void>(
  api: {
    on: (
      hookName: string,
      handler: (...args: unknown[]) => void,
      opts?: { priority?: number },
    ) => void;
  },
  store: SessionRuntimeStore<T, TRunState>,
  opts?: {
    onRunStart?: (sessionKey: string, state: T) => void;
    onAgentEnd?: (sessionKey: string, state: T) => void;
    onSessionStart?: (sessionId: string, state: T) => void;
    onSessionEnd?: (sessionId: string, state: T) => void;
  },
): void {
  api.on("run_start", (...args: unknown[]) => {
    const event = (args[0] ?? {}) as Record<string, unknown>;
    const sessionKey = event.sessionKey as string | undefined;
    if (!sessionKey) {
      return;
    }
    const state = store.getOrCreate(sessionKey);
    opts?.onRunStart?.(sessionKey, state);
  });

  api.on("agent_end", (...args: unknown[]) => {
    const event = (args[0] ?? {}) as Record<string, unknown>;
    const sessionKey = event.sessionKey as string | undefined;
    if (!sessionKey) {
      return;
    }
    const state = store.get(sessionKey);
    if (state !== undefined) {
      opts?.onAgentEnd?.(sessionKey, state);
      void store.flush(sessionKey);
    }
  });

  api.on("session_start", (...args: unknown[]) => {
    const event = (args[0] ?? {}) as Record<string, unknown>;
    const sessionId = event.sessionId as string | undefined;
    if (!sessionId) {
      return;
    }
    // If resuming, trigger a disk load so state is warm before the run starts.
    const resumedFrom = event.resumedFrom as string | undefined;
    if (resumedFrom) {
      store.get(sessionId);
    }
    const state = store.getOrCreate(sessionId);
    opts?.onSessionStart?.(sessionId, state);
  });

  api.on("session_end", (...args: unknown[]) => {
    const event = (args[0] ?? {}) as Record<string, unknown>;
    const sessionId = event.sessionId as string | undefined;
    if (!sessionId) {
      return;
    }
    const state = store.get(sessionId);
    if (state !== undefined) {
      opts?.onSessionEnd?.(sessionId, state);
      void store.flush(sessionId);
    }
  });

  // Wire `on-hooks` flush triggers
  for (const hookName of store.getOnHookNames()) {
    api.on(hookName, (...args: unknown[]) => {
      const event = (args[0] ?? {}) as Record<string, unknown>;
      // Best-effort: try sessionId, then sessionKey
      const key =
        (event.sessionId as string | undefined) ?? (event.sessionKey as string | undefined);
      if (key) {
        void store.flush(key);
      }
    });
  }
}
