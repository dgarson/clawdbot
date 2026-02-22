import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type EventKind =
  | "commit"
  | "pr"
  | "deploy"
  | "alert"
  | "message"
  | "spawn"
  | "task"
  | "config-change"
  | "error";

type Squad =
  | "product-ui"
  | "platform-core"
  | "feature-dev"
  | "ops"
  | "leadership";

interface TimelineEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorEmoji: string;
  kind: EventKind;
  title: string;
  description: string;
  metadata: Record<string, string>;
  squad: Squad;
}

type TimeRange = "1h" | "6h" | "24h" | "7d";

// ── Constants ──────────────────────────────────────────────────────────────────

const KIND_COLORS: Record<EventKind, { dot: string; badge: string; bar: string }> = {
  commit:          { dot: "bg-emerald-500", badge: "bg-emerald-500/20 text-emerald-400", bar: "bg-emerald-500" },
  pr:              { dot: "bg-blue-500",    badge: "bg-blue-500/20 text-blue-400",       bar: "bg-blue-500" },
  deploy:          { dot: "bg-indigo-500",  badge: "bg-indigo-500/20 text-indigo-400",   bar: "bg-indigo-500" },
  alert:           { dot: "bg-rose-500",    badge: "bg-rose-500/20 text-rose-400",       bar: "bg-rose-500" },
  message:         { dot: "bg-purple-500",  badge: "bg-purple-500/20 text-purple-400",   bar: "bg-purple-500" },
  spawn:           { dot: "bg-amber-500",   badge: "bg-amber-500/20 text-amber-400",     bar: "bg-amber-500" },
  task:            { dot: "bg-zinc-500",    badge: "bg-zinc-500/20 text-zinc-400",       bar: "bg-zinc-500" },
  "config-change": { dot: "bg-orange-500", badge: "bg-orange-500/20 text-orange-400",   bar: "bg-orange-500" },
  error:           { dot: "bg-red-500",     badge: "bg-red-500/20 text-red-400",         bar: "bg-red-500" },
};

const KIND_LABELS: Record<EventKind, string> = {
  commit: "Commit", pr: "PR", deploy: "Deploy", alert: "Alert",
  message: "Message", spawn: "Spawn", task: "Task",
  "config-change": "Config", error: "Error",
};

const ALL_KINDS: EventKind[] = [
  "commit", "pr", "deploy", "alert", "message", "spawn", "task", "config-change", "error",
];

const SQUAD_LABELS: Record<Squad, string> = {
  "product-ui": "Product & UI",
  "platform-core": "Platform Core",
  "feature-dev": "Feature Dev",
  ops: "Ops",
  leadership: "Leadership",
};

const ALL_SQUADS: Squad[] = ["product-ui", "platform-core", "feature-dev", "ops", "leadership"];

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
];

// ── Seed Data ──────────────────────────────────────────────────────────────────

