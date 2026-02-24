import React, { useState } from "react";
import { Server } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';

// --- Types ---

type Trend = "growing" | "stable" | "declining";
type Status = "Healthy" | "Warning" | "Critical" | "At Risk";
type Priority = "P0" | "P1" | "P2";
type PlanningPeriod = "3M" | "6M" | "12M" | "24M";

interface Resource {
  id: string;
  name: string;
  current: number;
  capacity: number;
  unit: string;
  trend: Trend;
  growthRatePercent: number;
  daysUntilCap: number | null;
  forecastData: number[];
}

interface Recommendation {
  id: string;
  resourceId: string;
  priority: Priority;
  title: string;
  impact: string;
  effort: string;
}

// --- Seed Data ---

const RESOURCES: Resource[] = [
  {
    id: "api-rate",
    name: "API Rate Limits",
    current: 8500,
    capacity: 10000,
    unit: "req/min",
    trend: "growing",
    growthRatePercent: 12,
    daysUntilCap: 45,
    forecastData: [8500, 8900, 9320, 9760, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000],
  },
  {
    id: "sessions",
    name: "Concurrent Sessions",
    current: 142,
    capacity: 250,
    unit: "sessions",
    trend: "growing",
    growthRatePercent: 8,
    daysUntilCap: 120,
    forecastData: [142, 153, 165, 178, 192, 208, 224, 242, 250, 250, 250, 250],
  },
  {
    id: "token-budget",
    name: "Token Budget (Monthly)",
    current: 18200000,
    capacity: 20000000,
    unit: "tokens",
    trend: "growing",
    growthRatePercent: 15,
    daysUntilCap: 22,
    forecastData: [18200000, 19000000, 20000000, 20000000, 20000000, 20000000, 20000000, 20000000, 20000000, 20000000, 20000000, 20000000],
  },
  {
    id: "tool-calls",
    name: "Tool Call Rate",
    current: 320,
    capacity: 500,
    unit: "calls/min",
    trend: "stable",
    growthRatePercent: 2,
    daysUntilCap: null,
    forecastData: [320, 326, 333, 339, 346, 353, 360, 367, 374, 382, 389, 397],
  },
  {
    id: "memory",
    name: "Memory / Storage",
    current: 74,
    capacity: 100,
    unit: "GB",
    trend: "growing",
    growthRatePercent: 6,
    daysUntilCap: 90,
    forecastData: [74, 78, 83, 88, 93, 98, 100, 100, 100, 100, 100, 100],
  },
  {
    id: "bandwidth",
    name: "Network Bandwidth",
    current: 450,
    capacity: 1000,
    unit: "Mbps",
    trend: "declining",
    growthRatePercent: -3,
    daysUntilCap: null,
    forecastData: [450, 437, 423, 410, 398, 386, 374, 363, 352, 341, 331, 321],
  },
];

const RECOMMENDATIONS: Recommendation[] = [
  { id: "r1", resourceId: "token-budget", priority: "P0", title: "Upgrade token tier to 50M/mo", impact: "Eliminates token cap risk for 6+ months", effort: "Low — billing change" },
  { id: "r2", resourceId: "api-rate", priority: "P0", title: "Enable rate limit auto-scaling", impact: "Prevents API throttling under load spikes", effort: "Medium — config + testing" },
  { id: "r3", resourceId: "memory", priority: "P1", title: "Archive stale agent memory snapshots", impact: "Frees ~18 GB, extends headroom to 6 months", effort: "Medium — migration script" },
  { id: "r4", resourceId: "sessions", priority: "P1", title: "Implement session pooling", impact: "Reduces peak concurrent sessions by ~30%", effort: "High — architecture change" },
  { id: "r5", resourceId: "api-rate", priority: "P1", title: "Add request deduplication layer", impact: "Reduces redundant API calls by ~20%", effort: "Medium — middleware" },
  { id: "r6", resourceId: "tool-calls", priority: "P2", title: "Batch tool calls where possible", impact: "Reduces call rate by ~15%", effort: "Low — agent prompt tuning" },
  { id: "r7", resourceId: "bandwidth", priority: "P2", title: "Enable response compression", impact: "Reduces bandwidth usage by ~40%", effort: "Low — gateway config" },
];

// --- Helpers ---

