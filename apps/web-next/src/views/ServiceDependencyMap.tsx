import React, { useState } from "react";
import { cn } from "../lib/utils";

type ServiceStatus = "healthy" | "degraded" | "down" | "unknown";
type DepType = "sync" | "async" | "cache" | "db";

interface Service {
  id: string;
  name: string;
  team: string;
  status: ServiceStatus;
  version: string;
  language: string;
  uptime: string;
  p99: string;
  errorRate: string;
  requestsPerMin: number;
  dependencies: string[];
  dependents: string[];
  port: number;
  host: string;
  lastDeploy: string;
  alerts: number;
}

interface Dependency {
  from: string;
  to: string;
  type: DepType;
  latency: string;
  errorRate: string;
  callsPerMin: number;
  healthy: boolean;
  protocol: string;
}

interface TraceEvent {
  id: string;
  traceId: string;
  service: string;
  operation: string;
  duration: string;
  status: "ok" | "error";
  timestamp: string;
  downstream: string[];
}

interface ImpactAnalysis {
  serviceId: string;
  upstreamCount: number;
  downstreamCount: number;
  criticalPath: boolean;
  estimatedImpact: string;
}

const SERVICES: Service[] = [
  { id: "api-gw", name: "api-gateway", team: "platform", status: "degraded", version: "v3.2.1", language: "Go", uptime: "99.7%", p99: "312ms", errorRate: "2.1%", requestsPerMin: 8420, dependencies: ["user-svc", "auth-svc", "rate-limiter"], dependents: [], port: 8080, host: "api-gw.internal", lastDeploy: "2h ago", alerts: 2 },
  { id: "user-svc", name: "user-service", team: "identity", status: "healthy", version: "v2.8.4", language: "TypeScript", uptime: "99.99%", p99: "45ms", errorRate: "0.02%", requestsPerMin: 6240, dependencies: ["postgres-users", "redis-cache", "notification-svc"], dependents: ["api-gw", "billing-svc"], port: 3001, host: "user-svc.internal", lastDeploy: "1d ago", alerts: 0 },
  { id: "auth-svc", name: "auth-service", team: "identity", status: "healthy", version: "v1.9.2", language: "Go", uptime: "99.99%", p99: "28ms", errorRate: "0.01%", requestsPerMin: 8100, dependencies: ["redis-sessions", "postgres-users"], dependents: ["api-gw", "admin-svc"], port: 3002, host: "auth-svc.internal", lastDeploy: "3d ago", alerts: 0 },
  { id: "billing-svc", name: "billing-service", team: "payments", status: "healthy", version: "v4.1.0", language: "Python", uptime: "99.95%", p99: "180ms", errorRate: "0.08%", requestsPerMin: 340, dependencies: ["stripe-api", "postgres-billing", "user-svc"], dependents: ["api-gw"], port: 3003, host: "billing-svc.internal", lastDeploy: "5d ago", alerts: 0 },
  { id: "notification-svc", name: "notification-service", team: "platform", status: "healthy", version: "v2.3.1", language: "TypeScript", uptime: "99.8%", p99: "95ms", errorRate: "0.15%", requestsPerMin: 1890, dependencies: ["sendgrid", "twilio", "message-queue"], dependents: ["user-svc", "billing-svc"], port: 3004, host: "notif-svc.internal", lastDeploy: "2d ago", alerts: 0 },
  { id: "rate-limiter", name: "rate-limiter", team: "platform", status: "healthy", version: "v1.2.0", language: "Go", uptime: "99.99%", p99: "3ms", errorRate: "0%", requestsPerMin: 8420, dependencies: ["redis-rate"], dependents: ["api-gw"], port: 3005, host: "rate-limiter.internal", lastDeploy: "1w ago", alerts: 0 },
  { id: "admin-svc", name: "admin-service", team: "platform", status: "down", version: "v1.1.0", language: "TypeScript", uptime: "0%", p99: "-", errorRate: "100%", requestsPerMin: 0, dependencies: ["auth-svc", "postgres-admin"], dependents: [], port: 3006, host: "admin-svc.internal", lastDeploy: "4h ago", alerts: 5 },
  { id: "postgres-users", name: "postgres-users", team: "data", status: "healthy", version: "15.4", language: "SQL", uptime: "99.999%", p99: "12ms", errorRate: "0%", requestsPerMin: 14500, dependencies: [], dependents: ["user-svc", "auth-svc"], port: 5432, host: "pg-users.internal", lastDeploy: "30d ago", alerts: 0 },
  { id: "redis-cache", name: "redis-cache", team: "data", status: "healthy", version: "7.2", language: "Redis", uptime: "99.99%", p99: "2ms", errorRate: "0%", requestsPerMin: 42000, dependencies: [], dependents: ["user-svc", "rate-limiter"], port: 6379, host: "redis.internal", lastDeploy: "14d ago", alerts: 0 },
  { id: "message-queue", name: "rabbitmq", team: "data", status: "healthy", version: "3.12", language: "Erlang", uptime: "99.97%", p99: "8ms", errorRate: "0.02%", requestsPerMin: 3200, dependencies: [], dependents: ["notification-svc"], port: 5672, host: "mq.internal", lastDeploy: "21d ago", alerts: 0 },
];

