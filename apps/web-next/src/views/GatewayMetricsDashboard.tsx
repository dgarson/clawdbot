import { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bolt,
  CheckCircle,
  Clock,
  Gauge,
  Layers,
  Minus,
  Plug,
  RefreshCcw,
  Server,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type PluginStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'OFFLINE';
type AgentType = 'luis' | 'wes' | 'claire' | 'ava' | 'rush';

interface PluginHealth {
  name: string;
  status: PluginStatus;
  lastHeartbeat: Date;
  errorCount: number;
  latency: number;
  version: string;
}

interface SessionLoad {
  agent: AgentType;
  agentName: string;
  active: number;
  idle: number;
  queued: number;
}

interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  type: 'NETWORK' | 'TIMEOUT' | 'RATE_LIMIT' | 'AUTH' | 'INTERNAL';
  message: string;
  plugin?: string;
  severity: 'warning' | 'error' | 'critical';
}

interface ErrorBudget {
  sloTarget: number;
  currentBurnRate: number;
  budgetRemaining: number;
  period: string;
  requestsTotal: number;
  requestsFailed: number;
}

interface GatewayStats {
  reqPerSec: number;
  errorRate: number;
  p99Latency: number;
  activeSessions: number;
  uptime: string;
  totalRequests: number;
  memoryMB: number;
  cpuPercent: number;
}

// ============================================================================
// Mock Data Generation
// ============================================================================

function generateSparklineData(points: number, base: number, variance: number): number[] {
  const data: number[] = [];
  let current = base;
  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.5) * variance;
    current = Math.max(0, base + change);
    data.push(Math.round(current * 10) / 10);
  }
  return data;
}

const MOCK_PLUGINS: PluginHealth[] = [
  {
    name: 'slack',
    status: 'HEALTHY',
    lastHeartbeat: new Date(Date.now() - 5000),
    errorCount: 0,
    latency: 45,
    version: '2.4.1',
  },
  {
    name: 'discord',
    status: 'HEALTHY',
    lastHeartbeat: new Date(Date.now() - 3000),
    errorCount: 2,
    latency: 62,
    version: '1.8.3',
  },
  {
    name: 'github',
    status: 'DEGRADED',
    lastHeartbeat: new Date(Date.now() - 12000),
    errorCount: 15,
    latency: 285,
    version: '3.1.0',
  },
  {
    name: 'anthropic',
    status: 'HEALTHY',
    lastHeartbeat: new Date(Date.now() - 2000),
    errorCount: 0,
    latency: 156,
    version: '1.2.4',
  },
  {
    name: 'openai',
    status: 'HEALTHY',
    lastHeartbeat: new Date(Date.now() - 4000),
    errorCount: 3,
    latency: 198,
    version: '2.0.1',
  },
  {
    name: 'elevenlabs',
    status: 'DEGRADED',
    lastHeartbeat: new Date(Date.now() - 8000),
    errorCount: 8,
    latency: 420,
    version: '1.5.2',
  },
  {
    name: 'xai',
    status: 'HEALTHY',
    lastHeartbeat: new Date(Date.now() - 1500),
    errorCount: 1,
    latency: 89,
    version: '1.0.0',
  },
  {
    name: 'minimax',
    status: 'OFFLINE',
    lastHeartbeat: new Date(Date.now() - 300000),
    errorCount: 45,
    latency: 0,
    version: '1.1.3',
  },
  {
    name: 'zai',
    status: 'HEALTHY',
    lastHeartbeat: new Date(Date.now() - 6000),
    errorCount: 0,
    latency: 112,
    version: '1.3.0',
  },
  {
    name: 'browser',
    status: 'HEALTHY',
    lastHeartbeat: new Date(Date.now() - 1000),
    errorCount: 4,
    latency: 78,
    version: '4.2.0',
  },
];

