/**
 * Session score store — JSONL-backed persistence for session.score diagnostic events.
 *
 * Layout: {stateDir}/session-scores/{YYYY-MM-DD}.jsonl
 *
 * Each line is a StoredScore record. Overrides (written via CLI or tool) are
 * appended as new records with isOverride=true. effectiveOnly queries resolve
 * the latest entry per (sessionId, rubric) pair so callers see a single score.
 */

import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type StoredScore = {
  ts: number;
  seq: number;
  type: "session.score";
  sessionId?: string;
  agentId?: string;
  score: number;
  rubric: string;
  tags?: string[];
  evaluatorId?: string;
  data?: Record<string, unknown>;
  /** True when this record was written manually as an override. */
  isOverride?: boolean;
  /** The sessionId this override supersedes (set on manual overrides). */
  overridesSessionId?: string;
};

export type ScoreQueryFilter = {
  agentId?: string;
  sessionId?: string;
  rubric?: string;
  limit?: number;
  /** When true, return only the latest entry per (sessionId, rubric) pair. */
  effectiveOnly?: boolean;
};

function scoresDir(stateDir: string): string {
  return path.join(stateDir, "session-scores");
}

function todayFile(stateDir: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(scoresDir(stateDir), `${date}.jsonl`);
}

export async function appendScore(stateDir: string, score: StoredScore): Promise<void> {
  const file = todayFile(stateDir);
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(score)}\n`, "utf-8");
}

export async function queryScores(
  stateDir: string,
  filter: ScoreQueryFilter,
): Promise<StoredScore[]> {
  const dir = scoresDir(stateDir);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const results: StoredScore[] = [];
  for (const name of entries.filter((n) => n.endsWith(".jsonl")).sort()) {
    const content = await readFile(path.join(dir, name), "utf-8").catch(() => "");
    for (const line of content.split("\n").filter(Boolean)) {
      try {
        const s = JSON.parse(line) as StoredScore;
        if (filter.agentId && s.agentId !== filter.agentId) continue;
        if (filter.sessionId && s.sessionId !== filter.sessionId) continue;
        if (filter.rubric && s.rubric !== filter.rubric) continue;
        results.push(s);
      } catch {
        /* skip malformed lines */
      }
    }
  }

  const sorted = results.sort((a, b) => b.ts - a.ts);

  if (filter.effectiveOnly) {
    // Keep only the latest entry per (sessionId, rubric) pair.
    const seen = new Map<string, StoredScore>();
    for (const s of sorted) {
      const key = `${s.sessionId ?? ""}::${s.rubric}`;
      if (!seen.has(key)) seen.set(key, s);
    }
    const effective = Array.from(seen.values()).sort((a, b) => b.ts - a.ts);
    return filter.limit ? effective.slice(0, filter.limit) : effective;
  }

  return filter.limit ? sorted.slice(0, filter.limit) : sorted;
}
