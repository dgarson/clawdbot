import React, { useState } from "react";
import { cn } from "../lib/utils";

type ColumnType = "int" | "bigint" | "varchar" | "text" | "bool" | "timestamp" | "uuid" | "jsonb" | "decimal" | "float" | "date" | "bytea";
type Tab = "tables" | "indexes" | "relations" | "migrations";

interface Column {
  name: string;
  type: ColumnType;
  nullable: boolean;
  default: string | null;
  primary: boolean;
  unique: boolean;
  indexed: boolean;
  fk: { table: string; column: string } | null;
  comment: string | null;
}

interface DBTable {
  id: string;
  name: string;
  schema: string;
  rows: number;
  size: string;
  columns: Column[];
  indexes: DBIndex[];
  description: string;
}

interface DBIndex {
  name: string;
  columns: string[];
  unique: boolean;
  type: "btree" | "hash" | "gin" | "gist";
  size: string;
}

interface DBRelation {
  from: string;
  fromCol: string;
  to: string;
  toCol: string;
  constraint: string;
  onDelete: string;
}

interface Migration {
  id: string;
  version: string;
  name: string;
  appliedAt: string | null;
  duration: string | null;
  author: string;
  status: "applied" | "pending" | "failed";
  changes: string[];
}

const TABLES: DBTable[] = [
  {
    id: "t1", name: "users", schema: "public", rows: 284921, size: "142 MB", description: "Core user accounts and profile data",
    columns: [
      { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()", primary: true, unique: true, indexed: true, fk: null, comment: "Primary key" },
      { name: "email", type: "varchar", nullable: false, default: null, primary: false, unique: true, indexed: true, fk: null, comment: "User email address" },
      { name: "hashed_password", type: "varchar", nullable: false, default: null, primary: false, unique: false, indexed: false, fk: null, comment: null },
      { name: "name", type: "varchar", nullable: true, default: null, primary: false, unique: false, indexed: false, fk: null, comment: null },
      { name: "plan", type: "varchar", nullable: false, default: "'free'", primary: false, unique: false, indexed: true, fk: null, comment: "Subscription tier" },
      { name: "org_id", type: "uuid", nullable: true, default: null, primary: false, unique: false, indexed: true, fk: { table: "organizations", column: "id" }, comment: null },
      { name: "created_at", type: "timestamp", nullable: false, default: "now()", primary: false, unique: false, indexed: true, fk: null, comment: null },
      { name: "last_login", type: "timestamp", nullable: true, default: null, primary: false, unique: false, indexed: false, fk: null, comment: null },
      { name: "metadata", type: "jsonb", nullable: true, default: null, primary: false, unique: false, indexed: false, fk: null, comment: null },
    ],
    indexes: [
      { name: "users_pkey", columns: ["id"], unique: true, type: "btree", size: "8 MB" },
      { name: "users_email_idx", columns: ["email"], unique: true, type: "btree", size: "12 MB" },
      { name: "users_org_id_idx", columns: ["org_id"], unique: false, type: "btree", size: "6 MB" },
      { name: "users_plan_created_idx", columns: ["plan", "created_at"], unique: false, type: "btree", size: "9 MB" },
    ],
  },
  {
    id: "t2", name: "organizations", schema: "public", rows: 12431, size: "18 MB", description: "Organization/team accounts",
    columns: [
      { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()", primary: true, unique: true, indexed: true, fk: null, comment: null },
      { name: "name", type: "varchar", nullable: false, default: null, primary: false, unique: false, indexed: true, fk: null, comment: null },
      { name: "slug", type: "varchar", nullable: false, default: null, primary: false, unique: true, indexed: true, fk: null, comment: "URL-safe identifier" },
      { name: "plan", type: "varchar", nullable: false, default: "'free'", primary: false, unique: false, indexed: false, fk: null, comment: null },
      { name: "created_at", type: "timestamp", nullable: false, default: "now()", primary: false, unique: false, indexed: true, fk: null, comment: null },
      { name: "settings", type: "jsonb", nullable: true, default: "'{}'", primary: false, unique: false, indexed: false, fk: null, comment: null },
    ],
    indexes: [
      { name: "organizations_pkey", columns: ["id"], unique: true, type: "btree", size: "1 MB" },
      { name: "organizations_slug_idx", columns: ["slug"], unique: true, type: "btree", size: "2 MB" },
    ],
  },
  {
    id: "t3", name: "sessions", schema: "public", rows: 4821023, size: "891 MB", description: "User session tokens",
    columns: [
      { name: "token", type: "varchar", nullable: false, default: null, primary: true, unique: true, indexed: true, fk: null, comment: "Session JWT token" },
      { name: "user_id", type: "uuid", nullable: false, default: null, primary: false, unique: false, indexed: true, fk: { table: "users", column: "id" }, comment: null },
      { name: "created_at", type: "timestamp", nullable: false, default: "now()", primary: false, unique: false, indexed: false, fk: null, comment: null },
      { name: "expires_at", type: "timestamp", nullable: false, default: null, primary: false, unique: false, indexed: true, fk: null, comment: null },
      { name: "ip_address", type: "varchar", nullable: true, default: null, primary: false, unique: false, indexed: false, fk: null, comment: null },
      { name: "user_agent", type: "text", nullable: true, default: null, primary: false, unique: false, indexed: false, fk: null, comment: null },
    ],
    indexes: [
      { name: "sessions_pkey", columns: ["token"], unique: true, type: "btree", size: "89 MB" },
      { name: "sessions_user_id_idx", columns: ["user_id"], unique: false, type: "btree", size: "67 MB" },
      { name: "sessions_expires_at_idx", columns: ["expires_at"], unique: false, type: "btree", size: "71 MB" },
    ],
  },
  {
    id: "t4", name: "api_keys", schema: "public", rows: 89234, size: "24 MB", description: "API key credentials",
    columns: [
      { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()", primary: true, unique: true, indexed: true, fk: null, comment: null },
      { name: "user_id", type: "uuid", nullable: false, default: null, primary: false, unique: false, indexed: true, fk: { table: "users", column: "id" }, comment: null },
      { name: "key_hash", type: "varchar", nullable: false, default: null, primary: false, unique: true, indexed: true, fk: null, comment: "bcrypt hash of key" },
      { name: "name", type: "varchar", nullable: false, default: null, primary: false, unique: false, indexed: false, fk: null, comment: null },
      { name: "last_used", type: "timestamp", nullable: true, default: null, primary: false, unique: false, indexed: false, fk: null, comment: null },
      { name: "scopes", type: "text", nullable: false, default: null, primary: false, unique: false, indexed: false, fk: null, comment: "Comma-separated permission scopes" },
      { name: "expires_at", type: "timestamp", nullable: true, default: null, primary: false, unique: false, indexed: true, fk: null, comment: null },
      { name: "created_at", type: "timestamp", nullable: false, default: "now()", primary: false, unique: false, indexed: false, fk: null, comment: null },
    ],
    indexes: [
      { name: "api_keys_pkey", columns: ["id"], unique: true, type: "btree", size: "3 MB" },
      { name: "api_keys_key_hash_idx", columns: ["key_hash"], unique: true, type: "btree", size: "4 MB" },
      { name: "api_keys_user_id_idx", columns: ["user_id"], unique: false, type: "btree", size: "3 MB" },
    ],
  },
  {
    id: "t5", name: "audit_events", schema: "public", rows: 82341023, size: "14.2 GB", description: "Immutable audit log",
    columns: [
      { name: "id", type: "bigint", nullable: false, default: "nextval('audit_events_id_seq')", primary: true, unique: true, indexed: true, fk: null, comment: null },
      { name: "user_id", type: "uuid", nullable: true, default: null, primary: false, unique: false, indexed: true, fk: { table: "users", column: "id" }, comment: null },
      { name: "action", type: "varchar", nullable: false, default: null, primary: false, unique: false, indexed: true, fk: null, comment: null },
      { name: "resource_type", type: "varchar", nullable: true, default: null, primary: false, unique: false, indexed: true, fk: null, comment: null },
      { name: "resource_id", type: "uuid", nullable: true, default: null, primary: false, unique: false, indexed: true, fk: null, comment: null },
      { name: "ip_address", type: "varchar", nullable: true, default: null, primary: false, unique: false, indexed: false, fk: null, comment: null },
      { name: "payload", type: "jsonb", nullable: true, default: null, primary: false, unique: false, indexed: false, fk: null, comment: null },
      { name: "created_at", type: "timestamp", nullable: false, default: "now()", primary: false, unique: false, indexed: true, fk: null, comment: null },
    ],
    indexes: [
      { name: "audit_events_pkey", columns: ["id"], unique: true, type: "btree", size: "1.2 GB" },
      { name: "audit_events_user_created_idx", columns: ["user_id", "created_at"], unique: false, type: "btree", size: "890 MB" },
      { name: "audit_events_action_idx", columns: ["action"], unique: false, type: "btree", size: "710 MB" },
      { name: "audit_events_created_at_idx", columns: ["created_at"], unique: false, type: "btree", size: "640 MB" },
    ],
  },
];

const RELATIONS: DBRelation[] = [
  { from: "users", fromCol: "org_id", to: "organizations", toCol: "id", constraint: "users_org_id_fkey", onDelete: "SET NULL" },
  { from: "sessions", fromCol: "user_id", to: "users", toCol: "id", constraint: "sessions_user_id_fkey", onDelete: "CASCADE" },
  { from: "api_keys", fromCol: "user_id", to: "users", toCol: "id", constraint: "api_keys_user_id_fkey", onDelete: "CASCADE" },
  { from: "audit_events", fromCol: "user_id", to: "users", toCol: "id", constraint: "audit_events_user_id_fkey", onDelete: "SET NULL" },
];

const MIGRATIONS: Migration[] = [
  { id: "m1", version: "20260222143012", name: "add_user_metadata_column", appliedAt: "2h ago", duration: "142ms", author: "platform-team", status: "applied", changes: ["ALTER TABLE users ADD COLUMN metadata jsonb", "CREATE INDEX users_metadata_gin ON users USING gin(metadata)"] },
  { id: "m2", version: "20260220091234", name: "create_audit_events_table", appliedAt: "2d ago", duration: "4.2s", author: "security-team", status: "applied", changes: ["CREATE TABLE audit_events (...)", "CREATE SEQUENCE audit_events_id_seq"] },
  { id: "m3", version: "20260218153445", name: "add_api_key_scopes", appliedAt: "4d ago", duration: "891ms", author: "platform-team", status: "applied", changes: ["ALTER TABLE api_keys ADD COLUMN scopes text NOT NULL DEFAULT 'read'"] },
  { id: "m4", version: "20260222180000", name: "add_org_settings_index", appliedAt: null, duration: null, author: "luis", status: "pending", changes: ["CREATE INDEX org_settings_gin ON organizations USING gin(settings)"] },
  { id: "m5", version: "20260215120000", name: "remove_legacy_auth_table", appliedAt: "7d ago", duration: "23ms", author: "platform-team", status: "applied", changes: ["DROP TABLE IF EXISTS legacy_auth_tokens", "DROP INDEX IF EXISTS legacy_auth_tokens_pkey"] },
];

const typeColor: Record<ColumnType, string> = {
  int: "text-sky-400", bigint: "text-sky-400", varchar: "text-emerald-400", text: "text-emerald-400",
  bool: "text-amber-400", timestamp: "text-primary", uuid: "text-primary",
  jsonb: "text-orange-400", decimal: "text-sky-400", float: "text-sky-400", date: "text-primary", bytea: "text-[var(--color-text-secondary)]",
};

export default function DatabaseSchemaExplorer() {
  const [tab, setTab] = useState<Tab>("tables");
  const [selectedTable, setSelectedTable] = useState<DBTable | null>(TABLES[0]);
  const [expandedMigration, setExpandedMigration] = useState<string | null>(null);

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "tables", label: "Tables", emoji: "🗄️" },
    { id: "indexes", label: "Indexes", emoji: "🔎" },
    { id: "relations", label: "Relations", emoji: "🔗" },
    { id: "migrations", label: "Migrations", emoji: "🚀" },
  ];

  const totalRows = TABLES.reduce((s, t) => s + t.rows, 0);
  const totalIndexes = TABLES.reduce((s, t) => s + t.indexes.length, 0);

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Database Schema Explorer</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">PostgreSQL 16 · prod-db-primary · schema: public</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Connected</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-0 border-b border-[var(--color-border)]">
        {[
          { label: "Tables", value: String(TABLES.length), sub: "in public schema" },
          { label: "Total Rows", value: totalRows.toLocaleString(), sub: "across all tables" },
          { label: "Total Indexes", value: String(totalIndexes), sub: "covering all tables" },
          { label: "Pending Migrations", value: String(MIGRATIONS.filter(m => m.status === "pending").length), sub: "awaiting apply" },
        ].map((stat, i) => (
          <div key={i} className="px-6 py-3 border-r border-[var(--color-border)] last:border-r-0">
            <div className="text-xl font-bold text-[var(--color-text-primary)]">{stat.value}</div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)] mt-0.5">{stat.label}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] px-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id ? "border-primary text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* TABLES TAB */}
        {tab === "tables" && (
          <div className="flex h-full">
            {/* Table list */}
            <div className="w-64 border-r border-[var(--color-border)] overflow-y-auto">
              <div className="p-2 text-xs text-[var(--color-text-muted)] uppercase tracking-wider border-b border-[var(--color-border)] px-4 py-2">
                Tables ({TABLES.length})
              </div>
              {TABLES.map(table => (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-1)] transition-colors",
                    selectedTable?.id === table.id && "bg-[var(--color-surface-2)]"
                  )}
                >
                  <div className="text-sm font-mono text-[var(--color-text-primary)]">{table.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {table.columns.length} cols · {table.rows.toLocaleString()} rows
                  </div>
                </button>
              ))}
            </div>

            {/* Column detail */}
            <div className="flex-1 overflow-y-auto">
              {selectedTable ? (
                <div>
                  <div className="px-6 py-4 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                      <h2 className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{selectedTable.schema}.{selectedTable.name}</h2>
                      <span className="text-xs text-[var(--color-text-muted)]">{selectedTable.size}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{selectedTable.rows.toLocaleString()} rows</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{selectedTable.description}</p>
                  </div>
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/50">
                        <th className="text-left px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Column</th>
                        <th className="text-left px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Type</th>
                        <th className="text-left px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Nullable</th>
                        <th className="text-left px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Default</th>
                        <th className="text-left px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Constraints</th>
                        <th className="text-left px-4 py-2.5 text-[var(--color-text-muted)] font-medium">References</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTable.columns.map(col => (
                        <tr key={col.name} className={cn("border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-1)]/30 transition-colors", col.primary && "bg-primary/3")}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {col.primary && <span className="text-yellow-400 text-xs" title="Primary key">🔑</span>}
                              {col.unique && !col.primary && <span className="text-sky-400 text-xs" title="Unique">U</span>}
                              {col.indexed && !col.primary && !col.unique && <span className="text-[var(--color-text-muted)] text-xs" title="Indexed">I</span>}
                              <span className={cn("font-medium", col.primary ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)]")}>{col.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={typeColor[col.type]}>{col.type}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={col.nullable ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-secondary)]"}>
                              {col.nullable ? "YES" : "NO"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{col.default || "—"}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1">
                              {col.primary && <span className="px-1 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs">PK</span>}
                              {col.unique && !col.primary && <span className="px-1 py-0.5 bg-sky-500/10 text-sky-400 rounded text-xs">UQ</span>}
                              {col.indexed && !col.primary && <span className="px-1 py-0.5 bg-[var(--color-surface-3)]/40 text-[var(--color-text-secondary)] rounded text-xs">IDX</span>}
                              {col.fk && <span className="px-1 py-0.5 bg-primary/10 text-primary rounded text-xs">FK</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                            {col.fk ? (
                              <button
                                className="text-primary hover:text-indigo-300 transition-colors"
                                onClick={() => {
                                  const t = TABLES.find(t => t.name === col.fk?.table);
                                  if (t) {setSelectedTable(t);}
                                }}
                              >
                                {col.fk.table}.{col.fk.column}
                              </button>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">Select a table</div>
              )}
            </div>
          </div>
        )}

        {/* INDEXES TAB */}
        {tab === "indexes" && (
          <div className="p-6">
            {TABLES.map(table => (
              <div key={table.id} className="mb-6">
                <h3 className="font-mono text-sm font-medium text-[var(--color-text-primary)] mb-2">{table.name}</h3>
                <div className="space-y-1">
                  {table.indexes.map(idx => (
                    <div key={idx.name} className="bg-[var(--color-surface-1)] rounded border border-[var(--color-border)] px-4 py-3 flex items-center gap-4 text-xs font-mono">
                      <span className="text-[var(--color-text-secondary)] font-medium w-64 shrink-0">{idx.name}</span>
                      <span className="text-sky-400">{idx.type.toUpperCase()}</span>
                      <span className={cn("px-1.5 py-0.5 rounded", idx.unique ? "bg-yellow-500/10 text-yellow-400" : "bg-[var(--color-surface-3)]/30 text-[var(--color-text-muted)]")}>
                        {idx.unique ? "UNIQUE" : ""}
                      </span>
                      <span className="text-[var(--color-text-primary)]">({idx.columns.join(", ")})</span>
                      <span className="ml-auto text-[var(--color-text-muted)]">{idx.size}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RELATIONS TAB */}
        {tab === "relations" && (
          <div className="p-6">
            <div className="space-y-2">
              {RELATIONS.map(rel => (
                <div key={rel.constraint} className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4 flex items-center gap-4 font-mono text-xs">
                  <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                    <span className="font-medium">{rel.from}</span>
                    <span className="text-[var(--color-text-muted)]">.</span>
                    <span className="text-primary">{rel.fromCol}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                    <span>─── FK ──→</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                    <span className="font-medium">{rel.to}</span>
                    <span className="text-[var(--color-text-muted)]">.</span>
                    <span className="text-emerald-400">{rel.toCol}</span>
                  </div>
                  <div className="ml-auto flex items-center gap-4 text-[var(--color-text-muted)]">
                    <span className="text-[var(--color-text-muted)]">{rel.constraint}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded",
                      rel.onDelete === "CASCADE" ? "bg-rose-500/10 text-rose-400" :
                      rel.onDelete === "SET NULL" ? "bg-amber-500/10 text-amber-400" :
                      "bg-[var(--color-surface-3)]/30 text-[var(--color-text-secondary)]"
                    )}>
                      ON DELETE {rel.onDelete}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MIGRATIONS TAB */}
        {tab === "migrations" && (
          <div className="p-6">
            <div className="space-y-2">
              {MIGRATIONS.map(migration => (
                <div key={migration.id} className={cn(
                  "rounded-lg border transition-colors",
                  migration.status === "pending" ? "bg-amber-500/5 border-amber-500/20" :
                  migration.status === "failed" ? "bg-rose-500/5 border-rose-500/20" :
                  "bg-[var(--color-surface-1)] border-[var(--color-border)]"
                )}>
                  <div
                    className="px-5 py-3 flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpandedMigration(expandedMigration === migration.id ? null : migration.id)}
                  >
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded border",
                      migration.status === "applied" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                      migration.status === "pending" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                      "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    )}>{migration.status}</span>
                    <span className="font-mono text-xs text-[var(--color-text-muted)]">{migration.version}</span>
                    <span className="font-mono text-sm text-[var(--color-text-primary)]">{migration.name}</span>
                    <span className="ml-auto text-xs text-[var(--color-text-muted)]">{migration.appliedAt || "Not applied"}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{migration.duration || "—"}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{migration.author}</span>
                    <span className="text-[var(--color-text-muted)] text-xs">{expandedMigration === migration.id ? "▲" : "▼"}</span>
                  </div>
                  {expandedMigration === migration.id && (
                    <div className="px-5 py-3 border-t border-[var(--color-border)] font-mono text-xs space-y-1">
                      {migration.changes.map((change, i) => (
                        <div key={i} className="text-[var(--color-text-secondary)]">
                          <span className="text-emerald-400">+</span> {change}
                        </div>
                      ))}
                      {migration.status === "pending" && (
                        <div className="mt-3 flex gap-2">
                          <button className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 rounded text-[var(--color-text-primary)] transition-colors font-sans">Apply Migration</button>
                          <button className="px-3 py-1.5 text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors font-sans">Dry Run</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
