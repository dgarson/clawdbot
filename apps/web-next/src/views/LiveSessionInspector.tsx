import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Clock,
  FileText,
  MessageSquare,
  Play,
  Pause,
  Square,
  Terminal,
  Users,
  XCircle,
  Zap,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Send,
  Layers,
  Cpu,
  Database,
  FileCode,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type SessionStatus = 'RUNNING' | 'PAUSED' | 'WAITING' | 'ERROR';
type SessionType = 'main' | 'subagent' | 'cron';
type TabKey = 'overview' | 'tools' | 'memory' | 'rawlog';
type ToolCallStatus = 'running' | 'complete' | 'error';
type ToolType = 'exec' | 'read' | 'write' | 'sessions_spawn' | 'message' | 'browser' | 'other';
type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface ToolCall {
  id: string;
  toolName: string;
  toolType: ToolType;
  elapsedMs: number;
  status: ToolCallStatus;
  parameters?: Record<string, unknown>;
}

interface MemoryEntry {
  key: string;
  value: string;
  source: string;
}

interface LogLine {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

interface SessionData {
  id: string;
  agentName: string;
  agentEmoji: string;
  sessionType: SessionType;
  status: SessionStatus;
  elapsedSeconds: number;
  tokenInput: number;
  tokenInputLimit: number;
  tokenOutput: number;
  tokenOutputLimit: number;
  costEstimate: number;
  toolCalls: ToolCall[];
  memoryEntries: MemoryEntry[];
  agentNotes: string;
  logs: LogLine[];
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_SESSION: SessionData = {
  id: 'sess_8f3a2c1d9e4b7f0a',
  agentName: 'Quinn',
  agentEmoji: '⚡',
  sessionType: 'subagent',
  status: 'RUNNING',
  elapsedSeconds: 847,
  tokenInput: 48210,
  tokenInputLimit: 200000,
  tokenOutput: 12340,
  tokenOutputLimit: 8192,
  costEstimate: 2.47,
  toolCalls: [
    {
      id: 'tc1',
      toolName: 'exec',
      toolType: 'exec',
      elapsedMs: 4200,
      status: 'running',
      parameters: { command: 'npm run build', cwd: '/workspace/clawdbot' },
    },
    {
      id: 'tc2',
      toolName: 'read',
      toolType: 'read',
      elapsedMs: 890,
      status: 'complete',
      parameters: { path: '/workspace/clawdbot/package.json' },
    },
    {
      id: 'tc3',
      toolName: 'write',
      toolType: 'write',
      elapsedMs: 1240,
      status: 'complete',
      parameters: { path: '/workspace/clawdbot/src/views/Dashboard.tsx' },
    },
    {
      id: 'tc4',
      toolName: 'sessions_spawn',
      toolType: 'sessions_spawn',
      elapsedMs: 15600,
      status: 'running',
      parameters: { task: 'Build Mission Control view', agentId: 'luis' },
    },
    {
      id: 'tc5',
      toolName: 'message',
      toolType: 'message',
      elapsedMs: 340,
      status: 'error',
      parameters: { target: '#cb-notifications', message: 'Build complete!' },
    },
    {
      id: 'tc6',
      toolName: 'browser',
      toolType: 'browser',
      elapsedMs: 2890,
      status: 'complete',
      parameters: { action: 'screenshot', url: 'https://localhost:3000' },
    },
  ],
  memoryEntries: [
    { key: 'project_root', value: '/workspace/clawdbot', source: 'context' },
    { key: 'target_branch', value: 'feat/horizon-ui-complete', source: 'instruction' },
    { key: 'user_name', value: 'David', source: 'USER.md' },
    { key: 'primary_channel', value: '#cb-inbox', source: 'USER.md' },
    { key: 'last_commit', value: 'a3f2c91', source: 'runtime' },
  ],
  agentNotes: `Task: Build LiveSessionInspector view for Mission Control Sprint 1.

Progress:
- ✅ Header with agent info and status
- ✅ Token budget panel with progress bars
- ✅ Tool call waterfall with expandable params
- ✅ Memory/context panel
- ✅ Tab navigation (Overview | Tools | Memory | Raw Log)

Next:
- [ ] Add control strip buttons
- [ ] Implement kill confirmation modal
- [ ] Add message input for Send Message

Reasoning:
The session inspector should feel like a debugger — all the info you need,
nothing you don't. Color coding by status, progress bars for budgets,
collapsible sections to reduce cognitive load.`,
  logs: [
    { id: 'l1', timestamp: new Date(Date.now() - 847000), level: 'INFO', message: 'Session started — model: claude-sonnet-4-6' },
    { id: 'l2', timestamp: new Date(Date.now() - 840000), level: 'INFO', message: 'Loaded context: AGENTS.md, USER.md, SOUL.md' },
    { id: 'l3', timestamp: new Date(Date.now() - 835000), level: 'INFO', message: 'Instruction received: Build LiveSessionInspector view' },
    { id: 'l4', timestamp: new Date(Date.now() - 820000), level: 'INFO', message: 'Tool call: read(/workspace/clawdbot/package.json)' },
    { id: 'l5', timestamp: new Date(Date.now() - 818000), level: 'INFO', message: 'Tool complete: read — 234 bytes read' },
    { id: 'l6', timestamp: new Date(Date.now() - 800000), level: 'WARN', message: 'Context window at 65% capacity' },
    { id: 'l7', timestamp: new Date(Date.now() - 780000), level: 'INFO', message: 'Tool call: write(/workspace/clawdbot/src/views/Dashboard.tsx)' },
    { id: 'l8', timestamp: new Date(Date.now() - 778000), level: 'INFO', message: 'Tool complete: write — 1,892 bytes written' },
    { id: 'l9', timestamp: new Date(Date.now() - 650000), level: 'ERROR', message: 'Tool failed: message — rate limit exceeded' },
    { id: 'l10', timestamp: new Date(Date.now() - 640000), level: 'INFO', message: 'Tool call: browser(screenshot)' },
    { id: 'l11', timestamp: new Date(Date.now() - 637000), level: 'INFO', message: 'Tool complete: browser — screenshot saved' },
    { id: 'l12', timestamp: new Date(Date.now() - 500000), level: 'INFO', message: 'Spawned subagent: luis/horizon-m1-mc-dashboard' },
    { id: 'l13', timestamp: new Date(Date.now() - 300000), level: 'WARN', message: 'Subagent luis/horizon-m1-mc-dashboard still running after 5m' },
    { id: 'l14', timestamp: new Date(Date.now() - 60000), level: 'INFO', message: 'Tool call: exec(npm run build)' },
    { id: 'l15', timestamp: new Date(Date.now() - 30000), level: 'INFO', message: 'Heartbeat cycle complete — no pending items' },
  ],
};

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
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

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

// ============================================================================
// Sub-components
// ============================================================================

function PulseDot({ color = 'bg-green-500' }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', color)} />
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', color)} />
    </span>
  );
}

function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const styles: Record<SessionStatus, string> = {
    RUNNING: 'bg-green-500/15 text-green-400 border-green-500/30',
    PAUSED: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    WAITING: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    ERROR: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  const dots: Record<SessionStatus, string> = {
    RUNNING: 'bg-green-500',
    PAUSED: 'bg-sky-500',
    WAITING: 'bg-amber-500',
    ERROR: 'bg-red-500',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border', styles[status])}>
      <span className={cn('w-1.5 h-1.5 rounded-full', status === 'RUNNING' && 'animate-pulse', dots[status])} />
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
    sessions_spawn: Users,
    message: MessageSquare,
    browser: Activity,
    other: Layers,
  };
  const Icon = icons[toolType];
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono border', styles[toolType])}>
      <Icon className="w-3 h-3" />
      {toolName}
    </span>
  );
}

