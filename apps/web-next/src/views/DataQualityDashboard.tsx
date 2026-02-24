import React, { useState } from "react"
import { cn } from "../lib/utils"

type Severity = "critical" | "warning" | "info"
type FilterTab = "all" | "critical" | "warning" | "info"
type StatusKind = "healthy" | "degraded" | "failing"

interface TrendPoint {
  week: string
  score: number
}

interface QualityDimension {
  name: string
  score: number
  trend: TrendPoint[]
}

interface FailedCheck {
  id: string
  check: string
  description: string
  severity: Severity
  source: string
  recommendedFix: string
  timestamp: string
}

interface DataSource {
  id: string
  name: string
  recordCount: number
  qualityScore: number
  lastChecked: string
  status: StatusKind
  failedChecks: FailedCheck[]
}

const OVERALL_SCORE = 82

const DIMENSIONS: QualityDimension[] = [
  {
    name: "Completeness",
    score: 91,
    trend: [
      { week: "W1", score: 84 }, { week: "W2", score: 86 }, { week: "W3", score: 85 },
      { week: "W4", score: 88 }, { week: "W5", score: 87 }, { week: "W6", score: 90 },
      { week: "W7", score: 89 }, { week: "W8", score: 91 },
    ],
  },
  {
    name: "Accuracy",
    score: 87,
    trend: [
      { week: "W1", score: 80 }, { week: "W2", score: 82 }, { week: "W3", score: 81 },
      { week: "W4", score: 84 }, { week: "W5", score: 85 }, { week: "W6", score: 86 },
      { week: "W7", score: 85 }, { week: "W8", score: 87 },
    ],
  },
  {
    name: "Consistency",
    score: 76,
    trend: [
      { week: "W1", score: 70 }, { week: "W2", score: 72 }, { week: "W3", score: 71 },
      { week: "W4", score: 73 }, { week: "W5", score: 74 }, { week: "W6", score: 75 },
      { week: "W7", score: 74 }, { week: "W8", score: 76 },
    ],
  },
  {
    name: "Timeliness",
    score: 83,
    trend: [
      { week: "W1", score: 78 }, { week: "W2", score: 80 }, { week: "W3", score: 79 },
      { week: "W4", score: 81 }, { week: "W5", score: 82 }, { week: "W6", score: 80 },
      { week: "W7", score: 82 }, { week: "W8", score: 83 },
    ],
  },
  {
    name: "Validity",
    score: 72,
    trend: [
      { week: "W1", score: 65 }, { week: "W2", score: 67 }, { week: "W3", score: 68 },
      { week: "W4", score: 70 }, { week: "W5", score: 69 }, { week: "W6", score: 71 },
      { week: "W7", score: 70 }, { week: "W8", score: 72 },
    ],
  },
]

const FAILED_CHECKS: FailedCheck[] = [
  { id: "fc1", check: "null_field_ratio", description: "Null ratio in 'outcome' field exceeds 15% threshold", severity: "critical", source: "agent-logs", recommendedFix: "Add required field validation in agent output schema", timestamp: "2 min ago" },
  { id: "fc2", check: "schema_drift", description: "Schema version mismatch detected in recent writes", severity: "critical", source: "vector-store", recommendedFix: "Run migration script to align vector schema to v3.2", timestamp: "8 min ago" },
  { id: "fc3", check: "stale_records", description: "12% of records older than SLA window (48h)", severity: "warning", source: "session-records", recommendedFix: "Increase session ingestion pipeline throughput", timestamp: "14 min ago" },
  { id: "fc4", check: "duplicate_entries", description: "Duplicate billing entries found for 3 accounts", severity: "critical", source: "billing-data", recommendedFix: "Enable deduplication guard on billing write path", timestamp: "22 min ago" },
  { id: "fc5", check: "format_violation", description: "Timestamp format inconsistency across 5% of records", severity: "warning", source: "telemetry", recommendedFix: "Enforce ISO-8601 format at ingestion boundary", timestamp: "31 min ago" },
  { id: "fc6", check: "missing_index", description: "Config entries missing required 'version' index", severity: "warning", source: "config-store", recommendedFix: "Backfill version index for existing config entries", timestamp: "45 min ago" },
  { id: "fc7", check: "range_outlier", description: "Latency values outside expected range in 2% of spans", severity: "info", source: "telemetry", recommendedFix: "Review outlier spans — may indicate instrumentation bug", timestamp: "1h ago" },
  { id: "fc8", check: "audit_gap", description: "Minor gap in sequential audit IDs (3 missing)", severity: "info", source: "audit-trail", recommendedFix: "Check event bus delivery guarantees for audit topic", timestamp: "1h ago" },
  { id: "fc9", check: "encoding_mismatch", description: "UTF-8 encoding issues in 0.3% of model output records", severity: "info", source: "model-outputs", recommendedFix: "Add encoding normalization layer before storage", timestamp: "2h ago" },
]

