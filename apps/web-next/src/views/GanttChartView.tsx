import React, { useState } from "react";
import { cn } from "../lib/utils";

type TaskStatus = "todo" | "in-progress" | "done" | "blocked" | "at-risk";
type TaskGroup = "research" | "design" | "implementation" | "testing" | "deployment";

interface GanttTask {
  id: string;
  name: string;
  group: TaskGroup;
  status: TaskStatus;
  startDay: number; // day offset from sprint start (0-based)
  durationDays: number;
  assignee: string;
  dependencies: string[];
  progress: number; // 0-100
  priority: "critical" | "high" | "medium" | "low";
  description: string;
}

interface GanttMilestone {
  id: string;
  name: string;
  day: number;
  type: "sprint-start" | "sprint-end" | "release" | "review";
}

const SPRINT_DAYS = 28; // 4-week sprint
const SPRINT_START = new Date("2026-02-03");

const TASKS: GanttTask[] = [
  // Research
  { id: "t1",  name: "UX Research: Admin Flows",         group: "research",       status: "done",        startDay: 0,  durationDays: 3,  assignee: "Luis",  dependencies: [],          progress: 100, priority: "high",     description: "User interviews and task analysis for admin workflows" },
  { id: "t2",  name: "Competitive Analysis",             group: "research",       status: "done",        startDay: 1,  durationDays: 2,  assignee: "Quinn", dependencies: [],          progress: 100, priority: "medium",   description: "Benchmark 5 competitor products" },
  { id: "t3",  name: "Information Architecture Audit",   group: "research",       status: "done",        startDay: 2,  durationDays: 3,  assignee: "Piper", dependencies: ["t1"],      progress: 100, priority: "high",     description: "Audit current nav tree and propose restructure" },
  // Design
  { id: "t4",  name: "Design System Component Audit",    group: "design",         status: "done",        startDay: 5,  durationDays: 4,  assignee: "Luis",  dependencies: ["t3"],      progress: 100, priority: "critical", description: "Inventory all existing components, identify gaps" },
  { id: "t5",  name: "Wireframes: Dashboard Redesign",   group: "design",         status: "done",        startDay: 7,  durationDays: 5,  assignee: "Piper", dependencies: ["t4"],      progress: 100, priority: "critical", description: "Low-fidelity wireframes for new dashboard shell" },
  { id: "t6",  name: "High-Fidelity Mockups",            group: "design",         status: "done",        startDay: 12, durationDays: 4,  assignee: "Luis",  dependencies: ["t5"],      progress: 100, priority: "critical", description: "Figma comps for all 10 primary views" },
  { id: "t7",  name: "Prototype & Stakeholder Review",   group: "design",         status: "done",        startDay: 16, durationDays: 2,  assignee: "Luis",  dependencies: ["t6"],      progress: 100, priority: "high",     description: "Interactive Figma prototype + Xavier sign-off" },
  // Implementation
  { id: "t8",  name: "Setup Vite + React Shell",         group: "implementation", status: "done",        startDay: 4,  durationDays: 2,  assignee: "Reed",  dependencies: [],          progress: 100, priority: "critical", description: "Create web-next app with routing, dark theme, Tailwind" },
  { id: "t9",  name: "Core Layout + Navigation",         group: "implementation", status: "done",        startDay: 6,  durationDays: 3,  assignee: "Wes",   dependencies: ["t8"],      progress: 100, priority: "critical", description: "Collapsible sidebar, top bar, breadcrumbs, search" },
  { id: "t10", name: "View Suite: Views 1-50",           group: "implementation", status: "done",        startDay: 9,  durationDays: 6,  assignee: "Luis",  dependencies: ["t9"],      progress: 100, priority: "critical", description: "Sprint building 50 production-ready views" },
  { id: "t11", name: "View Suite: Views 51-100",         group: "implementation", status: "done",        startDay: 15, durationDays: 5,  assignee: "Luis",  dependencies: ["t10"],     progress: 100, priority: "critical", description: "Push to 100 views milestone 🏆" },
  { id: "t12", name: "View Suite: Views 101-125+",       group: "implementation", status: "in-progress", startDay: 20, durationDays: 6,  assignee: "Luis",  dependencies: ["t11"],     progress: 72,  priority: "critical", description: "Current sprint — continuous view expansion" },
  { id: "t13", name: "State Management Layer",           group: "implementation", status: "done",        startDay: 10, durationDays: 4,  assignee: "Quinn", dependencies: ["t9"],      progress: 100, priority: "high",     description: "Zustand stores for nav, user preferences, cache" },
  { id: "t14", name: "API Integration Layer",            group: "implementation", status: "in-progress", startDay: 18, durationDays: 5,  assignee: "Sam",   dependencies: ["t13"],     progress: 45,  priority: "high",     description: "Connect views to live API endpoints via SWR" },
  { id: "t15", name: "Performance Optimization",         group: "implementation", status: "at-risk",     startDay: 23, durationDays: 3,  assignee: "Wes",   dependencies: ["t12"],     progress: 10,  priority: "medium",   description: "Bundle analysis, code splitting, lazy load audit" },
  // Testing
  { id: "t16", name: "Unit Test Suite",                  group: "testing",        status: "in-progress", startDay: 14, durationDays: 8,  assignee: "Reed",  dependencies: ["t9"],      progress: 60,  priority: "high",     description: "Vitest coverage for all utility functions and hooks" },
  { id: "t17", name: "E2E Tests: Critical Flows",        group: "testing",        status: "todo",        startDay: 22, durationDays: 4,  assignee: "Quinn", dependencies: ["t12"],     progress: 0,   priority: "high",     description: "Playwright E2E tests for 10 critical user flows" },
  { id: "t18", name: "A11y Audit & Remediation",         group: "testing",        status: "in-progress", startDay: 20, durationDays: 5,  assignee: "Quinn", dependencies: ["t12"],     progress: 30,  priority: "high",     description: "WCAG 2.1 AA compliance audit and fixes" },
  { id: "t19", name: "Cross-Browser Testing",            group: "testing",        status: "todo",        startDay: 25, durationDays: 2,  assignee: "Wes",   dependencies: ["t17"],     progress: 0,   priority: "medium",   description: "Chrome, Firefox, Safari, Edge — desktop & mobile" },
  // Deployment
  { id: "t20", name: "Preview Deployment (Cloudflare)",  group: "deployment",     status: "done",        startDay: 8,  durationDays: 1,  assignee: "Reed",  dependencies: ["t9"],      progress: 100, priority: "medium",   description: "Continuous preview deploys on branch push" },
  { id: "t21", name: "Staging Release",                  group: "deployment",     status: "todo",        startDay: 25, durationDays: 2,  assignee: "Reed",  dependencies: ["t19","t17"], progress: 0, priority: "high",     description: "Deploy to staging for final QA pass" },
  { id: "t22", name: "Production Release v2.0",          group: "deployment",     status: "todo",        startDay: 27, durationDays: 1,  assignee: "Luis",  dependencies: ["t21"],     progress: 0,   priority: "critical", description: "Tag v2.0, merge to main, deploy to prod" },
];

