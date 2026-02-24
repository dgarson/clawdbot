import React, { useState, useMemo, useCallback } from "react";
import { Calendar } from 'lucide-react';
import { cn } from "../lib/utils";
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';

// ─── Types ───────────────────────────────────────────────────────────────────

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun
type RepeatMode = "once" | "daily" | "weekly" | "monthly" | "cron";
type ScheduleStatus = "active" | "paused" | "completed" | "error";

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  agentId: string;
  agentName: string;
  agentEmoji: string;
  prompt: string;
  repeatMode: RepeatMode;
  cronExpr?: string;
  daysOfWeek?: DayOfWeek[];
  timeOfDay: string; // "HH:MM" 24h
  timezone: string;
  status: ScheduleStatus;
  nextRunAt: string; // ISO
  lastRunAt?: string;
  lastResult?: "success" | "failure";
  runCount: number;
  createdAt: string;
  tags: string[];
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SCHEDULES: ScheduledTask[] = [
  {
    id: "sched-001",
    name: "Daily Usage Digest",
    description: "Generate and send daily token usage summary to #cb-reports",
    agentId: "xavier",
    agentName: "Xavier",
    agentEmoji: "🎯",
    prompt: "Generate a comprehensive daily usage report covering all agents, models, and sessions. Include cost breakdown, token consumption, and top active agents. Post to #cb-reports.",
    repeatMode: "daily",
    timeOfDay: "08:00",
    timezone: "America/Denver",
    status: "active",
    nextRunAt: "2026-02-23T15:00:00Z",
    lastRunAt: "2026-02-22T15:00:00Z",
    lastResult: "success",
    runCount: 47,
    createdAt: "2025-12-01T00:00:00Z",
    tags: ["reporting", "usage"],
  },
  {
    id: "sched-002",
    name: "Hourly Agent Heartbeat",
    description: "Luis performs hourly work check and self-direction cycle",
    agentId: "luis",
    agentName: "Luis",
    agentEmoji: "🎨",
    prompt: "You are Luis, Principal UX Engineer at OpenClaw. Hourly work check. Read UX_WORK_QUEUE.md, pick up next TODO, delegate if needed.",
    repeatMode: "cron",
    cronExpr: "5 * * * *",
    timeOfDay: "00:05",
    timezone: "America/Denver",
    status: "active",
    nextRunAt: "2026-02-22T08:05:00Z",
    lastRunAt: "2026-02-22T07:05:00Z",
    lastResult: "success",
    runCount: 312,
    createdAt: "2025-11-01T00:00:00Z",
    tags: ["heartbeat", "self-direction"],
  },
  {
    id: "sched-003",
    name: "Weekly Brand Review",
    description: "Stephan reviews brand consistency across all public-facing content",
    agentId: "stephan",
    agentName: "Stephan",
    agentEmoji: "📣",
    prompt: "Review the past week's public-facing content for brand voice consistency. Check landing pages, email templates, and Slack announcements. Report any deviations from brand guidelines.",
    repeatMode: "weekly",
    daysOfWeek: [1], // Monday
    timeOfDay: "09:00",
    timezone: "America/Denver",
    status: "active",
    nextRunAt: "2026-02-23T16:00:00Z",
    lastRunAt: "2026-02-16T16:00:00Z",
    lastResult: "success",
    runCount: 11,
    createdAt: "2025-11-24T00:00:00Z",
    tags: ["brand", "weekly"],
  },
  {
    id: "sched-004",
    name: "Nightly Backup Check",
    description: "Verify all agent soul files and workspace data are backed up",
    agentId: "tim",
    agentName: "Tim",
    agentEmoji: "🏗️",
    prompt: "Verify all agent soul files in the workspace are properly backed up. Check backup timestamps, confirm integrity, alert if any agent's data is missing or stale.",
    repeatMode: "daily",
    timeOfDay: "00:30",
    timezone: "America/Denver",
    status: "active",
    nextRunAt: "2026-02-23T07:30:00Z",
    lastRunAt: "2026-02-22T07:30:00Z",
    lastResult: "success",
    runCount: 83,
    createdAt: "2025-11-15T00:00:00Z",
    tags: ["backup", "infra"],
  },
  {
    id: "sched-005",
    name: "Monthly UX Roadmap Review",
    description: "Luis updates UX_ROADMAP.md with next 4-6 weeks of forward view",
    agentId: "luis",
    agentName: "Luis",
    agentEmoji: "🎨",
    prompt: "Read CONTEXT.md and the current UX_ROADMAP.md. Update the roadmap with a fresh 4-6 week forward view based on current product priorities, identified UX gaps, and competitive patterns. Post summary to #cb-activity.",
    repeatMode: "monthly",
    timeOfDay: "10:00",
    timezone: "America/Denver",
    status: "active",
    nextRunAt: "2026-03-01T17:00:00Z",
    lastRunAt: "2026-02-01T17:00:00Z",
    lastResult: "success",
    runCount: 3,
    createdAt: "2025-12-01T00:00:00Z",
    tags: ["roadmap", "ux"],
  },
  {
    id: "sched-006",
    name: "Provider Health Poll",
    description: "Check all AI provider APIs for latency and availability",
    agentId: "tim",
    agentName: "Tim",
    agentEmoji: "🏗️",
    prompt: "Poll all configured AI provider APIs (Anthropic, OpenAI, Google, MiniMax) for health status. Record latency, check rate limit headroom, and alert if any provider is degraded.",
    repeatMode: "cron",
    cronExpr: "*/15 * * * *",
    timeOfDay: "00:00",
    timezone: "UTC",
    status: "paused",
    nextRunAt: "2026-02-22T08:15:00Z",
    lastRunAt: "2026-02-22T01:00:00Z",
    lastResult: "failure",
    runCount: 1204,
    createdAt: "2025-09-01T00:00:00Z",
    tags: ["health", "providers"],
  },
  {
    id: "sched-007",
    name: "Sprint Retrospective",
    description: "Xavier facilitates weekly sprint retrospective and posts findings",
    agentId: "xavier",
    agentName: "Xavier",
    agentEmoji: "🎯",
    prompt: "Facilitate the weekly sprint retrospective. Review what was shipped, what blocked us, what we'll do differently. Post a structured summary to #cb-activity with action items.",
    repeatMode: "weekly",
    daysOfWeek: [5], // Friday
    timeOfDay: "16:00",
    timezone: "America/Denver",
    status: "active",
    nextRunAt: "2026-02-27T23:00:00Z",
    lastRunAt: "2026-02-20T23:00:00Z",
    lastResult: "success",
    runCount: 14,
    createdAt: "2025-11-01T00:00:00Z",
    tags: ["retrospective", "sprint"],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ScheduleStatus, string> = {
  active:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  paused:    "text-amber-400 bg-amber-400/10 border-amber-400/20",
  completed: "text-fg-secondary bg-zinc-400/10 border-zinc-400/20",
  error:     "text-rose-400 bg-rose-400/10 border-rose-400/20",
};

const REPEAT_LABELS: Record<RepeatMode, string> = {
  once:    "Once",
  daily:   "Daily",
  weekly:  "Weekly",
  monthly: "Monthly",
  cron:    "Cron",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {return "just now";}
  if (mins < 60) {return `${mins}m ago`;}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {return `${hrs}h ${Math.floor((mins % 60))}m ago`;}
  return `${Math.floor(hrs / 24)}d ago`;
}

function futureTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {return "now";}
  if (mins < 60) {return `in ${mins}m`;}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {return `in ${hrs}h ${Math.floor(mins % 60)}m`;}
  return `in ${Math.floor(hrs / 24)}d`;
}

function repeatLabel(s: ScheduledTask): string {
  if (s.repeatMode === "cron") {return `Cron: ${s.cronExpr}`;}
  if (s.repeatMode === "weekly" && s.daysOfWeek) {
    return `Weekly on ${s.daysOfWeek.map(d => DAY_NAMES[d]).join(", ")} at ${s.timeOfDay}`;
  }
  return `${REPEAT_LABELS[s.repeatMode]} at ${s.timeOfDay}`;
}

// ─── Calendar Strip ───────────────────────────────────────────────────────────

function CalendarStrip({ schedules }: { schedules: ScheduledTask[] }) {
  const days = useMemo(() => {
    const result: { date: Date; dateStr: string; tasks: ScheduledTask[] }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const tasks = schedules.filter(s => s.status === "active" && s.nextRunAt.startsWith(dateStr));
      result.push({ date: d, dateStr, tasks });
    }
    return result;
  }, [schedules]);

  return (
    <div className="rounded-xl bg-surface-1 border border-tok-border overflow-hidden">
      <div className="px-4 py-3 border-b border-tok-border">
        <h3 className="text-sm font-semibold text-fg-primary">Upcoming Schedule — Next 7 Days</h3>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-7 divide-x divide-tok-border">
        {days.map(({ date, tasks }) => (
          <div key={date.toISOString()} className="p-2 min-h-[80px]">
            <p className="text-xs text-fg-muted mb-1">{DAY_NAMES[date.getDay()]}</p>
            <p className="text-sm font-bold text-fg-primary mb-2">{date.getDate()}</p>
            <div className="space-y-1">
              {tasks.slice(0, 3).map(t => (
                <div
                  key={t.id}
                  className="text-[9px] bg-indigo-950/60 border border-indigo-500/20 rounded px-1 py-0.5 text-indigo-300 truncate"
                  title={t.name}
                >
                  {t.agentEmoji} {t.name}
                </div>
              ))}
              {tasks.length > 3 && (
                <div className="text-[9px] text-fg-muted">+{tasks.length - 3} more</div>
              )}
              {tasks.length === 0 && (
                <div className="text-[9px] text-fg-muted">—</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type ViewMode = "list" | "calendar";
type StatusFilter = ScheduleStatus | "all";

export default function AgentScheduler() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(SCHEDULES[0].id);

  const agents = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string; emoji: string }> = [];
    for (const s of SCHEDULES) {
      if (!seen.has(s.agentId)) {
        seen.add(s.agentId);
        list.push({ id: s.agentId, name: s.agentName, emoji: s.agentEmoji });
      }
    }
    return list;
  }, []);

  const filtered = useMemo(() => {
    return SCHEDULES.filter(s => {
      if (statusFilter !== "all" && s.status !== statusFilter) {return false;}
      if (agentFilter !== "all" && s.agentId !== agentFilter) {return false;}
      return true;
    }).toSorted((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime());
  }, [statusFilter, agentFilter]);

  const selected = useMemo(() => SCHEDULES.find(s => s.id === selectedId) ?? null, [selectedId]);

  const handleToggle = useCallback((id: string) => {
    console.log("Toggle schedule:", id);
  }, []);

  const statuses: Array<{ value: StatusFilter; label: string }> = [
    { value: "all",     label: "All" },
    { value: "active",  label: "Active" },
    { value: "paused",  label: "Paused" },
    { value: "error",   label: "Error" },
  ];

  return (
    <>
    <a href="#agent-scheduler-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-surface-0 focus:text-fg-primary focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
      Skip to main content
    </a>
    <main id="agent-scheduler-main" className="flex flex-col h-full bg-surface-0 text-fg-primary overflow-hidden" role="main" aria-label="Agent Scheduler">
      {/* Header */}
      <div className="px-3 py-3 sm:px-4 md:px-6 md:py-4 border-b border-tok-border shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-bold text-fg-primary">Agent Scheduler</h1>
            <p className="text-xs text-fg-muted mt-0.5">
              {SCHEDULES.filter(s => s.status === "active").length} active schedules across{" "}
              {new Set(SCHEDULES.map(s => s.agentId)).size} agents
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg bg-surface-2 p-0.5" role="group" aria-label="View mode">
              {(["list", "calendar"] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  className={cn(
                    "px-3 py-1 rounded text-xs capitalize transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                    viewMode === mode ? "bg-surface-3 text-fg-primary" : "text-fg-secondary hover:text-fg-primary"
                  )}
                >
                  {mode === "list" ? "📋" : "📅"} {mode}
                </button>
              ))}
            </div>
            <button
              className={cn(
                "px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-fg-primary text-xs font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              )}
            >
              + New Schedule
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status */}
          <div className="flex gap-1" role="group" aria-label="Filter by status">
            {statuses.map(s => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                aria-pressed={statusFilter === s.value}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-lg border transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                  statusFilter === s.value
                    ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                    : "border-tok-border text-fg-secondary hover:text-fg-primary"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Agent filter */}
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            aria-label="Filter by agent"
            className={cn(
              "bg-surface-2 border border-tok-border rounded-lg px-3 py-1 text-xs text-fg-primary",
              "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            )}
          >
            <option value="all">All agents</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
            ))}
          </select>

          <span className="text-xs text-fg-muted ml-auto">{filtered.length} schedules</span>
        </div>
      </div>

      {/* Content */}
      {viewMode === "calendar" ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <CalendarStrip schedules={SCHEDULES} />
          <div className="text-center text-sm text-fg-muted">Full calendar view shows next 7 days</div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Schedule list — full width on mobile, fixed w-80 on md+; hidden on mobile when detail is open */}
          <div className={cn(
            "w-full md:w-80 shrink-0 flex-col border-r border-tok-border overflow-y-auto",
            selectedId ? "hidden md:flex" : "flex"
          )}>
            <div className="p-3 space-y-2" role="list" aria-label="Schedules">
              {filtered.length === 0 ? (
                <ContextualEmptyState
                  icon={Calendar}
                  title="No schedules found"
                  description="Try adjusting your filters or create a new schedule."
                />
              ) : filtered.map(sched => (
                <div key={sched.id} role="listitem">
                  <button
                    onClick={() => setSelectedId(sched.id)}
                    aria-pressed={selectedId === sched.id}
                    className={cn(
                      "w-full text-left rounded-xl border p-3 transition-all",
                      "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                      selectedId === sched.id
                        ? "border-indigo-500 bg-indigo-950/30"
                        : "border-tok-border bg-surface-1 hover:border-tok-border"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span>{sched.agentEmoji}</span>
                        <span className="text-sm font-medium text-fg-primary truncate">{sched.name}</span>
                      </div>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border shrink-0", STATUS_COLORS[sched.status])}>
                        {sched.status}
                      </span>
                    </div>
                    <p className="text-xs text-fg-muted mb-2 line-clamp-1">{sched.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-fg-muted">
                      <span>{REPEAT_LABELS[sched.repeatMode]}</span>
                      <span className="text-indigo-400">{futureTime(sched.nextRunAt)}</span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule detail — hidden on mobile unless something is selected */}
          <div className={cn("flex-1 overflow-y-auto p-6", !selectedId && "hidden md:block")}>
            {selected ? (
              <div className="space-y-5 max-w-xl">
                {/* Mobile back button */}
                <button
                  onClick={() => setSelectedId(null)}
                  className="md:hidden flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 mb-2"
                >
                  ← Back to schedules
                </button>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{selected.agentEmoji}</span>
                      <h2 className="text-xl font-bold text-fg-primary">{selected.name}</h2>
                    </div>
                    <p className="text-sm text-fg-secondary">{selected.description}</p>
                  </div>
                  {/* Toggle */}
                  <button
                    role="switch"
                    aria-checked={selected.status === "active"}
                    aria-label={`${selected.name} ${selected.status === "active" ? "active" : "paused"}`}
                    onClick={() => handleToggle(selected.id)}
                    className={cn(
                      "relative inline-flex h-6 w-11 rounded-full transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                      selected.status === "active" ? "bg-indigo-600" : "bg-surface-3"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform m-0.5",
                        selected.status === "active" ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Status + schedule */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Status",     value: selected.status,                   extra: <span className={cn("text-xs px-2 py-0.5 rounded border", STATUS_COLORS[selected.status])}>{selected.status}</span> },
                    { label: "Repeat",     value: repeatLabel(selected) },
                    { label: "Next Run",   value: `${futureTime(selected.nextRunAt)} (${new Date(selected.nextRunAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })})` },
                    { label: "Last Run",   value: selected.lastRunAt ? relTime(selected.lastRunAt) : "Never" },
                    { label: "Run Count",  value: String(selected.runCount) },
                    { label: "Last Result", value: selected.lastResult ?? "—" },
                  ].map(m => (
                    <div key={m.label} className="rounded-xl bg-surface-1 border border-tok-border p-3">
                      <p className="text-xs text-fg-muted mb-1">{m.label}</p>
                      {m.extra ?? <p className="text-sm text-fg-primary">{m.value}</p>}
                    </div>
                  ))}
                </div>

                {/* Prompt */}
                <div className="rounded-xl bg-surface-1 border border-tok-border p-4">
                  <h3 className="text-sm font-semibold text-fg-primary mb-2">Agent Prompt</h3>
                  <p className="text-sm text-fg-secondary leading-relaxed">{selected.prompt}</p>
                </div>

                {/* Tags */}
                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-1 rounded bg-surface-2 text-fg-secondary">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    className={cn(
                      "px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-fg-primary text-sm font-medium transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                    )}
                  >
                    Run Now
                  </button>
                  <button
                    className={cn(
                      "px-4 py-2 rounded-xl border border-tok-border text-fg-primary hover:text-fg-primary text-sm transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                    )}
                  >
                    Edit
                  </button>
                  <button
                    className={cn(
                      "px-4 py-2 rounded-xl border border-tok-border text-rose-400 hover:text-rose-300 text-sm transition-colors ml-auto",
                      "focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none"
                    )}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-5xl mb-4">⏰</p>
                <p className="text-lg font-semibold text-fg-primary">Select a schedule</p>
                <p className="text-sm text-fg-muted mt-1">Choose a scheduled task to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
    </>
  );
}
