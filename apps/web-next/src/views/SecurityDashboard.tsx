import React, { useState, useCallback, useEffect } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ThreatLevel = "critical" | "high" | "medium" | "low" | "info";
type BlockedStatus = "active" | "expired" | "manual";

interface SecurityEvent {
  id: string;
  timestamp: Date;
  threatLevel: ThreatLevel;
  type: string;
  description: string;
  ip?: string;
  actor?: string;
  attempts?: number;
  resolved: boolean;
  country?: string;
}

interface BlockedIP {
  id: string;
  ip: string;
  country: string;
  reason: string;
  blockedAt: Date;
  expiresAt?: Date;
  status: BlockedStatus;
  attempts: number;
}

interface SecurityScore {
  overall: number;      // 0-100
  authentication: number;
  apiSecurity: number;
  networkSecurity: number;
  dataProtection: number;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const future = (ms: number) => new Date(now.getTime() + ms);
const mins = (n: number) => n * 60_000;
const hrs = (n: number) => n * 3_600_000;
const days = (n: number) => n * 86_400_000;

const SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: "se1",
    timestamp: ago(hrs(4)),
    threatLevel: "high",
    type: "Brute Force Attempt",
    description: "3 invalid API token attempts from a single IP within 60 seconds.",
    ip: "198.51.100.44",
    actor: "api:unknown",
    attempts: 3,
    resolved: false,
    country: "RU",
  },
  {
    id: "se2",
    timestamp: ago(hrs(2)),
    threatLevel: "medium",
    type: "Budget Threshold",
    description: "Daily token budget at 87% — claude-opus-4-6. Potential runaway agent.",
    actor: "system",
    attempts: 1,
    resolved: false,
    country: undefined,
  },
  {
    id: "se3",
    timestamp: ago(mins(34)),
    threatLevel: "medium",
    type: "Scope Violation",
    description: "API key oc_sk_dev_3a9b attempted sessions:write without permission.",
    ip: "192.168.1.44",
    actor: "api:oc_sk_dev_3a9b",
    attempts: 1,
    resolved: true,
    country: "US",
  },
  {
    id: "se4",
    timestamp: ago(days(1) + hrs(3)),
    threatLevel: "low",
    type: "Unusual Access Time",
    description: "API key oc_sk_prod_7f2a used at 3:47 AM — outside normal hours.",
    ip: "203.0.113.12",
    actor: "api:oc_sk_prod_7f2a",
    attempts: 1,
    resolved: true,
    country: "US",
  },
  {
    id: "se5",
    timestamp: ago(days(2)),
    threatLevel: "info",
    type: "New Device Login",
    description: "David signed in from a new browser (Safari/19) for the first time.",
    ip: "10.0.1.5",
    actor: "user:david",
    attempts: 1,
    resolved: true,
    country: "US",
  },
  {
    id: "se6",
    timestamp: ago(days(3)),
    threatLevel: "critical",
    type: "Key Exposure Risk",
    description: "API key pattern detected in a pushed GitHub commit (now rolled back).",
    actor: "user:david",
    attempts: 1,
    resolved: true,
    country: "US",
  },
];

const BLOCKED_IPS: BlockedIP[] = [
  {
    id: "bi1",
    ip: "198.51.100.44",
    country: "RU",
    reason: "Brute force — 3 invalid token attempts",
    blockedAt: ago(hrs(4)),
    expiresAt: future(hrs(20)),
    status: "active",
    attempts: 3,
  },
  {
    id: "bi2",
    ip: "203.0.113.99",
    country: "CN",
    reason: "Port scanning detected",
    blockedAt: ago(days(2)),
    expiresAt: ago(hrs(4)),
    status: "expired",
    attempts: 47,
  },
  {
    id: "bi3",
    ip: "192.0.2.55",
    country: "KP",
    reason: "Manually blocked — suspicious reconnaissance",
    blockedAt: ago(days(5)),
    status: "manual",
    attempts: 2,
  },
];