const DEPENDENCIES: Dependency[] = [
  { from: "api-gw", to: "user-svc", type: "sync", latency: "45ms", errorRate: "0.02%", callsPerMin: 5200, healthy: true, protocol: "gRPC" },
  { from: "api-gw", to: "auth-svc", type: "sync", latency: "28ms", errorRate: "0.01%", callsPerMin: 8100, healthy: true, protocol: "gRPC" },
  { from: "api-gw", to: "rate-limiter", type: "sync", latency: "3ms", errorRate: "0%", callsPerMin: 8420, healthy: true, protocol: "HTTP" },
  { from: "user-svc", to: "postgres-users", type: "db", latency: "12ms", errorRate: "0%", callsPerMin: 9800, healthy: true, protocol: "PSQL" },
  { from: "user-svc", to: "redis-cache", type: "cache", latency: "2ms", errorRate: "0%", callsPerMin: 28000, healthy: true, protocol: "Redis" },
  { from: "user-svc", to: "notification-svc", type: "async", latency: "95ms", errorRate: "0.15%", callsPerMin: 840, healthy: true, protocol: "AMQP" },
  { from: "auth-svc", to: "postgres-users", type: "db", latency: "12ms", errorRate: "0%", callsPerMin: 4700, healthy: true, protocol: "PSQL" },
  { from: "notification-svc", to: "message-queue", type: "async", latency: "8ms", errorRate: "0.02%", callsPerMin: 3200, healthy: true, protocol: "AMQP" },
  { from: "billing-svc", to: "user-svc", type: "sync", latency: "47ms", errorRate: "0.02%", callsPerMin: 340, healthy: true, protocol: "gRPC" },
  { from: "admin-svc", to: "auth-svc", type: "sync", latency: "-", errorRate: "100%", callsPerMin: 0, healthy: false, protocol: "gRPC" },
];

const TRACES: TraceEvent[] = [
  { id: "t1", traceId: "a3f92c", service: "api-gw", operation: "POST /api/users/profile", duration: "312ms", status: "error", timestamp: "10:42:31.120", downstream: ["user-svc", "auth-svc"] },
  { id: "t2", traceId: "b7e41d", service: "api-gw", operation: "GET /api/billing/invoice", duration: "189ms", status: "ok", timestamp: "10:42:29.850", downstream: ["billing-svc", "user-svc"] },
  { id: "t3", traceId: "c9a03e", service: "api-gw", operation: "POST /api/auth/login", duration: "31ms", status: "ok", timestamp: "10:42:28.410", downstream: ["auth-svc"] },
  { id: "t4", traceId: "d2f57b", service: "api-gw", operation: "PUT /api/users/settings", duration: "498ms", status: "error", timestamp: "10:42:27.003", downstream: ["user-svc", "notification-svc"] },
  { id: "t5", traceId: "e8c12a", service: "billing-svc", operation: "POST /charges", duration: "204ms", status: "ok", timestamp: "10:42:25.775", downstream: ["postgres-billing", "user-svc"] },
];

