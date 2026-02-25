import React, { useState } from "react";
import { cn } from "../lib/utils";

type MigrationStatus = "pending" | "running" | "completed" | "failed" | "rolled_back";
type MigrationEnv = "development" | "staging" | "production";
type ChangeType = "create_table" | "alter_table" | "drop_table" | "add_index" | "add_column" | "drop_column" | "data_migration";

interface MigrationChange {
  type: ChangeType;
  description: string;
  table: string;
  reversible: boolean;
}

interface Migration {
  id: string;
  version: string;
  name: string;
  description: string;
  author: string;
  status: MigrationStatus;
  env: MigrationEnv;
  changes: MigrationChange[];
  upSql: string;
  downSql: string;
  appliedAt: string | null;
  duration: number | null;
  rowsAffected: number | null;
  checksum: string;
  createdAt: string;
}

interface SchemaTable {
  name: string;
  rowCount: number;
  sizeBytes: number;
  columns: number;
  indexes: number;
  lastMigration: string;
}

interface RunLog {
  id: string;
  migrationVersion: string;
  migrationName: string;
  env: MigrationEnv;
  action: "up" | "down";
  status: MigrationStatus;
  startedAt: string;
  duration: number;
  rowsAffected: number;
  output: string;
  triggeredBy: string;
}

const statusBadge: Record<MigrationStatus, string> = {
  pending:      "bg-[var(--color-surface-3)]/30 text-[var(--color-text-primary)] border border-[var(--color-surface-3)]/40",
  running:      "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  completed:    "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  failed:       "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  rolled_back:  "bg-amber-500/20 text-amber-300 border border-amber-500/30",
};

const statusDot: Record<MigrationStatus, string> = {
  pending:      "bg-[var(--color-surface-3)]",
  running:      "bg-blue-400 animate-pulse",
  completed:    "bg-emerald-400",
  failed:       "bg-rose-400",
  rolled_back:  "bg-amber-400",
};

const envBadge: Record<MigrationEnv, string> = {
  development: "bg-primary/20 text-indigo-300 border border-primary/30",
  staging:     "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  production:  "bg-rose-500/20 text-rose-300 border border-rose-500/30",
};

const changeTypeIcon: Record<ChangeType, string> = {
  create_table:    "🆕",
  alter_table:     "✏️",
  drop_table:      "🗑️",
  add_index:       "📇",
  add_column:      "➕",
  drop_column:     "➖",
  data_migration:  "🔄",
};

