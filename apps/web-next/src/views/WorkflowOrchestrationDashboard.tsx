import React, { useState } from "react";
import { cn } from "../lib/utils";

type WorkflowStatus = "running" | "paused" | "completed" | "failed" | "scheduled" | "cancelled";
type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
type TriggerType = "manual" | "schedule" | "webhook" | "event" | "condition";
type StepType = "action" | "condition" | "transform" | "wait" | "loop" | "parallel" | "notify";

interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  status: StepStatus;
  duration: number | null;
  retries: number;
  output: string;
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  trigger: TriggerType;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  steps: WorkflowStep[];
  triggeredBy: string;
  errorMessage: string | null;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  schedule: string | null;
  stepCount: number;
  lastRunStatus: WorkflowStatus | null;
  lastRunAt: string | null;
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  enabled: boolean;
  tags: string[];
}

interface ThroughputPoint {
  time: string;
  completed: number;
  failed: number;
}

const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "wf1",
    name: "User Onboarding Pipeline",
    description: "Provisions tenant, sends welcome email, seeds demo data",
    triggerType: "event",
    schedule: null,
    stepCount: 7,
    lastRunStatus: "completed",
    lastRunAt: "2026-02-22T14:38:00",
    totalRuns: 1248,
    successRate: 98.7,
    avgDuration: 12,
    enabled: true,
    tags: ["onboarding", "user", "email"],
  },
  {
    id: "wf2",
    name: "Nightly Data Export",
    description: "Exports tenant analytics to S3 and sends summary report",
    triggerType: "schedule",
    schedule: "0 2 * * *",
    stepCount: 5,
    lastRunStatus: "completed",
    lastRunAt: "2026-02-22T02:00:00",
    totalRuns: 187,
    successRate: 99.5,
    avgDuration: 340,
    enabled: true,
    tags: ["export", "analytics", "s3"],
  },
  {
    id: "wf3",
    name: "Quota Alert Escalation",
    description: "Notifies ops and optionally suspends service when quota exceeded",
    triggerType: "event",
    schedule: null,
    stepCount: 4,
    lastRunStatus: "running",
    lastRunAt: "2026-02-22T14:52:00",
    totalRuns: 43,
    successRate: 93.0,
    avgDuration: 8,
    enabled: true,
    tags: ["quota", "alert", "ops"],
  },
  {
    id: "wf4",
    name: "Stripe Invoice Sync",
    description: "Syncs invoice data from Stripe to internal billing DB",
    triggerType: "webhook",
    schedule: null,
    stepCount: 6,
    lastRunStatus: "failed",
    lastRunAt: "2026-02-22T13:21:00",
    totalRuns: 2841,
    successRate: 96.2,
    avgDuration: 4,
    enabled: true,
    tags: ["billing", "stripe", "sync"],
  },
  {
    id: "wf5",
    name: "SLA Violation Reporter",
    description: "Generates SLA reports and credits accounts for violations",
    triggerType: "schedule",
    schedule: "0 8 * * MON",
    stepCount: 8,
    lastRunStatus: "completed",
    lastRunAt: "2026-02-17T08:00:00",
    totalRuns: 12,
    successRate: 100,
    avgDuration: 65,
    enabled: true,
    tags: ["sla", "compliance", "billing"],
  },
  {
    id: "wf6",
    name: "Model Warmup Scheduler",
    description: "Pre-warms inference endpoints before peak traffic windows",
    triggerType: "schedule",
    schedule: "30 7 * * 1-5",
    stepCount: 3,
    lastRunStatus: "scheduled",
    lastRunAt: null,
    totalRuns: 0,
    successRate: 0,
    avgDuration: 0,
    enabled: false,
    tags: ["inference", "performance"],
  },
];

