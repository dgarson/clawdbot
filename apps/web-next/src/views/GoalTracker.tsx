import React, { useState } from "react";
import { cn } from "../lib/utils";

type GoalStatus = "not-started" | "in-progress" | "at-risk" | "complete" | "paused";
type GoalTimeframe = "weekly" | "monthly" | "quarterly" | "annual";
type MilestoneStatus = "pending" | "complete" | "missed";

interface Milestone {
  id: string;
  label: string;
  dueDate: string;
  status: MilestoneStatus;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  owner: string;
  timeframe: GoalTimeframe;
  status: GoalStatus;
  progress: number; // 0-100
  startDate: string;
  dueDate: string;
  milestones: Milestone[];
  tags: string[];
  parentId?: string; // for sub-goals
}

const GOALS: Goal[] = [
  {
    id: "g-001",
    title: "Ship Horizon UI — 100+ views",
    description: "Build and ship a comprehensive admin UI with 100+ production-ready views before Q1 end. Each view must be fully typed, accessible, and build-clean.",
    owner: "Luis",
    timeframe: "quarterly",
    status: "in-progress",
    progress: 75,
    startDate: "2026-02-01",
    dueDate: "2026-03-31",
    tags: ["frontend", "design-system", "sprint"],
    milestones: [
      { id: "m1", label: "25 views shipped", dueDate: "2026-02-10", status: "complete" },
      { id: "m2", label: "50 views shipped", dueDate: "2026-02-20", status: "complete" },
      { id: "m3", label: "75 views shipped", dueDate: "2026-03-01", status: "pending" },
      { id: "m4", label: "100 views shipped", dueDate: "2026-03-15", status: "pending" },
    ],
  },
  {
    id: "g-002",
    title: "Design system component coverage",
    description: "Ensure all 25 core design system components have documented variants, accessibility specs, and are used consistently across all views.",
    owner: "Piper",
    timeframe: "quarterly",
    status: "in-progress",
    progress: 60,
    startDate: "2026-02-01",
    dueDate: "2026-03-31",
    tags: ["design-system", "accessibility"],
    milestones: [
      { id: "m1", label: "Component audit complete", dueDate: "2026-02-15", status: "complete" },
      { id: "m2", label: "Variant docs written", dueDate: "2026-03-01", status: "pending" },
      { id: "m3", label: "A11y specs done", dueDate: "2026-03-20", status: "pending" },
    ],
  },
  {
    id: "g-003",
    title: "Agent session latency < 200ms p95",
    description: "Reduce agent session startup latency from current 480ms p95 to under 200ms p95 through gateway optimization and caching.",
    owner: "Tim",
    timeframe: "monthly",
    status: "at-risk",
    progress: 35,
    startDate: "2026-02-01",
    dueDate: "2026-02-28",
    tags: ["performance", "backend", "gateway"],
    milestones: [
      { id: "m1", label: "Baseline measurement", dueDate: "2026-02-05", status: "complete" },
      { id: "m2", label: "Gateway caching PoC", dueDate: "2026-02-15", status: "missed" },
      { id: "m3", label: "Latency target hit in staging", dueDate: "2026-02-25", status: "pending" },
    ],
  },
  {
    id: "g-004",
    title: "Zero-downtime deploy pipeline",
    description: "Implement blue-green deployment with automated health checks and instant rollback capability.",
    owner: "Tim",
    timeframe: "quarterly",
    status: "not-started",
    progress: 0,
    startDate: "2026-03-01",
    dueDate: "2026-03-31",
    tags: ["infrastructure", "devops"],
    milestones: [
      { id: "m1", label: "Architecture design", dueDate: "2026-03-07", status: "pending" },
      { id: "m2", label: "Staging implementation", dueDate: "2026-03-20", status: "pending" },
      { id: "m3", label: "Production cutover", dueDate: "2026-03-31", status: "pending" },
    ],
  },
  {
    id: "g-005",
    title: "Weekly UX standup ritual",
    description: "Establish a recurring weekly UX review where squad shares WIP, gets feedback, and aligns on design direction.",
    owner: "Luis",
    timeframe: "weekly",
    status: "complete",
    progress: 100,
    startDate: "2026-01-15",
    dueDate: "2026-02-15",
    tags: ["process", "team"],
    milestones: [
      { id: "m1", label: "First standup run", dueDate: "2026-01-20", status: "complete" },
      { id: "m2", label: "Template created", dueDate: "2026-01-27", status: "complete" },
      { id: "m3", label: "Squad buyin (all attend)", dueDate: "2026-02-10", status: "complete" },
    ],
  },
  {
    id: "g-006",
    title: "Model cost per session < $0.05",
    description: "Reduce average model cost per agent session through smart routing, caching, and model selection optimization.",
    owner: "Xavier",
    timeframe: "monthly",
    status: "in-progress",
    progress: 55,
    startDate: "2026-02-01",
    dueDate: "2026-02-28",
    tags: ["cost", "model-routing"],
    milestones: [
      { id: "m1", label: "Cost baseline established", dueDate: "2026-02-05", status: "complete" },
      { id: "m2", label: "Routing rules deployed", dueDate: "2026-02-18", status: "complete" },
      { id: "m3", label: "Target cost achieved", dueDate: "2026-02-28", status: "pending" },
    ],
  },
  {
    id: "g-007",
    title: "Accessibility audit pass",
    description: "All Horizon UI views pass WCAG 2.1 AA automated audit with 0 critical violations.",
    owner: "Reed",
    timeframe: "quarterly",
    status: "paused",
    progress: 20,
    startDate: "2026-02-01",
    dueDate: "2026-03-31",
    tags: ["accessibility", "frontend", "compliance"],
    milestones: [
      { id: "m1", label: "Audit tool setup", dueDate: "2026-02-10", status: "complete" },
      { id: "m2", label: "First 25 views audited", dueDate: "2026-02-28", status: "pending" },
      { id: "m3", label: "All views audited + fixed", dueDate: "2026-03-25", status: "pending" },
    ],
  },
];

