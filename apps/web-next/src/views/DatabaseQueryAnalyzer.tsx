import React, { useState } from "react";
import { cn } from "../lib/utils";

type QueryType = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

interface ExecutionPlanNode {
  operation: string;
  table?: string;
  cost: number;
  rows: number;
  children?: ExecutionPlanNode[];
}

interface QueryDetail {
  id: string;
  sql: string;
  database: string;
  table: string;
  p50: number;
  p95: number;
  p99: number;
  calls: number;
  type: QueryType;
  plan: ExecutionPlanNode;
  indexUsage: {
    indexName: string;
    scans: number;
    reads: number;
  }[];
}

interface TableStat {
  name: string;
  database: string;
  rows: number;
  size: string;
  indexHitRate: number;
  bloat: number;
  topQueries: string[];
}

interface HourlyTrend {
  hour: string;
  select: number;
  insert: number;
  update: number;
  delete: number;
}

interface LockEvent {
  id: string;
  database: string;
  blockedQueryId: string;
  blockingQueryId: string;
  waitMs: number;
  type: string;
  timestamp: string;
  isDeadlock: boolean;
}

const DATABASES = ["production_main", "analytics_dw", "user_service_db", "billing_v2"];

const MOCK_QUERIES: QueryDetail[] = [
  {
    id: "q1",
    sql: "SELECT * FROM orders WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 50",
    database: "production_main",
    table: "orders",
    p50: 12.4,
    p95: 145.2,
    p99: 450.8,
    calls: 15400,
    type: "SELECT",
    plan: {
      operation: "Limit", cost: 450.2, rows: 50,
      children: [{
        operation: "Sort", cost: 450.1, rows: 1200,
        children: [{ operation: "Index Scan", table: "orders", cost: 380.5, rows: 1200 }]
      }]
    },
    indexUsage: [{ indexName: "idx_orders_user_status", scans: 14500, reads: 120000 }]
  },
  {
    id: "q2",
    sql: "UPDATE inventory SET stock_count = stock_count - 1 WHERE product_id = ? AND warehouse_id = ?",
    database: "production_main",
    table: "inventory",
    p50: 8.1,
    p95: 24.5,
    p99: 89.2,
    calls: 45000,
    type: "UPDATE",
    plan: { operation: "Update", table: "inventory", cost: 12.4, rows: 1 },
    indexUsage: [{ indexName: "pk_inventory", scans: 45000, reads: 45000 }]
  },
  {
    id: "q3",
    sql: "SELECT SUM(total_amount), category_id FROM sales_fact GROUP BY category_id",
    database: "analytics_dw",
    table: "sales_fact",
    p50: 1240.5,
    p95: 3500.2,
    p99: 8900.1,
    calls: 120,
    type: "SELECT",
    plan: {
      operation: "Hash Aggregate", cost: 8500.5, rows: 45,
      children: [{ operation: "Seq Scan", table: "sales_fact", cost: 6200.1, rows: 850000 }]
    },
    indexUsage: []
  },
  {
    id: "q4",
    sql: "INSERT INTO audit_logs (event_type, payload, user_id, created_at) VALUES (?, ?, ?, NOW())",
    database: "user_service_db",
    table: "audit_logs",
    p50: 2.4,
    p95: 12.8,
    p99: 45.2,
    calls: 850000,
    type: "INSERT",
    plan: { operation: "Insert", table: "audit_logs", cost: 0.1, rows: 1 },
    indexUsage: []
  },
  {
    id: "q5",
    sql: "DELETE FROM sessions WHERE expires_at < NOW()",
    database: "user_service_db",
    table: "sessions",
    p50: 45.8,
    p95: 890.4,
    p99: 2300.5,
    calls: 1440,
    type: "DELETE",
    plan: {
      operation: "Delete", table: "sessions", cost: 2100.0, rows: 5000,
      children: [{ operation: "Seq Scan", table: "sessions", cost: 1800.0, rows: 5000 }]
    },
    indexUsage: []
  },
  {
    id: "q6",
    sql: "SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.author_id WHERE p.status = 'published'",
    database: "production_main",
    table: "posts",
    p50: 65.2,
    p95: 230.1,
    p99: 560.4,
    calls: 12000,
    type: "SELECT",
    plan: {
      operation: "Hash Join", cost: 500.5, rows: 1000,
      children: [
        { operation: "Seq Scan", table: "users", cost: 120.0, rows: 5000 },
        { operation: "Index Scan", table: "posts", cost: 250.0, rows: 1000 }
      ]
    },
    indexUsage: [{ indexName: "idx_posts_author", scans: 12000, reads: 45000 }]
  }
];

