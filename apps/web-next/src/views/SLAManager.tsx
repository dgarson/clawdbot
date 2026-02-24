import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "definitions" | "compliance" | "incidents";

type MetricType = "uptime" | "response-time" | "resolution-time";
type MeasurementWindow = "daily" | "weekly" | "monthly";
type Priority = "critical" | "high" | "medium" | "low";
type SLAStatus = "met" | "at-risk" | "breached";
type Trend = "up" | "down" | "stable";
type ResolutionStatus = "resolved" | "investigating" | "unresolved" | "mitigated";

interface SLADefinition {
  id: string;
  name: string;
  service: string;
  metricType: MetricType;
  targetValue: number;
  currentValue: number;
  unit: string;
  measurementWindow: MeasurementWindow;
  priority: Priority;
  status: SLAStatus;
  trend: Trend;
}

interface MonthlyCompliance {
  slaId: string;
  slaName: string;
  service: string;
  months: Record<string, number>;
}

interface BreachIncident {
  id: string;
  slaId: string;
  slaName: string;
  service: string;
  occurredAt: string;
  duration: string;
  impact: string;
  resolutionStatus: ResolutionStatus;
  description: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const SLA_DEFINITIONS: SLADefinition[] = [
  {
    id: "sla-1",
    name: "API Gateway Uptime",
    service: "API",
    metricType: "uptime",
    targetValue: 99.95,
    currentValue: 99.97,
    unit: "%",
    measurementWindow: "monthly",
    priority: "critical",
    status: "met",
    trend: "up",
  },
  {
    id: "sla-2",
    name: "LLM Inference Latency",
    service: "LLM",
    metricType: "response-time",
    targetValue: 500,
    currentValue: 472,
    unit: "ms",
    measurementWindow: "daily",
    priority: "critical",
    status: "met",
    trend: "stable",
  },
  {
    id: "sla-3",
    name: "Webhook Delivery Rate",
    service: "Webhooks",
    metricType: "uptime",
    targetValue: 99.9,
    currentValue: 99.2,
    unit: "%",
    measurementWindow: "weekly",
    priority: "high",
    status: "at-risk",
    trend: "down",
  },
  {
    id: "sla-4",
    name: "Support Ticket Resolution",
    service: "Support",
    metricType: "resolution-time",
    targetValue: 24,
    currentValue: 31,
    unit: "hrs",
    measurementWindow: "monthly",
    priority: "medium",
    status: "breached",
    trend: "down",
  },
  {
    id: "sla-5",
    name: "Database Query P99",
    service: "Database",
    metricType: "response-time",
    targetValue: 200,
    currentValue: 185,
    unit: "ms",
    measurementWindow: "daily",
    priority: "high",
    status: "met",
    trend: "up",
  },
  {
    id: "sla-6",
    name: "LLM Model Availability",
    service: "LLM",
    metricType: "uptime",
    targetValue: 99.5,
    currentValue: 98.8,
    unit: "%",
    measurementWindow: "monthly",
    priority: "high",
    status: "at-risk",
    trend: "down",
  },
  {
    id: "sla-7",
    name: "API Response Time (P95)",
    service: "API",
    metricType: "response-time",
    targetValue: 150,
    currentValue: 132,
    unit: "ms",
    measurementWindow: "daily",
    priority: "critical",
    status: "met",
    trend: "up",
  },
  {
    id: "sla-8",
    name: "Webhook Retry Success",
    service: "Webhooks",
    metricType: "uptime",
    targetValue: 99.0,
    currentValue: 97.5,
    unit: "%",
    measurementWindow: "weekly",
    priority: "medium",
    status: "breached",
    trend: "down",
  },
];

const MONTHLY_COMPLIANCE: MonthlyCompliance[] = [
  { slaId: "sla-1", slaName: "API Gateway Uptime", service: "API", months: { "Jan 2026": 99.96, "Feb 2026": 99.97 } },
  { slaId: "sla-2", slaName: "LLM Inference Latency", service: "LLM", months: { "Jan 2026": 98.1, "Feb 2026": 99.3 } },
  { slaId: "sla-3", slaName: "Webhook Delivery Rate", service: "Webhooks", months: { "Jan 2026": 99.91, "Feb 2026": 99.2 } },
  { slaId: "sla-4", slaName: "Support Ticket Resolution", service: "Support", months: { "Jan 2026": 88.0, "Feb 2026": 77.4 } },
  { slaId: "sla-5", slaName: "Database Query P99", service: "Database", months: { "Jan 2026": 99.7, "Feb 2026": 99.8 } },
  { slaId: "sla-6", slaName: "LLM Model Availability", service: "LLM", months: { "Jan 2026": 99.6, "Feb 2026": 98.8 } },
  { slaId: "sla-7", slaName: "API Response Time (P95)", service: "API", months: { "Jan 2026": 99.4, "Feb 2026": 99.7 } },
  { slaId: "sla-8", slaName: "Webhook Retry Success", service: "Webhooks", months: { "Jan 2026": 98.2, "Feb 2026": 97.5 } },
];

const BREACH_INCIDENTS: BreachIncident[] = [
  {
    id: "inc-1",
    slaId: "sla-4",
    slaName: "Support Ticket Resolution",
    service: "Support",
    occurredAt: "2026-02-18 14:23",
    duration: "7h 12m",
    impact: "42 tickets exceeded 24hr resolution window",
    resolutionStatus: "investigating",
    description: "Spike in support volume from billing migration caused backlog exceeding SLA targets.",
  },
  {
    id: "inc-2",
    slaId: "sla-8",
    slaName: "Webhook Retry Success",
    service: "Webhooks",
    occurredAt: "2026-02-15 09:47",
    duration: "3h 38m",
    impact: "1,247 webhooks failed after 3 retry attempts",
    resolutionStatus: "resolved",
    description: "Downstream partner endpoint returned 503 during maintenance window; retry queue exhausted.",
  },
  {
    id: "inc-3",
    slaId: "sla-3",
    slaName: "Webhook Delivery Rate",
    service: "Webhooks",
    occurredAt: "2026-02-12 22:15",
    duration: "1h 54m",
    impact: "Delivery rate dropped to 97.8% for 2hr window",
    resolutionStatus: "resolved",
    description: "Network partition between webhook workers and message queue caused delivery delays.",
  },
  {
    id: "inc-4",
    slaId: "sla-6",
    slaName: "LLM Model Availability",
    service: "LLM",
    occurredAt: "2026-02-10 03:02",
    duration: "45m",
    impact: "Model serving cluster scaled down too aggressively",
    resolutionStatus: "mitigated",
    description: "Auto-scaler reduced replicas below minimum during low-traffic window; cold start latency spiked.",
  },
  {
    id: "inc-5",
    slaId: "sla-4",
    slaName: "Support Ticket Resolution",
    service: "Support",
    occurredAt: "2026-01-28 10:30",
    duration: "12h 05m",
    impact: "18 P1 tickets unresolved beyond SLA window",
    resolutionStatus: "resolved",
    description: "Holiday staffing shortfall combined with infrastructure incident created resolution bottleneck.",
  },
  {
    id: "inc-6",
    slaId: "sla-8",
    slaName: "Webhook Retry Success",
    service: "Webhooks",
    occurredAt: "2026-01-20 16:12",
    duration: "2h 20m",
    impact: "832 webhooks permanently failed",
    resolutionStatus: "resolved",
    description: "TLS certificate rotation on retry worker caused transient connection failures to endpoints.",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "overview", label: "Overview", emoji: "📊" },
  { key: "definitions", label: "SLA Definitions", emoji: "📋" },
  { key: "compliance", label: "Compliance Report", emoji: "📈" },
  { key: "incidents", label: "Incidents", emoji: "🚨" },
];

function statusBadge(status: SLAStatus): { label: string; emoji: string; className: string } {
  switch (status) {
    case "met":
      return { label: "Met", emoji: "✅", className: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" };
    case "at-risk":
      return { label: "At Risk", emoji: "⚠️", className: "bg-amber-400/15 text-amber-400 border-amber-400/30" };
    case "breached":
      return { label: "Breached", emoji: "❌", className: "bg-rose-400/15 text-rose-400 border-rose-400/30" };
  }
}

function trendArrow(trend: Trend): { arrow: string; className: string } {
  switch (trend) {
    case "up":
      return { arrow: "↑", className: "text-emerald-400" };
    case "down":
      return { arrow: "↓", className: "text-rose-400" };
    case "stable":
      return { arrow: "→", className: "text-zinc-400" };
  }
}

function priorityBadge(priority: Priority): { label: string; className: string } {
  switch (priority) {
    case "critical":
      return { label: "Critical", className: "bg-rose-400/15 text-rose-400 border-rose-400/30" };
    case "high":
      return { label: "High", className: "bg-amber-400/15 text-amber-400 border-amber-400/30" };
    case "medium":
      return { label: "Medium", className: "bg-indigo-500/15 text-indigo-400 border-indigo-400/30" };
    case "low":
      return { label: "Low", className: "bg-zinc-700/40 text-zinc-400 border-zinc-600" };
  }
}

function resolutionBadge(status: ResolutionStatus): { label: string; emoji: string; className: string } {
  switch (status) {
    case "resolved":
      return { label: "Resolved", emoji: "✅", className: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" };
    case "investigating":
      return { label: "Investigating", emoji: "🔍", className: "bg-amber-400/15 text-amber-400 border-amber-400/30" };
    case "unresolved":
      return { label: "Unresolved", emoji: "❌", className: "bg-rose-400/15 text-rose-400 border-rose-400/30" };
    case "mitigated":
      return { label: "Mitigated", emoji: "🛡️", className: "bg-indigo-500/15 text-indigo-400 border-indigo-400/30" };
  }
}

function metricTypeLabel(mt: MetricType): string {
  switch (mt) {
    case "uptime": return "Uptime";
    case "response-time": return "Response Time";
    case "resolution-time": return "Resolution Time";
  }
}

function windowLabel(w: MeasurementWindow): string {
  switch (w) {
    case "daily": return "Daily";
    case "weekly": return "Weekly";
    case "monthly": return "Monthly";
  }
}

function compliancePercent(sla: SLADefinition): number {
  if (sla.metricType === "uptime") {
    return sla.currentValue;
  }
  // For time-based metrics, compliance = target / current when current <= target (good), else target/current
  if (sla.currentValue <= sla.targetValue) {
    return 100;
  }
  return Math.max(0, Math.min(100, (sla.targetValue / sla.currentValue) * 100));
}

function complianceColor(value: number, target: number): string {
  const ratio = value / target;
  if (ratio >= 1) {return "text-emerald-400";}
  if (ratio >= 0.98) {return "text-amber-400";}
  return "text-rose-400";
}

function complianceCellBg(value: number, target: number): string {
  const ratio = value / target;
  if (ratio >= 1) {return "bg-emerald-400/10";}
  if (ratio >= 0.98) {return "bg-amber-400/10";}
  return "bg-rose-400/10";
}

function complianceCellText(value: number, target: number): string {
  const ratio = value / target;
  if (ratio >= 1) {return "text-emerald-400";}
  if (ratio >= 0.98) {return "text-amber-400";}
  return "text-rose-400";
}

// ── Sub-Components ───────────────────────────────────────────────────────────

function OverviewTab({ slas }: { slas: SLADefinition[] }) {
  const metCount = slas.filter((s) => s.status === "met").length;
  const atRiskCount = slas.filter((s) => s.status === "at-risk").length;
  const breachedCount = slas.filter((s) => s.status === "breached").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">✅</span>
            <span className="text-sm text-zinc-400">SLAs Met</span>
          </div>
          <div className="text-3xl font-bold text-emerald-400">{metCount}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚠️</span>
            <span className="text-sm text-zinc-400">At Risk</span>
          </div>
          <div className="text-3xl font-bold text-amber-400">{atRiskCount}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">❌</span>
            <span className="text-sm text-zinc-400">Breached</span>
          </div>
          <div className="text-3xl font-bold text-rose-400">{breachedCount}</div>
        </div>
      </div>

      {/* SLA Scorecards */}
      <div className="space-y-3">
        {slas.map((sla) => {
          const badge = statusBadge(sla.status);
          const trend = trendArrow(sla.trend);
          const pct = compliancePercent(sla);
          const targetPct = sla.metricType === "uptime" ? sla.targetValue : 100;
          const barFillPct = sla.metricType === "uptime"
            ? Math.min(100, (sla.currentValue / 100) * 100)
            : Math.min(100, pct);
          const barTargetPct = sla.metricType === "uptime"
            ? (sla.targetValue / 100) * 100
            : 100;

          const barColor =
            sla.status === "met"
              ? "bg-emerald-400"
              : sla.status === "at-risk"
              ? "bg-amber-400"
              : "bg-rose-400";

          return (
            <div
              key={sla.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-semibold truncate">{sla.name}</h3>
                    <span className={cn("text-sm font-medium", trend.className)}>
                      {trend.arrow}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
                    <span className="bg-zinc-800 px-2 py-0.5 rounded text-xs">{sla.service}</span>
                    <span>{metricTypeLabel(sla.metricType)}</span>
                    <span>·</span>
                    <span>{windowLabel(sla.measurementWindow)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-white font-mono text-lg font-bold">
                      {sla.currentValue}
                      <span className="text-zinc-500 text-sm">{sla.unit}</span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      Target: {sla.targetValue}{sla.unit}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
                      badge.className
                    )}
                  >
                    {badge.emoji} {badge.label}
                  </span>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-full transition-all", barColor)}
                  style={{ width: `${barFillPct}%` }}
                />
                {/* Target marker */}
                <div
                  className="absolute inset-y-0 w-0.5 bg-white/60"
                  style={{ left: `${barTargetPct}%` }}
                  title={`Target: ${sla.targetValue}${sla.unit}`}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-zinc-500">
                <span>0{sla.unit}</span>
                <span>Target {sla.targetValue}{sla.unit}</span>
                <span>{sla.metricType === "uptime" ? "100%" : `${sla.targetValue}${sla.unit}`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DefinitionsTab({
  slas,
  onUpdate,
}: {
  slas: SLADefinition[];
  onUpdate: (id: string, field: keyof SLADefinition, value: string | number) => void;
}) {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(id: string, field: string, currentValue: string | number) {
    setEditingCell({ id, field });
    setEditValue(String(currentValue));
  }

  function commitEdit(id: string, field: keyof SLADefinition) {
    const numFields: Array<keyof SLADefinition> = ["targetValue", "currentValue"];
    const value = numFields.includes(field) ? parseFloat(editValue) || 0 : editValue;
    onUpdate(id, field, value);
    setEditingCell(null);
    setEditValue("");
  }

  function renderEditable(sla: SLADefinition, field: keyof SLADefinition, displayValue: string) {
    const isEditing = editingCell?.id === sla.id && editingCell?.field === field;
    if (isEditing) {
      return (
        <input
          className="bg-zinc-800 border border-indigo-500 rounded px-2 py-1 text-white text-sm w-full outline-none focus:ring-1 focus:ring-indigo-500"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => commitEdit(sla.id, field)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {commitEdit(sla.id, field);}
            if (e.key === "Escape") {setEditingCell(null);}
          }}
          autoFocus
        />
      );
    }
    return (
      <span
        className="cursor-pointer hover:text-indigo-400 transition-colors"
        onClick={() => startEdit(sla.id, field, sla[field])}
        title="Click to edit"
      >
        {displayValue}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">Click any value to edit inline. Press Enter to save, Escape to cancel.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="pb-3 pr-4 text-zinc-400 font-medium">Name</th>
              <th className="pb-3 pr-4 text-zinc-400 font-medium">Service</th>
              <th className="pb-3 pr-4 text-zinc-400 font-medium">Metric</th>
              <th className="pb-3 pr-4 text-zinc-400 font-medium">Target</th>
              <th className="pb-3 pr-4 text-zinc-400 font-medium">Window</th>
              <th className="pb-3 pr-4 text-zinc-400 font-medium">Priority</th>
              <th className="pb-3 text-zinc-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {slas.map((sla) => {
              const badge = statusBadge(sla.status);
              const pBadge = priorityBadge(sla.priority);
              return (
                <tr key={sla.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 pr-4 text-white font-medium">
                    {renderEditable(sla, "name", sla.name)}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs">
                      {renderEditable(sla, "service", sla.service)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-zinc-300">
                    {metricTypeLabel(sla.metricType)}
                  </td>
                  <td className="py-3 pr-4 text-white font-mono">
                    {renderEditable(sla, "targetValue", `${sla.targetValue}${sla.unit}`)}
                  </td>
                  <td className="py-3 pr-4 text-zinc-300">
                    {windowLabel(sla.measurementWindow)}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-xs font-medium border",
                        pBadge.className
                      )}
                    >
                      {pBadge.label}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                        badge.className
                      )}
                    >
                      {badge.emoji} {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComplianceTab({
  data,
  slas,
}: {
  data: MonthlyCompliance[];
  slas: SLADefinition[];
}) {
  const months = ["Jan 2026", "Feb 2026"];

  function getTarget(slaId: string): number {
    const sla = slas.find((s) => s.id === slaId);
    if (!sla) {return 99;}
    if (sla.metricType === "uptime") {return sla.targetValue;}
    return 99;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Monthly compliance percentages — color-coded against SLA targets.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="pb-3 pr-4 text-zinc-400 font-medium">SLA</th>
              <th className="pb-3 pr-4 text-zinc-400 font-medium">Service</th>
              <th className="pb-3 pr-4 text-zinc-400 font-medium text-right">Target</th>
              {months.map((m) => (
                <th key={m} className="pb-3 pr-4 text-zinc-400 font-medium text-center">
                  {m}
                </th>
              ))}
              <th className="pb-3 text-zinc-400 font-medium text-center">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {data.map((row) => {
              const target = getTarget(row.slaId);
              const values = months.map((m) => row.months[m] ?? 0);
              const trendDir: Trend =
                values.length >= 2
                  ? values[1] > values[0]
                    ? "up"
                    : values[1] < values[0]
                    ? "down"
                    : "stable"
                  : "stable";
              const trend = trendArrow(trendDir);

              return (
                <tr key={row.slaId} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 pr-4 text-white font-medium">{row.slaName}</td>
                  <td className="py-3 pr-4">
                    <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs">
                      {row.service}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-zinc-300 font-mono text-right">{target}%</td>
                  {months.map((m) => {
                    const val = row.months[m] ?? 0;
                    return (
                      <td key={m} className="py-3 pr-4 text-center">
                        <span
                          className={cn(
                            "inline-block px-3 py-1 rounded-lg font-mono text-sm font-medium",
                            complianceCellBg(val, target),
                            complianceCellText(val, target)
                          )}
                        >
                          {val.toFixed(1)}%
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-3 text-center">
                    <span className={cn("text-lg font-bold", trend.className)}>
                      {trend.arrow}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-zinc-500 pt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-400/20 border border-emerald-400/40" />
          <span>Meeting target</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-400/20 border border-amber-400/40" />
          <span>Within 2% of target</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-400/20 border border-rose-400/40" />
          <span>Below target</span>
        </div>
      </div>
    </div>
  );
}

function IncidentsTab({ incidents }: { incidents: BreachIncident[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          SLA breach incidents — {incidents.length} total
        </p>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            ✅ Resolved: {incidents.filter((i) => i.resolutionStatus === "resolved").length}
          </span>
          <span className="text-zinc-700">|</span>
          <span className="flex items-center gap-1">
            🔍 Investigating: {incidents.filter((i) => i.resolutionStatus === "investigating").length}
          </span>
          <span className="text-zinc-700">|</span>
          <span className="flex items-center gap-1">
            🛡️ Mitigated: {incidents.filter((i) => i.resolutionStatus === "mitigated").length}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {incidents.map((inc) => {
          const rBadge = resolutionBadge(inc.resolutionStatus);
          const isExpanded = expandedId === inc.id;

          return (
            <div
              key={inc.id}
              className={cn(
                "bg-zinc-900 border rounded-xl transition-colors",
                inc.resolutionStatus === "investigating"
                  ? "border-amber-400/30"
                  : inc.resolutionStatus === "unresolved"
                  ? "border-rose-400/30"
                  : "border-zinc-800"
              )}
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : inc.id)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">{inc.slaName}</span>
                      <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-xs">
                        {inc.service}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>🕐 {inc.occurredAt}</span>
                      <span>⏱️ Duration: {inc.duration}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
                        rBadge.className
                      )}
                    >
                      {rBadge.emoji} {rBadge.label}
                    </span>
                    <span className="text-zinc-500 text-sm">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-zinc-800/60">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Impact</div>
                      <div className="text-sm text-zinc-300">{inc.impact}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Description</div>
                      <div className="text-sm text-zinc-300">{inc.description}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SLAManager() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [slas, setSlas] = useState<SLADefinition[]>(SLA_DEFINITIONS);

  function handleUpdateSLA(id: string, field: keyof SLADefinition, value: string | number) {
    setSlas((prev) =>
      prev.map((sla) => {
        if (sla.id !== id) {return sla;}
        return { ...sla, [field]: value };
      })
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📋</span>
            <h1 className="text-2xl font-bold text-white">SLA Manager</h1>
          </div>
          <p className="text-zinc-400 text-sm">
            Monitor, define, and track service level agreements across all platform services.
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-800 mb-6">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === tab.key
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                )}
              >
                <span>{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "overview" && <OverviewTab slas={slas} />}
          {activeTab === "definitions" && (
            <DefinitionsTab slas={slas} onUpdate={handleUpdateSLA} />
          )}
          {activeTab === "compliance" && (
            <ComplianceTab data={MONTHLY_COMPLIANCE} slas={slas} />
          )}
          {activeTab === "incidents" && <IncidentsTab incidents={BREACH_INCIDENTS} />}
        </div>
      </div>
    </div>
  );
}
