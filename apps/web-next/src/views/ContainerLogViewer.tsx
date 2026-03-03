import React, { useState } from "react";
import { cn } from "../lib/utils";

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
type Tab = "live" | "search" | "pods" | "alerts";

interface LogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  pod: string;
  container: string;
  namespace: string;
  message: string;
  fields: Record<string, string>;
}

interface Pod {
  name: string;
  namespace: string;
  containers: string[];
  status: "running" | "pending" | "failed" | "completed";
  restarts: number;
  age: string;
  errorRate: number;
}

interface LogAlert {
  id: string;
  name: string;
  pattern: string;
  level: LogLevel;
  count: number;
  window: string;
  lastFired: string;
  enabled: boolean;
}

const PODS: Pod[] = [
  { name: "api-server-7d8f9b-xkj2p", namespace: "production", containers: ["api", "envoy"], status: "running", restarts: 0, age: "3d", errorRate: 0.2 },
  { name: "api-server-7d8f9b-m3n4q", namespace: "production", containers: ["api", "envoy"], status: "running", restarts: 1, age: "3d", errorRate: 0.4 },
  { name: "worker-5c6d7e-abcxy", namespace: "production", containers: ["worker"], status: "running", restarts: 0, age: "1d", errorRate: 0.0 },
  { name: "ml-inference-9a8b7c-pqrs1", namespace: "production", containers: ["inference", "sidecar"], status: "running", restarts: 2, age: "6h", errorRate: 1.2 },
  { name: "migration-job-20260222", namespace: "production", containers: ["migrate"], status: "completed", restarts: 0, age: "2h", errorRate: 0.0 },
  { name: "scheduler-4f5g6h-ijk3l", namespace: "production", containers: ["scheduler"], status: "running", restarts: 0, age: "5d", errorRate: 0.1 },
  { name: "redis-0", namespace: "production", containers: ["redis", "metrics"], status: "running", restarts: 0, age: "7d", errorRate: 0.0 },
  { name: "postgres-primary-0", namespace: "production", containers: ["postgres", "metrics"], status: "running", restarts: 0, age: "30d", errorRate: 0.0 },
  { name: "ingress-nginx-controller-xyz9", namespace: "ingress", containers: ["nginx"], status: "running", restarts: 0, age: "14d", errorRate: 0.0 },
  { name: "cert-manager-abc12-qwe34", namespace: "cert-manager", containers: ["controller"], status: "running", restarts: 0, age: "30d", errorRate: 0.0 },
];