function ToolStatusBadge({ status }: { status: ToolCallStatus }) {
  const styles: Record<ToolCallStatus, string> = {
    running: 'bg-green-500/15 text-green-400 border-green-500/25',
    complete: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/25',
    error: 'bg-red-500/15 text-red-400 border-red-500/25',
  };
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium border', styles[status])}>
      {status}
    </span>
  );
}

function LogLevelBadge({ level }: { level: LogLevel }) {
  const styles: Record<LogLevel, string> = {
    INFO: 'text-sky-400',
    WARN: 'text-amber-400',
    ERROR: 'text-red-400',
  };
  return (
    <span className={cn('font-mono text-xs', styles[level])}>
      [{level}]
    </span>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[2px]',
        active
          ? 'text-violet-400 border-violet-400'
          : 'text-zinc-400 border-transparent hover:text-zinc-300',
      )}
    >
      {children}
    </button>
  );
}

function ProgressBar({
  value,
  max,
  color = 'bg-violet-500',
  label,
}: {
  value: number;
  max: number;
  color?: string;
  label?: string;
}) {
  const percent = Math.min(100, (value / max) * 100);
  const isHigh = percent > 80;
  const isMedium = percent > 60;
  const barColor = isHigh ? 'bg-red-500' : isMedium ? 'bg-amber-500' : color;
  
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400">{label}</span>
          <span className="text-zinc-500 font-mono">
            {formatTokens(value)} / {formatTokens(max)}
          </span>
        </div>
      )}
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Section: Header
// ============================================================================

