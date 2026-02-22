import React, { useState } from "react";
import { cn } from "../lib/utils";

type ChangeType = "standard" | "normal" | "emergency" | "major";
type ChangeStatus = "draft" | "submitted" | "review" | "approved" | "scheduled" | "implementing" | "completed" | "failed" | "cancelled";
type ChangeRisk = "low" | "medium" | "high" | "critical";
type ImpactArea = "database" | "api" | "frontend" | "infra" | "security" | "network" | "data" | "auth";
type ApproverStatus = "pending" | "approved" | "rejected";

interface ChangeApprover {
  id: string;
  name: string;
  role: string;
  status: ApproverStatus;
  comment: string | null;
  respondedAt: string | null;
}

interface RollbackStep {
  order: number;
  action: string;
  estimatedMinutes: number;
}

interface ChangeRequest {
  id: string;
  title: string;
  type: ChangeType;
  status: ChangeStatus;
  risk: ChangeRisk;
  impactAreas: ImpactArea[];
  summary: string;
  requester: string;
  requestedAt: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  implementedAt: string | null;
  completedAt: string | null;
  approvers: ChangeApprover[];
  rollbackPlan: RollbackStep[];
  downtime: boolean;
  estimatedDowntimeMinutes: number;
  testingNotes: string;
  postImplementNotes: string;
}

interface CalendarDay {
  date: string;
  changeCount: number;
  hasEmergency: boolean;
}

