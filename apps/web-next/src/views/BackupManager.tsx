import React, { useState } from "react";
import { HardDrive } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";

// --- Types ---

type BackupStatus = "completed" | "running" | "failed" | "pending";
type BackupType = "full" | "incremental" | "snapshot";

interface BackupJob {
  id: string;
  name: string;
  type: BackupType;
  status: BackupStatus;
  size: string;
  duration: string;
  targetStorage: string;
  createdAt: string;
  manifest: string[];
  checksum: string;
  path: string;
}

interface Schedule {
  id: string;
  name: string;
  frequency: "hourly" | "daily" | "weekly";
  retention: string;
  nextRun: string;
  lastRun: string;
  enabled: boolean;
}

// --- Sample Data ---

const INITIAL_BACKUPS: BackupJob[] = [
  {
    id: "bak-001", name: "Nightly Production Sync", type: "full", status: "completed",
    size: "1.2 GB", duration: "4m 12s", targetStorage: "AWS-S3-Primary",
    createdAt: "2026-02-21 02:00:14",
    manifest: ["db_dump.sql", "media_assets.tar.gz", "config_v2.json"],
    checksum: "sha256:e3b0c442...810", path: "s3://horizon-backups/prod/2026-02-21-0200"
  },
  {
    id: "bak-002", name: "User Assets Incremental", type: "incremental", status: "completed",
    size: "45.8 MB", duration: "18s", targetStorage: "AWS-S3-Primary",
    createdAt: "2026-02-21 14:00:02",
    manifest: ["uploads/2026/02/img-091.jpg", "uploads/2026/02/doc-211.pdf"],
    checksum: "sha256:4f3a2c...b12", path: "s3://horizon-backups/prod/inc/2026-02-21-1400"
  },
  {
    id: "bak-003", name: "Staging Snapshot", type: "snapshot", status: "running",
    size: "890 MB", duration: "2m 45s (active)", targetStorage: "GCS-Secondary",
    createdAt: "2026-02-22 04:00:00", manifest: ["full_system_snap.img"],
    checksum: "computing...", path: "gcs://horizon-staging/snap/2026-02-22-0400"
  },
  {
    id: "bak-004", name: "Emergency Pre-Deploy", type: "full", status: "failed",
    size: "0 B", duration: "12s", targetStorage: "Local-NAS",
    createdAt: "2026-02-20 22:15:33", manifest: [],
    checksum: "N/A", path: "/mnt/backups/manual/pre-deploy-v1.4"
  },
  {
    id: "bak-005", name: "Weekly Global Archive", type: "full", status: "completed",
    size: "14.2 GB", duration: "45m 10s", targetStorage: "Azure-Glacier",
    createdAt: "2026-02-15 01:00:00",
    manifest: ["all_databases.sql", "legacy_logs_2025.zip", "customer_records_v3.tar"],
    checksum: "sha256:91a2b3...f90", path: "az://archive/2026-02-15"
  },
  {
    id: "bak-006", name: "Daily Analytics Dump", type: "incremental", status: "completed",
    size: "156 MB", duration: "1m 05s", targetStorage: "AWS-S3-Primary",
    createdAt: "2026-02-20 03:00:10", manifest: ["analytics_raw_data.csv"],
    checksum: "sha256:d82e1...12c", path: "s3://horizon-backups/analytics/2026-02-20"
  },
  {
    id: "bak-007", name: "Hourly Logs Rotation", type: "incremental", status: "pending",
    size: "Pending", duration: "--", targetStorage: "AWS-S3-Primary",
    createdAt: "2026-02-22 05:00:00", manifest: [],
    checksum: "Waiting...", path: "s3://horizon-backups/logs/2026-02-22-0500"
  },
  {
    id: "bak-008", name: "Legacy VM Export", type: "full", status: "completed",
    size: "42.1 GB", duration: "2h 15m", targetStorage: "GCS-Secondary",
    createdAt: "2026-01-20 12:00:00",
    manifest: ["vm_disk_01.vmdk", "vm_config.xml"],
    checksum: "sha256:ff01e2...888", path: "gcs://horizon-legacy/export-jan"
  }
];

