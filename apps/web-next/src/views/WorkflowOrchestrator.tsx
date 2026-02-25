import React, { useState } from "react"
import { cn } from "../lib/utils"

type WorkflowStatus = "active" | "paused" | "completed" | "failed" | "draft"
type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped"
type RunStatus = "running" | "completed" | "failed" | "cancelled"
type TriggerType = "manual" | "schedule" | "event" | "webhook"

interface WorkflowStep {
  id: string
  name: string
  type: "task" | "condition" | "parallel" | "delay" | "webhook"
  status: StepStatus
  duration?: number
  config: string
  retries: number
  maxRetries: number
}

interface WorkflowRun {
  id: string
  workflowId: string
  startedAt: string
  completedAt?: string
  status: RunStatus
  triggeredBy: string
  triggerType: TriggerType
  stepsTotal: number
  stepsCompleted: number
  stepsFailed: number
  duration?: number
  error?: string
}

interface Workflow {
  id: string
  name: string
  description: string
  status: WorkflowStatus
  trigger: TriggerType
  schedule?: string
  steps: WorkflowStep[]
  lastRun?: string
  nextRun?: string
  totalRuns: number
  successRate: number
  avgDuration: number
  owner: string
  tags: string[]
}

const WORKFLOWS: Workflow[] = [
  {
    id: "wf-001",
    name: "User Onboarding Pipeline",
    description: "Automated onboarding flow for new user registration events",
    status: "active",
    trigger: "event",
    steps: [
      { id: "s1", name: "Validate User Data", type: "task", status: "completed", duration: 120, config: "schema: user-v2", retries: 0, maxRetries: 3 },
      { id: "s2", name: "Create Account", type: "task", status: "completed", duration: 340, config: "service: auth-api", retries: 0, maxRetries: 3 },
      { id: "s3", name: "Send Welcome Email", type: "task", status: "running", duration: undefined, config: "template: welcome-v3", retries: 0, maxRetries: 2 },
      { id: "s4", name: "Setup Defaults", type: "task", status: "pending", duration: undefined, config: "preset: standard", retries: 0, maxRetries: 1 },
      { id: "s5", name: "Notify CRM", type: "webhook", status: "pending", duration: undefined, config: "url: crm.internal/users", retries: 0, maxRetries: 3 },
    ],
    lastRun: "2026-02-22T09:15:00Z",
    nextRun: undefined,
    totalRuns: 1247,
    successRate: 98.4,
    avgDuration: 8,
    owner: "platform-team",
    tags: ["onboarding", "users", "critical"],
  },
  {
    id: "wf-002",
    name: "Nightly Data Sync",
    description: "Sync production data to analytics warehouse every night at 2am",
    status: "active",
    trigger: "schedule",
    schedule: "0 2 * * *",
    steps: [
      { id: "s1", name: "Export PostgreSQL Tables", type: "task", status: "completed", duration: 4500, config: "tables: 24", retries: 0, maxRetries: 2 },
      { id: "s2", name: "Transform Schemas", type: "task", status: "completed", duration: 2200, config: "rules: etl-v4", retries: 0, maxRetries: 2 },
      { id: "s3", name: "Load to BigQuery", type: "task", status: "completed", duration: 8700, config: "dataset: analytics_prod", retries: 0, maxRetries: 3 },
      { id: "s4", name: "Validate Row Counts", type: "condition", status: "completed", duration: 180, config: "tolerance: 0.01%", retries: 0, maxRetries: 1 },
      { id: "s5", name: "Refresh Dashboard Cache", type: "task", status: "completed", duration: 650, config: "dashboards: 12", retries: 0, maxRetries: 1 },
      { id: "s6", name: "Send Report Email", type: "task", status: "completed", duration: 90, config: "recipients: data-team", retries: 0, maxRetries: 2 },
    ],
    lastRun: "2026-02-22T02:00:00Z",
    nextRun: "2026-02-23T02:00:00Z",
    totalRuns: 408,
    successRate: 99.2,
    avgDuration: 275,
    owner: "data-team",
    tags: ["data", "etl", "nightly"],
  },
  {
    id: "wf-003",
    name: "Invoice Processing",
    description: "Extract, validate and route incoming invoices from email",
    status: "active",
    trigger: "webhook",
    steps: [
      { id: "s1", name: "Parse Invoice PDF", type: "task", status: "completed", duration: 2100, config: "ocr: enabled", retries: 0, maxRetries: 2 },
      { id: "s2", name: "Validate Amount & Vendor", type: "condition", status: "failed", duration: 80, config: "rules: finance-v2", retries: 2, maxRetries: 2 },
      { id: "s3", name: "Route for Approval", type: "task", status: "skipped", duration: undefined, config: "threshold: $5000", retries: 0, maxRetries: 1 },
      { id: "s4", name: "Post to ERP", type: "task", status: "pending", duration: undefined, config: "system: netsuite", retries: 0, maxRetries: 3 },
    ],
    lastRun: "2026-02-22T11:45:00Z",
    nextRun: undefined,
    totalRuns: 892,
    successRate: 94.1,
    avgDuration: 45,
    owner: "finance-team",
    tags: ["finance", "invoices"],
  },
  {
    id: "wf-004",
    name: "Deployment Rollback Check",
    description: "Automatic health check post-deployment with rollback capability",
    status: "active",
    trigger: "event",
    steps: [
      { id: "s1", name: "Wait for Deploy", type: "delay", status: "completed", duration: 300, config: "wait: 5min", retries: 0, maxRetries: 0 },
      { id: "s2", name: "Health Check API", type: "task", status: "completed", duration: 45, config: "endpoint: /health", retries: 0, maxRetries: 3 },
      { id: "s3", name: "Check Error Rate", type: "condition", status: "completed", duration: 30, config: "threshold: 1%", retries: 0, maxRetries: 1 },
      { id: "s4", name: "Notify Slack", type: "webhook", status: "completed", duration: 200, config: "channel: #deploys", retries: 0, maxRetries: 2 },
    ],
    lastRun: "2026-02-22T08:30:00Z",
    nextRun: undefined,
    totalRuns: 2103,
    successRate: 99.8,
    avgDuration: 6,
    owner: "platform-team",
    tags: ["deployments", "health", "critical"],
  },
  {
    id: "wf-005",
    name: "Monthly Billing Cycle",
    description: "Generate and send invoices to all active subscribers",
    status: "paused",
    trigger: "schedule",
    schedule: "0 0 1 * *",
    steps: [
      { id: "s1", name: "Calculate Usage", type: "task", status: "pending", duration: undefined, config: "period: last-month", retries: 0, maxRetries: 2 },
      { id: "s2", name: "Apply Discounts", type: "task", status: "pending", duration: undefined, config: "rules: pricing-v3", retries: 0, maxRetries: 1 },
      { id: "s3", name: "Generate Invoices", type: "task", status: "pending", duration: undefined, config: "format: pdf+json", retries: 0, maxRetries: 2 },
      { id: "s4", name: "Charge Payment Methods", type: "parallel", status: "pending", duration: undefined, config: "concurrency: 50", retries: 0, maxRetries: 3 },
      { id: "s5", name: "Send Receipts", type: "task", status: "pending", duration: undefined, config: "template: receipt-v2", retries: 0, maxRetries: 2 },
    ],
    lastRun: "2026-02-01T00:00:00Z",
    nextRun: "2026-03-01T00:00:00Z",
    totalRuns: 24,
    successRate: 95.8,
    avgDuration: 1840,
    owner: "billing-team",
    tags: ["billing", "monthly", "revenue"],
  },
  {
    id: "wf-006",
    name: "Threat Detection Response",
    description: "Automated response to security threat signals from SIEM",
    status: "active",
    trigger: "event",
    steps: [
      { id: "s1", name: "Parse Threat Signal", type: "task", status: "completed", duration: 40, config: "schema: threat-v1", retries: 0, maxRetries: 2 },
      { id: "s2", name: "Enrich with Threat Intel", type: "task", status: "completed", duration: 890, config: "sources: 3", retries: 0, maxRetries: 2 },
      { id: "s3", name: "Score Risk Level", type: "condition", status: "completed", duration: 60, config: "model: risk-v2", retries: 0, maxRetries: 1 },
      { id: "s4", name: "Block IP / User", type: "task", status: "completed", duration: 120, config: "provider: cloudflare", retries: 0, maxRetries: 3 },
      { id: "s5", name: "Create Incident Ticket", type: "webhook", status: "completed", duration: 310, config: "system: jira", retries: 0, maxRetries: 3 },
      { id: "s6", name: "Alert Security Team", type: "task", status: "completed", duration: 150, config: "channel: #sec-alerts", retries: 0, maxRetries: 2 },
    ],
    lastRun: "2026-02-22T10:22:00Z",
    nextRun: undefined,
    totalRuns: 567,
    successRate: 99.1,
    avgDuration: 25,
    owner: "security-team",
    tags: ["security", "critical", "automated"],
  },
  {
    id: "wf-007",
    name: "ML Model Retraining",
    description: "Weekly automated retraining of recommendation models on fresh data",
    status: "draft",
    trigger: "schedule",
    schedule: "0 4 * * 1",
    steps: [
      { id: "s1", name: "Pull Training Data", type: "task", status: "pending", duration: undefined, config: "source: data-lake", retries: 0, maxRetries: 2 },
      { id: "s2", name: "Feature Engineering", type: "task", status: "pending", duration: undefined, config: "pipeline: fe-v3", retries: 0, maxRetries: 1 },
      { id: "s3", name: "Train Model", type: "task", status: "pending", duration: undefined, config: "gpu: 4x A100", retries: 0, maxRetries: 2 },
      { id: "s4", name: "Evaluate Metrics", type: "condition", status: "pending", duration: undefined, config: "baseline: current", retries: 0, maxRetries: 1 },
      { id: "s5", name: "Deploy if Better", type: "task", status: "pending", duration: undefined, config: "strategy: blue-green", retries: 0, maxRetries: 2 },
    ],
    lastRun: undefined,
    nextRun: "2026-02-24T04:00:00Z",
    totalRuns: 0,
    successRate: 0,
    avgDuration: 0,
    owner: "ml-team",
    tags: ["ml", "training", "models"],
  },
]

