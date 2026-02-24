import React, { useState } from "react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { Server } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";

// ── Types ──────────────────────────────────────────────────────────────────

type GatewayStatus = "active" | "degraded" | "down";
type RouteMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "ANY";
type AuthType = "jwt" | "api-key" | "oauth2" | "none";

interface Gateway {
  id: string;
  name: string;
  environment: string;
  status: GatewayStatus;
  upstreamUrl: string;
  requestsPerMin: number;
  avgLatencyMs: number;
  errorRate: number;
  rps: number;
  region: string;
}

interface Route {
  id: string;
  gatewayId: string;
  method: RouteMethod;
  path: string;
  upstreamPath: string;
  auth: AuthType;
  rateLimit: number;
  cacheTtl: number;
  enabled: boolean;
  requestCount24h: number;
  avgLatencyMs: number;
  errorRate: number;
}

interface Plugin {
  id: string;
  name: string;
  type: "auth" | "transform" | "logging" | "caching" | "security" | "traffic";
  enabled: boolean;
  appliedTo: string;
  config: string;
}

interface TrafficMetric {
  hour: string;
  requests: number;
  errors: number;
  p99Ms: number;
}

// ── Sample Data ────────────────────────────────────────────────────────────

const gateways: Gateway[] = [
  {
    id: "gw-prod", name: "Production Gateway", environment: "production",
    status: "active", upstreamUrl: "https://api-internal.openclawapp.com",
    requestsPerMin: 4820, avgLatencyMs: 42, errorRate: 0.3, rps: 80.4, region: "us-east-1",
  },
  {
    id: "gw-staging", name: "Staging Gateway", environment: "staging",
    status: "active", upstreamUrl: "https://api-staging.openclawapp.com",
    requestsPerMin: 240, avgLatencyMs: 58, errorRate: 1.2, rps: 4.0, region: "us-east-1",
  },
  {
    id: "gw-eu", name: "EU Gateway", environment: "production",
    status: "degraded", upstreamUrl: "https://api-eu.openclawapp.com",
    requestsPerMin: 1840, avgLatencyMs: 124, errorRate: 3.8, rps: 30.7, region: "eu-west-1",
  },
  {
    id: "gw-dev", name: "Development Gateway", environment: "development",
    status: "active", upstreamUrl: "https://api-dev.openclawapp.com",
    requestsPerMin: 42, avgLatencyMs: 182, errorRate: 8.4, rps: 0.7, region: "us-east-1",
  },
];

const routes: Route[] = [
  { id: "rt1", gatewayId: "gw-prod", method: "GET", path: "/v1/users", upstreamPath: "/users", auth: "jwt", rateLimit: 100, cacheTtl: 30, enabled: true, requestCount24h: 48200, avgLatencyMs: 38, errorRate: 0.1 },
  { id: "rt2", gatewayId: "gw-prod", method: "POST", path: "/v1/users", upstreamPath: "/users", auth: "jwt", rateLimit: 20, cacheTtl: 0, enabled: true, requestCount24h: 12400, avgLatencyMs: 62, errorRate: 0.4 },
  { id: "rt3", gatewayId: "gw-prod", method: "GET", path: "/v1/agents", upstreamPath: "/agents", auth: "jwt", rateLimit: 60, cacheTtl: 10, enabled: true, requestCount24h: 82000, avgLatencyMs: 28, errorRate: 0.2 },
  { id: "rt4", gatewayId: "gw-prod", method: "POST", path: "/v1/sessions/{id}/messages", upstreamPath: "/sessions/{id}/messages", auth: "jwt", rateLimit: 10, cacheTtl: 0, enabled: true, requestCount24h: 124000, avgLatencyMs: 1820, errorRate: 0.3 },
  { id: "rt5", gatewayId: "gw-prod", method: "ANY", path: "/v1/webhooks/inbound", upstreamPath: "/webhooks/inbound", auth: "api-key", rateLimit: 500, cacheTtl: 0, enabled: true, requestCount24h: 28400, avgLatencyMs: 18, errorRate: 0.8 },
  { id: "rt6", gatewayId: "gw-prod", method: "GET", path: "/v1/billing/usage", upstreamPath: "/billing/usage", auth: "jwt", rateLimit: 10, cacheTtl: 300, enabled: true, requestCount24h: 4200, avgLatencyMs: 220, errorRate: 0.1 },
  { id: "rt7", gatewayId: "gw-prod", method: "GET", path: "/v1/audit/events", upstreamPath: "/audit/events", auth: "jwt", rateLimit: 5, cacheTtl: 60, enabled: true, requestCount24h: 1800, avgLatencyMs: 340, errorRate: 0.0 },
  { id: "rt8", gatewayId: "gw-prod", method: "POST", path: "/v1/auth/token", upstreamPath: "/auth/token", auth: "none", rateLimit: 30, cacheTtl: 0, enabled: true, requestCount24h: 42000, avgLatencyMs: 88, errorRate: 2.1 },
  { id: "rt9", gatewayId: "gw-prod", method: "DELETE", path: "/v1/sessions/{id}", upstreamPath: "/sessions/{id}", auth: "jwt", rateLimit: 20, cacheTtl: 0, enabled: true, requestCount24h: 8400, avgLatencyMs: 32, errorRate: 0.2 },
  { id: "rt10", gatewayId: "gw-staging", method: "ANY", path: "/*", upstreamPath: "/*", auth: "api-key", rateLimit: 1000, cacheTtl: 0, enabled: true, requestCount24h: 5800, avgLatencyMs: 58, errorRate: 1.2 },
];