const MIGRATIONS: Migration[] = [
  {
    id: "m-001",
    version: "20260222_001",
    name: "add_ai_model_configs_table",
    description: "Creates the ai_model_configs table to store per-tenant model routing configuration",
    author: "tim@clawdbot.io",
    status: "completed",
    env: "production",
    changes: [
      { type: "create_table", description: "Create ai_model_configs table", table: "ai_model_configs", reversible: true },
      { type: "add_index", description: "Index on tenant_id + model_name", table: "ai_model_configs", reversible: true },
    ],
    upSql: "CREATE TABLE ai_model_configs (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  tenant_id UUID NOT NULL REFERENCES tenants(id),\n  model_name VARCHAR(100) NOT NULL,\n  provider VARCHAR(50) NOT NULL,\n  config JSONB NOT NULL DEFAULT '{}',\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\nCREATE INDEX idx_ai_model_configs_tenant ON ai_model_configs(tenant_id, model_name);",
    downSql: "DROP INDEX idx_ai_model_configs_tenant;\nDROP TABLE ai_model_configs;",
    appliedAt: "2026-02-22T08:15:00Z",
    duration: 234,
    rowsAffected: 0,
    checksum: "a3f9b2c1d8e4",
    createdAt: "2026-02-21",
  },
  {
    id: "m-002",
    version: "20260222_002",
    name: "add_webhook_retry_columns",
    description: "Adds retry tracking columns to the webhooks table",
    author: "sam@clawdbot.io",
    status: "completed",
    env: "production",
    changes: [
      { type: "add_column", description: "Add retry_count column", table: "webhooks", reversible: true },
      { type: "add_column", description: "Add next_retry_at column", table: "webhooks", reversible: true },
      { type: "add_column", description: "Add last_error column", table: "webhooks", reversible: true },
      { type: "add_index", description: "Index on next_retry_at for queue processing", table: "webhooks", reversible: true },
    ],
    upSql: "ALTER TABLE webhooks\n  ADD COLUMN retry_count INT NOT NULL DEFAULT 0,\n  ADD COLUMN next_retry_at TIMESTAMPTZ,\n  ADD COLUMN last_error TEXT;\nCREATE INDEX idx_webhooks_retry ON webhooks(next_retry_at) WHERE next_retry_at IS NOT NULL;",
    downSql: "DROP INDEX idx_webhooks_retry;\nALTER TABLE webhooks\n  DROP COLUMN retry_count,\n  DROP COLUMN next_retry_at,\n  DROP COLUMN last_error;",
    appliedAt: "2026-02-22T09:00:00Z",
    duration: 1840,
    rowsAffected: 47382,
    checksum: "b8c3d9e2f1a5",
    createdAt: "2026-02-21",
  },
  {
    id: "m-003",
    version: "20260221_001",
    name: "backfill_user_metadata",
    description: "Data migration: backfill user metadata from legacy user_profiles table",
    author: "xavier@clawdbot.io",
    status: "completed",
    env: "production",
    changes: [
      { type: "data_migration", description: "Backfill metadata from user_profiles into users.metadata JSONB", table: "users", reversible: false },
    ],
    upSql: "UPDATE users u\nSET metadata = jsonb_build_object(\n  'avatar_url', up.avatar_url,\n  'bio', up.bio,\n  'timezone', up.timezone\n)\nFROM user_profiles up\nWHERE u.id = up.user_id\n  AND u.metadata IS NULL;",
    downSql: "-- Not reversible: data migration",
    appliedAt: "2026-02-21T22:00:00Z",
    duration: 12450,
    rowsAffected: 83241,
    checksum: "c4e7f1a2b9d6",
    createdAt: "2026-02-20",
  },
  {
    id: "m-004",
    version: "20260222_003",
    name: "create_session_recordings_table",
    description: "Creates session_recordings table for session replay feature",
    author: "wes@clawdbot.io",
    status: "running",
    env: "staging",
    changes: [
      { type: "create_table", description: "Create session_recordings table", table: "session_recordings", reversible: true },
      { type: "create_table", description: "Create session_events table", table: "session_events", reversible: true },
      { type: "add_index", description: "Composite index on tenant_id + user_id + started_at", table: "session_recordings", reversible: true },
    ],
    upSql: "CREATE TABLE session_recordings (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  tenant_id UUID NOT NULL,\n  user_id UUID NOT NULL,\n  started_at TIMESTAMPTZ NOT NULL,\n  ended_at TIMESTAMPTZ,\n  page_count INT DEFAULT 0,\n  duration_ms INT\n);",
    downSql: "DROP TABLE session_events;\nDROP TABLE session_recordings;",
    appliedAt: null,
    duration: null,
    rowsAffected: null,
    checksum: "d5f8a3b0c7e1",
    createdAt: "2026-02-22",
  },
  {
    id: "m-005",
    version: "20260222_004",
    name: "add_cost_attribution_indexes",
    description: "Performance indexes for cost attribution queries",
    author: "quinn@clawdbot.io",
    status: "pending",
    env: "staging",
    changes: [
      { type: "add_index", description: "GIN index on resource_tags JSONB", table: "cloud_resources", reversible: true },
      { type: "add_index", description: "Composite index on team_id + month", table: "cost_allocations", reversible: true },
    ],
    upSql: "CREATE INDEX CONCURRENTLY idx_cloud_resources_tags ON cloud_resources USING GIN(tags);\nCREATE INDEX CONCURRENTLY idx_cost_allocations_team_month ON cost_allocations(team_id, month);",
    downSql: "DROP INDEX idx_cloud_resources_tags;\nDROP INDEX idx_cost_allocations_team_month;",
    appliedAt: null,
    duration: null,
    rowsAffected: null,
    checksum: "e9a1b4c6d2f0",
    createdAt: "2026-02-22",
  },
  {
    id: "m-006",
    version: "20260218_001",
    name: "drop_legacy_api_logs_table",
    description: "Remove deprecated api_logs table replaced by observability pipeline",
    author: "tim@clawdbot.io",
    status: "failed",
    env: "production",
    changes: [
      { type: "drop_table", description: "Drop api_logs table", table: "api_logs", reversible: false },
    ],
    upSql: "DROP TABLE IF EXISTS api_logs;",
    downSql: "-- Table drop not reversible without backup",
    appliedAt: null,
    duration: 45,
    rowsAffected: null,
    checksum: "f2b5c8e3a7d4",
    createdAt: "2026-02-18",
  },
];

