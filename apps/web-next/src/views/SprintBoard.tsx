import React, { useState } from "react"
import { cn } from "../lib/utils"

type Priority = "P0" | "P1" | "P2" | "P3"
type Label = "bug" | "feat" | "chore" | "docs"
type ColumnId = "backlog" | "in-progress" | "review" | "done"

interface SubTask {
  id: string
  text: string
  done: boolean
}

interface Task {
  id: string
  title: string
  description: string
  assignee: string
  priority: Priority
  labels: Label[]
  points: number
  ageDays: number
  column: ColumnId
  subTasks: SubTask[]
  comments: number
}

interface ColumnDef {
  id: ColumnId
  title: string
  emoji: string
}

const COLUMNS: ColumnDef[] = [
  { id: "backlog", title: "Backlog", emoji: "📋" },
  { id: "in-progress", title: "In Progress", emoji: "🔨" },
  { id: "review", title: "Review", emoji: "🔍" },
  { id: "done", title: "Done", emoji: "✅" },
]

const PRIORITY_COLORS: Record<Priority, string> = {
  P0: "bg-rose-500/20 text-rose-400 border-rose-500/40",
  P1: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  P2: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40",
  P3: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
}

const LABEL_COLORS: Record<Label, string> = {
  bug: "bg-red-500/15 text-red-400",
  feat: "bg-emerald-500/15 text-emerald-400",
  chore: "bg-orange-500/15 text-orange-400",
  docs: "bg-sky-500/15 text-sky-400",
}

const ASSIGNEES = ["🧑‍💻", "👩‍🎨", "🧑‍🔬", "👩‍🚀", "🧑‍🏫"]
const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"]
const LABELS: Label[] = ["bug", "feat", "chore", "docs"]

const INITIAL_TASKS: Task[] = [
  {
    id: "t1", title: "Fix auth redirect loop", description: "Users hitting an infinite redirect when OAuth callback fails. Needs graceful fallback to login page with error toast.",
    assignee: "🧑‍💻", priority: "P0", labels: ["bug"], points: 5, ageDays: 2, column: "in-progress",
    subTasks: [{ id: "s1a", text: "Reproduce in staging", done: true }, { id: "s1b", text: "Add redirect guard", done: false }, { id: "s1c", text: "Write regression test", done: false }], comments: 7,
  },
  {
    id: "t2", title: "Design system color tokens", description: "Migrate all hardcoded colors to semantic design tokens. Covers bg, text, border, and accent layers.",
    assignee: "👩‍🎨", priority: "P1", labels: ["feat"], points: 8, ageDays: 5, column: "backlog",
    subTasks: [{ id: "s2a", text: "Audit existing colors", done: false }, { id: "s2b", text: "Define token schema", done: false }], comments: 3,
  },
  {
    id: "t3", title: "Onboarding flow v2", description: "Redesign the onboarding wizard with progressive disclosure. 3-step flow replacing current 7-step.",
    assignee: "👩‍🚀", priority: "P1", labels: ["feat"], points: 13, ageDays: 8, column: "review",
    subTasks: [{ id: "s3a", text: "Step 1: Profile", done: true }, { id: "s3b", text: "Step 2: Preferences", done: true }, { id: "s3c", text: "Step 3: Workspace", done: false }], comments: 12,
  },
  {
    id: "t4", title: "Update API docs for v3", description: "Document all new endpoints added in v3 release. Include request/response examples.",
    assignee: "🧑‍🏫", priority: "P2", labels: ["docs"], points: 3, ageDays: 3, column: "backlog",
    subTasks: [{ id: "s4a", text: "Auth endpoints", done: true }, { id: "s4b", text: "User endpoints", done: false }], comments: 1,
  },
  {
    id: "t5", title: "Refactor modal manager", description: "Extract modal state into a centralized manager. Remove prop-drilling of isOpen/onClose through 4 layers.",
    assignee: "🧑‍💻", priority: "P2", labels: ["chore"], points: 5, ageDays: 12, column: "backlog",
    subTasks: [{ id: "s5a", text: "Create ModalContext", done: false }, { id: "s5b", text: "Migrate existing modals", done: false }], comments: 4,
  },
  {
    id: "t6", title: "Accessibility audit fixes", description: "Address WCAG 2.1 AA violations found in automated scan. Focus on contrast ratios and keyboard nav.",
    assignee: "🧑‍🔬", priority: "P0", labels: ["bug"], points: 8, ageDays: 1, column: "in-progress",
    subTasks: [{ id: "s6a", text: "Fix contrast issues", done: true }, { id: "s6b", text: "Keyboard nav for dropdowns", done: false }, { id: "s6c", text: "Aria labels on icons", done: false }], comments: 9,
  },
  {
    id: "t7", title: "Add loading skeletons", description: "Replace spinner placeholders with content-aware skeleton screens across all list and detail views.",
    assignee: "👩‍🎨", priority: "P3", labels: ["feat"], points: 3, ageDays: 15, column: "done",
    subTasks: [{ id: "s7a", text: "Skeleton component", done: true }, { id: "s7b", text: "Apply to list views", done: true }], comments: 2,
  },
  {
    id: "t8", title: "CI pipeline cleanup", description: "Remove deprecated test steps, consolidate lint stages, reduce avg build time by ~40%.",
    assignee: "🧑‍🔬", priority: "P3", labels: ["chore"], points: 2, ageDays: 20, column: "done",
    subTasks: [{ id: "s8a", text: "Remove legacy steps", done: true }, { id: "s8b", text: "Merge lint stages", done: true }], comments: 5,
  },
  {
    id: "t9", title: "Dashboard chart interactions", description: "Add hover tooltips and click-to-filter on all dashboard chart elements. Requires coordination with data layer.",
    assignee: "👩‍🚀", priority: "P1", labels: ["feat"], points: 8, ageDays: 4, column: "in-progress",
    subTasks: [{ id: "s9a", text: "Tooltip component", done: true }, { id: "s9b", text: "Click handlers", done: false }, { id: "s9c", text: "Filter integration", done: false }], comments: 6,
  },
  {
    id: "t10", title: "Form validation UX", description: "Implement inline validation with debounced checks. Show errors on blur, success on valid input.",
    assignee: "🧑‍🏫", priority: "P2", labels: ["feat"], points: 5, ageDays: 6, column: "review",
    subTasks: [{ id: "s10a", text: "Validation hook", done: true }, { id: "s10b", text: "Error display component", done: true }, { id: "s10c", text: "Integration tests", done: false }], comments: 3,
  },
]

