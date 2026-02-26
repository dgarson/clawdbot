import React, { useState } from "react";
import { cn } from "../lib/utils";

type MigrationStatus = "applied" | "pending" | "failed" | "rolled-back" | "running";
type MigrationType = "schema" | "data" | "index" | "constraint" | "seed";

interface Migration {
  id: string;
  version: string;
  name: string;
  type: MigrationType;
  status: MigrationStatus;
  appliedAt?: string;
  duration?: number; // ms
  author: string;
  description: string;
  upSql: string;
  downSql: string;
  affectedTables: string[];
  reversible: boolean;
  checksum: string;
  environment: string[];
}

interface MigrationRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  migrationsApplied: number;
  migrationsSkipped: number;
  migrationsFailed: number;
  environment: string;
  triggeredBy: string;
  log: string[];
}

const MIGRATIONS: Migration[] = [
  {
    id: "m001", version: "20260120001", name: "create_agents_table",
    type: "schema", status: "applied", appliedAt: "2026-01-20T09:00:00Z", duration: 142,
    author: "Sam", description: "Create the core agents table with UUID primary key, name, model, config JSONB, and timestamps",
    upSql: `CREATE TABLE agents (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name TEXT NOT NULL,\n  model TEXT NOT NULL,\n  config JSONB DEFAULT '{}',\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);`,
    downSql: `DROP TABLE agents;`,
    affectedTables: ["agents"], reversible: true, checksum: "a1b2c3d4", environment: ["dev", "staging", "production"],
  },
  {
    id: "m002", version: "20260122001", name: "create_sessions_table",
    type: "schema", status: "applied", appliedAt: "2026-01-22T10:15:00Z", duration: 89,
    author: "Sam", description: "Create sessions table with FK to agents, status enum, and message history JSONB",
    upSql: `CREATE TYPE session_status AS ENUM ('active', 'idle', 'closed', 'error');\nCREATE TABLE sessions (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,\n  status session_status DEFAULT 'active',\n  context JSONB DEFAULT '{}',\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);`,
    downSql: `DROP TABLE sessions;\nDROP TYPE session_status;`,
    affectedTables: ["sessions"], reversible: true, checksum: "e5f6a7b8", environment: ["dev", "staging", "production"],
  },
  {
    id: "m003", version: "20260128001", name: "add_agents_org_id",
    type: "schema", status: "applied", appliedAt: "2026-01-28T14:30:00Z", duration: 67,
    author: "Reed", description: "Add org_id column to agents for multi-tenant support",
    upSql: `ALTER TABLE agents ADD COLUMN org_id UUID REFERENCES organizations(id);\nCREATE INDEX idx_agents_org_id ON agents(org_id);`,
    downSql: `DROP INDEX idx_agents_org_id;\nALTER TABLE agents DROP COLUMN org_id;`,
    affectedTables: ["agents"], reversible: true, checksum: "c9d0e1f2", environment: ["dev", "staging", "production"],
  },
  {
    id: "m004", version: "20260201001", name: "create_model_invocations_table",
    type: "schema", status: "applied", appliedAt: "2026-02-01T08:00:00Z", duration: 201,
    author: "Sam", description: "High-volume invocations table with partitioning by month for performance",
    upSql: `CREATE TABLE model_invocations (\n  id UUID NOT NULL,\n  session_id UUID NOT NULL REFERENCES sessions(id),\n  model TEXT NOT NULL,\n  input_tokens INT,\n  output_tokens INT,\n  latency_ms INT,\n  cost_usd NUMERIC(10,6),\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n) PARTITION BY RANGE (created_at);`,
    downSql: `DROP TABLE model_invocations;`,
    affectedTables: ["model_invocations"], reversible: true, checksum: "g3h4i5j6", environment: ["dev", "staging", "production"],
  },
  {
    id: "m005", version: "20260205001", name: "backfill_agent_display_names",
    type: "data", status: "applied", appliedAt: "2026-02-05T11:45:00Z", duration: 4320,
    author: "Luis", description: "Backfill display_name from legacy name column, trimming whitespace and applying title case",
    upSql: `UPDATE agents\nSET display_name = initcap(trim(name))\nWHERE display_name IS NULL;`,
    downSql: `-- Not reversible: original data preserved in name column`,
    affectedTables: ["agents"], reversible: false, checksum: "k7l8m9n0", environment: ["staging", "production"],
  },
  {
    id: "m006", version: "20260210001", name: "add_webhook_delivery_index",
    type: "index", status: "applied", appliedAt: "2026-02-10T03:00:00Z", duration: 8940,
    author: "Sam", description: "Add composite index on webhook_deliveries (webhook_id, status, created_at) for faster delivery log queries",
    upSql: `CREATE INDEX CONCURRENTLY idx_webhook_deliveries_composite\nON webhook_deliveries(webhook_id, status, created_at DESC);`,
    downSql: `DROP INDEX CONCURRENTLY idx_webhook_deliveries_composite;`,
    affectedTables: ["webhook_deliveries"], reversible: true, checksum: "o1p2q3r4", environment: ["dev", "staging", "production"],
  },
  {
    id: "m007", version: "20260215001", name: "add_sessions_context_search",
    type: "index", status: "applied", appliedAt: "2026-02-15T04:00:00Z", duration: 12100,
    author: "Quinn", description: "Add GIN index on sessions.context JSONB for fast key lookups",
    upSql: `CREATE INDEX CONCURRENTLY idx_sessions_context_gin\nON sessions USING GIN(context);`,
    downSql: `DROP INDEX CONCURRENTLY idx_sessions_context_gin;`,
    affectedTables: ["sessions"], reversible: true, checksum: "s5t6u7v8", environment: ["dev", "staging", "production"],
  },
  {
    id: "m008", version: "20260218001", name: "add_agent_soft_delete",
    type: "schema", status: "applied", appliedAt: "2026-02-18T09:00:00Z", duration: 154,
    author: "Reed", description: "Add deleted_at timestamp for soft deletes on agents table",
    upSql: `ALTER TABLE agents ADD COLUMN deleted_at TIMESTAMPTZ;\nCREATE INDEX idx_agents_deleted_at ON agents(deleted_at) WHERE deleted_at IS NOT NULL;`,
    downSql: `DROP INDEX idx_agents_deleted_at;\nALTER TABLE agents DROP COLUMN deleted_at;`,
    affectedTables: ["agents"], reversible: true, checksum: "w9x0y1z2", environment: ["dev", "staging", "production"],
  },
  {
    id: "m009", version: "20260222001", name: "add_invocation_error_column",
    type: "schema", status: "pending", author: "Sam",
    description: "Add structured error JSONB column to model_invocations for better failure analysis",
    upSql: `ALTER TABLE model_invocations ADD COLUMN error_details JSONB;\nCOMMENT ON COLUMN model_invocations.error_details IS 'Structured error info: {code, message, retryable}';`,
    downSql: `ALTER TABLE model_invocations DROP COLUMN error_details;`,
    affectedTables: ["model_invocations"], reversible: true, checksum: "a3b4c5d6", environment: ["dev", "staging", "production"],
  },
  {
    id: "m010", version: "20260222002", name: "create_cost_allocations_table",
    type: "schema", status: "pending", author: "Quinn",
    description: "New table for tracking cost attribution by org, project, and agent",
    upSql: `CREATE TABLE cost_allocations (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  org_id UUID NOT NULL REFERENCES organizations(id),\n  agent_id UUID REFERENCES agents(id),\n  model TEXT NOT NULL,\n  period DATE NOT NULL,\n  tokens_used BIGINT DEFAULT 0,\n  cost_usd NUMERIC(12,6) DEFAULT 0,\n  UNIQUE(org_id, agent_id, model, period)\n);`,
    downSql: `DROP TABLE cost_allocations;`,
    affectedTables: ["cost_allocations"], reversible: true, checksum: "e7f8g9h0", environment: ["dev", "staging", "production"],
  },
  {
    id: "m011", version: "20260222003", name: "migrate_legacy_webhook_format",
    type: "data", status: "pending", author: "Sam",
    description: "Transform legacy webhook payload format from v1 to v2 schema (adds envelope wrapper)",
    upSql: `UPDATE webhook_deliveries\nSET payload = jsonb_build_object(\n  'version', 2,\n  'event', payload->'event',\n  'data', payload->'data',\n  'timestamp', payload->>'timestamp'\n)\nWHERE (payload->>'version')::int < 2 OR payload->>'version' IS NULL;`,
    downSql: `-- Version downgrade not supported for data migrations`,
    affectedTables: ["webhook_deliveries"], reversible: false, checksum: "i1j2k3l4", environment: ["dev"],
  },
];

