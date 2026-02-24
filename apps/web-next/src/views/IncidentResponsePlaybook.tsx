import React, { useState } from "react";
import { cn } from "../lib/utils";

type PlaybookStatus = "active" | "draft" | "archived" | "testing";
type StepType = "action" | "decision" | "notify" | "escalate" | "verify" | "wait";
type Severity = "critical" | "high" | "medium" | "low";
type RunStatus = "running" | "completed" | "failed" | "paused";
type StepState = "pending" | "running" | "done" | "skipped" | "failed";

interface PlaybookStep {
  id: string;
  order: number;
  type: StepType;
  title: string;
  description: string;
  assignedTo: string;
  estimatedMinutes: number;
  requiredApproval: boolean;
  automatable: boolean;
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  status: PlaybookStatus;
  category: string;
  owner: string;
  version: string;
  steps: PlaybookStep[];
  avgResolutionMinutes: number;
  totalRuns: number;
  successRate: number;
  lastTestedAt: string | null;
  createdAt: string;
  tags: string[];
}

interface ActiveRunStep {
  stepId: string;
  title: string;
  state: StepState;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  notes: string;
}

interface PlaybookRun {
  id: string;
  playbookId: string;
  playbookName: string;
  incidentId: string;
  status: RunStatus;
  severity: Severity;
  startedAt: string;
  completedAt: string | null;
  assignee: string;
  steps: ActiveRunStep[];
  currentStepIndex: number;
}

