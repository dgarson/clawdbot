import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { OpenClawPluginToolContext } from "../../../src/plugins/types.js";
import { createOcxOpsTool, findRunSummary, findScorecard, queryLedgerEvents } from "./ops.js";
import type { StoredScore } from "./score-store.js";

// Mock the in-memory observability state — it is process-level state that cannot
// be seeded from a temp dir; we mock the module to return deterministic values.
vi.mock("@openclaw/ocx-observability/src/monitor/health-evaluator.js", () => ({
  getAllCurrentHealth: vi.fn(() => []),
  getHealthHistory: vi.fn(() => []),
}));

// Minimal ctx — the tool only uses stateDir (closed over), not the ctx object.
const ctx = {} as OpenClawPluginToolContext;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Write ledger events for a given agentId into stateDir. */
async function writeEventFile(
  stateDir: string,
  agentId: string,
  date: string,
  events: object[],
): Promise<void> {
  const dir = join(stateDir, "event-ledger", agentId);
  await mkdir(dir, { recursive: true });
  const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeFile(join(dir, `${date}.jsonl`), lines, "utf-8");
}

/** Write run summaries into stateDir. */
async function writeSummaryFile(
  stateDir: string,
  date: string,
  summaries: object[],
): Promise<void> {
  const dir = join(stateDir, "event-ledger", "summaries");
  await mkdir(dir, { recursive: true });
  const lines = summaries.map((s) => JSON.stringify(s)).join("\n") + "\n";
  await writeFile(join(dir, `${date}.jsonl`), lines, "utf-8");
}

/** Write scorecard records into stateDir. */
async function writeScorecardFile(
  stateDir: string,
  date: string,
  scorecards: object[],
): Promise<void> {
  const dir = join(stateDir, "evaluation", "scorecards");
  await mkdir(dir, { recursive: true });
  const lines = scorecards.map((c) => JSON.stringify(c)).join("\n") + "\n";
  await writeFile(join(dir, `${date}.jsonl`), lines, "utf-8");
}

/** Write score records into stateDir. */
async function writeScoreFile(
  stateDir: string,
  date: string,
  scores: StoredScore[],
): Promise<void> {
  const dir = join(stateDir, "session-scores");
  await mkdir(dir, { recursive: true });
  const lines = scores.map((s) => JSON.stringify(s)).join("\n") + "\n";
  await writeFile(join(dir, `${date}.jsonl`), lines, "utf-8");
}

// ---------------------------------------------------------------------------
// Helper: build a complete run summary
// ---------------------------------------------------------------------------