const SECURITY_SCORE: SecurityScore = {
  overall: 82,
  authentication: 91,
  apiSecurity: 78,
  networkSecurity: 84,
  dataProtection: 88,
};

// 30-day threat timeline (daily counts)
const THREAT_HISTORY = [2, 0, 1, 3, 0, 0, 1, 2, 4, 1, 0, 2, 1, 0, 0, 3, 1, 0, 2, 1, 0, 0, 1, 2, 3, 0, 1, 4, 2, 1];
const DAY_LABELS_30 = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(now.getTime() - (29 - i) * days(1));
  return d.getDate().toString();
});

// ─── Constants ────────────────────────────────────────────────────────────────

const THREAT_CONFIG: Record<ThreatLevel, { label: string; dot: string; badge: string; text: string }> = {
  critical: { label: "Critical", dot: "bg-rose-500",   badge: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25",     text: "text-rose-400" },
  high:     { label: "High",     dot: "bg-orange-500", badge: "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/25", text: "text-orange-400" },
  medium:   { label: "Medium",   dot: "bg-amber-500",  badge: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25",   text: "text-amber-400" },
  low:      { label: "Low",      dot: "bg-primary", badge: "bg-primary/15 text-indigo-300 ring-1 ring-indigo-500/25", text: "text-primary" },
  info:     { label: "Info",     dot: "bg-[var(--color-surface-3)]",   badge: "bg-[var(--color-surface-3)]/15 text-[var(--color-text-secondary)] ring-1 ring-zinc-500/25",       text: "text-[var(--color-text-secondary)]" },
};

const BLOCKED_STATUS_CONFIG: Record<BlockedStatus, { label: string; badge: string }> = {
  active:  { label: "Active",  badge: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25" },
  expired: { label: "Expired", badge: "bg-[var(--color-surface-3)]/50 text-[var(--color-text-muted)] ring-1 ring-zinc-600/25" },
  manual:  { label: "Manual",  badge: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 0) {return "in future";}
  if (diff < 60_000) {return "just now";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function fmtExpiry(d: Date | undefined): string {
  if (!d) {return "Never";}
  const diff = d.getTime() - Date.now();
  if (diff < 0) {return "Expired";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m remaining`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h remaining`;}
  return `${Math.floor(diff / 86_400_000)}d remaining`;
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative flex items-center justify-center h-28 w-28" aria-label={`Security score: ${score}/100`}>
      <svg className="absolute" width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="#27272a" strokeWidth="10" />
        <circle
          cx="56" cy="56" r={radius}
          fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 56 56)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="text-center">
        <p className="text-2xl font-bold text-[var(--color-text-primary)]">{score}</p>
        <p className="text-xs text-[var(--color-text-muted)]">/ 100</p>
      </div>
    </div>
  );
}

// ─── 30-day threat chart ──────────────────────────────────────────────────────

function ThreatChart() {
  const max = Math.max(...THREAT_HISTORY);
  const H = 48;
  const barW = 8;
  const gap = 2;

  return (
    <div>
      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">30-Day Threat Activity</p>
      <div className="flex items-end gap-px" aria-label="30-day threat history bar chart">
        {THREAT_HISTORY.map((v, i) => {
          const barH = max > 0 ? Math.max(2, (v / max) * H) : 2;
          const isToday = i === THREAT_HISTORY.length - 1;
          const color = v === 0 ? "bg-[var(--color-surface-2)]" : v >= 3 ? "bg-rose-500" : v >= 2 ? "bg-amber-500" : "bg-primary";
          return (
            <div
              key={i}
              className={cn("rounded-sm", color, isToday && "ring-1 ring-white/20")}
              style={{ width: barW, height: barH, minHeight: 2 }}
              title={`Day ${i + 1}: ${v} events`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-[var(--color-text-muted)]">30 days ago</span>
        <span className="text-xs text-[var(--color-text-muted)]">Today</span>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type Tab = "overview" | "events" | "blocked";
type EventFilter = ThreatLevel | "all" | "unresolved";

export default function SecurityDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>(BLOCKED_IPS);
  const [events, setEvents] = useState<SecurityEvent[]>(SECURITY_EVENTS);

  const filteredEvents = events.filter((e) => {
    if (eventFilter === "unresolved") {return !e.resolved;}
    if (eventFilter === "all") {return true;}
    return e.threatLevel === eventFilter;
  });

  const handleUnblock = useCallback((id: string) => {
    setBlockedIPs((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const handleResolve = useCallback((id: string) => {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, resolved: true } : e));
  }, []);

  const unresolvedCount = events.filter((e) => !e.resolved).length;
  const activeBlocks = blockedIPs.filter((b) => b.status === "active").length;

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "events",   label: "Events",  badge: unresolvedCount },
    { id: "blocked",  label: "Blocked IPs", badge: activeBlocks },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)]">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Security Dashboard</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Threat detection, blocked IPs, and security posture</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {unresolvedCount > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                {unresolvedCount} unresolved
              </span>
            )}
            <span className="text-[var(--color-text-muted)]">Last scan: just now</span>
          </div>
        </div>

        {/* Tab bar */}
        <div role="tablist" aria-label="Security sections" className="flex items-center gap-1 mt-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                tab === t.id ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)]"
              )}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-rose-500 text-[var(--color-text-primary)]">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="px-6 py-5 space-y-6">
            {/* Score section */}
            <div className="flex flex-col sm:flex-row items-start gap-6 p-5 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)]">
              <div className="flex flex-col items-center gap-2">
                <ScoreRing score={SECURITY_SCORE.overall} />
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Security Score</p>
                <p className="text-xs text-[var(--color-text-muted)] text-center">Good — a few improvements possible</p>
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Score Breakdown</p>
                {[
                  { label: "Authentication",   value: SECURITY_SCORE.authentication },
                  { label: "API Security",     value: SECURITY_SCORE.apiSecurity },
                  { label: "Network Security", value: SECURITY_SCORE.networkSecurity },
                  { label: "Data Protection",  value: SECURITY_SCORE.dataProtection },
                ].map(({ label, value }) => {
                  const color = value >= 85 ? "bg-emerald-500" : value >= 70 ? "bg-amber-500" : "bg-rose-500";
                  const textColor = value >= 85 ? "text-emerald-400" : value >= 70 ? "text-amber-400" : "text-rose-400";
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
                        <span className={cn("text-xs font-mono font-semibold tabular-nums", textColor)}>{value}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--color-surface-2)] rounded-full">
                        <div className={cn("h-1.5 rounded-full transition-all", color)} style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Unresolved Events",  value: unresolvedCount.toString(), color: unresolvedCount > 0 ? "text-rose-400" : "text-emerald-400" },
                { label: "Active Blocks",       value: activeBlocks.toString(),    color: activeBlocks > 0 ? "text-amber-400" : "text-[var(--color-text-primary)]" },
                { label: "Events (30d)",        value: THREAT_HISTORY.reduce((a, b) => a + b, 0).toString(), color: "text-[var(--color-text-primary)]" },
                { label: "Auth Failures (24h)", value: "4",                        color: "text-[var(--color-text-primary)]" },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-4 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
                  <p className={cn("text-2xl font-bold tabular-nums mt-1", color)}>{value}</p>
                </div>
              ))}
            </div>

            {/* 30-day chart */}
            <div className="p-5 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)]">
              <ThreatChart />
              <div className="flex items-center gap-4 mt-3">
                {[
                  { color: "bg-rose-500",   label: "≥3 events" },
                  { color: "bg-amber-500",  label: "2 events" },
                  { color: "bg-primary", label: "1 event" },
                  { color: "bg-[var(--color-surface-2)]",   label: "None" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={cn("h-2 w-4 rounded-sm", color)} />
                    <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent unresolved events */}
            {unresolvedCount > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Unresolved Events
                </p>
                <div className="space-y-2">
                  {events.filter((e) => !e.resolved).map((event) => {
                    const cfg = THREAT_CONFIG[event.threatLevel];
                    return (
                      <div key={event.id} className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)]">
                        <span className={cn("flex-none h-2 w-2 rounded-full mt-1.5", cfg.dot)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full ring-1", cfg.badge)}>{cfg.label}</span>
                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{event.type}</span>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{event.description}</p>
                          <p className="text-xs text-[var(--color-text-muted)] mt-1">{relTime(event.timestamp)} {event.ip && `· ${event.ip}`} {event.country && `(${event.country})`}</p>
                        </div>
                        <button
                          onClick={() => handleResolve(event.id)}
                          aria-label={`Mark ${event.type} as resolved`}
                          className="flex-none py-1 px-2.5 text-xs font-medium rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                        >
                          Resolve
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* EVENTS */}
        {tab === "events" && (
          <div className="px-6 py-5">
            {/* Filter chips */}
            <div role="group" aria-label="Filter security events" className="flex flex-wrap gap-2 mb-4">
              {(["all", "unresolved", "critical", "high", "medium", "low", "info"] as EventFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setEventFilter(f)}
                  aria-pressed={eventFilter === f}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    eventFilter === f ? "bg-primary text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {f === "all" ? "All" : f === "unresolved" ? "Unresolved" : THREAT_CONFIG[f].label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredEvents.map((event) => {
                const cfg = THREAT_CONFIG[event.threatLevel];
                return (
                  <div key={event.id} className={cn("p-4 rounded-xl border transition-colors", event.resolved ? "bg-[var(--color-surface-1)] border-[var(--color-border)] opacity-60" : "bg-[var(--color-surface-1)] border-[var(--color-border)]")}>
                    <div className="flex items-start gap-3">
                      <span className={cn("flex-none h-2 w-2 rounded-full mt-1.5", cfg.dot)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full ring-1", cfg.badge)}>{cfg.label}</span>
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{event.type}</span>
                          {event.resolved && <span className="text-xs text-emerald-500">✓ Resolved</span>}
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">{event.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--color-text-muted)]">
                          <span>{relTime(event.timestamp)}</span>
                          {event.ip && <span>{event.ip}</span>}
                          {event.country && <span>({event.country})</span>}
                          {event.actor && <span className="font-mono">{event.actor}</span>}
                          {event.attempts && event.attempts > 1 && <span>{event.attempts} attempts</span>}
                        </div>
                      </div>
                      {!event.resolved && (
                        <button
                          onClick={() => handleResolve(event.id)}
                          aria-label="Mark as resolved"
                          className="flex-none py-1 px-2.5 text-xs font-medium rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:bg-emerald-600/20 hover:text-emerald-300 border border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <span className="text-3xl">✅</span>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">No events matching filter</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BLOCKED IPS */}
        {tab === "blocked" && (
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{blockedIPs.length} entries</p>
              <button
                aria-label="Block new IP address"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M7 2v10M2 7h10" /></svg>
                Block IP
              </button>
            </div>
            <div className="space-y-3">
              {blockedIPs.map((b) => {
                const cfg = BLOCKED_STATUS_CONFIG[b.status];
                return (
                  <div key={b.id} className={cn("p-4 rounded-xl border", b.status === "active" ? "bg-[var(--color-surface-1)] border-[var(--color-border)]" : "bg-[var(--color-surface-1)] border-[var(--color-border)] opacity-60")}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-mono font-semibold text-[var(--color-text-primary)]">{b.ip}</span>
                          <span className={cn("px-1.5 py-0.5 text-xs font-medium rounded-full", cfg.badge)}>{cfg.label}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">{b.country}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{b.reason}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                          <span>Blocked {relTime(b.blockedAt)}</span>
                          <span>·</span>
                          <span>{fmtExpiry(b.expiresAt)}</span>
                          <span>·</span>
                          <span>{b.attempts} attempt{b.attempts !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                      {b.status !== "expired" && (
                        <button
                          onClick={() => handleUnblock(b.id)}
                          aria-label={`Unblock ${b.ip}`}
                          className="flex-none py-1 px-2.5 text-xs font-medium rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-rose-400 border border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-colors"
                        >
                          Unblock
                        </button>
                      )}
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
