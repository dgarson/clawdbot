import React, { useState } from "react"
import { cn } from "../lib/utils"

type Plan = "Starter" | "Growth" | "Enterprise" | "Enterprise Plus"
type RiskLevel = "healthy" | "at-risk" | "churning"
type Sentiment = "positive" | "neutral" | "negative"

interface Account {
  id: string
  company: string
  plan: Plan
  arr: number
  healthScore: number
  nps: number
  lastContact: string
  csm: string
  riskLevel: RiskLevel
  activity30d: string
  tickets: number
  dau: number
  featureAdoption: number
}

interface NPSResponse {
  id: string
  respondent: string
  score: number
  comment: string
  date: string
  sentiment: Sentiment
}

interface PlaybookStep {
  id: string
  name: string
  completed: boolean
}

interface Playbook {
  id: string
  name: string
  accounts: string[]
  stepsCompleted: number
  stepsTotal: number
  successRate: number
  avgDaysToComplete: number
  steps: PlaybookStep[]
}

interface MonthlyScore {
  month: string
  score: number
}

interface MonthlyHealth {
  month: string
  avg: number
}

const ACCOUNTS: Account[] = [
  {
    id: "1",
    company: "Acme Corp",
    plan: "Enterprise",
    arr: 120000,
    healthScore: 92,
    nps: 9,
    lastContact: "2026-02-20",
    csm: "Sarah Chen",
    riskLevel: "healthy",
    activity30d: "Logged in 28/30 days, created 14 projects, 3 integrations active",
    tickets: 1,
    dau: 847,
    featureAdoption: 84,
  },
  {
    id: "2",
    company: "TechFlow Inc",
    plan: "Growth",
    arr: 48000,
    healthScore: 78,
    nps: 7,
    lastContact: "2026-02-18",
    csm: "Marcus Reid",
    riskLevel: "healthy",
    activity30d: "Logged in 22/30 days, moderate feature usage, 1 integration active",
    tickets: 3,
    dau: 312,
    featureAdoption: 61,
  },
  {
    id: "3",
    company: "GlobalRetail Ltd",
    plan: "Enterprise Plus",
    arr: 240000,
    healthScore: 55,
    nps: 5,
    lastContact: "2026-02-10",
    csm: "Sarah Chen",
    riskLevel: "at-risk",
    activity30d: "Login frequency dropped 40%, 2 open escalations, onboarding stalled",
    tickets: 8,
    dau: 1204,
    featureAdoption: 42,
  },
  {
    id: "4",
    company: "StartupXYZ",
    plan: "Starter",
    arr: 12000,
    healthScore: 88,
    nps: 9,
    lastContact: "2026-02-21",
    csm: "Jordan Park",
    riskLevel: "healthy",
    activity30d: "Daily active, completed onboarding, 2 power users identified",
    tickets: 0,
    dau: 45,
    featureAdoption: 72,
  },
  {
    id: "5",
    company: "FinanceHub Pro",
    plan: "Enterprise",
    arr: 96000,
    healthScore: 32,
    nps: 3,
    lastContact: "2026-01-28",
    csm: "Marcus Reid",
    riskLevel: "churning",
    activity30d: "Almost no activity, champion left org, renewal discussion stalled",
    tickets: 12,
    dau: 89,
    featureAdoption: 18,
  },
  {
    id: "6",
    company: "MedTech Solutions",
    plan: "Enterprise Plus",
    arr: 180000,
    healthScore: 95,
    nps: 10,
    lastContact: "2026-02-22",
    csm: "Sarah Chen",
    riskLevel: "healthy",
    activity30d: "Strong engagement, expanded team by 12 seats, referral program participant",
    tickets: 1,
    dau: 2103,
    featureAdoption: 91,
  },
  {
    id: "7",
    company: "Logistics Plus",
    plan: "Growth",
    arr: 36000,
    healthScore: 63,
    nps: 6,
    lastContact: "2026-02-14",
    csm: "Jordan Park",
    riskLevel: "at-risk",
    activity30d: "Intermittent usage, 4 support tickets in last 2 weeks, pricing concerns raised",
    tickets: 6,
    dau: 178,
    featureAdoption: 49,
  },
  {
    id: "8",
    company: "EduLearn Platform",
    plan: "Enterprise",
    arr: 72000,
    healthScore: 81,
    nps: 8,
    lastContact: "2026-02-19",
    csm: "Priya Nair",
    riskLevel: "healthy",
    activity30d: "Steady growth, deployed to 3 new departments, QBR scheduled",
    tickets: 2,
    dau: 654,
    featureAdoption: 77,
  },
  {
    id: "9",
    company: "RetailBrand Co",
    plan: "Starter",
    arr: 9600,
    healthScore: 44,
    nps: 4,
    lastContact: "2026-02-05",
    csm: "Jordan Park",
    riskLevel: "at-risk",
    activity30d: "Usage declining, budget review ongoing, contacted but no response",
    tickets: 4,
    dau: 23,
    featureAdoption: 31,
  },
  {
    id: "10",
    company: "CloudNine Infra",
    plan: "Enterprise Plus",
    arr: 210000,
    healthScore: 87,
    nps: 8,
    lastContact: "2026-02-17",
    csm: "Priya Nair",
    riskLevel: "healthy",
    activity30d: "API usage up 22%, new integration shipped, expansion call booked",
    tickets: 2,
    dau: 1876,
    featureAdoption: 83,
  },
  {
    id: "11",
    company: "SalesForce SMB",
    plan: "Growth",
    arr: 42000,
    healthScore: 71,
    nps: 7,
    lastContact: "2026-02-15",
    csm: "Marcus Reid",
    riskLevel: "healthy",
    activity30d: "Consistent usage, exploring advanced reporting features",
    tickets: 1,
    dau: 287,
    featureAdoption: 65,
  },
  {
    id: "12",
    company: "GreenEnergy Corp",
    plan: "Enterprise",
    arr: 84000,
    healthScore: 27,
    nps: 2,
    lastContact: "2026-01-15",
    csm: "Priya Nair",
    riskLevel: "churning",
    activity30d: "No activity in 18 days, executive sponsor disengaged, competitor eval in progress",
    tickets: 9,
    dau: 34,
    featureAdoption: 12,
  },
]

