/**
 * PostgreSQL backend for Meridia experience storage.
 * Implements MeridiaDbBackend using pg (node-postgres) with connection pooling,
 * tsvector-based full-text search, and proper transaction support.
 */

import type { Pool, PoolClient, PoolConfig } from "pg";
import type { MeridiaExperienceRecord, MeridiaTraceEvent } from "../../types.js";
import type {
  BackendHealthCheck,
  MeridiaDbBackend,
  MeridiaDbStats,
  MeridiaSessionListItem,
  MeridiaSessionSummary,
  MeridiaToolStatsItem,
  MeridiaTransaction,
  PoolStats,
  RecordQueryFilters,
  RecordQueryResult,
  TransactionOptions,
} from "../backend.js";
import { sanitizeExperienceRecord } from "../../sanitize/record.js";

// ────────────────────────────────────────────────────────────────────────────
// Text Helpers
// ────────────────────────────────────────────────────────────────────────────

function clampText(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  return `${input.slice(0, Math.max(0, maxChars - 12))}…(truncated)`;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildSearchableText(record: MeridiaExperienceRecord): string {
  const parts: string[] = [];
  if (record.tool?.name) parts.push(record.tool.name);
  if (record.tool?.meta) parts.push(record.tool.meta);
  if (record.capture?.evaluation?.reason) parts.push(record.capture.evaluation.reason);
  if (record.content?.topic) parts.push(record.content.topic);
  if (record.content?.summary) parts.push(record.content.summary);
  if (record.content?.context) parts.push(record.content.context);
  if (record.content?.tags?.length) parts.push(record.content.tags.join(" "));
  if (record.content?.anchors?.length) parts.push(record.content.anchors.join(" "));
  const phenom = record.phenomenology ?? record.content?.phenomenology;
  if (phenom?.emotionalSignature?.primary?.length) {
    parts.push(phenom.emotionalSignature.primary.join(" "));
  }
  if (phenom?.engagementQuality) parts.push(phenom.engagementQuality);
  if (phenom?.anchors?.length) parts.push(phenom.anchors.map((a) => a.phrase).join(" "));
  if (phenom?.uncertainties?.length) parts.push(phenom.uncertainties.join(" "));
  if (record.data?.args !== undefined)
    parts.push(clampText(safeJsonStringify(record.data.args), 500));
  if (record.data?.result !== undefined)
    parts.push(clampText(safeJsonStringify(record.data.result), 1000));
  return parts.join(" ");
}

function toPgVectorLiteral(embedding: Float32Array): string {
  const values = Array.from(embedding, (value) => {
    if (!Number.isFinite(value)) {
      return "0";
    }
    return String(value);
  });
  return `[${values.join(",")}]`;
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number.parseInt(typeof value === "string" ? value : "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

// ────────────────────────────────────────────────────────────────────────────
// Schema DDL
// ────────────────────────────────────────────────────────────────────────────

const SCHEMA_DDL = `
-- Meridia experience records
CREATE TABLE IF NOT EXISTS meridia_records (
  id TEXT PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,
  session_key TEXT,
  session_id TEXT,
  run_id TEXT,
  tool_name TEXT,
  tool_call_id TEXT,
  is_error BOOLEAN DEFAULT FALSE,
  score DOUBLE PRECISION,
  threshold DOUBLE PRECISION,
  eval_kind TEXT,
  eval_model TEXT,
  eval_reason TEXT,
  tags_json JSONB,
  data_json JSONB NOT NULL,
  data_text TEXT,
  memory_type TEXT,
  classification_json JSONB,
  emotional_primary TEXT,
  emotional_intensity DOUBLE PRECISION,
  emotional_valence DOUBLE PRECISION,
  engagement_quality TEXT,
  phenomenology_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(tool_name, '') || ' ' ||
      coalesce(eval_reason, '') || ' ' ||
      coalesce(data_text, '')
    )
  ) STORED
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_meridia_records_ts ON meridia_records(ts);
CREATE INDEX IF NOT EXISTS idx_meridia_records_session_key ON meridia_records(session_key);
CREATE INDEX IF NOT EXISTS idx_meridia_records_tool_name ON meridia_records(tool_name);
CREATE INDEX IF NOT EXISTS idx_meridia_records_score ON meridia_records(score);
CREATE INDEX IF NOT EXISTS idx_meridia_records_kind ON meridia_records(kind);
CREATE INDEX IF NOT EXISTS idx_meridia_records_engagement ON meridia_records(engagement_quality);
CREATE INDEX IF NOT EXISTS idx_meridia_records_emotional_intensity ON meridia_records(emotional_intensity);
CREATE INDEX IF NOT EXISTS idx_meridia_records_search ON meridia_records USING GIN(search_vector);

-- Trace events
CREATE TABLE IF NOT EXISTS meridia_trace (
  id TEXT PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,
  session_key TEXT,
  data_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meridia_trace_ts ON meridia_trace(ts);
CREATE INDEX IF NOT EXISTS idx_meridia_trace_kind ON meridia_trace(kind);
CREATE INDEX IF NOT EXISTS idx_meridia_trace_session_key ON meridia_trace(session_key);

-- Metadata / KV store
CREATE TABLE IF NOT EXISTS meridia_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ────────────────────────────────────────────────────────────────────────────
// PostgreSQL Transaction
// ────────────────────────────────────────────────────────────────────────────

/**
 * PostgreSQL-backed transaction implementing the MeridiaTransaction interface.
 *
 * Note: MeridiaTransaction insert methods are synchronous in the interface.
 * For PostgreSQL, we enqueue async queries and flush them on commit/rollback.
 */
class PgTransaction implements MeridiaTransaction {
  private client: PoolClient;
  private committed = false;
  private rolledBack = false;
  private pending: Array<Promise<unknown>> = [];

  constructor(client: PoolClient) {
    this.client = client;
  }

  private checkActive(): void {
    if (this.committed || this.rolledBack) {
      throw new Error("Transaction is no longer active");
    }
  }

  private enqueue(p: Promise<unknown>): void {
    this.pending.push(
      p.catch((err) => {
        // Ensure commit will fail and trigger rollback if any query fails.
        throw err;
      }),
    );
  }

  insertExperienceRecord(record: MeridiaExperienceRecord): boolean {
    this.checkActive();
    this.enqueue(this.client.query(INSERT_RECORD_SQL, buildRecordParams(record)));
    return true;
  }

  insertExperienceRecordsBatch(records: MeridiaExperienceRecord[]): number {
    this.checkActive();
    for (const record of records) {
      this.enqueue(this.client.query(INSERT_RECORD_SQL, buildRecordParams(record)));
    }
    return records.length;
  }

  insertTraceEvent(event: MeridiaTraceEvent): boolean {
    this.checkActive();
    this.enqueue(this.client.query(INSERT_TRACE_SQL, buildTraceParams(event)));
    return true;
  }

  insertTraceEventsBatch(events: MeridiaTraceEvent[]): number {
    this.checkActive();
    for (const event of events) {
      this.enqueue(this.client.query(INSERT_TRACE_SQL, buildTraceParams(event)));
    }
    return events.length;
  }

  setMeta(key: string, value: string): void {
    this.checkActive();
    this.enqueue(
      this.client.query(
        `INSERT INTO meridia_meta (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [key, value],
      ),
    );
  }

  async commit(): Promise<void> {
    this.checkActive();
    try {
      if (this.pending.length > 0) {
        await Promise.all(this.pending);
      }
      await this.client.query("COMMIT");
      this.committed = true;
    } finally {
      this.client.release();
    }
  }

  async rollback(): Promise<void> {
    if (this.committed) {
      throw new Error("Cannot rollback a committed transaction");
    }
    if (!this.rolledBack) {
      try {
        await this.client.query("ROLLBACK");
      } catch {
        // ignore
      }
      this.rolledBack = true;
      this.client.release();
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Filter Helpers
// ────────────────────────────────────────────────────────────────────────────

function buildFilterClause(
  filters?: RecordQueryFilters,
  startParam = 1,
): { where: string; params: unknown[]; nextParam: number } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = startParam;

  if (filters?.sessionKey) {
    conditions.push(`r.session_key = $${p++}`);
    params.push(filters.sessionKey);
  }
  if (filters?.toolName) {
    conditions.push(`r.tool_name = $${p++}`);
    params.push(filters.toolName);
  }
  if (filters?.minScore !== undefined) {
    conditions.push(`r.score >= $${p++}`);
    params.push(filters.minScore);
  }
  if (filters?.from) {
    conditions.push(`r.ts >= $${p++}`);
    params.push(filters.from);
  }
  if (filters?.to) {
    conditions.push(`r.ts <= $${p++}`);
    params.push(filters.to);
  }
  if (filters?.tag) {
    // JSONB array contains check
    conditions.push(`r.tags_json @> $${p++}::jsonb`);
    params.push(JSON.stringify([filters.tag]));
  }
  if (filters?.memoryType) {
    conditions.push(`r.memory_type = $${p++}`);
    params.push(filters.memoryType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params, nextParam: p };
}

// ────────────────────────────────────────────────────────────────────────────
// Insert Helpers
// ────────────────────────────────────────────────────────────────────────────

const INSERT_RECORD_SQL = `
  INSERT INTO meridia_records (
    id, ts, kind, session_key, session_id, run_id,
    tool_name, tool_call_id, is_error,
    score, threshold, eval_kind, eval_model, eval_reason,
    tags_json, data_json, data_text,
    memory_type, classification_json,
    emotional_primary, emotional_intensity, emotional_valence,
    engagement_quality, phenomenology_json
  ) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9,
    $10, $11, $12, $13, $14,
    $15, $16, $17,
    $18, $19,
    $20, $21, $22,
    $23, $24
  ) ON CONFLICT (id) DO NOTHING
`;

function buildRecordParams(record: MeridiaExperienceRecord): unknown[] {
  const sanitizedRecord = sanitizeExperienceRecord(record);
  const dataText = buildSearchableText(sanitizedRecord);
  const tagsJson = sanitizedRecord.content?.tags?.length
    ? JSON.stringify(sanitizedRecord.content.tags)
    : null;
  const evaluation = sanitizedRecord.capture.evaluation;
  const classificationJson = sanitizedRecord.classification
    ? JSON.stringify(sanitizedRecord.classification)
    : null;
  const phenom = sanitizedRecord.phenomenology;
  const emotionalPrimary = phenom?.emotionalSignature?.primary?.join(",") ?? null;
  const emotionalIntensity = phenom?.emotionalSignature?.intensity ?? null;
  const emotionalValence = phenom?.emotionalSignature?.valence ?? null;
  const engagementQuality = phenom?.engagementQuality ?? null;
  const phenomenologyJson = phenom ? JSON.stringify(phenom) : null;

  return [
    sanitizedRecord.id,
    sanitizedRecord.ts,
    sanitizedRecord.kind,
    sanitizedRecord.session?.key ?? null,
    sanitizedRecord.session?.id ?? null,
    sanitizedRecord.session?.runId ?? null,
    sanitizedRecord.tool?.name ?? null,
    sanitizedRecord.tool?.callId ?? null,
    sanitizedRecord.tool?.isError ?? false,
    sanitizedRecord.capture.score,
    sanitizedRecord.capture.threshold ?? null,
    evaluation.kind,
    evaluation.model ?? null,
    evaluation.reason ?? null,
    tagsJson,
    JSON.stringify(sanitizedRecord),
    dataText,
    sanitizedRecord.memoryType ?? null,
    classificationJson,
    emotionalPrimary,
    emotionalIntensity,
    emotionalValence,
    engagementQuality,
    phenomenologyJson,
  ];
}

const INSERT_TRACE_SQL = `
  INSERT INTO meridia_trace (id, ts, kind, session_key, data_json)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (id) DO NOTHING
`;

function buildTraceParams(event: MeridiaTraceEvent): unknown[] {
  return [event.id, event.ts, event.kind, event.session?.key ?? null, JSON.stringify(event)];
}

// ────────────────────────────────────────────────────────────────────────────
// PostgreSQL Backend
// ────────────────────────────────────────────────────────────────────────────

export type PostgresBackendConfig = {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
  poolSize?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
};

export class PostgresBackend implements MeridiaDbBackend {
  readonly type = "postgresql" as const;

  private pool: Pool | null = null;
  private config: PostgresBackendConfig;
  private schemaVersion: string | null = null;
  private ftsAvailable = false;
  private initCalled = false;
  vecAvailable = false;
  private embeddingDimensions = 384;

  constructor(config: PostgresBackendConfig) {
    this.config = config;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.initCalled && this.pool) return;

    const pg = await import("pg");
    const PgPool = pg.default?.Pool ?? pg.Pool;

    const poolConfig: PoolConfig = {
      max: this.config.poolSize ?? 10,
      idleTimeoutMillis: this.config.idleTimeoutMs ?? 30_000,
      connectionTimeoutMillis: this.config.connectionTimeoutMs ?? 10_000,
    };

    if (this.config.connectionString) {
      poolConfig.connectionString = this.config.connectionString;
    } else {
      poolConfig.host = this.config.host ?? "localhost";
      poolConfig.port = this.config.port ?? 5432;
      poolConfig.database = this.config.database ?? "meridia";
      poolConfig.user = this.config.user ?? "meridia";
      poolConfig.password = this.config.password;
    }

    if (this.config.ssl) {
      poolConfig.ssl = typeof this.config.ssl === "boolean" ? this.config.ssl : this.config.ssl;
    }

    this.pool = new PgPool(poolConfig);

    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }

    this.initCalled = true;
  }

  async ensureSchema(): Promise<{ ftsAvailable: boolean; ftsError?: string }> {
    this.ensurePool();

    try {
      await this.pool!.query(SCHEMA_DDL);
      this.ftsAvailable = true;

      // Set schema version
      await this.pool!.query(
        `INSERT INTO meridia_meta (key, value) VALUES ('schema_version', '4')
         ON CONFLICT (key) DO UPDATE SET value = '4'`,
      );
      this.schemaVersion = "4";
      await this.pool!.query(
        `INSERT INTO meridia_meta (key, value) VALUES ('vector_enabled', 'pending')
         ON CONFLICT (key) DO NOTHING`,
      );

      return { ftsAvailable: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ftsAvailable: false, ftsError: message };
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch {
        // ignore
      }
      this.pool = null;
    }
    this.initCalled = false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Health & Monitoring
  // ──────────────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<BackendHealthCheck> {
    const start = performance.now();
    try {
      this.ensurePool();
      await this.pool!.query("SELECT 1");
      const latencyMs = performance.now() - start;
      return {
        status: "healthy",
        latencyMs,
        details: {
          type: "postgresql",
          ftsAvailable: this.ftsAvailable,
          schemaVersion: this.schemaVersion,
          pool: this.getPoolStats(),
        },
      };
    } catch (err) {
      return {
        status: "unhealthy",
        latencyMs: performance.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  getPoolStats(): PoolStats | null {
    if (!this.pool) return null;
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      activeConnections: this.pool.totalCount - this.pool.idleCount,
      waitingRequests: this.pool.waitingCount,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Transactions
  // ──────────────────────────────────────────────────────────────────────────

  async beginTransaction(options?: TransactionOptions): Promise<MeridiaTransaction> {
    this.ensurePool();
    const client = await this.pool!.connect();

    let beginSql = "BEGIN";
    if (options?.isolationLevel) {
      const levels: Record<string, string> = {
        read_uncommitted: "READ UNCOMMITTED",
        read_committed: "READ COMMITTED",
        repeatable_read: "REPEATABLE READ",
        serializable: "SERIALIZABLE",
      };
      const level = levels[options.isolationLevel];
      if (level) beginSql = `BEGIN ISOLATION LEVEL ${level}`;
    }
    if (options?.readOnly) {
      beginSql += " READ ONLY";
    }

    await client.query(beginSql);
    return new PgTransaction(client);
  }

  async withTransaction<T>(
    fn: (tx: MeridiaTransaction) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const tx = await this.beginTransaction(options);
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Record Operations
  // ──────────────────────────────────────────────────────────────────────────

  async insertExperienceRecord(record: MeridiaExperienceRecord): Promise<boolean> {
    this.ensurePool();
    const result = await this.pool!.query(INSERT_RECORD_SQL, buildRecordParams(record));
    return (result.rowCount ?? 0) > 0;
  }

  async insertExperienceRecordsBatch(records: MeridiaExperienceRecord[]): Promise<number> {
    if (records.length === 0) return 0;
    this.ensurePool();

    const client = await this.pool!.connect();
    try {
      await client.query("BEGIN");
      let inserted = 0;
      for (const record of records) {
        const result = await client.query(INSERT_RECORD_SQL, buildRecordParams(record));
        if ((result.rowCount ?? 0) > 0) inserted++;
      }
      await client.query("COMMIT");
      return inserted;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async insertTraceEvent(event: MeridiaTraceEvent): Promise<boolean> {
    this.ensurePool();
    const result = await this.pool!.query(INSERT_TRACE_SQL, buildTraceParams(event));
    return (result.rowCount ?? 0) > 0;
  }

  async insertTraceEventsBatch(events: MeridiaTraceEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    this.ensurePool();

    const client = await this.pool!.connect();
    try {
      await client.query("BEGIN");
      let inserted = 0;
      for (const event of events) {
        const result = await client.query(INSERT_TRACE_SQL, buildTraceParams(event));
        if ((result.rowCount ?? 0) > 0) inserted++;
      }
      await client.query("COMMIT");
      return inserted;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async getRecordById(id: string): Promise<RecordQueryResult | null> {
    this.ensurePool();
    const result = await this.pool!.query(`SELECT data_json FROM meridia_records WHERE id = $1`, [
      id,
    ]);
    if (result.rows.length === 0) return null;
    return { record: result.rows[0].data_json as MeridiaExperienceRecord };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Query Operations
  // ──────────────────────────────────────────────────────────────────────────

  async searchRecords(query: string, filters?: RecordQueryFilters): Promise<RecordQueryResult[]> {
    this.ensurePool();
    const trimmed = query.trim();
    if (!trimmed) return [];

    const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
    const { where, params, nextParam } = buildFilterClause(filters);

    // Use ts_query for full-text search
    const tsQuery = trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.replace(/[^\w]/g, ""))
      .filter(Boolean)
      .join(" & ");

    if (this.ftsAvailable && tsQuery) {
      try {
        const ftsParam = nextParam;
        const limitParam = ftsParam + 1;
        const ftsCondition = `r.search_vector @@ to_tsquery('english', $${ftsParam})`;
        const fullWhere = where ? `${where} AND ${ftsCondition}` : `WHERE ${ftsCondition}`;

        const result = await this.pool!.query(
          `SELECT r.data_json,
                  ts_rank(r.search_vector, to_tsquery('english', $${ftsParam})) AS rank
           FROM meridia_records r
           ${fullWhere}
           ORDER BY rank DESC
           LIMIT $${limitParam}`,
          [...params, tsQuery, limit],
        );

        return result.rows.map((row) => ({
          record: row.data_json as MeridiaExperienceRecord,
          rank: row.rank as number,
        }));
      } catch {
        // Fall through to LIKE search
      }
    }

    // Fallback: ILIKE search
    const likeParam = nextParam;
    const limitParam = likeParam + 1;
    const likeCondition = `(r.data_text ILIKE $${likeParam} OR r.eval_reason ILIKE $${likeParam})`;
    const fullWhere = where ? `${where} AND ${likeCondition}` : `WHERE ${likeCondition}`;

    const result = await this.pool!.query(
      `SELECT r.data_json
       FROM meridia_records r
       ${fullWhere}
       ORDER BY r.ts DESC
       LIMIT $${limitParam}`,
      [...params, `%${trimmed}%`, limit],
    );

    return result.rows.map((row) => ({
      record: row.data_json as MeridiaExperienceRecord,
    }));
  }

  async getRecordsByDateRange(
    from: string,
    to: string,
    filters?: RecordQueryFilters,
  ): Promise<RecordQueryResult[]> {
    this.ensurePool();
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 500);
    const merged: RecordQueryFilters = { ...filters, from, to, limit };
    const { where, params, nextParam } = buildFilterClause(merged);

    const result = await this.pool!.query(
      `SELECT r.data_json
       FROM meridia_records r
       ${where}
       ORDER BY r.ts DESC
       LIMIT $${nextParam}`,
      [...params, limit],
    );

    return result.rows.map((row) => ({
      record: row.data_json as MeridiaExperienceRecord,
    }));
  }

  async getRecordsBySession(
    sessionKey: string,
    params?: { limit?: number },
  ): Promise<RecordQueryResult[]> {
    this.ensurePool();
    const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);

    const result = await this.pool!.query(
      `SELECT r.data_json
       FROM meridia_records r
       WHERE r.session_key = $1
       ORDER BY r.ts DESC
       LIMIT $2`,
      [sessionKey, limit],
    );

    return result.rows.map((row) => ({
      record: row.data_json as MeridiaExperienceRecord,
    }));
  }

  async getRecordsByTool(
    toolName: string,
    params?: { limit?: number },
  ): Promise<RecordQueryResult[]> {
    this.ensurePool();
    const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);

    const result = await this.pool!.query(
      `SELECT r.data_json
       FROM meridia_records r
       WHERE r.tool_name = $1
       ORDER BY r.ts DESC
       LIMIT $2`,
      [toolName, limit],
    );

    return result.rows.map((row) => ({
      record: row.data_json as MeridiaExperienceRecord,
    }));
  }

  async getRecentRecords(
    limit: number = 20,
    filters?: Omit<RecordQueryFilters, "limit">,
  ): Promise<RecordQueryResult[]> {
    this.ensurePool();
    const resolved = Math.min(Math.max(limit, 1), 200);
    const { where, params, nextParam } = buildFilterClause(
      filters ? { ...filters, limit: resolved } : { limit: resolved },
    );

    const result = await this.pool!.query(
      `SELECT r.data_json
       FROM meridia_records r
       ${where}
       ORDER BY r.ts DESC
       LIMIT $${nextParam}`,
      [...params, resolved],
    );

    return result.rows.map((row) => ({
      record: row.data_json as MeridiaExperienceRecord,
    }));
  }

  async getTraceEventsByDateRange(
    from: string,
    to: string,
    params?: { kind?: string; limit?: number },
  ): Promise<MeridiaTraceEvent[]> {
    this.ensurePool();
    const limit = Math.min(Math.max(params?.limit ?? 2000, 1), 50_000);
    const kind = params?.kind?.trim();

    if (kind) {
      const result = await this.pool!.query(
        `SELECT data_json FROM meridia_trace
         WHERE ts >= $1 AND ts <= $2 AND kind = $3
         ORDER BY ts DESC LIMIT $4`,
        [from, to, kind, limit],
      );
      return result.rows.map((row) => row.data_json as MeridiaTraceEvent);
    }

    const result = await this.pool!.query(
      `SELECT data_json FROM meridia_trace
       WHERE ts >= $1 AND ts <= $2
       ORDER BY ts DESC LIMIT $3`,
      [from, to, limit],
    );
    return result.rows.map((row) => row.data_json as MeridiaTraceEvent);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Stats & Metadata
  // ──────────────────────────────────────────────────────────────────────────

  async getStats(): Promise<MeridiaDbStats> {
    this.ensurePool();

    const [recordCount, traceCount, sessionCount, oldest, newest] = await Promise.all([
      this.pool!.query(`SELECT COUNT(*) AS cnt FROM meridia_records`),
      this.pool!.query(`SELECT COUNT(*) AS cnt FROM meridia_trace`),
      this.pool!.query(
        `SELECT COUNT(DISTINCT session_key) AS cnt FROM meridia_records WHERE session_key IS NOT NULL`,
      ),
      this.pool!.query(`SELECT MIN(ts) AS ts FROM meridia_records`),
      this.pool!.query(`SELECT MAX(ts) AS ts FROM meridia_records`),
    ]);

    return {
      recordCount: Number(recordCount.rows[0].cnt),
      traceCount: Number(traceCount.rows[0].cnt),
      sessionCount: Number(sessionCount.rows[0].cnt),
      oldestRecord: oldest.rows[0].ts ?? null,
      newestRecord: newest.rows[0].ts ?? null,
      schemaVersion: this.schemaVersion,
    };
  }

  async getToolStats(): Promise<MeridiaToolStatsItem[]> {
    this.ensurePool();
    const result = await this.pool!.query(`
      SELECT
        tool_name,
        COUNT(*) AS cnt,
        AVG(score) AS avg_score,
        SUM(CASE WHEN is_error THEN 1 ELSE 0 END) AS error_count,
        MAX(ts) AS last_used
      FROM meridia_records
      WHERE tool_name IS NOT NULL
      GROUP BY tool_name
      ORDER BY cnt DESC
    `);

    return result.rows.map((row) => ({
      toolName: row.tool_name as string,
      count: Number(row.cnt),
      avgScore: Number(row.avg_score ?? 0),
      errorCount: Number(row.error_count),
      lastUsed: row.last_used as string,
    }));
  }

  async listSessions(params?: {
    limit?: number;
    offset?: number;
  }): Promise<MeridiaSessionListItem[]> {
    this.ensurePool();
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const result = await this.pool!.query(
      `SELECT
        session_key,
        COUNT(*) AS record_count,
        MIN(ts) AS first_ts,
        MAX(ts) AS last_ts
       FROM meridia_records
       WHERE session_key IS NOT NULL
       GROUP BY session_key
       ORDER BY MAX(ts) DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return result.rows.map((row) => ({
      sessionKey: row.session_key as string,
      recordCount: Number(row.record_count),
      firstTs: (row.first_ts as string) ?? null,
      lastTs: (row.last_ts as string) ?? null,
    }));
  }

  async getSessionSummary(sessionKey: string): Promise<MeridiaSessionSummary | null> {
    this.ensurePool();

    const countResult = await this.pool!.query(
      `SELECT COUNT(*) AS cnt FROM meridia_records WHERE session_key = $1`,
      [sessionKey],
    );
    const recordCount = Number(countResult.rows[0].cnt);
    if (recordCount === 0) return null;

    const [firstResult, lastResult, toolResult] = await Promise.all([
      this.pool!.query(
        `SELECT ts FROM meridia_records WHERE session_key = $1 ORDER BY ts ASC LIMIT 1`,
        [sessionKey],
      ),
      this.pool!.query(
        `SELECT ts FROM meridia_records WHERE session_key = $1 ORDER BY ts DESC LIMIT 1`,
        [sessionKey],
      ),
      this.pool!.query(
        `SELECT DISTINCT tool_name FROM meridia_records WHERE session_key = $1 AND tool_name IS NOT NULL`,
        [sessionKey],
      ),
    ]);

    return {
      sessionKey,
      startedAt: firstResult.rows[0]?.ts ?? null,
      endedAt: lastResult.rows[0]?.ts ?? null,
      toolsUsed: toolResult.rows.map((r) => r.tool_name as string).filter(Boolean),
      recordCount,
    };
  }

  async getMeta(key: string): Promise<string | null> {
    this.ensurePool();
    try {
      const result = await this.pool!.query(`SELECT value FROM meridia_meta WHERE key = $1`, [key]);
      if (result.rows.length === 0) return null;
      return result.rows[0].value as string;
    } catch {
      return null;
    }
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.ensurePool();
    await this.pool!.query(
      `INSERT INTO meridia_meta (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [key, value],
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Vector Operations (pgvector)
  // ──────────────────────────────────────────────────────────────────────────

  async loadVectorExtension(
    _extensionPath?: string,
    dims?: number,
  ): Promise<{ ok: boolean; error?: string }> {
    this.ensurePool();
    try {
      const requestedDims =
        typeof dims === "number" && Number.isFinite(dims) ? Math.floor(dims) : 0;
      if (requestedDims > 0) {
        this.embeddingDimensions = requestedDims;
      }

      await this.pool!.query(`CREATE EXTENSION IF NOT EXISTS vector`);

      const existingDimsResult = await this.pool!.query(
        `SELECT value FROM meridia_meta WHERE key = 'vector_dims'`,
      );
      const existingDims = parsePositiveInt(existingDimsResult.rows[0]?.value);
      if (existingDims && existingDims !== this.embeddingDimensions) {
        await this.pool!.query(`DROP TABLE IF EXISTS meridia_vec`);
      }

      await this.pool!.query(
        `CREATE TABLE IF NOT EXISTS meridia_vec (
           record_id TEXT PRIMARY KEY REFERENCES meridia_records(id) ON DELETE CASCADE,
           embedding vector(${this.embeddingDimensions}) NOT NULL,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`,
      );

      try {
        await this.pool!.query(
          `CREATE INDEX IF NOT EXISTS idx_meridia_vec_embedding
             ON meridia_vec USING ivfflat (embedding vector_l2_ops)
             WITH (lists = 100)`,
        );
      } catch {
        // index creation can fail on restricted environments; table remains usable
      }

      await this.pool!.query(
        `INSERT INTO meridia_meta (key, value) VALUES ('vector_enabled', 'true')
         ON CONFLICT (key) DO UPDATE SET value = 'true'`,
      );
      await this.pool!.query(
        `INSERT INTO meridia_meta (key, value) VALUES ('vector_dims', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [String(this.embeddingDimensions)],
      );

      this.vecAvailable = true;
      return { ok: true };
    } catch (err) {
      this.vecAvailable = false;
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async insertEmbedding(recordId: string, embedding: Float32Array): Promise<boolean> {
    if (!this.vecAvailable) {
      return false;
    }
    if (embedding.length !== this.embeddingDimensions) {
      return false;
    }
    this.ensurePool();
    try {
      const literal = toPgVectorLiteral(embedding);
      await this.pool!.query(
        `INSERT INTO meridia_vec (record_id, embedding, updated_at)
         VALUES ($1, $2::vector, NOW())
         ON CONFLICT (record_id)
         DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()`,
        [recordId, literal],
      );
      return true;
    } catch {
      return false;
    }
  }

  async searchByVector(
    embedding: Float32Array,
    limit: number = 20,
  ): Promise<Array<{ recordId: string; distance: number }>> {
    if (!this.vecAvailable) {
      return [];
    }
    if (embedding.length !== this.embeddingDimensions) {
      return [];
    }
    this.ensurePool();
    try {
      const literal = toPgVectorLiteral(embedding);
      const result = await this.pool!.query(
        `SELECT record_id, embedding <-> $1::vector AS distance
         FROM meridia_vec
         ORDER BY embedding <-> $1::vector ASC
         LIMIT $2`,
        [literal, limit],
      );
      return result.rows
        .map((row) => ({
          recordId: String(row.record_id),
          distance: Number(row.distance),
        }))
        .filter((row) => Number.isFinite(row.distance));
    } catch {
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private ensurePool(): asserts this is { pool: Pool } {
    if (!this.pool) {
      throw new Error("PostgreSQL backend not initialized. Call init() first.");
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────────────────────────────────────

export function createPostgresBackend(config: PostgresBackendConfig): PostgresBackend {
  return new PostgresBackend(config);
}
