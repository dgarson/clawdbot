import React, { useState } from "react";
import { cn } from "../lib/utils";

type EndpointStatus = "healthy" | "degraded" | "down" | "unknown";
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";
type AlertSeverity = "critical" | "warning" | "info";

interface Endpoint {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  status: EndpointStatus;
  latencyMs: number;
  p95Ms: number;
  p99Ms: number;
  successRate: number; // percent
  checksPerMin: number;
  lastChecked: string;
  responseCode: number;
  region: string;
  tags: string[];
  uptime30d: number; // percent
}

interface IncidentRecord {
  id: string;
  endpointId: string;
  endpointName: string;
  startTime: string;
  endTime: string | null;
  duration: string;
  impact: string;
  rootCause: string;
}

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: AlertSeverity;
  enabled: boolean;
  lastFired: string | null;
}

interface LatencyPoint {
  time: string;
  p50: number;
  p95: number;
  p99: number;
}

const statusBadge: Record<EndpointStatus, string> = {
  healthy:  "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  degraded: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  down:     "bg-rose-500/20 text-rose-400 border border-rose-500/30",
  unknown:  "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)] border border-[var(--color-surface-3)]/30",
};

const statusDot: Record<EndpointStatus, string> = {
  healthy:  "bg-emerald-400",
  degraded: "bg-amber-400",
  down:     "bg-rose-400 animate-pulse",
  unknown:  "bg-[var(--color-surface-3)]",
};

const methodColor: Record<HttpMethod, string> = {
  GET:    "bg-emerald-500/20 text-emerald-400",
  POST:   "bg-sky-500/20 text-sky-400",
  PUT:    "bg-amber-500/20 text-amber-400",
  DELETE: "bg-rose-500/20 text-rose-400",
  PATCH:  "bg-violet-500/20 text-violet-400",
  HEAD:   "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)]",
};

const alertSeverityColor: Record<AlertSeverity, string> = {
  critical: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  warning:  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  info:     "bg-sky-500/20 text-sky-400 border-sky-500/30",
};

const endpoints: Endpoint[] = [
  {
    id: "e1", name: "Auth: Login",        url: "https://api.example.com/v1/auth/login",         method: "POST",  status: "healthy",  latencyMs: 82,   p95Ms: 145,  p99Ms: 210,  successRate: 99.8, checksPerMin: 60, lastChecked: "5s ago",  responseCode: 200, region: "us-east-1", tags: ["auth","critical"],   uptime30d: 99.97,
  },
  {
    id: "e2", name: "Users: Get Profile", url: "https://api.example.com/v1/users/:id",           method: "GET",   status: "healthy",  latencyMs: 45,   p95Ms: 98,   p99Ms: 140,  successRate: 99.9, checksPerMin: 60, lastChecked: "3s ago",  responseCode: 200, region: "us-east-1", tags: ["users","read"],      uptime30d: 99.99,
  },
  {
    id: "e3", name: "Search: Query",      url: "https://api.example.com/v1/search",              method: "GET",   status: "degraded", latencyMs: 820,  p95Ms: 2100, p99Ms: 4500, successRate: 97.2, checksPerMin: 60, lastChecked: "8s ago",  responseCode: 200, region: "us-east-1", tags: ["search","perf"],     uptime30d: 99.2,
  },
  {
    id: "e4", name: "Payments: Charge",   url: "https://api.example.com/v1/payments/charge",     method: "POST",  status: "healthy",  latencyMs: 310,  p95Ms: 680,  p99Ms: 1100, successRate: 99.95, checksPerMin: 30, lastChecked: "12s ago", responseCode: 200, region: "us-east-1", tags: ["payments","critical"], uptime30d: 99.98,
  },
  {
    id: "e5", name: "Webhooks: Deliver",  url: "https://api.example.com/v1/webhooks/deliver",    method: "POST",  status: "down",     latencyMs: 0,    p95Ms: 0,    p99Ms: 0,    successRate: 0,    checksPerMin: 60, lastChecked: "2s ago",  responseCode: 503, region: "us-east-1", tags: ["webhooks"],          uptime30d: 98.1,
  },
  {
    id: "e6", name: "Analytics: Track",  url: "https://api.example.com/v1/analytics/track",     method: "POST",  status: "healthy",  latencyMs: 28,   p95Ms: 55,   p99Ms: 80,   successRate: 99.7, checksPerMin: 60, lastChecked: "1s ago",  responseCode: 202, region: "us-east-1", tags: ["analytics"],        uptime30d: 99.95,
  },
  {
    id: "e7", name: "Files: Upload",      url: "https://api.example.com/v1/files/upload",        method: "POST",  status: "healthy",  latencyMs: 220,  p95Ms: 850,  p99Ms: 1800, successRate: 99.4, checksPerMin: 10, lastChecked: "30s ago", responseCode: 201, region: "us-east-1", tags: ["files"],             uptime30d: 99.8,
  },
  {
    id: "e8", name: "Admin: Stats",       url: "https://api.example.com/v1/admin/stats",         method: "GET",   status: "unknown",  latencyMs: 0,    p95Ms: 0,    p99Ms: 0,    successRate: 0,    checksPerMin: 5,  lastChecked: "5m ago",  responseCode: 0,   region: "eu-central-1", tags: ["admin"],          uptime30d: 95.0,
  },
];

