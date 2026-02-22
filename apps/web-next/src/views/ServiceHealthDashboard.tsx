import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ServiceStatus = "healthy" | "degraded" | "down" | "unknown";
type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";
type IncidentSeverity = "critical" | "major" | "minor";
type SLOWindow = "30d" | "7d" | "1d";
type TabKey = "services" | "incidents" | "slos" | "status";
type IncidentFilter = "all" | "active" | "resolved";

interface Service {
  id: string;
  name: string;
  status: ServiceStatus;
  uptime: number;
  errorRate: number;
  p99Latency: number;
  dependencies: string[];
  history: ServiceStatus[];
  incidents: string[];
}

interface IncidentUpdate {
  timestamp: string;
  status: IncidentStatus;
  message: string;
}

interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedServices: string[];
  startedAt: string;
  resolvedAt: string | null;
  mttr: number | null;
  updates: IncidentUpdate[];
}

interface SLO {
  id: string;
  name: string;
  service: string;
  target: number;
  current: number;
  errorBudgetDays: number;
  window: SLOWindow;
  burnRate: number;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SERVICES: Service[] = [
  {
    id: "api-gateway",
    name: "API Gateway",
    status: "healthy",
    uptime: 99.97,
    errorRate: 0.03,
    p99Latency: 45,
    dependencies: [],
    history: ["healthy", "healthy", "healthy", "healthy", "healthy", "degraded", "healthy"],
    incidents: ["INC-001"],
  },
  {
    id: "auth-service",
    name: "Auth Service",
    status: "healthy",
    uptime: 99.99,
    errorRate: 0.01,
    p99Latency: 32,
    dependencies: ["api-gateway"],
    history: ["healthy", "healthy", "healthy", "healthy", "healthy", "healthy", "healthy"],
    incidents: [],
  },
  {
    id: "user-service",
    name: "User Service",
    status: "degraded",
    uptime: 99.71,
    errorRate: 0.42,
    p99Latency: 210,
    dependencies: ["auth-service", "postgres-primary"],
    history: ["healthy", "healthy", "degraded", "degraded", "healthy", "healthy", "degraded"],
    incidents: ["INC-002"],
  },
  {
    id: "payment-service",
    name: "Payment Service",
    status: "healthy",
    uptime: 99.95,
    errorRate: 0.05,
    p99Latency: 180,
    dependencies: ["api-gateway"],
    history: ["healthy", "healthy", "healthy", "healthy", "healthy", "healthy", "healthy"],
    incidents: [],
  },
  {
    id: "notification-svc",
    name: "Notification Service",
    status: "down",
    uptime: 98.20,
    errorRate: 8.30,
    p99Latency: 0,
    dependencies: ["message-queue"],
    history: ["healthy", "healthy", "degraded", "down", "down", "down", "down"],
    incidents: ["INC-003"],
  },
  {
    id: "analytics-service",
    name: "Analytics Service",
    status: "healthy",
    uptime: 99.82,
    errorRate: 0.18,
    p99Latency: 320,
    dependencies: ["clickhouse", "kafka"],
    history: ["healthy", "healthy", "healthy", "healthy", "healthy", "healthy", "healthy"],
    incidents: [],
  },
  {
    id: "search-service",
    name: "Search Service",
    status: "healthy",
    uptime: 99.91,
    errorRate: 0.09,
    p99Latency: 78,
    dependencies: ["elasticsearch"],
    history: ["healthy", "healthy", "healthy", "healthy", "healthy", "healthy", "healthy"],
    incidents: [],
  },
  {
    id: "postgres-primary",
    name: "Postgres Primary",
    status: "healthy",
    uptime: 100.00,
    errorRate: 0.00,
    p99Latency: 12,
    dependencies: [],
    history: ["healthy", "healthy", "healthy", "healthy", "healthy", "healthy", "healthy"],
    incidents: [],
  },
  {
    id: "redis-cache",
    name: "Redis Cache",
    status: "healthy",
    uptime: 99.98,
    errorRate: 0.02,
    p99Latency: 3,
    dependencies: [],
    history: ["healthy", "healthy", "healthy", "healthy", "healthy", "healthy", "healthy"],
    incidents: ["INC-004"],
  },
  {
    id: "message-queue",
    name: "Message Queue",
    status: "degraded",
    uptime: 99.40,
    errorRate: 1.20,
    p99Latency: 450,
    dependencies: [],
    history: ["healthy", "healthy", "healthy", "degraded", "degraded", "degraded", "degraded"],
    incidents: ["INC-003"],
  },
  {
    id: "cdn-edge",
    name: "CDN / Edge",
    status: "healthy",
    uptime: 99.99,
    errorRate: 0.01,
    p99Latency: 8,
    dependencies: [],
    history: ["healthy", "healthy", "healthy", "healthy", "healthy", "healthy", "healthy"],
    incidents: [],
  },
  {
    id: "file-storage",
    name: "File Storage",
    status: "unknown",
    uptime: 99.50,
    errorRate: 0.50,
    p99Latency: 0,
    dependencies: [],
    history: ["healthy", "healthy", "healthy", "healthy", "healthy", "unknown", "unknown"],
    incidents: [],
  },
];

const INCIDENTS: Incident[] = [
  {
    id: "INC-001",
    title: "API Gateway elevated 5xx rate",
    severity: "minor",
    status: "resolved",
    affectedServices: ["API Gateway"],
    startedAt: "2026-02-20T14:23:00Z",
    resolvedAt: "2026-02-20T15:47:00Z",
    mttr: 84,
    updates: [
      { timestamp: "2026-02-20T14:23:00Z", status: "investigating", message: "Elevated 5xx error rate detected on API Gateway. On-call paged." },
      { timestamp: "2026-02-20T14:45:00Z", status: "identified", message: "Root cause identified: misconfigured rate-limiting rule pushed via config deploy." },
      { timestamp: "2026-02-20T15:10:00Z", status: "monitoring", message: "Rate-limiting config reverted. Error rate returning to baseline. Monitoring." },
      { timestamp: "2026-02-20T15:47:00Z", status: "resolved", message: "Error rate back to normal. Incident resolved. Post-mortem scheduled for Feb 21." },
    ],
  },
  {
    id: "INC-002",
    title: "User Service high latency & error spike",
    severity: "major",
    status: "monitoring",
    affectedServices: ["User Service", "API Gateway"],
    startedAt: "2026-02-22T03:15:00Z",
    resolvedAt: null,
    mttr: null,
    updates: [
      { timestamp: "2026-02-22T03:15:00Z", status: "investigating", message: "User Service p99 spiked to 1200ms. Error rate at 4.2%. Investigation in progress." },
      { timestamp: "2026-02-22T03:48:00Z", status: "identified", message: "Slow query in user profile lookup. Missing index after schema migration." },
      { timestamp: "2026-02-22T04:30:00Z", status: "monitoring", message: "Hotfix index applied. Latency improving. Monitoring for stability." },
    ],
  },
  {
    id: "INC-003",
    title: "Notification Service complete outage",
    severity: "critical",
    status: "investigating",
    affectedServices: ["Notification Service", "Message Queue"],
    startedAt: "2026-02-22T05:00:00Z",
    resolvedAt: null,
    mttr: null,
    updates: [
      { timestamp: "2026-02-22T05:00:00Z", status: "investigating", message: "Notification Service is down. Email and push notifications are failing. All hands investigating." },
      { timestamp: "2026-02-22T05:22:00Z", status: "investigating", message: "Queue consumer crashing on malformed payload. Hotfix underway." },
    ],
  },
  {
    id: "INC-004",
    title: "Redis cache eviction stampede",
    severity: "minor",
    status: "resolved",
    affectedServices: ["Redis Cache", "User Service"],
    startedAt: "2026-02-18T09:10:00Z",
    resolvedAt: "2026-02-18T10:05:00Z",
    mttr: 55,
    updates: [
      { timestamp: "2026-02-18T09:10:00Z", status: "investigating", message: "Cache hit rate dropped significantly. High DB load observed." },
      { timestamp: "2026-02-18T09:40:00Z", status: "identified", message: "Mass cache eviction hit memory limit. Cache stampede triggered." },
      { timestamp: "2026-02-18T10:05:00Z", status: "resolved", message: "Cache TTLs staggered. Memory limit raised. Incident resolved." },
    ],
  },
];

const SLOS: SLO[] = [
  { id: "slo-1", name: "API Gateway Availability", service: "API Gateway", target: 99.9, current: 99.97, errorBudgetDays: 28, window: "30d", burnRate: 0.12 },
  { id: "slo-2", name: "API Gateway p99 < 200ms", service: "API Gateway", target: 95.0, current: 97.3, errorBudgetDays: 22, window: "30d", burnRate: 0.31 },
  { id: "slo-3", name: "Auth Service Availability", service: "Auth Service", target: 99.99, current: 99.99, errorBudgetDays: 30, window: "30d", burnRate: 0.02 },
  { id: "slo-4", name: "User Service Availability", service: "User Service", target: 99.9, current: 99.71, errorBudgetDays: 3, window: "30d", burnRate: 4.20 },
  { id: "slo-5", name: "User Service p99 < 300ms", service: "User Service", target: 95.0, current: 88.2, errorBudgetDays: 0, window: "7d", burnRate: 12.50 },
  { id: "slo-6", name: "Payment Service Availability", service: "Payment Service", target: 99.95, current: 99.95, errorBudgetDays: 30, window: "30d", burnRate: 0.08 },
  { id: "slo-7", name: "Notification Svc Availability", service: "Notification Service", target: 99.5, current: 98.20, errorBudgetDays: 0, window: "30d", burnRate: 18.70 },
  { id: "slo-8", name: "Search Service p99 < 150ms", service: "Search Service", target: 99.0, current: 99.4, errorBudgetDays: 25, window: "30d", burnRate: 0.22 },
  { id: "slo-9", name: "Postgres Primary Availability", service: "Postgres Primary", target: 99.99, current: 100.0, errorBudgetDays: 30, window: "30d", burnRate: 0.00 },
  { id: "slo-10", name: "Redis Cache p99 < 10ms", service: "Redis Cache", target: 99.5, current: 99.8, errorBudgetDays: 29, window: "30d", burnRate: 0.05 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusTextColor(s: ServiceStatus): string {
  if (s === "healthy") return "text-emerald-400";
  if (s === "degraded") return "text-amber-400";
  if (s === "down") return "text-rose-400";
  return "text-zinc-500";
}

function statusDotColor(s: ServiceStatus): string {
  if (s === "healthy") return "bg-emerald-400";
  if (s === "degraded") return "bg-amber-400";
  if (s === "down") return "bg-rose-400";
  return "bg-zinc-500";
}

function statusBadgeClass(s: ServiceStatus): string {
  if (s === "healthy") return "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20";
  if (s === "degraded") return "bg-amber-400/10 text-amber-400 border border-amber-400/20";
  if (s === "down") return "bg-rose-400/10 text-rose-400 border border-rose-400/20";
  return "bg-zinc-800 text-zinc-500 border border-zinc-700";
}

function severityBadgeClass(s: IncidentSeverity): string {
  if (s === "critical") return "bg-rose-400/10 text-rose-400 border border-rose-400/20";
  if (s === "major") return "bg-amber-400/10 text-amber-400 border border-amber-400/20";
  return "bg-indigo-400/10 text-indigo-400 border border-indigo-400/20";
}

function incidentStatusTextColor(s: IncidentStatus): string {
  if (s === "investigating") return "text-rose-400";
  if (s === "identified") return "text-amber-400";
  if (s === "monitoring") return "text-indigo-400";
  return "text-emerald-400";
}

function sloBurnTextColor(burnRate: number, errorBudgetDays: number): string {
  if (errorBudgetDays === 0 || burnRate > 5) return "text-rose-400";
  if (burnRate > 1.5 || errorBudgetDays < 7) return "text-amber-400";
  return "text-emerald-400";
}

function sloBurnBarColor(burnRate: number, errorBudgetDays: number): string {
  if (errorBudgetDays === 0 || burnRate > 5) return "bg-rose-400";
  if (burnRate > 1.5 || errorBudgetDays < 7) return "bg-amber-400";
  return "bg-emerald-400";
}

function sparklineHeight(s: ServiceStatus): string {
  if (s === "healthy") return "100%";
  if (s === "degraded") return "55%";
  if (s === "down") return "25%";
  return "15%";
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

function generateUptimeCalendar(): ServiceStatus[] {
  const days: ServiceStatus[] = [];
  for (let i = 0; i < 90; i++) {
    if (i === 88 || i === 89) {
      days.push("down");
    } else if (i === 85 || i === 72 || i === 55 || i === 40 || i === 28 || i === 14) {
      days.push("degraded");
    } else {
      days.push("healthy");
    }
  }
  return days;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ServiceHealthDashboard() {
  const [tab, setTab] = useState<TabKey>("services");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [incidentFilter, setIncidentFilter] = useState<IncidentFilter>("all");

  const calendarDays = generateUptimeCalendar();
  const activeIncidents = INCIDENTS.filter((i) => i.status !== "resolved");
  const healthyCount = SERVICES.filter((s) => s.status === "healthy").length;
  const degradedCount = SERVICES.filter((s) => s.status === "degraded").length;
  const downCount = SERVICES.filter((s) => s.status === "down").length;
  const unknownCount = SERVICES.filter((s) => s.status === "unknown").length;

  const overallStatus: ServiceStatus =
    downCount > 0 ? "down" : degradedCount > 0 ? "degraded" : unknownCount > 0 ? "unknown" : "healthy";

  const selectedSvc = selectedServiceId
    ? SERVICES.find((s) => s.id === selectedServiceId) ?? null
    : null;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "services", label: "Services" },
    {
      key: "incidents",
      label: activeIncidents.length > 0 ? `Incidents (${activeIncidents.length})` : "Incidents",
    },
    { key: "slos", label: "SLOs" },
    { key: "status", label: "Status Page" },
  ];

  const filteredIncidents = INCIDENTS.filter((i) => {
    if (incidentFilter === "active") return i.status !== "resolved";
    if (incidentFilter === "resolved") return i.status === "resolved";
    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold tracking-tight">Service Health</h1>
          <span className="text-xs text-zinc-500 font-mono">
            http://127.0.0.1:3000 · Last updated: Feb 22, 2026 06:34 MST
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-400">{healthyCount} healthy</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-amber-400">{degradedCount} degraded</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="text-rose-400">{downCount} down</span>
          </span>
          {unknownCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-500" />
              <span className="text-zinc-500">{unknownCount} unknown</span>
            </span>
          )}
          {activeIncidents.length > 0 && (
            <span className="ml-2 text-rose-400 font-semibold animate-pulse">
              ● {activeIncidents.length} active incident{activeIncidents.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-zinc-800 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setSelectedServiceId(null);
            }}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t transition-colors border border-b-0 -mb-px",
              tab === t.key
                ? "bg-zinc-900 border-zinc-800 text-white"
                : "bg-transparent border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/50"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ SERVICES TAB */}
      {tab === "services" && !selectedSvc && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((svc) => (
            <button
              key={svc.id}
              onClick={() => setSelectedServiceId(svc.id)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:border-zinc-600 transition-all hover:shadow-lg hover:shadow-black/20 group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="font-semibold text-sm group-hover:text-white">{svc.name}</span>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full capitalize font-medium",
                    statusBadgeClass(svc.status)
                  )}
                >
                  {svc.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs mb-4">
                <div>
                  <div className="text-zinc-500 mb-0.5">Uptime</div>
                  <div className={cn("font-mono font-semibold", statusTextColor(svc.status))}>
                    {svc.uptime.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-0.5">Error Rate</div>
                  <div
                    className={cn(
                      "font-mono font-semibold",
                      svc.errorRate > 2
                        ? "text-rose-400"
                        : svc.errorRate > 0.3
                        ? "text-amber-400"
                        : "text-zinc-300"
                    )}
                  >
                    {svc.errorRate.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-0.5">p99 Latency</div>
                  <div
                    className={cn(
                      "font-mono font-semibold",
                      svc.p99Latency === 0
                        ? "text-zinc-600"
                        : svc.p99Latency > 350
                        ? "text-amber-400"
                        : "text-zinc-300"
                    )}
                  >
                    {svc.p99Latency === 0 ? "—" : `${svc.p99Latency}ms`}
                  </div>
                </div>
              </div>
              {/* Sparkline */}
              <div>
                <div className="text-xs text-zinc-600 mb-1.5">7-day history</div>
                <div className="flex gap-0.5 items-end h-7">
                  {svc.history.map((h, idx) => (
                    <div
                      key={idx}
                      className={cn("flex-1 rounded-sm transition-all", statusDotColor(h))}
                      style={{ height: sparklineHeight(h) }}
                    />
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ SERVICE DETAIL VIEW */}
      {tab === "services" && selectedSvc && (
        <div>
          <button
            onClick={() => setSelectedServiceId(null)}
            className="text-sm text-indigo-400 hover:text-indigo-300 mb-5 transition-colors"
          >
            ← Back to Services
          </button>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: main stats + history + deps */}
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold">{selectedSvc.name}</h2>
                  <span
                    className={cn(
                      "text-sm px-3 py-1 rounded-full capitalize font-medium",
                      statusBadgeClass(selectedSvc.status)
                    )}
                  >
                    {selectedSvc.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-1">Uptime (30d)</div>
                    <div
                      className={cn(
                        "text-2xl font-mono font-bold",
                        statusTextColor(selectedSvc.status)
                      )}
                    >
                      {selectedSvc.uptime.toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-1">Error Rate</div>
                    <div
                      className={cn(
                        "text-2xl font-mono font-bold",
                        selectedSvc.errorRate > 2
                          ? "text-rose-400"
                          : selectedSvc.errorRate > 0.3
                          ? "text-amber-400"
                          : "text-zinc-300"
                      )}
                    >
                      {selectedSvc.errorRate.toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-1">p99 Latency</div>
                    <div className="text-2xl font-mono font-bold text-zinc-300">
                      {selectedSvc.p99Latency === 0 ? "—" : `${selectedSvc.p99Latency}ms`}
                    </div>
                  </div>
                </div>

                {/* History sparkline (larger) */}
                <div>
                  <div className="text-xs text-zinc-500 mb-2 font-medium">7-Day Status History</div>
                  <div className="flex gap-1 items-end h-12 mb-1">
                    {selectedSvc.history.map((h, idx) => (
                      <div key={idx} className="flex-1 flex flex-col justify-end">
                        <div
                          className={cn("w-full rounded", statusDotColor(h))}
                          style={{ height: sparklineHeight(h) }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>7 days ago</span>
                    <span>Today</span>
                  </div>
                </div>
              </div>

              {/* Dependencies */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="text-sm font-semibold mb-3 text-zinc-300">Dependencies</div>
                {selectedSvc.dependencies.length === 0 ? (
                  <div className="text-sm text-zinc-600 italic">No upstream dependencies</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedSvc.dependencies.map((dep) => {
                      const depSvc = SERVICES.find((s) => s.id === dep);
                      return (
                        <button
                          key={dep}
                          onClick={() => depSvc && setSelectedServiceId(dep)}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded-full border transition-opacity hover:opacity-80",
                            depSvc ? statusBadgeClass(depSvc.status) : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          )}
                        >
                          {depSvc ? depSvc.name : dep}
                          {depSvc && (
                            <span className="ml-1 opacity-60 capitalize">· {depSvc.status}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: SLO gauges + recent incidents */}
            <div className="space-y-5">
              {/* SLO Compliance */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="text-sm font-semibold mb-4 text-zinc-300">SLO Compliance</div>
                {SLOS.filter((s) => s.service === selectedSvc.name).length === 0 ? (
                  <div className="text-sm text-zinc-600 italic">No SLOs defined</div>
                ) : (
                  <div className="space-y-4">
                    {SLOS.filter((s) => s.service === selectedSvc.name).map((slo) => {
                      const budgetPct = Math.min(100, (slo.errorBudgetDays / 30) * 100);
                      const color = sloBurnTextColor(slo.burnRate, slo.errorBudgetDays);
                      const bar = sloBurnBarColor(slo.burnRate, slo.errorBudgetDays);
                      return (
                        <div key={slo.id}>
                          <div className="flex justify-between items-baseline text-xs mb-1">
                            <span className="text-zinc-400 truncate mr-2 max-w-[160px]">{slo.name}</span>
                            <span className={cn("font-mono font-semibold shrink-0", color)}>
                              {slo.current.toFixed(2)}%
                            </span>
                          </div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", bar)}
                              style={{ width: `${budgetPct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-zinc-600 mt-0.5">
                            <span>Target {slo.target}%</span>
                            <span>{slo.errorBudgetDays}d budget · {slo.burnRate.toFixed(1)}x burn</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Incidents */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="text-sm font-semibold mb-3 text-zinc-300">Recent Incidents</div>
                {selectedSvc.incidents.length === 0 ? (
                  <div className="text-sm text-zinc-600 italic">No recent incidents 🎉</div>
                ) : (
                  <div className="space-y-2">
                    {selectedSvc.incidents.map((incId) => {
                      const inc = INCIDENTS.find((i) => i.id === incId);
                      if (!inc) return null;
                      return (
                        <div key={incId} className="bg-zinc-800 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={cn(
                                "text-xs px-1.5 py-0.5 rounded capitalize font-medium",
                                severityBadgeClass(inc.severity)
                              )}
                            >
                              {inc.severity}
                            </span>
                            <span className="text-xs text-zinc-500 font-mono">{inc.id}</span>
                          </div>
                          <div className="text-xs text-zinc-300 mb-1">{inc.title}</div>
                          <div
                            className={cn(
                              "text-xs capitalize font-medium",
                              incidentStatusTextColor(inc.status)
                            )}
                          >
                            {inc.status}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ INCIDENTS TAB */}
      {tab === "incidents" && (
        <div>
          <div className="flex gap-2 mb-5">
            {(["all", "active", "resolved"] as IncidentFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setIncidentFilter(f)}
                className={cn(
                  "text-sm px-4 py-1.5 rounded-lg capitalize font-medium transition-colors",
                  incidentFilter === f
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                )}
              >
                {f}
                {f === "active" && activeIncidents.length > 0 && (
                  <span className="ml-1.5 text-xs bg-rose-500 text-white px-1.5 py-0.5 rounded-full">
                    {activeIncidents.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="space-y-4">
            {filteredIncidents.map((inc) => (
              <div
                key={inc.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-xs text-zinc-500 font-mono font-semibold">{inc.id}</span>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full capitalize font-medium",
                          severityBadgeClass(inc.severity)
                        )}
                      >
                        {inc.severity}
                      </span>
                      <span
                        className={cn(
                          "text-xs capitalize font-semibold",
                          incidentStatusTextColor(inc.status)
                        )}
                      >
                        ● {inc.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-base">{inc.title}</h3>
                  </div>
                  {inc.mttr !== null && (
                    <div className="text-right ml-4 shrink-0">
                      <div className="text-xs text-zinc-500 mb-0.5">MTTR</div>
                      <div className="text-lg font-mono font-bold text-emerald-400">{inc.mttr}m</div>
                    </div>
                  )}
                </div>

                {/* Affected services */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {inc.affectedServices.map((s) => (
                    <span
                      key={s}
                      className="text-xs bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full border border-zinc-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {/* Timeline */}
                <div className="border-l-2 border-zinc-800 pl-4 space-y-3 mb-3">
                  {inc.updates.map((upd, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-zinc-700 border-2 border-zinc-900" />
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={cn(
                            "text-xs capitalize font-semibold",
                            incidentStatusTextColor(upd.status)
                          )}
                        >
                          {upd.status}
                        </span>
                        <span className="text-xs text-zinc-600">{formatTimestamp(upd.timestamp)}</span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{upd.message}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-zinc-800 text-xs text-zinc-600">
                  Started: {formatTimestamp(inc.startedAt)}
                  {inc.resolvedAt && ` · Resolved: ${formatTimestamp(inc.resolvedAt)}`}
                </div>
              </div>
            ))}
            {filteredIncidents.length === 0 && (
              <div className="text-center py-16 text-zinc-600">No {incidentFilter} incidents found.</div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ SLOS TAB */}
      {tab === "slos" && (
        <div>
          <div className="hidden md:grid grid-cols-12 gap-4 text-xs text-zinc-500 font-medium uppercase tracking-wider px-4 pb-2 border-b border-zinc-800 mb-3">
            <div className="col-span-3">SLO Name</div>
            <div className="col-span-2">Service</div>
            <div className="col-span-1 text-center">Window</div>
            <div className="col-span-1 text-right">Target</div>
            <div className="col-span-1 text-right">Current</div>
            <div className="col-span-2 text-center">Error Budget</div>
            <div className="col-span-2 text-right">Burn Rate</div>
          </div>
          <div className="space-y-2">
            {SLOS.map((slo) => {
              const color = sloBurnTextColor(slo.burnRate, slo.errorBudgetDays);
              const bar = sloBurnBarColor(slo.burnRate, slo.errorBudgetDays);
              const budgetPct = Math.min(100, (slo.errorBudgetDays / 30) * 100);
              return (
                <div
                  key={slo.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
                >
                  <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center">
                    <div className="md:col-span-3 mb-1 md:mb-0">
                      <div className="text-sm font-semibold">{slo.name}</div>
                    </div>
                    <div className="md:col-span-2 text-xs text-zinc-400 mb-1 md:mb-0">
                      {slo.service}
                    </div>
                    <div className="md:col-span-1 text-xs text-zinc-500 text-center mb-1 md:mb-0 font-mono">
                      {slo.window}
                    </div>
                    <div className="md:col-span-1 text-right text-xs text-zinc-400 font-mono mb-1 md:mb-0">
                      {slo.target.toFixed(2)}%
                    </div>
                    <div className={cn("md:col-span-1 text-right text-sm font-mono font-bold mb-1 md:mb-0", color)}>
                      {slo.current.toFixed(2)}%
                    </div>
                    <div className="md:col-span-2 mb-1 md:mb-0">
                      <div className={cn("text-xs font-mono text-center mb-1", color)}>
                        {slo.errorBudgetDays}d remaining
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", bar)}
                          style={{ width: `${budgetPct}%` }}
                        />
                      </div>
                    </div>
                    <div className={cn("md:col-span-2 text-right text-lg font-mono font-bold", color)}>
                      {slo.burnRate.toFixed(2)}
                      <span className="text-sm font-normal">x</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="mt-5 flex gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Compliant (burn &lt; 1.5×)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Warning (1.5–5×)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400" /> Critical (&gt;5× or budget exhausted)</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ STATUS PAGE TAB */}
      {tab === "status" && (
        <div className="max-w-2xl">
          {/* Overall status banner */}
          <div
            className={cn(
              "rounded-xl p-5 mb-6 border",
              overallStatus === "healthy"
                ? "bg-emerald-400/10 border-emerald-400/20"
                : overallStatus === "degraded"
                ? "bg-amber-400/10 border-amber-400/20"
                : overallStatus === "unknown"
                ? "bg-zinc-800 border-zinc-700"
                : "bg-rose-400/10 border-rose-400/20"
            )}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className={cn("w-3.5 h-3.5 rounded-full", statusDotColor(overallStatus))} />
              <h2 className={cn("text-lg font-bold", statusTextColor(overallStatus))}>
                {overallStatus === "healthy"
                  ? "All Systems Operational"
                  : overallStatus === "degraded"
                  ? "Partial System Degradation"
                  : overallStatus === "unknown"
                  ? "Some Systems Status Unknown"
                  : "Major Service Outage"}
              </h2>
            </div>
            <p className="text-sm text-zinc-400 ml-6">
              Last updated: Feb 22, 2026 at 06:34 MST
            </p>
          </div>

          {/* Component list */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl mb-6 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <span className="text-sm font-semibold text-zinc-300">Components</span>
            </div>
            <div className="divide-y divide-zinc-800">
              {SERVICES.map((svc) => (
                <div key={svc.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-sm text-zinc-200">{svc.name}</span>
                    <span className="ml-3 text-xs text-zinc-600 font-mono">{svc.uptime.toFixed(2)}% uptime</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {svc.status === "healthy" ? (
                      <span className="text-emerald-400 text-base">✓</span>
                    ) : svc.status === "down" ? (
                      <span className="text-rose-400 text-base">✗</span>
                    ) : svc.status === "degraded" ? (
                      <span className="text-amber-400 text-base">⚠</span>
                    ) : (
                      <span className="text-zinc-500 text-base">?</span>
                    )}
                    <span className={cn("text-xs capitalize font-medium", statusTextColor(svc.status))}>
                      {svc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 90-Day Uptime Calendar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-zinc-300">Overall Uptime — Past 90 Days</span>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
                  Up
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
                  Degraded
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" />
                  Down
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-0.5">
              {calendarDays.map((day, idx) => (
                <div
                  key={idx}
                  title={`${90 - idx} days ago · ${day}`}
                  className={cn(
                    "w-3.5 h-3.5 rounded-sm cursor-default transition-opacity hover:opacity-75",
                    statusDotColor(day)
                  )}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-zinc-600 mt-2">
              <span>90 days ago</span>
              <span>Today</span>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800 flex gap-6 text-xs text-zinc-500">
              <span>
                <span className="text-zinc-300 font-semibold">
                  {calendarDays.filter((d) => d === "healthy").length}
                </span>{" "}
                operational days
              </span>
              <span>
                <span className="text-amber-400 font-semibold">
                  {calendarDays.filter((d) => d === "degraded").length}
                </span>{" "}
                degraded days
              </span>
              <span>
                <span className="text-rose-400 font-semibold">
                  {calendarDays.filter((d) => d === "down").length}
                </span>{" "}
                outage days
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
