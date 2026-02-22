import React, { useState } from "react";
import { cn } from "../lib/utils";

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
    ANY:    "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };
  return map[m];
}

function authColor(a: AuthType): string {
  const map: Record<AuthType, string> = {
    jwt:      "text-indigo-400",
    "api-key": "text-amber-400",
    oauth2:   "text-blue-400",
    none:     "text-zinc-500",
  };
  return map[a];
}

function pluginTypeColor(t: Plugin["type"]): string {
  const map: Record<Plugin["type"], string> = {
    auth:      "bg-rose-500/20 text-rose-400 border-rose-500/30",
    transform: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    logging:   "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
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
    <div className="space-y-3">
      {gateways.map((gw) => (
        <div
          key={gw.id}
          className={cn(
            "rounded-xl border p-4 cursor-pointer transition-all",
            selected?.id === gw.id ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
          )}
          onClick={() => setSelected(selected?.id === gw.id ? null : gw)}
        >
          <div className="flex items-center gap-3">
            <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", gatewayStatusColor(gw.status))} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{gw.name}</span>
                <span className="text-xs bg-zinc-800 text-zinc-400 rounded px-2 py-0.5">{gw.environment}</span>
                <span className={cn("text-xs capitalize", gatewayStatusText(gw.status))}>{gw.status}</span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">{gw.upstreamUrl} · {gw.region}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm font-semibold text-white">{gw.rps.toFixed(0)}</div>
                <div className="text-xs text-zinc-500">RPS</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{gw.avgLatencyMs}ms</div>
                <div className="text-xs text-zinc-500">Latency</div>
              </div>
              <div>
                <div className={cn("text-sm font-semibold", gw.errorRate > 2 ? "text-rose-400" : "text-emerald-400")}>{gw.errorRate}%</div>
                <div className="text-xs text-zinc-500">Error</div>
              </div>
            </div>
          </div>

          {selected?.id === gw.id && (
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <div className="text-xs text-zinc-500 mb-1">Upstream URL</div>
              <div className="font-mono text-xs text-indigo-300 bg-zinc-950 border border-zinc-700 rounded px-3 py-2">{gw.upstreamUrl}</div>
              <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Req/min</span>
                  <span className="text-zinc-300">{gw.requestsPerMin.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Routes</span>
                  <span className="text-zinc-300">{routes.filter((r) => r.gatewayId === gw.id).length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RoutesTab() {
  const [gwFilter, setGwFilter] = useState<string>("gw-prod");
  const [selected, setSelected] = useState<Route | null>(null);

  const visible = routes.filter((r) => r.gatewayId === gwFilter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {gateways.map((gw) => (
          <button
            key={gw.id}
            onClick={() => setGwFilter(gw.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              gwFilter === gw.id ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            {gw.name}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.map((route) => (
          <div
            key={route.id}
            className={cn(
              "rounded-xl border p-3 cursor-pointer transition-all",
              !route.enabled && "opacity-50",
              selected?.id === route.id ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
            )}
            onClick={() => setSelected(selected?.id === route.id ? null : route)}
          >
            <div className="flex items-center gap-3">
              <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border", methodColor(route.method))}>
                {route.method}
              </span>
              <span className="font-mono text-sm text-white">{route.path}</span>
              <span className={cn("text-xs ml-auto", authColor(route.auth))}>{route.auth}</span>
              <span className="text-xs text-zinc-500">{(route.requestCount24h / 1000).toFixed(0)}K/day</span>
              <span className="text-xs text-zinc-400">{route.avgLatencyMs}ms</span>
              <span className={cn("text-xs", route.errorRate > 2 ? "text-rose-400" : "text-zinc-500")}>{route.errorRate}%</span>
            </div>

            {selected?.id === route.id && (
              <div className="mt-3 grid grid-cols-2 gap-4 border-t border-zinc-800 pt-3 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Upstream path</span>
                    <span className="font-mono text-indigo-300">{route.upstreamPath}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Rate limit</span>
                    <span className="text-zinc-300">{route.rateLimit} req/min</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Cache TTL</span>
                    <span className="text-zinc-300">{route.cacheTtl > 0 ? route.cacheTtl + "s" : "disabled"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Status</span>
                    <span className={route.enabled ? "text-emerald-400" : "text-zinc-500"}>{route.enabled ? "active" : "disabled"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PluginsTab() {
  return (
    <div className="space-y-3">
      {plugins.map((p) => (
        <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-4">
          <div className={cn("w-2 h-2 rounded-full shrink-0", p.enabled ? "bg-emerald-400" : "bg-zinc-600")} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white text-sm">{p.name}</span>
              <span className={cn("text-xs px-1.5 py-0.5 rounded border capitalize", pluginTypeColor(p.type))}>{p.type}</span>
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">{p.appliedTo}</div>
          </div>
          <div className="text-xs font-mono text-zinc-400 max-w-xs truncate">{p.config}</div>
          <span className={cn("text-xs font-medium shrink-0", p.enabled ? "text-emerald-400" : "text-zinc-500")}>
            {p.enabled ? "active" : "disabled"}
          </span>
        </div>
      ))}
    </div>
  );
}

function TrafficTab() {
  const maxReq = Math.max(...trafficMetrics.map((m) => m.requests));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Traffic Volume (last 24h by 2h)</h3>
        <div className="flex items-end gap-1.5 h-32">
          {trafficMetrics.map((m) => (
            <div key={m.hour} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end" style={{ height: "100px" }}>
                <div className="w-full rounded-t overflow-hidden" style={{ height: (m.requests / maxReq * 100) + "%" }}>
                  <div className="h-full bg-indigo-500" />
                </div>
              </div>
              <span className="text-xs text-zinc-600">{m.hour}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Top Routes by Volume</h3>
        <div className="space-y-2">
          {routes.filter((r) => r.gatewayId === "gw-prod").sort((a, b) => b.requestCount24h - a.requestCount24h).slice(0, 5).map((r) => {
            const totalReqs = routes.filter((rt) => rt.gatewayId === "gw-prod").reduce((a, rt) => a + rt.requestCount24h, 0);
            return (
              <div key={r.id} className="flex items-center gap-3">
                <span className={cn("text-xs px-1.5 py-0.5 rounded border font-mono font-bold w-16 text-center", methodColor(r.method))}>{r.method}</span>
                <span className="font-mono text-xs text-zinc-300 flex-1 truncate">{r.path}</span>
                <div className="w-32 bg-zinc-800 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: (r.requestCount24h / totalReqs * 100) + "%" }} />
                </div>
                <span className="text-xs text-zinc-400 w-16 text-right">{(r.requestCount24h / 1000).toFixed(0)}K</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const TABS = ["Gateways", "Routes", "Plugins", "Traffic"] as const;
type Tab = typeof TABS[number];

export default function APIGatewayManager() {
  const [tab, setTab] = useState<Tab>("Gateways");

  const activeGateways = gateways.filter((g) => g.status === "active").length;
  const degraded = gateways.filter((g) => g.status === "degraded").length;
  const totalRps = gateways.reduce((a, g) => a + g.rps, 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">API Gateway Manager</h1>
          {degraded > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-3 py-1">
              {degraded} degraded
            </span>
          )}
        </div>
        <p className="text-zinc-400 text-sm">
          {gateways.length} gateways · {activeGateways} active · {routes.length} routes · {totalRps.toFixed(0)} RPS total
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active Gateways", value: activeGateways, color: "text-emerald-400" },
          { label: "Total Routes", value: routes.length, color: "text-white" },
          { label: "Active Plugins", value: plugins.filter((p) => p.enabled).length, color: "text-indigo-400" },
          { label: "Total RPS", value: totalRps.toFixed(0), color: "text-white" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className={cn("text-3xl font-bold", kpi.color)}>{kpi.value}</div>
            <div className="text-sm text-zinc-400 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-zinc-400 hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Gateways" && <GatewaysTab />}
      {tab === "Routes" && <RoutesTab />}
      {tab === "Plugins" && <PluginsTab />}
      {tab === "Traffic" && <TrafficTab />}
    </div>
  );
}
