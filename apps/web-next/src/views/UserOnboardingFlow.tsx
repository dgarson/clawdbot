import React, { useState } from "react"
import { cn } from "../lib/utils"

type FlowStatus = "active" | "paused" | "draft" | "archived"
type StepType = "action" | "email" | "wait" | "condition" | "in-app"
type UserStepStatus = "completed" | "current" | "skipped" | "pending"
type CohortTrend = "up" | "down" | "flat"

interface OnboardingStep {
  id: string
  name: string
  type: StepType
  description: string
  avgCompletionTimeH: number
  completionRate: number
  dropOffRate: number
}

interface OnboardingFlow {
  id: string
  name: string
  description: string
  status: FlowStatus
  targetSegment: string
  steps: OnboardingStep[]
  totalUsers: number
  completedUsers: number
  avgCompletionDays: number
  completionRate: number
  createdAt: string
}

interface UserProgress {
  userId: string
  name: string
  email: string
  flowId: string
  currentStepIdx: number
  startedAt: string
  lastActiveAt: string
  steps: UserStepStatus[]
  daysInFlow: number
  healthScore: number
}

interface CohortMetric {
  week: string
  started: number
  completed: number
  rate: number
  trend: CohortTrend
}

const FLOWS: OnboardingFlow[] = [
  {
    id: "flow-001",
    name: "Developer Quick Start",
    description: "Guide developers from signup to first API call in under 48 hours",
    status: "active",
    targetSegment: "role:developer",
    totalUsers: 1842,
    completedUsers: 1341,
    avgCompletionDays: 1.8,
    completionRate: 72.8,
    createdAt: "2025-08-01",
    steps: [
      { id: "s1", name: "Email Verification", type: "email", description: "Send and verify email address", avgCompletionTimeH: 0.5, completionRate: 98.2, dropOffRate: 1.8 },
      { id: "s2", name: "Create Workspace", type: "action", description: "User creates first workspace", avgCompletionTimeH: 2.1, completionRate: 91.4, dropOffRate: 8.6 },
      { id: "s3", name: "Install SDK", type: "action", description: "Install the clawdbot SDK", avgCompletionTimeH: 4.8, completionRate: 84.3, dropOffRate: 15.7 },
      { id: "s4", name: "Welcome Email", type: "email", description: "Day 1 welcome email with resources", avgCompletionTimeH: 0, completionRate: 99.9, dropOffRate: 0.1 },
      { id: "s5", name: "First API Call", type: "action", description: "Make first successful API request", avgCompletionTimeH: 8.2, completionRate: 78.9, dropOffRate: 21.1 },
      { id: "s6", name: "Explore Playground", type: "in-app", description: "In-app prompt to try the playground", avgCompletionTimeH: 12, completionRate: 72.8, dropOffRate: 27.2 },
    ],
  },
  {
    id: "flow-002",
    name: "Enterprise Admin Setup",
    description: "Help enterprise admins configure SSO, RBAC, and team management",
    status: "active",
    targetSegment: "plan:enterprise + role:admin",
    totalUsers: 218,
    completedUsers: 187,
    avgCompletionDays: 4.2,
    completionRate: 85.8,
    createdAt: "2025-09-15",
    steps: [
      { id: "s1", name: "Admin Verification", type: "email", description: "Verify admin email and role", avgCompletionTimeH: 1, completionRate: 99.1, dropOffRate: 0.9 },
      { id: "s2", name: "SSO Configuration", type: "action", description: "Connect identity provider", avgCompletionTimeH: 6, completionRate: 94.5, dropOffRate: 5.5 },
      { id: "s3", name: "Invite Team Members", type: "action", description: "Add at least 3 team members", avgCompletionTimeH: 12, completionRate: 91.3, dropOffRate: 8.7 },
      { id: "s4", name: "Set Up RBAC", type: "action", description: "Configure role-based access control", avgCompletionTimeH: 8, completionRate: 88.1, dropOffRate: 11.9 },
      { id: "s5", name: "Kickoff Call", type: "wait", description: "Schedule customer success call", avgCompletionTimeH: 48, completionRate: 85.8, dropOffRate: 14.2 },
    ],
  },
  {
    id: "flow-003",
    name: "Product Manager Activation",
    description: "Guide PMs to set up their first project, goals, and integrations",
    status: "active",
    targetSegment: "role:product",
    totalUsers: 624,
    completedUsers: 389,
    avgCompletionDays: 3.1,
    completionRate: 62.3,
    createdAt: "2025-10-01",
    steps: [
      { id: "s1", name: "Profile Setup", type: "action", description: "Complete profile and preferences", avgCompletionTimeH: 1, completionRate: 95.8, dropOffRate: 4.2 },
      { id: "s2", name: "Create First Project", type: "action", description: "Set up a project workspace", avgCompletionTimeH: 3, completionRate: 83.7, dropOffRate: 16.3 },
      { id: "s3", name: "Connect GitHub", type: "action", description: "Integrate with GitHub repo", avgCompletionTimeH: 2, completionRate: 71.4, dropOffRate: 28.6 },
      { id: "s4", name: "Week 1 Tip Email", type: "email", description: "Tips for getting value in week 1", avgCompletionTimeH: 0, completionRate: 99.8, dropOffRate: 0.2 },
      { id: "s5", name: "Invite Teammates", type: "action", description: "Invite 2+ collaborators", avgCompletionTimeH: 24, completionRate: 62.3, dropOffRate: 37.7 },
    ],
  },
  {
    id: "flow-004",
    name: "Freemium to Paid Conversion",
    description: "Nurture free users toward upgrade with targeted in-app and email",
    status: "paused",
    targetSegment: "plan:free + age>14d",
    totalUsers: 4812,
    completedUsers: 891,
    avgCompletionDays: 21,
    completionRate: 18.5,
    createdAt: "2025-07-01",
    steps: [
      { id: "s1", name: "Usage Limit Warning", type: "in-app", description: "Show limit approaching banner", avgCompletionTimeH: 0, completionRate: 99.9, dropOffRate: 0.1 },
      { id: "s2", name: "Upgrade Email Drip 1", type: "email", description: "Benefits of paid plan", avgCompletionTimeH: 0, completionRate: 98.4, dropOffRate: 1.6 },
      { id: "s3", name: "Pricing Prompt", type: "in-app", description: "In-app pricing page nudge", avgCompletionTimeH: 48, completionRate: 42.1, dropOffRate: 57.9 },
      { id: "s4", name: "Upgrade Email Drip 2", type: "email", description: "Trial offer with 20% discount", avgCompletionTimeH: 0, completionRate: 96.2, dropOffRate: 3.8 },
      { id: "s5", name: "Conversion", type: "action", description: "User upgrades to paid plan", avgCompletionTimeH: 168, completionRate: 18.5, dropOffRate: 81.5 },
    ],
  },
]

