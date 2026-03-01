import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendBounded,
  createSessionRuntimeStore,
  SessionRuntimeStore,
  wireSessionHooks,
  wireSessionLifecycleHooks,
} from "./session-runtime-store.js";

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

  it("get returns undefined for unknown key", () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });
    expect(store.get("nonexistent")).toBeUndefined();
  });

  it("getOrCreate creates new state on first access", () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });
    const state = store.getOrCreate("session-1");
    expect(state).toEqual({ count: 0 });
  });

  it("returns same state on repeated access", () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });
    const s1 = store.getOrCreate("session-1");
    s1.count = 42;
    const s2 = store.get("session-1");
    expect(s2?.count).toBe(42);
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
    expect(store.get("a")?.count).toBe(1);
    expect(store.get("b")?.count).toBe(2);
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

    const raw = fs.readFileSync(path.join(sessionsDir, files[0]), "utf-8");
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

    expect(store.get("session-1")?.count).toBe(99);
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
    expect(store.get("a")?.count).toBe(1);
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

    // get() should return undefined after delete
    expect(store.get("session-1")).toBeUndefined();
    // getOrCreate() should return fresh state
    expect(store.getOrCreate("session-1").count).toBe(0);
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

  it("has() checks existence without loading", () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });

    expect(store.has("nope")).toBe(false);
    store.getOrCreate("yes");
    expect(store.has("yes")).toBe(true);
  });

  it("TTL eviction removes stale entries during flush", async () => {
    const evicted: string[] = [];
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      ttlMs: 50,
      flushIntervalMs: 0,
      onEvict: (key) => evicted.push(key),
    });

    store.update("stale", (s) => {
      s.count = 1;
    });

    // Wait for the entry to become stale
    await new Promise((r) => setTimeout(r, 80));

    // Trigger flush (which also runs TTL eviction)
    await store.close();

    expect(evicted).toContain("stale");
    expect(store.size()).toBe(0);
  });

  it("TTL eviction preserves recently-updated entries", async () => {
    const evicted: string[] = [];
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      ttlMs: 200,
      flushIntervalMs: 0,
      onEvict: (key) => evicted.push(key),
    });

    store.update("fresh", (s) => {
      s.count = 1;
    });

    // Flush immediately — should not evict (entry is fresh)
    await store.close();

    expect(evicted).not.toContain("fresh");
  });

  it("ephemeral mode never touches disk", async () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      ephemeral: true,
      flushIntervalMs: 0,
    });

    store.update("key1", (s) => {
      s.count = 42;
    });
    await store.flush("key1");
    await store.close();

    // No sessions directory should have been created
    const sessionsDir = path.join(dir, "sessions");
    expect(fs.existsSync(sessionsDir)).toBe(false);
  });

  it("ephemeral mode evicts without writing to disk", () => {
    const evicted: string[] = [];
    store = createSessionRuntimeStore({
      stateDir: dir,
      maxEntries: 2,
      create: () => ({ count: 0 }),
      ephemeral: true,
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
    }); // evicts "a"

    expect(evicted).toContain("a");
    // Evicted entry is gone — no disk to recover from
    expect(store.get("a")).toBeUndefined();
  });

  it("ephemeral mode has() returns false for evicted keys", () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      maxEntries: 1,
      create: () => ({ count: 0 }),
      ephemeral: true,
      flushIntervalMs: 0,
    });

    store.getOrCreate("a");
    store.getOrCreate("b"); // evicts "a"

    expect(store.has("a")).toBe(false);
    expect(store.has("b")).toBe(true);
  });

  it("toPluginService returns valid service", async () => {
    store = createSessionRuntimeStore({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });

    const service = store.toPluginService("my-store");
    expect(service.id).toBe("my-store");

    // start is a no-op
    service.start();

    store.update("key", (s) => {
      s.count = 42;
    });

    // stop flushes to disk
    await service.stop();

    // Verify flushed
    const sessionsDir = path.join(dir, "sessions");
    const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(1);
  });
});

