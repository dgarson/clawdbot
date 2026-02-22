import React, { useState } from "react";
import { cn } from "../lib/utils";

type RetentionStatus = "active" | "expiring" | "expired" | "exempt";
type DataClass = "pii" | "financial" | "logs" | "metrics" | "backups" | "user-content";
type PolicyAction = "delete" | "archive" | "anonymize" | "compress";
type ScanStatus = "running" | "idle" | "failed" | "scheduled";

interface RetentionPolicy {
  id: string;
  name: string;
  dataClass: DataClass;
  retentionDays: number;
  action: PolicyAction;
  scope: string;
  owner: string;
  enabled: boolean;
  description: string;
  lastRun: string;
  nextRun: string;
  affectedRows: number;
  storageGB: number;
}

interface DataStore {
  id: string;
  name: string;
  type: string;
  totalGB: number;
  expiringGB: number;
  expiredGB: number;
  policies: number;
  scanStatus: ScanStatus;
  lastScanned: string;
}

interface RetentionRecord {
  id: string;
  dataStore: string;
  dataClass: DataClass;
  recordCount: number;
  oldestRecord: string;
  expiresOn: string;
  status: RetentionStatus;
  policyId: string;
  policyName: string;
}

interface DeletionJob {
  id: string;
  policyName: string;
  dataStore: string;
  startTime: string;
  endTime: string | null;
  status: "running" | "completed" | "failed" | "queued";
  rowsProcessed: number;
  rowsDeleted: number;
  gbFreed: number;
  error: string | null;
}

const dataClassColor: Record<DataClass, string> = {
  pii:            "bg-rose-500/20 text-rose-400",
  financial:      "bg-amber-500/20 text-amber-400",
  logs:           "bg-zinc-500/20 text-zinc-400",
  metrics:        "bg-sky-500/20 text-sky-400",
  backups:        "bg-indigo-500/20 text-indigo-400",
  "user-content": "bg-violet-500/20 text-violet-400",
};

const actionBadge: Record<PolicyAction, string> = {
  delete:     "bg-rose-500/20 text-rose-400",
  archive:    "bg-indigo-500/20 text-indigo-400",
  anonymize:  "bg-amber-500/20 text-amber-400",
  compress:   "bg-sky-500/20 text-sky-400",
};

const statusBadge: Record<RetentionStatus, string> = {
  active:   "bg-emerald-500/20 text-emerald-400",
  expiring: "bg-amber-500/20 text-amber-400",
  expired:  "bg-rose-500/20 text-rose-400",
  exempt:   "bg-zinc-500/20 text-zinc-400",
};

const jobBadge: Record<DeletionJob["status"], string> = {
  running:   "bg-sky-500/20 text-sky-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  failed:    "bg-rose-500/20 text-rose-400",
  queued:    "bg-zinc-500/20 text-zinc-400",
};

const scanBadge: Record<ScanStatus, string> = {
  running:   "bg-sky-500/20 text-sky-400",
  idle:      "bg-zinc-500/20 text-zinc-400",
  failed:    "bg-rose-500/20 text-rose-400",
  scheduled: "bg-amber-500/20 text-amber-400",
};

const policies: RetentionPolicy[] = [
  {
    id: "pol1",
    name: "User PII 90-Day Purge",
    dataClass: "pii",
    retentionDays: 90,
    action: "delete",
    scope: "users.profile_events",
    owner: "Privacy Team",
    enabled: true,
    description: "Deletes PII fields from profile_events after 90 days per GDPR Art. 17.",
    lastRun: "2025-02-21 02:00",
    nextRun: "2025-02-22 02:00",
    affectedRows: 14_820,
    storageGB: 2.1,
  },
  {
    id: "pol2",
    name: "Application Logs 30-Day Archive",
    dataClass: "logs",
    retentionDays: 30,
    action: "archive",
    scope: "logs.*",
    owner: "Platform Team",
    enabled: true,
    description: "Moves application logs to cold storage after 30 days. Retained 1 year in cold.",
    lastRun: "2025-02-21 03:00",
    nextRun: "2025-02-22 03:00",
    affectedRows: 4_200_000,
    storageGB: 88.4,
  },
  {
    id: "pol3",
    name: "Metrics 13-Month Rollup",
    dataClass: "metrics",
    retentionDays: 395,
    action: "compress",
    scope: "metrics.raw",
    owner: "Observability Team",
    enabled: true,
    description: "Rolls up raw metric points older than 13 months to hourly resolution.",
    lastRun: "2025-01-31 04:00",
    nextRun: "2025-03-31 04:00",
    affectedRows: 890_000,
    storageGB: 14.7,
  },
  {
    id: "pol4",
    name: "Financial Records 7-Year Hold",
    dataClass: "financial",
    retentionDays: 2555,
    action: "archive",
    scope: "billing.*",
    owner: "Finance Team",
    enabled: true,
    description: "Archives financial records for 7-year regulatory compliance.",
    lastRun: "2024-12-31 05:00",
    nextRun: "2025-12-31 05:00",
    affectedRows: 540_000,
    storageGB: 8.2,
  },
  {
    id: "pol5",
    name: "User Content Anonymization",
    dataClass: "user-content",
    retentionDays: 180,
    action: "anonymize",
    scope: "content.submissions",
    owner: "Privacy Team",
    enabled: false,
    description: "Anonymizes deleted user content after 180 days.",
    lastRun: "2025-02-01 06:00",
    nextRun: "N/A (disabled)",
    affectedRows: 23_000,
    storageGB: 1.8,
  },
  {
    id: "pol6",
    name: "Backup Rotation 90-Day",
    dataClass: "backups",
    retentionDays: 90,
    action: "delete",
    scope: "backups.daily",
    owner: "Infra Team",
    enabled: true,
    description: "Deletes daily backup snapshots older than 90 days.",
    lastRun: "2025-02-21 07:00",
    nextRun: "2025-02-22 07:00",
    affectedRows: 90,
    storageGB: 320.0,
  },
];

