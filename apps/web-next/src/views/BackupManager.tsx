import React, { useState } from "react";
import { cn } from "../lib/utils";

/**
 * BackupManager Component
 * 
 * A comprehensive backup and disaster recovery management dashboard for the Horizon UI.
 * Features:
 * - Backups: View and manage historical backup jobs.
 * - Schedule: Configure automated backup routines.
 * - Restore: Browser-based restore point selection and execution.
 * - Settings: Global configuration for storage, encryption, and notifications.
 * 
 * DESIGN SYSTEM:
 * - Dark theme: zinc-950/900/800
 * - Accent: indigo-500/600
 * - Status: emerald-400 (success), rose-400 (error), amber-400 (warning)
 */

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

interface StorageBackend {
  id: string;
  name: string;
  type: "S3" | "GCS" | "Azure" | "local";
  status: "connected" | "disconnected";
  usage: number; // 0-100
}

// --- Sample Data ---

const INITIAL_BACKUPS: BackupJob[] = [
  {
    id: "bak-001",
    name: "Nightly Production Sync",
    type: "full",
    status: "completed",
    size: "1.2 GB",
    duration: "4m 12s",
    targetStorage: "AWS-S3-Primary",
    createdAt: "2026-02-21 02:00:14",
    manifest: ["db_dump.sql", "media_assets.tar.gz", "config_v2.json"],
    checksum: "sha256:e3b0c442...810",
    path: "s3://horizon-backups/prod/2026-02-21-0200"
  },
  {
    id: "bak-002",
    name: "User Assets Incremental",
    type: "incremental",
    status: "completed",
    size: "45.8 MB",
    duration: "18s",
    targetStorage: "AWS-S3-Primary",
    createdAt: "2026-02-21 14:00:02",
    manifest: ["uploads/2026/02/img-091.jpg", "uploads/2026/02/doc-211.pdf"],
    checksum: "sha256:4f3a2c...b12",
    path: "s3://horizon-backups/prod/inc/2026-02-21-1400"
  },
  {
    id: "bak-003",
    name: "Staging Snapshot",
    type: "snapshot",
    status: "running",
    size: "890 MB",
    duration: "2m 45s (active)",
    targetStorage: "GCS-Secondary",
    createdAt: "2026-02-22 04:00:00",
    manifest: ["full_system_snap.img"],
    checksum: "computing...",
    path: "gcs://horizon-staging/snap/2026-02-22-0400"
  },
  {
    id: "bak-004",
    name: "Emergency Pre-Deploy",
    type: "full",
    status: "failed",
    size: "0 B",
    duration: "12s",
    targetStorage: "Local-NAS",
    createdAt: "2026-02-20 22:15:33",
    manifest: [],
    checksum: "N/A",
    path: "/mnt/backups/manual/pre-deploy-v1.4"
  },
  {
    id: "bak-005",
    name: "Weekly Global Archive",
    type: "full",
    status: "completed",
    size: "14.2 GB",
    duration: "45m 10s",
    targetStorage: "Azure-Glacier",
    createdAt: "2026-02-15 01:00:00",
    manifest: ["all_databases.sql", "legacy_logs_2025.zip", "customer_records_v3.tar"],
    checksum: "sha256:91a2b3...f90",
    path: "az://archive/2026-02-15"
  },
  {
    id: "bak-006",
    name: "Daily Analytics Dump",
    type: "incremental",
    status: "completed",
    size: "156 MB",
    duration: "1m 05s",
    targetStorage: "AWS-S3-Primary",
    createdAt: "2026-02-20 03:00:10",
    manifest: ["analytics_raw_data.csv"],
    checksum: "sha256:d82e1...12c",
    path: "s3://horizon-backups/analytics/2026-02-20"
  },
  {
    id: "bak-007",
    name: "Hourly Logs Rotation",
    type: "incremental",
    status: "pending",
    size: "Pending",
    duration: "--",
    targetStorage: "AWS-S3-Primary",
    createdAt: "2026-02-22 05:00:00",
    manifest: [],
    checksum: "Waiting...",
    path: "s3://horizon-backups/logs/2026-02-22-0500"
  },
  {
    id: "bak-008",
    name: "Legacy VM Export",
    type: "full",
    status: "completed",
    size: "42.1 GB",
    duration: "2h 15m",
    targetStorage: "GCS-Secondary",
    createdAt: "2026-01-20 12:00:00",
    manifest: ["vm_disk_01.vmdk", "vm_config.xml"],
    checksum: "sha256:ff01e2...888",
    path: "gcs://horizon-legacy/export-jan"
  }
];

