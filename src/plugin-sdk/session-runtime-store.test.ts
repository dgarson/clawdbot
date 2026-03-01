import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionRuntimeStore, SessionRuntimeStore } from "./session-runtime-store.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "session-store-test-"));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("SessionRuntimeStore", () => {
  let dir: string;
  let store: SessionRuntimeStore<{ count: number; label?: string }>;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(async () => {
    await store?.close();
    cleanup(dir);
  });

  it("creates new state on first access", () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });
    const state = store.get("session-1");
    expect(state).toEqual({ count: 0 });
  });

  it("returns same state on repeated access", () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });
    const s1 = store.get("session-1");
    s1.count = 42;
    const s2 = store.get("session-1");
    expect(s2.count).toBe(42);
  });

  it("tracks independent state per key", () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });
    store.update("a", (s) => {
      s.count = 1;
    });
    store.update("b", (s) => {
      s.count = 2;
    });
    expect(store.get("a").count).toBe(1);
    expect(store.get("b").count).toBe(2);
  });

  it("update marks entry dirty and flush persists to disk", async () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });
    store.update("session-1", (s) => {
      s.count = 10;
    });
    await store.flush("session-1");

    // Verify a JSON file was written
    const sessionsDir = path.join(dir, "sessions");
    const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(1);

    const raw = fs.readFileSync(path.join(sessionsDir, files[0]!), "utf-8");
    const envelope = JSON.parse(raw);
    expect(envelope.key).toBe("session-1");
    expect(envelope.state.count).toBe(10);
  });

  it("recovers state from disk on new store creation", async () => {
    // First store: write state
    const store1 = createSessionRuntimeStore<{ count: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });
    store1.update("session-1", (s) => {
      s.count = 99;
    });
    await store1.close();

    // Second store: should recover
    const recovered: string[] = [];
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
      onRecover: (key) => recovered.push(key),
    });

    expect(store.get("session-1").count).toBe(99);
    expect(recovered).toContain("session-1");
  });

  it("evicts LRU entries when maxEntries exceeded", async () => {
    const evicted: string[] = [];
    store = createSessionRuntimeStore({
      stateDir: dir,
      maxEntries: 3,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
      onEvict: (key) => evicted.push(key),
    });

    store.update("a", (s) => {
      s.count = 1;
    });
    store.update("b", (s) => {
      s.count = 2;
    });
    store.update("c", (s) => {
      s.count = 3;
    });

    expect(store.size()).toBe(3);

    // Adding a 4th should evict the oldest (a)
    store.update("d", (s) => {
      s.count = 4;
    });

    expect(store.size()).toBe(3);
    expect(evicted).toContain("a");

    // Evicted entry should still be loadable from disk
    expect(store.get("a").count).toBe(1);
  });

  it("LRU touch: accessing a key moves it to end of eviction order", async () => {
    const evicted: string[] = [];
    store = createSessionRuntimeStore({
      stateDir: dir,
      maxEntries: 3,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
      onEvict: (key) => evicted.push(key),
    });

    store.update("a", (s) => {
      s.count = 1;
    });
    store.update("b", (s) => {
      s.count = 2;
    });
    store.update("c", (s) => {
      s.count = 3;
    });

    // Touch "a" — moves it to end
    store.get("a");

    // Now "b" is oldest; adding "d" should evict "b"
    store.update("d", (s) => {
      s.count = 4;
    });

    expect(evicted).toContain("b");
    expect(evicted).not.toContain("a");
  });

  it("delete removes from memory and disk", async () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });
    store.update("session-1", (s) => {
      s.count = 5;
    });
    await store.flush("session-1");

    await store.delete("session-1");
    expect(store.size()).toBe(0);

    // Verify file was removed
    const sessionsDir = path.join(dir, "sessions");
    const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(0);

    // get() should return fresh state
    expect(store.get("session-1").count).toBe(0);
  });

  it("keys() includes both in-memory and on-disk keys", async () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      maxEntries: 2,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });

    store.update("a", (s) => {
      s.count = 1;
    });
    store.update("b", (s) => {
      s.count = 2;
    });
    store.update("c", (s) => {
      s.count = 3;
    }); // evicts "a" to disk

    const allKeys = store.keys();
    expect(allKeys).toContain("a");
    expect(allKeys).toContain("b");
    expect(allKeys).toContain("c");
  });

  it("close flushes all dirty entries", async () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 60_000, // Long interval — won't auto-flush
    });

    store.update("x", (s) => {
      s.count = 77;
    });
    await store.close();

    // Verify flushed to disk
    const sessionsDir = path.join(dir, "sessions");
    const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(1);
  });

  it("handles corrupted state files gracefully", async () => {
    // Write a corrupted file
    const sessionsDir = path.join(dir, "sessions");
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(path.join(sessionsDir, "badfile.json"), "not-json{{{", "utf-8");

    // Should not throw
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });

    expect(store.size()).toBe(0);
  });

  it("periodic flush timer writes dirty entries", async () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 50, // Short interval for testing
    });

    store.update("timed", (s) => {
      s.count = 33;
    });

    // Wait for the periodic flush
    await new Promise((r) => setTimeout(r, 150));

    const sessionsDir = path.join(dir, "sessions");
    const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(1);
  });
});