const SAMPLE_STEPS: WorkflowStep[] = [
  { id: "s1", name: "Validate Event Payload", type: "action", status: "completed", duration: 120, retries: 0, output: "Payload valid. tenant_id=t-001" },
  { id: "s2", name: "Check Existing User", type: "condition", status: "completed", duration: 85, retries: 0, output: "New user confirmed" },
  { id: "s3", name: "Provision Tenant", type: "action", status: "completed", duration: 3200, retries: 1, output: "Tenant created: t-001" },
  { id: "s4", name: "Send Welcome Email", type: "notify", status: "completed", duration: 230, retries: 0, output: "Email queued: msg_x9k2p" },
  { id: "s5", name: "Wait for Email Confirm", type: "wait", status: "completed", duration: 14000, retries: 0, output: "Confirmed at T+14s" },
  { id: "s6", name: "Seed Demo Data", type: "action", status: "running", duration: null, retries: 0, output: "" },
  { id: "s7", name: "Notify Ops Slack", type: "notify", status: "pending", duration: null, retries: 0, output: "" },
];

const SAMPLE_RUNS: WorkflowRun[] = [
  {
    id: "r1",
    workflowId: "wf1",
    workflowName: "User Onboarding Pipeline",
    status: "running",
    trigger: "event",
    startedAt: "2026-02-22T14:52:08",
    completedAt: null,
    duration: null,
    steps: SAMPLE_STEPS,
    triggeredBy: "webhook:user.created",
    errorMessage: null,
  },
  {
    id: "r2",
    workflowId: "wf4",
    workflowName: "Stripe Invoice Sync",
    status: "failed",
    trigger: "webhook",
    startedAt: "2026-02-22T13:21:00",
    completedAt: "2026-02-22T13:21:04",
    duration: 4,
    steps: [],
    triggeredBy: "webhook:invoice.created",
    errorMessage: "Stripe API rate limit exceeded (429). Retry exhausted.",
  },
  {
    id: "r3",
    workflowId: "wf2",
    workflowName: "Nightly Data Export",
    status: "completed",
    trigger: "schedule",
    startedAt: "2026-02-22T02:00:00",
    completedAt: "2026-02-22T02:05:42",
    duration: 342,
    steps: [],
    triggeredBy: "cron:0 2 * * *",
    errorMessage: null,
  },
];

const THROUGHPUT: ThroughputPoint[] = [
  { time: "08:00", completed: 14, failed: 1 },
  { time: "09:00", completed: 22, failed: 0 },
  { time: "10:00", completed: 31, failed: 2 },
  { time: "11:00", completed: 28, failed: 1 },
  { time: "12:00", completed: 19, failed: 0 },
  { time: "13:00", completed: 25, failed: 3 },
  { time: "14:00", completed: 33, failed: 1 },
];