const IMPACT: ImpactAnalysis[] = [
  { serviceId: "api-gw", upstreamCount: 0, downstreamCount: 3, criticalPath: true, estimatedImpact: "All external traffic blocked" },
  { serviceId: "user-svc", upstreamCount: 2, downstreamCount: 3, criticalPath: true, estimatedImpact: "Login, profiles, billing affected" },
  { serviceId: "auth-svc", upstreamCount: 2, downstreamCount: 2, criticalPath: true, estimatedImpact: "Auth fails → all API calls fail" },
  { serviceId: "postgres-users", upstreamCount: 0, downstreamCount: 2, criticalPath: true, estimatedImpact: "All user data unavailable" },
  { serviceId: "redis-cache", upstreamCount: 0, downstreamCount: 2, criticalPath: false, estimatedImpact: "Cache miss fallback active" },
  { serviceId: "admin-svc", upstreamCount: 1, downstreamCount: 0, criticalPath: false, estimatedImpact: "Admin panel only — no user impact" },
];

const statusColor: Record<ServiceStatus, string> = {
  healthy:  "text-emerald-400",
  degraded: "text-amber-400",
  down:     "text-rose-400",
  unknown:  "text-[var(--color-text-secondary)]",
};

const statusDot: Record<ServiceStatus, string> = {
  healthy:  "bg-emerald-400",
  degraded: "bg-amber-400 animate-pulse",
  down:     "bg-rose-400 animate-pulse",
  unknown:  "bg-[var(--color-surface-3)]",
};

const depTypeBadge: Record<DepType, string> = {
  sync:  "bg-primary/15 text-primary",
  async: "bg-purple-500/15 text-purple-400",
  cache: "bg-amber-500/15 text-amber-400",
  db:    "bg-sky-500/15 text-sky-400",
};

const langColor: Record<string, string> = {
  Go: "text-sky-400",
  TypeScript: "text-blue-400",
  Python: "text-yellow-400",
  SQL: "text-primary",
  Redis: "text-red-400",
  Erlang: "text-purple-400",
};

