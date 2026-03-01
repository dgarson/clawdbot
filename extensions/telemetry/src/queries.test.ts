import { describe, expect, it } from "vitest";
import type BetterSqlite3 from "better-sqlite3";
import { createIndexerFromDb, indexEvent } from "./indexer.js";
import {
  listRuns,
  getRun,
  getToolCalls,
  getSessionTimeline,
  getUsageSummary,
  listEvents,
  getFileOperations,
} from "./queries.js";
import type { TelemetryEvent } from "./types.js";

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

async function openMemoryDb(): Promise<BetterSqlite3.Database> {
  const mod = await import("better-sqlite3");
  const Database = mod.default ?? mod;
  return new Database(":memory:");
}

let _seq = 0;
function makeEvent(overrides: Partial<TelemetryEvent> = {}): TelemetryEvent {
  return {
    id: `evt_${(++_seq).toString().padStart(16, "0")}`,
    ts: 1_700_000_000_000 + _seq * 1000,
    seq: _seq,
    agentId: "agent-test",
    sessionKey: "sess-test",
    sessionId: "sid-test",
    kind: "session.start",
    data: {},
    source: "hook",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// listRuns
// ---------------------------------------------------------------------------

describe("listRuns", () => {
  it("returns empty array when no runs exist", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");
    expect(listRuns(db)).toEqual([]);
  });

  it("returns all runs ordered by started_at desc", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(db, makeEvent({ kind: "run.start", runId: "r1", ts: 1000, sessionKey: "s1" }));
    indexEvent(db, makeEvent({ kind: "run.start", runId: "r2", ts: 2000, sessionKey: "s1" }));
    indexEvent(db, makeEvent({ kind: "run.start", runId: "r3", ts: 3000, sessionKey: "s2" }));

    const runs = listRuns(db);
    expect(runs.length).toBe(3);
    expect(runs[0].runId).toBe("r3"); // Most recent first
  });

  it("filters by sessionKey", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(db, makeEvent({ kind: "run.start", runId: "r1", sessionKey: "s1" }));
    indexEvent(db, makeEvent({ kind: "run.start", runId: "r2", sessionKey: "s2" }));

    const runs = listRuns(db, { sessionKey: "s1" });
    expect(runs.length).toBe(1);
    expect(runs[0].runId).toBe("r1");
  });

  it("respects limit and offset", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    for (let i = 0; i < 5; i++) {
      indexEvent(db, makeEvent({ kind: "run.start", runId: `run-${i}` }));
    }

    const page1 = listRuns(db, { limit: 2, offset: 0 });
    const page2 = listRuns(db, { limit: 2, offset: 2 });
    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    // Ensure no overlap
    const ids1 = page1.map((r) => r.runId);
    const ids2 = page2.map((r) => r.runId);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it("filters by since", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(db, makeEvent({ kind: "run.start", runId: "old", ts: 1000 }));
    indexEvent(db, makeEvent({ kind: "run.start", runId: "new", ts: 5000 }));

    const runs = listRuns(db, { since: 3000 });
    expect(runs.length).toBe(1);
    expect(runs[0].runId).toBe("new");
  });
});

// ---------------------------------------------------------------------------
// getRun
// ---------------------------------------------------------------------------