const PLAYBOOKS: Playbook[] = [
  {
    id: "pb1",
    name: "Database Outage Response",
    description: "Step-by-step response for complete or partial database unavailability",
    severity: "critical",
    status: "active",
    category: "Infrastructure",
    owner: "SRE Team",
    version: "3.2",
    steps: [
      { id: "s1", order: 1, type: "verify", title: "Confirm database outage", description: "Verify via monitoring dashboards and direct query attempts", assignedTo: "On-call SRE", estimatedMinutes: 2, requiredApproval: false, automatable: true },
      { id: "s2", order: 2, type: "notify", title: "Page on-call SRE lead", description: "Trigger PagerDuty incident for SRE lead", assignedTo: "Automated", estimatedMinutes: 1, requiredApproval: false, automatable: true },
      { id: "s3", order: 3, type: "action", title: "Check replica failover status", description: "Verify if auto-failover has triggered or needs manual promotion", assignedTo: "SRE Lead", estimatedMinutes: 5, requiredApproval: false, automatable: false },
      { id: "s4", order: 4, type: "decision", title: "Auto-failover succeeded?", description: "If yes, proceed to verify. If no, manually promote replica.", assignedTo: "SRE Lead", estimatedMinutes: 3, requiredApproval: false, automatable: false },
      { id: "s5", order: 5, type: "action", title: "Promote read replica to primary", description: "Run promotion script: ./scripts/promote-replica.sh --region us-east-1", assignedTo: "SRE Lead", estimatedMinutes: 8, requiredApproval: true, automatable: false },
      { id: "s6", order: 6, type: "verify", title: "Confirm service recovery", description: "Validate health checks pass and queries succeed across all services", assignedTo: "SRE Lead", estimatedMinutes: 5, requiredApproval: false, automatable: true },
      { id: "s7", order: 7, type: "notify", title: "Update status page", description: "Post recovery notice on status.example.com", assignedTo: "On-call", estimatedMinutes: 3, requiredApproval: false, automatable: true },
    ],
    avgResolutionMinutes: 28,
    totalRuns: 14,
    successRate: 92.9,
    lastTestedAt: "2026-02-10",
    createdAt: "2025-06-01",
    tags: ["database", "infrastructure", "critical"],
  },
  {
    id: "pb2",
    name: "Security Breach Response",
    description: "Coordinated response to confirmed or suspected security breach",
    severity: "critical",
    status: "active",
    category: "Security",
    owner: "Security Team",
    version: "2.1",
    steps: [
      { id: "s1", order: 1, type: "action", title: "Isolate affected systems", description: "Immediately revoke access tokens and block network paths", assignedTo: "Security Engineer", estimatedMinutes: 10, requiredApproval: false, automatable: false },
      { id: "s2", order: 2, type: "escalate", title: "Notify CISO and Legal", description: "Alert CISO, Legal, and Privacy Officer immediately", assignedTo: "Security Lead", estimatedMinutes: 5, requiredApproval: false, automatable: false },
      { id: "s3", order: 3, type: "action", title: "Preserve forensic evidence", description: "Snapshot disk state, copy logs to secure storage before any remediation", assignedTo: "Security Engineer", estimatedMinutes: 15, requiredApproval: true, automatable: false },
      { id: "s4", order: 4, type: "action", title: "Rotate all affected credentials", description: "Rotate API keys, secrets, and service account credentials", assignedTo: "Security + Ops", estimatedMinutes: 20, requiredApproval: true, automatable: false },
      { id: "s5", order: 5, type: "notify", title: "Customer notification decision", description: "Legal determines if and when customers must be notified (GDPR 72hr)", assignedTo: "Legal + Privacy", estimatedMinutes: 30, requiredApproval: true, automatable: false },
    ],
    avgResolutionMinutes: 180,
    totalRuns: 3,
    successRate: 100,
    lastTestedAt: "2026-01-15",
    createdAt: "2025-09-01",
    tags: ["security", "breach", "critical", "gdpr"],
  },
  {
    id: "pb3",
    name: "High Error Rate Response",
    description: "Response for API error rates exceeding alert thresholds",
    severity: "high",
    status: "active",
    category: "Application",
    owner: "Platform Team",
    version: "1.4",
    steps: [
      { id: "s1", order: 1, type: "verify", title: "Confirm alert accuracy", description: "Cross-check Datadog, Sentry, and application logs", assignedTo: "On-call Engineer", estimatedMinutes: 3, requiredApproval: false, automatable: true },
      { id: "s2", order: 2, type: "action", title: "Identify error pattern", description: "Cluster errors by type, endpoint, and deployment cohort", assignedTo: "On-call Engineer", estimatedMinutes: 10, requiredApproval: false, automatable: false },
      { id: "s3", order: 3, type: "decision", title: "Recent deployment culprit?", description: "Check if error surge correlates with a deployment in the last hour", assignedTo: "On-call Engineer", estimatedMinutes: 5, requiredApproval: false, automatable: false },
      { id: "s4", order: 4, type: "action", title: "Rollback deployment", description: "Initiate rollback via deploy pipeline: ./ops rollback --env prod", assignedTo: "On-call Engineer", estimatedMinutes: 8, requiredApproval: true, automatable: false },
      { id: "s5", order: 5, type: "verify", title: "Confirm error rate recovery", description: "Error rate should return to < 0.1% baseline within 5 minutes", assignedTo: "On-call Engineer", estimatedMinutes: 5, requiredApproval: false, automatable: true },
    ],
    avgResolutionMinutes: 22,
    totalRuns: 31,
    successRate: 96.8,
    lastTestedAt: "2026-02-18",
    createdAt: "2025-04-15",
    tags: ["error-rate", "application", "rollback"],
  },
  {
    id: "pb4",
    name: "DDoS Mitigation",
    description: "Response to distributed denial-of-service attack traffic patterns",
    severity: "high",
    status: "active",
    category: "Security",
    owner: "Network Security",
    version: "2.0",
    steps: [
      { id: "s1", order: 1, type: "verify", title: "Confirm attack pattern", description: "Validate traffic spike is malicious (not organic). Check IP distribution.", assignedTo: "Network Engineer", estimatedMinutes: 5, requiredApproval: false, automatable: true },
      { id: "s2", order: 2, type: "action", title: "Enable Cloudflare Under Attack mode", description: "Toggle CF Under Attack mode and activate JS challenge globally", assignedTo: "Network Engineer", estimatedMinutes: 2, requiredApproval: false, automatable: true },
      { id: "s3", order: 3, type: "action", title: "Block attacking IP ranges", description: "Add identified CIDR blocks to WAF deny list", assignedTo: "Network Engineer", estimatedMinutes: 10, requiredApproval: false, automatable: false },
      { id: "s4", order: 4, type: "escalate", title: "Engage CDN DDoS protection", description: "Contact Cloudflare / Akamai DDoS support for L3/L4 attack mitigation", assignedTo: "Network Lead", estimatedMinutes: 15, requiredApproval: true, automatable: false },
    ],
    avgResolutionMinutes: 45,
    totalRuns: 7,
    successRate: 85.7,
    lastTestedAt: null,
    createdAt: "2025-11-01",
    tags: ["ddos", "network", "security"],
  },
  {
    id: "pb5",
    name: "On-Call Escalation SOP",
    description: "Standard escalation procedure when initial on-call cannot resolve incident",
    severity: "medium",
    status: "draft",
    category: "Process",
    owner: "Engineering Management",
    version: "0.9",
    steps: [
      { id: "s1", order: 1, type: "wait", title: "Initial response window", description: "Allow 15 minutes for initial on-call to assess and attempt resolution", assignedTo: "On-call", estimatedMinutes: 15, requiredApproval: false, automatable: false },
      { id: "s2", order: 2, type: "escalate", title: "Escalate to senior engineer", description: "Page secondary on-call if issue unresolved after 15 minutes", assignedTo: "On-call", estimatedMinutes: 5, requiredApproval: false, automatable: true },
      { id: "s3", order: 3, type: "escalate", title: "Escalate to manager if needed", description: "If SLA breach is imminent (30+ minutes), notify engineering manager", assignedTo: "Senior Engineer", estimatedMinutes: 5, requiredApproval: false, automatable: false },
    ],
    avgResolutionMinutes: 35,
    totalRuns: 0,
    successRate: 0,
    lastTestedAt: null,
    createdAt: "2026-02-15",
    tags: ["escalation", "process", "on-call"],
  },
];

