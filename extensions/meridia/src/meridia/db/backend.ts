import type { MeridiaExperienceRecord, MeridiaTraceEvent } from "../types.js";

// ────────────────────────────────────────────────────────────────────────────
// Query Types
// ────────────────────────────────────────────────────────────────────────────

export type RecordQueryFilters = {
  sessionKey?: string;
  toolName?: string;
  minScore?: number;
  from?: string;
  to?: string;
  limit?: number;
  tag?: string;
};

export type RecordQueryResult = {
  record: MeridiaExperienceRecord;
  rank?: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Stats Types
// ────────────────────────────────────────────────────────────────────────────

export type MeridiaDbStats = {
  recordCount: number;
  traceCount: number;
  sessionCount: number;
  oldestRecord: string | null;
  newestRecord: string | null;
  schemaVersion: string | null;
};

export type MeridiaToolStatsItem = {
  toolName: string;
  count: number;
  avgScore: number;
  errorCount: number;
  lastUsed: string;
};

export type MeridiaSessionListItem = {
  sessionKey: string;
  recordCount: number;
  firstTs: string | null;
  lastTs: string | null;
};

export type MeridiaSessionSummary = {
  sessionKey: string;
  startedAt: string | null;
  endedAt: string | null;
  toolsUsed: string[];
  recordCount: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Health Check Types
// ────────────────────────────────────────────────────────────────────────────

export type BackendHealthStatus = "healthy" | "degraded" | "unhealthy";

export type BackendHealthCheck = {
  status: BackendHealthStatus;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
};

// ────────────────────────────────────────────────────────────────────────────
// Connection Pool Types
// ────────────────────────────────────────────────────────────────────────────

export type PoolStats = {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingRequests: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Transaction Types
// ────────────────────────────────────────────────────────────────────────────

export type IsolationLevel =
  | "read_uncommitted"
  | "read_committed"
  | "repeatable_read"
  | "serializable";

export type TransactionOptions = {
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
  timeoutMs?: number;
};

/**
 * Transaction handle for executing operations within a transaction.
 * Use this to perform batch operations atomically.
 */
export interface MeridiaTransaction {
  /**
   * Insert a single experience record within the transaction.
   */
  insertExperienceRecord(record: MeridiaExperienceRecord): boolean;

  /**
   * Insert multiple experience records within the transaction.
   */
  insertExperienceRecordsBatch(records: MeridiaExperienceRecord[]): number;

  /**
   * Insert a single trace event within the transaction.
   */
  insertTraceEvent(event: MeridiaTraceEvent): boolean;

  /**
   * Insert multiple trace events within the transaction.
   */
  insertTraceEventsBatch(events: MeridiaTraceEvent[]): number;

  /**
   * Set a meta key within the transaction.
   */
  setMeta(key: string, value: string): void;

  /**
   * Commit the transaction.
   */
  commit(): Promise<void>;

  /**
   * Rollback the transaction.
   */
  rollback(): Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// Backend Interface
// ────────────────────────────────────────────────────────────────────────────

/**
 * Backend type identifier for the registry.
 */
export type MeridiaBackendType = "sqlite" | "postgresql";

/**
 * Core interface that all Meridia storage backends must implement.
 * This enables pluggable storage with support for different databases.
 */
export interface MeridiaDbBackend {
  // ──────────────────────────────────────────────────────────────────────────
  // Lifecycle Management
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * The type of this backend (e.g., "sqlite", "postgresql").
   */
  readonly type: MeridiaBackendType;

  /**
   * Initialize the backend and establish connections.
   * Called once during startup. Must be idempotent.
   */
  init(): Promise<void>;

  /**
   * Ensure the database schema is up-to-date.
   * Returns information about FTS (full-text search) availability.
   */
  ensureSchema(): Promise<{ ftsAvailable: boolean; ftsError?: string }>;

  /**
   * Gracefully close the backend, releasing all resources.
   * Called during shutdown.
   */
  close(): Promise<void>;

  // ──────────────────────────────────────────────────────────────────────────
  // Health & Monitoring
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Check the health of the backend connection.
   * Used for monitoring and graceful degradation.
   */
  healthCheck(): Promise<BackendHealthCheck>;

  /**
   * Get connection pool statistics (if applicable).
   * Returns null for backends without connection pooling.
   */
  getPoolStats(): PoolStats | null;

  // ──────────────────────────────────────────────────────────────────────────
  // Transaction Support
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Begin a new transaction with optional configuration.
   * @param options Transaction options (isolation level, read-only, timeout)
   * @returns A transaction handle for executing operations
   */
  beginTransaction(options?: TransactionOptions): Promise<MeridiaTransaction>;

  /**
   * Execute a function within a transaction.
   * Automatically commits on success, rolls back on error.
   * @param fn Function to execute within the transaction
   * @param options Transaction options
   */
  withTransaction<T>(
    fn: (tx: MeridiaTransaction) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>;

  // ──────────────────────────────────────────────────────────────────────────
  // Record Operations
  // ──────────────────────────────────────────────────────────────────────────

  insertExperienceRecord(record: MeridiaExperienceRecord): Promise<boolean>;
  insertExperienceRecordsBatch(records: MeridiaExperienceRecord[]): Promise<number>;

  insertTraceEvent(event: MeridiaTraceEvent): Promise<boolean>;
  insertTraceEventsBatch(events: MeridiaTraceEvent[]): Promise<number>;

  getRecordById(id: string): Promise<RecordQueryResult | null>;

  // ──────────────────────────────────────────────────────────────────────────
  // Query Operations
  // ──────────────────────────────────────────────────────────────────────────

  searchRecords(query: string, filters?: RecordQueryFilters): Promise<RecordQueryResult[]>;
  getRecordsByDateRange(
    from: string,
    to: string,
    filters?: RecordQueryFilters,
  ): Promise<RecordQueryResult[]>;
  getRecordsBySession(
    sessionKey: string,
    params?: { limit?: number },
  ): Promise<RecordQueryResult[]>;
  getRecordsByTool(toolName: string, params?: { limit?: number }): Promise<RecordQueryResult[]>;
  getRecentRecords(
    limit?: number,
    filters?: Omit<RecordQueryFilters, "limit">,
  ): Promise<RecordQueryResult[]>;

  getTraceEventsByDateRange(
    from: string,
    to: string,
    params?: { kind?: string; limit?: number },
  ): Promise<MeridiaTraceEvent[]>;

  // ──────────────────────────────────────────────────────────────────────────
  // Stats & Metadata
  // ──────────────────────────────────────────────────────────────────────────

  getStats(): Promise<MeridiaDbStats>;
  getToolStats(): Promise<MeridiaToolStatsItem[]>;
  listSessions(params?: { limit?: number; offset?: number }): Promise<MeridiaSessionListItem[]>;
  getSessionSummary(sessionKey: string): Promise<MeridiaSessionSummary | null>;

  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// Backend Factory Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for creating a backend instance.
 */
export type BackendConfig = {
  type: MeridiaBackendType;
  sqlite?: {
    dbPath?: string;
    allowAutoWipe?: boolean;
  };
  postgresql?: {
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
};

/**
 * Factory function signature for creating backend instances.
 */
export type BackendFactory = (config: BackendConfig) => MeridiaDbBackend;