const RUNS: MigrationRun[] = [
  {
    id: "run-3", startedAt: "2026-02-18T09:00:00Z", completedAt: "2026-02-18T09:00:04Z",
    migrationsApplied: 1, migrationsSkipped: 7, migrationsFailed: 0,
    environment: "production", triggeredBy: "Reed",
    log: [
      "[09:00:00] Connecting to postgres://prod-db.internal:5432/clawdbot",
      "[09:00:00] Running migration check...",
      "[09:00:00] 7 migrations already applied",
      "[09:00:00] 1 pending migration found",
      "[09:00:00] ▶ Applying 20260218001_add_agent_soft_delete...",
      "[09:00:04] ✓ Applied in 154ms",
      "[09:00:04] ✓ All migrations up to date",
    ],
  },
  {
    id: "run-2", startedAt: "2026-02-15T04:00:00Z", completedAt: "2026-02-15T04:00:16Z",
    migrationsApplied: 1, migrationsSkipped: 6, migrationsFailed: 0,
    environment: "production", triggeredBy: "deploy-bot",
    log: [
      "[04:00:00] Connecting to postgres://prod-db.internal:5432/clawdbot",
      "[04:00:00] 6 migrations already applied, 1 pending",
      "[04:00:00] ▶ Applying 20260215001_add_sessions_context_search...",
      "[04:00:16] ✓ Applied in 12.1s (CONCURRENTLY)",
    ],
  },
];

