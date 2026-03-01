import node_fs from "node:fs";
import node_os from "node:os";
import node_path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type BetterSqlite3 from "better-sqlite3";
import { createIndexerFromDb, indexEvent, catchUp } from "./indexer.js";
import type { TelemetryEvent } from "./types.js";

type Db = BetterSqlite3.Database;

// ---------------------------------------------------------------------------
// Helper: open an in-memory SQLite database
// ---------------------------------------------------------------------------

async function openMemoryDb(): Promise<Db> {
  const mod = await import("better-sqlite3");
  const Database = mod.default ?? mod;
  return new Database(":memory:");
}

function makeEvent(overrides: Partial<TelemetryEvent> = {}): TelemetryEvent {
  return {
    id: `evt_${Math.random().toString(36).slice(2, 18)}`,
    ts: Date.now(),
    seq: 0,
    agentId: "agent-1",
    sessionKey: "sess-abc",
    sessionId: "sid-123",
    runId: "run-xyz",
    kind: "run.start",
    data: {},
    source: "hook",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Schema creation
// ---------------------------------------------------------------------------

describe("createIndexerFromDb", () => {
  it("creates all required tables", async () => {
    const db = await openMemoryDb();
    const indexer = createIndexerFromDb(db, ":none:");

    const tables = db
      .prepare<unknown[], { name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name)
      .sort();

    expect(tables).toContain("events");
    expect(tables).toContain("runs");
    expect(tables).toContain("tool_calls");
    expect(tables).toContain("messages");
    expect(tables).toContain("subagents");
    expect(tables).toContain("model_calls");
    expect(tables).toContain("indexer_state");

    indexer.close();
  });

  it("creates indexes", async () => {
    const db = await openMemoryDb();
    const indexer = createIndexerFromDb(db, ":none:");

    const indexes = db
      .prepare<unknown[], { name: string }>("SELECT name FROM sqlite_master WHERE type='index'")
      .all()
      .map((r) => r.name);

    expect(indexes).toContain("idx_events_kind");
    expect(indexes).toContain("idx_runs_session");
    expect(indexes).toContain("idx_tool_calls_run");

    indexer.close();
  });
});

// ---------------------------------------------------------------------------
// Event dispatching
// ---------------------------------------------------------------------------

type EventRow = { id: string; kind: string; session_key: string | null };
type RunRow = {
  run_id: string;
  model: string | null;
  provider: string | null;
  session_key: string | null;
  duration_ms: number | null;
  stop_reason: string | null;
  tool_call_count: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
};
type ToolCallRow = {
  id: string;
  tool_name: string;
  file_path: string | null;
  tool_call_id: string | null;
  duration_ms: number | null;
  is_error: number;
};
type MessageRow = { id: string; direction: string; from_id: string | null; channel: string | null };
type SubagentRow = {
  id: string;
  parent_session_key: string | null;
  child_session_key: string | null;
  label: string | null;
};
type ModelCallRow = {
  id: string;
  call_index: number | null;
  input_tokens: number | null;
  cost_usd: number | null;
};
type CountRow = { c: number };

describe("indexEvent", () => {
  it("inserts into events table for any kind", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    const event = makeEvent({ kind: "session.start" });
    indexEvent(db, event);

    const row = db
      .prepare<unknown[], EventRow>("SELECT id, kind, session_key FROM events WHERE id = ?")
      .get(event.id);
    expect(row).toBeTruthy();
    expect(row!.kind).toBe("session.start");
    expect(row!.session_key).toBe("sess-abc");
  });

  it("is idempotent — duplicate event id is ignored", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    const event = makeEvent({ kind: "session.start" });
    indexEvent(db, event);
    indexEvent(db, event);

    const count = db
      .prepare<unknown[], CountRow>("SELECT COUNT(*) as c FROM events WHERE id = ?")
      .get(event.id)!.c;
    expect(count).toBe(1);
  });

  it("run.start inserts into runs table", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    const event = makeEvent({
      kind: "run.start",
      runId: "run-001",
      data: { model: "claude-opus-4", provider: "anthropic", isHeartbeat: false },
    });
    indexEvent(db, event);

    const row = db
      .prepare<unknown[], RunRow>(
        "SELECT run_id, model, provider, session_key FROM runs WHERE run_id = ?",
      )
      .get("run-001");
    expect(row).toBeTruthy();
    expect(row!.model).toBe("claude-opus-4");
    expect(row!.provider).toBe("anthropic");
    expect(row!.session_key).toBe("sess-abc");
  });

  it("run.end updates the runs row with usage data", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    // First create the run
    indexEvent(
      db,
      makeEvent({
        kind: "run.start",
        runId: "run-002",
        data: { model: "gpt-4o", provider: "openai" },
      }),
    );

    // Now end the run
    indexEvent(
      db,
      makeEvent({
        kind: "run.end",
        runId: "run-002",
        data: {
          durationMs: 5000,
          stopReason: "end_turn",
          toolCallCount: 3,
          compactionCount: 1,
          usage: { input: 100, output: 200, cacheRead: 50, cacheWrite: 10, total: 360 },
        },
      }),
    );

    const row = db
      .prepare<
        unknown[],
        RunRow
      >(
        "SELECT duration_ms, stop_reason, tool_call_count, input_tokens, output_tokens, total_tokens FROM runs WHERE run_id = ?",
      )
      .get("run-002");
    expect(row!.duration_ms).toBe(5000);
    expect(row!.stop_reason).toBe("end_turn");
    expect(row!.tool_call_count).toBe(3);
    expect(row!.input_tokens).toBe(100);
    expect(row!.output_tokens).toBe(200);
    expect(row!.total_tokens).toBe(360);
  });

  it("tool.start inserts into tool_calls", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    const event = makeEvent({
      kind: "tool.start",
      runId: "run-003",
      data: { toolName: "Read", toolCallId: "tc-abc", filePath: "/foo/bar.ts" },
    });
    indexEvent(db, event);

    const row = db
      .prepare<unknown[], ToolCallRow>(
        "SELECT id, tool_name, file_path FROM tool_calls WHERE id = ?",
      )
      .get(event.id);
    expect(row).toBeTruthy();
    expect(row!.tool_name).toBe("Read");
    expect(row!.file_path).toBe("/foo/bar.ts");
  });

  it("tool.end with toolCallId updates the matching tool_call row", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    // Insert a tool.start first
    const startEvent = makeEvent({
      kind: "tool.start",
      runId: "run-004",
      data: { toolName: "Bash", toolCallId: "tc-bash-1", execCommand: "npm test" },
    });
    indexEvent(db, startEvent);

    // End it
    indexEvent(
      db,
      makeEvent({
        kind: "tool.end",
        runId: "run-004",
        data: {
          toolName: "Bash",
          toolCallId: "tc-bash-1",
          durationMs: 2000,
          isError: false,
        },
      }),
    );

    const row = db
      .prepare<unknown[], ToolCallRow>(
        "SELECT tool_call_id, duration_ms, is_error FROM tool_calls WHERE tool_call_id = ?",
      )
      .get("tc-bash-1");
    expect(row).toBeTruthy();
    expect(row!.duration_ms).toBe(2000);
    expect(row!.is_error).toBe(0);
  });

  it("message.inbound inserts into messages with direction=inbound", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    const event = makeEvent({
      kind: "message.inbound",
      data: { from: "user123", channel: "telegram", contentPreview: "hello world" },
    });
    indexEvent(db, event);

    const row = db
      .prepare<unknown[], MessageRow>(
        "SELECT id, direction, from_id, channel FROM messages WHERE id = ?",
      )
      .get(event.id);
    expect(row).toBeTruthy();
    expect(row!.direction).toBe("inbound");
    expect(row!.from_id).toBe("user123");
    expect(row!.channel).toBe("telegram");
  });

  it("message.outbound inserts into messages with direction=outbound", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    const event = makeEvent({
      kind: "message.outbound",
      data: { to: "user123", channel: "telegram", contentPreview: "hi there" },
    });
    indexEvent(db, event);

    const row = db
      .prepare<unknown[], MessageRow>("SELECT id, direction FROM messages WHERE id = ?")
      .get(event.id);
    expect(row).toBeTruthy();
    expect(row!.direction).toBe("outbound");
  });

  it("subagent.spawn inserts into subagents", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    const event = makeEvent({
      kind: "subagent.spawn",
      runId: "run-parent",
      sessionKey: "sess-parent",
      data: { childSessionKey: "sess-child", agentId: "child-agent", label: "worker" },
    });
    indexEvent(db, event);

    const row = db
      .prepare<
        unknown[],
        SubagentRow
      >(
        "SELECT id, parent_session_key, child_session_key, label FROM subagents WHERE id = ?",
      )
      .get(event.id);
    expect(row).toBeTruthy();
    expect(row!.parent_session_key).toBe("sess-parent");
    expect(row!.child_session_key).toBe("sess-child");
    expect(row!.label).toBe("worker");
  });

  it("llm.call inserts into model_calls", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    const event = makeEvent({
      kind: "llm.call",
      runId: "run-005",
      data: {
        callIndex: 2,
        provider: "anthropic",
        model: "claude-sonnet-4",
        inputTokens: 500,
        outputTokens: 300,
        totalTokens: 800,
        costUsd: 0.0012,
        durationMs: 1500,
      },
    });
    indexEvent(db, event);

    const row = db
      .prepare<unknown[], ModelCallRow>(
        "SELECT id, call_index, input_tokens, cost_usd FROM model_calls WHERE id = ?",
      )
      .get(event.id);
    expect(row).toBeTruthy();
    expect(row!.call_index).toBe(2);
    expect(row!.input_tokens).toBe(500);
    expect(row!.cost_usd).toBeCloseTo(0.0012);
  });
});

