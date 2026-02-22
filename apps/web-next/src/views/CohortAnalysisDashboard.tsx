import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type AcquisitionChannel = "organic" | "paid" | "referral" | "direct";
type PlanType = "starter" | "pro" | "enterprise";

interface ChannelBreakdown {
  organic: number;
  paid: number;
  referral: number;
  direct: number;
}

interface PlanBreakdown {
  starter: number;
  pro: number;
  enterprise: number;
}

interface CohortData {
  label: string;
  month: string;
  size: number;
  retention: number[];
  channels: ChannelBreakdown;
  plans: PlanBreakdown;
  avgApiUsage: number;
}

// ── Static Data ────────────────────────────────────────────────────────────────

const COHORTS: CohortData[] = [
  {
    label: "Aug 2025",
    month: "2025-08",
    size: 1243,
    retention: [100, 68, 54, 45, 38, 31, 26, 22],
    channels: { organic: 42, paid: 31, referral: 18, direct: 9 },
    plans: { starter: 58, pro: 32, enterprise: 10 },
    avgApiUsage: 12400,
  },
  {
    label: "Sep 2025",
    month: "2025-09",
    size: 1387,
    retention: [100, 71, 58, 49, 42, 35, 29, 24],
    channels: { organic: 38, paid: 35, referral: 16, direct: 11 },
    plans: { starter: 54, pro: 34, enterprise: 12 },
    avgApiUsage: 14200,
  },
  {
    label: "Oct 2025",
    month: "2025-10",
    size: 1562,
    retention: [100, 74, 61, 52, 44, 37, 32, 27],
    channels: { organic: 45, paid: 28, referral: 19, direct: 8 },
    plans: { starter: 51, pro: 36, enterprise: 13 },
    avgApiUsage: 15800,
  },
  {
    label: "Nov 2025",
    month: "2025-11",
    size: 1198,
    retention: [100, 65, 51, 42, 35, 28, 23, 19],
    channels: { organic: 36, paid: 38, referral: 14, direct: 12 },
    plans: { starter: 62, pro: 28, enterprise: 10 },
    avgApiUsage: 10900,
  },
  {
    label: "Dec 2025",
    month: "2025-12",
    size: 982,
    retention: [100, 62, 48, 39, 32, 26, 21, 17],
    channels: { organic: 30, paid: 42, referral: 15, direct: 13 },
    plans: { starter: 64, pro: 27, enterprise: 9 },
    avgApiUsage: 9500,
  },
  {
    label: "Jan 2026",
    month: "2026-01",
    size: 1721,
    retention: [100, 76, 64, 55, 47, 40, 34, 29],
    channels: { organic: 48, paid: 26, referral: 17, direct: 9 },
    plans: { starter: 47, pro: 38, enterprise: 15 },
    avgApiUsage: 18300,
  },
  {
    label: "Feb 2026",
    month: "2026-02",
    size: 1654,
    retention: [100, 73, 60, 51, 43, 36, 30, 25],
    channels: { organic: 44, paid: 30, referral: 18, direct: 8 },
    plans: { starter: 49, pro: 37, enterprise: 14 },
    avgApiUsage: 16700,
  },
  {
    label: "Mar 2026",
    month: "2026-03",
    size: 1489,
    retention: [100, 70, 57, 47, 40, 33, 27, 23],
    channels: { organic: 41, paid: 33, referral: 16, direct: 10 },
    plans: { starter: 53, pro: 34, enterprise: 13 },
    avgApiUsage: 14800,
  },
];

