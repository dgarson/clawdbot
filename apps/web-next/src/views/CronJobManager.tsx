import { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Pause,
  Edit,
  Trash,
  Plus,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  History,
  BarChart,
  Activity,
  FileText,
  Zap,
  RotateCcw,
  Bell,
  Database,
  Trash2,
  HeartPulse as Heartbeat,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";

// ============================================================================
// Types
// ============================================================================

type JobStatus = 'Active' | 'Paused' | 'Running' | 'Failed';

interface CronJob {
  id: string;
  name: string;
  schedule: {
    cron: string;
    human: string;
  };
  nextRun: Date;
  status: JobStatus;
  lastRun?: {
    time: Date;
    duration: number;
    success: boolean;
  };
  payloadPreview: string;
  fullPayload: string;
  deliveryConfig: string;
  history: RunHistory[];
}

interface RunHistory {
  id: string;
  time: Date;
  duration: number;
  success: boolean;
  outcome: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_JOBS: CronJob[] = [
  {
    id: 'job1',
    name: 'System Heartbeat',
    schedule: { cron: '*/5 * * * *', human: 'Every 5 minutes' },
    nextRun: new Date(Date.now() + 2 * 60 * 1000),
    status: 'Active',
    lastRun: { time: new Date(Date.now() - 3 * 60 * 1000), duration: 45, success: true },
    payloadPreview: 'Session: system, Task: ping',
    fullPayload: '{ "session": "system:heartbeat", "task": "ping all nodes" }',
    deliveryConfig: 'Direct to gateway',
    history: [
      { id: 'r1', time: new Date(Date.now() - 3*60*1000), duration: 45, success: true, outcome: 'All nodes responsive' },
      { id: 'r2', time: new Date(Date.now() - 8*60*1000), duration: 52, success: true, outcome: 'Success' },
      { id: 'r3', time: new Date(Date.now() - 13*60*1000), duration: 48, success: false, outcome: 'Node offline' },
      { id: 'r4', time: new Date(Date.now() - 18*60*1000), duration: 50, success: true, outcome: 'Success' },
      { id: 'r5', time: new Date(Date.now() - 23*60*1000), duration: 47, success: true, outcome: 'Success' },
    ],
  },
  {
    id: 'job2',
    name: 'Daily Report Generation',
    schedule: { cron: '0 9 * * *', human: 'Daily at 9 AM' },
    nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'Active',
    lastRun: { time: new Date(Date.now() - 24 * 60 * 60 * 1000), duration: 300, success: true },
    payloadPreview: 'Session: reports, Task: generate daily',
    fullPayload: '{ "session": "reports:daily", "task": "aggregate metrics and email" }',
    deliveryConfig: 'Email to admin',
    history: [
      { id: 'r6', time: new Date(Date.now() - 24*60*60*1000), duration: 300, success: true, outcome: 'Report sent' },
      { id: 'r7', time: new Date(Date.now() - 48*60*60*1000), duration: 280, success: true, outcome: 'Success' },
      { id: 'r8', time: new Date(Date.now() - 72*60*60*1000), duration: 310, success: true, outcome: 'Success' },
      { id: 'r9', time: new Date(Date.now() - 96*60*60*1000), duration: 295, success: false, outcome: 'Data fetch failed' },
      { id: 'r10', time: new Date(Date.now() - 120*60*60*1000), duration: 305, success: true, outcome: 'Success' },
    ],
  },
  {
    id: 'job3',
    name: 'Cache Cleanup',
    schedule: { cron: '0 2 * * *', human: 'Daily at 2 AM' },
    nextRun: new Date(Date.now() + 2 * 60 * 60 * 1000),
    status: 'Paused',
    lastRun: { time: new Date(Date.now() - 24 * 60 * 60 * 1000), duration: 120, success: true },
    payloadPreview: 'Session: maintenance, Task: clear cache',
    fullPayload: '{ "session": "maintenance:cache", "task": "delete expired entries" }',
    deliveryConfig: 'Internal queue',
    history: [
      { id: 'r11', time: new Date(Date.now() - 24*60*60*1000), duration: 120, success: true, outcome: '1.2GB freed' },
      { id: 'r12', time: new Date(Date.now() - 48*60*60*1000), duration: 110, success: true, outcome: 'Success' },
      { id: 'r13', time: new Date(Date.now() - 72*60*60*1000), duration: 130, success: true, outcome: 'Success' },
      { id: 'r14', time: new Date(Date.now() - 96*60*60*1000), duration: 115, success: true, outcome: 'Success' },
      { id: 'r15', time: new Date(Date.now() - 120*60*60*1000), duration: 125, success: true, outcome: 'Success' },
    ],
  },
  {
    id: 'job4',
    name: 'User Notifications',
    schedule: { cron: '*/30 * * * *', human: 'Every 30 minutes' },
    nextRun: new Date(Date.now() + 15 * 60 * 1000),
    status: 'Running',
    lastRun: { time: new Date(Date.now() - 30 * 60 * 1000), duration: 90, success: true },
    payloadPreview: 'Session: notifications, Task: send pending',
    fullPayload: '{ "session": "notifications:user", "task": "process queue" }',
    deliveryConfig: 'Push to channels',
    history: [
      { id: 'r16', time: new Date(Date.now() - 30*60*1000), duration: 90, success: true, outcome: '12 sent' },
      { id: 'r17', time: new Date(Date.now() - 60*60*1000), duration: 85, success: true, outcome: 'Success' },
      { id: 'r18', time: new Date(Date.now() - 90*60*1000), duration: 95, success: false, outcome: 'API error' },
      { id: 'r19', time: new Date(Date.now() - 120*60*1000), duration: 88, success: true, outcome: 'Success' },
      { id: 'r20', time: new Date(Date.now() - 150*60*1000), duration: 92, success: true, outcome: 'Success' },
    ],
  },
  {
    id: 'job5',
    name: 'Backup Database',
    schedule: { cron: '0 3 * * 0', human: 'Weekly Sunday 3 AM' },
    nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'Active',
    lastRun: { time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), duration: 600, success: true },
    payloadPreview: 'Session: backup, Task: full db',
    fullPayload: '{ "session": "backup:database", "task": "export and archive" }',
    deliveryConfig: 'S3 upload',
    history: [
      { id: 'r21', time: new Date(Date.now() - 7*24*60*60*1000), duration: 600, success: true, outcome: 'Backup complete' },
      { id: 'r22', time: new Date(Date.now() - 14*24*60*60*1000), duration: 580, success: true, outcome: 'Success' },
      { id: 'r23', time: new Date(Date.now() - 21*24*60*60*1000), duration: 620, success: true, outcome: 'Success' },
      { id: 'r24', time: new Date(Date.now() - 28*24*60*60*1000), duration: 590, success: true, outcome: 'Success' },
      { id: 'r25', time: new Date(Date.now() - 35*24*60*60*1000), duration: 610, success: false, outcome: 'Storage full' },
    ],
  },
  {
    id: 'job6',
    name: 'Log Rotation',
    schedule: { cron: '0 0 * * *', human: 'Daily at midnight' },
    nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'Failed',
    lastRun: { time: new Date(Date.now() - 24 * 60 * 60 * 1000), duration: 180, success: false },
    payloadPreview: 'Session: logs, Task: rotate',
    fullPayload: '{ "session": "logs:rotation", "task": "archive old logs" }',
    deliveryConfig: 'Local filesystem',
    history: [
      { id: 'r26', time: new Date(Date.now() - 24*60*60*1000), duration: 180, success: false, outcome: 'Permission denied' },
      { id: 'r27', time: new Date(Date.now() - 48*60*60*1000), duration: 160, success: true, outcome: 'Success' },
      { id: 'r28', time: new Date(Date.now() - 72*60*60*1000), duration: 170, success: true, outcome: 'Success' },
      { id: 'r29', time: new Date(Date.now() - 96*60*60*1000), duration: 165, success: true, outcome: 'Success' },
      { id: 'r30', time: new Date(Date.now() - 120*60*60*1000), duration: 175, success: true, outcome: 'Success' },
    ],
  },
  {
    id: 'job7',
    name: 'Metrics Aggregation',
    schedule: { cron: '*/15 * * * *', human: 'Every 15 minutes' },
    nextRun: new Date(Date.now() + 10 * 60 * 1000),
    status: 'Active',
    lastRun: { time: new Date(Date.now() - 15 * 60 * 1000), duration: 60, success: true },
    payloadPreview: 'Session: metrics, Task: aggregate',
    fullPayload: '{ "session": "metrics:agg", "task": "collect and store" }',
    deliveryConfig: 'InfluxDB',
    history: [
      { id: 'r31', time: new Date(Date.now() - 15*60*1000), duration: 60, success: true, outcome: 'Success' },
      { id: 'r32', time: new Date(Date.now() - 30*60*1000), duration: 55, success: true, outcome: 'Success' },
      { id: 'r33', time: new Date(Date.now() - 45*60*1000), duration: 65, success: true, outcome: 'Success' },
      { id: 'r34', time: new Date(Date.now() - 60*60*1000), duration: 58, success: true, outcome: 'Success' },
      { id: 'r35', time: new Date(Date.now() - 75*60*1000), duration: 62, success: true, outcome: 'Success' },
    ],
  },
  {
    id: 'job8',
    name: 'Security Scan',
    schedule: { cron: '0 4 * * *', human: 'Daily at 4 AM' },
    nextRun: new Date(Date.now() + 4 * 60 * 60 * 1000),
    status: 'Active',
    lastRun: { time: new Date(Date.now() - 24 * 60 * 60 * 1000), duration: 900, success: true },
    payloadPreview: 'Session: security, Task: vulnerability scan',
    fullPayload: '{ "session": "security:scan", "task": "run full system scan" }',
    deliveryConfig: 'Report to slack',
    history: [
      { id: 'r36', time: new Date(Date.now() - 24*60*60*1000), duration: 900, success: true, outcome: 'No issues' },
      { id: 'r37', time: new Date(Date.now() - 48*60*60*1000), duration: 880, success: true, outcome: 'Success' },
      { id: 'r38', time: new Date(Date.now() - 72*60*60*1000), duration: 920, success: false, outcome: 'Vuln found' },
      { id: 'r39', time: new Date(Date.now() - 96*60*60*1000), duration: 890, success: true, outcome: 'Success' },
      { id: 'r40', time: new Date(Date.now() - 120*60*60*1000), duration: 910, success: true, outcome: 'Success' },
    ],
  },
];

// Flatten for global history (last 20)
const ALL_RUNS: RunHistory[] = MOCK_JOBS.flatMap(j => j.history)
  .sort((a, b) => b.time.getTime() - a.time.getTime())
  .slice(0, 20);

// ============================================================================
// Helpers
// ============================================================================

function formatCountdown(next: Date): string {
  const diff = next.getTime() - Date.now();
  if (diff < 0) return 'Overdue';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${hours}h ${mins}m ${secs}s`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatTime(date: Date): string {
  return date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, string> = {
    Active: 'bg-green-500/15 text-green-400 border-green-500/30',
    Paused: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Running: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    Failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border', styles[status])}>
      <span className={cn('w-1.5 h-1.5 rounded-full', status === 'Running' && 'animate-pulse bg-blue-500', styles[status].split(' ')[0].replace('/15', ''))} />
      {status}
    </span>
  );
}

function OutcomeIcon({ success }: { success: boolean }) {
  return success ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />;
}

function JobCard({
  job,
  expanded,
  onToggleExpand,
  onRunNow,
  onPause,
  onEdit,
  onDelete,
}: {
  job: CronJob;
  expanded: boolean;
  onToggleExpand: () => void;
  onRunNow: () => void;
  onPause: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-surface-1 border border-tok-border rounded-xl">
      <div className="px-4 py-3 flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-fg-primary">{job.name}</span>
            <StatusBadge status={job.status} />
          </div>
          <div className="text-xs text-fg-secondary">{job.schedule.human}</div>
          <div className="text-xs text-fg-muted mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Next: {formatCountdown(job.nextRun)}
          </div>
          {job.lastRun && (
            <div className="text-xs text-fg-muted mt-0.5 flex items-center gap-1">
              <History className="w-3 h-3" />
              Last: {formatTime(job.lastRun.time)} ({formatDuration(job.lastRun.duration)}) {job.lastRun.success ? 'Success' : 'Failed'}
            </div>
          )}
          <div className="text-xs text-fg-secondary mt-1">{job.payloadPreview}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRunNow} className="p-1 hover:bg-surface-2 rounded"><Play className="w-4 h-4 text-green-400" /></button>
          <button onClick={onPause} className="p-1 hover:bg-surface-2 rounded"><Pause className="w-4 h-4 text-amber-400" /></button>
          <button onClick={onEdit} className="p-1 hover:bg-surface-2 rounded"><Edit className="w-4 h-4 text-blue-400" /></button>
          <button onClick={onDelete} className="p-1 hover:bg-surface-2 rounded"><Trash className="w-4 h-4 text-red-400" /></button>
          <button onClick={onToggleExpand} className="p-1 hover:bg-surface-2 rounded">
            {expanded ? <ChevronUp className="w-4 h-4 text-fg-secondary" /> : <ChevronDown className="w-4 h-4 text-fg-secondary" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 py-3 border-t border-tok-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <h4 className="text-xs font-medium text-fg-secondary mb-1">Full Payload</h4>
              <pre className="text-xs text-fg-primary bg-surface-2 p-2 rounded">{job.fullPayload}</pre>
            </div>
            <div>
              <h4 className="text-xs font-medium text-fg-secondary mb-1">Delivery Config</h4>
              <pre className="text-xs text-fg-primary bg-surface-2 p-2 rounded">{job.deliveryConfig}</pre>
            </div>
            <div>
              <h4 className="text-xs font-medium text-fg-secondary mb-1">Recent Runs (last 5)</h4>
              <div className="space-y-1">
                {job.history.slice(0, 5).map(run => (
                  <div key={run.id} className="flex items-center gap-2 text-xs text-fg-secondary">
                    <OutcomeIcon success={run.success} />
                    {formatTime(run.time)} - {formatDuration(run.duration)} - {run.outcome}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleTimeline({ jobs }: { jobs: CronJob[] }) {
  const now = new Date();
  const start = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 24h window centered on now
  const end = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const totalMs = end.getTime() - start.getTime();

  return (
    <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-fg-primary">24h Schedule Timeline</span>
      </div>
      <div className="relative h-32 overflow-hidden">
        <div className="absolute inset-0 flex flex-col gap-1">
          {jobs.map((job, idx) => (
            <div key={job.id} className="relative flex-1">
              <div className="absolute left-0 top-1/2 h-1 w-full bg-surface-2" />
              {/* Mock firings: for simplicity, place one bar per job */}
              <div
                className="absolute top-1/2 h-1 bg-primary"
                style={{
                  left: `${((job.nextRun.getTime() - start.getTime()) / totalMs) * 100}%`,
                  width: '2%',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RunHistoryTable({ runs }: { runs: RunHistory[] }) {
  return (
    <div className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-tok-border flex items-center gap-2">
        <History className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-fg-primary">Run History (last 20)</span>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-surface-2/50">
          <tr>
            <th className="px-4 py-2 text-left text-fg-secondary">Time</th>
            <th className="px-4 py-2 text-left text-fg-secondary">Duration</th>
            <th className="px-4 py-2 text-left text-fg-secondary">Status</th>
            <th className="px-4 py-2 text-left text-fg-secondary">Outcome</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-tok-border">
          {runs.map(run => (
            <tr key={run.id}>
              <td className="px-4 py-2 text-fg-primary">{formatTime(run.time)}</td>
              <td className="px-4 py-2 text-fg-primary">{formatDuration(run.duration)}</td>
              <td className="px-4 py-2">
                <OutcomeIcon success={run.success} />
              </td>
              <td className="px-4 py-2 text-fg-primary">{run.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsRow({ total, active, failed24h, avgTime }: { total: number; active: number; failed24h: number; avgTime: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
        <div className="text-xs text-fg-secondary uppercase">Total Jobs</div>
        <div className="text-xl font-bold text-fg-primary">{total}</div>
      </div>
      <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
        <div className="text-xs text-fg-secondary uppercase">Active</div>
        <div className="text-xl font-bold text-fg-primary">{active}</div>
      </div>
      <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
        <div className="text-xs text-fg-secondary uppercase">Failed (24h)</div>
        <div className="text-xl font-bold text-fg-primary">{failed24h}</div>
      </div>
      <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
        <div className="text-xs text-fg-secondary uppercase">Avg Run Time</div>
        <div className="text-xl font-bold text-fg-primary">{formatDuration(avgTime)}</div>
      </div>
    </div>
  );
}

function AddJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-surface-1 border border-tok-border rounded-xl p-6 w-96">
        <h2 className="text-lg font-bold text-fg-primary mb-4">Add New Job</h2>
        <form className="space-y-4">
          <input placeholder="Job Name" className="w-full bg-surface-2 p-2 rounded text-fg-primary" />
          <select className="w-full bg-surface-2 p-2 rounded text-fg-primary">
            <option>Schedule Type</option>
            <option>at</option>
            <option>every</option>
            <option>cron</option>
          </select>
          <input placeholder="Payload Kind" className="w-full bg-surface-2 p-2 rounded text-fg-primary" />
          <input placeholder="Session Target" className="w-full bg-surface-2 p-2 rounded text-fg-primary" />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-primary text-fg-primary py-2 rounded">Add</button>
            <button onClick={onClose} className="flex-1 bg-surface-3 text-fg-primary py-2 rounded">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function CronJobManager() {
  const [jobs, setJobs] = useState<CronJob[]>(MOCK_JOBS);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [pauseAll, setPauseAll] = useState(false);

  const totalJobs = jobs.length;
  const activeJobs = jobs.filter(j => j.status === 'Active').length;
  const failed24h = ALL_RUNS.filter(r => !r.success && (Date.now() - r.time.getTime()) < 24*60*60*1000).length;
  const avgTime = Math.floor(ALL_RUNS.reduce((sum, r) => sum + r.duration, 0) / ALL_RUNS.length) || 0;

  const toggleExpand = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Mock actions
  const handleRunNow = (id: string) => console.log('Run now:', id);
  const handlePause = (id: string) => console.log('Pause:', id);
  const handleEdit = (id: string) => console.log('Edit:', id);
  const handleDelete = (id: string) => setJobs(prev => prev.filter(j => j.id !== id));

  useEffect(() => {
    const interval = setInterval(() => {}, 1000); // For countdown updates
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-2xl font-bold text-fg-primary flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Cron Jobs
          </h1>
          <p className="text-sm text-fg-secondary mt-0.5">Manage scheduled tasks and heartbeats</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-fg-primary flex items-center gap-2">
            Active: <span className="font-bold">{activeJobs}</span>
          </span>
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-1 bg-primary px-3 py-1.5 rounded text-sm text-fg-primary">
            <Plus className="w-4 h-4" /> Add Job
          </button>
          <div className="flex items-center gap-2 text-sm text-fg-secondary">
            Pause All
            {pauseAll ? <ToggleRight onClick={() => setPauseAll(false)} className="w-5 h-5 text-green-400 cursor-pointer" /> : <ToggleLeft onClick={() => setPauseAll(true)} className="w-5 h-5 cursor-pointer" />}
          </div>
        </div>
      </div>

      <StatsRow total={totalJobs} active={activeJobs} failed24h={failed24h} avgTime={avgTime} />

      <ScheduleTimeline jobs={jobs} />

      <div className="space-y-4">
        {jobs.length === 0 ? (
          <ContextualEmptyState icon={Clock} title="No cron jobs configured" description="Add a job to start scheduling tasks." />
        ) : (
          jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              expanded={expanded.includes(job.id)}
              onToggleExpand={() => toggleExpand(job.id)}
              onRunNow={() => handleRunNow(job.id)}
              onPause={() => handlePause(job.id)}
              onEdit={() => handleEdit(job.id)}
              onDelete={() => handleDelete(job.id)}
            />
          ))
        )}
      </div>

      <RunHistoryTable runs={ALL_RUNS} />

      <AddJobModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
