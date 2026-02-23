import React, { useState } from "react"
import { cn } from "../lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Agent {
  name: string
  color: string
  bgClass: string
  textClass: string
  borderClass: string
}

interface ShiftBlock {
  day: number
  period: "AM" | "PM"
  agentIndex: number
}

interface SwapTarget {
  day: number
  period: "AM" | "PM"
}

// ── Constants ──────────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
  { name: "Luis", color: "#6366f1", bgClass: "bg-indigo-500", textClass: "text-indigo-400", borderClass: "border-indigo-500" },
  { name: "Xavier", color: "#f59e0b", bgClass: "bg-amber-500", textClass: "text-amber-400", borderClass: "border-amber-500" },
  { name: "Piper", color: "#ec4899", bgClass: "bg-pink-500", textClass: "text-pink-400", borderClass: "border-pink-500" },
  { name: "Quinn", color: "#10b981", bgClass: "bg-emerald-500", textClass: "text-emerald-400", borderClass: "border-emerald-500" },
  { name: "Reed", color: "#3b82f6", bgClass: "bg-blue-500", textClass: "text-blue-400", borderClass: "border-blue-500" },
  { name: "Wes", color: "#a855f7", bgClass: "bg-purple-500", textClass: "text-purple-400", borderClass: "border-purple-500" },
]

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const PERIODS: Array<"AM" | "PM"> = ["AM", "PM"]

// ── Helpers ────────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${months[date.getMonth()]} ${date.getDate()}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function buildScheduleKey(weekStart: Date): string {
  return `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`
}

function generateDefaultSchedule(): ShiftBlock[] {
  const blocks: ShiftBlock[] = []
  for (let day = 0; day < 7; day++) {
    for (let p = 0; p < 2; p++) {
      const slotIndex = day * 2 + p
      blocks.push({
        day,
        period: PERIODS[p],
        agentIndex: slotIndex % AGENTS.length,
      })
    }
  }
  return blocks
}

function getCurrentShiftPeriod(now: Date): "AM" | "PM" {
  return now.getHours() < 12 ? "AM" : "PM"
}