const MOCK_TABLES: TableStat[] = [
  { name: "orders", database: "production_main", rows: 1250000, size: "1.2 GB", indexHitRate: 98.5, bloat: 4.2, topQueries: ["q1"] },
  { name: "inventory", database: "production_main", rows: 45000, size: "12 MB", indexHitRate: 99.9, bloat: 1.5, topQueries: ["q2"] },
  { name: "sales_fact", database: "analytics_dw", rows: 45000000, size: "156 GB", indexHitRate: 45.2, bloat: 0.8, topQueries: ["q3"] },
  { name: "audit_logs", database: "user_service_db", rows: 89000000, size: "420 GB", indexHitRate: 12.4, bloat: 2.1, topQueries: ["q4"] },
  { name: "sessions", database: "user_service_db", rows: 120000, size: "85 MB", indexHitRate: 88.5, bloat: 35.4, topQueries: ["q5"] },
  { name: "posts", database: "production_main", rows: 850000, size: "850 MB", indexHitRate: 94.1, bloat: 8.5, topQueries: ["q6"] },
  { name: "users", database: "production_main", rows: 500000, size: "120 MB", indexHitRate: 99.2, bloat: 3.2, topQueries: ["q6"] },
  { name: "transactions", database: "billing_v2", rows: 2500000, size: "4.5 GB", indexHitRate: 97.8, bloat: 5.6, topQueries: [] },
  { name: "invoices", database: "billing_v2", rows: 1200000, size: "2.1 GB", indexHitRate: 96.5, bloat: 4.8, topQueries: [] },
  { name: "customers", database: "billing_v2", rows: 450000, size: "95 MB", indexHitRate: 99.5, bloat: 2.4, topQueries: [] }
];

const MOCK_TRENDS: HourlyTrend[] = Array.from({ length: 24 }).map((_, i) => ({
  hour: i.toString().padStart(2, "0") + ":00",
  select: Math.floor(Math.random() * 5000) + 2000,
  insert: Math.floor(Math.random() * 1000) + 200,
  update: Math.floor(Math.random() * 800) + 100,
  delete: Math.floor(Math.random() * 200) + 50
}));

const MOCK_LOCKS: LockEvent[] = [
  { id: "l1", database: "production_main", blockedQueryId: "q2", blockingQueryId: "q1", waitMs: 1250, type: "RowShareLock", timestamp: "2024-05-22 10:15:02", isDeadlock: false },
  { id: "l2", database: "user_service_db", blockedQueryId: "q5", blockingQueryId: "q4", waitMs: 4500, type: "ExclusiveLock", timestamp: "2024-05-22 10:20:45", isDeadlock: true },
  { id: "l3", database: "billing_v2", blockedQueryId: "q7", blockingQueryId: "q8", waitMs: 850, type: "AccessExclusiveLock", timestamp: "2024-05-22 11:05:12", isDeadlock: false }
];