const SPRINT_DAYS_TOTAL = 14
const SPRINT_DAYS_REMAINING = 6

export default function SprintBoard() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null)
  const [filterPriority, setFilterPriority] = useState<Priority | null>(null)
  const [filterLabel, setFilterLabel] = useState<Label | null>(null)

  const totalPoints = tasks.reduce((sum, t) => sum + t.points, 0)
  const completedPoints = tasks.filter((t) => t.column === "done").reduce((sum, t) => sum + t.points, 0)
  const velocityPercent = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0
  const inProgressPoints = tasks.filter((t) => t.column === "in-progress").reduce((sum, t) => sum + t.points, 0)

  const filteredTasks = tasks.filter((t) => {
    if (filterAssignee && t.assignee !== filterAssignee) {return false}
    if (filterPriority && t.priority !== filterPriority) {return false}
    if (filterLabel && !t.labels.includes(filterLabel)) {return false}
    return true
  })

  const moveTask = (taskId: string, toColumn: ColumnId) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, column: toColumn } : t)))
  }

  const toggleSubTask = (taskId: string, subTaskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subTasks: t.subTasks.map((st) => (st.id === subTaskId ? { ...st, done: !st.done } : st)) }
          : t
      )
    )
  }

  const clearFilters = () => {
    setFilterAssignee(null)
    setFilterPriority(null)
    setFilterLabel(null)
  }

  const hasFilters = filterAssignee !== null || filterPriority !== null || filterLabel !== null

  const getOtherColumns = (currentColumn: ColumnId): ColumnDef[] =>
    COLUMNS.filter((c) => c.id !== currentColumn)

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sprint Board</h1>
            <p className="text-sm text-zinc-400 mt-1">Sprint 24 · Feb 10 – Feb 24</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="text-zinc-400">Days left</span>
              <span className="font-bold text-indigo-400">{SPRINT_DAYS_REMAINING}</span>
              <span className="text-zinc-600">/ {SPRINT_DAYS_TOTAL}</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-400 mb-1">Total Points</div>
            <div className="text-xl font-bold">{totalPoints}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-400 mb-1">Completed</div>
            <div className="text-xl font-bold text-emerald-400">{completedPoints}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-400 mb-1">In Flight</div>
            <div className="text-xl font-bold text-amber-400">{inProgressPoints}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-400 mb-1">Velocity</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${velocityPercent}%` }}
                />
              </div>
              <span className="text-sm font-bold text-indigo-400">{velocityPercent}%</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-500 uppercase tracking-wider mr-1">Filter</span>
          {ASSIGNEES.map((a) => (
            <button
              key={a}
              onClick={() => setFilterAssignee(filterAssignee === a ? null : a)}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all border",
                filterAssignee === a
                  ? "bg-indigo-500/20 border-indigo-500"
                  : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
              )}
            >
              {a}
            </button>
          ))}
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(filterPriority === p ? null : p)}
              className={cn(
                "px-2 py-1 rounded-md text-xs font-medium transition-all border",
                filterPriority === p
                  ? PRIORITY_COLORS[p]
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              )}
            >
              {p}
            </button>
          ))}
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          {LABELS.map((l) => (
            <button
              key={l}
              onClick={() => setFilterLabel(filterLabel === l ? null : l)}
              className={cn(
                "px-2 py-1 rounded-md text-xs font-medium transition-all border",
                filterLabel === l
                  ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              )}
            >
              {l}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-zinc-300 transition-colors ml-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const columnTasks = filteredTasks.filter((t) => t.column === col.id)
          const colPoints = columnTasks.reduce((s, t) => s + t.points, 0)

          return (
            <div key={col.id} className="flex flex-col">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">{col.emoji}</span>
                  <h2 className="text-sm font-semibold text-zinc-300">{col.title}</h2>
                  <span className="bg-zinc-800 text-zinc-400 text-xs px-1.5 py-0.5 rounded-md">
                    {columnTasks.length}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">{colPoints} pts</span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-[200px]">
                {columnTasks.map((task) => {
                  const isExpanded = expandedTaskId === task.id
                  const isDone = col.id === "done"
                  const doneSubTasks = task.subTasks.filter((st) => st.done).length

                  return (
                    <div key={task.id} className="group">
                      <button
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        className={cn(
                          "w-full text-left bg-zinc-900 border rounded-lg p-3 transition-all",
                          isExpanded
                            ? "border-indigo-500/60 ring-1 ring-indigo-500/20"
                            : "border-zinc-800 hover:border-zinc-700"
                        )}
                      >
                        {/* Card Top Row */}
                        <div className="flex items-start justify-between mb-2">
                          <span
                            className={cn(
                              "text-sm font-medium leading-snug flex-1 mr-2",
                              isDone ? "line-through text-zinc-500" : "text-zinc-100"
                            )}
                          >
                            {task.title}
                          </span>
                          <span className="text-base flex-shrink-0">{task.assignee}</span>
                        </div>

                        {/* Meta Row */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                              PRIORITY_COLORS[task.priority]
                            )}
                          >
                            {task.priority}
                          </span>
                          {task.labels.map((l) => (
                            <span
                              key={l}
                              className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", LABEL_COLORS[l])}
                            >
                              {l}
                            </span>
                          ))}
                          <span className="text-[10px] text-zinc-500 ml-auto">
                            {task.points}pt · {task.ageDays}d
                          </span>
                        </div>

                        {/* Sub-task progress mini bar */}
                        {task.subTasks.length > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500/70 rounded-full transition-all"
                                style={{
                                  width: `${(doneSubTasks / task.subTasks.length) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-zinc-500">
                              {doneSubTasks}/{task.subTasks.length}
                            </span>
                          </div>
                        )}
                      </button>

                      {/* Expanded Detail Panel */}
                      {isExpanded && (
                        <div className="bg-zinc-900 border border-zinc-800 border-t-0 rounded-b-lg p-3 -mt-1">
                          {/* Description */}
                          <p className={cn("text-xs leading-relaxed mb-3", isDone ? "text-zinc-600 line-through" : "text-zinc-400")}>
                            {task.description}
                          </p>

                          {/* Sub-tasks */}
                          {task.subTasks.length > 0 && (
                            <div className="mb-3">
                              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                                Sub-tasks
                              </div>
                              <div className="flex flex-col gap-1">
                                {task.subTasks.map((st) => (
                                  <button
                                    key={st.id}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleSubTask(task.id, st.id)
                                    }}
                                    className="flex items-center gap-2 text-xs text-left group/st"
                                  >
                                    <div
                                      className={cn(
                                        "w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
                                        st.done
                                          ? "bg-emerald-500/30 border-emerald-500/50"
                                          : "border-zinc-700 group-hover/st:border-zinc-600"
                                      )}
                                    >
                                      {st.done && (
                                        <div className="w-1.5 h-1.5 rounded-sm bg-emerald-400" />
                                      )}
                                    </div>
                                    <span
                                      className={cn(
                                        st.done ? "text-zinc-600 line-through" : "text-zinc-300"
                                      )}
                                    >
                                      {st.text}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Comments count */}
                          <div className="flex items-center gap-1 text-[10px] text-zinc-500 mb-3">
                            <span>💬</span>
                            <span>{task.comments} comment{task.comments !== 1 ? "s" : ""}</span>
                          </div>

                          {/* Move Actions */}
                          <div className="flex flex-col gap-1">
                            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                              Move to
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {getOtherColumns(task.column).map((target) => (
                                <button
                                  key={target.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    moveTask(task.id, target.id)
                                    setExpandedTaskId(null)
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-zinc-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-zinc-400 rounded-md border border-zinc-700 hover:border-indigo-500/40 transition-all"
                                >
                                  <span>{target.emoji}</span>
                                  <span>{target.title}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {columnTasks.length === 0 && (
                  <div className="flex items-center justify-center h-24 border border-dashed border-zinc-800 rounded-lg">
                    <span className="text-xs text-zinc-600">No tasks</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-600">
        <span>
          {tasks.length} tasks · {totalPoints} total points · {completedPoints} completed
        </span>
        <span>Horizon Sprint Board</span>
      </div>
    </div>
  )
}
