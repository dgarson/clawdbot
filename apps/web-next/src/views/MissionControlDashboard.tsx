import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Info,
  Layers,
  MessageSquare,
  Radio,
  Terminal,
  Users,
  XCircle,
  Zap,
  FileText,
  GitBranch,
  AlertCircle,
  ChevronUp,
  X,
  Check,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { EmptyState } from '../components/ui/empty-state';

// ============================================================================
// Types
// ============================================================================

type SessionStatus = 'RUNNING' | 'WAITING' | 'ERROR';
type SessionType = 'main' | 'subagent' | 'cron';

interface ActiveSession {
  id: string;
  agentName: string;
  agentEmoji: string;
  sessionType: SessionType;
  currentTool?: string;
  tokenInput: number;
  tokenOutput: number;
  durationSeconds: number;
  status: SessionStatus;
}

type ToolCallStatus = 'running' | 'complete' | 'error';
type ToolType = 'exec' | 'read' | 'write' | 'sessions_spawn' | 'message' | 'browser' | 'other';

interface ToolCall {
  id: string;
  toolName: string;
  toolType: ToolType;
  agentName: string;
  elapsedMs: number;
  status: ToolCallStatus;
  completedAt?: number;
}

type RiskLevel = 'Low' | 'Medium' | 'High';

interface PendingApproval {
  id: string;
  agentName: string;
  agentEmoji: string;
  actionDescription: string;
  riskLevel: RiskLevel;
  waitingSeconds: number;
}

type AlertSeverity = 'critical' | 'error' | 'warning' | 'info';
type AlertFilter = 'all' | 'error' | 'warning' | 'info';