export default function DatabaseQueryAnalyzer() {
  const [activeTab, setActiveTab] = useState("queries");
  const [selectedQuery, setSelectedQuery] = useState<QueryDetail | null>(null);
  const [dbFilter, setDbFilter] = useState("ALL");

  const filteredQueries = MOCK_QUERIES.filter(q => dbFilter === "ALL" || q.database === dbFilter);

  const getLatencyColor = (ms: number) => {
    if (ms < 50) return "text-emerald-400";
    if (ms < 500) return "text-amber-400";
    return "text-rose-400";
  };

  const getLatencyBg = (ms: number) => {
    if (ms < 50) return "bg-emerald-400/10";
    if (ms < 500) return "bg-amber-400/10";
    return "bg-rose-400/10";
  };

  const PlanNode = ({ node, depth = 0 }: { node: ExecutionPlanNode, depth?: number }) => (
    <div className="flex flex-col gap-1">
      <div className={cn(
        "flex items-center gap-3 p-2 rounded border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors",
        depth > 0 && "ml-6 border-l-indigo-500/30"
      )}>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{node.operation}</span>
          {node.table && <span className="text-[10px] text-zinc-500 font-mono">{node.table}</span>}
        </div>
        <div className="flex-1" />
        <div className="flex gap-4 text-[10px]">
          <div className="flex flex-col items-end">
            <span className="text-zinc-500 uppercase">Cost</span>
            <span className="text-zinc-300">{node.cost.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-zinc-500 uppercase">Rows</span>
            <span className="text-zinc-300">{node.rows.toLocaleString()}</span>
          </div>
        </div>
      </div>
      {node.children?.map((child, i) => (
        <PlanNode key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ClawDB <span className="text-indigo-500">Analyzer</span></h1>
          <p className="text-zinc-500 text-sm">Performance metrics and query optimization suite</p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          {["queries", "trends", "tables", "locks"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-all",
                activeTab === tab ? "bg-indigo-500 text-white shadow-lg" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {activeTab === "queries" && (
          <>
            {/* List */}
            <div className={cn("flex flex-col gap-4", selectedQuery ? "col-span-4" : "col-span-12")}>
              <div className="flex items-center gap-4 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                <span className="text-xs font-bold text-zinc-500 uppercase ml-2">Database</span>
                <select 
                  value={dbFilter}
                  onChange={(e) => setDbFilter(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1 text-xs outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="ALL">All Databases</option>
                  {DATABASES.map(db => <option key={db} value={db}>{db}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                {filteredQueries.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQuery(q)}
                    className={cn(
                      "flex flex-col gap-3 p-4 rounded-xl border transition-all text-left group",
                      selectedQuery?.id === q.id 
                        ? "bg-indigo-500/10 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.1)]" 
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1 max-w-[70%]">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded",
                            q.type === "SELECT" ? "bg-indigo-500/20 text-indigo-400" :
                            q.type === "INSERT" ? "bg-emerald-500/20 text-emerald-400" :
                            q.type === "UPDATE" ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400"
                          )}>
                            {q.type}
                          </span>
                          <span className="text-xs text-zinc-500 font-mono truncate">{q.database}</span>
                        </div>
                        <p className="text-sm font-mono text-zinc-300 line-clamp-2 mt-1 leading-relaxed">
                          {q.sql}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn("text-lg font-bold font-mono", getLatencyColor(q.p95))}>
                          {q.p95.toFixed(1)}ms
                        </span>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">p95 Latency</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                      <div className="flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500 uppercase">p50</span>
                          <span className="text-xs text-zinc-300 font-mono">{q.p50}ms</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500 uppercase">p99</span>
                          <span className="text-xs text-zinc-300 font-mono">{q.p99}ms</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-zinc-500 uppercase">Calls</span>
                        <span className="text-xs text-zinc-300 font-mono">{(q.calls / 1000).toFixed(1)}k</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail */}
            {selectedQuery && (
              <div className="col-span-8 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                  <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Query Context</h2>
                      <button 
                        onClick={() => setSelectedQuery(null)}
                        className="text-zinc-500 hover:text-white transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-sm leading-relaxed text-indigo-300 whitespace-pre-wrap">
                      {selectedQuery.sql.split(" ").map((word, i) => (
                        <span key={i} className={cn(
                          ["SELECT", "FROM", "WHERE", "JOIN", "ON", "GROUP", "BY", "ORDER", "LIMIT", "INSERT", "UPDATE", "DELETE", "SET", "VALUES", "AND", "OR"].includes(word.toUpperCase()) 
                            ? "text-indigo-400 font-bold" 
                            : "text-zinc-300"
                        )}>
                          {word}{" "}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Execution Plan</h3>
                      <PlanNode node={selectedQuery.plan} />
                    </div>

                    <div className="flex flex-col gap-8">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Index Statistics</h3>
                        {selectedQuery.indexUsage.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {selectedQuery.indexUsage.map((idx, i) => (
                              <div key={i} className="p-3 bg-zinc-950 rounded border border-zinc-800">
                                <div className="text-xs font-mono text-indigo-400 font-bold mb-2">{idx.indexName}</div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-zinc-500 uppercase">Scans</span>
                                    <span className="text-sm text-zinc-300">{idx.scans.toLocaleString()}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-zinc-500 uppercase">Block Reads</span>
                                    <span className="text-sm text-zinc-300">{idx.reads.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 bg-zinc-950 rounded border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-2">
                            <span className="text-rose-400 text-xs font-bold">MISSING INDEXES</span>
                            <span className="text-[10px] text-zinc-600">Query is performing sequential scans</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Latency Distribution</h3>
                        <div className="flex flex-col gap-3">
                          {[
                            { label: "p50", value: selectedQuery.p50 },
                            { label: "p95", value: selectedQuery.p95 },
                            { label: "p99", value: selectedQuery.p99 }
                          ].map(p => (
                            <div key={p.label} className="flex flex-col gap-1">
                              <div className="flex justify-between text-[10px] uppercase font-bold px-1">
                                <span className="text-zinc-500">{p.label}</span>
                                <span className={getLatencyColor(p.value)}>{p.value}ms</span>
                              </div>
                              <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                                <div 
                                  className={cn("h-full transition-all duration-500", p.label === "p50" ? "bg-emerald-500" : p.label === "p95" ? "bg-amber-500" : "bg-rose-500")}
                                  style={{ width: `${Math.min(100, (p.value / selectedQuery.p99) * 100)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "trends" && (
          <div className="col-span-12 flex flex-col gap-6">
            <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold">Query Load Trends</h2>
                  <p className="text-sm text-zinc-500 italic">Aggregated requests per hour (Last 24h)</p>
                </div>
                <div className="flex gap-4">
                  {[
                    { label: "Select", color: "bg-indigo-500" },
                    { label: "Insert", color: "bg-emerald-400" },
                    { label: "Update", color: "bg-amber-400" },
                    { label: "Delete", color: "bg-rose-400" }
                  ].map(leg => (
                    <div key={leg.label} className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", leg.color)} />
                      <span className="text-[10px] uppercase font-bold text-zinc-400">{leg.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-64 flex items-end gap-1.5 relative">
                {/* Y-Axis mock */}
                <div className="absolute -left-12 top-0 bottom-0 flex flex-col justify-between text-[10px] text-zinc-600 font-mono">
                  <span>8k</span>
                  <span>6k</span>
                  <span>4k</span>
                  <span>2k</span>
                  <span>0</span>
                </div>

                {MOCK_TRENDS.map((t, i) => {
                  const total = t.select + t.insert + t.update + t.delete;
                  const max = 8000;
                  return (
                    <div key={i} className="flex-1 group relative flex flex-col justify-end h-full">
                      <div className="flex flex-col w-full rounded-t-sm overflow-hidden" style={{ height: `${(total / max) * 100}%` }}>
                        <div className="bg-rose-400 w-full" style={{ height: `${(t.delete / total) * 100}%` }} />
                        <div className="bg-amber-400 w-full" style={{ height: `${(t.update / total) * 100}%` }} />
                        <div className="bg-emerald-400 w-full" style={{ height: `${(t.insert / total) * 100}%` }} />
                        <div className="bg-indigo-500 w-full flex-1" />
                      </div>
                      <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 text-[9px] text-zinc-600 font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        {t.hour}
                      </div>
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-zinc-950 border border-zinc-800 rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none min-w-[120px]">
                        <div className="text-[10px] font-bold text-zinc-400 mb-1 border-b border-zinc-800 pb-1">{t.hour}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                          <span className="text-indigo-400">SELECT</span><span className="text-right">{t.select.toLocaleString()}</span>
                          <span className="text-emerald-400">INSERT</span><span className="text-right">{t.insert.toLocaleString()}</span>
                          <span className="text-amber-400">UPDATE</span><span className="text-right">{t.update.toLocaleString()}</span>
                          <span className="text-rose-400">DELETE</span><span className="text-right">{t.delete.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-6">
              {[
                { label: "Throughput", value: "14.2k", sub: "req/sec", trend: "+5.2%" },
                { label: "Error Rate", value: "0.04%", sub: "avg", trend: "-12%" },
                { label: "CPU Load", value: "42%", sub: "cluster", trend: "+2.1%" },
                { label: "Active Conns", value: "842", sub: "connections", trend: "+124" }
              ].map((stat, i) => (
                <div key={i} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">{stat.label}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{stat.value}</span>
                    <span className="text-xs text-zinc-600">{stat.sub}</span>
                  </div>
                  <div className={cn("text-[10px] font-bold mt-2", stat.trend.startsWith("+") ? "text-rose-400" : "text-emerald-400")}>
                    {stat.trend} from last period
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "tables" && (
          <div className="col-span-12 flex flex-col gap-6">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                    <th className="px-6 py-4">Table / Database</th>
                    <th className="px-6 py-4">Rows</th>
                    <th className="px-6 py-4">Size</th>
                    <th className="px-6 py-4">Index Hit Rate</th>
                    <th className="px-6 py-4">Bloat</th>
                    <th className="px-6 py-4">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {MOCK_TABLES.map((table, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold group-hover:text-indigo-400 transition-colors">{table.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{table.database}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-300 font-mono">
                        {table.rows > 1000000 ? (table.rows / 1000000).toFixed(1) + "M" : table.rows.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-300 font-mono">{table.size}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 w-32">
                          <div className="flex justify-between text-[9px] font-bold">
                            <span className={cn(table.indexHitRate > 90 ? "text-emerald-400" : "text-rose-400")}>
                              {table.indexHitRate}%
                            </span>
                          </div>
                          <div className="h-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50">
                            <div 
                              className={cn("h-full transition-all duration-700", table.indexHitRate > 90 ? "bg-emerald-500" : "bg-rose-500")}
                              style={{ width: `${table.indexHitRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold",
                          table.bloat < 5 ? "bg-emerald-500/10 text-emerald-400" :
                          table.bloat < 15 ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"
                        )}>
                          {table.bloat}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {[0, 1, 2, 3, 4].map(dot => (
                            <div 
                              key={dot} 
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                table.indexHitRate > 90 ? "bg-emerald-500" : table.indexHitRate > 70 ? "bg-amber-500" : "bg-rose-500",
                                dot > 3 && "opacity-30"
                              )} 
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "locks" && (
          <div className="col-span-12 grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-2">Active & Recent Lock Events</h2>
              {MOCK_LOCKS.map((lock) => (
                <div key={lock.id} className={cn(
                  "p-6 rounded-2xl border bg-zinc-900 flex flex-col gap-4",
                  lock.isDeadlock ? "border-rose-500/50 bg-rose-500/5" : "border-zinc-800"
                )}>
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          lock.isDeadlock ? "bg-rose-500 text-white" : "bg-amber-500/20 text-amber-400"
                        )}>
                          {lock.isDeadlock ? "Deadlock Detected" : lock.type}
                        </span>
                        <span className="text-xs text-zinc-500 font-mono">{lock.database}</span>
                      </div>
                      <span className="text-[10px] text-zinc-600 font-mono">{lock.timestamp}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-bold font-mono text-rose-400">{lock.waitMs}ms</span>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Wait Time</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">Blocked Query</span>
                      <span className="text-xs font-mono text-indigo-400">{lock.blockedQueryId}</span>
                    </div>
                    <div className="text-zinc-700">←</div>
                    <div className="flex flex-col gap-1 flex-1 text-right">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">Blocking Query</span>
                      <span className="text-xs font-mono text-amber-400">{lock.blockingQueryId}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Lock Wait Stats</h2>
              <div className="flex flex-col gap-8">
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-2xl font-bold">1.2s</span>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Avg Wait Time</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 w-[60%]" />
                    <div className="bg-amber-500 w-[25%]" />
                    <div className="bg-rose-500 w-[15%]" />
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { label: "RowShareLock", count: 1450, color: "bg-indigo-500" },
                    { label: "ExclusiveLock", count: 120, color: "bg-amber-500" },
                    { label: "AccessExclusive", count: 12, color: "bg-rose-500" }
                  ].map(stat => (
                    <div key={stat.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full", stat.color)} />
                        <span className="text-xs text-zinc-300 font-medium">{stat.label}</span>
                      </div>
                      <span className="text-xs font-mono text-zinc-500">{stat.count} events</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Recommendation</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed italic">
                    Detected high wait times on <span className="text-white font-bold">production_main</span>. 
                    Consider breaking up long transactions in the user session cleanup worker.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
        <div className="flex gap-6">
          <span>Cluster: US-EAST-1</span>
          <span>Status: <span className="text-emerald-500">Healthy</span></span>
          <span>Nodes: 8 Active</span>
        </div>
        <div>Last updated: {new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