describe("appendBounded", () => {
  it("appends and evicts oldest when over max", () => {
    const arr = [1, 2, 3];
    appendBounded(arr, 4, 3);
    expect(arr).toEqual([2, 3, 4]);
  });

  it("appends without eviction when under max", () => {
    const arr = [1];
    appendBounded(arr, 2, 5);
    expect(arr).toEqual([1, 2]);
  });

  it("handles maxItems of 1", () => {
    const arr: number[] = [];
    appendBounded(arr, 10, 1);
    expect(arr).toEqual([10]);
    appendBounded(arr, 20, 1);
    expect(arr).toEqual([20]);
  });
});

describe("wireSessionHooks", () => {
  it("wires run_start and agent_end to store", () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const mockApi = {
      on: (hookName: string, handler: (...args: unknown[]) => void) => {
        handlers.set(hookName, handler);
      },
    };

    const dir = makeTempDir();
    const store = createSessionRuntimeStore<{ initialized: boolean }>({
      stateDir: dir,
      create: () => ({ initialized: false }),
      flushIntervalMs: 0,
    });

    const startCalls: string[] = [];
    wireSessionHooks(mockApi, store, {
      onRunStart: (key, state) => {
        state.initialized = true;
        startCalls.push(key);
      },
    });

    expect(handlers.has("run_start")).toBe(true);
    expect(handlers.has("agent_end")).toBe(true);

    // Simulate run_start
    handlers.get("run_start")!({ sessionKey: "sess-1" });
    expect(startCalls).toEqual(["sess-1"]);
    expect(store.get("sess-1")?.initialized).toBe(true);

    void store.close();
    cleanup(dir);
  });

  it("skips events without sessionKey", () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const mockApi = {
      on: (hookName: string, handler: (...args: unknown[]) => void) => {
        handlers.set(hookName, handler);
      },
    };

    const dir = makeTempDir();
    const store = createSessionRuntimeStore<{ count: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });

    wireSessionHooks(mockApi, store);

    // Should not throw
    handlers.get("run_start")!({});
    expect(store.size()).toBe(0);

    void store.close();
    cleanup(dir);
  });

  it("wireSessionHooks handles session_start with resumedFrom", () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const mockApi = {
      on: (hookName: string, handler: (...args: unknown[]) => void) => {
        handlers.set(hookName, handler);
      },
    };

    const dir = makeTempDir();
    const store = createSessionRuntimeStore<{ count: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flushIntervalMs: 0,
    });

    const sessionStartCalls: string[] = [];
    wireSessionHooks(mockApi, store, {
      onSessionStart: (sessionId) => {
        sessionStartCalls.push(sessionId);
      },
    });

    expect(handlers.has("session_start")).toBe(true);

    // Simulate session_start with resumedFrom (as if resuming from a previous session)
    handlers.get("session_start")!({ sessionId: "sess-A", resumedFrom: "sess-A-old" });
    expect(sessionStartCalls).toContain("sess-A");
    expect(store.get("sess-A")).toBeDefined();

    void store.close();
    cleanup(dir);
  });

  it("wireSessionHooks handles session_end with flush", async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const mockApi = {
      on: (hookName: string, handler: (...args: unknown[]) => void) => {
        handlers.set(hookName, handler);
      },
    };

    const dir = makeTempDir();
    const store = createSessionRuntimeStore<{ value: number }>({
      stateDir: dir,
      create: () => ({ value: 0 }),
      flushIntervalMs: 60_000, // Long interval — won't auto-flush
    });

    const sessionEndCalls: string[] = [];
    wireSessionHooks(mockApi, store, {
      onSessionEnd: (sessionId) => {
        sessionEndCalls.push(sessionId);
      },
    });

    // Set some state
    store.update("sess-B", (s) => {
      s.value = 42;
    });

    expect(handlers.has("session_end")).toBe(true);

    // Simulate session_end
    handlers.get("session_end")!({ sessionId: "sess-B", messageCount: 5 });
    expect(sessionEndCalls).toContain("sess-B");

    // Allow the flush promise to resolve
    await new Promise((r) => setTimeout(r, 10));

    // Verify it was written to disk
    const sessionsDir = path.join(dir, "sessions");
    const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(1);

    await store.close();
    cleanup(dir);
  });
});

