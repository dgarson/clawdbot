import React, { useState } from "react"
import { cn } from "../lib/utils"

type QueryStatus = "slow" | "normal" | "fast" | "error"
type IndexStatus = "used" | "unused" | "missing" | "redundant"

interface QueryPlan {
  node: string
  cost: number
  rows: number
  width: number
  actual?: number
  children?: QueryPlan[]
}

interface SlowQuery {
  id: string
  queryHash: string
  query: string
  database: string
  avgDurationMs: number
  maxDurationMs: number
  executions: number
  rowsExamined: number
  rowsReturned: number
  indexUsed?: string
  status: QueryStatus
  lastSeen: string
  user: string
  plan: QueryPlan
}

interface IndexRecommendation {
  id: string
  table: string
  database: string
  columns: string[]
  type: "btree" | "hash" | "gin" | "gist"
  estimatedSpeedup: string
  affectedQueries: number
  status: IndexStatus
  createStatement: string
}

interface DatabaseStats {
  name: string
  activeConnections: number
  maxConnections: number
  cacheHitRate: number
  txPerSec: number
  avgQueryTimeMs: number
  slowQueryCount: number
}

const SLOW_QUERIES: SlowQuery[] = [
  {
    id: "q-001",
    queryHash: "a3f91bc7",
    query: "SELECT u.*, o.total, o.created_at FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.plan = $1 AND o.created_at > $2 ORDER BY o.total DESC LIMIT 100",
    database: "app_prod",
    avgDurationMs: 8420,
    maxDurationMs: 23100,
    executions: 1247,
    rowsExamined: 4200000,
    rowsReturned: 100,
    status: "slow",
    lastSeen: "2026-02-22T12:01:00Z",
    user: "app_user",
    plan: {
      node: "Limit",
      cost: 142000,
      rows: 100,
      width: 312,
      actual: 8420,
      children: [
        {
          node: "Sort (total DESC)",
          cost: 142000,
          rows: 18240,
          width: 312,
          actual: 8100,
          children: [
            {
              node: "Hash Left Join (u.id = o.user_id)",
              cost: 98200,
              rows: 18240,
              width: 312,
              actual: 7800,
              children: [
                { node: "Seq Scan users (plan=$1)", cost: 12400, rows: 24300, width: 180, actual: 2100 },
                { node: "Hash Seq Scan orders (created_at>$2)", cost: 64800, rows: 1820000, width: 64, actual: 5600 },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "q-002",
    queryHash: "b7d44e21",
    query: "SELECT COUNT(*) FROM events WHERE user_id = $1 AND type IN ($2, $3, $4) AND created_at BETWEEN $5 AND $6",
    database: "analytics_prod",
    avgDurationMs: 3240,
    maxDurationMs: 9800,
    executions: 8921,
    rowsExamined: 2100000,
    rowsReturned: 1,
    status: "slow",
    lastSeen: "2026-02-22T12:03:00Z",
    user: "analytics_reader",
    plan: {
      node: "Aggregate",
      cost: 89000,
      rows: 1,
      width: 8,
      actual: 3240,
      children: [
        {
          node: "Bitmap Heap Scan events",
          cost: 89000,
          rows: 420000,
          width: 0,
          actual: 3100,
          children: [
            { node: "Bitmap Index Scan (idx_events_user_id)", cost: 8200, rows: 420000, width: 0, actual: 420 },
          ],
        },
      ],
    },
  },
  {
    id: "q-003",
    queryHash: "c2a88f59",
    query: "UPDATE sessions SET last_active = NOW(), metadata = $1 WHERE id = $2 AND expires_at > NOW()",
    database: "app_prod",
    avgDurationMs: 12,
    maxDurationMs: 48,
    executions: 284020,
    rowsExamined: 1,
    rowsReturned: 1,
    indexUsed: "sessions_pkey",
    status: "fast",
    lastSeen: "2026-02-22T12:05:00Z",
    user: "app_user",
    plan: {
      node: "Update sessions",
      cost: 8,
      rows: 1,
      width: 0,
      actual: 12,
      children: [
        { node: "Index Scan (sessions_pkey, id=$2)", cost: 4, rows: 1, width: 128, actual: 1 },
      ],
    },
  },
  {
    id: "q-004",
    queryHash: "d9c16a30",
    query: "SELECT p.*, array_agg(t.name) AS tags FROM products p LEFT JOIN product_tags pt ON p.id = pt.product_id LEFT JOIN tags t ON pt.tag_id = t.id GROUP BY p.id HAVING COUNT(pt.id) > 0",
    database: "catalog_prod",
    avgDurationMs: 5810,
    maxDurationMs: 14200,
    executions: 423,
    rowsExamined: 890000,
    rowsReturned: 8420,
    status: "slow",
    lastSeen: "2026-02-22T11:55:00Z",
    user: "catalog_api",
    plan: {
      node: "HashAggregate (GROUP BY p.id)",
      cost: 72400,
      rows: 8420,
      width: 420,
      actual: 5810,
      children: [
        {
          node: "Hash Left Join (p.id = pt.product_id)",
          cost: 61200,
          rows: 890000,
          width: 224,
          actual: 5200,
          children: [
            { node: "Seq Scan products", cost: 4200, rows: 94000, width: 180, actual: 380 },
            {
              node: "Hash Left Join (pt.tag_id = t.id)",
              cost: 38400,
              rows: 890000,
              width: 44,
              actual: 4600,
              children: [
                { node: "Seq Scan product_tags", cost: 18200, rows: 890000, width: 16, actual: 2100 },
                { node: "Hash Seq Scan tags", cost: 480, rows: 240, width: 28, actual: 12 },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "q-005",
    queryHash: "e5f72c84",
    query: "SELECT * FROM audit_logs WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 50",
    database: "app_prod",
    avgDurationMs: 1820,
    maxDurationMs: 4100,
    executions: 3284,
    rowsExamined: 12400000,
    rowsReturned: 50,
    status: "slow",
    lastSeen: "2026-02-22T11:48:00Z",
    user: "admin_api",
    plan: {
      node: "Limit",
      cost: 390000,
      rows: 50,
      width: 312,
      actual: 1820,
      children: [
        {
          node: "Sort (created_at DESC)",
          cost: 390000,
          rows: 12400000,
          width: 312,
          actual: 1810,
          children: [
            { node: "Seq Scan audit_logs (actor_id=$1)", cost: 280000, rows: 12400000, width: 312, actual: 1200 },
          ],
        },
      ],
    },
  },
]

const INDEX_RECOMMENDATIONS: IndexRecommendation[] = [
  { id: "idx-001", table: "orders", database: "app_prod", columns: ["created_at", "user_id"], type: "btree", estimatedSpeedup: "92%", affectedQueries: 8, status: "missing", createStatement: "CREATE INDEX CONCURRENTLY idx_orders_created_at_user_id ON orders (created_at, user_id);" },
  { id: "idx-002", table: "events", database: "analytics_prod", columns: ["user_id", "type", "created_at"], type: "btree", estimatedSpeedup: "84%", affectedQueries: 12, status: "missing", createStatement: "CREATE INDEX CONCURRENTLY idx_events_user_type_created ON events (user_id, type, created_at);" },
  { id: "idx-003", table: "audit_logs", database: "app_prod", columns: ["actor_id", "created_at"], type: "btree", estimatedSpeedup: "96%", affectedQueries: 3, status: "missing", createStatement: "CREATE INDEX CONCURRENTLY idx_audit_logs_actor_created ON audit_logs (actor_id, created_at DESC);" },
  { id: "idx-004", table: "sessions", database: "app_prod", columns: ["user_id"], type: "btree", estimatedSpeedup: "—", affectedQueries: 0, status: "unused", createStatement: "-- Already exists: DROP INDEX IF EXISTS idx_sessions_user_id;" },
  { id: "idx-005", table: "product_tags", database: "catalog_prod", columns: ["product_id", "tag_id"], type: "btree", estimatedSpeedup: "71%", affectedQueries: 4, status: "missing", createStatement: "CREATE INDEX CONCURRENTLY idx_product_tags_product_tag ON product_tags (product_id, tag_id);" },
]

const DB_STATS: DatabaseStats[] = [
  { name: "app_prod", activeConnections: 48, maxConnections: 100, cacheHitRate: 96.8, txPerSec: 842, avgQueryTimeMs: 24, slowQueryCount: 18 },
  { name: "analytics_prod", activeConnections: 12, maxConnections: 50, cacheHitRate: 89.2, txPerSec: 124, avgQueryTimeMs: 180, slowQueryCount: 7 },
  { name: "catalog_prod", activeConnections: 8, maxConnections: 50, cacheHitRate: 94.1, txPerSec: 42, avgQueryTimeMs: 65, slowQueryCount: 3 },
  { name: "billing_prod", activeConnections: 5, maxConnections: 30, cacheHitRate: 98.4, txPerSec: 18, avgQueryTimeMs: 12, slowQueryCount: 1 },
]

const statusColor: Record<QueryStatus, string> = {
  slow: "text-rose-400 bg-rose-400/10",
  normal: "text-amber-400 bg-amber-400/10",
  fast: "text-emerald-400 bg-emerald-400/10",
  error: "text-rose-600 bg-rose-600/10",
}

const indexStatusColor: Record<IndexStatus, string> = {
  missing: "text-rose-400 bg-rose-400/10",
  unused: "text-amber-400 bg-amber-400/10",
  redundant: "text-amber-400 bg-amber-400/10",
  used: "text-emerald-400 bg-emerald-400/10",
}

function fmtMs(ms: number): string {
  if (ms < 1000) {return `${ms}ms`}
  return `${(ms / 1000).toFixed(1)}s`
}

function fmtNum(n: number): string {
  if (n >= 1000000) {return `${(n / 1000000).toFixed(1)}M`}
  if (n >= 1000) {return `${(n / 1000).toFixed(1)}K`}
  return n.toString()
}

function PlanNode({ node, depth = 0 }: { node: QueryPlan; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-start gap-2 w-full text-left hover:bg-zinc-800/50 rounded px-2 py-1 transition-colors"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <span className="text-zinc-600 shrink-0 mt-0.5 text-xs">{node.children?.length ? (open ? "▾" : "▸") : "·"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono text-zinc-200">{node.node}</span>
            <span className="text-xs text-zinc-500">cost={node.cost.toLocaleString()}</span>
            <span className="text-xs text-zinc-500">rows={node.rows.toLocaleString()}</span>
            {node.actual !== undefined && (
              <span className={cn("text-xs font-mono", node.actual > 1000 ? "text-rose-400" : node.actual > 100 ? "text-amber-400" : "text-emerald-400")}>
                actual={fmtMs(node.actual)}
              </span>
            )}
          </div>
        </div>
      </button>
      {open && node.children?.map((child, i) => (
        <PlanNode key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export default function QueryPerformanceAnalyzer() {
  const [tab, setTab] = useState<"queries" | "indexes" | "databases" | "explain">("queries")
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dbFilter, setDbFilter] = useState<string>("all")
  const [explainQuery, setExplainQuery] = useState<string | null>(null)

  const tabs = [
    { id: "queries" as const, label: "Slow Queries", emoji: "🐢" },
    { id: "indexes" as const, label: "Index Analysis", emoji: "⚡" },
    { id: "databases" as const, label: "Database Health", emoji: "🗄" },
    { id: "explain" as const, label: "EXPLAIN Viewer", emoji: "🔬" },
  ]

  const filtered = SLOW_QUERIES.filter(q => {
    if (statusFilter !== "all" && q.status !== statusFilter) {return false}
    if (dbFilter !== "all" && q.database !== dbFilter) {return false}
    return true
  })

  const query = selectedQuery ? SLOW_QUERIES.find(q => q.id === selectedQuery) : null
  const explainQueryObj = explainQuery ? SLOW_QUERIES.find(q => q.id === explainQuery) : null

  const totalSlowQueries = SLOW_QUERIES.filter(q => q.status === "slow").length
  const missingIndexes = INDEX_RECOMMENDATIONS.filter(i => i.status === "missing").length
  const avgQueryTime = Math.round(SLOW_QUERIES.reduce((s, q) => s + q.avgDurationMs, 0) / SLOW_QUERIES.length)

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Query Performance Analyzer</h1>
          <p className="text-zinc-400 text-sm mt-1">Identify slow queries, missing indexes, and optimization opportunities</p>
        </div>
        <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm text-zinc-300 transition-colors">
          Export Report
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 border border-rose-400/20 rounded-lg p-4">
          <div className="text-xs text-zinc-400 mb-1">Slow Queries</div>
          <div className="text-2xl font-bold text-rose-400">{totalSlowQueries}</div>
          <div className="text-xs text-zinc-500 mt-1">avg {fmtMs(avgQueryTime)}</div>
        </div>
        <div className="bg-zinc-900 border border-amber-400/20 rounded-lg p-4">
          <div className="text-xs text-zinc-400 mb-1">Missing Indexes</div>
          <div className="text-2xl font-bold text-amber-400">{missingIndexes}</div>
          <div className="text-xs text-zinc-500 mt-1">potential 80%+ improvement</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
          <div className="text-xs text-zinc-400 mb-1">Databases Monitored</div>
          <div className="text-2xl font-bold text-zinc-300">{DB_STATS.length}</div>
          <div className="text-xs text-zinc-500 mt-1">all healthy</div>
        </div>
        <div className="bg-zinc-900 border border-emerald-400/20 rounded-lg p-4">
          <div className="text-xs text-zinc-400 mb-1">Cache Hit Rate</div>
          <div className="text-2xl font-bold text-emerald-400">94.6%</div>
          <div className="text-xs text-zinc-500 mt-1">avg across databases</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              tab === t.id
                ? "border-indigo-500 text-white bg-zinc-900"
                : "border-transparent text-zinc-400 hover:text-zinc-300"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Slow Queries Tab */}
      {tab === "queries" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white">
              <option value="all">All Statuses</option>
              <option value="slow">Slow</option>
              <option value="fast">Fast</option>
              <option value="error">Error</option>
            </select>
            <select value={dbFilter} onChange={e => setDbFilter(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white">
              <option value="all">All Databases</option>
              {DB_STATS.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
            <span className="text-sm text-zinc-400 self-center">{filtered.length} queries</span>
          </div>

          <div className="space-y-2">
            {filtered.map(q => (
              <div key={q.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setSelectedQuery(selectedQuery === q.id ? null : q.id)}
                  className="w-full text-left p-4 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColor[q.status])}>
                          {q.status}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">{q.database}</span>
                        <span className="text-xs font-mono text-zinc-500">{q.queryHash}</span>
                      </div>
                      <code className="text-xs text-indigo-300 font-mono line-clamp-2 block">{q.query}</code>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-sm">
                      <div className="text-center">
                        <div className="text-xs text-zinc-500 mb-0.5">Avg</div>
                        <div className={cn("font-mono", q.avgDurationMs > 5000 ? "text-rose-400" : q.avgDurationMs > 1000 ? "text-amber-400" : "text-emerald-400")}>
                          {fmtMs(q.avgDurationMs)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-zinc-500 mb-0.5">Executions</div>
                        <div className="text-zinc-300">{fmtNum(q.executions)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-zinc-500 mb-0.5">Rows Scanned</div>
                        <div className="text-zinc-300">{fmtNum(q.rowsExamined)}</div>
                      </div>
                      <span className="text-zinc-600">{selectedQuery === q.id ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </button>

                {selectedQuery === q.id && (
                  <div className="border-t border-zinc-800 p-4 bg-zinc-950 space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="bg-zinc-900 rounded-md p-3">
                        <div className="text-xs text-zinc-500 mb-1">Max Duration</div>
                        <div className="text-rose-400 font-mono">{fmtMs(q.maxDurationMs)}</div>
                      </div>
                      <div className="bg-zinc-900 rounded-md p-3">
                        <div className="text-xs text-zinc-500 mb-1">Rows Returned / Examined</div>
                        <div className="text-zinc-300 font-mono">{fmtNum(q.rowsReturned)} / {fmtNum(q.rowsExamined)}</div>
                      </div>
                      <div className="bg-zinc-900 rounded-md p-3">
                        <div className="text-xs text-zinc-500 mb-1">User / Last Seen</div>
                        <div className="text-zinc-300">{q.user}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setExplainQuery(q.id); setTab("explain") }}
                        className="px-3 py-1.5 text-xs bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-md transition-colors"
                      >
                        🔬 View EXPLAIN Plan
                      </button>
                      <button className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-400 hover:bg-zinc-700 rounded-md transition-colors">
                        Copy Query
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Index Analysis Tab */}
      {tab === "indexes" && (
        <div className="space-y-3">
          {INDEX_RECOMMENDATIONS.map(idx => (
            <div key={idx.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", indexStatusColor[idx.status])}>
                      {idx.status}
                    </span>
                    <span className="font-medium text-sm">{idx.database}.{idx.table}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">{idx.type}</span>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-zinc-500">Columns:</span>
                    {idx.columns.map(c => (
                      <span key={c} className="text-xs font-mono px-1.5 py-0.5 bg-zinc-800 text-indigo-300 rounded">{c}</span>
                    ))}
                  </div>
                  <code className="text-xs font-mono text-zinc-400 bg-zinc-800 px-3 py-2 rounded-md block">
                    {idx.createStatement}
                  </code>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn("text-2xl font-bold", idx.status === "missing" ? "text-emerald-400" : "text-zinc-400")}>
                    {idx.estimatedSpeedup}
                  </div>
                  <div className="text-xs text-zinc-500">speedup</div>
                  <div className="text-xs text-zinc-400 mt-1">{idx.affectedQueries} queries</div>
                  {idx.status === "missing" && (
                    <button className="mt-2 px-3 py-1 text-xs bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-md transition-colors">
                      Create Index
                    </button>
                  )}
                  {idx.status === "unused" && (
                    <button className="mt-2 px-3 py-1 text-xs bg-rose-400/10 text-rose-400 hover:bg-rose-400/20 rounded-md transition-colors">
                      Drop Index
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Database Health Tab */}
      {tab === "databases" && (
        <div className="space-y-4">
          {DB_STATS.map(db => (
            <div key={db.name} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-medium font-mono">{db.name}</div>
                  <div className="text-sm text-zinc-400 mt-0.5">{db.slowQueryCount} slow queries active</div>
                </div>
                <div className={cn("text-sm font-medium", db.slowQueryCount > 10 ? "text-rose-400" : db.slowQueryCount > 5 ? "text-amber-400" : "text-emerald-400")}>
                  {db.slowQueryCount > 10 ? "⚠ Degraded" : db.slowQueryCount > 5 ? "! Watch" : "✓ Healthy"}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Connections</div>
                  <div className="text-zinc-300">{db.activeConnections}/{db.maxConnections}</div>
                  <div className="mt-1 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", (db.activeConnections / db.maxConnections) > 0.8 ? "bg-rose-500" : "bg-indigo-500")}
                      style={{ width: `${(db.activeConnections / db.maxConnections) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Cache Hit Rate</div>
                  <div className={cn("font-mono", db.cacheHitRate > 95 ? "text-emerald-400" : db.cacheHitRate > 90 ? "text-amber-400" : "text-rose-400")}>
                    {db.cacheHitRate}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Transactions/s</div>
                  <div className="text-zinc-300">{db.txPerSec}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Avg Query Time</div>
                  <div className={cn("font-mono", db.avgQueryTimeMs > 100 ? "text-amber-400" : "text-emerald-400")}>
                    {fmtMs(db.avgQueryTimeMs)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EXPLAIN Viewer Tab */}
      {tab === "explain" && (
        <div className="space-y-4">
          {/* Query selector */}
          <div className="flex gap-2 flex-wrap">
            {SLOW_QUERIES.map(q => (
              <button
                key={q.id}
                onClick={() => setExplainQuery(q.id)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md font-mono transition-colors",
                  explainQuery === q.id
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}
              >
                {q.queryHash}
              </button>
            ))}
          </div>

          {explainQueryObj ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-zinc-800">
                <code className="text-xs font-mono text-indigo-300 line-clamp-2">{explainQueryObj.query}</code>
              </div>
              <div className="p-3 space-y-0.5">
                <PlanNode node={explainQueryObj.plan} />
              </div>
              <div className="p-3 border-t border-zinc-800 flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500 inline-block" /> &lt;100ms</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500 inline-block" /> 100ms–1s</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-500 inline-block" /> &gt;1s</span>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center text-zinc-500">
              Select a query hash to view its EXPLAIN plan
            </div>
          )}
        </div>
      )}
    </div>
  )
}