const CHANGES: ChangeRequest[] = [
  {
    id: "CHG-1841",
    title: "Database connection pool size increase",
    type: "standard",
    status: "completed",
    risk: "low",
    impactAreas: ["database", "api"],
    summary: "Increase PostgreSQL connection pool from 100 to 200 connections to address contention during peak load.",
    requester: "Morgan Chen",
    requestedAt: "2026-02-18T10:00:00",
    scheduledStart: "2026-02-20T02:00:00",
    scheduledEnd: "2026-02-20T03:00:00",
    implementedAt: "2026-02-20T02:05:00",
    completedAt: "2026-02-20T02:38:00",
    approvers: [
      { id: "a1", name: "Taylor Reed", role: "DBA", status: "approved", comment: "Pool size increase is safe with current RAM", respondedAt: "2026-02-19T14:00:00" },
      { id: "a2", name: "Jordan Kim", role: "SRE Lead", status: "approved", comment: null, respondedAt: "2026-02-19T15:30:00" },
    ],
    rollbackPlan: [
      { order: 1, action: "Revert pool size config to 100", estimatedMinutes: 2 },
      { order: 2, action: "Restart connection pool service", estimatedMinutes: 3 },
      { order: 3, action: "Verify metrics return to baseline", estimatedMinutes: 5 },
    ],
    downtime: false,
    estimatedDowntimeMinutes: 0,
    testingNotes: "Tested in staging with 150 concurrent connections. Stable.",
    postImplementNotes: "Connection contention p95 latency dropped from 850ms to 120ms. Success.",
  },
  {
    id: "CHG-1842",
    title: "API v3 gateway rollout — canary phase 1",
    type: "normal",
    status: "approved",
    risk: "medium",
    impactAreas: ["api", "frontend", "network"],
    summary: "Route 10% of production traffic to new API gateway v3. Full rollout follows after 48h monitoring.",
    requester: "Alex Patel",
    requestedAt: "2026-02-20T09:00:00",
    scheduledStart: "2026-02-23T10:00:00",
    scheduledEnd: "2026-02-23T11:00:00",
    implementedAt: null,
    completedAt: null,
    approvers: [
      { id: "a3", name: "Jordan Kim", role: "SRE Lead", status: "approved", comment: "Canary is well-scoped. Approve.", respondedAt: "2026-02-21T11:00:00" },
      { id: "a4", name: "Casey Nguyen", role: "CTO", status: "approved", comment: "Go ahead.", respondedAt: "2026-02-21T13:00:00" },
      { id: "a5", name: "Taylor Reed", role: "DBA", status: "pending", comment: null, respondedAt: null },
    ],
    rollbackPlan: [
      { order: 1, action: "Route 100% traffic back to v2 gateway", estimatedMinutes: 5 },
      { order: 2, action: "Disable v3 gateway service", estimatedMinutes: 2 },
      { order: 3, action: "Verify v2 health checks pass", estimatedMinutes: 5 },
    ],
    downtime: false,
    estimatedDowntimeMinutes: 0,
    testingNotes: "Load tested at 2x expected canary traffic. P99 latency within 5% of v2.",
    postImplementNotes: "",
  },
  {
    id: "CHG-1843",
    title: "EMERGENCY: Revoke compromised API keys",
    type: "emergency",
    status: "completed",
    risk: "critical",
    impactAreas: ["security", "auth", "api"],
    summary: "Immediate revocation of 14 API keys exposed in public GitHub repository. Affected integrations will break until re-issued.",
    requester: "Security Team",
    requestedAt: "2026-02-22T11:45:00",
    scheduledStart: "2026-02-22T11:50:00",
    scheduledEnd: "2026-02-22T12:00:00",
    implementedAt: "2026-02-22T11:52:00",
    completedAt: "2026-02-22T12:10:00",
    approvers: [
      { id: "a6", name: "Casey Nguyen", role: "CTO", status: "approved", comment: "Approve immediately. Security emergency.", respondedAt: "2026-02-22T11:48:00" },
    ],
    rollbackPlan: [
      { order: 1, action: "Emergency rollback not applicable — security action irreversible", estimatedMinutes: 0 },
    ],
    downtime: true,
    estimatedDowntimeMinutes: 10,
    testingNotes: "N/A — emergency action.",
    postImplementNotes: "All 14 keys revoked. 6 affected tenants notified. New keys issued within 2 hours.",
  },
  {
    id: "CHG-1844",
    title: "Kubernetes cluster upgrade to 1.31",
    type: "major",
    status: "review",
    risk: "high",
    impactAreas: ["infra", "api", "database", "network"],
    summary: "Upgrade all production Kubernetes clusters from v1.28 to v1.31. Rolling upgrade across 3 AZs.",
    requester: "Infrastructure Team",
    requestedAt: "2026-02-22T08:00:00",
    scheduledStart: "2026-03-01T01:00:00",
    scheduledEnd: "2026-03-01T06:00:00",
    implementedAt: null,
    completedAt: null,
    approvers: [
      { id: "a7", name: "Casey Nguyen", role: "CTO", status: "pending", comment: null, respondedAt: null },
      { id: "a8", name: "Jordan Kim", role: "SRE Lead", status: "pending", comment: null, respondedAt: null },
      { id: "a9", name: "Taylor Reed", role: "DBA", status: "pending", comment: null, respondedAt: null },
      { id: "a10", name: "Security Review", role: "InfoSec", status: "pending", comment: null, respondedAt: null },
    ],
    rollbackPlan: [
      { order: 1, action: "Rollback failing nodes to v1.28 using Cluster API", estimatedMinutes: 30 },
      { order: 2, action: "Restore etcd snapshot from pre-upgrade backup", estimatedMinutes: 45 },
      { order: 3, action: "Verify all services healthy on v1.28", estimatedMinutes: 20 },
      { order: 4, action: "Post-mortem within 24 hours", estimatedMinutes: 60 },
    ],
    downtime: true,
    estimatedDowntimeMinutes: 15,
    testingNotes: "Successfully upgraded staging cluster. 2 deprecated API issues found and fixed.",
    postImplementNotes: "",
  },
  {
    id: "CHG-1845",
    title: "Enable HSTS and CSP headers globally",
    type: "standard",
    status: "scheduled",
    risk: "low",
    impactAreas: ["frontend", "security"],
    summary: "Add HTTP Strict Transport Security and Content Security Policy headers to all web responses.",
    requester: "Security Team",
    requestedAt: "2026-02-21T13:00:00",
    scheduledStart: "2026-02-24T14:00:00",
    scheduledEnd: "2026-02-24T14:30:00",
    implementedAt: null,
    completedAt: null,
    approvers: [
      { id: "a11", name: "Jordan Kim", role: "SRE Lead", status: "approved", comment: "Low risk. LGTM.", respondedAt: "2026-02-21T15:00:00" },
    ],
    rollbackPlan: [
      { order: 1, action: "Remove headers from nginx config", estimatedMinutes: 2 },
      { order: 2, action: "Reload nginx", estimatedMinutes: 1 },
    ],
    downtime: false,
    estimatedDowntimeMinutes: 0,
    testingNotes: "Verified headers don't break CSP report-only mode in staging.",
    postImplementNotes: "",
  },
];

const CALENDAR: CalendarDay[] = [
  { date: "Feb 22", changeCount: 2, hasEmergency: true },
  { date: "Feb 23", changeCount: 1, hasEmergency: false },
  { date: "Feb 24", changeCount: 1, hasEmergency: false },
  { date: "Feb 25", changeCount: 0, hasEmergency: false },
  { date: "Feb 26", changeCount: 0, hasEmergency: false },
  { date: "Feb 27", changeCount: 0, hasEmergency: false },
  { date: "Mar 01", changeCount: 1, hasEmergency: false },
];