const USER_PROGRESS: UserProgress[] = [
  { userId: "u-001", name: "Alex Chen", email: "alex@techcorp.io", flowId: "flow-001", currentStepIdx: 4, startedAt: "2026-02-20", lastActiveAt: "2026-02-22", steps: ["completed", "completed", "completed", "completed", "current", "pending"], daysInFlow: 2, healthScore: 88 },
  { userId: "u-002", name: "Maria Santos", email: "msantos@startup.co", flowId: "flow-001", currentStepIdx: 2, startedAt: "2026-02-21", lastActiveAt: "2026-02-21", steps: ["completed", "completed", "current", "pending", "pending", "pending"], daysInFlow: 1, healthScore: 72 },
  { userId: "u-003", name: "Jordan Lee", email: "j.lee@enterprise.com", flowId: "flow-002", currentStepIdx: 3, startedAt: "2026-02-17", lastActiveAt: "2026-02-22", steps: ["completed", "completed", "completed", "current", "pending"], daysInFlow: 5, healthScore: 91 },
  { userId: "u-004", name: "Priya Patel", email: "priya@vc-backed.io", flowId: "flow-003", currentStepIdx: 2, startedAt: "2026-02-19", lastActiveAt: "2026-02-20", steps: ["completed", "completed", "current", "pending", "pending"], daysInFlow: 3, healthScore: 58 },
  { userId: "u-005", name: "Thomas Weber", email: "t.weber@bigco.de", flowId: "flow-002", currentStepIdx: 4, startedAt: "2026-02-15", lastActiveAt: "2026-02-22", steps: ["completed", "completed", "completed", "completed", "current"], daysInFlow: 7, healthScore: 94 },
  { userId: "u-006", name: "Sophie Martin", email: "sophie@agence.fr", flowId: "flow-003", currentStepIdx: 1, startedAt: "2026-02-22", lastActiveAt: "2026-02-22", steps: ["completed", "current", "pending", "pending", "pending"], daysInFlow: 0, healthScore: 65 },
  { userId: "u-007", name: "Ryan O'Connor", email: "ryan@dev.io", flowId: "flow-001", currentStepIdx: 5, startedAt: "2026-02-18", lastActiveAt: "2026-02-22", steps: ["completed", "completed", "completed", "completed", "completed", "current"], daysInFlow: 4, healthScore: 97 },
  { userId: "u-008", name: "Yuki Tanaka", email: "yuki@saas.jp", flowId: "flow-001", currentStepIdx: 3, startedAt: "2026-02-21", lastActiveAt: "2026-02-21", steps: ["completed", "completed", "skipped", "current", "pending", "pending"], daysInFlow: 1, healthScore: 44 },
]

