import { describe, expect, test, vi, beforeEach } from "vitest";
import { queryEvents, getRunSummary } from "./query.js";
import type { EventEnvelope, RunSummary } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    eventId: `${Date.now()}-${Math.random()}`,
    ts: new Date().toISOString(),
    version: 1,
    family: "tool",
    type: "tool.invoked",
    runId: "run-1",
    data: {},
    ...overrides,
  };
}

function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    runId: "run-1",
    agentId: "agent-1",
    sessionKey: "session-1",
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock storage builder
// ---------------------------------------------------------------------------

type MockStorage = {
  listAgentIds: () => Promise<string[]>;
  listDays: (agentId: string) => Promise<string[]>;
  readDayEvents: (agentId: string, day: string) => Promise<EventEnvelope[]>;
  listSummaryDays: () => Promise<string[]>;
  readDaySummaries: (day: string) => Promise<RunSummary[]>;
};

function createMockStorage(data: {
  agents?: Record<string, Record<string, EventEnvelope[]>>;
  summaries?: Record<string, RunSummary[]>;
}): MockStorage {
  const agents = data.agents ?? {};
  const summaries = data.summaries ?? {};

  return {
    listAgentIds: vi.fn(async () => Object.keys(agents).sort()),
    listDays: vi.fn(async (agentId: string) => {
      const agentData = agents[agentId];
      return agentData ? Object.keys(agentData).sort() : [];
    }),
    readDayEvents: vi.fn(async (agentId: string, day: string) => {
      return agents[agentId]?.[day] ?? [];
    }),
    listSummaryDays: vi.fn(async () => Object.keys(summaries).sort()),
    readDaySummaries: vi.fn(async (day: string) => {
      return summaries[day] ?? [];
    }),
  };
}

// ---------------------------------------------------------------------------
// queryEvents tests
// ---------------------------------------------------------------------------

