import React, { useState } from "react";
import { cn } from "../lib/utils";

type ChangeType = "standard" | "emergency" | "normal" | "major";
type ChangeStatus = "draft" | "pending" | "approved" | "rejected" | "in-progress" | "completed" | "cancelled";
type RiskLevel = "low" | "medium" | "high" | "critical";
type ApprovalDecision = "approved" | "rejected" | "pending" | "abstain";

interface Approver {
  name: string;
  role: string;
  decision: ApprovalDecision;
  comment: string | null;
  decidedAt: string | null;
}

interface ChangeRequest {
  id: string;
  title: string;
  type: ChangeType;
  status: ChangeStatus;
  risk: RiskLevel;
  requestedBy: string;
  team: string;
  service: string;
  environment: string;
  scheduledStart: string;
  scheduledEnd: string;
  description: string;
  rollbackPlan: string;
  testPlan: string;
  approvers: Approver[];
  createdAt: string;
  updatedAt: string;
  linkedTickets: string[];
  maintenanceWindow: boolean;
}

const statusBadge: Record<ChangeStatus, string> = {
  draft:       "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)] border border-[var(--color-surface-3)]/30",
  pending:     "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  approved:    "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  rejected:    "bg-rose-500/20 text-rose-400 border border-rose-500/30",
  "in-progress":"bg-sky-500/20 text-sky-400 border border-sky-500/30",
  completed:   "bg-primary/20 text-primary border border-primary/30",
  cancelled:   "bg-[var(--color-surface-3)]/20 text-[var(--color-text-muted)] border border-[var(--color-surface-3)]/30",
};

const typeColor: Record<ChangeType, string> = {
  standard:   "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)]",
  normal:     "bg-sky-500/20 text-sky-400",
  major:      "bg-primary/20 text-primary",
  emergency:  "bg-rose-500/20 text-rose-400",
};

const riskBadge: Record<RiskLevel, string> = {
  low:      "bg-emerald-500/20 text-emerald-400",
  medium:   "bg-amber-500/20 text-amber-400",
  high:     "bg-orange-500/20 text-orange-400",
  critical: "bg-red-500/20 text-red-400",
};

const decisionIcon: Record<ApprovalDecision, { icon: string; color: string }> = {
  approved: { icon: "✓", color: "text-emerald-400" },
  rejected: { icon: "✗", color: "text-rose-400" },
  pending:  { icon: "⋯", color: "text-[var(--color-text-muted)]" },
  abstain:  { icon: "—", color: "text-[var(--color-text-muted)]" },
};

