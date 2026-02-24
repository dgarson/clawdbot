import React, { useState } from "react"
import { cn } from "../lib/utils"

type RegionStatus = "healthy" | "degraded" | "outage" | "maintenance"
type FailoverStatus = "primary" | "standby" | "active-failover"

interface RegionLatency {
  from: string
  to: string
  p50: number
  p99: number
}

interface Region {
  id: string
  name: string
  shortName: string
  provider: "aws" | "gcp" | "azure"
  status: RegionStatus
  failoverStatus: FailoverStatus
  endpoints: number
  activeInstances: number
  totalInstances: number
  requestsPerSec: number
  errorRate: number
  p50LatencyMs: number
  p99LatencyMs: number
  availability: number
  trafficWeight: number
  lastIncident?: string
  services: string[]
}

interface TrafficSplit {
  hour: string
  regions: Record<string, number>
}

interface FailoverEvent {
  id: string
  timestamp: string
  fromRegion: string
  toRegion: string
  duration: number
  reason: string
  triggerType: "auto" | "manual"
  successful: boolean
}

const REGIONS: Region[] = [
  {
    id: "us-east-1",
    name: "US East (N. Virginia)",
    shortName: "USE1",
    provider: "aws",
    status: "healthy",
    failoverStatus: "primary",
    endpoints: 24,
    activeInstances: 48,
    totalInstances: 48,
    requestsPerSec: 4821,
    errorRate: 0.04,
    p50LatencyMs: 12,
    p99LatencyMs: 48,
    availability: 99.98,
    trafficWeight: 45,
    services: ["api-gateway", "auth", "users", "payments", "notifications"],
  },
  {
    id: "eu-west-1",
    name: "EU West (Ireland)",
    shortName: "EUW1",
    provider: "aws",
    status: "healthy",
    failoverStatus: "primary",
    endpoints: 22,
    activeInstances: 32,
    totalInstances: 32,
    requestsPerSec: 2140,
    errorRate: 0.06,
    p50LatencyMs: 14,
    p99LatencyMs: 52,
    availability: 99.96,
    trafficWeight: 28,
    services: ["api-gateway", "auth", "users", "notifications"],
  },
  {
    id: "ap-southeast-1",
    name: "Asia Pacific (Singapore)",
    shortName: "APSE1",
    provider: "aws",
    status: "degraded",
    failoverStatus: "primary",
    endpoints: 18,
    activeInstances: 20,
    totalInstances: 24,
    requestsPerSec: 1102,
    errorRate: 1.82,
    p50LatencyMs: 28,
    p99LatencyMs: 180,
    availability: 99.72,
    trafficWeight: 15,
    lastIncident: "2026-02-22T10:15:00Z",
    services: ["api-gateway", "auth", "users"],
  },
  {
    id: "us-west-2",
    name: "US West (Oregon)",
    shortName: "USW2",
    provider: "aws",
    status: "healthy",
    failoverStatus: "standby",
    endpoints: 20,
    activeInstances: 16,
    totalInstances: 16,
    requestsPerSec: 580,
    errorRate: 0.02,
    p50LatencyMs: 13,
    p99LatencyMs: 45,
    availability: 99.99,
    trafficWeight: 8,
    services: ["api-gateway", "auth"],
  },
  {
    id: "eu-central-1",
    name: "EU Central (Frankfurt)",
    shortName: "EUC1",
    provider: "aws",
    status: "maintenance",
    failoverStatus: "standby",
    endpoints: 0,
    activeInstances: 0,
    totalInstances: 20,
    requestsPerSec: 0,
    errorRate: 0,
    p50LatencyMs: 0,
    p99LatencyMs: 0,
    availability: 100.00,
    trafficWeight: 4,
    services: ["api-gateway", "auth", "users"],
  },
]

const LATENCIES: RegionLatency[] = [
  { from: "USE1", to: "EUW1", p50: 82, p99: 120 },
  { from: "USE1", to: "APSE1", p50: 188, p99: 260 },
  { from: "USE1", to: "USW2", p50: 68, p99: 95 },
  { from: "EUW1", to: "APSE1", p50: 164, p99: 220 },
  { from: "EUW1", to: "EUC1", p50: 24, p99: 38 },
  { from: "USW2", to: "APSE1", p50: 140, p99: 195 },
]

