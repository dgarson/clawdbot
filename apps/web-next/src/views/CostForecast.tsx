import React, { useState } from "react"
import { cn } from "../lib/utils"

type Category = "models" | "compute" | "storage" | "network"
type Scenario = "conservative" | "current" | "aggressive"

interface CostItem {
  name: string
  category: Category
  monthlyCost: number
  percentOfTotal: number
  momChange: number
}

interface MonthData {
  label: string
  actual: boolean
  costs: Record<Category, number>
}

interface Optimization {
  title: string
  savings: number
  description: string
}

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: "models", label: "Models (LLM API)", color: "bg-indigo-500" },
  { key: "compute", label: "Compute", color: "bg-sky-500" },
  { key: "storage", label: "Storage", color: "bg-emerald-500" },
  { key: "network", label: "Network", color: "bg-amber-500" },
]

const SCENARIO_LABELS: Record<Scenario, string> = {
  conservative: "Conservative",
  current: "Current Trend",
  aggressive: "Aggressive Growth",
}

const SCENARIO_MULTIPLIERS: Record<Scenario, number> = {
  conservative: 1.03,
  current: 1.08,
  aggressive: 1.18,
}

const MONTH_LABELS = [
  "Sep", "Oct", "Nov", "Dec", "Jan", "Feb",
  "Mar", "Apr", "May", "Jun", "Jul", "Aug",
]

function buildActualData(): MonthData[] {
  const base = { models: 2800, compute: 1600, storage: 420, network: 310 }
  const growthFactors = [0.82, 0.87, 0.91, 0.95, 0.97, 1.0]
  return growthFactors.map((f, i) => ({
    label: MONTH_LABELS[i],
    actual: true,
    costs: {
      models: Math.round(base.models * f),
      compute: Math.round(base.compute * f),
      storage: Math.round(base.storage * f),
      network: Math.round(base.network * f),
    },
  }))
}

function buildProjectedData(scenario: Scenario): MonthData[] {
  const mult = SCENARIO_MULTIPLIERS[scenario]
  const lastActual = { models: 2800, compute: 1600, storage: 420, network: 310 }
  return Array.from({ length: 6 }, (_, i) => {
    const factor = Math.pow(mult, i + 1)
    return {
      label: MONTH_LABELS[i + 6],
      actual: false,
      costs: {
        models: Math.round(lastActual.models * factor),
        compute: Math.round(lastActual.compute * factor),
        storage: Math.round(lastActual.storage * factor),
        network: Math.round(lastActual.network * factor),
      },
    }
  })
}

const COST_DRIVERS: CostItem[] = [
  { name: "Claude Opus 4", category: "models", monthlyCost: 1240, percentOfTotal: 24.2, momChange: 12.3 },
  { name: "GPT-4o Turbo", category: "models", monthlyCost: 860, percentOfTotal: 16.8, momChange: 5.1 },
  { name: "GPU Cluster A100", category: "compute", monthlyCost: 720, percentOfTotal: 14.0, momChange: 8.7 },
  { name: "Claude Sonnet 4", category: "models", monthlyCost: 480, percentOfTotal: 9.4, momChange: -2.1 },
  { name: "Edge Inference Pods", category: "compute", monthlyCost: 440, percentOfTotal: 8.6, momChange: 15.4 },
  { name: "Vector DB Storage", category: "storage", monthlyCost: 280, percentOfTotal: 5.5, momChange: 3.2 },
  { name: "Embedding Pipeline", category: "compute", monthlyCost: 260, percentOfTotal: 5.1, momChange: 22.0 },
  { name: "CDN Egress", category: "network", monthlyCost: 210, percentOfTotal: 4.1, momChange: -1.4 },
  { name: "Model Cache Layer", category: "storage", monthlyCost: 140, percentOfTotal: 2.7, momChange: 0.0 },
  { name: "API Gateway Traffic", category: "network", monthlyCost: 100, percentOfTotal: 1.9, momChange: 6.8 },
]

