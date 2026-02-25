import React, { useState } from "react";
import { Network } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ServiceStatus = "healthy" | "degraded" | "down" | "unknown";
type ServiceKind =
  | "gateway"
  | "api"
  | "worker"
  | "database"
  | "cache"
  | "queue"
  | "external";

interface ServiceMetric {
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  rps: number;
}

interface Service {
  id: string;
  name: string;
  kind: ServiceKind;
  status: ServiceStatus;
  version: string;
  uptime: string;
  host: string;
  port: number;
  metrics: ServiceMetric;
  dependsOn: string[];
  description: string;
}

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const STATUS_META: Record<ServiceStatus, { dot: string; label: string; badge: string }> = {
  healthy: {
    dot: "bg-emerald-400",
    label: "Healthy",
    badge: "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20",
  },
  degraded: {
    dot: "bg-amber-400",
    label: "Degraded",
    badge: "bg-amber-400/10 text-amber-400 ring-amber-400/20",
  },
  down: {
    dot: "bg-rose-400",
    label: "Down",
    badge: "bg-rose-400/10 text-rose-400 ring-rose-400/20",
  },
  unknown: {
    dot: "bg-[var(--color-surface-3)]",
    label: "Unknown",
    badge: "bg-[var(--color-surface-3)]/10 text-[var(--color-text-secondary)] ring-zinc-500/20",
  },
};

const KIND_META: Record<ServiceKind, { label: string; color: string }> = {
  gateway: { label: "Gateway", color: "bg-primary/10 text-primary ring-indigo-500/20" },
  api: { label: "API", color: "bg-sky-500/10 text-sky-400 ring-sky-500/20" },
  worker: { label: "Worker", color: "bg-primary/10 text-primary ring-violet-500/20" },
  database: { label: "Database", color: "bg-orange-500/10 text-orange-400 ring-orange-500/20" },
  cache: { label: "Cache", color: "bg-teal-500/10 text-teal-400 ring-teal-500/20" },
  queue: { label: "Queue", color: "bg-pink-500/10 text-pink-400 ring-pink-500/20" },
  external: { label: "External", color: "bg-[var(--color-surface-3)]/10 text-[var(--color-text-primary)] ring-zinc-500/20" },
};

const ALL_KINDS: ServiceKind[] = [
  "gateway",
  "api",
  "worker",
  "database",
  "cache",
  "queue",
  "external",
];

type StatusFilter = "all" | ServiceStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "healthy", label: "Healthy" },
  { value: "degraded", label: "Degraded" },
  { value: "down", label: "Down" },
];

function fmtMs(ms: number): string {
  if (ms >= 1000) {return `${(ms / 1000).toFixed(1)}s`;}
  return `${ms}ms`;
}

function fmtRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

function fmtRps(rps: number): string {
  if (rps >= 1000) {return `${(rps / 1000).toFixed(1)}k`;}
  return String(rps);
}

function fmtHostPort(host: string, port: number): string {
  if (port === 0) {return `${host} (embedded)`;}
  if (host.includes(".")) {return host;}
  return `${host}:${port}`;
}

