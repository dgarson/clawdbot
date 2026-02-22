import React, { useState } from "react";
import { cn } from "../lib/utils";

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  isPK: boolean;
  isFK: boolean;
}

interface Table {
  name: string;
  schema: string;
  rowCount: number;
  columns: Column[];
}

interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
  duration: number;
  rowsAffected: number;
}

interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  lastRun: string;
  tags: string[];
}

const TABLES: Table[] = [
  {
    name: "users", schema: "public", rowCount: 48291,
    columns: [
      { name: "id",         type: "uuid",        nullable: false, isPK: true,  isFK: false },
      { name: "email",      type: "varchar(255)", nullable: false, isPK: false, isFK: false },
      { name: "name",       type: "varchar(100)", nullable: true,  isPK: false, isFK: false },
      { name: "plan",       type: "varchar(20)",  nullable: false, isPK: false, isFK: false },
      { name: "created_at", type: "timestamptz",  nullable: false, isPK: false, isFK: false },
      { name: "deleted_at", type: "timestamptz",  nullable: true,  isPK: false, isFK: false },
    ],
  },
  {
    name: "orders", schema: "public", rowCount: 312449,
    columns: [
      { name: "id",         type: "uuid",        nullable: false, isPK: true,  isFK: false },
      { name: "user_id",    type: "uuid",        nullable: false, isPK: false, isFK: true  },
      { name: "amount",     type: "numeric(10,2)",nullable: false, isPK: false, isFK: false },
      { name: "status",     type: "varchar(20)", nullable: false, isPK: false, isFK: false },
      { name: "created_at", type: "timestamptz", nullable: false, isPK: false, isFK: false },
    ],
  },
  {
    name: "events", schema: "analytics", rowCount: 9841200,
    columns: [
      { name: "id",         type: "bigint",       nullable: false, isPK: true,  isFK: false },
      { name: "session_id", type: "uuid",         nullable: false, isPK: false, isFK: false },
      { name: "type",       type: "varchar(50)",  nullable: false, isPK: false, isFK: false },
      { name: "properties", type: "jsonb",        nullable: true,  isPK: false, isFK: false },
      { name: "ts",         type: "timestamptz",  nullable: false, isPK: false, isFK: false },
    ],
  },
  {
    name: "audit_logs", schema: "public", rowCount: 1240580,
    columns: [
      { name: "id",         type: "bigint",       nullable: false, isPK: true,  isFK: false },
      { name: "actor_id",   type: "uuid",         nullable: true,  isPK: false, isFK: true  },
      { name: "action",     type: "varchar(100)", nullable: false, isPK: false, isFK: false },
      { name: "resource",   type: "text",         nullable: false, isPK: false, isFK: false },
      { name: "ip",         type: "inet",         nullable: true,  isPK: false, isFK: false },
      { name: "created_at", type: "timestamptz",  nullable: false, isPK: false, isFK: false },
    ],
  },
  {
    name: "api_keys", schema: "public", rowCount: 8903,
    columns: [
      { name: "id",         type: "uuid",         nullable: false, isPK: true,  isFK: false },
      { name: "user_id",    type: "uuid",         nullable: false, isPK: false, isFK: true  },
      { name: "name",       type: "varchar(100)", nullable: false, isPK: false, isFK: false },
      { name: "key_hash",   type: "varchar(64)",  nullable: false, isPK: false, isFK: false },
      { name: "last_used",  type: "timestamptz",  nullable: true,  isPK: false, isFK: false },
      { name: "revoked_at", type: "timestamptz",  nullable: true,  isPK: false, isFK: false },
    ],
  },
];

const SAMPLE_RESULT: QueryResult = {
  columns: ["id", "email", "plan", "created_at", "order_count", "total_spend"],
  rows: [
    ["usr_9kX2", "alice@corp.io",   "enterprise", "2024-01-15", 42, 12840.50],
    ["usr_8xT1", "bob@example.com", "pro",        "2024-02-03", 18, 2340.00 ],
    ["usr_7kW2", "carol@nova.ai",   "enterprise", "2024-03-11", 61, 22100.00],
    ["usr_6jT9", "dave@acme.com",   "starter",    "2024-04-22", 5,  250.00  ],
    ["usr_5nRt", "eve@corp.io",     "pro",        "2024-05-01", 29, 4890.75 ],
    ["usr_4mQp", "frank@veritas.io","pro",        "2024-05-18", 12, 1200.00 ],
    ["usr_3kLm", "grace@novo.labs", "enterprise", "2024-06-02", 88, 31200.00],
    ["usr_2xR8", "henry@corp.io",   "starter",    "2024-06-30", 3,  99.00   ],
  ],
  duration: 142,
  rowsAffected: 8,
};