const ACTIVE_RUN: PlaybookRun = {
  id: "run-001",
  playbookId: "pb1",
  playbookName: "Database Outage Response",
  incidentId: "INC-4821",
  status: "running",
  severity: "critical",
  startedAt: "2026-02-22T14:48:00",
  completedAt: null,
  assignee: "Morgan Chen",
  currentStepIndex: 3,
  steps: [
    { stepId: "s1", title: "Confirm database outage", state: "done", startedAt: "14:48:02", completedAt: "14:48:30", completedBy: "Automated", notes: "RDS health check failed. 0/3 endpoints responding." },
    { stepId: "s2", title: "Page on-call SRE lead", state: "done", startedAt: "14:48:30", completedAt: "14:48:32", completedBy: "Automated", notes: "PagerDuty incident #382 created. Morgan Chen paged." },
    { stepId: "s3", title: "Check replica failover status", state: "done", startedAt: "14:49:00", completedAt: "14:53:21", completedBy: "Morgan Chen", notes: "Auto-failover did not trigger. us-east-1b replica available." },
    { stepId: "s4", title: "Auto-failover succeeded?", state: "done", startedAt: "14:53:21", completedAt: "14:54:10", completedBy: "Morgan Chen", notes: "No — proceeding to manual promotion." },
    { stepId: "s5", title: "Promote read replica to primary", state: "running", startedAt: "14:54:15", completedAt: null, completedBy: null, notes: "" },
    { stepId: "s6", title: "Confirm service recovery", state: "pending", startedAt: null, completedAt: null, completedBy: null, notes: "" },
    { stepId: "s7", title: "Update status page", state: "pending", startedAt: null, completedAt: null, completedBy: null, notes: "" },
  ],
};

function sevBg(s: Severity) {
  if (s === "critical") {return "bg-rose-500/10 text-rose-400";}
  if (s === "high") {return "bg-orange-500/10 text-orange-400";}
  if (s === "medium") {return "bg-amber-500/10 text-amber-400";}
  return "bg-emerald-500/10 text-emerald-400";
}
function pbStatusBg(s: PlaybookStatus) {
  if (s === "active") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "draft") {return "bg-amber-400/10 text-amber-400";}
  if (s === "testing") {return "bg-indigo-400/10 text-indigo-400";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]";
}
function stepTypeBg(t: StepType) {
  const m: Record<StepType, string> = {
    action: "bg-indigo-500/10 text-indigo-400",
    decision: "bg-purple-500/10 text-purple-400",
    notify: "bg-cyan-500/10 text-cyan-400",
    escalate: "bg-orange-500/10 text-orange-400",
    verify: "bg-emerald-500/10 text-emerald-400",
    wait: "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]",
  };
  return m[t];
}
function stepStateColor(s: StepState) {
  if (s === "done") {return "bg-emerald-500";}
  if (s === "running") {return "bg-indigo-500 animate-pulse";}
  if (s === "failed") {return "bg-rose-500";}
  if (s === "skipped") {return "bg-[var(--color-surface-3)]";}
  return "bg-[var(--color-surface-3)]";
}