const plugins: Plugin[] = [
  { id: "pl1", name: "JWT Validator", type: "auth", enabled: true, appliedTo: "All routes (jwt)", config: "issuer: openclawapp.com, algorithm: RS256" },
  { id: "pl2", name: "Rate Limiter", type: "traffic", enabled: true, appliedTo: "All routes", config: "strategy: sliding-window, redis-backend" },
  { id: "pl3", name: "Request Logger", type: "logging", enabled: true, appliedTo: "All routes", config: "format: json, destination: CloudWatch" },
  { id: "pl4", name: "Response Cache", type: "caching", enabled: true, appliedTo: "Routes with cacheTtl > 0", config: "backend: redis, max-size: 500MB" },
  { id: "pl5", name: "IP Allowlist", type: "security", enabled: false, appliedTo: "/v1/admin/*", config: "allowlist: 10.0.0.0/8, 172.16.0.0/12" },
  { id: "pl6", name: "Request Transform", type: "transform", enabled: true, appliedTo: "/v1/webhooks/inbound", config: "add-header: X-Webhook-Source, strip-prefix: /v1" },
  { id: "pl7", name: "CORS Handler", type: "security", enabled: true, appliedTo: "All routes", config: "origins: openclawapp.com, allow-credentials: true" },
  { id: "pl8", name: "API Key Auth", type: "auth", enabled: true, appliedTo: "Routes (api-key)", config: "header: X-API-Key, lookup: dynamodb" },
];