describe("SessionRuntimeStore per-run state", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(() => {
    cleanup(dir);
  });

  it("getRun returns undefined for non-existent session", () => {
    const store = createSessionRuntimeStore<{ count: number }, { calls: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      initialRun: () => ({ calls: 0 }),
      flushIntervalMs: 0,
    });

    expect(store.getRun("no-session", "run-1")).toBeUndefined();
    void store.close();
  });

  it("getRun returns undefined for non-existent run in existing session", () => {
    const store = createSessionRuntimeStore<{ count: number }, { calls: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      initialRun: () => ({ calls: 0 }),
      flushIntervalMs: 0,
    });

    store.getOrCreate("session-1");
    expect(store.getRun("session-1", "run-xyz")).toBeUndefined();
    void store.close();
  });

  it("updateRun creates session and run state", () => {
    const store = createSessionRuntimeStore<{ count: number }, { calls: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      initialRun: () => ({ calls: 0 }),
      flushIntervalMs: 0,
    });

    store.updateRun("session-1", "run-1", (run) => {
      run.calls = 5;
    });

    expect(store.getRun("session-1", "run-1")).toEqual({ calls: 5 });
    // Session-level state should also have been created
    expect(store.get("session-1")).toBeDefined();
    void store.close();
  });

  it("updateRun updates existing run state", () => {
    const store = createSessionRuntimeStore<{ count: number }, { calls: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      initialRun: () => ({ calls: 0 }),
      flushIntervalMs: 0,
    });

    store.updateRun("session-1", "run-1", (run) => {
      run.calls = 3;
    });
    store.updateRun("session-1", "run-1", (run) => {
      run.calls += 2;
    });

    expect(store.getRun("session-1", "run-1")?.calls).toBe(5);
    void store.close();
  });

  it("deleteRun removes run state", () => {
    const store = createSessionRuntimeStore<{ count: number }, { calls: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      initialRun: () => ({ calls: 0 }),
      flushIntervalMs: 0,
    });

    store.updateRun("session-1", "run-1", (run) => {
      run.calls = 10;
    });
    expect(store.getRun("session-1", "run-1")).toBeDefined();

    store.deleteRun("session-1", "run-1");
    expect(store.getRun("session-1", "run-1")).toBeUndefined();
    void store.close();
  });

  it("allRuns returns all runs for a session", () => {
    const store = createSessionRuntimeStore<{ count: number }, { calls: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      initialRun: () => ({ calls: 0 }),
      flushIntervalMs: 0,
    });

    store.updateRun("session-1", "run-A", (run) => {
      run.calls = 1;
    });
    store.updateRun("session-1", "run-B", (run) => {
      run.calls = 2;
    });

    const runs = store.allRuns("session-1");
    expect(runs.size).toBe(2);
    expect(runs.get("run-A")?.calls).toBe(1);
    expect(runs.get("run-B")?.calls).toBe(2);
    void store.close();
  });

  it("allRuns returns empty Map for non-existent session", () => {
    const store = createSessionRuntimeStore<{ count: number }, { calls: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      initialRun: () => ({ calls: 0 }),
      flushIntervalMs: 0,
    });

    const runs = store.allRuns("no-session");
    expect(runs.size).toBe(0);
    void store.close();
  });

  it("per-run state is persisted and recovered from disk", async () => {
    // Write state with per-run data
    const store1 = createSessionRuntimeStore<{ count: number }, { calls: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      initialRun: () => ({ calls: 0 }),
      flushIntervalMs: 0,
    });
    store1.updateRun("session-1", "run-1", (run) => {
      run.calls = 7;
    });
    await store1.close();

    // Recover in a new store
    const store2 = createSessionRuntimeStore<{ count: number }, { calls: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      initialRun: () => ({ calls: 0 }),
      flushIntervalMs: 0,
    });
    const recovered = store2.getRun("session-1", "run-1");
    expect(recovered?.calls).toBe(7);
    await store2.close();
  });
});