function getNextHandoff(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) {return "Today 12:00 PM"}
  return "Tomorrow 12:00 AM"
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function OncallScheduler() {
  const today = new Date()
  const [weekOffset, setWeekOffset] = useState<number>(0)
  const [schedules, setSchedules] = useState<Record<string, ShiftBlock[]>>({})
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null)
  const [overrideTarget, setOverrideTarget] = useState<SwapTarget | null>(null)

  const currentMonday = getMonday(today)
  const viewMonday = addDays(currentMonday, weekOffset * 7)
  const weekKey = buildScheduleKey(viewMonday)

  const schedule = schedules[weekKey] ?? generateDefaultSchedule()

  const isCurrentWeek = weekOffset === 0
  const todayDayIndex = isCurrentWeek ? ((today.getDay() + 6) % 7) : -1
  const currentPeriod = getCurrentShiftPeriod(today)

  // Who's on call right now
  const nowBlock = isCurrentWeek
    ? schedule.find((b) => b.day === todayDayIndex && b.period === currentPeriod)
    : null
  const oncallAgent = nowBlock ? AGENTS[nowBlock.agentIndex] : null

  // Escalation chain: current agent first, then cycle through rest
  const escalationChain: Agent[] = oncallAgent
    ? [oncallAgent, ...AGENTS.filter((a) => a.name !== oncallAgent.name)]
    : [...AGENTS]

  function updateShift(day: number, period: "AM" | "PM", newAgentIndex: number) {
    const current = schedules[weekKey] ?? generateDefaultSchedule()
    const updated = current.map((block) =>
      block.day === day && block.period === period ? { ...block, agentIndex: newAgentIndex } : block
    )
    setSchedules((prev) => ({ ...prev, [weekKey]: updated }))
    setSwapTarget(null)
    setOverrideTarget(null)
  }

  function getBlock(day: number, period: "AM" | "PM"): ShiftBlock {
    return schedule.find((b) => b.day === day && b.period === period) ?? {
      day,
      period,
      agentIndex: 0,
    }
  }

  function handleBlockClick(day: number, period: "AM" | "PM") {
    if (swapTarget?.day === day && swapTarget?.period === period) {
      setSwapTarget(null)
      setOverrideTarget(null)
    } else {
      setSwapTarget({ day, period })
      setOverrideTarget(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">On-Call Scheduler</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage rotation coverage for the squad</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setWeekOffset((w) => w - 1); setSwapTarget(null); }}
            className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white text-sm font-medium transition-colors"
          >
            ← Prev
          </button>
          <div className="text-sm font-medium text-zinc-300 min-w-[180px] text-center">
            {formatDate(viewMonday)} – {formatDate(addDays(viewMonday, 6))}
            {isCurrentWeek && (
              <span className="ml-2 text-xs text-indigo-400 font-semibold">(This week)</span>
            )}
          </div>
          <button
            onClick={() => { setWeekOffset((w) => w + 1); setSwapTarget(null); }}
            className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white text-sm font-medium transition-colors"
          >
            Next →
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => { setWeekOffset(0); setSwapTarget(null); }}
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 text-sm font-medium transition-colors"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Calendar Grid */}
        <div className="flex-1">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-zinc-800">
              <div className="p-3 text-xs font-semibold text-zinc-500 uppercase">Shift</div>
              {DAY_NAMES.map((name, i) => {
                const dayDate = addDays(viewMonday, i)
                const isToday = isSameDay(dayDate, today)
                return (
                  <div
                    key={name}
                    className={cn(
                      "p-3 text-center border-l border-zinc-800",
                      isToday ? "bg-indigo-500/10" : ""
                    )}
                  >
                    <div className={cn("text-xs font-semibold uppercase", isToday ? "text-indigo-400" : "text-zinc-400")}>
                      {name}
                    </div>
                    <div className={cn("text-lg font-bold mt-0.5", isToday ? "text-indigo-300" : "text-zinc-200")}>
                      {dayDate.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Shift rows: AM and PM */}
            {PERIODS.map((period) => (
              <div
                key={period}
                className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-zinc-800 last:border-b-0"
              >
                <div className="p-3 flex items-center justify-center">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    {period}
                  </span>
                  <span className="ml-1.5 text-[10px] text-zinc-600">
                    {period === "AM" ? "0–12" : "12–24"}
                  </span>
                </div>
                {DAY_NAMES.map((_, dayIdx) => {
                  const block = getBlock(dayIdx, period)
                  const agent = AGENTS[block.agentIndex]
                  const isToday = dayIdx === todayDayIndex && isCurrentWeek
                  const isNow = isToday && period === currentPeriod
                  const isSelected = swapTarget?.day === dayIdx && swapTarget?.period === period

                  return (
                    <button
                      key={`${dayIdx}-${period}`}
                      onClick={() => handleBlockClick(dayIdx, period)}
                      className={cn(
                        "border-l border-zinc-800 p-2 min-h-[72px] transition-all text-left relative group",
                        isToday ? "bg-indigo-500/5" : "bg-zinc-900",
                        isSelected ? "ring-2 ring-indigo-500 ring-inset bg-zinc-800" : "",
                        isNow ? "bg-indigo-500/10" : "",
                        "hover:bg-zinc-800/80 cursor-pointer"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <div
                          className={cn("w-2.5 h-2.5 rounded-full shrink-0", agent.bgClass)}
                        />
                        <span className={cn("text-sm font-medium truncate", agent.textClass)}>
                          {agent.name}
                        </span>
                      </div>
                      {isNow && (
                        <div className="mt-1.5 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-[10px] text-green-400 font-semibold uppercase">Live</span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/60">
                        <span className="text-[10px] text-zinc-400 font-medium">Click to swap</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Swap Panel */}
          {swapTarget && (
            <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Swap Shift — {DAY_NAMES[swapTarget.day]} {swapTarget.period}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Currently assigned: {AGENTS[getBlock(swapTarget.day, swapTarget.period).agentIndex].name}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setOverrideTarget(overrideTarget ? null : swapTarget)
                    }}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium border transition-colors",
                      overrideTarget
                        ? "bg-red-500/20 border-red-500/50 text-red-400"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
                    )}
                  >
                    {overrideTarget ? "Cancel Override" : "Override"}
                  </button>
                  <button
                    onClick={() => { setSwapTarget(null); setOverrideTarget(null); }}
                    className="px-3 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white text-xs font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {AGENTS.map((agent, idx) => {
                  const currentBlock = getBlock(swapTarget.day, swapTarget.period)
                  const isCurrent = currentBlock.agentIndex === idx
                  return (
                    <button
                      key={agent.name}
                      onClick={() => {
                        if (!isCurrent) {updateShift(swapTarget.day, swapTarget.period, idx)}
                      }}
                      disabled={isCurrent}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                        isCurrent
                          ? "border-zinc-700 bg-zinc-800/50 opacity-50 cursor-not-allowed"
                          : overrideTarget
                            ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/50 cursor-pointer"
                            : "border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-600 cursor-pointer"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white", agent.bgClass)}>
                        {agent.name[0]}
                      </div>
                      <span className={cn("text-xs font-medium", isCurrent ? "text-zinc-600" : "text-zinc-300")}>
                        {agent.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] text-zinc-600">Current</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {overrideTarget && (
                <div className="mt-3 flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="text-xs text-red-400">
                    Override mode: select an agent to force-assign this shift
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Color Legend */}
          <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Agent Legend
            </h3>
            <div className="flex flex-wrap gap-4">
              {AGENTS.map((agent) => (
                <div key={agent.name} className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", agent.bgClass)} />
                  <span className="text-sm text-zinc-300 font-medium">{agent.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Who's On Call Now */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              On Call Now
            </h2>
            {oncallAgent ? (
              <div className="flex flex-col items-center text-center">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-3",
                    oncallAgent.bgClass
                  )}
                >
                  {oncallAgent.name[0]}
                </div>
                <div className={cn("text-xl font-bold", oncallAgent.textClass)}>
                  {oncallAgent.name}
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400 font-semibold">Active</span>
                </div>
                <div className="mt-3 w-full pt-3 border-t border-zinc-800">
                  <div className="text-xs text-zinc-500">Current period</div>
                  <div className="text-sm font-semibold text-zinc-200 mt-0.5">
                    {currentPeriod === "AM" ? "00:00 – 12:00" : "12:00 – 24:00"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl text-zinc-600">?</span>
                </div>
                <p className="text-sm text-zinc-500">Navigate to current week</p>
              </div>
            )}
          </div>

          {/* Next Handoff */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Next Handoff
            </h2>
            <div className="text-lg font-bold text-white">{getNextHandoff(today)}</div>
            <div className="mt-2 text-xs text-zinc-500">
              {currentPeriod === "AM" ? "PM shift begins at noon" : "AM shift begins at midnight"}
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${((today.getHours() % 12) / 12) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-zinc-600">
                {currentPeriod === "AM" ? "00:00" : "12:00"}
              </span>
              <span className="text-[10px] text-zinc-600">
                {currentPeriod === "AM" ? "12:00" : "24:00"}
              </span>
            </div>
          </div>

          {/* Escalation Chain */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Escalation Chain
            </h2>
            <div className="space-y-2">
              {escalationChain.map((agent, idx) => (
                <div
                  key={agent.name}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg transition-colors",
                    idx === 0 ? "bg-zinc-800/80" : "bg-transparent"
                  )}
                >
                  <div className="text-xs font-mono text-zinc-600 w-4 text-right">
                    {idx === 0 ? "→" : `L${idx}`}
                  </div>
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white", agent.bgClass)}>
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-medium truncate", idx === 0 ? "text-white" : "text-zinc-400")}>
                      {agent.name}
                    </div>
                  </div>
                  {idx === 0 && (
                    <span className="text-[10px] font-semibold text-indigo-400 uppercase">Primary</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Week Stats */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Week Coverage
            </h2>
            <div className="space-y-2">
              {AGENTS.map((agent, idx) => {
                const shiftCount = schedule.filter((b) => b.agentIndex === idx).length
                const pct = (shiftCount / 14) * 100
                return (
                  <div key={agent.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-400">{agent.name}</span>
                      <span className="text-xs text-zinc-500">{shiftCount} shifts</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", agent.bgClass)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