const dataStores: DataStore[] = [
  { id: "ds1", name: "PostgreSQL prod",     type: "Relational",    totalGB: 480,  expiringGB: 12.4, expiredGB: 3.2,  policies: 3, scanStatus: "idle",      lastScanned: "1h ago" },
  { id: "ds2", name: "Elasticsearch logs",  type: "Search/Analytics", totalGB: 1200, expiringGB: 92.0, expiredGB: 45.1, policies: 2, scanStatus: "running",   lastScanned: "running" },
  { id: "ds3", name: "S3 cold storage",     type: "Object Store",  totalGB: 8400, expiringGB: 340.0, expiredGB: 120.0, policies: 2, scanStatus: "idle",      lastScanned: "6h ago" },
  { id: "ds4", name: "ClickHouse metrics",  type: "Analytics",     totalGB: 620,  expiringGB: 18.2, expiredGB: 0,    policies: 1, scanStatus: "scheduled", lastScanned: "12h ago" },
  { id: "ds5", name: "Redis sessions",      type: "Cache",         totalGB: 24,   expiringGB: 2.1,  expiredGB: 0.4,  policies: 1, scanStatus: "idle",      lastScanned: "30m ago" },
];

const records: RetentionRecord[] = [
  { id: "r1", dataStore: "PostgreSQL prod",     dataClass: "pii",            recordCount: 14_820,    oldestRecord: "2024-10-01", expiresOn: "2025-01-01", status: "expired",  policyId: "pol1", policyName: "User PII 90-Day Purge" },
  { id: "r2", dataStore: "Elasticsearch logs",  dataClass: "logs",           recordCount: 4_200_000, oldestRecord: "2025-01-21", expiresOn: "2025-02-20", status: "expiring", policyId: "pol2", policyName: "Application Logs 30-Day Archive" },
  { id: "r3", dataStore: "ClickHouse metrics",  dataClass: "metrics",        recordCount: 890_000,   oldestRecord: "2024-01-01", expiresOn: "2025-02-28", status: "expiring", policyId: "pol3", policyName: "Metrics 13-Month Rollup" },
  { id: "r4", dataStore: "PostgreSQL prod",      dataClass: "financial",      recordCount: 540_000,   oldestRecord: "2018-01-01", expiresOn: "2025-01-01", status: "expired",  policyId: "pol4", policyName: "Financial Records 7-Year Hold" },
  { id: "r5", dataStore: "S3 cold storage",      dataClass: "backups",        recordCount: 90,        oldestRecord: "2024-11-24", expiresOn: "2025-02-24", status: "expiring", policyId: "pol6", policyName: "Backup Rotation 90-Day" },
  { id: "r6", dataStore: "S3 cold storage",      dataClass: "user-content",   recordCount: 23_000,    oldestRecord: "2024-08-01", expiresOn: "2025-02-01", status: "expired",  policyId: "pol5", policyName: "User Content Anonymization" },
];