const incidents: IncidentRecord[] = [
  { id: "i1", endpointId: "e5", endpointName: "Webhooks: Deliver",  startTime: "2025-02-22 14:10", endTime: null,               duration: "12m (ongoing)", impact: "Webhook deliveries failing, downstream integrations delayed.", rootCause: "Investigating — potential pod OOM in webhook-worker namespace." },
  { id: "i2", endpointId: "e3", endpointName: "Search: Query",      startTime: "2025-02-22 11:30", endTime: "2025-02-22 12:05", duration: "35min",         impact: "Search latency 10x normal, some timeouts.", rootCause: "Elasticsearch shard rebalancing triggered by node addition." },
  { id: "i3", endpointId: "e1", endpointName: "Auth: Login",        startTime: "2025-02-20 03:14", endTime: "2025-02-20 03:22", duration: "8min",          impact: "Login failures for EU users, 503 responses.", rootCause: "Redis session store connection exhaustion; pool size increased." },
];

const alertRules: AlertRule[] = [
  { id: "a1", name: "High Latency",      condition: "p95 > 2000ms for 3 consecutive checks",  severity: "warning",  enabled: true,  lastFired: "35m ago" },
  { id: "a2", name: "Down (503+)",       condition: "response code >= 500 for 2 checks",       severity: "critical", enabled: true,  lastFired: "12m ago" },
  { id: "a3", name: "Success Rate Drop", condition: "success rate < 98% over 5min window",     severity: "critical", enabled: true,  lastFired: "2d ago" },
  { id: "a4", name: "Cert Expiry",       condition: "TLS cert expires in < 14 days",           severity: "warning",  enabled: true,  lastFired: null },
  { id: "a5", name: "Slow Response",     condition: "p50 > 500ms for 5 consecutive checks",    severity: "info",     enabled: false, lastFired: null },
  { id: "a6", name: "Unknown Status",    condition: "no successful check for 5 minutes",       severity: "warning",  enabled: true,  lastFired: "4h ago" },
];

// Latency sparkline data (last 12 intervals)
const latencyHistory: LatencyPoint[] = [
  { time: "13:00", p50: 42, p95: 95, p99: 140 },
  { time: "13:05", p50: 45, p95: 98, p99: 145 },
  { time: "13:10", p50: 820, p95: 2100, p99: 4500 },
  { time: "13:15", p50: 750, p95: 1900, p99: 4100 },
  { time: "13:20", p50: 610, p95: 1600, p99: 3200 },
  { time: "13:25", p50: 480, p95: 1200, p99: 2800 },
  { time: "13:30", p50: 200, p95: 450, p99: 900 },
  { time: "13:35", p50: 95,  p95: 210, p99: 380 },
  { time: "13:40", p50: 65,  p95: 150, p99: 240 },
  { time: "13:45", p50: 55,  p95: 120, p99: 190 },
  { time: "13:50", p50: 50,  p95: 110, p99: 170 },
  { time: "13:55", p50: 48,  p95: 105, p99: 165 },
];
const maxLatency = Math.max(...latencyHistory.map(p => p.p99));