const RUNS: WorkflowRun[] = [
  { id: "run-001", workflowId: "wf-001", startedAt: "2026-02-22T09:15:00Z", completedAt: "2026-02-22T09:15:08Z", status: "completed", triggeredBy: "event:user.registered", triggerType: "event", stepsTotal: 5, stepsCompleted: 4, stepsFailed: 0, duration: 8 },
  { id: "run-002", workflowId: "wf-002", startedAt: "2026-02-22T02:00:00Z", completedAt: "2026-02-22T06:35:00Z", status: "completed", triggeredBy: "scheduler", triggerType: "schedule", stepsTotal: 6, stepsCompleted: 6, stepsFailed: 0, duration: 275 },
  { id: "run-003", workflowId: "wf-003", startedAt: "2026-02-22T11:45:00Z", status: "failed", triggeredBy: "webhook:invoice-service", triggerType: "webhook", stepsTotal: 4, stepsCompleted: 1, stepsFailed: 1, error: "Vendor not found in approved list" },
  { id: "run-004", workflowId: "wf-004", startedAt: "2026-02-22T08:30:00Z", completedAt: "2026-02-22T08:36:00Z", status: "completed", triggeredBy: "event:deploy.completed", triggerType: "event", stepsTotal: 4, stepsCompleted: 4, stepsFailed: 0, duration: 6 },
  { id: "run-005", workflowId: "wf-006", startedAt: "2026-02-22T10:22:00Z", completedAt: "2026-02-22T10:22:25Z", status: "completed", triggeredBy: "event:threat.detected", triggerType: "event", stepsTotal: 6, stepsCompleted: 6, stepsFailed: 0, duration: 25 },
  { id: "run-006", workflowId: "wf-001", startedAt: "2026-02-22T08:50:00Z", completedAt: "2026-02-22T08:50:07Z", status: "completed", triggeredBy: "event:user.registered", triggerType: "event", stepsTotal: 5, stepsCompleted: 5, stepsFailed: 0, duration: 7 },
  { id: "run-007", workflowId: "wf-004", startedAt: "2026-02-22T07:15:00Z", completedAt: "2026-02-22T07:21:00Z", status: "completed", triggeredBy: "event:deploy.completed", triggerType: "event", stepsTotal: 4, stepsCompleted: 4, stepsFailed: 0, duration: 6 },
  { id: "run-008", workflowId: "wf-003", startedAt: "2026-02-21T16:30:00Z", completedAt: "2026-02-21T16:31:00Z", status: "completed", triggeredBy: "webhook:invoice-service", triggerType: "webhook", stepsTotal: 4, stepsCompleted: 4, stepsFailed: 0, duration: 60 },
  { id: "run-009", workflowId: "wf-001", startedAt: "2026-02-21T14:20:00Z", status: "running", triggeredBy: "event:user.registered", triggerType: "event", stepsTotal: 5, stepsCompleted: 2, stepsFailed: 0 },
]

