import React, { useState } from "react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { Activity } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";

type RouteStatus = "active" | "deprecated" | "disabled" | "beta";
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type AuthType = "api_key" | "jwt" | "oauth2" | "none";
type HealthStatus = "healthy" | "degraded" | "down";

interface RouteMetrics {
  requestsPerMin: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  successRate: number;
  upstreamLatency: number;
}

interface APIRoute {
  id: string;
  path: string;
  method: HttpMethod;
  upstream: string;
  status: RouteStatus;
  auth: AuthType;
  rateLimit: number;
  metrics: RouteMetrics;
  tags: string[];
  version: string;
  createdAt: string;
}

interface UpstreamService {
  id: string;
  name: string;
  url: string;
  health: HealthStatus;
  latencyMs: number;
  requestsPerMin: number;
  errorRate: number;
  lastCheck: string;
  routes: number;
}

interface TrafficPoint {
  time: string;
  requests: number;
  errors: number;
  p95: number;
}

interface RateLimitEvent {
  id: string;
  route: string;
  ip: string;
  count: number;
  limit: number;
  windowSec: number;
  blockedAt: string;
}

const methodColor: Record<HttpMethod, string> = {
  GET:    "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  POST:   "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  PUT:    "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  PATCH:  "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  DELETE: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
};

const routeStatusBadge: Record<RouteStatus, string> = {
  active:     "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  deprecated: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  disabled:   "bg-surface-3/30 text-fg-secondary border border-tok-border/30",
  beta:       "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
};

const authIcon: Record<AuthType, string> = {
  api_key: "🔑",
  jwt:     "🪙",
  oauth2:  "🛡️",
  none:    "🔓",
};

const healthDot: Record<HealthStatus, string> = {
  healthy:  "bg-emerald-400",
  degraded: "bg-amber-400",
  down:     "bg-rose-400",
};

const healthBadge: Record<HealthStatus, string> = {
  healthy:  "text-emerald-400",
  degraded: "text-amber-400",
  down:     "text-rose-400",
};

const ROUTES: APIRoute[] = [
  {
    id: "r-01", path: "/api/v2/users", method: "GET", upstream: "user-service",
    status: "active", auth: "jwt", rateLimit: 1000, version: "v2",
    metrics: { requestsPerMin: 342, p50Ms: 28, p95Ms: 87, p99Ms: 145, errorRate: 0.2, successRate: 99.8, upstreamLatency: 18 },
    tags: ["users", "read"], createdAt: "2025-09-01",
  },
  {
    id: "r-02", path: "/api/v2/users/:id", method: "GET", upstream: "user-service",
    status: "active", auth: "jwt", rateLimit: 500, version: "v2",
    metrics: { requestsPerMin: 128, p50Ms: 22, p95Ms: 64, p99Ms: 110, errorRate: 0.5, successRate: 99.5, upstreamLatency: 14 },
    tags: ["users", "read"], createdAt: "2025-09-01",
  },
  {
    id: "r-03", path: "/api/v2/users/:id", method: "PATCH", upstream: "user-service",
    status: "active", auth: "jwt", rateLimit: 100, version: "v2",
    metrics: { requestsPerMin: 34, p50Ms: 45, p95Ms: 130, p99Ms: 240, errorRate: 1.2, successRate: 98.8, upstreamLatency: 32 },
    tags: ["users", "write"], createdAt: "2025-09-01",
  },
  {
    id: "r-04", path: "/api/v2/auth/token", method: "POST", upstream: "auth-service",
    status: "active", auth: "api_key", rateLimit: 60, version: "v2",
    metrics: { requestsPerMin: 89, p50Ms: 55, p95Ms: 190, p99Ms: 320, errorRate: 3.1, successRate: 96.9, upstreamLatency: 45 },
    tags: ["auth"], createdAt: "2025-08-15",
  },
  {
    id: "r-05", path: "/api/v1/users", method: "GET", upstream: "user-service",
    status: "deprecated", auth: "api_key", rateLimit: 200, version: "v1",
    metrics: { requestsPerMin: 12, p50Ms: 42, p95Ms: 130, p99Ms: 210, errorRate: 0.8, successRate: 99.2, upstreamLatency: 35 },
    tags: ["users", "legacy"], createdAt: "2024-03-01",
  },
  {
    id: "r-06", path: "/api/v2/reports/generate", method: "POST", upstream: "report-service",
    status: "active", auth: "jwt", rateLimit: 10, version: "v2",
    metrics: { requestsPerMin: 4, p50Ms: 2400, p95Ms: 8200, p99Ms: 14500, errorRate: 5.0, successRate: 95.0, upstreamLatency: 2100 },
    tags: ["reports", "async"], createdAt: "2025-11-01",
  },
  {
    id: "r-07", path: "/api/v2/webhooks", method: "POST", upstream: "webhook-service",
    status: "active", auth: "api_key", rateLimit: 500, version: "v2",
    metrics: { requestsPerMin: 67, p50Ms: 18, p95Ms: 52, p99Ms: 88, errorRate: 0.3, successRate: 99.7, upstreamLatency: 10 },
    tags: ["webhooks"], createdAt: "2025-10-15",
  },
  {
    id: "r-08", path: "/api/v2/ai/completions", method: "POST", upstream: "ai-service",
    status: "beta", auth: "jwt", rateLimit: 20, version: "v2",
    metrics: { requestsPerMin: 15, p50Ms: 1200, p95Ms: 4800, p99Ms: 8900, errorRate: 2.5, successRate: 97.5, upstreamLatency: 1150 },
    tags: ["ai", "beta"], createdAt: "2026-01-15",
  },
];

