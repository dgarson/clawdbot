import React, { useState } from "react";
import { cn } from "../lib/utils";

type RetentionUnit = "days" | "months" | "years";
type PolicyScope = "global" | "tenant" | "data-type" | "region";
type PolicyStatus = "active" | "draft" | "archived";
type DeletionMethod = "soft-delete" | "hard-delete" | "anonymize" | "archive";
type DataCategory = "pii" | "financial" | "logs" | "analytics" | "config" | "media" | "audit";
type JobStatus = "running" | "completed" | "failed" | "scheduled" | "cancelled";

interface RetentionPolicy {
  id: string;
  name: string;
  scope: PolicyScope;
  dataCategory: DataCategory;
  status: PolicyStatus;
  retentionPeriod: number;
  retentionUnit: RetentionUnit;
  deletionMethod: DeletionMethod;
  legalHoldOverride: boolean;
  regions: string[];
  dataSize: number;
  recordCount: number;
  nextPurgeAt: string;
  lastPurgedAt: string | null;
  owner: string;
  complianceFrameworks: string[];
  notes: string;
}

interface PurgeJob {
  id: string;
  policyId: string;
  policyName: string;
  status: JobStatus;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  recordsScanned: number;
  recordsDeleted: number;
  bytesReclaimed: number;
  errorMessage: string | null;
  triggeredBy: string;
}

interface StorageTrend {
  month: string;
  pii: number;
  logs: number;
  analytics: number;
  media: number;
}

const POLICIES: RetentionPolicy[] = [
  {
    id: "r1",
    name: "PII Data — Global Standard",
    scope: "global",
    dataCategory: "pii",
    status: "active",
    retentionPeriod: 2,
    retentionUnit: "years",
    deletionMethod: "anonymize",
    legalHoldOverride: true,
    regions: ["us-east-1", "eu-west-1", "ap-southeast-1"],
    dataSize: 48200,
    recordCount: 12450000,
    nextPurgeAt: "2026-03-01",
    lastPurgedAt: "2026-02-01",
    owner: "Privacy Team",
    complianceFrameworks: ["GDPR", "CCPA", "SOC2"],
    notes: "GDPR Art. 17 right to erasure — anonymize rather than delete to preserve analytics",
  },
  {
    id: "r2",
    name: "Application Logs — 90-Day Rolling",
    scope: "global",
    dataCategory: "logs",
    status: "active",
    retentionPeriod: 90,
    retentionUnit: "days",
    deletionMethod: "hard-delete",
    legalHoldOverride: false,
    regions: ["us-east-1", "eu-west-1"],
    dataSize: 820400,
    recordCount: 5800000000,
    nextPurgeAt: "2026-02-23",
    lastPurgedAt: "2026-02-22",
    owner: "SRE Team",
    complianceFrameworks: ["SOC2"],
    notes: "Daily purge job. Log volume ~9GB/day.",
  },
  {
    id: "r3",
    name: "Financial Records — 7-Year Hold",
    scope: "data-type",
    dataCategory: "financial",
    status: "active",
    retentionPeriod: 7,
    retentionUnit: "years",
    deletionMethod: "archive",
    legalHoldOverride: true,
    regions: ["us-east-1"],
    dataSize: 12300,
    recordCount: 8200000,
    nextPurgeAt: "2033-01-01",
    lastPurgedAt: null,
    owner: "Finance & Legal",
    complianceFrameworks: ["SOX", "IRS", "FINRA"],
    notes: "Archival to Glacier after 3 years. Hard deletion only after 7.",
  },
  {
    id: "r4",
    name: "EU User Analytics — GDPR Scoped",
    scope: "region",
    dataCategory: "analytics",
    status: "active",
    retentionPeriod: 1,
    retentionUnit: "years",
    deletionMethod: "anonymize",
    legalHoldOverride: false,
    regions: ["eu-west-1"],
    dataSize: 9400,
    recordCount: 320000000,
    nextPurgeAt: "2026-04-01",
    lastPurgedAt: "2026-01-15",
    owner: "Privacy Team",
    complianceFrameworks: ["GDPR"],
    notes: "EU-specific. Shorter retention than global analytics policy.",
  },
  {
    id: "r5",
    name: "Audit Logs — Immutable 3-Year",
    scope: "global",
    dataCategory: "audit",
    status: "active",
    retentionPeriod: 3,
    retentionUnit: "years",
    deletionMethod: "archive",
    legalHoldOverride: true,
    regions: ["us-east-1", "eu-west-1", "ap-southeast-1"],
    dataSize: 5600,
    recordCount: 450000000,
    nextPurgeAt: "2029-01-01",
    lastPurgedAt: null,
    owner: "Security Team",
    complianceFrameworks: ["SOC2", "ISO27001", "HIPAA"],
    notes: "Write-once. Cannot be modified or deleted — only archived to cold storage.",
  },
  {
    id: "r6",
    name: "Media Uploads — 1-Year TTL",
    scope: "data-type",
    dataCategory: "media",
    status: "draft",
    retentionPeriod: 1,
    retentionUnit: "years",
    deletionMethod: "hard-delete",
    legalHoldOverride: false,
    regions: ["us-east-1", "eu-west-1"],
    dataSize: 2800000,
    recordCount: 4200000,
    nextPurgeAt: "2027-01-01",
    lastPurgedAt: null,
    owner: "Product Team",
    complianceFrameworks: [],
    notes: "Draft — pending legal review before activation",
  },
];

