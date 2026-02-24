import React, { useState } from "react";
import { Wallet } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';

// ── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  date: string;
  description: string;
  amount: number;
  vendor: string;
}

interface BudgetCategory {
  id: string;
  name: string;
  emoji: string;
  monthlyBudget: number;
  ytdSpent: number;
  currentMonth: number;
  forecast: number;
  variance: number;
  transactions: Transaction[];
}

type Period = "MTD" | "QTD" | "YTD";

// ── Seed Data ────────────────────────────────────────────────────────────────

const CATEGORIES: BudgetCategory[] = [
  {
    id: "llm-api",
    name: "LLM API Costs",
    emoji: "🤖",
    monthlyBudget: 12000,
    ytdSpent: 21400,
    currentMonth: 11800,
    forecast: 141600,
    variance: 141600 - 12000 * 12,
    transactions: [
      { date: "2026-02-20", description: "Claude API usage", amount: 4200, vendor: "Anthropic" },
      { date: "2026-02-18", description: "GPT-4o batch inference", amount: 3100, vendor: "OpenAI" },
      { date: "2026-02-15", description: "Embedding generation", amount: 2800, vendor: "Anthropic" },
    ],
  },
  {
    id: "infra",
    name: "Infrastructure",
    emoji: "🏗️",
    monthlyBudget: 8500,
    ytdSpent: 15200,
    currentMonth: 7600,
    forecast: 91200,
    variance: 91200 - 8500 * 12,
    transactions: [
      { date: "2026-02-19", description: "AWS compute (EKS)", amount: 3200, vendor: "AWS" },
      { date: "2026-02-17", description: "Cloudflare CDN", amount: 1400, vendor: "Cloudflare" },
      { date: "2026-02-14", description: "Database hosting", amount: 2100, vendor: "AWS RDS" },
    ],
  },
  {
    id: "tooling",
    name: "Agent Tooling",
    emoji: "🔧",
    monthlyBudget: 5000,
    ytdSpent: 9800,
    currentMonth: 4900,
    forecast: 58800,
    variance: 58800 - 5000 * 12,
    transactions: [
      { date: "2026-02-21", description: "Tool runtime licenses", amount: 1800, vendor: "Internal" },
      { date: "2026-02-16", description: "Sandbox compute", amount: 1600, vendor: "Fly.io" },
      { date: "2026-02-12", description: "Browser automation", amount: 900, vendor: "Browserbase" },
    ],
  },
  {
    id: "dev",
    name: "Development",
    emoji: "💻",
    monthlyBudget: 6000,
    ytdSpent: 10500,
    currentMonth: 5200,
    forecast: 62400,
    variance: 62400 - 6000 * 12,
    transactions: [
      { date: "2026-02-20", description: "GitHub Enterprise", amount: 1900, vendor: "GitHub" },
      { date: "2026-02-18", description: "CI/CD pipeline", amount: 1400, vendor: "GitHub Actions" },
      { date: "2026-02-13", description: "Dev tooling licenses", amount: 1100, vendor: "JetBrains" },
    ],
  },
  {
    id: "design",
    name: "Design & Research",
    emoji: "🎨",
    monthlyBudget: 3500,
    ytdSpent: 5800,
    currentMonth: 2900,
    forecast: 34800,
    variance: 34800 - 3500 * 12,
    transactions: [
      { date: "2026-02-19", description: "Figma team plan", amount: 800, vendor: "Figma" },
      { date: "2026-02-15", description: "User research tools", amount: 1200, vendor: "Maze" },
      { date: "2026-02-10", description: "Design asset licenses", amount: 600, vendor: "Various" },
    ],
  },
  {
    id: "security",
    name: "Security & Compliance",
    emoji: "🔒",
    monthlyBudget: 4000,
    ytdSpent: 7800,
    currentMonth: 3900,
    forecast: 46800,
    variance: 46800 - 4000 * 12,
    transactions: [
      { date: "2026-02-21", description: "SOC 2 audit services", amount: 1500, vendor: "Vanta" },
      { date: "2026-02-17", description: "Pen testing", amount: 1200, vendor: "HackerOne" },
      { date: "2026-02-11", description: "Secret management", amount: 800, vendor: "1Password" },
    ],
  },
  {
    id: "ops",
    name: "Operations",
    emoji: "⚙️",
    monthlyBudget: 3000,
    ytdSpent: 5400,
    currentMonth: 2700,
    forecast: 32400,
    variance: 32400 - 3000 * 12,
    transactions: [
      { date: "2026-02-20", description: "Monitoring stack", amount: 900, vendor: "Datadog" },
      { date: "2026-02-16", description: "PagerDuty on-call", amount: 600, vendor: "PagerDuty" },
      { date: "2026-02-12", description: "Slack workspace", amount: 750, vendor: "Slack" },
    ],
  },
  {
    id: "contingency",
    name: "Contingency",
    emoji: "🛡️",
    monthlyBudget: 2000,
    ytdSpent: 1200,
    currentMonth: 600,
    forecast: 7200,
    variance: 7200 - 2000 * 12,
    transactions: [
      { date: "2026-02-18", description: "Unplanned scaling burst", amount: 400, vendor: "AWS" },
      { date: "2026-02-09", description: "Emergency vendor switch", amount: 200, vendor: "Various" },
      { date: "2026-01-28", description: "Incident remediation", amount: 350, vendor: "Internal" },
    ],
  },
];