const deletionJobs: DeletionJob[] = [
  { id: "j1", policyName: "User PII 90-Day Purge",            dataStore: "PostgreSQL prod",    startTime: "2025-02-22 02:00", endTime: "2025-02-22 02:04", status: "completed", rowsProcessed: 14_820, rowsDeleted: 14_820, gbFreed: 2.1, error: null },
  { id: "j2", policyName: "Application Logs 30-Day Archive",  dataStore: "Elasticsearch logs", startTime: "2025-02-22 03:00", endTime: null,               status: "running",   rowsProcessed: 2_100_000, rowsDeleted: 0, gbFreed: 0,   error: null },
  { id: "j3", policyName: "Backup Rotation 90-Day",           dataStore: "S3 cold storage",    startTime: "2025-02-21 07:00", endTime: "2025-02-21 07:12", status: "completed", rowsProcessed: 90, rowsDeleted: 90, gbFreed: 320.0, error: null },
  { id: "j4", policyName: "User Content Anonymization",       dataStore: "PostgreSQL prod",    startTime: "2025-02-01 06:00", endTime: "2025-02-01 06:31", status: "failed",    rowsProcessed: 12_000, rowsDeleted: 0, gbFreed: 0,   error: "Foreign key constraint violation on content.replies" },
  { id: "j5", policyName: "Metrics 13-Month Rollup",          dataStore: "ClickHouse metrics", startTime: "2025-01-31 04:00", endTime: "2025-01-31 04:45", status: "completed", rowsProcessed: 890_000, rowsDeleted: 0, gbFreed: 9.2, error: null },
];

function fmt(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000)     {return `${(n / 1_000).toFixed(0)}k`;}
  return String(n);
}