export default function IncidentResponsePlaybook() {
  const [tab, setTab] = useState<"playbooks" | "active-runs" | "history" | "templates">("playbooks");
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Playbook | null>(null);

  const categories = Array.from(new Set(PLAYBOOKS.map(p => p.category)));

  const filtered = PLAYBOOKS.filter(p => {
    if (sevFilter !== "all" && p.severity !== sevFilter) {return false;}
    if (catFilter !== "all" && p.category !== catFilter) {return false;}
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) {return false;}
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Incident Response Playbooks</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Standardized response procedures for incidents across severity levels</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-1 rounded-full border border-indigo-500/30 animate-pulse">
            1 active run
          </span>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)] text-sm px-3 py-1.5 rounded-lg transition-colors">
            + New Playbook
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border)] px-6">
        <div className="flex gap-6">
          {(["playbooks", "active-runs", "history", "templates"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "py-3 text-sm font-medium border-b-2 capitalize transition-colors",
                tab === t ? "border-indigo-500 text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {t.replace("-", " ")}
              {t === "active-runs" && (
                <span className="ml-1.5 bg-indigo-500 text-[var(--color-text-primary)] text-xs px-1.5 rounded-full">1</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* PLAYBOOKS TAB */}
        {tab === "playbooks" && (
          <div className="flex h-full">
            <div className="w-96 border-r border-[var(--color-border)] flex flex-col">
              <div className="p-4 border-b border-[var(--color-border)] space-y-3">
                <input
                  type="text"
                  placeholder="Search playbooks..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] text-sm rounded-lg px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <select
                    value={sevFilter}
                    onChange={e => setSevFilter(e.target.value as Severity | "all")}
                    className="flex-1 bg-[var(--color-surface-2)] text-sm rounded-lg px-2 py-1.5 text-[var(--color-text-primary)] outline-none"
                  >
                    <option value="all">All Severity</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={catFilter}
                    onChange={e => setCatFilter(e.target.value)}
                    className="flex-1 bg-[var(--color-surface-2)] text-sm rounded-lg px-2 py-1.5 text-[var(--color-text-primary)] outline-none"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {filtered.map(pb => (
                  <button
                    key={pb.id}
                    onClick={() => setSelected(pb)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-1)] transition-colors",
                      selected?.id === pb.id && "bg-[var(--color-surface-1)] border-l-2 border-l-indigo-500"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{pb.name}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full ml-2 shrink-0", pbStatusBg(pb.status))}>{pb.status}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", sevBg(pb.severity))}>{pb.severity}</span>
                      <span className="text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded">{pb.category}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {pb.steps.length} steps · ~{pb.avgResolutionMinutes}min avg
                      {pb.totalRuns > 0 && <span className="ml-2 text-emerald-500">{pb.successRate.toFixed(0)}% success</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selected ? (
                <div className="p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{selected.name} <span className="text-[var(--color-text-muted)] text-sm font-normal">v{selected.version}</span></h2>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">{selected.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn("text-xs px-2 py-0.5 rounded", sevBg(selected.severity))}>{selected.severity}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", pbStatusBg(selected.status))}>{selected.status}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">Owner: {selected.owner}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)] text-sm px-3 py-1.5 rounded-lg transition-colors">▶ Execute</button>
                      <button className="bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-sm px-3 py-1.5 rounded-lg text-[var(--color-text-primary)] transition-colors">Edit</button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    {[
                      { label: "Steps", value: selected.steps.length },
                      { label: "Total Runs", value: selected.totalRuns },
                      { label: "Success Rate", value: selected.totalRuns > 0 ? `${selected.successRate.toFixed(0)}%` : "N/A", color: "text-emerald-400" },
                      { label: "Avg Resolution", value: `~${selected.avgResolutionMinutes}m` },
                    ].map((s, i) => (
                      <div key={i} className="bg-[var(--color-surface-1)] rounded-xl p-4">
                        <div className={cn("text-xl font-bold", s.color || "text-[var(--color-text-primary)]")}>{s.value}</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Steps */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-5">
                    <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Response Steps</h3>
                    <div className="space-y-1">
                      {selected.steps.map((step, i) => (
                        <div key={step.id} className="flex items-start gap-3">
                          <div className="flex flex-col items-center shrink-0">
                            <div className="w-6 h-6 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] text-xs flex items-center justify-center font-medium">{step.order}</div>
                            {i < selected.steps.length - 1 && <div className="w-px bg-[var(--color-surface-2)] h-4 mt-1" />}
                          </div>
                          <div className="flex-1 pb-3">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm text-[var(--color-text-primary)]">{step.title}</span>
                              <span className={cn("text-xs px-1.5 py-0.5 rounded", stepTypeBg(step.type))}>{step.type}</span>
                              {step.requiredApproval && <span className="text-xs bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded">approval</span>}
                              {step.automatable && <span className="text-xs bg-emerald-900/40 text-emerald-400 px-1.5 py-0.5 rounded">auto</span>}
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)]">{step.description}</p>
                            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Assigned: {step.assignedTo} · Est. {step.estimatedMinutes}m</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selected.tags.map(tag => (
                      <span key={tag} className="bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] text-xs px-2 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                  <span className="text-4xl mb-3">📖</span>
                  <span className="text-sm">Select a playbook to view steps</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACTIVE RUNS TAB */}
        {tab === "active-runs" && (
          <div className="p-6">
            <div className="bg-rose-900/20 border border-rose-800 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-rose-400">🔴 LIVE — {ACTIVE_RUN.playbookName}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">Incident {ACTIVE_RUN.incidentId}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Started: {ACTIVE_RUN.startedAt} · Assignee: {ACTIVE_RUN.assignee}</div>
                </div>
                <button className="bg-amber-900/40 text-amber-400 text-xs px-3 py-1.5 rounded-lg hover:bg-amber-900/60 transition-colors">Pause Run</button>
              </div>
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-xl p-5">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Live Step Tracker</h3>
              <div className="space-y-1">
                {ACTIVE_RUN.steps.map((step, i) => (
                  <div key={step.stepId} className={cn(
                    "flex items-start gap-3 p-3 rounded-lg",
                    step.state === "running" && "bg-indigo-900/20 border border-indigo-800",
                    step.state === "done" && "opacity-60",
                    step.state === "pending" && "opacity-40"
                  )}>
                    <div className="flex flex-col items-center shrink-0">
                      <div className={cn("w-3 h-3 rounded-full mt-1", stepStateColor(step.state))} />
                      {i < ACTIVE_RUN.steps.length - 1 && <div className="w-px bg-[var(--color-surface-2)] h-4 mt-1" />}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center justify-between">
                        <span className={cn("text-sm", step.state === "running" ? "text-indigo-300 font-medium" : "text-[var(--color-text-primary)]")}>{step.title}</span>
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                          {step.startedAt && <span>Start: {step.startedAt}</span>}
                          {step.completedAt && <span>Done: {step.completedAt}</span>}
                        </div>
                      </div>
                      {step.completedBy && <div className="text-xs text-[var(--color-text-muted)] mt-0.5">By: {step.completedBy}</div>}
                      {step.notes && <div className="text-xs text-[var(--color-text-secondary)] mt-1 bg-[var(--color-surface-2)] rounded px-2 py-1">{step.notes}</div>}
                      {step.state === "running" && (
                        <div className="mt-2 flex gap-2">
                          <button className="text-xs bg-emerald-700 hover:bg-emerald-600 text-[var(--color-text-primary)] px-2 py-1 rounded transition-colors">✓ Mark Done</button>
                          <button className="text-xs bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] px-2 py-1 rounded transition-colors">Skip</button>
                          <button className="text-xs bg-rose-900/40 text-rose-400 px-2 py-1 rounded hover:bg-rose-900/60 transition-colors">Mark Failed</button>
                        </div>
                      )}
                    </div>
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
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Playbook</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Incident</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Severity</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Assignee</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {[ACTIVE_RUN].map(run => (
                    <tr key={run.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/50 transition-colors">
                      <td className="px-4 py-3 text-[var(--color-text-primary)]">{run.playbookName}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] font-mono text-xs">{run.incidentId}</td>
                      <td className="px-4 py-3"><span className={cn("text-xs px-2 py-0.5 rounded", sevBg(run.severity))}>{run.severity}</span></td>
                      <td className="px-4 py-3"><span className="text-xs bg-indigo-400/10 text-indigo-400 px-2 py-0.5 rounded-full animate-pulse">{run.status}</span></td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{run.assignee}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{run.startedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TEMPLATES TAB */}
        {tab === "templates" && (
          <div className="p-6 grid grid-cols-3 gap-4">
            {[
              { icon: "🗄️", name: "Database Incident", desc: "Outage, performance, replication failure" },
              { icon: "🔐", name: "Security Incident", desc: "Breach, unauthorized access, data exposure" },
              { icon: "🌐", name: "Network Incident", desc: "DDoS, connectivity, CDN issues" },
              { icon: "⚡", name: "Application Incident", desc: "High error rates, latency spikes, crashes" },
              { icon: "☁️", name: "Cloud Provider Incident", desc: "AWS/GCP/Azure outage response" },
              { icon: "📊", name: "Data Pipeline Incident", desc: "ETL failures, data quality degradation" },
            ].map((t, i) => (
              <div key={i} className="bg-[var(--color-surface-1)] rounded-xl p-5 hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer">
                <div className="text-3xl mb-3">{t.icon}</div>
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{t.name}</div>
                <div className="text-xs text-[var(--color-text-muted)] mb-3">{t.desc}</div>
                <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Use template →</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
