/**
 * Command History — localStorage-backed store for recently used commands.
 * Tracks the last N commands used in the command palette so they can be
 * surfaced as a "Recent" category when the palette opens.
 */

const STORAGE_KEY = "clawdbot:command-history";
const MAX_HISTORY = 20;

export type CommandHistoryEntry = {
  /** Command ID. */
  id: string;
  /** Unix timestamp (ms) of last use. */
  lastUsedAt: number;
  /** Total number of times this command was used. */
  useCount: number;
};

export type CommandHistoryStore = {
  entries: CommandHistoryEntry[];
};

function loadStore(): CommandHistoryStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw) as CommandHistoryStore;
    if (!Array.isArray(parsed.entries)) return { entries: [] };
    return parsed;
  } catch {
    return { entries: [] };
  }
}

function saveStore(store: CommandHistoryStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage might be full or unavailable; silently ignore.
  }
}

/**
 * Record a command usage. Moves it to the top if already present,
 * increments its use count, and trims to MAX_HISTORY.
 */
export function recordCommandUsage(commandId: string): void {
  const store = loadStore();
  const now = Date.now();

  const existingIndex = store.entries.findIndex((e) => e.id === commandId);
  if (existingIndex !== -1) {
    const existing = store.entries.splice(existingIndex, 1)[0];
    existing.lastUsedAt = now;
    existing.useCount++;
    store.entries.unshift(existing);
  } else {
    store.entries.unshift({ id: commandId, lastUsedAt: now, useCount: 1 });
  }

  // Trim to max size.
  if (store.entries.length > MAX_HISTORY) {
    store.entries = store.entries.slice(0, MAX_HISTORY);
  }

  saveStore(store);
}

/**
 * Get recent command IDs, ordered by most recently used first.
 */
export function getRecentCommandIds(limit: number = MAX_HISTORY): string[] {
  const store = loadStore();
  return store.entries.slice(0, limit).map((e) => e.id);
}

/**
 * Get the full history entries for more detailed display.
 */
export function getCommandHistory(): CommandHistoryEntry[] {
  return loadStore().entries;
}

/**
 * Clear all command history.
 */
export function clearCommandHistory(): void {
  saveStore({ entries: [] });
}
