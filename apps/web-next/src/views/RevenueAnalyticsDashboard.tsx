import React, { useState } from "react"
import { cn } from "../lib/utils"

type PlanTier = "free" | "starter" | "pro" | "enterprise"
type MetricPeriod = "mtd" | "qtd" | "ytd" | "custom"

interface RevenueMetric {
  month: string
  mrr: number
  newMrr: number
  expansionMrr: number
  contractionMrr: number
  churnMrr: number
  arr: number
  customers: number
  arpu: number
}

interface PlanRevenue {
  plan: PlanTier
  customers: number
  mrr: number
  arr: number
  avgContractValue: number
  churnRate: number
  growthRate: number
}

interface CohortRetention {
  cohort: string
  month0: number
  month1: number
  month2: number
  month3: number
  month6: number
  month12: number
}

interface TopCustomer {
  id: string
  name: string
  plan: PlanTier
  arr: number
  contractStart: string
  renewalDate: string
  expansionPotential: number
  healthScore: number
  trend: "up" | "down" | "flat"
}

const MONTHLY_METRICS: RevenueMetric[] = [
  { month: "Mar '25", mrr: 182400, newMrr: 24200, expansionMrr: 8400, contractionMrr: -3200, churnMrr: -6800, arr: 2188800, customers: 421, arpu: 433 },
  { month: "Apr '25", mrr: 205000, newMrr: 26800, expansionMrr: 9200, contractionMrr: -2800, churnMrr: -10600, arr: 2460000, customers: 448, arpu: 458 },
  { month: "May '25", mrr: 231400, newMrr: 31200, expansionMrr: 11000, contractionMrr: -3400, churnMrr: -12400, arr: 2776800, customers: 489, arpu: 473 },
  { month: "Jun '25", mrr: 258800, newMrr: 34400, expansionMrr: 12600, contractionMrr: -3200, churnMrr: -16400, arr: 3105600, customers: 527, arpu: 491 },
  { month: "Jul '25", mrr: 289200, newMrr: 38000, expansionMrr: 14200, contractionMrr: -4400, churnMrr: -17400, arr: 3470400, customers: 571, arpu: 507 },
  { month: "Aug '25", mrr: 321800, newMrr: 42200, expansionMrr: 16000, contractionMrr: -4800, churnMrr: -20800, arr: 3861600, customers: 618, arpu: 520 },
  { month: "Sep '25", mrr: 356400, newMrr: 46000, expansionMrr: 17400, contractionMrr: -5600, churnMrr: -23200, arr: 4276800, customers: 669, arpu: 533 },
  { month: "Oct '25", mrr: 392600, newMrr: 50200, expansionMrr: 19000, contractionMrr: -6000, churnMrr: -27000, arr: 4711200, customers: 724, arpu: 542 },
  { month: "Nov '25", mrr: 432000, newMrr: 54400, expansionMrr: 21200, contractionMrr: -6600, churnMrr: -29600, arr: 5184000, customers: 781, arpu: 553 },
  { month: "Dec '25", mrr: 474000, newMrr: 57600, expansionMrr: 23400, contractionMrr: -7000, churnMrr: -31600, arr: 5688000, customers: 841, arpu: 563 },
  { month: "Jan '26", mrr: 518200, newMrr: 62400, expansionMrr: 26000, contractionMrr: -7400, churnMrr: -35000, arr: 6218400, customers: 906, arpu: 572 },
  { month: "Feb '26", mrr: 564800, newMrr: 67200, expansionMrr: 28400, contractionMrr: -8000, churnMrr: -40600, arr: 6777600, customers: 972, arpu: 581 },
]

const PLAN_REVENUE: PlanRevenue[] = [
  { plan: "enterprise", customers: 42, mrr: 294000, arr: 3528000, avgContractValue: 84000, churnRate: 2.1, growthRate: 28.4 },
  { plan: "pro", customers: 318, mrr: 196400, arr: 2356800, avgContractValue: 7420, churnRate: 4.8, growthRate: 22.1 },
  { plan: "starter", customers: 612, mrr: 74400, arr: 892800, avgContractValue: 1462, churnRate: 8.2, growthRate: 18.6 },
  { plan: "free", customers: 8240, mrr: 0, arr: 0, avgContractValue: 0, churnRate: 31.4, growthRate: 15.0 },
]

