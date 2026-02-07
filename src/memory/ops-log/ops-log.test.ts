import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { MemoryOpsEvent } from "./types.js";
import {
  resolveMemoryOpsDir,
  resolveCurrentMemoryOpsLogPath,
  logMemoryOpsEvent,
  queryMemoryOpsEvents,
  clearMemoryOpsListeners,
} from "./index.js";

describe("memory ops log", () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await mkdtemp(join(tmpdir(), "ops-log-test-"));
    clearMemoryOpsListeners();
  });

  afterEach(async () => {
    clearMemoryOpsListeners();
    await rm(stateDir, { recursive: true, force: true });
  });

  it("resolves ops dir under stateDir", () => {
    const dir = resolveMemoryOpsDir(stateDir);
    expect(dir).toBe(join(stateDir, "ops-logs"));
  });

  it("resolves current log path with month pattern", () => {
    const logPath = resolveCurrentMemoryOpsLogPath(stateDir);
    expect(logPath).toMatch(/ops-\d{4}-\d{2}\.jsonl$/);
  });

  it("logs and queries events", async () => {
    const event = await logMemoryOpsEvent(stateDir, {
      action: "query.start",
      status: "success",
      traceId: "trace-1",
      detail: { query: "test query", activeBackends: ["builtin"] },
    });

    expect(event.id).toBeTruthy();
    expect(event.ts).toBeTruthy();
    expect(event.action).toBe("query.start");

    const result = await queryMemoryOpsEvents(stateDir);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].action).toBe("query.start");
    expect(result.events[0].traceId).toBe("trace-1");
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it("filters by action", async () => {
    await logMemoryOpsEvent(stateDir, {
      action: "query.start",
      status: "success",
      detail: {},
    });
    await logMemoryOpsEvent(stateDir, {
      action: "query.merged",
      status: "success",
      detail: {},
    });

    const result = await queryMemoryOpsEvents(stateDir, { action: "query.merged" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].action).toBe("query.merged");
  });

  it("filters by backend", async () => {
    await logMemoryOpsEvent(stateDir, {
      action: "query.backend_result",
      backend: "builtin",
      status: "success",
      detail: {},
    });
    await logMemoryOpsEvent(stateDir, {
      action: "query.backend_result",
      backend: "graphiti",
      status: "success",
      detail: {},
    });

    const result = await queryMemoryOpsEvents(stateDir, { backend: "graphiti" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].backend).toBe("graphiti");
  });

  it("filters by status", async () => {
    await logMemoryOpsEvent(stateDir, {
      action: "query.start",
      status: "success",
      detail: {},
    });
    await logMemoryOpsEvent(stateDir, {
      action: "query.backend_result",
      status: "failure",
      detail: { error: "timeout" },
    });

    const result = await queryMemoryOpsEvents(stateDir, { status: "failure" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].status).toBe("failure");
  });

  it("paginates results", async () => {
    for (let i = 0; i < 5; i++) {
      await logMemoryOpsEvent(stateDir, {
        action: "query.start",
        status: "success",
        detail: { index: i },
      });
    }

    const page1 = await queryMemoryOpsEvents(stateDir, { limit: 2 });
    expect(page1.events).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.hasMore).toBe(true);

    const page2 = await queryMemoryOpsEvents(stateDir, { limit: 2, offset: 2 });
    expect(page2.events).toHaveLength(2);
    expect(page2.hasMore).toBe(true);
  });

  it("returns empty for non-existent directory", async () => {
    const result = await queryMemoryOpsEvents("/nonexistent/path");
    expect(result.events).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("emits events to listeners", async () => {
    const { onMemoryOpsEvent } = await import("./ops-events.js");
    const received: MemoryOpsEvent[] = [];
    const unsubscribe = onMemoryOpsEvent((evt) => received.push(evt));

    await logMemoryOpsEvent(stateDir, {
      action: "query.start",
      status: "success",
      detail: {},
    });

    expect(received).toHaveLength(1);
    expect(received[0].action).toBe("query.start");
    unsubscribe();
  });

  it("creates JSONL file on disk", async () => {
    await logMemoryOpsEvent(stateDir, {
      action: "ingest.start",
      status: "success",
      detail: { itemCount: 3 },
    });

    const opsDir = resolveMemoryOpsDir(stateDir);
    const files = await readdir(opsDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^ops-\d{4}-\d{2}\.jsonl$/);

    const content = await readFile(join(opsDir, files[0]), "utf-8");
    const parsed = JSON.parse(content.trim());
    expect(parsed.action).toBe("ingest.start");
    expect(parsed.detail.itemCount).toBe(3);
  });
});
