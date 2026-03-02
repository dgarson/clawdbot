import node_fs from "node:fs";
import node_path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import type { TelemetryEvent } from "./types.js";

// better-sqlite3 Database type alias for convenience.
type Db = BetterSqlite3.Database;

// ---------------------------------------------------------------------------
// Schema DDL
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  ts INTEGER NOT NULL,
  session_key TEXT,
  session_id TEXT,
  run_id TEXT,
  agent_id TEXT,
  data TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  session_key TEXT NOT NULL,
  agent_id TEXT,
  provider TEXT,
  model TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  duration_ms INTEGER,
  stop_reason TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  tool_call_count INTEGER DEFAULT 0,
  compaction_count INTEGER DEFAULT 0,
  is_heartbeat INTEGER DEFAULT 0,
  origin_channel TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  session_key TEXT,
  tool_name TEXT NOT NULL,
  tool_call_id TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  duration_ms INTEGER,
  is_error INTEGER DEFAULT 0,
  error TEXT,
  file_path TEXT,
  exec_command TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_key TEXT,
  run_id TEXT,
  direction TEXT NOT NULL,
  channel TEXT,
  from_id TEXT,
  content_preview TEXT,
  ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subagents (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  parent_session_key TEXT,
  child_session_key TEXT,
  agent_id TEXT,
  task TEXT,
  label TEXT,
  model TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  duration_ms INTEGER,
  outcome TEXT
);

CREATE TABLE IF NOT EXISTS model_calls (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  session_key TEXT,
  call_index INTEGER,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read_tokens INTEGER,
  cache_write_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd REAL,
  total_cost_usd REAL,
  duration_ms INTEGER,
  ts INTEGER
);

