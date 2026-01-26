import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearCommandHistory,
  getCommandHistory,
  getRecentCommandIds,
  recordCommandUsage,
} from "./command-history";

describe("command history", () => {
  const storageMap = new Map<string, string>();

  beforeEach(() => {
    storageMap.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, value: string) => storageMap.set(key, value),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with empty history", () => {
    expect(getRecentCommandIds()).toEqual([]);
    expect(getCommandHistory()).toEqual([]);
  });

  it("records a command and retrieves it", () => {
    recordCommandUsage("nav-chat");
    const ids = getRecentCommandIds();
    expect(ids).toEqual(["nav-chat"]);

    const entries = getCommandHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("nav-chat");
    expect(entries[0].useCount).toBe(1);
    expect(entries[0].lastUsedAt).toBe(Date.now());
  });

  it("moves repeated commands to the top and increments useCount", () => {
    recordCommandUsage("nav-chat");
    vi.advanceTimersByTime(1000);
    recordCommandUsage("nav-config");
    vi.advanceTimersByTime(1000);
    recordCommandUsage("nav-chat");

    const ids = getRecentCommandIds();
    expect(ids).toEqual(["nav-chat", "nav-config"]);

    const entries = getCommandHistory();
    expect(entries[0].useCount).toBe(2);
    expect(entries[1].useCount).toBe(1);
  });

  it("preserves order for distinct commands (most recent first)", () => {
    recordCommandUsage("cmd-a");
    vi.advanceTimersByTime(100);
    recordCommandUsage("cmd-b");
    vi.advanceTimersByTime(100);
    recordCommandUsage("cmd-c");

    expect(getRecentCommandIds()).toEqual(["cmd-c", "cmd-b", "cmd-a"]);
  });

  it("trims history to max 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      recordCommandUsage(`cmd-${i}`);
      vi.advanceTimersByTime(10);
    }

    const ids = getRecentCommandIds();
    expect(ids).toHaveLength(20);
    // Most recent should be cmd-24
    expect(ids[0]).toBe("cmd-24");
    // Oldest kept should be cmd-5 (0–4 trimmed)
    expect(ids[19]).toBe("cmd-5");
  });

  it("respects limit parameter in getRecentCommandIds", () => {
    recordCommandUsage("cmd-a");
    recordCommandUsage("cmd-b");
    recordCommandUsage("cmd-c");

    expect(getRecentCommandIds(2)).toEqual(["cmd-c", "cmd-b"]);
  });

  it("clearCommandHistory removes all entries", () => {
    recordCommandUsage("nav-chat");
    recordCommandUsage("nav-config");
    expect(getRecentCommandIds()).toHaveLength(2);

    clearCommandHistory();
    expect(getRecentCommandIds()).toEqual([]);
    expect(getCommandHistory()).toEqual([]);
  });

  it("recovers from corrupt localStorage data", () => {
    storageMap.set("clawdbot:command-history", "{invalid json");
    expect(getRecentCommandIds()).toEqual([]);

    // Should still work after corrupt data
    recordCommandUsage("nav-chat");
    expect(getRecentCommandIds()).toEqual(["nav-chat"]);
  });

  it("recovers from localStorage with missing entries array", () => {
    storageMap.set("clawdbot:command-history", JSON.stringify({ version: 1 }));
    expect(getRecentCommandIds()).toEqual([]);
  });

  it("handles localStorage being unavailable for writes", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
      clear: () => {},
    });

    // Should not throw
    expect(() => recordCommandUsage("nav-chat")).not.toThrow();
  });
});
