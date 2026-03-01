/**
 * SQL query helpers for the telemetry SQLite index.
 * All functions accept a better-sqlite3 Database instance and return typed results.
 */

import type BetterSqlite3 from "better-sqlite3";

type Db = BetterSqlite3.Database;

// ---------------------------------------------------------------------------
// Raw DB row shapes (SQLite returns snake_case columns)
// ---------------------------------------------------------------------------

type RunRow = {
  run_id: string;
  session_key: string | null;
  agent_id: string | null;
  provider: string | null;
  model: string | null;
  started_at: number | null;
  ended_at: number | null;
  duration_ms: number | null;
  stop_reason: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  total_tokens: number | null;
  tool_call_count: number | null;
  compaction_count: number | null;
  is_heartbeat: number;
  origin_channel: string | null;
  error: string | null;
};

type ToolCallRow = {
  id: string;
  run_id: string | null;
  session_key: string | null;
  tool_name: string;
  tool_call_id: string | null;
  started_at: number | null;
  ended_at: number | null;
  duration_ms: number | null;
  is_error: number;
  error: string | null;
  file_path: string | null;
  exec_command: string | null;
};

type ModelCallRow = {
  id: string;
  run_id: string | null;
  session_key: string | null;
  call_index: number | null;
  provider: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  ts: number | null;
};

type EventRow = {
  id: string;
  kind: string;
  ts: number;
  run_id: string | null;
  session_key: string | null;
  data: string | null;
};

type UsageAggRow = {
  total_runs: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  total_tokens: number | null;
  tool_call_count: number | null;
};

type CostAggRow = {
  total_cost: number | null;
};

type FileOpRow = {
  id: string;
  run_id: string | null;
  session_key: string | null;
  tool_name: string;
  file_path: string;
  exec_command: string | null;
  is_error: number;
  started_at: number | null;
};

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type RunSummary = {
  runId: string;
  sessionKey: string | null;
  agentId: string | null;
  provider: string | null;
  model: string | null;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  toolCallCount: number;
  compactionCount: number;
  isHeartbeat: boolean;
  originChannel: string | null;
  error: string | null;
};

export type RunDetail = RunSummary & {
  cacheReadTokens: number;
  cacheWriteTokens: number;
  toolCalls: ToolCallSummary[];
  modelCalls: ModelCallSummary[];
};

export type ToolCallSummary = {
  id: string;
  runId: string | null;
  sessionKey: string | null;
  toolName: string;
  toolCallId: string | null;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  isError: boolean;
  error: string | null;
  filePath: string | null;
  execCommand: string | null;
};

export type ModelCallSummary = {
  id: string;
  runId: string | null;
  sessionKey: string | null;
  callIndex: number | null;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  ts: number | null;
};

export type UsageSummary = {
  totalRuns: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  toolCallCount: number;
  estimatedCostUsd: number;
};

export type FileOperation = {
  id: string;
  runId: string | null;
  sessionKey: string | null;
  toolName: string;
  filePath: string;
  execCommand: string | null;
  isError: boolean;
  ts: number | null;
};

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToRunSummary(row: RunRow): RunSummary {
  return {
    runId: row.run_id,
    sessionKey: row.session_key ?? null,
    agentId: row.agent_id ?? null,
    provider: row.provider ?? null,
    model: row.model ?? null,
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    durationMs: row.duration_ms ?? null,
    stopReason: row.stop_reason ?? null,
    inputTokens: row.input_tokens ?? 0,
    outputTokens: row.output_tokens ?? 0,
    totalTokens: row.total_tokens ?? 0,
    toolCallCount: row.tool_call_count ?? 0,
    compactionCount: row.compaction_count ?? 0,
    isHeartbeat: row.is_heartbeat === 1,
    originChannel: row.origin_channel ?? null,
    error: row.error ?? null,
  };
}

function rowToToolCallSummary(row: ToolCallRow): ToolCallSummary {
  return {
    id: row.id,
    runId: row.run_id ?? null,
    sessionKey: row.session_key ?? null,
    toolName: row.tool_name,
    toolCallId: row.tool_call_id ?? null,
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    durationMs: row.duration_ms ?? null,
    isError: row.is_error === 1,
    error: row.error ?? null,
    filePath: row.file_path ?? null,
    execCommand: row.exec_command ?? null,
  };
}

