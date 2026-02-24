import React, { useState } from "react"
import { cn } from "../lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "current" | "forecast" | "planning" | "alerts"
type ResourceType = "CPU" | "Memory" | "Storage" | "Network"
type ForecastResource = "CPU" | "Memory" | "Storage"
type ChangeStatus = "draft" | "approved" | "scheduled" | "completed"
type ChangeAction = "scale-up" | "scale-down" | "add" | "remove"
type AlertSeverity = "critical" | "warning" | "info"

interface ResourceCard {
  type: ResourceType
  currentPct: number
  capacity: string
  used: string
}

interface ServiceUtilization {
  id: string
  name: string
  cpu: number
  memory: number
  instances: number
  autoScale: boolean
  threshold: number
  history: number[]
}

interface ForecastMonth {
  month: string
  current: number
  projected: number
  headroom: number
}

interface ForecastData {
  resource: ForecastResource
  months: ForecastMonth[]
  growthRate: number
  confidenceInterval: string
  model: string
  lastUpdated: string
}

interface ChangeRequest {
  id: string
  resourceType: ResourceType
  action: ChangeAction
  quantity: string
  requester: string
  targetDate: string
  costImpact: number
  status: ChangeStatus
}

interface CapacityAlert {
  id: string
  resource: ResourceType
  service: string
  currentValue: number
  threshold: number
  severity: AlertSeverity
  triggeredAt: string
  acknowledged: boolean
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const resourceCards: ResourceCard[] = [
  { type: "CPU",     currentPct: 72, capacity: "1,280 vCPU", used: "921 vCPU" },
  { type: "Memory",  currentPct: 58, capacity: "5.12 TB",    used: "2.97 TB"  },
  { type: "Storage", currentPct: 84, capacity: "800 TB",     used: "672 TB"   },
  { type: "Network", currentPct: 45, capacity: "40 Gbps",    used: "18 Gbps"  },
]

const services: ServiceUtilization[] = [
  {
    id: "svc-api",
    name: "api-gateway",
    cpu: 83, memory: 67, instances: 12, autoScale: true, threshold: 80,
    history: [71, 74, 78, 82, 85, 83, 80, 77, 79, 83, 86, 83],
  },
  {
    id: "svc-auth",
    name: "auth-service",
    cpu: 54, memory: 49, instances: 4, autoScale: true, threshold: 75,
    history: [48, 51, 53, 55, 57, 54, 52, 50, 53, 55, 54, 54],
  },
  {
    id: "svc-db",
    name: "postgres-primary",
    cpu: 91, memory: 88, instances: 2, autoScale: false, threshold: 85,
    history: [82, 85, 87, 89, 92, 91, 90, 88, 89, 91, 93, 91],
  },
  {
    id: "svc-cache",
    name: "redis-cluster",
    cpu: 38, memory: 72, instances: 6, autoScale: false, threshold: 80,
    history: [35, 36, 37, 38, 40, 39, 38, 37, 37, 38, 39, 38],
  },
  {
    id: "svc-worker",
    name: "job-workers",
    cpu: 67, memory: 55, instances: 8, autoScale: true, threshold: 70,
    history: [60, 63, 65, 68, 70, 67, 64, 62, 65, 68, 69, 67],
  },
  {
    id: "svc-stream",
    name: "event-stream",
    cpu: 79, memory: 63, instances: 5, autoScale: true, threshold: 80,
    history: [70, 72, 74, 76, 79, 80, 78, 75, 76, 78, 80, 79],
  },
]

const forecastData: ForecastData[] = [
  {
    resource: "CPU",
    months: [
      { month: "Mar 2026", current: 72, projected: 79, headroom: 21 },
      { month: "Apr 2026", current: 72, projected: 85, headroom: 15 },
      { month: "May 2026", current: 72, projected: 93, headroom: 7  },
    ],
    growthRate: 8.5,
    confidenceInterval: "±4.2%",
    model: "Linear Regression",
    lastUpdated: "2026-02-22 00:00",
  },
  {
    resource: "Memory",
    months: [
      { month: "Mar 2026", current: 58, projected: 63, headroom: 37 },
      { month: "Apr 2026", current: 58, projected: 68, headroom: 32 },
      { month: "May 2026", current: 58, projected: 74, headroom: 26 },
    ],
    growthRate: 5.2,
    confidenceInterval: "±2.8%",
    model: "ARIMA",
    lastUpdated: "2026-02-22 00:00",
  },
  {
    resource: "Storage",
    months: [
      { month: "Mar 2026", current: 84, projected: 87, headroom: 13 },
      { month: "Apr 2026", current: 84, projected: 91, headroom: 9  },
      { month: "May 2026", current: 84, projected: 95, headroom: 5  },
    ],
    growthRate: 3.8,
    confidenceInterval: "±1.5%",
    model: "Prophet",
    lastUpdated: "2026-02-21 18:00",
  },
]

const changeRequests: ChangeRequest[] = [
  {
    id: "cr-001", resourceType: "CPU",     action: "scale-up",   quantity: "+8 vCPU",
    requester: "ops-team",     targetDate: "2026-03-01", costImpact:  320, status: "approved",
  },
  {
    id: "cr-002", resourceType: "Storage", action: "add",        quantity: "+100 TB",
    requester: "data-team",    targetDate: "2026-03-15", costImpact: 1800, status: "draft",
  },
  {
    id: "cr-003", resourceType: "Memory",  action: "scale-up",   quantity: "+512 GB",
    requester: "platform-eng", targetDate: "2026-02-28", costImpact:  640, status: "scheduled",
  },
  {
    id: "cr-004", resourceType: "CPU",     action: "scale-down", quantity: "-4 vCPU",
    requester: "finops",       targetDate: "2026-04-01", costImpact: -160, status: "draft",
  },
  {
    id: "cr-005", resourceType: "Network", action: "add",        quantity: "+10 Gbps",
    requester: "infra-team",   targetDate: "2026-03-20", costImpact:  950, status: "completed",
  },
  {
    id: "cr-006", resourceType: "Storage", action: "remove",     quantity: "-20 TB",
    requester: "finops",       targetDate: "2026-04-15", costImpact: -360, status: "draft",
  },
]

const initialAlerts: CapacityAlert[] = [
  { id: "alt-001", resource: "CPU",     service: "postgres-primary", currentValue: 91, threshold: 85, severity: "critical", triggeredAt: "2026-02-22 03:42", acknowledged: false },
  { id: "alt-002", resource: "Storage", service: "data-lake",        currentValue: 88, threshold: 85, severity: "critical", triggeredAt: "2026-02-22 01:15", acknowledged: false },
  { id: "alt-003", resource: "CPU",     service: "api-gateway",      currentValue: 83, threshold: 80, severity: "warning",  triggeredAt: "2026-02-22 04:01", acknowledged: false },
  { id: "alt-004", resource: "Memory",  service: "postgres-primary", currentValue: 88, threshold: 85, severity: "critical", triggeredAt: "2026-02-22 03:42", acknowledged: true  },
  { id: "alt-005", resource: "CPU",     service: "event-stream",     currentValue: 79, threshold: 80, severity: "warning",  triggeredAt: "2026-02-21 22:30", acknowledged: true  },
  { id: "alt-006", resource: "Memory",  service: "redis-cluster",    currentValue: 72, threshold: 75, severity: "warning",  triggeredAt: "2026-02-21 20:15", acknowledged: false },
  { id: "alt-007", resource: "Storage", service: "log-archive",      currentValue: 78, threshold: 80, severity: "info",     triggeredAt: "2026-02-21 18:00", acknowledged: true  },
  { id: "alt-008", resource: "Network", service: "cdn-edge",         currentValue: 71, threshold: 75, severity: "info",     triggeredAt: "2026-02-21 16:45", acknowledged: false },
  { id: "alt-009", resource: "CPU",     service: "job-workers",      currentValue: 67, threshold: 70, severity: "warning",  triggeredAt: "2026-02-22 02:20", acknowledged: false },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function utilizationTextColor(pct: number): string {
  if (pct >= 80) {return "text-rose-400"}
  if (pct >= 60) {return "text-amber-400"}
  return "text-emerald-400"
}

function utilizationBarColor(pct: number): string {
  if (pct >= 80) {return "bg-rose-400"}
  if (pct >= 60) {return "bg-amber-400"}
  return "bg-emerald-400"
}

function severityTextColor(severity: AlertSeverity): string {
  if (severity === "critical") {return "text-rose-400"}
  if (severity === "warning")  {return "text-amber-400"}
  return "text-indigo-400"
}

function severityBadgeClass(severity: AlertSeverity): string {
  if (severity === "critical") {return "bg-rose-400/10 text-rose-400 border border-rose-400/20"}
  if (severity === "warning")  {return "bg-amber-400/10 text-amber-400 border border-amber-400/20"}
  return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
}

function statusBadgeClass(status: ChangeStatus): string {
  if (status === "completed") {return "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"}
  if (status === "approved")  {return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"}
  if (status === "scheduled") {return "bg-amber-400/10 text-amber-400 border border-amber-400/20"}
  return "bg-[var(--color-surface-3)]/50 text-[var(--color-text-secondary)] border border-[var(--color-border)]"
}

function actionLabel(action: ChangeAction): string {
  if (action === "scale-up")   {return "⬆ Scale Up"}
  if (action === "scale-down") {return "⬇ Scale Down"}
  if (action === "add")        {return "+ Add"}
  return "− Remove"
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CapacityForecastDashboard() {
  const [activeTab,        setActiveTab]        = useState<TabId>("current")
  const [expandedService,  setExpandedService]  = useState<string | null>(null)
  const [forecastResource, setForecastResource] = useState<ForecastResource>("CPU")
  const [showAcknowledged, setShowAcknowledged] = useState(false)
  const [changeStatuses,   setChangeStatuses]   = useState<Record<string, ChangeStatus>>(
    Object.fromEntries(changeRequests.map(cr => [cr.id, cr.status]))
  )

  const tabs: { id: TabId; label: string }[] = [
    { id: "current",  label: "📊 Current"  },
    { id: "forecast", label: "📈 Forecast" },
    { id: "planning", label: "📋 Planning" },
    { id: "alerts",   label: "🔔 Alerts"   },
  ]

  const activeForecast = forecastData.find(f => f.resource === forecastResource) ?? forecastData[0]

  const filteredAlerts = showAcknowledged
    ? initialAlerts
    : initialAlerts.filter(a => !a.acknowledged)

  const criticalCount = initialAlerts.filter(a => a.severity === "critical" && !a.acknowledged).length
  const warningCount  = initialAlerts.filter(a => a.severity === "warning"  && !a.acknowledged).length
  const infoCount     = initialAlerts.filter(a => a.severity === "info"     && !a.acknowledged).length

  const pendingApprovals = Object.values(changeStatuses).filter(s => s === "draft").length
  const scheduledChanges = Object.values(changeStatuses).filter(s => s === "scheduled").length
  const totalCostImpact  = changeRequests.reduce((sum, cr) => {
    const status = changeStatuses[cr.id]
    return status !== "completed" ? sum + cr.costImpact : sum
  }, 0)

  function handleApprove(id: string) {
    setChangeStatuses(prev => ({ ...prev, [id]: "approved" }))
  }

  function handleReject(id: string) {
    setChangeStatuses(prev => ({ ...prev, [id]: "draft" }))
  }

  function toggleService(id: string) {
    setExpandedService(prev => (prev === id ? null : id))
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Capacity Forecast Dashboard</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">
            Resource planning, utilization monitoring, and 90-day forecasting
          </p>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 bg-[var(--color-surface-1)] rounded-lg p-1 w-fit border border-[var(--color-border)]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-indigo-500 text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1 — CURRENT
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "current" && (
          <div>
            {/* Resource Overview Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
              {resourceCards.map(card => (
                <div key={card.type} className="bg-[var(--color-surface-1)] rounded-lg p-4 border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[var(--color-text-secondary)] text-sm font-medium">{card.type}</span>
                    <span className={cn("text-xl font-bold", utilizationTextColor(card.currentPct))}>
                      {card.currentPct}%
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--color-surface-2)] rounded-full mb-3 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", utilizationBarColor(card.currentPct))}
                      style={{ width: `${card.currentPct}%` }}
                    />
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    <span className="text-[var(--color-text-primary)] font-medium">{card.used}</span>
                    <span className="mx-1">/</span>
                    {card.capacity}
                  </div>
                </div>
              ))}
            </div>

            {/* Service Utilization Table */}
            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Service Utilization</h2>
                <span className="text-xs text-[var(--color-text-muted)]">Click a row to expand hourly history</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40">
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Service</th>
                      <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">CPU %</th>
                      <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">Memory %</th>
                      <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">Instances</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium">Auto-Scale</th>
                      <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map(svc => (
                      <React.Fragment key={svc.id}>
                        <tr
                          onClick={() => toggleService(svc.id)}
                          className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-[var(--color-text-primary)]">
                            <span className="mr-2 text-[var(--color-text-muted)] text-xs select-none">
                              {expandedService === svc.id ? "▼" : "▶"}
                            </span>
                            {svc.name}
                          </td>
                          <td className={cn("px-4 py-3 text-right font-semibold", utilizationTextColor(svc.cpu))}>
                            {svc.cpu}%
                          </td>
                          <td className={cn("px-4 py-3 text-right font-semibold", utilizationTextColor(svc.memory))}>
                            {svc.memory}%
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--color-text-primary)]">{svc.instances}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-xs font-semibold",
                              svc.autoScale
                                ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                                : "bg-[var(--color-surface-3)]/50 text-[var(--color-text-muted)] border border-[var(--color-surface-3)]"
                            )}>
                              {svc.autoScale ? "ON" : "OFF"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{svc.threshold}%</td>
                        </tr>

                        {/* Expanded: 12h hourly bars */}
                        {expandedService === svc.id && (
                          <tr className="border-b border-[var(--color-border)]/50">
                            <td colSpan={6} className="px-4 py-4 bg-[var(--color-surface-2)]/20">
                              <div className="text-xs text-[var(--color-text-secondary)] mb-3 font-medium">
                                Hourly CPU Utilization — Last 12 hours
                              </div>
                              <div className="flex items-end gap-1.5" style={{ height: "72px" }}>
                                {svc.history.map((val, idx) => (
                                  <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                                    <span className="text-[var(--color-text-muted)]" style={{ fontSize: "9px" }}>
                                      {val}%
                                    </span>
                                    <div
                                      className={cn("w-full rounded-sm transition-all", utilizationBarColor(val))}
                                      style={{ height: `${Math.round((val / 100) * 44)}px` }}
                                    />
                                    <span className="text-[var(--color-text-muted)]" style={{ fontSize: "9px" }}>
                                      {idx === 11 ? "now" : `${11 - idx}h`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2 — FORECAST
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "forecast" && (
          <div>
            {/* Resource Selector */}
            <div className="flex gap-2 mb-6">
              {(["CPU", "Memory", "Storage"] as ForecastResource[]).map(res => (
                <button
                  key={res}
                  onClick={() => setForecastResource(res)}
                  className={cn(
                    "px-5 py-2 rounded-md text-sm font-medium transition-colors border",
                    forecastResource === res
                      ? "bg-indigo-500 border-indigo-500 text-[var(--color-text-primary)]"
                      : "bg-[var(--color-surface-1)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-surface-3)]"
                  )}
                >
                  {res}
                </button>
              ))}
            </div>

            {/* Grouped Bar Chart */}
            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-6 mb-6">
              <div className="mb-5">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  90-Day Capacity Forecast — {forecastResource}
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Current baseline vs projected demand vs available headroom
                </p>
              </div>

              <div className="space-y-7">
                {activeForecast.months.map(month => (
                  <div key={month.month}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{month.month}</span>
                      <span className={cn("text-xs font-semibold", utilizationTextColor(month.projected))}>
                        Projected: {month.projected}%
                      </span>
                    </div>

                    {/* Current bar */}
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-xs text-[var(--color-text-muted)] w-16 text-right shrink-0">Current</span>
                      <div className="flex-1 h-5 bg-[var(--color-surface-2)] rounded overflow-hidden">
                        <div
                          className="h-full bg-indigo-500/60 rounded flex items-center px-2"
                          style={{ width: `${month.current}%` }}
                        >
                          <span className="text-xs text-[var(--color-text-primary)]/90 whitespace-nowrap">{month.current}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Projected bar */}
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-xs text-[var(--color-text-muted)] w-16 text-right shrink-0">Projected</span>
                      <div className="flex-1 h-5 bg-[var(--color-surface-2)] rounded overflow-hidden">
                        <div
                          className={cn("h-full rounded flex items-center px-2 opacity-80", utilizationBarColor(month.projected))}
                          style={{ width: `${month.projected}%` }}
                        >
                          <span className="text-xs text-[var(--color-text-primary)]/90 whitespace-nowrap">{month.projected}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Headroom bar */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-text-muted)] w-16 text-right shrink-0">Headroom</span>
                      <div className="flex-1 h-5 bg-[var(--color-surface-2)] rounded overflow-hidden">
                        <div
                          className="h-full bg-emerald-400/25 border border-emerald-400/20 rounded flex items-center px-2"
                          style={{ width: `${month.headroom}%` }}
                        >
                          <span className="text-xs text-emerald-400/90 whitespace-nowrap">{month.headroom}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex gap-5 mt-6 pt-5 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-indigo-500/60" />
                  <span className="text-xs text-[var(--color-text-secondary)]">Current baseline</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-amber-400 opacity-80" />
                  <span className="text-xs text-[var(--color-text-secondary)]">Projected demand</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-emerald-400/25 border border-emerald-400/20" />
                  <span className="text-xs text-[var(--color-text-secondary)]">Available headroom</span>
                </div>
              </div>
            </div>

            {/* Forecast Assumptions Table */}
            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border)]">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Forecast Assumptions</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40">
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Resource</th>
                    <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">Growth Rate</th>
                    <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">Confidence</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Model</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.map(fd => (
                    <tr key={fd.resource} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/30">
                      <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{fd.resource}</td>
                      <td className="px-4 py-3 text-right text-amber-400 font-medium">{fd.growthRate}% / mo</td>
                      <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{fd.confidenceInterval}</td>
                      <td className="px-4 py-3 text-[var(--color-text-primary)]">{fd.model}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">{fd.lastUpdated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3 — PLANNING
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "planning" && (
          <div>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[var(--color-surface-1)] rounded-lg p-4 border border-amber-400/20">
                <div className="text-[var(--color-text-secondary)] text-xs mb-1">⏳ Pending Approvals</div>
                <div className="text-3xl font-bold text-amber-400">{pendingApprovals}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">awaiting review</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded-lg p-4 border border-indigo-500/20">
                <div className="text-[var(--color-text-secondary)] text-xs mb-1">📅 Scheduled Changes</div>
                <div className="text-3xl font-bold text-indigo-400">{scheduledChanges}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">in queue</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="text-[var(--color-text-secondary)] text-xs mb-1">💰 Est. Monthly Cost Delta</div>
                <div className={cn("text-3xl font-bold", totalCostImpact >= 0 ? "text-rose-400" : "text-emerald-400")}>
                  {totalCostImpact >= 0 ? "+" : ""}${totalCostImpact.toLocaleString()}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">pending + scheduled</div>
              </div>
            </div>

            {/* Change Requests Table */}
            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border)]">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Capacity Change Requests</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40">
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Resource</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Action</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Quantity</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Requester</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Target Date</th>
                      <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">Cost / mo</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium">Status</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changeRequests.map(cr => {
                      const status = changeStatuses[cr.id]
                      return (
                        <tr key={cr.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{cr.resourceType}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{actionLabel(cr.action)}</td>
                          <td className="px-4 py-3 font-mono text-[var(--color-text-primary)]">{cr.quantity}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{cr.requester}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">{cr.targetDate}</td>
                          <td className={cn(
                            "px-4 py-3 text-right font-mono font-semibold",
                            cr.costImpact >= 0 ? "text-rose-400" : "text-emerald-400"
                          )}>
                            {cr.costImpact >= 0 ? "+" : ""}${cr.costImpact.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn("px-2 py-0.5 rounded text-xs font-medium", statusBadgeClass(status))}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              {status === "draft" ? (
                                <>
                                  <button
                                    onClick={() => handleApprove(cr.id)}
                                    className="px-2 py-1 rounded-md text-xs bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/20 transition-colors"
                                  >
                                    ✓ Approve
                                  </button>
                                  <button
                                    onClick={() => handleReject(cr.id)}
                                    className="px-2 py-1 rounded-md text-xs bg-rose-400/10 text-rose-400 border border-rose-400/20 hover:bg-rose-400/20 transition-colors"
                                  >
                                    ✕ Reject
                                  </button>
                                </>
                              ) : (
                                <span className="text-[var(--color-text-muted)] text-xs">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 4 — ALERTS
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "alerts" && (
          <div>
            {/* Severity Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[var(--color-surface-1)] rounded-lg p-4 border border-rose-400/25">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">🔴</span>
                  <span className="text-[var(--color-text-secondary)] text-xs font-medium">Critical</span>
                </div>
                <div className="text-3xl font-bold text-rose-400">{criticalCount}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">unacknowledged</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded-lg p-4 border border-amber-400/25">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">🟡</span>
                  <span className="text-[var(--color-text-secondary)] text-xs font-medium">Warning</span>
                </div>
                <div className="text-3xl font-bold text-amber-400">{warningCount}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">unacknowledged</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded-lg p-4 border border-indigo-500/25">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">🔵</span>
                  <span className="text-[var(--color-text-secondary)] text-xs font-medium">Info</span>
                </div>
                <div className="text-3xl font-bold text-indigo-400">{infoCount}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">unacknowledged</div>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Threshold Alerts
                <span className="ml-2 text-[var(--color-text-muted)] font-normal text-xs">
                  ({filteredAlerts.length} shown)
                </span>
              </h2>
              <button
                onClick={() => setShowAcknowledged(prev => !prev)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  showAcknowledged
                    ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400"
                    : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {showAcknowledged ? "✓ " : ""}Show Acknowledged
              </button>
            </div>

            {/* Alerts Table */}
            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40">
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Resource</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Service</th>
                      <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">Current</th>
                      <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">Threshold</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium">Severity</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Triggered At</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium">Ack&apos;d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map(alert => (
                      <tr
                        key={alert.id}
                        className={cn(
                          "border-b border-[var(--color-border)]/50 transition-colors",
                          alert.acknowledged
                            ? "opacity-50 hover:opacity-70"
                            : "hover:bg-[var(--color-surface-2)]/30"
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{alert.resource}</td>
                        <td className="px-4 py-3 font-mono text-[var(--color-text-secondary)]">{alert.service}</td>
                        <td className={cn("px-4 py-3 text-right font-semibold", severityTextColor(alert.severity))}>
                          {alert.currentValue}%
                        </td>
                        <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{alert.threshold}%</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("px-2 py-0.5 rounded text-xs font-medium", severityBadgeClass(alert.severity))}>
                            {alert.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">{alert.triggeredAt}</td>
                        <td className="px-4 py-3 text-center">
                          {alert.acknowledged ? (
                            <span className="text-emerald-400 text-xs font-medium">✓ Yes</span>
                          ) : (
                            <span className="text-[var(--color-text-muted)] text-xs">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredAlerts.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-[var(--color-text-muted)] text-sm">
                          ✓ No alerts to display
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
