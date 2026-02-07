/**
 * Feedback Store — SQLite persistence for relevancy evaluations.
 *
 * Stores individual feedback entries and maintains rolling aggregate
 * statistics per backend for weight adjustment advisory.
 */

import type { DatabaseSync } from "node:sqlite";
import fsSync from "node:fs";
import path from "node:path";
import type { RelevanceFeedback } from "./types.js";
import { requireNodeSqlite } from "../sqlite.js";

// ─── Schema ─────────────────────────────────────────────────────────────────

function ensureSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS relevance_feedback (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      query_trace_id TEXT NOT NULL,
      query TEXT NOT NULL,
      precision REAL NOT NULL,
      mean_relevance REAL NOT NULL,
      used_count INTEGER NOT NULL,
      retrieved_count INTEGER NOT NULL,
      evaluator_model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      session_key TEXT,
      detail TEXT NOT NULL
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_fb_ts ON relevance_feedback(ts);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fb_trace ON relevance_feedback(query_trace_id);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS backend_feedback_agg (
      backend TEXT NOT NULL,
      window_start TEXT NOT NULL,
      eval_count INTEGER DEFAULT 0,
      sum_precision REAL DEFAULT 0,
      sum_mean_relevance REAL DEFAULT 0,
      sum_used_count INTEGER DEFAULT 0,
      sum_retrieved_count INTEGER DEFAULT 0,
      PRIMARY KEY (backend, window_start)
    );
  `);
}

// ─── Store class ────────────────────────────────────────────────────────────

export type FeedbackStoreOptions = {
  dbPath: string;
};

export class FeedbackStore {
  private db: DatabaseSync;
  private closed = false;

  constructor(options: FeedbackStoreOptions) {
    const dir = path.dirname(options.dbPath);
    try {
      fsSync.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }

    const { DatabaseSync: DB } = requireNodeSqlite();
    this.db = new DB(options.dbPath);
    this.db.exec("PRAGMA journal_mode=WAL;");
    this.db.exec("PRAGMA busy_timeout=5000;");
    ensureSchema(this.db);
  }

  /** Store a feedback evaluation result. */
  storeFeedback(feedback: RelevanceFeedback, sessionKey?: string): void {
    this.assertOpen();

    this.db
      .prepare(
        `INSERT OR REPLACE INTO relevance_feedback
          (id, ts, query_trace_id, query, precision, mean_relevance,
           used_count, retrieved_count, evaluator_model,
           input_tokens, output_tokens, duration_ms, session_key, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        feedback.id,
        feedback.ts,
        feedback.queryTraceId,
        feedback.query,
        feedback.aggregate.precision,
        feedback.aggregate.meanRelevanceScore,
        feedback.aggregate.usedCount,
        feedback.aggregate.retrievedCount,
        feedback.evaluatorModel,
        feedback.evaluationCost.inputTokens,
        feedback.evaluationCost.outputTokens,
        feedback.evaluationCost.durationMs,
        sessionKey ?? null,
        JSON.stringify(feedback),
      );

    // Update per-backend aggregate
    const windowStart = feedback.ts.slice(0, 10); // YYYY-MM-DD
    for (const [backend, stats] of Object.entries(feedback.aggregate.byBackend)) {
      this.upsertBackendAgg(backend, windowStart, stats);
    }
  }

  /** Get recent feedback entries. */
  listFeedback(params?: {
    limit?: number;
    offset?: number;
    sessionKey?: string;
  }): RelevanceFeedback[] {
    this.assertOpen();
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    let sql = "SELECT detail FROM relevance_feedback";
    const binds: (string | number)[] = [];

    if (params?.sessionKey) {
      sql += " WHERE session_key = ?";
      binds.push(params.sessionKey);
    }

    sql += " ORDER BY ts DESC LIMIT ? OFFSET ?";
    binds.push(limit, offset);

    const rows = this.db.prepare(sql).all(...binds) as Array<{ detail: string }>;
    return rows.map((r) => JSON.parse(r.detail) as RelevanceFeedback);
  }

  /** Get feedback for a specific query trace. */
  getByTraceId(queryTraceId: string): RelevanceFeedback | null {
    this.assertOpen();
    const row = this.db
      .prepare("SELECT detail FROM relevance_feedback WHERE query_trace_id = ?")
      .get(queryTraceId) as { detail: string } | undefined;
    return row ? (JSON.parse(row.detail) as RelevanceFeedback) : null;
  }

  /** Get aggregated backend feedback for a rolling window. */
  getBackendAggregates(windowDays: number = 7): Array<{
    backend: string;
    evalCount: number;
    avgPrecision: number;
    avgMeanRelevance: number;
    avgUsedCount: number;
    avgRetrievedCount: number;
  }> {
    this.assertOpen();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const rows = this.db
      .prepare(
        `SELECT
          backend,
          SUM(eval_count) as total_evals,
          SUM(sum_precision) as total_precision,
          SUM(sum_mean_relevance) as total_relevance,
          SUM(sum_used_count) as total_used,
          SUM(sum_retrieved_count) as total_retrieved
        FROM backend_feedback_agg
        WHERE window_start >= ?
        GROUP BY backend`,
      )
      .all(cutoffStr) as Array<{
      backend: string;
      total_evals: number;
      total_precision: number;
      total_relevance: number;
      total_used: number;
      total_retrieved: number;
    }>;

    return rows.map((r) => ({
      backend: r.backend,
      evalCount: r.total_evals,
      avgPrecision: r.total_evals > 0 ? r.total_precision / r.total_evals : 0,
      avgMeanRelevance: r.total_evals > 0 ? r.total_relevance / r.total_evals : 0,
      avgUsedCount: r.total_evals > 0 ? r.total_used / r.total_evals : 0,
      avgRetrievedCount: r.total_evals > 0 ? r.total_retrieved / r.total_evals : 0,
    }));
  }

  /** Total number of stored feedback evaluations. */
  count(): number {
    this.assertOpen();
    const row = this.db.prepare("SELECT COUNT(*) as count FROM relevance_feedback").get() as {
      count: number;
    };
    return row.count;
  }

  close(): void {
    if (!this.closed) {
      this.closed = true;
      try {
        this.db.close();
      } catch {
        // ignore
      }
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────

  private assertOpen(): void {
    if (this.closed) {
      throw new Error("FeedbackStore is closed");
    }
  }

  private upsertBackendAgg(
    backend: string,
    windowStart: string,
    stats: { precision: number; meanRelevance: number; count: number },
  ): void {
    // Try update first
    const result = this.db
      .prepare(
        `UPDATE backend_feedback_agg
         SET eval_count = eval_count + 1,
             sum_precision = sum_precision + ?,
             sum_mean_relevance = sum_mean_relevance + ?,
             sum_used_count = sum_used_count + ?,
             sum_retrieved_count = sum_retrieved_count + ?
         WHERE backend = ? AND window_start = ?`,
      )
      .run(stats.precision, stats.meanRelevance, 0, stats.count, backend, windowStart);

    if ((result.changes ?? 0) === 0) {
      this.db
        .prepare(
          `INSERT INTO backend_feedback_agg
            (backend, window_start, eval_count, sum_precision, sum_mean_relevance,
             sum_used_count, sum_retrieved_count)
           VALUES (?, ?, 1, ?, ?, 0, ?)`,
        )
        .run(backend, windowStart, stats.precision, stats.meanRelevance, stats.count);
    }
  }
}