const SEGMENT_COLORS = [
  "bg-indigo-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-400",
];

const MONTHLY_DATA: { month: string; budget: number; actual: number }[] = [
  { month: "Mar", budget: 44000, actual: 38200 },
  { month: "Apr", budget: 44000, actual: 40100 },
  { month: "May", budget: 44000, actual: 42800 },
  { month: "Jun", budget: 44000, actual: 41500 },
  { month: "Jul", budget: 44000, actual: 43200 },
  { month: "Aug", budget: 44000, actual: 44800 },
  { month: "Sep", budget: 44000, actual: 42100 },
  { month: "Oct", budget: 44000, actual: 45600 },
  { month: "Nov", budget: 44000, actual: 43900 },
  { month: "Dec", budget: 44000, actual: 41700 },
  { month: "Jan", budget: 44000, actual: 37500 },
  { month: "Feb", budget: 44000, actual: 39600 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

function pct(spent: number, budget: number): number {
  return budget === 0 ? 0 : Math.round((spent / budget) * 100);
}

function statusColor(ratio: number): string {
  if (ratio >= 90) {return "text-rose-400";}
  if (ratio >= 70) {return "text-amber-400";}
  return "text-emerald-400";
}

function barColor(ratio: number): string {
  if (ratio >= 90) {return "bg-rose-500";}
  if (ratio >= 70) {return "bg-amber-500";}
  return "bg-emerald-500";
}

// ── Component ────────────────────────────────────────────────────────────────

import { Skeleton } from '../components/Skeleton';

function BudgetTrackerSkeleton() {
  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary p-6">
      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-32 rounded" />
              <Skeleton className="h-9 w-20 rounded" />
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface-1 border border-tok-border rounded-lg p-4 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>

          {/* Stacked spend bar */}
          <div className="bg-surface-1 border border-tok-border rounded-lg p-4 space-y-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-6 w-full rounded" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Skeleton className="w-2.5 h-2.5 rounded-sm" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>

          {/* Budget table */}
          <div className="bg-surface-1 border border-tok-border rounded-lg overflow-hidden">
            <div className="flex gap-2 px-4 py-2.5 border-b border-tok-border">
              {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
              <Skeleton className="w-8 h-3" />
            </div>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-2 px-4 py-3 border-b border-tok-border last:border-b-0 items-center">
                <div className="flex-[2] flex items-center gap-2">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="flex-1 h-3" />
                <Skeleton className="flex-1 h-3" />
                <div className="flex-[1.2] flex items-center gap-2">
                  <Skeleton className="flex-1 h-2 rounded-full" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="flex-1 h-3" />
                <Skeleton className="flex-1 h-3" />
                <Skeleton className="flex-1 h-3" />
                <Skeleton className="w-8 h-3" />
              </div>
            ))}
          </div>

          {/* Monthly trend chart */}
          <div className="bg-surface-1 border border-tok-border rounded-lg p-4 space-y-4">
            <Skeleton className="h-4 w-56" />
            <div className="flex items-end gap-3 h-40">
              {[75,90,62,80,95,70,85,55,78,92,65,88].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex items-end gap-0.5 h-32 w-full justify-center">
                    <div className="w-[40%] bg-secondary/70 rounded-t animate-pulse-soft" aria-hidden="true" style={{ height: `${h}%` }} />
                    <div className="w-[40%] bg-secondary/70 rounded-t animate-pulse-soft" aria-hidden="true" style={{ height: `${Math.max(h - 5, 10)}%` }} />
                  </div>
                  <Skeleton className="h-3 w-6" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts sidebar */}
        <div className="w-[200px] flex-shrink-0">
          <div className="bg-surface-1 border border-tok-border rounded-lg p-4 sticky top-6 space-y-3">
            <Skeleton className="h-4 w-28" />
            {[...Array(2)].map((_, i) => (
              <div key={i} className="rounded-lg p-3 border border-amber-500/30 bg-amber-500/10 space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
            <div className="pt-3 border-t border-tok-border space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BudgetTracker({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <BudgetTrackerSkeleton />;

  const [period, setPeriod] = useState<Period>("MTD");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalBudget = CATEGORIES.reduce((s, c) => s + c.monthlyBudget * 12, 0);
  const totalSpent = CATEGORIES.reduce((s, c) => s + c.ytdSpent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const totalCurrentMonth = CATEGORIES.reduce((s, c) => s + c.currentMonth, 0);
  const totalMonthlyBudget = CATEGORIES.reduce((s, c) => s + c.monthlyBudget, 0);
  const burnRate = totalMonthlyBudget === 0 ? 0 : Math.round((totalCurrentMonth / totalMonthlyBudget) * 100);

  const alerts = CATEGORIES.filter(
    (c) => pct(c.currentMonth, c.monthlyBudget) >= 90
  );

  const maxTrend = Math.max(...MONTHLY_DATA.map((m) => Math.max(m.budget, m.actual)));

  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* ── Main Content ─────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Budget Tracker</h1>
            <div className="flex items-center gap-3">
              <div className="flex bg-surface-2 rounded overflow-hidden border border-tok-border">
                {(["MTD", "QTD", "YTD"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium transition-colors",
                      period === p
                        ? "bg-indigo-600 text-fg-primary"
                        : "text-fg-secondary hover:text-fg-primary"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button className="bg-indigo-600 hover:bg-indigo-500 text-fg-primary px-3 py-1.5 rounded text-sm">
                Export
              </button>
            </div>
          </div>

          {/* Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Budget", value: fmt(totalBudget), sub: "Annual" },
              { label: "Total Spent", value: fmt(totalSpent), sub: "YTD" },
              {
                label: "Remaining",
                value: fmt(totalRemaining),
                sub: `${pct(totalSpent, totalBudget)}% used`,
              },
              { label: "Burn Rate", value: `${burnRate}%`, sub: "vs monthly budget" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-surface-1 border border-tok-border rounded-lg p-4"
              >
                <p className="text-fg-muted text-xs uppercase tracking-wider mb-1">
                  {s.label}
                </p>
                <p className="text-xl font-semibold">{s.value}</p>
                <p className="text-fg-muted text-xs mt-1">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Stacked Spend Bar */}
          <div className="bg-surface-1 border border-tok-border rounded-lg p-4">
            <p className="text-sm text-fg-secondary mb-3">Spend by Category (YTD)</p>
            <div className="flex h-6 rounded overflow-hidden">
              {CATEGORIES.map((c, i) => {
                const w = totalSpent === 0 ? 0 : (c.ytdSpent / totalSpent) * 100;
                return (
                  <div
                    key={c.id}
                    className={cn(SEGMENT_COLORS[i], "transition-all")}
                    style={{ width: `${w}%` }}
                    title={`${c.name}: ${fmt(c.ytdSpent)}`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {CATEGORIES.map((c, i) => (
                <div key={c.id} className="flex items-center gap-1.5 text-xs text-fg-secondary">
                  <div className={cn("w-2.5 h-2.5 rounded-sm", SEGMENT_COLORS[i])} />
                  <span>{c.emoji} {c.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Budget Table */}
          {CATEGORIES.length === 0 ? (
            <ContextualEmptyState
              icon={Wallet}
              title="No budgets configured"
              description="Set up budget limits to track and control your AI spending across agents and models."
            />
          ) : (
          <div className="bg-surface-1 border border-tok-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
            <div className="min-w-[700px]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr_1fr_auto] gap-2 px-4 py-2.5 border-b border-tok-border text-xs text-fg-muted uppercase tracking-wider">
              <span>Category</span>
              <span>Monthly Budget</span>
              <span>Current Month</span>
              <span>MTD Usage</span>
              <span>YTD Spent</span>
              <span>Forecast</span>
              <span>Variance</span>
              <span className="w-8" />
            </div>

            {CATEGORIES.map((c) => {
              const ratio = pct(c.currentMonth, c.monthlyBudget);
              const isExpanded = expandedId === c.id;
              const varianceNeg = c.variance > 0;

              return (
                <div key={c.id} className="border-b border-tok-border last:border-b-0">
                  <div
                    className="grid grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr_1fr_auto] gap-2 px-4 py-3 items-center text-sm hover:bg-surface-2/40 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <span>{c.emoji}</span>
                      <span>{c.name}</span>
                    </span>
                    <span className="text-fg-secondary">{fmt(c.monthlyBudget)}</span>
                    <span className={statusColor(ratio)}>{fmt(c.currentMonth)}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", barColor(ratio))}
                          style={{ width: `${Math.min(ratio, 100)}%` }}
                        />
                      </div>
                      <span className={cn("text-xs w-8 text-right", statusColor(ratio))}>
                        {ratio}%
                      </span>
                    </div>
                    <span className="text-fg-secondary">{fmt(c.ytdSpent)}</span>
                    <span className="text-fg-secondary">{fmt(c.forecast)}</span>
                    <span className={varianceNeg ? "text-rose-400" : "text-emerald-400"}>
                      {varianceNeg ? "+" : ""}
                      {fmt(Math.abs(c.variance))}
                    </span>
                    <span className="w-8 text-center text-fg-muted text-xs select-none">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-3">
                      <div className="bg-surface-2/60 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-[1fr_2fr_1fr_1fr] gap-2 px-3 py-2 text-xs text-fg-muted uppercase tracking-wider border-b border-tok-border">
                          <span>Date</span>
                          <span>Description</span>
                          <span>Amount</span>
                          <span>Vendor</span>
                        </div>
                        {c.transactions.map((t, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-[1fr_2fr_1fr_1fr] gap-2 px-3 py-2 text-sm border-b border-tok-border/50 last:border-b-0"
                          >
                            <span className="text-fg-muted">{t.date}</span>
                            <span className="text-fg-primary">{t.description}</span>
                            <span className="text-fg-primary">{fmt(t.amount)}</span>
                            <span className="text-fg-secondary">{t.vendor}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
            </div>
          </div>
          )}

          {/* Monthly Trend */}
          <div className="bg-surface-1 border border-tok-border rounded-lg p-4">
            <p className="text-sm text-fg-secondary mb-4">Monthly Trend — Budget vs Actual</p>
            <div className="flex items-end gap-3 h-40">
              {MONTHLY_DATA.map((m) => {
                const bH = maxTrend === 0 ? 0 : (m.budget / maxTrend) * 100;
                const aH = maxTrend === 0 ? 0 : (m.actual / maxTrend) * 100;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-end gap-0.5 h-32 w-full justify-center">
                      <div
                        className="w-[40%] bg-indigo-500/40 rounded-t"
                        style={{ height: `${bH}%` }}
                        title={`Budget: ${fmt(m.budget)}`}
                      />
                      <div
                        className={cn(
                          "w-[40%] rounded-t",
                          m.actual > m.budget ? "bg-rose-500" : "bg-emerald-500"
                        )}
                        style={{ height: `${aH}%` }}
                        title={`Actual: ${fmt(m.actual)}`}
                      />
                    </div>
                    <span className="text-xs text-fg-muted">{m.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-5 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-fg-secondary">
                <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500/40" />
                <span>Budget</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-fg-secondary">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span>Actual (under)</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-fg-secondary">
                <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                <span>Actual (over)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Alerts Sidebar ──────────────────────────── */}
        <div className="w-full md:w-[200px] md:flex-shrink-0">
          <div className="bg-surface-1 border border-tok-border rounded-lg p-4 sticky top-6">
            <p className="text-sm font-semibold text-fg-primary mb-3">⚠️ Budget Alerts</p>
            {alerts.length === 0 ? (
              <p className="text-xs text-fg-muted">All categories within budget.</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((c) => {
                  const ratio = pct(c.currentMonth, c.monthlyBudget);
                  const isOver = ratio >= 100;
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "rounded-lg p-3 border",
                        isOver
                          ? "bg-rose-500/10 border-rose-500/30"
                          : "bg-amber-500/10 border-amber-500/30"
                      )}
                    >
                      <p className="text-xs font-medium flex items-center gap-1">
                        <span>{c.emoji}</span>
                        <span className={isOver ? "text-rose-400" : "text-amber-400"}>
                          {c.name}
                        </span>
                      </p>
                      <p className="text-xs text-fg-secondary mt-1">
                        {ratio}% of monthly budget
                      </p>
                      <p className={cn("text-xs mt-0.5", isOver ? "text-rose-400" : "text-amber-400")}>
                        {isOver
                          ? `Over by ${fmt(c.currentMonth - c.monthlyBudget)}`
                          : `${fmt(c.monthlyBudget - c.currentMonth)} remaining`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-tok-border">
              <p className="text-xs text-fg-muted mb-2">Overall Health</p>
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", barColor(burnRate))}
                  style={{ width: `${Math.min(burnRate, 100)}%` }}
                />
              </div>
              <p className={cn("text-xs mt-1", statusColor(burnRate))}>
                {burnRate}% burn rate
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