// ---------------------------------------------------------------------------
// JSONL catch-up
// ---------------------------------------------------------------------------

describe("catchUp", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = node_fs.mkdtempSync(node_path.join(node_os.tmpdir(), "tel-catchup-"));
  });

  afterEach(() => {
    node_fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 0 when JSONL file does not exist", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, "/nonexistent/events.jsonl");
    const count = catchUp(db, "/nonexistent/events.jsonl");
    expect(count).toBe(0);
  });

  it("indexes events from JSONL file", async () => {
    const db = await openMemoryDb();
    const jsonlPath = node_path.join(tmpDir, "events.jsonl");
    createIndexerFromDb(db, jsonlPath);

    // Write two events to the file
    const e1 = makeEvent({ kind: "run.start", runId: "run-catchup-1" });
    const e2 = makeEvent({ kind: "session.end" });
    node_fs.writeFileSync(jsonlPath, [JSON.stringify(e1), JSON.stringify(e2), ""].join("\n"));

    const count = catchUp(db, jsonlPath);
    expect(count).toBe(2);

    const row = db
      .prepare<unknown[], EventRow>("SELECT id, kind, session_key FROM events WHERE id = ?")
      .get(e1.id);
    expect(row).toBeTruthy();
  });

  it("resumes from last indexed position (does not re-index)", async () => {
    const db = await openMemoryDb();
    const jsonlPath = node_path.join(tmpDir, "events.jsonl");
    createIndexerFromDb(db, jsonlPath);

    const e1 = makeEvent({ kind: "run.start" });
    node_fs.writeFileSync(jsonlPath, JSON.stringify(e1) + "\n");

    // First catch-up
    const count1 = catchUp(db, jsonlPath);
    expect(count1).toBe(1);

    // Second catch-up — nothing new
    const count2 = catchUp(db, jsonlPath);
    expect(count2).toBe(0);

    // Append a new event
    const e2 = makeEvent({ kind: "session.end" });
    node_fs.appendFileSync(jsonlPath, JSON.stringify(e2) + "\n");

    // Third catch-up — only new event
    const count3 = catchUp(db, jsonlPath);
    expect(count3).toBe(1);
  });

  it("skips corrupt lines without failing", async () => {
    const db = await openMemoryDb();
    const jsonlPath = node_path.join(tmpDir, "events.jsonl");
    createIndexerFromDb(db, jsonlPath);

    const e1 = makeEvent({ kind: "run.start" });
    const badLine = "{corrupted json{{";
    const e2 = makeEvent({ kind: "session.end" });
    node_fs.writeFileSync(
      jsonlPath,
      [JSON.stringify(e1), badLine, JSON.stringify(e2), ""].join("\n"),
    );

    const count = catchUp(db, jsonlPath);
    // Should index the 2 valid events (skip the bad one)
    expect(count).toBe(2);
  });
});