const PURGE_JOBS: PurgeJob[] = [
  {
    id: "j1",
    policyId: "r2",
    policyName: "Application Logs — 90-Day Rolling",
    status: "running",
    scheduledAt: "2026-02-22T02:00:00",
    startedAt: "2026-02-22T02:00:02",
    completedAt: null,
    recordsScanned: 4200000000,
    recordsDeleted: 3800000000,
    bytesReclaimed: 720000,
    errorMessage: null,
    triggeredBy: "cron",
  },
  {
    id: "j2",
    policyId: "r1",
    policyName: "PII Data — Global Standard",
    status: "completed",
    scheduledAt: "2026-02-01T00:00:00",
    startedAt: "2026-02-01T00:00:10",
    completedAt: "2026-02-01T01:42:30",
    recordsScanned: 14200000,
    recordsDeleted: 1890000,
    bytesReclaimed: 6800,
    errorMessage: null,
    triggeredBy: "cron",
  },
  {
    id: "j3",
    policyId: "r4",
    policyName: "EU User Analytics — GDPR Scoped",
    status: "completed",
    scheduledAt: "2026-01-15T00:00:00",
    startedAt: "2026-01-15T00:00:05",
    completedAt: "2026-01-15T00:28:12",
    recordsScanned: 380000000,
    recordsDeleted: 42000000,
    bytesReclaimed: 2100,
    errorMessage: null,
    triggeredBy: "cron",
  },
  {
    id: "j4",
    policyId: "r2",
    policyName: "Application Logs — 90-Day Rolling",
    status: "failed",
    scheduledAt: "2026-02-21T02:00:00",
    startedAt: "2026-02-21T02:00:03",
    completedAt: "2026-02-21T02:12:00",
    recordsScanned: 120000000,
    recordsDeleted: 0,
    bytesReclaimed: 0,
    errorMessage: "Database connection timeout after 12 minutes. Rolled back.",
    triggeredBy: "cron",
  },
];

const STORAGE_TREND: StorageTrend[] = [
  { month: "Sep", pii: 38000, logs: 680000, analytics: 7800, media: 2200000 },
  { month: "Oct", pii: 41000, logs: 720000, analytics: 8200, media: 2350000 },
  { month: "Nov", pii: 44000, logs: 760000, analytics: 8600, media: 2500000 },
  { month: "Dec", pii: 46000, logs: 790000, analytics: 8900, media: 2650000 },
  { month: "Jan", pii: 47500, logs: 810000, analytics: 9200, media: 2750000 },
  { month: "Feb", pii: 48200, logs: 820400, analytics: 9400, media: 2800000 },
];