/** Max latency across all services — used to normalise bar heights. */
function globalMaxLatency(services: readonly Service[]): number {
  let max = 1;
  for (const s of services) {
    if (s.metrics.p99 > max) {max = s.metrics.p99;}
  }
  return max;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const SERVICES: Service[] = [
  {
    id: "openclaw-gateway",
    name: "OpenClaw Gateway",
    kind: "gateway",
    status: "healthy",
    version: "v1.14.2",
    uptime: "14d 6h",
    host: "0.0.0.0",
    port: 8080,
    metrics: { p50: 8, p95: 42, p99: 180, errorRate: 0.2, rps: 148 },
    dependsOn: ["agent-runner", "file-server"],
    description:
      "Edge gateway handling all inbound traffic. Routes requests to internal services, manages TLS termination, rate limiting, and auth token validation.",
  },
  {
    id: "agent-runner",
    name: "Agent Runner",
    kind: "worker",
    status: "healthy",
    version: "v2.3.1",
    uptime: "14d 6h",
    host: "0.0.0.0",
    port: 8081,
    metrics: { p50: 240, p95: 1800, p99: 4200, errorRate: 1.1, rps: 28 },
    dependsOn: ["model-proxy", "redis-cache", "sqlite-db"],
    description:
      "Orchestrates agent execution loops. Manages tool invocation, context assembly, and streaming responses back to the gateway.",
  },
  {
    id: "model-proxy",
    name: "Model Proxy",
    kind: "api",
    status: "degraded",
    version: "v1.8.0",
    uptime: "6d 18h",
    host: "0.0.0.0",
    port: 8082,
    metrics: { p50: 620, p95: 3800, p99: 8100, errorRate: 4.8, rps: 56 },
    dependsOn: ["anthropic-api", "openai-api", "gemini-api"],
    description:
      "Unified LLM gateway abstracting provider differences. Currently degraded due to elevated error rates from the OpenAI upstream.",
  },
  {
    id: "file-server",
    name: "File Server",
    kind: "api",
    status: "healthy",
    version: "v1.2.0",
    uptime: "14d 6h",
    host: "0.0.0.0",
    port: 8083,
    metrics: { p50: 12, p95: 85, p99: 280, errorRate: 0.1, rps: 42 },
    dependsOn: ["s3-storage"],
    description:
      "Handles file uploads, downloads, and workspace file operations. Streams large files directly from S3.",
  },
  {
    id: "redis-cache",
    name: "Redis Cache",
    kind: "cache",
    status: "healthy",
    version: "v7.2.4",
    uptime: "30d 2h",
    host: "0.0.0.0",
    port: 6379,
    metrics: { p50: 1, p95: 4, p99: 12, errorRate: 0.0, rps: 2840 },
    dependsOn: [],
    description:
      "In-memory cache for session state, rate-limit counters, and hot-path data. Persistence disabled — ephemeral by design.",
  },
  {
    id: "sqlite-db",
    name: "SQLite DB",
    kind: "database",
    status: "healthy",
    version: "v3.45.0",
    uptime: "14d 6h",
    host: "embedded",
    port: 0,
    metrics: { p50: 2, p95: 8, p99: 28, errorRate: 0.0, rps: 440 },
    dependsOn: [],
    description:
      "Embedded relational store for agent memory, conversation history, and configuration. WAL mode enabled for concurrent reads.",
  },
  {
    id: "anthropic-api",
    name: "Anthropic API",
    kind: "external",
    status: "healthy",
    version: "—",
    uptime: "—",
    host: "api.anthropic.com",
    port: 443,
    metrics: { p50: 880, p95: 2400, p99: 4800, errorRate: 0.8, rps: 18 },
    dependsOn: [],
    description:
      "External provider for Claude model family. Primary model backend with the highest reliability among LLM providers.",
  },
  {
    id: "openai-api",
    name: "OpenAI API",
    kind: "external",
    status: "degraded",
    version: "—",
    uptime: "—",
    host: "api.openai.com",
    port: 443,
    metrics: { p50: 1200, p95: 7500, p99: 12000, errorRate: 8.4, rps: 6 },
    dependsOn: [],
    description:
      "External provider for GPT model family. Currently rate-limited — elevated p95/p99 and 8.4% error rate. Fallback routing active.",
  },
  {
    id: "gemini-api",
    name: "Gemini API",
    kind: "external",
    status: "healthy",
    version: "—",
    uptime: "—",
    host: "generativelanguage.googleapis.com",
    port: 443,
    metrics: { p50: 420, p95: 1800, p99: 3200, errorRate: 0.4, rps: 14 },
    dependsOn: [],
    description:
      "External provider for Gemini model family. Used as secondary backend and for embedding generation.",
  },
  {
    id: "s3-storage",
    name: "S3 Storage",
    kind: "external",
    status: "healthy",
    version: "—",
    uptime: "—",
    host: "s3.amazonaws.com",
    port: 443,
    metrics: { p50: 88, p95: 320, p99: 680, errorRate: 0.1, rps: 12 },
    dependsOn: [],
    description:
      "AWS S3 object storage for workspace files, uploaded assets, and agent artifacts. Regional bucket with versioning enabled.",
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Mini 3-bar sparkline representing p50 / p95 / p99 relative to a global max. */
function LatencySparkline({
  metrics,
  maxMs,
}: {
  metrics: ServiceMetric;
  maxMs: number;
}) {
  const bars: { value: number; color: string }[] = [
    { value: metrics.p50, color: "bg-primary" },
    { value: metrics.p95, color: "bg-primary" },
    { value: metrics.p99, color: "bg-indigo-300" },
  ];

  return (
    <div className="flex items-end gap-px h-5 w-8" aria-hidden="true">
      {bars.map((bar, i) => {
        const pct = maxMs > 0 ? Math.max((bar.value / maxMs) * 100, 6) : 6;
        return (
          <div
            key={i}
            className={cn("w-2 rounded-sm", bar.color)}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

/** Chip / pill used for filter buttons. */
function FilterChip({
  active,
  onClick,
  children,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary ring-1 ring-indigo-500/30"
          : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
      )}
    >
      {dot && (
        <span
          className={cn("inline-block h-1.5 w-1.5 rounded-full", dot)}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

/** Badge for service kind. */
function KindBadge({ kind }: { kind: ServiceKind }) {
  const meta = KIND_META[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        meta.color
      )}
    >
      {meta.label}
    </span>
  );
}

/** Status badge with dot. */
function StatusBadge({ status }: { status: ServiceStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        meta.badge
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", meta.dot)}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
}

/** Latency bar used in the detail panel — horizontal bar showing p50/p95/p99 proportions. */
function LatencyBar({ metrics, maxMs }: { metrics: ServiceMetric; maxMs: number }) {
  const pct = (v: number) => (maxMs > 0 ? Math.max((v / maxMs) * 100, 2) : 2);
  return (
    <div className="space-y-2">
      {(
        [
          { label: "p50", value: metrics.p50, color: "bg-primary" },
          { label: "p95", value: metrics.p95, color: "bg-primary" },
          { label: "p99", value: metrics.p99, color: "bg-indigo-300" },
        ] as const
      ).map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="w-7 shrink-0 text-[11px] font-mono text-[var(--color-text-muted)]">
            {row.label}
          </span>
          <div className="relative h-2 flex-1 rounded-full bg-[var(--color-surface-2)]">
            <div
              className={cn("absolute inset-y-0 left-0 rounded-full", row.color)}
              style={{ width: `${pct(row.value)}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-xs font-mono text-[var(--color-text-primary)]">
            {fmtMs(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A single row in the service list. */
function ServiceRow({
  service,
  selected,
  onSelect,
  maxMs,
}: {
  service: Service;
  selected: boolean;
  onSelect: () => void;
  maxMs: number;
}) {
  const statusMeta = STATUS_META[service.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        selected
          ? "bg-[var(--color-surface-2)] ring-1 ring-indigo-500/40"
          : "hover:bg-[var(--color-surface-2)]/60"
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-zinc-900",
          statusMeta.dot
        )}
        aria-label={statusMeta.label}
      />

      {/* Name + kind */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
            {service.name}
          </span>
          <KindBadge kind={service.kind} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
          <span className="font-mono">
            {fmtHostPort(service.host, service.port)}
          </span>
          <span>·</span>
          <span>{fmtRps(service.metrics.rps)} rps</span>
          {service.metrics.errorRate > 2 && (
            <>
              <span>·</span>
              <span className="text-rose-400">
                {fmtRate(service.metrics.errorRate)} err
              </span>
            </>
          )}
        </div>
      </div>

      {/* Sparkline */}
      <LatencySparkline metrics={service.metrics} maxMs={maxMs} />
    </button>
  );
}

/** Dependency / dependent link row. */
function DepLink({
  service,
  onClick,
}: {
  service: Service;
  onClick: () => void;
}) {
  const statusMeta = STATUS_META[service.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-2)]"
    >
      <span
        className={cn("h-2 w-2 rounded-full", statusMeta.dot)}
        aria-hidden="true"
      />
      <span className="text-[var(--color-text-primary)]">{service.name}</span>
      <KindBadge kind={service.kind} />
    </button>
  );
}

/** Detail panel shown on the right when a service is selected. */
function DetailPanel({
  service,
  allServices,
  maxMs,
  onSelectService,
}: {
  service: Service;
  allServices: Service[];
  maxMs: number;
  onSelectService: (id: string) => void;
}) {
  const statusMeta = STATUS_META[service.status];

  // Outbound dependencies (services this one depends on)
  const outbound = service.dependsOn
    .map((id) => allServices.find((s) => s.id === id))
    .filter((s): s is Service => s !== undefined);

  // Inbound dependents (services that depend on this one)
  const inbound = allServices.filter((s) => s.dependsOn.includes(service.id));

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="rounded-xl bg-[var(--color-surface-1)] ring-1 ring-zinc-800 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {service.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <KindBadge kind={service.kind} />
              <span className="font-mono">{service.version}</span>
              <span>·</span>
              <span className="font-mono">
                {fmtHostPort(service.host, service.port)}
              </span>
              <span>·</span>
              <span>up {service.uptime}</span>
            </div>
          </div>
          <StatusBadge status={service.status} />
        </div>
      </div>

      {/* Metrics card */}
      <div className="rounded-xl bg-[var(--color-surface-1)] ring-1 ring-zinc-800 p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Latency
        </h3>
        <LatencyBar metrics={service.metrics} maxMs={maxMs} />

        <div className="grid grid-cols-2 gap-3 pt-2">
          {/* Error rate */}
          <div className="rounded-lg bg-[var(--color-surface-2)]/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Error Rate
            </p>
            <p
              className={cn(
                "mt-1 text-xl font-semibold font-mono",
                service.metrics.errorRate >= 5
                  ? "text-rose-400"
                  : service.metrics.errorRate >= 2
                  ? "text-amber-400"
                  : "text-emerald-400"
              )}
            >
              {fmtRate(service.metrics.errorRate)}
            </p>
          </div>
          {/* RPS */}
          <div className="rounded-lg bg-[var(--color-surface-2)]/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Throughput
            </p>
            <p className="mt-1 text-xl font-semibold font-mono text-[var(--color-text-primary)]">
              {fmtRps(service.metrics.rps)}{" "}
              <span className="text-xs text-[var(--color-text-muted)] font-normal">rps</span>
            </p>
          </div>
        </div>
      </div>

      {/* Dependencies */}
      {(outbound.length > 0 || inbound.length > 0) && (
        <div className="rounded-xl bg-[var(--color-surface-1)] ring-1 ring-zinc-800 p-5 space-y-4">
          {outbound.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Depends On ({outbound.length})
              </h3>
              <div className="flex flex-col gap-0.5">
                {outbound.map((dep) => (
                  <DepLink
                    key={dep.id}
                    service={dep}
                    onClick={() => onSelectService(dep.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {inbound.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Depended On By ({inbound.length})
              </h3>
              <div className="flex flex-col gap-0.5">
                {inbound.map((dep) => (
                  <DepLink
                    key={dep.id}
                    service={dep}
                    onClick={() => onSelectService(dep.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      <div className="rounded-xl bg-[var(--color-surface-1)] ring-1 ring-zinc-800 p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Description
        </h3>
        <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
          {service.description}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function ServiceMap() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<ServiceKind | "all">("all");
  const [selectedId, setSelectedId] = useState<string>(SERVICES[0].id);

  const maxMs = globalMaxLatency(SERVICES);

  const filtered = SERVICES.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) {return false;}
    if (kindFilter !== "all" && s.kind !== kindFilter) {return false;}
    return true;
  });

  const selected = SERVICES.find((s) => s.id === selectedId) ?? SERVICES[0];

  // Counts for the status filter chips
  const statusCounts: Record<StatusFilter, number> = {
    all: SERVICES.length,
    healthy: SERVICES.filter((s) => s.status === "healthy").length,
    degraded: SERVICES.filter((s) => s.status === "degraded").length,
    down: SERVICES.filter((s) => s.status === "down").length,
    unknown: SERVICES.filter((s) => s.status === "unknown").length,
  };

  // Unique kinds actually present in data
  const presentKinds = Array.from(new Set(SERVICES.map((s) => s.kind))).toSorted(
    (a, b) => ALL_KINDS.indexOf(a) - ALL_KINDS.indexOf(b)
  );

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Service Map</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          Topology, health, and latency across {SERVICES.length} services
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status filters */}
        {STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f.value}
            active={statusFilter === f.value}
            onClick={() => setStatusFilter(f.value)}
            dot={f.value !== "all" ? STATUS_META[f.value].dot : undefined}
          >
            {f.label}
            <span className="ml-0.5 text-[var(--color-text-muted)]">{statusCounts[f.value]}</span>
          </FilterChip>
        ))}

        <span className="mx-1 h-4 w-px bg-[var(--color-surface-3)]" aria-hidden="true" />

        {/* Kind filters */}
        <FilterChip
          active={kindFilter === "all"}
          onClick={() => setKindFilter("all")}
        >
          All kinds
        </FilterChip>
        {presentKinds.map((k) => (
          <FilterChip
            key={k}
            active={kindFilter === k}
            onClick={() => setKindFilter(k)}
          >
            {KIND_META[k].label}
          </FilterChip>
        ))}
      </div>

      {/* Body: list + detail */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* Left: service list */}
        <div className="rounded-xl bg-[var(--color-surface-1)] ring-1 ring-zinc-800 p-2 overflow-y-auto">
          {filtered.length === 0 ? (
            <ContextualEmptyState
              icon={Network}
              title="No services in view"
              description="Adjust your filters to explore the map — your services are out there."
              size="sm"
            />
          ) : (
            <div className="flex flex-col gap-0.5">
              {filtered.map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  selected={service.id === selectedId}
                  onSelect={() => setSelectedId(service.id)}
                  maxMs={maxMs}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <DetailPanel
          service={selected}
          allServices={SERVICES}
          maxMs={maxMs}
          onSelectService={setSelectedId}
        />
      </div>
    </div>
  );
}