const STATUS_BADGE: Record<GoalStatus, string> = {
  "not-started": "bg-zinc-700 text-zinc-300",
  "in-progress": "bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30",
  "at-risk": "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30",
  "complete": "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  "paused": "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
};

const STATUS_LABEL: Record<GoalStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  "at-risk": "At risk",
  "complete": "Complete",
  "paused": "Paused",
};

const MILESTONE_STATUS_STYLES: Record<MilestoneStatus, string> = {
  pending: "text-zinc-500",
  complete: "text-emerald-400",
  missed: "text-rose-400",
};

const MILESTONE_ICON: Record<MilestoneStatus, string> = {
  pending: "○",
  complete: "✓",
  missed: "✗",
};

const TIMEFRAME_COLORS: Record<GoalTimeframe, string> = {
  weekly: "text-sky-400",
  monthly: "text-violet-400",
  quarterly: "text-indigo-400",
  annual: "text-amber-400",
};

export default function GoalTracker() {
  const [selectedId, setSelectedId] = useState<string>("g-001");
  const [statusFilter, setStatusFilter] = useState<GoalStatus | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  const owners = Array.from(new Set(GOALS.map((g) => g.owner)));
  const filtered = GOALS.filter((g) => {
    if (statusFilter !== "all" && g.status !== statusFilter) return false;
    if (ownerFilter !== "all" && g.owner !== ownerFilter) return false;
    return true;
  });

  const selected = GOALS.find((g) => g.id === selectedId) ?? GOALS[0];

  const overallProgress = Math.round(GOALS.reduce((a, g) => a + g.progress, 0) / GOALS.length);
  const atRiskCount = GOALS.filter((g) => g.status === "at-risk").length;
  const completeCount = GOALS.filter((g) => g.status === "complete").length;

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white">Goal Tracker</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {GOALS.length} goals · {completeCount} complete · {atRiskCount} at risk · {overallProgress}% avg progress
          </p>
        </div>
        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Filter by owner"
          >
            <option value="all">All owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <div className="flex gap-1">
            {(["all", "in-progress", "at-risk", "complete", "paused"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  statusFilter === s ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                )}
              >
                {s === "all" ? "All" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Goal list */}
        <ul className="w-72 shrink-0 border-r border-zinc-800 overflow-y-auto divide-y divide-zinc-800/50" role="listbox" aria-label="Goals">
          {filtered.map((goal) => (
            <li key={goal.id}>
              <button
                role="option"
                aria-selected={goal.id === selectedId}
                onClick={() => setSelectedId(goal.id)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
                  goal.id === selectedId && "bg-zinc-800 border-l-2 border-indigo-500"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200 leading-tight flex-1">{goal.title}</span>
                  <span className={cn("shrink-0 text-xs px-1.5 py-0.5 rounded font-medium", STATUS_BADGE[goal.status])}>
                    {STATUS_LABEL[goal.status]}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-500">{goal.owner}</span>
                    <span className={cn("font-medium", goal.progress >= 70 ? "text-emerald-400" : goal.progress >= 40 ? "text-amber-400" : "text-zinc-400")}>
                      {goal.progress}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        goal.status === "at-risk" ? "bg-rose-500" :
                        goal.status === "complete" ? "bg-emerald-500" :
                        goal.status === "paused" ? "bg-amber-500" :
                        "bg-indigo-500"
                      )}
                      style={{ width: `${goal.progress}%` }}
                      role="progressbar"
                      aria-valuenow={goal.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={cn("text-xs", TIMEFRAME_COLORS[goal.timeframe])}>{goal.timeframe}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-xs text-zinc-600">due {goal.dueDate}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {/* Goal detail */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">{selected.title}</h2>
              <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{selected.description}</p>
            </div>
            <span className={cn("shrink-0 text-xs px-2 py-1 rounded font-medium", STATUS_BADGE[selected.status])}>
              {STATUS_LABEL[selected.status]}
            </span>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Owner", value: selected.owner },
              { label: "Timeframe", value: selected.timeframe, color: TIMEFRAME_COLORS[selected.timeframe] },
              { label: "Start", value: selected.startDate },
              { label: "Due", value: selected.dueDate },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-zinc-900 rounded-lg border border-zinc-800 p-3">
                <div className="text-xs text-zinc-500 mb-0.5">{label}</div>
                <div className={cn("text-sm font-medium", color ?? "text-zinc-200")}>{value}</div>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Progress</span>
              <span className={cn(
                "text-2xl font-bold",
                selected.status === "at-risk" ? "text-rose-400" :
                selected.status === "complete" ? "text-emerald-400" :
                selected.status === "paused" ? "text-amber-400" :
                "text-indigo-400"
              )}>
                {selected.progress}%
              </span>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  selected.status === "at-risk" ? "bg-rose-500" :
                  selected.status === "complete" ? "bg-emerald-500" :
                  selected.status === "paused" ? "bg-amber-500" :
                  "bg-indigo-500"
                )}
                style={{ width: `${selected.progress}%` }}
                role="progressbar"
                aria-valuenow={selected.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress: ${selected.progress}%`}
              />
            </div>
          </div>

          {/* Milestones */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Milestones
            </div>
            <ul className="divide-y divide-zinc-800/50">
              {selected.milestones.map((ms) => (
                <li key={ms.id} className="px-4 py-3 flex items-center gap-3">
                  <span className={cn("text-sm font-bold w-4", MILESTONE_STATUS_STYLES[ms.status])}>
                    {MILESTONE_ICON[ms.status]}
                  </span>
                  <span className={cn("flex-1 text-xs", ms.status === "complete" ? "text-zinc-300" : ms.status === "missed" ? "text-zinc-500 line-through" : "text-zinc-200")}>
                    {ms.label}
                  </span>
                  <span className="text-xs text-zinc-600">{ms.dueDate}</span>
                  <span className={cn("text-xs font-medium capitalize", MILESTONE_STATUS_STYLES[ms.status])}>
                    {ms.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tags */}
          {selected.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500">Tags:</span>
              {selected.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
