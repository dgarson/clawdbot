import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOrchestratorStore, type OrchestratorStore } from "./store.js";

describe("OrchestratorStore", () => {
  let store: OrchestratorStore;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orch-store-"));
    store = createOrchestratorStore(tmpDir);
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates default state for new session", () => {
    const state = store.getOrCreate("session-1");
    expect(state.role).toBeUndefined();
    expect(state.status).toBeUndefined();
    expect(state.depth).toBeUndefined();
  });

  it("persists state updates in memory", () => {
    store.update("session-1", (s) => {
      s.role = "builder";
      s.depth = 2;
      s.status = "active";
    });
    const state = store.getOrCreate("session-1");
    expect(state.role).toBe("builder");
    expect(state.depth).toBe(2);
    expect(state.status).toBe("active");
  });

  it("returns undefined for unknown session via get()", () => {
    const state = store.get("nonexistent-session");
    expect(state).toBeUndefined();
  });

  it("tracks multiple sessions independently", () => {
    store.update("session-a", (s) => {
      s.role = "orchestrator";
      s.depth = 0;
    });
    store.update("session-b", (s) => {
      s.role = "builder";
      s.depth = 2;
    });

    const a = store.getOrCreate("session-a");
    const b = store.getOrCreate("session-b");

    expect(a.role).toBe("orchestrator");
    expect(a.depth).toBe(0);
    expect(b.role).toBe("builder");
    expect(b.depth).toBe(2);
  });

  it("stores all optional fields", () => {
    store.update("session-1", (s) => {
      s.role = "scout";
      s.depth = 1;
      s.parentSessionKey = "parent-key";
      s.status = "completed";
      s.lastActivity = 12345;
      s.taskDescription = "explore codebase";
      s.fileScope = ["src/foo.ts", "src/bar.ts"];
    });

    const state = store.getOrCreate("session-1");
    expect(state.parentSessionKey).toBe("parent-key");
    expect(state.lastActivity).toBe(12345);
    expect(state.taskDescription).toBe("explore codebase");
    expect(state.fileScope).toEqual(["src/foo.ts", "src/bar.ts"]);
  });

  it("flushes to disk and recovers on re-open", async () => {
    store.update("session-flush", (s) => {
      s.role = "reviewer";
      s.status = "active";
    });
    await store.flushAll();
    await store.close();

    // Re-open a new store instance pointing at the same stateDir
    const store2 = createOrchestratorStore(tmpDir);
    const state = store2.get("session-flush");
    expect(state?.role).toBe("reviewer");
    expect(state?.status).toBe("active");
    await store2.close();
  });
});