export default function DataRetentionManager() {
  const [tab, setTab]                   = useState<"overview" | "policies" | "records" | "jobs">("overview");
  const [selectedPolicy, setSelectedPolicy] = useState<RetentionPolicy | null>(null);
  const [classFilter, setClassFilter]   = useState<DataClass | "all">("all");

  const filteredPolicies = classFilter === "all" ? policies : policies.filter(p => p.dataClass === classFilter);
  const expiredCount  = records.filter(r => r.status === "expired").length;
  const expiringCount = records.filter(r => r.status === "expiring").length;
  const totalExpiredGB = records.reduce((acc, r) => {
    const policy = policies.find(p => p.id === r.policyId);
    return r.status === "expired" ? acc + (policy?.storageGB ?? 0) : acc;
  }, 0);

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "overview",  label: "Overview" },
    { id: "policies",  label: "Policies" },
    { id: "records",   label: "Inventory" },
    { id: "jobs",      label: "Deletion Jobs" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Data Retention Manager</h1>
            <p className="text-zinc-400 text-sm mt-1">Lifecycle policies, expiry tracking, and compliance records</p>
          </div>
          <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors">
            + New Policy
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedPolicy(null); }}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                tab === t.id
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Active Policies",   value: policies.filter(p => p.enabled).length, color: "text-emerald-400" },
                { label: "Expired Records",   value: expiredCount,      color: "text-rose-400" },
                { label: "Expiring Soon",     value: expiringCount,     color: "text-amber-400" },
                { label: "Reclaimable GB",    value: `${totalExpiredGB.toFixed(1)}`, color: "text-sky-400" },
              ].map(kpi => (
                <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">{kpi.label}</p>
                  <p className={cn("text-3xl font-bold mt-1", kpi.color)}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Data stores */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Data Store Summary</h2>
              <div className="space-y-3">
                {dataStores.map(ds => {
                  const expiringPct = Math.round((ds.expiringGB / ds.totalGB) * 100);
                  const expiredPct  = Math.round((ds.expiredGB / ds.totalGB) * 100);
                  return (
                    <div key={ds.id} className="flex items-center gap-4">
                      <div className="w-36 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{ds.name}</p>
                        <p className="text-xs text-zinc-500">{ds.type}</p>
                      </div>
                      {/* Storage bar */}
                      <div className="flex-1 bg-zinc-800 rounded-full h-2 relative">
                        <div
                          className="absolute left-0 top-0 h-2 rounded-full bg-amber-500 opacity-70"
                          style={{ width: `${expiringPct}%` }}
                        />
                        <div
                          className="absolute left-0 top-0 h-2 rounded-full bg-rose-500"
                          style={{ width: `${expiredPct}%` }}
                        />
                      </div>
                      <div className="text-xs text-zinc-400 w-20 text-right">{ds.totalGB} GB</div>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", scanBadge[ds.scanStatus])}>{ds.scanStatus}</span>
                      <span className="text-xs text-zinc-600 w-20 text-right">Scanned {ds.lastScanned}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-4 pt-3 border-t border-zinc-800">
                <div className="flex items-center gap-2"><div className="w-3 h-1.5 rounded-full bg-amber-500 opacity-70" /><span className="text-xs text-zinc-400">Expiring</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-1.5 rounded-full bg-rose-500" /><span className="text-xs text-zinc-400">Expired</span></div>
              </div>
            </div>

            {/* Policy status grid */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Policy Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {policies.map(p => (
                  <div key={p.id} className="bg-zinc-800/50 rounded-lg p-3 flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", p.enabled ? "bg-emerald-400" : "bg-zinc-500")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.name}</p>
                      <p className="text-xs text-zinc-500">{p.scope} · {p.retentionDays}d</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", dataClassColor[p.dataClass])}>{p.dataClass}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", actionBadge[p.action])}>{p.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Policies */}
        {tab === "policies" && (
          <div className="space-y-4">
            {/* Class filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setClassFilter("all")}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", classFilter === "all" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200")}
              >
                All
              </button>
              {(["pii","financial","logs","metrics","backups","user-content"] as DataClass[]).map(c => (
                <button
                  key={c}
                  onClick={() => setClassFilter(c)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", classFilter === c ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200")}
                >
                  {c}
                </button>
              ))}
            </div>

            {selectedPolicy ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
                <button onClick={() => setSelectedPolicy(null)} className="text-zinc-400 hover:text-white text-sm">← Back</button>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">{selectedPolicy.name}</h2>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", selectedPolicy.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-500/20 text-zinc-400")}>
                    {selectedPolicy.enabled ? "enabled" : "disabled"}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">{selectedPolicy.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Data Class",    value: selectedPolicy.dataClass },
                    { label: "Action",        value: selectedPolicy.action },
                    { label: "Retention",     value: `${selectedPolicy.retentionDays} days` },
                    { label: "Scope",         value: selectedPolicy.scope },
                    { label: "Owner",         value: selectedPolicy.owner },
                    { label: "Affected Rows", value: fmt(selectedPolicy.affectedRows) },
                    { label: "Storage",       value: `${selectedPolicy.storageGB} GB` },
                    { label: "Last Run",      value: selectedPolicy.lastRun },
                  ].map(m => (
                    <div key={m.label} className="bg-zinc-800/60 rounded-lg p-3">
                      <p className="text-xs text-zinc-500">{m.label}</p>
                      <p className="text-sm font-medium text-white mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-sm font-medium transition-colors">Run Now</button>
                  <button className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors">
                    {selectedPolicy.enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPolicies.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPolicy(p)}
                    className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", p.enabled ? "bg-emerald-400" : "bg-zinc-500")} />
                        <span className="text-sm font-semibold text-white">{p.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className={cn("text-xs px-2 py-0.5 rounded", dataClassColor[p.dataClass])}>{p.dataClass}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded", actionBadge[p.action])}>{p.action}</span>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-zinc-500 ml-5">
                      <span>{p.scope}</span>
                      <span>{p.retentionDays}d retention</span>
                      <span>{fmt(p.affectedRows)} rows</span>
                      <span>{p.storageGB} GB</span>
                      <span>Next: {p.nextRun}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Records / Inventory */}
        {tab === "records" && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">Data inventory by policy scope and expiry status</p>
            {records.map(r => (
              <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", statusBadge[r.status])}>{r.status}</span>
                    <span className="text-sm font-semibold text-white">{r.dataStore}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded", dataClassColor[r.dataClass])}>{r.dataClass}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{r.policyName}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs text-zinc-400">
                  <span>Records: {fmt(r.recordCount)}</span>
                  <span>Oldest: {r.oldestRecord}</span>
                  <span className={r.status === "expired" ? "text-rose-400" : r.status === "expiring" ? "text-amber-400" : ""}>
                    Expires: {r.expiresOn}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Deletion Jobs */}
        {tab === "jobs" && (
          <div className="space-y-3">
            {deletionJobs.map(job => (
              <div key={job.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", jobBadge[job.status])}>{job.status}</span>
                    <span className="text-sm font-semibold text-white">{job.policyName}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{job.dataStore}</span>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-2">
                  <div className="bg-zinc-800/50 rounded p-2">
                    <p className="text-xs text-zinc-500">Processed</p>
                    <p className="text-sm font-medium text-white">{fmt(job.rowsProcessed)}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded p-2">
                    <p className="text-xs text-zinc-500">Deleted</p>
                    <p className="text-sm font-medium text-rose-400">{fmt(job.rowsDeleted)}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded p-2">
                    <p className="text-xs text-zinc-500">GB Freed</p>
                    <p className="text-sm font-medium text-emerald-400">{job.gbFreed}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded p-2">
                    <p className="text-xs text-zinc-500">Duration</p>
                    <p className="text-sm font-medium text-zinc-300">
                      {job.endTime ? `${Math.round((new Date(job.endTime).getTime() - new Date(job.startTime).getTime()) / 60000)}min` : "running"}
                    </p>
                  </div>
                </div>
                {job.error && (
                  <div className="mt-2 bg-rose-500/10 border border-rose-500/20 rounded p-2">
                    <p className="text-xs text-rose-400 font-medium">Error: {job.error}</p>
                  </div>
                )}
                {job.status === "running" && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Progress</span>
                      <span>{Math.round((job.rowsProcessed / 4_200_000) * 100)}%</span>
                    </div>
                    <div className="bg-zinc-800 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-sky-500"
                        style={{ width: `${Math.round((job.rowsProcessed / 4_200_000) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