function scopeBg(s: PolicyScope) {
  if (s === "global") {return "bg-purple-500/10 text-purple-400";}
  if (s === "region") {return "bg-cyan-500/10 text-cyan-400";}
  if (s === "tenant") {return "bg-primary/10 text-primary";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]";
}
function categoryBg(c: DataCategory) {
  const m: Record<DataCategory, string> = {
    pii: "bg-rose-500/10 text-rose-400",
    financial: "bg-emerald-500/10 text-emerald-400",
    logs: "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]",
    analytics: "bg-primary/10 text-primary",
    config: "bg-amber-500/10 text-amber-400",
    media: "bg-purple-500/10 text-purple-400",
    audit: "bg-orange-500/10 text-orange-400",
  };
  return m[c];
}
function statusBg(s: PolicyStatus) {
  if (s === "active") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "draft") {return "bg-amber-400/10 text-amber-400";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]";
}
function jobStatusBg(s: JobStatus) {
  if (s === "running") {return "bg-primary/10 text-primary animate-pulse";}
  if (s === "completed") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "failed") {return "bg-rose-400/10 text-rose-400";}
  if (s === "scheduled") {return "bg-cyan-400/10 text-cyan-400";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]";
}
function methodBg(m: DeletionMethod) {
  if (m === "hard-delete") {return "bg-rose-500/10 text-rose-400";}
  if (m === "soft-delete") {return "bg-amber-500/10 text-amber-400";}
  if (m === "anonymize") {return "bg-primary/10 text-primary";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]";
}
function fmtBytes(kb: number) {
  if (kb >= 1_000_000) {return (kb / 1_000_000).toFixed(1) + " TB";}
  if (kb >= 1_000) {return (kb / 1_000).toFixed(1) + " GB";}
  return kb.toFixed(0) + " MB";
}
function fmtCount(n: number) {
  if (n >= 1_000_000_000) {return (n / 1_000_000_000).toFixed(1) + "B";}
  if (n >= 1_000_000) {return (n / 1_000_000).toFixed(1) + "M";}
  if (n >= 1_000) {return (n / 1_000).toFixed(1) + "K";}
  return String(n);
}

