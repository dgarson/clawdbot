import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ExportFormat = "json" | "csv" | "zip";
type DateRange = "7d" | "30d" | "90d" | "all";
type ExportStatus = "completed" | "failed" | "in-progress";
type Frequency = "daily" | "weekly" | "monthly";
type Destination = "local" | "s3";

interface ExportTypeConfig {
  id: string;
  icon: string;
  title: string;
  description: string;
  stats: string;
  formats: ExportFormat[];
  supportsDateRange: boolean;
  lastExported: string;
}

interface ScheduledExport {
  id: string;
  name: string;
  exportType: string;
  frequency: Frequency;
  format: ExportFormat;
  destination: Destination;
  enabled: boolean;
  lastRun: string;
  nextRun: string;
}

interface RecentExportJob {
  id: string;
  exportType: string;
  format: ExportFormat;
  size: string;
  status: ExportStatus;
  timestamp: string;
  downloadable: boolean;
}

interface ExportProgress {
  id: string;
  progress: number;
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

const EXPORT_TYPES: ExportTypeConfig[] = [
  {
    id: "sessions",
    icon: "💬",
    title: "Sessions",
    description: "Full conversation history",
    stats: "14 sessions · ~4.2 MB",
    formats: ["json", "csv"],
    supportsDateRange: true,
    lastExported: "2d ago",
  },
  {
    id: "agent-configs",
    icon: "🤖",
    title: "Agent Configs",
    description: "All agent YAML configs",
    stats: "12 agents · ~128 KB",
    formats: ["zip"],
    supportsDateRange: false,
    lastExported: "1w ago",
  },
  {
    id: "audit-log",
    icon: "📋",
    title: "Audit Log",
    description: "Compliance event log",
    stats: "847 events · ~2.1 MB",
    formats: ["csv"],
    supportsDateRange: true,
    lastExported: "today",
  },
  {
    id: "usage-data",
    icon: "📊",
    title: "Usage Data",
    description: "Token & cost breakdown",
    stats: "31 days tracked · ~890 KB",
    formats: ["csv", "json"],
    supportsDateRange: true,
    lastExported: "3d ago",
  },
  {
    id: "workspace-files",
    icon: "📁",
    title: "Workspace Files",
    description: "Full workspace backup",
    stats: "2.3 GB total",
    formats: ["zip"],
    supportsDateRange: false,
    lastExported: "5d ago",
  },
  {
    id: "full-backup",
    icon: "🗄️",
    title: "Everything (Full Backup)",
    description: "All of the above as a single archive",
    stats: "~2.5 GB estimated",
    formats: ["zip"],
    supportsDateRange: false,
    lastExported: "1w ago",
  },
];

const INITIAL_SCHEDULES: ScheduledExport[] = [
  {
    id: "sched-1",
    name: "Daily Audit Log → S3",
    exportType: "Audit Log",
    frequency: "daily",
    format: "csv",
    destination: "s3",
    enabled: true,
    lastRun: "Today, 00:00 UTC",
    nextRun: "Tomorrow, 00:00 UTC",
  },
  {
    id: "sched-2",
    name: "Weekly Full Backup → Local",
    exportType: "Full Backup",
    frequency: "weekly",
    format: "zip",
    destination: "local",
    enabled: true,
    lastRun: "Feb 16, 2026",
    nextRun: "Feb 23, 2026",
  },
];

const INITIAL_RECENT_EXPORTS: RecentExportJob[] = [
  { id: "exp-1", exportType: "Audit Log", format: "csv", size: "2.1 MB", status: "completed", timestamp: "Feb 22, 2026 00:00", downloadable: true },
  { id: "exp-2", exportType: "Sessions", format: "json", size: "4.2 MB", status: "completed", timestamp: "Feb 20, 2026 14:32", downloadable: true },
  { id: "exp-3", exportType: "Full Backup", format: "zip", size: "2.4 GB", status: "completed", timestamp: "Feb 16, 2026 00:00", downloadable: true },
  { id: "exp-4", exportType: "Usage Data", format: "csv", size: "890 KB", status: "failed", timestamp: "Feb 19, 2026 11:05", downloadable: false },
  { id: "exp-5", exportType: "Agent Configs", format: "zip", size: "128 KB", status: "completed", timestamp: "Feb 15, 2026 09:20", downloadable: true },
  { id: "exp-6", exportType: "Workspace Files", format: "zip", size: "—", status: "in-progress", timestamp: "Feb 22, 2026 01:10", downloadable: false },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  json: "JSON",
  csv: "CSV",
  zip: "ZIP",
};

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function statusColor(status: ExportStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-400/15 text-emerald-400 border-emerald-400/25";
    case "failed":
      return "bg-rose-400/15 text-rose-400 border-rose-400/25";
    case "in-progress":
      return "bg-indigo-400/15 text-indigo-400 border-indigo-400/25";
  }
}