const COHORT_RETENTION: CohortRetention[] = [
  { cohort: "Feb '25", month0: 100, month1: 84, month2: 78, month3: 74, month6: 68, month12: 61 },
  { cohort: "Apr '25", month0: 100, month1: 85, month2: 80, month3: 76, month6: 70, month12: 0 },
  { cohort: "Jun '25", month0: 100, month1: 86, month2: 81, month3: 77, month6: 72, month12: 0 },
  { cohort: "Aug '25", month0: 100, month1: 87, month2: 82, month3: 78, month6: 0, month12: 0 },
  { cohort: "Oct '25", month0: 100, month1: 88, month2: 83, month3: 0, month6: 0, month12: 0 },
  { cohort: "Dec '25", month0: 100, month1: 89, month2: 0, month3: 0, month6: 0, month12: 0 },
]

const TOP_CUSTOMERS: TopCustomer[] = [
  { id: "c-001", name: "Acme Corp", plan: "enterprise", arr: 480000, contractStart: "2024-03-01", renewalDate: "2027-03-01", expansionPotential: 120000, healthScore: 94, trend: "up" },
  { id: "c-002", name: "TechVentures Inc", plan: "enterprise", arr: 360000, contractStart: "2024-06-15", renewalDate: "2026-06-15", expansionPotential: 80000, healthScore: 88, trend: "up" },
  { id: "c-003", name: "GlobalOps Ltd", plan: "enterprise", arr: 312000, contractStart: "2025-01-01", renewalDate: "2027-01-01", expansionPotential: 60000, healthScore: 82, trend: "flat" },
  { id: "c-004", name: "DataFlow Systems", plan: "enterprise", arr: 264000, contractStart: "2024-09-01", renewalDate: "2026-09-01", expansionPotential: 40000, healthScore: 71, trend: "down" },
  { id: "c-005", name: "CloudNative Co", plan: "pro", arr: 96000, contractStart: "2025-04-01", renewalDate: "2026-04-01", expansionPotential: 120000, healthScore: 91, trend: "up" },
  { id: "c-006", name: "DevOps United", plan: "pro", arr: 84000, contractStart: "2025-02-15", renewalDate: "2026-02-15", expansionPotential: 96000, healthScore: 87, trend: "up" },
  { id: "c-007", name: "Apex Analytics", plan: "enterprise", arr: 240000, contractStart: "2024-11-01", renewalDate: "2026-11-01", expansionPotential: 0, healthScore: 64, trend: "down" },
  { id: "c-008", name: "ScaleUp Labs", plan: "pro", arr: 72000, contractStart: "2025-06-01", renewalDate: "2026-06-01", expansionPotential: 48000, healthScore: 79, trend: "flat" },
]

const planColor: Record<PlanTier, string> = {
  free: "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10",
  starter: "text-blue-400 bg-blue-400/10",
  pro: "text-primary bg-primary/10",
  enterprise: "text-amber-400 bg-amber-400/10",
}

function fmtMoney(n: number): string {
  if (n >= 1000000) {return `$${(n / 1000000).toFixed(2)}M`}
  if (n >= 1000) {return `$${(n / 1000).toFixed(0)}K`}
  return `$${n}`
}

function retentionColor(pct: number): string {
  if (pct === 0) {return "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"}
  if (pct >= 80) {return "bg-emerald-500/80 text-[var(--color-text-primary)]"}
  if (pct >= 70) {return "bg-emerald-600/60 text-emerald-100"}
  if (pct >= 60) {return "bg-amber-500/60 text-amber-100"}
  return "bg-rose-500/60 text-rose-100"
}

