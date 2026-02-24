import React, { useState } from "react"
import { cn } from "../lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type InterfaceStatus = "up" | "down" | "degraded"
type AlertSeverity = "critical" | "warning" | "info"
type AlertState = "active" | "acknowledged" | "silenced" | "resolved"
type Direction = "inbound" | "outbound" | "bidirectional"
type Protocol = "HTTP" | "HTTPS" | "DB" | "SSH" | "Other"

interface TrendPoint {
  date: string
  utilizationPct: number
  peakPct: number
  avgPct: number
  p95Pct: number
}

interface NetworkInterface {
  id: string
  name: string
  status: InterfaceStatus
  speedMbps: number
  inboundMbps: number
  outboundMbps: number
  inboundPps: number
  outboundPps: number
  errorRateIn: number
  errorRateOut: number
  dropRateIn: number
  dropRateOut: number
  mtu: number
  macAddress: string
  ipAddress: string
  ipv6Address: string
  duplex: string
  trend7d: TrendPoint[]
  peakMbps: number
  avgMbps: number
  p95Mbps: number
  projectedSaturationDays: number | null
}

interface TrafficFlow {
  id: string
  srcIp: string
  dstIp: string
  protocol: Protocol
  port: number
  bytesSec: number
  direction: Direction
  interfaceName: string
  packets: number
  connectionCount: number
  latencyMs: number
}

interface BandwidthAlert {
  id: string
  time: string
  interfaceName: string
  metric: string
  value: number
  threshold: number
  severity: AlertSeverity
  state: AlertState
  message: string
  unit: string
}