const MOCK_SESSION_LOAD: SessionLoad[] = [
  { agent: 'luis', agentName: 'Luis', active: 8, idle: 4, queued: 12 },
  { agent: 'wes', agentName: 'Wes', active: 5, idle: 2, queued: 3 },
  { agent: 'claire', agentName: 'Claire', active: 3, idle: 6, queued: 1 },
  { agent: 'ava', agentName: 'Ava', active: 6, idle: 1, queued: 8 },
  { agent: 'rush', agentName: 'Rush', active: 2, idle: 3, queued: 0 },
];

const MOCK_ERROR_LOG: ErrorLogEntry[] = [
  {
    id: 'err-001',
    timestamp: new Date(Date.now() - 120000),
    type: 'RATE_LIMIT',
    message: 'GitHub API rate limit exceeded, backing off for 60s',
    plugin: 'github',
    severity: 'warning',
  },
  {
    id: 'err-002',
    timestamp: new Date(Date.now() - 300000),
    type: 'TIMEOUT',
    message: 'ElevenLabs TTS request timed out after 30s',
    plugin: 'elevenlabs',
    severity: 'error',
  },
  {
    id: 'err-003',
    timestamp: new Date(Date.now() - 450000),
    type: 'NETWORK',
    message: 'Failed to connect to MiniMax API endpoint',
    plugin: 'minimax',
    severity: 'critical',
  },
  {
    id: 'err-004',
    timestamp: new Date(Date.now() - 600000),
    type: 'AUTH',
    message: 'Expired OAuth token for Slack workspace refresh',
    plugin: 'slack',
    severity: 'warning',
  },
  {
    id: 'err-005',
    timestamp: new Date(Date.now() - 720000),
    type: 'INTERNAL',
    message: 'Session state corruption detected, restarting session',
    severity: 'error',
  },
  {
    id: 'err-006',
    timestamp: new Date(Date.now() - 900000),
    type: 'RATE_LIMIT',
    message: 'OpenAI API quota at 95%, throttling requests',
    plugin: 'openai',
    severity: 'warning',
  },
  {
    id: 'err-007',
    timestamp: new Date(Date.now() - 1200000),
    type: 'TIMEOUT',
    message: 'Anthropic Claude response timeout on long context',
    plugin: 'anthropic',
    severity: 'warning',
  },
  {
    id: 'err-008',
    timestamp: new Date(Date.now() - 1500000),
    type: 'NETWORK',
    message: 'WebSocket connection dropped, reconnecting...',
    plugin: 'discord',
    severity: 'warning',
  },
  {
    id: 'err-009',
    timestamp: new Date(Date.now() - 1800000),
    type: 'INTERNAL',
    message: 'Memory pressure detected, triggering GC',
    severity: 'warning',
  },
  {
    id: 'err-010',
    timestamp: new Date(Date.now() - 2100000),
    type: 'AUTH',
    message: 'Browser session cookie expired, re-authenticating',
    plugin: 'browser',
    severity: 'warning',
  },
];

const MOCK_ERROR_BUDGET: ErrorBudget = {
  sloTarget: 99.9,
  currentBurnRate: 0.12,
  budgetRemaining: 87.5,
  period: '30d',
  requestsTotal: 1250000,
  requestsFailed: 1250,
};

const MOCK_GATEWAY_STATS: GatewayStats = {
  reqPerSec: 24.7,
  errorRate: 0.08,
  p99Latency: 342,
  activeSessions: 24,
  uptime: '14d 6h 42m',
  totalRequests: 8924567,
  memoryMB: 2048,
  cpuPercent: 38.5,
};

// Generate 60-point sparkline for request rate
const SPARKLINE_DATA = generateSparklineData(60, 25, 15);

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) {return 'just now';}
  if (minutes < 60) {return `${minutes}m ago`;}
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {return `${hours}h ago`;}
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatHeartbeat(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 10) {return `${seconds}s`;}
  if (seconds < 60) {return `${seconds}s`;}
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {return `${minutes}m`;}
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function getPluginStatusColor(status: PluginStatus): string {
  switch (status) {
    case 'HEALTHY': return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    case 'DEGRADED': return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    case 'UNHEALTHY': return 'text-orange-400 bg-orange-500/15 border-orange-500/30';
    case 'OFFLINE': return 'text-red-400 bg-red-500/15 border-red-500/30';
  }
}