const MILESTONES: GanttMilestone[] = [
  { id: "m1", name: "Sprint Start",    day: 0,  type: "sprint-start" },
  { id: "m2", name: "100 Views 🏆",   day: 18, type: "review" },
  { id: "m3", name: "API Freeze",      day: 22, type: "review" },
  { id: "m4", name: "Release v2.0",    day: 27, type: "release" },
  { id: "m5", name: "Sprint End",      day: 27, type: "sprint-end" },
];

const STATUS_CONFIG: Record<TaskStatus, { label: string; barColor: string; textColor: string; bg: string }> = {
  "todo":        { label: "Todo",        barColor: "bg-[var(--color-surface-3)]",    textColor: "text-[var(--color-text-secondary)]",   bg: "bg-[var(--color-surface-2)]" },
  "in-progress": { label: "In Progress", barColor: "bg-indigo-500",  textColor: "text-indigo-400", bg: "bg-indigo-900/30" },
  "done":        { label: "Done",        barColor: "bg-emerald-500", textColor: "text-emerald-400", bg: "bg-emerald-900/30" },
  "blocked":     { label: "Blocked",     barColor: "bg-rose-500",    textColor: "text-rose-400",   bg: "bg-rose-900/30" },
  "at-risk":     { label: "At Risk",     barColor: "bg-amber-500",   textColor: "text-amber-400",  bg: "bg-amber-900/30" },
};