const TRAFFIC_HISTORY: TrafficSplit[] = [
  { hour: "06:00", regions: { "USE1": 4200, "EUW1": 2800, "APSE1": 1400, "USW2": 600 } },
  { hour: "07:00", regions: { "USE1": 4400, "EUW1": 2600, "APSE1": 1300, "USW2": 580 } },
  { hour: "08:00", regions: { "USE1": 4600, "EUW1": 2400, "APSE1": 1200, "USW2": 560 } },
  { hour: "09:00", regions: { "USE1": 4800, "EUW1": 2200, "APSE1": 1100, "USW2": 580 } },
  { hour: "10:00", regions: { "USE1": 4821, "EUW1": 2140, "APSE1": 900, "USW2": 580 } },
  { hour: "11:00", regions: { "USE1": 5100, "EUW1": 2200, "APSE1": 1100, "USW2": 600 } },
  { hour: "12:00", regions: { "USE1": 5400, "EUW1": 2400, "APSE1": 1200, "USW2": 620 } },
  { hour: "13:00", regions: { "USE1": 5200, "EUW1": 2300, "APSE1": 1150, "USW2": 610 } },
]

const FAILOVER_EVENTS: FailoverEvent[] = [
  { id: "fo-001", timestamp: "2026-02-22T10:15:00Z", fromRegion: "APSE1", toRegion: "USW2", duration: 45, reason: "High error rate (>2%) detected on APSE1", triggerType: "auto", successful: true },
  { id: "fo-002", timestamp: "2026-01-15T03:22:00Z", fromRegion: "EUC1", toRegion: "EUW1", duration: 120, reason: "Scheduled maintenance window", triggerType: "manual", successful: true },
  { id: "fo-003", timestamp: "2025-12-28T18:44:00Z", fromRegion: "USE1", toRegion: "USW2", duration: 8, reason: "Partial DNS resolution failure in USE1-AZ-1", triggerType: "auto", successful: true },
  { id: "fo-004", timestamp: "2025-11-10T09:15:00Z", fromRegion: "EUW1", toRegion: "EUC1", duration: 210, reason: "Network provider outage affecting EU-WEST-1", triggerType: "auto", successful: false },
]

const statusColor: Record<RegionStatus, string> = {
  healthy: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  degraded: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  outage: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  maintenance: "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/20",
}

const failoverStatusColor: Record<FailoverStatus, string> = {
  primary: "text-indigo-400",
  standby: "text-[var(--color-text-secondary)]",
  "active-failover": "text-amber-400",
}

const providerColor: Record<string, string> = {
  aws: "text-amber-400",
  gcp: "text-blue-400",
  azure: "text-indigo-400",
}

