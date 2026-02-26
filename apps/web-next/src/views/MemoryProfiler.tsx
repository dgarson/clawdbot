import React, { useState } from "react"
import { cn } from "../lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────

interface HeapBreakdown {
  newSpace: number
  oldSpace: number
  codeSpace: number
  mapSpace: number
}

interface AgentProcess {
  pid: number
  name: string
  rss: number
  heapUsed: number
  heapTotal: number
  external: number
  status: "running" | "idle" | "gc"
  heap: HeapBreakdown
}

interface FlameBlock {
  name: string
  width: number
  memClass: "alloc" | "retain" | "cache" | "mapped" | "shared"
}

interface GCEvent {
  timestamp: number
  durationMs: number
  reclaimed: number
}

interface Snapshot {
  id: number
  timestamp: number
  totalRss: number
  processCount: number
}

type SortKey = "rss" | "heapUsed" | "name"

// ── Mock Data Generators ───────────────────────────────────────────────────

const generateTimeline = (): number[] =>
  Array.from({ length: 30 }, (_, i) =>
    Math.round(220 + Math.sin(i * 0.4) * 80 + Math.random() * 60)
  )

const PROCESS_NAMES = [
  "orchestrator", "planner", "executor", "memory-store",
  "embedder", "retriever", "tool-router", "monitor",
]

const generateProcesses = (): AgentProcess[] =>
  PROCESS_NAMES.map((name, i) => {
    const heapTotal = Math.round(64 + Math.random() * 192)
    const heapUsed = Math.round(heapTotal * (0.35 + Math.random() * 0.62))
    const newSpace = Math.round(heapUsed * (0.15 + Math.random() * 0.15))
    const oldSpace = Math.round(heapUsed * (0.4 + Math.random() * 0.2))
    const codeSpace = Math.round(heapUsed * (0.1 + Math.random() * 0.1))
    const mapSpace = heapUsed - newSpace - oldSpace - codeSpace
    return {
      pid: 4200 + i * 13,
      name,
      rss: Math.round(heapTotal * (1.1 + Math.random() * 0.4)),
      heapUsed,
      heapTotal,
      external: Math.round(8 + Math.random() * 32),
      status: (["running", "idle", "gc"] as const)[Math.floor(Math.random() * 3)],
      heap: { newSpace, oldSpace, codeSpace, mapSpace },
    }
  })

const FLAME_DATA: FlameBlock[][] = [
  [
    { name: "processMessage", width: 100, memClass: "alloc" },
  ],
  [
    { name: "parsePayload", width: 62, memClass: "alloc" },
    { name: "validateSchema", width: 38, memClass: "cache" },
  ],
  [
    { name: "tokenize", width: 40, memClass: "retain" },
    { name: "buildAST", width: 22, memClass: "alloc" },
    { name: "allocBuffer", width: 38, memClass: "mapped" },
  ],
  [
    { name: "encodeChunk", width: 25, memClass: "shared" },
    { name: "hashBlock", width: 15, memClass: "retain" },
    { name: "lookupCache", width: 22, memClass: "cache" },
    { name: "writeOut", width: 38, memClass: "mapped" },
  ],
  [
    { name: "flushStream", width: 18, memClass: "shared" },
    { name: "gcMark", width: 12, memClass: "retain" },
    { name: "serialize", width: 15, memClass: "cache" },
    { name: "compress", width: 25, memClass: "alloc" },
    { name: "emitEvent", width: 30, memClass: "mapped" },
  ],
]

const FLAME_COLORS: Record<FlameBlock["memClass"], string> = {
  alloc: "bg-indigo-500",
  retain: "bg-violet-500",
  cache: "bg-cyan-500",
  mapped: "bg-amber-500",
  shared: "bg-emerald-500",
}