const UPSTREAMS: UpstreamService[] = [
  { id: "u-01", name: "user-service", url: "http://127.0.0.1:3001", health: "healthy", latencyMs: 18, requestsPerMin: 514, errorRate: 0.6, lastCheck: "5s ago", routes: 4 },
  { id: "u-02", name: "auth-service", url: "http://127.0.0.1:3002", health: "degraded", latencyMs: 145, requestsPerMin: 89, errorRate: 3.1, lastCheck: "5s ago", routes: 1 },
  { id: "u-03", name: "report-service", url: "http://127.0.0.1:3003", health: "healthy", latencyMs: 2100, requestsPerMin: 4, errorRate: 5.0, lastCheck: "5s ago", routes: 1 },
  { id: "u-04", name: "webhook-service", url: "http://127.0.0.1:3004", health: "healthy", latencyMs: 10, requestsPerMin: 67, errorRate: 0.3, lastCheck: "5s ago", routes: 1 },
  { id: "u-05", name: "ai-service", url: "http://127.0.0.1:3005", health: "down", latencyMs: 0, requestsPerMin: 0, errorRate: 100, lastCheck: "12s ago", routes: 1 },
];

const TRAFFIC: TrafficPoint[] = [
  { time: "09:00", requests: 580, errors: 12, p95: 88 },
  { time: "09:05", requests: 612, errors: 8,  p95: 82 },
  { time: "09:10", requests: 590, errors: 14, p95: 96 },
  { time: "09:15", requests: 720, errors: 22, p95: 145 },
  { time: "09:20", requests: 680, errors: 18, p95: 120 },
  { time: "09:25", requests: 698, errors: 15, p95: 110 },
  { time: "09:30", requests: 730, errors: 9,  p95: 90 },
  { time: "09:35", requests: 688, errors: 11, p95: 87 },
  { time: "09:40", requests: 710, errors: 7,  p95: 80 },
  { time: "09:45", requests: 695, errors: 13, p95: 94 },
  { time: "09:50", requests: 742, errors: 19, p95: 112 },
  { time: "09:55", requests: 680, errors: 10, p95: 86 },
];

