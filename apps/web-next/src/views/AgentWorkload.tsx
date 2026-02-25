import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type AgentStatus = "online" | "busy" | "idle" | "offline";
type WorkItemKind = "session" | "subagent" | "cron" | "pr-review" | "build" | "analysis";

interface WorkItem {
  id: string;
  kind: WorkItemKind;
  title: string;
  startedAt: string;
  progress?: number; // 0-100
  tokensBurned: number;
  estimatedCompletion?: string;
}

interface AgentWorkloadData {
  agentId: string;
  agentName: string;
  agentEmoji: string;
  role: string;
  status: AgentStatus;
  activeWorkItems: WorkItem[];
  queuedCount: number;
  completedToday: number;
  tokensUsedToday: number;
  tokenBudgetToday: number;
  successRateThisWeek: number; // 0-100
  avgSessionDurationMins: number;
  lastActive: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const AGENTS: AgentWorkloadData[] = [
  {
    agentId: "luis",
    agentName: "Luis",
    agentEmoji: "🎨",
    role: "Principal UX Engineer",
    status: "busy",
    activeWorkItems: [
      { id: "wi-001", kind: "session", title: "Horizon UI Sprint — building views #57-#60", startedAt: "2026-02-22T01:05:00Z", progress: 72, tokensBurned: 320000, estimatedCompletion: "2026-02-22T07:30:00Z" },
      { id: "wi-002", kind: "subagent", title: "Delegated: ApiPlayground to Piper", startedAt: "2026-02-22T02:30:00Z", progress: 40, tokensBurned: 8000 },
      { id: "wi-003", kind: "subagent", title: "Delegated: WorkspaceSettings to Reed", startedAt: "2026-02-22T02:30:00Z", progress: 35, tokensBurned: 6000 },
    ],
    queuedCount: 4,
    completedToday: 38,
    tokensUsedToday: 1780000,
    tokenBudgetToday: 2000000,
    successRateThisWeek: 97,
    avgSessionDurationMins: 82,
    lastActive: "2026-02-22T02:32:00Z",
  },
  {
    agentId: "xavier",
    agentName: "Xavier",
    agentEmoji: "🎯",
    role: "CTO",
    status: "idle",
    activeWorkItems: [],
    queuedCount: 2,
    completedToday: 8,
    tokensUsedToday: 87000,
    tokenBudgetToday: 500000,
    successRateThisWeek: 99,
    avgSessionDurationMins: 24,
    lastActive: "2026-02-22T01:45:00Z",
  },
  {
    agentId: "piper",
    agentName: "Piper",
    agentEmoji: "🧩",
    role: "UI Specialist",
    status: "busy",
    activeWorkItems: [
      { id: "wi-004", kind: "build", title: "ApiPlayground.tsx — Horizon UI view", startedAt: "2026-02-22T02:30:00Z", progress: 40, tokensBurned: 12000, estimatedCompletion: "2026-02-22T02:35:00Z" },
    ],
    queuedCount: 0,
    completedToday: 4,
    tokensUsedToday: 120000,
    tokenBudgetToday: 300000,
    successRateThisWeek: 91,
    avgSessionDurationMins: 4,
    lastActive: "2026-02-22T02:30:00Z",
  },
  {
    agentId: "reed",
    agentName: "Reed",
    agentEmoji: "📊",
    role: "State/Data Specialist",
    status: "busy",
    activeWorkItems: [
      { id: "wi-005", kind: "build", title: "WorkspaceSettings.tsx — Horizon UI view", startedAt: "2026-02-22T02:30:00Z", progress: 35, tokensBurned: 10000, estimatedCompletion: "2026-02-22T02:35:00Z" },
    ],
    queuedCount: 0,
    completedToday: 3,
    tokensUsedToday: 78000,
    tokenBudgetToday: 300000,
    successRateThisWeek: 93,
    avgSessionDurationMins: 3,
    lastActive: "2026-02-22T02:30:00Z",
  },
  {
    agentId: "wes",
    agentName: "Wes",
    agentEmoji: "⚡",
    role: "Performance Specialist",
    status: "idle",
    activeWorkItems: [],
    queuedCount: 0,
    completedToday: 4,
    tokensUsedToday: 102000,
    tokenBudgetToday: 300000,
    successRateThisWeek: 88,
    avgSessionDurationMins: 3,
    lastActive: "2026-02-22T02:04:00Z",
  },
  {
    agentId: "quinn",
    agentName: "Quinn",
    agentEmoji: "🎯",
    role: "Interaction Design",
    status: "idle",
    activeWorkItems: [],
    queuedCount: 0,
    completedToday: 2,
    tokensUsedToday: 130000,
    tokenBudgetToday: 300000,
    successRateThisWeek: 95,
    avgSessionDurationMins: 2,
    lastActive: "2026-02-22T02:03:00Z",
  },
  {
    agentId: "stephan",
    agentName: "Stephan",
    agentEmoji: "📣",
    role: "CMO",
    status: "offline",
    activeWorkItems: [],
    queuedCount: 1,
    completedToday: 1,
    tokensUsedToday: 12000,
    tokenBudgetToday: 300000,
    successRateThisWeek: 100,
    avgSessionDurationMins: 18,
    lastActive: "2026-02-21T20:00:00Z",
  },
  {
    agentId: "tim",
    agentName: "Tim",
    agentEmoji: "🏗️",
    role: "VP Architecture",
    status: "idle",
    activeWorkItems: [],
    queuedCount: 0,
    completedToday: 2,
    tokensUsedToday: 21000,
    tokenBudgetToday: 500000,
    successRateThisWeek: 98,
    avgSessionDurationMins: 31,
    lastActive: "2026-02-22T00:30:00Z",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<AgentStatus, string> = {
  online:  "bg-emerald-400",
  busy:    "bg-amber-400 animate-pulse",
  idle:    "bg-[var(--color-surface-3)]",
  offline: "bg-[var(--color-surface-3)]",
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  online:  "Online",
  busy:    "Busy",
  idle:    "Idle",
  offline: "Offline",
};

const KIND_EMOJIS: Record<WorkItemKind, string> = {
  session:    "💬",
  subagent:   "🤖",
  cron:       "⏰",
  "pr-review": "📝",
  build:      "🔨",
  analysis:   "📊",
};

function fmtTokens(n: number): string {
  if (n >= 1000000) {return `${(n / 1000000).toFixed(2)}M`;}
  if (n >= 1000) {return `${(n / 1000).toFixed(0)}K`;}
  return String(n);
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

function budgetPct(used: number, budget: number): number {
  return Math.min(100, Math.round((used / budget) * 100));
}

function budgetColor(pct: number): string {
  if (pct >= 90) {return "bg-rose-500";}
  if (pct >= 75) {return "bg-amber-400";}
  return "bg-emerald-400";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: AgentWorkloadData;
  selected: boolean;
  onSelect: () => void;
}

function AgentCard({ agent, selected, onSelect }: AgentCardProps) {
  const bPct = budgetPct(agent.tokensUsedToday, agent.tokenBudgetToday);

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${agent.agentName} — ${STATUS_LABELS[agent.status]}`}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all",
        "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
        selected
          ? "border-primary bg-indigo-950/30"
          : "border-[var(--color-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-border)]"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <span className="text-2xl">{agent.agentEmoji}</span>
            <span
              className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-border)]", STATUS_COLORS[agent.status])}
              aria-label={STATUS_LABELS[agent.status]}
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--color-text-primary)]">{agent.agentName}</p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">{agent.role}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold font-mono text-[var(--color-text-primary)]">{agent.completedToday}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">done today</p>
        </div>
      </div>

      {/* Token budget bar */}
      <div>
        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
          <span>Token budget</span>
          <span className="font-mono">{fmtTokens(agent.tokensUsedToday)} / {fmtTokens(agent.tokenBudgetToday)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", budgetColor(bPct))}
            style={{ width: `${bPct}%` }}
            role="progressbar"
            aria-valuenow={bPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Active indicator */}
      {agent.activeWorkItems.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
          <span className="text-[10px] text-amber-400">{agent.activeWorkItems.length} active item{agent.activeWorkItems.length > 1 ? "s" : ""}</span>
        </div>
      )}
    </button>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type StatusFilter = AgentStatus | "all";

export default function AgentWorkload() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(AGENTS[0].agentId);

  const filtered = useMemo(() => {
    return AGENTS.filter(a => {
      if (statusFilter !== "all" && a.status !== statusFilter) {return false;}
      return true;
    }).toSorted((a, b) => {
      const order: Record<AgentStatus, number> = { busy: 0, online: 1, idle: 2, offline: 3 };
      return order[a.status] - order[b.status];
    });
  }, [statusFilter]);

  const selected = useMemo(() => AGENTS.find(a => a.agentId === selectedId) ?? null, [selectedId]);

  const busyCount = AGENTS.filter(a => a.status === "busy").length;
  const idleCount = AGENTS.filter(a => a.status === "idle").length;
  const totalActive = AGENTS.reduce((acc, a) => acc + a.activeWorkItems.length, 0);

  const statuses: Array<{ value: StatusFilter; label: string }> = [
    { value: "all",     label: "All" },
    { value: "busy",    label: `Busy (${busyCount})` },
    { value: "idle",    label: `Idle (${idleCount})` },
    { value: "offline", label: "Offline" },
  ];

  return (
    <main className="flex h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden" role="main" aria-label="Agent Workload">
      {/* Left: Agent cards */}
      <div className="w-80 shrink-0 flex flex-col border-r border-[var(--color-border)] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border)]">
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Agent Workload</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {busyCount} busy · {totalActive} active items · {AGENTS.length} agents
          </p>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-[var(--color-border)]">
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
                    ? "border-primary bg-indigo-950/40 text-indigo-300"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2" role="list" aria-label="Agent workloads">
          {filtered.map(agent => (
            <div key={agent.agentId} role="listitem">
              <AgentCard
                agent={agent}
                selected={selectedId === agent.agentId}
                onSelect={() => setSelectedId(agent.agentId)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Right: Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <div className="space-y-5 max-w-2xl">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <span className="text-5xl">{selected.agentEmoji}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">{selected.agentName}</h2>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full border",
                      selected.status === "busy" ? "text-amber-400 bg-amber-400/10 border-amber-400/20" :
                      selected.status === "online" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" :
                      selected.status === "idle" ? "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/20" :
                      "text-[var(--color-text-muted)] bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/20"
                    )}>
                      {STATUS_LABELS[selected.status]}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">{selected.role}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Last active: {relTime(selected.lastActive)}</p>
                </div>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Done Today",    value: String(selected.completedToday),                  color: "text-[var(--color-text-primary)]" },
                { label: "Queued",        value: String(selected.queuedCount),                     color: "text-[var(--color-text-primary)]" },
                { label: "Success Rate",  value: `${selected.successRateThisWeek}%`,               color: selected.successRateThisWeek >= 90 ? "text-emerald-400" : "text-amber-400" },
                { label: "Avg Duration",  value: `${selected.avgSessionDurationMins}m`,            color: "text-[var(--color-text-primary)]" },
              ].map(k => (
                <div key={k.label} className="rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] p-3 text-center">
                  <p className={cn("text-xl font-bold font-mono", k.color)}>{k.value}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Token budget */}
            <div className="rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Token Budget (Today)</h3>
                <span className="text-sm font-mono text-[var(--color-text-primary)]">
                  {fmtTokens(selected.tokensUsedToday)} / {fmtTokens(selected.tokenBudgetToday)}
                  <span className="text-[var(--color-text-muted)] ml-2">({budgetPct(selected.tokensUsedToday, selected.tokenBudgetToday)}%)</span>
                </span>
              </div>
              <div className="h-3 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", budgetColor(budgetPct(selected.tokensUsedToday, selected.tokenBudgetToday)))}
                  style={{ width: `${budgetPct(selected.tokensUsedToday, selected.tokenBudgetToday)}%` }}
                  role="progressbar"
                  aria-valuenow={budgetPct(selected.tokensUsedToday, selected.tokenBudgetToday)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Token budget used"
                />
              </div>
            </div>

            {/* Active work items */}
            <div className="rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Active Work</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {selected.activeWorkItems.length} active · {selected.queuedCount} queued
                </p>
              </div>
              {selected.activeWorkItems.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-2xl mb-1">😴</p>
                  <p className="text-sm text-[var(--color-text-muted)]">No active work items</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {selected.activeWorkItems.map(item => (
                    <div key={item.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span>{KIND_EMOJIS[item.kind]}</span>
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.title}</p>
                        </div>
                        <span className="text-xs text-[var(--color-text-muted)] shrink-0 font-mono">{fmtTokens(item.tokensBurned)}</span>
                      </div>
                      {item.progress !== undefined && (
                        <>
                          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1">
                            <span>{relTime(item.startedAt)}</span>
                            <span>{item.progress}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${item.progress}%` }}
                              role="progressbar"
                              aria-valuenow={item.progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </div>
                        </>
                      )}
                      {item.estimatedCompletion && (
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                          ETA: {new Date(item.estimatedCompletion).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-5xl mb-4">👥</p>
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">Select an agent</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Choose an agent to view their workload details</p>
          </div>
        )}
      </div>
    </main>
  );
}
