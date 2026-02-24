import { useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  BadgeX,
  CheckCircle,
  Clock,
  Gauge,
  Layers,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
  Zap,
  ChevronDown,
  ChevronUp,
  Eye,
  MoreHorizontal,
  BarChart,
  Archive,
  Rotate3d,
  Badge,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type JobStatus = 'pending' | 'running' | 'complete' | 'failed' | 'retrying';
type JobPriority = 'critical' | 'high' | 'normal' | 'low';

interface Job {
  id: string;
  type: string;
  priority: JobPriority;
  enqueuedAt: Date;
  assignedAgent: string;
  agentEmoji: string;
  estimatedCompletion: Date | null;
  status: JobStatus;
  retryCount: number;
  progress: number; // 0-100
  elapsedSeconds: number;
  errorMessage?: string;
  inputParams?: Record<string, any>;
  outputPreview?: string;
  timingBreakdown?: { phase: string; durationMs: number }[];
}

interface Worker {
  id: string;
  currentJobId: string | null;
  progress: number;
  elapsedSeconds: number;
  assignedAgent: string;
  agentEmoji: string;
}

type QueueStats = {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  avgWaitTime: number; // seconds
  throughput: number; // jobs/min
};

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_JOBS: Job[] = [
  {
    id: 'job-001',
    type: 'data-sync',
    priority: 'critical',
    enqueuedAt: new Date(Date.now() - 120000),
    assignedAgent: 'Quinn',
    agentEmoji: '⚡',
    estimatedCompletion: new Date(Date.now() + 30000),
    status: 'running',
    retryCount: 0,
    progress: 65,
    elapsedSeconds: 120,
    inputParams: { source: 'db', target: 'cache' },
    outputPreview: 'Synced 450 records',
    timingBreakdown: [{ phase: 'init', durationMs: 500 }, { phase: 'sync', durationMs: 115000 }],
  },
  {
    id: 'job-002',
    type: 'report-gen',
    priority: 'high',
    enqueuedAt: new Date(Date.now() - 60000),
    assignedAgent: 'Luis',
    agentEmoji: '🎨',
    estimatedCompletion: new Date(Date.now() + 60000),
    status: 'pending',
    retryCount: 0,
    progress: 0,
    elapsedSeconds: 0,
  },
  {
    id: 'job-003',
    type: 'backup',
    priority: 'normal',
    enqueuedAt: new Date(Date.now() - 180000),
    assignedAgent: 'Xavier',
    agentEmoji: '🏗️',
    estimatedCompletion: null,
    status: 'complete',
    retryCount: 0,
    progress: 100,
    elapsedSeconds: 150,
    outputPreview: 'Backup complete: 2.3GB',
  },
  {
    id: 'job-004',
    type: 'email-send',
    priority: 'low',
    enqueuedAt: new Date(Date.now() - 30000),
    assignedAgent: 'Stephan',
    agentEmoji: '📣',
    estimatedCompletion: new Date(Date.now() + 10000),
    status: 'running',
    retryCount: 1,
    progress: 30,
    elapsedSeconds: 20,
  },
  {
    id: 'job-005',
    type: 'data-process',
    priority: 'critical',
    enqueuedAt: new Date(Date.now() - 90000),
    assignedAgent: 'Reed',
    agentEmoji: '♿',
    estimatedCompletion: null,
    status: 'failed',
    retryCount: 3,
    progress: 0,
    elapsedSeconds: 45,
    errorMessage: 'Timeout exceeded',
  },
  {
    id: 'job-006',
    type: 'cache-clear',
    priority: 'high',
    enqueuedAt: new Date(Date.now() - 45000),
    assignedAgent: 'Piper',
    agentEmoji: '🗣️',
    estimatedCompletion: new Date(Date.now() + 15000),
    status: 'retrying',
    retryCount: 2,
    progress: 10,
    elapsedSeconds: 30,
  },
  {
    id: 'job-007',
    type: 'user-notify',
    priority: 'normal',
    enqueuedAt: new Date(Date.now() - 150000),
    assignedAgent: 'Quinn',
    agentEmoji: '⚡',
    estimatedCompletion: null,
    status: 'complete',
    retryCount: 0,
    progress: 100,
    elapsedSeconds: 10,
  },
  {
    id: 'job-008',
    type: 'log-analyze',
    priority: 'low',
    enqueuedAt: new Date(Date.now() - 20000),
    assignedAgent: 'Luis',
    agentEmoji: '🎨',
    estimatedCompletion: new Date(Date.now() + 40000),
    status: 'pending',
    retryCount: 0,
    progress: 0,
    elapsedSeconds: 0,
  },
  {
    id: 'job-009',
    type: 'db-optimize',
    priority: 'critical',
    enqueuedAt: new Date(Date.now() - 100000),
    assignedAgent: 'Xavier',
    agentEmoji: '🏗️',
    estimatedCompletion: new Date(Date.now() + 50000),
    status: 'running',
    retryCount: 0,
    progress: 40,
    elapsedSeconds: 90,
  },
  {
    id: 'job-010',
    type: 'file-upload',
    priority: 'high',
    enqueuedAt: new Date(Date.now() - 70000),
    assignedAgent: 'Stephan',
    agentEmoji: '📣',
    estimatedCompletion: null,
    status: 'failed',
    retryCount: 1,
    progress: 0,
    elapsedSeconds: 25,
    errorMessage: 'Network error',
  },
  {
    id: 'job-011',
    type: 'metrics-calc',
    priority: 'normal',
    enqueuedAt: new Date(Date.now() - 50000),
    assignedAgent: 'Reed',
    agentEmoji: '♿',
    estimatedCompletion: new Date(Date.now() + 20000),
    status: 'pending',
    retryCount: 0,
    progress: 0,
    elapsedSeconds: 0,
  },
  {
    id: 'job-012',
    type: 'session-cleanup',
    priority: 'low',
    enqueuedAt: new Date(Date.now() - 25000),
    assignedAgent: 'Piper',
    agentEmoji: '🗣️',
    estimatedCompletion: null,
    status: 'complete',
    retryCount: 0,
    progress: 100,
    elapsedSeconds: 15,
  },
  {
    id: 'job-013',
    type: 'alert-trigger',
    priority: 'critical',
    enqueuedAt: new Date(Date.now() - 80000),
    assignedAgent: 'Quinn',
    agentEmoji: '⚡',
    estimatedCompletion: new Date(Date.now() + 10000),
    status: 'retrying',
    retryCount: 1,
    progress: 20,
    elapsedSeconds: 40,
  },
  {
    id: 'job-014',
    type: 'config-update',
    priority: 'high',
    enqueuedAt: new Date(Date.now() - 35000),
    assignedAgent: 'Luis',
    agentEmoji: '🎨',
    estimatedCompletion: new Date(Date.now() + 30000),
    status: 'running',
    progress: 50,
    elapsedSeconds: 25,
    retryCount: 0,
  },
  {
    id: 'job-015',
    type: 'batch-process',
    priority: 'normal',
    enqueuedAt: new Date(Date.now() - 110000),
    assignedAgent: 'Xavier',
    agentEmoji: '🏗️',
    estimatedCompletion: null,
    status: 'failed',
    retryCount: 2,
    progress: 0,
    elapsedSeconds: 60,
    errorMessage: 'Invalid input',
  },
  {
    id: 'job-016',
    type: 'thumbnail-gen',
    priority: 'low',
    enqueuedAt: new Date(Date.now() - 15000),
    assignedAgent: 'Stephan',
    agentEmoji: '📣',
    estimatedCompletion: new Date(Date.now() + 5000),
    status: 'pending',
    retryCount: 0,
    progress: 0,
    elapsedSeconds: 0,
  },
  {
    id: 'job-017',
    type: 'security-scan',
    priority: 'critical',
    enqueuedAt: new Date(Date.now() - 95000),
    assignedAgent: 'Reed',
    agentEmoji: '♿',
    estimatedCompletion: null,
    status: 'complete',
    retryCount: 0,
    progress: 100,
    elapsedSeconds: 80,
  },
];

const MOCK_WORKERS: Worker[] = [
  { id: 'w1', currentJobId: 'job-001', progress: 65, elapsedSeconds: 120, assignedAgent: 'Quinn', agentEmoji: '⚡' },
  { id: 'w2', currentJobId: 'job-004', progress: 30, elapsedSeconds: 20, assignedAgent: 'Stephan', agentEmoji: '📣' },
  { id: 'w3', currentJobId: 'job-009', progress: 40, elapsedSeconds: 90, assignedAgent: 'Xavier', agentEmoji: '🏗️' },
  { id: 'w4', currentJobId: 'job-014', progress: 50, elapsedSeconds: 25, assignedAgent: 'Luis', agentEmoji: '🎨' },
  { id: 'w5', currentJobId: null, progress: 0, elapsedSeconds: 0, assignedAgent: 'Idle', agentEmoji: '💤' },
];

const MOCK_STATS: QueueStats = {
  pending: 4,
  running: 4,
  completed: 5,
  failed: 3,
  avgWaitTime: 45,
  throughput: 2.3,
};

const MOCK_THROUGHPUT: number[] = [0, 1, 0, 2, 1, 3, 2, 1, 0, 2, 1, 3, 4, 2, 1, 0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 2, 1, 0, 1, 2]; // last 30 min

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatEstimated(date: Date | null): string {
  if (!date) return 'N/A';
  const diff = Math.floor((date.getTime() - Date.now()) / 1000 / 60);
  return `~${diff} min`;
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'text-[var(--color-text-secondary)]',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 flex items-start gap-3">
      <div className="mt-0.5 p-2 bg-[var(--color-surface-2)] rounded-lg">
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div>
        <p className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wide mb-1">{label}</p>
        <p className="text-xl font-bold text-[var(--color-text-primary)]">{value}</p>
        {sub && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, string> = {
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    running: 'bg-green-500/15 text-green-400 border-green-500/30',
    complete: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
    retrying: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  };
  const icons: Record<JobStatus, React.ElementType> = {
    pending: Clock,
    running: Activity,
    complete: CheckCircle,
    failed: XCircle,
    retrying: RotateCcw,
  };
  const Icon = icons[status];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border', styles[status])}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: JobPriority }) {
  const styles: Record<JobPriority, string> = {
    critical: 'bg-red-500/20 text-red-300',
    high: 'bg-orange-500/20 text-orange-300',
    normal: 'bg-green-500/20 text-green-300',
    low: 'bg-blue-500/20 text-blue-300',
  };
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', styles[priority])}>
      {priority.toUpperCase()}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-[var(--color-surface-2)] text-[var(--color-text-primary)]">
      {type}
    </span>
  );
}

function RetryBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">
      <RotateCcw className="w-3 h-3" />
      x{count}
    </span>
  );
}