function formatNumber(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}K`;}
  return n.toString();
}

function getUsagePercent(current: number, capacity: number): number {
  return Math.round((current / capacity) * 100);
}

function getHeadroom(current: number, capacity: number): number {
  return Math.round(((capacity - current) / capacity) * 100);
}

function getStatus(current: number, capacity: number, trend: Trend): Status {
  const usage = getUsagePercent(current, capacity);
  if (usage >= 90) {return "Critical";}
  if (usage >= 80 && trend === "growing") {return "At Risk";}
  if (usage >= 70) {return "Warning";}
  return "Healthy";
}

function getTrendArrow(growthRate: number): string {
  if (growthRate >= 10) {return "↑";}
  if (growthRate >= 4) {return "↗";}
  if (growthRate > -4) {return "→";}
  if (growthRate > -10) {return "↘";}
  return "↓";
}

function getBarColor(usagePercent: number): string {
  if (usagePercent >= 90) {return "bg-rose-500";}
  if (usagePercent >= 70) {return "bg-amber-500";}
  return "bg-emerald-500";
}

function getStatusColor(status: Status): string {
  switch (status) {
    case "Critical": return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    case "At Risk": return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "Warning": return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "Healthy": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  }
}

function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case "P0": return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    case "P1": return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "P2": return "text-fg-secondary bg-zinc-500/10 border-zinc-500/30";
  }
}

function computeForecastWithRate(resource: Resource, adjustedRate: number): { data: number[]; daysUntilCap: number | null } {
  const data: number[] = [resource.current];
  const monthlyMultiplier = 1 + adjustedRate / 100;
  let daysUntilCap: number | null = null;
  for (let i = 1; i < 12; i++) {
    const projected = Math.min(data[i - 1] * monthlyMultiplier, resource.capacity);
    data.push(Math.round(projected));
    if (daysUntilCap === null && projected >= resource.capacity) {
      daysUntilCap = i * 30;
    }
  }
  return { data, daysUntilCap };
}

// --- Component ---

export default function CapacityPlanner() {
  const [period, setPeriod] = useState<PlanningPeriod>("12M");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [whatIfRate, setWhatIfRate] = useState<number | null>(null);

  const selected = RESOURCES.find((r) => r.id === selectedId) ?? null;
  const effectiveRate = whatIfRate ?? (selected?.growthRatePercent ?? 0);

  const atRiskCount = RESOURCES.filter((r) => getHeadroom(r.current, r.capacity) < 20).length;
  const healthyCount = RESOURCES.filter((r) => getStatus(r.current, r.capacity, r.trend) === "Healthy").length;
  const firstCapDays = RESOURCES.reduce<number | null>((min, r) => {
    if (r.daysUntilCap === null) {return min;}
    return min === null ? r.daysUntilCap : Math.min(min, r.daysUntilCap);
  }, null);
  const actionCount = RECOMMENDATIONS.filter((r) => r.priority === "P0" || r.priority === "P1").length;

  const periodMonths = parseInt(period.replace("M", ""), 10);
  const selectedRecs = selected ? RECOMMENDATIONS.filter((r) => r.resourceId === selected.id) : [];

  const whatIfForecast = selected ? computeForecastWithRate(selected, effectiveRate) : null;
  const forecastData = whatIfRate !== null && whatIfForecast ? whatIfForecast.data : selected?.forecastData ?? [];
  const forecastCap = whatIfRate !== null && whatIfForecast ? whatIfForecast.daysUntilCap : selected?.daysUntilCap ?? null;

  const handleSelectRow = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setWhatIfRate(null);
    } else {
      setSelectedId(id);
      setWhatIfRate(null);
    }
  };

  const visibleMonths = Math.min(periodMonths, 12);

  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Capacity Planner</h1>
        <div className="flex items-center gap-1 bg-surface-1 border border-tok-border rounded p-1">
          {(["3M", "6M", "12M", "24M"] as PlanningPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1 rounded text-sm font-medium transition-colors",
                period === p ? "bg-indigo-600 text-fg-primary" : "text-fg-secondary hover:text-fg-primary"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6">
            {[
              { label: "At Risk", value: atRiskCount.toString(), sub: "< 20% headroom", color: atRiskCount > 0 ? "text-rose-400" : "text-emerald-400" },
              { label: "Healthy", value: healthyCount.toString(), sub: "resources", color: "text-emerald-400" },
              { label: "First Cap Hit", value: firstCapDays !== null ? `${firstCapDays}d` : "—", sub: "days until", color: firstCapDays !== null && firstCapDays < 60 ? "text-amber-400" : "text-fg-secondary" },
              { label: "Actions Needed", value: actionCount.toString(), sub: "P0 + P1", color: actionCount > 0 ? "text-indigo-400" : "text-fg-secondary" },
            ].map((card) => (
              <div key={card.label} className="bg-surface-1 border border-tok-border rounded-lg p-4">
                <div className="text-fg-muted text-xs font-medium uppercase tracking-wider mb-1">{card.label}</div>
                <div className={cn("text-2xl font-bold", card.color)}>{card.value}</div>
                <div className="text-fg-muted text-xs mt-0.5">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Resource table */}
          <div className="bg-surface-1 border border-tok-border rounded-lg overflow-hidden mb-6">
            {RESOURCES.length === 0 ? (
              <div className="p-6">
                <ContextualEmptyState
                  icon={Server}
                  title="No capacity data"
                  description="Capacity metrics will populate once your infrastructure is connected and reporting."
                />
              </div>
            ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tok-border">
                  {["Resource", "Current", "Capacity", "Usage %", "Headroom", "Trend", "Days to Cap", "Status"].map((h) => (
                    <th key={h} className="text-left text-fg-muted text-xs font-medium uppercase tracking-wider px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map((r) => {
                  const usage = getUsagePercent(r.current, r.capacity);
                  const headroom = getHeadroom(r.current, r.capacity);
                  const status = getStatus(r.current, r.capacity, r.trend);
                  const isSelected = selectedId === r.id;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleSelectRow(r.id)}
                      className={cn(
                        "border-b border-tok-border/50 cursor-pointer transition-colors",
                        isSelected ? "bg-indigo-500/10" : "hover:bg-surface-2/50"
                      )}
                    >
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-fg-secondary">{formatNumber(r.current)} <span className="text-fg-muted text-xs">{r.unit}</span></td>
                      <td className="px-4 py-3 text-fg-secondary">{formatNumber(r.capacity)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-surface-2 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", getBarColor(usage))} style={{ width: `${Math.min(usage, 100)}%` }} />
                          </div>
                          <span className="text-fg-secondary text-xs w-8">{usage}%</span>
                        </div>
                      </td>
                      <td className={cn("px-4 py-3 text-xs font-medium", headroom < 20 ? "text-rose-400" : headroom < 30 ? "text-amber-400" : "text-emerald-400")}>
                        {headroom}%
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-sm", r.trend === "growing" ? "text-amber-400" : r.trend === "declining" ? "text-emerald-400" : "text-fg-muted")}>
                          {getTrendArrow(r.growthRatePercent)} <span className="text-xs text-fg-muted">{r.growthRatePercent > 0 ? "+" : ""}{r.growthRatePercent}%</span>
                        </span>
                      </td>
                      <td className={cn("px-4 py-3 text-sm", r.daysUntilCap !== null && r.daysUntilCap < 60 ? "text-rose-400 font-medium" : "text-fg-secondary")}>
                        {r.daysUntilCap !== null ? `${r.daysUntilCap}d` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded border", getStatusColor(status))}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="bg-surface-1 border border-tok-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{selected.name} — Forecast</h2>
                <span className="text-fg-muted text-sm">
                  {visibleMonths}-month projection
                  {forecastCap !== null && (
                    <span className="ml-2 text-amber-400">· cap in {forecastCap}d</span>
                  )}
                </span>
              </div>

              {/* Bar chart */}
              <div className="mb-6">
                <div className="flex items-end gap-1 h-40">
                  {forecastData.slice(0, visibleMonths).map((val, i) => {
                    const maxVal = selected.capacity * 1.05;
                    const heightPct = Math.max((val / maxVal) * 100, 2);
                    const capLinePct = (selected.capacity / maxVal) * 100;
                    const isOverCap = val >= selected.capacity;
                    const isCurrent = i === 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 relative h-full justify-end">
                        <div
                          className={cn(
                            "w-full rounded-t transition-all",
                            isCurrent ? "bg-indigo-500" : isOverCap ? "bg-rose-500/70" : "bg-indigo-500/40"
                          )}
                          style={{ height: `${heightPct}%` }}
                          title={`M${i + 1}: ${formatNumber(val)} ${selected.unit}`}
                        />
                        <span className="text-fg-muted text-[10px]">M{i + 1}</span>
                        {/* Capacity line marker on first bar */}
                        {i === 0 && (
                          <div
                            className="absolute left-0 right-0 border-t border-dashed border-rose-500/50"
                            style={{ bottom: `${capLinePct}%` }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-fg-muted text-[10px]">Current: {formatNumber(selected.current)}</span>
                  <span className="text-fg-muted text-[10px]">Capacity: {formatNumber(selected.capacity)} {selected.unit}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Recommendations for selected resource */}
                <div>
                  <h3 className="text-sm font-medium text-fg-secondary mb-3">Recommended Actions</h3>
                  {selectedRecs.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedRecs.map((rec) => (
                        <li key={rec.id} className="bg-surface-2/50 rounded p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getPriorityColor(rec.priority))}>
                              {rec.priority}
                            </span>
                            <span className="text-sm font-medium">{rec.title}</span>
                          </div>
                          <div className="text-fg-muted text-xs">{rec.impact}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-fg-muted text-sm">No specific actions for this resource.</p>
                  )}
                </div>

                {/* What-if scenario */}
                <div>
                  <h3 className="text-sm font-medium text-fg-secondary mb-3">What-If Scenario</h3>
                  <div className="bg-surface-2/50 rounded p-4">
                    <label className="block text-xs text-fg-muted mb-2">
                      Adjust monthly growth rate: <span className="text-fg-primary font-medium">{effectiveRate > 0 ? "+" : ""}{effectiveRate}%</span>
                    </label>
                    <input
                      type="range"
                      min={-20}
                      max={30}
                      step={1}
                      value={effectiveRate}
                      onChange={(e) => setWhatIfRate(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-500"
                    />
                    <div className="flex justify-between text-[10px] text-fg-muted mt-1">
                      <span>-20%</span>
                      <span>0%</span>
                      <span>+30%</span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-fg-muted">Original growth</span>
                        <span className="text-fg-secondary">{selected.growthRatePercent > 0 ? "+" : ""}{selected.growthRatePercent}%/mo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-fg-muted">Projected cap hit</span>
                        <span className={cn(forecastCap !== null && forecastCap < 90 ? "text-rose-400" : "text-emerald-400")}>
                          {forecastCap !== null ? `${forecastCap} days` : "Not projected"}
                        </span>
                      </div>
                      {whatIfRate !== null && (
                        <div className="flex justify-between">
                          <span className="text-fg-muted">vs. baseline</span>
                          <span className="text-indigo-400">
                            {forecastCap !== null && selected.daysUntilCap !== null
                              ? `${forecastCap - selected.daysUntilCap > 0 ? "+" : ""}${forecastCap - selected.daysUntilCap}d`
                              : forecastCap === null && selected.daysUntilCap !== null
                                ? "Cap eliminated"
                                : "—"}
                          </span>
                        </div>
                      )}
                    </div>
                    {whatIfRate !== null && (
                      <button
                        onClick={() => setWhatIfRate(null)}
                        className="mt-3 text-xs text-fg-muted hover:text-fg-primary underline"
                      >
                        Reset to baseline
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar — Recommendations */}
        <div className="w-full lg:w-60 shrink-0">
          <div className="bg-surface-1 border border-tok-border rounded-lg p-4 sticky top-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted mb-4">All Recommendations</h2>
            <div className="space-y-3">
              {RECOMMENDATIONS.map((rec) => (
                <div
                  key={rec.id}
                  className={cn(
                    "rounded p-3 border transition-colors cursor-pointer",
                    selectedId === rec.resourceId ? "border-indigo-500/40 bg-indigo-500/5" : "border-tok-border bg-surface-2/30 hover:border-tok-border"
                  )}
                  onClick={() => {
                    setSelectedId(rec.resourceId);
                    setWhatIfRate(null);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getPriorityColor(rec.priority))}>
                      {rec.priority}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-fg-primary leading-snug mb-1">{rec.title}</div>
                  <div className="text-[10px] text-fg-muted leading-snug mb-1">{rec.impact}</div>
                  <div className="text-[10px] text-fg-muted">Effort: {rec.effort}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