describe("SessionRuntimeStore appendToList", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(() => {
    cleanup(dir);
  });

  it("appendToList adds items and enforces maxItems from boundedLists config", () => {
    type State = { events: string[]; name: string };
    const store = createSessionRuntimeStore<State>({
      stateDir: dir,
      create: () => ({ events: [], name: "" }),
      flushIntervalMs: 0,
      boundedLists: [{ key: "events", maxItems: 3 }],
    });

    store.appendToList("session-1", "events", "e1");
    store.appendToList("session-1", "events", "e2");
    store.appendToList("session-1", "events", "e3");
    store.appendToList("session-1", "events", "e4"); // should evict "e1"

    const state = store.get("session-1");
    expect(state?.events).toEqual(["e2", "e3", "e4"]);
    void store.close();
  });

  it("appendToList with no boundedLists config grows without bound", () => {
    type State = { items: number[] };
    const store = createSessionRuntimeStore<State>({
      stateDir: dir,
      create: () => ({ items: [] }),
      flushIntervalMs: 0,
    });

    for (let i = 0; i < 10; i++) {
      store.appendToList("session-1", "items", i);
    }

    expect(store.get("session-1")?.items.length).toBe(10);
    void store.close();
  });
});

describe("SessionRuntimeStore debounce flush strategy", () => {
  it("debounce flush fires after delayMs", async () => {
    const dir = makeTempDir();
    const store = createSessionRuntimeStore<{ count: number }>({
      stateDir: dir,
      create: () => ({ count: 0 }),
      flush: { kind: "debounce", delayMs: 50 },
    });

    store.update("session-1", (s) => {
      s.count = 99;
    });

    // Before debounce fires, the entry may not be on disk yet
    const sessionsDir = path.join(dir, "sessions");
    const filesBefore = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
    expect(filesBefore.length).toBe(0);

    // Wait for debounce to fire
    await new Promise((r) => setTimeout(r, 150));

    const filesAfter = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
    expect(filesAfter.length).toBe(1);

    const raw = fs.readFileSync(path.join(sessionsDir, filesAfter[0]), "utf-8");
    const envelope = JSON.parse(raw);
    expect(envelope.state.count).toBe(99);

    await store.close();
    cleanup(dir);
  });
});

describe("SessionRuntimeStore flushAll", () => {
  it("flushAll writes all dirty entries without stopping the timer", async () => {
    const dir = makeTempDir();
    const store = createSessionRuntimeStore<{ n: number }>({
      stateDir: dir,
      create: () => ({ n: 0 }),
      flushIntervalMs: 60_000, // long interval — won't auto-flush
    });

    store.update("a", (s) => {
      s.n = 1;
    });
    store.update("b", (s) => {
      s.n = 2;
    });
    await store.flushAll();

    // Both files written
    const store2 = createSessionRuntimeStore<{ n: number }>({
      stateDir: dir,
      create: () => ({ n: 0 }),
    });
    expect(store2.get("a")?.n).toBe(1);
    expect(store2.get("b")?.n).toBe(2);

    // Store still functional (timer not stopped)
    store.update("a", (s) => {
      s.n = 99;
    });
    expect(store.get("a")?.n).toBe(99);

    await store.close();
    await store2.close();
    cleanup(dir);
  });
});