const SCHEMA_TABLES: SchemaTable[] = [
  { name: "users", rowCount: 94821, sizeBytes: 124_850_000, columns: 18, indexes: 5, lastMigration: "20260215_002" },
  { name: "tenants", rowCount: 1284, sizeBytes: 2_450_000, columns: 12, indexes: 3, lastMigration: "20260210_001" },
  { name: "webhooks", rowCount: 47382, sizeBytes: 38_200_000, columns: 14, indexes: 4, lastMigration: "20260222_002" },
  { name: "ai_model_configs", rowCount: 3847, sizeBytes: 4_100_000, columns: 7, indexes: 2, lastMigration: "20260222_001" },
  { name: "agent_sessions", rowCount: 2_841_029, sizeBytes: 8_920_000_000, columns: 22, indexes: 8, lastMigration: "20260201_003" },
  { name: "cost_allocations", rowCount: 158_443, sizeBytes: 211_000_000, columns: 15, indexes: 3, lastMigration: "20260210_002" },
  { name: "cloud_resources", rowCount: 28_441, sizeBytes: 94_200_000, columns: 24, indexes: 6, lastMigration: "20260215_001" },
  { name: "audit_events", rowCount: 4_291_847, sizeBytes: 14_800_000_000, columns: 11, indexes: 4, lastMigration: "20260101_001" },
];

const RUN_LOGS: RunLog[] = [
  { id: "rl-01", migrationVersion: "20260222_002", migrationName: "add_webhook_retry_columns", env: "production", action: "up", status: "completed", startedAt: "2026-02-22 09:00:00", duration: 1840, rowsAffected: 47382, output: "Migration applied successfully. 47382 rows updated.", triggeredBy: "deploy@ci" },
  { id: "rl-02", migrationVersion: "20260222_001", migrationName: "add_ai_model_configs_table", env: "production", action: "up", status: "completed", startedAt: "2026-02-22 08:15:00", duration: 234, rowsAffected: 0, output: "Table created. Index created. Migration applied.", triggeredBy: "deploy@ci" },
  { id: "rl-03", migrationVersion: "20260218_001", migrationName: "drop_legacy_api_logs_table", env: "production", action: "up", status: "failed", startedAt: "2026-02-18 14:00:00", duration: 45, rowsAffected: 0, output: "ERROR: table api_logs has dependent objects: VIEW legacy_api_summary. Use DROP ... CASCADE or drop the dependent objects first.", triggeredBy: "deploy@ci" },
  { id: "rl-04", migrationVersion: "20260221_001", migrationName: "backfill_user_metadata", env: "production", action: "up", status: "completed", startedAt: "2026-02-21 22:00:00", duration: 12450, rowsAffected: 83241, output: "UPDATE 83241. Batch processing complete.", triggeredBy: "xavier@clawdbot.io" },
];

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) {return `${(bytes / 1_000_000_000).toFixed(1)}GB`;}
  if (bytes >= 1_000_000) {return `${(bytes / 1_000_000).toFixed(0)}MB`;}
  return `${(bytes / 1_000).toFixed(0)}KB`;
}

const maxTableSize = Math.max(...SCHEMA_TABLES.map(t => t.sizeBytes));