const LIVE_LOGS: LogEntry[] = [
  { id: "l1", ts: "14:32:01.234", level: "info", pod: "api-server-7d8f9b-xkj2p", container: "api", namespace: "production", message: "POST /api/v2/payments 200 OK (142ms)", fields: { "req_id": "req_8k3j2", "user_id": "u_1234", "amount": "99.00" } },
  { id: "l2", ts: "14:32:01.891", level: "error", pod: "ml-inference-9a8b7c-pqrs1", container: "inference", namespace: "production", message: "Model prediction timeout after 5000ms, falling back to cache", fields: { "model": "fraud-v3", "request_id": "inf_7723" } },
  { id: "l3", ts: "14:32:02.103", level: "info", pod: "api-server-7d8f9b-m3n4q", container: "api", namespace: "production", message: "GET /api/v2/users/profile 200 OK (23ms)", fields: { "req_id": "req_9l4k3", "user_id": "u_5678" } },
  { id: "l4", ts: "14:32:02.445", level: "warn", pod: "worker-5c6d7e-abcxy", container: "worker", namespace: "production", message: "Job queue depth exceeding threshold: 847 pending jobs", fields: { "queue": "email", "threshold": "500" } },
  { id: "l5", ts: "14:32:02.789", level: "debug", pod: "scheduler-4f5g6h-ijk3l", container: "scheduler", namespace: "production", message: "Scheduled job churn-predictor-nightly will run in 127s", fields: { "job_id": "job_chn_002", "cron": "0 2 * * *" } },
  { id: "l6", ts: "14:32:03.012", level: "error", pod: "ml-inference-9a8b7c-pqrs1", container: "inference", namespace: "production", message: "CUDA device out of memory: tried to allocate 512MB", fields: { "device": "cuda:0", "free_mb": "312", "total_gb": "40" } },
  { id: "l7", ts: "14:32:03.334", level: "info", pod: "redis-0", container: "redis", namespace: "production", message: "Keyspace notification: expired key user:session:u_9012", fields: { "key": "user:session:u_9012", "ttl_was": "3600" } },
  { id: "l8", ts: "14:32:03.677", level: "info", pod: "api-server-7d8f9b-xkj2p", container: "api", namespace: "production", message: "POST /api/v2/auth/login 200 OK (89ms)", fields: { "req_id": "req_2m5n6", "user_id": "u_3456" } },
  { id: "l9", ts: "14:32:04.001", level: "warn", pod: "postgres-primary-0", container: "postgres", namespace: "production", message: "Slow query detected: 2342ms (threshold: 1000ms)", fields: { "query_hash": "qh_b7c4d2", "table": "transactions", "rows": "4.2M" } },
  { id: "l10", ts: "14:32:04.289", level: "fatal", pod: "ml-inference-9a8b7c-pqrs1", container: "inference", namespace: "production", message: "Process exiting: unhandled exception in inference loop", fields: { "exit_code": "1", "signal": "SIGABRT" } },
  { id: "l11", ts: "14:32:04.556", level: "info", pod: "api-server-7d8f9b-m3n4q", container: "envoy", namespace: "production", message: "Health check passed: upstream api:8080 is healthy", fields: { "upstream": "api:8080" } },
  { id: "l12", ts: "14:32:04.891", level: "info", pod: "worker-5c6d7e-abcxy", container: "worker", namespace: "production", message: "Processed email job job_email_3421 in 234ms", fields: { "job_id": "job_email_3421", "recipient": "user@example.com" } },
  { id: "l13", ts: "14:32:05.123", level: "warn", pod: "ingress-nginx-controller-xyz9", container: "nginx", namespace: "ingress", message: "Rate limit triggered for IP 192.168.45.23 on /api/v2/", fields: { "ip": "192.168.45.23", "limit": "100/min", "current": "142/min" } },
  { id: "l14", ts: "14:32:05.445", level: "debug", pod: "scheduler-4f5g6h-ijk3l", container: "scheduler", namespace: "production", message: "Lock acquired for job weekly-report-generator", fields: { "job_id": "job_rpt_007", "ttl": "300s" } },
  { id: "l15", ts: "14:32:05.889", level: "error", pod: "api-server-7d8f9b-xkj2p", container: "api", namespace: "production", message: "Database connection pool exhausted: 50/50 connections in use", fields: { "pool": "primary", "max_conn": "50", "waiting": "3" } },
];

const LOG_ALERTS: LogAlert[] = [
  { id: "a1", name: "Fatal errors", pattern: "level:fatal", level: "fatal", count: 5, window: "5m", lastFired: "1m ago", enabled: true },
  { id: "a2", name: "DB connection exhausted", pattern: "connection pool exhausted", level: "error", count: 3, window: "10m", lastFired: "1m ago", enabled: true },
  { id: "a3", name: "OOM events", pattern: "out of memory", level: "error", count: 2, window: "5m", lastFired: "2m ago", enabled: true },
  { id: "a4", name: "High queue depth", pattern: "queue depth exceeding", level: "warn", count: 10, window: "15m", lastFired: "2m ago", enabled: true },
  { id: "a5", name: "Slow queries", pattern: "Slow query detected", level: "warn", count: 5, window: "5m", lastFired: "30m ago", enabled: true },
  { id: "a6", name: "Rate limit triggers", pattern: "Rate limit triggered", level: "warn", count: 20, window: "1m", lastFired: "30s ago", enabled: false },
];

const levelColor: Record<LogLevel, string> = {
  debug: "text-zinc-500",
  info: "text-sky-400",
  warn: "text-amber-400",
  error: "text-rose-400",
  fatal: "text-purple-400",
};

const levelBg: Record<LogLevel, string> = {
  debug: "bg-zinc-700/30",
  info: "bg-sky-500/5",
  warn: "bg-amber-500/5",
  error: "bg-rose-500/8",
  fatal: "bg-purple-500/10 border-l-2 border-purple-500",
};

const levelBadge: Record<LogLevel, string> = {
  debug: "bg-zinc-700/40 text-zinc-500",
  info: "bg-sky-500/10 text-sky-400",
  warn: "bg-amber-500/10 text-amber-400",
  error: "bg-rose-500/10 text-rose-400",
  fatal: "bg-purple-500/15 text-purple-400 font-bold",
};

const podStatusColor: Record<string, string> = {
  running: "bg-emerald-400",
  pending: "bg-amber-400 animate-pulse",
  failed: "bg-rose-400",
  completed: "bg-zinc-500",
};

