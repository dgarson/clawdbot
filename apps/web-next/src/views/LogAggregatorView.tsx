import React, { useState } from "react";
import { cn } from "../lib/utils";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
type LogSource = "api-gateway" | "user-service" | "auth-service" | "billing-service" | "worker" | "scheduler";
type TimeRange = "1h" | "6h" | "24h" | "7d";

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  traceId: string;
  spanId: string;
  fields: Record<string, string | number>;
  expanded?: boolean;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  createdBy: string;
  createdAt: string;
}

interface VolumePoint {
  time: string;
  debug: number;
  info: number;
  warn: number;
  error: number;
  fatal: number;
}

interface SourceStats {
  source: LogSource;
  total: number;
  errorRate: number;
  trend: number;
}

const LOGS: LogEntry[] = [
  { id: "l1", timestamp: "10:42:31.841", level: "ERROR", source: "api-gateway", message: "Upstream connection timeout for service user-service after 5000ms", traceId: "a3f92c8e", spanId: "b1d4", fields: { duration_ms: 5000, status: 503, upstream: "user-service", retries: 3 } },
  { id: "l2", timestamp: "10:42:31.102", level: "WARN", source: "auth-service", message: "Rate limit approaching for client_id=cli_abc123: 950/1000 requests used", traceId: "b7e41d2a", spanId: "c2e5", fields: { client_id: "cli_abc123", limit: 1000, used: 950, window: "1m" } },
  { id: "l3", timestamp: "10:42:30.577", level: "INFO", source: "billing-service", message: "Payment processed successfully for customer cus_xyz789", traceId: "c9a03e4b", spanId: "d3f6", fields: { customer_id: "cus_xyz789", amount: 299.00, currency: "USD", method: "card" } },
  { id: "l4", timestamp: "10:42:30.219", level: "INFO", source: "user-service", message: "User profile updated: usr_123 changed email address", traceId: "d2f57b1c", spanId: "e4g7", fields: { user_id: "usr_123", field: "email", old_domain: "gmail.com", new_domain: "company.com" } },
  { id: "l5", timestamp: "10:42:29.883", level: "FATAL", source: "api-gateway", message: "Circuit breaker OPEN for upstream auth-service after 10 consecutive failures", traceId: "e8c12a5d", spanId: "f5h8", fields: { service: "auth-service", failures: 10, state: "OPEN", recovery_in: 30 } },
  { id: "l6", timestamp: "10:42:29.441", level: "DEBUG", source: "scheduler", message: "Job invoice-generator-daily started with 1204 pending invoices", traceId: "f1b36e7c", spanId: "g6i9", fields: { job_id: "invoice-gen-daily", pending_count: 1204, estimated_duration_min: 14 } },
  { id: "l7", timestamp: "10:42:28.971", level: "ERROR", source: "worker", message: "Failed to process event order.created evt_001HX after 3 attempts: queue consumer timeout", traceId: "g4d92f8a", spanId: "h7j0", fields: { event_id: "evt_001HX", attempts: 3, queue: "orders-processing", error: "ConsumerTimeoutError" } },
  { id: "l8", timestamp: "10:42:28.542", level: "INFO", source: "auth-service", message: "JWT issued for usr_456 - scope: read:all,write:profile expires in 3600s", traceId: "h7f21c4b", spanId: "i8k1", fields: { user_id: "usr_456", scope: "read:all,write:profile", ttl: 3600 } },
  { id: "l9", timestamp: "10:42:28.103", level: "WARN", source: "billing-service", message: "Webhook delivery failed for endpoint https://api.acme.com/webhooks/orders (attempt 2/5)", traceId: "i2a54d9e", spanId: "j9l2", fields: { endpoint: "https://api.acme.com/webhooks/orders", attempt: 2, max_attempts: 5, response_code: 503 } },
  { id: "l10", timestamp: "10:42:27.674", level: "INFO", source: "api-gateway", message: "GET /api/users/profile 200 OK 124ms", traceId: "j5c87e2f", spanId: "k0m3", fields: { method: "GET", path: "/api/users/profile", status: 200, duration_ms: 124 } },
  { id: "l11", timestamp: "10:42:27.201", level: "DEBUG", source: "user-service", message: "Cache hit for user profile usr_789 (key: profile:usr_789:v2)", traceId: "k8e14f5g", spanId: "l1n4", fields: { user_id: "usr_789", cache_key: "profile:usr_789:v2", ttl_remaining: 287 } },
  { id: "l12", timestamp: "10:42:26.812", level: "ERROR", source: "worker", message: "Database connection pool exhausted: 100/100 connections in use", traceId: "l3g47h8i", spanId: "m2o5", fields: { pool_size: 100, active_connections: 100, waiting_requests: 23, queue_wait_ms: 4200 } },
];