function statusLabel(status: ExportStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "in-progress":
      return "In Progress";
  }
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

interface ExportCardProps {
  config: ExportTypeConfig;
  onExport: (id: string, format: ExportFormat, dateRange: DateRange) => void;
  progress: number | null;
}

function ExportCard({ config, onExport, progress }: ExportCardProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(config.formats[0]);
  const [selectedRange, setSelectedRange] = useState<DateRange>("30d");
  const isExporting = progress !== null;

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900 p-5",
        "flex flex-col gap-3 transition-colors",
        "hover:border-zinc-700"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl" role="img" aria-label={config.title}>
          {config.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">{config.title}</h3>
          <p className="text-xs text-zinc-400">{config.description}</p>
        </div>
      </div>

      {/* Stats */}
      <p className="text-xs text-zinc-500">{config.stats}</p>

      {/* Format selector */}
      <fieldset>
        <legend className="sr-only">Export format for {config.title}</legend>
        <div className="flex gap-1.5">
          {config.formats.map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setSelectedFormat(fmt)}
              aria-pressed={selectedFormat === fmt}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
                selectedFormat === fmt
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600 hover:text-zinc-300"
              )}
            >
              {FORMAT_LABELS[fmt]}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Date range picker */}
      {config.supportsDateRange && (
        <fieldset>
          <legend className="sr-only">Date range for {config.title} export</legend>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setSelectedRange(range)}
                aria-pressed={selectedRange === range}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
                  selectedRange === range
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {DATE_RANGE_LABELS[range]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Progress bar */}
      {isExporting && (
        <div className="w-full" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={`Exporting ${config.title}`}>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-indigo-400">{Math.round(progress)}% — Exporting…</p>
        </div>
      )}

      {/* Export button + last exported */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          disabled={isExporting}
          onClick={() => onExport(config.id, selectedFormat, selectedRange)}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
            isExporting
              ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
              : "bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700"
          )}
        >
          {isExporting ? "Exporting…" : "Export Now"}
        </button>
        <span className="text-xs text-zinc-600">Last: {config.lastExported}</span>
      </div>
    </div>
  );
}

// ─── Schedule Modal ──────────────────────────────────────────────────────────

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (schedule: Omit<ScheduledExport, "id" | "lastRun" | "nextRun" | "enabled">) => void;
}