const GROUP_CONFIG: Record<TaskGroup, { label: string; emoji: string; color: string }> = {
  research:       { label: "Research",       emoji: "🔍", color: "text-purple-400" },
  design:         { label: "Design",         emoji: "🎨", color: "text-pink-400" },
  implementation: { label: "Implementation", emoji: "⚙️", color: "text-sky-400" },
  testing:        { label: "Testing",        emoji: "🧪", color: "text-amber-400" },
  deployment:     { label: "Deployment",     emoji: "🚀", color: "text-emerald-400" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: "P0", color: "text-rose-400" },
  high:     { label: "P1", color: "text-orange-400" },
  medium:   { label: "P2", color: "text-amber-400" },
  low:      { label: "P3", color: "text-[var(--color-text-secondary)]" },
};

const ASSIGNEE_COLORS: Record<string, string> = {
  Luis:  "bg-indigo-500",
  Quinn: "bg-purple-500",
  Piper: "bg-pink-500",
  Reed:  "bg-teal-500",
  Wes:   "bg-amber-500",
  Sam:   "bg-sky-500",
};

type ViewMode = "gantt" | "list" | "summary";

function dayLabel(day: number): string {
  const d = new Date(SPRINT_START);
  d.setDate(d.getDate() + day);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function GanttChartView() {
  const [viewMode, setViewMode] = useState<ViewMode>("gantt");
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [groupFilter, setGroupFilter] = useState<TaskGroup | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [showMilestones, setShowMilestones] = useState(true);

  const filteredTasks = TASKS.filter(t => {
    if (groupFilter !== "all" && t.group !== groupFilter) {return false;}
    if (statusFilter !== "all" && t.status !== statusFilter) {return false;}
    return true;
  });

  const groups = (["research", "design", "implementation", "testing", "deployment"] as TaskGroup[]);

  // Today marker: day 19 (based on our sprint start)
  const todayDay = 19;

  const doneCount = TASKS.filter(t => t.status === "done").length;
  const inProgressCount = TASKS.filter(t => t.status === "in-progress").length;
  const blockedCount = TASKS.filter(t => t.status === "blocked" || t.status === "at-risk").length;
  const overallProgress = Math.round(TASKS.reduce((a, t) => a + t.progress, 0) / TASKS.length);

  const tasksByGroup = groups.map(g => ({
    group: g,
    tasks: filteredTasks.filter(t => t.group === g),
  })).filter(g => g.tasks.length > 0);

  // Column width: each day = 32px in gantt
  const DAY_W = 32;

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Project Timeline</h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">
              Horizon UI v2.0 Sprint · {new Date(SPRINT_START).toLocaleDateString()} – {new Date(new Date(SPRINT_START).setDate(SPRINT_START.getDate() + SPRINT_DAYS - 1)).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(["gantt", "list", "summary"] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize",
                  viewMode === mode
                    ? "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {mode === "gantt" ? "📊 Gantt" : mode === "list" ? "📋 List" : "📈 Summary"}
              </button>
            ))}
            <button
              onClick={() => setShowMilestones(!showMilestones)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg border transition-colors",
                showMilestones ? "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-primary)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
              )}
            >
              🏁 Milestones
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-3 text-center">
            <div className={cn("text-3xl font-bold", overallProgress >= 80 ? "text-emerald-400" : overallProgress >= 50 ? "text-indigo-400" : "text-amber-400")}>
              {overallProgress}%
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Overall Progress</div>
          </div>
          {[
            { label: "Done",        value: doneCount,       color: "text-emerald-400" },
            { label: "In Progress", value: inProgressCount, color: "text-indigo-400" },
            { label: "At Risk",     value: blockedCount,    color: "text-amber-400" },
            { label: "Total Tasks", value: TASKS.length,    color: "text-[var(--color-text-primary)]" },
          ].map(s => (
            <div key={s.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-3 text-center">
              <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Overall progress bar */}
        <div className="mt-3 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-2">
            <span>Sprint Progress</span>
            <span>Day {todayDay} of {SPRINT_DAYS}</span>
          </div>
          <div className="bg-[var(--color-surface-2)] rounded-full h-2">
            <div
              className="h-full bg-indigo-500 rounded-full relative"
              style={{ width: `${(todayDay / SPRINT_DAYS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
          <button
            onClick={() => setGroupFilter("all")}
            className={cn("px-2 py-1 text-xs rounded transition-colors", groupFilter === "all" ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}
          >All</button>
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={cn("px-2 py-1 text-xs rounded transition-colors", groupFilter === g ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}
            >
              {GROUP_CONFIG[g].emoji} {GROUP_CONFIG[g].label}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-[var(--color-surface-3)]" />
        <div className="flex gap-1">
          {(["all", "in-progress", "at-risk", "todo", "done"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn("px-2 py-1 text-xs rounded transition-colors",
                statusFilter === s ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {s === "all" ? "All Status" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Gantt View */}
      {viewMode === "gantt" && (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          {/* Header: day columns */}
          <div className="flex border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-surface-1)] z-10">
            <div className="w-56 shrink-0 px-3 py-2 text-xs text-[var(--color-text-muted)] font-semibold border-r border-[var(--color-border)]">
              Task
            </div>
            <div className="flex-1 overflow-x-auto">
              <div className="flex" style={{ width: SPRINT_DAYS * DAY_W }}>
                {Array.from({ length: SPRINT_DAYS }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-center text-xs py-2 border-r border-[var(--color-border)]/50",
                      i === todayDay ? "bg-indigo-900/30 text-indigo-400" : "text-[var(--color-text-muted)]"
                    )}
                    style={{ width: DAY_W, minWidth: DAY_W }}
                  >
                    {i % 7 === 0 || i === todayDay ? dayLabel(i) : ""}
                    {i === todayDay && <div className="text-indigo-400 text-xs">▼</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Task rows */}
          <div className="overflow-x-auto">
            {tasksByGroup.map(({ group, tasks }) => (
              <React.Fragment key={group}>
                {/* Group header */}
                <div className="flex border-b border-[var(--color-border)]/50 bg-[var(--color-surface-2)]/30">
                  <div className="w-56 shrink-0 px-3 py-1.5 text-xs font-semibold border-r border-[var(--color-border)] flex items-center gap-2">
                    <span>{GROUP_CONFIG[group].emoji}</span>
                    <span className={GROUP_CONFIG[group].color}>{GROUP_CONFIG[group].label}</span>
                    <span className="text-[var(--color-text-muted)] ml-auto">{tasks.length}</span>
                  </div>
                  <div style={{ width: SPRINT_DAYS * DAY_W, minWidth: SPRINT_DAYS * DAY_W }} />
                </div>

                {/* Tasks in group */}
                {tasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                    className={cn(
                      "flex border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-2)]/20 cursor-pointer",
                      selectedTask?.id === task.id ? "bg-[var(--color-surface-2)]/40" : ""
                    )}
                  >
                    {/* Task name column */}
                    <div className="w-56 shrink-0 px-3 py-2 border-r border-[var(--color-border)] flex items-center gap-2 min-h-10">
                      <div className={cn("w-2 h-2 rounded-full shrink-0", STATUS_CONFIG[task.status].barColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[var(--color-text-primary)] truncate">{task.name}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className={cn("w-3 h-3 rounded-full text-xs flex items-center justify-center text-[var(--color-text-primary)] font-bold shrink-0", ASSIGNEE_COLORS[task.assignee] ?? "bg-[var(--color-surface-3)]")} style={{ fontSize: "7px" }}>
                            {task.assignee[0]}
                          </div>
                          <span className="text-[var(--color-text-muted)] text-xs">{task.assignee}</span>
                          <span className={cn("text-xs ml-auto", PRIORITY_CONFIG[task.priority].color)}>{PRIORITY_CONFIG[task.priority].label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Gantt bar column */}
                    <div className="flex-1 relative" style={{ width: SPRINT_DAYS * DAY_W, minWidth: SPRINT_DAYS * DAY_W, height: 40 }}>
                      {/* Today line */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-indigo-500/40 pointer-events-none"
                        style={{ left: todayDay * DAY_W }}
                      />
                      {/* Milestones */}
                      {showMilestones && MILESTONES.map(m => (
                        <div
                          key={m.id}
                          className="absolute top-0 bottom-0 w-px pointer-events-none"
                          style={{
                            left: m.day * DAY_W,
                            backgroundColor: m.type === "release" ? "rgba(251,113,133,0.3)" : "rgba(251,191,36,0.2)"
                          }}
                        />
                      ))}
                      {/* Task bar */}
                      <div
                        className={cn("absolute rounded h-6 top-2 flex items-center overflow-hidden", STATUS_CONFIG[task.status].barColor)}
                        style={{
                          left: task.startDay * DAY_W + 2,
                          width: Math.max(task.durationDays * DAY_W - 4, 8),
                        }}
                      >
                        {/* Progress overlay */}
                        {task.progress > 0 && task.progress < 100 && (
                          <div
                            className="absolute top-0 left-0 bottom-0 bg-white/20"
                            style={{ width: `${task.progress}%` }}
                          />
                        )}
                        <span className="text-xs text-[var(--color-text-primary)]/80 px-1 truncate font-medium" style={{ fontSize: "10px" }}>
                          {task.progress > 0 ? `${task.progress}%` : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}

            {/* Milestones row */}
            {showMilestones && (
              <div className="flex border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/20">
                <div className="w-56 shrink-0 px-3 py-2 border-r border-[var(--color-border)] text-xs text-[var(--color-text-muted)] font-semibold">
                  🏁 Milestones
                </div>
                <div className="flex-1 relative" style={{ width: SPRINT_DAYS * DAY_W, minWidth: SPRINT_DAYS * DAY_W, height: 32 }}>
                  {MILESTONES.map(m => (
                    <div
                      key={m.id}
                      className="absolute top-1 text-xs whitespace-nowrap"
                      style={{ left: m.day * DAY_W }}
                    >
                      <div className={cn("w-0 h-0 mx-auto mb-0.5", m.type === "release" ? "text-rose-400" : "text-amber-400")}>◆</div>
                      <div className={cn("text-xs px-1", m.type === "release" ? "text-rose-400" : "text-amber-400")} style={{ fontSize: "9px" }}>
                        {m.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center gap-4 flex-wrap">
            {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG[TaskStatus]][]).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={cn("w-3 h-2 rounded-sm", cfg.barColor)} />
                <span className="text-xs text-[var(--color-text-secondary)]">{cfg.label}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <div className="w-3 h-px bg-indigo-500" />
              <span>Today (Day {todayDay})</span>
            </div>
          </div>
        </div>
      )}

      {/* Task detail panel */}
      {selectedTask && (
        <div className="mt-4 bg-[var(--color-surface-1)] border border-indigo-800 rounded-lg p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-xs px-2 py-0.5 rounded font-medium", STATUS_CONFIG[selectedTask.status].textColor, STATUS_CONFIG[selectedTask.status].bg)}>
                  {STATUS_CONFIG[selectedTask.status].label}
                </span>
                <span className={cn("text-xs font-semibold", PRIORITY_CONFIG[selectedTask.priority].color)}>
                  {PRIORITY_CONFIG[selectedTask.priority].label} — {selectedTask.priority.charAt(0).toUpperCase() + selectedTask.priority.slice(1)}
                </span>
              </div>
              <div className="text-lg font-semibold text-[var(--color-text-primary)]">{selectedTask.name}</div>
            </div>
            <button onClick={() => setSelectedTask(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg">✕</button>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            {[
              { label: "Assignee", value: selectedTask.assignee },
              { label: "Group", value: GROUP_CONFIG[selectedTask.group].label },
              { label: "Duration", value: `${selectedTask.durationDays} days` },
              { label: "Progress", value: `${selectedTask.progress}%` },
            ].map(item => (
              <div key={item.label} className="bg-[var(--color-surface-0)] rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">{item.label}</div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="mb-3">
            <div className="text-xs text-[var(--color-text-muted)] mb-2">Progress</div>
            <div className="bg-[var(--color-surface-2)] rounded-full h-2">
              <div className={cn("h-full rounded-full", STATUS_CONFIG[selectedTask.status].barColor)} style={{ width: `${selectedTask.progress}%` }} />
            </div>
          </div>

          <p className="text-sm text-[var(--color-text-primary)]">{selectedTask.description}</p>

          {selectedTask.dependencies.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-[var(--color-text-muted)] mb-1">Dependencies</div>
              <div className="flex flex-wrap gap-1">
                {selectedTask.dependencies.map(depId => {
                  const dep = TASKS.find(t => t.id === depId);
                  return dep ? (
                    <span key={depId} className="text-xs px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-primary)]">
                      → {dep.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["Task", "Group", "Status", "Progress", "Assignee", "Start", "Duration", "Priority"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => (
                <tr key={task.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/30">
                  <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium text-sm max-w-48">
                    <div className="truncate">{task.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)] truncate">{task.description}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={cn("font-medium", GROUP_CONFIG[task.group].color)}>
                      {GROUP_CONFIG[task.group].emoji} {GROUP_CONFIG[task.group].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded", STATUS_CONFIG[task.status].textColor, STATUS_CONFIG[task.status].bg)}>
                      {STATUS_CONFIG[task.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-[var(--color-surface-2)] rounded-full h-1.5">
                        <div className={cn("h-full rounded-full", STATUS_CONFIG[task.status].barColor)} style={{ width: `${task.progress}%` }} />
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)]">{task.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-primary)]">{task.assignee}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{dayLabel(task.startDay)}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{task.durationDays}d</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-semibold", PRIORITY_CONFIG[task.priority].color)}>
                      {PRIORITY_CONFIG[task.priority].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary View */}
      {viewMode === "summary" && (
        <div className="grid grid-cols-2 gap-4">
          {/* By group */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
            <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Progress by Group</div>
            {groups.map(g => {
              const groupTasks = TASKS.filter(t => t.group === g);
              const groupProgress = Math.round(groupTasks.reduce((a, t) => a + t.progress, 0) / groupTasks.length);
              return (
                <div key={g} className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-sm font-medium", GROUP_CONFIG[g].color)}>
                      {GROUP_CONFIG[g].emoji} {GROUP_CONFIG[g].label}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{groupProgress}%</span>
                  </div>
                  <div className="bg-[var(--color-surface-2)] rounded-full h-2">
                    <div className={cn("h-full rounded-full", groupProgress === 100 ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${groupProgress}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-0.5">
                    <span>{groupTasks.filter(t => t.status === "done").length}/{groupTasks.length} done</span>
                    <span>{groupTasks.filter(t => t.status === "in-progress").length} in progress</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* By assignee */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
            <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">By Assignee</div>
            {Object.keys(ASSIGNEE_COLORS).map(assignee => {
              const assigneeTasks = TASKS.filter(t => t.assignee === assignee);
              if (assigneeTasks.length === 0) {return null;}
              const progress = Math.round(assigneeTasks.reduce((a, t) => a + t.progress, 0) / assigneeTasks.length);
              return (
                <div key={assignee} className="flex items-center gap-3 mb-3">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-text-primary)] text-xs font-bold shrink-0", ASSIGNEE_COLORS[assignee])}>
                    {assignee[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--color-text-primary)]">{assignee}</span>
                      <span className="text-[var(--color-text-muted)]">{assigneeTasks.length} tasks · {progress}%</span>
                    </div>
                    <div className="bg-[var(--color-surface-2)] rounded-full h-1.5">
                      <div className={cn("h-full rounded-full", ASSIGNEE_COLORS[assignee])} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