const EVENTS: TimelineEvent[] = [
  { id: "e01", timestamp: "2026-02-22T09:42:00Z", actor: "Piper", actorEmoji: "🔧", kind: "commit", title: "feat: add ActivityTimeline view scaffold", description: "Initial layout with sidebar filters, timeline rail, and density bar.", metadata: { branch: "piper/activity-timeline", repo: "clawdbot", files: "1" }, squad: "product-ui" },
  { id: "e02", timestamp: "2026-02-22T09:38:00Z", actor: "Xavier", actorEmoji: "🧠", kind: "message", title: "Horizon dashboard scope locked", description: "Confirmed six core views for MVP: Agents, Squads, Timeline, Metrics, Cost, Settings.", metadata: { channel: "#cb-product" }, squad: "leadership" },
  { id: "e03", timestamp: "2026-02-22T09:31:00Z", actor: "Roman", actorEmoji: "⚙️", kind: "deploy", title: "Gateway v2.14.0 → production", description: "Rolling deploy across 3 regions. Zero-downtime verified.", metadata: { version: "2.14.0", regions: "us-west,eu-west,ap-south", rollback: "v2.13.2" }, squad: "platform-core" },
  { id: "e04", timestamp: "2026-02-22T09:24:00Z", actor: "Nadia", actorEmoji: "🔍", kind: "alert", title: "Memory pressure on worker pool", description: "Worker RSS exceeding 1.2 GB threshold on 2 nodes.", metadata: { severity: "warning", nodes: "w-07,w-12", threshold: "1.2GB" }, squad: "ops" },
  { id: "e05", timestamp: "2026-02-22T09:18:00Z", actor: "Claire", actorEmoji: "🚀", kind: "pr", title: "PR #482: Streaming response chunking", description: "Implements backpressure-aware chunked transfer for large tool outputs.", metadata: { branch: "claire/stream-chunk", repo: "clawdbot", lines: "+342 / -89" }, squad: "feature-dev" },
  { id: "e06", timestamp: "2026-02-22T09:10:00Z", actor: "Luis", actorEmoji: "🎨", kind: "task", title: "Assign Horizon view components", description: "Distributed 6 dashboard views across Product & UI squad workers.", metadata: { assignees: "Piper,Quinn,Reed,Wes,Sam", views: "6" }, squad: "product-ui" },
  { id: "e07", timestamp: "2026-02-22T08:55:00Z", actor: "Joey", actorEmoji: "📋", kind: "spawn", title: "Spawned daily standup aggregator", description: "Collecting status from all squads for the 09:00 digest.", metadata: { target: "all-squads", timeout: "300s" }, squad: "leadership" },
  { id: "e08", timestamp: "2026-02-22T08:47:00Z", actor: "Tim", actorEmoji: "🏗️", kind: "config-change", title: "Updated ESLint strict-mode rules", description: "Enabled no-explicit-any and strict-boolean-expressions across monorepo.", metadata: { scope: "monorepo", rules: "no-explicit-any,strict-boolean-expressions" }, squad: "platform-core" },
  { id: "e09", timestamp: "2026-02-22T08:30:00Z", actor: "Sam", actorEmoji: "🔌", kind: "commit", title: "fix: API client retry backoff", description: "Exponential backoff now respects Retry-After headers from gateway.", metadata: { branch: "sam/retry-fix", repo: "clawdbot", files: "3" }, squad: "product-ui" },
  { id: "e10", timestamp: "2026-02-22T08:12:00Z", actor: "Wes", actorEmoji: "⚡", kind: "commit", title: "perf: virtualize agent list rendering", description: "Replaced naive map with windowed list; 60fps on 500+ agents.", metadata: { branch: "wes/virtual-list", repo: "clawdbot", fps: "60" }, squad: "product-ui" },
  { id: "e11", timestamp: "2026-02-22T07:58:00Z", actor: "Roman", actorEmoji: "⚙️", kind: "error", title: "Redis connection pool exhaustion", description: "Pool max reached during burst. Auto-scaled from 20→40 connections.", metadata: { severity: "critical", pool_before: "20", pool_after: "40" }, squad: "platform-core" },
  { id: "e12", timestamp: "2026-02-22T07:45:00Z", actor: "Reed", actorEmoji: "♿", kind: "pr", title: "PR #479: ARIA landmarks for dashboard", description: "Added role attributes and skip-nav links across all Horizon views.", metadata: { branch: "reed/aria-landmarks", repo: "clawdbot", lines: "+128 / -14" }, squad: "product-ui" },
  { id: "e13", timestamp: "2026-02-22T07:30:00Z", actor: "Quinn", actorEmoji: "🧩", kind: "commit", title: "feat: squad detail drill-down view", description: "Added expandable squad cards with member roster and recent activity.", metadata: { branch: "quinn/squad-detail", repo: "clawdbot", files: "2" }, squad: "product-ui" },
  { id: "e14", timestamp: "2026-02-22T07:02:00Z", actor: "Nadia", actorEmoji: "🔍", kind: "deploy", title: "Monitoring stack upgrade → Grafana 11", description: "Upgraded observability dashboards with new service-map topology view.", metadata: { version: "11.0.1", downtime: "0s" }, squad: "ops" },
  { id: "e15", timestamp: "2026-02-22T06:45:00Z", actor: "Amadeus", actorEmoji: "👑", kind: "message", title: "Q1 OKR checkpoint reminder", description: "All squad leads: submit OKR progress by EOD Friday.", metadata: { channel: "#cb-leadership", deadline: "2026-02-27" }, squad: "leadership" },
  { id: "e16", timestamp: "2026-02-21T22:15:00Z", actor: "Claire", actorEmoji: "🚀", kind: "commit", title: "feat: tool-call batching engine", description: "Batch up to 8 independent tool calls into a single parallel dispatch.", metadata: { branch: "claire/batch-tools", repo: "clawdbot", files: "5" }, squad: "feature-dev" },
  { id: "e17", timestamp: "2026-02-21T21:40:00Z", actor: "Roman", actorEmoji: "⚙️", kind: "config-change", title: "Rate limiter thresholds adjusted", description: "Increased per-agent burst from 30→60 req/s after capacity review.", metadata: { before: "30 req/s", after: "60 req/s", scope: "per-agent" }, squad: "platform-core" },
  { id: "e18", timestamp: "2026-02-21T20:30:00Z", actor: "Sam", actorEmoji: "🔌", kind: "pr", title: "PR #476: WebSocket reconnect logic", description: "Graceful reconnect with jittered backoff and session resume.", metadata: { branch: "sam/ws-reconnect", repo: "clawdbot", lines: "+210 / -45" }, squad: "product-ui" },
  { id: "e19", timestamp: "2026-02-21T19:50:00Z", actor: "Piper", actorEmoji: "🔧", kind: "task", title: "Design system color audit complete", description: "Verified all 9 kind-colors meet WCAG AA contrast on zinc-950 background.", metadata: { colors_checked: "9", pass_rate: "100%" }, squad: "product-ui" },
  { id: "e20", timestamp: "2026-02-21T18:20:00Z", actor: "Tim", actorEmoji: "🏗️", kind: "spawn", title: "Spawned dependency audit agent", description: "Scanning for outdated/vulnerable packages across monorepo.", metadata: { packages: "347", scope: "monorepo" }, squad: "platform-core" },
  { id: "e21", timestamp: "2026-02-21T17:00:00Z", actor: "Nadia", actorEmoji: "🔍", kind: "alert", title: "Disk usage > 85% on log volume", description: "Log rotation triggered; archiving logs older than 7 days to cold storage.", metadata: { severity: "warning", usage: "87%", volume: "/var/log/openclaw" }, squad: "ops" },
  { id: "e22", timestamp: "2026-02-21T15:30:00Z", actor: "Wes", actorEmoji: "⚡", kind: "pr", title: "PR #474: Lazy-load dashboard panels", description: "Code-split each Horizon view into async chunks; initial load −38%.", metadata: { branch: "wes/lazy-panels", repo: "clawdbot", lines: "+95 / -22", improvement: "−38% bundle" }, squad: "product-ui" },
  { id: "e23", timestamp: "2026-02-21T14:10:00Z", actor: "Xavier", actorEmoji: "🧠", kind: "task", title: "Horizon MVP scope finalized", description: "Six views confirmed. Stretch: 7th view for cost breakdown if time permits.", metadata: { views: "6+1 stretch", deadline: "2026-03-07" }, squad: "leadership" },
  { id: "e24", timestamp: "2026-02-21T12:45:00Z", actor: "Claire", actorEmoji: "🚀", kind: "error", title: "Flaky test: tool-dispatch timeout", description: "Intermittent 2s timeout in CI. Root cause: mock clock drift. Fixed.", metadata: { test: "tool-dispatch.spec.ts", ci_run: "14209", fix: "mock clock pinned" }, squad: "feature-dev" },
  { id: "e25", timestamp: "2026-02-21T11:00:00Z", actor: "Quinn", actorEmoji: "🧩", kind: "deploy", title: "Storybook v8 deployed to preview", description: "Updated component docs with new Horizon design tokens and examples.", metadata: { url: "preview.openclaw.dev/storybook", version: "8.4.2" }, squad: "product-ui" },
  { id: "e26", timestamp: "2026-02-21T09:30:00Z", actor: "Joey", actorEmoji: "📋", kind: "message", title: "Sprint velocity report posted", description: "Team completed 48/52 story points. Two carry-overs from Platform Core.", metadata: { channel: "#cb-standups", points_done: "48", points_planned: "52" }, squad: "leadership" },
  { id: "e27", timestamp: "2026-02-20T16:20:00Z", actor: "Roman", actorEmoji: "⚙️", kind: "deploy", title: "Database migration: add agent_metrics table", description: "Online migration completed in 4.2s. No locks held during write.", metadata: { migration: "20260220_agent_metrics", duration: "4.2s" }, squad: "platform-core" },
  { id: "e28", timestamp: "2026-02-20T14:00:00Z", actor: "Reed", actorEmoji: "♿", kind: "commit", title: "fix: focus trap in modal dialogs", description: "Tab cycling now correctly wraps inside modals; escape key dismisses.", metadata: { branch: "reed/focus-trap", repo: "clawdbot", files: "4" }, squad: "product-ui" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatTime(ts: string): string {
  const d = new Date(ts);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m} UTC`;
}

function dayLabel(ts: string): string {
  const d = new Date(ts);
  const today = new Date("2026-02-22T00:00:00Z");
  const yesterday = new Date("2026-02-21T00:00:00Z");
  const evDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (evDay.getTime() === today.getTime()) return "Today";
  if (evDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function groupByDay(events: TimelineEvent[]): { label: string; events: TimelineEvent[] }[] {
  const groups: { label: string; events: TimelineEvent[] }[] = [];
  let currentLabel = "";
  for (const ev of events) {
    const lbl = dayLabel(ev.timestamp);
    if (lbl !== currentLabel) {
      currentLabel = lbl;
      groups.push({ label: lbl, events: [] });
    }
    groups[groups.length - 1].events.push(ev);
  }
  return groups;
}

function computeHourlyDensity(events: TimelineEvent[]): number[] {
  const buckets = new Array<number>(24).fill(0);
  for (const ev of events) {
    const h = new Date(ev.timestamp).getUTCHours();
    buckets[h]++;
  }
  return buckets;
}

function uniqueActors(events: TimelineEvent[]): string[] {
  return Array.from(new Set(events.map((e) => e.actor))).sort();
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ActivityTimeline() {
  const [search, setSearch] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [activeKinds, setActiveKinds] = useState<Set<EventKind>>(new Set(ALL_KINDS));
  const [activeSquad, setActiveSquad] = useState<Squad | "all">("all");
  const [activeActors, setActiveActors] = useState<Set<string>>(new Set(uniqueActors(EVENTS)));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(15);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = EVENTS.filter((ev) => {
    if (!activeKinds.has(ev.kind)) return false;
    if (activeSquad !== "all" && ev.squad !== activeSquad) return false;
    if (!activeActors.has(ev.actor)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = `${ev.title} ${ev.description} ${ev.actor} ${ev.kind}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    // time range filter
    const now = new Date("2026-02-22T10:00:00Z").getTime();
    const evTime = new Date(ev.timestamp).getTime();
    const diffH = (now - evTime) / 3_600_000;
    const maxH: Record<TimeRange, number> = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 };
    if (diffH > maxH[timeRange]) return false;
    return true;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const groups = groupByDay(visible);
  const density = computeHourlyDensity(filtered);
  const maxDensity = Math.max(...density, 1);
  const actors = uniqueActors(EVENTS);

  // ── Toggle helpers ────────────────────────────────────────────────────────

  const toggleKind = (k: EventKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    setVisibleCount(15);
  };

  const toggleActor = (a: string) => {
    setActiveActors((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
    setVisibleCount(15);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-semibold tracking-tight">Activity Timeline</h1>
        <input
          type="text"
          placeholder="Search events…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setVisibleCount(15); }}
          className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm w-64 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
        />
        <div className="flex items-center gap-1 ml-auto">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.value}
              onClick={() => { setTimeRange(tr.value); setVisibleCount(15); }}
              className={cn(
                "px-3 py-1.5 rounded text-sm transition-colors",
                timeRange === tr.value
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              )}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <aside className="w-[200px] shrink-0 border-r border-zinc-800 p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-64px)]">
          {/* Kind Filters */}
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Event Kind</h3>
            <div className="space-y-1">
              {ALL_KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => toggleKind(k)}
                  className={cn(
                    "flex items-center gap-2 w-full text-left px-2 py-1 rounded text-sm transition-colors",
                    activeKinds.has(k) ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", KIND_COLORS[k].dot, !activeKinds.has(k) && "opacity-30")} />
                  <span>{KIND_LABELS[k]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Squad Filter */}
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Squad</h3>
            <div className="space-y-1">
              <button
                onClick={() => { setActiveSquad("all"); setVisibleCount(15); }}
                className={cn(
                  "w-full text-left px-2 py-1 rounded text-sm transition-colors",
                  activeSquad === "all" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-400"
                )}
              >
                All Squads
              </button>
              {ALL_SQUADS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setActiveSquad(s); setVisibleCount(15); }}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded text-sm transition-colors",
                    activeSquad === s ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-400"
                  )}
                >
                  {SQUAD_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Agent Filter */}
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Agent</h3>
            <div className="space-y-1">
              {actors.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleActor(a)}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded text-sm transition-colors",
                    activeActors.has(a) ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main Timeline ─────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-64px)]">
          {/* Activity density bar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">24h Activity Density</span>
              <span className="text-xs text-zinc-500">{filtered.length} events</span>
            </div>
            <div className="flex items-end gap-[3px] h-10">
              {density.map((count, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end"
                  title={`${i.toString().padStart(2, "0")}:00 UTC — ${count} events`}
                >
                  <div
                    className={cn(
                      "w-full rounded-sm transition-all",
                      count > 0 ? "bg-indigo-500" : "bg-zinc-800"
                    )}
                    style={{ height: `${Math.max(count > 0 ? 10 : 2, (count / maxDensity) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-zinc-600">00:00</span>
              <span className="text-[10px] text-zinc-600">06:00</span>
              <span className="text-[10px] text-zinc-600">12:00</span>
              <span className="text-[10px] text-zinc-600">18:00</span>
              <span className="text-[10px] text-zinc-600">23:00</span>
            </div>
          </div>

          {/* Timeline groups */}
          {groups.length === 0 && (
            <div className="text-center py-16 text-zinc-500">
              No events match the current filters.
            </div>
          )}

          {groups.map((group) => (
            <div key={group.label}>
              {/* Day label */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-semibold text-zinc-400">{group.label}</span>
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs text-zinc-600">{group.events.length} events</span>
              </div>

              {/* Events */}
              <div className="relative ml-4">
                {/* Vertical timeline rail */}
                <div className="absolute left-[5px] top-0 bottom-0 w-px bg-zinc-800" />

                <div className="space-y-3">
                  {group.events.map((ev) => {
                    const colors = KIND_COLORS[ev.kind];
                    const isExpanded = expandedId === ev.id;

                    return (
                      <div key={ev.id} className="relative flex gap-4">
                        {/* Dot */}
                        <div className="relative z-10 mt-3 shrink-0">
                          <div className={cn("w-[11px] h-[11px] rounded-full border-2 border-zinc-950", colors.dot)} />
                        </div>

                        {/* Card */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                          className={cn(
                            "flex-1 text-left bg-zinc-900 border rounded-lg p-3 transition-colors hover:border-zinc-700 cursor-pointer",
                            isExpanded ? "border-zinc-700" : "border-zinc-800"
                          )}
                        >
                          {/* Top row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm">{ev.actorEmoji} {ev.actor}</span>
                            <span className={cn("text-[11px] px-1.5 py-0.5 rounded font-medium", colors.badge)}>
                              {KIND_LABELS[ev.kind]}
                            </span>
                            <span className="text-xs text-zinc-600 ml-auto shrink-0">{formatTime(ev.timestamp)}</span>
                          </div>

                          {/* Title */}
                          <p className="text-sm text-white mt-1 font-medium">{ev.title}</p>

                          {/* Description */}
                          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{ev.description}</p>

                          {/* Metadata pills */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {Object.entries(ev.metadata).slice(0, isExpanded ? undefined : 3).map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-flex text-[10px] bg-zinc-800 text-zinc-400 rounded px-1.5 py-0.5"
                              >
                                <span className="text-zinc-600">{k}:</span>
                                <span className="ml-0.5">{v}</span>
                              </span>
                            ))}
                            {!isExpanded && Object.keys(ev.metadata).length > 3 && (
                              <span className="text-[10px] text-zinc-600">
                                +{Object.keys(ev.metadata).length - 3} more
                              </span>
                            )}
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-500 space-y-1">
                              <div className="flex gap-4">
                                <span>Squad: <span className="text-zinc-300">{SQUAD_LABELS[ev.squad]}</span></span>
                                <span>ID: <span className="text-zinc-300 font-mono">{ev.id}</span></span>
                              </div>
                              <div>Full timestamp: <span className="text-zinc-300 font-mono">{ev.timestamp}</span></div>
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setVisibleCount((c) => c + 10)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm transition-colors"
              >
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}

          {!hasMore && filtered.length > 0 && (
            <div className="text-center text-xs text-zinc-600 pt-4 pb-8">
              End of timeline — {filtered.length} events shown
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
