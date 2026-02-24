import React, { useState, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ServiceStatus = "healthy" | "degraded" | "down" | "unknown";
type IncidentSeverity = "critical" | "major" | "minor" | "maintenance";

interface ServiceCheck {
  id: string;
  name: string;
  description: string;
  category: "core" | "integration" | "storage" | "network" | "model";
  status: ServiceStatus;
  latencyMs: number | null;
  uptime99d: number; // 99-day uptime %
  lastChecked: Date;
  detail?: string;
}

interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  startedAt: Date;
  resolvedAt?: Date;
  updates: { timestamp: Date; message: string }[];
}

interface MetricPoint {
  label: string;
  value: number; // latency ms or uptime %
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const mins = (n: number) => n * 60_000;
const hrs = (n: number) => n * 3_600_000;
const days = (n: number) => n * 86_400_000;

const SERVICES: ServiceCheck[] = [
  {
    id: "gateway",
    name: "Gateway RPC",
    description: "Core gateway daemon — agent communication, session management",
    category: "core",
    status: "healthy",
    latencyMs: 8,
    uptime99d: 99.94,
    lastChecked: ago(mins(0.3)),
    detail: "All endpoints nominal. 14 active sessions.",
  },
  {
    id: "agent-runtime",
    name: "Agent Runtime",
    description: "Agent process management, heartbeat, lifecycle",
    category: "core",
    status: "healthy",
    latencyMs: 12,
    uptime99d: 99.87,
    lastChecked: ago(mins(0.3)),
    detail: "12 agents active, 2 idle, 0 crashed.",
  },
  {
    id: "cron-scheduler",
    name: "Cron Scheduler",
    description: "Job scheduler — heartbeats, periodic tasks",
    category: "core",
    status: "degraded",
    latencyMs: 340,
    uptime99d: 98.21,
    lastChecked: ago(mins(0.5)),
    detail: "data-sync job failing — timeout after 30s. Other jobs healthy.",
  },
  {
    id: "session-store",
    name: "Session Store",
    description: "Persistent session history and message store",
    category: "storage",
    status: "healthy",
    latencyMs: 4,
    uptime99d: 99.99,
    lastChecked: ago(mins(0.3)),
    detail: "2.3 GB used. Read/write latency within SLA.",
  },
  {
    id: "workspace-fs",
    name: "Workspace FS",
    description: "Agent workspace file system — reads, writes, watches",
    category: "storage",
    status: "healthy",
    latencyMs: 3,
    uptime99d: 99.98,
    lastChecked: ago(mins(0.3)),
    detail: "14.8 GB used across 12 workspaces.",
  },
  {
    id: "anthropic-api",
    name: "Anthropic API",
    description: "Claude API — claude-opus-4-6, claude-sonnet-4-6",
    category: "model",
    status: "healthy",
    latencyMs: 1240,
    uptime99d: 99.71,
    lastChecked: ago(mins(1)),
    detail: "TTFT ~0.8s avg. No rate limits hit.",
  },
  {
    id: "openai-api",
    name: "OpenAI API",
    description: "OpenAI API — GPT-4o, TTS, embeddings",
    category: "model",
    status: "healthy",
    latencyMs: 890,
    uptime99d: 99.62,
    lastChecked: ago(mins(1)),
    detail: "TTS-1-HD healthy. No rate limits.",
  },
  {
    id: "slack-integration",
    name: "Slack Integration",
    description: "Slack channel messaging, reactions, pins",
    category: "integration",
    status: "healthy",
    latencyMs: 210,
    uptime99d: 99.55,
    lastChecked: ago(mins(2)),
    detail: "WebSocket connected. Message delivery nominal.",
  },
  {
    id: "github-integration",
    name: "GitHub Integration",
    description: "GitHub API — PRs, issues, branches, commits",
    category: "integration",
    status: "healthy",
    latencyMs: 180,
    uptime99d: 99.81,
    lastChecked: ago(mins(2)),
    detail: "Authenticated as dgarson. Rate limit: 4,821/5,000 remaining.",
  },
  {
    id: "node-relay",
    name: "Node Relay",
    description: "Paired device relay — notifications, camera, screen",
    category: "network",
    status: "healthy",
    latencyMs: 45,
    uptime99d: 97.4,
    lastChecked: ago(mins(0.5)),
    detail: "2 nodes paired: David's MacBook Pro, iPhone 15 Pro.",
  },
  {
    id: "browser-relay",
    name: "Browser Relay",
    description: "Chrome extension relay — tab attach, page control",
    category: "network",
    status: "unknown",
    latencyMs: null,
    uptime99d: 94.1,
    lastChecked: ago(mins(10)),
    detail: "No attached tab. Extension installed but idle.",
  },
  {
    id: "tts-provider",
    name: "TTS Provider",
    description: "Text-to-speech — OpenAI TTS-1-HD (shimmer, chris voices)",
    category: "model",
    status: "healthy",
    latencyMs: 620,
    uptime99d: 99.50,
    lastChecked: ago(mins(1)),
    detail: "Last synthesis: 14s ago. Avg synthesis time: 620ms.",
  },
];

const INCIDENTS: Incident[] = [
  {
    id: "inc-001",
    title: "Cron job data-sync timing out",
    severity: "minor",
    status: "investigating",
    startedAt: ago(hrs(1) + mins(10)),
    updates: [
      { timestamp: ago(hrs(1) + mins(10)), message: "Incident opened — data-sync job timing out after 30s. Other jobs unaffected." },
      { timestamp: ago(mins(45)), message: "Investigating root cause. Likely a dependency call to external API hanging." },
    ],
  },
  {
    id: "inc-002",
    title: "Gateway restart — planned maintenance",
    severity: "maintenance",
    status: "resolved",
    startedAt: ago(hrs(6) + mins(5)),
    resolvedAt: ago(hrs(6)),
    updates: [
      { timestamp: ago(hrs(6) + mins(5)), message: "Planned gateway restart for v2.4.1 deployment." },
      { timestamp: ago(hrs(6)), message: "Restart complete. All services healthy. Uptime reset." },
    ],
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ServiceStatus, {
  label: string; dot: string; badge: string; text: string; ring: string;
}> = {
  healthy:  { label: "Healthy",  dot: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25", text: "text-emerald-400", ring: "ring-emerald-500/30" },
  degraded: { label: "Degraded", dot: "bg-amber-500",   badge: "bg-amber-500/15 text-amber-300 ring-amber-500/25",     text: "text-amber-400",  ring: "ring-amber-500/30" },
  down:     { label: "Down",     dot: "bg-rose-500",    badge: "bg-rose-500/15 text-rose-300 ring-rose-500/25",         text: "text-rose-400",   ring: "ring-rose-500/30" },
  unknown:  { label: "Unknown",  dot: "bg-zinc-500",    badge: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/25",         text: "text-zinc-400",   ring: "ring-zinc-500/30" },
};

const INCIDENT_SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; badge: string }> = {
  critical:    { label: "Critical",    badge: "bg-rose-500/15 text-rose-300 ring-rose-500/25 ring-1" },
  major:       { label: "Major",       badge: "bg-orange-500/15 text-orange-300 ring-orange-500/25 ring-1" },
  minor:       { label: "Minor",       badge: "bg-amber-500/15 text-amber-300 ring-amber-500/25 ring-1" },
  maintenance: { label: "Maintenance", badge: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/25 ring-1" },
};

const INCIDENT_STATUS_CONFIG: Record<Incident["status"], { label: string; color: string }> = {
  investigating: { label: "Investigating", color: "text-amber-400" },
  identified:    { label: "Identified",    color: "text-orange-400" },
  monitoring:    { label: "Monitoring",    color: "text-indigo-400" },
  resolved:      { label: "Resolved",      color: "text-emerald-400" },
};

const CATEGORY_LABELS: Record<ServiceCheck["category"], string> = {
  core: "Core", integration: "Integration", storage: "Storage", network: "Network", model: "AI Models",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) {return `${Math.floor(diff / 1000)}s ago`;}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

// ─── Mini sparkline for latency (SVG) ────────────────────────────────────────

function LatencySparkline({ baseLatency, color }: { baseLatency: number; color: string }) {
  const points = Array.from({ length: 20 }, (_, i) => {
    const jitter = (Math.sin(i * 2.7 + baseLatency) + Math.cos(i * 1.3)) * 0.2;
    return Math.max(0, baseLatency * (1 + jitter));
  });
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const W = 60;
  const H = 20;
  const pts = points
    .map((v, i) => `${(i / (points.length - 1)) * W},${H - ((v - min) / range) * (H - 2) - 1}`)
    .join(" ");
  return (
    <svg width={W} height={H} className="flex-none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
    </svg>
  );
}

// ─── Uptime bar (last 30 days as 30 segments) ─────────────────────────────────

function UptimeBar({ uptime }: { uptime: number }) {
  // Simulate segments: mostly green, occasional blip based on uptime
  const segments = Array.from({ length: 30 }, (_, i) => {
    const chance = (100 - uptime) / 100;
    const seed = Math.sin(i * 13.7 + uptime) * 0.5 + 0.5;
    if (seed < chance * 3) {return "degraded";}
    if (seed < chance * 1.5) {return "down";}
    return "healthy";
  });
  return (
    <div className="flex items-end gap-px" aria-label={`${uptime.toFixed(2)}% uptime`}>
      {segments.map((s, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-sm",
            s === "healthy" ? "bg-emerald-500 h-3" : s === "degraded" ? "bg-amber-500 h-2" : "bg-rose-500 h-1"
          )}
        />
      ))}
    </div>
  );
}

// ─── Overall status banner ───────────────────────────────────────────────────

function OverallBanner({ services }: { services: ServiceCheck[] }) {
  const hasDown = services.some((s) => s.status === "down");
  const hasDegraded = services.some((s) => s.status === "degraded");
  const allHealthy = !hasDown && !hasDegraded;

  if (allHealthy) {
    return (
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <span className="flex h-3 w-3 relative flex-none">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>
        <div>
          <p className="text-sm font-semibold text-emerald-300">All systems operational</p>
          <p className="text-xs text-emerald-600">No active incidents or degradations</p>
        </div>
      </div>
    );
  }

  if (hasDown) {
    return (
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
        <span className="h-3 w-3 rounded-full bg-rose-500 flex-none" />
        <div>
          <p className="text-sm font-semibold text-rose-300">Service outage detected</p>
          <p className="text-xs text-rose-600">One or more services are down. Check incidents below.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
      <span className="h-3 w-3 rounded-full bg-amber-500 flex-none animate-pulse" />
      <div>
        <p className="text-sm font-semibold text-amber-300">Partial service degradation</p>
        <p className="text-xs text-amber-600">Some services are running below normal performance.</p>
      </div>
    </div>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ service }: { service: ServiceCheck }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[service.status];

  return (
    <div className={cn("rounded-xl bg-zinc-900 border transition-colors", cfg.ring, "border-zinc-800")}>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`${service.name} — ${cfg.label}. Click to ${expanded ? "collapse" : "expand"}`}
        className="w-full flex items-start gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl"
      >
        {/* Status dot */}
        <div className="flex-none mt-1">
          <span className={cn("block h-2.5 w-2.5 rounded-full", cfg.dot, service.status === "degraded" && "animate-pulse")} />
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{service.name}</span>
            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full ring-1", cfg.badge)}>{cfg.label}</span>
            <span className="text-xs text-zinc-600">{CATEGORY_LABELS[service.category]}</span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 truncate">{service.description}</p>
        </div>

        {/* Metrics */}
        <div className="flex-none flex items-center gap-4">
          {service.latencyMs !== null && (
            <div className="text-right hidden sm:block">
              <LatencySparkline baseLatency={service.latencyMs} color={service.status === "healthy" ? "#34d399" : service.status === "degraded" ? "#fbbf24" : "#f87171"} />
              <p className="text-xs text-zinc-500 mt-0.5">{service.latencyMs}ms</p>
            </div>
          )}
          <div className="text-right hidden md:block">
            <p className={cn("text-xs font-semibold tabular-nums", service.uptime99d >= 99.9 ? "text-emerald-400" : service.uptime99d >= 99 ? "text-amber-400" : "text-rose-400")}>
              {service.uptime99d.toFixed(2)}%
            </p>
            <p className="text-xs text-zinc-600">30d uptime</p>
          </div>
          <svg
            className={cn("h-4 w-4 text-zinc-600 transition-transform flex-none", expanded && "rotate-180")}
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-zinc-800 mt-0">
          <div className="pt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <div>
              <p className="text-xs text-zinc-500">Status</p>
              <p className={cn("text-xs font-medium mt-0.5", cfg.text)}>{cfg.label}</p>
            </div>
            {service.latencyMs !== null && (
              <div>
                <p className="text-xs text-zinc-500">Latency</p>
                <p className="text-xs font-mono font-medium text-zinc-200 mt-0.5">{service.latencyMs}ms</p>
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-500">30d Uptime</p>
              <p className="text-xs font-mono font-medium text-zinc-200 mt-0.5">{service.uptime99d.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Last Checked</p>
              <p className="text-xs text-zinc-400 mt-0.5">{relTime(service.lastChecked)}</p>
            </div>
          </div>
          {service.detail && (
            <p className="mt-3 text-xs text-zinc-400 leading-relaxed bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-800">{service.detail}</p>
          )}
          <div className="mt-3">
            <p className="text-xs text-zinc-500 mb-1.5">30-day uptime history</p>
            <UptimeBar uptime={service.uptime99d} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Incident Card ────────────────────────────────────────────────────────────

function IncidentCard({ incident }: { incident: Incident }) {
  const [expanded, setExpanded] = useState(!incident.resolvedAt);
  const sevCfg = INCIDENT_SEVERITY_CONFIG[incident.severity];
  const statusCfg = INCIDENT_STATUS_CONFIG[incident.status];

  return (
    <div className={cn("rounded-xl bg-zinc-900 border border-zinc-800", !incident.resolvedAt && "border-amber-500/20")}>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`Incident: ${incident.title}`}
        className="w-full flex items-start gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", sevCfg.badge)}>
              {sevCfg.label}
            </span>
            <span className={cn("text-xs font-medium", statusCfg.color)}>
              {statusCfg.label}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-white">{incident.title}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Started {relTime(incident.startedAt)}
            {incident.resolvedAt && ` · Resolved ${relTime(incident.resolvedAt)}`}
          </p>
        </div>
        <svg
          className={cn("h-4 w-4 text-zinc-600 transition-transform flex-none mt-1", expanded && "rotate-180")}
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-zinc-800">
          <div className="pt-3 space-y-3">
            {[...incident.updates].toReversed().map((u, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-none flex flex-col items-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-zinc-600 mt-1.5" />
                  {i < incident.updates.length - 1 && <div className="w-px flex-1 bg-zinc-800 mt-1" />}
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-xs text-zinc-500">{fmtTime(u.timestamp)} · {relTime(u.timestamp)}</p>
                  <p className="text-sm text-zinc-300 mt-0.5 leading-snug">{u.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type CategoryFilter = ServiceCheck["category"] | "all";

export default function SystemHealth() {
  const [services, setServices] = useState<ServiceCheck[]>(SERVICES);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  // Simulated live refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshing(true);
      setTimeout(() => {
        setServices((prev) =>
          prev.map((s) => ({
            ...s,
            latencyMs: s.latencyMs !== null ? Math.max(1, s.latencyMs + Math.floor((Math.random() - 0.5) * 20)) : null,
            lastChecked: new Date(),
          }))
        );
        setLastRefresh(new Date());
        setRefreshing(false);
      }, 800);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          latencyMs: s.latencyMs !== null ? Math.max(1, s.latencyMs + Math.floor((Math.random() - 0.5) * 30)) : null,
          lastChecked: new Date(),
        }))
      );
      setLastRefresh(new Date());
      setRefreshing(false);
    }, 600);
  }, []);

  const categories: CategoryFilter[] = ["all", "core", "model", "integration", "storage", "network"];
  const filteredServices = categoryFilter === "all" ? services : services.filter((s) => s.category === categoryFilter);

  const statusCounts = {
    healthy: services.filter((s) => s.status === "healthy").length,
    degraded: services.filter((s) => s.status === "degraded").length,
    down: services.filter((s) => s.status === "down").length,
    unknown: services.filter((s) => s.status === "unknown").length,
  };

  const activeIncidents = INCIDENTS.filter((i) => !i.resolvedAt);
  const resolvedIncidents = INCIDENTS.filter((i) => !!i.resolvedAt);

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-white">System Health</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Real-time status of all OpenClaw services and integrations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-zinc-600">Updated {relTime(lastRefresh)}</p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh service status"
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors",
                refreshing && "opacity-50 cursor-not-allowed"
              )}
            >
              <svg className={cn("h-4 w-4", refreshing && "animate-spin")} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 8A5.5 5.5 0 112.5 8" />
                <path strokeLinecap="round" d="M13.5 3v5h-5" />
              </svg>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Status counts */}
        <div className="flex items-center gap-5 mt-3 flex-wrap">
          {[
            { label: "Healthy",  count: statusCounts.healthy,  color: "text-emerald-400" },
            { label: "Degraded", count: statusCounts.degraded, color: statusCounts.degraded > 0 ? "text-amber-400" : "text-zinc-600" },
            { label: "Down",     count: statusCounts.down,     color: statusCounts.down > 0 ? "text-rose-400" : "text-zinc-600" },
            { label: "Unknown",  count: statusCounts.unknown,  color: "text-zinc-500" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn("text-sm font-semibold tabular-nums", color)}>{count}</span>
              <span className="text-xs text-zinc-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-5 space-y-8">
        {/* Overall banner */}
        <OverallBanner services={services} />

        {/* Active Incidents */}
        {activeIncidents.length > 0 && (
          <section aria-labelledby="incidents-heading">
            <h2 id="incidents-heading" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Active Incidents ({activeIncidents.length})
            </h2>
            <div className="space-y-2">
              {activeIncidents.map((inc) => <IncidentCard key={inc.id} incident={inc} />)}
            </div>
          </section>
        )}

        {/* Services */}
        <section aria-labelledby="services-heading">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 id="services-heading" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Services ({filteredServices.length})
            </h2>
            {/* Category filter tabs */}
            <div role="tablist" aria-label="Filter by category" className="flex items-center gap-1 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  role="tab"
                  aria-selected={categoryFilter === cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    categoryFilter === cat
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  )}
                >
                  {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {filteredServices.map((svc) => <ServiceCard key={svc.id} service={svc} />)}
          </div>
        </section>

        {/* Resolved Incidents */}
        {resolvedIncidents.length > 0 && (
          <section aria-labelledby="resolved-heading">
            <h2 id="resolved-heading" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Resolved Incidents
            </h2>
            <div className="space-y-2">
              {resolvedIncidents.map((inc) => <IncidentCard key={inc.id} incident={inc} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