function wfStatusColor(s: WorkflowStatus) {
  if (s === "completed") {return "text-emerald-400";}
  if (s === "running") {return "text-indigo-400";}
  if (s === "paused") {return "text-amber-400";}
  if (s === "scheduled") {return "text-cyan-400";}
  if (s === "failed") {return "text-rose-400";}
  return "text-[var(--color-text-secondary)]";
}
function wfStatusBg(s: WorkflowStatus) {
  if (s === "completed") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "running") {return "bg-indigo-400/10 text-indigo-400 animate-pulse";}
  if (s === "paused") {return "bg-amber-400/10 text-amber-400";}
  if (s === "scheduled") {return "bg-cyan-400/10 text-cyan-400";}
  if (s === "failed") {return "bg-rose-400/10 text-rose-400";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]";
}
function stepStatusColor(s: StepStatus) {
  if (s === "completed") {return "bg-emerald-500";}
  if (s === "running") {return "bg-indigo-500 animate-pulse";}
  if (s === "failed") {return "bg-rose-500";}
  if (s === "skipped") {return "bg-[var(--color-surface-3)]";}
  return "bg-[var(--color-surface-3)]";
}
function stepTypeEmoji(t: StepType) {
  const m: Record<StepType, string> = { action: "⚙️", condition: "🔀", transform: "🔄", wait: "⏳", loop: "🔁", parallel: "⇒", notify: "📣" };
  return m[t];
}
function triggerBg(t: TriggerType) {
  if (t === "schedule") {return "bg-purple-500/10 text-purple-400";}
  if (t === "webhook") {return "bg-cyan-500/10 text-cyan-400";}
  if (t === "event") {return "bg-indigo-500/10 text-indigo-400";}
  if (t === "condition") {return "bg-amber-500/10 text-amber-400";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]";
}
function fmtDuration(s: number | null) {
  if (s === null) {return "—";}
  if (s < 60) {return `${s}s`;}
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function ThroughputChart({ data }: { data: ThroughputPoint[] }) {
  const maxVal = Math.max(...data.map(d => d.completed + d.failed));
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => {
        const cH = ((d.completed / maxVal) * 100);
        const fH = ((d.failed / maxVal) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col-reverse rounded-sm overflow-hidden" style={{ height: "60px" }}>
              <div className="bg-emerald-500" style={{ height: `${cH}%` }} />
              <div className="bg-rose-500" style={{ height: `${fH}%` }} />
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">{d.time}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function WorkflowOrchestrationDashboard() {
  const [tab, setTab] = useState<"workflows" | "runs" | "analytics" | "history">("workflows");
  const [triggerFilter, setTriggerFilter] = useState<TriggerType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedWf, setSelectedWf] = useState<WorkflowDefinition | null>(null);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);

  const filteredWf = WORKFLOWS.filter(wf => {
    if (triggerFilter !== "all" && wf.triggerType !== triggerFilter) {return false;}
    if (statusFilter !== "all" && wf.lastRunStatus !== statusFilter) {return false;}
    if (search && !wf.name.toLowerCase().includes(search.toLowerCase())) {return false;}
    return true;
  });

  const runningCount = WORKFLOWS.filter(w => w.lastRunStatus === "running").length;
  const failedCount = WORKFLOWS.filter(w => w.lastRunStatus === "failed").length;
  const totalRuns = WORKFLOWS.reduce((a, w) => a + w.totalRuns, 0);
  const avgSuccess = WORKFLOWS.filter(w => w.totalRuns > 0).reduce((a, w, _, arr) => a + w.successRate / arr.length, 0);

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Workflow Orchestration</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Monitor, trigger, and manage automated workflows across the platform</p>
        </div>
        <div className="flex items-center gap-2">
          {runningCount > 0 && (
            <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-1 rounded-full border border-indigo-500/30 animate-pulse">
              {runningCount} running
            </span>
          )}
          {failedCount > 0 && (
            <span className="bg-rose-500/10 text-rose-400 text-xs px-2 py-1 rounded-full border border-rose-500/30">
              {failedCount} failed
            </span>
          )}
          <button className="bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)] text-sm px-3 py-1.5 rounded-lg transition-colors">
            + New Workflow
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border)] px-6">
        <div className="flex gap-6">
          {(["workflows", "runs", "analytics", "history"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "py-3 text-sm font-medium border-b-2 capitalize transition-colors",
                tab === t ? "border-indigo-500 text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* WORKFLOWS TAB */}
        {tab === "workflows" && (
          <div className="flex h-full">
            {/* List */}
            <div className="w-96 border-r border-[var(--color-border)] flex flex-col">
              <div className="p-4 border-b border-[var(--color-border)] space-y-3">
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] text-sm rounded-lg px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <select
                    value={triggerFilter}
                    onChange={e => setTriggerFilter(e.target.value as TriggerType | "all")}
                    className="flex-1 bg-[var(--color-surface-2)] text-sm rounded-lg px-2 py-1.5 text-[var(--color-text-primary)] outline-none"
                  >
                    <option value="all">All Triggers</option>
                    <option value="manual">Manual</option>
                    <option value="schedule">Schedule</option>
                    <option value="webhook">Webhook</option>
                    <option value="event">Event</option>
                    <option value="condition">Condition</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as WorkflowStatus | "all")}
                    className="flex-1 bg-[var(--color-surface-2)] text-sm rounded-lg px-2 py-1.5 text-[var(--color-text-primary)] outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="running">Running</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {filteredWf.map(wf => (
                  <button
                    key={wf.id}
                    onClick={() => setSelectedWf(wf)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-1)] transition-colors",
                      selectedWf?.id === wf.id && "bg-[var(--color-surface-1)] border-l-2 border-l-indigo-500"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate flex-1">{wf.name}</span>
                      {wf.lastRunStatus && (
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full ml-2 shrink-0", wfStatusBg(wf.lastRunStatus))}>
                          {wf.lastRunStatus}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", triggerBg(wf.triggerType))}>{wf.triggerType}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{wf.stepCount} steps</span>
                      {!wf.enabled && <span className="text-xs bg-[var(--color-surface-2)] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded">disabled</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                      <span>{wf.totalRuns} runs</span>
                      {wf.totalRuns > 0 && <span className="text-emerald-500">{wf.successRate.toFixed(1)}% success</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail */}
            <div className="flex-1 overflow-y-auto">
              {selectedWf ? (
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{selectedWf.name}</h2>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">{selectedWf.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn("text-xs px-2 py-0.5 rounded", triggerBg(selectedWf.triggerType))}>{selectedWf.triggerType}</span>
                        {selectedWf.schedule && (
                          <span className="text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded font-mono">{selectedWf.schedule}</span>
                        )}
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", selectedWf.enabled ? "bg-emerald-400/10 text-emerald-400" : "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]")}>
                          {selectedWf.enabled ? "enabled" : "disabled"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-indigo-600 hover:bg-indigo-500 text-sm px-3 py-1.5 rounded-lg text-[var(--color-text-primary)] transition-colors">▶ Run Now</button>
                      <button className="bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-sm px-3 py-1.5 rounded-lg text-[var(--color-text-primary)] transition-colors">Edit</button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    {[
                      { label: "Total Runs", value: selectedWf.totalRuns.toLocaleString() },
                      { label: "Success Rate", value: `${selectedWf.successRate}%`, color: "text-emerald-400" },
                      { label: "Avg Duration", value: fmtDuration(selectedWf.avgDuration) },
                      { label: "Steps", value: selectedWf.stepCount },
                    ].map((s, i) => (
                      <div key={i} className="bg-[var(--color-surface-1)] rounded-xl p-4">
                        <div className={cn("text-xl font-bold", s.color || "text-[var(--color-text-primary)]")}>{s.value}</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Tags */}
                  {selectedWf.tags.length > 0 && (
                    <div className="mb-5">
                      <div className="text-xs text-[var(--color-text-muted)] mb-2">Tags</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedWf.tags.map(tag => (
                          <span key={tag} className="bg-[var(--color-surface-2)] text-[var(--color-text-primary)] text-xs px-2 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent run steps if available */}
                  {selectedWf.id === "wf1" && (
                    <div className="bg-[var(--color-surface-1)] rounded-xl p-5">
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Live Run — Current Steps</h3>
                      <div className="space-y-2">
                        {SAMPLE_STEPS.map((step, i) => (
                          <div key={step.id} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn("w-3 h-3 rounded-full mt-1 shrink-0", stepStatusColor(step.status))} />
                              {i < SAMPLE_STEPS.length - 1 && <div className="w-px flex-1 bg-[var(--color-surface-2)] my-1 min-h-4" />}
                            </div>
                            <div className="flex-1 pb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs">{stepTypeEmoji(step.type)}</span>
                                  <span className="text-sm text-[var(--color-text-primary)]">{step.name}</span>
                                  <span className="text-xs text-[var(--color-text-muted)] capitalize">{step.type}</span>
                                </div>
                                <span className="text-xs text-[var(--color-text-muted)]">{fmtDuration(step.duration)}</span>
                              </div>
                              {step.output && <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">{step.output}</p>}
                              {step.retries > 0 && <p className="text-xs text-amber-500 mt-0.5">↺ {step.retries} retr{step.retries > 1 ? "ies" : "y"}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                  <span className="text-4xl mb-3">⚙️</span>
                  <span className="text-sm">Select a workflow to view details</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RUNS TAB */}
        {tab === "runs" && (
          <div className="flex h-full">
            <div className="w-96 border-r border-[var(--color-border)] overflow-y-auto">
              {SAMPLE_RUNS.map(run => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRun(run)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-1)] transition-colors",
                    selectedRun?.id === run.id && "bg-[var(--color-surface-1)] border-l-2 border-l-indigo-500"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate flex-1">{run.workflowName}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full ml-2 shrink-0", wfStatusBg(run.status))}>
                      {run.status}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    <span>{run.startedAt}</span>
                    {run.duration && <span className="ml-2">· {fmtDuration(run.duration)}</span>}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{run.triggeredBy}</div>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedRun ? (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{selectedRun.workflowName}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", wfStatusBg(selectedRun.status))}>{selectedRun.status}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">{selectedRun.triggeredBy}</span>
                      </div>
                    </div>
                  </div>
                  {selectedRun.errorMessage && (
                    <div className="bg-rose-900/20 border border-rose-800 rounded-xl p-4 mb-4">
                      <div className="text-sm font-medium text-rose-400 mb-1">Error</div>
                      <div className="text-sm text-rose-300 font-mono">{selectedRun.errorMessage}</div>
                      <button className="mt-2 text-xs bg-rose-900/40 text-rose-300 px-2 py-1 rounded hover:bg-rose-900/60 transition-colors">Retry Run</button>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: "Started", value: selectedRun.startedAt },
                      { label: "Completed", value: selectedRun.completedAt || "In progress" },
                      { label: "Duration", value: fmtDuration(selectedRun.duration) },
                    ].map((s, i) => (
                      <div key={i} className="bg-[var(--color-surface-1)] rounded-xl p-4">
                        <div className="text-sm text-[var(--color-text-primary)]">{s.value}</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {selectedRun.steps.length > 0 && (
                    <div className="bg-[var(--color-surface-1)] rounded-xl p-5">
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Step Execution</h3>
                      <div className="space-y-2">
                        {selectedRun.steps.map((step, i) => (
                          <div key={step.id} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn("w-3 h-3 rounded-full mt-1 shrink-0", stepStatusColor(step.status))} />
                              {i < selectedRun.steps.length - 1 && <div className="w-px bg-[var(--color-surface-2)] my-1 min-h-4" />}
                            </div>
                            <div className="flex-1 pb-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-[var(--color-text-primary)]">{step.name}</span>
                                <span className="text-xs text-[var(--color-text-muted)]">{fmtDuration(step.duration)}</span>
                              </div>
                              {step.output && <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">{step.output}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                  <span className="text-4xl mb-3">▶</span>
                  <span className="text-sm">Select a run to view details</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (
          <div className="p-6">
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Workflows", value: WORKFLOWS.length, color: "text-[var(--color-text-primary)]" },
                { label: "Total Runs", value: totalRuns.toLocaleString(), color: "text-indigo-400" },
                { label: "Avg Success Rate", value: `${avgSuccess.toFixed(1)}%`, color: "text-emerald-400" },
                { label: "Currently Running", value: runningCount, color: runningCount > 0 ? "text-indigo-400" : "text-[var(--color-text-secondary)]" },
              ].map((s, i) => (
                <div key={i} className="bg-[var(--color-surface-1)] rounded-xl p-5">
                  <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 mb-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Hourly Throughput</h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                <span className="inline-block w-2 h-2 bg-emerald-500 rounded-sm mr-1" />completed
                <span className="inline-block w-2 h-2 bg-rose-500 rounded-sm mr-1 ml-3" />failed
              </p>
              <ThroughputChart data={THROUGHPUT} />
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-xl p-5">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Workflow Performance</h3>
              <div className="space-y-3">
                {WORKFLOWS.filter(w => w.totalRuns > 0).toSorted((a, b) => b.totalRuns - a.totalRuns).map(wf => (
                  <div key={wf.id} className="flex items-center gap-4">
                    <div className="w-40 text-sm text-[var(--color-text-primary)] truncate">{wf.name}</div>
                    <div className="flex-1 h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${wf.successRate}%` }} />
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] w-16 text-right">{wf.successRate.toFixed(1)}%</div>
                    <div className="text-xs text-[var(--color-text-muted)] w-12 text-right">{wf.totalRuns}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div className="p-6">
            <div className="bg-[var(--color-surface-1)] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Workflow</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Trigger</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Started</th>
                    <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_RUNS.map(run => (
                    <tr key={run.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/50 transition-colors">
                      <td className="px-4 py-3 text-[var(--color-text-primary)]">{run.workflowName}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", wfStatusBg(run.status))}>{run.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded", triggerBg(run.trigger))}>{run.trigger}</span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{run.startedAt}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] text-right">{fmtDuration(run.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