const STATUS_CONFIG: Record<MigrationStatus, { label: string; color: string; bg: string; icon: string }> = {
  applied:      { label: "Applied",      color: "text-emerald-400", bg: "bg-emerald-900/30 border-emerald-800", icon: "✅" },
  pending:      { label: "Pending",      color: "text-amber-400",   bg: "bg-amber-900/30 border-amber-800",    icon: "⏳" },
  failed:       { label: "Failed",       color: "text-rose-400",    bg: "bg-rose-900/30 border-rose-800",      icon: "❌" },
  "rolled-back": { label: "Rolled Back", color: "text-zinc-400",    bg: "bg-zinc-800 border-zinc-700",         icon: "↩️" },
  running:      { label: "Running",      color: "text-sky-400",     bg: "bg-sky-900/30 border-sky-800",        icon: "🔄" },
};

const TYPE_CONFIG: Record<MigrationType, { label: string; color: string; icon: string }> = {
  schema:     { label: "Schema",     color: "text-indigo-400", icon: "🗂️" },
  data:       { label: "Data",       color: "text-sky-400",    icon: "📦" },
  index:      { label: "Index",      color: "text-purple-400", icon: "🔍" },
  constraint: { label: "Constraint", color: "text-orange-400", icon: "🔗" },
  seed:       { label: "Seed",       color: "text-teal-400",   icon: "🌱" },
};

type Tab = "migrations" | "runs" | "schema";