const SAVED_SEARCHES: SavedSearch[] = [
  { id: "ss1", name: "Production Errors", query: "level:ERROR OR level:FATAL source:api-gateway,user-service", createdBy: "alice", createdAt: "2d ago" },
  { id: "ss2", name: "Auth Issues", query: "source:auth-service level:WARN OR level:ERROR", createdBy: "bob", createdAt: "1w ago" },
  { id: "ss3", name: "Slow Requests > 1s", query: "duration_ms:>1000 level:INFO", createdBy: "carol", createdAt: "3d ago" },
  { id: "ss4", name: "Circuit Breaker Events", query: "message:circuit breaker", createdBy: "dave", createdAt: "5d ago" },
];

const VOLUME: VolumePoint[] = [
  { time: "10:30", debug: 4200, info: 18400, warn: 340, error: 82, fatal: 1 },
  { time: "10:32", debug: 3900, info: 17200, warn: 290, error: 74, fatal: 0 },
  { time: "10:34", debug: 4100, info: 19100, warn: 410, error: 91, fatal: 0 },
  { time: "10:36", debug: 4500, info: 20200, warn: 480, error: 124, fatal: 2 },
  { time: "10:38", debug: 5100, info: 22100, warn: 620, error: 187, fatal: 4 },
  { time: "10:40", debug: 4800, info: 21400, warn: 540, error: 203, fatal: 5 },
  { time: "10:42", debug: 4300, info: 19800, warn: 490, error: 178, fatal: 3 },
];

const SOURCE_STATS: SourceStats[] = [
  { source: "api-gateway", total: 48210, errorRate: 2.1, trend: 8.4 },
  { source: "user-service", total: 31890, errorRate: 0.4, trend: -1.2 },
  { source: "auth-service", total: 28340, errorRate: 0.2, trend: 2.8 },
  { source: "billing-service", total: 12190, errorRate: 1.8, trend: 4.1 },
  { source: "worker", total: 9820, errorRate: 3.2, trend: 15.7 },
  { source: "scheduler", total: 2140, errorRate: 0.1, trend: -0.3 },
];

const levelColor: Record<LogLevel, string> = {
  DEBUG: "text-[var(--color-text-muted)]",
  INFO:  "text-sky-400",
  WARN:  "text-amber-400",
  ERROR: "text-rose-400",
  FATAL: "text-rose-300",
};

const levelBg: Record<LogLevel, string> = {
  DEBUG: "bg-[var(--color-surface-3)]/30 border-[var(--color-border)]/50",
  INFO:  "bg-sky-500/10 border-sky-500/20",
  WARN:  "bg-amber-500/10 border-amber-500/20",
  ERROR: "bg-rose-500/10 border-rose-500/30",
  FATAL: "bg-rose-500/20 border-rose-500/50",
};

const levelBadge: Record<LogLevel, string> = {
  DEBUG: "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]",
  INFO:  "bg-sky-500/15 text-sky-400",
  WARN:  "bg-amber-500/15 text-amber-400",
  ERROR: "bg-rose-500/15 text-rose-400",
  FATAL: "bg-rose-500/30 text-rose-200 font-bold",
};

const maxVolume = Math.max(...VOLUME.map(v => v.debug + v.info + v.warn + v.error + v.fatal));
const maxSourceTotal = Math.max(...SOURCE_STATS.map(s => s.total));