const trafficMetrics: TrafficMetric[] = [
  { hour: "00:00", requests: 1240, errors: 18, p99Ms: 320 },
  { hour: "02:00", requests: 820, errors: 12, p99Ms: 280 },
  { hour: "04:00", requests: 640, errors: 8, p99Ms: 240 },
  { hour: "06:00", requests: 2840, errors: 24, p99Ms: 380 },
  { hour: "08:00", requests: 4820, errors: 42, p99Ms: 480 },
  { hour: "10:00", requests: 6200, errors: 48, p99Ms: 520 },
  { hour: "12:00", requests: 8400, errors: 62, p99Ms: 580 },
  { hour: "14:00", requests: 7800, errors: 58, p99Ms: 560 },
  { hour: "16:00", requests: 6800, errors: 54, p99Ms: 540 },
  { hour: "18:00", requests: 5400, errors: 44, p99Ms: 500 },
  { hour: "20:00", requests: 3800, errors: 32, p99Ms: 420 },
  { hour: "22:00", requests: 2200, errors: 24, p99Ms: 360 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function gatewayStatusColor(s: GatewayStatus): string {
  return s === "active" ? "bg-emerald-400" : s === "degraded" ? "bg-amber-400" : "bg-rose-500";
}

function gatewayStatusText(s: GatewayStatus): string {
  return s === "active" ? "text-emerald-400" : s === "degraded" ? "text-amber-400" : "text-rose-400";
}

function methodColor(m: RouteMethod): string {
  const map: Record<RouteMethod, string> = {
    GET:    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    POST:   "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    PUT:    "bg-amber-500/20 text-amber-400 border-amber-500/30",
    PATCH:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
    DELETE: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    ANY:    "bg-surface-3/20 text-fg-secondary border-tok-border/30",
  };
  return map[m];
}

function authColor(a: AuthType): string {
  const map: Record<AuthType, string> = {
    jwt:      "text-indigo-400",
    "api-key": "text-amber-400",
    oauth2:   "text-blue-400",
    none:     "text-fg-muted",
  };
  return map[a];
}

function pluginTypeColor(t: Plugin["type"]): string {
  const map: Record<Plugin["type"], string> = {
    auth:      "bg-rose-500/20 text-rose-400 border-rose-500/30",
    transform: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    logging:   "bg-surface-3/20 text-fg-secondary border-tok-border/30",
    caching:   "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    security:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
    traffic:   "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  };
  return map[t];
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function GatewaysTab() {
  const [selected, setSelected] = useState<Gateway | null>(null);

  return (
    <section aria-label="Gateways" className="space-y-3">
      {gateways.length === 0 && (
        <ContextualEmptyState
          icon={Server}
          title="No gateways configured"
          description="Add your first API gateway to start routing traffic to your services."
          size="md"
        />
      )}
      {gateways.map((gw) => (
        <div
          key={gw.id}
          role="button"
          tabIndex={0}
          aria-expanded={selected?.id === gw.id}
          onClick={() => setSelected(selected?.id === gw.id ? null : gw)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(selected?.id === gw.id ? null : gw); } }}
          className={cn(
            "rounded-xl border p-4 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
            selected?.id === gw.id ? "border-indigo-500 bg-indigo-500/5" : "border-tok-border bg-surface-1 hover:border-tok-border"
          )}
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className={cn("w-2.5 h-2.5 rounded-full shrink-0", gatewayStatusColor(gw.status))} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-fg-primary">{gw.name}</span>
                <span className="text-xs bg-surface-2 text-fg-secondary rounded px-2 py-0.5">{gw.environment}</span>
                <span className={cn("text-xs capitalize", gatewayStatusText(gw.status))}>{gw.status}</span>
              </div>
              <div className="text-xs text-fg-muted mt-0.5">{gw.upstreamUrl} · {gw.region}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm font-semibold text-fg-primary">{gw.rps.toFixed(0)}</div>
                <div className="text-xs text-fg-muted">RPS</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-fg-primary">{gw.avgLatencyMs}ms</div>
                <div className="text-xs text-fg-muted">Latency</div>
              </div>
              <div>
                <div className={cn("text-sm font-semibold", gw.errorRate > 2 ? "text-rose-400" : "text-emerald-400")}>{gw.errorRate}%</div>
                <div className="text-xs text-fg-muted">Error</div>
              </div>
            </div>
          </div>

          {selected?.id === gw.id && (
            <div className="mt-4 border-t border-tok-border pt-4">
              <div className="text-xs text-fg-muted mb-1">Upstream URL</div>
              <div className="font-mono text-xs text-indigo-300 bg-surface-0 border border-tok-border rounded px-3 py-2">{gw.upstreamUrl}</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-fg-muted">Req/min</span>
                  <span className="text-fg-primary">{gw.requestsPerMin.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Routes</span>
                  <span className="text-fg-primary">{routes.filter((r) => r.gatewayId === gw.id).length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function RoutesTab() {
  const [gwFilter, setGwFilter] = useState<string>("gw-prod");
  const [selected, setSelected] = useState<Route | null>(null);

  const visible = routes.filter((r) => r.gatewayId === gwFilter);

  return (
    <section aria-label="Routes" className="space-y-4">
      <div role="group" aria-label="Filter routes by gateway" className="flex gap-2">
        {gateways.map((gw) => (
          <button
            key={gw.id}
            onClick={() => setGwFilter(gw.id)}
            aria-pressed={gwFilter === gw.id}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              gwFilter === gw.id ? "bg-indigo-600 text-fg-primary" : "bg-surface-2 text-fg-secondary hover:text-fg-primary"
            )}
          >
            {gw.name}
          </button>
        ))}
      </div>

      <div className="space-y-2" aria-live="polite">
        {visible.map((route) => (
          <div
            key={route.id}
            role="button"
            tabIndex={0}
            aria-expanded={selected?.id === route.id}
            onClick={() => setSelected(selected?.id === route.id ? null : route)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(selected?.id === route.id ? null : route); } }}
            className={cn(
              "rounded-xl border p-3 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              !route.enabled && "opacity-50",
              selected?.id === route.id ? "border-indigo-500 bg-indigo-500/5" : "border-tok-border bg-surface-1 hover:border-tok-border"
            )}
          >
            <div className="flex items-center gap-3">
              <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border", methodColor(route.method))}>
                {route.method}
              </span>
              <span className="font-mono text-sm text-fg-primary">{route.path}</span>
              <span className={cn("text-xs ml-auto", authColor(route.auth))}>{route.auth}</span>
              <span className="text-xs text-fg-muted">{(route.requestCount24h / 1000).toFixed(0)}K/day</span>
              <span className="text-xs text-fg-secondary">{route.avgLatencyMs}ms</span>
              <span className={cn("text-xs", route.errorRate > 2 ? "text-rose-400" : "text-fg-muted")}>{route.errorRate}%</span>
            </div>

            {selected?.id === route.id && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-tok-border pt-3 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-fg-muted">Upstream path</span>
                    <span className="font-mono text-indigo-300">{route.upstreamPath}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fg-muted">Rate limit</span>
                    <span className="text-fg-primary">{route.rateLimit} req/min</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-fg-muted">Cache TTL</span>
                    <span className="text-fg-primary">{route.cacheTtl > 0 ? route.cacheTtl + "s" : "disabled"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fg-muted">Status</span>
                    <span className={route.enabled ? "text-emerald-400" : "text-fg-muted"}>{route.enabled ? "active" : "disabled"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function PluginsTab() {
  return (
    <section aria-label="Plugins" className="space-y-3">
      {plugins.map((p) => (
        <div key={p.id} className="rounded-xl border border-tok-border bg-surface-1 p-4 flex items-center gap-4">
          <span aria-hidden="true" className={cn("w-2 h-2 rounded-full shrink-0", p.enabled ? "bg-emerald-400" : "bg-surface-3")} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-fg-primary text-sm">{p.name}</span>
              <span className={cn("text-xs px-1.5 py-0.5 rounded border capitalize", pluginTypeColor(p.type))}>{p.type}</span>
            </div>
            <div className="text-xs text-fg-muted mt-0.5">{p.appliedTo}</div>
          </div>
          <div className="text-xs font-mono text-fg-secondary max-w-xs truncate">{p.config}</div>
          <span className={cn("text-xs font-medium shrink-0", p.enabled ? "text-emerald-400" : "text-fg-muted")}>
            {p.enabled ? "active" : "disabled"}
          </span>
        </div>
      ))}
    </section>
  );
}

function TrafficTab() {
  const maxReq = Math.max(...trafficMetrics.map((m) => m.requests));

  return (
    <section aria-label="Traffic overview" className="space-y-6">
      <section aria-label="Traffic volume chart" className="rounded-xl border border-tok-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-fg-primary mb-4">Traffic Volume (last 24h by 2h)</h2>
        <div className="flex items-end gap-1.5 h-32" role="img" aria-label="Bar chart showing traffic volume over last 24 hours">
          {trafficMetrics.map((m) => (
            <div key={m.hour} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end" style={{ height: "100px" }}>
                <div
                  aria-hidden="true"
                  className="w-full rounded-t overflow-hidden"
                  style={{ height: (m.requests / maxReq * 100) + "%" }}
                  title={`${m.hour}: ${m.requests.toLocaleString()} requests`}
                >
                  <div className="h-full bg-indigo-500" />
                </div>
              </div>
              <span aria-hidden="true" className="text-xs text-fg-muted">{m.hour}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Top routes by volume" className="rounded-xl border border-tok-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-fg-primary mb-3">Top Routes by Volume</h2>
        <div className="space-y-2">
          {routes.filter((r) => r.gatewayId === "gw-prod").toSorted((a, b) => b.requestCount24h - a.requestCount24h).slice(0, 5).map((r) => {
            const totalReqs = routes.filter((rt) => rt.gatewayId === "gw-prod").reduce((a, rt) => a + rt.requestCount24h, 0);
            return (
              <div key={r.id} className="flex items-center gap-3">
                <span className={cn("text-xs px-1.5 py-0.5 rounded border font-mono font-bold w-16 text-center", methodColor(r.method))}>{r.method}</span>
                <span className="font-mono text-xs text-fg-primary flex-1 truncate">{r.path}</span>
                <div
                  className="w-32 bg-surface-2 rounded-full h-1.5"
                  role="img"
                  aria-label={`${r.path}: ${(r.requestCount24h / 1000).toFixed(0)}K requests`}
                >
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: (r.requestCount24h / totalReqs * 100) + "%" }} />
                </div>
                <span className="text-xs text-fg-secondary w-16 text-right" aria-hidden="true">{(r.requestCount24h / 1000).toFixed(0)}K</span>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const TABS = ["Gateways", "Routes", "Plugins", "Traffic"] as const;
type Tab = typeof TABS[number];

function APIGatewayManagerSkeleton() {
  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-52 mb-2" />
        <Skeleton variant="text" className="w-72 h-3" />
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-tok-border bg-surface-1 p-4">
            <Skeleton className="h-9 w-16 mb-2" />
            <Skeleton variant="text" className="w-28 h-3" />
          </div>
        ))}
      </div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-tok-border">
        {[80, 64, 64, 64].map((w, i) => (
          <Skeleton key={i} className="h-9 mb-px" style={{ width: w }} />
        ))}
      </div>
      {/* Gateway cards */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-tok-border bg-surface-1 p-4">
            <div className="flex items-center gap-3">
              <Skeleton variant="circle" className="w-2.5 h-2.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Skeleton variant="text" className="w-40 h-4" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton variant="text" className="w-14 h-3" />
                </div>
                <Skeleton variant="text" className="w-64 h-3" />
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[0, 1, 2].map(j => (
                  <div key={j}>
                    <Skeleton className="h-5 w-10 mx-auto mb-1" />
                    <Skeleton variant="text" className="w-8 h-3 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function APIGatewayManager({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <APIGatewayManagerSkeleton />;

  const [tab, setTab] = useState<Tab>("Gateways");

  const activeGateways = gateways.filter((g) => g.status === "active").length;
  const degraded = gateways.filter((g) => g.status === "degraded").length;
  const totalRps = gateways.reduce((a, g) => a + g.rps, 0);

  return (
    <>
      <a
        href="#agm-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-[var(--color-text-primary)] focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>
      <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">API Gateway Manager</h1>
            {degraded > 0 && (
              <span role="status" className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-3 py-1">
                {degraded} degraded
              </span>
            )}
          </div>
          <p className="text-fg-secondary text-sm">
            {gateways.length} gateways · {activeGateways} active · {routes.length} routes · {totalRps.toFixed(0)} RPS total
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active Gateways", value: activeGateways, color: "text-emerald-400" },
            { label: "Total Routes", value: routes.length, color: "text-fg-primary" },
            { label: "Active Plugins", value: plugins.filter((p) => p.enabled).length, color: "text-indigo-400" },
            { label: "Total RPS", value: totalRps.toFixed(0), color: "text-fg-primary" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-tok-border bg-surface-1 p-4">
              <div className={cn("text-3xl font-bold", kpi.color)}>{kpi.value}</div>
              <div className="text-sm text-fg-secondary mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>

        <div role="tablist" aria-label="Gateway sections" className="flex gap-1 mb-6 border-b border-tok-border">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`agm-panel-${t.toLowerCase()}`}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                tab === t
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-fg-secondary hover:text-fg-primary"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <main id="agm-main">
          {tab === "Gateways" && <GatewaysTab />}
          {tab === "Routes" && <RoutesTab />}
          {tab === "Plugins" && <PluginsTab />}
          {tab === "Traffic" && <TrafficTab />}
        </main>
      </div>
    </>
  );
}