export default function EndpointMonitor() {
  const [tab, setTab]                     = useState<"overview" | "incidents" | "alerts">("overview");
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [statusFilter, setStatusFilter]   = useState<EndpointStatus | "all">("all");

  const filteredEndpoints = statusFilter === "all"
    ? endpoints
    : endpoints.filter(e => e.status === statusFilter);

  const downCount     = endpoints.filter(e => e.status === "down").length;
  const degradedCount = endpoints.filter(e => e.status === "degraded").length;
  const healthyCount  = endpoints.filter(e => e.status === "healthy").length;

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "overview",  label: "Endpoints" },
    { id: "incidents", label: `Incidents${incidents.some(i => !i.endTime) ? " 🔴" : ""}` },
    { id: "alerts",    label: "Alert Rules" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Endpoint Monitor</h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">Uptime, latency, and incident tracking for API endpoints</p>
          </div>
          <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors">
            + Add Endpoint
          </button>
        </div>

        {/* Status bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <div><p className="text-xs text-[var(--color-text-muted)]">Healthy</p><p className="text-2xl font-bold text-emerald-400">{healthyCount}</p></div>
          </div>
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div><p className="text-xs text-[var(--color-text-muted)]">Degraded</p><p className="text-2xl font-bold text-amber-400">{degradedCount}</p></div>
          </div>
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-rose-400 animate-pulse" />
            <div><p className="text-xs text-[var(--color-text-muted)]">Down</p><p className="text-2xl font-bold text-rose-400">{downCount}</p></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--color-border)]">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedEndpoint(null); }}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                tab === t.id
                  ? "border-indigo-500 text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Endpoints */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Status filter */}
            <div className="flex gap-2">
              {(["all", "healthy", "degraded", "down", "unknown"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setStatusFilter(f === "all" ? "all" : f); setSelectedEndpoint(null); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    statusFilter === f ? "bg-indigo-600 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {selectedEndpoint ? (
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5 space-y-5">
                <button onClick={() => setSelectedEndpoint(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm">← Back</button>
                <div className="flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-full", statusDot[selectedEndpoint.status])} />
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedEndpoint.name}</h2>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge[selectedEndpoint.status])}>{selectedEndpoint.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded font-medium", methodColor[selectedEndpoint.method])}>{selectedEndpoint.method}</span>
                  <code className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-2)]/80 px-2 py-1 rounded">{selectedEndpoint.url}</code>
                </div>

                {/* Latency stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Latency (p50)", value: `${selectedEndpoint.latencyMs}ms`, color: "text-[var(--color-text-primary)]" },
                    { label: "Latency (p95)", value: `${selectedEndpoint.p95Ms}ms`,   color: selectedEndpoint.p95Ms > 1000 ? "text-amber-400" : "text-[var(--color-text-primary)]" },
                    { label: "Latency (p99)", value: `${selectedEndpoint.p99Ms}ms`,   color: selectedEndpoint.p99Ms > 2000 ? "text-rose-400" : "text-[var(--color-text-primary)]" },
                    { label: "Success Rate",  value: `${selectedEndpoint.successRate}%`, color: selectedEndpoint.successRate < 99 ? "text-rose-400" : "text-emerald-400" },
                    { label: "Uptime (30d)",  value: `${selectedEndpoint.uptime30d}%`, color: "text-emerald-400" },
                    { label: "Response Code", value: selectedEndpoint.responseCode || "N/A", color: selectedEndpoint.responseCode >= 500 ? "text-rose-400" : "text-[var(--color-text-primary)]" },
                    { label: "Last Checked",  value: selectedEndpoint.lastChecked,   color: "text-[var(--color-text-secondary)]" },
                    { label: "Region",        value: selectedEndpoint.region,        color: "text-[var(--color-text-secondary)]" },
                  ].map(m => (
                    <div key={m.label} className="bg-[var(--color-surface-2)]/60 rounded-lg p-3">
                      <p className="text-xs text-[var(--color-text-muted)]">{m.label}</p>
                      <p className={cn("text-sm font-semibold mt-0.5", m.color)}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Latency chart (sparkline) */}
                <div className="bg-[var(--color-surface-2)]/40 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Latency Over Time</h3>
                  <div className="flex items-end gap-1 h-20">
                    {latencyHistory.map((pt, i) => (
                      <div key={i} className="flex-1 flex flex-col items-stretch gap-0">
                        {/* p99 bar */}
                        <div
                          className="bg-rose-500/40 rounded-t-sm"
                          style={{ height: `${(pt.p99 / maxLatency) * 70}px` }}
                          title={`p99: ${pt.p99}ms`}
                        />
                        {/* p50 bar overlay */}
                        <div
                          className="bg-indigo-500 -mt-px"
                          style={{ height: `${(pt.p50 / maxLatency) * 70}px`, marginTop: `${-((pt.p50 / maxLatency) * 70)}px` }}
                          title={`p50: ${pt.p50}ms`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                    <span>{latencyHistory[0].time}</span>
                    <span>{latencyHistory[latencyHistory.length - 1].time}</span>
                  </div>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /><span className="text-xs text-[var(--color-text-secondary)]">p50</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500/40" /><span className="text-xs text-[var(--color-text-secondary)]">p99</span></div>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex gap-2 flex-wrap">
                  {selectedEndpoint.tags.map(tag => (
                    <span key={tag} className="text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEndpoints.map(ep => (
                  <button
                    key={ep.id}
                    onClick={() => setSelectedEndpoint(ep)}
                    className="w-full text-left bg-[var(--color-surface-1)] border border-[var(--color-border)] hover:border-[var(--color-surface-3)] rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", statusDot[ep.status])} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", methodColor[ep.method])}>{ep.method}</span>
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{ep.name}</span>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge[ep.status])}>{ep.status}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] truncate">{ep.url}</p>
                      </div>
                      <div className="flex items-center gap-6 flex-shrink-0 text-xs">
                        <div className="text-right">
                          <p className="text-[var(--color-text-muted)]">p50</p>
                          <p className={cn("font-medium", ep.latencyMs > 500 ? "text-rose-400" : ep.latencyMs > 200 ? "text-amber-400" : "text-[var(--color-text-primary)]")}>{ep.status === "down" ? "—" : `${ep.latencyMs}ms`}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[var(--color-text-muted)]">Uptime</p>
                          <p className={cn("font-medium", ep.uptime30d < 99 ? "text-amber-400" : "text-emerald-400")}>{ep.uptime30d}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[var(--color-text-muted)]">Checked</p>
                          <p className="text-[var(--color-text-secondary)]">{ep.lastChecked}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Incidents */}
        {tab === "incidents" && (
          <div className="space-y-3">
            {incidents.map(inc => (
              <div key={inc.id} className={cn(
                "bg-[var(--color-surface-1)] border rounded-xl p-4",
                !inc.endTime ? "border-rose-500/30" : "border-[var(--color-border)]"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {!inc.endTime && <div className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse" />}
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      !inc.endTime ? "bg-rose-500/20 text-rose-400" : "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)]"
                    )}>
                      {!inc.endTime ? "ONGOING" : "RESOLVED"}
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">{inc.endpointName}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">Duration: {inc.duration}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-[var(--color-surface-2)]/50 rounded p-2">
                    <p className="text-xs text-[var(--color-text-muted)]">Impact</p>
                    <p className="text-xs text-[var(--color-text-primary)] mt-0.5">{inc.impact}</p>
                  </div>
                  <div className="bg-[var(--color-surface-2)]/50 rounded p-2">
                    <p className="text-xs text-[var(--color-text-muted)]">Root Cause</p>
                    <p className="text-xs text-[var(--color-text-primary)] mt-0.5">{inc.rootCause}</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">Started: {inc.startTime}{inc.endTime ? ` · Resolved: ${inc.endTime}` : ""}</p>
              </div>
            ))}
          </div>
        )}

        {/* Alert Rules */}
        {tab === "alerts" && (
          <div className="space-y-3">
            {alertRules.map(rule => (
              <div key={rule.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-4">
                <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", rule.enabled ? "bg-emerald-400" : "bg-[var(--color-surface-3)]")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">{rule.name}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", alertSeverityColor[rule.severity])}>{rule.severity}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)]">{rule.condition}</p>
                  {rule.lastFired && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Last fired: {rule.lastFired}</p>}
                </div>
                <button className={cn(
                  "text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0 transition-colors",
                  rule.enabled ? "bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)]"
                )}>
                  {rule.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
