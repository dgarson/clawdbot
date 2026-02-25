import React, { useState } from "react"
import { cn } from "../lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NodeStatus = "healthy" | "degraded" | "offline"
type Region = "us-east-1" | "us-west-2"

interface InfraNode {
  id: string
  name: string
  status: NodeStatus
  icon: string
  region: Region
  cpu: number
  ram: number
  uptime: string
  requestRate: number
  errorRate: number
  events: string[]
  x: number
  y: number
}

interface Connection {
  from: string
  to: string
  volume: "low" | "medium" | "high"
}

type FilterOption = "all" | NodeStatus

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const NODES: InfraNode[] = [
  // us-east-1
  { id: "gateway", name: "Gateway", status: "healthy", icon: "🌐", region: "us-east-1", cpu: 34, ram: 52, uptime: "47d 12h", requestRate: 12400, errorRate: 0.02, events: ["Scaled up replicas → 4", "TLS cert renewed", "Rate-limit threshold raised"], x: 80, y: 40 },
  { id: "api-server", name: "API Server", status: "healthy", icon: "⚡", region: "us-east-1", cpu: 61, ram: 74, uptime: "47d 12h", requestRate: 9800, errorRate: 0.05, events: ["Deployed v2.14.1", "Connection pool resized", "Health-check latency spike resolved"], x: 310, y: 40 },
  { id: "agent-1", name: "Agent Runtime 1", status: "healthy", icon: "🤖", region: "us-east-1", cpu: 78, ram: 81, uptime: "12d 3h", requestRate: 3200, errorRate: 0.1, events: ["Model swap complete", "Memory GC triggered", "Queue depth normalised"], x: 540, y: 40 },
  { id: "agent-2", name: "Agent Runtime 2", status: "degraded", icon: "🤖", region: "us-east-1", cpu: 92, ram: 88, uptime: "12d 3h", requestRate: 2900, errorRate: 1.4, events: ["CPU throttling detected", "OOM kill on worker-7", "Auto-restart triggered"], x: 540, y: 140 },
  { id: "redis", name: "Redis Cache", status: "healthy", icon: "🔴", region: "us-east-1", cpu: 18, ram: 45, uptime: "90d 1h", requestRate: 48000, errorRate: 0.0, events: ["Snapshot saved", "Eviction policy active", "Replica sync OK"], x: 310, y: 140 },
  { id: "postgres", name: "Postgres DB", status: "healthy", icon: "🐘", region: "us-east-1", cpu: 42, ram: 67, uptime: "90d 1h", requestRate: 6100, errorRate: 0.01, events: ["Vacuum completed", "Replication lag 0ms", "Backup verified"], x: 80, y: 140 },
  // us-west-2
  { id: "agent-3", name: "Agent Runtime 3", status: "offline", icon: "🤖", region: "us-west-2", cpu: 0, ram: 0, uptime: "0d 0h", requestRate: 0, errorRate: 0, events: ["Node unreachable", "Drain initiated", "Replacement provisioning"], x: 80, y: 40 },
  { id: "vector", name: "Vector Store", status: "healthy", icon: "📐", region: "us-west-2", cpu: 55, ram: 72, uptime: "30d 8h", requestRate: 4200, errorRate: 0.03, events: ["Index rebuild complete", "Shard rebalanced", "Query cache warmed"], x: 310, y: 40 },
  { id: "mq", name: "Message Queue", status: "degraded", icon: "📨", region: "us-west-2", cpu: 83, ram: 59, uptime: "30d 8h", requestRate: 18700, errorRate: 0.8, events: ["Consumer lag increasing", "Partition rebalance", "Dead-letter queue growing"], x: 540, y: 40 },
  { id: "cdn", name: "CDN Edge", status: "healthy", icon: "🌍", region: "us-west-2", cpu: 12, ram: 28, uptime: "120d 0h", requestRate: 74000, errorRate: 0.01, events: ["Cache hit ratio 98.4%", "Origin pull spike resolved", "New POP deployed"], x: 310, y: 140 },
]