const NPS_RESPONSES: NPSResponse[] = [
  {
    id: "1",
    respondent: "Alex T. (Acme Corp)",
    score: 9,
    comment: "The platform has transformed our workflow. Onboarding was smooth and support is excellent.",
    date: "2026-02-20",
    sentiment: "positive",
  },
  {
    id: "2",
    respondent: "Jamie K. (TechFlow Inc)",
    score: 7,
    comment: "Good tool overall but the reporting module needs more customization options.",
    date: "2026-02-18",
    sentiment: "neutral",
  },
  {
    id: "3",
    respondent: "Morgan S. (GlobalRetail Ltd)",
    score: 5,
    comment: "We've been struggling with the integration. Too many bugs and slow support response times.",
    date: "2026-02-16",
    sentiment: "negative",
  },
  {
    id: "4",
    respondent: "Casey L. (StartupXYZ)",
    score: 10,
    comment: "Absolutely love it! Went from chaos to clarity in two weeks. Already recommended to 3 other companies.",
    date: "2026-02-21",
    sentiment: "positive",
  },
  {
    id: "5",
    respondent: "Dana R. (FinanceHub Pro)",
    score: 3,
    comment: "Performance has been degraded for weeks. Our team is frustrated and evaluating alternatives.",
    date: "2026-02-12",
    sentiment: "negative",
  },
  {
    id: "6",
    respondent: "Riley M. (MedTech Solutions)",
    score: 10,
    comment: "Best-in-class product. Our compliance team is especially impressed with the audit trail features.",
    date: "2026-02-22",
    sentiment: "positive",
  },
  {
    id: "7",
    respondent: "Sam W. (Logistics Plus)",
    score: 6,
    comment: "Pricing feels high for what we get. Core features work but advanced ones feel incomplete.",
    date: "2026-02-14",
    sentiment: "neutral",
  },
  {
    id: "8",
    respondent: "Taylor B. (EduLearn Platform)",
    score: 8,
    comment: "Really impressed with the new dashboard. Would love a better mobile experience.",
    date: "2026-02-19",
    sentiment: "positive",
  },
  {
    id: "9",
    respondent: "Jordan F. (RetailBrand Co)",
    score: 4,
    comment: "The product is okay but we feel like a small fish. Support is hard to reach.",
    date: "2026-02-08",
    sentiment: "negative",
  },
  {
    id: "10",
    respondent: "Chris V. (CloudNine Infra)",
    score: 9,
    comment: "Solid platform. The new API v3 is a major improvement. Dev team loves it.",
    date: "2026-02-17",
    sentiment: "positive",
  },
  {
    id: "11",
    respondent: "Pat O. (SalesForce SMB)",
    score: 7,
    comment: "Works well day-to-day. Setup took longer than expected but we're happy now.",
    date: "2026-02-15",
    sentiment: "neutral",
  },
  {
    id: "12",
    respondent: "Leslie N. (GreenEnergy Corp)",
    score: 2,
    comment: "We've had nothing but problems. The product doesn't meet our use case and support has been unresponsive.",
    date: "2026-01-20",
    sentiment: "negative",
  },
]

