import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appendScore, queryScores } from "./score-store.js";
import type { StoredScore } from "./score-store.js";

// Helper to build a minimal StoredScore for tests.
function makeScore(overrides: Partial<StoredScore> = {}): StoredScore {
  return {
    ts: Date.now(),
    seq: 1,
    type: "session.score",
    sessionId: "sess-1",
    agentId: "agent-1",
    score: 80,
    rubric: "task_completion",
    ...overrides,
  };
}

// Helper to write score lines directly into the stateDir, bypassing appendScore
// date logic. Useful for multi-file tests with controlled dates.
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

describe("score-store: queryScores", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), "openclaw-score-store-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when directory does not exist", async () => {
    const result = await queryScores(tmpDir, {});
    expect(result).toEqual([]);
  });

  it("returns all records when no filter applied", async () => {
    const scores = [
      makeScore({ ts: 1000, sessionId: "s1", agentId: "a1", rubric: "quality" }),
      makeScore({ ts: 2000, sessionId: "s2", agentId: "a2", rubric: "speed" }),
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const result = await queryScores(tmpDir, {});
    expect(result).toHaveLength(2);
  });

  it("filters by agentId", async () => {
    const scores = [
      makeScore({ ts: 1000, agentId: "agent-alpha", sessionId: "s1", rubric: "r" }),
      makeScore({ ts: 2000, agentId: "agent-beta", sessionId: "s2", rubric: "r" }),
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const result = await queryScores(tmpDir, { agentId: "agent-alpha" });
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe("agent-alpha");
  });

  it("filters by sessionId", async () => {
    const scores = [
      makeScore({ ts: 1000, sessionId: "session-A", agentId: "a1", rubric: "r" }),
      makeScore({ ts: 2000, sessionId: "session-B", agentId: "a1", rubric: "r" }),
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const result = await queryScores(tmpDir, { sessionId: "session-B" });
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("session-B");
  });

  it("filters by rubric", async () => {
    const scores = [
      makeScore({ ts: 1000, rubric: "task_completion", sessionId: "s1" }),
      makeScore({ ts: 2000, rubric: "accuracy", sessionId: "s1" }),
      makeScore({ ts: 3000, rubric: "task_completion", sessionId: "s2" }),
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const result = await queryScores(tmpDir, { rubric: "task_completion" });
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.rubric === "task_completion")).toBe(true);
  });

  it("filters by agentId and rubric in combination", async () => {
    const scores = [
      makeScore({ ts: 1000, agentId: "agent-x", rubric: "accuracy", sessionId: "s1" }),
      makeScore({ ts: 2000, agentId: "agent-y", rubric: "accuracy", sessionId: "s2" }),
      makeScore({ ts: 3000, agentId: "agent-x", rubric: "speed", sessionId: "s3" }),
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const result = await queryScores(tmpDir, { agentId: "agent-x", rubric: "accuracy" });
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe("agent-x");
    expect(result[0].rubric).toBe("accuracy");
  });

  it("filters by sessionId and rubric in combination", async () => {
    const scores = [
      makeScore({ ts: 1000, sessionId: "s1", rubric: "quality", agentId: "a1" }),
      makeScore({ ts: 2000, sessionId: "s1", rubric: "speed", agentId: "a1" }),
      makeScore({ ts: 3000, sessionId: "s2", rubric: "quality", agentId: "a1" }),
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const result = await queryScores(tmpDir, { sessionId: "s1", rubric: "quality" });
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("s1");
    expect(result[0].rubric).toBe("quality");
  });

  it("respects limit", async () => {
    const scores = [
      makeScore({ ts: 1000, sessionId: "s1", rubric: "r" }),
      makeScore({ ts: 2000, sessionId: "s2", rubric: "r" }),
      makeScore({ ts: 3000, sessionId: "s3", rubric: "r" }),
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const result = await queryScores(tmpDir, { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it("returns results sorted newest-first", async () => {
    const scores = [
      makeScore({ ts: 1000, sessionId: "s1", rubric: "r" }),
      makeScore({ ts: 3000, sessionId: "s2", rubric: "r" }),
      makeScore({ ts: 2000, sessionId: "s3", rubric: "r" }),
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const result = await queryScores(tmpDir, {});
    expect(result[0].ts).toBe(3000);
    expect(result[1].ts).toBe(2000);
    expect(result[2].ts).toBe(1000);
  });

  it("effectiveOnly: true returns only the latest record per (sessionId, rubric) pair", async () => {
    const scores = [
      makeScore({ ts: 1000, sessionId: "s1", rubric: "quality", score: 50 }),
      makeScore({ ts: 3000, sessionId: "s1", rubric: "quality", score: 90 }), // newer — should win
      makeScore({ ts: 2000, sessionId: "s1", rubric: "speed", score: 70 }),
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const result = await queryScores(tmpDir, { effectiveOnly: true });
    // Should have 2 unique pairs: (s1, quality) and (s1, speed)
    expect(result).toHaveLength(2);

    const qualityScore = result.find((s) => s.rubric === "quality");
    expect(qualityScore?.score).toBe(90); // the newer record wins
    expect(qualityScore?.ts).toBe(3000);
  });

  it("effectiveOnly: true excludes older records with same (sessionId, rubric) pair", async () => {
    const scores = [
      makeScore({ ts: 1000, sessionId: "s1", rubric: "quality", score: 50 }),
      makeScore({ ts: 2000, sessionId: "s1", rubric: "quality", score: 75 }),
      makeScore({ ts: 3000, sessionId: "s1", rubric: "quality", score: 90 }),
    ];
    await writeScoreFile(tmpDir, "2026-01-01", scores);

    const result = await queryScores(tmpDir, { effectiveOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(90);
  });

  it("effectiveOnly: true — override with higher ts supersedes original", async () => {
    const original = makeScore({
      ts: 1000,
      sessionId: "s1",
      rubric: "task_completion",
      score: 40,
    });
    const override = makeScore({
      ts: 5000,
      sessionId: "s1",
      rubric: "task_completion",
      score: 95,
      isOverride: true,
      overridesSessionId: "s1",
    });
    await writeScoreFile(tmpDir, "2026-01-01", [original, override]);

    const result = await queryScores(tmpDir, { effectiveOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].isOverride).toBe(true);
    expect(result[0].score).toBe(95);
  });

  it("multi-file scan: records spread across two date files are all found", async () => {
    const file1Scores = [
      makeScore({ ts: 1000, sessionId: "s1", rubric: "accuracy", agentId: "a1" }),
    ];
    const file2Scores = [makeScore({ ts: 2000, sessionId: "s2", rubric: "speed", agentId: "a1" })];
    await writeScoreFile(tmpDir, "2026-01-01", file1Scores);
    await writeScoreFile(tmpDir, "2026-01-02", file2Scores);

    const result = await queryScores(tmpDir, {});
    expect(result).toHaveLength(2);
    // Sorted newest-first
    expect(result[0].ts).toBe(2000);
    expect(result[1].ts).toBe(1000);
  });

  it("multi-file scan: effectiveOnly works across files", async () => {
    // Older record in first file, override in second file
    const olderScore = makeScore({ ts: 1000, sessionId: "s1", rubric: "quality", score: 30 });
    const newerScore = makeScore({
      ts: 5000,
      sessionId: "s1",
      rubric: "quality",
      score: 80,
      isOverride: true,
    });
    await writeScoreFile(tmpDir, "2026-01-01", [olderScore]);
    await writeScoreFile(tmpDir, "2026-01-02", [newerScore]);

    const result = await queryScores(tmpDir, { effectiveOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(80);
    expect(result[0].ts).toBe(5000);
  });

  it("malformed JSONL lines are silently skipped", async () => {
    const dir = join(tmpDir, "session-scores");
    await mkdir(dir, { recursive: true });
    const content =
      `${JSON.stringify(makeScore({ ts: 1000, sessionId: "s1", rubric: "r" }))}\n` +
      `not valid json at all!!!\n` +
      `{broken: "json"\n` +
      `${JSON.stringify(makeScore({ ts: 2000, sessionId: "s2", rubric: "r" }))}\n`;
    await writeFile(join(dir, "2026-01-01.jsonl"), content, "utf-8");

    const result = await queryScores(tmpDir, {});
    expect(result).toHaveLength(2);
    expect(result[0].ts).toBe(2000);
    expect(result[1].ts).toBe(1000);
  });
});

describe("score-store: appendScore", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), "openclaw-score-store-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates directory if it does not exist", async () => {
    const score = makeScore({ sessionId: "s1" });
    await appendScore(tmpDir, score);

    // Query back — should find the record
    const result = await queryScores(tmpDir, {});
    expect(result).toHaveLength(1);
  });

  it("appends a valid JSONL line that can be queried back", async () => {
    const score = makeScore({ sessionId: "sess-append", rubric: "quality", score: 77 });
    await appendScore(tmpDir, score);

    const result = await queryScores(tmpDir, { sessionId: "sess-append" });
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(77);
    expect(result[0].rubric).toBe("quality");
  });

  it("multiple appends produce multiple parseable lines", async () => {
    const score1 = makeScore({ sessionId: "s1", rubric: "accuracy", score: 60 });
    const score2 = makeScore({ sessionId: "s2", rubric: "speed", score: 80 });
    const score3 = makeScore({ sessionId: "s3", rubric: "task_completion", score: 90 });

    await appendScore(tmpDir, score1);
    await appendScore(tmpDir, score2);
    await appendScore(tmpDir, score3);

    const result = await queryScores(tmpDir, {});
    expect(result).toHaveLength(3);

    const sessionIds = new Set(result.map((s) => s.sessionId));
    expect(sessionIds).toContain("s1");
    expect(sessionIds).toContain("s2");
    expect(sessionIds).toContain("s3");
  });

  it("appended score has correct fields preserved", async () => {
    const now = Date.now();
    const score = makeScore({
      ts: now,
      seq: 42,
      sessionId: "session-xyz",
      agentId: "agent-abc",
      score: 95,
      rubric: "tool_use",
      tags: ["eval", "prod"],
      evaluatorId: "judge-1",
      isOverride: true,
    });

    await appendScore(tmpDir, score);

    const result = await queryScores(tmpDir, {});
    expect(result).toHaveLength(1);
    const r = result[0];
    expect(r.ts).toBe(now);
    expect(r.seq).toBe(42);
    expect(r.sessionId).toBe("session-xyz");
    expect(r.agentId).toBe("agent-abc");
    expect(r.score).toBe(95);
    expect(r.rubric).toBe("tool_use");
    expect(r.tags).toEqual(["eval", "prod"]);
    expect(r.evaluatorId).toBe("judge-1");
    expect(r.isOverride).toBe(true);
  });
});
