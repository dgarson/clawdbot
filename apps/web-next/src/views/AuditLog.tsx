import React, { useState, useCallback, useRef, useEffect } from "react";
import { FileSearch } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { Skeleton } from "../components/ui/Skeleton";

// ─── Types ───────────────────────────────────────────────────────────────────

type EventSeverity = "info" | "warning" | "error" | "success";
type EventCategory =
  | "auth"
  | "agent"
  | "session"
  | "cron"
  | "api"
  | "file"
  | "node"
  | "billing"
  | "system";

interface AuditEvent {
  id: string;
  timestamp: Date;
  severity: EventSeverity;
  category: EventCategory;
  actor: string;           // "agent:luis", "user:david", "system", "api:key-abc"
  actorKind: "agent" | "user" | "system" | "api";
  action: string;          // e.g. "session.create", "agent.config.update"
  resource: string;        // e.g. "session:abc123", "agent:piper"
  result: "success" | "failure" | "partial";
  duration?: number;       // ms
  ip?: string;
  detail: string;          // human-readable summary
  meta?: Record<string, string>;
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const mins = (n: number) => n * 60 * 1000;
const hrs = (n: number) => n * 60 * mins(1);

const SEED_EVENTS: AuditEvent[] = [
  {
    id: "evt-001",
    timestamp: ago(mins(2)),
    severity: "info",
    category: "cron",
    actor: "system",
    actorKind: "system",
    action: "cron.job.execute",
    resource: "cron:ux-work-check",
    result: "success",
    duration: 14200,
    detail: "Hourly UX Work Check (Luis) completed. 19 views shipped.",
    meta: { jobId: "e61f3c46", runtime: "14.2s" },
  },
  {
    id: "evt-002",
    timestamp: ago(mins(8)),
    severity: "info",
    category: "session",
    actor: "agent:luis",
    actorKind: "agent",
    action: "session.spawn",
    resource: "session:agent:piper:subagent:d7c8e57e",
    result: "success",
    duration: 312,
    detail: "Luis spawned Piper sub-agent for TeamManagement view.",
    meta: { label: "horizon-team-management", model: "claude-sonnet-4-6" },
  },
  {
    id: "evt-003",
    timestamp: ago(mins(15)),
    severity: "success",
    category: "agent",
    actor: "agent:luis",
    actorKind: "agent",
    action: "agent.file.write",
    resource: "file:src/views/ApiKeysManager.tsx",
    result: "success",
    duration: 890,
    detail: "ApiKeysManager.tsx created — 30.88 kB, ✓ 0 TS errors.",
    meta: { size: "30.88 kB", gzip: "6.98 kB" },
  },
  {
    id: "evt-004",
    timestamp: ago(mins(22)),
    severity: "info",
    category: "api",
    actor: "api:oc_sk_prod_7f2a",
    actorKind: "api",
    action: "api.agents.list",
    resource: "agents:*",
    result: "success",
    duration: 45,
    ip: "203.0.113.12",
    detail: "API key oc_sk_prod_7f2a listed all agents (14 returned).",
    meta: { count: "14", keyName: "CI Pipeline" },
  },
  {
    id: "evt-005",
    timestamp: ago(mins(34)),
    severity: "warning",
    category: "api",
    actor: "api:oc_sk_dev_3a9b",
    actorKind: "api",
    action: "api.sessions.write",
    resource: "session:new",
    result: "failure",
    duration: 12,
    ip: "192.168.1.44",
    detail: "Scope violation: key oc_sk_dev_3a9b lacks sessions:write permission.",
    meta: { scope: "sessions:write", keyName: "Dev Local" },
  },
  {
    id: "evt-006",
    timestamp: ago(hrs(1)),
    severity: "info",
    category: "auth",
    actor: "user:david",
    actorKind: "user",
    action: "auth.login",
    resource: "user:david",
    result: "success",
    duration: 230,
    ip: "10.0.1.5",
    detail: "David signed in via browser session.",
    meta: { method: "session-token", browser: "Safari/19" },
  },
  {
    id: "evt-007",
    timestamp: ago(hrs(1) + mins(10)),
    severity: "error",
    category: "cron",
    actor: "system",
    actorKind: "system",
    action: "cron.job.execute",
    resource: "cron:data-sync",
    result: "failure",
    duration: 30012,
    detail: "Cron job data-sync timed out after 30s. Will retry at next interval.",
    meta: { jobId: "a3b4c5d6", timeout: "30s", retryAt: "02:15 AM" },
  },
  {
    id: "evt-008",
    timestamp: ago(hrs(1) + mins(25)),
    severity: "info",
    category: "node",
    actor: "user:david",
    actorKind: "user",
    action: "node.pair",
    resource: "node:david-iphone",
    result: "success",
    duration: 1840,
    detail: "David paired iPhone 15 Pro (node: david-iphone).",
    meta: { os: "iOS 18.3", platform: "arm64" },
  },
  {
    id: "evt-009",
    timestamp: ago(hrs(2)),
    severity: "info",
    category: "agent",
    actor: "user:david",
    actorKind: "user",
    action: "agent.config.update",
    resource: "agent:xavier",
    result: "success",
    duration: 340,
    ip: "10.0.1.5",
    detail: "Xavier agent config updated — model changed to claude-opus-4-6.",
    meta: { field: "model", from: "claude-sonnet-4-6", to: "claude-opus-4-6" },
  },
  {
    id: "evt-010",
    timestamp: ago(hrs(2) + mins(15)),
    severity: "warning",
    category: "billing",
    actor: "system",
    actorKind: "system",
    action: "billing.budget.alert",
    resource: "budget:daily-tokens",
    result: "partial",
    detail: "Daily token budget at 87% — claude-opus-4-6. Estimated cap at ~3 AM.",
    meta: { model: "claude-opus-4-6", used: "87%", estimate: "3:00 AM" },
  },
  {
    id: "evt-011",
    timestamp: ago(hrs(3)),
    severity: "info",
    category: "file",
    actor: "agent:luis",
    actorKind: "agent",
    action: "file.read",
    resource: "file:CONTEXT.md",
    result: "success",
    duration: 8,
    detail: "Luis read CONTEXT.md during session start.",
    meta: { size: "12.3 kB" },
  },
  {
    id: "evt-012",
    timestamp: ago(hrs(4)),
    severity: "error",
    category: "auth",
    actor: "api:oc_sk_unknown",
    actorKind: "api",
    action: "auth.token.validate",
    resource: "api:gateway",
    result: "failure",
    duration: 3,
    ip: "198.51.100.44",
    detail: "Invalid API token presented — key not found. Possible credential leak or brute force.",
    meta: { ip: "198.51.100.44", attempts: "3" },
  },
  {
    id: "evt-013",
    timestamp: ago(hrs(5)),
    severity: "info",
    category: "session",
    actor: "agent:stephan",
    actorKind: "agent",
    action: "session.create",
    resource: "session:stephan:cron:brand-review",
    result: "success",
    duration: 280,
    detail: "Stephan started brand review cron session.",
    meta: { kind: "cron", model: "claude-sonnet-4-6" },
  },
  {
    id: "evt-014",
    timestamp: ago(hrs(6)),
    severity: "success",
    category: "system",
    actor: "system",
    actorKind: "system",
    action: "system.gateway.restart",
    resource: "gateway:main",
    result: "success",
    duration: 4200,
    detail: "Gateway restarted cleanly. All services healthy. Uptime reset.",
    meta: { version: "2.4.1", pid: "8842" },
  },
  {
    id: "evt-015",
    timestamp: ago(hrs(8)),
    severity: "info",
    category: "agent",
    actor: "user:david",
    actorKind: "user",
    action: "agent.create",
    resource: "agent:sam",
    result: "success",
    duration: 510,
    ip: "10.0.1.5",
    detail: "Sam agent created. Role: Worker — Product & UI Squad.",
    meta: { role: "worker", squad: "product-ui" },
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<EventSeverity, { label: string; dot: string; badge: string; text: string }> = {
  info:    { label: "Info",    dot: "bg-indigo-500",  badge: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/25", text: "text-indigo-300" },
  success: { label: "Success", dot: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25", text: "text-emerald-300" },
  warning: { label: "Warning", dot: "bg-amber-500",   badge: "bg-amber-500/15 text-amber-300 ring-amber-500/25", text: "text-amber-300" },
  error:   { label: "Error",   dot: "bg-rose-500",    badge: "bg-rose-500/15 text-rose-300 ring-rose-500/25", text: "text-rose-300" },
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  auth: "Auth", agent: "Agent", session: "Session", cron: "Cron",
  api: "API", file: "File", node: "Node", billing: "Billing", system: "System",
};

const ACTOR_KIND_LABELS: Record<AuditEvent["actorKind"], { label: string; color: string }> = {
  agent:  { label: "Agent",  color: "text-indigo-300" },
  user:   { label: "User",   color: "text-emerald-300" },
  system: { label: "System", color: "text-fg-secondary" },
  api:    { label: "API",    color: "text-amber-300" },
};

const RESULT_CONFIG: Record<AuditEvent["result"], { label: string; color: string }> = {
  success: { label: "Success", color: "text-emerald-400" },
  failure: { label: "Failure", color: "text-rose-400" },
  partial: { label: "Partial", color: "text-amber-400" },
};

// ─── Helper: format timestamp ─────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function fmtFull(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) {return `${Math.floor(diff / 1000)}s ago`;}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(events: AuditEvent[]): void {
  const header = ["id", "timestamp", "severity", "category", "actor", "actorKind", "action", "resource", "result", "duration_ms", "ip", "detail"].join(",");
  const rows = events.map((e) =>
    [
      e.id,
      e.timestamp.toISOString(),
      e.severity,
      e.category,
      e.actor,
      e.actorKind,
      e.action,
      e.resource,
      e.result,
      e.duration ?? "",
      e.ip ?? "",
      `"${e.detail.replace(/"/g, '""')}"`,
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SeverityBadgeProps { severity: EventSeverity; }
function SeverityBadge({ severity }: SeverityBadgeProps) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ring-1", cfg.badge)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

interface CategoryBadgeProps { category: EventCategory; }
function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-mono font-medium rounded bg-surface-2 text-fg-secondary border border-tok-border">
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  event: AuditEvent;
  onClose: () => void;
}

function DetailPanel({ event, onClose }: DetailPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {onClose();}
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const sev = SEVERITY_CONFIG[event.severity];
  const actor = ACTOR_KIND_LABELS[event.actorKind];
  const result = RESULT_CONFIG[event.result];

  return (
    <div className="flex flex-col h-full bg-surface-1 border-l border-tok-border">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-tok-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={event.severity} />
            <CategoryBadge category={event.category} />
          </div>
          <p className="mt-2 text-sm font-semibold text-fg-primary leading-snug">{event.detail}</p>
          <p className="mt-1 text-xs text-fg-muted font-mono">{event.action}</p>
        </div>
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close detail panel"
          className="flex-none p-1.5 rounded-md text-fg-secondary hover:text-fg-primary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Meta grid */}
      <div className="px-5 py-4 border-b border-tok-border">
        <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Event Details</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {[
            { label: "Event ID",   value: event.id,           mono: true },
            { label: "Timestamp",  value: fmtFull(event.timestamp), mono: true },
            { label: "Actor",      value: event.actor,        mono: true },
            { label: "Actor Kind", value: actor.label,        color: actor.color },
            { label: "Resource",   value: event.resource,     mono: true },
            { label: "Result",     value: result.label,       color: result.color },
            ...(event.duration !== undefined ? [{ label: "Duration", value: `${event.duration.toLocaleString()}ms`, mono: true }] : []),
            ...(event.ip ? [{ label: "IP Address", value: event.ip, mono: true }] : []),
          ].map(({ label, value, mono, color }) => (
            <div key={label}>
              <dt className="text-xs text-fg-muted">{label}</dt>
              <dd className={cn("mt-0.5 text-xs break-all", mono ? "font-mono text-fg-primary" : "font-medium", color ?? "text-fg-primary")}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Metadata */}
      {event.meta && Object.keys(event.meta).length > 0 && (
        <div className="px-5 py-4">
          <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Metadata</h3>
          <div className="rounded-lg bg-surface-0 border border-tok-border divide-y divide-tok-border">
            {Object.entries(event.meta).map(([k, v]) => (
              <div key={k} className="flex items-center px-3 py-2 gap-3">
                <span className="text-xs font-mono text-indigo-400 flex-none">{k}</span>
                <span className="text-xs font-mono text-fg-secondary truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

function AuditLogSkeleton() {
  return (
    <div className="flex flex-col md:flex-row h-full bg-surface-0 text-fg-primary overflow-hidden">
      {/* Left: filter + list */}
      <div className="md:w-[480px] flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-tok-border overflow-hidden">
        {/* Header bar */}
        <div className="p-4 border-b border-tok-border flex items-center justify-between">
          <Skeleton variant="text" className="h-5 w-20" />
          <div className="flex gap-2">
            <Skeleton variant="rect" className="h-7 w-16 rounded" />
            <Skeleton variant="rect" className="h-7 w-16 rounded" />
          </div>
        </div>
        {/* Filters */}
        <div className="px-3 py-2 border-b border-tok-border space-y-2">
          <Skeleton variant="rect" className="h-8 w-full rounded-lg" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-6 w-16 rounded" />
            ))}
          </div>
        </div>
        {/* Log rows */}
        <div className="flex-1 divide-y divide-tok-border overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <Skeleton variant="circle" className="w-2 h-2 mt-1.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton variant="rect" className="h-4 w-14 rounded" />
                  <Skeleton variant="text" className="h-3.5 w-32" />
                  <div className="ml-auto">
                    <Skeleton variant="text" className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton variant="text" className="h-3 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton variant="text" className="h-3 w-20" />
                  <Skeleton variant="text" className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Right: detail */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <Skeleton variant="circle" className="w-12 h-12 mx-auto" />
          <Skeleton variant="text" className="h-4 w-32 mx-auto" />
          <Skeleton variant="text" className="h-3 w-48 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export default function AuditLog({ isLoading = false }: { isLoading?: boolean }) {
  const [events] = useState<AuditEvent[]>(SEED_EVENTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "all">("all");
  const [resultFilter, setResultFilter] = useState<AuditEvent["result"] | "all">("all");
  const [actorKindFilter, setActorKindFilter] = useState<AuditEvent["actorKind"] | "all">("all");
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd+F focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const filtered = events.filter((e) => {
    if (severityFilter !== "all" && e.severity !== severityFilter) {return false;}
    if (categoryFilter !== "all" && e.category !== categoryFilter) {return false;}
    if (resultFilter !== "all" && e.result !== resultFilter) {return false;}
    if (actorKindFilter !== "all" && e.actorKind !== actorKindFilter) {return false;}
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        e.detail.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.resource.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedEvent = selectedId ? events.find((e) => e.id === selectedId) ?? null : null;

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleCloseDetail = useCallback(() => setSelectedId(null), []);
  const handleExport = useCallback(() => exportCSV(filtered), [filtered]);

  // Stats
  const stats = {
    total: filtered.length,
    errors: filtered.filter((e) => e.severity === "error").length,
    warnings: filtered.filter((e) => e.severity === "warning").length,
    failures: filtered.filter((e) => e.result === "failure").length,
  };

  if (isLoading) return <AuditLogSkeleton />;

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Header */}
      <div className="flex-none px-3 sm:px-4 md:px-6 py-4 border-b border-tok-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-fg-primary">Audit Log</h1>
            <p className="text-sm text-fg-muted mt-0.5">
              Complete record of all system events, API calls, and configuration changes
            </p>
          </div>
          <button
            onClick={handleExport}
            aria-label="Export filtered audit log as CSV"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-surface-2 text-fg-primary hover:bg-surface-3 hover:text-fg-primary border border-tok-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v8m0 0l-2.5-2.5M8 10l2.5-2.5M3 13h10" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {[
            { label: "Total", value: stats.total, color: "text-fg-primary" },
            { label: "Errors", value: stats.errors, color: stats.errors > 0 ? "text-rose-400" : "text-fg-muted" },
            { label: "Warnings", value: stats.warnings, color: stats.warnings > 0 ? "text-amber-400" : "text-fg-muted" },
            { label: "Failures", value: stats.failures, color: stats.failures > 0 ? "text-rose-400" : "text-fg-muted" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn("text-sm font-semibold tabular-nums", color)}>{value}</span>
              <span className="text-xs text-fg-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex-none px-3 sm:px-4 md:px-6 py-3 border-b border-tok-border flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fg-muted pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="7" cy="7" r="4.5" /><path strokeLinecap="round" d="M10.5 10.5l3 3" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events… (⌘F)"
            aria-label="Search audit events"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface-1 border border-tok-border rounded-lg text-fg-primary placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Severity filter */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as EventSeverity | "all")}
          aria-label="Filter by severity"
          className="py-1.5 pl-2 pr-6 text-sm bg-surface-1 border border-tok-border rounded-lg text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
        >
          <option value="all">All Severity</option>
          {(["info", "success", "warning", "error"] as EventSeverity[]).map((s) => (
            <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
          ))}
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as EventCategory | "all")}
          aria-label="Filter by category"
          className="py-1.5 pl-2 pr-6 text-sm bg-surface-1 border border-tok-border rounded-lg text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
        >
          <option value="all">All Categories</option>
          {(Object.keys(CATEGORY_LABELS) as EventCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>

        {/* Result filter */}
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value as AuditEvent["result"] | "all")}
          aria-label="Filter by result"
          className="py-1.5 pl-2 pr-6 text-sm bg-surface-1 border border-tok-border rounded-lg text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
        >
          <option value="all">All Results</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="partial">Partial</option>
        </select>

        {/* Actor kind filter */}
        <select
          value={actorKindFilter}
          onChange={(e) => setActorKindFilter(e.target.value as AuditEvent["actorKind"] | "all")}
          aria-label="Filter by actor type"
          className="py-1.5 pl-2 pr-6 text-sm bg-surface-1 border border-tok-border rounded-lg text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
        >
          <option value="all">All Actors</option>
          <option value="agent">Agent</option>
          <option value="user">User</option>
          <option value="system">System</option>
          <option value="api">API Key</option>
        </select>

        {/* Clear */}
        {(search || severityFilter !== "all" || categoryFilter !== "all" || resultFilter !== "all" || actorKindFilter !== "all") && (
          <button
            onClick={() => { setSearch(""); setSeverityFilter("all"); setCategoryFilter("all"); setResultFilter("all"); setActorKindFilter("all"); }}
            aria-label="Clear all filters"
            className="text-xs text-indigo-400 hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded transition-colors px-1"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Body: event list + detail panel */}
      <div className="flex flex-1 min-h-0">
        {/* Event list */}
        <div
          role="listbox"
          aria-label="Audit events"
          aria-multiselectable="false"
          className={cn("flex flex-col overflow-y-auto", selectedEvent ? "w-1/2" : "w-full")}
        >
          {filtered.length === 0 && (
            <ContextualEmptyState
              icon={FileSearch}
              title="Nothing in the log yet"
              description="Audit events appear as agents act. Try adjusting your search or clearing filters."
            />
          )}

          {filtered.map((event) => {
            const sev = SEVERITY_CONFIG[event.severity];
            const actor = ACTOR_KIND_LABELS[event.actorKind];
            const result = RESULT_CONFIG[event.result];
            const isSelected = event.id === selectedId;

            return (
              <button
                key={event.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(event.id)}
                className={cn(
                  "flex items-start gap-3 w-full text-left px-5 py-3 border-b border-tok-border/70 transition-colors group",
                  "hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
                  isSelected && "bg-surface-1 ring-1 ring-inset ring-indigo-500/40"
                )}
              >
                {/* Severity dot */}
                <div className="flex-none mt-1.5">
                  <span className={cn("block h-2 w-2 rounded-full", sev.dot)} />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-fg-muted">{fmt(event.timestamp)}</span>
                    <CategoryBadge category={event.category} />
                    <span className={cn("text-xs font-mono", actor.color)}>{event.actor}</span>
                    <span className={cn("text-xs font-medium", result.color)}>{result.label}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-fg-primary leading-snug truncate">{event.detail}</p>
                  <p className="mt-0.5 text-xs font-mono text-fg-muted">{event.action} → {event.resource}</p>
                </div>

                {/* Right: rel time + duration */}
                <div className="flex-none text-right">
                  <p className="text-xs text-fg-muted">{relTime(event.timestamp)}</p>
                  {event.duration !== undefined && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{event.duration.toLocaleString()}ms</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        {selectedEvent && (
          <div className="w-1/2 flex-none overflow-y-auto">
            <DetailPanel event={selectedEvent} onClose={handleCloseDetail} />
          </div>
        )}
      </div>
    </div>
  );
}