interface AlertEntry {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  agentName: string;
  message: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const INITIAL_SESSIONS: ActiveSession[] = [
  {
    id: 's1',
    agentName: 'Luis',
    agentEmoji: '🎨',
    sessionType: 'main',
    currentTool: 'sessions_spawn',
    tokenInput: 14320,
    tokenOutput: 3812,
    durationSeconds: 284,
    status: 'RUNNING',
  },
  {
    id: 's2',
    agentName: 'Quinn',
    agentEmoji: '⚡',
    sessionType: 'subagent',
    currentTool: 'exec',
    tokenInput: 6204,
    tokenOutput: 1950,
    durationSeconds: 142,
    status: 'RUNNING',
  },
  {
    id: 's3',
    agentName: 'Xavier',
    agentEmoji: '🏗️',
    sessionType: 'main',
    currentTool: 'read',
    tokenInput: 22100,
    tokenOutput: 5430,
    durationSeconds: 510,
    status: 'WAITING',
  },
  {
    id: 's4',
    agentName: 'Stephan',
    agentEmoji: '📣',
    sessionType: 'main',
    currentTool: undefined,
    tokenInput: 8900,
    tokenOutput: 2110,
    durationSeconds: 78,
    status: 'WAITING',
  },
  {
    id: 's5',
    agentName: 'Reed',
    agentEmoji: '♿',
    sessionType: 'subagent',
    currentTool: 'write',
    tokenInput: 3100,
    tokenOutput: 980,
    durationSeconds: 34,
    status: 'ERROR',
  },
];

const INITIAL_TOOL_CALLS: ToolCall[] = [
  {
    id: 'tc1',
    toolName: 'exec',
    toolType: 'exec',
    agentName: 'Quinn',
    elapsedMs: 4200,
    status: 'running',
  },
  {
    id: 'tc2',
    toolName: 'sessions_spawn',
    toolType: 'sessions_spawn',
    agentName: 'Luis',
    elapsedMs: 12800,
    status: 'running',
  },
  {
    id: 'tc3',
    toolName: 'read',
    toolType: 'read',
    agentName: 'Xavier',
    elapsedMs: 340,
    status: 'complete',
    completedAt: Date.now() - 1200,
  },
  {
    id: 'tc4',
    toolName: 'message',
    toolType: 'message',
    agentName: 'Stephan',
    elapsedMs: 880,
    status: 'complete',
    completedAt: Date.now() - 3100,
  },
  {
    id: 'tc5',
    toolName: 'write',
    toolType: 'write',
    agentName: 'Reed',
    elapsedMs: 1500,
    status: 'error',
    completedAt: Date.now() - 500,
  },
  {
    id: 'tc6',
    toolName: 'browser',
    toolType: 'browser',
    agentName: 'Piper',
    elapsedMs: 7300,
    status: 'running',
  },
];

const INITIAL_APPROVALS: PendingApproval[] = [
  {
    id: 'ap1',
    agentName: 'Xavier',
    agentEmoji: '🏗️',
    actionDescription: 'Merge PR #312 into feat/horizon-ui-complete — 847 lines changed',
    riskLevel: 'Medium',
    waitingSeconds: 192,
  },
];

const INITIAL_ALERTS: AlertEntry[] = [
  {
    id: 'al1',
    timestamp: new Date(Date.now() - 12000),
    severity: 'critical',
    agentName: 'Reed',
    message: 'Tool timeout: write() exceeded 30s limit — session may be stalled',
  },
  {
    id: 'al2',
    timestamp: new Date(Date.now() - 45000),
    severity: 'error',
    agentName: 'Quinn',
    message: 'Rate limit hit on anthropic/claude-sonnet-4-6 — retrying in 15s',
  },
  {
    id: 'al3',
    timestamp: new Date(Date.now() - 78000),
    severity: 'warning',
    agentName: 'Xavier',
    message: 'Session context nearing limit (82% used) — compaction recommended',
  },
  {
    id: 'al4',
    timestamp: new Date(Date.now() - 120000),
    severity: 'info',
    agentName: 'Luis',
    message: 'Spawned subagent quinn/horizon-m1-mission-control (depth 1)',
  },
  {
    id: 'al5',
    timestamp: new Date(Date.now() - 180000),
    severity: 'info',
    agentName: 'Stephan',
    message: 'Agent session started — model: claude-sonnet-4-6',
  },
  {
    id: 'al6',
    timestamp: new Date(Date.now() - 240000),
    severity: 'warning',
    agentName: 'Piper',
    message: 'Browser snapshot took 8.2s — above 5s threshold',
  },
  {
    id: 'al7',
    timestamp: new Date(Date.now() - 320000),
    severity: 'error',
    agentName: 'Xavier',
    message: 'exec() process exited with code 1 — npm run build failed',
  },
  {
    id: 'al8',
    timestamp: new Date(Date.now() - 480000),
    severity: 'info',
    agentName: 'System',
    message: 'Gateway restarted — all sessions re-registered (5 active)',
  },
  {
    id: 'al9',
    timestamp: new Date(Date.now() - 600000),
    severity: 'warning',
    agentName: 'Reed',
    message: 'Session compaction triggered — context window freed 42% tokens',
  },
  {
    id: 'al10',
    timestamp: new Date(Date.now() - 720000),
    severity: 'info',
    agentName: 'Luis',
    message: 'Heartbeat cycle complete — 3 queue items claimed',
  },
];

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatWaiting(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

// ============================================================================
// Sub-components
// ============================================================================

// WCAG fix: aria-hidden — decorative pulse animation, never read by AT
function PulseDot({ color = 'bg-green-500' }: { color?: string }) {
  return (
    <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', color)} />
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', color)} />
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  pulse,
  pulseColor,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  icon: React.ElementType;
  pulse?: boolean;
  pulseColor?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
      <div className="mt-0.5 p-2 bg-zinc-800 rounded-lg">
        {/* WCAG fix: decorative icon — label text below provides the meaning */}
        <Icon aria-hidden="true" className="w-4 h-4 text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">{label}</p>
        <div className="flex items-center gap-2">
          {pulse && <PulseDot color={pulseColor} />}
          <span className="text-xl font-bold text-white">{value}</span>
        </div>
        {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// WCAG fix: role="status" so AT announces the badge value; dot is aria-hidden since text carries the status
function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const styles: Record<SessionStatus, string> = {
    RUNNING: 'bg-green-500/15 text-green-400 border-green-500/30',
    WAITING: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    ERROR: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  const dots: Record<SessionStatus, string> = {
    RUNNING: 'bg-green-500',
    WAITING: 'bg-amber-500',
    ERROR: 'bg-red-500',
  };
  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border', styles[status])}
    >
      {/* WCAG fix: color dot is decorative — status text carries the meaning */}
      <span aria-hidden="true" className={cn('w-1.5 h-1.5 rounded-full', status === 'RUNNING' && 'animate-pulse', dots[status])} />
      {status}
    </span>
  );
}

function SessionTypeBadge({ type }: { type: SessionType }) {
  const styles: Record<SessionType, string> = {
    main: 'bg-violet-500/15 text-violet-400',
    subagent: 'bg-sky-500/15 text-sky-400',
    cron: 'bg-orange-500/15 text-orange-400',
  };
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', styles[type])}>
      {type}
    </span>
  );
}

function ToolBadge({ toolType, toolName }: { toolType: ToolType; toolName: string }) {
  const styles: Record<ToolType, string> = {
    exec: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    read: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
    write: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
    sessions_spawn: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
    message: 'bg-green-500/15 text-green-400 border-green-500/25',
    browser: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
    other: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/25',
  };
  const icons: Record<ToolType, React.ElementType> = {
    exec: Terminal,
    read: FileText,
    write: FileText,
    sessions_spawn: GitBranch,
    message: MessageSquare,
    browser: Activity,
    other: Layers,
  };
  const Icon = icons[toolType];
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono border', styles[toolType])}>
      {/* WCAG fix: decorative icon — tool name text carries the meaning */}
      <Icon aria-hidden="true" className="w-3 h-3" />
      {toolName}
    </span>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    Low: 'bg-green-500/15 text-green-400',
    Medium: 'bg-amber-500/15 text-amber-400',
    High: 'bg-red-500/15 text-red-400',
  };
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', styles[level])}>
      {level}
    </span>
  );
}

// WCAG fix: severity icons are informative — each carries an aria-label and role="img"
function SeverityIcon({ severity }: { severity: AlertSeverity }) {
  switch (severity) {
    case 'critical':
      return <XCircle role="img" aria-label="Critical" className="w-4 h-4 text-red-500 shrink-0" />;
    case 'error':
      return <AlertCircle role="img" aria-label="Error" className="w-4 h-4 text-orange-400 shrink-0" />;
    case 'warning':
      return <AlertTriangle role="img" aria-label="Warning" className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'info':
      return <Info role="img" aria-label="Info" className="w-4 h-4 text-sky-400 shrink-0" />;
  }
}

// ============================================================================
// Section: Live Status Bar
// ============================================================================

function LiveStatusBar({
  sessionCount,
  agentCount,
  tokensPerMin,
  gatewayOnline,
}: {
  sessionCount: number;
  agentCount: number;
  tokensPerMin: number;
  gatewayOnline: boolean;
}) {
  return (
    // WCAG fix: aria-live="polite" so screen readers hear updates every 3s without interruption
    <div aria-live="polite" aria-label="Live system status" className="grid grid-cols-4 gap-4">
      <StatCard
        label="Gateway"
        value={gatewayOnline ? 'ONLINE' : 'OFFLINE'}
        sub="All systems nominal"
        icon={Radio}
        pulse
        pulseColor={gatewayOnline ? 'bg-green-500' : 'bg-red-500'}
      />
      <StatCard
        label="Active Sessions"
        value={sessionCount}
        sub={
          <span className="flex items-center gap-1 text-green-400">
            {/* WCAG fix: decorative trend arrow, sr-only equivalent conveyed by surrounding text */}
            <ChevronUp aria-hidden="true" className="w-3 h-3" />
            3 in last 5min
          </span>
        }
        icon={Layers}
        pulse
        pulseColor="bg-green-500"
      />
      <StatCard
        label="Active Agents"
        value={agentCount}
        sub="Across all sessions"
        icon={Users}
        pulse
        pulseColor="bg-violet-500"
      />
      <StatCard
        label="Tokens / min"
        value={tokensPerMin.toLocaleString()}
        sub="Combined I/O rate"
        icon={Zap}
        pulse
        pulseColor="bg-amber-500"
      />
    </div>
  );
}

// ============================================================================
// Section: Active Sessions Panel
// ============================================================================

function ActiveSessionsPanel({ sessions }: { sessions: ActiveSession[] }) {
  return (
    <section aria-label="Active Sessions" className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* WCAG fix: decorative header icon */}
          <Activity aria-hidden="true" className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Active Sessions</span>
        </div>
        <span className="text-xs text-zinc-500">{sessions.length} / 10</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
        {sessions.length === 0 ? (
          <EmptyState
            variant="no-sessions"
            title="No active sessions"
            description="Agents are idle right now. Start a new run or open an existing session to populate this panel."
            className="h-40 py-4 px-4"
          />
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="px-4 py-3 hover:bg-zinc-800/40 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* WCAG fix: emoji is decorative — name follows */}
                  <span aria-hidden="true" className="text-lg leading-none">{session.agentEmoji}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-white">{session.agentName}</span>
                      <SessionTypeBadge type={session.sessionType} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                      {/* WCAG fix: decorative clock icon */}
                      <Clock aria-hidden="true" className="w-3 h-3" />
                      running {formatDuration(session.durationSeconds)}
                      <span aria-hidden="true" className="text-zinc-700">·</span>
                      <span>{formatTokens(session.tokenInput)}↑ {formatTokens(session.tokenOutput)}↓</span>
                    </div>
                  </div>
                </div>
                <SessionStatusBadge status={session.status} />
              </div>
              {session.currentTool && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-zinc-500">calling</span>
                  <ToolBadge
                    toolName={session.currentTool}
                    toolType={
                      ['exec', 'read', 'write', 'sessions_spawn', 'message', 'browser'].includes(session.currentTool)
                        ? (session.currentTool as ToolType)
                        : 'other'
                    }
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Section: Tool Calls In-Flight
// ============================================================================

function ToolCallsPanel({ toolCalls }: { toolCalls: ToolCall[] }) {
  const now = Date.now();

  return (
    <section aria-label="Tool Calls In-Flight" className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        {/* WCAG fix: decorative header icon */}
        <Terminal aria-hidden="true" className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">Tool Calls</span>
        <span className="ml-auto text-xs text-zinc-500">
          {toolCalls.filter((t) => t.status === 'running').length} running
        </span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
        {toolCalls.length === 0 ? (
          <EmptyState
            variant="no-results"
            title="No recent tool calls"
            description="Tool executions will appear here when agents start running commands."
            className="h-40 py-4 px-4"
          />
        ) : (
          toolCalls.map((tc) => {
            const age = tc.completedAt ? now - tc.completedAt : 0;
            const fadingOut = tc.status !== 'running' && age > 3000;
            return (
              <div
                key={tc.id}
                className={cn(
                  'px-4 py-3 transition-opacity duration-[2000ms]',
                  fadingOut ? 'opacity-30' : 'opacity-100',
                  tc.status === 'error' && 'bg-red-950/20',
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <ToolBadge toolType={tc.toolType} toolName={tc.toolName} />
                  {tc.status === 'running' && (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      {/* WCAG fix: decorative pulse dot — "live" text carries the meaning */}
                      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      live
                    </span>
                  )}
                  {/* WCAG fix: status icons carry informative role + label */}
                  {tc.status === 'complete' && (
                    <CheckCircle role="img" aria-label="Complete" className="w-3.5 h-3.5 text-green-500 opacity-60" />
                  )}
                  {tc.status === 'error' && (
                    <XCircle role="img" aria-label="Error" className="w-3.5 h-3.5 text-red-500" />
                  )}
                </div>
                <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                  <span className="text-zinc-400">{tc.agentName}</span>
                  <span aria-hidden="true" className="text-zinc-700">·</span>
                  {/* WCAG fix: decorative clock icon */}
                  <Clock aria-hidden="true" className="w-3 h-3" />
                  {formatElapsed(tc.elapsedMs)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Section: Pending Approvals
// ============================================================================

function PendingApprovalsPanel({
  approvals,
  onApprove,
  onDeny,
}: {
  approvals: PendingApproval[];
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  return (
    <section aria-label="Pending Approvals" className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        {/* WCAG fix: decorative header icon */}
        <CheckCircle aria-hidden="true" className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-white">Pending Approvals</span>
        {approvals.length > 0 && (
          <span
            aria-label={`${approvals.length} pending`}
            className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-xs font-bold leading-none"
          >
            {approvals.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {approvals.length === 0 ? (
          <EmptyState
            variant="generic"
            title="No pending approvals"
            description="No approval actions are waiting for review. High-risk operations will show up here."
            className="h-40 py-4 px-4"
          />
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {approvals.map((ap) => (
              <div key={ap.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  {/* WCAG fix: decorative emoji */}
                  <span aria-hidden="true" className="text-base">{ap.agentEmoji}</span>
                  <span className="text-sm font-medium text-white">{ap.agentName}</span>
                  <RiskBadge level={ap.riskLevel} />
                  <span className="ml-auto text-xs text-zinc-500 flex items-center gap-1">
                    {/* WCAG fix: decorative clock icon */}
                    <Clock aria-hidden="true" className="w-3 h-3" />
                    {formatWaiting(ap.waitingSeconds)}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{ap.actionDescription}</p>
                <div className="flex gap-2">
                  {/* WCAG fix: focus-visible ring on interactive buttons; icons are decorative */}
                  <button
                    onClick={() => onApprove(ap.id)}
                    aria-label={`Approve: ${ap.actionDescription}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:outline-none"
                  >
                    <Check aria-hidden="true" className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => onDeny(ap.id)}
                    aria-label={`Deny: ${ap.actionDescription}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors border border-zinc-700 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                  >
                    <X aria-hidden="true" className="w-3.5 h-3.5" />
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Section: Error / Alert Feed
// ============================================================================

function AlertFeed({ alerts }: { alerts: AlertEntry[] }) {
  const [filter, setFilter] = useState<AlertFilter>('all');

  const filters: { key: AlertFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'error', label: 'Errors' },
    { key: 'warning', label: 'Warnings' },
    { key: 'info', label: 'Info' },
  ];

  const filtered = alerts.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'error') return a.severity === 'critical' || a.severity === 'error';
    if (filter === 'warning') return a.severity === 'warning';
    if (filter === 'info') return a.severity === 'info';
    return true;
  });

  const severityRowStyle: Record<AlertSeverity, string> = {
    critical: 'border-l-2 border-l-red-500 bg-red-950/20',
    error: 'border-l-2 border-l-orange-500 bg-orange-950/10',
    warning: 'border-l-2 border-l-amber-500 bg-amber-950/10',
    info: 'border-l-2 border-l-sky-500/50',
  };

  return (
    <section aria-label="System Event Feed" className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* WCAG fix: decorative header icon */}
          <AlertTriangle aria-hidden="true" className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">System Event Feed</span>
          <span className="text-xs text-zinc-500">last {Math.min(alerts.length, 20)} events</span>
        </div>
        {/* WCAG fix: filter buttons have aria-pressed to convey selected state to AT */}
        <div role="group" aria-label="Filter events" className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none',
                filter === f.key
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-300',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* WCAG fix: role="log" + aria-live so new entries are announced politely by AT */}
      <div
        role="log"
        aria-live="polite"
        aria-label="System events"
        className="divide-y divide-zinc-800/40 max-h-64 overflow-y-auto"
      >
        {filtered.length === 0 ? (
          <EmptyState
            variant="no-results"
            title="No alerts for this filter"
            description="Try switching severity filters or wait for new system events."
            className="h-28 py-3 px-4"
          />
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className={cn('flex items-start gap-3 px-4 py-2.5 text-xs', severityRowStyle[alert.severity])}
            >
              <span className="text-zinc-500 font-mono whitespace-nowrap mt-0.5 text-[11px]">
                {formatTimestamp(alert.timestamp)}
              </span>
              <SeverityIcon severity={alert.severity} />
              <span className="font-medium text-zinc-300 shrink-0">{alert.agentName}</span>
              <span className="text-zinc-400 leading-relaxed">{alert.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function MissionControlDashboard() {
  const [sessions, setSessions] = useState<ActiveSession[]>(INITIAL_SESSIONS);
  const [approvals, setApprovals] = useState<PendingApproval[]>(INITIAL_APPROVALS);
  const [tick, setTick] = useState(0);

  // Cycle session states every 3s to simulate live feel
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setSessions((prev) =>
        prev.map((s, i) => {
          // Rotate tools and statuses on a staggered cycle
          const cycle = Math.floor(Date.now() / 3000) + i;
          const tools = ['exec', 'read', 'write', 'sessions_spawn', 'message', 'browser', undefined];
          const nextTool = tools[cycle % tools.length] as string | undefined;
          const statuses: SessionStatus[] = ['RUNNING', 'RUNNING', 'WAITING', 'RUNNING', 'RUNNING'];
          const nextStatus = s.status === 'ERROR' ? 'ERROR' : statuses[cycle % statuses.length];
          return {
            ...s,
            currentTool: s.status === 'ERROR' ? undefined : nextTool,
            status: nextStatus,
            durationSeconds: s.durationSeconds + 3,
            tokenInput: s.tokenInput + Math.floor(Math.random() * 60),
            tokenOutput: s.tokenOutput + Math.floor(Math.random() * 20),
          };
        }),
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Suppress unused tick warning — used to force re-render for elapsed times
  void tick;

  const handleApprove = useCallback((id: string) => {
    console.log('[MissionControl] Approved:', id);
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleDeny = useCallback((id: string) => {
    console.log('[MissionControl] Denied:', id);
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const gatewayOnline = true;
  const sessionCount = sessions.length;
  const agentCount = sessions.filter((s) => s.status === 'RUNNING').length;
  const tokensPerMin = 4280;

  return (
    <>
      {/* WCAG fix: skip link — allows keyboard users to bypass repetitive header/nav content */}
      <a
        href="#mcd-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-700 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* WCAG fix: <main> landmark identifies the primary content region */}
      <main id="mcd-main" className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {/* WCAG fix: decorative icon — heading text carries the label */}
              <Radio aria-hidden="true" className="w-6 h-6 text-violet-400" />
              Mission Control
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">Real-time operator hub — live system state</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            {/* PulseDot is already aria-hidden="true" internally */}
            <PulseDot color="bg-green-500" />
            <span>Live</span>
            <span aria-hidden="true" className="text-zinc-700">·</span>
            <span>Updated every 3s</span>
          </div>
        </div>

        {/* Section 1: Live Status Bar */}
        <LiveStatusBar
          sessionCount={sessionCount}
          agentCount={agentCount}
          tokensPerMin={tokensPerMin}
          gatewayOnline={gatewayOnline}
        />

        {/* Sections 2-4: Three-panel layout */}
        <div className="grid grid-cols-4 gap-4" style={{ minHeight: '420px' }}>
          {/* Active Sessions — 2/4 width */}
          <div className="col-span-2">
            <ActiveSessionsPanel sessions={sessions} />
          </div>

          {/* Tool Calls In-Flight — 1/4 width */}
          <div className="col-span-1">
            <ToolCallsPanel toolCalls={INITIAL_TOOL_CALLS} />
          </div>

          {/* Pending Approvals — 1/4 width */}
          <div className="col-span-1">
            <PendingApprovalsPanel
              approvals={approvals}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />
          </div>
        </div>

        {/* Section 5: Alert Feed */}
        <AlertFeed alerts={INITIAL_ALERTS} />
      </main>
    </>
  );
}