const SAVED_QUERIES: SavedQuery[] = [
  { id: "sq1", name: "Top Spenders",              sql: "SELECT u.id, u.email, u.plan, COUNT(o.id) as order_count, SUM(o.amount) as total_spend\nFROM users u\nJOIN orders o ON o.user_id = u.id\nWHERE u.deleted_at IS NULL\nGROUP BY u.id, u.email, u.plan\nORDER BY total_spend DESC\nLIMIT 50;", lastRun: "2 hours ago", tags: ["revenue","users"] },
  { id: "sq2", name: "Recent Failed Orders",       sql: "SELECT id, user_id, amount, created_at\nFROM orders\nWHERE status = 'failed'\n  AND created_at > NOW() - INTERVAL '7 days'\nORDER BY created_at DESC;", lastRun: "Yesterday",   tags: ["orders","ops"] },
  { id: "sq3", name: "Daily Active Users",         sql: "SELECT DATE(created_at) as day, COUNT(DISTINCT session_id) as dau\nFROM analytics.events\nWHERE ts > NOW() - INTERVAL '30 days'\n  AND type = 'session_start'\nGROUP BY day\nORDER BY day DESC;", lastRun: "3 days ago",  tags: ["analytics"] },
  { id: "sq4", name: "Expiring API Keys",          sql: "SELECT ak.id, ak.name, u.email, ak.last_used\nFROM api_keys ak\nJOIN users u ON u.id = ak.user_id\nWHERE ak.revoked_at IS NULL\n  AND (ak.last_used < NOW() - INTERVAL '90 days' OR ak.last_used IS NULL)\nORDER BY ak.last_used ASC NULLS FIRST;", lastRun: "1 week ago",  tags: ["security","api"] },
  { id: "sq5", name: "Audit: Admin Actions",       sql: "SELECT actor_id, action, resource, ip, created_at\nFROM audit_logs\nWHERE action LIKE 'admin.%'\n  AND created_at > NOW() - INTERVAL '24 hours'\nORDER BY created_at DESC;", lastRun: "6 hours ago", tags: ["audit","security"] },
];

type Tab = "editor" | "schema" | "saved" | "history";

const QUERY_HISTORY = [
  { sql: "SELECT * FROM users LIMIT 10;",                           ts: "07:38:14", duration: 12,  rows: 10  },
  { sql: "SELECT COUNT(*) FROM orders WHERE status = 'failed';",   ts: "07:22:01", duration: 340, rows: 1   },
  { sql: "EXPLAIN ANALYZE SELECT * FROM events WHERE ts > NOW() - INTERVAL '1 hour';", ts: "07:15:44", duration: 88, rows: 24 },
  { sql: "SELECT id, email FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 100;", ts: "06:58:02", duration: 67, rows: 100 },
  { sql: "UPDATE orders SET status = 'cancelled' WHERE id = 'ord_7mNp';", ts: "06:44:11", duration: 8, rows: 1 },
];