export default function ServiceDependencyMap() {
  const [tab, setTab] = useState<"services" | "deps" | "traces" | "impact">("services");
  const [selected, setSelected] = useState<Service | null>(SERVICES[0]);
  const [statusFilter, setStatusFilter] = useState<"all" | ServiceStatus>("all");

  const filtered = SERVICES.filter(s => statusFilter === "all" || s.status === statusFilter);

  const healthy = SERVICES.filter(s => s.status === "healthy").length;
  const degraded = SERVICES.filter(s => s.status === "degraded").length;
  const down = SERVICES.filter(s => s.status === "down").length;

  const selectedDeps = selected
    ? DEPENDENCIES.filter(d => d.from === selected.id || d.to === selected.id)
    : [];

  const getService = (id: string) => SERVICES.find(s => s.id === id);

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Service Dependency Map</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{SERVICES.length} services · {DEPENDENCIES.length} dependencies</p>
          </div>
          <button className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-xs font-medium text-[var(--color-text-primary)] transition-colors">Export Graph</button>
        </div>
        {/* Health summary */}
        <div className="flex gap-4 mt-3">
          {[
            { label: "Healthy", value: healthy, color: "text-emerald-400", dot: "bg-emerald-400" },
            { label: "Degraded", value: degraded, color: "text-amber-400", dot: "bg-amber-400" },
            { label: "Down", value: down, color: "text-rose-400", dot: "bg-rose-400" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full flex-none", s.dot)} />
              <span className={cn("text-base font-bold", s.color)}>{s.value}</span>
              <span className="text-[var(--color-text-muted)] text-xs">{s.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 ml-2">
            <span className="text-base font-bold text-rose-400">{SERVICES.reduce((s, svc) => s + svc.alerts, 0)}</span>
            <span className="text-[var(--color-text-muted)] text-xs">Active Alerts</span>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(["services", "deps", "traces", "impact"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]")}>
              {t === "deps" ? "Dependencies" : t === "impact" ? "Impact Analysis" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Services Tab */}
        {tab === "services" && (
          <div className="flex h-full">
            {/* Left list */}
            <div className="w-[46%] flex-none border-r border-[var(--color-border)] flex flex-col">
              <div className="flex-none px-4 py-2.5 border-b border-[var(--color-border)] flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">Status:</span>
                {(["all", "healthy", "degraded", "down"] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn("px-2 py-0.5 rounded text-xs capitalize transition-colors",
                      statusFilter === s ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.map(svc => (
                  <button key={svc.id} onClick={() => setSelected(svc)} className={cn(
                    "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-1)] transition-colors",
                    selected?.id === svc.id && "bg-[var(--color-surface-1)] border-l-2 border-l-indigo-500"
                  )}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("w-1.5 h-1.5 rounded-full flex-none", statusDot[svc.status])} />
                        <span className="text-sm font-medium text-[var(--color-text-primary)] font-mono truncate">{svc.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        {svc.alerts > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500 text-[9px] font-bold text-[var(--color-text-primary)]">{svc.alerts}</span>
                        )}
                        <span className={cn("text-[10px] font-medium", statusColor[svc.status])}>{svc.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 pl-3.5 text-[10px] text-[var(--color-text-muted)]">
                      <span className={langColor[svc.language] || "text-[var(--color-text-secondary)]"}>{svc.language}</span>
                      <span>{svc.version}</span>
                      <span>{svc.requestsPerMin.toLocaleString()} rpm</span>
                      <span>p99: {svc.p99}</span>
                      {svc.errorRate !== "0%" && svc.errorRate !== "0.01%" && svc.errorRate !== "0.02%" && (
                        <span className="text-amber-400">{svc.errorRate} err</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {/* Right: service detail */}
            <div className="flex-1 overflow-y-auto p-5">
              {selected && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", statusDot[selected.status])} />
                        <h2 className="font-mono text-base font-semibold text-[var(--color-text-primary)]">{selected.name}</h2>
                        <span className={cn("text-xs font-medium", statusColor[selected.status])}>{selected.status}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 pl-4 text-xs text-[var(--color-text-muted)]">
                        <span>Team: <span className="text-[var(--color-text-primary)]">{selected.team}</span></span>
                        <span>{selected.version}</span>
                        <span className={langColor[selected.language] || "text-[var(--color-text-secondary)]"}>{selected.language}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--color-text-muted)]">
                      <div>:{selected.port}</div>
                      <div className="font-mono text-[var(--color-text-secondary)]">{selected.host}</div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Uptime", value: selected.uptime, color: selected.uptime === "0%" ? "text-rose-400" : "text-emerald-400" },
                      { label: "P99 Latency", value: selected.p99, color: "text-[var(--color-text-primary)]" },
                      { label: "Error Rate", value: selected.errorRate, color: parseFloat(selected.errorRate) > 1 ? "text-rose-400" : parseFloat(selected.errorRate) > 0 ? "text-amber-400" : "text-emerald-400" },
                      { label: "Req/min", value: selected.requestsPerMin.toLocaleString(), color: "text-[var(--color-text-primary)]" },
                    ].map(m => (
                      <div key={m.label} className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)]">
                        <div className="text-xs text-[var(--color-text-muted)]">{m.label}</div>
                        <div className={cn("text-lg font-bold mt-0.5", m.color)}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Dependencies section */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                    <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">Upstream Dependencies ({selected.dependencies.length})</div>
                    {selected.dependencies.length === 0 ? (
                      <div className="text-xs text-[var(--color-text-muted)]">No upstream dependencies — leaf service</div>
                    ) : (
                      <div className="space-y-1.5">
                        {selected.dependencies.map(dep => {
                          const svc = getService(dep);
                          const edge = DEPENDENCIES.find(d => d.from === selected.id && d.to === dep);
                          return (
                            <div key={dep} className="flex items-center justify-between bg-[var(--color-surface-0)] rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className={cn("w-1.5 h-1.5 rounded-full", svc ? statusDot[svc.status] : "bg-[var(--color-surface-3)]")} />
                                <span className="font-mono text-xs text-[var(--color-text-primary)]">{dep}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px]">
                                {edge && (
                                  <>
                                    <span className={cn("px-1.5 py-0.5 rounded", depTypeBadge[edge.type])}>{edge.type}</span>
                                    <span className="text-[var(--color-text-muted)]">{edge.latency}</span>
                                    <span className="text-[var(--color-text-muted)]">{edge.protocol}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Dependents */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                    <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">Downstream Dependents ({selected.dependents.length})</div>
                    {selected.dependents.length === 0 ? (
                      <div className="text-xs text-[var(--color-text-muted)]">No dependents — external-facing service</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selected.dependents.map(dep => {
                          const svc = getService(dep);
                          return (
                            <button key={dep} onClick={() => svc && setSelected(svc)}
                              className="flex items-center gap-1.5 bg-[var(--color-surface-0)] rounded-lg px-3 py-1.5 hover:bg-[var(--color-surface-2)] transition-colors">
                              <div className={cn("w-1.5 h-1.5 rounded-full", svc ? statusDot[svc.status] : "bg-[var(--color-surface-3)]")} />
                              <span className="font-mono text-xs text-[var(--color-text-primary)]">{dep}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-[var(--color-text-muted)]">Last deployed: {selected.lastDeploy}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dependencies Tab */}
        {tab === "deps" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-2">
              {DEPENDENCIES.map((dep, i) => {
                const fromSvc = getService(dep.from);
                const toSvc = getService(dep.to);
                return (
                  <div key={i} className={cn("bg-[var(--color-surface-1)] rounded-xl p-4 border transition-colors",
                    dep.healthy ? "border-[var(--color-border)] hover:border-[var(--color-border)]" : "border-rose-500/40 bg-rose-500/5"
                  )}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <div className="flex items-center gap-1">
                            <div className={cn("w-1.5 h-1.5 rounded-full", fromSvc ? statusDot[fromSvc.status] : "bg-[var(--color-surface-3)]")} />
                            <span className="font-mono text-xs text-[var(--color-text-primary)]">{dep.from}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className={cn("text-sm", dep.healthy ? "text-[var(--color-text-secondary)]" : "text-rose-400")}>→</div>
                          <span className={cn("px-1.5 py-0.5 rounded text-[10px] mt-0.5", depTypeBadge[dep.type])}>{dep.type}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={cn("w-1.5 h-1.5 rounded-full", toSvc ? statusDot[toSvc.status] : "bg-[var(--color-surface-3)]")} />
                          <span className="font-mono text-xs text-[var(--color-text-primary)]">{dep.to}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-right">
                          <div className="text-[var(--color-text-secondary)]">{dep.latency}</div>
                          <div className="text-[var(--color-text-muted)] text-[10px]">p99 lat</div>
                        </div>
                        <div className="text-right">
                          <div className={dep.errorRate === "0%" ? "text-emerald-400" : "text-amber-400"}>{dep.errorRate}</div>
                          <div className="text-[var(--color-text-muted)] text-[10px]">err rate</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[var(--color-text-primary)]">{dep.callsPerMin.toLocaleString()}</div>
                          <div className="text-[var(--color-text-muted)] text-[10px]">calls/min</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[var(--color-text-secondary)]">{dep.protocol}</div>
                          <div className="text-[var(--color-text-muted)] text-[10px]">protocol</div>
                        </div>
                        {!dep.healthy && <span className="px-2 py-1 rounded bg-rose-500/15 border border-rose-500/30 text-xs text-rose-400">UNHEALTHY</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Traces Tab */}
        {tab === "traces" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-2">
              {TRACES.map(trace => (
                <div key={trace.id} className={cn("bg-[var(--color-surface-1)] rounded-xl p-4 border",
                  trace.status === "error" ? "border-rose-500/30" : "border-[var(--color-border)]"
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium",
                          trace.status === "error" ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"
                        )}>{trace.status.toUpperCase()}</span>
                        <span className="font-mono text-xs text-[var(--color-text-secondary)]">{trace.traceId}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">{trace.timestamp}</span>
                      </div>
                      <div className="mt-1.5">
                        <span className="font-mono text-sm text-[var(--color-text-primary)]">{trace.operation}</span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                        Origin: <span className="text-[var(--color-text-primary)]">{trace.service}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("text-sm font-semibold", trace.status === "error" ? "text-rose-400" : "text-[var(--color-text-primary)]")}>{trace.duration}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">total duration</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-text-muted)]">Downstream:</span>
                    {trace.downstream.map(svc => {
                      const s = getService(svc);
                      return (
                        <span key={svc} className="flex items-center gap-1 bg-[var(--color-surface-2)] rounded px-2 py-0.5">
                          <div className={cn("w-1 h-1 rounded-full", s ? statusDot[s.status] : "bg-[var(--color-surface-3)]")} />
                          <span className="font-mono text-[10px] text-[var(--color-text-primary)]">{svc}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Impact Analysis Tab */}
        {tab === "impact" && (
          <div className="overflow-y-auto h-full p-5">
            <p className="text-xs text-[var(--color-text-muted)] mb-4">Services ranked by blast radius — what breaks if each service goes down.</p>
            <div className="space-y-3">
              {IMPACT.map(imp => {
                const svc = getService(imp.serviceId);
                return (
                  <div key={imp.serviceId} className={cn("bg-[var(--color-surface-1)] rounded-xl p-4 border",
                    imp.criticalPath ? "border-rose-500/30" : "border-[var(--color-border)]"
                  )}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full flex-none", svc ? statusDot[svc.status] : "bg-[var(--color-surface-3)]")} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{imp.serviceId}</span>
                            {imp.criticalPath && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-[10px] text-rose-400">Critical Path</span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{imp.estimatedImpact}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-right flex-none">
                        <div>
                          <div className="text-[var(--color-text-primary)] font-semibold">{imp.upstreamCount}</div>
                          <div className="text-[var(--color-text-muted)] text-[10px]">upstream</div>
                        </div>
                        <div>
                          <div className="text-[var(--color-text-primary)] font-semibold">{imp.downstreamCount}</div>
                          <div className="text-[var(--color-text-muted)] text-[10px]">downstream</div>
                        </div>
                        <div>
                          <div className="text-[var(--color-text-primary)] font-semibold">{imp.upstreamCount + imp.downstreamCount}</div>
                          <div className="text-[var(--color-text-muted)] text-[10px]">total</div>
                        </div>
                      </div>
                    </div>
                    {/* Blast radius bar */}
                    <div className="mt-3 w-full bg-[var(--color-surface-2)] rounded-full h-1">
                      <div
                        className={cn("h-1 rounded-full", imp.criticalPath ? "bg-rose-500" : "bg-primary")}
                        style={{ width: `${Math.min(100, ((imp.upstreamCount + imp.downstreamCount) / 10) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