const changes: ChangeRequest[] = [
  {
    id: "CR-2201",
    title: "Upgrade PostgreSQL 14 → 16 on prod",
    type: "major",
    status: "pending",
    risk: "high",
    requestedBy: "alice",
    team: "Platform",
    service: "postgres-primary",
    environment: "production",
    scheduledStart: "2025-02-28 02:00",
    scheduledEnd: "2025-02-28 06:00",
    description: "In-place major version upgrade of the production PostgreSQL cluster from 14.10 to 16.2. Requires ~15min downtime for switchover.",
    rollbackPlan: "Restore from pre-upgrade snapshot. Estimated recovery: 30min. Snapshot taken 1hr before window.",
    testPlan: "Staged 3 days prior in staging. pg_upgrade check runs clean. Tested all stored procedures and extensions.",
    approvers: [
      { name: "xavier",  role: "VP Engineering",     decision: "approved",  comment: "Staging looked good. Proceed.", decidedAt: "2025-02-22 10:30" },
      { name: "tim",     role: "Platform Architect",  decision: "approved",  comment: "Migration plan is solid.",       decidedAt: "2025-02-22 11:00" },
      { name: "cto",     role: "CTO",                decision: "pending",   comment: null,                             decidedAt: null },
    ],
    createdAt: "2025-02-20",
    updatedAt: "4h ago",
    linkedTickets: ["PLAT-4892", "OPS-1201"],
    maintenanceWindow: true,
  },
  {
    id: "CR-2199",
    title: "Deploy rate limiter middleware to prod API",
    type: "normal",
    status: "approved",
    risk: "medium",
    requestedBy: "bob",
    team: "Backend",
    service: "api-gateway",
    environment: "production",
    scheduledStart: "2025-02-23 14:00",
    scheduledEnd: "2025-02-23 14:30",
    description: "Deploy new Redis-backed rate limiting middleware (PR #1482). Zero-downtime deployment via rolling update.",
    rollbackPlan: "Feature flag to disable. Rollback deploy in 5min if error rate spikes.",
    testPlan: "Load tested in staging. No regression in p99. Canary passed at 5% traffic.",
    approvers: [
      { name: "alice",   role: "Senior Engineer",    decision: "approved",  comment: "Tested thoroughly.", decidedAt: "2025-02-22 09:00" },
      { name: "xavier",  role: "VP Engineering",     decision: "approved",  comment: "Good to go.",        decidedAt: "2025-02-22 09:15" },
    ],
    createdAt: "2025-02-21",
    updatedAt: "2h ago",
    linkedTickets: ["BE-3341"],
    maintenanceWindow: false,
  },
  {
    id: "CR-2195",
    title: "Emergency: Revert webhook worker OOM config",
    type: "emergency",
    status: "in-progress",
    risk: "critical",
    requestedBy: "carol",
    team: "Platform",
    service: "webhook-worker",
    environment: "production",
    scheduledStart: "2025-02-22 14:15",
    scheduledEnd: "2025-02-22 14:45",
    description: "Emergency change to revert the webhook-worker memory limit from 256Mi to 512Mi. Active incident CR-INC-2195.",
    rollbackPlan: "N/A — this IS the rollback of the original change.",
    testPlan: "N/A — emergency. Monitoring closely after apply.",
    approvers: [
      { name: "xavier",  role: "VP Engineering", decision: "approved", comment: "Approved. Fix the outage.", decidedAt: "2025-02-22 14:12" },
    ],
    createdAt: "2025-02-22",
    updatedAt: "12m ago",
    linkedTickets: ["INC-2195", "PLAT-4901"],
    maintenanceWindow: false,
  },
  {
    id: "CR-2188",
    title: "Rotate production JWT signing keys",
    type: "normal",
    status: "pending",
    risk: "high",
    requestedBy: "eve",
    team: "Security",
    service: "auth-service",
    environment: "production",
    scheduledStart: "2025-03-01 03:00",
    scheduledEnd: "2025-03-01 04:00",
    description: "Rotate HS256 JWT signing keys and migrate to RS256. Requires coordinated deploy of auth-service and all consumer services.",
    rollbackPlan: "Keep old keys active for 24hr overlap. Can roll back by re-enabling old key in Vault.",
    testPlan: "Tested in staging with 4 consumer services. All token flows verified.",
    approvers: [
      { name: "security", role: "CISO",              decision: "approved",  comment: "Long overdue.",       decidedAt: "2025-02-21 16:00" },
      { name: "xavier",   role: "VP Engineering",    decision: "pending",   comment: null,                  decidedAt: null },
      { name: "tim",      role: "Platform Architect", decision: "pending",  comment: null,                  decidedAt: null },
    ],
    createdAt: "2025-02-18",
    updatedAt: "1d ago",
    linkedTickets: ["SEC-882", "AUTH-219"],
    maintenanceWindow: true,
  },
  {
    id: "CR-2180",
    title: "Enable WAF on production load balancer",
    type: "standard",
    status: "completed",
    risk: "medium",
    requestedBy: "frank",
    team: "Security",
    service: "load-balancer",
    environment: "production",
    scheduledStart: "2025-02-19 23:00",
    scheduledEnd: "2025-02-20 00:00",
    description: "Enable AWS WAF with OWASP managed ruleset on the production ALB. Rate limiting rules for login endpoint.",
    rollbackPlan: "Disable WAF association in 2 CLI commands. Estimated 60s.",
    testPlan: "Tested in staging for 7 days. No false positives on legitimate traffic patterns.",
    approvers: [
      { name: "security", role: "CISO",           decision: "approved",  comment: "Required by Q1 audit.",  decidedAt: "2025-02-18 14:00" },
      { name: "xavier",   role: "VP Engineering", decision: "approved",  comment: "Approved.",              decidedAt: "2025-02-18 15:30" },
    ],
    createdAt: "2025-02-15",
    updatedAt: "3d ago",
    linkedTickets: ["SEC-860"],
    maintenanceWindow: false,
  },
  {
    id: "CR-2176",
    title: "Increase Elasticsearch shard count for search index",
    type: "major",
    status: "rejected",
    risk: "high",
    requestedBy: "grace",
    team: "Search",
    service: "elasticsearch",
    environment: "production",
    scheduledStart: "2025-02-17 02:00",
    scheduledEnd: "2025-02-17 08:00",
    description: "Reindex search with 12 shards (up from 5) to reduce per-shard size and improve query throughput.",
    rollbackPlan: "Reindex back to 5 shards. Estimated 4-6hr recovery window.",
    testPlan: "Tested in staging — reindex took 3.5hr. Some query latency improvement observed.",
    approvers: [
      { name: "tim",    role: "Platform Architect", decision: "rejected", comment: "Risk window too wide. We have the DB migration same week. Defer to March.", decidedAt: "2025-02-16 11:00" },
      { name: "xavier", role: "VP Engineering",     decision: "abstain",  comment: "Deferring to Tim's judgment on scheduling.", decidedAt: "2025-02-16 11:30" },
    ],
    createdAt: "2025-02-14",
    updatedAt: "5d ago",
    linkedTickets: ["SRCH-104"],
    maintenanceWindow: false,
  },
];