function getPluginStatusDot(status: PluginStatus): string {
  switch (status) {
    case 'HEALTHY': return 'bg-emerald-500';
    case 'DEGRADED': return 'bg-amber-500 animate-pulse';
    case 'UNHEALTHY': return 'bg-orange-500 animate-pulse';
    case 'OFFLINE': return 'bg-red-500';
  }
}

function getErrorTypeColor(type: ErrorLogEntry['type']): string {
  switch (type) {
    case 'NETWORK': return 'text-sky-400 bg-sky-500/15';
    case 'TIMEOUT': return 'text-amber-400 bg-amber-500/15';
    case 'RATE_LIMIT': return 'text-violet-400 bg-violet-500/15';
    case 'AUTH': return 'text-rose-400 bg-rose-500/15';
    case 'INTERNAL': return 'text-zinc-400 bg-zinc-500/15';
  }
}

function getSeverityIcon(severity: ErrorLogEntry['severity']): React.ReactNode {
  switch (severity) {
    case 'warning': return <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5 text-amber-400" />;
    case 'error': return <AlertCircle aria-hidden="true" className="w-3.5 h-3.5 text-orange-400" />;
    case 'critical': return <XCircle aria-hidden="true" className="w-3.5 h-3.5 text-red-400" />;
  }
}

function getAgentColor(agent: AgentType): string {
  switch (agent) {
    case 'luis': return 'from-violet-500 to-violet-600';
    case 'wes': return 'from-emerald-500 to-emerald-600';
    case 'claire': return 'from-rose-500 to-rose-600';
    case 'ava': return 'from-sky-500 to-sky-600';
    case 'rush': return 'from-amber-500 to-amber-600';
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  trendValue,
  accentColor = 'violet',
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  accentColor?: 'violet' | 'emerald' | 'amber' | 'sky' | 'rose';
}) {
  const colorMap = {
    violet: 'text-violet-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    sky: 'text-sky-400',
    rose: 'text-rose-400',
  };

  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-zinc-400',
  };

  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-zinc-800 rounded-lg">
            <Icon aria-hidden="true" className={cn('w-4 h-4', colorMap[accentColor])} />
          </div>
          <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">{label}</span>
        </div>
        {trend && (
          <div className={cn('flex items-center gap-1 text-xs', trendColors[trend])}>
            <TrendIcon aria-hidden="true" className="w-3 h-3" />
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        {unit && <span className="text-sm text-zinc-500">{unit}</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PluginStatus }) {
  const color = getPluginStatusColor(status);
  const dotColor = getPluginStatusDot(status);

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border', color)}>
      <span aria-hidden="true" className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
      {status}
    </span>
  );
}

function RequestRateSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 48;
  const width = 100;
  const _barWidth = (width / data.length) * 0.7;
  const _gap = (width / data.length) * 0.3;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4" aria-live="polite">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity aria-hidden="true" className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Request Rate</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-zinc-400">Current:</span>
            <span className="text-white font-medium">{data[data.length - 1]?.toFixed(1)}</span>
            <span className="text-zinc-500">req/s</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-zinc-400">Avg:</span>
            <span className="text-white font-medium">
              {(data.reduce((a, b) => a + b, 0) / data.length).toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-zinc-400">Peak:</span>
            <span className="text-emerald-400 font-medium">{max.toFixed(1)}</span>
          </div>
        </div>
      </div>
      <div className="relative h-12 flex items-end gap-px overflow-hidden">
        {data.map((value, i) => {
          const normalizedHeight = ((value - min) / range) * height;
          const isRecent = i >= data.length - 5;
          return (
            <div
              key={i}
              className={cn(
                'flex-1 rounded-t transition-all duration-300',
                isRecent ? 'bg-violet-500' : 'bg-violet-500/40'
              )}
              style={{ height: `${Math.max(normalizedHeight, 2)}px` }}
              title={`${value.toFixed(1)} req/s`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>60s ago</span>
        <span>Now</span>
      </div>
    </div>
  );
}

function PluginHealthTable({ plugins }: { plugins: PluginHealth[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug aria-hidden="true" className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Plugin Health</span>
        </div>
        <span className="text-xs text-zinc-500">
          {plugins.filter(p => p.status === 'HEALTHY').length}/{plugins.length} healthy
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide border-b border-zinc-800">
              <th className="py-2 px-4">Plugin</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Heartbeat</th>
              <th className="py-2 px-4">Latency</th>
              <th className="py-2 px-4">Errors</th>
              <th className="py-2 px-4">Version</th>
            </tr>
          </thead>
          <tbody>
            {plugins.map((plugin) => (
              <tr
                key={plugin.name}
                className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="py-3 px-4">
                  <span className="text-sm font-medium text-white">{plugin.name}</span>
                </td>
                <td className="py-3 px-4">
                  <StatusBadge status={plugin.status} />
                </td>
                <td className="py-3 px-4">
                  <span className={cn(
                    'text-sm',
                    plugin.status === 'OFFLINE' ? 'text-red-400' : 'text-zinc-300'
                  )}>
                    {formatHeartbeat(plugin.lastHeartbeat)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={cn(
                    'text-sm',
                    plugin.latency > 300 ? 'text-amber-400' : 
                    plugin.latency > 200 ? 'text-yellow-400' : 'text-zinc-300'
                  )}>
                    {plugin.latency > 0 ? `${plugin.latency}ms` : '—'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={cn(
                    'text-sm font-medium',
                    plugin.errorCount > 10 ? 'text-red-400' :
                    plugin.errorCount > 5 ? 'text-amber-400' :
                    plugin.errorCount > 0 ? 'text-yellow-400' : 'text-zinc-500'
                  )}>
                    {plugin.errorCount}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs text-zinc-500 font-mono">{plugin.version}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionLoadPanel({ sessions }: { sessions: SessionLoad[] }) {
  const totalActive = sessions.reduce((sum, s) => sum + s.active, 0);
  const totalIdle = sessions.reduce((sum, s) => sum + s.idle, 0);
  const totalQueued = sessions.reduce((sum, s) => sum + s.queued, 0);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers aria-hidden="true" className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-white">Session Load by Agent</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">Active:</span>
            <span className="text-white font-medium">{totalActive}</span>
          </div>
          <div className="flex items-center gap-1">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-zinc-500" />
            <span className="text-zinc-400">Idle:</span>
            <span className="text-white font-medium">{totalIdle}</span>
          </div>
          <div className="flex items-center gap-1">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-zinc-400">Queued:</span>
            <span className="text-white font-medium">{totalQueued}</span>
          </div>
        </div>
      </div>
      <div className="p-4 grid grid-cols-5 gap-3">
        {sessions.map((session) => {
          const total = session.active + session.idle + session.queued;
          const activePct = (session.active / total) * 100;
          const idlePct = (session.idle / total) * 100;
          const queuedPct = (session.queued / total) * 100;

          return (
            <div key={session.agent} className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-bold text-white',
                  getAgentColor(session.agent)
                )}>
                  {session.agentName[0]}
                </div>
                <span className="text-sm font-medium text-white">{session.agentName}</span>
              </div>
              
              <div className="h-2 rounded-full bg-zinc-700 overflow-hidden flex">
                <div 
                  className="bg-emerald-500 transition-all" 
                  style={{ width: `${activePct}%` }}
                />
                <div 
                  className="bg-zinc-500 transition-all" 
                  style={{ width: `${idlePct}%` }}
                />
                <div 
                  className="bg-amber-500 transition-all" 
                  style={{ width: `${queuedPct}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-1 text-center text-xs">
                <div>
                  <div className="text-emerald-400 font-medium">{session.active}</div>
                  <div className="text-zinc-500">active</div>
                </div>
                <div>
                  <div className="text-zinc-400 font-medium">{session.idle}</div>
                  <div className="text-zinc-500">idle</div>
                </div>
                <div>
                  <div className="text-amber-400 font-medium">{session.queued}</div>
                  <div className="text-zinc-500">queued</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ErrorBudgetTracker({ budget }: { budget: ErrorBudget }) {
  const _budgetUsed = 100 - budget.budgetRemaining;
  const isHealthy = budget.budgetRemaining > 50;
  const isWarning = budget.budgetRemaining > 20 && budget.budgetRemaining <= 50;
  const _isCritical = budget.budgetRemaining <= 20;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert aria-hidden="true" className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Error Budget</span>
          <span className="text-xs text-zinc-500">SLO: {budget.sloTarget}%</span>
        </div>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          isHealthy ? 'bg-emerald-500/15 text-emerald-400' :
          isWarning ? 'bg-amber-500/15 text-amber-400' :
          'bg-red-500/15 text-red-400'
        )}>
          {budget.period} window
        </span>
      </div>

      <div className="space-y-4">
        {/* Budget remaining bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-400">Budget Remaining</span>
            <span className={cn(
              'font-medium',
              isHealthy ? 'text-emerald-400' :
              isWarning ? 'text-amber-400' :
              'text-red-400'
            )}>
              {budget.budgetRemaining.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
            <div 
              className={cn(
                'h-full rounded-full transition-all',
                isHealthy ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                isWarning ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                'bg-gradient-to-r from-red-500 to-red-400'
              )}
              style={{ width: `${budget.budgetRemaining}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-white">
              {budget.currentBurnRate.toFixed(2)}
            </div>
            <div className="text-xs text-zinc-400">Burn Rate</div>
            <div className="text-xs text-zinc-500">per hour</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-white">
              {budget.requestsTotal.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-400">Total Requests</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className={cn(
              'text-lg font-bold',
              budget.requestsFailed > 1000 ? 'text-amber-400' : 'text-white'
            )}>
              {budget.requestsFailed.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-400">Failed</div>
            <div className="text-xs text-zinc-500">
              {((budget.requestsFailed / budget.requestsTotal) * 100).toFixed(3)}%
            </div>
          </div>
        </div>

        {/* Budget burn visualization */}
        <div className="pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Budget Status</span>
            <span className={cn(
              'flex items-center gap-1 font-medium',
              isHealthy ? 'text-emerald-400' :
              isWarning ? 'text-amber-400' :
              'text-red-400'
            )}>
              {isHealthy ? (
                <>
                  <CheckCircle aria-hidden="true" className="w-3 h-3" />
                  Healthy
                </>
              ) : isWarning ? (
                <>
                  <AlertTriangle aria-hidden="true" className="w-3 h-3" />
                  Warning
                </>
              ) : (
                <>
                  <AlertCircle aria-hidden="true" className="w-3 h-3" />
                  Critical
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorLogPanel({ errors }: { errors: ErrorLogEntry[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle aria-hidden="true" className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-white">Recent Errors</span>
        </div>
        <span className="text-xs text-zinc-500">Last 10 entries</span>
      </div>
      <div className="divide-y divide-zinc-800/50">
        {errors.map((error) => (
          <div 
            key={error.id} 
            className="px-4 py-3 hover:bg-zinc-800/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              {getSeverityIcon(error.severity)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded font-medium',
                    getErrorTypeColor(error.type)
                  )}>
                    {error.type}
                  </span>
                  {error.plugin && (
                    <span className="text-xs text-zinc-500">via {error.plugin}</span>
                  )}
                </div>
                <p className="text-sm text-zinc-300 truncate">{error.message}</p>
              </div>
              <span className="text-xs text-zinc-500 whitespace-nowrap">
                {formatTimestamp(error.timestamp)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GatewayInfoPanel({ stats }: { stats: GatewayStats }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4" aria-live="polite">
      <div className="flex items-center gap-2 mb-4">
        <Server aria-hidden="true" className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-semibold text-white">Gateway Info</span>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Uptime</span>
          <span className="text-sm text-white font-medium">{stats.uptime}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Total Requests</span>
          <span className="text-sm text-white font-medium">{stats.totalRequests.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Memory</span>
          <span className="text-sm text-white font-medium">{stats.memoryMB} MB</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">CPU</span>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className={cn(
                  'h-full rounded-full',
                  stats.cpuPercent > 80 ? 'bg-red-500' :
                  stats.cpuPercent > 60 ? 'bg-amber-500' :
                  'bg-emerald-500'
                )}
                style={{ width: `${stats.cpuPercent}%` }}
              />
            </div>
            <span className="text-sm text-white font-medium">{stats.cpuPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function GatewayMetricsDashboard() {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [sparklineData, setSparklineData] = useState(SPARKLINE_DATA);
  const [stats, setStats] = useState(MOCK_GATEWAY_STATS);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
      
      // Update sparkline data
      setSparklineData(prev => {
        const newData = prev.slice(1);
        const lastValue = prev[prev.length - 1] || 25;
        const change = (Math.random() - 0.5) * 8;
        newData.push(Math.max(5, Math.min(50, lastValue + change)));
        return newData;
      });

      // Update stats with slight fluctuations
      setStats(prev => ({
        ...prev,
        reqPerSec: Math.max(15, Math.min(35, prev.reqPerSec + (Math.random() - 0.5) * 2)),
        errorRate: Math.max(0, Math.min(0.5, prev.errorRate + (Math.random() - 0.5) * 0.05)),
        p99Latency: Math.max(200, Math.min(500, prev.p99Latency + (Math.random() - 0.5) * 30)),
        cpuPercent: Math.max(20, Math.min(80, prev.cpuPercent + (Math.random() - 0.5) * 5)),
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const formatLastUpdated = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  return (
    <>
      <a href="#gmd-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:rounded-md">Skip to main content</a>
      <main id="gmd-main" className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/15 rounded-lg">
            <Gauge aria-hidden="true" className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Mission Control</h1>
            <p className="text-sm text-zinc-400">Gateway health and throughput monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-zinc-400" aria-live="polite">
            <Clock aria-hidden="true" className="w-4 h-4" />
            <span>Last updated: {formatLastUpdated(lastUpdated)}</span>
          </div>
          <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
            <RefreshCcw aria-hidden="true" className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4" role="status" aria-label="Live gateway statistics">
        <StatCard
          label="Requests/sec"
          value={stats.reqPerSec.toFixed(1)}
          icon={Bolt}
          trend="up"
          trendValue="+2.3%"
          accentColor="violet"
        />
        <StatCard
          label="Error Rate"
          value={stats.errorRate.toFixed(2)}
          unit="%"
          icon={AlertTriangle}
          trend="down"
          trendValue="-0.01%"
          accentColor="emerald"
        />
        <StatCard
          label="P99 Latency"
          value={stats.p99Latency}
          unit="ms"
          icon={Clock}
          trend="neutral"
          trendValue="stable"
          accentColor="amber"
        />
        <StatCard
          label="Active Sessions"
          value={stats.activeSessions}
          icon={Layers}
          trend="up"
          trendValue="+3"
          accentColor="sky"
        />
      </div>

      {/* Request Rate Sparkline */}
      <RequestRateSparkline data={sparklineData} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Plugin Health Table - spans 2 columns */}
        <div className="col-span-2">
          <PluginHealthTable plugins={MOCK_PLUGINS} />
        </div>
        
        {/* Right column */}
        <div className="space-y-6">
          <GatewayInfoPanel stats={stats} />
          <ErrorBudgetTracker budget={MOCK_ERROR_BUDGET} />
        </div>
      </div>

      {/* Session Load Panel */}
      <SessionLoadPanel sessions={MOCK_SESSION_LOAD} />

      {/* Error Log */}
      <ErrorLogPanel errors={MOCK_ERROR_LOG} />

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-zinc-600 pt-4 border-t border-zinc-800/50">
        <Activity aria-hidden="true" className="w-3 h-3" />
        <span>Gateway Metrics Dashboard</span>
        <span>•</span>
        <span>Real-time monitoring</span>
        <span>•</span>
        <span>Auto-refresh: 2s</span>
      </div>
      </main>
    </>
  );
}