export default function LogAggregatorView() {
  const [tab, setTab] = useState<"stream" | "volume" | "sources" | "saved">("stream");
  const [levelFilter, setLevelFilter] = useState<"all" | LogLevel>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | LogSource>("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");

  const filtered = LOGS.filter(l =>
    (levelFilter === "all" || l.level === levelFilter) &&
    (sourceFilter === "all" || l.source === sourceFilter) &&
    (query === "" || l.message.toLowerCase().includes(query.toLowerCase()) || l.traceId.includes(query))
  );

  const errorCount = LOGS.filter(l => l.level === "ERROR" || l.level === "FATAL").length;
  const warnCount = LOGS.filter(l => l.level === "WARN").length;

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Log Aggregator</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{SOURCE_STATS.length} sources · Real-time log streaming</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {(["1h", "6h", "24h", "7d"] as TimeRange[]).map(t => (
                <button key={t} onClick={() => setTimeRange(t)}
                  className={cn("px-2 py-1 rounded text-xs font-mono transition-colors",
                    timeRange === t ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Stats */}
        <div className="flex gap-4 mt-3">
          {[
            { label: "Total Logs", value: LOGS.length.toLocaleString(), color: "text-[var(--color-text-primary)]" },
            { label: "Errors", value: errorCount, color: errorCount > 0 ? "text-rose-400" : "text-emerald-400" },
            { label: "Warnings", value: warnCount, color: warnCount > 0 ? "text-amber-400" : "text-[var(--color-text-primary)]" },
            { label: "Ingestion Rate", value: "~25K/min", color: "text-sky-400" },
          ].map(s => (
            <div key={s.label}>
              <span className={cn("text-base font-bold", s.color)}>{s.value}</span>
              <span className="text-[var(--color-text-muted)] text-xs ml-1.5">{s.label}</span>
            </div>
          ))}
        </div>
        {/* Search + Tabs */}
        <div className="mt-3 space-y-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search logs, trace IDs, messages..."
            className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-primary"
          />
          <div className="flex gap-1">
            {(["stream", "volume", "sources", "saved"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                  tab === t ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]")}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Log Stream Tab */}
        {tab === "stream" && (
          <div className="flex flex-col h-full">
            {/* Filters */}
            <div className="flex-none px-4 py-2 border-b border-[var(--color-border)] flex flex-wrap gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--color-text-muted)]">Level:</span>
                {(["all", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"] as const).map(l => (
                  <button key={l} onClick={() => setLevelFilter(l)}
                    className={cn("px-2 py-0.5 rounded text-[10px] transition-colors",
                      levelFilter === l ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--color-text-muted)]">Source:</span>
                <select
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value as "all" | LogSource)}
                  className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text-primary)] focus:outline-none"
                >
                  <option value="all">all</option>
                  {(["api-gateway", "user-service", "auth-service", "billing-service", "worker", "scheduler"] as LogSource[]).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Log stream */}
            <div className="flex-1 overflow-y-auto font-mono text-[11px]">
              {filtered.map(log => (
                <div key={log.id} className={cn("border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-1)]/50 transition-colors cursor-pointer", levelBg[log.level])}
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                  <div className="flex items-start gap-3 px-4 py-2">
                    <span className="text-[var(--color-text-muted)] flex-none w-20">{log.timestamp}</span>
                    <span className={cn("flex-none px-1.5 py-0.5 rounded text-[9px] font-bold w-11 text-center", levelBadge[log.level])}>{log.level}</span>
                    <span className="text-primary flex-none w-24 truncate">{log.source}</span>
                    <span className={cn("flex-1 min-w-0 truncate", levelColor[log.level])}>{log.message}</span>
                    <span className="text-[var(--color-text-muted)] flex-none">{log.traceId}</span>
                  </div>
                  {expandedLog === log.id && (
                    <div className="px-4 pb-3 pt-1 bg-[var(--color-surface-1)]/80">
                      <div className="bg-[var(--color-surface-0)] rounded-lg p-3 border border-[var(--color-border)]">
                        <div className="text-[10px] text-[var(--color-text-muted)] mb-2">Fields</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {Object.entries(log.fields).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-2">
                              <span className="text-primary">{k}:</span>
                              <span className="text-[var(--color-text-primary)]">{String(v)}</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-2"><span className="text-primary">trace_id:</span><span className="text-[var(--color-text-primary)]">{log.traceId}</span></div>
                          <div className="flex items-center gap-2"><span className="text-primary">span_id:</span><span className="text-[var(--color-text-primary)]">{log.spanId}</span></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">No logs match your filters</div>
              )}
            </div>
          </div>
        )}

        {/* Volume Tab */}
        {tab === "volume" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)] mb-4">
              <div className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Log Volume by Level (last {timeRange})</div>
              <div className="flex items-end gap-2 h-48">
                {VOLUME.map(v => {
                  const total = v.debug + v.info + v.warn + v.error + v.fatal;
                  return (
                    <div key={v.time} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[9px] text-[var(--color-text-muted)]">{(total / 1000).toFixed(0)}K</div>
                      <div className="w-full flex flex-col-reverse rounded overflow-hidden gap-px" style={{ height: `${(total / maxVolume) * 180}px` }}>
                        {v.fatal > 0 && <div className="bg-rose-300" style={{ flex: v.fatal }} />}
                        {v.error > 0 && <div className="bg-rose-500" style={{ flex: v.error }} />}
                        {v.warn > 0 && <div className="bg-amber-500" style={{ flex: v.warn }} />}
                        {v.info > 0 && <div className="bg-sky-500" style={{ flex: v.info }} />}
                        {v.debug > 0 && <div className="bg-[var(--color-surface-3)]" style={{ flex: v.debug }} />}
                      </div>
                      <div className="text-[9px] text-[var(--color-text-muted)]">{v.time}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-3 text-[10px]">
                {[
                  { label: "FATAL", color: "bg-rose-300" },
                  { label: "ERROR", color: "bg-rose-500" },
                  { label: "WARN", color: "bg-amber-500" },
                  { label: "INFO", color: "bg-sky-500" },
                  { label: "DEBUG", color: "bg-[var(--color-surface-3)]" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-sm", l.color)} />
                    <span className="text-[var(--color-text-muted)]">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sources Tab */}
        {tab === "sources" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-3">
              {SOURCE_STATS.toSorted((a, b) => b.total - a.total).map(ss => (
                <div key={ss.source} className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-mono text-sm font-medium text-[var(--color-text-primary)]">{ss.source}</div>
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className={cn("font-semibold", ss.errorRate > 2 ? "text-rose-400" : ss.errorRate > 0.5 ? "text-amber-400" : "text-emerald-400")}>{ss.errorRate}%</span>
                        <span className="text-[var(--color-text-muted)] ml-1">errors</span>
                      </div>
                      <div>
                        <span className={cn("font-semibold", ss.trend > 10 ? "text-rose-400" : ss.trend > 0 ? "text-amber-400" : "text-emerald-400")}>
                          {ss.trend > 0 ? "↑" : "↓"}{Math.abs(ss.trend)}%
                        </span>
                        <span className="text-[var(--color-text-muted)] ml-1">trend</span>
                      </div>
                      <div className="text-[var(--color-text-primary)] font-semibold">{ss.total.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="w-full bg-[var(--color-surface-2)] rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(ss.total / maxSourceTotal) * 100}%` }} />
                  </div>
                  <div className="mt-1.5 w-full bg-[var(--color-surface-2)] rounded-full h-1">
                    <div className="bg-rose-500 h-1 rounded-full" style={{ width: `${ss.errorRate * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Saved Searches Tab */}
        {tab === "saved" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Saved Searches</h2>
              <button className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary text-xs font-medium transition-colors">Save Current</button>
            </div>
            <div className="space-y-2">
              {SAVED_SEARCHES.map(ss => (
                <div key={ss.id} className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)] hover:border-[var(--color-border)] transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--color-text-primary)] text-sm">{ss.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setQuery(ss.query)}
                        className="px-2.5 py-1 rounded text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-colors">
                        Load
                      </button>
                      <button className="px-2.5 py-1 rounded text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] transition-colors">Delete</button>
                    </div>
                  </div>
                  <div className="mt-2 font-mono text-[11px] bg-[var(--color-surface-0)] rounded px-2.5 py-1.5 border border-[var(--color-border)] text-emerald-400">{ss.query}</div>
                  <div className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">Saved by {ss.createdBy} · {ss.createdAt}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
