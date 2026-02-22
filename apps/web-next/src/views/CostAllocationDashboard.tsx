import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type CostCategory = "compute" | "storage" | "network" | "database" | "ai" | "other";
type CostTrend = "up" | "down" | "flat";
type BudgetStatus = "under" | "on-track" | "warning" | "over";
type TimeRange = "7d" | "30d" | "90d" | "ytd";
type AllocationMethod = "tag" | "account" | "team" | "project";

interface CostCenter {
  id: string;
  name: string;
  team: string;
  budget: number;
  spent: number;
  forecast: number;
  status: BudgetStatus;
  trend: CostTrend;
  trendPct: number;
  topCategory: CostCategory;
  breakdown: Record<CostCategory, number>;
  alerts: number;
}

interface ServiceCost {
  id: string;
  service: string;
  provider: "aws" | "gcp" | "azure" | "internal";
  category: CostCategory;
  monthlyCost: number;
  change: number; // %
  trend: CostTrend;
  costCenter: string;
  resourceCount: number;
  topResource: string;
}

interface BudgetAlert {
  id: string;
  costCenter: string;
  type: "threshold" | "anomaly" | "forecast";
  message: string;
  severity: "info" | "warning" | "critical";
  triggeredAt: string;
  resolved: boolean;
}

interface TrendPoint {
  date: string;
  compute: number;
  storage: number;
  network: number;
  database: number;
  ai: number;
  other: number;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const COST_CENTERS: CostCenter[] = [
  {
    id: "cc-001", name: "Platform Core", team: "Platform", budget: 45000, spent: 38200,
    forecast: 43500, status: "on-track", trend: "up", trendPct: 4.2, topCategory: "compute",
    breakdown: { compute: 22000, storage: 8000, network: 3500, database: 3200, ai: 1000, other: 500 },
    alerts: 0,
  },
  {
    id: "cc-002", name: "Product & UI", team: "Product", budget: 12000, spent: 11400,
    forecast: 13200, status: "warning", trend: "up", trendPct: 12.5, topCategory: "ai",
    breakdown: { compute: 3200, storage: 1800, network: 800, database: 600, ai: 4500, other: 500 },
    alerts: 2,
  },
  {
    id: "cc-003", name: "Data Science", team: "Analytics", budget: 35000, spent: 36800,
    forecast: 41000, status: "over", trend: "up", trendPct: 18.3, topCategory: "ai",
    breakdown: { compute: 12000, storage: 5000, network: 2000, database: 3000, ai: 14000, other: 800 },
    alerts: 3,
  },
  {
    id: "cc-004", name: "Customer Ops", team: "Operations", budget: 18000, spent: 14200,
    forecast: 16800, status: "under", trend: "down", trendPct: -3.1, topCategory: "compute",
    breakdown: { compute: 7000, storage: 3500, network: 1500, database: 1800, ai: 200, other: 200 },
    alerts: 0,
  },
  {
    id: "cc-005", name: "Security", team: "Security", budget: 22000, spent: 19800,
    forecast: 21500, status: "on-track", trend: "flat", trendPct: 0.8, topCategory: "compute",
    breakdown: { compute: 9000, storage: 4500, network: 2500, database: 2800, ai: 500, other: 500 },
    alerts: 1,
  },
  {
    id: "cc-006", name: "DevOps/Infra", team: "DevOps", budget: 55000, spent: 52100,
    forecast: 54800, status: "on-track", trend: "up", trendPct: 2.1, topCategory: "compute",
    breakdown: { compute: 28000, storage: 12000, network: 6000, database: 4500, ai: 800, other: 800 },
    alerts: 1,
  },
];

const SERVICES: ServiceCost[] = [
  { id: "s-001", service: "EC2 Instances", provider: "aws", category: "compute", monthlyCost: 28400, change: 5.2, trend: "up", costCenter: "DevOps/Infra", resourceCount: 142, topResource: "m5.2xlarge" },
  { id: "s-002", service: "Cloud Storage", provider: "gcp", category: "storage", monthlyCost: 12800, change: -2.1, trend: "down", costCenter: "Platform Core", resourceCount: 48, topResource: "standard-bucket" },
  { id: "s-003", service: "AI API Calls", provider: "internal", category: "ai", monthlyCost: 18600, change: 22.4, trend: "up", costCenter: "Data Science", resourceCount: 8, topResource: "inference-cluster" },
  { id: "s-004", service: "RDS Databases", provider: "aws", category: "database", monthlyCost: 9200, change: 0.4, trend: "flat", costCenter: "Platform Core", resourceCount: 24, topResource: "db.r5.large" },
  { id: "s-005", service: "CDN / Network", provider: "aws", category: "network", monthlyCost: 6400, change: 3.1, trend: "up", costCenter: "Product & UI", resourceCount: 12, topResource: "CloudFront dist." },
  { id: "s-006", service: "Kubernetes", provider: "gcp", category: "compute", monthlyCost: 22100, change: 1.8, trend: "up", costCenter: "DevOps/Infra", resourceCount: 320, topResource: "n2-standard-4" },
  { id: "s-007", service: "BigQuery", provider: "gcp", category: "database", monthlyCost: 7800, change: 8.9, trend: "up", costCenter: "Data Science", resourceCount: 16, topResource: "analysis dataset" },
  { id: "s-008", service: "Azure OpenAI", provider: "azure", category: "ai", monthlyCost: 14200, change: 31.0, trend: "up", costCenter: "Data Science", resourceCount: 4, topResource: "gpt-4o endpoint" },
];

const ALERTS: BudgetAlert[] = [
  { id: "a-001", costCenter: "Data Science", type: "threshold", message: "Spent 105% of monthly budget", severity: "critical", triggeredAt: "2026-02-22T10:00:00Z", resolved: false },
  { id: "a-002", costCenter: "Data Science", type: "forecast", message: "Forecasted to exceed budget by $6k", severity: "critical", triggeredAt: "2026-02-20T08:00:00Z", resolved: false },
  { id: "a-003", costCenter: "Data Science", type: "anomaly", message: "Azure OpenAI costs up 31% MoM", severity: "warning", triggeredAt: "2026-02-21T14:00:00Z", resolved: false },
  { id: "a-004", costCenter: "Product & UI", type: "forecast", message: "Forecasted to exceed budget by $1.2k", severity: "warning", triggeredAt: "2026-02-22T09:00:00Z", resolved: false },
  { id: "a-005", costCenter: "Product & UI", type: "anomaly", message: "AI API spend up 22% vs last month", severity: "warning", triggeredAt: "2026-02-19T12:00:00Z", resolved: false },
  { id: "a-006", costCenter: "Security", type: "threshold", message: "Reached 90% of monthly budget", severity: "info", triggeredAt: "2026-02-18T16:00:00Z", resolved: false },
  { id: "a-007", costCenter: "DevOps/Infra", type: "anomaly", message: "Unusual bandwidth spike (2× baseline)", severity: "info", triggeredAt: "2026-02-17T11:00:00Z", resolved: false },
];

const TREND_POINTS: TrendPoint[] = [
  { date: "Feb 08", compute: 58, storage: 28, network: 13, database: 18, ai: 28, other: 4 },
  { date: "Feb 09", compute: 60, storage: 27, network: 14, database: 17, ai: 30, other: 4 },
  { date: "Feb 10", compute: 59, storage: 29, network: 13, database: 19, ai: 31, other: 5 },
  { date: "Feb 11", compute: 62, storage: 28, network: 15, database: 18, ai: 33, other: 4 },
  { date: "Feb 12", compute: 61, storage: 30, network: 14, database: 20, ai: 35, other: 5 },
  { date: "Feb 13", compute: 64, storage: 29, network: 16, database: 19, ai: 36, other: 4 },
  { date: "Feb 14", compute: 63, storage: 31, network: 15, database: 21, ai: 38, other: 5 },
  { date: "Feb 15", compute: 66, storage: 30, network: 17, database: 20, ai: 39, other: 5 },
  { date: "Feb 16", compute: 65, storage: 32, network: 16, database: 22, ai: 40, other: 5 },
  { date: "Feb 17", compute: 68, storage: 31, network: 18, database: 21, ai: 42, other: 6 },
  { date: "Feb 18", compute: 67, storage: 33, network: 17, database: 23, ai: 44, other: 6 },
  { date: "Feb 19", compute: 70, storage: 32, network: 19, database: 22, ai: 46, other: 6 },
  { date: "Feb 20", compute: 69, storage: 34, network: 18, database: 24, ai: 48, other: 7 },
  { date: "Feb 21", compute: 72, storage: 33, network: 20, database: 23, ai: 50, other: 7 },
  { date: "Feb 22", compute: 81, storage: 35, network: 14, database: 20, ai: 37, other: 3 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCost(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

function budgetStatusColor(s: BudgetStatus): string {
  return s === "over" ? "text-rose-400" : s === "warning" ? "text-amber-400" : s === "under" ? "text-sky-400" : "text-emerald-400";
}

function budgetStatusBg(s: BudgetStatus): string {
  return s === "over" ? "bg-rose-500/20 text-rose-300" : s === "warning" ? "bg-amber-500/20 text-amber-300" : s === "under" ? "bg-sky-500/20 text-sky-300" : "bg-emerald-500/20 text-emerald-300";
}

function trendColor(t: CostTrend): string {
  return t === "up" ? "text-rose-400" : t === "down" ? "text-emerald-400" : "text-zinc-400";
}

function categoryColor(c: CostCategory): string {
  const m: Record<CostCategory, string> = {
    compute: "bg-indigo-500", storage: "bg-sky-500", network: "bg-violet-500",
    database: "bg-amber-500", ai: "bg-rose-500", other: "bg-zinc-500",
  };
  return m[c];
}

function providerBadge(p: string): string {
  const m: Record<string, string> = { aws: "bg-amber-500/20 text-amber-300", gcp: "bg-sky-500/20 text-sky-300", azure: "bg-blue-500/20 text-blue-300", internal: "bg-indigo-500/20 text-indigo-300" };
  return m[p] ?? "bg-zinc-700 text-zinc-300";
}

function severityColor(s: string): string {
  return s === "critical" ? "text-rose-400" : s === "warning" ? "text-amber-400" : "text-sky-400";
}

function severityBg(s: string): string {
  return s === "critical" ? "bg-rose-500/20 text-rose-300" : s === "warning" ? "bg-amber-500/20 text-amber-300" : "bg-sky-500/20 text-sky-300";
}

// ── Cost breakdown bar ────────────────────────────────────────────────────────

function BreakdownBar({ breakdown }: { breakdown: Record<CostCategory, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const categories: CostCategory[] = ["compute", "storage", "database", "network", "ai", "other"];
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden gap-px">
      {categories.map((cat) => {
        const pct = total > 0 ? (breakdown[cat] / total) * 100 : 0;
        return pct > 0 ? (
          <div key={cat} className={cn(categoryColor(cat))} style={{ width: `${pct}%` }} title={`${cat}: ${fmtCost(breakdown[cat])}`} />
        ) : null;
      })}
    </div>
  );
}

// ── Trend chart ───────────────────────────────────────────────────────────────

function TrendChart({ points }: { points: TrendPoint[] }) {
  const categories: (keyof Omit<TrendPoint, "date">)[] = ["compute", "storage", "database", "network", "ai", "other"];
  const colorMap: Record<string, string> = {
    compute: "#6366f1", storage: "#0ea5e9", network: "#8b5cf6",
    database: "#f59e0b", ai: "#f43f5e", other: "#71717a",
  };
  const maxTotal = Math.max(...points.map((p) => categories.reduce((s, c) => s + p[c], 0)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {categories.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: colorMap[cat] }} />
            {cat}
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1 h-32">
        {points.map((p) => {
          const total = categories.reduce((s, c) => s + p[c], 0);
          const heightPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
          return (
            <div key={p.date} className="flex-1 flex flex-col justify-end gap-px group relative" style={{ height: "100%" }}>
              <div className="flex flex-col justify-end overflow-hidden rounded-sm" style={{ height: `${heightPct}%` }}>
                {categories.map((cat) => {
                  const pct = total > 0 ? (p[cat] / total) * 100 : 0;
                  return <div key={cat} style={{ height: `${pct}%`, background: colorMap[cat] }} />;
                })}
              </div>
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-zinc-500 whitespace-nowrap hidden group-hover:block">{p.date}</div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function CostCenterDetail({ cc }: { cc: CostCenter }) {
  const categories: CostCategory[] = ["compute", "storage", "database", "network", "ai", "other"];
  const budgetPct = Math.round((cc.spent / cc.budget) * 100);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{cc.name}</span>
            <span className={cn("px-2 py-0.5 rounded text-xs font-medium", budgetStatusBg(cc.status))}>
              {cc.status === "over" ? "Over Budget" : cc.status === "warning" ? "Warning" : cc.status === "under" ? "Under Budget" : "On Track"}
            </span>
            {cc.alerts > 0 && <span className="px-1.5 py-0.5 rounded text-xs bg-rose-500/20 text-rose-300">{cc.alerts} alert{cc.alerts > 1 ? "s" : ""}</span>}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">{cc.team}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Spent", val: fmtCost(cc.spent), sub: `of ${fmtCost(cc.budget)} budget`, color: budgetStatusColor(cc.status) },
          { label: "Forecast", val: fmtCost(cc.forecast), sub: "end-of-month est.", color: "text-zinc-200" },
          { label: "MoM Change", val: `${cc.trend === "up" ? "+" : ""}${cc.trendPct}%`, sub: `vs. last month`, color: trendColor(cc.trend) },
        ].map((m) => (
          <div key={m.label} className="bg-zinc-800/60 rounded-lg p-3">
            <div className="text-xs text-zinc-400">{m.label}</div>
            <div className={cn("text-lg font-bold mt-1", m.color)}>{m.val}</div>
            <div className="text-xs text-zinc-500">{m.sub}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="flex justify-between text-xs text-zinc-400 mb-1">
          <span>Budget utilization</span>
          <span className={budgetStatusColor(cc.status)}>{budgetPct}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", cc.status === "over" ? "bg-rose-500" : cc.status === "warning" ? "bg-amber-500" : "bg-indigo-500")}
            style={{ width: `${Math.min(budgetPct, 100)}%` }}
          />
        </div>
      </div>
      <div>
        <div className="text-xs text-zinc-400 mb-2">Cost breakdown</div>
        <BreakdownBar breakdown={cc.breakdown} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <div className={cn("w-2 h-2 rounded-sm", categoryColor(cat))} />
                {cat}
              </div>
              <span className="text-zinc-300">{fmtCost(cc.breakdown[cat])}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CostAllocationDashboard() {
  const [tab, setTab] = useState<"centers" | "services" | "alerts" | "trends">("centers");
  const [selectedCC, setSelectedCC] = useState<CostCenter | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [filterStatus, setFilterStatus] = useState<BudgetStatus | "all">("all");
  const [filterCategory, setFilterCategory] = useState<CostCategory | "all">("all");
  const [_method, _setMethod] = useState<AllocationMethod>("tag");

  const filteredCenters = COST_CENTERS.filter(
    (cc) => filterStatus === "all" || cc.status === filterStatus,
  );

  const filteredServices = SERVICES.filter(
    (s) => filterCategory === "all" || s.category === filterCategory,
  );

  const totalSpent = COST_CENTERS.reduce((s, cc) => s + cc.spent, 0);
  const totalBudget = COST_CENTERS.reduce((s, cc) => s + cc.budget, 0);
  const totalForecast = COST_CENTERS.reduce((s, cc) => s + cc.forecast, 0);
  const openAlerts = ALERTS.filter((a) => !a.resolved).length;

  const tabs = [
    { id: "centers" as const, label: "Cost Centers", count: COST_CENTERS.length },
    { id: "services" as const, label: "Services", count: SERVICES.length },
    { id: "alerts" as const, label: "Alerts", count: openAlerts },
    { id: "trends" as const, label: "Trends" },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Cost Allocation</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Budget tracking, service costs, and anomaly detection</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-zinc-800 p-0.5 text-xs">
              {(["7d", "30d", "90d", "ytd"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={cn("px-3 py-1.5 rounded-md transition-colors", timeRange === r ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white")}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Summary metrics */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          {[
            { label: "Total Spent", val: fmtCost(totalSpent), sub: `${Math.round((totalSpent / totalBudget) * 100)}% of budget`, color: "text-white" },
            { label: "Budget", val: fmtCost(totalBudget), sub: "monthly allocation", color: "text-zinc-200" },
            { label: "Forecast", val: fmtCost(totalForecast), sub: totalForecast > totalBudget ? "⚠️ exceeds budget" : "✓ within budget", color: totalForecast > totalBudget ? "text-amber-400" : "text-emerald-400" },
            { label: "Open Alerts", val: String(openAlerts), sub: `${ALERTS.filter((a) => !a.resolved && a.severity === "critical").length} critical`, color: openAlerts > 0 ? "text-amber-400" : "text-emerald-400" },
          ].map((m) => (
            <div key={m.label} className="bg-zinc-900 rounded-lg p-3">
              <div className="text-xs text-zinc-400">{m.label}</div>
              <div className={cn("text-xl font-bold mt-0.5", m.color)}>{m.val}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedCC(null); }}
            className={cn("px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", tab === t.id ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-white")}
          >
            {t.label}
            {"count" in t && t.count !== undefined && (
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full", tab === t.id ? "bg-indigo-500/20 text-indigo-300" : "bg-zinc-700 text-zinc-400")}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">
        {tab === "centers" && (
          <>
            <div className="flex flex-col w-72 border-r border-zinc-800 overflow-hidden">
              {/* Filter */}
              <div className="p-3 border-b border-zinc-800">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as BudgetStatus | "all")}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="over">Over Budget</option>
                  <option value="warning">Warning</option>
                  <option value="on-track">On Track</option>
                  <option value="under">Under Budget</option>
                </select>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredCenters.map((cc) => (
                  <button
                    key={cc.id}
                    onClick={() => setSelectedCC(cc)}
                    className={cn("w-full text-left px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors", selectedCC?.id === cc.id && "bg-zinc-800/60")}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{cc.name}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", budgetStatusBg(cc.status))}>
                        {cc.status === "over" ? "Over" : cc.status === "warning" ? "Warn" : cc.status === "under" ? "Under" : "OK"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                      <span>{fmtCost(cc.spent)}</span>
                      <span className={trendColor(cc.trend)}>
                        {cc.trend === "up" ? "▲" : cc.trend === "down" ? "▼" : "—"} {Math.abs(cc.trendPct)}%
                      </span>
                    </div>
                    <BreakdownBar breakdown={cc.breakdown} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {selectedCC ? (
                <CostCenterDetail cc={selectedCC} />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                  Select a cost center to view details
                </div>
              )}
            </div>
          </>
        )}

        {tab === "services" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center gap-3 mb-4">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as CostCategory | "all")}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white"
              >
                <option value="all">All Categories</option>
                {(["compute", "storage", "network", "database", "ai", "other"] as CostCategory[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">{filteredServices.length} services</span>
            </div>
            <div className="space-y-2">
              {filteredServices.sort((a, b) => b.monthlyCost - a.monthlyCost).map((svc) => (
                <div key={svc.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2.5 h-2.5 rounded-sm flex-shrink-0 mt-1", categoryColor(svc.category))} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{svc.service}</span>
                          <span className={cn("px-1.5 py-0.5 rounded text-xs", providerBadge(svc.provider))}>{svc.provider.toUpperCase()}</span>
                          <span className="text-xs text-zinc-500">{svc.category}</span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">{svc.costCenter} · {svc.resourceCount} resources · Top: {svc.topResource}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">{fmtCost(svc.monthlyCost)}<span className="text-xs font-normal text-zinc-400">/mo</span></div>
                      <div className={cn("text-xs mt-0.5", trendColor(svc.trend))}>
                        {svc.change > 0 ? "+" : ""}{svc.change}% MoM
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", categoryColor(svc.category))}
                      style={{ width: `${Math.min((svc.monthlyCost / 30000) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "alerts" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-3">
              {ALERTS.filter((a) => !a.resolved).map((alert) => (
                <div key={alert.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "ℹ️"}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{alert.costCenter}</span>
                          <span className={cn("px-1.5 py-0.5 rounded text-xs", severityBg(alert.severity))}>{alert.severity}</span>
                          <span className="text-xs text-zinc-500">{alert.type}</span>
                        </div>
                        <div className="text-sm text-zinc-300 mt-1">{alert.message}</div>
                        <div className="text-xs text-zinc-500 mt-1">{new Date(alert.triggeredAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <button className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors">
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
              {ALERTS.filter((a) => !a.resolved).length === 0 && (
                <div className="text-center py-12 text-zinc-500 text-sm">No open alerts</div>
              )}
            </div>
          </div>
        )}

        {tab === "trends" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <h3 className="text-sm font-medium text-white mb-4">Daily cost trend by category ($k)</h3>
              <TrendChart points={TREND_POINTS} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              {(["compute", "ai", "storage", "database"] as CostCategory[]).map((cat) => {
                const vals = TREND_POINTS.map((p) => p[cat as keyof Omit<TrendPoint, "date">] as number);
                const cur = vals[vals.length - 1];
                const prev = vals[0];
                const delta = prev > 0 ? ((cur - prev) / prev) * 100 : 0;
                return (
                  <div key={cat} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("w-2.5 h-2.5 rounded-sm", categoryColor(cat))} />
                      <span className="text-xs text-zinc-400 capitalize">{cat}</span>
                    </div>
                    <div className="text-xl font-bold text-white">${cur}k</div>
                    <div className={cn("text-xs mt-1", delta > 0 ? "text-rose-400" : "text-emerald-400")}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}% over period
                    </div>
                    <div className="flex items-end gap-0.5 h-8 mt-2">
                      {vals.map((v, i) => (
                        <div key={i} className={cn("flex-1 rounded-sm", categoryColor(cat))} style={{ height: `${(v / Math.max(...vals)) * 100}%`, opacity: 0.4 + (i / vals.length) * 0.6 }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