const WEEK_LABELS = ["W0", "W1", "W2", "W3", "W4", "W5", "W6", "W7"];
const CHANNEL_OPTIONS: AcquisitionChannel[] = ["organic", "paid", "referral", "direct"];
const PLAN_OPTIONS: PlanType[] = ["starter", "pro", "enterprise"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function retentionColor(value: number): string {
  if (value > 60) return "bg-emerald-500/80 text-emerald-50";
  if (value >= 40) return "bg-indigo-500/80 text-indigo-50";
  if (value >= 20) return "bg-amber-500/80 text-amber-50";
  return "bg-rose-500/80 text-rose-50";
}

function retentionBgClass(value: number): string {
  if (value > 60) return "bg-emerald-500";
  if (value >= 40) return "bg-indigo-500";
  if (value >= 20) return "bg-amber-500";
  return "bg-rose-500";
}

function channelColor(ch: AcquisitionChannel): string {
  const map: Record<AcquisitionChannel, string> = {
    organic: "bg-emerald-500",
    paid: "bg-indigo-500",
    referral: "bg-amber-500",
    direct: "bg-rose-400",
  };
  return map[ch];
}

function planColor(p: PlanType): string {
  const map: Record<PlanType, string> = {
    starter: "bg-zinc-500",
    pro: "bg-indigo-500",
    enterprise: "bg-emerald-500",
  };
  return map[p];
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function filterCohorts(
  cohorts: CohortData[],
  channelFilter: AcquisitionChannel | "all",
  planFilter: PlanType | "all"
): CohortData[] {
  return cohorts.filter((c) => {
    if (channelFilter !== "all" && c.channels[channelFilter] < 15) return false;
    if (planFilter !== "all" && c.plans[planFilter] < 10) return false;
    return true;
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
        {label}
      </span>
      <span className={cn("text-2xl font-bold", accent ?? "text-white")}>
        {value}
      </span>
      {sub && <span className="text-zinc-500 text-xs">{sub}</span>}
    </div>
  );
}

function RetentionMatrix({
  cohorts,
  selectedIndex,
  onSelect,
}: {
  cohorts: CohortData[];
  selectedIndex: number | null;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 overflow-x-auto">
      <h3 className="text-white font-semibold text-sm mb-4">
        📊 Retention Matrix
      </h3>
      <div className="min-w-[640px]">
        {/* Header */}
        <div className="grid grid-cols-[140px_repeat(8,1fr)] gap-1 mb-1">
          <div className="text-zinc-500 text-xs font-medium px-2 py-1">
            Cohort
          </div>
          {WEEK_LABELS.map((w) => (
            <div
              key={w}
              className="text-zinc-500 text-xs font-medium text-center py-1"
            >
              {w}
            </div>
          ))}
        </div>
        {/* Rows */}
        {cohorts.map((cohort, idx) => (
          <div
            key={cohort.month}
            onClick={() => onSelect(idx)}
            className={cn(
              "grid grid-cols-[140px_repeat(8,1fr)] gap-1 mb-1 cursor-pointer rounded-lg transition-all",
              selectedIndex === idx
                ? "ring-1 ring-indigo-500 bg-zinc-800/50"
                : "hover:bg-zinc-800/30"
            )}
          >
            <div className="flex items-center gap-2 px-2 py-1">
              <span className="text-white text-xs font-medium">
                {cohort.label}
              </span>
              <span className="text-zinc-500 text-[10px]">
                ({formatNumber(cohort.size)})
              </span>
            </div>
            {cohort.retention.map((val, wIdx) => (
              <div
                key={wIdx}
                className={cn(
                  "rounded text-center py-1.5 text-xs font-semibold transition-all",
                  retentionColor(val)
                )}
              >
                {val}%
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-800">
        <span className="text-zinc-500 text-[10px] uppercase tracking-wider">
          Legend:
        </span>
        {[
          { label: ">60%", cls: "bg-emerald-500/80" },
          { label: "40-60%", cls: "bg-indigo-500/80" },
          { label: "20-40%", cls: "bg-amber-500/80" },
          { label: "<20%", cls: "bg-rose-500/80" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", item.cls)} />
            <span className="text-zinc-400 text-[10px]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CohortComparisonChart({ cohorts }: { cohorts: CohortData[] }) {
  const weeks = [
    { label: "Week 1", idx: 1 },
    { label: "Week 4", idx: 4 },
    { label: "Week 7", idx: 7 },
  ];

  const maxVal = 100;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm mb-4">
        📈 Cohort Comparison
      </h3>
      <div className="space-y-6">
        {weeks.map((week) => (
          <div key={week.label}>
            <div className="text-zinc-400 text-xs font-medium mb-2">
              {week.label} Retention
            </div>
            <div className="space-y-1.5">
              {cohorts.map((cohort) => {
                const val = cohort.retention[week.idx] ?? 0;
                const widthPct = (val / maxVal) * 100;
                return (
                  <div key={cohort.month} className="flex items-center gap-2">
                    <span className="text-zinc-500 text-[10px] w-16 text-right shrink-0">
                      {cohort.label}
                    </span>
                    <div className="flex-1 h-5 bg-zinc-800 rounded-full overflow-hidden relative">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          retentionBgClass(val)
                        )}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="text-zinc-300 text-[10px] w-8 shrink-0">
                      {val}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CohortDetails({ cohort }: { cohort: CohortData }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm mb-1">
        🔍 {cohort.label} Details
      </h3>
      <p className="text-zinc-500 text-xs mb-4">
        Cohort size: {cohort.size.toLocaleString()} users
      </p>

      {/* Acquisition Channels */}
      <div className="mb-5">
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
          Acquisition Channels
        </span>
        <div className="mt-2 space-y-2">
          {CHANNEL_OPTIONS.map((ch) => (
            <div key={ch} className="flex items-center gap-2">
              <span className="text-zinc-400 text-xs w-16 capitalize shrink-0">
                {ch}
              </span>
              <div className="flex-1 h-4 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", channelColor(ch))}
                  style={{ width: `${cohort.channels[ch]}%` }}
                />
              </div>
              <span className="text-zinc-300 text-xs w-8 shrink-0">
                {cohort.channels[ch]}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Distribution */}
      <div className="mb-5">
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
          Plan Distribution
        </span>
        <div className="mt-2 flex gap-1 h-6 rounded-full overflow-hidden">
          {PLAN_OPTIONS.map((p) => (
            <div
              key={p}
              className={cn(
                "h-full flex items-center justify-center text-[10px] font-medium text-white",
                planColor(p)
              )}
              style={{ width: `${cohort.plans[p]}%` }}
              title={`${p}: ${cohort.plans[p]}%`}
            >
              {cohort.plans[p] > 12 ? `${p} ${cohort.plans[p]}%` : ""}
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-2">
          {PLAN_OPTIONS.map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <div className={cn("w-2.5 h-2.5 rounded-sm", planColor(p))} />
              <span className="text-zinc-500 text-[10px] capitalize">
                {p} ({cohort.plans[p]}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* API Usage */}
      <div>
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
          Avg API Usage
        </span>
        <div className="mt-1 text-white text-lg font-bold">
          {cohort.avgApiUsage.toLocaleString()}{" "}
          <span className="text-zinc-500 text-xs font-normal">
            calls / user / month
          </span>
        </div>
      </div>
    </div>
  );
}

function FilterBar({
  channelFilter,
  planFilter,
  onChannelChange,
  onPlanChange,
}: {
  channelFilter: AcquisitionChannel | "all";
  planFilter: PlanType | "all";
  onChannelChange: (v: AcquisitionChannel | "all") => void;
  onPlanChange: (v: PlanType | "all") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Channel filter */}
      <div className="flex items-center gap-2">
        <span className="text-zinc-500 text-xs">Channel:</span>
        <div className="flex gap-1">
          {(["all", ...CHANNEL_OPTIONS] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => onChannelChange(opt)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                channelFilter === opt
                  ? "bg-indigo-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
              )}
            >
              {opt === "all" ? "All" : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Plan filter */}
      <div className="flex items-center gap-2">
        <span className="text-zinc-500 text-xs">Plan:</span>
        <div className="flex gap-1">
          {(["all", ...PLAN_OPTIONS] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => onPlanChange(opt)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                planFilter === opt
                  ? "bg-indigo-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
              )}
            >
              {opt === "all"
                ? "All"
                : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CohortAnalysisDashboard() {
  const [selectedCohortIdx, setSelectedCohortIdx] = useState<number | null>(null);
  const [channelFilter, setChannelFilter] = useState<AcquisitionChannel | "all">("all");
  const [planFilter, setPlanFilter] = useState<PlanType | "all">("all");

  const filtered = filterCohorts(COHORTS, channelFilter, planFilter);

  // ── Metrics ────────────────────────────────────────────────────────────────

  const avgD1 =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((sum, c) => sum + c.retention[1], 0) / filtered.length
        )
      : 0;
  const avgD7 =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((sum, c) => sum + (c.retention[3] ?? 0), 0) /
            filtered.length
        )
      : 0;
  const avgD30 =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((sum, c) => sum + (c.retention[7] ?? 0), 0) /
            filtered.length
        )
      : 0;

  let bestCohort = "";
  let worstCohort = "";
  if (filtered.length > 0) {
    const sorted = [...filtered].sort(
      (a, b) => b.retention[4] - a.retention[4]
    );
    bestCohort = sorted[0].label;
    worstCohort = sorted[sorted.length - 1].label;
  }

  const selectedCohort =
    selectedCohortIdx !== null && selectedCohortIdx < filtered.length
      ? filtered[selectedCohortIdx]
      : null;

  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-white text-2xl font-bold">
              Cohort Analysis
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              User retention and cohort performance · Aug 2025 – Mar 2026
            </p>
          </div>
          <FilterBar
            channelFilter={channelFilter}
            planFilter={planFilter}
            onChannelChange={setChannelFilter}
            onPlanChange={setPlanFilter}
          />
        </div>

        {/* Metrics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard
            label="Avg W1 Retention"
            value={`${avgD1}%`}
            accent="text-emerald-400"
          />
          <MetricCard
            label="Avg W3 Retention"
            value={`${avgD7}%`}
            accent="text-indigo-400"
          />
          <MetricCard
            label="Avg W7 Retention"
            value={`${avgD30}%`}
            accent="text-amber-400"
          />
          <MetricCard
            label="Best Cohort"
            value={bestCohort || "—"}
            sub="Highest W4 retention"
            accent="text-emerald-400"
          />
          <MetricCard
            label="Worst Cohort"
            value={worstCohort || "—"}
            sub="Lowest W4 retention"
            accent="text-rose-400"
          />
        </div>

        {/* Retention Matrix */}
        <RetentionMatrix
          cohorts={filtered}
          selectedIndex={selectedCohortIdx}
          onSelect={setSelectedCohortIdx}
        />

        {/* Bottom Row: Comparison Chart + Cohort Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CohortComparisonChart cohorts={filtered} />
          {selectedCohort ? (
            <CohortDetails cohort={selectedCohort} />
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-center">
              <div className="text-center">
                <span className="text-3xl mb-2 block">👆</span>
                <p className="text-zinc-400 text-sm">
                  Click a cohort row to view details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