const INITIAL_SCHEDULES: Schedule[] = [
  { id: "sch-1", name: "Main Production DB", frequency: "hourly", retention: "30 days", nextRun: "2026-02-22 05:00:00", lastRun: "2026-02-22 04:00:00", enabled: true },
  { id: "sch-2", name: "User Uploads Media", frequency: "daily", retention: "90 days", nextRun: "2026-02-23 02:00:00", lastRun: "2026-02-22 02:00:00", enabled: true },
  { id: "sch-3", name: "System Configuration", frequency: "weekly", retention: "1 year", nextRun: "2026-02-28 00:00:00", lastRun: "2026-02-21 00:00:00", enabled: false },
  { id: "sch-4", name: "Analytics Data Stream", frequency: "daily", retention: "14 days", nextRun: "2026-02-23 03:00:00", lastRun: "2026-02-22 03:00:00", enabled: true }
];

// --- Sub-Components ---

const StatusBadge = ({ status }: { status: BackupStatus }) => {
  const styles = {
    completed: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    running: "bg-indigo-400/10 text-indigo-400 border-indigo-400/20",
    failed: "bg-rose-400/10 text-rose-400 border-rose-400/20",
    pending: "bg-amber-400/10 text-amber-400 border-amber-400/20"
  };
  const labels = {
    completed: "Completed",
    running: "Running",
    failed: "Failed",
    pending: "Pending"
  };
  const icons = { completed: "✅", running: "🔄", failed: "❌", pending: "⏳" };
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", styles[status])}>
      <span aria-hidden="true">{icons[status]}</span> {labels[status]}
    </span>
  );
};

const TypeBadge = ({ type }: { type: BackupType }) => {
  const styles = {
    full: "bg-surface-2 text-fg-primary",
    incremental: "bg-surface-2 text-indigo-300",
    snapshot: "bg-surface-2 text-amber-300"
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border border-tok-border", styles[type])}>
      {type}
    </span>
  );
};

const ProgressBar = ({ value, color = "bg-indigo-500", label }: { value: number; color?: string; label?: string }) => (
  <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? `${value}%`}>
    <div className={cn("h-full transition-all duration-500", color)} style={{ width: `${value}%` }} />
  </div>
);

// --- Main View ---

type TabId = "backups" | "schedule" | "restore" | "settings";