const COHORTS: CohortMetric[] = [
  { week: "Jan 6", started: 186, completed: 134, rate: 72.0, trend: "flat" },
  { week: "Jan 13", started: 204, completed: 152, rate: 74.5, trend: "up" },
  { week: "Jan 20", started: 221, completed: 158, rate: 71.5, trend: "down" },
  { week: "Jan 27", started: 197, completed: 144, rate: 73.1, trend: "up" },
  { week: "Feb 3", started: 248, completed: 185, rate: 74.6, trend: "up" },
  { week: "Feb 10", started: 232, completed: 172, rate: 74.1, trend: "down" },
  { week: "Feb 17", started: 261, completed: 198, rate: 75.9, trend: "up" },
  { week: "Feb 22", started: 178, completed: 0, rate: 0, trend: "flat" },
]

const flowStatusColor: Record<FlowStatus, string> = {
  active: "text-emerald-400 bg-emerald-400/10",
  paused: "text-amber-400 bg-amber-400/10",
  draft: "text-indigo-400 bg-indigo-400/10",
  archived: "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10",
}

const stepTypeIcon: Record<StepType, string> = {
  action: "⚡",
  email: "✉️",
  wait: "⏱",
  condition: "🔀",
  "in-app": "💬",
}

const stepStatusColor: Record<UserStepStatus, string> = {
  completed: "bg-emerald-500 border-emerald-400",
  current: "bg-indigo-500 border-indigo-400 ring-2 ring-indigo-400/30",
  skipped: "bg-[var(--color-surface-3)] border-[var(--color-surface-3)]",
  pending: "bg-[var(--color-surface-2)] border-[var(--color-border)]",
}

function healthColor(score: number): string {
  if (score >= 80) {return "text-emerald-400"}
  if (score >= 60) {return "text-amber-400"}
  return "text-rose-400"
}