const CONNECTIONS: Connection[] = [
  { from: "gateway", to: "api-server", volume: "high" },
  { from: "api-server", to: "agent-1", volume: "high" },
  { from: "api-server", to: "agent-2", volume: "medium" },
  { from: "api-server", to: "redis", volume: "high" },
  { from: "api-server", to: "postgres", volume: "medium" },
  { from: "agent-1", to: "vector", volume: "medium" },
  { from: "agent-2", to: "mq", volume: "low" },
  { from: "mq", to: "agent-3", volume: "low" },
  { from: "cdn", to: "gateway", volume: "high" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<NodeStatus, { dot: string; border: string; bg: string; text: string }> = {
  healthy:  { dot: "bg-emerald-500", border: "border-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  degraded: { dot: "bg-amber-500",   border: "border-amber-500/40",   bg: "bg-amber-500/10",   text: "text-amber-400" },
  offline:  { dot: "bg-rose-500",    border: "border-rose-500/40",    bg: "bg-rose-500/10",     text: "text-rose-400" },
}

const VOLUME_THICKNESS: Record<Connection["volume"], string> = {
  low: "h-px",
  medium: "h-0.5",
  high: "h-1",
}

const VOLUME_COLOR: Record<Connection["volume"], string> = {
  low: "bg-[var(--color-surface-3)]",
  medium: "bg-primary/60",
  high: "bg-primary",
}

const CARD_W = 200
const CARD_H = 80
const FILTERS: FilterOption[] = ["all", "healthy", "degraded", "offline"]

function formatNumber(n: number): string {
  if (n >= 1000) {return `${(n / 1000).toFixed(1)}k`}
  return String(n)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NodeCard({
  node,
  selected,
  onSelect,
}: {
  node: InfraNode
  selected: boolean
  onSelect: (id: string) => void
}) {
  const sc = STATUS_COLORS[node.status]
  return (
    <button
      onClick={() => onSelect(node.id)}
      className={cn(
        "absolute flex flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-all",
        "bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)]/80 focus:outline-none",
        selected ? "ring-2 ring-indigo-500 border-primary" : cn("border-[var(--color-border)]", sc.border),
      )}
      style={{ width: CARD_W, height: CARD_H, left: node.x, top: node.y }}
    >
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{node.icon}</span>
        <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">{node.name}</span>
        <span className={cn("ml-auto h-2 w-2 shrink-0 rounded-full", sc.dot)} />
      </div>
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
        <span>CPU {node.cpu}%</span>
        <span>RAM {node.ram}%</span>
        <span className={cn("ml-auto capitalize text-xs font-medium", sc.text)}>{node.status}</span>
      </div>
    </button>
  )
}

function ConnectionLine({ conn, nodes }: { conn: Connection; nodes: InfraNode[] }) {
  const fromNode = nodes.find((n) => n.id === conn.from)
  const toNode = nodes.find((n) => n.id === conn.to)
  if (!fromNode || !toNode) {return null}

  // Resolve absolute positions from region offsets
  const regionOffsets: Record<Region, { x: number; y: number }> = {
    "us-east-1": { x: 20, y: 52 },
    "us-west-2": { x: 20, y: 52 },
  }

  const fOff = regionOffsets[fromNode.region]
  const tOff = regionOffsets[toNode.region]

  const fromCx = fromNode.x + fOff.x + CARD_W / 2
  const fromCy = fromNode.y + fOff.y + CARD_H / 2
  const toCx = toNode.x + tOff.x + CARD_W / 2
  const toCy = toNode.y + tOff.y + CARD_H / 2

  // Cross-region? skip for simplicity when regions differ — use a dashed marker instead
  if (fromNode.region !== toNode.region) {return null}

  const left = Math.min(fromCx, toCx)
  const top = Math.min(fromCy, toCy)
  const width = Math.abs(toCx - fromCx)
  const height = Math.abs(toCy - fromCy)

  // Horizontal line
  if (height < 20) {
    return (
      <div
        className={cn("absolute rounded-full", VOLUME_THICKNESS[conn.volume], VOLUME_COLOR[conn.volume])}
        style={{ left, top: fromCy, width }}
      />
    )
  }

  // Vertical line
  if (width < 20) {
    return (
      <div
        className={cn("absolute rounded-full", VOLUME_COLOR[conn.volume])}
        style={{ left: fromCx, top, height, width: conn.volume === "high" ? 4 : conn.volume === "medium" ? 2 : 1 }}
      />
    )
  }

  // L-shaped: horizontal then vertical
  return (
    <>
      <div
        className={cn("absolute rounded-full", VOLUME_THICKNESS[conn.volume], VOLUME_COLOR[conn.volume])}
        style={{ left: fromCx, top: fromCy, width: toCx - fromCx }}
      />
      <div
        className={cn("absolute rounded-full", VOLUME_COLOR[conn.volume])}
        style={{
          left: toCx,
          top: Math.min(fromCy, toCy),
          height: Math.abs(toCy - fromCy),
          width: conn.volume === "high" ? 4 : conn.volume === "medium" ? 2 : 1,
        }}
      />
    </>
  )
}

function DetailSidebar({ node, onClose }: { node: InfraNode; onClose: () => void }) {
  const sc = STATUS_COLORS[node.status]
  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-1)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <span className="text-2xl">{node.icon}</span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{node.name}</h2>
          <span className={cn("text-xs font-medium capitalize", sc.text)}>{node.status}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
        >
          ✕
        </button>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 p-5">
        {([
          ["Uptime", node.uptime],
          ["CPU", `${node.cpu}%`],
          ["RAM", `${node.ram}%`],
          ["Req / s", formatNumber(node.requestRate)],
          ["Error %", `${node.errorRate}%`],
          ["Region", node.region],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-0)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Resource bars */}
      <div className="space-y-3 px-5">
        {(["cpu", "ram"] as const).map((key) => {
          const pct = node[key]
          const color = pct > 85 ? "bg-rose-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500"
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs text-[var(--color-text-secondary)]">
                <span className="uppercase">{key}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-2)]">
                <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Events */}
      <div className="mt-4 flex-1 overflow-y-auto px-5 pb-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Recent Events</h3>
        <ul className="space-y-2">
          {node.events.map((evt, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-primary)]">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
              {evt}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function InfrastructureMap() {
  const [filter, setFilter] = useState<FilterOption>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(0)

  // Tick the "last updated" counter every second when auto-refresh is on
  React.useEffect(() => {
    if (!autoRefresh) {return}
    setLastUpdated(0)
    const id = setInterval(() => setLastUpdated((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [autoRefresh])

  const filtered = filter === "all" ? NODES : NODES.filter((n) => n.status === filter)
  const selectedNode = NODES.find((n) => n.id === selectedId) ?? null

  const eastNodes = filtered.filter((n) => n.region === "us-east-1")
  const westNodes = filtered.filter((n) => n.region === "us-west-2")

  const statusCount = (s: NodeStatus) => NODES.filter((n) => n.status === s).length

  return (
    <div className="flex h-full min-h-screen flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Infrastructure Map</h1>
          <p className="text-xs text-[var(--color-text-muted)]">Real-time topology &middot; {NODES.length} nodes</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Auto-refresh */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
              autoRefresh
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", autoRefresh ? "bg-primary animate-pulse" : "bg-[var(--color-surface-3)]")} />
            {autoRefresh ? `Auto-refresh · ${lastUpdated}s ago` : "Auto-refresh off"}
          </button>

          {/* Summary pills */}
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {statusCount("healthy")}
            </span>
            <span className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {statusCount("degraded")}
            </span>
            <span className="flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> {statusCount("offline")}
            </span>
          </div>
        </div>
      </header>

      {/* Filter chips */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-6 py-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium capitalize transition",
              filter === f
                ? "border-primary bg-primary/15 text-primary"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]",
            )}
          >
            {f === "all" ? `All (${NODES.length})` : `${f} (${statusCount(f)})`}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-auto p-6">
          <div className="flex flex-col gap-6">
            {/* Region: us-east-1 */}
            {eastNodes.length > 0 && (
              <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-0)] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">us-east-1</span>
                  <span className="h-px flex-1 bg-[var(--color-surface-2)]" />
                </div>
                <div className="relative" style={{ height: 260 }}>
                  {/* Connections for this region */}
                  {CONNECTIONS.filter((c) => {
                    const fn = NODES.find((n) => n.id === c.from)
                    const tn = NODES.find((n) => n.id === c.to)
                    return fn?.region === "us-east-1" && tn?.region === "us-east-1"
                      && filtered.some((n) => n.id === c.from) && filtered.some((n) => n.id === c.to)
                  }).map((c, i) => (
                    <ConnectionLine key={i} conn={c} nodes={eastNodes} />
                  ))}
                  {eastNodes.map((n) => (
                    <NodeCard
                      key={n.id}
                      node={n}
                      selected={selectedId === n.id}
                      onSelect={setSelectedId}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Region: us-west-2 */}
            {westNodes.length > 0 && (
              <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-0)] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">us-west-2</span>
                  <span className="h-px flex-1 bg-[var(--color-surface-2)]" />
                </div>
                <div className="relative" style={{ height: 260 }}>
                  {CONNECTIONS.filter((c) => {
                    const fn = NODES.find((n) => n.id === c.from)
                    const tn = NODES.find((n) => n.id === c.to)
                    return fn?.region === "us-west-2" && tn?.region === "us-west-2"
                      && filtered.some((n) => n.id === c.from) && filtered.some((n) => n.id === c.to)
                  }).map((c, i) => (
                    <ConnectionLine key={i} conn={c} nodes={westNodes} />
                  ))}
                  {westNodes.map((n) => (
                    <NodeCard
                      key={n.id}
                      node={n}
                      selected={selectedId === n.id}
                      onSelect={setSelectedId}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Cross-region connections legend */}
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-2.5">
              <span className="text-xs text-[var(--color-text-muted)]">Cross-region links</span>
              {CONNECTIONS.filter((c) => {
                const fn = NODES.find((n) => n.id === c.from)
                const tn = NODES.find((n) => n.id === c.to)
                return fn && tn && fn.region !== tn.region
              }).map((c, i) => {
                const fn = NODES.find((n) => n.id === c.from)
                const tn = NODES.find((n) => n.id === c.to)
                return (
                  <span key={i} className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                    <span className="font-medium text-[var(--color-text-primary)]">{fn?.name}</span>
                    <span className={cn("inline-block h-px w-4 rounded-full", VOLUME_COLOR[c.volume])} />
                    <span className="font-medium text-[var(--color-text-primary)]">{tn?.name}</span>
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {/* Detail sidebar */}
        {selectedNode && (
          <DetailSidebar node={selectedNode} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  )
}