const NPS_MONTHLY: MonthlyScore[] = [
  { month: "Mar", score: 28 },
  { month: "Apr", score: 32 },
  { month: "May", score: 35 },
  { month: "Jun", score: 30 },
  { month: "Jul", score: 38 },
  { month: "Aug", score: 41 },
  { month: "Sep", score: 37 },
  { month: "Oct", score: 44 },
  { month: "Nov", score: 42 },
  { month: "Dec", score: 46 },
  { month: "Jan", score: 43 },
  { month: "Feb", score: 48 },
]

const HEALTH_MONTHLY: MonthlyHealth[] = [
  { month: "Sep", avg: 68 },
  { month: "Oct", avg: 71 },
  { month: "Nov", avg: 69 },
  { month: "Dec", avg: 73 },
  { month: "Jan", avg: 72 },
  { month: "Feb", avg: 75 },
]

const PLAYBOOKS: Playbook[] = [
  {
    id: "1",
    name: "Renewal at Risk",
    accounts: ["FinanceHub Pro", "GreenEnergy Corp"],
    stepsCompleted: 6,
    stepsTotal: 9,
    successRate: 67,
    avgDaysToComplete: 42,
    steps: [
      { id: "1-1", name: "Identify renewal stakeholders", completed: true },
      { id: "1-2", name: "Schedule executive business review", completed: true },
      { id: "1-3", name: "Audit open support tickets", completed: true },
      { id: "1-4", name: "Deliver value summary deck", completed: true },
      { id: "1-5", name: "Address product gaps or blockers", completed: true },
      { id: "1-6", name: "Negotiate renewal terms", completed: true },
      { id: "1-7", name: "Get verbal commitment", completed: false },
      { id: "1-8", name: "Send renewal quote", completed: false },
      { id: "1-9", name: "Signed renewal contract", completed: false },
    ],
  },
  {
    id: "2",
    name: "New Enterprise Onboarding",
    accounts: ["MedTech Solutions", "CloudNine Infra"],
    stepsCompleted: 8,
    stepsTotal: 10,
    successRate: 88,
    avgDaysToComplete: 30,
    steps: [
      { id: "2-1", name: "Welcome call scheduled", completed: true },
      { id: "2-2", name: "Admin users provisioned", completed: true },
      { id: "2-3", name: "SSO / SAML configured", completed: true },
      { id: "2-4", name: "Data migration completed", completed: true },
      { id: "2-5", name: "First project created", completed: true },
      { id: "2-6", name: "Team training session 1", completed: true },
      { id: "2-7", name: "Team training session 2", completed: true },
      { id: "2-8", name: "Integration with core tools", completed: true },
      { id: "2-9", name: "30-day check-in call", completed: false },
      { id: "2-10", name: "Champion identified and activated", completed: false },
    ],
  },
  {
    id: "3",
    name: "Expansion Opportunity",
    accounts: ["EduLearn Platform", "Acme Corp", "TechFlow Inc"],
    stepsCompleted: 4,
    stepsTotal: 7,
    successRate: 74,
    avgDaysToComplete: 35,
    steps: [
      { id: "3-1", name: "Identify expansion trigger (usage spike, new team)", completed: true },
      { id: "3-2", name: "Qualify expansion potential with CSM", completed: true },
      { id: "3-3", name: "Present expanded plan features", completed: true },
      { id: "3-4", name: "Send upgrade proposal", completed: true },
      { id: "3-5", name: "Internal champion advocacy", completed: false },
      { id: "3-6", name: "Budget approval obtained", completed: false },
      { id: "3-7", name: "Upgrade contract signed", completed: false },
    ],
  },
  {
    id: "4",
    name: "Low Engagement Recovery",
    accounts: ["RetailBrand Co", "Logistics Plus", "GlobalRetail Ltd"],
    stepsCompleted: 3,
    stepsTotal: 8,
    successRate: 52,
    avgDaysToComplete: 28,
    steps: [
      { id: "4-1", name: "Identify low engagement trigger", completed: true },
      { id: "4-2", name: "Outreach — email and call attempt", completed: true },
      { id: "4-3", name: "Re-discovery call to understand blockers", completed: true },
      { id: "4-4", name: "Tailored re-engagement plan created", completed: false },
      { id: "4-5", name: "Product tutorial session scheduled", completed: false },
      { id: "4-6", name: "Usage checkpoint at 14 days", completed: false },
      { id: "4-7", name: "Success story shared with team", completed: false },
      { id: "4-8", name: "Re-engaged confirmation (login 5+ days)", completed: false },
    ],
  },
]