const statusColor: Record<WorkflowStatus, string> = {
  active: "text-emerald-400 bg-emerald-400/10",
  paused: "text-amber-400 bg-amber-400/10",
  completed: "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10",
  failed: "text-rose-400 bg-rose-400/10",
  draft: "text-primary bg-primary/10",
}

const stepStatusColor: Record<StepStatus, string> = {
  pending: "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]",
  running: "bg-primary/20 text-primary",
  completed: "bg-emerald-400/10 text-emerald-400",
  failed: "bg-rose-400/10 text-rose-400",
  skipped: "bg-[var(--color-surface-3)]/50 text-[var(--color-text-muted)]",
}

const runStatusColor: Record<RunStatus, string> = {
  running: "text-primary",
  completed: "text-emerald-400",
  failed: "text-rose-400",
  cancelled: "text-[var(--color-text-secondary)]",
}

const stepTypeIcon: Record<WorkflowStep["type"], string> = {
  task: "⚙️",
  condition: "🔀",
  parallel: "⫸",
  delay: "⏱",
  webhook: "🪝",
}

const triggerIcon: Record<TriggerType, string> = {
  manual: "👤",
  schedule: "🕐",
  event: "⚡",
  webhook: "🪝",
}

function fmtDuration(mins?: number): string {
  if (mins == null) {return "—"}
  if (mins < 1) {return "<1m"}
  if (mins < 60) {return `${mins}m`}
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmtTime(iso?: string): string {
  if (!iso) {return "—"}
  const d = new Date(iso)
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
      <div className="text-xs text-[var(--color-text-secondary)] mb-1">{label}</div>
      <div className={cn("text-2xl font-bold", color)}>{value}</div>
      <div className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</div>
    </div>
  )
}

