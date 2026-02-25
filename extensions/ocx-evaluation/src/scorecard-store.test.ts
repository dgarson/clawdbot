import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ScorecardStore } from "./scorecard-store.js";
import type { Scorecard } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScorecard(overrides?: Partial<Scorecard>): Scorecard {
  return {
    runId: "run-" + Math.random().toString(36).slice(2, 8),
    agentId: "agent-1",
    sessionKey: "sess-1",
    judgeProfileId: "judge-1",
    judgeProfileVersion: 1,
    overallScore: 75,
    criteriaScores: { response_time: 80 },
    confidence: 0.9,
    disqualified: false,
    scoredAt: "2026-02-20T12:00:00.000Z",
    model: "gpt-4.1",
    provider: "openai",
    classificationLabel: "coding",
    costUsd: 0.01,
    totalTokens: 1000,
    durationMs: 5000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("ScorecardStore", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-scorecard-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("append and query scorecards", () => {
    const store = new ScorecardStore(tmpDir);

    const card1 = makeScorecard({ runId: "run-1", agentId: "a1" });
    const card2 = makeScorecard({ runId: "run-2", agentId: "a2" });
    store.append(card1);
    store.append(card2);

    // Query all
    const all = store.query({});
    expect(all).toHaveLength(2);

    // Query by agentId
    const filtered = store.query({ agentId: "a1" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.runId).toBe("run-1");

    // Query by runId
    const byRun = store.query({ runId: "run-2" });
    expect(byRun).toHaveLength(1);
    expect(byRun[0]!.agentId).toBe("a2");
  });

  test("query respects limit", () => {
    const store = new ScorecardStore(tmpDir);
    for (let i = 0; i < 5; i++) {
      store.append(makeScorecard({ runId: `run-${i}` }));
    }

    const limited = store.query({ limit: 2 });
    expect(limited).toHaveLength(2);
  });

  test("query filters by model", () => {
    const store = new ScorecardStore(tmpDir);
    store.append(makeScorecard({ runId: "r1", model: "gpt-4.1" }));
    store.append(makeScorecard({ runId: "r2", model: "claude-sonnet-4" }));

    const results = store.query({ model: "claude-sonnet-4" });
    expect(results).toHaveLength(1);
    expect(results[0]!.runId).toBe("r2");
  });

  test("human override updates scorecard", () => {
    const store = new ScorecardStore(tmpDir);
    const card = makeScorecard({ runId: "run-override" });
    store.append(card);

    const updated = store.updateByRunId("run-override", (c) => ({
      ...c,
      humanOverride: {
        overrideScore: 95,
        annotator: "alice",
        reason: "Actually excellent",
        overriddenAt: new Date().toISOString(),
      },
    }));

    expect(updated).toBe(true);

    const retrieved = store.getByRunId("run-override");
    expect(retrieved).toBeDefined();
    expect(retrieved!.humanOverride).toBeDefined();
    expect(retrieved!.humanOverride!.overrideScore).toBe(95);
    expect(retrieved!.humanOverride!.annotator).toBe("alice");
    expect(retrieved!.humanOverride!.reason).toBe("Actually excellent");
  });

  test("human override returns false for missing run", () => {
    const store = new ScorecardStore(tmpDir);

    const updated = store.updateByRunId("nonexistent", (c) => ({
      ...c,
      humanOverride: {
        overrideScore: 50,
        annotator: "bob",
        reason: "test",
        overriddenAt: new Date().toISOString(),
      },
    }));

    expect(updated).toBe(false);
  });

  test("hasScorecard returns true for existing, false for missing", () => {
    const store = new ScorecardStore(tmpDir);
    store.append(makeScorecard({ runId: "run-exists" }));

    expect(store.hasScorecard("run-exists")).toBe(true);
    expect(store.hasScorecard("run-nope")).toBe(false);
  });

  test("getByRunId returns the scorecard", () => {
    const store = new ScorecardStore(tmpDir);
    const card = makeScorecard({ runId: "run-get", overallScore: 42 });
    store.append(card);

    const retrieved = store.getByRunId("run-get");
    expect(retrieved).toBeDefined();
    expect(retrieved!.overallScore).toBe(42);
  });

  test("getByRunId returns undefined for missing run", () => {
    const store = new ScorecardStore(tmpDir);
    expect(store.getByRunId("nope")).toBeUndefined();
  });

  test("scorecards persist across store instances", () => {
    const store1 = new ScorecardStore(tmpDir);
    store1.append(makeScorecard({ runId: "run-persist" }));

    // Create a new store instance pointing at the same directory
    const store2 = new ScorecardStore(tmpDir);
    const results = store2.query({ runId: "run-persist" });
    expect(results).toHaveLength(1);
  });

  test("date-partitioned files: different scoredAt dates go to different files", () => {
    const store = new ScorecardStore(tmpDir);
    store.append(makeScorecard({ runId: "r-day1", scoredAt: "2026-02-20T10:00:00.000Z" }));
    store.append(makeScorecard({ runId: "r-day2", scoredAt: "2026-02-21T10:00:00.000Z" }));

    // Check that two files were created
    const scorecardDir = path.join(tmpDir, "evaluation", "scorecards");
    const files = fs.readdirSync(scorecardDir).filter((f) => f.endsWith(".jsonl"));
    expect(files).toHaveLength(2);
    expect(files).toContain("2026-02-20.jsonl");
    expect(files).toContain("2026-02-21.jsonl");

    // Query across both dates
    const all = store.query({});
    expect(all).toHaveLength(2);
  });
});