function typeBg(t: ChangeType) {
  if (t === "emergency") return "bg-rose-500/10 text-rose-400";
  if (t === "major") return "bg-orange-500/10 text-orange-400";
  if (t === "normal") return "bg-indigo-500/10 text-indigo-400";
  return "bg-zinc-700 text-zinc-300";
}
function statusBg(s: ChangeStatus) {
  if (s === "completed") return "bg-emerald-400/10 text-emerald-400";
  if (s === "implementing") return "bg-indigo-400/10 text-indigo-400 animate-pulse";
  if (s === "approved" || s === "scheduled") return "bg-cyan-400/10 text-cyan-400";
  if (s === "review" || s === "submitted") return "bg-amber-400/10 text-amber-400";
  if (s === "failed") return "bg-rose-400/10 text-rose-400";
  if (s === "cancelled") return "bg-zinc-700 text-zinc-400";
  return "bg-zinc-800 text-zinc-300";
}
function riskBg(r: ChangeRisk) {
  if (r === "critical") return "bg-rose-500/10 text-rose-400";
  if (r === "high") return "bg-orange-500/10 text-orange-400";
  if (r === "medium") return "bg-amber-500/10 text-amber-400";
  return "bg-emerald-500/10 text-emerald-400";
}
function approverBg(s: ApproverStatus) {
  if (s === "approved") return "bg-emerald-400/10 text-emerald-400";
  if (s === "rejected") return "bg-rose-400/10 text-rose-400";
  return "bg-zinc-700 text-zinc-400";
}
function impactBg(a: ImpactArea) {
  const m: Record<ImpactArea, string> = {
    database: "bg-blue-500/10 text-blue-400",
    api: "bg-indigo-500/10 text-indigo-400",
    frontend: "bg-purple-500/10 text-purple-400",
    infra: "bg-zinc-700 text-zinc-300",
    security: "bg-rose-500/10 text-rose-400",
    network: "bg-cyan-500/10 text-cyan-400",
    data: "bg-teal-500/10 text-teal-400",
    auth: "bg-orange-500/10 text-orange-400",
  };
  return m[a];
}