export default function BackupManager() {
  const [activeTab, setActiveTab] = useState<TabId>("backups");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [backups] = useState<BackupJob[]>(INITIAL_BACKUPS);
  const [schedules] = useState<Schedule[]>(INITIAL_SCHEDULES);

  const [restoreStep, setRestoreStep] = useState<1 | 2 | 3>(1);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<"prod" | "staging" | "dev">("staging");

  const tabs: { id: TabId; label: string }[] = [
    { id: "backups", label: "Backups" },
    { id: "schedule", label: "Schedule" },
    { id: "restore", label: "Restore" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <>
    <a href="#backup-manager-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-surface-0 focus:text-fg-primary focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
      Skip to main content
    </a>
    <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-5 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Backup & Recovery</h1>
            <p className="text-fg-secondary mt-1">Manage data resilience, scheduled snapshots, and disaster recovery orchestration.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-surface-1 border border-tok-border rounded-lg hover:bg-surface-2 transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
              Export Logs
            </button>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm font-medium shadow-lg shadow-indigo-500/20 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
              <span aria-hidden="true">⚡</span> Trigger Backup
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="border-b border-tok-border">
          <nav role="tablist" aria-label="Backup manager sections" className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`bm-tab-${tab.id}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`bm-tabpanel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "pb-4 text-sm font-medium transition-all relative capitalize focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                  activeTab === tab.id ? "text-indigo-400" : "text-fg-muted hover:text-fg-primary"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_-4px_10px_rgba(99,102,241,0.4)]" aria-hidden="true" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <main id="backup-manager-main" className="min-h-[600px]">

          {/* TAB: BACKUPS */}
          <section
            id="bm-tabpanel-backups"
            role="tabpanel"
            aria-labelledby="bm-tab-backups"
            hidden={activeTab !== "backups"}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-1 p-4 rounded-xl border border-tok-border">
                <div className="text-fg-muted text-xs font-bold uppercase tracking-widest mb-1">Total Storage Used</div>
                <div className="text-2xl font-mono">59.4 GB</div>
                <div className="mt-3">
                  <ProgressBar value={64} label="Storage: 59.4 GB of 100 GB used (64%)" />
                  <div className="flex justify-between mt-1 text-[10px] text-fg-muted" aria-hidden="true">
                    <span>Used: 59.4GB</span>
                    <span>Total: 100GB</span>
                  </div>
                </div>
              </div>
              <div className="bg-surface-1 p-4 rounded-xl border border-tok-border">
                <div className="text-fg-muted text-xs font-bold uppercase tracking-widest mb-1">Success Rate (24h)</div>
                <div className="text-2xl font-mono text-emerald-400">98.2%</div>
                <div className="mt-3 flex gap-1 h-4" aria-label="24-hour success rate chart: 98.2%">
                  {[80, 90, 100, 100, 100, 95, 100, 100, 40, 100, 100, 100].map((h, i) => (
                    <div key={i} className="flex-1 bg-surface-2 rounded-sm relative" aria-hidden="true">
                      <div
                        className={cn("absolute bottom-0 left-0 right-0 rounded-sm", h < 50 ? "bg-rose-500" : "bg-emerald-500")}
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-surface-1 p-4 rounded-xl border border-tok-border" role="status" aria-live="polite">
                <div className="text-fg-muted text-xs font-bold uppercase tracking-widest mb-1">Active Jobs</div>
                <div className="text-2xl font-mono text-indigo-400">1 Running</div>
                <div className="mt-2 text-xs text-fg-secondary">Next scheduled: 14 mins</div>
              </div>
            </div>

            {backups.length === 0 ? (
              <div className="bg-surface-1 rounded-xl border border-tok-border p-8">
                <ContextualEmptyState icon={HardDrive} title="No backups yet" description="Create your first backup to protect your agent configurations and data." />
              </div>
            ) : (
              <div className="bg-surface-1 rounded-xl border border-tok-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse" aria-label="Backup jobs">
                    <thead>
                      <tr className="bg-surface-0/50 border-b border-tok-border text-fg-secondary text-xs font-bold uppercase tracking-wider">
                        <th scope="col" className="px-6 py-4">Job Name</th>
                        <th scope="col" className="px-6 py-4">Type</th>
                        <th scope="col" className="px-6 py-4">Status</th>
                        <th scope="col" className="px-6 py-4">Size</th>
                        <th scope="col" className="px-6 py-4">Duration</th>
                        <th scope="col" className="px-6 py-4">Target</th>
                        <th scope="col" className="px-6 py-4">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tok-border">
                      {backups.map((job) => (
                        <React.Fragment key={job.id}>
                          <tr
                            onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedJob(expandedJob === job.id ? null : job.id); } }}
                            tabIndex={0}
                            role="button"
                            aria-expanded={expandedJob === job.id}
                            aria-label={`${job.name} — ${job.status}. Press to ${expandedJob === job.id ? 'collapse' : 'expand'} details`}
                            className="hover:bg-surface-2/50 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none focus-visible:ring-inset"
                          >
                            <td className="px-6 py-4">
                              <div className="font-medium text-sm flex items-center gap-2">
                                <span className="text-fg-muted text-[10px] font-mono">{job.id}</span>
                                {job.name}
                              </div>
                            </td>
                            <td className="px-6 py-4"><TypeBadge type={job.type} /></td>
                            <td className="px-6 py-4"><StatusBadge status={job.status} /></td>
                            <td className="px-6 py-4 text-sm font-mono text-fg-primary">{job.size}</td>
                            <td className="px-6 py-4 text-sm text-fg-secondary">{job.duration}</td>
                            <td className="px-6 py-4 text-sm text-fg-secondary">{job.targetStorage}</td>
                            <td className="px-6 py-4 text-sm text-fg-muted whitespace-nowrap">{job.createdAt}</td>
                          </tr>
                          {expandedJob === job.id && (
                            <tr className="bg-surface-0/40">
                              <td colSpan={7} className="px-8 py-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-fg-muted uppercase">File Manifest</h4>
                                    <ul className="space-y-1">
                                      {job.manifest.length > 0 ? job.manifest.map((file, i) => (
                                        <li key={i} className="text-xs font-mono text-fg-secondary flex items-center gap-2">
                                          <span aria-hidden="true">📄</span> {file}
                                        </li>
                                      )) : (
                                        <li className="text-xs italic text-fg-muted">No files recorded</li>
                                      )}
                                    </ul>
                                  </div>
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-fg-muted uppercase">Integrity</h4>
                                    <div className="p-3 bg-surface-1 border border-tok-border rounded text-[11px] font-mono break-all text-indigo-300">
                                      <div className="text-fg-muted mb-1">CHECKSUM</div>
                                      {job.checksum}
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-fg-muted uppercase">Storage Path</h4>
                                    <div className="p-3 bg-surface-1 border border-tok-border rounded text-[11px] font-mono break-all text-fg-secondary">
                                      {job.path}
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                      <button className="text-[10px] px-3 py-1 bg-indigo-600 rounded hover:bg-indigo-500 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">Verify Path</button>
                                      <button className="text-[10px] px-3 py-1 bg-surface-2 rounded hover:bg-surface-3 border border-tok-border transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">Download Zip</button>
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
            )}
          </section>

          {/* TAB: SCHEDULE */}
          <section
            id="bm-tabpanel-schedule"
            role="tabpanel"
            aria-labelledby="bm-tab-schedule"
            hidden={activeTab !== "schedule"}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-surface-1 rounded-xl border border-tok-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse" aria-label="Backup schedules">
                    <thead>
                      <tr className="bg-surface-0/50 border-b border-tok-border text-fg-secondary text-xs font-bold uppercase tracking-wider">
                        <th scope="col" className="px-6 py-4">Schedule Name</th>
                        <th scope="col" className="px-6 py-4">Frequency</th>
                        <th scope="col" className="px-6 py-4">Retention</th>
                        <th scope="col" className="px-6 py-4">Last / Next Run</th>
                        <th scope="col" className="px-6 py-4">Enabled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tok-border">
                      {schedules.map((sch) => (
                        <tr key={sch.id} className="hover:bg-surface-2/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium">{sch.name}</div>
                          </td>
                          <td className="px-6 py-4 capitalize text-sm text-fg-primary">{sch.frequency}</td>
                          <td className="px-6 py-4 text-sm text-fg-secondary">{sch.retention}</td>
                          <td className="px-6 py-4">
                            <div className="text-[10px] text-fg-muted uppercase mb-1">Last: {sch.lastRun}</div>
                            <div className="text-xs font-mono text-indigo-300">Next: {sch.nextRun}</div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              role="switch"
                              aria-checked={sch.enabled}
                              aria-label={`${sch.name} schedule — ${sch.enabled ? 'enabled' : 'disabled'}`}
                              className={cn(
                                "w-10 h-5 rounded-full relative transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                                sch.enabled ? "bg-indigo-600" : "bg-surface-3"
                              )}
                            >
                              <div className={cn(
                                "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                sch.enabled ? "left-6" : "left-1"
                              )} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-surface-1 p-6 rounded-xl border border-tok-border h-fit space-y-6">
              <div>
                <h3 className="text-lg font-bold">New Schedule</h3>
                <p className="text-fg-secondary text-sm">Create a new automated backup job.</p>
              </div>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()} aria-label="New backup schedule form">
                <div className="space-y-2">
                  <label htmlFor="sch-name" className="text-xs font-bold text-fg-muted uppercase">Job Name</label>
                  <input
                    id="sch-name"
                    type="text"
                    placeholder="e.g. Daily Logs Archive"
                    className="w-full bg-surface-0 border border-tok-border rounded-lg p-3 text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sch-freq" className="text-xs font-bold text-fg-muted uppercase">Frequency</label>
                  <select
                    id="sch-freq"
                    className="w-full bg-surface-0 border border-tok-border rounded-lg p-3 text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none appearance-none"
                  >
                    <option>Hourly</option>
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="sch-retention" className="text-xs font-bold text-fg-muted uppercase">Retention Period</label>
                  <div className="flex gap-2">
                    <input
                      id="sch-retention"
                      type="number"
                      defaultValue={30}
                      aria-label="Retention amount"
                      className="flex-1 bg-surface-0 border border-tok-border rounded-lg p-3 text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                    />
                    <select
                      aria-label="Retention unit"
                      className="bg-surface-0 border border-tok-border rounded-lg p-3 text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                    >
                      <option>Days</option>
                      <option>Weeks</option>
                      <option>Months</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-sm transition-all mt-4 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                >
                  Create Schedule
                </button>
              </form>
            </div>
          </section>

          {/* TAB: RESTORE */}
          <section
            id="bm-tabpanel-restore"
            role="tabpanel"
            aria-labelledby="bm-tab-restore"
            hidden={activeTab !== "restore"}
            className="max-w-4xl mx-auto"
          >
            {/* Stepper Header */}
            <div className="flex justify-between mb-12 relative" role="list" aria-label="Restore steps">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-surface-2 -translate-y-1/2 z-0" aria-hidden="true" />
              {([1, 2, 3] as const).map((step) => {
                const labels = { 1: "Select Source", 2: "Configuration", 3: "Execution" };
                return (
                  <div key={step} className="relative z-10 flex flex-col items-center gap-2" role="listitem">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all",
                        restoreStep === step ? "bg-indigo-600 border-indigo-500 text-fg-primary shadow-lg shadow-indigo-500/20" :
                        restoreStep > step ? "bg-emerald-500 border-emerald-400 text-fg-primary" : "bg-surface-1 border-tok-border text-fg-muted"
                      )}
                      aria-current={restoreStep === step ? 'step' : undefined}
                    >
                      {restoreStep > step ? <span aria-hidden="true">✓</span> : <span aria-hidden="true">{step}</span>}
                      <span className="sr-only">{restoreStep > step ? 'Completed: ' : restoreStep === step ? 'Current: ' : ''}{labels[step]}</span>
                    </div>
                    <span className={cn("text-xs font-bold uppercase tracking-wider", restoreStep === step ? "text-indigo-400" : "text-fg-muted")} aria-hidden="true">
                      {labels[step]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Step 1: Select Source */}
            {restoreStep === 1 && (
              <div className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <div className="p-6 border-b border-tok-border">
                  <h3 className="text-xl font-bold">Choose a Restore Point</h3>
                  <p className="text-fg-secondary text-sm">Select a successful backup job to use as the recovery source.</p>
                </div>
                <div className="max-h-[400px] overflow-y-auto" role="listbox" aria-label="Available restore points">
                  {backups.filter(b => b.status === "completed").map((job) => (
                    <div
                      key={job.id}
                      role="option"
                      aria-selected={selectedBackup === job.id}
                      tabIndex={0}
                      onClick={() => setSelectedBackup(job.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBackup(job.id); } }}
                      className={cn(
                        "p-4 border-b border-tok-border last:border-0 cursor-pointer transition-colors flex items-center justify-between focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none focus-visible:ring-inset",
                        selectedBackup === job.id ? "bg-indigo-500/10 border-indigo-500/30" : "hover:bg-surface-2"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn("w-4 h-4 rounded-full border flex items-center justify-center", selectedBackup === job.id ? "border-indigo-500" : "border-tok-border")}
                          aria-hidden="true"
                        >
                          {selectedBackup === job.id && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{job.name}</div>
                          <div className="text-xs text-fg-muted">{job.createdAt} · {job.size} · {job.targetStorage}</div>
                        </div>
                      </div>
                      <TypeBadge type={job.type} />
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-surface-0/50 flex justify-end">
                  <button
                    disabled={!selectedBackup}
                    onClick={() => setRestoreStep(2)}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-sm transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                  >
                    Next: Target Configuration
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Configuration */}
            {restoreStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="bg-surface-1 border border-tok-border rounded-xl p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-fg-muted uppercase" id="restore-target-label">Target Environment</p>
                      <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-labelledby="restore-target-label">
                        {(["staging", "dev", "prod"] as const).map((env) => (
                          <button
                            key={env}
                            role="radio"
                            aria-checked={restoreTarget === env}
                            onClick={() => setRestoreTarget(env)}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-lg border transition-all text-left focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                              restoreTarget === env ? "bg-indigo-500/10 border-indigo-500 text-fg-primary" : "bg-surface-0 border-tok-border text-fg-secondary hover:border-tok-border"
                            )}
                          >
                            <span className="capitalize font-medium">{env} environment</span>
                            {env === "prod" && <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded border border-rose-400/20">Critical</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-fg-muted uppercase">Estimated Impact</p>
                      <div className="bg-amber-400/10 border border-amber-400/20 p-4 rounded-lg space-y-3" role="alert">
                        <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                          <span aria-hidden="true">⚠️</span> Warning: Potential Downtime
                        </div>
                        <p className="text-xs text-fg-primary leading-relaxed">
                          Restoring to <span className="text-fg-primary font-bold">{restoreTarget}</span> will require a system reboot and approximately <span className="text-fg-primary font-bold">12–15 minutes</span> of downtime. Active sessions will be terminated.
                        </p>
                        <div className="pt-2 border-t border-amber-400/10 text-[10px] text-fg-secondary">
                          Source: {backups.find(b => b.id === selectedBackup)?.name}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-6 border-t border-tok-border">
                    <button
                      onClick={() => setRestoreStep(1)}
                      className="px-6 py-2 bg-surface-2 hover:bg-surface-3 text-fg-primary rounded-lg font-bold text-sm transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setRestoreStep(3)}
                      className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 rounded-lg font-bold text-sm transition-all shadow-lg shadow-rose-500/20 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                    >
                      Confirm & Initiate Restore
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Execution */}
            {restoreStep === 3 && (
              <div className="space-y-6 animate-in zoom-in-95 duration-300">
                <div className="bg-surface-1 border border-tok-border rounded-xl p-8 text-center space-y-6" role="status" aria-live="polite" aria-label="Restore in progress">
                  <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" aria-hidden="true" />
                  <div>
                    <h3 className="text-2xl font-bold">Restore in Progress</h3>
                    <p className="text-fg-secondary text-sm mt-2">Currently writing blocks to <span className="text-fg-primary font-mono">{restoreTarget}-cluster-01</span></p>
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <ProgressBar value={42} label="Restore progress: 42% complete" />
                    <div className="flex justify-between text-[10px] font-mono text-fg-muted" aria-hidden="true">
                      <span>DATA: 512MB / 1.2GB</span>
                      <span>42% COMPLETE</span>
                    </div>
                  </div>
                </div>

                <div className="bg-black rounded-xl border border-tok-border p-6 font-mono text-xs overflow-hidden h-64 relative" aria-label="Restore log stream" role="log" aria-live="polite">
                  <div className="absolute top-4 left-6 text-fg-muted font-bold uppercase tracking-widest text-[10px]">Restore Logic Stream</div>
                  <div className="mt-8 space-y-2 text-fg-secondary">
                    <div>[04:12:01] <span className="text-indigo-400">INFO</span> Initializing connection to S3 backend...</div>
                    <div>[04:12:03] <span className="text-indigo-400">INFO</span> Validating manifest checksums...</div>
                    <div>[04:12:05] <span className="text-indigo-400">INFO</span> Verified 3 of 3 files. Integrity match 100%.</div>
                    <div>[04:12:08] <span className="text-amber-400">WARN</span> Suspending health check probes on target...</div>
                    <div>[04:12:12] <span className="text-emerald-400">EXEC</span> BEGIN DATA STREAM: db_dump.sql (442MB)</div>
                    <div className="motion-safe:animate-pulse text-fg-primary">_ [04:12:15] WRITING BLOCK 122/840...</div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => { setRestoreStep(1); setActiveTab("backups"); }}
                    className="text-fg-muted hover:text-fg-primary text-xs font-bold uppercase tracking-widest transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none rounded px-2 py-1"
                  >
                    ← Abort & Return to Dashboard
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* TAB: SETTINGS */}
          <section
            id="bm-tabpanel-settings"
            role="tabpanel"
            aria-labelledby="bm-tab-settings"
            hidden={activeTab !== "settings"}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {/* Storage Backends */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Storage Backends</h3>
                <button className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none rounded px-1 py-0.5">
                  + Add Provider
                </button>
              </div>
              <div className="space-y-4">
                {[
                  { name: "AWS-S3-Primary", type: "S3", usage: 64, status: "connected" as const },
                  { name: "GCS-Secondary", type: "GCS", usage: 22, status: "connected" as const },
                  { name: "Local-NAS", type: "local", usage: 89, status: "disconnected" as const }
                ].map((store, i) => (
                  <div key={i} className="bg-surface-1 border border-tok-border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-surface-0 rounded-lg flex items-center justify-center border border-tok-border font-bold text-xs text-fg-muted" aria-hidden="true">
                      {store.type}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold">{store.name}</span>
                        <span className={cn("text-[10px] font-bold uppercase", store.status === "connected" ? "text-emerald-400" : "text-rose-400")}>
                          {store.status}
                        </span>
                      </div>
                      <ProgressBar value={store.usage} color={store.status === "connected" ? "bg-indigo-500" : "bg-surface-3"} label={`${store.name}: ${store.usage}% capacity used`} />
                      <div className="text-[10px] text-fg-muted mt-1 uppercase tracking-tighter" aria-hidden="true">Capacity: {store.usage}% full</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Encryption & Policies */}
            <div className="space-y-8">
              <section className="bg-surface-1 border border-tok-border rounded-xl p-6 space-y-6" aria-label="Encryption settings">
                <h3 className="text-lg font-bold">Encryption Settings</h3>
                <div className="space-y-4">
                  {[
                    { id: "enc-aes", label: "AES-256 Encryption", desc: "Enable at-rest encryption for all backup targets.", checked: true },
                    { id: "enc-kms", label: "External Key Management (KMS)", desc: "Use AWS/Google KMS for root key rotation.", checked: false },
                  ].map((setting) => (
                    <div key={setting.id} className="flex items-center justify-between p-4 bg-surface-0 rounded-lg border border-tok-border">
                      <div>
                        <label htmlFor={setting.id} className="text-sm font-bold cursor-pointer">{setting.label}</label>
                        <div className="text-xs text-fg-muted">{setting.desc}</div>
                      </div>
                      <button
                        id={setting.id}
                        role="switch"
                        aria-checked={setting.checked}
                        aria-label={setting.label}
                        className={cn(
                          "w-10 h-5 rounded-full relative transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                          setting.checked ? "bg-indigo-600" : "bg-surface-3"
                        )}
                      >
                        <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", setting.checked ? "left-6" : "left-1")} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-surface-1 border border-tok-border rounded-xl p-6 space-y-6" aria-label="Notification rules">
                <h3 className="text-lg font-bold">Notification Rules</h3>
                <div className="space-y-3" role="list">
                  {["Failure Alerts", "Weekly Reports", "Storage Quota Warnings"].map((rule, i) => (
                    <div key={i} className="flex items-center gap-3" role="listitem">
                      <div className="w-4 h-4 rounded border border-indigo-500 bg-indigo-500 flex items-center justify-center text-[10px] text-fg-primary" aria-hidden="true">✓</div>
                      <span className="text-sm text-fg-primary">{rule}</span>
                      <span className="sr-only">(enabled)</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>

        </main>
      </div>
    </div>
    </>
  );
}