function formatARR(arr: number): string {
  if (arr >= 1000000) {return `$${(arr / 1000000).toFixed(1)}M`}
  if (arr >= 1000) {return `$${(arr / 1000).toFixed(0)}K`}
  return `$${arr}`
}

function healthScoreColor(score: number): string {
  if (score >= 90) {return "text-emerald-400"}
  if (score >= 70) {return "text-primary"}
  if (score >= 50) {return "text-amber-400"}
  return "text-rose-400"
}

function healthScoreBadge(score: number): string {
  if (score >= 90) {return "bg-emerald-400/10 text-emerald-400"}
  if (score >= 70) {return "bg-primary/10 text-primary"}
  if (score >= 50) {return "bg-amber-400/10 text-amber-400"}
  return "bg-rose-400/10 text-rose-400"
}

function riskBadgeClass(risk: RiskLevel): string {
  if (risk === "healthy") {return "bg-emerald-400/10 text-emerald-400"}
  if (risk === "at-risk") {return "bg-amber-400/10 text-amber-400"}
  return "bg-rose-400/10 text-rose-400"
}

function npsScoreColor(score: number): string {
  if (score >= 9) {return "text-emerald-400"}
  if (score >= 7) {return "text-primary"}
  if (score >= 5) {return "text-amber-400"}
  return "text-rose-400"
}

function sentimentBadgeClass(sentiment: Sentiment): string {
  if (sentiment === "positive") {return "bg-emerald-400/10 text-emerald-400"}
  if (sentiment === "neutral") {return "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]"}
  return "bg-rose-400/10 text-rose-400"
}

function ticketColor(count: number): string {
  if (count > 5) {return "text-rose-400"}
  if (count > 2) {return "text-amber-400"}
  return "text-emerald-400"
}

const promoters = NPS_RESPONSES.filter(r => r.score >= 9).length
const passives = NPS_RESPONSES.filter(r => r.score >= 7 && r.score <= 8).length
const detractors = NPS_RESPONSES.filter(r => r.score <= 6).length
const totalResponses = NPS_RESPONSES.length
const currentNPS = Math.round(((promoters - detractors) / totalResponses) * 100)

const totalAccounts = ACCOUNTS.length
const bucket90 = ACCOUNTS.filter(a => a.healthScore >= 90).length
const bucket70 = ACCOUNTS.filter(a => a.healthScore >= 70 && a.healthScore < 90).length
const bucket50 = ACCOUNTS.filter(a => a.healthScore >= 50 && a.healthScore < 70).length
const bucketLow = ACCOUNTS.filter(a => a.healthScore < 50).length

const decliningAccounts = [...ACCOUNTS]
  .filter(a => a.riskLevel !== "healthy")
  .toSorted((a, b) => a.healthScore - b.healthScore)
  .slice(0, 5)

const totalARR = ACCOUNTS.reduce((sum, a) => sum + a.arr, 0)
const avgHealth = Math.round(ACCOUNTS.reduce((sum, a) => sum + a.healthScore, 0) / totalAccounts)
const churningCount = ACCOUNTS.filter(a => a.riskLevel === "churning").length
const atRiskCount = ACCOUNTS.filter(a => a.riskLevel === "at-risk").length

const maxNPS = Math.max(...NPS_MONTHLY.map(m => m.score))
const maxHealth = Math.max(...HEALTH_MONTHLY.map(m => m.avg))

type TabId = "accounts" | "trends" | "nps" | "playbooks"