function SessionHeader({ session }: { session: SessionData }) {
  return (
    <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{session.agentEmoji}</span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{session.agentName}</h1>
            <SessionTypeBadge type={session.sessionType} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs text-zinc-500 font-mono">{session.id}</code>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(session.elapsedSeconds)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SessionStatusBadge status={session.status} />
        {session.status === 'RUNNING' && <PulseDot color="bg-green-500" />}
      </div>
    </div>
  );
}

// ============================================================================
// Section: Status Bar
// ============================================================================

function StatusBar({ status }: { status: SessionStatus }) {
  const styles: Record<SessionStatus, { bg: string; text: string; border: string }> = {
    RUNNING: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
    PAUSED: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
    WAITING: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    ERROR: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  };
  const style = styles[status];
  const icons: Record<SessionStatus, React.ElementType> = {
    RUNNING: Activity,
    PAUSED: Pause,
    WAITING: Clock,
    ERROR: AlertCircle,
  };
  const Icon = icons[status];
  
  return (
    <div className={cn('rounded-lg border px-4 py-2 flex items-center gap-2', style.bg, style.border)}>
      <Icon className={cn('w-4 h-4', status === 'RUNNING' && 'animate-pulse', style.text)} />
      <span className={cn('text-sm font-semibold', style.text)}>{status}</span>
      {status === 'RUNNING' && (
        <span className="text-xs text-zinc-500 ml-2">Processing...</span>
      )}
      {status === 'WAITING' && (
        <span className="text-xs text-zinc-500 ml-2">Awaiting user input</span>
      )}
      {status === 'ERROR' && (
        <span className="text-xs text-zinc-500 ml-2">Recoverable — agent may retry</span>
      )}
    </div>
  );
}

// ============================================================================
// Section: Token Budget Panel
// ============================================================================