export default function ContainerLogViewer() {
  const [tab, setTab] = useState<Tab>("live");
  const [selectedPod, setSelectedPod] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [namespaceFilter, setNamespaceFilter] = useState<string>("all");
  const [wrapLines, setWrapLines] = useState(false);
  const [showFields, setShowFields] = useState(true);

  const filteredLogs = LIVE_LOGS.filter(log => {
    if (selectedPod !== "all" && log.pod !== selectedPod) {return false;}
    if (levelFilter !== "all" && log.level !== levelFilter) {return false;}
    if (namespaceFilter !== "all" && log.namespace !== namespaceFilter) {return false;}
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return log.message.toLowerCase().includes(q) ||
        log.pod.toLowerCase().includes(q) ||
        Object.values(log.fields).some(v => v.toLowerCase().includes(q));
    }
    return true;
  });

  const levelCounts = LIVE_LOGS.reduce<Record<string, number>>((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {});

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "live", label: "Live Logs", emoji: "📡" },
    { id: "search", label: "Search", emoji: "🔍" },
    { id: "pods", label: "Pods", emoji: "📦" },
    { id: "alerts", label: "Alerts", emoji: "🔔" },
  ];

  const namespaces = [...new Set(PODS.map(p => p.namespace))];

  const renderLogLine = (log: LogEntry) => (
    <div key={log.id}>
      <div
        className={cn(
          "flex items-start gap-0 px-3 py-1 font-mono text-xs cursor-pointer hover:brightness-125 transition-all",
          levelBg[log.level],
          expandedLog === log.id && "border-b border-zinc-700"
        )}
        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
      >
        <span className="text-zinc-600 w-20 shrink-0 pt-0.5">{log.ts}</span>
        <span className={cn("w-12 shrink-0 text-center mr-2 rounded px-1 pt-0.5", levelBadge[log.level])}>{log.level}</span>
        <span className="text-indigo-400 w-44 shrink-0 truncate pt-0.5" title={log.pod}>{log.pod.split("-").slice(0, 2).join("-")}</span>
        <span className="text-zinc-500 w-20 shrink-0 pt-0.5">{log.container}</span>
        <span className={cn(
          levelColor[log.level],
          wrapLines ? "break-all" : "truncate",
          "flex-1 pt-0.5"
        )}>
          {log.message}
        </span>
        {showFields && Object.keys(log.fields).length > 0 && (
          <span className="text-zinc-600 ml-2 shrink-0 pt-0.5 text-xs">
            {Object.entries(log.fields).slice(0, 2).map(([k, v]) => (
              <span key={k} className="mr-2">
                <span className="text-zinc-700">{k}=</span>
                <span className="text-zinc-500">{v}</span>
              </span>
            ))}
          </span>
        )}
      </div>
      {expandedLog === log.id && (
        <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800 font-mono text-xs">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2">
            <div><span className="text-zinc-600">pod: </span><span className="text-zinc-300">{log.pod}</span></div>
            <div><span className="text-zinc-600">namespace: </span><span className="text-zinc-300">{log.namespace}</span></div>
            <div><span className="text-zinc-600">container: </span><span className="text-zinc-300">{log.container}</span></div>
            <div><span className="text-zinc-600">timestamp: </span><span className="text-zinc-300">{log.ts}</span></div>
          </div>
          {Object.keys(log.fields).length > 0 && (
            <div>
              <div className="text-zinc-600 mb-1">fields:</div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 ml-2">
                {Object.entries(log.fields).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-sky-600">{k}: </span>
                    <span className="text-zinc-300">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Container Log Viewer</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Kubernetes · production cluster · {PODS.length} pods</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Streaming</span>
          </div>
        </div>
      </div>

      {/* Level summary */}
      <div className="flex gap-0 border-b border-zinc-800">
        {(["fatal", "error", "warn", "info", "debug"] as LogLevel[]).map(level => (
          <button
            key={level}
            onClick={() => setLevelFilter(levelFilter === level ? "all" : level)}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors border-b-2",
              levelFilter === level ? "border-indigo-500 bg-indigo-500/5" : "border-transparent hover:bg-zinc-900"
            )}
          >
            <span className={levelColor[level]}>{level.toUpperCase()}</span>
            <span className="text-zinc-600 ml-1">({levelCounts[level] || 0})</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* LIVE LOGS TAB */}
        {tab === "live" && (
          <div className="flex flex-col h-full">
            {/* Filters */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/40">
              <select
                value={selectedPod}
                onChange={e => setSelectedPod(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 w-48"
              >
                <option value="all">All pods</option>
                {PODS.map(p => (
                  <option key={p.name} value={p.name}>{p.name.split("-").slice(0, 2).join("-")}</option>
                ))}
              </select>
              <select
                value={namespaceFilter}
                onChange={e => setNamespaceFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
              >
                <option value="all">All namespaces</option>
                {namespaces.map(ns => (
                  <option key={ns} value={ns}>{ns}</option>
                ))}
              </select>
              <div className="flex items-center gap-3 ml-auto text-xs text-zinc-500">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={wrapLines} onChange={e => setWrapLines(e.target.checked)} className="w-3 h-3" />
                  Wrap
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showFields} onChange={e => setShowFields(e.target.checked)} className="w-3 h-3" />
                  Show fields
                </label>
                <button className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 transition-colors">
                  ⬇ Download
                </button>
              </div>
            </div>
            {/* Log lines */}
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-zinc-800/30">
                {filteredLogs.map(renderLogLine)}
              </div>
            </div>
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === "search" && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-zinc-800">
              <input
                type="text"
                placeholder='Search logs... (e.g. "error", pod:api-server, "timeout")'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500 font-mono"
              />
              <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                <span className="px-2 py-0.5 bg-zinc-800 rounded font-mono">level:error</span>
                <span className="px-2 py-0.5 bg-zinc-800 rounded font-mono">pod:api-server*</span>
                <span className="px-2 py-0.5 bg-zinc-800 rounded font-mono">"connection refused"</span>
                <span className="px-2 py-0.5 bg-zinc-800 rounded font-mono">container:envoy</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {searchQuery ? (
                <div>
                  <div className="px-4 py-2 text-xs text-zinc-500 border-b border-zinc-800">
                    {filteredLogs.length} results for "{searchQuery}"
                  </div>
                  <div className="divide-y divide-zinc-800/30">
                    {filteredLogs.map(renderLogLine)}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                  Enter a search query to filter logs
                </div>
              )}
            </div>
          </div>
        )}

        {/* PODS TAB */}
        {tab === "pods" && (
          <div className="p-6">
            <div className="space-y-2">
              {PODS.map(pod => (
                <div
                  key={pod.name}
                  className="bg-zinc-900 rounded-lg border border-zinc-800 px-5 py-4 cursor-pointer hover:border-zinc-700 transition-colors"
                  onClick={() => { setTab("live"); setSelectedPod(pod.name); }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full shrink-0", podStatusColor[pod.status])} />
                      <div>
                        <span className="font-mono text-sm text-white">{pod.name}</span>
                        <span className="text-xs text-zinc-500 ml-2">{pod.namespace}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      {pod.restarts > 0 && (
                        <span className={cn("font-medium", pod.restarts > 1 ? "text-amber-400" : "text-zinc-400")}>
                          {pod.restarts} restarts
                        </span>
                      )}
                      <span>age: {pod.age}</span>
                      {pod.errorRate > 0 && (
                        <span className={cn("font-medium", pod.errorRate > 1 ? "text-rose-400" : "text-amber-400")}>
                          {pod.errorRate.toFixed(1)} err/s
                        </span>
                      )}
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs",
                        pod.status === "running" ? "bg-emerald-500/10 text-emerald-400" :
                        pod.status === "failed" ? "bg-rose-500/10 text-rose-400" :
                        pod.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                        "bg-zinc-700/30 text-zinc-500"
                      )}>{pod.status}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {pod.containers.map(c => (
                      <span key={c} className="text-xs px-2 py-0.5 bg-zinc-800 rounded font-mono text-zinc-400">{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ALERTS TAB */}
        {tab === "alerts" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-zinc-300">Log Alerts</h2>
              <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">
                + New Alert
              </button>
            </div>

            {/* Active alerts banner */}
            {LOG_ALERTS.filter(a => a.enabled).length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
                <span className="text-rose-400 font-medium text-sm">
                  🔔 {LOG_ALERTS.filter(a => a.enabled && a.lastFired.includes("m ago")).length} alerts firing
                </span>
                <span className="text-xs text-rose-300/60">ml-inference OOM, DB connection exhaustion, high queue depth</span>
              </div>
            )}

            <div className="space-y-2">
              {LOG_ALERTS.map(alert => (
                <div key={alert.id} className={cn(
                  "bg-zinc-900 rounded-lg border px-5 py-4",
                  alert.enabled ? "border-zinc-700" : "border-zinc-800 opacity-60"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded font-medium", levelBadge[alert.level])}>{alert.level}</span>
                      <span className="font-medium text-sm text-zinc-200">{alert.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500">last: {alert.lastFired}</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <div className={cn(
                          "w-8 h-4 rounded-full transition-colors relative",
                          alert.enabled ? "bg-indigo-600" : "bg-zinc-700"
                        )}>
                          <div className={cn(
                            "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                            alert.enabled ? "translate-x-4" : "translate-x-0.5"
                          )} />
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                    <span>Pattern: <span className="font-mono text-zinc-400">{alert.pattern}</span></span>
                    <span>Threshold: {alert.count} occurrences in {alert.window}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