const RATELIMIT_EVENTS: RateLimitEvent[] = [
  { id: "rl-01", route: "POST /api/v2/auth/token", ip: "203.0.113.42", count: 84, limit: 60, windowSec: 60, blockedAt: "09:52:14" },
  { id: "rl-02", route: "GET /api/v2/users", ip: "198.51.100.17", count: 1248, limit: 1000, windowSec: 60, blockedAt: "09:48:33" },
  { id: "rl-03", route: "POST /api/v2/ai/completions", ip: "192.0.2.88", count: 27, limit: 20, windowSec: 60, blockedAt: "09:41:02" },
  { id: "rl-04", route: "POST /api/v2/auth/token", ip: "203.0.113.55", count: 73, limit: 60, windowSec: 60, blockedAt: "09:35:49" },
];

const maxRequests = Math.max(...TRAFFIC.map(p => p.requests));

function APIGatewayMonitorSkeleton() {
  return (
    <div className="flex flex-col h-full bg-surface-0 text-fg-primary">
      {/* Header */}
      <div className="px-3 sm:px-4 md:px-6 py-4 border-b border-tok-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton variant="text" className="w-56 h-3" />
        </div>
        <div className="flex items-center gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="text-center">
              <Skeleton className="h-6 w-16 mx-auto mb-1" />
              <Skeleton variant="text" className="w-12 h-3 mx-auto" />
            </div>
          ))}
        </div>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-tok-border px-6">
        {[64, 88, 64, 88].map((w, i) => (
          <Skeleton key={i} className="h-10 my-1 mr-1" style={{ width: w }} />
        ))}
      </div>
      {/* Split layout: route list + detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Route list */}
        <div className="w-80 border-r border-tok-border flex flex-col">
          <div className="p-3 border-b border-tok-border flex gap-1.5 flex-wrap">
            {[40, 40, 48, 40, 56, 60].map((w, i) => (
              <Skeleton key={i} className="h-5" style={{ width: w }} />
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="px-4 py-3 border-b border-tok-border/60">
                <div className="flex items-center gap-2 mb-1">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton variant="text" className="w-48 h-3 mb-1.5" />
                <div className="flex items-center gap-3">
                  <Skeleton variant="text" className="w-16 h-3" />
                  <Skeleton variant="text" className="w-12 h-3" />
                  <Skeleton variant="text" className="w-12 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Detail */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Skeleton className="h-8 w-14" />
                <Skeleton variant="text" className="w-52 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton variant="text" className="w-24 h-3" />
                <Skeleton variant="text" className="w-10 h-3" />
              </div>
            </div>
          </div>
          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-surface-1 rounded-lg p-3 text-center">
                <Skeleton className="h-7 w-16 mx-auto mb-1" />
                <Skeleton variant="text" className="w-14 h-3 mx-auto" />
              </div>
            ))}
          </div>
          {/* Latency percentiles */}
          <div className="bg-surface-1 rounded-lg p-4 mb-4">
            <Skeleton variant="text" className="w-36 h-4 mb-3" />
            {["p50", "p95", "p99"].map(p => (
              <div key={p} className="flex items-center gap-3 mb-2">
                <Skeleton className="w-6 h-3" />
                <div className="flex-1"><Skeleton className="h-1.5 rounded-full" /></div>
                <Skeleton className="w-14 h-3" />
              </div>
            ))}
          </div>
          {/* Tags */}
          <div className="bg-surface-1 rounded-lg p-4">
            <Skeleton variant="text" className="w-10 h-4 mb-2" />
            <div className="flex flex-wrap gap-1.5">
              {[0, 1, 2].map(i => (
                <Skeleton key={i} className="h-5 w-16" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function APIGatewayMonitor({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <APIGatewayMonitorSkeleton />;

  const [tab, setTab] = useState<"routes" | "upstreams" | "traffic" | "ratelimits">("routes");
  const [selectedRoute, setSelectedRoute] = useState<APIRoute>(ROUTES[0]);
  const [selectedUpstream, setSelectedUpstream] = useState<UpstreamService>(UPSTREAMS[0]);
  const [methodFilter, setMethodFilter] = useState<HttpMethod | "ALL">("ALL");

  const filteredRoutes = methodFilter === "ALL" ? ROUTES : ROUTES.filter(r => r.method === methodFilter);
  const totalRpm = ROUTES.reduce((s, r) => s + r.metrics.requestsPerMin, 0);
  const avgError = (ROUTES.reduce((s, r) => s + r.metrics.errorRate, 0) / ROUTES.length).toFixed(1);

  const tabs = [
    { id: "routes", label: "Routes" },
    { id: "upstreams", label: "Upstreams" },
    { id: "traffic", label: "Traffic" },
    { id: "ratelimits", label: "Rate Limits" },
  ] as const;

  return (
    <>
      {/* WCAG 2.1 AA — Skip navigation */}
      <a
        href="#agmon-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-[var(--color-text-primary)] focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <div className="flex flex-col h-full bg-surface-0 text-fg-primary">
        {/* Header */}
        <header className="px-3 sm:px-4 md:px-6 py-4 border-b border-tok-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">API Gateway Monitor</h1>
            <p className="text-sm text-fg-secondary mt-0.5">Routes · Upstreams · Traffic · Rate Limiting</p>
          </div>
          {/* Live summary stats */}
          <div className="flex items-center gap-6 text-sm" aria-live="polite" role="status">
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-fg-primary">{totalRpm.toLocaleString()}</div>
              <div className="text-xs text-fg-muted">req/min</div>
            </div>
            <div className="text-center">
              <div className={cn("text-lg font-bold font-mono", parseFloat(avgError) > 2 ? "text-amber-400" : "text-emerald-400")}>
                {avgError}%
              </div>
              <div className="text-xs text-fg-muted">error rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-fg-primary">{ROUTES.filter(r => r.status === "active").length}</div>
              <div className="text-xs text-fg-muted">active routes</div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Monitor sections"
          className="flex border-b border-tok-border px-6"
        >
          {tabs.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                tab === t.id ? "border-indigo-500 text-fg-primary" : "border-transparent text-fg-secondary hover:text-fg-primary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <main id="agmon-main" className="flex flex-1 overflow-hidden">

          {/* Routes Tab */}
          {tab === "routes" && (
            <section
              aria-labelledby="tab-routes"
              id="panel-routes"
              role="tabpanel"
              className="flex flex-1 overflow-hidden"
            >
              {/* Route List */}
              <div className="w-80 border-r border-tok-border flex flex-col">
                {/* Method filters */}
                <div
                  role="group"
                  aria-label="Filter routes by HTTP method"
                  className="p-3 border-b border-tok-border flex gap-1.5 flex-wrap"
                >
                  {(["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMethodFilter(m)}
                      aria-pressed={methodFilter === m}
                      className={cn(
                        "text-xs px-2 py-0.5 rounded border transition-colors font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                        methodFilter === m
                          ? m === "ALL" ? "bg-surface-3 border-tok-border text-fg-primary" : methodColor[m as HttpMethod]
                          : "border-tok-border text-fg-secondary hover:border-tok-border"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto" aria-label="Route list" aria-live="polite">
                  {filteredRoutes.length === 0 && (
                    <ContextualEmptyState
                      icon={Activity}
                      title="No routes match filter"
                      description="Try a different HTTP method filter to see matching routes."
                      size="sm"
                    />
                  )}
                  {filteredRoutes.map(route => (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRoute(route)}
                      aria-pressed={selectedRoute.id === route.id}
                      aria-label={`${route.method} ${route.path} — ${route.metrics.requestsPerMin} req/min, ${route.metrics.errorRate}% error rate`}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-tok-border/60 hover:bg-surface-2/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                        selectedRoute.id === route.id && "bg-surface-2/60"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-mono font-bold", methodColor[route.method])}>
                          {route.method}
                        </span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full", routeStatusBadge[route.status])}>
                          {route.status}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-fg-primary mb-1.5 truncate">{route.path}</div>
                      <div className="flex items-center gap-3 text-xs text-fg-muted">
                        <span className="font-mono">{route.metrics.requestsPerMin} rpm</span>
                        <span className={route.metrics.errorRate > 2 ? "text-amber-400" : "text-fg-muted"}>{route.metrics.errorRate}% err</span>
                        <span>p95:{route.metrics.p95Ms}ms</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Route Detail */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={cn("text-sm px-2 py-1 rounded font-mono font-bold", methodColor[selectedRoute.method])}>
                        {selectedRoute.method}
                      </span>
                      <span className="font-mono text-lg text-fg-primary">{selectedRoute.path}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", routeStatusBadge[selectedRoute.status])}>{selectedRoute.status}</span>
                      <span className="text-xs text-fg-muted">→ {selectedRoute.upstream}</span>
                      <span className="text-xs text-fg-muted">· {selectedRoute.version}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true" className="text-fg-secondary">{authIcon[selectedRoute.auth]}</span>
                    <span className="text-fg-secondary">{selectedRoute.auth.replace("_", " ")}</span>
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="bg-surface-1 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold font-mono text-fg-primary mb-1">{selectedRoute.metrics.requestsPerMin}</div>
                    <div className="text-xs text-fg-muted">req/min</div>
                  </div>
                  <div className="bg-surface-1 rounded-lg p-3 text-center">
                    <div className={cn("text-xl font-bold font-mono mb-1", selectedRoute.metrics.errorRate > 2 ? "text-amber-400" : "text-emerald-400")}>
                      {selectedRoute.metrics.errorRate}%
                    </div>
                    <div className="text-xs text-fg-muted">error rate</div>
                  </div>
                  <div className="bg-surface-1 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold font-mono text-fg-primary mb-1">{selectedRoute.metrics.p95Ms}ms</div>
                    <div className="text-xs text-fg-muted">p95 latency</div>
                  </div>
                  <div className="bg-surface-1 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold font-mono text-amber-400 mb-1">{selectedRoute.rateLimit}</div>
                    <div className="text-xs text-fg-muted">rate limit/min</div>
                  </div>
                </div>

                {/* Latency percentiles */}
                <section aria-label="Latency percentiles" className="bg-surface-1 rounded-lg p-4 mb-4">
                  <div className="text-sm font-medium mb-3 text-fg-primary">Latency Percentiles</div>
                  <div className="space-y-2">
                    {[
                      { label: "p50", value: selectedRoute.metrics.p50Ms },
                      { label: "p95", value: selectedRoute.metrics.p95Ms },
                      { label: "p99", value: selectedRoute.metrics.p99Ms },
                    ].map(({ label, value }) => {
                      const max = selectedRoute.metrics.p99Ms;
                      return (
                        <div key={label} className="flex items-center gap-3">
                          <span className="text-xs font-mono text-fg-secondary w-6">{label}</span>
                          <div className="flex-1 bg-surface-2 rounded-full h-1.5">
                            <div
                              role="img"
                              aria-label={`${label} latency: ${value}ms (${Math.round((value / max) * 100)}% of max)`}
                              className="bg-indigo-500 h-1.5 rounded-full"
                              style={{ width: `${(value / max) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-fg-primary w-14 text-right">{value}ms</span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Tags */}
                <section aria-label="Route tags" className="bg-surface-1 rounded-lg p-4 mb-4">
                  <div className="text-sm font-medium mb-2 text-fg-primary">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRoute.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded bg-surface-2 text-fg-primary border border-tok-border">{tag}</span>
                    ))}
                  </div>
                </section>

                <div className="text-xs text-fg-muted">Created {selectedRoute.createdAt} · Upstream latency {selectedRoute.metrics.upstreamLatency}ms</div>
              </div>
            </section>
          )}

          {/* Upstreams Tab */}
          {tab === "upstreams" && (
            <section
              aria-labelledby="tab-upstreams"
              id="panel-upstreams"
              role="tabpanel"
              className="flex flex-1 overflow-hidden"
            >
              <div className="w-72 border-r border-tok-border overflow-y-auto" aria-label="Upstream services list">
                {UPSTREAMS.map(up => (
                  <button
                    key={up.id}
                    onClick={() => setSelectedUpstream(up)}
                    aria-pressed={selectedUpstream.id === up.id}
                    aria-label={`${up.name} — ${up.health}, ${up.requestsPerMin} req/min`}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-tok-border/60 hover:bg-surface-2/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                      selectedUpstream.id === up.id && "bg-surface-2/60"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span aria-hidden="true" className={cn("w-2 h-2 rounded-full flex-shrink-0", healthDot[up.health])} />
                      <span className="text-sm font-medium">{up.name}</span>
                    </div>
                    <div className="text-xs font-mono text-fg-muted mb-1.5">{up.url}</div>
                    <div className="flex items-center gap-3 text-xs text-fg-muted">
                      <span>{up.requestsPerMin} rpm</span>
                      <span className={up.errorRate > 2 ? "text-amber-400" : "text-fg-muted"}>{up.errorRate}% err</span>
                      <span>{up.latencyMs}ms</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold mb-1">{selectedUpstream.name}</h2>
                    <div className="flex items-center gap-3">
                      <span className={cn("flex items-center gap-1.5 text-sm font-medium", healthBadge[selectedUpstream.health])}>
                        <span aria-hidden="true" className={cn("w-2 h-2 rounded-full", healthDot[selectedUpstream.health])} />
                        {selectedUpstream.health}
                      </span>
                      <span className="font-mono text-sm text-fg-secondary">{selectedUpstream.url}</span>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-fg-secondary">Last check</div>
                    <div className="text-fg-primary">{selectedUpstream.lastCheck}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-surface-1 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold font-mono text-fg-primary mb-1">{selectedUpstream.requestsPerMin}</div>
                    <div className="text-xs text-fg-muted">req/min</div>
                  </div>
                  <div className="bg-surface-1 rounded-lg p-4 text-center">
                    <div className={cn("text-2xl font-bold font-mono mb-1", selectedUpstream.errorRate > 5 ? "text-rose-400" : selectedUpstream.errorRate > 2 ? "text-amber-400" : "text-emerald-400")}>
                      {selectedUpstream.errorRate}%
                    </div>
                    <div className="text-xs text-fg-muted">error rate</div>
                  </div>
                  <div className="bg-surface-1 rounded-lg p-4 text-center">
                    <div className={cn("text-2xl font-bold font-mono mb-1", selectedUpstream.latencyMs > 1000 ? "text-amber-400" : "text-fg-primary")}>
                      {selectedUpstream.latencyMs}ms
                    </div>
                    <div className="text-xs text-fg-muted">avg latency</div>
                  </div>
                </div>
                <section aria-label={`Routes for ${selectedUpstream.name}`} className="bg-surface-1 rounded-lg p-4">
                  <div className="text-sm font-medium mb-2 text-fg-primary">Routes ({selectedUpstream.routes})</div>
                  {ROUTES.filter(r => r.upstream === selectedUpstream.name).map(r => (
                    <div key={r.id} className="flex items-center gap-3 py-2 border-b border-tok-border/40 last:border-0">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-mono font-bold", methodColor[r.method])}>{r.method}</span>
                      <span className="font-mono text-xs text-fg-primary">{r.path}</span>
                      <span className="ml-auto text-xs text-fg-muted">{r.metrics.requestsPerMin} rpm</span>
                    </div>
                  ))}
                  {ROUTES.filter(r => r.upstream === selectedUpstream.name).length === 0 && (
                    <div className="text-sm text-fg-muted">No routes for this upstream</div>
                  )}
                </section>
              </div>
            </section>
          )}

          {/* Traffic Tab */}
          {tab === "traffic" && (
            <section
              aria-labelledby="tab-traffic"
              id="panel-traffic"
              role="tabpanel"
              className="flex-1 overflow-y-auto p-6"
            >
              <h2 className="text-base font-semibold mb-1">Traffic Overview</h2>
              <p className="text-sm text-fg-secondary mb-6">Requests and errors over the last hour</p>

              <div className="bg-surface-1 rounded-lg p-6 mb-6">
                <div className="flex items-center gap-4 mb-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                    <span className="text-fg-secondary">Requests</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                    <span className="text-fg-secondary">Errors</span>
                  </span>
                </div>
                {/* Chart */}
                <div
                  role="img"
                  aria-label={`Traffic chart: ${TRAFFIC.length} data points from ${TRAFFIC[0].time} to ${TRAFFIC[TRAFFIC.length - 1].time}. Peak: ${Math.max(...TRAFFIC.map(p => p.requests))} requests at ${TRAFFIC.find(p => p.requests === Math.max(...TRAFFIC.map(p => p.requests)))?.time}.`}
                >
                  <div className="flex items-end gap-1.5 h-40 mb-2">
                    {TRAFFIC.map(pt => (
                      <div key={pt.time} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                        <div
                          className="w-full bg-indigo-500/40 rounded-t relative"
                          style={{ height: `${(pt.requests / maxRequests) * 100}%` }}
                        >
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-rose-500 rounded-t"
                            style={{ height: `${(pt.errors / pt.requests) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {TRAFFIC.map(pt => (
                      <div key={pt.time} className="flex-1 text-center text-xs text-fg-muted">{pt.time.replace("09:", "")}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {TRAFFIC.slice(-4).map(pt => (
                  <div key={pt.time} className="bg-surface-1 rounded-lg p-4">
                    <div className="text-xs text-fg-muted mb-2">{pt.time}</div>
                    <div className="text-lg font-bold font-mono text-fg-primary mb-1">{pt.requests.toLocaleString()}</div>
                    <div className="text-xs text-fg-secondary mb-2">requests</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-rose-400">{pt.errors} err</span>
                      <span className="text-fg-secondary">p95:{pt.p95}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Rate Limits Tab */}
          {tab === "ratelimits" && (
            <section
              aria-labelledby="tab-ratelimits"
              id="panel-ratelimits"
              role="tabpanel"
              className="flex-1 overflow-y-auto p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold">Rate Limit Events</h2>
                  <p className="text-sm text-fg-secondary mt-0.5">Blocked requests in the last hour</p>
                </div>
                <span role="status" className="text-sm text-rose-400 font-medium">
                  {RATELIMIT_EVENTS.length} events
                </span>
              </div>
              <div className="space-y-3" aria-live="polite">
                {RATELIMIT_EVENTS.map(evt => (
                  <div key={evt.id} className="bg-surface-1 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-mono text-sm text-fg-primary">{evt.route}</div>
                      <div className="text-xs text-fg-muted">{evt.blockedAt}</div>
                    </div>
                    <div className="flex items-center gap-4 text-sm mb-3">
                      <span className="font-mono text-fg-primary">{evt.ip}</span>
                      <span className="text-rose-400 font-medium">{evt.count} / {evt.limit} rpm</span>
                      <span className="text-fg-muted">{evt.windowSec}s window</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={Math.round((evt.count / evt.limit) * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Rate limit usage: ${evt.count} of ${evt.limit} rpm (${((evt.count / evt.limit) * 100).toFixed(0)}%)`}
                      className="w-full bg-surface-2 rounded-full h-1.5"
                    >
                      <div
                        className="bg-rose-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min((evt.count / evt.limit) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-fg-muted mt-1 text-right">{((evt.count / evt.limit) * 100).toFixed(0)}% of limit</div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </main>
      </div>
    </>
  );
}