export default function ChangeManagementBoard() {
  const [tab, setTab] = useState<"board" | "calendar" | "approvals" | "metrics">("board");
  const [typeFilter, setTypeFilter] = useState<ChangeType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ChangeStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ChangeRequest | null>(null);

  const filtered = CHANGES.filter(c => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendingApprovals = CHANGES.filter(c => c.approvers.some(a => a.status === "pending") && c.status !== "completed" && c.status !== "cancelled");
  const scheduledCount = CHANGES.filter(c => c.status === "scheduled" || c.status === "approved").length;
  const emergencies = CHANGES.filter(c => c.type === "emergency").length;

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Change Management Board</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Review, approve, and track infrastructure and application changes</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingApprovals.length > 0 && (
            <span className="bg-amber-500/10 text-amber-400 text-xs px-2 py-1 rounded-full border border-amber-500/30">
              {pendingApprovals.length} pending approval
            </span>
          )}
          {scheduledCount > 0 && (
            <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2 py-1 rounded-full border border-cyan-500/30">
              {scheduledCount} scheduled
            </span>
          )}
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
            + New RFC
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-6">
        <div className="flex gap-6">
          {(["board", "calendar", "approvals", "metrics"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "py-3 text-sm font-medium border-b-2 capitalize transition-colors",
                tab === t ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              {t}
              {t === "approvals" && pendingApprovals.length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 rounded-full">{pendingApprovals.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* BOARD TAB */}
        {tab === "board" && (
          <div className="flex h-full">
            <div className="w-96 border-r border-zinc-800 flex flex-col">
              <div className="p-4 border-b border-zinc-800 space-y-3">
                <input
                  type="text"
                  placeholder="Search changes..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-zinc-800 text-sm rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value as ChangeType | "all")}
                    className="flex-1 bg-zinc-800 text-sm rounded-lg px-2 py-1.5 text-zinc-300 outline-none"
                  >
                    <option value="all">All Types</option>
                    <option value="standard">Standard</option>
                    <option value="normal">Normal</option>
                    <option value="major">Major</option>
                    <option value="emergency">Emergency</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as ChangeStatus | "all")}
                    className="flex-1 bg-zinc-800 text-sm rounded-lg px-2 py-1.5 text-zinc-300 outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="approved">Approved</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {filtered.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-zinc-800 hover:bg-zinc-900 transition-colors",
                      selected?.id === c.id && "bg-zinc-900 border-l-2 border-l-indigo-500",
                      c.type === "emergency" && "border-l-2 border-l-rose-500"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-500 font-mono">{c.id}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full ml-2", statusBg(c.status))}>{c.status}</span>
                    </div>
                    <div className="text-sm font-medium text-zinc-100 mb-1 line-clamp-2">{c.title}</div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", typeBg(c.type))}>{c.type}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", riskBg(c.risk))}>{c.risk}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {c.requester}
                      {c.scheduledStart && <span className="ml-2">· {c.scheduledStart.split("T")[0]}</span>}
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
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-zinc-500 font-mono">{selected.id}</span>
                        {selected.type === "emergency" && <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full">🚨 EMERGENCY</span>}
                      </div>
                      <h2 className="text-xl font-semibold text-zinc-100 mb-2">{selected.title}</h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-xs px-2 py-0.5 rounded", typeBg(selected.type))}>{selected.type}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBg(selected.status))}>{selected.status}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded", riskBg(selected.risk))}>{selected.risk} risk</span>
                        {selected.downtime && (
                          <span className="text-xs bg-rose-900/40 text-rose-400 px-2 py-0.5 rounded">
                            ⚠ {selected.estimatedDowntimeMinutes}m downtime
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {selected.status === "review" && (
                        <button className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">Approve</button>
                      )}
                      <button className="bg-zinc-800 hover:bg-zinc-700 text-sm px-3 py-1.5 rounded-lg text-zinc-300 transition-colors">Edit</button>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-zinc-900 rounded-xl p-5 mb-4">
                    <h3 className="text-sm font-medium text-zinc-300 mb-2">Summary</h3>
                    <p className="text-sm text-zinc-300">{selected.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {selected.impactAreas.map(area => (
                        <span key={area} className={cn("text-xs px-2 py-0.5 rounded", impactBg(area))}>{area}</span>
                      ))}
                    </div>
                  </div>

                  {/* Approvals */}
                  <div className="bg-zinc-900 rounded-xl p-5 mb-4">
                    <h3 className="text-sm font-medium text-zinc-300 mb-3">Approvers</h3>
                    <div className="space-y-2">
                      {selected.approvers.map(a => (
                        <div key={a.id} className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full", approverBg(a.status))}>{a.status}</span>
                            <div>
                              <div className="text-sm text-zinc-200">{a.name}</div>
                              <div className="text-xs text-zinc-500">{a.role}</div>
                            </div>
                          </div>
                          {a.comment && <div className="text-xs text-zinc-400 max-w-48 text-right">{a.comment}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="bg-zinc-900 rounded-xl p-5 mb-4">
                    <h3 className="text-sm font-medium text-zinc-300 mb-3">Schedule</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><div className="text-xs text-zinc-500 mb-0.5">Requested</div><div className="text-zinc-200">{selected.requestedAt}</div></div>
                      <div><div className="text-xs text-zinc-500 mb-0.5">Scheduled Start</div><div className="text-zinc-200">{selected.scheduledStart || "—"}</div></div>
                      <div><div className="text-xs text-zinc-500 mb-0.5">Scheduled End</div><div className="text-zinc-200">{selected.scheduledEnd || "—"}</div></div>
                      <div><div className="text-xs text-zinc-500 mb-0.5">Completed</div><div className="text-zinc-200">{selected.completedAt || "—"}</div></div>
                    </div>
                  </div>

                  {/* Rollback plan */}
                  <div className="bg-zinc-900 rounded-xl p-5 mb-4">
                    <h3 className="text-sm font-medium text-zinc-300 mb-3">Rollback Plan</h3>
                    <ol className="space-y-2">
                      {selected.rollbackPlan.map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <span className="bg-zinc-800 text-zinc-400 text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">{step.order}</span>
                          <div className="flex-1">
                            <span className="text-zinc-300">{step.action}</span>
                            {step.estimatedMinutes > 0 && (
                              <span className="text-xs text-zinc-500 ml-2">(~{step.estimatedMinutes}m)</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Testing & post-impl notes */}
                  {selected.testingNotes && (
                    <div className="bg-zinc-900 rounded-xl p-5 mb-4">
                      <h3 className="text-sm font-medium text-zinc-300 mb-2">Testing Notes</h3>
                      <p className="text-sm text-zinc-400">{selected.testingNotes}</p>
                    </div>
                  )}
                  {selected.postImplementNotes && (
                    <div className="bg-zinc-900 rounded-xl p-5">
                      <h3 className="text-sm font-medium text-emerald-400 mb-2">Post-Implementation Notes</h3>
                      <p className="text-sm text-zinc-300">{selected.postImplementNotes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                  <span className="text-4xl mb-3">📋</span>
                  <span className="text-sm">Select a change request to view details</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CALENDAR TAB */}
        {tab === "calendar" && (
          <div className="p-6">
            <div className="bg-zinc-900 rounded-xl p-5 mb-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">7-Day Change Window</h3>
              <div className="grid grid-cols-7 gap-2">
                {CALENDAR.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl p-3 text-center border",
                      day.hasEmergency ? "border-rose-700 bg-rose-900/20" :
                      day.changeCount > 0 ? "border-indigo-700 bg-indigo-900/20" :
                      "border-zinc-800 bg-zinc-900"
                    )}
                  >
                    <div className="text-xs text-zinc-400 mb-2">{day.date}</div>
                    {day.changeCount > 0 ? (
                      <>
                        <div className={cn("text-lg font-bold", day.hasEmergency ? "text-rose-400" : "text-indigo-400")}>
                          {day.changeCount}
                        </div>
                        <div className="text-xs text-zinc-500">change{day.changeCount > 1 ? "s" : ""}</div>
                        {day.hasEmergency && <div className="text-xs text-rose-400 mt-1">🚨 emrg</div>}
                      </>
                    ) : (
                      <div className="text-xs text-zinc-600 mt-3">clear</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Upcoming Scheduled Changes</h3>
              <div className="space-y-3">
                {CHANGES.filter(c => c.status === "scheduled" || c.status === "approved").map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-zinc-800 rounded-lg p-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-zinc-500 font-mono">{c.id}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded", typeBg(c.type))}>{c.type}</span>
                      </div>
                      <div className="text-sm text-zinc-200">{c.title}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {c.scheduledStart} → {c.scheduledEnd}
                        {c.downtime && <span className="ml-2 text-amber-400">⚠ downtime</span>}
                      </div>
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full ml-4 shrink-0", statusBg(c.status))}>{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* APPROVALS TAB */}
        {tab === "approvals" && (
          <div className="p-6">
            {pendingApprovals.length === 0 ? (
              <div className="bg-zinc-900 rounded-xl p-12 text-center text-zinc-500">
                <span className="text-3xl block mb-2">✅</span>
                All changes fully approved
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map(c => (
                  <div key={c.id} className="bg-zinc-900 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-zinc-500 font-mono">{c.id}</span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded", typeBg(c.type))}>{c.type}</span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded", riskBg(c.risk))}>{c.risk}</span>
                        </div>
                        <div className="text-sm font-medium text-zinc-100">{c.title}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">✓ Approve</button>
                        <button className="bg-rose-900/50 hover:bg-rose-900 text-rose-400 text-xs px-3 py-1.5 rounded-lg transition-colors">✕ Reject</button>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 mb-3">{c.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      {c.approvers.map(a => (
                        <span key={a.id} className={cn("text-xs px-2 py-0.5 rounded-full", approverBg(a.status))}>
                          {a.name}: {a.status}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* METRICS TAB */}
        {tab === "metrics" && (
          <div className="p-6">
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Changes (30d)", value: CHANGES.length, color: "text-zinc-100" },
                { label: "Emergency Changes", value: emergencies, color: emergencies > 0 ? "text-rose-400" : "text-emerald-400" },
                { label: "Pending Approvals", value: pendingApprovals.length, color: pendingApprovals.length > 0 ? "text-amber-400" : "text-emerald-400" },
                { label: "Success Rate", value: "93.2%", color: "text-emerald-400" },
              ].map((s, i) => (
                <div key={i} className="bg-zinc-900 rounded-xl p-5">
                  <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
                  <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 rounded-xl p-5 mb-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Changes by Type</h3>
              <div className="space-y-3">
                {(["standard", "normal", "major", "emergency"] as ChangeType[]).map(type => {
                  const count = CHANGES.filter(c => c.type === type).length;
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded w-20 text-center", typeBg(type))}>{type}</span>
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(count / CHANGES.length) * 100}%` }} />
                      </div>
                      <span className="text-xs text-zinc-400 w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-zinc-900 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Changes by Risk Level</h3>
              <div className="space-y-3">
                {(["low", "medium", "high", "critical"] as ChangeRisk[]).map(risk => {
                  const count = CHANGES.filter(c => c.risk === risk).length;
                  return (
                    <div key={risk} className="flex items-center gap-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded w-16 text-center", riskBg(risk))}>{risk}</span>
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full",
                          risk === "critical" ? "bg-rose-500" : risk === "high" ? "bg-orange-500" : risk === "medium" ? "bg-amber-500" : "bg-emerald-500"
                        )} style={{ width: `${(count / CHANGES.length) * 100}%` }} />
                      </div>
                      <span className="text-xs text-zinc-400 w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