export default function DataRetentionPolicyManager() {
  const [tab, setTab] = useState<"policies" | "jobs" | "storage" | "legal-holds">("policies");
  const [categoryFilter, setCategoryFilter] = useState<DataCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RetentionPolicy | null>(null);

  const filtered = POLICIES.filter(p => {
    if (categoryFilter !== "all" && p.dataCategory !== categoryFilter) {return false;}
    if (statusFilter !== "all" && p.status !== statusFilter) {return false;}
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) {return false;}
    return true;
  });

  const activeCount = POLICIES.filter(p => p.status === "active").length;
  const runningJobs = PURGE_JOBS.filter(j => j.status === "running").length;
  const failedJobs = PURGE_JOBS.filter(j => j.status === "failed").length;
  const totalStorage = POLICIES.reduce((a, p) => a + p.dataSize, 0);

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Data Retention Policy Manager</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Define retention schedules, monitor purge jobs, and ensure compliance</p>
        </div>
        <div className="flex items-center gap-2">
          {runningJobs > 0 && (
            <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full border border-primary/30 animate-pulse">
              {runningJobs} purge running
            </span>
          )}
          {failedJobs > 0 && (
            <span className="bg-rose-500/10 text-rose-400 text-xs px-2 py-1 rounded-full border border-rose-500/30">
              {failedJobs} job failed
            </span>
          )}
          <button className="bg-primary hover:bg-primary text-[var(--color-text-primary)] text-sm px-3 py-1.5 rounded-lg transition-colors">
            + New Policy
          </button>
        </div>
      </div>

      {/* Stat bar */}
      <div className="border-b border-[var(--color-border)] px-6 py-3 grid grid-cols-4 gap-4">
        {[
          { label: "Active Policies", value: activeCount, color: "text-emerald-400" },
          { label: "Running Jobs", value: runningJobs, color: runningJobs > 0 ? "text-primary" : "text-[var(--color-text-secondary)]" },
          { label: "Failed Jobs", value: failedJobs, color: failedJobs > 0 ? "text-rose-400" : "text-emerald-400" },
          { label: "Total Data Under Policy", value: fmtBytes(totalStorage), color: "text-[var(--color-text-primary)]" },
        ].map((s, i) => (
          <div key={i} className="text-center">
            <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border)] px-6">
        <div className="flex gap-6">
          {(["policies", "jobs", "storage", "legal-holds"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "py-3 text-sm font-medium border-b-2 capitalize transition-colors",
                tab === t ? "border-primary text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {t.replace("-", " ")}
              {t === "jobs" && failedJobs > 0 && (
                <span className="ml-1.5 bg-rose-500 text-[var(--color-text-primary)] text-xs px-1.5 rounded-full">{failedJobs}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* POLICIES TAB */}
        {tab === "policies" && (
          <div className="flex h-full">
            <div className="w-96 border-r border-[var(--color-border)] flex flex-col">
              <div className="p-4 border-b border-[var(--color-border)] space-y-3">
                <input
                  type="text"
                  placeholder="Search policies..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] text-sm rounded-lg px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value as DataCategory | "all")}
                    className="flex-1 bg-[var(--color-surface-2)] text-sm rounded-lg px-2 py-1.5 text-[var(--color-text-primary)] outline-none"
                  >
                    <option value="all">All Categories</option>
                    <option value="pii">PII</option>
                    <option value="financial">Financial</option>
                    <option value="logs">Logs</option>
                    <option value="analytics">Analytics</option>
                    <option value="audit">Audit</option>
                    <option value="media">Media</option>
                    <option value="config">Config</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as PolicyStatus | "all")}
                    className="flex-1 bg-[var(--color-surface-2)] text-sm rounded-lg px-2 py-1.5 text-[var(--color-text-primary)] outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-1)] transition-colors",
                      selected?.id === p.id && "bg-[var(--color-surface-1)] border-l-2 border-l-indigo-500"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{p.name}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full ml-2 shrink-0", statusBg(p.status))}>{p.status}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", categoryBg(p.dataCategory))}>{p.dataCategory}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", scopeBg(p.scope))}>{p.scope}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {p.retentionPeriod} {p.retentionUnit} · {fmtBytes(p.dataSize)} · Next purge {p.nextPurgeAt}
                    </div>
                    {p.legalHoldOverride && (
                      <div className="text-xs text-amber-400 mt-0.5">⚖ Legal hold override enabled</div>
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
                    <span className="text-3xl mb-2">📋</span>
                    <span className="text-sm">No policies match filters</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selected ? (
                <div className="p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">{selected.name}</h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-xs px-2 py-0.5 rounded", categoryBg(selected.dataCategory))}>{selected.dataCategory}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded", scopeBg(selected.scope))}>{selected.scope}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBg(selected.status))}>{selected.status}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded", methodBg(selected.deletionMethod))}>{selected.deletionMethod}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-primary hover:bg-primary text-[var(--color-text-primary)] text-sm px-3 py-1.5 rounded-lg transition-colors">Run Now</button>
                      <button className="bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-sm px-3 py-1.5 rounded-lg text-[var(--color-text-primary)] transition-colors">Edit</button>
                    </div>
                  </div>

                  {/* Key metrics */}
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    {[
                      { label: "Retention", value: `${selected.retentionPeriod} ${selected.retentionUnit}` },
                      { label: "Data Size", value: fmtBytes(selected.dataSize) },
                      { label: "Record Count", value: fmtCount(selected.recordCount) },
                      { label: "Next Purge", value: selected.nextPurgeAt },
                    ].map((s, i) => (
                      <div key={i} className="bg-[var(--color-surface-1)] rounded-xl p-4">
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{s.value}</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Compliance frameworks */}
                  {selected.complianceFrameworks.length > 0 && (
                    <div className="bg-[var(--color-surface-1)] rounded-xl p-5 mb-4">
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Compliance Frameworks</h3>
                      <div className="flex flex-wrap gap-2">
                        {selected.complianceFrameworks.map(f => (
                          <span key={f} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-lg border border-primary/20">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Regions */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-5 mb-4">
                    <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Regions</h3>
                    <div className="flex flex-wrap gap-2">
                      {selected.regions.map(r => (
                        <span key={r} className="bg-[var(--color-surface-2)] text-[var(--color-text-primary)] text-xs px-2 py-1 rounded font-mono">{r}</span>
                      ))}
                    </div>
                  </div>

                  {/* Legal hold & settings */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-5 mb-4">
                    <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Settings</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--color-text-secondary)]">Legal Hold Override</span>
                        <span className={selected.legalHoldOverride ? "text-amber-400" : "text-[var(--color-text-muted)]"}>
                          {selected.legalHoldOverride ? "⚖ Enabled" : "Disabled"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--color-text-secondary)]">Deletion Method</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded", methodBg(selected.deletionMethod))}>{selected.deletionMethod}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--color-text-secondary)]">Owner</span>
                        <span className="text-[var(--color-text-primary)]">{selected.owner}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--color-text-secondary)]">Last Purged</span>
                        <span className="text-[var(--color-text-primary)]">{selected.lastPurgedAt || "Never"}</span>
                      </div>
                    </div>
                    {selected.notes && (
                      <div className="mt-3 p-3 bg-[var(--color-surface-2)] rounded-lg text-xs text-[var(--color-text-secondary)]">{selected.notes}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                  <span className="text-4xl mb-3">🗂️</span>
                  <span className="text-sm">Select a policy to view details</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* JOBS TAB */}
        {tab === "jobs" && (
          <div className="p-6">
            <div className="space-y-4">
              {PURGE_JOBS.map(job => (
                <div key={job.id} className="bg-[var(--color-surface-1)] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{job.policyName}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", jobStatusBg(job.status))}>{job.status}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Triggered by {job.triggeredBy} · {job.scheduledAt}</div>
                    </div>
                    {job.status === "failed" && (
                      <button className="text-xs bg-indigo-900/40 text-primary px-2 py-1 rounded hover:bg-indigo-900/60 transition-colors">Retry</button>
                    )}
                  </div>

                  {job.errorMessage && (
                    <div className="bg-rose-900/20 border border-rose-800 rounded-lg p-3 mb-3 text-xs text-rose-300 font-mono">
                      {job.errorMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Records Scanned</div>
                      <div className="text-[var(--color-text-primary)]">{fmtCount(job.recordsScanned)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Records Deleted</div>
                      <div className={cn("font-medium", job.recordsDeleted > 0 ? "text-emerald-400" : "text-[var(--color-text-secondary)]")}>{fmtCount(job.recordsDeleted)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Storage Reclaimed</div>
                      <div className={cn("font-medium", job.bytesReclaimed > 0 ? "text-emerald-400" : "text-[var(--color-text-secondary)]")}>{fmtBytes(job.bytesReclaimed)}</div>
                    </div>
                  </div>

                  {job.status === "running" && job.recordsScanned > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: `${(job.recordsDeleted / job.recordsScanned) * 100}%` }} />
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">{((job.recordsDeleted / job.recordsScanned) * 100).toFixed(1)}% complete</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STORAGE TAB */}
        {tab === "storage" && (
          <div className="p-6">
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 mb-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Storage by Category — 6 Month Trend</h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">Media dominates at {fmtBytes(STORAGE_TREND[STORAGE_TREND.length - 1].media)} · Logs at {fmtBytes(STORAGE_TREND[STORAGE_TREND.length - 1].logs)}</p>
              <div className="flex items-end gap-2 h-28">
                {STORAGE_TREND.map((d, i) => {
                  const maxVal = 2800000;
                  const logPct = (d.logs / maxVal) * 100;
                  const mediaPct = (d.media / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col-reverse rounded-sm overflow-hidden" style={{ height: "80px" }}>
                        <div className="bg-primary" style={{ height: `${logPct}%` }} />
                        <div className="bg-purple-500" style={{ height: `${Math.min(mediaPct, 100 - logPct)}%` }} />
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)]">{d.month}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
                <span><span className="inline-block w-2 h-2 bg-primary rounded-sm mr-1" />Logs</span>
                <span><span className="inline-block w-2 h-2 bg-purple-500 rounded-sm mr-1" />Media</span>
              </div>
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-xl p-5">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Storage by Policy</h3>
              <div className="space-y-3">
                {POLICIES.toSorted((a, b) => b.dataSize - a.dataSize).map(p => {
                  const maxSize = Math.max(...POLICIES.map(x => x.dataSize));
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="w-48 text-xs text-[var(--color-text-primary)] truncate">{p.name}</div>
                      <div className="flex-1 h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(p.dataSize / maxSize) * 100}%` }} />
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] w-16 text-right">{fmtBytes(p.dataSize)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* LEGAL HOLDS TAB */}
        {tab === "legal-holds" && (
          <div className="p-6 max-w-2xl">
            <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4 mb-6">
              <div className="text-sm font-medium text-amber-400 mb-1">⚖ Legal Hold Notice</div>
              <p className="text-sm text-amber-300">
                Policies with legal hold override enabled will NOT purge data regardless of retention schedule.
                Holds must be explicitly released by Legal before purge jobs can execute.
              </p>
            </div>
            <div className="space-y-4">
              {POLICIES.filter(p => p.legalHoldOverride).map(p => (
                <div key={p.id} className="bg-[var(--color-surface-1)] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">{p.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded", categoryBg(p.dataCategory))}>{p.dataCategory}</span>
                        <span className="text-xs text-amber-400">⚖ Legal hold active</span>
                      </div>
                    </div>
                    <button className="text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] px-3 py-1.5 rounded-lg transition-colors">
                      Release Hold
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><div className="text-xs text-[var(--color-text-muted)] mb-0.5">Data Size</div><div className="text-[var(--color-text-primary)]">{fmtBytes(p.dataSize)}</div></div>
                    <div><div className="text-xs text-[var(--color-text-muted)] mb-0.5">Records</div><div className="text-[var(--color-text-primary)]">{fmtCount(p.recordCount)}</div></div>
                    <div><div className="text-xs text-[var(--color-text-muted)] mb-0.5">Scheduled Purge</div><div className="text-amber-400">Suspended</div></div>
                  </div>
                  {p.complianceFrameworks.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {p.complianceFrameworks.map(f => (
                        <span key={f} className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded">{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