const OPTIMIZATIONS: Optimization[] = [
  { title: "Switch to Gemini Flash for low-complexity tasks", savings: 120, description: "Route simple classification and extraction to Gemini Flash instead of Opus" },
  { title: "Enable prompt caching on Claude Sonnet", savings: 85, description: "Activate prompt caching for repeated system prompts across sessions" },
  { title: "Consolidate vector DB indexes", savings: 60, description: "Merge 3 overlapping indexes into a single optimized schema" },
  { title: "Right-size GPU cluster during off-peak", savings: 190, description: "Scale A100 pods to 40% capacity between 11PM-7AM UTC" },
  { title: "Compress CDN assets with Brotli", savings: 45, description: "Switch from gzip to Brotli for static asset delivery" },
]

const MONTHLY_BUDGET = 6200

function getTierColor(total: number): string {
  if (total < 4000) {return "bg-emerald-500"}
  if (total < 5500) {return "bg-yellow-500"}
  if (total < 7000) {return "bg-orange-500"}
  return "bg-red-500"
}

function getMonthTotal(m: MonthData, visibleCategories: Set<Category>): number {
  return CATEGORIES.reduce(
    (sum, c) => sum + (visibleCategories.has(c.key) ? m.costs[c.key] : 0),
    0
  )
}

function formatCurrency(n: number): string {
  return "$" + n.toLocaleString("en-US")
}