const pendingCount  = changes.filter(c => c.status === "pending").length;
const approvedCount = changes.filter(c => c.status === "approved").length;
const emergencyCount = changes.filter(c => c.type === "emergency" && (c.status === "pending" || c.status === "in-progress")).length;

export default function ChangeApprovalBoard() {
  const [tab, setTab]                 = useState<"board" | "detail" | "calendar">("board");
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<ChangeStatus | "all">("all");
  const [typeFilter, setTypeFilter]   = useState<ChangeType | "all">("all");

  const filtered = changes.filter(c =>
    (statusFilter === "all" || c.status === statusFilter) &&
    (typeFilter === "all" || c.type === typeFilter)
  );

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "board",    label: "Change Board" },
    { id: "calendar", label: "Scheduled" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Change Approval Board</h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">Change requests, approvals, and change management workflow</p>
          </div>
          <button className="px-4 py-2 rounded-lg bg-primary hover:bg-primary text-sm font-medium transition-colors">
            + Submit Change
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Pending Approval",   value: pendingCount,                   color: "text-amber-400" },
            { label: "Approved (7d)",      value: approvedCount,                  color: "text-emerald-400" },
            { label: "Active Emergencies", value: emergencyCount,                 color: "text-rose-400" },
            { label: "Total (30d)",        value: changes.length,                 color: "text-[var(--color-text-primary)]" },
          ].map(kpi => (
            <div key={kpi.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{kpi.label}</p>
              <p className={cn("text-3xl font-bold mt-1", kpi.color)}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--color-border)]">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedChange(null); }}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                tab === t.id
                  ? "border-primary text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Change Board */}
        {tab === "board" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              {(["all","pending","approved","in-progress","completed","rejected"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setStatusFilter(f === "all" ? "all" : f); setSelectedChange(null); }}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", statusFilter === f ? "bg-primary text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")}
                >
                  {f === "all" ? "All" : f.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                </button>
              ))}
              <div className="ml-auto flex gap-2">
                {(["all","emergency","major","normal","standard"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTypeFilter(f === "all" ? "all" : f)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", typeFilter === f ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}
                  >
                    {f === "all" ? "All types" : f}
                  </button>
                ))}
              </div>
            </div>

            {selectedChange ? (
              /* Detail view */
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5 space-y-5">
                <button onClick={() => setSelectedChange(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm">← Back</button>

                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-xs font-mono text-[var(--color-text-muted)]">{selectedChange.id}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge[selectedChange.status])}>{selectedChange.status}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", typeColor[selectedChange.type])}>{selectedChange.type}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", riskBadge[selectedChange.risk])}>risk: {selectedChange.risk}</span>
                    {selectedChange.maintenanceWindow && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">maintenance window</span>}
                  </div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedChange.title}</h2>
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Requested by", value: selectedChange.requestedBy },
                    { label: "Team",         value: selectedChange.team },
                    { label: "Service",      value: selectedChange.service },
                    { label: "Environment",  value: selectedChange.environment },
                    { label: "Starts",       value: selectedChange.scheduledStart },
                    { label: "Ends",         value: selectedChange.scheduledEnd },
                    { label: "Created",      value: selectedChange.createdAt },
                    { label: "Updated",      value: selectedChange.updatedAt },
                  ].map(m => (
                    <div key={m.label} className="bg-[var(--color-surface-2)]/60 rounded-lg p-3">
                      <p className="text-xs text-[var(--color-text-muted)]">{m.label}</p>
                      <p className="text-sm font-medium text-[var(--color-text-primary)] mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Description / Plans */}
                {[
                  { label: "Description",   text: selectedChange.description },
                  { label: "Rollback Plan", text: selectedChange.rollbackPlan },
                  { label: "Test Plan",     text: selectedChange.testPlan },
                ].map(s => (
                  <div key={s.label} className="bg-[var(--color-surface-2)]/40 rounded-lg p-4">
                    <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">{s.label}</p>
                    <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{s.text}</p>
                  </div>
                ))}

                {/* Approvals */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Approvals ({selectedChange.approvers.filter(a => a.decision !== "pending").length}/{selectedChange.approvers.length})</h3>
                  <div className="space-y-2">
                    {selectedChange.approvers.map(a => {
                      const d = decisionIcon[a.decision];
                      return (
                        <div key={a.name} className="bg-[var(--color-surface-2)]/50 rounded-lg p-3 flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center text-xs font-bold flex-shrink-0">{a.name[0].toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[var(--color-text-primary)]">{a.name}</span>
                              <span className="text-xs text-[var(--color-text-muted)]">{a.role}</span>
                              <span className={cn("text-sm font-bold ml-auto", d.color)}>{d.icon} {a.decision}</span>
                            </div>
                            {a.comment && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{a.comment}</p>}
                            {a.decidedAt && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{a.decidedAt}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Linked tickets */}
                {selectedChange.linkedTickets.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">Linked tickets</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedChange.linkedTickets.map(t => (
                        <span key={t} className="text-xs bg-[var(--color-surface-2)] text-primary px-2 py-1 rounded font-mono">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {selectedChange.status === "pending" && (
                  <div className="flex gap-3">
                    <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors">Approve</button>
                    <button className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-sm font-medium transition-colors">Reject</button>
                    <button className="px-4 py-2 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] rounded-lg text-sm font-medium transition-colors">Abstain</button>
                  </div>
                )}
              </div>
            ) : (
              /* Change list */
              <div className="space-y-3">
                {filtered.map(cr => {
                  const approvedCount = cr.approvers.filter(a => a.decision === "approved").length;
                  const totalApprovers = cr.approvers.length;
                  return (
                    <button
                      key={cr.id}
                      onClick={() => setSelectedChange(cr)}
                      className={cn(
                        "w-full text-left bg-[var(--color-surface-1)] border rounded-xl p-4 transition-colors hover:border-[var(--color-surface-3)]",
                        cr.type === "emergency" ? "border-rose-500/30" : "border-[var(--color-border)]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-mono text-[var(--color-text-muted)]">{cr.id}</span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge[cr.status])}>{cr.status}</span>
                            <span className={cn("text-xs px-1.5 py-0.5 rounded", typeColor[cr.type])}>{cr.type}</span>
                            <span className={cn("text-xs px-1.5 py-0.5 rounded", riskBadge[cr.risk])}>{cr.risk} risk</span>
                          </div>
                          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{cr.title}</p>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{cr.service} · {cr.team} · by {cr.requestedBy} · {cr.updatedAt}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className={cn(
                            "text-xs font-medium px-2 py-1 rounded",
                            approvedCount === totalApprovers ? "text-emerald-400 bg-emerald-500/10" : "text-[var(--color-text-secondary)] bg-[var(--color-surface-2)]"
                          )}>
                            {approvedCount}/{totalApprovers} approved
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-1">{cr.scheduledStart}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Calendar / Scheduled view */}
        {tab === "calendar" && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)]">Upcoming scheduled changes</p>
            {changes
              .filter(c => !["completed","rejected","cancelled"].includes(c.status))
              .toSorted((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
              .map(cr => (
                <div key={cr.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-4">
                  <div className="bg-primary/20 border border-primary/30 rounded-lg p-3 text-center flex-shrink-0 w-20">
                    <p className="text-xs text-primary font-medium">{cr.scheduledStart.slice(5, 10)}</p>
                    <p className="text-xs text-indigo-300">{cr.scheduledStart.slice(11, 16)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge[cr.status])}>{cr.status}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", typeColor[cr.type])}>{cr.type}</span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{cr.title}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{cr.service} · {cr.team}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={cn("text-xs px-2 py-0.5 rounded", riskBadge[cr.risk])}>{cr.risk} risk</span>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">to {cr.scheduledEnd.slice(11, 16)}</p>
                  </div>
                </div>
              ))
            }
          </div>
        )}

      </div>
    </div>
  );
}