export default function MigrationManager() {
  const [tab, setTab] = useState<Tab>("migrations");
  const [selectedMigration, setSelectedMigration] = useState<Migration | null>(null);
  const [statusFilter, setStatusFilter] = useState<MigrationStatus | "all">("all");
  const [showSql, setShowSql] = useState<"up" | "down" | null>(null);
  const [selectedRun, setSelectedRun] = useState<MigrationRun | null>(null);

  const applied = MIGRATIONS.filter(m => m.status === "applied").length;
  const pending = MIGRATIONS.filter(m => m.status === "pending").length;
  const failed  = MIGRATIONS.filter(m => m.status === "failed").length;

  const filteredMigrations = MIGRATIONS.filter(m => statusFilter === "all" || m.status === statusFilter);

  const tabs: { id: Tab; label: string }[] = [
    { id: "migrations", label: "📋 Migrations" },
    { id: "runs",       label: "▶ Run History" },
    { id: "schema",     label: "🗂️ Schema Info" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Migration Manager</h1>
            <p className="text-zinc-400 text-sm mt-1">Database migration tracking — clawdbot PostgreSQL</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("px-3 py-1.5 text-sm rounded-lg border font-mono", pending > 0 ? "border-amber-800 text-amber-400 bg-amber-900/20" : "border-emerald-800 text-emerald-400 bg-emerald-900/20")}>
              {pending > 0 ? `${pending} pending` : "✅ Up to date"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Applied",  value: applied,            color: "text-emerald-400", bg: "border-emerald-900 bg-emerald-900/10" },
            { label: "Pending",  value: pending,            color: "text-amber-400",   bg: "border-amber-900 bg-amber-900/10" },
            { label: "Total",    value: MIGRATIONS.length,  color: "text-white",       bg: "border-zinc-800 bg-zinc-900/50" },
          ].map(s => (
            <div key={s.label} className={cn("border rounded-lg p-4", s.bg)}>
              <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-800 mb-5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
              tab === t.id ? "text-white bg-zinc-800 border border-b-0 border-zinc-700" : "text-zinc-400 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Migrations Tab */}
      {tab === "migrations" && (
        <div>
          <div className="flex gap-1 mb-4">
            {(["all", "applied", "pending", "failed"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1 text-xs rounded-lg border transition-colors",
                  statusFilter === s ? "bg-zinc-700 border-zinc-600 text-white" : "border-zinc-800 text-zinc-500 hover:text-white"
                )}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s].label}
                <span className="ml-1 text-zinc-600">
                  ({s === "all" ? MIGRATIONS.length : MIGRATIONS.filter(m => m.status === s).length})
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredMigrations.map(m => (
              <div
                key={m.id}
                onClick={() => setSelectedMigration(selectedMigration?.id === m.id ? null : m)}
                className={cn(
                  "bg-zinc-900 border rounded-lg p-4 cursor-pointer transition-colors",
                  selectedMigration?.id === m.id ? "border-indigo-600" : "border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg shrink-0 mt-0.5">{STATUS_CONFIG[m.status].icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs text-zinc-500">{m.version}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded border", STATUS_CONFIG[m.status].color, STATUS_CONFIG[m.status].bg)}>
                        {STATUS_CONFIG[m.status].label}
                      </span>
                      <span className={cn("text-xs", TYPE_CONFIG[m.type].color)}>
                        {TYPE_CONFIG[m.type].icon} {TYPE_CONFIG[m.type].label}
                      </span>
                      {!m.reversible && <span className="text-xs text-orange-400">⚠️ Irreversible</span>}
                      <span className="text-xs text-zinc-500 ml-auto">by {m.author}</span>
                    </div>
                    <div className="font-mono text-sm text-white">{m.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{m.description}</div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-zinc-600">
                      {m.appliedAt && <span>Applied {new Date(m.appliedAt).toLocaleDateString()}</span>}
                      {m.duration && <span>⏱️ {m.duration >= 1000 ? `${(m.duration/1000).toFixed(1)}s` : `${m.duration}ms`}</span>}
                      <span>Tables: {m.affectedTables.join(", ")}</span>
                    </div>
                  </div>
                </div>

                {selectedMigration?.id === m.id && (
                  <div className="mt-4 border-t border-zinc-800 pt-4 space-y-3" onClick={e => e.stopPropagation()}>
                    {/* SQL buttons */}
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => setShowSql(showSql === "up" ? null : "up")}
                        className={cn("px-3 py-1.5 text-xs rounded-lg border transition-colors", showSql === "up" ? "bg-indigo-600 border-indigo-500 text-white" : "border-zinc-700 text-zinc-400 hover:text-white")}
                      >
                        ▲ UP Migration SQL
                      </button>
                      {m.reversible && (
                        <button
                          onClick={() => setShowSql(showSql === "down" ? null : "down")}
                          className={cn("px-3 py-1.5 text-xs rounded-lg border transition-colors", showSql === "down" ? "bg-rose-700 border-rose-600 text-white" : "border-zinc-700 text-zinc-400 hover:text-white")}
                        >
                          ▼ DOWN (Rollback) SQL
                        </button>
                      )}
                    </div>

                    {showSql && (
                      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre">
                        {showSql === "up" ? m.upSql : m.downSql}
                      </pre>
                    )}

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-zinc-500 mb-1">Checksum</div>
                        <div className="font-mono text-zinc-300">{m.checksum}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 mb-1">Environments</div>
                        <div className="flex gap-1 flex-wrap">
                          {m.environment.map(env => (
                            <span key={env} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">{env}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500 mb-1">Reversible</div>
                        <div className={m.reversible ? "text-emerald-400" : "text-rose-400"}>
                          {m.reversible ? "✅ Yes" : "❌ No"}
                        </div>
                      </div>
                    </div>

                    {m.status === "pending" && (
                      <div className="flex gap-2 mt-2">
                        <button className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">
                          ▶ Apply Migration
                        </button>
                        <button className="px-4 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors">
                          Dry Run
                        </button>
                      </div>
                    )}
                    {m.status === "applied" && m.reversible && (
                      <button className="px-4 py-1.5 text-sm border border-rose-800 hover:bg-rose-900/30 rounded-lg text-rose-400 transition-colors">
                        ↩️ Rollback This Migration
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run History Tab */}
      {tab === "runs" && (
        <div className="space-y-4">
          {pending > 0 && (
            <div className="bg-amber-900/20 border border-amber-900 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-amber-300">{pending} pending migrations</div>
                <div className="text-xs text-zinc-400 mt-0.5">Run migrations to bring the database up to date</div>
              </div>
              <button className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium text-white transition-colors">
                ▶ Run Pending
              </button>
            </div>
          )}

          {RUNS.map(run => (
            <div
              key={run.id}
              onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
              className={cn(
                "bg-zinc-900 border rounded-lg p-4 cursor-pointer transition-colors",
                selectedRun?.id === run.id ? "border-indigo-600" : "border-zinc-800 hover:border-zinc-700"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <div>
                    <div className="text-sm font-medium text-white">
                      {run.migrationsApplied} applied, {run.migrationsSkipped} skipped
                    </div>
                    <div className="text-xs text-zinc-500">{new Date(run.startedAt).toLocaleString()} · {run.environment} · by {run.triggeredBy}</div>
                  </div>
                </div>
                <span className="text-xs text-zinc-500">{run.id}</span>
              </div>

              {selectedRun?.id === run.id && (
                <div className="mt-3 bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs space-y-0.5">
                  {run.log.map((line, i) => (
                    <div key={i} className={cn("", line.includes("✓") ? "text-emerald-400" : line.includes("▶") ? "text-indigo-400" : "text-zinc-500")}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Schema Info */}
      {tab === "schema" && (
        <div className="space-y-4">
          <div className="text-sm text-zinc-400 mb-4">Tables touched by tracked migrations</div>
          {Array.from(new Set(MIGRATIONS.flatMap(m => m.affectedTables))).map(table => {
            const tableMigrations = MIGRATIONS.filter(m => m.affectedTables.includes(table));
            const lastApplied = tableMigrations.filter(m => m.status === "applied").toSorted((a, b) => (b.version > a.version ? 1 : -1))[0];
            return (
              <div key={table} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-mono text-white text-sm">{table}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{tableMigrations.length} migrations · last modified {lastApplied?.appliedAt ? new Date(lastApplied.appliedAt).toLocaleDateString() : "never"}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tableMigrations.map(m => (
                    <div key={m.id} className="flex items-center gap-1.5 bg-zinc-800 rounded px-2 py-1 text-xs">
                      <span>{STATUS_CONFIG[m.status].icon}</span>
                      <span className="font-mono text-zinc-300">{m.name}</span>
                      <span className={cn(TYPE_CONFIG[m.type].color)}>{TYPE_CONFIG[m.type].icon}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