const DATA_SOURCES: DataSource[] = [
  { id: "ds1", name: "agent-logs", recordCount: 2_847_312, qualityScore: 74, lastChecked: "2 min ago", status: "degraded", failedChecks: FAILED_CHECKS.filter((c) => c.source === "agent-logs") },
  { id: "ds2", name: "session-records", recordCount: 1_203_884, qualityScore: 81, lastChecked: "5 min ago", status: "healthy", failedChecks: FAILED_CHECKS.filter((c) => c.source === "session-records") },
  { id: "ds3", name: "vector-store", recordCount: 948_221, qualityScore: 68, lastChecked: "3 min ago", status: "failing", failedChecks: FAILED_CHECKS.filter((c) => c.source === "vector-store") },
  { id: "ds4", name: "model-outputs", recordCount: 4_112_093, qualityScore: 89, lastChecked: "1 min ago", status: "healthy", failedChecks: FAILED_CHECKS.filter((c) => c.source === "model-outputs") },
  { id: "ds5", name: "billing-data", recordCount: 312_441, qualityScore: 71, lastChecked: "8 min ago", status: "failing", failedChecks: FAILED_CHECKS.filter((c) => c.source === "billing-data") },
  { id: "ds6", name: "audit-trail", recordCount: 5_887_102, qualityScore: 93, lastChecked: "1 min ago", status: "healthy", failedChecks: FAILED_CHECKS.filter((c) => c.source === "audit-trail") },
  { id: "ds7", name: "config-store", recordCount: 14_832, qualityScore: 78, lastChecked: "12 min ago", status: "degraded", failedChecks: FAILED_CHECKS.filter((c) => c.source === "config-store") },
  { id: "ds8", name: "telemetry", recordCount: 11_439_017, qualityScore: 84, lastChecked: "30s ago", status: "healthy", failedChecks: FAILED_CHECKS.filter((c) => c.source === "telemetry") },
]

function scoreColor(score: number): string {
  if (score >= 90) {return "bg-emerald-500"}
  if (score >= 75) {return "bg-indigo-500"}
  if (score >= 60) {return "bg-amber-500"}
  return "bg-red-500"
}

function scoreTextColor(score: number): string {
  if (score >= 90) {return "text-emerald-400"}
  if (score >= 75) {return "text-indigo-400"}
  if (score >= 60) {return "text-amber-400"}
  return "text-red-400"
}