CREATE TABLE IF NOT EXISTS indexer_state (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_key);
CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_key);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);
CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON tool_calls(run_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_name ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_file ON tool_calls(file_path);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_key);
CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts);
CREATE INDEX IF NOT EXISTS idx_subagents_run ON subagents(run_id);
CREATE INDEX IF NOT EXISTS idx_subagents_parent ON subagents(parent_session_key);
CREATE INDEX IF NOT EXISTS idx_model_calls_run ON model_calls(run_id);
CREATE INDEX IF NOT EXISTS idx_model_calls_session ON model_calls(session_key);
`;

// ---------------------------------------------------------------------------
// Event dispatcher — updates the materialized tables
// ---------------------------------------------------------------------------

function safeNum(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function safeStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function tableHasColumn(db: Db, table: string, column: string): boolean {
  const rows = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

// ---------------------------------------------------------------------------
// Schema migrations — append-only, keyed by PRAGMA user_version
// ---------------------------------------------------------------------------

type Migration = (db: Db) => void;

const MIGRATIONS: Migration[] = [
  // v0 → v1: add total_cost_usd to model_calls
  (db) => {
    if (!tableHasColumn(db, "model_calls", "total_cost_usd")) {
      db.exec("ALTER TABLE model_calls ADD COLUMN total_cost_usd REAL");
    }
  },
];

/**
 * Run pending schema migrations inside a single transaction.
 * Uses PRAGMA user_version to track the current schema version.
 */
function runMigrations(db: Db): void {
  const current = (db.pragma("user_version", { simple: true }) as number) ?? 0;
  const target = MIGRATIONS.length;
  if (current >= target) return;

  const migrate = db.transaction(() => {
    for (let i = current; i < target; i++) {
      MIGRATIONS[i](db);
    }
    db.pragma(`user_version = ${target}`);
  });
  migrate();
}

/**
 * Index a single TelemetryEvent into the SQLite database.
 * Always inserts into the `events` table; also upserts into the appropriate
 * materialized table based on event.kind.
 */
export function indexEvent(db: Db, event: TelemetryEvent): void {
  // 1. Always insert into events table
  db.prepare(
    `INSERT OR IGNORE INTO events
       (id, kind, ts, session_key, session_id, run_id, agent_id, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event.id,
    event.kind,
    event.ts,
    event.sessionKey ?? null,
    event.sessionId ?? null,
    event.runId ?? null,
    event.agentId ?? null,
    JSON.stringify(event.data ?? {}),
  );

  const d = event.data ?? {};

  // 2. Dispatch to materialized tables
  switch (event.kind) {
    case "run.start":
      db.prepare(
        `INSERT OR IGNORE INTO runs
           (run_id, session_key, agent_id, provider, model, started_at,
            is_heartbeat, origin_channel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        event.runId ?? null,
        event.sessionKey ?? null,
        event.agentId ?? null,
        safeStr(d.provider),
        safeStr(d.model),
        event.ts,
        d.isHeartbeat ? 1 : 0,
        safeStr(d.originChannel),
      );
      break;

    case "run.end": {
      const usage =
        d.usage && typeof d.usage === "object" ? (d.usage as Record<string, unknown>) : {};
      db.prepare(
        `UPDATE runs SET
           ended_at = ?,
           duration_ms = ?,
           stop_reason = ?,
           input_tokens = ?,
           output_tokens = ?,
           cache_read_tokens = ?,
           cache_write_tokens = ?,
           total_tokens = ?,
           tool_call_count = ?,
           compaction_count = ?,
           error = ?
         WHERE run_id = ?`,
      ).run(
        event.ts,
        safeNum(d.durationMs),
        safeStr(d.stopReason),
        safeNum(usage.input),
        safeNum(usage.output),
        safeNum(usage.cacheRead),
        safeNum(usage.cacheWrite),
        safeNum(usage.total),
        safeNum(d.toolCallCount),
        safeNum(d.compactionCount),
        event.error?.message ?? null,
        event.runId ?? null,
      );
      break;
    }

    case "tool.start":
      db.prepare(
        `INSERT OR IGNORE INTO tool_calls
           (id, run_id, session_key, tool_name, tool_call_id, started_at,
            file_path, exec_command)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        event.id,
        event.runId ?? null,
        event.sessionKey ?? null,
        safeStr(d.toolName) ?? "unknown",
        safeStr(d.toolCallId),
        event.ts,
        safeStr(d.filePath),
        safeStr(d.execCommand),
      );
      break;

    case "tool.end": {
      const toolCallId = safeStr(d.toolCallId);
      if (toolCallId) {
        // Update by toolCallId if available (more precise)
        db.prepare(
          `UPDATE tool_calls SET
             ended_at = ?, duration_ms = ?, is_error = ?, error = ?,
             file_path = COALESCE(file_path, ?),
             exec_command = COALESCE(exec_command, ?)
           WHERE tool_call_id = ?`,
        ).run(
          event.ts,
          safeNum(d.durationMs),
          d.isError ? 1 : 0,
          safeStr(d.error),
          safeStr(d.filePath),
          safeStr(d.execCommand),
          toolCallId,
        );
      } else {
        // Fallback: insert a new row if no toolCallId pairing
        db.prepare(
          `INSERT OR IGNORE INTO tool_calls
             (id, run_id, session_key, tool_name, tool_call_id, ended_at,
              duration_ms, is_error, error, file_path, exec_command)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          event.id,
          event.runId ?? null,
          event.sessionKey ?? null,
          safeStr(d.toolName) ?? "unknown",
          null,
          event.ts,
          safeNum(d.durationMs),
          d.isError ? 1 : 0,
          safeStr(d.error),
          safeStr(d.filePath),
          safeStr(d.execCommand),
        );
      }
      break;
    }

    case "message.inbound":
      db.prepare(
        `INSERT OR IGNORE INTO messages
           (id, session_key, run_id, direction, channel, from_id,
            content_preview, ts)
         VALUES (?, ?, ?, 'inbound', ?, ?, ?, ?)`,
      ).run(
        event.id,
        event.sessionKey ?? null,
        event.runId ?? null,
        safeStr(d.channel),
        safeStr(d.from),
        safeStr(d.contentPreview),
        event.ts,
      );
      break;

    case "message.outbound":
      db.prepare(
        `INSERT OR IGNORE INTO messages
           (id, session_key, run_id, direction, channel, from_id,
            content_preview, ts)
         VALUES (?, ?, ?, 'outbound', ?, ?, ?, ?)`,
      ).run(
        event.id,
        event.sessionKey ?? null,
        event.runId ?? null,
        safeStr(d.channel),
        safeStr(d.to),
        safeStr(d.contentPreview),
        event.ts,
      );
      break;

    case "subagent.spawn":
      db.prepare(
        `INSERT OR IGNORE INTO subagents
           (id, run_id, parent_session_key, child_session_key, agent_id,
            task, label, model, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        event.id,
        event.runId ?? null,
        event.sessionKey ?? null,
        safeStr(d.childSessionKey),
        safeStr(d.agentId),
        safeStr(d.task),
        safeStr(d.label),
        safeStr(d.model),
        event.ts,
      );
      break;

    case "subagent.end": {
      // Update by child_session_key + run_id if possible
      const childKey = safeStr(d.childSessionKey) ?? event.sessionKey;
      db.prepare(
        `UPDATE subagents SET
           ended_at = ?, duration_ms = ?, outcome = ?
         WHERE child_session_key = ? AND (run_id = ? OR run_id IS NULL)`,
      ).run(event.ts, safeNum(d.durationMs), safeStr(d.outcome), childKey, event.runId ?? null);
      break;
    }

    case "llm.call": {
      // Per-API-call snapshot emitted by pi-embedded-subscribe's model.call diagnostic event.
      // Token counts come from d.delta (per-call) with d.cumulative as last-resort fallback.
      //
      // IMPORTANT: always prefer delta over cumulative. Cumulative holds running totals that
      // grow each call; storing and then summing them causes massive overcounting in aggregates.
      const delta =
        d.delta && typeof d.delta === "object" ? (d.delta as Record<string, unknown>) : {};
      const cumulative =
        d.cumulative && typeof d.cumulative === "object"
          ? (d.cumulative as Record<string, unknown>)
          : {};
      // Prefer delta > top-level > cumulative (last resort fallback only).
      const inputTokens = safeNum(
        delta.inputTokens ??
          delta.input ??
          d.inputTokens ??
          cumulative.inputTokens ??
          cumulative.input,
      );
      const outputTokens = safeNum(
        delta.outputTokens ??
          delta.output ??
          d.outputTokens ??
          cumulative.outputTokens ??
          cumulative.output,
      );
      const cacheReadTokens = safeNum(
        delta.cacheReadTokens ??
          delta.cacheRead ??
          d.cacheReadTokens ??
          cumulative.cacheReadTokens ??
          cumulative.cacheRead,
      );
      const cacheWriteTokens = safeNum(
        delta.cacheWriteTokens ??
          delta.cacheWrite ??
          d.cacheWriteTokens ??
          cumulative.cacheWriteTokens ??
          cumulative.cacheWrite,
      );
      // total_tokens = input + output + cacheRead + cacheWrite (all tokens the model processed).
      // delta.total is emitted by the subscriber; fallback derives it here if missing.
      const totalTokens = safeNum(
        delta.totalTokens ??
          delta.total ??
          d.totalTokens ??
          cumulative.totalTokens ??
          cumulative.total,
      );
      db.prepare(
        `INSERT OR IGNORE INTO model_calls
           (id, run_id, session_key, call_index, provider, model,
            input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
            total_tokens, cost_usd, total_cost_usd, duration_ms, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      ).run(
        event.id,
        event.runId ?? null,
        event.sessionKey ?? null,
        safeNum(d.callIndex),
        safeStr(d.provider),
        safeStr(d.model),
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        totalTokens,
        typeof d.costUsd === "number" ? d.costUsd : null,
        safeNum(d.durationMs),
        event.ts,
      );
      break;
    }

    case "usage.snapshot": {
      // Run-level summary emitted once per run from agent-runner's model.usage diagnostic event.
      // Token and per-call cost_usd are already captured via llm.call rows; storing them again
      // would double-count in aggregates. We NULL out tokens and cost_usd so only incremental
      // llm.call rows drive SUM(cost_usd). The run-level total is preserved in total_cost_usd
      // as a cross-check / fallback for runs without per-call events.
      const usageNested =
        d.usage && typeof d.usage === "object" ? (d.usage as Record<string, unknown>) : {};
      db.prepare(
        `INSERT OR IGNORE INTO model_calls
           (id, run_id, session_key, call_index, provider, model,
            input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
            total_tokens, cost_usd, total_cost_usd, duration_ms, ts)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`,
      ).run(
        event.id,
        event.runId ?? null,
        event.sessionKey ?? null,
        null, // no callIndex for run-level summary
        safeStr(d.provider ?? usageNested.provider),
        safeStr(d.model ?? usageNested.model),
        typeof d.costUsd === "number" ? d.costUsd : null,
        safeNum(d.durationMs),
        event.ts,
      );
      break;
    }

    default:
      // session.start, session.end, compaction.start, compaction.end, error, etc.
      // Only stored in the events table (already done above).
      break;
  }
}

// ---------------------------------------------------------------------------
// JSONL catch-up watcher
// ---------------------------------------------------------------------------

const STATE_KEY_OFFSET = "jsonl_last_offset";

/**
 * Read new lines from the JSONL file starting at the stored byte offset,
 * index each event, and update the stored offset in indexer_state.
 *
 * This is safe to call multiple times; it is idempotent if no new lines
 * have been written.
 */
export function catchUp(db: Db, jsonlPath: string): number {
  if (!node_fs.existsSync(jsonlPath)) {
    return 0;
  }

  const stateRow = db
    .prepare<unknown[], { value: string }>("SELECT value FROM indexer_state WHERE key = ?")
    .get(STATE_KEY_OFFSET);

  const lastOffset = stateRow ? parseInt(stateRow.value, 10) : 0;

  const stat = node_fs.statSync(jsonlPath);
  if (stat.size <= lastOffset) {
    return 0;
  }

  // Read the new bytes
  const fd = node_fs.openSync(jsonlPath, "r");
  const buf = Buffer.allocUnsafe(stat.size - lastOffset);
  node_fs.readSync(fd, buf, 0, buf.length, lastOffset);
  node_fs.closeSync(fd);

  const chunk = buf.toString("utf8");
  const lines = chunk.split("\n");

  let indexed = 0;
  const insertState = db.prepare("INSERT OR REPLACE INTO indexer_state (key, value) VALUES (?, ?)");

  const runBatch = db.transaction(() => {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as TelemetryEvent;
        indexEvent(db, event);
        indexed++;
      } catch {
        // Corrupt or partial line — skip it.
      }
    }
    insertState.run(STATE_KEY_OFFSET, String(stat.size));
  });

  runBatch();
  return indexed;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type Indexer = {
  db: Db;
  indexEvent: (event: TelemetryEvent) => void;
  catchUp: () => number;
  close: () => void;
};

/**
 * Create a telemetry indexer backed by a SQLite database.
 *
 * @param dbPath   - Path to the SQLite file (use `:memory:` for tests).
 * @param jsonlPath - Path to the JSONL event log for catch-up on startup.
 */
export async function createIndexer(dbPath: string, jsonlPath: string): Promise<Indexer> {
  // Dynamic import — better-sqlite3 is optional; fail loudly if missing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Database: any;
  try {
    const mod = await import("better-sqlite3");
    Database = mod.default ?? mod;
  } catch (err) {
    throw new Error(
      `telemetry: better-sqlite3 is required for SQLite indexing. ` +
        `Install it: npm install better-sqlite3\n${String(err)}`,
      { cause: err },
    );
  }

  const db: Db = new Database(dbPath);
  // WAL mode gives better concurrent read performance.
  db.pragma("journal_mode = WAL");
  // Execute the schema DDL (all CREATE TABLE/INDEX IF NOT EXISTS).
  db.exec(SCHEMA_SQL);
  runMigrations(db);

  return {
    db,
    indexEvent: (event) => indexEvent(db, event),
    catchUp: () => catchUp(db, jsonlPath),
    close: () => db.close(),
  };
}

/**
 * Create an indexer synchronously using a pre-opened database instance.
 * Useful for tests where the caller controls the DB lifecycle.
 */
export function createIndexerFromDb(db: Db, jsonlPath: string): Indexer {
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  runMigrations(db);
  return {
    db,
    indexEvent: (event) => indexEvent(db, event),
    catchUp: () => catchUp(db, jsonlPath),
    close: () => db.close(),
  };
}