interface AlertThresholdConfig {
  interfaceId: string
  inboundWarningPct: number
  inboundCriticalPct: number
  outboundWarningPct: number
  outboundCriticalPct: number
  errorRateWarning: number
  errorRateCritical: number
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const DAYS_7 = ["02/16", "02/17", "02/18", "02/19", "02/20", "02/21", "02/22"]

function makeTrend(base: number, cap: number): TrendPoint[] {
  return DAYS_7.map((date, i) => {
    const variance = (Math.sin(i * 1.3) * 0.15 + Math.cos(i * 0.9) * 0.1)
    const avg = Math.min(cap, Math.max(5, base + variance * base))
    const peak = Math.min(cap, avg * (1.2 + i * 0.03))
    const p95 = Math.min(cap, avg * 1.1)
    return {
      date,
      utilizationPct: Math.round((avg / cap) * 100),
      peakPct: Math.round((peak / cap) * 100),
      avgPct: Math.round((avg / cap) * 100),
      p95Pct: Math.round((p95 / cap) * 100),
    }
  })
}

const MOCK_INTERFACES: NetworkInterface[] = [
  {
    id: "iface-eth0",
    name: "eth0",
    status: "up",
    speedMbps: 10000,
    inboundMbps: 3842,
    outboundMbps: 2191,
    inboundPps: 512400,
    outboundPps: 298700,
    errorRateIn: 0.002,
    errorRateOut: 0.001,
    dropRateIn: 0.004,
    dropRateOut: 0.002,
    mtu: 9000,
    macAddress: "00:1A:2B:3C:4D:5E",
    ipAddress: "10.0.1.1",
    ipv6Address: "fe80::21a:2bff:fe3c:4d5e",
    duplex: "Full",
    trend7d: makeTrend(3500, 10000),
    peakMbps: 7821,
    avgMbps: 3200,
    p95Mbps: 6100,
    projectedSaturationDays: 62,
  },
  {
    id: "iface-eth1",
    name: "eth1",
    status: "up",
    speedMbps: 10000,
    inboundMbps: 1204,
    outboundMbps: 987,
    inboundPps: 164000,
    outboundPps: 132100,
    errorRateIn: 0.001,
    errorRateOut: 0.0,
    dropRateIn: 0.001,
    dropRateOut: 0.001,
    mtu: 9000,
    macAddress: "00:1A:2B:3C:4D:5F",
    ipAddress: "10.0.1.2",
    ipv6Address: "fe80::21a:2bff:fe3c:4d5f",
    duplex: "Full",
    trend7d: makeTrend(1100, 10000),
    peakMbps: 4200,
    avgMbps: 1050,
    p95Mbps: 3100,
    projectedSaturationDays: 145,
  },
  {
    id: "iface-bond0",
    name: "bond0",
    status: "up",
    speedMbps: 20000,
    inboundMbps: 9800,
    outboundMbps: 8100,
    inboundPps: 1204000,
    outboundPps: 992000,
    errorRateIn: 0.003,
    errorRateOut: 0.002,
    dropRateIn: 0.005,
    dropRateOut: 0.003,
    mtu: 9000,
    macAddress: "00:1A:2B:3C:4D:60",
    ipAddress: "10.0.2.1",
    ipv6Address: "fe80::21a:2bff:fe3c:4d60",
    duplex: "Full",
    trend7d: makeTrend(8900, 20000),
    peakMbps: 18700,
    avgMbps: 8400,
    p95Mbps: 15200,
    projectedSaturationDays: 14,
  },
  {
    id: "iface-bond1",
    name: "bond1",
    status: "degraded",
    speedMbps: 20000,
    inboundMbps: 4310,
    outboundMbps: 3890,
    inboundPps: 551000,
    outboundPps: 497000,
    errorRateIn: 0.12,
    errorRateOut: 0.08,
    dropRateIn: 0.15,
    dropRateOut: 0.10,
    mtu: 9000,
    macAddress: "00:1A:2B:3C:4D:61",
    ipAddress: "10.0.2.2",
    ipv6Address: "fe80::21a:2bff:fe3c:4d61",
    duplex: "Full",
    trend7d: makeTrend(4000, 20000),
    peakMbps: 9100,
    avgMbps: 3800,
    p95Mbps: 7200,
    projectedSaturationDays: null,
  },
  {
    id: "iface-lo",
    name: "lo",
    status: "up",
    speedMbps: 0,
    inboundMbps: 0.12,
    outboundMbps: 0.12,
    inboundPps: 420,
    outboundPps: 420,
    errorRateIn: 0.0,
    errorRateOut: 0.0,
    dropRateIn: 0.0,
    dropRateOut: 0.0,
    mtu: 65536,
    macAddress: "00:00:00:00:00:00",
    ipAddress: "127.0.0.1",
    ipv6Address: "::1",
    duplex: "N/A",
    trend7d: makeTrend(0.1, 1000),
    peakMbps: 0.5,
    avgMbps: 0.1,
    p95Mbps: 0.3,
    projectedSaturationDays: null,
  },
  {
    id: "iface-eth2",
    name: "eth2",
    status: "up",
    speedMbps: 1000,
    inboundMbps: 621,
    outboundMbps: 489,
    inboundPps: 78400,
    outboundPps: 61200,
    errorRateIn: 0.005,
    errorRateOut: 0.003,
    dropRateIn: 0.007,
    dropRateOut: 0.005,
    mtu: 1500,
    macAddress: "00:1A:2B:3C:4D:62",
    ipAddress: "192.168.10.1",
    ipv6Address: "fe80::21a:2bff:fe3c:4d62",
    duplex: "Full",
    trend7d: makeTrend(580, 1000),
    peakMbps: 921,
    avgMbps: 540,
    p95Mbps: 810,
    projectedSaturationDays: 7,
  },
  {
    id: "iface-eth3",
    name: "eth3",
    status: "down",
    speedMbps: 1000,
    inboundMbps: 0,
    outboundMbps: 0,
    inboundPps: 0,
    outboundPps: 0,
    errorRateIn: 0.0,
    errorRateOut: 0.0,
    dropRateIn: 0.0,
    dropRateOut: 0.0,
    mtu: 1500,
    macAddress: "00:1A:2B:3C:4D:63",
    ipAddress: "—",
    ipv6Address: "—",
    duplex: "N/A",
    trend7d: makeTrend(0, 1000),
    peakMbps: 0,
    avgMbps: 0,
    p95Mbps: 0,
    projectedSaturationDays: null,
  },
  {
    id: "iface-vlan100",
    name: "vlan100",
    status: "up",
    speedMbps: 10000,
    inboundMbps: 2140,
    outboundMbps: 1876,
    inboundPps: 271000,
    outboundPps: 238000,
    errorRateIn: 0.001,
    errorRateOut: 0.0,
    dropRateIn: 0.002,
    dropRateOut: 0.001,
    mtu: 1500,
    macAddress: "00:1A:2B:3C:4D:64",
    ipAddress: "172.16.100.1",
    ipv6Address: "fe80::21a:2bff:fe3c:4d64",
    duplex: "Full",
    trend7d: makeTrend(1900, 10000),
    peakMbps: 5800,
    avgMbps: 1700,
    p95Mbps: 4100,
    projectedSaturationDays: 98,
  },
]

const MOCK_FLOWS: TrafficFlow[] = [
  { id: "f1", srcIp: "10.0.1.15", dstIp: "203.0.113.42", protocol: "HTTPS", port: 443, bytesSec: 524288000, direction: "outbound", interfaceName: "bond0", packets: 412000, connectionCount: 1840, latencyMs: 12 },
  { id: "f2", srcIp: "203.0.113.10", dstIp: "10.0.1.20", protocol: "HTTP", port: 80, bytesSec: 314572800, direction: "inbound", interfaceName: "bond0", packets: 287000, connectionCount: 3200, latencyMs: 8 },
  { id: "f3", srcIp: "10.0.1.5", dstIp: "10.0.3.100", protocol: "DB", port: 5432, bytesSec: 209715200, direction: "bidirectional", interfaceName: "eth0", packets: 198000, connectionCount: 420, latencyMs: 3 },
  { id: "f4", srcIp: "10.0.1.8", dstIp: "10.0.3.101", protocol: "DB", port: 3306, bytesSec: 157286400, direction: "bidirectional", interfaceName: "eth0", packets: 152000, connectionCount: 380, latencyMs: 4 },
  { id: "f5", srcIp: "198.51.100.22", dstIp: "10.0.1.1", protocol: "HTTPS", port: 443, bytesSec: 125829120, direction: "inbound", interfaceName: "bond0", packets: 118000, connectionCount: 910, latencyMs: 18 },
  { id: "f6", srcIp: "10.0.1.30", dstIp: "192.0.2.55", protocol: "SSH", port: 22, bytesSec: 62914560, direction: "outbound", interfaceName: "eth1", packets: 72000, connectionCount: 12, latencyMs: 22 },
  { id: "f7", srcIp: "10.0.1.12", dstIp: "10.0.3.200", protocol: "DB", port: 27017, bytesSec: 52428800, direction: "bidirectional", interfaceName: "eth0", packets: 61000, connectionCount: 210, latencyMs: 5 },
  { id: "f8", srcIp: "172.16.100.5", dstIp: "10.0.1.99", protocol: "HTTP", port: 8080, bytesSec: 41943040, direction: "inbound", interfaceName: "vlan100", packets: 49000, connectionCount: 1600, latencyMs: 11 },
  { id: "f9", srcIp: "10.0.2.14", dstIp: "198.51.100.80", protocol: "HTTPS", port: 443, bytesSec: 31457280, direction: "outbound", interfaceName: "bond1", packets: 38000, connectionCount: 750, latencyMs: 29 },
  { id: "f10", srcIp: "192.168.10.44", dstIp: "10.0.1.7", protocol: "Other", port: 9200, bytesSec: 20971520, direction: "inbound", interfaceName: "eth2", packets: 24000, connectionCount: 64, latencyMs: 6 },
]

const MOCK_ALERTS: BandwidthAlert[] = [
  { id: "a1", time: "2026-02-22 05:14:02", interfaceName: "bond0", metric: "Inbound Utilization", value: 98, threshold: 90, severity: "critical", state: "active", message: "bond0 inbound utilization exceeded critical threshold (90%)", unit: "%" },
  { id: "a2", time: "2026-02-22 04:58:17", interfaceName: "eth2", metric: "Inbound Utilization", value: 87, threshold: 80, severity: "warning", state: "active", message: "eth2 inbound utilization exceeded warning threshold (80%)", unit: "%" },
  { id: "a3", time: "2026-02-22 04:45:33", interfaceName: "bond1", metric: "Error Rate (In)", value: 0.12, threshold: 0.05, severity: "critical", state: "acknowledged", message: "bond1 inbound error rate critical — possible hardware fault", unit: "%" },
  { id: "a4", time: "2026-02-22 03:22:11", interfaceName: "bond0", metric: "Outbound Utilization", value: 93, threshold: 90, severity: "critical", state: "resolved", message: "bond0 outbound utilization exceeded critical threshold", unit: "%" },
  { id: "a5", time: "2026-02-22 02:10:55", interfaceName: "eth2", metric: "Projected Saturation", value: 7, threshold: 14, severity: "warning", state: "active", message: "eth2 projected saturation within 7 days", unit: "days" },
  { id: "a6", time: "2026-02-21 22:04:38", interfaceName: "eth3", metric: "Link Status", value: 0, threshold: 1, severity: "critical", state: "silenced", message: "eth3 link went down — no carrier detected", unit: "state" },
  { id: "a7", time: "2026-02-21 18:32:09", interfaceName: "bond1", metric: "Drop Rate (In)", value: 0.15, threshold: 0.05, severity: "warning", state: "acknowledged", message: "bond1 inbound drop rate above threshold", unit: "%" },
  { id: "a8", time: "2026-02-21 11:17:44", interfaceName: "vlan100", metric: "Inbound Utilization", value: 58, threshold: 70, severity: "info", state: "resolved", message: "vlan100 utilization trending up — within normal range", unit: "%" },
]

const DEFAULT_THRESHOLDS: AlertThresholdConfig[] = MOCK_INTERFACES.map((iface) => ({
  interfaceId: iface.id,
  inboundWarningPct: 80,
  inboundCriticalPct: 90,
  outboundWarningPct: 80,
  outboundCriticalPct: 90,
  errorRateWarning: 0.05,
  errorRateCritical: 0.1,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes >= 1073741824) {return `${(bytes / 1073741824).toFixed(1)} GB/s`}
  if (bytes >= 1048576) {return `${(bytes / 1048576).toFixed(1)} MB/s`}
  if (bytes >= 1024) {return `${(bytes / 1024).toFixed(1)} KB/s`}
  return `${bytes} B/s`
}

function fmtMbps(mbps: number): string {
  if (mbps >= 1000) {return `${(mbps / 1000).toFixed(2)} Gbps`}
  return `${mbps.toFixed(1)} Mbps`
}

function fmtPps(pps: number): string {
  if (pps >= 1000000) {return `${(pps / 1000000).toFixed(2)} Mpps`}
  if (pps >= 1000) {return `${(pps / 1000).toFixed(1)} Kpps`}
  return `${pps} pps`
}

function utilizationPct(current: number, speed: number): number {
  if (speed === 0) {return 0}
  return Math.min(100, Math.round((current / speed) * 100))
}

function statusColor(status: InterfaceStatus): string {
  if (status === "up") {return "bg-emerald-500"}
  if (status === "degraded") {return "bg-amber-500"}
  return "bg-red-500"
}

function statusLabel(status: InterfaceStatus): string {
  if (status === "up") {return "UP"}
  if (status === "degraded") {return "DEGRADED"}
  return "DOWN"
}

function severityColor(severity: AlertSeverity): string {
  if (severity === "critical") {return "text-red-400"}
  if (severity === "warning") {return "text-amber-400"}
  return "text-blue-400"
}

function severityBg(severity: AlertSeverity): string {
  if (severity === "critical") {return "bg-red-500/15 border-red-500/30"}
  if (severity === "warning") {return "bg-amber-500/15 border-amber-500/30"}
  return "bg-blue-500/15 border-blue-500/30"
}

function stateColor(state: AlertState): string {
  if (state === "active") {return "text-red-400"}
  if (state === "acknowledged") {return "text-amber-400"}
  if (state === "silenced") {return "text-[var(--color-text-secondary)]"}
  return "text-emerald-400"
}

function protocolColor(protocol: Protocol): string {
  if (protocol === "HTTP") {return "bg-blue-500"}
  if (protocol === "HTTPS") {return "bg-indigo-500"}
  if (protocol === "DB") {return "bg-violet-500"}
  if (protocol === "SSH") {return "bg-amber-500"}
  return "bg-[var(--color-surface-3)]"
}

function directionLabel(direction: Direction): string {
  if (direction === "inbound") {return "← In"}
  if (direction === "outbound") {return "→ Out"}
  return "↔ Bi"
}

function utilizationBarColor(pct: number): string {
  if (pct >= 90) {return "bg-red-500"}
  if (pct >= 75) {return "bg-amber-500"}
  if (pct >= 50) {return "bg-indigo-400"}
  return "bg-indigo-500"
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MiniBarProps {
  pct: number
  height?: number
  label?: string
}

function MiniBar({ pct, height = 6, label }: MiniBarProps) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex-1 rounded-full overflow-hidden bg-[var(--color-surface-2)]"
        style={{ height }}
      >
        <div
          className={cn("absolute left-0 top-0 h-full rounded-full transition-all", utilizationBarColor(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {label !== undefined && (
        <span className="text-xs text-[var(--color-text-secondary)] w-10 text-right">{label}</span>
      )}
    </div>
  )
}

interface StatCellProps {
  label: string
  value: string
  accent?: boolean
}

function StatCell({ label, value, accent }: StatCellProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span className={cn("text-sm font-mono font-medium", accent ? "text-indigo-300" : "text-[var(--color-text-primary)]")}>
        {value}
      </span>
    </div>
  )
}

// ─── Tab: Interfaces ──────────────────────────────────────────────────────────

interface InterfacesTabProps {
  interfaces: NetworkInterface[]
}

function InterfacesTab({ interfaces }: InterfacesTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = interfaces.find((i) => i.id === selectedId) ?? null

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* List */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2 overflow-y-auto pr-1">
        {interfaces.map((iface) => {
          const inPct = utilizationPct(iface.inboundMbps, iface.speedMbps)
          const outPct = utilizationPct(iface.outboundMbps, iface.speedMbps)
          const isSelected = selectedId === iface.id
          return (
            <button
              key={iface.id}
              onClick={() => setSelectedId(iface.id === selectedId ? null : iface.id)}
              className={cn(
                "w-full text-left rounded-lg border p-3 transition-all",
                isSelected
                  ? "bg-indigo-500/10 border-indigo-500/50"
                  : "bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColor(iface.status))}
                  />
                  <span className="text-sm font-mono font-semibold text-[var(--color-text-primary)]">{iface.name}</span>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded",
                    iface.status === "up"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : iface.status === "degraded"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-red-500/20 text-red-400"
                  )}
                >
                  {statusLabel(iface.status)}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-0.5">
                    <span>IN</span>
                    <span>{fmtMbps(iface.inboundMbps)}</span>
                  </div>
                  <MiniBar pct={inPct} height={5} label={`${inPct}%`} />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-0.5">
                    <span>OUT</span>
                    <span>{fmtMbps(iface.outboundMbps)}</span>
                  </div>
                  <MiniBar pct={outPct} height={5} label={`${outPct}%`} />
                </div>
              </div>

              <div className="flex justify-between mt-2 text-[10px] text-[var(--color-text-muted)]">
                <span>PKT: {fmtPps(iface.inboundPps + iface.outboundPps)}</span>
                <span>ERR: {((iface.errorRateIn + iface.errorRateOut) / 2).toFixed(3)}%</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Detail Panel */}
      <div className="flex-1 min-w-0">
        {selected ? (
          <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-5 h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className={cn("w-3 h-3 rounded-full", statusColor(selected.status))} />
                <h3 className="text-xl font-mono font-bold text-[var(--color-text-primary)]">{selected.name}</h3>
                <span className="text-sm text-[var(--color-text-secondary)] font-mono">{fmtMbps(selected.speedMbps)} link</span>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Throughput Bars */}
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest mb-3">Throughput</h4>
              <div className="space-y-3">
                {[
                  { label: "Inbound", mbps: selected.inboundMbps },
                  { label: "Outbound", mbps: selected.outboundMbps },
                ].map(({ label, mbps }) => {
                  const pct = utilizationPct(mbps, selected.speedMbps)
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                        <span>{label}</span>
                        <span className="font-mono">
                          {fmtMbps(mbps)} / {fmtMbps(selected.speedMbps)} ({pct}%)
                        </span>
                      </div>
                      <MiniBar pct={pct} height={10} />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
              <StatCell label="IP Address" value={selected.ipAddress} />
              <StatCell label="IPv6 Address" value={selected.ipv6Address} />
              <StatCell label="MAC Address" value={selected.macAddress} />
              <StatCell label="MTU" value={`${selected.mtu} bytes`} />
              <StatCell label="Duplex" value={selected.duplex} />
              <StatCell label="In Packets" value={fmtPps(selected.inboundPps)} />
              <StatCell label="Out Packets" value={fmtPps(selected.outboundPps)} />
              <StatCell label="Error Rate In" value={`${selected.errorRateIn.toFixed(3)}%`} accent={selected.errorRateIn > 0.05} />
              <StatCell label="Error Rate Out" value={`${selected.errorRateOut.toFixed(3)}%`} accent={selected.errorRateOut > 0.05} />
              <StatCell label="Drop Rate In" value={`${selected.dropRateIn.toFixed(3)}%`} accent={selected.dropRateIn > 0.05} />
              <StatCell label="Drop Rate Out" value={`${selected.dropRateOut.toFixed(3)}%`} accent={selected.dropRateOut > 0.05} />
              <StatCell label="Peak" value={fmtMbps(selected.peakMbps)} />
              <StatCell label="Avg" value={fmtMbps(selected.avgMbps)} />
              <StatCell label="P95" value={fmtMbps(selected.p95Mbps)} />
              <StatCell
                label="Projected Saturation"
                value={selected.projectedSaturationDays !== null ? `${selected.projectedSaturationDays}d` : "N/A"}
                accent={selected.projectedSaturationDays !== null && selected.projectedSaturationDays <= 14}
              />
            </div>

            {/* 7-day Trend */}
            <div>
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest mb-3">7-Day Utilization Trend</h4>
              <div className="flex items-end gap-1 h-20">
                {selected.trend7d.map((pt) => (
                  <div key={pt.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute bottom-6 hidden group-hover:flex flex-col items-center z-10">
                      <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-1 text-[10px] text-[var(--color-text-primary)] whitespace-nowrap">
                        {pt.date}: {pt.utilizationPct}%
                      </div>
                    </div>
                    <div className="w-full rounded-sm overflow-hidden bg-[var(--color-surface-2)]" style={{ height: 60 }}>
                      <div
                        className={cn("w-full rounded-sm", utilizationBarColor(pt.utilizationPct))}
                        style={{ height: `${pt.utilizationPct}%`, marginTop: `${100 - pt.utilizationPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-[var(--color-text-muted)]">{pt.date.slice(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-8 h-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center mb-3">
              <div className="w-5 h-5 rounded-full border-2 border-[var(--color-surface-3)]" />
            </div>
            <p className="text-[var(--color-text-secondary)] text-sm">Select an interface to view detailed statistics</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Traffic Flow ────────────────────────────────────────────────────────

const PROTOCOLS: Protocol[] = ["HTTP", "HTTPS", "DB", "SSH", "Other"]

interface TrafficFlowTabProps {
  flows: TrafficFlow[]
}

function TrafficFlowTab({ flows }: TrafficFlowTabProps) {
  const sorted = [...flows].toSorted((a, b) => b.bytesSec - a.bytesSec)
  const maxBytes = sorted[0]?.bytesSec ?? 1

  // Protocol totals for stacked bar
  const protocolTotals: Record<Protocol, number> = { HTTP: 0, HTTPS: 0, DB: 0, SSH: 0, Other: 0 }
  flows.forEach((f) => { protocolTotals[f.protocol] += f.bytesSec })
  const grandTotal = Object.values(protocolTotals).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      {/* Stacked Protocol Chart */}
      <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Bandwidth by Protocol Category</h3>
        <div className="flex h-8 rounded-lg overflow-hidden gap-px mb-3">
          {PROTOCOLS.map((p) => {
            const pct = (protocolTotals[p] / grandTotal) * 100
            if (pct < 0.5) {return null}
            return (
              <div
                key={p}
                className={cn("flex items-center justify-center text-xs font-semibold text-[var(--color-text-primary)] transition-all", protocolColor(p))}
                style={{ width: `${pct}%` }}
                title={`${p}: ${fmtBytes(protocolTotals[p])}`}
              >
                {pct > 8 ? p : ""}
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          {PROTOCOLS.map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <span className={cn("w-2.5 h-2.5 rounded-sm", protocolColor(p))} />
              <span className="text-xs text-[var(--color-text-secondary)]">{p}</span>
              <span className="text-xs font-mono text-[var(--color-text-primary)]">{fmtBytes(protocolTotals[p])}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Flow Table */}
      <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Top Flows by Bandwidth</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["#", "Src IP", "Dst IP", "Proto", "Port", "Bandwidth", "Direction", "Interface", "Latency"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((flow, idx) => {
                const pct = (flow.bytesSec / maxBytes) * 100
                return (
                  <tr key={flow.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/30 transition-colors">
                    <td className="px-4 py-3 text-[var(--color-text-muted)] font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-primary)]">{flow.srcIp}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-primary)]">{flow.dstIp}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-bold text-[var(--color-text-primary)]", protocolColor(flow.protocol))}>
                        {flow.protocol}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">{flow.port}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <div className="flex-1 h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", protocolColor(flow.protocol))}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-[var(--color-text-primary)] whitespace-nowrap">{fmtBytes(flow.bytesSec)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{directionLabel(flow.direction)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">{flow.interfaceName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">{flow.latencyMs}ms</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Alerts ──────────────────────────────────────────────────────────────

interface AlertsTabProps {
  alerts: BandwidthAlert[]
  thresholds: AlertThresholdConfig[]
  interfaces: NetworkInterface[]
}

function AlertsTab({ alerts: initialAlerts, thresholds: initialThresholds, interfaces }: AlertsTabProps) {
  const [alerts, setAlerts] = useState<BandwidthAlert[]>(initialAlerts)
  const [thresholds, setThresholds] = useState<AlertThresholdConfig[]>(initialThresholds)
  const [editingIfaceId, setEditingIfaceId] = useState<string | null>(null)

  function handleAction(id: string, action: "acknowledge" | "silence" | "resolve") {
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id !== id) {return a}
        const stateMap: Record<string, AlertState> = {
          acknowledge: "acknowledged",
          silence: "silenced",
          resolve: "resolved",
        }
        return { ...a, state: stateMap[action] }
      })
    )
  }

  function handleThresholdChange(
    ifaceId: string,
    field: keyof Omit<AlertThresholdConfig, "interfaceId">,
    value: number
  ) {
    setThresholds((prev) =>
      prev.map((t) => (t.interfaceId === ifaceId ? { ...t, [field]: value } : t))
    )
  }

  const activeCount = alerts.filter((a) => a.state === "active").length
  const ackCount = alerts.filter((a) => a.state === "acknowledged").length

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Active", count: activeCount, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
          { label: "Acknowledged", count: ackCount, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
          { label: "Silenced", count: alerts.filter((a) => a.state === "silenced").length, color: "text-[var(--color-text-secondary)]", bg: "bg-[var(--color-surface-2)] border-[var(--color-border)]" },
          { label: "Resolved", count: alerts.filter((a) => a.state === "resolved").length, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={cn("rounded-xl border p-4 flex flex-col gap-1", bg)}>
            <span className={cn("text-2xl font-bold font-mono", color)}>{count}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
          </div>
        ))}
      </div>

      {/* Alert History */}
      <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Alert History</h3>
        </div>
        <div className="divide-y divide-[var(--color-border)]/50">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "px-5 py-4 flex gap-4 items-start transition-colors",
                alert.state === "active" ? "bg-[var(--color-surface-1)]" : "bg-[var(--color-surface-1)]/50"
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                    severityBg(alert.severity),
                    severityColor(alert.severity)
                  )}
                >
                  {alert.severity}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-mono text-[var(--color-text-secondary)]">{alert.time}</span>
                  <span className="text-xs font-mono font-semibold text-indigo-300">{alert.interfaceName}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{alert.metric}</span>
                </div>
                <p className="text-sm text-[var(--color-text-primary)] mb-1">{alert.message}</p>
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                  <span>
                    Value: <span className="font-mono text-[var(--color-text-primary)]">{alert.value}{alert.unit}</span>
                  </span>
                  <span>
                    Threshold: <span className="font-mono text-[var(--color-text-primary)]">{alert.threshold}{alert.unit}</span>
                  </span>
                  <span className={cn("font-semibold", stateColor(alert.state))}>
                    {alert.state.charAt(0).toUpperCase() + alert.state.slice(1)}
                  </span>
                </div>
              </div>
              {alert.state === "active" && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAction(alert.id, "acknowledge")}
                    className="px-2.5 py-1 text-xs rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/20 transition-colors"
                  >
                    Ack
                  </button>
                  <button
                    onClick={() => handleAction(alert.id, "silence")}
                    className="px-2.5 py-1 text-xs rounded bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-colors"
                  >
                    Silence
                  </button>
                  <button
                    onClick={() => handleAction(alert.id, "resolve")}
                    className="px-2.5 py-1 text-xs rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/20 transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              )}
              {alert.state === "acknowledged" && (
                <button
                  onClick={() => handleAction(alert.id, "resolve")}
                  className="flex-shrink-0 px-2.5 py-1 text-xs rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/20 transition-colors"
                >
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Threshold Config */}
      <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Threshold Configuration</h3>
          <span className="text-xs text-[var(--color-text-muted)]">Click interface to expand</span>
        </div>
        <div className="divide-y divide-[var(--color-border)]/50">
          {interfaces.map((iface) => {
            const cfg = thresholds.find((t) => t.interfaceId === iface.id)
            if (!cfg) {return null}
            const isOpen = editingIfaceId === iface.id
            return (
              <div key={iface.id}>
                <button
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-[var(--color-surface-2)]/30 transition-colors"
                  onClick={() => setEditingIfaceId(isOpen ? null : iface.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", statusColor(iface.status))} />
                    <span className="font-mono text-sm text-[var(--color-text-primary)]">{iface.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                    <span>
                      In warn: <span className="text-[var(--color-text-primary)] font-mono">{cfg.inboundWarningPct}%</span>
                    </span>
                    <span>
                      In crit: <span className="text-red-400 font-mono">{cfg.inboundCriticalPct}%</span>
                    </span>
                    <span className={cn("transition-transform text-[var(--color-text-muted)]", isOpen ? "rotate-90" : "")}>›</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 grid grid-cols-2 gap-4 bg-[var(--color-surface-2)]/20">
                    {(
                      [
                        { field: "inboundWarningPct", label: "Inbound Warning (%)" },
                        { field: "inboundCriticalPct", label: "Inbound Critical (%)" },
                        { field: "outboundWarningPct", label: "Outbound Warning (%)" },
                        { field: "outboundCriticalPct", label: "Outbound Critical (%)" },
                        { field: "errorRateWarning", label: "Error Rate Warning (%)" },
                        { field: "errorRateCritical", label: "Error Rate Critical (%)" },
                      ] as Array<{ field: keyof Omit<AlertThresholdConfig, "interfaceId">; label: string }>
                    ).map(({ field, label }) => (
                      <label key={field} className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={cfg[field]}
                          onChange={(e) =>
                            handleThresholdChange(iface.id, field, parseFloat(e.target.value))
                          }
                          className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-[var(--color-text-primary)] font-mono focus:border-indigo-500 focus:outline-none w-full"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Capacity ────────────────────────────────────────────────────────────

interface CapacityTabProps {
  interfaces: NetworkInterface[]
}

function CapacityTab({ interfaces }: CapacityTabProps) {
  const [sortKey, setSortKey] = useState<"name" | "utilization" | "saturation">("utilization")

  const sorted = [...interfaces].toSorted((a, b) => {
    if (sortKey === "name") {return a.name.localeCompare(b.name)}
    if (sortKey === "utilization") {
      const au = utilizationPct(a.inboundMbps + a.outboundMbps, a.speedMbps * 2 || 1)
      const bu = utilizationPct(b.inboundMbps + b.outboundMbps, b.speedMbps * 2 || 1)
      return bu - au
    }
    const ad = a.projectedSaturationDays ?? 9999
    const bd = b.projectedSaturationDays ?? 9999
    return ad - bd
  })

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-muted)]">Sort by:</span>
        {(["utilization", "saturation", "name"] as Array<"name" | "utilization" | "saturation">).map((key) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={cn(
              "px-3 py-1 rounded text-xs font-medium transition-colors",
              sortKey === key
                ? "bg-indigo-500 text-[var(--color-text-primary)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]"
            )}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {/* Per-Interface Capacity Cards */}
      <div className="flex flex-col gap-4">
        {sorted.map((iface) => {
          const currentUtilPct = iface.speedMbps > 0
            ? Math.round(((iface.inboundMbps + iface.outboundMbps) / (iface.speedMbps * 2)) * 100)
            : 0

          return (
            <div key={iface.id} className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2.5 h-2.5 rounded-full", statusColor(iface.status))} />
                  <span className="font-mono font-bold text-[var(--color-text-primary)]">{iface.name}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{fmtMbps(iface.speedMbps)} link</span>
                </div>
                {iface.projectedSaturationDays !== null ? (
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded border font-mono",
                      iface.projectedSaturationDays <= 7
                        ? "bg-red-500/15 border-red-500/30 text-red-400"
                        : iface.projectedSaturationDays <= 30
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                        : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)]"
                    )}
                  >
                    Saturation in {iface.projectedSaturationDays}d
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded border bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)]">
                    No saturation projected
                  </span>
                )}
              </div>

              {/* Current Utilization */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-1.5">
                  <span>Current Utilization (combined)</span>
                  <span className="font-mono">{currentUtilPct}%</span>
                </div>
                <MiniBar pct={currentUtilPct} height={10} />
              </div>

              {/* 7-day Trend */}
              <div className="mb-4">
                <h4 className="text-xs text-[var(--color-text-muted)] mb-2">7-Day Utilization Trend</h4>
                <div className="flex items-end gap-1" style={{ height: 48 }}>
                  {iface.trend7d.map((pt) => (
                    <div key={pt.date} className="flex-1 flex flex-col items-center gap-1 relative group">
                      <div className="absolute bottom-5 hidden group-hover:flex z-10 pointer-events-none">
                        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text-primary)] whitespace-nowrap">
                          {pt.date}: avg {pt.avgPct}% | peak {pt.peakPct}%
                        </div>
                      </div>
                      <div className="w-full rounded-sm bg-[var(--color-surface-2)] relative overflow-hidden" style={{ height: 40 }}>
                        {/* Peak bar (lighter) */}
                        <div
                          className={cn("absolute bottom-0 w-full opacity-30", utilizationBarColor(pt.peakPct))}
                          style={{ height: `${pt.peakPct}%` }}
                        />
                        {/* Avg bar */}
                        <div
                          className={cn("absolute bottom-0 w-full", utilizationBarColor(pt.avgPct))}
                          style={{ height: `${pt.avgPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-[var(--color-text-muted)]">{pt.date.slice(3)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peak / Avg / P95 Table */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--color-border)]">
                <div className="text-center">
                  <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Peak</div>
                  <div className="font-mono text-sm font-semibold text-red-400">{fmtMbps(iface.peakMbps)}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    {iface.speedMbps > 0 ? `${Math.round((iface.peakMbps / iface.speedMbps) * 100)}%` : "—"}
                  </div>
                </div>
                <div className="text-center border-x border-[var(--color-border)]">
                  <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Average</div>
                  <div className="font-mono text-sm font-semibold text-indigo-300">{fmtMbps(iface.avgMbps)}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    {iface.speedMbps > 0 ? `${Math.round((iface.avgMbps / iface.speedMbps) * 100)}%` : "—"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[var(--color-text-muted)] mb-0.5">P95</div>
                  <div className="font-mono text-sm font-semibold text-amber-300">{fmtMbps(iface.p95Mbps)}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    {iface.speedMbps > 0 ? `${Math.round((iface.p95Mbps / iface.speedMbps) * 100)}%` : "—"}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type TabId = "interfaces" | "traffic" | "alerts" | "capacity"

interface Tab {
  id: TabId
  label: string
}

const TABS: Tab[] = [
  { id: "interfaces", label: "Interfaces" },
  { id: "traffic", label: "Traffic Flow" },
  { id: "alerts", label: "Alerts" },
  { id: "capacity", label: "Capacity" },
]

export default function NetworkBandwidthMonitor() {
  const [activeTab, setActiveTab] = useState<TabId>("interfaces")

  const activeAlertCount = MOCK_ALERTS.filter((a) => a.state === "active").length

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-0)] px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Network Bandwidth Monitor</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {MOCK_INTERFACES.filter((i) => i.status === "up").length} up ·{" "}
            {MOCK_INTERFACES.filter((i) => i.status === "degraded").length} degraded ·{" "}
            {MOCK_INTERFACES.filter((i) => i.status === "down").length} down · {MOCK_INTERFACES.length} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-[var(--color-text-secondary)]">Live</span>
          </div>
          <div className="h-4 w-px bg-[var(--color-surface-2)]" />
          <span className="text-xs text-[var(--color-text-muted)]">Updated 2026-02-22 05:22 MST</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-0)] px-6 flex-shrink-0">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2",
                activeTab === tab.id
                  ? "border-indigo-500 text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {tab.label}
              {tab.id === "alerts" && activeAlertCount > 0 && (
                <span className="bg-red-500 text-[var(--color-text-primary)] text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {activeAlertCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        {activeTab === "interfaces" && (
          <InterfacesTab interfaces={MOCK_INTERFACES} />
        )}
        {activeTab === "traffic" && (
          <TrafficFlowTab flows={MOCK_FLOWS} />
        )}
        {activeTab === "alerts" && (
          <AlertsTab
            alerts={MOCK_ALERTS}
            thresholds={DEFAULT_THRESHOLDS}
            interfaces={MOCK_INTERFACES}
          />
        )}
        {activeTab === "capacity" && (
          <CapacityTab interfaces={MOCK_INTERFACES} />
        )}
      </div>
    </div>
  )
}