describe("getRun", () => {
  it("returns undefined for unknown runId", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");
    expect(getRun(db, "nope")).toBeUndefined();
  });

  it("returns run detail with nested tool calls and model calls", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(
      db,
      makeEvent({
        kind: "run.start",
        runId: "r-detail",
        sessionKey: "s-detail",
        data: { model: "claude-opus-4", provider: "anthropic" },
      }),
    );

    indexEvent(
      db,
      makeEvent({
        kind: "tool.start",
        runId: "r-detail",
        data: { toolName: "Read", toolCallId: "tc-1", filePath: "/src/app.ts" },
      }),
    );

    indexEvent(
      db,
      makeEvent({
        kind: "llm.call",
        runId: "r-detail",
        data: {
          callIndex: 0,
          provider: "anthropic",
          model: "claude-opus-4",
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
        },
      }),
    );

    const detail = getRun(db, "r-detail");
    expect(detail).toBeTruthy();
    expect(detail!.runId).toBe("r-detail");
    expect(detail!.model).toBe("claude-opus-4");
    expect(detail!.toolCalls.length).toBe(1);
    expect(detail!.toolCalls[0].toolName).toBe("Read");
    expect(detail!.modelCalls.length).toBe(1);
    expect(detail!.modelCalls[0].inputTokens).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// getToolCalls
// ---------------------------------------------------------------------------

describe("getToolCalls", () => {
  it("filters by toolName", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(db, makeEvent({ kind: "tool.start", runId: "r1", data: { toolName: "Read" } }));
    indexEvent(db, makeEvent({ kind: "tool.start", runId: "r1", data: { toolName: "Write" } }));
    indexEvent(db, makeEvent({ kind: "tool.start", runId: "r1", data: { toolName: "Read" } }));

    const reads = getToolCalls(db, { toolName: "Read" });
    expect(reads.length).toBe(2);
    expect(reads.every((t) => t.toolName === "Read")).toBe(true);
  });

  it("filters by runId", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(db, makeEvent({ kind: "tool.start", runId: "r-a", data: { toolName: "Bash" } }));
    indexEvent(db, makeEvent({ kind: "tool.start", runId: "r-b", data: { toolName: "Bash" } }));

    const calls = getToolCalls(db, { runId: "r-a" });
    expect(calls.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getSessionTimeline
// ---------------------------------------------------------------------------

describe("getSessionTimeline", () => {
  it("returns events for session ordered by ts", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(db, makeEvent({ kind: "run.start", ts: 100, sessionKey: "s1", runId: "r1" }));
    indexEvent(db, makeEvent({ kind: "tool.start", ts: 200, sessionKey: "s1", runId: "r1" }));
    indexEvent(db, makeEvent({ kind: "run.end", ts: 300, sessionKey: "s1", runId: "r1" }));
    // Different session — should not appear
    indexEvent(db, makeEvent({ kind: "run.start", ts: 150, sessionKey: "s2", runId: "r2" }));

    const timeline = getSessionTimeline(db, "s1");
    expect(timeline.length).toBe(3);
    expect(timeline[0].kind).toBe("run.start");
    expect(timeline[2].kind).toBe("run.end");
  });

  it("filters by kinds", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(db, makeEvent({ kind: "run.start", sessionKey: "s1" }));
    indexEvent(db, makeEvent({ kind: "tool.start", sessionKey: "s1" }));
    indexEvent(db, makeEvent({ kind: "message.inbound", sessionKey: "s1", data: { from: "u" } }));

    const tools = getSessionTimeline(db, "s1", { kinds: ["tool.start"] });
    expect(tools.length).toBe(1);
    expect(tools[0].kind).toBe("tool.start");
  });
});

// ---------------------------------------------------------------------------
// getUsageSummary
// ---------------------------------------------------------------------------

describe("getUsageSummary", () => {
  it("returns zeros for empty database", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");
    const summary = getUsageSummary(db);
    expect(summary.totalRuns).toBe(0);
    expect(summary.totalTokens).toBe(0);
  });

  it("aggregates token counts across runs", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    // Two run.starts with corresponding run.ends
    indexEvent(db, makeEvent({ kind: "run.start", runId: "u1", sessionKey: "su" }));
    indexEvent(
      db,
      makeEvent({
        kind: "run.end",
        runId: "u1",
        sessionKey: "su",
        data: { usage: { input: 100, output: 200, total: 300 }, toolCallCount: 2 },
      }),
    );
    indexEvent(db, makeEvent({ kind: "run.start", runId: "u2", sessionKey: "su" }));
    indexEvent(
      db,
      makeEvent({
        kind: "run.end",
        runId: "u2",
        sessionKey: "su",
        data: { usage: { input: 50, output: 100, total: 150 }, toolCallCount: 1 },
      }),
    );

    const summary = getUsageSummary(db);
    expect(summary.totalRuns).toBe(2);
    expect(summary.inputTokens).toBe(150);
    expect(summary.outputTokens).toBe(300);
    expect(summary.totalTokens).toBe(450);
    expect(summary.toolCallCount).toBe(3);
  });

  it("filters by sessionKey", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(db, makeEvent({ kind: "run.start", runId: "sa1", sessionKey: "sa" }));
    indexEvent(
      db,
      makeEvent({
        kind: "run.end",
        runId: "sa1",
        sessionKey: "sa",
        data: { usage: { input: 100, output: 200, total: 300 } },
      }),
    );
    indexEvent(db, makeEvent({ kind: "run.start", runId: "sb1", sessionKey: "sb" }));
    indexEvent(
      db,
      makeEvent({
        kind: "run.end",
        runId: "sb1",
        sessionKey: "sb",
        data: { usage: { input: 999, output: 999, total: 1998 } },
      }),
    );

    const summary = getUsageSummary(db, { sessionKey: "sa" });
    expect(summary.totalRuns).toBe(1);
    expect(summary.totalTokens).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// listEvents
// ---------------------------------------------------------------------------

describe("listEvents", () => {
  it("returns events ordered by ts desc", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(db, makeEvent({ kind: "run.start", ts: 1000, sessionKey: "ev" }));
    indexEvent(db, makeEvent({ kind: "tool.start", ts: 2000, sessionKey: "ev" }));

    const events = listEvents(db);
    expect(events.length).toBeGreaterThanOrEqual(2);
    // Most recent first
    expect(events[0].ts).toBeGreaterThanOrEqual(events[1].ts);
  });

  it("filters by kind", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(db, makeEvent({ kind: "run.start" }));
    indexEvent(db, makeEvent({ kind: "tool.start" }));
    indexEvent(db, makeEvent({ kind: "tool.start" }));

    const tools = listEvents(db, { kind: "tool.start" });
    expect(tools.length).toBe(2);
    expect(tools.every((e) => e.kind === "tool.start")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getFileOperations
// ---------------------------------------------------------------------------

describe("getFileOperations", () => {
  it("returns only tool calls with a file_path", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(
      db,
      makeEvent({
        kind: "tool.start",
        runId: "r-files",
        data: { toolName: "Read", toolCallId: "tc-r1", filePath: "/src/foo.ts" },
      }),
    );
    // Tool call without file path
    indexEvent(
      db,
      makeEvent({
        kind: "tool.start",
        runId: "r-files",
        data: { toolName: "Bash", toolCallId: "tc-bash" },
      }),
    );

    const ops = getFileOperations(db, { runId: "r-files" });
    expect(ops.length).toBe(1);
    expect(ops[0].filePath).toBe("/src/foo.ts");
    expect(ops[0].toolName).toBe("Read");
  });

  it("filters by filePath substring", async () => {
    const db = await openMemoryDb();
    createIndexerFromDb(db, ":none:");

    indexEvent(
      db,
      makeEvent({
        kind: "tool.start",
        data: { toolName: "Write", filePath: "/src/components/Button.tsx" },
      }),
    );
    indexEvent(
      db,
      makeEvent({
        kind: "tool.start",
        data: { toolName: "Read", filePath: "/src/utils/helpers.ts" },
      }),
    );

    const ops = getFileOperations(db, { filePath: "components" });
    expect(ops.length).toBe(1);
    expect(ops[0].filePath).toContain("components");
  });
});