function JobCard({ job, onViewDetails }: { job: Job; onViewDetails: (job: Job) => void }) {
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-[var(--color-text-secondary)]">{job.id}</span>
          <TypeBadge type={job.type} />
          <PriorityBadge priority={job.priority} />
        </div>
        <StatusBadge status={job.status} />
      </div>
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <Clock className="w-4 h-4" />
        Enqueued {formatTimestamp(job.enqueuedAt)}
        <span className="text-[var(--color-text-muted)] mx-1">·</span>
        Est. {formatEstimated(job.estimatedCompletion)}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg">{job.agentEmoji}</span>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{job.assignedAgent}</span>
        <RetryBadge count={job.retryCount} />
      </div>
      {job.status === 'running' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>Progress</span>
            <span>{job.progress}% · {formatDuration(job.elapsedSeconds)}</span>
          </div>
          <div className="h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
            <div className="h-full bg-green-500" style={{ width: `${job.progress}%` }} />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button className="flex-1 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 flex items-center justify-center gap-1 border border-red-500/20 hover:border-red-500/40 rounded-md">
          <Trash2 className="w-3 h-3" />
          Cancel
        </button>
        <button className="flex-1 py-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center justify-center gap-1 border border-amber-500/20 hover:border-amber-500/40 rounded-md">
          <Rotate3d className="w-3 h-3" />
          Reprioritize
        </button>
        <button onClick={() => onViewDetails(job)} className="flex-1 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 border border-blue-500/20 hover:border-blue-500/40 rounded-md">
          <Eye className="w-3 h-3" />
          Details
        </button>
      </div>
    </div>
  );
}