const generateGCEvents = (): GCEvent[] =>
  Array.from({ length: 5 }, (_, i) => ({
    timestamp: Date.now() - (5 - i) * 12000 + Math.round(Math.random() * 4000),
    durationMs: Math.round(4 + Math.random() * 28),
    reclaimed: Math.round(6 + Math.random() * 48),
  }))

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtMB = (n: number): string => `${n} MB`
const fmtTime = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`
}

const heapPct = (proc: AgentProcess): number =>
  proc.heapTotal > 0 ? Math.round((proc.heapUsed / proc.heapTotal) * 100) : 0

// ── Component ──────────────────────────────────────────────────────────────

export default function MemoryProfiler() {
  const [timeline] = useState<number[]>(generateTimeline)
  const [processes, setProcesses] = useState<AgentProcess[]>(generateProcesses)
  const [gcEvents] = useState<GCEvent[]>(generateGCEvents)
  const [expandedPid, setExpandedPid] = useState<number | null>(null)
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("rss")
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [nextSnapId, setNextSnapId] = useState(1)
  const [hoveredFlame, setHoveredFlame] = useState<string | null>(null)

  const maxTimeline = Math.max(...timeline, 1)

  const sorted = [...processes].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name)
    return b[sortKey] - a[sortKey]
  })

  const alerts = processes.filter((p) => heapPct(p) >= 80)

  const takeSnapshot = () => {
    const totalRss = processes.reduce((s, p) => s + p.rss, 0)
    setSnapshots((prev) => [
      ...prev,
      { id: nextSnapId, timestamp: Date.now(), totalRss, processCount: processes.length },
    ])
    setNextSnapId((n) => n + 1)
    setProcesses(generateProcesses())
  }

  // GC event positions mapped to timeline (last 30 ticks, ~6s each)
  const gcPositions = gcEvents.map((ev) => {
    const now = Date.now()
    const span = 30 * 6000
    const age = now - ev.timestamp
    const pct = Math.max(0, Math.min(100, 100 - (age / span) * 100))
    return { ...ev, pct }
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Memory Profiler</h1>
          <p className="text-sm text-zinc-400 mt-1">Agent runtime memory analysis</p>
        </div>
        <button
          onClick={takeSnapshot}
          className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm font-medium transition-colors"
        >
          Take Snapshot
        </button>
      </div>

      {/* Memory Timeline + GC markers */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Memory Timeline</h2>
        <div className="relative">
          <div className="flex items-end gap-[3px] h-36">
            {timeline.map((val, i) => (
              <div
                key={i}
                className="relative flex-1 group"
                onMouseEnter={() => setHoveredBar(i)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                <div
                  className={cn(
                    "w-full rounded-t transition-colors",
                    hoveredBar === i ? "bg-indigo-400" : "bg-indigo-500/70"
                  )}
                  style={{ height: `${(val / maxTimeline) * 100}%` }}
                />
                {hoveredBar === i && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-zinc-700">
                    {fmtMB(val)}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* GC event markers */}
          <div className="relative h-3 mt-1">
            {gcPositions.map((gc, i) => (
              <div
                key={i}
                className="absolute top-0 h-3 w-1.5 rounded-sm bg-rose-500/80"
                style={{ left: `${gc.pct}%` }}
                title={`GC ${gc.durationMs}ms — reclaimed ${gc.reclaimed} MB`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
            <span>-3 min</span>
            <span>GC events (rose markers)</span>
            <span>now</span>
          </div>
        </div>
      </div>

      {/* GC Event Details */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Recent GC Events</h2>
        <div className="flex gap-3">
          {gcEvents.map((ev, i) => (
            <div
              key={i}
              className="flex-1 bg-zinc-800 rounded-lg p-3 text-xs space-y-1 border border-zinc-700/50"
            >
              <div className="text-zinc-400">{fmtTime(ev.timestamp)}</div>
              <div className="text-white font-medium">{ev.durationMs}ms</div>
              <div className="text-emerald-400">-{ev.reclaimed} MB</div>
              <div className="h-1 bg-zinc-700 rounded-full mt-1">
                <div
                  className="h-1 bg-rose-500 rounded-full"
                  style={{ width: `${Math.min(100, (ev.durationMs / 32) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Heap Alerts</h2>
          <div className="space-y-2">
            {alerts
              .sort((a, b) => heapPct(b) - heapPct(a))
              .map((proc) => {
                const pct = heapPct(proc)
                const critical = pct >= 95
                return (
                  <div
                    key={proc.pid}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-4 py-2 text-sm border",
                      critical
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    )}
                  >
                    <span className="font-medium">{proc.name}</span>
                    <span>
                      {pct}% heap — {fmtMB(proc.heapUsed)} / {fmtMB(proc.heapTotal)}
                    </span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        critical ? "bg-rose-500/20" : "bg-amber-500/20"
                      )}
                    >
                      {critical ? "CRITICAL" : "WARNING"}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-400">Sort by:</span>
        {(["rss", "heapUsed", "name"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
              sortKey === key
                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            )}
          >
            {key === "heapUsed" ? "Heap Used" : key === "rss" ? "RSS" : "Name"}
          </button>
        ))}
      </div>

      {/* Process Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 gap-2 px-5 py-3 text-xs text-zinc-500 font-medium border-b border-zinc-800">
          <span>PID</span>
          <span>Process</span>
          <span>RSS</span>
          <span>Heap Used</span>
          <span>Heap Total</span>
          <span>External</span>
          <span>Status</span>
        </div>
        {sorted.map((proc) => {
          const pct = heapPct(proc)
          const expanded = expandedPid === proc.pid
          return (
            <div key={proc.pid}>
              <button
                onClick={() => setExpandedPid(expanded ? null : proc.pid)}
                className={cn(
                  "w-full grid grid-cols-7 gap-2 px-5 py-3 text-sm text-left transition-colors hover:bg-zinc-800/60",
                  expanded && "bg-zinc-800/40"
                )}
              >
                <span className="text-zinc-400 font-mono">{proc.pid}</span>
                <span className="text-white font-medium">{proc.name}</span>
                <span>{fmtMB(proc.rss)}</span>
                <span
                  className={cn(
                    pct >= 95 ? "text-rose-400" : pct >= 80 ? "text-amber-400" : "text-zinc-200"
                  )}
                >
                  {fmtMB(proc.heapUsed)}
                </span>
                <span className="text-zinc-300">{fmtMB(proc.heapTotal)}</span>
                <span className="text-zinc-400">{fmtMB(proc.external)}</span>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full w-fit font-medium",
                    proc.status === "running"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : proc.status === "gc"
                        ? "bg-rose-500/15 text-rose-400"
                        : "bg-zinc-700/40 text-zinc-400"
                  )}
                >
                  {proc.status}
                </span>
              </button>
              {/* Expanded Heap Breakdown */}
              {expanded && (
                <div className="px-5 pb-4 pt-1 space-y-3 border-b border-zinc-800/60">
                  <h3 className="text-xs font-medium text-zinc-400">Heap Breakdown</h3>
                  {(["newSpace", "oldSpace", "codeSpace", "mapSpace"] as const).map((seg) => {
                    const segVal = proc.heap[seg]
                    const segPct = proc.heapUsed > 0 ? (segVal / proc.heapUsed) * 100 : 0
                    const colors: Record<string, string> = {
                      newSpace: "bg-indigo-500",
                      oldSpace: "bg-violet-500",
                      codeSpace: "bg-cyan-500",
                      mapSpace: "bg-amber-500",
                    }
                    return (
                      <div key={seg} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-300">
                            {seg.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                          <span className="text-zinc-500">
                            {fmtMB(segVal)} ({Math.round(segPct)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={cn("h-2 rounded-full transition-all", colors[seg])}
                            style={{ width: `${segPct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {/* Stacked bar summary */}
                  <div className="mt-2">
                    <div className="text-xs text-zinc-500 mb-1">Combined</div>
                    <div className="h-4 bg-zinc-800 rounded-full overflow-hidden flex">
                      {(["newSpace", "oldSpace", "codeSpace", "mapSpace"] as const).map((seg) => {
                        const segPct =
                          proc.heapUsed > 0 ? (proc.heap[seg] / proc.heapUsed) * 100 : 0
                        const colors: Record<string, string> = {
                          newSpace: "bg-indigo-500",
                          oldSpace: "bg-violet-500",
                          codeSpace: "bg-cyan-500",
                          mapSpace: "bg-amber-500",
                        }
                        return (
                          <div
                            key={seg}
                            className={cn("h-4", colors[seg])}
                            style={{ width: `${segPct}%` }}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Flamegraph */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-1">Memory Flamegraph</h2>
        <p className="text-xs text-zinc-500 mb-4">Top allocation paths by retained size</p>
        <div className="space-y-1">
          {FLAME_DATA.map((row, ri) => (
            <div key={ri} className="flex gap-0.5 h-9">
              {row.map((block) => (
                <div
                  key={block.name}
                  onMouseEnter={() => setHoveredFlame(block.name)}
                  onMouseLeave={() => setHoveredFlame(null)}
                  className={cn(
                    "relative rounded-sm flex items-center justify-center text-[11px] font-medium transition-opacity cursor-default",
                    FLAME_COLORS[block.memClass],
                    hoveredFlame && hoveredFlame !== block.name ? "opacity-40" : "opacity-90"
                  )}
                  style={{ width: `${block.width}%` }}
                >
                  <span className="truncate px-1 text-white/90">{block.name}</span>
                  {hoveredFlame === block.name && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-zinc-700">
                      {block.name} — {block.memClass}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4">
          {(Object.entries(FLAME_COLORS) as [FlameBlock["memClass"], string][]).map(([cls, bg]) => (
            <div key={cls} className="flex items-center gap-1.5 text-xs text-zinc-400">
              <div className={cn("w-2.5 h-2.5 rounded-sm", bg)} />
              {cls}
            </div>
          ))}
        </div>
      </div>

      {/* Snapshot History */}
      {snapshots.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">
            Snapshot History ({snapshots.length})
          </h2>
          <div className="space-y-2">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-2.5 text-sm border border-zinc-700/40"
              >
                <div className="flex items-center gap-3">
                  <span className="text-indigo-400 font-mono text-xs">#{snap.id}</span>
                  <span className="text-zinc-300">{fmtTime(snap.timestamp)}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span>{snap.processCount} processes</span>
                  <span className="text-white font-medium">{fmtMB(snap.totalRss)} total RSS</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
