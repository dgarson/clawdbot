import React, { useState, useMemo, useCallback } from "react";
import { Gauge } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";

// ─── Types ───────────────────────────────────────────────────────────────────

type LimitScope = "agent" | "model" | "user" | "global";
type LimitStatus = "ok" | "warning" | "throttled" | "blocked";
type TimeWindow = "1m" | "5m" | "1h" | "24h";

interface RateLimit {
  id: string;
  name: string;
  scope: LimitScope;
  scopeId: string;
  status: LimitStatus;
  limit: number;
  used: number;
  unit: "requests" | "tokens" | "sessions";
  window: TimeWindow;
  resetAt: string; // ISO
  description: string;
  throttleThreshold: number; // % at which warning kicks in (e.g. 80)
}

interface ThrottleEvent {
  id: string;
  timestamp: string;
  limitId: string;
  limitName: string;
  scope: LimitScope;
  scopeId: string;
  used: number;
  limit: number;
  duration: number; // ms throttle applied
  reason: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const LIMITS: RateLimit[] = [
  // Global
  {
    id: "gl-req",      name: "Global Requests",          scope: "global", scopeId: "system",
    status: "ok",      limit: 10000, used: 3847,        unit: "requests", window: "1h",
    resetAt: "2026-02-22T02:00:00Z", description: "Total API requests across all agents per hour",
    throttleThreshold: 80,
  },
  {
    id: "gl-tok",      name: "Global Tokens",            scope: "global", scopeId: "system",
    status: "warning", limit: 5000000, used: 4312000,  unit: "tokens",   window: "1h",
    resetAt: "2026-02-22T02:00:00Z", description: "Total tokens consumed across all models per hour",
    throttleThreshold: 80,
  },
  // Per-model
  {
    id: "mdl-sonnet",  name: "Claude Sonnet 4.6",        scope: "model",  scopeId: "claude-sonnet-4-6",
    status: "warning", limit: 2000000, used: 1780000,  unit: "tokens",   window: "1h",
    resetAt: "2026-02-22T02:00:00Z", description: "Token budget for Claude Sonnet 4.6",
    throttleThreshold: 80,
  },
  {
    id: "mdl-opus",    name: "Claude Opus 4.6",          scope: "model",  scopeId: "claude-opus-4-6",
    status: "ok",      limit: 500000,  used: 87000,    unit: "tokens",   window: "1h",
    resetAt: "2026-02-22T02:00:00Z", description: "Token budget for Claude Opus 4.6",
    throttleThreshold: 80,
  },
  {
    id: "mdl-flash",   name: "Gemini 3 Flash",           scope: "model",  scopeId: "gemini-3-flash",
    status: "throttled", limit: 3000000, used: 3000000, unit: "tokens",  window: "1h",
    resetAt: "2026-02-22T02:00:00Z", description: "Token budget for Gemini 3 Flash (provider limit reached)",
    throttleThreshold: 80,
  },
  {
    id: "mdl-gpt4o",   name: "GPT-4o",                  scope: "model",  scopeId: "gpt-4o",
    status: "ok",      limit: 1000000, used: 234000,   unit: "tokens",   window: "1h",
    resetAt: "2026-02-22T02:00:00Z", description: "Token budget for GPT-4o",
    throttleThreshold: 80,
  },
  // Per-agent
  {
    id: "ag-luis",     name: "Luis (UX Lead)",           scope: "agent",  scopeId: "luis",
    status: "ok",      limit: 500,     used: 89,        unit: "requests", window: "1h",
    resetAt: "2026-02-22T02:00:00Z", description: "Request quota for agent: Luis",
    throttleThreshold: 75,
  },
  {
    id: "ag-xavier",   name: "Xavier (CTO)",             scope: "agent",  scopeId: "xavier",
    status: "ok",      limit: 500,     used: 31,        unit: "requests", window: "1h",
    resetAt: "2026-02-22T02:00:00Z", description: "Request quota for agent: Xavier",
    throttleThreshold: 75,
  },
  {
    id: "ag-stephan",  name: "Stephan (CMO)",            scope: "agent",  scopeId: "stephan",
    status: "ok",      limit: 300,     used: 12,        unit: "requests", window: "1h",
    resetAt: "2026-02-22T02:00:00Z", description: "Request quota for agent: Stephan",
    throttleThreshold: 75,
  },
  {
    id: "ag-piper",    name: "Piper (UI)",               scope: "agent",  scopeId: "piper",
    status: "warning", limit: 300,     used: 254,       unit: "requests", window: "1h",
    resetAt: "2026-02-22T02:00:00Z", description: "Request quota for agent: Piper",
    throttleThreshold: 75,
  },
  {
    id: "ag-wes",      name: "Wes (Performance)",        scope: "agent",  scopeId: "wes",
    status: "ok",      limit: 300,     used: 78,        unit: "requests", window: "1h",
    resetAt: "2026-02-22T02:00:00Z", description: "Request quota for agent: Wes",
    throttleThreshold: 75,
  },
  // Per-session
  {
    id: "sess-max",    name: "Concurrent Sessions",      scope: "user",   scopeId: "david",
    status: "ok",      limit: 20,      used: 7,          unit: "sessions", window: "1m",
    resetAt: "2026-02-22T01:21:00Z", description: "Max concurrent agent sessions for workspace owner",
    throttleThreshold: 70,
  },
];

const THROTTLE_EVENTS: ThrottleEvent[] = [
  { id: "te-1", timestamp: "2026-02-22T00:47:12Z", limitId: "mdl-flash", limitName: "Gemini 3 Flash",   scope: "model", scopeId: "gemini-3-flash",   used: 3000000, limit: 3000000, duration: 45000, reason: "Provider token limit reached — hourly cap exhausted" },
  { id: "te-2", timestamp: "2026-02-22T00:31:05Z", limitId: "ag-piper",  limitName: "Piper (UI)",       scope: "agent", scopeId: "piper",             used: 287,     limit: 300,     duration: 2000,  reason: "Agent request quota at 96% — brief backoff applied" },
  { id: "te-3", timestamp: "2026-02-22T00:15:33Z", limitId: "gl-tok",    limitName: "Global Tokens",    scope: "global", scopeId: "system",           used: 4800000, limit: 5000000, duration: 10000, reason: "Global hourly token budget over 96% — throttling burst traffic" },
  { id: "te-4", timestamp: "2026-02-21T23:58:44Z", limitId: "mdl-flash", limitName: "Gemini 3 Flash",   scope: "model", scopeId: "gemini-3-flash",   used: 3000000, limit: 3000000, duration: 3600000, reason: "Hourly token limit hit — all requests queued until reset" },
  { id: "te-5", timestamp: "2026-02-21T23:22:17Z", limitId: "ag-piper",  limitName: "Piper (UI)",       scope: "agent", scopeId: "piper",             used: 299,     limit: 300,     duration: 1500,  reason: "Agent at limit — request delayed" },
  { id: "te-6", timestamp: "2026-02-21T22:11:08Z", limitId: "mdl-sonnet", limitName: "Claude Sonnet 4.6", scope: "model", scopeId: "claude-sonnet-4-6", used: 2000000, limit: 2000000, duration: 8000, reason: "Model token limit hit — switching to fallback model" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<LimitStatus, string> = {
  ok: "OK",
  warning: "Warning",
  throttled: "Throttled",
  blocked: "Blocked",
};

const STATUS_COLORS: Record<LimitStatus, string> = {
  ok: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  warning: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  throttled: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  blocked: "text-red-400 bg-red-400/10 border-red-400/20",
};

const STATUS_DOT: Record<LimitStatus, string> = {
  ok: "bg-emerald-400",
  warning: "bg-amber-400",
  throttled: "bg-rose-400",
  blocked: "bg-red-400",
};

const SCOPE_LABELS: Record<LimitScope, string> = {
  agent: "Agent",
  model: "Model",
  user: "User",
  global: "Global",
};

const WINDOW_LABELS: Record<TimeWindow, string> = {
  "1m": "per minute",
  "5m": "per 5 min",
  "1h": "per hour",
  "24h": "per day",
};

function pct(used: number, limit: number): number {
  return Math.min(100, Math.round((used / limit) * 100));
}

function fmtNum(n: number): string {
  if (n >= 1000000) {return `${(n / 1000000).toFixed(1)}M`;}
  if (n >= 1000) {return `${(n / 1000).toFixed(0)}K`;}
  return String(n);
}

function fmtMs(ms: number): string {
  if (ms >= 3600000) {return `${(ms / 3600000).toFixed(0)}h`;}
  if (ms >= 60000) {return `${(ms / 60000).toFixed(0)}m`;}
  if (ms >= 1000) {return `${(ms / 1000).toFixed(0)}s`;}
  return `${ms}ms`;
}

function barColor(p: number): string {
  if (p >= 100) {return "bg-rose-500";}
  if (p >= 80)  {return "bg-amber-400";}
  return "bg-emerald-400";
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {return "just now";}
  if (mins < 60) {return `${mins}m ago`;}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {return `${hrs}h ago`;}
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UsageBar({ used, limit, threshold }: { used: number; limit: number; threshold: number }) {
  const p = pct(used, limit);
  return (
    <div className="relative h-2 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden">
      {/* Threshold marker */}
      <div
        className="absolute top-0 bottom-0 w-px bg-[var(--color-surface-3)] z-10"
        style={{ left: `${threshold}%` }}
        aria-hidden="true"
      />
      {/* Bar */}
      <div
        className={cn("h-full rounded-full transition-all", barColor(p))}
        style={{ width: `${p}%` }}
        role="presentation"
      />
    </div>
  );
}

interface LimitCardProps {
  limit: RateLimit;
}

function LimitCard({ limit }: LimitCardProps) {
  const p = pct(limit.used, limit.limit);

  return (
    <div
      className={cn(
        "rounded-xl border bg-[var(--color-surface-1)] p-4",
        limit.status === "throttled" || limit.status === "blocked"
          ? "border-rose-500/30"
          : limit.status === "warning"
          ? "border-amber-400/30"
          : "border-[var(--color-border)]"
      )}
      role="article"
      aria-label={`${limit.name} rate limit`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{limit.name}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{limit.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", STATUS_COLORS[limit.status])}>
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[limit.status])} aria-hidden="true" />
            {STATUS_LABELS[limit.status]}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{SCOPE_LABELS[limit.scope]}</span>
        </div>
      </div>

      <UsageBar used={limit.used} limit={limit.limit} threshold={limit.throttleThreshold} />

      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-[var(--color-text-secondary)]">
          <span className="font-mono font-semibold text-[var(--color-text-primary)]">{fmtNum(limit.used)}</span>
          {" / "}
          <span className="font-mono text-[var(--color-text-muted)]">{fmtNum(limit.limit)}</span>
          {" "}
          <span className="text-[var(--color-text-muted)]">{limit.unit}</span>
        </span>
        <div className="flex items-center gap-3">
          <span className={cn("font-mono font-bold", p >= 100 ? "text-rose-400" : p >= 80 ? "text-amber-400" : "text-[var(--color-text-primary)]")}>
            {p}%
          </span>
          <span className="text-[var(--color-text-muted)]">{WINDOW_LABELS[limit.window]}</span>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-[var(--color-text-muted)]">
        Resets at {new Date(limit.resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type TabId = "limits" | "history";
type ScopeFilter = LimitScope | "all";

export default function RateLimitDashboard() {
  const [tab, setTab] = useState<TabId>("limits");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<LimitStatus | "all">("all");

  const filteredLimits = useMemo(() => {
    return LIMITS.filter(l => {
      if (scopeFilter !== "all" && l.scope !== scopeFilter) {return false;}
      if (statusFilter !== "all" && l.status !== statusFilter) {return false;}
      return true;
    });
  }, [scopeFilter, statusFilter]);

  const counts = useMemo(() => ({
    ok:        LIMITS.filter(l => l.status === "ok").length,
    warning:   LIMITS.filter(l => l.status === "warning").length,
    throttled: LIMITS.filter(l => l.status === "throttled").length,
    blocked:   LIMITS.filter(l => l.status === "blocked").length,
  }), []);

  const tabs: Array<{ id: TabId; label: string; emoji: string }> = [
    { id: "limits",  label: "Active Limits",    emoji: "⚡" },
    { id: "history", label: "Throttle History",  emoji: "📋" },
  ];

  const scopes: Array<{ value: ScopeFilter; label: string }> = [
    { value: "all",    label: "All Scopes" },
    { value: "global", label: "Global" },
    { value: "model",  label: "Model" },
    { value: "agent",  label: "Agent" },
    { value: "user",   label: "User" },
  ];

  const statuses: Array<{ value: LimitStatus | "all"; label: string }> = [
    { value: "all",      label: "All" },
    { value: "ok",       label: "OK" },
    { value: "warning",  label: "Warning" },
    { value: "throttled", label: "Throttled" },
  ];

  const handleResetLimit = useCallback((id: string) => {
    // In production this would call the gateway API
    console.log("Reset limit:", id);
  }, []);

  return (
    <main className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden" role="main" aria-label="Rate Limit Dashboard">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Rate Limits</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Monitor and manage request quotas across agents, models, and system</p>
          </div>
          {/* Status summary */}
          <div className="flex items-center gap-4 text-xs">
            {[
              { label: "OK",        count: counts.ok,       color: "text-emerald-400" },
              { label: "Warning",   count: counts.warning,  color: "text-amber-400" },
              { label: "Throttled", count: counts.throttled, color: "text-rose-400" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={cn("text-xl font-bold font-mono", s.color)}>{s.count}</p>
                <p className="text-[var(--color-text-muted)]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4" role="tablist" aria-label="Rate limit views">
          {tabs.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`tabpanel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm transition-colors",
                "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                tab === t.id
                  ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6" role="tabpanel" id={`tabpanel-${tab}`}>
        {tab === "limits" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-1.5" role="group" aria-label="Filter by scope">
                {scopes.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setScopeFilter(s.value)}
                    aria-pressed={scopeFilter === s.value}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                      scopeFilter === s.value
                        ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-[var(--color-surface-3)]" aria-hidden="true" />
              <div className="flex items-center gap-1.5" role="group" aria-label="Filter by status">
                {statuses.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setStatusFilter(s.value)}
                    aria-pressed={statusFilter === s.value}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                      statusFilter === s.value
                        ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[var(--color-text-muted)] ml-auto">
                Showing {filteredLimits.length} of {LIMITS.length} limits
              </span>
            </div>

            {/* Grid */}
            {filteredLimits.length === 0 ? (
              <ContextualEmptyState
                icon={Gauge}
                title="Nothing matches those filters"
                description="Try a different scope or status — your limits are in there somewhere."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredLimits.map(limit => (
                  <LimitCard key={limit.id} limit={limit} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          <div className="rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Throttle Events</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Recent rate limit interventions — last 24 hours</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">{THROTTLE_EVENTS.length} events</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {THROTTLE_EVENTS.map(ev => (
                <div key={ev.id} className="p-4 hover:bg-[var(--color-surface-2)]/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border text-rose-400 bg-rose-400/10 border-rose-400/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" aria-hidden="true" />
                          Throttled
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)] capitalize">{SCOPE_LABELS[ev.scope]} · {ev.scopeId}</span>
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{ev.limitName}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">{ev.reason}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs font-mono">
                        <span className="text-[var(--color-text-secondary)]">
                          {fmtNum(ev.used)} / {fmtNum(ev.limit)} {" "}
                          <span className="text-rose-400 font-semibold">({pct(ev.used, ev.limit)}%)</span>
                        </span>
                        <span className="text-[var(--color-text-muted)]">Duration: {fmtMs(ev.duration)}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--color-text-muted)] shrink-0">
                      <p>{relTime(ev.timestamp)}</p>
                      <p className="text-[var(--color-text-muted)] mt-0.5">
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