function TokenBudgetPanel({ session }: { session: SessionData }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-white">Token Budget</span>
      </div>
      
      <div className="space-y-4">
        <ProgressBar
          value={session.tokenInput}
          max={session.tokenInputLimit}
          label="Input Tokens"
          color="bg-sky-500"
        />
        <ProgressBar
          value={session.tokenOutput}
          max={session.tokenOutputLimit}
          label="Output Tokens"
          color="bg-violet-500"
        />
        
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs">Estimated Cost</span>
          </div>
          <span className="text-sm font-mono text-white">${session.costEstimate.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Section: Tool Call Waterfall
// ============================================================================

function ToolCallWaterfall({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const runningCount = toolCalls.filter((t) => t.status === 'running').length;
  const completedCount = toolCalls.filter((t) => t.status === 'complete').length;
  const errorCount = toolCalls.filter((t) => t.status === 'error').length;
  
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Tool Calls</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-400">{runningCount} running</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">{completedCount} complete</span>
          {errorCount > 0 && (
            <>
              <span className="text-zinc-600">·</span>
              <span className="text-red-400">{errorCount} error</span>
            </>
          )}
        </div>
      </div>
      
      <div className="divide-y divide-zinc-800/60 max-h-80 overflow-y-auto">
        {toolCalls.map((tc) => (
          <div key={tc.id} className={cn(tc.status === 'error' && 'bg-red-950/20')}>
            <div
              className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800/40 transition-colors"
              onClick={() => toggleExpand(tc.id)}
            >
              <div className="flex items-center gap-3">
                {expanded.has(tc.id) ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                )}
                <ToolBadge toolType={tc.toolType} toolName={tc.toolName} />
                {tc.status === 'running' && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    live
                  </span>
                )}
                {tc.status === 'complete' && (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 opacity-60" />
                )}
                {tc.status === 'error' && (
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatElapsed(tc.elapsedMs)}
                </span>
                <ToolStatusBadge status={tc.status} />
              </div>
            </div>
            
            {expanded.has(tc.id) && tc.parameters && (
              <div className="px-4 pb-3">
                <pre className="text-xs text-zinc-400 font-mono bg-zinc-800/50 rounded-md p-2 overflow-x-auto">
                  {JSON.stringify(tc.parameters, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Section: Memory Panel
// ============================================================================

function MemoryPanel({ entries }: { entries: MemoryEntry[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <Database className="w-4 h-4 text-sky-400" />
        <span className="text-sm font-semibold text-white">Active Memory</span>
        <span className="text-xs text-zinc-500">{entries.length} entries</span>
      </div>
      
      <div className="divide-y divide-zinc-800/60 max-h-60 overflow-y-auto">
        {entries.map((entry, idx) => (
          <div key={idx} className="px-4 py-2 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-violet-400">{entry.key}</span>
                <span className="text-xs text-zinc-600 px-1 py-0.5 bg-zinc-800 rounded">{entry.source}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono truncate">{entry.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Section: Agent Notes
// ============================================================================

function AgentNotesPanel({ notes }: { notes: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <FileCode className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">Agent Notes</span>
        <span className="text-xs text-zinc-600">Read-only</span>
      </div>
      <div className="p-4">
        <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">
          {notes}
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// Section: Raw Log
// ============================================================================

function RawLogPanel({ logs }: { logs: LogLine[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl h-full flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <FileText className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-semibold text-white">Raw Log</span>
        <span className="text-xs text-zinc-500">{logs.length} lines</span>
      </div>
      
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {logs.map((log) => (
          <div
            key={log.id}
            className={cn(
              'px-4 py-1.5 flex items-start gap-2 hover:bg-zinc-800/40',
              log.level === 'ERROR' && 'bg-red-950/20',
              log.level === 'WARN' && 'bg-amber-950/10',
            )}
          >
            <span className="text-zinc-600 shrink-0">{formatTimestamp(log.timestamp)}</span>
            <LogLevelBadge level={log.level} />
            <span className="text-zinc-400">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Section: Control Strip
// ============================================================================

function ControlStrip({
  status,
  onPause,
  onResume,
  onKill,
  onSendMessage,
  showKillConfirm,
  setShowKillConfirm,
  messageInput,
  setMessageInput,
}: {
  status: SessionStatus;
  onPause: () => void;
  onResume: () => void;
  onKill: () => void;
  onSendMessage: (msg: string) => void;
  showKillConfirm: boolean;
  setShowKillConfirm: (v: boolean) => void;
  messageInput: string;
  setMessageInput: (v: string) => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        {status === 'RUNNING' ? (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </button>
        ) : (
          <button
            onClick={onResume}
            disabled={status === 'ERROR'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors',
              status === 'ERROR'
                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500',
            )}
          >
            <Play className="w-3.5 h-3.5" />
            Resume
          </button>
        )}
        
        <button
          onClick={() => setShowKillConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-medium transition-colors border border-red-600/30"
        >
          <Square className="w-3.5 h-3.5" />
          Kill Session
        </button>
      </div>
      
      {/* Kill Confirmation Modal (inline) */}
      {showKillConfirm && (
        <div className="bg-red-950/30 border border-red-600/40 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Confirm Kill Session?</span>
          </div>
          <p className="text-xs text-zinc-400">
            This will immediately terminate the session. Any in-progress work will be lost.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onKill}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Confirm Kill
            </button>
            <button
              onClick={() => setShowKillConfirm(false)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors border border-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Message Input */}
      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Send message to session..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && messageInput.trim()) {
              onSendMessage(messageInput.trim());
              setMessageInput('');
            }
          }}
        />
        <button
          onClick={() => {
            if (messageInput.trim()) {
              onSendMessage(messageInput.trim());
              setMessageInput('');
            }
          }}
          disabled={!messageInput.trim()}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            messageInput.trim()
              ? 'bg-violet-600 hover:bg-violet-500 text-white'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
          )}
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Tab Content Components
// ============================================================================

function OverviewTab({ session }: { session: SessionData }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <TokenBudgetPanel session={session} />
      <AgentNotesPanel notes={session.agentNotes} />
      <div className="col-span-2">
        <ToolCallWaterfall toolCalls={session.toolCalls} />
      </div>
    </div>
  );
}

function ToolsTab({ session }: { session: SessionData }) {
  return (
    <ToolCallWaterfall toolCalls={session.toolCalls} />
  );
}

function MemoryTab({ session }: { session: SessionData }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <MemoryPanel entries={session.memoryEntries} />
      <AgentNotesPanel notes={session.agentNotes} />
    </div>
  );
}

function RawLogTab({ session }: { session: SessionData }) {
  return (
    <RawLogPanel logs={session.logs} />
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function LiveSessionInspector() {
  const [session] = useState<SessionData>(MOCK_SESSION);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  
  // Control handlers (mock)
  const handlePause = () => {
    console.log('[LiveSessionInspector] Pause clicked');
  };
  
  const handleResume = () => {
    console.log('[LiveSessionInspector] Resume clicked');
  };
  
  const handleKill = () => {
    console.log('[LiveSessionInspector] Kill confirmed');
    setShowKillConfirm(false);
  };
  
  const handleSendMessage = (msg: string) => {
    console.log('[LiveSessionInspector] Send message:', msg);
  };
  
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <SessionHeader session={session} />
        
        {/* Status Bar */}
        <StatusBar status={session.status} />
        
        {/* Tab Navigation */}
        <div className="border-b border-zinc-800">
          <div className="flex gap-1">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
              Overview
            </TabButton>
            <TabButton active={activeTab === 'tools'} onClick={() => setActiveTab('tools')}>
              Tool Calls
            </TabButton>
            <TabButton active={activeTab === 'memory'} onClick={() => setActiveTab('memory')}>
              Memory
            </TabButton>
            <TabButton active={activeTab === 'rawlog'} onClick={() => setActiveTab('rawlog')}>
              Raw Log
            </TabButton>
          </div>
        </div>
        
        {/* Tab Content */}
        <div className="min-h-[500px]">
          {activeTab === 'overview' && <OverviewTab session={session} />}
          {activeTab === 'tools' && <ToolsTab session={session} />}
          {activeTab === 'memory' && <MemoryTab session={session} />}
          {activeTab === 'rawlog' && <RawLogTab session={session} />}
        </div>
        
        {/* Control Strip */}
        <ControlStrip
          status={session.status}
          onPause={handlePause}
          onResume={handleResume}
          onKill={handleKill}
          onSendMessage={handleSendMessage}
          showKillConfirm={showKillConfirm}
          setShowKillConfirm={setShowKillConfirm}
          messageInput={messageInput}
          setMessageInput={setMessageInput}
        />
      </div>
    </div>
  );
}