export default function RevenueAnalyticsDashboard() {
  const [tab, setTab] = useState<"mrr" | "plans" | "retention" | "customers">("mrr")
  const [period, setPeriod] = useState<MetricPeriod>("ytd")
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)

  const tabs = [
    { id: "mrr" as const, label: "MRR / ARR", emoji: "💰" },
    { id: "plans" as const, label: "By Plan", emoji: "📊" },
    { id: "retention" as const, label: "Retention", emoji: "🔁" },
    { id: "customers" as const, label: "Top Accounts", emoji: "🏆" },
  ]

  const latestMonth = MONTHLY_METRICS[MONTHLY_METRICS.length - 1]
  const prevMonth = MONTHLY_METRICS[MONTHLY_METRICS.length - 2]
  const mrrGrowth = (((latestMonth.mrr - prevMonth.mrr) / prevMonth.mrr) * 100).toFixed(1)

  const maxMrr = Math.max(...MONTHLY_METRICS.map(m => m.mrr))

  // Net MRR components for waterfall-style chart
  const netMrrComponents = [
    { label: "New", value: latestMonth.newMrr, color: "bg-primary" },
    { label: "Expansion", value: latestMonth.expansionMrr, color: "bg-emerald-500" },
    { label: "Contraction", value: latestMonth.contractionMrr, color: "bg-amber-500" },
    { label: "Churn", value: latestMonth.churnMrr, color: "bg-rose-500" },
  ]
  const maxComponent = Math.max(...netMrrComponents.map(c => Math.abs(c.value)))

  const customer = selectedCustomer ? TOP_CUSTOMERS.find(c => c.id === selectedCustomer) : null

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Revenue Analytics</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">MRR, ARR, churn, retention, and plan performance</p>
        </div>
        <div className="flex gap-2">
          {(["mtd", "qtd", "ytd"] as MetricPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn("px-3 py-1.5 text-sm rounded-md transition-colors uppercase font-mono", period === p ? "bg-primary text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]")}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Current MRR</div>
          <div className="text-2xl font-bold text-primary">{fmtMoney(latestMonth.mrr)}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            <span className={parseFloat(mrrGrowth) > 0 ? "text-emerald-400" : "text-rose-400"}>
              {parseFloat(mrrGrowth) > 0 ? "↑" : "↓"} {Math.abs(parseFloat(mrrGrowth))}%
            </span> vs last month
          </div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">ARR</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{fmtMoney(latestMonth.arr)}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">annualized run rate</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Paying Customers</div>
          <div className="text-2xl font-bold text-emerald-400">{latestMonth.customers.toLocaleString()}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">ARPU: {fmtMoney(latestMonth.arpu)}/mo</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Net MRR Movement</div>
          <div className="text-2xl font-bold text-emerald-400">
            +{fmtMoney(latestMonth.newMrr + latestMonth.expansionMrr + latestMonth.contractionMrr + latestMonth.churnMrr)}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">this month</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              tab === t.id
                ? "border-primary text-[var(--color-text-primary)] bg-[var(--color-surface-1)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* MRR Tab */}
      {tab === "mrr" && (
        <div className="space-y-6">
          {/* MRR trend */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">MRR Growth Trend</h3>
            <div className="flex items-end gap-2 h-40">
              {MONTHLY_METRICS.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: "120px" }}>
                    <div
                      className="w-full bg-primary rounded-t-sm"
                      style={{ height: `${(m.mrr / maxMrr) * 120}px` }}
                    />
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] text-center" style={{ fontSize: "9px" }}>{m.month}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Net MRR movement */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Net MRR Movement — {latestMonth.month}</h3>
            <div className="space-y-3">
              {netMrrComponents.map(c => (
                <div key={c.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">{c.label} MRR</span>
                    <span className={cn("font-mono font-medium", c.value > 0 ? "text-emerald-400" : "text-rose-400")}>
                      {c.value > 0 ? "+" : ""}{fmtMoney(c.value)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", c.color)}
                      style={{ width: `${(Math.abs(c.value) / maxComponent) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historical table */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Month</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">MRR</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">New</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">Expansion</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">Churn</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">Customers</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">ARPU</th>
                </tr>
              </thead>
              <tbody>
                {[...MONTHLY_METRICS].toReversed().map(m => (
                  <tr key={m.month} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/20">
                    <td className="p-3 text-[var(--color-text-primary)]">{m.month}</td>
                    <td className="p-3 text-right font-mono text-primary">{fmtMoney(m.mrr)}</td>
                    <td className="p-3 text-right text-emerald-400 font-mono">+{fmtMoney(m.newMrr)}</td>
                    <td className="p-3 text-right text-blue-400 font-mono">+{fmtMoney(m.expansionMrr)}</td>
                    <td className="p-3 text-right text-rose-400 font-mono">{fmtMoney(m.churnMrr)}</td>
                    <td className="p-3 text-right text-[var(--color-text-primary)]">{m.customers}</td>
                    <td className="p-3 text-right text-[var(--color-text-primary)]">{fmtMoney(m.arpu)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plans Tab */}
      {tab === "plans" && (
        <div className="space-y-4">
          {PLAN_REVENUE.filter(p => p.mrr > 0).map(p => (
            <div key={p.plan} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-bold px-2 py-0.5 rounded-full", planColor[p.plan])}>
                    {p.plan.toUpperCase()}
                  </span>
                  <span className="text-[var(--color-text-secondary)]">{p.customers} accounts</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">{fmtMoney(p.mrr)}/mo</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{fmtMoney(p.arr)} ARR</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Avg Contract</div>
                  <div className="text-[var(--color-text-primary)]">{fmtMoney(p.avgContractValue)}/yr</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Churn Rate</div>
                  <div className={cn("font-medium", p.churnRate > 10 ? "text-rose-400" : p.churnRate > 5 ? "text-amber-400" : "text-emerald-400")}>
                    {p.churnRate}%/mo
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Growth Rate</div>
                  <div className="text-emerald-400 font-medium">+{p.growthRate}% YoY</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--color-text-muted)] mb-0.5">% of ARR</div>
                  <div className="text-[var(--color-text-primary)]">{Math.round((p.arr / MONTHLY_METRICS[MONTHLY_METRICS.length-1].arr) * 100)}%</div>
                </div>
              </div>
              <div className="mt-3 w-full h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(p.arr / MONTHLY_METRICS[MONTHLY_METRICS.length-1].arr) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Retention Tab */}
      {tab === "retention" && (
        <div className="space-y-6">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            <div className="p-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Cohort Retention (%)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Cohort</th>
                    <th className="text-center p-2 text-[var(--color-text-secondary)] font-medium">Month 0</th>
                    <th className="text-center p-2 text-[var(--color-text-secondary)] font-medium">Month 1</th>
                    <th className="text-center p-2 text-[var(--color-text-secondary)] font-medium">Month 2</th>
                    <th className="text-center p-2 text-[var(--color-text-secondary)] font-medium">Month 3</th>
                    <th className="text-center p-2 text-[var(--color-text-secondary)] font-medium">Month 6</th>
                    <th className="text-center p-2 text-[var(--color-text-secondary)] font-medium">Month 12</th>
                  </tr>
                </thead>
                <tbody>
                  {COHORT_RETENTION.map(c => (
                    <tr key={c.cohort} className="border-b border-[var(--color-border)]/50">
                      <td className="p-3 text-[var(--color-text-primary)] font-medium">{c.cohort}</td>
                      {[c.month0, c.month1, c.month2, c.month3, c.month6, c.month12].map((pct, i) => (
                        <td key={i} className="p-1 text-center">
                          <div className={cn("rounded py-1.5 text-xs font-mono font-medium mx-1", retentionColor(pct))}>
                            {pct > 0 ? `${pct}%` : "—"}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">84%</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Month 1 Retention</div>
            </div>
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-amber-400">69%</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Month 6 Retention</div>
            </div>
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-rose-400">61%</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Month 12 Retention</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Customers Tab */}
      {tab === "customers" && (
        <div className="space-y-3">
          {TOP_CUSTOMERS.map(c => (
            <div key={c.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <button
                onClick={() => setSelectedCustomer(selectedCustomer === c.id ? null : c.id)}
                className="w-full text-left p-4 hover:bg-[var(--color-surface-2)]/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{c.name}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", planColor[c.plan])}>
                        {c.plan}
                      </span>
                      <span className={cn("text-sm", c.trend === "up" ? "text-emerald-400" : c.trend === "down" ? "text-rose-400" : "text-[var(--color-text-muted)]")}>
                        {c.trend === "up" ? "↑" : c.trend === "down" ? "↓" : "→"}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Renewal: {c.renewalDate}</div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 text-sm">
                    <div className="text-center">
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">ARR</div>
                      <div className="text-primary font-mono font-medium">{fmtMoney(c.arr)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Expansion</div>
                      <div className="text-emerald-400 font-mono">+{fmtMoney(c.expansionPotential)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Health</div>
                      <div className={cn("font-bold", c.healthScore >= 80 ? "text-emerald-400" : c.healthScore >= 65 ? "text-amber-400" : "text-rose-400")}>
                        {c.healthScore}
                      </div>
                    </div>
                    <span className="text-[var(--color-text-muted)]">{selectedCustomer === c.id ? "▲" : "▼"}</span>
                  </div>
                </div>
              </button>

              {selectedCustomer === c.id && (
                <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-surface-0)]">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Contract Start</div>
                      <div className="text-[var(--color-text-primary)]">{c.contractStart}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Renewal Date</div>
                      <div className={cn("font-medium", new Date(c.renewalDate) < new Date("2026-06-01") ? "text-amber-400" : "text-[var(--color-text-primary)]")}>
                        {c.renewalDate}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Expansion Potential</div>
                      <div className="text-emerald-400 font-medium">{fmtMoney(c.expansionPotential)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="px-3 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors">
                      View in CRM
                    </button>
                    <button className="px-3 py-1 text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] rounded-md transition-colors">
                      Create Task
                    </button>
                    {c.expansionPotential > 0 && (
                      <button className="px-3 py-1 text-xs bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 rounded-md transition-colors">
                        Create Expansion Opportunity
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
