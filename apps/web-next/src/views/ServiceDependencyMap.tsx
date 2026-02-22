import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type ServiceHealth = "healthy" | "degraded" | "down" | "unknown";
type ServiceTier = "frontend" | "gateway" | "backend" | "data" | "infra" | "external";
type DepType = "sync" | "async" | "cache" | "db" | "queue";

interface ServiceNode {
  id: string;
  name: string;
  tier: ServiceTier;
  health: ServiceHealth;
  owner: string;
  version: string;
  uptime: number; // %
  latencyP50: number; // ms
  latencyP99: number; // ms
  errorRate: number; // %
  callsPerMin: number;
  deps: string[]; // ids this service depends on
  port?: number;
  language: string;
  incidents: number;
}

interface Dependency {
  from: string;
  to: string;
  type: DepType;
  callsPerMin: number;
  latencyMs: number;
  errorRate: number;
}

interface HealthEvent {
  id: string;
  serviceId: string;
  type: "incident" | "deploy" | "recovery" | "alert";
  message: string;
  at: string;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const SERVICES: ServiceNode[] = [
  // Frontend
  { id: "web-app", name: "Web App", tier: "frontend", health: "healthy", owner: "Product & UI", version: "3.12.4", uptime: 99.97, latencyP50: 45, latencyP99: 180, errorRate: 0.02, callsPerMin: 3400, deps: ["api-gateway"], port: 3000, language: "TypeScript", incidents: 0 },
  { id: "mobile-app", name: "Mobile App", tier: "frontend", health: "healthy", owner: "Product & UI", version: "2.8.1", uptime: 99.94, latencyP50: 80, latencyP99: 320, errorRate: 0.05, callsPerMin: 1800, deps: ["api-gateway"], language: "React Native", incidents: 0 },

  // Gateway
  { id: "api-gateway", name: "API Gateway", tier: "gateway", health: "healthy", owner: "Platform", version: "1.4.2", uptime: 99.99, latencyP50: 12, latencyP99: 45, errorRate: 0.01, callsPerMin: 5200, deps: ["auth-svc", "user-svc", "order-svc", "analytics-svc", "notification-svc"], port: 8080, language: "Go", incidents: 0 },

  // Backend
  { id: "auth-svc", name: "Auth Service", tier: "backend", health: "healthy", owner: "Security", version: "2.1.0", uptime: 99.98, latencyP50: 8, latencyP99: 32, errorRate: 0.01, callsPerMin: 4800, deps: ["user-db", "redis-cache"], port: 8081, language: "Go", incidents: 0 },
  { id: "user-svc", name: "User Service", tier: "backend", health: "healthy", owner: "Platform", version: "1.9.3", uptime: 99.95, latencyP50: 22, latencyP99: 88, errorRate: 0.03, callsPerMin: 2200, deps: ["user-db", "redis-cache", "event-bus"], port: 8082, language: "TypeScript", incidents: 0 },
  { id: "order-svc", name: "Order Service", tier: "backend", health: "degraded", owner: "Feature Dev", version: "1.6.1", uptime: 98.82, latencyP50: 145, latencyP99: 890, errorRate: 1.8, callsPerMin: 1100, deps: ["order-db", "payment-svc", "event-bus", "inventory-svc"], port: 8083, language: "Java", incidents: 1 },
  { id: "payment-svc", name: "Payment Service", tier: "backend", health: "healthy", owner: "Feature Dev", version: "1.3.7", uptime: 99.99, latencyP50: 210, latencyP99: 820, errorRate: 0.02, callsPerMin: 380, deps: ["payment-db", "stripe-api"], port: 8084, language: "Java", incidents: 0 },
  { id: "inventory-svc", name: "Inventory Service", tier: "backend", health: "healthy", owner: "Feature Dev", version: "1.2.4", uptime: 99.91, latencyP50: 18, latencyP99: 72, errorRate: 0.08, callsPerMin: 920, deps: ["inventory-db", "redis-cache"], port: 8085, language: "Python", incidents: 0 },
  { id: "analytics-svc", name: "Analytics Service", tier: "backend", health: "healthy", owner: "Data Science", version: "0.9.8", uptime: 99.85, latencyP50: 55, latencyP99: 220, errorRate: 0.1, callsPerMin: 620, deps: ["data-warehouse", "event-bus"], port: 8086, language: "Python", incidents: 0 },
  { id: "notification-svc", name: "Notification Svc", tier: "backend", health: "degraded", owner: "Platform", version: "1.1.2", uptime: 97.4, latencyP50: 320, latencyP99: 2100, errorRate: 3.2, callsPerMin: 480, deps: ["event-bus", "sendgrid-api", "twilio-api"], port: 8087, language: "TypeScript", incidents: 2 },

  // Data
  { id: "user-db", name: "User DB (PG)", tier: "data", health: "healthy", owner: "DevOps", version: "16.2", uptime: 99.99, latencyP50: 2, latencyP99: 12, errorRate: 0.0, callsPerMin: 8400, deps: [], language: "PostgreSQL", incidents: 0 },
  { id: "order-db", name: "Order DB (PG)", tier: "data", health: "healthy", owner: "DevOps", version: "16.2", uptime: 99.98, latencyP50: 3, latencyP99: 18, errorRate: 0.01, callsPerMin: 3200, deps: [], language: "PostgreSQL", incidents: 0 },
  { id: "payment-db", name: "Payment DB (PG)", tier: "data", health: "healthy", owner: "DevOps", version: "15.4", uptime: 99.99, latencyP50: 2, latencyP99: 10, errorRate: 0.0, callsPerMin: 1200, deps: [], language: "PostgreSQL", incidents: 0 },
  { id: "inventory-db", name: "Inventory DB (Mongo)", tier: "data", health: "healthy", owner: "DevOps", version: "7.0", uptime: 99.96, latencyP50: 4, latencyP99: 22, errorRate: 0.02, callsPerMin: 2800, deps: [], language: "MongoDB", incidents: 0 },
  { id: "redis-cache", name: "Redis Cache", tier: "data", health: "healthy", owner: "DevOps", version: "7.2", uptime: 99.99, latencyP50: 1, latencyP99: 4, errorRate: 0.0, callsPerMin: 28000, deps: [], language: "Redis", incidents: 0 },
  { id: "data-warehouse", name: "Data Warehouse", tier: "data", health: "healthy", owner: "Data Science", version: "BigQuery", uptime: 99.9, latencyP50: 1200, latencyP99: 8000, errorRate: 0.05, callsPerMin: 40, deps: [], language: "BigQuery", incidents: 0 },

  // Infra
  { id: "event-bus", name: "Event Bus (Kafka)", tier: "infra", health: "healthy", owner: "DevOps", version: "3.6", uptime: 99.98, latencyP50: 5, latencyP99: 28, errorRate: 0.01, callsPerMin: 12000, deps: [], language: "Kafka", incidents: 0 },

  // External
  { id: "stripe-api", name: "Stripe API", tier: "external", health: "healthy", owner: "External", version: "v1", uptime: 99.99, latencyP50: 180, latencyP99: 650, errorRate: 0.0, callsPerMin: 380, deps: [], language: "REST", incidents: 0 },
  { id: "sendgrid-api", name: "SendGrid API", tier: "external", health: "degraded", owner: "External", version: "v3", uptime: 96.2, latencyP50: 420, latencyP99: 3200, errorRate: 4.1, callsPerMin: 280, deps: [], language: "REST", incidents: 1 },
  { id: "twilio-api", name: "Twilio API", tier: "external", health: "healthy", owner: "External", version: "v2", uptime: 99.95, latencyP50: 310, latencyP99: 1100, errorRate: 0.1, callsPerMin: 90, deps: [], language: "REST", incidents: 0 },
];

const DEPENDENCIES: Dependency[] = [
  { from: "web-app", to: "api-gateway", type: "sync", callsPerMin: 3400, latencyMs: 45, errorRate: 0.02 },
  { from: "mobile-app", to: "api-gateway", type: "sync", callsPerMin: 1800, latencyMs: 80, errorRate: 0.05 },
  { from: "api-gateway", to: "auth-svc", type: "sync", callsPerMin: 5200, latencyMs: 8, errorRate: 0.01 },
  { from: "api-gateway", to: "user-svc", type: "sync", callsPerMin: 2200, latencyMs: 22, errorRate: 0.03 },
  { from: "api-gateway", to: "order-svc", type: "sync", callsPerMin: 1100, latencyMs: 145, errorRate: 1.8 },
  { from: "api-gateway", to: "analytics-svc", type: "async", callsPerMin: 620, latencyMs: 55, errorRate: 0.1 },
  { from: "api-gateway", to: "notification-svc", type: "async", callsPerMin: 480, latencyMs: 320, errorRate: 3.2 },
  { from: "auth-svc", to: "user-db", type: "db", callsPerMin: 4800, latencyMs: 2, errorRate: 0.0 },
  { from: "auth-svc", to: "redis-cache", type: "cache", callsPerMin: 9600, latencyMs: 1, errorRate: 0.0 },
  { from: "user-svc", to: "user-db", type: "db", callsPerMin: 2200, latencyMs: 2, errorRate: 0.0 },
  { from: "user-svc", to: "redis-cache", type: "cache", callsPerMin: 4400, latencyMs: 1, errorRate: 0.0 },
  { from: "user-svc", to: "event-bus", type: "queue", callsPerMin: 800, latencyMs: 5, errorRate: 0.01 },
  { from: "order-svc", to: "order-db", type: "db", callsPerMin: 3200, latencyMs: 3, errorRate: 0.01 },
  { from: "order-svc", to: "payment-svc", type: "sync", callsPerMin: 380, latencyMs: 210, errorRate: 0.02 },
  { from: "order-svc", to: "event-bus", type: "queue", callsPerMin: 1100, latencyMs: 5, errorRate: 0.01 },
  { from: "order-svc", to: "inventory-svc", type: "sync", callsPerMin: 920, latencyMs: 18, errorRate: 0.08 },
  { from: "payment-svc", to: "payment-db", type: "db", callsPerMin: 1200, latencyMs: 2, errorRate: 0.0 },
  { from: "payment-svc", to: "stripe-api", type: "sync", callsPerMin: 380, latencyMs: 180, errorRate: 0.0 },
  { from: "inventory-svc", to: "inventory-db", type: "db", callsPerMin: 2800, latencyMs: 4, errorRate: 0.02 },
  { from: "inventory-svc", to: "redis-cache", type: "cache", callsPerMin: 5600, latencyMs: 1, errorRate: 0.0 },
  { from: "analytics-svc", to: "data-warehouse", type: "db", callsPerMin: 40, latencyMs: 1200, errorRate: 0.05 },
  { from: "analytics-svc", to: "event-bus", type: "queue", callsPerMin: 580, latencyMs: 5, errorRate: 0.01 },
  { from: "notification-svc", to: "event-bus", type: "queue", callsPerMin: 480, latencyMs: 5, errorRate: 0.01 },
  { from: "notification-svc", to: "sendgrid-api", type: "sync", callsPerMin: 280, latencyMs: 420, errorRate: 4.1 },
  { from: "notification-svc", to: "twilio-api", type: "sync", callsPerMin: 90, latencyMs: 310, errorRate: 0.1 },
];

const EVENTS: HealthEvent[] = [
  { id: "e-001", serviceId: "order-svc", type: "incident", message: "P99 latency spiked to 890ms — DB connection pool saturation", at: "2026-02-22T10:32:00Z" },
  { id: "e-002", serviceId: "notification-svc", type: "incident", message: "SendGrid API degraded — email delivery delays up to 45s", at: "2026-02-22T09:15:00Z" },
  { id: "e-003", serviceId: "notification-svc", type: "alert", message: "Error rate crossed 3% threshold", at: "2026-02-22T09:18:00Z" },
  { id: "e-004", serviceId: "sendgrid-api", type: "incident", message: "External provider reporting degraded email delivery (status.sendgrid.com)", at: "2026-02-22T08:55:00Z" },
  { id: "e-005", serviceId: "order-svc", type: "deploy", message: "Deploy v1.6.1 — hotfix for checkout flow regression", at: "2026-02-22T07:00:00Z" },
  { id: "e-006", serviceId: "user-svc", type: "deploy", message: "Deploy v1.9.3 — profile update performance improvements", at: "2026-02-21T18:00:00Z" },
  { id: "e-007", serviceId: "api-gateway", type: "deploy", message: "Deploy v1.4.2 — rate limiting improvements", at: "2026-02-21T14:30:00Z" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function healthColor(h: ServiceHealth): string {
  return h === "healthy" ? "text-emerald-400" : h === "degraded" ? "text-amber-400" : h === "down" ? "text-rose-400" : "text-zinc-400";
}

function healthBg(h: ServiceHealth): string {
  return h === "healthy" ? "bg-emerald-500/20 text-emerald-300" : h === "degraded" ? "bg-amber-500/20 text-amber-300" : h === "down" ? "bg-rose-500/20 text-rose-300" : "bg-zinc-700 text-zinc-300";
}

function healthDot(h: ServiceHealth): string {
  return h === "healthy" ? "bg-emerald-400" : h === "degraded" ? "bg-amber-400" : h === "down" ? "bg-rose-400" : "bg-zinc-500";
}

function tierColor(t: ServiceTier): string {
  const m: Record<ServiceTier, string> = {
    frontend: "bg-indigo-500/20 text-indigo-300",
    gateway: "bg-violet-500/20 text-violet-300",
    backend: "bg-sky-500/20 text-sky-300",
    data: "bg-amber-500/20 text-amber-300",
    infra: "bg-zinc-600/40 text-zinc-300",
    external: "bg-zinc-700/60 text-zinc-400",
  };
  return m[t];
}

function depTypeColor(t: DepType): string {
  const m: Record<DepType, string> = { sync: "text-sky-400", async: "text-violet-400", cache: "text-amber-400", db: "text-emerald-400", queue: "text-indigo-400" };
  return m[t];
}

function eventIcon(type: HealthEvent["type"]): string {
  return type === "incident" ? "🔴" : type === "deploy" ? "🚀" : type === "recovery" ? "✅" : "⚠️";
}

// ── Tier columns layout ───────────────────────────────────────────────────────

const TIER_ORDER: ServiceTier[] = ["frontend", "gateway", "backend", "data", "infra", "external"];
const TIER_LABELS: Record<ServiceTier, string> = {
  frontend: "Frontend", gateway: "Gateway", backend: "Backend",
  data: "Data", infra: "Infra", external: "External",
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ServiceDependencyMap() {
  const [tab, setTab] = useState<"map" | "services" | "deps" | "events">("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<ServiceTier | "all">("all");
  const [filterHealth, setFilterHealth] = useState<ServiceHealth | "all">("all");

  const selected = SERVICES.find((s) => s.id === selectedId) ?? null;

  // Services that depend ON selected, and what selected depends on
  const upstreamOf = selected ? DEPENDENCIES.filter((d) => d.to === selected.id).map((d) => d.from) : [];
  const downstreamOf = selected ? DEPENDENCIES.filter((d) => d.from === selected.id).map((d) => d.to) : [];

  const filteredServices = SERVICES.filter(
    (s) => (filterTier === "all" || s.tier === filterTier) && (filterHealth === "all" || s.health === filterHealth),
  );

  const unhealthyCount = SERVICES.filter((s) => s.health !== "healthy").length;
  const totalCallsPerMin = SERVICES.reduce((s, svc) => s + svc.callsPerMin, 0);

  const tabs = [
    { id: "map" as const, label: "Dependency Map" },
    { id: "services" as const, label: "Services", count: SERVICES.length },
    { id: "deps" as const, label: "Dependencies", count: DEPENDENCIES.length },
    { id: "events" as const, label: "Events", count: EVENTS.length },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Service Dependency Map</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Service topology, health, and dependency tracking</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-zinc-400">Services</div>
              <div className="text-lg font-bold text-white">{SERVICES.length}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-400">Unhealthy</div>
              <div className={cn("text-lg font-bold", unhealthyCount > 0 ? "text-amber-400" : "text-emerald-400")}>{unhealthyCount}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-400">Calls/min</div>
              <div className="text-lg font-bold text-white">{(totalCallsPerMin / 1000).toFixed(1)}k</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedId(null); }}
            className={cn("px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", tab === t.id ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-white")}
          >
            {t.label}
            {"count" in t && t.count !== undefined && (
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full", tab === t.id ? "bg-indigo-500/20 text-indigo-300" : "bg-zinc-700 text-zinc-400")}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">

        {/* MAP TAB */}
        {tab === "map" && (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {TIER_ORDER.map((tier) => {
                  const tierServices = SERVICES.filter((s) => s.tier === tier);
                  if (tierServices.length === 0) return null;
                  return (
                    <div key={tier}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", tierColor(tier))}>{TIER_LABELS[tier]}</span>
                        <div className="flex-1 border-b border-zinc-800" />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {tierServices.map((svc) => {
                          const isSelected = selectedId === svc.id;
                          const isUpstream = upstreamOf.includes(svc.id);
                          const isDownstream = downstreamOf.includes(svc.id);
                          return (
                            <button
                              key={svc.id}
                              onClick={() => setSelectedId(isSelected ? null : svc.id)}
                              className={cn(
                                "relative text-left rounded-lg border p-3 w-40 transition-all",
                                isSelected ? "border-indigo-500 bg-indigo-500/10" : isUpstream ? "border-violet-500/60 bg-violet-500/5" : isDownstream ? "border-sky-500/60 bg-sky-500/5" : "border-zinc-700 bg-zinc-900 hover:border-zinc-600",
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", healthDot(svc.health))} />
                                <span className="text-xs font-medium text-white truncate">{svc.name}</span>
                              </div>
                              <div className="text-[10px] text-zinc-400">{svc.language}</div>
                              <div className="text-[10px] text-zinc-500 mt-1">v{svc.version}</div>
                              {svc.incidents > 0 && (
                                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 rounded-full text-[9px] flex items-center justify-center text-white font-bold">
                                  {svc.incidents}
                                </div>
                              )}
                              {isUpstream && <div className="absolute -top-1 right-1 text-[9px] text-violet-400 font-medium">↓ uses</div>}
                              {isDownstream && <div className="absolute -top-1 right-1 text-[9px] text-sky-400 font-medium">↑ used by</div>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Side detail panel */}
            {selected && (
              <div className="w-80 border-l border-zinc-800 overflow-y-auto p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{selected.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", healthBg(selected.health))}>{selected.health}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", tierColor(selected.tier))}>{selected.tier}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedId(null)} className="text-zinc-500 hover:text-white text-lg">×</button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Owner", val: selected.owner },
                    { label: "Language", val: selected.language },
                    { label: "Version", val: `v${selected.version}` },
                    { label: "Port", val: selected.port ? `:${selected.port}` : "—" },
                  ].map((m) => (
                    <div key={m.label} className="bg-zinc-800/50 rounded p-2">
                      <div className="text-[10px] text-zinc-500">{m.label}</div>
                      <div className="text-xs text-zinc-200 mt-0.5">{m.val}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {[
                    { label: "Uptime", val: `${selected.uptime}%`, color: selected.uptime > 99 ? "text-emerald-400" : selected.uptime > 98 ? "text-amber-400" : "text-rose-400" },
                    { label: "P50 Latency", val: `${selected.latencyP50}ms`, color: "text-zinc-200" },
                    { label: "P99 Latency", val: `${selected.latencyP99}ms`, color: selected.latencyP99 > 500 ? "text-amber-400" : "text-zinc-200" },
                    { label: "Error Rate", val: `${selected.errorRate}%`, color: selected.errorRate > 1 ? "text-rose-400" : selected.errorRate > 0.1 ? "text-amber-400" : "text-emerald-400" },
                    { label: "Calls/min", val: selected.callsPerMin.toLocaleString(), color: "text-zinc-200" },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{m.label}</span>
                      <span className={cn("text-xs font-medium", m.color)}>{m.val}</span>
                    </div>
                  ))}
                </div>

                {upstreamOf.length > 0 && (
                  <div>
                    <div className="text-xs text-violet-400 font-medium mb-2">↓ Depends on ({upstreamOf.length})</div>
                    <div className="space-y-1">
                      {upstreamOf.map((id) => {
                        const dep = DEPENDENCIES.find((d) => d.from === selected.id && d.to === id);
                        const svc = SERVICES.find((s) => s.id === id);
                        return (
                          <div key={id} className="flex items-center justify-between text-xs bg-zinc-800/40 rounded px-2 py-1">
                            <div className="flex items-center gap-1.5">
                              <div className={cn("w-1.5 h-1.5 rounded-full", svc ? healthDot(svc.health) : "bg-zinc-500")} />
                              <span className="text-zinc-300">{svc?.name ?? id}</span>
                            </div>
                            {dep && <span className={cn("text-[10px]", depTypeColor(dep.type))}>{dep.type}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {downstreamOf.length > 0 && (
                  <div>
                    <div className="text-xs text-sky-400 font-medium mb-2">↑ Used by ({downstreamOf.length})</div>
                    <div className="space-y-1">
                      {downstreamOf.map((id) => {
                        const svc = SERVICES.find((s) => s.id === id);
                        return (
                          <div key={id} className="flex items-center gap-1.5 text-xs bg-zinc-800/40 rounded px-2 py-1">
                            <div className={cn("w-1.5 h-1.5 rounded-full", svc ? healthDot(svc.health) : "bg-zinc-500")} />
                            <span className="text-zinc-300">{svc?.name ?? id}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* SERVICES TAB */}
        {tab === "services" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center gap-3 mb-4">
              <select value={filterTier} onChange={(e) => setFilterTier(e.target.value as ServiceTier | "all")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white">
                <option value="all">All Tiers</option>
                {TIER_ORDER.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
              </select>
              <select value={filterHealth} onChange={(e) => setFilterHealth(e.target.value as ServiceHealth | "all")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white">
                <option value="all">All Health</option>
                {(["healthy", "degraded", "down", "unknown"] as ServiceHealth[]).map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-xs text-zinc-500">{filteredServices.length} services</span>
            </div>
            <div className="space-y-2">
              {filteredServices.map((svc) => (
                <div key={svc.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5", healthDot(svc.health))} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{svc.name}</span>
                          <span className={cn("px-1.5 py-0.5 rounded text-xs", tierColor(svc.tier))}>{svc.tier}</span>
                          <span className={cn("px-1.5 py-0.5 rounded text-xs", healthBg(svc.health))}>{svc.health}</span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">{svc.owner} · v{svc.version} · {svc.language}{svc.port ? ` · :${svc.port}` : ""}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-right">
                      {[
                        { label: "Uptime", val: `${svc.uptime}%`, warn: svc.uptime < 99 },
                        { label: "P99", val: `${svc.latencyP99}ms`, warn: svc.latencyP99 > 500 },
                        { label: "Error%", val: `${svc.errorRate}%`, warn: svc.errorRate > 0.5 },
                        { label: "RPM", val: svc.callsPerMin >= 1000 ? `${(svc.callsPerMin / 1000).toFixed(1)}k` : String(svc.callsPerMin), warn: false },
                      ].map((m) => (
                        <div key={m.label}>
                          <div className="text-[10px] text-zinc-500">{m.label}</div>
                          <div className={cn("text-xs font-medium", m.warn ? "text-amber-400" : "text-zinc-200")}>{m.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEPS TAB */}
        {tab === "deps" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-2">
              {DEPENDENCIES.sort((a, b) => b.errorRate - a.errorRate).map((dep) => {
                const fromSvc = SERVICES.find((s) => s.id === dep.from);
                const toSvc = SERVICES.find((s) => s.id === dep.to);
                const isUnhealthy = dep.errorRate > 1;
                return (
                  <div key={`${dep.from}-${dep.to}`} className={cn("bg-zinc-900 border rounded-lg p-3", isUnhealthy ? "border-amber-500/40" : "border-zinc-800")}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={cn("w-2 h-2 rounded-full", fromSvc ? healthDot(fromSvc.health) : "bg-zinc-500")} />
                        <span className="text-sm text-zinc-300 truncate">{fromSvc?.name ?? dep.from}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", depTypeColor(dep.type), "bg-zinc-800")}>{dep.type}</span>
                        <span className="text-zinc-600">→</span>
                        <div className={cn("w-2 h-2 rounded-full", toSvc ? healthDot(toSvc.health) : "bg-zinc-500")} />
                        <span className="text-sm text-zinc-300 truncate">{toSvc?.name ?? dep.to}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-right flex-shrink-0">
                        <div>
                          <div className="text-zinc-500 text-[10px]">RPM</div>
                          <div className="text-zinc-300">{dep.callsPerMin >= 1000 ? `${(dep.callsPerMin / 1000).toFixed(1)}k` : dep.callsPerMin}</div>
                        </div>
                        <div>
                          <div className="text-zinc-500 text-[10px]">Latency</div>
                          <div className={cn(dep.latencyMs > 500 ? "text-amber-400" : "text-zinc-300")}>{dep.latencyMs}ms</div>
                        </div>
                        <div>
                          <div className="text-zinc-500 text-[10px]">Error%</div>
                          <div className={cn(dep.errorRate > 1 ? "text-rose-400" : dep.errorRate > 0.1 ? "text-amber-400" : "text-emerald-400")}>{dep.errorRate}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* EVENTS TAB */}
        {tab === "events" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-3">
              {EVENTS.map((ev) => {
                const svc = SERVICES.find((s) => s.id === ev.serviceId);
                return (
                  <div key={ev.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{eventIcon(ev.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{svc?.name ?? ev.serviceId}</span>
                          <span className={cn("px-1.5 py-0.5 rounded text-xs", ev.type === "incident" ? "bg-rose-500/20 text-rose-300" : ev.type === "deploy" ? "bg-indigo-500/20 text-indigo-300" : ev.type === "recovery" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300")}>
                            {ev.type}
                          </span>
                        </div>
                        <div className="text-sm text-zinc-300 mt-1">{ev.message}</div>
                        <div className="text-xs text-zinc-500 mt-1">{new Date(ev.at).toLocaleString()}</div>
                      </div>
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