export default function CustomerSuccessDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("accounts")
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null)
  const [planFilter, setPlanFilter] = useState<string>("all")
  const [riskFilter, setRiskFilter] = useState<string>("all")
  const [expandedPlaybook, setExpandedPlaybook] = useState<string | null>(null)

  const filteredAccounts = ACCOUNTS.filter(a => {
    if (planFilter !== "all" && a.plan !== planFilter) {return false}
    if (riskFilter !== "all" && a.riskLevel !== riskFilter) {return false}
    return true
  })

  const tabs: { id: TabId; label: string }[] = [
    { id: "accounts", label: "Accounts" },
    { id: "trends", label: "Health Trends" },
    { id: "nps", label: "NPS" },
    { id: "playbooks", label: "Playbooks" },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Customer Success</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Account health, NPS tracking, and CS team operations</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[var(--color-surface-1)] rounded-lg p-4 border border-[var(--color-border)]">
            <div className="text-[var(--color-text-secondary)] text-sm">Total ARR</div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{formatARR(totalARR)}</div>
            <div className="text-xs text-emerald-400 mt-1">↑ 12% YoY</div>
          </div>
          <div className="bg-[var(--color-surface-1)] rounded-lg p-4 border border-[var(--color-border)]">
            <div className="text-[var(--color-text-secondary)] text-sm">Avg Health Score</div>
            <div className={cn("text-2xl font-bold mt-1", healthScoreColor(avgHealth))}>{avgHealth}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">{totalAccounts} accounts</div>
          </div>
          <div className="bg-[var(--color-surface-1)] rounded-lg p-4 border border-[var(--color-border)]">
            <div className="text-[var(--color-text-secondary)] text-sm">Current NPS</div>
            <div className="text-2xl font-bold text-primary mt-1">{currentNPS}</div>
            <div className="text-xs text-emerald-400 mt-1">↑ 5 pts from Jan</div>
          </div>
          <div className="bg-[var(--color-surface-1)] rounded-lg p-4 border border-[var(--color-border)]">
            <div className="text-[var(--color-text-secondary)] text-sm">Churn Risk</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{churningCount}</div>
            <div className="text-xs text-amber-400 mt-1">{atRiskCount} at-risk</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-t-md transition-colors",
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary bg-[var(--color-surface-1)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Accounts */}
        {activeTab === "accounts" && (
          <div>
            <div className="flex gap-3 mb-4 flex-wrap items-center">
              <select
                value={planFilter}
                onChange={e => setPlanFilter(e.target.value)}
                className="bg-[var(--color-surface-2)] text-[var(--color-text-primary)] text-sm rounded-md px-3 py-2 border border-[var(--color-border)] focus:outline-none focus:border-primary"
              >
                <option value="all">All Plans</option>
                <option value="Starter">Starter</option>
                <option value="Growth">Growth</option>
                <option value="Enterprise">Enterprise</option>
                <option value="Enterprise Plus">Enterprise Plus</option>
              </select>
              <select
                value={riskFilter}
                onChange={e => setRiskFilter(e.target.value)}
                className="bg-[var(--color-surface-2)] text-[var(--color-text-primary)] text-sm rounded-md px-3 py-2 border border-[var(--color-border)] focus:outline-none focus:border-primary"
              >
                <option value="all">All Risk Levels</option>
                <option value="healthy">Healthy</option>
                <option value="at-risk">At Risk</option>
                <option value="churning">Churning</option>
              </select>
              <span className="text-[var(--color-text-secondary)] text-sm">{filteredAccounts.length} accounts</span>
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="text-left text-[var(--color-text-secondary)] px-4 py-3 font-medium">Company</th>
                      <th className="text-left text-[var(--color-text-secondary)] px-4 py-3 font-medium">Plan</th>
                      <th className="text-left text-[var(--color-text-secondary)] px-4 py-3 font-medium">ARR</th>
                      <th className="text-left text-[var(--color-text-secondary)] px-4 py-3 font-medium">Health</th>
                      <th className="text-left text-[var(--color-text-secondary)] px-4 py-3 font-medium">NPS</th>
                      <th className="text-left text-[var(--color-text-secondary)] px-4 py-3 font-medium">Last Contact</th>
                      <th className="text-left text-[var(--color-text-secondary)] px-4 py-3 font-medium">CSM</th>
                      <th className="text-left text-[var(--color-text-secondary)] px-4 py-3 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map(account => (
                      <React.Fragment key={account.id}>
                        <tr
                          className={cn(
                            "border-b border-[var(--color-border)] cursor-pointer transition-colors",
                            expandedAccount === account.id ? "bg-[var(--color-surface-2)]" : "hover:bg-[var(--color-surface-2)]/50"
                          )}
                          onClick={() =>
                            setExpandedAccount(expandedAccount === account.id ? null : account.id)
                          }
                        >
                          <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">
                            <span className="mr-2 text-[var(--color-text-muted)] text-xs">
                              {expandedAccount === account.id ? "▾" : "▸"}
                            </span>
                            {account.company}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-primary)]">{account.plan}</td>
                          <td className="px-4 py-3 text-[var(--color-text-primary)]">{formatARR(account.arr)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-md text-xs font-bold",
                                healthScoreBadge(account.healthScore)
                              )}
                            >
                              {account.healthScore}
                            </span>
                          </td>
                          <td className={cn("px-4 py-3 font-medium", npsScoreColor(account.nps))}>
                            {account.nps}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{account.lastContact}</td>
                          <td className="px-4 py-3 text-[var(--color-text-primary)]">{account.csm}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-md text-xs capitalize",
                                riskBadgeClass(account.riskLevel)
                              )}
                            >
                              {account.riskLevel}
                            </span>
                          </td>
                        </tr>
                        {expandedAccount === account.id && (
                          <tr className="bg-[var(--color-surface-2)]/60 border-b border-[var(--color-border)]">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                  <div className="text-xs text-[var(--color-text-secondary)] mb-2 uppercase tracking-wide font-medium">
                                    30-Day Activity
                                  </div>
                                  <div className="text-[var(--color-text-primary)] text-sm leading-relaxed">
                                    {account.activity30d}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-[var(--color-text-secondary)] mb-2 uppercase tracking-wide font-medium">
                                    Support Tickets
                                  </div>
                                  <div className={cn("text-3xl font-bold", ticketColor(account.tickets))}>
                                    {account.tickets}
                                  </div>
                                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">open tickets</div>
                                </div>
                                <div>
                                  <div className="text-xs text-[var(--color-text-secondary)] mb-2 uppercase tracking-wide font-medium">
                                    Usage Metrics
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-[var(--color-text-secondary)]">DAU</span>
                                      <span className="text-[var(--color-text-primary)] font-medium">
                                        {account.dau.toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-[var(--color-text-secondary)]">Feature Adoption</span>
                                      <span
                                        className={cn(
                                          "font-medium",
                                          account.featureAdoption >= 70
                                            ? "text-emerald-400"
                                            : account.featureAdoption >= 50
                                            ? "text-amber-400"
                                            : "text-rose-400"
                                        )}
                                      >
                                        {account.featureAdoption}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-[var(--color-surface-3)] rounded-full h-1.5">
                                      <div
                                        className={cn(
                                          "h-1.5 rounded-full",
                                          account.featureAdoption >= 70
                                            ? "bg-emerald-400"
                                            : account.featureAdoption >= 50
                                            ? "bg-amber-400"
                                            : "bg-rose-400"
                                        )}
                                        style={{ width: `${account.featureAdoption}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
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

        {/* Tab: Health Trends */}
        {activeTab === "trends" && (
          <div className="space-y-6">
            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-6">
              <h2 className="text-[var(--color-text-primary)] font-semibold mb-5">Health Score Distribution</h2>
              <div className="space-y-4">
                {[
                  { label: "90–100 (Excellent)", count: bucket90, color: "bg-emerald-400" },
                  { label: "70–89 (Good)", count: bucket70, color: "bg-primary" },
                  { label: "50–69 (Fair)", count: bucket50, color: "bg-amber-400" },
                  { label: "<50 (Critical)", count: bucketLow, color: "bg-rose-400" },
                ].map(bucket => (
                  <div key={bucket.label} className="flex items-center gap-4">
                    <div className="w-36 text-sm text-[var(--color-text-secondary)] shrink-0">{bucket.label}</div>
                    <div className="flex-1 bg-[var(--color-surface-2)] rounded-full h-4 overflow-hidden">
                      <div
                        className={cn("h-4 rounded-full", bucket.color)}
                        style={{ width: `${(bucket.count / totalAccounts) * 100}%` }}
                      />
                    </div>
                    <div className="text-[var(--color-text-primary)] text-sm w-20 text-right shrink-0">
                      {bucket.count} acct{bucket.count !== 1 ? "s" : ""} ({Math.round((bucket.count / totalAccounts) * 100)}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-6">
              <h2 className="text-[var(--color-text-primary)] font-semibold mb-5">Avg Health Score — Last 6 Months</h2>
              <div className="flex items-end gap-3 h-40 px-2">
                {HEALTH_MONTHLY.map(m => (
                  <div key={m.month} className="flex flex-col items-center flex-1 h-full justify-end">
                    <div className="text-xs text-[var(--color-text-secondary)] mb-1">{m.avg}</div>
                    <div
                      className="w-full bg-primary rounded-t-md"
                      style={{ height: `${(m.avg / maxHealth) * 100}%` }}
                    />
                    <div className="text-xs text-[var(--color-text-secondary)] mt-2">{m.month}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-6">
              <h2 className="text-[var(--color-text-primary)] font-semibold mb-4">Top 5 Declining Accounts</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left text-[var(--color-text-secondary)] px-2 py-2 font-medium">Company</th>
                    <th className="text-left text-[var(--color-text-secondary)] px-2 py-2 font-medium">Health Score</th>
                    <th className="text-left text-[var(--color-text-secondary)] px-2 py-2 font-medium">Trend</th>
                    <th className="text-left text-[var(--color-text-secondary)] px-2 py-2 font-medium">CSM</th>
                    <th className="text-left text-[var(--color-text-secondary)] px-2 py-2 font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {decliningAccounts.map(a => (
                    <tr key={a.id} className="border-b border-[var(--color-border)]">
                      <td className="px-2 py-3 text-[var(--color-text-primary)] font-medium">{a.company}</td>
                      <td className="px-2 py-3">
                        <span className={cn("font-bold text-base", healthScoreColor(a.healthScore))}>
                          {a.healthScore}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-rose-400 font-medium">↓ Declining</td>
                      <td className="px-2 py-3 text-[var(--color-text-primary)]">{a.csm}</td>
                      <td className="px-2 py-3">
                        <span
                          className={cn(
                            "px-2 py-1 rounded-md text-xs capitalize",
                            riskBadgeClass(a.riskLevel)
                          )}
                        >
                          {a.riskLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: NPS */}
        {activeTab === "nps" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-6 flex flex-col items-center justify-center">
                <div className="text-[var(--color-text-secondary)] text-sm mb-2">Current NPS</div>
                <div className="text-6xl font-bold text-primary">{currentNPS}</div>
                <div className="text-[var(--color-text-secondary)] text-xs mt-2">Net Promoter Score</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4 flex flex-col items-center justify-center">
                <div className="text-emerald-400 text-3xl font-bold">{promoters}</div>
                <div className="text-[var(--color-text-secondary)] text-sm mt-1">Promoters</div>
                <div className="text-[var(--color-text-muted)] text-xs mt-0.5">score 9–10</div>
                <div className="text-emerald-400 text-sm font-medium mt-1">
                  {Math.round((promoters / totalResponses) * 100)}%
                </div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4 flex flex-col items-center justify-center">
                <div className="text-[var(--color-text-primary)] text-3xl font-bold">{passives}</div>
                <div className="text-[var(--color-text-secondary)] text-sm mt-1">Passives</div>
                <div className="text-[var(--color-text-muted)] text-xs mt-0.5">score 7–8</div>
                <div className="text-[var(--color-text-secondary)] text-sm font-medium mt-1">
                  {Math.round((passives / totalResponses) * 100)}%
                </div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4 flex flex-col items-center justify-center">
                <div className="text-rose-400 text-3xl font-bold">{detractors}</div>
                <div className="text-[var(--color-text-secondary)] text-sm mt-1">Detractors</div>
                <div className="text-[var(--color-text-muted)] text-xs mt-0.5">score 0–6</div>
                <div className="text-rose-400 text-sm font-medium mt-1">
                  {Math.round((detractors / totalResponses) * 100)}%
                </div>
              </div>
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-6">
              <h2 className="text-[var(--color-text-primary)] font-semibold mb-5">NPS Trend — Last 12 Months</h2>
              <div className="flex items-end gap-1.5 h-32 px-1">
                {NPS_MONTHLY.map(m => (
                  <div key={m.month} className="flex flex-col items-center flex-1 h-full justify-end">
                    <div className="text-xs text-[var(--color-text-secondary)] mb-1">{m.score}</div>
                    <div
                      className="w-full bg-primary/80 rounded-t-sm"
                      style={{ height: `${(m.score / maxNPS) * 100}%` }}
                    />
                    <div className="text-xs text-[var(--color-text-secondary)] mt-2">{m.month}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-6">
              <h2 className="text-[var(--color-text-primary)] font-semibold mb-4">Recent Responses</h2>
              <div className="space-y-3">
                {NPS_RESPONSES.map(r => (
                  <div
                    key={r.id}
                    className="bg-[var(--color-surface-2)] rounded-lg px-4 py-3 border border-[var(--color-border)]"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={cn("text-lg font-bold tabular-nums", npsScoreColor(r.score))}>
                          {r.score}
                        </span>
                        <span className="text-[var(--color-text-primary)] text-sm font-medium">{r.respondent}</span>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-md text-xs capitalize",
                            sentimentBadgeClass(r.sentiment)
                          )}
                        >
                          {r.sentiment}
                        </span>
                      </div>
                      <span className="text-[var(--color-text-secondary)] text-xs shrink-0">{r.date}</span>
                    </div>
                    <p className="text-[var(--color-text-secondary)] text-sm truncate">{r.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Playbooks */}
        {activeTab === "playbooks" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[var(--color-text-secondary)] text-sm">{PLAYBOOKS.length} active playbooks</p>
            </div>
            {PLAYBOOKS.map(pb => (
              <div key={pb.id} className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
                <div
                  className="px-5 py-4 cursor-pointer hover:bg-[var(--color-surface-2)]/50 transition-colors"
                  onClick={() =>
                    setExpandedPlaybook(expandedPlaybook === pb.id ? null : pb.id)
                  }
                >
                  <div className="flex items-start md:items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--color-text-secondary)] text-xs">
                        {expandedPlaybook === pb.id ? "▾" : "▸"}
                      </span>
                      <div>
                        <div className="text-[var(--color-text-primary)] font-semibold">{pb.name}</div>
                        <div className="text-[var(--color-text-secondary)] text-xs mt-0.5">
                          Applied to: {pb.accounts.join(", ")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm flex-wrap">
                      <div className="text-center">
                        <div className="text-[var(--color-text-secondary)] text-xs mb-0.5">Progress</div>
                        <div className="text-[var(--color-text-primary)] font-medium">
                          {pb.stepsCompleted}/{pb.stepsTotal}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[var(--color-text-secondary)] text-xs mb-0.5">Success Rate</div>
                        <div
                          className={cn(
                            "font-medium",
                            pb.successRate >= 75
                              ? "text-emerald-400"
                              : pb.successRate >= 55
                              ? "text-amber-400"
                              : "text-rose-400"
                          )}
                        >
                          {pb.successRate}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[var(--color-text-secondary)] text-xs mb-0.5">Avg Days</div>
                        <div className="text-[var(--color-text-primary)] font-medium">{pb.avgDaysToComplete}d</div>
                      </div>
                      <div className="w-28 shrink-0">
                        <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                          <span>Completion</span>
                          <span>{Math.round((pb.stepsCompleted / pb.stepsTotal) * 100)}%</span>
                        </div>
                        <div className="w-full bg-[var(--color-surface-3)] rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${(pb.stepsCompleted / pb.stepsTotal) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedPlaybook === pb.id && (
                  <div className="border-t border-[var(--color-border)] px-5 py-4 bg-[var(--color-surface-2)]/30">
                    <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide font-medium mb-3">
                      Steps ({pb.stepsCompleted} of {pb.stepsTotal} completed)
                    </div>
                    <div className="space-y-2">
                      {pb.steps.map((step, idx) => (
                        <div key={step.id} className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                              step.completed
                                ? "bg-emerald-400/20 text-emerald-400"
                                : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
                            )}
                          >
                            {step.completed ? "✓" : idx + 1}
                          </div>
                          <span
                            className={cn(
                              "text-sm flex-1",
                              step.completed ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"
                            )}
                          >
                            {step.name}
                          </span>
                          {!step.completed && (
                            <span className="text-xs text-[var(--color-text-muted)] shrink-0">Pending</span>
                          )}
                          {step.completed && (
                            <span className="text-xs text-emerald-400/60 shrink-0">Done</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
