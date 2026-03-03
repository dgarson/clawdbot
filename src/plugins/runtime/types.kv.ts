/**
 * runtime.kv namespace types (#6).
 * Per-plugin key-value store with optional TTL.
 * Extracted so types.ts stays focused on the high-level PluginRuntime shape.
 */

export type PluginKvSetOptions = {
  /** Time-to-live in milliseconds. After this duration the value is treated as expired. */
  ttlMs?: number;
};

/**
 * Lightweight per-plugin key-value store.
 *
 * Values are stored as JSON in `{stateDir}/plugin-kv/{pluginId}.json`.
 * An in-memory write-through cache avoids repeated disk I/O within a session.
 * TTL eviction is applied lazily on `get` and `list`.
 */
export type PluginKvNamespace = {
  /** Retrieve a value by key. Returns undefined if missing or expired. */
  get<T = unknown>(key: string): Promise<T | undefined>;
  /** Store a value. If `opts.ttlMs` is set the entry expires after that duration. */
  set(key: string, value: unknown, opts?: PluginKvSetOptions): Promise<void>;
  /** Remove a single key. No-op if the key does not exist. */
  delete(key: string): Promise<void>;
  /** List all non-expired keys, optionally filtered by prefix. */
  list(prefix?: string): Promise<string[]>;
  /** Remove all keys for this plugin. */
  clear(): Promise<void>;
};
