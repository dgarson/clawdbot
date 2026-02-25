import fsPromises from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPluginKvStore } from "./kv.js";

// Spy on the methods of the default export object.
const readFileSpy = vi.spyOn(fsPromises, "readFile");
const writeFileSpy = vi.spyOn(fsPromises, "writeFile");
const mkdirSpy = vi.spyOn(fsPromises, "mkdir");

// Use a unique counter to produce fresh stateDir/pluginId combos per test,
// avoiding the module-level storeCache leaking state between tests.
let testId = 0;
function freshIds() {
  testId++;
  return { stateDir: `/tmp/kv-test-${testId}`, pluginId: `plugin-${testId}` };
}

describe("plugin kv store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: readFile rejects (no file on disk) so loadStore starts fresh.
    readFileSpy.mockRejectedValue(new Error("ENOENT"));
    writeFileSpy.mockResolvedValue(undefined);
    mkdirSpy.mockResolvedValue(undefined as unknown as string);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("get returns undefined for missing key", async () => {
    const { stateDir, pluginId } = freshIds();
    const kv = createPluginKvStore(stateDir, pluginId);
    expect(await kv.get("nonexistent")).toBeUndefined();
  });

  it("set then get returns stored value", async () => {
    const { stateDir, pluginId } = freshIds();
    const kv = createPluginKvStore(stateDir, pluginId);

    await kv.set("greeting", "hello");
    expect(await kv.get("greeting")).toBe("hello");

    // Verify writeFile was called with the stored data.
    expect(writeFileSpy).toHaveBeenCalled();
    const written = JSON.parse(writeFileSpy.mock.calls[0][1] as string);
    expect(written).toHaveProperty("greeting");
    expect(written.greeting.v).toBe("hello");
  });

  it("set with TTL makes value expire after time passes", async () => {
    vi.useFakeTimers();
    const { stateDir, pluginId } = freshIds();
    const kv = createPluginKvStore(stateDir, pluginId);

    await kv.set("temp", "data", { ttlMs: 5000 });
    expect(await kv.get("temp")).toBe("data");

    vi.advanceTimersByTime(5001);
    expect(await kv.get("temp")).toBeUndefined();
  });

  it("delete removes key", async () => {
    const { stateDir, pluginId } = freshIds();
    const kv = createPluginKvStore(stateDir, pluginId);

    await kv.set("key1", "value1");
    writeFileSpy.mockClear();

    await kv.delete("key1");
    expect(await kv.get("key1")).toBeUndefined();
    // Persist was called for the delete.
    expect(writeFileSpy).toHaveBeenCalledTimes(1);
  });

  it("delete does nothing for nonexistent key (no writeFile call)", async () => {
    const { stateDir, pluginId } = freshIds();
    const kv = createPluginKvStore(stateDir, pluginId);

    writeFileSpy.mockClear();
    await kv.delete("nope");
    expect(writeFileSpy).not.toHaveBeenCalled();
  });

  it("list returns all keys", async () => {
    const { stateDir, pluginId } = freshIds();
    const kv = createPluginKvStore(stateDir, pluginId);

    await kv.set("a", 1);
    await kv.set("b", 2);
    await kv.set("c", 3);

    const keys = await kv.list();
    expect(keys.toSorted()).toEqual(["a", "b", "c"]);
  });

  it("list with prefix filters keys", async () => {
    const { stateDir, pluginId } = freshIds();
    const kv = createPluginKvStore(stateDir, pluginId);

    await kv.set("user:alice", 1);
    await kv.set("user:bob", 2);
    await kv.set("settings:theme", "dark");

    const userKeys = await kv.list("user:");
    expect(userKeys.toSorted()).toEqual(["user:alice", "user:bob"]);

    const settingsKeys = await kv.list("settings:");
    expect(settingsKeys).toEqual(["settings:theme"]);
  });

  it("list excludes expired entries", async () => {
    vi.useFakeTimers();
    const { stateDir, pluginId } = freshIds();
    const kv = createPluginKvStore(stateDir, pluginId);

    await kv.set("persistent", "stays");
    await kv.set("ephemeral", "goes", { ttlMs: 1000 });

    expect(await kv.list()).toEqual(expect.arrayContaining(["persistent", "ephemeral"]));

    vi.advanceTimersByTime(1001);

    const keys = await kv.list();
    expect(keys).toEqual(["persistent"]);
  });

  it("clear removes all entries and persists empty store", async () => {
    const { stateDir, pluginId } = freshIds();
    const kv = createPluginKvStore(stateDir, pluginId);

    await kv.set("x", 1);
    await kv.set("y", 2);
    writeFileSpy.mockClear();

    await kv.clear();

    expect(await kv.list()).toEqual([]);
    expect(await kv.get("x")).toBeUndefined();

    // Persisted an empty store.
    expect(writeFileSpy).toHaveBeenCalledTimes(1);
    const written = JSON.parse(writeFileSpy.mock.calls[0][1] as string);
    expect(written).toEqual({});
  });

  it("different plugins have independent stores", async () => {
    const stateDir = `/tmp/kv-isolation-${++testId}`;
    const kvA = createPluginKvStore(stateDir, `pluginA-${testId}`);
    const kvB = createPluginKvStore(stateDir, `pluginB-${testId}`);

    await kvA.set("shared-key", "from-a");
    await kvB.set("shared-key", "from-b");

    expect(await kvA.get("shared-key")).toBe("from-a");
    expect(await kvB.get("shared-key")).toBe("from-b");
  });
});
