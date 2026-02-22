import React, { useState, useMemo, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "retrying";
type TaskPriority = "critical" | "high" | "normal" | "low";
type TaskKind =
  | "agent-run"
  | "cron-job"
  | "webhook-delivery"
  | "export"
  | "build"
  | "sync"
  | "email"
  | "notification";

interface TaskItem {
  id: string;
  name: string;
  kind: TaskKind;
  status: TaskStatus;
  priority: TaskPriority;
  agentId?: string;
  agentName?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress?: number; // 0–100 for running tasks
  attempts: number;
  maxAttempts: number;
  error?: string;
  eta?: string; // ISO
  tags: string[];
  workerId?: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const TASKS: TaskItem[] = [
  {
    id: "tsk-001", name: "Horizon UI nightly build",
    kind: "build",   status: "running",   priority: "high",
    agentId: "luis", agentName: "Luis",
    createdAt: "2026-02-22T01:00:00Z", startedAt: "2026-02-22T01:00:05Z",
    progress: 67, attempts: 1, maxAttempts: 3,
    eta: "2026-02-22T01:25:00Z", tags: ["ci", "frontend"], workerId: "worker-a1",
  },
  {
    id: "tsk-002", name: "GitHub webhook delivery — PR #142",
    kind: "webhook-delivery", status: "completed", priority: "normal",
    createdAt: "2026-02-22T00:58:12Z", startedAt: "2026-02-22T00:58:13Z",
    completedAt: "2026-02-22T00:58:14Z",
    attempts: 1, maxAttempts: 5, tags: ["webhook", "github"],
  },
  {
    id: "tsk-003", name: "Daily usage report export",
    kind: "export", status: "completed", priority: "normal",
    agentId: "xavier", agentName: "Xavier",
    createdAt: "2026-02-22T00:00:02Z", startedAt: "2026-02-22T00:00:08Z",
    completedAt: "2026-02-22T00:01:44Z",
    attempts: 1, maxAttempts: 3, tags: ["report", "scheduled"],
  },
  {
    id: "tsk-004", name: "Slack digest notification — weekly summary",
    kind: "notification", status: "pending", priority: "low",
    createdAt: "2026-02-22T01:05:00Z",
    attempts: 0, maxAttempts: 3, eta: "2026-02-22T08:00:00Z",
    tags: ["slack", "digest"],
  },
  {
    id: "tsk-005", name: "Gemini provider token sync",
    kind: "sync", status: "failed", priority: "high",
    agentId: "tim", agentName: "Tim",
    createdAt: "2026-02-22T00:45:00Z", startedAt: "2026-02-22T00:45:02Z",
    completedAt: "2026-02-22T00:45:08Z",
    attempts: 3, maxAttempts: 3,
    error: "Provider API returned 429 Too Many Requests — hourly token limit exceeded. Manual intervention required.",
    tags: ["provider", "sync"],
  },
  {
    id: "tsk-006", name: "Agent soul backup — all agents",
    kind: "export", status: "running", priority: "normal",
    agentId: "xavier", agentName: "Xavier",
    createdAt: "2026-02-22T01:10:00Z", startedAt: "2026-02-22T01:10:05Z",
    progress: 34, attempts: 1, maxAttempts: 2,
    eta: "2026-02-22T01:15:00Z", tags: ["backup", "souls"], workerId: "worker-b2",
  },
  {
    id: "tsk-007", name: "Cron: hourly agent heartbeat check",
    kind: "cron-job", status: "completed", priority: "critical",
    createdAt: "2026-02-22T01:05:00Z", startedAt: "2026-02-22T01:05:00Z",
    completedAt: "2026-02-22T01:05:03Z",
    attempts: 1, maxAttempts: 1, tags: ["cron", "heartbeat"],
  },
  {
    id: "tsk-008", name: "Stripe invoice webhook — INV-2024-089",
    kind: "webhook-delivery", status: "retrying", priority: "high",
    createdAt: "2026-02-22T00:52:00Z", startedAt: "2026-02-22T00:52:01Z",
    attempts: 2, maxAttempts: 5,
    error: "HTTP 503 Service Unavailable — endpoint temporarily down",
    eta: "2026-02-22T01:22:00Z", tags: ["webhook", "billing"], workerId: "worker-c3",
  },
  {
    id: "tsk-009", name: "Piper component PR review agent-run",
    kind: "agent-run", status: "completed", priority: "normal",
    agentId: "piper", agentName: "Piper",
    createdAt: "2026-02-22T00:30:00Z", startedAt: "2026-02-22T00:30:05Z",
    completedAt: "2026-02-22T00:33:12Z",
    attempts: 1, maxAttempts: 1, tags: ["pr-review", "piper"],
  },
  {
    id: "tsk-010", name: "Welcome email — new workspace member",
    kind: "email", status: "cancelled", priority: "low",
    createdAt: "2026-02-21T23:45:00Z",
    attempts: 0, maxAttempts: 3, tags: ["email", "onboarding"],
    error: "Cancelled: user account was deactivated before send",
  },
  {
    id: "tsk-011", name: "Wes DataExport render benchmark",
    kind: "agent-run", status: "running", priority: "normal",
    agentId: "wes", agentName: "Wes",
    createdAt: "2026-02-22T01:08:00Z", startedAt: "2026-02-22T01:08:10Z",
    progress: 12, attempts: 1, maxAttempts: 1, tags: ["benchmark", "wes"], workerId: "worker-a1",
  },
  {
    id: "tsk-012", name: "Cron: midnight audit log archival",
    kind: "cron-job", status: "completed", priority: "normal",
    createdAt: "2026-02-22T00:00:00Z", startedAt: "2026-02-22T00:00:00Z",
    completedAt: "2026-02-22T00:04:22Z",
    attempts: 1, maxAttempts: 1, tags: ["cron", "audit"],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending:   "Pending",
  running:   "Running",
  completed: "Done",
  failed:    "Failed",
  cancelled: "Cancelled",
  retrying:  "Retrying",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending:   "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
  running:   "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  completed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  failed:    "text-rose-400 bg-rose-400/10 border-rose-400/20",
  cancelled: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
  retrying:  "text-amber-400 bg-amber-400/10 border-amber-400/20",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  normal:   "text-zinc-400",
  low:      "text-zinc-600",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: "P0",
  high:     "P1",
  normal:   "P2",
  low:      "P3",
};

const KIND_EMOJIS: Record<TaskKind, string> = {
  "agent-run":          "🤖",
  "cron-job":           "⏰",
  "webhook-delivery":   "🔗",
  "export":             "📦",
  "build":              "🔨",
  "sync":               "🔄",
  "email":              "✉️",
  "notification":       "🔔",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function duration(start?: string, end?: string): string {
  if (!start) return "—";
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  const ms = to - from;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="relative h-1 w-full rounded-full bg-zinc-800 overflow-hidden mt-2">
      <div
        className="h-full rounded-full bg-indigo-500 transition-all"
        style={{ width: `${value}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${value}% complete`}
      />
    </div>
  );
}

interface TaskRowProps {
  task: TaskItem;
  expanded: boolean;
  onToggle: () => void;
}

function TaskRow({ task, expanded, onToggle }: TaskRowProps) {
  return (
    <div className="border-b border-zinc-800 last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`task-detail-${task.id}`}
        className={cn(
          "w-full text-left px-4 py-3 transition-colors",
          "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 focus-visible:outline-none",
          expanded ? "bg-zinc-800/40" : "hover:bg-zinc-800/20"
        )}
      >
        <div className="flex items-center gap-3">
          {/* Kind emoji */}
          <span className="text-lg w-7 text-center shrink-0" aria-hidden="true">
            {KIND_EMOJIS[task.kind]}
          </span>

          {/* Name + tags */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-white truncate">{task.name}</p>
              {task.agentName && (
                <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                  {task.agentName}
                </span>
              )}
            </div>
            {task.status === "running" && task.progress !== undefined && (
              <ProgressBar value={task.progress} />
            )}
          </div>

          {/* Priority */}
          <span className={cn("text-xs font-bold font-mono shrink-0 w-5 text-center", PRIORITY_COLORS[task.priority])}>
            {PRIORITY_LABELS[task.priority]}
          </span>

          {/* Attempts */}
          <span className="text-xs text-zinc-600 shrink-0 w-12 text-center">
            {task.attempts}/{task.maxAttempts}
          </span>

          {/* Status badge */}
          <span className={cn("inline-flex items-center text-xs px-2 py-0.5 rounded-full border shrink-0 w-24 justify-center", STATUS_COLORS[task.status])}>
            {task.status === "running" && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse mr-1" aria-hidden="true" />
            )}
            {STATUS_LABELS[task.status]}
          </span>

          {/* Time */}
          <span className="text-xs text-zinc-500 shrink-0 w-16 text-right">
            {relTime(task.createdAt)}
          </span>

          {/* Expand icon */}
          <span className={cn("text-zinc-600 transition-transform shrink-0", expanded && "rotate-180")} aria-hidden="true">
            ▾
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          id={`task-detail-${task.id}`}
          className="px-4 pb-4 pt-1 bg-zinc-800/20 space-y-3"
          role="region"
          aria-label={`Details for ${task.name}`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-zinc-500 mb-0.5">Task ID</p>
              <p className="text-zinc-300 font-mono">{task.id}</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-0.5">Kind</p>
              <p className="text-zinc-300 capitalize">{task.kind.replace("-", " ")}</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-0.5">Duration</p>
              <p className="text-zinc-300 font-mono">{duration(task.startedAt, task.completedAt)}</p>
            </div>
            {task.workerId && (
              <div>
                <p className="text-zinc-500 mb-0.5">Worker</p>
                <p className="text-zinc-300 font-mono">{task.workerId}</p>
              </div>
            )}
            {task.eta && (
              <div>
                <p className="text-zinc-500 mb-0.5">ETA</p>
                <p className="text-zinc-300">{new Date(task.eta).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            )}
          </div>

          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {task.error && (
            <div className="rounded-lg bg-rose-950/30 border border-rose-500/20 p-3">
              <p className="text-xs text-rose-400 font-semibold mb-1">Error</p>
              <p className="text-xs text-rose-300">{task.error}</p>
            </div>
          )}

          <div className="flex gap-2">
            {(task.status === "failed" || task.status === "cancelled") && (
              <button
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                )}
              >
                Retry
              </button>
            )}
            {task.status === "running" && (
              <button
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none"
                )}
              >
                Cancel
              </button>
            )}
            <button
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white transition-colors",
                "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              )}
            >
              View Logs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type StatusFilter = TaskStatus | "all";
type KindFilter = TaskKind | "all";

export default function TaskQueue() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return TASKS.filter(t => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (kindFilter !== "all" && t.kind !== kindFilter) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      // Sort: running first, then pending/retrying, then by created desc
      const rank: Record<TaskStatus, number> = {
        running: 0, retrying: 1, pending: 2, failed: 3, completed: 4, cancelled: 5,
      };
      const dr = rank[a.status] - rank[b.status];
      if (dr !== 0) return dr;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [statusFilter, kindFilter, search]);

  const toggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const stats = useMemo(() => ({
    running:   TASKS.filter(t => t.status === "running").length,
    pending:   TASKS.filter(t => t.status === "pending").length,
    failed:    TASKS.filter(t => t.status === "failed").length,
    completed: TASKS.filter(t => t.status === "completed").length,
  }), []);

  const statuses: Array<{ value: StatusFilter; label: string }> = [
    { value: "all",       label: "All" },
    { value: "running",   label: "Running" },
    { value: "pending",   label: "Pending" },
    { value: "retrying",  label: "Retrying" },
    { value: "failed",    label: "Failed" },
    { value: "completed", label: "Done" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const kinds: Array<{ value: KindFilter; label: string }> = [
    { value: "all",              label: "All kinds" },
    { value: "agent-run",        label: "Agent Runs" },
    { value: "cron-job",         label: "Cron Jobs" },
    { value: "webhook-delivery", label: "Webhooks" },
    { value: "export",           label: "Exports" },
    { value: "build",            label: "Builds" },
    { value: "sync",             label: "Syncs" },
    { value: "email",            label: "Emails" },
    { value: "notification",     label: "Notifications" },
  ];

  return (
    <main className="flex flex-col h-full bg-zinc-950 text-white overflow-hidden" role="main" aria-label="Task Queue">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-white">Task Queue</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Background jobs, agent runs, webhooks, and scheduled tasks</p>
          </div>
          {/* Live stats */}
          <div className="flex items-center gap-5 text-xs">
            {[
              { label: "Running", count: stats.running, color: "text-indigo-400" },
              { label: "Pending", count: stats.pending, color: "text-zinc-400" },
              { label: "Failed",  count: stats.failed,  color: "text-rose-400" },
              { label: "Done",    count: stats.completed, color: "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={cn("text-xl font-bold font-mono", s.color)}>{s.count}</p>
                <p className="text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className={cn(
              "bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-500",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none w-48"
            )}
          />

          {/* Status filter chips */}
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
            {statuses.map(s => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                aria-pressed={statusFilter === s.value}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-lg border transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  statusFilter === s.value
                    ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                    : "border-zinc-700 text-zinc-400 hover:text-white"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Kind select */}
          <select
            value={kindFilter}
            onChange={e => setKindFilter(e.target.value as KindFilter)}
            aria-label="Filter by task kind"
            className={cn(
              "bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            )}
          >
            {kinds.map(k => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>

          <span className="text-xs text-zinc-600 ml-auto">{filtered.length} tasks</span>
        </div>
      </div>

      {/* Table header */}
      <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-3 text-xs text-zinc-500 bg-zinc-900/50 shrink-0">
        <span className="w-7" aria-hidden="true" />
        <span className="flex-1">Task</span>
        <span className="w-5 text-center">Pri</span>
        <span className="w-12 text-center">Tries</span>
        <span className="w-24 text-center">Status</span>
        <span className="w-16 text-right">Created</span>
        <span className="w-4" aria-hidden="true" />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto" role="list" aria-label="Task list">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-white font-semibold">No tasks match your filters</p>
            <p className="text-sm text-zinc-500 mt-1">Try clearing filters or check back later</p>
          </div>
        ) : (
          <div className="rounded-none bg-zinc-900 border-zinc-800">
            {filtered.map(task => (
              <div key={task.id} role="listitem">
                <TaskRow
                  task={task}
                  expanded={expandedIds.has(task.id)}
                  onToggle={() => toggle(task.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