function rowToModelCallSummary(row: ModelCallRow): ModelCallSummary {
  return {
    id: row.id,
    runId: row.run_id ?? null,
    sessionKey: row.session_key ?? null,
    callIndex: row.call_index ?? null,
    provider: row.provider ?? null,
    model: row.model ?? null,
    inputTokens: row.input_tokens ?? null,
    outputTokens: row.output_tokens ?? null,
    totalTokens: row.total_tokens ?? null,
    costUsd: row.cost_usd ?? null,
    durationMs: row.duration_ms ?? null,
    ts: row.ts ?? null,
  };
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

export type ListRunsOptions = {
  sessionKey?: string;
  limit?: number;
  offset?: number;
  since?: number;
  until?: number;
};

/**
 * List runs with optional filters, ordered by started_at descending.
 */
export function listRuns(db: Db, opts: ListRunsOptions = {}): RunSummary[] {
  const { sessionKey, limit = 50, offset = 0, since, until } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (sessionKey) {
    conditions.push("session_key = ?");
    params.push(sessionKey);
  }
  if (since !== undefined) {
    conditions.push("started_at >= ?");
    params.push(since);
  }
  if (until !== undefined) {
    conditions.push("started_at <= ?");
    params.push(until);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT * FROM runs ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare<unknown[], RunRow>(sql).all(...params);
  return rows.map(rowToRunSummary);
}

/**
 * Get a single run with full details including tool calls and model calls.
 */
export function getRun(db: Db, runId: string): RunDetail | undefined {
  const row = db.prepare<unknown[], RunRow>("SELECT * FROM runs WHERE run_id = ?").get(runId);
  if (!row) return undefined;

  const base = rowToRunSummary(row);
  const cacheReadTokens: number = row.cache_read_tokens ?? 0;
  const cacheWriteTokens: number = row.cache_write_tokens ?? 0;

  const toolCalls = getToolCalls(db, { runId, limit: 500 });
  const modelCalls = getModelCalls(db, { runId, limit: 500 });

  return { ...base, cacheReadTokens, cacheWriteTokens, toolCalls, modelCalls };
}

export type GetToolCallsOptions = {
  runId?: string;
  toolName?: string;
  limit?: number;
  offset?: number;
};

/**
 * List tool calls with optional filters, ordered by started_at.
 */
export function getToolCalls(db: Db, opts: GetToolCallsOptions = {}): ToolCallSummary[] {
  const { runId, toolName, limit = 100, offset = 0 } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (runId) {
    conditions.push("run_id = ?");
    params.push(runId);
  }
  if (toolName) {
    conditions.push("tool_name = ?");
    params.push(toolName);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT * FROM tool_calls ${where} ORDER BY started_at ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare<unknown[], ToolCallRow>(sql).all(...params);
  return rows.map(rowToToolCallSummary);
}

type GetModelCallsOptions = {
  runId?: string;
  sessionKey?: string;
  limit?: number;
};

function getModelCalls(db: Db, opts: GetModelCallsOptions = {}): ModelCallSummary[] {
  const { runId, sessionKey, limit = 100 } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (runId) {
    conditions.push("run_id = ?");
    params.push(runId);
  }
  if (sessionKey) {
    conditions.push("session_key = ?");
    params.push(sessionKey);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT * FROM model_calls ${where} ORDER BY call_index ASC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare<unknown[], ModelCallRow>(sql).all(...params);
  return rows.map(rowToModelCallSummary);
}

export type GetSessionTimelineOptions = {
  limit?: number;
  kinds?: string[];
};

/**
 * Get all events for a session, ordered by ts then seq (raw event rows).
 * Returns parsed TelemetryEvent-like objects (id, kind, ts, data).
 */
export function getSessionTimeline(
  db: Db,
  sessionKey: string,
  opts: GetSessionTimelineOptions = {},
): Array<{ id: string; kind: string; ts: number; runId: string | null; data: unknown }> {
  const { limit = 500, kinds } = opts;
  const params: unknown[] = [sessionKey];
  let kindsClause = "";

  if (kinds && kinds.length > 0) {
    kindsClause = ` AND kind IN (${kinds.map(() => "?").join(",")})`;
    params.push(...kinds);
  }

  params.push(limit);
  const sql = `SELECT id, kind, ts, run_id, data FROM events
               WHERE session_key = ?${kindsClause}
               ORDER BY ts ASC, rowid ASC LIMIT ?`;

  const rows = db.prepare<unknown[], EventRow>(sql).all(...params);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    ts: r.ts,
    runId: r.run_id ?? null,
    data: r.data ? JSON.parse(r.data) : {},
  }));
}

export type GetUsageSummaryOptions = {
  since?: number;
  until?: number;
  sessionKey?: string;
};

/**
 * Aggregate token counts and cost across all matching runs.
 */
export function getUsageSummary(db: Db, opts: GetUsageSummaryOptions = {}): UsageSummary {
  const { since, until, sessionKey } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (sessionKey) {
    conditions.push("session_key = ?");
    params.push(sessionKey);
  }
  if (since !== undefined) {
    conditions.push("started_at >= ?");
    params.push(since);
  }
  if (until !== undefined) {
    conditions.push("started_at <= ?");
    params.push(until);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `
    SELECT
      COUNT(*) as total_runs,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_read_tokens) as cache_read_tokens,
      SUM(cache_write_tokens) as cache_write_tokens,
      SUM(total_tokens) as total_tokens,
      SUM(tool_call_count) as tool_call_count
    FROM runs ${where}
  `;

  const row = db.prepare<unknown[], UsageAggRow>(sql).get(...params);

  // Sum cost from model_calls (runs table doesn't store cost)
  const costParams: unknown[] = [];
  const costConditions: string[] = [];
  if (sessionKey) {
    costConditions.push("session_key = ?");
    costParams.push(sessionKey);
  }
  if (since !== undefined) {
    costConditions.push("ts >= ?");
    costParams.push(since);
  }
  if (until !== undefined) {
    costConditions.push("ts <= ?");
    costParams.push(until);
  }
  const costWhere = costConditions.length > 0 ? `WHERE ${costConditions.join(" AND ")}` : "";
  const costRow = db
    .prepare<unknown[], CostAggRow>(`SELECT SUM(cost_usd) as total_cost FROM model_calls ${costWhere}`)
    .get(...costParams);

  return {
    totalRuns: row?.total_runs ?? 0,
    inputTokens: row?.input_tokens ?? 0,
    outputTokens: row?.output_tokens ?? 0,
    cacheReadTokens: row?.cache_read_tokens ?? 0,
    cacheWriteTokens: row?.cache_write_tokens ?? 0,
    totalTokens: row?.total_tokens ?? 0,
    toolCallCount: row?.tool_call_count ?? 0,
    estimatedCostUsd: costRow?.total_cost ?? 0,
  };
}

export type ListEventsOptions = {
  kind?: string;
  limit?: number;
  offset?: number;
  since?: number;
  until?: number;
  sessionKey?: string;
};

/**
 * List recent events with optional filters, ordered by ts descending.
 */
export function listEvents(
  db: Db,
  opts: ListEventsOptions = {},
): Array<{ id: string; kind: string; ts: number; sessionKey: string | null; runId: string | null; data: unknown }> {
  const { kind, limit = 100, offset = 0, since, until, sessionKey } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (kind) {
    conditions.push("kind = ?");
    params.push(kind);
  }
  if (sessionKey) {
    conditions.push("session_key = ?");
    params.push(sessionKey);
  }
  if (since !== undefined) {
    conditions.push("ts >= ?");
    params.push(since);
  }
  if (until !== undefined) {
    conditions.push("ts <= ?");
    params.push(until);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT id, kind, ts, session_key, run_id, data FROM events
               ${where} ORDER BY ts DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare<unknown[], EventRow>(sql).all(...params);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    ts: r.ts,
    sessionKey: r.session_key ?? null,
    runId: r.run_id ?? null,
    data: r.data ? JSON.parse(r.data) : {},
  }));
}

export type GetFileOperationsOptions = {
  runId?: string;
  filePath?: string;
  limit?: number;
  offset?: number;
};

/**
 * Get file operations (tool calls that touched a file path).
 */
export function getFileOperations(db: Db, opts: GetFileOperationsOptions = {}): FileOperation[] {
  const { runId, filePath, limit = 100, offset = 0 } = opts;
  const conditions: string[] = ["file_path IS NOT NULL"];
  const params: unknown[] = [];

  if (runId) {
    conditions.push("run_id = ?");
    params.push(runId);
  }
  if (filePath) {
    conditions.push("file_path LIKE ?");
    params.push(`%${filePath}%`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const sql = `SELECT id, run_id, session_key, tool_name, file_path,
                      exec_command, is_error, started_at
               FROM tool_calls ${where}
               ORDER BY started_at ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare<unknown[], FileOpRow>(sql).all(...params);
  return rows.map((r) => ({
    id: r.id,
    runId: r.run_id ?? null,
    sessionKey: r.session_key ?? null,
    toolName: r.tool_name,
    filePath: r.file_path,
    execCommand: r.exec_command ?? null,
    isError: r.is_error === 1,
    ts: r.started_at ?? null,
  }));
}