describe("queryEvents", () => {
  test("returns all events when no filter is set", async () => {
    const events = [
      makeEvent({ eventId: "e1", family: "tool", type: "tool.invoked" }),
      makeEvent({ eventId: "e2", family: "model", type: "model.resolve" }),
    ];
    const storage = createMockStorage({
      agents: { agent1: { "2026-02-24": events } },
    });

    const result = await queryEvents(storage as never, {});
    expect(result.events).toHaveLength(2);
    expect(result.nextCursor).toBeUndefined();
  });

  test("filters by family", async () => {
    const events = [
      makeEvent({ eventId: "e1", family: "tool", type: "tool.invoked" }),
      makeEvent({ eventId: "e2", family: "model", type: "model.resolve" }),
      makeEvent({ eventId: "e3", family: "tool", type: "tool.completed" }),
    ];
    const storage = createMockStorage({
      agents: { agent1: { "2026-02-24": events } },
    });

    const result = await queryEvents(storage as never, { family: "tool" });
    expect(result.events).toHaveLength(2);
    expect(result.events.every((e) => e.family === "tool")).toBe(true);
  });

  test("filters by type", async () => {
    const events = [
      makeEvent({ eventId: "e1", type: "tool.invoked" }),
      makeEvent({ eventId: "e2", type: "tool.completed" }),
    ];
    const storage = createMockStorage({
      agents: { agent1: { "2026-02-24": events } },
    });

    const result = await queryEvents(storage as never, { type: "tool.invoked" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.type).toBe("tool.invoked");
  });

  test("filters by runId", async () => {
    const events = [
      makeEvent({ eventId: "e1", runId: "run-A" }),
      makeEvent({ eventId: "e2", runId: "run-B" }),
      makeEvent({ eventId: "e3", runId: "run-A" }),
    ];
    const storage = createMockStorage({
      agents: { agent1: { "2026-02-24": events } },
    });

    const result = await queryEvents(storage as never, { runId: "run-A" });
    expect(result.events).toHaveLength(2);
    expect(result.events.every((e) => e.runId === "run-A")).toBe(true);
  });

  test("filters by agentId (only scans that agent directory)", async () => {
    const storage = createMockStorage({
      agents: {
        agent1: { "2026-02-24": [makeEvent({ eventId: "e1", agentId: "agent1" })] },
        agent2: { "2026-02-24": [makeEvent({ eventId: "e2", agentId: "agent2" })] },
      },
    });

    const result = await queryEvents(storage as never, { agentId: "agent1" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.eventId).toBe("e1");
    // listAgentIds should not be called when agentId is specified
    expect(storage.listAgentIds).not.toHaveBeenCalled();
  });

  test("filters by time range (from/to)", async () => {
    const events = [
      makeEvent({ eventId: "e1", ts: "2026-02-24T08:00:00.000Z" }),
      makeEvent({ eventId: "e2", ts: "2026-02-24T12:00:00.000Z" }),
      makeEvent({ eventId: "e3", ts: "2026-02-24T18:00:00.000Z" }),
    ];
    const storage = createMockStorage({
      agents: { agent1: { "2026-02-24": events } },
    });

    const result = await queryEvents(storage as never, {
      from: "2026-02-24T10:00:00.000Z",
      to: "2026-02-24T14:00:00.000Z",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.eventId).toBe("e2");
  });

  test("respects limit and returns nextCursor", async () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ eventId: `e${i}`, ts: `2026-02-24T10:0${i}:00.000Z` }),
    );
    const storage = createMockStorage({
      agents: { agent1: { "2026-02-24": events } },
    });

    const result = await queryEvents(storage as never, { limit: 3 });
    expect(result.events).toHaveLength(3);
    expect(result.nextCursor).toBeDefined();
  });

  test("pagination cursor resumes from correct position", async () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ eventId: `e${i}`, ts: `2026-02-24T10:0${i}:00.000Z` }),
    );
    const storage = createMockStorage({
      agents: { agent1: { "2026-02-24": events } },
    });

    // First page
    const page1 = await queryEvents(storage as never, { limit: 2 });
    expect(page1.events).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();
    expect(page1.events[0]!.eventId).toBe("e0");
    expect(page1.events[1]!.eventId).toBe("e1");

    // Second page using cursor
    const page2 = await queryEvents(storage as never, { limit: 2, cursor: page1.nextCursor });
    expect(page2.events).toHaveLength(2);
    expect(page2.events[0]!.eventId).toBe("e2");
    expect(page2.events[1]!.eventId).toBe("e3");

    // Third page
    const page3 = await queryEvents(storage as never, { limit: 2, cursor: page2.nextCursor });
    expect(page3.events).toHaveLength(1);
    expect(page3.events[0]!.eventId).toBe("e4");
    expect(page3.nextCursor).toBeUndefined();
  });

  test("returns empty result when no events match", async () => {
    const storage = createMockStorage({
      agents: { agent1: { "2026-02-24": [] } },
    });

    const result = await queryEvents(storage as never, { family: "tool" });
    expect(result.events).toHaveLength(0);
    expect(result.nextCursor).toBeUndefined();
  });

  test("scans multiple agent directories when agentId not specified", async () => {
    const storage = createMockStorage({
      agents: {
        agent1: { "2026-02-24": [makeEvent({ eventId: "e1" })] },
        agent2: { "2026-02-24": [makeEvent({ eventId: "e2" })] },
      },
    });

    const result = await queryEvents(storage as never, {});
    expect(result.events).toHaveLength(2);
  });

  test("day-level filtering skips out-of-range days", async () => {
    const storage = createMockStorage({
      agents: {
        agent1: {
          "2026-02-20": [makeEvent({ eventId: "old", ts: "2026-02-20T10:00:00.000Z" })],
          "2026-02-24": [makeEvent({ eventId: "new", ts: "2026-02-24T10:00:00.000Z" })],
        },
      },
    });

    const result = await queryEvents(storage as never, { from: "2026-02-23T00:00:00.000Z" });
    // Only the 2026-02-24 day file should be scanned
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.eventId).toBe("new");
  });
});

// ---------------------------------------------------------------------------
// getRunSummary tests
// ---------------------------------------------------------------------------

describe("getRunSummary", () => {
  test("returns matching summary by runId", async () => {
    const summary = makeSummary({ runId: "run-42" });
    const storage = createMockStorage({
      summaries: { "2026-02-24": [summary] },
    });

    const result = await getRunSummary(storage as never, "run-42");
    expect(result).not.toBeNull();
    expect(result!.runId).toBe("run-42");
    expect(result!.model).toBe("gpt-4");
  });

  test("returns null when runId not found", async () => {
    const storage = createMockStorage({
      summaries: { "2026-02-24": [makeSummary({ runId: "other" })] },
    });

    const result = await getRunSummary(storage as never, "missing");
    expect(result).toBeNull();
  });

  test("searches most recent day first", async () => {
    const oldSummary = makeSummary({ runId: "run-1", model: "old-model" });
    const newSummary = makeSummary({ runId: "run-1", model: "new-model" });
    const storage = createMockStorage({
      summaries: {
        "2026-02-20": [oldSummary],
        "2026-02-24": [newSummary],
      },
    });

    const result = await getRunSummary(storage as never, "run-1");
    expect(result).not.toBeNull();
    // Should find the most recent one first (reverse chronological scan)
    expect(result!.model).toBe("new-model");
  });

  test("returns null when no summary files exist", async () => {
    const storage = createMockStorage({ summaries: {} });
    const result = await getRunSummary(storage as never, "any");
    expect(result).toBeNull();
  });
});