const REGION_COLORS = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-blue-500", "bg-purple-500"]

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function MultiRegionDashboard() {
  const [tab, setTab] = useState<"overview" | "traffic" | "latency" | "failover">("overview")
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  const tabs = [
    { id: "overview" as const, label: "Region Overview", emoji: "🌍" },
    { id: "traffic" as const, label: "Traffic", emoji: "📶" },
    { id: "latency" as const, label: "Latency Matrix", emoji: "⚡" },
    { id: "failover" as const, label: "Failover", emoji: "🔄" },
  ]

  const region = selectedRegion ? REGIONS.find(r => r.id === selectedRegion) : null
  const totalRPS = REGIONS.reduce((s, r) => s + r.requestsPerSec, 0)
  const degradedRegions = REGIONS.filter(r => r.status === "degraded" || r.status === "outage").length
  const avgAvailability = (REGIONS.reduce((s, r) => s + r.availability, 0) / REGIONS.length).toFixed(3)

  const maxHourlyRPS = Math.max(...TRAFFIC_HISTORY.map(h => Object.values(h.regions).reduce((a, b) => a + b, 0)))
  const regionIds = ["USE1", "EUW1", "APSE1", "USW2"]

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Multi-Region Dashboard</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Global infrastructure health, traffic, and failover management</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-md text-sm text-[var(--color-text-primary)] transition-colors">
            Traffic Policy
          </button>
          <button className="px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-md text-sm font-medium transition-colors">
            Trigger Failover
          </button>
        </div>
      </div>

      {/* Global summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={cn("bg-[var(--color-surface-1)] border rounded-lg p-4", degradedRegions > 0 ? "border-amber-400/30" : "border-[var(--color-border)]")}>
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Region Health</div>
          <div className={cn("text-2xl font-bold", degradedRegions > 0 ? "text-amber-400" : "text-emerald-400")}>
            {REGIONS.length - degradedRegions}/{REGIONS.length}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">{degradedRegions} degraded</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Global RPS</div>
          <div className="text-2xl font-bold text-indigo-400">{totalRPS.toLocaleString()}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">req/sec across all regions</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Avg Availability</div>
          <div className="text-2xl font-bold text-emerald-400">{avgAvailability}%</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">30-day rolling</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Active Failovers</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">0</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">all regions routing normally</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              tab === t.id
                ? "border-indigo-500 text-[var(--color-text-primary)] bg-[var(--color-surface-1)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-4">
          {REGIONS.map(r => (
            <div key={r.id} className={cn("bg-[var(--color-surface-1)] border rounded-lg overflow-hidden", r.status === "degraded" ? "border-amber-400/30" : r.status === "outage" ? "border-rose-400/30" : r.status === "maintenance" ? "border-[var(--color-surface-3)]" : "border-[var(--color-border)]")}>
              <button
                onClick={() => setSelectedRegion(selectedRegion === r.id ? null : r.id)}
                className="w-full text-left p-4 hover:bg-[var(--color-surface-2)]/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs font-bold uppercase", providerColor[r.provider])}>{r.provider}</span>
                      <span className="font-medium">{r.name}</span>
                      <span className="font-mono text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">{r.shortName}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", statusColor[r.status])}>
                        {r.status}
                      </span>
                      <span className={cn("text-xs", failoverStatusColor[r.failoverStatus])}>
                        {r.failoverStatus === "primary" ? "★ Primary" : r.failoverStatus === "standby" ? "◇ Standby" : "⟲ Failover Active"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {r.services.map(svc => (
                        <span key={svc} className="text-xs px-1.5 py-0.5 bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded">{svc}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 text-sm">
                    <div className="text-center">
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">RPS</div>
                      <div className="text-[var(--color-text-primary)] font-mono">{r.requestsPerSec.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Error%</div>
                      <div className={r.errorRate > 1 ? "text-rose-400" : r.errorRate > 0.1 ? "text-amber-400" : "text-emerald-400"}>
                        {r.errorRate}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">P99</div>
                      <div className={r.p99LatencyMs > 100 ? "text-amber-400" : "text-[var(--color-text-primary)]"}>
                        {r.p99LatencyMs}ms
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Instances</div>
                      <div className="text-[var(--color-text-primary)]">{r.activeInstances}/{r.totalInstances}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Traffic</div>
                      <div className="text-indigo-400">{r.trafficWeight}%</div>
                    </div>
                    <span className="text-[var(--color-text-muted)]">{selectedRegion === r.id ? "▲" : "▼"}</span>
                  </div>
                </div>
              </button>

              {selectedRegion === r.id && (
                <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-surface-0)]">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-[var(--color-surface-1)] rounded-md p-3">
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">30d Availability</div>
                      <div className={cn("text-lg font-bold", r.availability > 99.9 ? "text-emerald-400" : "text-amber-400")}>
                        {r.availability}%
                      </div>
                    </div>
                    <div className="bg-[var(--color-surface-1)] rounded-md p-3">
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">P50 Latency</div>
                      <div className="text-lg font-bold text-[var(--color-text-primary)]">{r.p50LatencyMs}ms</div>
                    </div>
                    <div className="bg-[var(--color-surface-1)] rounded-md p-3">
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Endpoints</div>
                      <div className="text-lg font-bold text-[var(--color-text-primary)]">{r.endpoints}</div>
                    </div>
                    <div className="bg-[var(--color-surface-1)] rounded-md p-3">
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Last Incident</div>
                      <div className="text-sm text-[var(--color-text-primary)]">{r.lastIncident ? fmtTime(r.lastIncident) : "None"}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="px-3 py-1 text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-md text-[var(--color-text-primary)] transition-colors">View Logs</button>
                    <button className="px-3 py-1 text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-md text-[var(--color-text-primary)] transition-colors">Traffic Policy</button>
                    {r.status !== "maintenance" && (
                      <button className="px-3 py-1 text-xs bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 rounded-md transition-colors">
                        Enter Maintenance
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Traffic Tab */}
      {tab === "traffic" && (
        <div className="space-y-6">
          {/* Traffic weight distribution */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Traffic Distribution (Current)</h3>
            <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
              {REGIONS.filter(r => r.trafficWeight > 0).map((r, i) => (
                <div
                  key={r.id}
                  className={REGION_COLORS[i % REGION_COLORS.length]}
                  style={{ width: `${r.trafficWeight}%` }}
                  title={`${r.shortName}: ${r.trafficWeight}%`}
                />
              ))}
            </div>
            <div className="flex gap-4 mt-3 flex-wrap">
              {REGIONS.filter(r => r.trafficWeight > 0).map((r, i) => (
                <span key={r.id} className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                  <span className={cn("w-3 h-3 rounded-sm inline-block", REGION_COLORS[i % REGION_COLORS.length])} />
                  {r.shortName} ({r.trafficWeight}%)
                </span>
              ))}
            </div>
          </div>

          {/* Hourly traffic chart */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Hourly Traffic Volume by Region</h3>
            <div className="flex items-end gap-2 h-40">
              {TRAFFIC_HISTORY.map(h => {
                const total = Object.values(h.regions).reduce((a, b) => a + b, 0)
                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end gap-px" style={{ height: "120px" }}>
                      {regionIds.map((rid, i) => {
                        const rps = h.regions[rid] ?? 0
                        return (
                          <div
                            key={rid}
                            className={REGION_COLORS[i % REGION_COLORS.length]}
                            style={{ height: `${(rps / maxHourlyRPS) * 120}px` }}
                          />
                        )
                      })}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">{h.hour}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] font-mono">{(total / 1000).toFixed(1)}k</div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-2 flex-wrap">
              {regionIds.map((rid, i) => (
                <span key={rid} className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                  <span className={cn("w-3 h-3 rounded-sm inline-block", REGION_COLORS[i % REGION_COLORS.length])} />
                  {rid}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Latency Matrix Tab */}
      {tab === "latency" && (
        <div className="space-y-4">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            <div className="p-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Cross-Region Latency</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Network RTT between regions (measured continuously)</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">From → To</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">P50</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">P99</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">Quality</th>
                </tr>
              </thead>
              <tbody>
                {LATENCIES.map(l => (
                  <tr key={`${l.from}-${l.to}`} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/20">
                    <td className="p-3">
                      <span className="font-mono text-indigo-300">{l.from}</span>
                      <span className="text-[var(--color-text-muted)] mx-2">→</span>
                      <span className="font-mono text-indigo-300">{l.to}</span>
                    </td>
                    <td className="p-3 text-right font-mono text-[var(--color-text-primary)]">{l.p50}ms</td>
                    <td className="p-3 text-right font-mono text-[var(--color-text-primary)]">{l.p99}ms</td>
                    <td className="p-3 text-right">
                      <span className={cn("text-xs", l.p99 < 100 ? "text-emerald-400" : l.p99 < 200 ? "text-amber-400" : "text-rose-400")}>
                        {l.p99 < 100 ? "Excellent" : l.p99 < 200 ? "Good" : "High"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Region status grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {REGIONS.map(r => (
              <div key={r.id} className={cn("bg-[var(--color-surface-1)] border rounded-lg p-3", statusColor[r.status].includes("emerald") ? "border-emerald-400/20" : statusColor[r.status].includes("amber") ? "border-amber-400/20" : "border-[var(--color-border)]")}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-bold text-[var(--color-text-primary)]">{r.shortName}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", statusColor[r.status])}>{r.status}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">P50</span>
                    <span className="text-[var(--color-text-primary)]">{r.p50LatencyMs > 0 ? `${r.p50LatencyMs}ms` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">P99</span>
                    <span className={r.p99LatencyMs > 100 ? "text-amber-400" : "text-[var(--color-text-primary)]"}>
                      {r.p99LatencyMs > 0 ? `${r.p99LatencyMs}ms` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failover Tab */}
      {tab === "failover" && (
        <div className="space-y-4">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Failover Policy</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-[var(--color-surface-2)] rounded-md p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Auto-Failover</div>
                <div className="text-emerald-400 font-medium">Enabled</div>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-md p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Error Rate Threshold</div>
                <div className="text-[var(--color-text-primary)]">1.5%</div>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-md p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Detection Window</div>
                <div className="text-[var(--color-text-primary)]">60 seconds</div>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-md p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Cooldown Period</div>
                <div className="text-[var(--color-text-primary)]">5 minutes</div>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-md p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Routing Strategy</div>
                <div className="text-[var(--color-text-primary)]">Weighted Round-Robin</div>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-md p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">DNS TTL</div>
                <div className="text-[var(--color-text-primary)]">30 seconds</div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            <div className="p-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Failover History</h3>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {FAILOVER_EVENTS.map(fe => (
                <div key={fe.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", fe.successful ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10")}>
                          {fe.successful ? "✓ Success" : "✗ Failed"}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-[var(--color-surface-2)] rounded text-[var(--color-text-secondary)]">
                          {fe.triggerType === "auto" ? "⟳ Auto" : "👤 Manual"}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">{fmtTime(fe.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <span className="font-mono text-[var(--color-text-primary)]">{fe.fromRegion}</span>
                        <span className="text-[var(--color-text-muted)]">→</span>
                        <span className="font-mono text-indigo-300">{fe.toRegion}</span>
                        <span className="text-[var(--color-text-muted)]">in {fe.duration}s</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">{fe.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
