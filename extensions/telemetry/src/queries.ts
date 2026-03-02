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
  agentId?: string;
  model?: string;
  limit?: number;
  offset?: number;
  since?: number;
  until?: number;
};

/**
 * List runs with optional filters, ordered by started_at descending.
 */
export function listRuns(db: Db, opts: ListRunsOptions = {}): RunSummary[] {
  const { sessionKey, agentId, model, limit = 50, offset = 0, since, until } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (sessionKey) {
    conditions.push("session_key = ?");
    params.push(sessionKey);
  }
  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
  }
  if (model) {
    conditions.push("model = ?");
    params.push(model);
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
  agentId?: string;
  sessionKey?: string;
  errorsOnly?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * List tool calls with optional filters, ordered by started_at.
 */
export function getToolCalls(db: Db, opts: GetToolCallsOptions = {}): ToolCallSummary[] {
  const { runId, toolName, agentId, sessionKey, errorsOnly, limit = 100, offset = 0 } = opts;
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
  if (agentId) {
    conditions.push("run_id IN (SELECT run_id FROM runs WHERE agent_id = ?)");
    params.push(agentId);
  }
  if (sessionKey) {
    conditions.push("session_key = ?");
    params.push(sessionKey);
  }
  if (errorsOnly) {
    conditions.push("is_error = 1");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT * FROM tool_calls ${where} ORDER BY started_at ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare<unknown[], ToolCallRow>(sql).all(...params);
  return rows.map(rowToToolCallSummary);
}

export type GetModelCallsOptions = {
  runId?: string;
  sessionKey?: string;
  model?: string;
  agentId?: string;
  limit?: number;
};

export function getModelCalls(db: Db, opts: GetModelCallsOptions = {}): ModelCallSummary[] {
  const { runId, sessionKey, model, agentId, limit = 100 } = opts;
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
  if (model) {
    conditions.push("model = ?");
    params.push(model);
  }
  if (agentId) {
    conditions.push("run_id IN (SELECT run_id FROM runs WHERE agent_id = ?)");
    params.push(agentId);
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
  agentId?: string;
};

/**
 * Aggregate token counts and cost across all matching runs.
 */
export function getUsageSummary(db: Db, opts: GetUsageSummaryOptions = {}): UsageSummary {
  const { since, until, sessionKey, agentId } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (sessionKey) {
    conditions.push("session_key = ?");
    params.push(sessionKey);
  }
  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
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
    .prepare<unknown[], CostAggRow>(
      `SELECT SUM(cost_usd) as total_cost FROM model_calls ${costWhere}`,
    )
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
  agentId?: string;
  runId?: string;
};

/**
 * List recent events with optional filters, ordered by ts descending.
 */
export function listEvents(
  db: Db,
  opts: ListEventsOptions = {},
): Array<{
  id: string;
  kind: string;
  ts: number;
  sessionKey: string | null;
  runId: string | null;
  data: unknown;
}> {
  const { kind, limit = 100, offset = 0, since, until, sessionKey, agentId, runId } = opts;
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
  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
  }
  if (runId) {
    conditions.push("run_id = ?");
    params.push(runId);
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
  agentId?: string;
  sessionKey?: string;
  limit?: number;
  offset?: number;
};

/**
 * Get file operations (tool calls that touched a file path).
 */
export function getFileOperations(db: Db, opts: GetFileOperationsOptions = {}): FileOperation[] {
  const { runId, filePath, agentId, sessionKey, limit = 100, offset = 0 } = opts;
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
  if (agentId) {
    conditions.push("run_id IN (SELECT run_id FROM runs WHERE agent_id = ?)");
    params.push(agentId);
  }
  if (sessionKey) {
    conditions.push("session_key = ?");
    params.push(sessionKey);
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

// ---------------------------------------------------------------------------
// New analytics return types
// ---------------------------------------------------------------------------

export type SessionSummary = {
  sessionKey: string;
  agentId: string | null;
  runCount: number;
  firstRunAt: number | null;
  lastActivityAt: number | null;
  totalTokens: number;
  toolCallCount: number;
  totalDurationMs: number;
  errorCount: number;
  totalCostUsd: number;
};

export type SessionDetail = SessionSummary & {
  runs: RunSummary[];
  subagents: SubagentSummary[];
  messages: MessageSummary[];
  modelCostBreakdown: CostBreakdown[];
};

export type CostGroupBy = "model" | "provider" | "agent" | "session" | "day";

export type CostBreakdown = {
  groupKey: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
};

export type SubagentSummary = {
  id: string;
  runId: string | null;
  parentSessionKey: string | null;
  childSessionKey: string | null;
  agentId: string | null;
  task: string | null;
  label: string | null;
  model: string | null;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  outcome: string | null;
};

export type SubagentTreeNode = SubagentSummary & {
  depth: number;
};

export type MessageSummary = {
  id: string;
  sessionKey: string | null;
  runId: string | null;
  direction: string;
  channel: string | null;
  fromId: string | null;
  contentPreview: string | null;
  ts: number;
};

export type ErrorEntry = {
  ts: number;
  source: "run" | "tool";
  contextId: string | null;
  sessionKey: string | null;
  errorText: string;
};

export type LeaderboardDimension = "runs" | "tools" | "models" | "sessions";

export type LeaderboardEntry = {
  key: string;
  count: number;
  totalTokens: number;
  totalCostUsd: number;
  totalDurationMs: number;
};

// ---------------------------------------------------------------------------
// New analytics DB row shapes
// ---------------------------------------------------------------------------

type SessionAggRow = {
  session_key: string;
  agent_id: string | null;
  run_count: number;
  first_run_at: number | null;
  last_activity_at: number | null;
  total_tokens: number | null;
  tool_call_count: number | null;
  total_duration_ms: number | null;
  error_count: number;
  total_cost_usd: number | null;
};

type SubagentRow = {
  id: string;
  run_id: string | null;
  parent_session_key: string | null;
  child_session_key: string | null;
  agent_id: string | null;
  task: string | null;
  label: string | null;
  model: string | null;
  started_at: number | null;
  ended_at: number | null;
  duration_ms: number | null;
  outcome: string | null;
};

type MessageRow = {
  id: string;
  session_key: string | null;
  run_id: string | null;
  direction: string;
  channel: string | null;
  from_id: string | null;
  content_preview: string | null;
  ts: number;
};

type ErrorRow = {
  ts: number;
  source: string;
  context_id: string | null;
  session_key: string | null;
  error_text: string;
};

type CostRow = {
  group_key: string | null;
  call_count: number;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  total_cost_usd: number | null;
};

type LeaderboardRow = {
  key: string | null;
  count: number;
  total_tokens: number | null;
  total_cost_usd: number | null;
  total_duration_ms: number | null;
};

// ---------------------------------------------------------------------------
// New analytics row mappers
// ---------------------------------------------------------------------------

function rowToSubagentSummary(row: SubagentRow): SubagentSummary {
  return {
    id: row.id,
    runId: row.run_id ?? null,
    parentSessionKey: row.parent_session_key ?? null,
    childSessionKey: row.child_session_key ?? null,
    agentId: row.agent_id ?? null,
    task: row.task ?? null,
    label: row.label ?? null,
    model: row.model ?? null,
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    durationMs: row.duration_ms ?? null,
    outcome: row.outcome ?? null,
  };
}

function rowToMessageSummary(row: MessageRow): MessageSummary {
  return {
    id: row.id,
    sessionKey: row.session_key ?? null,
    runId: row.run_id ?? null,
    direction: row.direction,
    channel: row.channel ?? null,
    fromId: row.from_id ?? null,
    contentPreview: row.content_preview ?? null,
    ts: row.ts,
  };
}

// ---------------------------------------------------------------------------
// New analytics query functions
// ---------------------------------------------------------------------------

export type ListSessionsOptions = {
  sessionKey?: string;
  agentId?: string;
  since?: number;
  until?: number;
  limit?: number;
};

/**
 * List sessions with aggregate stats from the runs table.
 */
export function listSessions(db: Db, opts: ListSessionsOptions = {}): SessionSummary[] {
  const { sessionKey, agentId, since, until, limit = 50 } = opts;
  const conditions: string[] = ["r.session_key IS NOT NULL"];
  const params: unknown[] = [];

  if (sessionKey) {
    conditions.push("r.session_key = ?");
    params.push(sessionKey);
  }
  if (agentId) {
    conditions.push("r.agent_id = ?");
    params.push(agentId);
  }
  if (since !== undefined) {
    conditions.push("r.started_at >= ?");
    params.push(since);
  }
  if (until !== undefined) {
    conditions.push("COALESCE(r.ended_at, r.started_at) <= ?");
    params.push(until);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const sql = `
    SELECT
      r.session_key,
      MAX(r.agent_id) as agent_id,
      COUNT(*) as run_count,
      MIN(r.started_at) as first_run_at,
      MAX(COALESCE(r.ended_at, r.started_at)) as last_activity_at,
      COALESCE(SUM(r.total_tokens), 0) as total_tokens,
      COALESCE(SUM(r.tool_call_count), 0) as tool_call_count,
      COALESCE(SUM(r.duration_ms), 0) as total_duration_ms,
      SUM(CASE WHEN r.error IS NOT NULL THEN 1 ELSE 0 END) as error_count,
      (SELECT COALESCE(SUM(mc.cost_usd), 0) FROM model_calls mc
       WHERE mc.session_key = r.session_key) as total_cost_usd
    FROM runs r
    ${where}
    GROUP BY r.session_key
    ORDER BY last_activity_at DESC
    LIMIT ?
  `;
  params.push(limit);

  const rows = db.prepare<unknown[], SessionAggRow>(sql).all(...params);
  return rows.map((r) => ({
    sessionKey: r.session_key,
    agentId: r.agent_id ?? null,
    runCount: r.run_count,
    firstRunAt: r.first_run_at ?? null,
    lastActivityAt: r.last_activity_at ?? null,
    totalTokens: r.total_tokens ?? 0,
    toolCallCount: r.tool_call_count ?? 0,
    totalDurationMs: r.total_duration_ms ?? 0,
    errorCount: r.error_count,
    totalCostUsd: r.total_cost_usd ?? 0,
  }));
}

/**
 * Get full session detail: summary + runs + subagents + messages + cost breakdown.
 */
export function getSessionDetail(db: Db, sessionKey: string): SessionDetail | undefined {
  const sessions = listSessions(db, { sessionKey, limit: 1 });
  if (sessions.length === 0) return undefined;
  const summary = sessions[0];

  const runs = listRuns(db, { sessionKey, limit: 500 });
  const subagents = listSubagents(db, { parentSessionKey: sessionKey, limit: 100 });
  const messages = listMessages(db, { sessionKey, limit: 200 });
  const modelCostBreakdown = getCostBreakdown(db, { groupBy: "model", sessionKey });

  return { ...summary, runs, subagents, messages, modelCostBreakdown };
}

export type GetCostBreakdownOptions = {
  groupBy?: CostGroupBy;
  since?: number;
  until?: number;
  agentId?: string;
  sessionKey?: string;
  limit?: number;
};

/**
 * Get cost breakdown grouped by the specified dimension.
 */
export function getCostBreakdown(db: Db, opts: GetCostBreakdownOptions = {}): CostBreakdown[] {
  const { groupBy = "model", since, until, agentId, sessionKey, limit = 50 } = opts;

  let groupExpr: string;
  let needsRunsJoin = false;

  switch (groupBy) {
    case "model":
      groupExpr = "mc.model";
      break;
    case "provider":
      groupExpr = "mc.provider";
      break;
    case "session":
      groupExpr = "mc.session_key";
      break;
    case "day":
      groupExpr = "date(mc.ts / 1000, 'unixepoch')";
      break;
    case "agent":
      groupExpr = "r.agent_id";
      needsRunsJoin = true;
      break;
  }

  if (agentId) needsRunsJoin = true;

  const fromClause = needsRunsJoin
    ? "model_calls mc JOIN runs r ON mc.run_id = r.run_id"
    : "model_calls mc";

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (agentId) {
    conditions.push("r.agent_id = ?");
    params.push(agentId);
  }
  if (sessionKey) {
    conditions.push("mc.session_key = ?");
    params.push(sessionKey);
  }
  if (since !== undefined) {
    conditions.push("mc.ts >= ?");
    params.push(since);
  }
  if (until !== undefined) {
    conditions.push("mc.ts <= ?");
    params.push(until);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `
    SELECT
      ${groupExpr} as group_key,
      COUNT(*) as call_count,
      COALESCE(SUM(mc.input_tokens), 0) as input_tokens,
      COALESCE(SUM(mc.output_tokens), 0) as output_tokens,
      COALESCE(SUM(mc.total_tokens), 0) as total_tokens,
      COALESCE(SUM(mc.cost_usd), 0) as total_cost_usd
    FROM ${fromClause}
    ${where}
    GROUP BY ${groupExpr}
    ORDER BY total_cost_usd DESC
    LIMIT ?
  `;
  params.push(limit);

  const rows = db.prepare<unknown[], CostRow>(sql).all(...params);
  return rows.map((r) => ({
    groupKey: r.group_key ?? "unknown",
    callCount: r.call_count,
    inputTokens: r.input_tokens ?? 0,
    outputTokens: r.output_tokens ?? 0,
    totalTokens: r.total_tokens ?? 0,
    totalCostUsd: r.total_cost_usd ?? 0,
  }));
}

export type ListSubagentsOptions = {
  parentSessionKey?: string;
  runId?: string;
  agentId?: string;
  limit?: number;
};

/**
 * List subagent spawns with optional filters.
 */
export function listSubagents(db: Db, opts: ListSubagentsOptions = {}): SubagentSummary[] {
  const { parentSessionKey, runId, agentId, limit = 50 } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (parentSessionKey) {
    conditions.push("parent_session_key = ?");
    params.push(parentSessionKey);
  }
  if (runId) {
    conditions.push("run_id = ?");
    params.push(runId);
  }
  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT * FROM subagents ${where} ORDER BY started_at DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare<unknown[], SubagentRow>(sql).all(...params);
  return rows.map(rowToSubagentSummary);
}

/**
 * Get recursive subagent hierarchy tree for a session. Max depth 10.
 */
export function getSubagentTree(db: Db, sessionKey: string): SubagentTreeNode[] {
  const sql = `
    WITH RECURSIVE tree AS (
      SELECT *, 0 as depth
      FROM subagents
      WHERE parent_session_key = ?
      UNION ALL
      SELECT s.id, s.run_id, s.parent_session_key, s.child_session_key,
             s.agent_id, s.task, s.label, s.model,
             s.started_at, s.ended_at, s.duration_ms, s.outcome,
             t.depth + 1 as depth
      FROM subagents s
      JOIN tree t ON s.parent_session_key = t.child_session_key
      WHERE t.depth < 10
    )
    SELECT * FROM tree ORDER BY started_at ASC
  `;

  type TreeRow = SubagentRow & { depth: number };
  const rows = db.prepare<unknown[], TreeRow>(sql).all(sessionKey);
  return rows.map((r) => ({
    ...rowToSubagentSummary(r),
    depth: r.depth,
  }));
}

export type ListMessagesOptions = {
  sessionKey?: string;
  direction?: "inbound" | "outbound";
  channel?: string;
  agentId?: string;
  limit?: number;
};

/**
 * List messages with optional filters.
 */
export function listMessages(db: Db, opts: ListMessagesOptions = {}): MessageSummary[] {
  const { sessionKey, direction, channel, agentId, limit = 50 } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (sessionKey) {
    conditions.push("session_key = ?");
    params.push(sessionKey);
  }
  if (direction) {
    conditions.push("direction = ?");
    params.push(direction);
  }
  if (channel) {
    conditions.push("channel = ?");
    params.push(channel);
  }
  if (agentId) {
    conditions.push("session_key IN (SELECT DISTINCT session_key FROM runs WHERE agent_id = ?)");
    params.push(agentId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT * FROM messages ${where} ORDER BY ts DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare<unknown[], MessageRow>(sql).all(...params);
  return rows.map(rowToMessageSummary);
}

export type ListErrorsOptions = {
  since?: number;
  sessionKey?: string;
  runId?: string;
  agentId?: string;
  limit?: number;
};

/**
 * List errors across runs and tool calls via UNION ALL.
 */
export function listErrors(db: Db, opts: ListErrorsOptions = {}): ErrorEntry[] {
  const { since, sessionKey, runId, agentId, limit = 50 } = opts;

  // Build conditions for both halves of the union
  const runConds: string[] = ["error IS NOT NULL"];
  const toolConds: string[] = ["is_error = 1"];
  const runParams: unknown[] = [];
  const toolParams: unknown[] = [];

  if (since !== undefined) {
    runConds.push("COALESCE(ended_at, started_at) >= ?");
    runParams.push(since);
    toolConds.push("COALESCE(ended_at, started_at) >= ?");
    toolParams.push(since);
  }
  if (sessionKey) {
    runConds.push("session_key = ?");
    runParams.push(sessionKey);
    toolConds.push("session_key = ?");
    toolParams.push(sessionKey);
  }
  if (runId) {
    runConds.push("run_id = ?");
    runParams.push(runId);
    toolConds.push("run_id = ?");
    toolParams.push(runId);
  }
  if (agentId) {
    runConds.push("agent_id = ?");
    runParams.push(agentId);
    toolConds.push("run_id IN (SELECT run_id FROM runs WHERE agent_id = ?)");
    toolParams.push(agentId);
  }

  const runWhere = `WHERE ${runConds.join(" AND ")}`;
  const toolWhere = `WHERE ${toolConds.join(" AND ")}`;

  const sql = `
    SELECT * FROM (
      SELECT
        COALESCE(ended_at, started_at) as ts,
        'run' as source,
        run_id as context_id,
        session_key,
        error as error_text
      FROM runs
      ${runWhere}
      UNION ALL
      SELECT
        COALESCE(ended_at, started_at) as ts,
        'tool' as source,
        run_id as context_id,
        session_key,
        COALESCE(error, tool_name || ' failed') as error_text
      FROM tool_calls
      ${toolWhere}
    )
    ORDER BY ts DESC
    LIMIT ?
  `;
  const params = [...runParams, ...toolParams, limit];

  const rows = db.prepare<unknown[], ErrorRow>(sql).all(...params);
  return rows.map((r) => ({
    ts: r.ts,
    source: r.source as "run" | "tool",
    contextId: r.context_id ?? null,
    sessionKey: r.session_key ?? null,
    errorText: r.error_text,
  }));
}

export type GetLeaderboardOptions = {
  since?: number;
  agentId?: string;
  limit?: number;
};

/**
 * Get top-N leaderboard for the specified dimension.
 */
export function getLeaderboard(
  db: Db,
  dimension: LeaderboardDimension,
  opts: GetLeaderboardOptions = {},
): LeaderboardEntry[] {
  const { since, agentId, limit = 10 } = opts;

  let sql: string;
  const params: unknown[] = [];

  switch (dimension) {
    case "runs": {
      const conditions: string[] = [];
      if (since !== undefined) {
        conditions.push("r.started_at >= ?");
        params.push(since);
      }
      if (agentId) {
        conditions.push("r.agent_id = ?");
        params.push(agentId);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      sql = `
        SELECT
          r.run_id as key,
          1 as count,
          COALESCE(r.total_tokens, 0) as total_tokens,
          COALESCE((SELECT SUM(mc.cost_usd) FROM model_calls mc WHERE mc.run_id = r.run_id), 0) as total_cost_usd,
          COALESCE(r.duration_ms, 0) as total_duration_ms
        FROM runs r ${where}
        ORDER BY total_cost_usd DESC LIMIT ?
      `;
      break;
    }
    case "tools": {
      const conditions: string[] = [];
      if (since !== undefined) {
        conditions.push("started_at >= ?");
        params.push(since);
      }
      if (agentId) {
        conditions.push("run_id IN (SELECT run_id FROM runs WHERE agent_id = ?)");
        params.push(agentId);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      sql = `
        SELECT
          tool_name as key,
          COUNT(*) as count,
          0 as total_tokens,
          0 as total_cost_usd,
          COALESCE(SUM(duration_ms), 0) as total_duration_ms
        FROM tool_calls ${where}
        GROUP BY tool_name
        ORDER BY count DESC LIMIT ?
      `;
      break;
    }
    case "models": {
      const conditions: string[] = [];
      if (since !== undefined) {
        conditions.push("mc.ts >= ?");
        params.push(since);
      }
      if (agentId) {
        conditions.push("mc.run_id IN (SELECT run_id FROM runs WHERE agent_id = ?)");
        params.push(agentId);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      sql = `
        SELECT
          mc.model as key,
          COUNT(*) as count,
          COALESCE(SUM(mc.total_tokens), 0) as total_tokens,
          COALESCE(SUM(mc.cost_usd), 0) as total_cost_usd,
          COALESCE(SUM(mc.duration_ms), 0) as total_duration_ms
        FROM model_calls mc ${where}
        GROUP BY mc.model
        ORDER BY total_cost_usd DESC LIMIT ?
      `;
      break;
    }
    case "sessions": {
      const conditions: string[] = [];
      if (since !== undefined) {
        conditions.push("mc.ts >= ?");
        params.push(since);
      }
      if (agentId) {
        conditions.push("mc.run_id IN (SELECT run_id FROM runs WHERE agent_id = ?)");
        params.push(agentId);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      sql = `
        SELECT
          mc.session_key as key,
          COUNT(*) as count,
          COALESCE(SUM(mc.total_tokens), 0) as total_tokens,
          COALESCE(SUM(mc.cost_usd), 0) as total_cost_usd,
          COALESCE(SUM(mc.duration_ms), 0) as total_duration_ms
        FROM model_calls mc ${where}
        GROUP BY mc.session_key
        ORDER BY total_cost_usd DESC LIMIT ?
      `;
      break;
    }
  }

  params.push(limit);
  const rows = db.prepare<unknown[], LeaderboardRow>(sql).all(...params);
  return rows.map((r) => ({
    key: r.key ?? "unknown",
    count: r.count,
    totalTokens: r.total_tokens ?? 0,
    totalCostUsd: r.total_cost_usd ?? 0,
    totalDurationMs: r.total_duration_ms ?? 0,
  }));
}