const INITIAL_SCHEDULES: Schedule[] = [
  {
    id: "sch-1",
    name: "Main Production DB",
    frequency: "hourly",
    retention: "30 days",
    nextRun: "2026-02-22 05:00:00",
    lastRun: "2026-02-22 04:00:00",
    enabled: true
  },
  {
    id: "sch-2",
    name: "User Uploads Media",
    frequency: "daily",
    retention: "90 days",
    nextRun: "2026-02-23 02:00:00",
    lastRun: "2026-02-22 02:00:00",
    enabled: true
  },
  {
    id: "sch-3",
    name: "System Configuration",
    frequency: "weekly",
    retention: "1 year",
    nextRun: "2026-02-28 00:00:00",
    lastRun: "2026-02-21 00:00:00",
    enabled: false
  },
  {
    id: "sch-4",
    name: "Analytics Data Stream",
    frequency: "daily",
    retention: "14 days",
    nextRun: "2026-02-23 03:00:00",
    lastRun: "2026-02-22 03:00:00",
    enabled: true
  }
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
    completed: "✅ Completed",
    running: "🔄 Running",
    failed: "❌ Failed",
    pending: "⏳ Pending"
  };

  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", styles[status])}>
      {labels[status]}
    </span>
  );
};

const TypeBadge = ({ type }: { type: BackupType }) => {
  const styles = {
    full: "bg-zinc-800 text-zinc-300",
    incremental: "bg-zinc-800 text-indigo-300",
    snapshot: "bg-zinc-800 text-amber-300"
  };

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border border-zinc-700", styles[type])}>
      {type}
    </span>
  );
};

const ProgressBar = ({ value, color = "bg-indigo-500" }: { value: number; color?: string }) => (
  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
    <div 
      className={cn("h-full transition-all duration-500", color)} 
      style={{ width: `${value}%` }} 
    />
  </div>
);

// --- Main View ---

import { Skeleton } from '../components/Skeleton';

function BackupManagerSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-36 rounded-lg" />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-800">
          <div className="flex gap-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-16 mb-4" />
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 space-y-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-7 gap-4 px-6 py-4 border-b border-zinc-800">
            {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-3 w-full" />)}
          </div>
          {/* Table rows */}
          {[...Array(6)].map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-4 px-6 py-4 border-b border-zinc-800 last:border-b-0 items-center">
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BackupManager({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <BackupManagerSkeleton />;

  const [activeTab, setActiveTab] = useState<"backups" | "schedule" | "restore" | "settings">("backups");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [backups] = useState<BackupJob[]>(INITIAL_BACKUPS);
  const [schedules] = useState<Schedule[]>(INITIAL_SCHEDULES);

  // Restore State
  const [restoreStep, setRestoreStep] = useState<1 | 2 | 3>(1);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<"prod" | "staging" | "dev">("staging");

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Backup & Recovery</h1>
            <p className="text-zinc-400 mt-1">Manage data resilience, scheduled snapshots, and disaster recovery orchestration.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors text-sm font-medium">
              Export Logs
            </button>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm font-medium shadow-lg shadow-indigo-500/20">
              ⚡ Trigger Backup
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="border-b border-zinc-800">
          <nav className="flex gap-8">
            {(["backups", "schedule", "restore", "settings"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "pb-4 text-sm font-medium transition-all relative capitalize",
                  activeTab === tab ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_-4px_10px_rgba(99,102,241,0.4)]" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <main className="min-h-[600px]">
          
          {/* TAB: BACKUPS */}
          {activeTab === "backups" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                  <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Total Storage Used</div>
                  <div className="text-2xl font-mono">59.4 GB</div>
                  <div className="mt-3">
                    <ProgressBar value={64} />
                    <div className="flex justify-between mt-1 text-[10px] text-zinc-500">
                      <span>Used: 59.4GB</span>
                      <span>Total: 100GB</span>
                    </div>
                  </div>
                </div>
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                  <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Success Rate (24h)</div>
                  <div className="text-2xl font-mono text-emerald-400">98.2%</div>
                  <div className="mt-3 flex gap-1 h-4">
                    {[80, 90, 100, 100, 100, 95, 100, 100, 40, 100, 100, 100].map((h, i) => (
                      <div key={i} className="flex-1 bg-zinc-800 rounded-sm relative group">
                        <div 
                          className={cn("absolute bottom-0 left-0 right-0 rounded-sm", h < 50 ? "bg-rose-500" : "bg-emerald-500")} 
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                  <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Active Jobs</div>
                  <div className="text-2xl font-mono text-indigo-400">1 Running</div>
                  <div className="mt-2 text-xs text-zinc-400">Next scheduled: 14 mins</div>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/50 border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Job Name</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Size</th>
                      <th className="px-6 py-4">Duration</th>
                      <th className="px-6 py-4">Target</th>
                      <th className="px-6 py-4">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {backups.map((job) => (
                      <React.Fragment key={job.id}>
                        <tr 
                          onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                          className="hover:bg-zinc-800/50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-sm flex items-center gap-2">
                              <span className="text-zinc-600 text-[10px] font-mono">{job.id}</span>
                              {job.name}
                            </div>
                          </td>
                          <td className="px-6 py-4"><TypeBadge type={job.type} /></td>
                          <td className="px-6 py-4"><StatusBadge status={job.status} /></td>
                          <td className="px-6 py-4 text-sm font-mono text-zinc-300">{job.size}</td>
                          <td className="px-6 py-4 text-sm text-zinc-400">{job.duration}</td>
                          <td className="px-6 py-4 text-sm text-zinc-400">{job.targetStorage}</td>
                          <td className="px-6 py-4 text-sm text-zinc-500 whitespace-nowrap">{job.createdAt}</td>
                        </tr>
                        {expandedJob === job.id && (
                          <tr className="bg-zinc-950/40">
                            <td colSpan={7} className="px-8 py-6">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-3">
                                  <h4 className="text-xs font-bold text-zinc-500 uppercase">File Manifest</h4>
                                  <ul className="space-y-1">
                                    {job.manifest.length > 0 ? job.manifest.map((file, i) => (
                                      <li key={i} className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                                        <span className="text-zinc-700">📄</span> {file}
                                      </li>
                                    )) : (
                                      <li className="text-xs italic text-zinc-600">No files recorded</li>
                                    )}
                                  </ul>
                                </div>
                                <div className="space-y-3">
                                  <h4 className="text-xs font-bold text-zinc-500 uppercase">Integrity</h4>
                                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded text-[11px] font-mono break-all text-indigo-300">
                                    <div className="text-zinc-600 mb-1">CHECKSUM</div>
                                    {job.checksum}
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <h4 className="text-xs font-bold text-zinc-500 uppercase">Storage Path</h4>
                                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded text-[11px] font-mono break-all text-zinc-400">
                                    {job.path}
                                  </div>
                                  <div className="flex gap-2 mt-4">
                                    <button className="text-[10px] px-3 py-1 bg-indigo-600 rounded hover:bg-indigo-500 transition-colors">Verify Path</button>
                                    <button className="text-[10px] px-3 py-1 bg-zinc-800 rounded hover:bg-zinc-700 border border-zinc-700 transition-colors">Download Zip</button>
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

          {/* TAB: SCHEDULE */}
          {activeTab === "schedule" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-950/50 border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">Schedule Name</th>
                        <th className="px-6 py-4">Frequency</th>
                        <th className="px-6 py-4">Retention</th>
                        <th className="px-6 py-4">Last / Next Run</th>
                        <th className="px-6 py-4">Enabled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {schedules.map((sch) => (
                        <tr key={sch.id} className="hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium">{sch.name}</div>
                          </td>
                          <td className="px-6 py-4 capitalize text-sm text-zinc-300">{sch.frequency}</td>
                          <td className="px-6 py-4 text-sm text-zinc-400">{sch.retention}</td>
                          <td className="px-6 py-4">
                            <div className="text-[10px] text-zinc-500 uppercase mb-1">Last: {sch.lastRun}</div>
                            <div className="text-xs font-mono text-indigo-300">Next: {sch.nextRun}</div>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              className={cn(
                                "w-10 h-5 rounded-full relative transition-colors",
                                sch.enabled ? "bg-indigo-600" : "bg-zinc-700"
                              )}
                            >
                              <div className={cn(
                                "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                sch.enabled ? "left-6" : "left-1"
                              )} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 h-fit space-y-6">
                <div>
                  <h3 className="text-lg font-bold">New Schedule</h3>
                  <p className="text-zinc-400 text-sm">Create a new automated backup job.</p>
                </div>
                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Job Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Daily Logs Archive" 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Frequency</label>
                    <select className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none">
                      <option>Hourly</option>
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Retention Period</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        defaultValue={30} 
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none"
                      />
                      <select className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none">
                        <option>Days</option>
                        <option>Weeks</option>
                        <option>Months</option>
                      </select>
                    </div>
                  </div>
                  <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-sm transition-all mt-4">
                    Create Schedule
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB: RESTORE */}
          {activeTab === "restore" && (
            <div className="max-w-4xl mx-auto">
              {/* Stepper Header */}
              <div className="flex justify-between mb-12 relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-zinc-800 -translate-y-1/2 z-0" />
                {[1, 2, 3].map((step) => (
                  <div key={step} className="relative z-10 flex flex-col items-center gap-2">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all",
                      restoreStep === step ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" : 
                      restoreStep > step ? "bg-emerald-500 border-emerald-400 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                    )}>
                      {restoreStep > step ? "✓" : step}
                    </div>
                    <span className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      restoreStep === step ? "text-indigo-400" : "text-zinc-600"
                    )}>
                      {step === 1 ? "Select Source" : step === 2 ? "Configuration" : "Execution"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Step 1: Select Source */}
              {restoreStep === 1 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-6 border-b border-zinc-800">
                    <h3 className="text-xl font-bold">Choose a Restore Point</h3>
                    <p className="text-zinc-400 text-sm">Select a successful backup job to use as the recovery source.</p>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {backups.filter(b => b.status === "completed").map((job) => (
                      <div 
                        key={job.id} 
                        onClick={() => setSelectedBackup(job.id)}
                        className={cn(
                          "p-4 border-b border-zinc-800 last:border-0 cursor-pointer transition-colors flex items-center justify-between",
                          selectedBackup === job.id ? "bg-indigo-500/10 border-indigo-500/30" : "hover:bg-zinc-800"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-4 h-4 rounded-full border flex items-center justify-center",
                            selectedBackup === job.id ? "border-indigo-500" : "border-zinc-700"
                          )}>
                            {selectedBackup === job.id && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{job.name}</div>
                            <div className="text-xs text-zinc-500">{job.createdAt} • {job.size} • {job.targetStorage}</div>
                          </div>
                        </div>
                        <TypeBadge type={job.type} />
                      </div>
                    ))}
                  </div>
                  <div className="p-6 bg-zinc-950/50 flex justify-end">
                    <button 
                      disabled={!selectedBackup}
                      onClick={() => setRestoreStep(2)}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-sm transition-all"
                    >
                      Next: Target Configuration
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Configuration */}
              {restoreStep === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-4">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Target Environment</label>
                        <div className="grid grid-cols-1 gap-3">
                          {(["staging", "dev", "prod"] as const).map((env) => (
                            <button
                              key={env}
                              onClick={() => setRestoreTarget(env)}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-lg border transition-all text-left",
                                restoreTarget === env ? "bg-indigo-500/10 border-indigo-500 text-white" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                              )}
                            >
                              <span className="capitalize font-medium">{env} environment</span>
                              {env === "prod" && <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded border border-rose-400/20">Critical</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Estimated Impact</label>
                        <div className="bg-amber-400/10 border border-amber-400/20 p-4 rounded-lg space-y-3">
                          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                            ⚠️ Warning: Potential Downtime
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            Restoring to <span className="text-white font-bold">{restoreTarget}</span> will require a system reboot and approximately <span className="text-white font-bold">12-15 minutes</span> of downtime. Active sessions will be terminated.
                          </p>
                          <div className="pt-2 border-t border-amber-400/10 text-[10px] text-zinc-400">
                            Source: {backups.find(b => b.id === selectedBackup)?.name}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pt-6 border-t border-zinc-800">
                      <button 
                        onClick={() => setRestoreStep(1)}
                        className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-bold text-sm transition-all"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => setRestoreStep(3)}
                        className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 rounded-lg font-bold text-sm transition-all shadow-lg shadow-rose-500/20"
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
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                    <div>
                      <h3 className="text-2xl font-bold">Restore in Progress</h3>
                      <p className="text-zinc-400 text-sm mt-2">Currently writing blocks to <span className="text-white font-mono">{restoreTarget}-cluster-01</span></p>
                    </div>
                    <div className="max-w-md mx-auto space-y-2">
                      <ProgressBar value={42} />
                      <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                        <span>DATA: 512MB / 1.2GB</span>
                        <span>42% COMPLETE</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-black rounded-xl border border-zinc-800 p-6 font-mono text-xs overflow-hidden h-64 relative">
                    <div className="absolute top-4 left-6 text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Restore Logic Stream</div>
                    <div className="mt-8 space-y-2 text-zinc-400">
                      <div>[04:12:01] <span className="text-indigo-400">INFO</span> Initializing connection to S3 backend...</div>
                      <div>[04:12:03] <span className="text-indigo-400">INFO</span> Validating manifest checksums...</div>
                      <div>[04:12:05] <span className="text-indigo-400">INFO</span> Verified 3 of 3 files. Integrity match 100%.</div>
                      <div>[04:12:08] <span className="text-amber-400">WARN</span> Suspending health check probes on target...</div>
                      <div>[04:12:12] <span className="text-emerald-400">EXEC</span> BEGIN DATA STREAM: db_dump.sql (442MB)</div>
                      <div className="animate-pulse text-white">_ [04:12:15] WRITING BLOCK 122/840...</div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button 
                      onClick={() => {
                        setRestoreStep(1);
                        setActiveTab("backups");
                      }}
                      className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      ← Abort & Return to Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === "settings" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Storage Backends */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Storage Backends</h3>
                  <button className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">+ Add Provider</button>
                </div>
                <div className="space-y-4">
                  {[
                    { name: "AWS-S3-Primary", type: "S3", usage: 64, status: "connected" },
                    { name: "GCS-Secondary", type: "GCS", usage: 22, status: "connected" },
                    { name: "Local-NAS", type: "local", usage: 89, status: "disconnected" }
                  ].map((store, i) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-950 rounded-lg flex items-center justify-center border border-zinc-800 font-bold text-xs text-zinc-500">
                        {store.type}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold">{store.name}</span>
                          <span className={cn(
                            "text-[10px] font-bold uppercase",
                            store.status === "connected" ? "text-emerald-400" : "text-rose-400"
                          )}>{store.status}</span>
                        </div>
                        <ProgressBar value={store.usage} color={store.status === "connected" ? "bg-indigo-500" : "bg-zinc-700"} />
                        <div className="text-[10px] text-zinc-600 mt-1 uppercase tracking-tighter">Capacity: {store.usage}% full</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Encryption & Policies */}
              <div className="space-y-8">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
                  <h3 className="text-lg font-bold">Encryption Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                      <div>
                        <div className="text-sm font-bold">AES-256 Encryption</div>
                        <div className="text-xs text-zinc-500">Enable at-rest encryption for all backup targets.</div>
                      </div>
                      <div className="w-10 h-5 bg-indigo-600 rounded-full relative">
                        <div className="absolute top-1 left-6 w-3 h-3 bg-white rounded-full" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                      <div>
                        <div className="text-sm font-bold">External Key Management (KMS)</div>
                        <div className="text-xs text-zinc-500">Use AWS/Google KMS for root key rotation.</div>
                      </div>
                      <div className="w-10 h-5 bg-zinc-700 rounded-full relative">
                        <div className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
                  <h3 className="text-lg font-bold">Notification Rules</h3>
                  <div className="space-y-3">
                    {["Failure Alerts", "Weekly Reports", "Storage Quota Warnings"].map((rule, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded border border-indigo-500 bg-indigo-500 flex items-center justify-center text-[10px] text-white">✓</div>
                        <span className="text-sm text-zinc-300">{rule}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