export default function CostForecast() {
  const [scenario, setScenario] = useState<Scenario>("current")
  const [showProjections, setShowProjections] = useState(true)
  const [visibleCategories, setVisibleCategories] = useState<Set<Category>>(
    new Set<Category>(["models", "compute", "storage", "network"])
  )

  const actualData = buildActualData()
  const projectedData = buildProjectedData(scenario)
  const allMonths = showProjections ? [...actualData, ...projectedData] : actualData

  const currentMonth = actualData[actualData.length - 1]
  const currentTotal = getMonthTotal(currentMonth, new Set<Category>(["models", "compute", "storage", "network"]))
  const budgetPercent = Math.min((currentTotal / MONTHLY_BUDGET) * 100, 100)
  const overBudget = currentTotal > MONTHLY_BUDGET

  const q3Months = projectedData.slice(3, 6)
  const q3Total = q3Months.reduce(
    (sum, m) => sum + getMonthTotal(m, new Set<Category>(["models", "compute", "storage", "network"])),
    0
  )
  const q3Budget = MONTHLY_BUDGET * 3
  const q3Exceeds = q3Total > q3Budget

  const maxBarValue = Math.max(...allMonths.map((m) => getMonthTotal(m, visibleCategories)), 1)

  const toggleCategory = (cat: Category) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        if (next.size > 1) {next.delete(cat)}
      } else {
        next.add(cat)
      }
      return next
    })
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cost Forecast</h1>
          <p className="text-zinc-400 text-sm mt-1">AI infrastructure spend analysis and projections</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
            <button
              onClick={() => setShowProjections((p) => !p)}
              className={cn(
                "w-9 h-5 rounded-full relative transition-colors",
                showProjections ? "bg-indigo-500" : "bg-zinc-700"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                  showProjections ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
            Projections
          </label>
        </div>
      </div>

      {q3Exceeds && showProjections && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-amber-400 text-lg">⚠</span>
          <div>
            <p className="text-amber-300 text-sm font-medium">
              Projected Q3 spend ({formatCurrency(q3Total)}) exceeds quarterly budget ({formatCurrency(q3Budget)})
            </p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Consider adjusting scenario or reviewing optimization opportunities below
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Current Month Spend</p>
          <p className="text-4xl font-bold tracking-tight">{formatCurrency(currentTotal)}</p>
          <p className="text-zinc-500 text-xs mt-1">February 2026</p>
          <div className="mt-4 space-y-2">
            {CATEGORIES.map((c) => (
              <div key={c.key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2.5 h-2.5 rounded-full", c.color)} />
                  <span className="text-zinc-300">{c.label}</span>
                </div>
                <span className="text-zinc-100 font-medium tabular-nums">
                  {formatCurrency(currentMonth.costs[c.key])}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-3 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-zinc-400 text-xs uppercase tracking-wider">Budget vs Actual</p>
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              overBudget ? "bg-red-500/20 text-red-400" : budgetPercent >= 80 ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
            )}>
              {Math.round(budgetPercent)}%
            </span>
          </div>
          <p className="text-sm text-zinc-300 mb-3">
            {formatCurrency(currentTotal)} of {formatCurrency(MONTHLY_BUDGET)} budget
          </p>
          <div className="relative h-4 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                overBudget ? "bg-red-500" : budgetPercent >= 80 ? "bg-amber-500" : "bg-indigo-500"
              )}
              style={{ width: `${budgetPercent}%` }}
            />
            <div className="absolute top-0 left-[80%] w-px h-full bg-amber-500/50" />
            <div className="absolute top-0 left-full w-px h-full bg-red-500/50" />
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>$0</span>
            <span className="text-amber-500/70">80%</span>
            <span>{formatCurrency(MONTHLY_BUDGET)}</span>
          </div>

          <div className="mt-5">
            <p className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Category Filters</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const active = visibleCategories.has(c.key)
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleCategory(c.key)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors",
                      active
                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                        : "border-zinc-700 bg-zinc-800 text-zinc-500"
                    )}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-zinc-200">12-Month Forecast</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {showProjections ? "6 months actual + 6 months projected" : "6 months actual"}
            </p>
          </div>
          {showProjections && (
            <div className="flex bg-zinc-800 rounded-lg p-0.5">
              {(Object.keys(SCENARIO_LABELS) as Scenario[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-md transition-colors",
                    scenario === s
                      ? "bg-indigo-500 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {SCENARIO_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-end gap-1.5 h-48">
          {allMonths.map((m, i) => {
            const total = getMonthTotal(m, visibleCategories)
            const heightPct = maxBarValue > 0 ? (total / maxBarValue) * 100 : 0
            const tierColor = getTierColor(total)
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-zinc-500 tabular-nums">{formatCurrency(total)}</span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={cn(
                      "w-full rounded-t transition-all",
                      tierColor,
                      m.actual ? "opacity-100" : "opacity-40"
                    )}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className={cn(
                  "text-[10px]",
                  m.actual ? "text-zinc-300" : "text-zinc-600"
                )}>
                  {m.label}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-3 h-3 rounded-sm bg-zinc-400" />
            Actual
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-3 h-3 rounded-sm bg-zinc-400 opacity-40" />
            Projected
          </div>
          <div className="ml-auto flex items-center gap-3 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{"<$4k"}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />{"<$5.5k"}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />{"<$7k"}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{"$7k+"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-sm font-medium text-zinc-200 mb-3">Top Cost Drivers</p>
          <div className="overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 gap-y-0 text-xs text-zinc-500 uppercase tracking-wider pb-2 border-b border-zinc-800 mb-1">
              <span>Item</span>
              <span className="text-right">Category</span>
              <span className="text-right">Monthly</span>
              <span className="text-right">% Total</span>
              <span className="text-right">MoM</span>
            </div>
            {COST_DRIVERS.map((item, i) => {
              const catMeta = CATEGORIES.find((c) => c.key === item.category)
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center py-2 border-b border-zinc-800/50 text-sm"
                >
                  <span className="text-zinc-200 truncate">{item.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span className={cn("w-1.5 h-1.5 rounded-full", catMeta?.color ?? "bg-zinc-600")} />
                    {catMeta?.label ?? item.category}
                  </span>
                  <span className="text-right text-zinc-100 tabular-nums font-medium">
                    {formatCurrency(item.monthlyCost)}
                  </span>
                  <span className="text-right text-zinc-400 tabular-nums">{item.percentOfTotal}%</span>
                  <span
                    className={cn(
                      "text-right tabular-nums text-xs font-medium",
                      item.momChange > 0
                        ? "text-red-400"
                        : item.momChange < 0
                        ? "text-emerald-400"
                        : "text-zinc-500"
                    )}
                  >
                    {item.momChange > 0 ? "↑" : item.momChange < 0 ? "↓" : "—"}
                    {item.momChange !== 0 ? ` ${Math.abs(item.momChange)}%` : ""}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-sm font-medium text-zinc-200 mb-1">Optimization Opportunities</p>
          <p className="text-xs text-zinc-500 mb-3">
            Potential savings: {formatCurrency(OPTIMIZATIONS.reduce((s, o) => s + o.savings, 0))}/mo
          </p>
          <div className="space-y-3">
            {OPTIMIZATIONS.map((opt, i) => (
              <div key={i} className="border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-zinc-200 font-medium leading-snug">{opt.title}</p>
                  <span className="shrink-0 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    -{formatCurrency(opt.savings)}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{opt.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-zinc-600 py-2">
        Last updated: Feb 22, 2026 · Data refreshes daily
      </div>
    </div>
  )
}
