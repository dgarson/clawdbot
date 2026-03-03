/**
 * Per-plugin key-value store implementation (#6).
 *
 * Storage: `{stateDir}/plugin-kv/{pluginId}.json`
 * Format: `Record<string, { v: unknown; expiresAt?: number }>`
 * Caching: write-through in-memory cache per plugin to avoid repeated disk I/O.
 */

import fsPromises from "node:fs/promises";
import path from "node:path";
import type { PluginKvNamespace, PluginKvSetOptions } from "./types.kv.js";

type KvEntry = {
  v: unknown;
  expiresAt?: number;
};

type KvStore = Record<string, KvEntry>;

// In-memory write-through cache — one map per pluginId+stateDir key.
const storeCache = new Map<string, KvStore>();

function cacheKey(stateDir: string, pluginId: string): string {
  return `${stateDir}::${pluginId}`;
}

function kvFilePath(stateDir: string, pluginId: string): string {
  return path.join(stateDir, "plugin-kv", `${pluginId}.json`);
}

async function loadStore(stateDir: string, pluginId: string): Promise<KvStore> {
  const key = cacheKey(stateDir, pluginId);
  if (storeCache.has(key)) {
    return storeCache.get(key)!;
  }
  const filePath = kvFilePath(stateDir, pluginId);
  try {
    const raw = await fsPromises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as KvStore;
    storeCache.set(key, parsed);
    return parsed;
  } catch {
    const empty: KvStore = {};
    storeCache.set(key, empty);
    return empty;
  }
}

async function persistStore(stateDir: string, pluginId: string, store: KvStore): Promise<void> {
  const filePath = kvFilePath(stateDir, pluginId);
  const dir = path.dirname(filePath);
  await fsPromises.mkdir(dir, { recursive: true });
  await fsPromises.writeFile(filePath, JSON.stringify(store), "utf8");
}

function isExpired(entry: KvEntry): boolean {
  return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
}

export function createPluginKvStore(stateDir: string, pluginId: string): PluginKvNamespace {
  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      const store = await loadStore(stateDir, pluginId);
      const entry = store[key];
      if (!entry || isExpired(entry)) {
        return undefined;
      }
      return entry.v as T;
    },

    async set(key: string, value: unknown, opts?: PluginKvSetOptions): Promise<void> {
      const store = await loadStore(stateDir, pluginId);
      const entry: KvEntry = { v: value };
      if (opts?.ttlMs !== undefined && opts.ttlMs > 0) {
        entry.expiresAt = Date.now() + opts.ttlMs;
      }
      store[key] = entry;
      await persistStore(stateDir, pluginId, store);
    },

    async delete(key: string): Promise<void> {
      const store = await loadStore(stateDir, pluginId);
      if (Object.hasOwn(store, key)) {
        delete store[key];
        await persistStore(stateDir, pluginId, store);
      }
    },

    async list(prefix?: string): Promise<string[]> {
      const store = await loadStore(stateDir, pluginId);
      const now = Date.now();
      return Object.keys(store).filter((k) => {
        const entry = store[k];
        if (entry && entry.expiresAt !== undefined && now > entry.expiresAt) {
          return false;
        }
        return prefix === undefined || k.startsWith(prefix);
      });
    },

    async clear(): Promise<void> {
      const key = cacheKey(stateDir, pluginId);
      const empty: KvStore = {};
      storeCache.set(key, empty);
      await persistStore(stateDir, pluginId, empty);
    },
  };
}
