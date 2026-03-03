/**
 * Scorecard persistence using JSONL files.
 *
 * Scorecards are stored as one-per-line JSON in date-partitioned files:
 *   {stateDir}/evaluation/scorecards/{YYYY-MM-DD}.jsonl
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import type { Scorecard } from "./types.js";

export type ScorecardQuery = {
  runId?: string;
  agentId?: string;
  from?: string;
  to?: string;
  classificationLabel?: string;
  model?: string;
  limit?: number;
};

export class ScorecardStore {
  private readonly dir: string;

  constructor(stateDir: string) {
    this.dir = join(stateDir, "evaluation", "scorecards");
    mkdirSync(this.dir, { recursive: true });
  }

  /** Append a scorecard to the appropriate date-partitioned file. */
  append(scorecard: Scorecard): void {
    const date = scorecard.scoredAt.slice(0, 10); // YYYY-MM-DD
    const file = join(this.dir, `${date}.jsonl`);
    appendFileSync(file, JSON.stringify(scorecard) + "\n", "utf-8");
  }

  /** Query scorecards matching the given filters. */
  query(q: ScorecardQuery): Scorecard[] {
    const files = this.resolveFiles(q.from, q.to);
    const limit = q.limit ?? 1000;
    const results: Scorecard[] = [];

    for (const file of files) {
      if (results.length >= limit) break;

      const lines = this.readLines(file);
      for (const line of lines) {
        if (results.length >= limit) break;

        const card = this.parseLine(line);
        if (!card) continue;
        if (!this.matchesQuery(card, q)) continue;

        results.push(card);
      }
    }

    return results;
  }

  /** Get a single scorecard by runId. Returns the first match. */
  getByRunId(runId: string): Scorecard | undefined {
    const results = this.query({ runId, limit: 1 });
    return results[0];
  }

  /** Update a scorecard in place (used for human overrides). */
  updateByRunId(runId: string, updater: (card: Scorecard) => Scorecard): boolean {
    const files = this.listFiles();

    for (const file of files) {
      const lines = this.readLines(file);
      let found = false;
      const updated: string[] = [];

      for (const line of lines) {
        const card = this.parseLine(line);
        if (card && card.runId === runId) {
          found = true;
          updated.push(JSON.stringify(updater(card)));
        } else {
          updated.push(line);
        }
      }

      if (found) {
        writeFileSync(file, updated.join("\n") + "\n", "utf-8");
        return true;
      }
    }

    return false;
  }

  /** Delete scorecards older than the given number of days. */
  purgeOlderThan(days: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    let deleted = 0;

    for (const file of this.listFiles()) {
      const dateStr =
        file
          .replace(/\.jsonl$/, "")
          .split("/")
          .pop() ?? "";
      if (dateStr < cutoffStr) {
        unlinkSync(file);
        deleted++;
      }
    }

    return deleted;
  }

  /** Check whether a run has already been scored. */
  hasScorecard(runId: string): boolean {
    return this.getByRunId(runId) !== undefined;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private resolveFiles(from?: string, to?: string): string[] {
    const all = this.listFiles();
    if (!from && !to) return all;

    return all.filter((file) => {
      const dateStr =
        file
          .replace(/\.jsonl$/, "")
          .split("/")
          .pop() ?? "";
      if (from && dateStr < from) return false;
      if (to && dateStr > to) return false;
      return true;
    });
  }

  private listFiles(): string[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .map((f) => join(this.dir, f));
  }

  private readLines(file: string): string[] {
    if (!existsSync(file)) return [];
    return readFileSync(file, "utf-8")
      .split("\n")
      .filter((line) => line.trim().length > 0);
  }

  private parseLine(line: string): Scorecard | undefined {
    try {
      return JSON.parse(line) as Scorecard;
    } catch {
      return undefined;
    }
  }

  private matchesQuery(card: Scorecard, q: ScorecardQuery): boolean {
    if (q.runId && card.runId !== q.runId) return false;
    if (q.agentId && card.agentId !== q.agentId) return false;
    if (q.classificationLabel && card.classificationLabel !== q.classificationLabel) return false;
    if (q.model && card.model !== q.model) return false;
    if (q.from && card.scoredAt < q.from) return false;
    if (q.to && card.scoredAt > q.to) return false;
    return true;
  }
}