export default function WorkflowOrchestrator() {
  const [tab, setTab] = useState<"workflows" | "runs" | "builder" | "analytics">("workflows")
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [triggerFilter, setTriggerFilter] = useState<string>("all")

  const tabs = [
    { id: "workflows" as const, label: "Workflows", emoji: "🔄" },
    { id: "runs" as const, label: "Run History", emoji: "📋" },
    { id: "builder" as const, label: "Step Editor", emoji: "🛠️" },
    { id: "analytics" as const, label: "Analytics", emoji: "📊" },
  ]

  const filteredWorkflows = WORKFLOWS.filter(w => {
    if (statusFilter !== "all" && w.status !== statusFilter) {return false}
    if (triggerFilter !== "all" && w.trigger !== triggerFilter) {return false}
    return true
  })

  const workflow = selectedWorkflow ? WORKFLOWS.find(w => w.id === selectedWorkflow) : null
  const run = selectedRun ? RUNS.find(r => r.id === selectedRun) : null

  const totalRuns = RUNS.length
  const successRuns = RUNS.filter(r => r.status === "completed").length
  const failedRuns = RUNS.filter(r => r.status === "failed").length
  const runningRuns = RUNS.filter(r => r.status === "running").length

  // Daily run volume for past 7 days (mock)
  const dailyVolume = [
    { day: "Mon", runs: 42, failed: 2 },
    { day: "Tue", runs: 56, failed: 3 },
    { day: "Wed", runs: 38, failed: 1 },
    { day: "Thu", runs: 61, failed: 4 },
    { day: "Fri", runs: 74, failed: 2 },
    { day: "Sat", runs: 29, failed: 1 },
    { day: "Sun", runs: 18, failed: 0 },
  ]
  const maxVol = Math.max(...dailyVolume.map(d => d.runs))

  // Workflow success rates for analytics
  const wfStats = WORKFLOWS.filter(w => w.totalRuns > 0).map(w => ({
    name: w.name.length > 25 ? w.name.slice(0, 25) + "…" : w.name,
    rate: w.successRate,
    runs: w.totalRuns,
    avgDuration: w.avgDuration,
  }))

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workflow Orchestrator</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Automate, monitor and manage multi-step workflows</p>
        </div>
        <button className="px-4 py-2 bg-primary hover:bg-primary rounded-md text-sm font-medium transition-colors">
          + New Workflow
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Workflows" value={WORKFLOWS.filter(w => w.status === "active").length.toString()} sub="2 paused, 1 draft" color="text-emerald-400" />
        <StatCard label="Today's Runs" value={totalRuns.toString()} sub={`${runningRuns} currently running`} color="text-primary" />
        <StatCard label="Success Rate" value={`${((successRuns / totalRuns) * 100).toFixed(1)}%`} sub={`${failedRuns} failed today`} color="text-emerald-400" />
        <StatCard label="Avg Duration" value="42m" sub="across all workflows" color="text-[var(--color-text-primary)]" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)] pb-0">
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

      {/* Workflows Tab */}
      {tab === "workflows" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={triggerFilter}
              onChange={e => setTriggerFilter(e.target.value)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
            >
              <option value="all">All Triggers</option>
              <option value="schedule">Schedule</option>
              <option value="event">Event</option>
              <option value="webhook">Webhook</option>
              <option value="manual">Manual</option>
            </select>
            <span className="text-sm text-[var(--color-text-secondary)] self-center">{filteredWorkflows.length} workflows</span>
          </div>

          {/* Workflow list */}
          <div className="space-y-3">
            {filteredWorkflows.map(wf => (
              <div key={wf.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                <button
                  onClick={() => setSelectedWorkflow(selectedWorkflow === wf.id ? null : wf.id)}
                  className="w-full text-left p-4 hover:bg-[var(--color-surface-2)]/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{wf.name}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColor[wf.status])}>
                          {wf.status}
                        </span>
                        {wf.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] truncate">{wf.description}</p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0 text-sm">
                      <div className="text-center">
                        <div className="text-[var(--color-text-secondary)] text-xs mb-0.5">Trigger</div>
                        <div className="text-[var(--color-text-primary)]">{triggerIcon[wf.trigger]} {wf.trigger}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[var(--color-text-secondary)] text-xs mb-0.5">Success</div>
                        <div className={wf.successRate >= 98 ? "text-emerald-400" : wf.successRate >= 95 ? "text-amber-400" : "text-rose-400"}>
                          {wf.totalRuns > 0 ? `${wf.successRate}%` : "—"}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[var(--color-text-secondary)] text-xs mb-0.5">Avg Time</div>
                        <div className="text-[var(--color-text-primary)]">{fmtDuration(wf.avgDuration)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[var(--color-text-secondary)] text-xs mb-0.5">Total Runs</div>
                        <div className="text-[var(--color-text-primary)]">{wf.totalRuns.toLocaleString()}</div>
                      </div>
                      <span className="text-[var(--color-text-muted)]">{selectedWorkflow === wf.id ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded: Steps */}
                {selectedWorkflow === wf.id && (
                  <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-surface-0)]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Steps ({wf.steps.length})</h3>
                      <div className="flex gap-2 text-xs text-[var(--color-text-secondary)]">
                        {wf.schedule && <span>🕐 {wf.schedule}</span>}
                        {wf.lastRun && <span>Last: {fmtTime(wf.lastRun)}</span>}
                        {wf.nextRun && <span>Next: {fmtTime(wf.nextRun)}</span>}
                      </div>
                    </div>

                    {/* Step pipeline visualization */}
                    <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
                      {wf.steps.map((step, idx) => (
                        <React.Fragment key={step.id}>
                          <div className={cn("shrink-0 rounded-md px-3 py-2 text-xs border", {
                            "border-emerald-500/50 bg-emerald-400/5": step.status === "completed",
                            "border-primary/50 bg-primary/5 animate-pulse": step.status === "running",
                            "border-rose-500/50 bg-rose-400/5": step.status === "failed",
                            "border-[var(--color-border)] bg-[var(--color-surface-1)]": step.status === "pending",
                            "border-[var(--color-border)]/30 bg-[var(--color-surface-1)]/30": step.status === "skipped",
                          })}>
                            <div className="flex items-center gap-1">
                              <span>{stepTypeIcon[step.type]}</span>
                              <span className={cn("font-medium", {
                                "text-emerald-400": step.status === "completed",
                                "text-primary": step.status === "running",
                                "text-rose-400": step.status === "failed",
                                "text-[var(--color-text-secondary)]": step.status === "pending",
                                "text-[var(--color-text-muted)]": step.status === "skipped",
                              })}>{step.name}</span>
                            </div>
                            {step.duration && <div className="text-[var(--color-text-muted)] mt-0.5">{step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(1)}s`}</div>}
                            {step.retries > 0 && <div className="text-amber-400/70 mt-0.5">↺ {step.retries}/{step.maxRetries}</div>}
                          </div>
                          {idx < wf.steps.length - 1 && (
                            <span className="text-[var(--color-text-muted)] shrink-0">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Owner + Actions */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)]">Owner: {wf.owner}</span>
                      <div className="flex gap-2">
                        {wf.status === "active" && (
                          <button className="px-3 py-1 text-xs bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 rounded-md transition-colors">
                            ⏸ Pause
                          </button>
                        )}
                        {wf.status === "paused" && (
                          <button className="px-3 py-1 text-xs bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 rounded-md transition-colors">
                            ▶ Resume
                          </button>
                        )}
                        <button className="px-3 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors">
                          ▶ Run Now
                        </button>
                        <button className="px-3 py-1 text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] rounded-md transition-colors">
                          ✏️ Edit
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run History Tab */}
      {tab === "runs" && (
        <div className="space-y-4">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Run ID</th>
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Workflow</th>
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Triggered By</th>
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Started</th>
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Duration</th>
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Steps</th>
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {RUNS.map(r => {
                  const wf = WORKFLOWS.find(w => w.id === r.workflowId)
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        onClick={() => setSelectedRun(selectedRun === r.id ? null : r.id)}
                        className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/30 cursor-pointer transition-colors"
                      >
                        <td className="p-3 font-mono text-xs text-[var(--color-text-secondary)]">{r.id}</td>
                        <td className="p-3 text-[var(--color-text-primary)]">{wf?.name ?? r.workflowId}</td>
                        <td className="p-3 text-[var(--color-text-secondary)] text-xs">
                          {triggerIcon[r.triggerType]} {r.triggeredBy}
                        </td>
                        <td className="p-3 text-[var(--color-text-secondary)] text-xs">{fmtTime(r.startedAt)}</td>
                        <td className="p-3 text-[var(--color-text-primary)]">{fmtDuration(r.duration)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400">{r.stepsCompleted}</span>
                            <span className="text-[var(--color-text-muted)]">/</span>
                            <span className="text-[var(--color-text-primary)]">{r.stepsTotal}</span>
                            {r.stepsFailed > 0 && <span className="text-rose-400">({r.stepsFailed} failed)</span>}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={cn("font-medium", runStatusColor[r.status])}>
                            {r.status === "running" ? "⟳ " : r.status === "completed" ? "✓ " : r.status === "failed" ? "✗ " : ""}
                            {r.status}
                          </span>
                        </td>
                      </tr>
                      {selectedRun === r.id && r.error && (
                        <tr className="border-b border-[var(--color-border)]/50">
                          <td colSpan={7} className="px-3 pb-3">
                            <div className="bg-rose-400/5 border border-rose-400/20 rounded-md p-3">
                              <div className="text-xs text-rose-400 font-medium mb-1">Error Details</div>
                              <div className="text-xs text-rose-300 font-mono">{r.error}</div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {selectedRun === r.id && r.status === "running" && (
                        <tr className="border-b border-[var(--color-border)]/50">
                          <td colSpan={7} className="px-3 pb-3">
                            <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
                              <div className="text-xs text-primary font-medium mb-2">Progress</div>
                              <ProgressBar value={(r.stepsCompleted / r.stepsTotal) * 100} color="bg-primary" />
                              <div className="text-xs text-[var(--color-text-secondary)] mt-1">{r.stepsCompleted} of {r.stepsTotal} steps complete</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step Editor Tab */}
      {tab === "builder" && (
        <div className="space-y-4">
          <div className="flex gap-4">
            {/* Workflow selector */}
            <div className="w-64 space-y-2">
              <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-2">Select Workflow</div>
              {WORKFLOWS.map(wf => (
                <button
                  key={wf.id}
                  onClick={() => setSelectedWorkflow(wf.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                    selectedWorkflow === wf.id
                      ? "bg-primary/20 text-indigo-300 border border-primary/30"
                      : "bg-[var(--color-surface-1)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)]"
                  )}
                >
                  <div className="font-medium truncate">{wf.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{wf.steps.length} steps</div>
                </button>
              ))}
            </div>

            {/* Step editor */}
            <div className="flex-1">
              {workflow ? (
                <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-medium">{workflow.name}</h2>
                    <button className="px-3 py-1 text-xs bg-primary hover:bg-primary rounded-md transition-colors">
                      + Add Step
                    </button>
                  </div>
                  <div className="space-y-2">
                    {workflow.steps.map((step, idx) => (
                      <div key={step.id} className="flex items-center gap-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md p-3">
                        <span className="text-[var(--color-text-muted)] text-sm w-5 text-center">{idx + 1}</span>
                        <span className="text-lg">{stepTypeIcon[step.type]}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{step.name}</span>
                            <span className={cn("text-xs px-1.5 py-0.5 rounded", stepStatusColor[step.status])}>
                              {step.status}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">{step.config}</div>
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          Retries: {step.maxRetries}
                        </div>
                        <div className="flex gap-1">
                          <button className="p-1 hover:bg-[var(--color-surface-3)] rounded text-[var(--color-text-secondary)]">✏️</button>
                          <button className="p-1 hover:bg-[var(--color-surface-3)] rounded text-[var(--color-text-secondary)]">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                    <button className="px-4 py-2 bg-primary hover:bg-primary rounded-md text-sm transition-colors">
                      Save Changes
                    </button>
                    <button className="px-4 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-md text-sm text-[var(--color-text-primary)] transition-colors">
                      Discard
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-12 text-center text-[var(--color-text-muted)]">
                  Select a workflow to view and edit its steps
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {/* Daily volume chart */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Daily Run Volume (Last 7 Days)</h3>
            <div className="flex items-end gap-3 h-36">
              {dailyVolume.map(d => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: "120px" }}>
                    <div
                      className="w-full bg-rose-400/60 rounded-t"
                      style={{ height: `${(d.failed / maxVol) * 120}px` }}
                    />
                    <div
                      className="w-full bg-primary rounded-t"
                      style={{ height: `${((d.runs - d.failed) / maxVol) * 120}px` }}
                    />
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{d.day}</div>
                  <div className="text-xs text-[var(--color-text-primary)] font-mono">{d.runs}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary inline-block" /> Success</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-400/60 inline-block" /> Failed</span>
            </div>
          </div>

          {/* Workflow performance table */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Workflow Performance</h3>
            <div className="space-y-3">
              {wfStats.map(ws => (
                <div key={ws.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-primary)]">{ws.name}</span>
                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                      <span>{ws.runs.toLocaleString()} runs</span>
                      <span>{fmtDuration(ws.avgDuration)} avg</span>
                      <span className={cn("font-medium", ws.rate >= 98 ? "text-emerald-400" : ws.rate >= 95 ? "text-amber-400" : "text-rose-400")}>
                        {ws.rate}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar
                    value={ws.rate}
                    color={ws.rate >= 98 ? "bg-emerald-500" : ws.rate >= 95 ? "bg-amber-500" : "bg-rose-500"}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-primary">4,241</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Total Runs This Month</div>
            </div>
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">98.6%</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Overall Success Rate</div>
            </div>
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">127h</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Total Compute Time</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