describe("wireSessionLifecycleHooks", () => {
  it("session_start with resumedFrom calls onSessionStart callback", async () => {
    const dir = makeTempDir();
    const store1 = createSessionRuntimeStore<{ val: number }>({
      stateDir: dir,
      create: () => ({ val: 0 }),
      flushIntervalMs: 0,
    });
    store1.update("sess1", (s) => {
      s.val = 42;
    });
    await store1.close();

    const store2 = createSessionRuntimeStore<{ val: number }>({
      stateDir: dir,
      create: () => ({ val: 0 }),
      flushIntervalMs: 0,
    });
    const started: string[] = [];
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    wireSessionLifecycleHooks(
      {
        on: (name: string, h: (...args: unknown[]) => void) => {
          handlers[name] = h;
        },
      },
      store2,
      { onSessionStart: (id) => started.push(id) },
    );

    // Trigger session_start with resumedFrom — callback should fire
    handlers["session_start"]?.({ sessionId: "sess1", resumedFrom: "prev-session-id" }, {});
    await new Promise((r) => setTimeout(r, 10));

    expect(started).toContain("sess1");
    expect(store2.get("sess1")?.val).toBe(42);

    await store2.close();
    cleanup(dir);
  });

  it("session_start without resumedFrom does not eagerly create new entries", async () => {
    const dir = makeTempDir();
    // Use a fresh dir with no existing state — nothing to recover on construction
    const store2 = createSessionRuntimeStore<{ val: number }>({
      stateDir: dir,
      create: () => ({ val: 0 }),
      flushIntervalMs: 0,
    });
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    wireSessionLifecycleHooks(
      {
        on: (name: string, h: (...args: unknown[]) => void) => {
          handlers[name] = h;
        },
      },
      store2,
    );

    // Trigger session_start WITHOUT resumedFrom — hook should not create an entry
    handlers["session_start"]?.({ sessionId: "new-session" }, {});
    await new Promise((r) => setTimeout(r, 10));

    // The hook must NOT have called getOrCreate — entry should not exist in memory
    expect(store2.size()).toBe(0);
    expect(store2.get("new-session")).toBeUndefined();

    await store2.close();
    cleanup(dir);
  });

  it("session_end flushes the session to disk", async () => {
    const dir = makeTempDir();
    const store = createSessionRuntimeStore<{ val: number }>({
      stateDir: dir,
      create: () => ({ val: 0 }),
      flushIntervalMs: 60_000, // long interval — won't auto-flush
    });
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    wireSessionLifecycleHooks(
      {
        on: (name: string, h: (...args: unknown[]) => void) => {
          handlers[name] = h;
        },
      },
      store,
    );

    store.update("sess1", (s) => {
      s.val = 77;
    });
    handlers["session_end"]?.({ sessionId: "sess1" }, {});
    await new Promise((r) => setTimeout(r, 20));

    // Verify it flushed to disk
    const store2 = createSessionRuntimeStore<{ val: number }>({
      stateDir: dir,
      create: () => ({ val: 0 }),
      flushIntervalMs: 0,
    });
    expect(store2.get("sess1")?.val).toBe(77);

    await store.close();
    await store2.close();
    cleanup(dir);
  });

  it("onSessionStart and onSessionEnd callbacks are called", async () => {
    const dir = makeTempDir();
    const store = createSessionRuntimeStore<{ val: number }>({
      stateDir: dir,
      create: () => ({ val: 0 }),
      flushIntervalMs: 0,
    });
    const started: string[] = [];
    const ended: string[] = [];
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    wireSessionLifecycleHooks(
      {
        on: (name: string, h: (...args: unknown[]) => void) => {
          handlers[name] = h;
        },
      },
      store,
      {
        onSessionStart: (id) => started.push(id),
        onSessionEnd: (id) => ended.push(id),
      },
    );

    store.update("sess1", (s) => {
      s.val = 1;
    });
    handlers["session_start"]?.({ sessionId: "sess1", resumedFrom: "prev" }, {});
    handlers["session_end"]?.({ sessionId: "sess1" }, {});
    await new Promise((r) => setTimeout(r, 20));

    expect(started).toContain("sess1");
    expect(ended).toContain("sess1");

    await store.close();
    cleanup(dir);
  });
});