function JobDetailDrawer({ job, onClose }: { job: Job | null; onClose: () => void }) {
  if (!job) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex justify-end z-50">
      <div className="w-96 bg-[var(--color-surface-1)] border-l border-[var(--color-border)] p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Job Details</h3>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-6">
          <section>
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Spec</h4>
            <div className="space-y-2 text-sm text-[var(--color-text-primary)]">
              <p><span className="text-[var(--color-text-muted)]">ID:</span> {job.id}</p>
              <p><span className="text-[var(--color-text-muted)]">Type:</span> {job.type}</p>
              <p><span className="text-[var(--color-text-muted)]">Priority:</span> {job.priority}</p>
              <p><span className="text-[var(--color-text-muted)]">Enqueued:</span> {job.enqueuedAt.toISOString()}</p>
              <p><span className="text-[var(--color-text-muted)]">Agent:</span> {job.agentEmoji} {job.assignedAgent}</p>
              <p><span className="text-[var(--color-text-muted)]">Status:</span> {job.status}</p>
              <p><span className="text-[var(--color-text-muted)]">Retries:</span> {job.retryCount}</p>
            </div>
          </section>
          <section>
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Input Params</h4>
            <pre className="bg-[var(--color-surface-2)] p-3 rounded-md text-xs overflow-x-auto">
              {JSON.stringify(job.inputParams || {}, null, 2)}
            </pre>
          </section>
          <section>
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Output Preview</h4>
            <pre className="bg-[var(--color-surface-2)] p-3 rounded-md text-xs overflow-x-auto">
              {job.outputPreview || 'N/A'}
            </pre>
          </section>
          <section>
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Timing Breakdown</h4>
            {job.timingBreakdown ? (
              <div className="space-y-1">
                {job.timingBreakdown.map((t, i) => (
                  <div key={i} className="flex justify-between text-sm text-[var(--color-text-primary)]">
                    <span>{t.phase}</span>
                    <span>{t.durationMs}ms</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">N/A</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  return (
    <div className="h-8 flex items-end gap-0.5">
      {data.map((val, i) => (
        <div
          key={i}
          className="w-1.5 bg-green-500 rounded-t"
          style={{ height: `${(val / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function WorkqueueDashboard() {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [workers, setWorkers] = useState<Worker[]>(MOCK_WORKERS);
  const [stats, setStats] = useState<QueueStats>(MOCK_STATS);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const groupedJobs = {
    critical: jobs.filter(j => j.priority === 'critical'),
    high: jobs.filter(j => j.priority === 'high'),
    normal: jobs.filter(j => j.priority === 'normal'),
    low: jobs.filter(j => j.priority === 'low'),
  };

  const failedJobs = jobs.filter(j => j.status === 'failed');

  const handleFlushCompleted = () => {
    setJobs(prev => prev.filter(j => j.status !== 'complete'));
  };

  const handleRetryFailed = (jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'retrying', retryCount: j.retryCount + 1 } : j));
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Work Queue</h1>
          <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-300 text-sm font-medium">
            {stats.running} active
          </span>
          <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium">
            {stats.pending} queued
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              isPaused ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
            )}
          >
            {isPaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
            {isPaused ? 'Resume Queue' : 'Pause Queue'}
          </button>
          <button
            onClick={handleFlushCompleted}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors"
          >
            <Archive className="w-4 h-4" />
            Flush Completed
          </button>
        </div>
      </div>

      {/* Queue Stats Row */}
      <div className="grid grid-cols-6 gap-4">
        <StatCard label="Pending" value={stats.pending} icon={Clock} color="text-amber-400" />
        <StatCard label="Running" value={stats.running} icon={Activity} color="text-green-400" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle} color="text-blue-400" />
        <StatCard label="Failed" value={stats.failed} icon={AlertCircle} color="text-red-400" />
        <StatCard label="Avg Wait" value={`${stats.avgWaitTime}s`} icon={Gauge} color="text-purple-400" />
        <StatCard label="Throughput" value={`${stats.throughput}/min`} icon={Zap} color="text-orange-400" />
      </div>

      {/* Main Layout: Active Workers | Job List | Failed Jobs */}
      <div className="grid grid-cols-4 gap-6">
        {/* Active Workers Panel */}
        <div className="col-span-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            Active Workers
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">{workers.filter(w => w.currentJobId).length} / 5</span>
          </h2>
          <div className="space-y-3">
            {workers.map(worker => (
              <div key={worker.id} className="bg-[var(--color-surface-2)] rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{worker.agentEmoji}</span>
                  <span className="text-sm font-medium">{worker.assignedAgent}</span>
                  <span className="ml-auto text-xs text-[var(--color-text-secondary)]">{worker.currentJobId || 'Idle'}</span>
                </div>
                {worker.currentJobId && (
                  <>
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>Progress</span>
                      <span>{worker.progress}% · {formatDuration(worker.elapsedSeconds)}</span>
                    </div>
                    <div className="h-1 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500" style={{ width: `${worker.progress}%` }} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Job List with Priority Lanes */}
        <div className="col-span-2 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-green-400" />
            Job List
          </h2>
          <div className="space-y-6">
            {(['critical', 'high', 'normal', 'low'] as JobPriority[]).map(priority => (
              <div key={priority}>
                <div className="flex items-center gap-2 mb-2">
                  <PriorityBadge priority={priority} />
                  <span className="text-sm text-[var(--color-text-secondary)]">({groupedJobs[priority].length})</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {groupedJobs[priority].map(job => (
                    <JobCard key={job.id} job={job} onViewDetails={setSelectedJob} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Failed Jobs Panel + Throughput Sparkline */}
        <div className="col-span-1 space-y-6">
          {/* Failed Jobs */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Failed Jobs
              <span className="ml-auto text-xs text-[var(--color-text-muted)]">{failedJobs.length}</span>
            </h2>
            <div className="space-y-3">
              {failedJobs.map(job => (
                <div key={job.id} className="bg-[var(--color-surface-2)] rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">{job.id}</span>
                    <TypeBadge type={job.type} />
                    <PriorityBadge priority={job.priority} />
                  </div>
                  <p className="text-xs text-red-400">{job.errorMessage}</p>
                  <button
                    onClick={() => handleRetryFailed(job.id)}
                    className="w-full py-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center justify-center gap-1 border border-purple-500/20 hover:border-purple-500/40 rounded-md"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Throughput Sparkline */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              Throughput (last 30 min)
            </h2>
            <Sparkline data={MOCK_THROUGHPUT} />
            <p className="text-xs text-[var(--color-text-muted)] text-center">Jobs completed per minute</p>
          </div>
        </div>
      </div>

      <JobDetailDrawer job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}