function ScheduleModal({ open, onClose, onSave }: ScheduleModalProps) {
  const [name, setName] = useState("");
  const [exportType, setExportType] = useState("Audit Log");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [destination, setDestination] = useState<Destination>("local");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {return;}
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {return;}
      onSave({ name: name.trim(), exportType, frequency, format, destination });
      setName("");
      onClose();
    },
    [name, exportType, frequency, format, destination, onSave, onClose]
  );

  if (!open) {return null;}

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 m-auto w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-0 text-white shadow-2xl backdrop:bg-black/60"
      aria-labelledby="schedule-modal-title"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
        <h2 id="schedule-modal-title" className="text-base font-semibold text-white">
          Add Scheduled Export
        </h2>

        {/* Name */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-400">Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekly Sessions Backup"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>

        {/* Export Type */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-400">Export Type</span>
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {EXPORT_TYPES.map((t) => (
              <option key={t.id} value={t.title}>
                {t.title}
              </option>
            ))}
          </select>
        </label>

        {/* Frequency */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-400">Frequency</span>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        {/* Format */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-400">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="zip">ZIP</option>
          </select>
        </label>

        {/* Destination */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-400">Destination</span>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value as Destination)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="local">Local Storage</option>
            <option value="s3">S3 (coming soon)</option>
          </select>
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-750 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Save Schedule
          </button>
        </div>
      </form>
    </dialog>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DataExportManager() {
  const [schedules, setSchedules] = useState<ScheduledExport[]>(INITIAL_SCHEDULES);
  const [recentExports] = useState<RecentExportJob[]>(INITIAL_RECENT_EXPORTS);
  const [exportProgress, setExportProgress] = useState<Map<string, number>>(new Map());
  const [modalOpen, setModalOpen] = useState(false);
  const progressTimers = useRef<Map<string, number>>(new Map());

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      progressTimers.current.forEach((timer) => clearInterval(timer));
    };
  }, []);

  const handleExport = useCallback((id: string, _format: ExportFormat, _dateRange: DateRange) => {
    // Simulate 2s export with animated progress
    setExportProgress((prev) => new Map(prev).set(id, 0));

    const startTime = Date.now();
    const duration = 2000;

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setExportProgress((prev) => {
        const next = new Map(prev);
        if (pct >= 100) {
          next.delete(id);
          return next;
        }
        next.set(id, pct);
        return next;
      });
      if (elapsed >= duration) {
        clearInterval(timer);
        progressTimers.current.delete(id);
      }
    }, 50);

    progressTimers.current.set(id, timer);
  }, []);

  const handleToggleSchedule = useCallback((scheduleId: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === scheduleId ? { ...s, enabled: !s.enabled } : s))
    );
  }, []);

  const handleAddSchedule = useCallback(
    (data: Omit<ScheduledExport, "id" | "lastRun" | "nextRun" | "enabled">) => {
      const newSchedule: ScheduledExport = {
        ...data,
        id: `sched-${Date.now()}`,
        enabled: true,
        lastRun: "—",
        nextRun: "Pending",
      };
      setSchedules((prev) => [...prev, newSchedule]);
    },
    []
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Page header */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">Data Export Manager</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Back up your data, schedule automatic exports, and download past archives.
          </p>
        </header>

        {/* ── Section 1: Export Types ───────────────────────────────────── */}
        <section aria-labelledby="export-types-heading" className="mb-10">
          <h2 id="export-types-heading" className="mb-4 text-lg font-semibold text-white">
            Export Types
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EXPORT_TYPES.map((config) => (
              <ExportCard
                key={config.id}
                config={config}
                onExport={handleExport}
                progress={exportProgress.get(config.id) ?? null}
              />
            ))}
          </div>
        </section>

        {/* ── Section 2: Scheduled Exports ─────────────────────────────── */}
        <section aria-labelledby="scheduled-heading" className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="scheduled-heading" className="text-lg font-semibold text-white">
              Scheduled Exports
            </h2>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              + Add Schedule
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Frequency
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Last Run
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Next Run
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Enabled
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((sched) => (
                  <tr key={sched.id} className="border-b border-zinc-800/60 last:border-0">
                    <td className="px-4 py-3 font-medium text-white">{sched.name}</td>
                    <td className="px-4 py-3 text-zinc-400">{sched.exportType}</td>
                    <td className="px-4 py-3 text-zinc-400">{FREQUENCY_LABELS[sched.frequency]}</td>
                    <td className="px-4 py-3 text-zinc-500">{sched.lastRun}</td>
                    <td className="px-4 py-3 text-zinc-500">{sched.nextRun}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={sched.enabled}
                        aria-label={`Toggle ${sched.name}`}
                        onClick={() => handleToggleSchedule(sched.id)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                          sched.enabled ? "bg-indigo-600" : "bg-zinc-700"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                            sched.enabled ? "translate-x-[18px]" : "translate-x-[3px]"
                          )}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
                {schedules.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-600">
                      No scheduled exports yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Section 3: Recent Exports ────────────────────────────────── */}
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="mb-4 text-lg font-semibold text-white">
            Recent Exports
          </h2>

          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Export Type
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Format
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Size
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Timestamp
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentExports.map((job) => (
                  <tr key={job.id} className="border-b border-zinc-800/60 last:border-0">
                    <td className="px-4 py-3 font-medium text-white">{job.exportType}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-zinc-300">
                        {FORMAT_LABELS[job.format]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{job.size}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                          statusColor(job.status)
                        )}
                      >
                        {statusLabel(job.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{job.timestamp}</td>
                    <td className="px-4 py-3 text-right">
                      {job.downloadable ? (
                        <button
                          type="button"
                          className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          aria-label={`Download ${job.exportType} export from ${job.timestamp}`}
                        >
                          Download
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Schedule Modal */}
      <ScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleAddSchedule}
      />
    </div>
  );
}