export default function UserOnboardingFlow() {
  const [tab, setTab] = useState<"flows" | "users" | "cohorts" | "editor">("flows")
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [flowFilter, setFlowFilter] = useState<string>("all")

  const tabs = [
    { id: "flows" as const, label: "Flows", emoji: "🚀" },
    { id: "users" as const, label: "User Progress", emoji: "👤" },
    { id: "cohorts" as const, label: "Cohort Analysis", emoji: "📊" },
    { id: "editor" as const, label: "Step Editor", emoji: "✏️" },
  ]

  const flow = selectedFlow ? FLOWS.find(f => f.id === selectedFlow) : null
  const user = selectedUser ? USER_PROGRESS.find(u => u.userId === selectedUser) : null
  const filteredUsers = USER_PROGRESS.filter(u => flowFilter === "all" || u.flowId === flowFilter)

  const totalActive = FLOWS.filter(f => f.status === "active").reduce((s, f) => s + f.totalUsers, 0)
  const avgCompletion = Math.round(FLOWS.filter(f => f.status === "active").reduce((s, f) => s + f.completionRate, 0) / FLOWS.filter(f => f.status === "active").length)

  const maxCohortStarted = Math.max(...COHORTS.slice(0, 7).map(c => c.started))

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Onboarding Flows</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Design, monitor, and optimize user activation journeys</p>
        </div>
        <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-md text-sm font-medium transition-colors">
          + New Flow
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Users in Active Flows</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{totalActive.toLocaleString()}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">{FLOWS.filter(f => f.status === "active").length} active flows</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Avg Completion Rate</div>
          <div className="text-2xl font-bold text-emerald-400">{avgCompletion}%</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">across active flows</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Users This Week</div>
          <div className="text-2xl font-bold text-indigo-400">261</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">↑ 12% vs last week</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">At-Risk Users</div>
          <div className="text-2xl font-bold text-amber-400">{USER_PROGRESS.filter(u => u.healthScore < 60).length}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">health score below 60</div>
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
                ? "border-indigo-500 text-[var(--color-text-primary)] bg-[var(--color-surface-1)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Flows Tab */}
      {tab === "flows" && (
        <div className="space-y-4">
          {FLOWS.map(f => (
            <div key={f.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <button
                onClick={() => setSelectedFlow(selectedFlow === f.id ? null : f.id)}
                className="w-full text-left p-4 hover:bg-[var(--color-surface-2)]/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{f.name}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", flowStatusColor[f.status])}>
                        {f.status}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">{f.description}</p>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">Target: <span className="font-mono text-[var(--color-text-secondary)]">{f.targetSegment}</span></div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 text-sm">
                    <div className="text-center">
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Users</div>
                      <div className="text-[var(--color-text-primary)]">{f.totalUsers.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Completion</div>
                      <div className={f.completionRate >= 70 ? "text-emerald-400" : f.completionRate >= 50 ? "text-amber-400" : "text-rose-400"}>
                        {f.completionRate}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Avg Days</div>
                      <div className="text-[var(--color-text-primary)]">{f.avgCompletionDays}</div>
                    </div>
                    <span className="text-[var(--color-text-muted)]">{selectedFlow === f.id ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Completion bar */}
                <div className="mt-3 w-full h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", f.completionRate >= 70 ? "bg-emerald-500" : f.completionRate >= 50 ? "bg-amber-500" : "bg-rose-500")}
                    style={{ width: `${f.completionRate}%` }}
                  />
                </div>
              </button>

              {selectedFlow === f.id && (
                <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-surface-0)]">
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Step Funnel</h3>
                  <div className="space-y-2">
                    {f.steps.map((step, idx) => (
                      <div key={step.id} className="flex items-center gap-3">
                        <span className="text-[var(--color-text-muted)] text-xs w-4 text-right">{idx + 1}</span>
                        <span>{stepTypeIcon[step.type]}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-[var(--color-text-primary)]">{step.name}</span>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-emerald-400">{step.completionRate}% complete</span>
                              {step.dropOffRate > 10 && <span className="text-rose-400">↓ {step.dropOffRate}% drop</span>}
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", step.completionRate >= 85 ? "bg-emerald-500" : step.completionRate >= 70 ? "bg-amber-500" : "bg-rose-500")}
                              style={{ width: `${step.completionRate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* User Progress Tab */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <select value={flowFilter} onChange={e => setFlowFilter(e.target.value)} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">All Flows</option>
              {FLOWS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <span className="text-sm text-[var(--color-text-secondary)] self-center">{filteredUsers.length} users</span>
          </div>

          <div className="space-y-3">
            {filteredUsers.map(u => {
              const userFlow = FLOWS.find(f => f.id === u.flowId)
              return (
                <div key={u.userId} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setSelectedUser(selectedUser === u.userId ? null : u.userId)}
                    className="w-full text-left p-4 hover:bg-[var(--color-surface-2)]/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-medium text-indigo-300">
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{u.name}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">{u.email}</span>
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{userFlow?.name} · Day {u.daysInFlow}</div>
                      </div>
                      {/* Step indicators */}
                      <div className="flex items-center gap-1">
                        {u.steps.map((status, idx) => (
                          <div
                            key={idx}
                            className={cn("w-3 h-3 rounded-full border", stepStatusColor[status])}
                            title={status}
                          />
                        ))}
                      </div>
                      <div className="text-right">
                        <div className={cn("text-lg font-bold", healthColor(u.healthScore))}>{u.healthScore}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">health</div>
                      </div>
                    </div>
                  </button>

                  {selectedUser === u.userId && (
                    <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-surface-0)]">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-[var(--color-text-secondary)] uppercase mb-2">Journey Progress</div>
                          <div className="space-y-2">
                            {userFlow?.steps.map((step, idx) => (
                              <div key={step.id} className="flex items-center gap-2 text-sm">
                                <div className={cn("w-2.5 h-2.5 rounded-full border shrink-0", stepStatusColor[u.steps[idx] ?? "pending"])} />
                                <span className={cn(
                                  u.steps[idx] === "completed" ? "text-[var(--color-text-secondary)] line-through" :
                                  u.steps[idx] === "current" ? "text-[var(--color-text-primary)] font-medium" :
                                  u.steps[idx] === "skipped" ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-muted)]"
                                )}>{step.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-[var(--color-text-secondary)] uppercase mb-2">Activity</div>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-[var(--color-text-muted)]">Started</span>
                              <span className="text-[var(--color-text-primary)]">{u.startedAt}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--color-text-muted)]">Last active</span>
                              <span className="text-[var(--color-text-primary)]">{u.lastActiveAt}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--color-text-muted)]">Days in flow</span>
                              <span className="text-[var(--color-text-primary)]">{u.daysInFlow}</span>
                            </div>
                          </div>
                          {u.healthScore < 60 && (
                            <div className="mt-3 p-2 bg-amber-400/5 border border-amber-400/20 rounded-md text-xs text-amber-300">
                              ⚠ At risk — consider a manual outreach
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cohort Analysis Tab */}
      {tab === "cohorts" && (
        <div className="space-y-6">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Weekly Onboarding Cohorts — Developer Quick Start</h3>
            <div className="flex items-end gap-2 h-40 mb-4">
              {COHORTS.slice(0, 7).map(c => (
                <div key={c.week} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end gap-px" style={{ height: "120px" }}>
                    <div className="w-full bg-emerald-500/80 rounded-t-sm" style={{ height: `${(c.completed / maxCohortStarted) * 120}px` }} />
                    <div className="w-full bg-[var(--color-surface-3)]" style={{ height: `${((c.started - c.completed) / maxCohortStarted) * 120}px` }} />
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]" style={{ fontSize: "10px" }}>{c.week}</div>
                  <div className="text-xs text-[var(--color-text-primary)]">{c.rate > 0 ? `${c.rate}%` : "—"}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 text-xs text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Completed</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[var(--color-surface-3)] inline-block" /> Incomplete</span>
            </div>
          </div>

          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            <div className="p-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Cohort Details</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Week</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">Started</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">Completed</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">Rate</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {COHORTS.map(c => (
                  <tr key={c.week} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/20">
                    <td className="p-3 text-[var(--color-text-primary)]">{c.week}</td>
                    <td className="p-3 text-right text-[var(--color-text-primary)]">{c.started}</td>
                    <td className="p-3 text-right text-[var(--color-text-primary)]">{c.completed || "—"}</td>
                    <td className="p-3 text-right font-medium">
                      {c.rate > 0 ? (
                        <span className={c.rate >= 74 ? "text-emerald-400" : c.rate >= 70 ? "text-amber-400" : "text-rose-400"}>
                          {c.rate}%
                        </span>
                      ) : <span className="text-[var(--color-text-muted)]">In progress</span>}
                    </td>
                    <td className="p-3 text-right">
                      <span className={c.trend === "up" ? "text-emerald-400" : c.trend === "down" ? "text-rose-400" : "text-[var(--color-text-muted)]"}>
                        {c.trend === "up" ? "↑" : c.trend === "down" ? "↓" : "→"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step Editor Tab */}
      {tab === "editor" && (
        <div className="flex gap-4">
          <div className="w-56 space-y-1 shrink-0">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-2 mb-2">Select Flow</div>
            {FLOWS.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFlow(f.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                  selectedFlow === f.id
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)]"
                )}
              >
                {f.name}
              </button>
            ))}
          </div>
          <div className="flex-1">
            {flow ? (
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-medium">{flow.name}</h2>
                  <button className="px-3 py-1 text-xs bg-indigo-500 hover:bg-indigo-400 rounded-md transition-colors">
                    + Add Step
                  </button>
                </div>
                <div className="space-y-2">
                  {flow.steps.map((step, idx) => (
                    <div key={step.id} className="flex items-start gap-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md p-3">
                      <span className="text-[var(--color-text-muted)] text-sm w-5 mt-0.5 text-right shrink-0">{idx + 1}</span>
                      <span className="text-lg shrink-0">{stepTypeIcon[step.type]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{step.name}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] rounded">{step.type}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">{step.description}</p>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] shrink-0 text-right">
                        <div>{step.completionRate}% complete</div>
                        <div className="text-[var(--color-text-muted)]">{step.avgCompletionTimeH}h avg</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button className="p-1 hover:bg-[var(--color-surface-3)] rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">✏️</button>
                        <button className="p-1 hover:bg-[var(--color-surface-3)] rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                  <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-md text-sm transition-colors">Save</button>
                  <button className="px-4 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-md text-sm text-[var(--color-text-primary)] transition-colors">Preview</button>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-12 text-center text-[var(--color-text-muted)]">
                Select a flow to edit its steps
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