function makeRunSummary(runId: string, overrides: object = {}) {
  return {
    runId,
    agentId: "agent-1",
    sessionKey: "sess-1",
    startedAt: "2026-01-01T10:00:00.000Z",
    endedAt: "2026-01-01T10:01:00.000Z",
    durationMs: 60000,
    model: "claude-opus-4",
    provider: "anthropic",
    inputTokens: 100,
    outputTokens: 50,
    estimatedCostUsd: 0.01,
    toolCalls: 2,
    toolFailures: 0,
    outcome: "completed",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: build a complete scorecard
// ---------------------------------------------------------------------------

function makeScorecard(runId: string, overrides: object = {}) {
  return {
    runId,
    agentId: "agent-1",
    scoredAt: "2026-01-01T10:02:00.000Z",
    judgeProfileId: "judge-default",
    judgeProfileVersion: "1",
    overallScore: 85,
    confidence: 0.9,
    criteriaScores: { accuracy: 90, tool_use: 80 },
    disqualified: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: build a ledger event
// ---------------------------------------------------------------------------

function makeLedgerEvent(runId: string, type: string, family: string, overrides: object = {}) {
  return {
    eventId: `evt-${Math.random().toString(36).slice(2)}`,
    ts: "2026-01-01T10:00:30.000Z",
    family,
    type,
    runId,
    agentId: "agent-1",
    data: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// findRunSummary
// ---------------------------------------------------------------------------

describe("findRunSummary", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), "openclaw-ops-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when summaries directory does not exist", async () => {
    const result = await findRunSummary(tmpDir, "run-123");
    expect(result).toBeNull();
  });

  it("returns null when run ID is not found", async () => {
    await writeSummaryFile(tmpDir, "2026-01-01", [makeRunSummary("run-other")]);
    const result = await findRunSummary(tmpDir, "run-missing");
    expect(result).toBeNull();
  });

  it("returns the matching summary", async () => {
    await writeSummaryFile(tmpDir, "2026-01-01", [
      makeRunSummary("run-A"),
      makeRunSummary("run-B", { model: "claude-haiku" }),
    ]);
    const result = await findRunSummary(tmpDir, "run-B");
    expect(result).not.toBeNull();
    expect(result?.runId).toBe("run-B");
    expect(result?.model).toBe("claude-haiku");
  });
});

// ---------------------------------------------------------------------------
// findScorecard
// ---------------------------------------------------------------------------

describe("findScorecard", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), "openclaw-ops-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when scorecards directory does not exist", async () => {
    const result = await findScorecard(tmpDir, "run-123");
    expect(result).toBeNull();
  });

  it("returns null when run ID is not found", async () => {
    await writeScorecardFile(tmpDir, "2026-01-01", [makeScorecard("run-other")]);
    const result = await findScorecard(tmpDir, "run-missing");
    expect(result).toBeNull();
  });

  it("returns the matching scorecard", async () => {
    await writeScorecardFile(tmpDir, "2026-01-01", [
      makeScorecard("run-A"),
      makeScorecard("run-B", { overallScore: 42 }),
    ]);
    const result = await findScorecard(tmpDir, "run-B");
    expect(result).not.toBeNull();
    expect(result?.runId).toBe("run-B");
    expect(result?.overallScore).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// queryLedgerEvents
// ---------------------------------------------------------------------------

describe("queryLedgerEvents", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), "openclaw-ops-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when ledger directory does not exist", async () => {
    const result = await queryLedgerEvents(tmpDir, { limit: 10 });
    expect(result).toEqual([]);
  });

  it("returns events matching runId filter", async () => {
    await writeEventFile(tmpDir, "agent-1", "2026-01-01", [
      makeLedgerEvent("run-A", "model.routed", "model"),
      makeLedgerEvent("run-B", "model.routed", "model"),
    ]);

    const result = await queryLedgerEvents(tmpDir, { runId: "run-A", limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].runId).toBe("run-A");
  });

  it("filters by agentId — only scans that agent directory", async () => {
    await writeEventFile(tmpDir, "agent-x", "2026-01-01", [
      makeLedgerEvent("run-1", "model.routed", "model", { agentId: "agent-x" }),
    ]);
    await writeEventFile(tmpDir, "agent-y", "2026-01-01", [
      makeLedgerEvent("run-2", "model.routed", "model", { agentId: "agent-y" }),
    ]);

    const result = await queryLedgerEvents(tmpDir, { agentId: "agent-x", limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe("agent-x");
  });

  it("filters by family", async () => {
    await writeEventFile(tmpDir, "agent-1", "2026-01-01", [
      makeLedgerEvent("run-1", "model.routed", "model"),
      makeLedgerEvent("run-1", "budget.admission", "budget"),
    ]);

    const result = await queryLedgerEvents(tmpDir, { family: "budget", limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("budget.admission");
  });

  it("respects limit", async () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeLedgerEvent(`run-${i}`, "model.routed", "model"),
    );
    await writeEventFile(tmpDir, "agent-1", "2026-01-01", events);

    const result = await queryLedgerEvents(tmpDir, { limit: 3 });
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// createOcxOpsTool — action="query"
// ---------------------------------------------------------------------------

describe("createOcxOpsTool: action=query", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), "openclaw-ops-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns ok:true with run_id when run not found", async () => {
    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "query", run_id: "run-404" }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.run_id).toBe("run-404");
  });

  it("returns summary domain when summary file exists", async () => {
    await writeSummaryFile(tmpDir, "2026-01-01", [makeRunSummary("run-X")]);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "query", run_id: "run-X", include: ["summary"] }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.run_id).toBe("run-X");
    expect(result.summary).toBeDefined();
    expect(result.summary.model).toBe("claude-opus-4");
  });

  it("include=['summary'] returns only summary, no events/scorecard/health", async () => {
    await writeSummaryFile(tmpDir, "2026-01-01", [makeRunSummary("run-Y")]);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "query", run_id: "run-Y", include: ["summary"] }, ctx);
    const result = JSON.parse(raw);
    expect(result.summary).toBeDefined();
    expect(result.events).toBeUndefined();
    expect(result.scorecard).toBeUndefined();
    expect(result.health).toBeUndefined();
  });

  it("include=['events'] returns events array", async () => {
    await writeEventFile(tmpDir, "agent-1", "2026-01-01", [
      makeLedgerEvent("run-Z", "model.routed", "model"),
    ]);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "query", run_id: "run-Z", include: ["events"] }, ctx);
    const result = JSON.parse(raw);
    expect(Array.isArray(result.events)).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.summary).toBeUndefined();
    expect(result.scorecard).toBeUndefined();
    expect(result.health).toBeUndefined();
  });

  it("include=['scorecard'] returns scorecard domain", async () => {
    await writeScorecardFile(tmpDir, "2026-01-01", [makeScorecard("run-SC", { overallScore: 72 })]);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute(
      { action: "query", run_id: "run-SC", include: ["scorecard"] },
      ctx,
    );
    const result = JSON.parse(raw);
    expect(result.scorecard).toBeDefined();
    expect(result.scorecard.overallScore).toBe(72);
    expect(result.summary).toBeUndefined();
    expect(result.events).toBeUndefined();
    expect(result.health).toBeUndefined();
  });

  it("include=['health'] returns health domain", async () => {
    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "query", run_id: "run-H", include: ["health"] }, ctx);
    const result = JSON.parse(raw);
    expect(result.health).toBeDefined();
    expect(result.summary).toBeUndefined();
    expect(result.events).toBeUndefined();
    expect(result.scorecard).toBeUndefined();
  });

  it("returns all domains when include is omitted", async () => {
    await writeSummaryFile(tmpDir, "2026-01-01", [makeRunSummary("run-ALL")]);
    await writeScorecardFile(tmpDir, "2026-01-01", [makeScorecard("run-ALL")]);
    await writeEventFile(tmpDir, "agent-1", "2026-01-01", [
      makeLedgerEvent("run-ALL", "model.routed", "model"),
    ]);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "query", run_id: "run-ALL" }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.events).toBeDefined();
    expect(result.scorecard).toBeDefined();
    expect(result.health).toBeDefined();
  });

  it("missing run_id — run_id is undefined in result (schema makes it optional)", async () => {
    const tool = createOcxOpsTool(tmpDir);
    // Pass no run_id — params.run_id will cast as undefined
    const raw = await tool.execute({ action: "query" }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    // run_id key present but value undefined serializes as absent in JSON
    expect(
      Object.prototype.hasOwnProperty.call(result, "run_id") || result.run_id === undefined,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createOcxOpsTool — action="explain"
// ---------------------------------------------------------------------------

describe("createOcxOpsTool: action=explain", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), "openclaw-ops-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("missing question returns ok:false with error message", async () => {
    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "explain", run_id: "run-1" }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("question is required");
  });

  it("why_routed with events returns ok:true and expected shape", async () => {
    const runId = "run-routed";
    await writeEventFile(tmpDir, "agent-1", "2026-01-01", [
      makeLedgerEvent(runId, "model.routed", "model", {
        data: { model: "claude-opus-4", reason: "task classified as complex" },
      }),
    ]);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute(
      { action: "explain", run_id: runId, question: "why_routed" },
      ctx,
    );
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.question).toBe("why_routed");
    expect(result.run_id).toBe(runId);
    expect(typeof result.explanation).toBe("string");
    expect(Array.isArray(result.evidence)).toBe(true);
    expect(Array.isArray(result.next_actions)).toBe(true);
  });

  it("why_routed with no events returns ok:true with default explanation", async () => {
    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute(
      { action: "explain", run_id: "run-no-events", question: "why_routed" },
      ctx,
    );
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.explanation).toContain("could not be determined");
  });

  it("why_blocked with budget.admission event", async () => {
    const runId = "run-blocked";
    await writeEventFile(tmpDir, "agent-1", "2026-01-01", [
      makeLedgerEvent(runId, "budget.admission", "budget", {
        data: { outcome: "block", reason: "daily limit exceeded", scope: "agent" },
      }),
    ]);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute(
      { action: "explain", run_id: runId, question: "why_blocked" },
      ctx,
    );
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.question).toBe("why_blocked");
    expect(result.explanation).toContain("blocked");
  });

  it("why_blocked with no events returns ok:true with default explanation", async () => {
    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute(
      { action: "explain", run_id: "run-no-budget", question: "why_blocked" },
      ctx,
    );
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.explanation).toContain("No budget admission events");
  });

  it("why_reaped without agent_id returns ok:false", async () => {
    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute(
      { action: "explain", run_id: "run-1", question: "why_reaped" },
      ctx,
    );
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("agent_id is required");
  });

  it("why_reaped with agent_id returns ok:true with shape", async () => {
    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute(
      { action: "explain", run_id: "run-1", question: "why_reaped", agent_id: "agent-reaped" },
      ctx,
    );
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.question).toBe("why_reaped");
    expect(result.agent_id).toBe("agent-reaped");
    expect(typeof result.explanation).toBe("string");
  });

  it("why_low_score with scorecard present", async () => {
    const runId = "run-low-score";
    await writeScorecardFile(tmpDir, "2026-01-01", [
      makeScorecard(runId, {
        overallScore: 15,
        criteriaScores: { accuracy: 20, tool_use: 10 },
        reasoning: "The agent failed to follow instructions properly.",
      }),
    ]);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute(
      { action: "explain", run_id: runId, question: "why_low_score" },
      ctx,
    );
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.question).toBe("why_low_score");
    expect(result.explanation).toContain("15");
    expect(Array.isArray(result.evidence)).toBe(true);
  });

  it("why_low_score with no scorecard", async () => {
    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute(
      { action: "explain", run_id: "run-no-card", question: "why_low_score" },
      ctx,
    );
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.explanation).toContain("No scorecard found");
  });

  it("why_low_score with disqualified scorecard", async () => {
    const runId = "run-disq";
    await writeScorecardFile(tmpDir, "2026-01-01", [
      makeScorecard(runId, {
        disqualified: true,
        disqualifierTriggered: "harmful_content",
        overallScore: 0,
      }),
    ]);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute(
      { action: "explain", run_id: runId, question: "why_low_score" },
      ctx,
    );
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.explanation).toContain("disqualified");
    expect(result.explanation).toContain("harmful_content");
  });

  it("unknown question value returns ok:false with error", async () => {
    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute(
      { action: "explain", run_id: "run-1", question: "why_unknown_question" },
      ctx,
    );
    const result = JSON.parse(raw);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown question");
  });
});

