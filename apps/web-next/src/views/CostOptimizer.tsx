import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CostCategory =
  | "model-inference"
  | "storage"
  | "compute"
  | "network"
  | "agent-sessions";

type OptimizationStatus = "pending" | "applied" | "dismissed";

interface CostEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  category: CostCategory;
  agent: string;
  model: string;
  tokens: number;
  cost: number; // USD cents
}

interface Optimization {
  id: string;
  title: string;
  description: string;
  category: CostCategory;
  estimatedSavings: number; // USD cents/month
  effort: "low" | "medium" | "high";
  status: OptimizationStatus;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<CostCategory, string> = {
  "model-inference": "Model Inference",
  storage: "Storage",
  compute: "Compute",
  network: "Network",
  "agent-sessions": "Agent Sessions",
};

const CATEGORY_COLORS: Record<CostCategory, string> = {
  "model-inference": "bg-indigo-500",
  storage: "bg-emerald-400",
  compute: "bg-amber-400",
  network: "bg-sky-400",
  "agent-sessions": "bg-rose-400",
};

const CATEGORY_TEXT_COLORS: Record<CostCategory, string> = {
  "model-inference": "text-indigo-400",
  storage: "text-emerald-400",
  compute: "text-amber-400",
  network: "text-sky-400",
  "agent-sessions": "text-rose-400",
};

const EFFORT_STYLES: Record<
  Optimization["effort"],
  { bg: string; text: string; label: string }
> = {
  low: { bg: "bg-emerald-400/15", text: "text-emerald-400", label: "Low" },
  medium: { bg: "bg-amber-400/15", text: "text-amber-400", label: "Medium" },
  high: { bg: "bg-rose-400/15", text: "text-rose-400", label: "High" },
};

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

const INITIAL_COST_ENTRIES: CostEntry[] = [
  { id: "ce-01", date: "2026-02-09", category: "model-inference", agent: "Luis", model: "Claude Opus", tokens: 48200, cost: 380 },
  { id: "ce-02", date: "2026-02-10", category: "model-inference", agent: "Xavier", model: "Claude Sonnet", tokens: 31400, cost: 145 },
  { id: "ce-03", date: "2026-02-11", category: "compute", agent: "Piper", model: "GPT-4o", tokens: 22600, cost: 198 },
  { id: "ce-04", date: "2026-02-12", category: "storage", agent: "Reed", model: "Gemini Flash", tokens: 8500, cost: 42 },
  { id: "ce-05", date: "2026-02-13", category: "network", agent: "Luis", model: "Claude Sonnet", tokens: 5200, cost: 28 },
  { id: "ce-06", date: "2026-02-14", category: "agent-sessions", agent: "Xavier", model: "Claude Opus", tokens: 41800, cost: 310 },
  { id: "ce-07", date: "2026-02-15", category: "model-inference", agent: "Piper", model: "GPT-4o", tokens: 18900, cost: 165 },
  { id: "ce-08", date: "2026-02-16", category: "compute", agent: "Luis", model: "Gemini Flash", tokens: 12300, cost: 56 },
  { id: "ce-09", date: "2026-02-17", category: "storage", agent: "Reed", model: "Claude Sonnet", tokens: 3100, cost: 12 },
  { id: "ce-10", date: "2026-02-18", category: "model-inference", agent: "Xavier", model: "Claude Opus", tokens: 52700, cost: 372 },
  { id: "ce-11", date: "2026-02-19", category: "agent-sessions", agent: "Piper", model: "GPT-4o", tokens: 26400, cost: 224 },
  { id: "ce-12", date: "2026-02-20", category: "network", agent: "Reed", model: "Gemini Flash", tokens: 7800, cost: 18 },
];

const INITIAL_OPTIMIZATIONS: Optimization[] = [
  { id: "opt-01", title: "Switch from Opus to Sonnet for routine tasks", description: "Opus is used for simple summarization and formatting tasks where Sonnet delivers equivalent quality at ~60% lower cost.", category: "model-inference", estimatedSavings: 4200, effort: "low", status: "pending" },
  { id: "opt-02", title: "Enable response caching for repeated prompts", description: "Approximately 18% of prompts are near-duplicates. A semantic cache layer would eliminate redundant inference calls.", category: "compute", estimatedSavings: 1800, effort: "medium", status: "pending" },
  { id: "opt-03", title: "Reduce session history retention to 7 days", description: "Current 30-day retention stores conversation history rarely accessed after the first week. Reducing to 7 days cuts storage costs significantly.", category: "storage", estimatedSavings: 950, effort: "low", status: "pending" },
  { id: "opt-04", title: "Batch webhook deliveries", description: "Webhooks currently fire individually. Batching into 5-second windows reduces network overhead and egress charges.", category: "network", estimatedSavings: 420, effort: "low", status: "pending" },
  { id: "opt-05", title: "Limit concurrent agent sessions to 5", description: "Unbounded concurrency leads to resource contention and higher peak compute costs. A pool of 5 concurrent sessions smooths load.", category: "agent-sessions", estimatedSavings: 2100, effort: "medium", status: "pending" },
  { id: "opt-06", title: "Archive inactive knowledge base entries", description: "Move knowledge base entries with zero hits in 90 days to cold storage, reducing active storage footprint.", category: "storage", estimatedSavings: 680, effort: "low", status: "pending" },
  { id: "opt-07", title: "Use streaming for long responses", description: "Streaming responses instead of buffering reduces memory pressure and allows early connection release, lowering per-request inference cost.", category: "model-inference", estimatedSavings: 1100, effort: "high", status: "pending" },
  { id: "opt-08", title: "Consolidate cron jobs during off-peak hours", description: "Scheduling batch jobs between 2–5 AM leverages lower spot-instance pricing and reduces daytime resource contention.", category: "compute", estimatedSavings: 350, effort: "medium", status: "pending" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function centsToUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function pct(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}

function KpiCard({ label, value, sub, subColor }: KpiCardProps) {
  return (
    <div className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{value}</p>
      {sub && (
        <p className={cn("mt-0.5 text-sm", subColor ?? "text-[var(--color-text-secondary)]")}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type TabId = "analysis" | "recommendations";
type StatusFilter = "all" | OptimizationStatus;
type EffortFilter = "all" | Optimization["effort"];

export default function CostOptimizer() {
  const [activeTab, setActiveTab] = useState<TabId>("analysis");
  const [optimizations, setOptimizations] = useState<Optimization[]>(
    INITIAL_OPTIMIZATIONS
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [effortFilter, setEffortFilter] = useState<EffortFilter>("all");

  // ---- Derived data -------------------------------------------------------

  const costEntries = INITIAL_COST_ENTRIES;

  const totalCostCents = useMemo(
    () => costEntries.reduce((s, e) => s + e.cost, 0),
    [costEntries]
  );

  // Simulate "last month" as 85% of current to show a positive delta
  const lastMonthCents = useMemo(
    () => Math.round(totalCostCents * 0.85),
    [totalCostCents]
  );
  const deltaPct = useMemo(
    () =>
      lastMonthCents === 0
        ? 0
        : Math.round(((totalCostCents - lastMonthCents) / lastMonthCents) * 100),
    [totalCostCents, lastMonthCents]
  );

  const topSpender = useMemo(() => {
    const map = new Map<string, number>();
    costEntries.forEach((e) => map.set(e.agent, (map.get(e.agent) ?? 0) + e.cost));
    let best = "";
    let max = 0;
    map.forEach((v, k) => {
      if (v > max) {
        max = v;
        best = k;
      }
    });
    return best;
  }, [costEntries]);

  const projectedSavings = useMemo(
    () =>
      optimizations
        .filter((o) => o.status !== "dismissed")
        .reduce((s, o) => s + o.estimatedSavings, 0),
    [optimizations]
  );

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<CostCategory, number>();
    costEntries.forEach((e) =>
      map.set(e.category, (map.get(e.category) ?? 0) + e.cost)
    );
    const entries = Array.from(map.entries()).toSorted((a, b) => b[1] - a[1]);
    return entries.map(([cat, cost]) => ({
      category: cat,
      cost,
      pct: pct(cost, totalCostCents),
    }));
  }, [costEntries, totalCostCents]);

  // 7-day trend
  const sevenDayTrend = useMemo(() => {
    const today = new Date("2026-02-22");
    const days: { date: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const total = costEntries
        .filter((e) => e.date === iso)
        .reduce((s, e) => s + e.cost, 0);
      days.push({ date: iso, total });
    }
    return days;
  }, [costEntries]);

  const maxDayCost = useMemo(
    () => Math.max(...sevenDayTrend.map((d) => d.total), 1),
    [sevenDayTrend]
  );

  // Agent table
  const agentRows = useMemo(() => {
    const map = new Map<string, { tokens: number; cost: number }>();
    costEntries.forEach((e) => {
      const prev = map.get(e.agent) ?? { tokens: 0, cost: 0 };
      map.set(e.agent, {
        tokens: prev.tokens + e.tokens,
        cost: prev.cost + e.cost,
      });
    });
    return Array.from(map.entries())
      .map(([agent, data]) => ({
        agent,
        ...data,
        pct: pct(data.cost, totalCostCents),
      }))
      .toSorted((a, b) => b.cost - a.cost);
  }, [costEntries, totalCostCents]);

  // Filtered optimizations
  const filteredOptimizations = useMemo(
    () =>
      optimizations.filter((o) => {
        if (statusFilter !== "all" && o.status !== statusFilter) {return false;}
        if (effortFilter !== "all" && o.effort !== effortFilter) {return false;}
        return true;
      }),
    [optimizations, statusFilter, effortFilter]
  );

  const appliedSummary = useMemo(() => {
    const applied = optimizations.filter((o) => o.status === "applied");
    return {
      count: applied.length,
      savings: applied.reduce((s, o) => s + o.estimatedSavings, 0),
    };
  }, [optimizations]);

  // ---- Handlers -----------------------------------------------------------

  function handleApply(id: string) {
    setOptimizations((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "applied" as const } : o))
    );
  }

  function handleDismiss(id: string) {
    setOptimizations((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, status: "dismissed" as const } : o
      )
    );
  }

  // ---- Render helpers -----------------------------------------------------

  const TAB_ITEMS: { id: TabId; label: string }[] = [
    { id: "analysis", label: "Analysis" },
    { id: "recommendations", label: "Recommendations" },
  ];

  const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "applied", label: "Applied" },
    { value: "dismissed", label: "Dismissed" },
  ];

  const EFFORT_CHIPS: { value: EffortFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ];

  // ---- JSX ----------------------------------------------------------------

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* KPI Row */}
      <div className="flex flex-wrap gap-4 p-6 pb-0">
        <KpiCard
          label="Total This Month"
          value={centsToUsd(totalCostCents)}
        />
        <KpiCard
          label="vs Last Month"
          value={`${deltaPct >= 0 ? "+" : ""}${deltaPct}%`}
          sub={`Last month: ${centsToUsd(lastMonthCents)}`}
          subColor={deltaPct > 0 ? "text-rose-400" : "text-emerald-400"}
        />
        <KpiCard label="Top Spender" value={topSpender} sub="By total cost" />
        <KpiCard
          label="Projected Savings"
          value={centsToUsd(projectedSavings)}
          sub="If all pending applied"
          subColor="text-emerald-400"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)] px-6 pt-6">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={cn(
              "rounded-t-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              activeTab === tab.id
                ? "bg-[var(--color-surface-1)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "analysis" && (
          <div
            id="panel-analysis"
            role="tabpanel"
            aria-label="Analysis panel"
            className="space-y-8"
          >
            {/* Category Breakdown */}
            <section aria-label="Cost breakdown by category">
              <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                Category Breakdown
              </h2>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
                <div className="space-y-3">
                  {categoryBreakdown.map(({ category, cost, pct: p }) => (
                    <div key={category}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className={CATEGORY_TEXT_COLORS[category]}>
                          {CATEGORY_LABELS[category]}
                        </span>
                        <span className="text-[var(--color-text-primary)]">
                          {centsToUsd(cost)} ({p}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-[var(--color-surface-2)]">
                        <div
                          className={cn(
                            "h-2.5 rounded-full transition-all",
                            CATEGORY_COLORS[category]
                          )}
                          style={{ width: `${p}%` }}
                          role="meter"
                          aria-valuenow={p}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${CATEGORY_LABELS[category]}: ${p}%`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-right text-sm font-medium text-[var(--color-text-primary)]">
                  Total: {centsToUsd(totalCostCents)}
                </p>
              </div>
            </section>

            {/* 7-Day Cost Trend */}
            <section aria-label="7-day cost trend">
              <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                7-Day Cost Trend
              </h2>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
                <div className="flex items-end gap-2" style={{ height: 160 }}>
                  {sevenDayTrend.map(({ date, total }) => {
                    const heightPct =
                      maxDayCost === 0 ? 0 : (total / maxDayCost) * 100;
                    const dayLabel = date.slice(5); // MM-DD
                    return (
                      <div
                        key={date}
                        className="flex flex-1 flex-col items-center justify-end"
                        style={{ height: "100%" }}
                      >
                        <span className="mb-1 text-xs text-[var(--color-text-secondary)]">
                          {total > 0 ? centsToUsd(total) : "—"}
                        </span>
                        <div
                          className={cn(
                            "w-full max-w-[40px] rounded-t bg-indigo-500 transition-all",
                            total === 0 && "bg-[var(--color-surface-3)]"
                          )}
                          style={{
                            height: `${Math.max(heightPct, total > 0 ? 4 : 1)}%`,
                          }}
                          role="meter"
                          aria-valuenow={total}
                          aria-valuemin={0}
                          aria-valuemax={maxDayCost}
                          aria-label={`${date}: ${centsToUsd(total)}`}
                        />
                        <span className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                          {dayLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Agent Cost Table */}
            <section aria-label="Agent cost breakdown">
              <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                Cost by Agent
              </h2>
              <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/80">
                      <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                        Agent
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                        Tokens
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                        Cost
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                        % of Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentRows.map((row) => (
                      <tr
                        key={row.agent}
                        className="border-b border-[var(--color-border)]/60 bg-[var(--color-surface-1)] last:border-b-0"
                      >
                        <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                          {row.agent}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                          {row.tokens.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                          {centsToUsd(row.cost)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                          {row.pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === "recommendations" && (
          <div
            id="panel-recommendations"
            role="tabpanel"
            aria-label="Recommendations panel"
            className="space-y-6"
          >
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                Status
              </span>
              {STATUS_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  aria-pressed={statusFilter === chip.value}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    statusFilter === chip.value
                      ? "bg-indigo-500 text-[var(--color-text-primary)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )}
                  onClick={() => setStatusFilter(chip.value)}
                >
                  {chip.label}
                </button>
              ))}
              <span className="ml-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                Effort
              </span>
              {EFFORT_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  aria-pressed={effortFilter === chip.value}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    effortFilter === chip.value
                      ? "bg-indigo-500 text-[var(--color-text-primary)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )}
                  onClick={() => setEffortFilter(chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Cards */}
            <div className="space-y-4">
              {filteredOptimizations.length === 0 && (
                <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                  No optimizations match the current filters.
                </p>
              )}
              {filteredOptimizations.map((opt) => {
                const isDismissed = opt.status === "dismissed";
                const isApplied = opt.status === "applied";
                const effortStyle = EFFORT_STYLES[opt.effort];

                return (
                  <div
                    key={opt.id}
                    className={cn(
                      "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 transition-opacity",
                      isDismissed && "opacity-50"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={cn(
                              "text-base font-semibold",
                              isDismissed
                                ? "text-[var(--color-text-muted)] line-through"
                                : "text-[var(--color-text-primary)]"
                            )}
                          >
                            {isApplied && (
                              <span
                                className="mr-1.5 inline-block text-emerald-400"
                                aria-label="Applied"
                              >
                                ✓
                              </span>
                            )}
                            {opt.title}
                          </h3>
                        </div>
                        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                          {opt.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {/* Category badge */}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs font-medium",
                              CATEGORY_TEXT_COLORS[opt.category]
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-1.5 w-1.5 rounded-full",
                                CATEGORY_COLORS[opt.category]
                              )}
                            />
                            {CATEGORY_LABELS[opt.category]}
                          </span>
                          {/* Effort badge */}
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-medium",
                              effortStyle.bg,
                              effortStyle.text
                            )}
                          >
                            {effortStyle.label} effort
                          </span>
                        </div>
                      </div>

                      {/* Savings + Actions */}
                      <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                          <p className="text-2xl font-bold tabular-nums text-emerald-400">
                            {centsToUsd(opt.estimatedSavings)}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            savings / month
                          </p>
                        </div>
                        {opt.status === "pending" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApply(opt.id)}
                              aria-label={`Apply optimization: ${opt.title}`}
                              className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                            >
                              Apply
                            </button>
                            <button
                              onClick={() => handleDismiss(opt.id)}
                              aria-label={`Dismiss optimization: ${opt.title}`}
                              className="rounded-md bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                        {isApplied && (
                          <span className="text-xs font-medium text-emerald-400">
                            Applied
                          </span>
                        )}
                        {isDismissed && (
                          <span className="text-xs font-medium text-[var(--color-text-muted)]">
                            Dismissed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Footer */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)]/50 px-5 py-3 text-center text-sm text-[var(--color-text-secondary)]">
              <span className="font-medium text-[var(--color-text-primary)]">
                {appliedSummary.count}
              </span>{" "}
              optimization{appliedSummary.count !== 1 ? "s" : ""} applied,
              saving{" "}
              <span className="font-medium text-emerald-400">
                {centsToUsd(appliedSummary.savings)}/month
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