export default function DatabaseQueryBuilder() {
  const [activeTab, setActiveTab] = useState<Tab>("editor");
  const [sqlValue, setSqlValue]   = useState(SAVED_QUERIES[0].sql);
  const [result, setResult]       = useState<QueryResult | null>(null);
  const [running, setRunning]     = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<SavedQuery | null>(null);

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "editor", label: "Query Editor", emoji: "✏️" },
    { id: "schema", label: "Schema",       emoji: "🗄️" },
    { id: "saved",  label: "Saved",        emoji: "💾" },
    { id: "history",label: "History",      emoji: "🕐" },
  ];

  const runQuery = () => {
    setRunning(true);
    setTimeout(() => {
      setResult(SAMPLE_RESULT);
      setRunning(false);
    }, 800);
  };

  const TYPE_COLOR: Record<string, string> = {
    uuid: "text-indigo-300", bigint: "text-amber-300", varchar: "text-emerald-300",
    text: "text-emerald-300", numeric: "text-sky-300", timestamptz: "text-purple-300",
    jsonb: "text-orange-300", inet: "text-cyan-300",
  };

  const getTypeColor = (type: string) => {
    const base = type.split("(")[0];
    return TYPE_COLOR[base] ?? "text-zinc-300";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Database Query Builder</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Connected: <span className="text-emerald-400">postgres://db.prod.internal:5432/clawdbot</span></p>
        </div>
        <div className="flex items-center gap-2">
          <select className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none">
            <option>production</option>
            <option>staging</option>
            <option>development</option>
          </select>
          <div className="flex items-center gap-1.5 text-xs bg-emerald-400/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Connected
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm rounded-md transition-colors",
              activeTab === t.id
                ? "bg-indigo-500 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      {activeTab === "editor" && (
        <div className="grid grid-cols-4 gap-4">
          {/* Table browser sidebar */}
          <div className="col-span-1">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Tables</div>
              <div className="space-y-1">
                {TABLES.map(tbl => (
                  <div key={tbl.name}>
                    <button
                      onClick={() => setExpandedTable(expandedTable === tbl.name ? null : tbl.name)}
                      className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 text-xs">{expandedTable === tbl.name ? "▼" : "▶"}</span>
                        <span className="text-sm text-white">{tbl.name}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{(tbl.rowCount / 1000).toFixed(0)}K</span>
                    </button>
                    {expandedTable === tbl.name && (
                      <div className="ml-4 mt-1 space-y-0.5 pb-1">
                        {tbl.columns.map(col => (
                          <div key={col.name} className="flex items-center gap-1.5 px-2 py-0.5">
                            <span className="text-xs text-zinc-600">
                              {col.isPK ? "🔑" : col.isFK ? "🔗" : "·"}
                            </span>
                            <span className="text-xs text-zinc-300">{col.name}</span>
                            <span className={cn("text-xs ml-auto", getTypeColor(col.type))}>{col.type.split("(")[0]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Editor + results */}
          <div className="col-span-3 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2">
              <button
                onClick={runQuery}
                disabled={running}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors",
                  running
                    ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                    : "bg-indigo-500 text-white hover:bg-indigo-600"
                )}
              >
                {running ? "⏳ Running..." : "▶ Run Query"}
              </button>
              <button className="text-sm px-3 py-2 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-800 transition-colors">💾 Save</button>
              <button className="text-sm px-3 py-2 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-800 transition-colors">📋 Format</button>
              <button
                onClick={() => setResult(null)}
                className="text-sm px-3 py-2 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-800 transition-colors"
              >✕ Clear</button>
              <div className="ml-auto text-xs text-zinc-500">Cmd+Enter to run</div>
            </div>

            {/* SQL editor */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
                <span className="text-xs text-zinc-400">SQL</span>
                <div className="ml-auto flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                </div>
              </div>
              <div className="flex">
                {/* Line numbers */}
                <div className="px-3 py-3 text-xs font-mono text-zinc-600 text-right select-none border-r border-zinc-800 bg-zinc-900/50">
                  {sqlValue.split("\n").map((_, i) => (
                    <div key={i} className="leading-6">{i + 1}</div>
                  ))}
                </div>
                {/* Code area */}
                <textarea
                  value={sqlValue}
                  onChange={e => setSqlValue(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-3 text-sm font-mono text-zinc-100 resize-none focus:outline-none leading-6 min-h-[200px]"
                  spellCheck={false}
                  rows={Math.max(8, sqlValue.split("\n").length + 1)}
                />
              </div>
            </div>

            {/* Results */}
            {result && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-800 bg-zinc-800/30">
                  <span className="text-xs text-zinc-400">Results</span>
                  <span className="text-xs text-emerald-400">{result.rowsAffected} rows</span>
                  <span className="text-xs text-zinc-500">{result.duration}ms</span>
                  <button className="ml-auto text-xs text-indigo-400 hover:text-indigo-300">⬇ Export CSV</button>
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs font-mono">
                    <thead className="sticky top-0 bg-zinc-800">
                      <tr>
                        {result.columns.map(col => (
                          <th key={col} className="px-3 py-2 text-left text-zinc-400 font-medium whitespace-nowrap border-b border-zinc-700">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {result.rows.map((row, ri) => (
                        <tr key={ri} className="hover:bg-zinc-800/30 transition-colors">
                          {row.map((cell, ci) => (
                            <td key={ci} className={cn(
                              "px-3 py-2 whitespace-nowrap",
                              cell === null ? "text-zinc-600 italic" : "text-zinc-300"
                            )}>
                              {cell === null ? "NULL" : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schema */}
      {activeTab === "schema" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1 space-y-2">
            {TABLES.map(tbl => (
              <button
                key={tbl.name}
                onClick={() => setSelectedTable(tbl)}
                className={cn(
                  "w-full bg-zinc-900 border rounded-lg p-3 text-left hover:border-zinc-600 transition-colors",
                  selectedTable?.name === tbl.name ? "border-indigo-500/50" : "border-zinc-800"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{tbl.schema}.{tbl.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{tbl.columns.length} cols</span>
                  <span>{tbl.rowCount.toLocaleString()} rows</span>
                </div>
              </button>
            ))}
          </div>

          <div className="col-span-2">
            {selectedTable ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{selectedTable.schema}.{selectedTable.name}</span>
                  <span className="text-xs text-zinc-400">{selectedTable.rowCount.toLocaleString()} rows</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs text-zinc-400">
                      <th className="px-4 py-2 text-left font-medium">Column</th>
                      <th className="px-4 py-2 text-left font-medium">Type</th>
                      <th className="px-4 py-2 text-center font-medium">Nullable</th>
                      <th className="px-4 py-2 text-center font-medium">PK</th>
                      <th className="px-4 py-2 text-center font-medium">FK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {selectedTable.columns.map(col => (
                      <tr key={col.name} className="hover:bg-zinc-800/30">
                        <td className="px-4 py-2.5 text-white font-medium font-mono text-xs">{col.name}</td>
                        <td className={cn("px-4 py-2.5 font-mono text-xs", getTypeColor(col.type))}>{col.type}</td>
                        <td className="px-4 py-2.5 text-center text-xs">{col.nullable ? <span className="text-amber-400">yes</span> : <span className="text-zinc-500">no</span>}</td>
                        <td className="px-4 py-2.5 text-center">{col.isPK ? <span className="text-amber-400">🔑</span> : <span className="text-zinc-700">—</span>}</td>
                        <td className="px-4 py-2.5 text-center">{col.isFK ? <span className="text-indigo-400">🔗</span> : <span className="text-zinc-700">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center text-zinc-500 text-sm">
                Select a table to view schema
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved Queries */}
      {activeTab === "saved" && (
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 space-y-3">
            {SAVED_QUERIES.map(sq => (
              <button
                key={sq.id}
                onClick={() => setSelectedSaved(sq)}
                className={cn(
                  "w-full bg-zinc-900 border rounded-lg p-4 text-left hover:border-zinc-600 transition-colors",
                  selectedSaved?.id === sq.id ? "border-indigo-500/50" : "border-zinc-800"
                )}
              >
                <div className="text-sm font-medium text-white mb-1">{sq.name}</div>
                <div className="text-xs text-zinc-500 mb-2">Last run {sq.lastRun}</div>
                <div className="flex flex-wrap gap-1">
                  {sq.tags.map(tag => (
                    <span key={tag} className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="col-span-3">
            {selectedSaved ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                  <span className="text-sm font-semibold text-white">{selectedSaved.name}</span>
                  <button
                    onClick={() => { setSqlValue(selectedSaved.sql); setActiveTab("editor"); }}
                    className="text-xs px-3 py-1.5 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                  >
                    Open in Editor
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-zinc-200 leading-relaxed overflow-x-auto whitespace-pre-wrap">{selectedSaved.sql}</pre>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center text-zinc-500 text-sm">
                Select a saved query to preview
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {activeTab === "history" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 text-xs text-zinc-400">Recent queries (today)</div>
          <div className="divide-y divide-zinc-800">
            {QUERY_HISTORY.map((h, i) => (
              <div key={i} className="px-4 py-3 hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-500 font-mono">{h.ts}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={cn(h.duration > 200 ? "text-amber-400" : "text-zinc-400")}>{h.duration}ms</span>
                    <span className="text-zinc-400">{h.rows} rows</span>
                    <button
                      onClick={() => { setSqlValue(h.sql); setActiveTab("editor"); }}
                      className="text-indigo-400 hover:text-indigo-300"
                    >Re-run →</button>
                  </div>
                </div>
                <pre className="text-xs font-mono text-zinc-300 truncate">{h.sql}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