export default function DatabaseMigrationManager() {
  const [tab, setTab] = useState<"migrations" | "schema" | "history" | "run">("migrations");
  const [selectedMig, setSelectedMig] = useState<Migration>(MIGRATIONS[0]);
  const [sqlView, setSqlView] = useState<"up" | "down">("up");
  const [envFilter, setEnvFilter] = useState<MigrationEnv | "all">("all");

  const filteredMigrations = envFilter === "all" ? MIGRATIONS : MIGRATIONS.filter(m => m.env === envFilter);

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Database Migration Manager</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Schema versioning · Rollback · Audit</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[var(--color-text-secondary)]">{MIGRATIONS.filter(m => m.status === "completed").length} applied</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-surface-3)]" />
              <span className="text-[var(--color-text-secondary)]">{MIGRATIONS.filter(m => m.status === "pending").length} pending</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="text-[var(--color-text-secondary)]">{MIGRATIONS.filter(m => m.status === "failed").length} failed</span>
            </span>
          </div>
          <button className="px-3 py-1.5 bg-primary hover:bg-primary rounded text-sm font-medium transition-colors">
            Run Pending
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] px-6">
        {(["migrations", "schema", "history", "run"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t ? "border-primary text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t === "run" ? "Run Console" : t}
          </button>
        ))}
      </div>

      {/* Migrations Tab */}
      {tab === "migrations" && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-80 border-r border-[var(--color-border)] flex flex-col">
            <div className="p-3 border-b border-[var(--color-border)] flex gap-1.5">
              {(["all", "development", "staging", "production"] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setEnvFilter(e)}
                  className={cn(
                    "text-xs px-2 py-0.5 rounded border transition-colors capitalize",
                    envFilter === e
                      ? e === "all" ? "bg-[var(--color-surface-3)] border-[var(--color-surface-3)] text-[var(--color-text-primary)]" : envBadge[e as MigrationEnv]
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredMigrations.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMig(m)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)]/40 transition-colors",
                    selectedMig.id === m.id && "bg-[var(--color-surface-2)]/60"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusDot[m.status])} />
                    <span className="text-xs font-mono text-[var(--color-text-secondary)]">{m.version}</span>
                    <span className={cn("ml-auto text-xs px-1.5 py-0.5 rounded-full", envBadge[m.env])}>{m.env.slice(0, 4)}</span>
                  </div>
                  <div className="text-xs font-mono text-[var(--color-text-primary)] mb-1 truncate">{m.name}</div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <span className={cn("px-1.5 py-0.5 rounded-full", statusBadge[m.status])}>{m.status.replace("_", " ")}</span>
                    {m.duration !== null && <span>{m.duration}ms</span>}
                    {m.rowsAffected !== null && <span>{m.rowsAffected.toLocaleString()} rows</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Migration Detail */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-mono text-lg font-semibold mb-1">{selectedMig.name}</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-[var(--color-text-secondary)]">{selectedMig.version}</span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs", statusBadge[selectedMig.status])}>{selectedMig.status.replace("_", " ")}</span>
                  <span className={cn("px-2 py-0.5 rounded text-xs", envBadge[selectedMig.env])}>{selectedMig.env}</span>
                </div>
              </div>
              {(selectedMig.status === "pending" || selectedMig.status === "failed") && (
                <button className="px-3 py-1.5 bg-primary hover:bg-primary rounded text-sm font-medium transition-colors">
                  Run Up
                </button>
              )}
              {selectedMig.status === "completed" && (
                <button className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-600/40 rounded text-sm font-medium transition-colors">
                  Rollback
                </button>
              )}
            </div>

            <p className="text-sm text-[var(--color-text-secondary)] mb-4">{selectedMig.description}</p>

            {/* Meta */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-[var(--color-surface-1)] rounded p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Author</div>
                <div className="text-xs font-mono text-[var(--color-text-primary)] truncate">{selectedMig.author}</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Created</div>
                <div className="text-xs text-[var(--color-text-primary)]">{selectedMig.createdAt}</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Duration</div>
                <div className="text-xs font-mono text-[var(--color-text-primary)]">{selectedMig.duration !== null ? `${selectedMig.duration}ms` : "—"}</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Rows Affected</div>
                <div className="text-xs font-mono text-[var(--color-text-primary)]">{selectedMig.rowsAffected !== null ? selectedMig.rowsAffected.toLocaleString() : "—"}</div>
              </div>
            </div>

            {/* Changes */}
            <div className="mb-4">
              <div className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Changes ({selectedMig.changes.length})</div>
              <div className="space-y-1.5">
                {selectedMig.changes.map((c, i) => (
                  <div key={i} className="bg-[var(--color-surface-1)] rounded p-3 flex items-center gap-3">
                    <span className="text-sm">{changeTypeIcon[c.type]}</span>
                    <div className="flex-1">
                      <span className="text-xs text-[var(--color-text-primary)]">{c.description}</span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-2">on <span className="font-mono text-[var(--color-text-secondary)]">{c.table}</span></span>
                    </div>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded", c.reversible ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10")}>
                      {c.reversible ? "reversible" : "irreversible"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* SQL */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">SQL</div>
                <div className="flex rounded overflow-hidden border border-[var(--color-border)]">
                  <button onClick={() => setSqlView("up")} className={cn("px-2 py-0.5 text-xs transition-colors", sqlView === "up" ? "bg-primary text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")}>UP</button>
                  <button onClick={() => setSqlView("down")} className={cn("px-2 py-0.5 text-xs transition-colors", sqlView === "down" ? "bg-amber-600 text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")}>DOWN</button>
                </div>
              </div>
              <pre className="bg-[var(--color-surface-1)] rounded p-4 text-xs font-mono text-[var(--color-text-primary)] overflow-x-auto whitespace-pre-wrap">
                {sqlView === "up" ? selectedMig.upSql : selectedMig.downSql}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Schema Tab */}
      {tab === "schema" && (
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-1">Schema Overview</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">Tables tracked by migration system (production)</p>
          <div className="space-y-2">
            {SCHEMA_TABLES.map(t => (
              <div key={t.name} className="bg-[var(--color-surface-1)] rounded-lg p-4">
                <div className="flex items-center gap-4 mb-2">
                  <span className="font-mono text-sm font-medium text-[var(--color-text-primary)]">{t.name}</span>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] ml-auto">
                    <span>{t.columns} cols</span>
                    <span>{t.indexes} idx</span>
                    <span className="font-mono">{t.rowCount.toLocaleString()} rows</span>
                    <span className="font-mono text-amber-400">{formatBytes(t.sizeBytes)}</span>
                  </div>
                </div>
                <div className="w-full bg-[var(--color-surface-2)] rounded-full h-1.5 mb-1">
                  <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(t.sizeBytes / maxTableSize) * 100}%` }} />
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">Last migration: {t.lastMigration}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-4">Run History</h2>
          <div className="space-y-3">
            {RUN_LOGS.map(log => (
              <div key={log.id} className="bg-[var(--color-surface-1)] rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold", log.action === "up" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300")}>
                        {log.action.toUpperCase()}
                      </span>
                      <span className="font-mono text-sm text-[var(--color-text-primary)]">{log.migrationName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                      <span className="font-mono">{log.migrationVersion}</span>
                      <span className={cn("px-1.5 py-0.5 rounded-full", envBadge[log.env])}>{log.env}</span>
                      <span>by {log.triggeredBy}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBadge[log.status])}>{log.status}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{log.startedAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)] mb-2">
                  <span>Duration: <span className="font-mono text-[var(--color-text-primary)]">{log.duration}ms</span></span>
                  {log.rowsAffected > 0 && <span>Rows: <span className="font-mono text-[var(--color-text-primary)]">{log.rowsAffected.toLocaleString()}</span></span>}
                </div>
                <pre className={cn("text-xs font-mono rounded p-2 whitespace-pre-wrap", log.status === "failed" ? "bg-rose-500/10 text-rose-300" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]")}>
                  {log.output}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run Console Tab */}
      {tab === "run" && (
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-1">Run Console</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">Execute migrations manually with environment selection</p>
          <div className="bg-[var(--color-surface-1)] rounded-lg p-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">Target Environment</label>
                <select className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-primary">
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">Migration</label>
                <select className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-primary">
                  {MIGRATIONS.filter(m => m.status === "pending" || m.status === "failed").map(m => (
                    <option key={m.id} value={m.id}>{m.version} — {m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mb-6">
              <button className="flex-1 py-2.5 bg-primary hover:bg-primary rounded text-sm font-medium transition-colors">
                ▶ Run Up (Apply)
              </button>
              <button className="flex-1 py-2.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-600/40 rounded text-sm font-medium transition-colors">
                ↩ Run Down (Rollback)
              </button>
            </div>
            <div className="bg-[var(--color-surface-0)] rounded p-4 min-h-32">
              <div className="text-xs text-[var(--color-text-muted)] font-mono">Awaiting execution...</div>
              <div className="text-xs text-emerald-400 font-mono mt-1">$ ./migrate --env=staging --version=20260222_003 up</div>
              <div className="text-xs text-[var(--color-text-primary)] font-mono mt-1">Connecting to staging database...</div>
              <div className="text-xs text-[var(--color-text-primary)] font-mono">Running migration 20260222_003...</div>
              <div className="animate-pulse text-xs text-blue-400 font-mono">Processing...</div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Pending Migrations</h3>
            {MIGRATIONS.filter(m => m.status === "pending").map(m => (
              <div key={m.id} className="flex items-center gap-3 bg-[var(--color-surface-1)] rounded p-3 mb-2">
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">{m.version}</span>
                <span className="font-mono text-xs text-[var(--color-text-primary)]">{m.name}</span>
                <span className={cn("ml-auto text-xs px-1.5 py-0.5 rounded", envBadge[m.env])}>{m.env}</span>
              </div>
            ))}
            {MIGRATIONS.filter(m => m.status === "pending").length === 0 && (
              <div className="text-sm text-[var(--color-text-muted)]">All migrations applied</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