function statusBadge(status: StatusKind): { label: string; classes: string } {
  switch (status) {
    case "healthy":
      return { label: "Healthy", classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
    case "degraded":
      return { label: "Degraded", classes: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
    case "failing":
      return { label: "Failing", classes: "bg-red-500/15 text-red-400 border-red-500/30" }
  }
}

function severityBadge(severity: Severity): { label: string; dot: string; classes: string } {
  switch (severity) {
    case "critical":
      return { label: "Critical", dot: "bg-red-400", classes: "text-red-400" }
    case "warning":
      return { label: "Warning", dot: "bg-amber-400", classes: "text-amber-400" }
    case "info":
      return { label: "Info", dot: "bg-sky-400", classes: "text-sky-400" }
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}K`}
  return String(n)
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warnings" },
  { key: "info", label: "Info" },
]

function Sparkline({ trend }: { trend: TrendPoint[] }) {
  const max = Math.max(...trend.map((t) => t.score))
  const min = Math.min(...trend.map((t) => t.score))
  const range = max - min || 1
  const barMaxH = 28

  return (
    <div className="flex items-end gap-px h-7">
      {trend.map((point, i) => {
        const h = Math.max(4, ((point.score - min) / range) * barMaxH)
        const isLast = i === trend.length - 1
        return (
          <div
            key={point.week}
            className={cn("w-1.5 rounded-sm transition-all", isLast ? "bg-indigo-400" : "bg-[var(--color-surface-3)]")}
            style={{ height: `${h}px` }}
            title={`${point.week}: ${point.score}`}
          />
        )
      })}
    </div>
  )
}

function GaugeDisplay({ score }: { score: number }) {
  const circumference = 100
  const filled = (score / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-[var(--color-border)]" />
        <div
          className={cn("absolute inset-0 rounded-full border-4 transition-all duration-700", score >= 90 ? "border-emerald-500" : score >= 75 ? "border-indigo-500" : score >= 60 ? "border-amber-500" : "border-red-500")}
          style={{
            clipPath: `polygon(50% 50%, 50% 0%, ${score >= 25 ? "100% 0%" : `${50 + (score / 25) * 50}% 0%`}${score >= 25 ? `, 100% ${score >= 50 ? "100%" : `${((score - 25) / 25) * 100}%`}` : ""}${score >= 50 ? `, ${score >= 75 ? "0%" : `${100 - ((score - 50) / 25) * 100}%`} 100%` : ""}${score >= 75 ? `, 0% ${100 - ((score - 75) / 25) * 100}%` : ""})`,
          }}
        />
        <div className="absolute inset-2 rounded-full bg-[var(--color-surface-0)] flex items-center justify-center">
          <span className={cn("text-3xl font-bold tabular-nums", scoreTextColor(score))}>{score}</span>
        </div>
      </div>
      <div className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">Overall Quality</div>
      <div className="w-full max-w-[10rem] h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", scoreColor(score))}
          style={{ width: `${filled}%` }}
        />
      </div>
    </div>
  )
}

export default function DataQualityDashboard() {
  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all")

  const filteredChecks = FAILED_CHECKS.filter((check) => {
    if (activeFilter === "all") {return true}
    return check.severity === activeFilter
  })

  const criticalCount = FAILED_CHECKS.filter((c) => c.severity === "critical").length
  const warningCount = FAILED_CHECKS.filter((c) => c.severity === "warning").length
  const infoCount = FAILED_CHECKS.filter((c) => c.severity === "info").length

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Quality Dashboard</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">Monitor quality across agent outputs, pipelines, and stored records</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live monitoring
            </div>
            <span className="text-[var(--color-text-muted)]">|</span>
            <span>Last refresh: 30s ago</span>
          </div>
        </div>

        {/* Top row: Gauge + Dimensions */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6 flex items-center justify-center">
            <GaugeDisplay score={OVERALL_SCORE} />
          </div>
          <div className="col-span-9 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Quality Dimensions</h2>
            <div className="space-y-3">
              {DIMENSIONS.map((dim) => (
                <div key={dim.name} className="flex items-center gap-4">
                  <span className="text-sm text-[var(--color-text-primary)] w-28 shrink-0">{dim.name}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", scoreColor(dim.score))}
                      style={{ width: `${dim.score}%` }}
                    />
                  </div>
                  <span className={cn("text-sm font-semibold tabular-nums w-10 text-right", scoreTextColor(dim.score))}>
                    {dim.score}
                  </span>
                  <div className="w-20 shrink-0">
                    <Sparkline trend={dim.trend} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary badges */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Sources", value: String(DATA_SOURCES.length), accent: "text-[var(--color-text-primary)]" },
            { label: "Critical Issues", value: String(criticalCount), accent: "text-red-400" },
            { label: "Warnings", value: String(warningCount), accent: "text-amber-400" },
            { label: "Info Notices", value: String(infoCount), accent: "text-sky-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">{stat.label}</span>
              <span className={cn("text-xl font-bold tabular-nums", stat.accent)}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Main content: Sources table + Failed checks panel */}
        <div className="grid grid-cols-12 gap-4">
          {/* Sources table */}
          <div className="col-span-7 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Data Sources</h2>
            </div>
            <div className="divide-y divide-[var(--color-border)]/60">
              {DATA_SOURCES.map((source) => {
                const badge = statusBadge(source.status)
                const isExpanded = expandedSource === source.id
                return (
                  <div key={source.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-[var(--color-surface-2)]/40 transition-colors cursor-pointer",
                        isExpanded && "bg-[var(--color-surface-2)]/30"
                      )}
                      onClick={() => setExpandedSource(isExpanded ? null : source.id)}
                    >
                      <span className={cn("text-[10px] transition-transform duration-200 text-[var(--color-text-muted)]", isExpanded && "rotate-90")}>
                        ▶
                      </span>
                      <span className="text-sm text-[var(--color-text-primary)] font-mono w-36 shrink-0">{source.name}</span>
                      <span className="text-xs text-[var(--color-text-muted)] tabular-nums w-16 shrink-0 text-right">
                        {formatCount(source.recordCount)}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", scoreColor(source.qualityScore))}
                          style={{ width: `${source.qualityScore}%` }}
                        />
                      </div>
                      <span className={cn("text-xs font-semibold tabular-nums w-8 text-right", scoreTextColor(source.qualityScore))}>
                        {source.qualityScore}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)] w-20 shrink-0 text-right">{source.lastChecked}</span>
                      <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium shrink-0", badge.classes)}>
                        {badge.label}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-1 pl-12 space-y-2 bg-[var(--color-surface-2)]/15">
                        {source.failedChecks.length === 0 ? (
                          <p className="text-xs text-[var(--color-text-muted)] italic">No failed checks — all quality gates passing.</p>
                        ) : (
                          source.failedChecks.map((fc) => {
                            const sev = severityBadge(fc.severity)
                            return (
                              <div key={fc.id} className="flex items-start gap-3 text-xs">
                                <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", sev.dot)} />
                                <div className="space-y-0.5">
                                  <div className="text-[var(--color-text-primary)] font-medium font-mono">{fc.check}</div>
                                  <div className="text-[var(--color-text-secondary)]">{fc.description}</div>
                                  <div className="text-[var(--color-text-muted)]">
                                    Fix: <span className="text-[var(--color-text-secondary)]">{fc.recommendedFix}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Failed checks panel */}
          <div className="col-span-5 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Failed Checks</h2>
              <span className="text-xs text-[var(--color-text-muted)] tabular-nums">{filteredChecks.length} issues</span>
            </div>
            {/* Filter tabs */}
            <div className="flex gap-1 px-4 pt-3 pb-2">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                    activeFilter === tab.key
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] border border-transparent"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Check list */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]/50">
              {filteredChecks.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--color-text-muted)] italic">No issues match this filter.</div>
              ) : (
                filteredChecks.map((check) => {
                  const sev = severityBadge(check.severity)
                  return (
                    <div key={check.id} className="px-5 py-3 space-y-1.5 hover:bg-[var(--color-surface-2)]/20 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", sev.dot)} />
                          <span className={cn("text-[11px] font-semibold uppercase tracking-wide", sev.classes)}>
                            {sev.label}
                          </span>
                          <span className="text-[11px] text-[var(--color-text-muted)]">·</span>
                          <span className="text-[11px] text-[var(--color-text-muted)] font-mono">{check.source}</span>
                        </div>
                        <span className="text-[10px] text-[var(--color-text-muted)]">{check.timestamp}</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-primary)] leading-relaxed">{check.description}</p>
                      <div className="flex items-start gap-1.5">
                        <span className="text-[11px] text-indigo-400 font-medium shrink-0">Fix →</span>
                        <span className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">{check.recommendedFix}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
