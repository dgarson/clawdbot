import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { DEFAULT_CONFIG, type EventLedgerConfig } from "./config.js";
import { EventStorage } from "./storage.js";
import type { EventEnvelope, RunSummary } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    eventId: `${Date.now()}-${Math.random()}`,
    ts: "2026-02-24T10:00:00.000Z",
    version: 1,
    family: "tool",
    type: "tool.invoked",
    runId: "run-1",
    data: { toolName: "shell" },
    ...overrides,
  };
}

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EventStorage", () => {
  let tempDir: string;
  let config: EventLedgerConfig;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "event-ledger-test-"));
    config = { ...DEFAULT_CONFIG, flushIntervalMs: 60_000, maxBufferSize: 50 };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("appendEvent buffers events and flush writes to JSONL file", () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    const evt = makeEvent({ agentId: "agent-1" });
    storage.appendEvent(evt);
    storage.flush();

    const filePath = join(tempDir, "event-ledger", "agent-1", "2026-02-24.jsonl");
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]!) as EventEnvelope;
    expect(parsed.eventId).toBe(evt.eventId);
    expect(parsed.family).toBe("tool");

    storage.close();
  });

  test("flush writes multiple events as separate JSONL lines", () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    storage.appendEvent(makeEvent({ eventId: "e1", agentId: "agent-1" }));
    storage.appendEvent(makeEvent({ eventId: "e2", agentId: "agent-1" }));
    storage.appendEvent(makeEvent({ eventId: "e3", agentId: "agent-1" }));
    storage.flush();

    const filePath = join(tempDir, "event-ledger", "agent-1", "2026-02-24.jsonl");
    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(3);

    storage.close();
  });

  test("day-partitioned file creation uses event timestamp", () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    storage.appendEvent(makeEvent({ agentId: "a1", ts: "2026-02-20T10:00:00.000Z" }));
    storage.appendEvent(makeEvent({ agentId: "a1", ts: "2026-02-24T10:00:00.000Z" }));
    storage.flush();

    expect(existsSync(join(tempDir, "event-ledger", "a1", "2026-02-20.jsonl"))).toBe(true);
    expect(existsSync(join(tempDir, "event-ledger", "a1", "2026-02-24.jsonl"))).toBe(true);

    storage.close();
  });

  test("events with different agentIds go to different directories", () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    storage.appendEvent(makeEvent({ agentId: "alpha" }));
    storage.appendEvent(makeEvent({ agentId: "beta" }));
    storage.flush();

    expect(existsSync(join(tempDir, "event-ledger", "alpha", "2026-02-24.jsonl"))).toBe(true);
    expect(existsSync(join(tempDir, "event-ledger", "beta", "2026-02-24.jsonl"))).toBe(true);

    storage.close();
  });

  test("events without agentId use _default directory", () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    storage.appendEvent(makeEvent({ agentId: undefined }));
    storage.flush();

    expect(existsSync(join(tempDir, "event-ledger", "_default", "2026-02-24.jsonl"))).toBe(true);

    storage.close();
  });

  test("auto-flush triggers when buffer reaches maxBufferSize", () => {
    config.maxBufferSize = 3;
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    // Append exactly maxBufferSize events -- should auto-flush
    storage.appendEvent(makeEvent({ eventId: "e1", agentId: "a1" }));
    storage.appendEvent(makeEvent({ eventId: "e2", agentId: "a1" }));
    storage.appendEvent(makeEvent({ eventId: "e3", agentId: "a1" }));

    const filePath = join(tempDir, "event-ledger", "a1", "2026-02-24.jsonl");
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(3);

    storage.close();
  });

  test("close() flushes remaining buffered events", () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    storage.appendEvent(makeEvent({ eventId: "e1", agentId: "a1" }));
    // Don't flush manually, just close
    storage.close();

    const filePath = join(tempDir, "event-ledger", "a1", "2026-02-24.jsonl");
    expect(existsSync(filePath)).toBe(true);
  });

  test("appendEvent after close is silently ignored", () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();
    storage.close();

    // Should not throw
    storage.appendEvent(makeEvent({ agentId: "a1" }));
    expect(existsSync(join(tempDir, "event-ledger", "a1"))).toBe(false);
  });

  test("appendSummary writes to summaries directory", () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    const summary: RunSummary = {
      runId: "run-1",
      agentId: "agent-1",
      sessionKey: "sess-1",
      startedAt: "2026-02-24T10:00:00.000Z",
      endedAt: "2026-02-24T10:05:00.000Z",
      durationMs: 300000,
      model: "gpt-4",
      provider: "openai",
      inputTokens: 500,
      outputTokens: 200,
      estimatedCostUsd: 0.05,
      toolCalls: 3,
      toolFailures: 0,
      outcome: "completed",
    };
    storage.appendSummary(summary);

    const filePath = join(tempDir, "event-ledger", "summaries", "2026-02-24.jsonl");
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content.trim()) as RunSummary;
    expect(parsed.runId).toBe("run-1");

    storage.close();
  });

  test("readDayEvents returns parsed events from JSONL", async () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    const evt = makeEvent({ eventId: "read-test", agentId: "a1" });
    storage.appendEvent(evt);
    storage.flush();

    const events = await storage.readDayEvents("a1", "2026-02-24");
    expect(events).toHaveLength(1);
    expect(events[0]!.eventId).toBe("read-test");

    storage.close();
  });

  test("listDays returns sorted day names", async () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    storage.appendEvent(makeEvent({ agentId: "a1", ts: "2026-02-22T10:00:00.000Z" }));
    storage.appendEvent(makeEvent({ agentId: "a1", ts: "2026-02-24T10:00:00.000Z" }));
    storage.appendEvent(makeEvent({ agentId: "a1", ts: "2026-02-20T10:00:00.000Z" }));
    storage.flush();

    const days = await storage.listDays("a1");
    expect(days).toEqual(["2026-02-20", "2026-02-22", "2026-02-24"]);

    storage.close();
  });

  test("listAgentIds returns sorted agent directory names", async () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    storage.appendEvent(makeEvent({ agentId: "zulu" }));
    storage.appendEvent(makeEvent({ agentId: "alpha" }));
    storage.flush();

    const agents = await storage.listAgentIds();
    expect(agents).toEqual(["alpha", "zulu"]);

    storage.close();
  });

  test("listAgentIds excludes summaries directory", async () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    storage.start();

    storage.appendEvent(makeEvent({ agentId: "a1" }));
    storage.flush();

    // Create a summaries directory
    const summaryDir = join(tempDir, "event-ledger", "summaries");
    mkdirSync(summaryDir, { recursive: true });
    writeFileSync(join(summaryDir, "2026-02-24.jsonl"), "{}");

    const agents = await storage.listAgentIds();
    expect(agents).not.toContain("summaries");

    storage.close();
  });

  test("readDayEvents returns empty array for missing file", async () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    const events = await storage.readDayEvents("nonexistent", "2026-02-24");
    expect(events).toEqual([]);
  });

  test("readDayEvents skips malformed JSONL lines", async () => {
    const dir = join(tempDir, "event-ledger", "a1");
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, "2026-02-24.jsonl");
    const validEvent = JSON.stringify(makeEvent({ eventId: "valid" }));
    writeFileSync(filePath, `${validEvent}\nnot valid json\n${validEvent}\n`);

    const storage = new EventStorage(tempDir, config, noopLogger);
    const events = await storage.readDayEvents("a1", "2026-02-24");
    expect(events).toHaveLength(2);
  });

  test("baseDir returns correct path", () => {
    const storage = new EventStorage(tempDir, config, noopLogger);
    expect(storage.baseDir).toBe(join(tempDir, "event-ledger"));
  });
});
