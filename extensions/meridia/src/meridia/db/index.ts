// Types from backend interface
export type {
  BackendConfig,
  BackendFactory,
  BackendHealthCheck,
  BackendHealthStatus,
  IsolationLevel,
  MeridiaBackendType,
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
} from "./backend.js";

// Backend management
export {
  backendRegistry,
  closeBackend,
  closeBackendAsync,
  createBackend,
  createBackendAsync,
  getCachedBackend,
  isBackendReady,
  resolveMeridiaDbPath,
} from "./backends/index.js";

// SQLite backend
export { createSqliteBackend, SqliteBackend } from "./backends/sqlite.js";

// PostgreSQL backend
export { createPostgresBackend, PostgresBackend } from "./backends/postgresql.js";
export type { PostgresBackendConfig } from "./backends/postgresql.js";