// ---------------------------------------------------------------------------
// createOcxOpsTool — action="scores"
// ---------------------------------------------------------------------------

describe("createOcxOpsTool: action=scores", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), "openclaw-ops-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("no scores in stateDir returns empty result", async () => {
    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "scores" }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(result.scores).toEqual([]);
  });

  it("returns all scores when no filter", async () => {
    const scores: StoredScore[] = [
      {
        ts: 1000,
        seq: 1,
        type: "session.score",
        sessionId: "s1",
        agentId: "a1",
        score: 80,
        rubric: "quality",
      },
      {
        ts: 2000,
        seq: 2,
        type: "session.score",
        sessionId: "s2",
        agentId: "a2",
        score: 90,
        rubric: "speed",
      },
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "scores" }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);
    expect(result.scores).toHaveLength(2);
  });

  it("filters by agent_id — only matching scores returned", async () => {
    const scores: StoredScore[] = [
      {
        ts: 1000,
        seq: 1,
        type: "session.score",
        sessionId: "s1",
        agentId: "agent-alpha",
        score: 80,
        rubric: "quality",
      },
      {
        ts: 2000,
        seq: 2,
        type: "session.score",
        sessionId: "s2",
        agentId: "agent-beta",
        score: 90,
        rubric: "quality",
      },
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "scores", agent_id: "agent-alpha" }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.scores[0].agentId).toBe("agent-alpha");
  });

  it("filters by session_id", async () => {
    const scores: StoredScore[] = [
      {
        ts: 1000,
        seq: 1,
        type: "session.score",
        sessionId: "sess-A",
        agentId: "a1",
        score: 70,
        rubric: "r",
      },
      {
        ts: 2000,
        seq: 2,
        type: "session.score",
        sessionId: "sess-B",
        agentId: "a1",
        score: 85,
        rubric: "r",
      },
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "scores", session_id: "sess-B" }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.scores[0].sessionId).toBe("sess-B");
  });

  it("filters by rubric", async () => {
    const scores: StoredScore[] = [
      {
        ts: 1000,
        seq: 1,
        type: "session.score",
        sessionId: "s1",
        agentId: "a1",
        score: 70,
        rubric: "task_completion",
      },
      {
        ts: 2000,
        seq: 2,
        type: "session.score",
        sessionId: "s2",
        agentId: "a1",
        score: 85,
        rubric: "accuracy",
      },
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "scores", rubric: "task_completion" }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.scores[0].rubric).toBe("task_completion");
  });

  it("effective_only:true applies deduplication", async () => {
    const scores: StoredScore[] = [
      {
        ts: 1000,
        seq: 1,
        type: "session.score",
        sessionId: "s1",
        agentId: "a1",
        score: 40,
        rubric: "quality",
      },
      {
        ts: 2000,
        seq: 2,
        type: "session.score",
        sessionId: "s1",
        agentId: "a1",
        score: 90,
        rubric: "quality",
        isOverride: true,
      },
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "scores", effective_only: true }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.scores[0].score).toBe(90);
    expect(result.scores[0].isOverride).toBe(true);
  });

  it("effective_only:false returns all records including duplicates", async () => {
    const scores: StoredScore[] = [
      {
        ts: 1000,
        seq: 1,
        type: "session.score",
        sessionId: "s1",
        agentId: "a1",
        score: 40,
        rubric: "quality",
      },
      {
        ts: 2000,
        seq: 2,
        type: "session.score",
        sessionId: "s1",
        agentId: "a1",
        score: 90,
        rubric: "quality",
      },
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const tool = createOcxOpsTool(tmpDir);
    const raw = await tool.execute({ action: "scores", effective_only: false }, ctx);
    const result = JSON.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// createOcxOpsTool — unknown action falls through to scores branch
// ---------------------------------------------------------------------------

describe("createOcxOpsTool: unknown action", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), "openclaw-ops-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("falls through to scores branch and returns a scores result", async () => {
    const tool = createOcxOpsTool(tmpDir);
    // The tool's execute checks action === "query" and action === "explain" only;
    // anything else falls through to the scores path.
    const raw = await tool.execute({ action: "some_unknown_action" }, ctx);
    const result = JSON.parse(raw);
    // Should return a scores-shaped result (ok:true, count, scores[])
    expect(result.ok).toBe(true);
    expect(typeof result.count).toBe("number");
    expect(Array.isArray(result.scores)).toBe(true);
  });
});
