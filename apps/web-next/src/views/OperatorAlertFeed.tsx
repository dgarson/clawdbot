import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  Check,
  CheckCircle,
  Clock,
  Bell,
  BellOff,
  Link2,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Radio,
  Layers,
  Users,
  Zap,
  Timer,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type AlertSeverity = 'critical' | 'error' | 'warning' | 'info';
type AlertStatus = 'active' | 'acknowledged' | 'resolved';
type AlertFilter = 'all' | 'critical' | 'error' | 'warning' | 'info' | 'acknowledged' | 'resolved';
type TimeRange = '15m' | '1h' | '6h' | '24h';

interface AlertTag {
  type: 'channel' | 'tool' | 'action';
  value: string;
}

interface AlertEntry {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  status: AlertStatus;
  agentName: string;
  agentEmoji: string;
  message: string;
  detail?: string;
  tags: AlertTag[];
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  parentId?: string;
  childIds?: string[];
}

interface MuteRule {
  id: string;
  agentName?: string;
  pattern: string;
  expiresAt: Date;
}

interface AlertStats {
  total: number;
  critical: number;
  unacked: number;
  avgMtr: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const generateMockAlerts = (): AlertEntry[] => {
  const now = Date.now();
  return [
    {
      id: 'ALT-001',
      timestamp: new Date(now - 120000),
      severity: 'critical',
      status: 'active',
      agentName: 'Reed',
      agentEmoji: '♿',
      message: 'Tool timeout: write() exceeded 30s limit — session stalled',
      detail: 'Process was writing to /Users/openclaw/.openclaw/workspace/piper/memory/session-logs.json. Write operation timed out after 30000ms.',
      tags: [{ type: 'tool', value: 'write' }, { type: 'action', value: 'file-write' }, { type: 'channel', value: 'memory' }],
    },
    {
      id: 'ALT-002',
      timestamp: new Date(now - 180000),
      severity: 'critical',
      status: 'acknowledged',
      agentName: 'Luis',
      agentEmoji: '🎨',
      message: 'Gateway connection lost — 3 sessions affected',
      detail: 'WebSocket connection to gateway timed out. Reconnecting...',
      tags: [{ type: 'tool', value: 'gateway' }, { type: 'channel', value: 'system' }],
      acknowledgedBy: 'Xavier',
      acknowledgedAt: new Date(now - 90000),
    },
    {
      id: 'ALT-003',
      timestamp: new Date(now - 240000),
      severity: 'error',
      status: 'active',
      agentName: 'Quinn',
      agentEmoji: '⚡',
      message: 'Rate limit hit on anthropic/claude-sonnet — retrying in 15s',
      detail: 'Rate limit: 50 requests/minute. Current: 52. Backoff until T+15s.',
      tags: [{ type: 'tool', value: 'api' }, { type: 'action', value: 'model-call' }],
    },
    {
      id: 'ALT-004',
      timestamp: new Date(now - 300000),
      severity: 'error',
      status: 'resolved',
      agentName: 'Xavier',
      agentEmoji: '🏗️',
      message: 'exec() process exited with code 1 — npm run build failed',
      detail: 'Build failed: TypeScript errors in 3 files. Run "npm run build" locally for details.',
      tags: [{ type: 'tool', value: 'exec' }, { type: 'action', value: 'npm-build' }],
      resolvedAt: new Date(now - 180000),
    },
    {
      id: 'ALT-005',
      timestamp: new Date(now - 420000),
      severity: 'warning',
      status: 'active',
      agentName: 'Piper',
      agentEmoji: '👆',
      message: 'Browser snapshot took 8.2s — above 5s threshold',
      detail: 'DOM snapshot for canvas capture exceeded threshold. Consider reducing page complexity.',
      tags: [{ type: 'tool', value: 'browser' }, { type: 'action', value: 'snapshot' }],
    },
    {
      id: 'ALT-006',
      timestamp: new Date(now - 480000),
      severity: 'warning',
      status: 'acknowledged',
      agentName: 'Stephan',
      agentEmoji: '📣',
      message: 'Session context nearing limit (82% used) — compaction recommended',
      tags: [{ type: 'tool', value: 'session' }, { type: 'action', value: 'context' }],
      acknowledgedBy: 'Stephan',
      acknowledgedAt: new Date(now - 400000),
    },
    {
      id: 'ALT-007',
      timestamp: new Date(now - 600000),
      severity: 'warning',
      status: 'resolved',
      agentName: 'System',
      agentEmoji: '🔧',
      message: 'Memory pressure detected — auto-compaction triggered',
      detail: 'Compaction freed 42% of token context across 5 sessions.',
      tags: [{ type: 'channel', value: 'system' }],
      resolvedAt: new Date(now - 540000),
    },
    {
      id: 'ALT-008',
      timestamp: new Date(now - 720000),
      severity: 'info',
      status: 'active',
      agentName: 'Luis',
      agentEmoji: '🎨',
      message: 'Spawned subagent piper/horizon-m1-alert-feed (depth 1)',
      tags: [{ type: 'tool', value: 'sessions_spawn' }, { type: 'channel', value: 'mission-control' }],
    },
    {
      id: 'ALT-009',
      timestamp: new Date(now - 900000),
      severity: 'info',
      status: 'acknowledged',
      agentName: 'Quinn',
      agentEmoji: '⚡',
      message: 'Heartbeat cycle complete — 4 queue items claimed',
      tags: [{ type: 'tool', value: 'heartbeat' }, { type: 'channel', value: 'queue' }],
      acknowledgedBy: 'Quinn',
      acknowledgedAt: new Date(now - 850000),
    },
    {
      id: 'ALT-010',
      timestamp: new Date(now - 1200000),
      severity: 'info',
      status: 'resolved',
      agentName: 'System',
      agentEmoji: '🔧',
      message: 'Gateway restarted — all sessions re-registered (5 active)',
      tags: [{ type: 'channel', value: 'system' }],
      resolvedAt: new Date(now - 1080000),
    },
    {
      id: 'ALT-011',
      timestamp: new Date(now - 60000),
      severity: 'critical',
      status: 'active',
      agentName: 'Xavier',
      agentEmoji: '🏗️',
      message: 'SSH connection refused — host unreachable (192.168.1.50)',
      detail: 'Connection refused after 3 retries. Host may be down or firewall blocking.',
      tags: [{ type: 'tool', value: 'exec' }, { type: 'action', value: 'ssh' }],
    },
    {
      id: 'ALT-012',
      timestamp: new Date(now - 3000000),
      severity: 'info',
      status: 'resolved',
      agentName: 'Piper',
      agentEmoji: '👆',
      message: 'Agent session started — model: claude-sonnet-4-6',
      tags: [{ type: 'tool', value: 'session' }, { type: 'channel', value: 'cli' }],
      resolvedAt: new Date(now - 2800000),
    },
  ];
};

const INITIAL_MUTE_RULES: MuteRule[] = [
  {
    id: 'MR-001',
    agentName: 'Quinn',
    pattern: 'Rate limit*',
    expiresAt: new Date(Date.now() + 3600000),
  },
  {
    id: 'MR-002',
    pattern: 'Heartbeat cycle*',
    expiresAt: new Date(Date.now() + 7200000),
  },
  {
    id: 'MR-003',
    agentName: 'System',
    pattern: 'Memory pressure*',
    expiresAt: new Date(Date.now() + 1800000),
  },
];

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatMuteExpiry(date: Date): string {
  const mins = Math.floor((date.getTime() - Date.now()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ============================================================================
// Sub-components
// ============================================================================

function SeverityIcon({ severity, className }: { severity: AlertSeverity; className?: string }) {
  switch (severity) {
    case 'critical':
      return <XCircle className={cn('w-4 h-4', className)} />;
    case 'error':
      return <AlertCircle className={cn('w-4 h-4', className)} />;
    case 'warning':
      return <AlertTriangle className={cn('w-4 h-4', className)} />;
    case 'info':
      return <Info className={cn('w-4 h-4', className)} />;
  }
}

function SeverityBadge({ severity, count }: { severity: AlertSeverity; count: number }) {
  const styles: Record<AlertSeverity, string> = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    error: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    info: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  };
  const icons: Record<AlertSeverity, React.ReactNode> = {
    critical: <XCircle className="w-3 h-3" />,
    error: <AlertCircle className="w-3 h-3" />,
    warning: <AlertTriangle className="w-3 h-3" />,
    info: <Info className="w-3 h-3" />,
  };
  const labels: Record<AlertSeverity, string> = {
    critical: 'Critical',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
  };
  if (count === 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border', styles[severity])}>
      {icons[severity]}
      {labels[severity]} ({count})
    </span>
  );
}

function TagBadge({ tag }: { tag: AlertTag }) {
  const colors: Record<AlertTag['type'], string> = {
    channel: 'bg-zinc-700/50 text-zinc-300',
    tool: 'bg-amber-500/15 text-amber-400',
    action: 'bg-violet-500/15 text-violet-400',
  };
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono', colors[tag.type])}>
      {tag.value}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-start gap-2.5">
      <div className="mt-0.5 p-1.5 bg-zinc-800 rounded-md">
        <Icon className="w-3.5 h-3.5 text-zinc-400" />
      </div>
      <div>
        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
        {sub && <p className="text-[10px] text-zinc-500">{sub}</p>}
      </div>
    </div>
  );
}

function FilterButton({
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
        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
        active
          ? 'bg-violet-600 text-white'
          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700',
      )}
    >
      {children}
    </button>
  );
}

function TimeRangeButton({
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
        'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
        active
          ? 'bg-zinc-700 text-white'
          : 'text-zinc-500 hover:text-zinc-400',
      )}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Alert Card Component
// ============================================================================

function AlertCard({
  alert,
  onAcknowledge,
  onSnooze,
  onResolve,
}: {
  alert: AlertEntry;
  onAcknowledge: (id: string) => void;
  onSnooze: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const severityStyles: Record<AlertSeverity, string> = {
    critical: 'border-l-red-500 bg-red-950/20',
    error: 'border-l-orange-500 bg-orange-950/10',
    warning: 'border-l-amber-500 bg-amber-950/10',
    info: 'border-l-sky-500/50 bg-sky-950/10',
  };

  const iconColors: Record<AlertSeverity, string> = {
    critical: 'text-red-500',
    error: 'text-orange-400',
    warning: 'text-amber-400',
    info: 'text-sky-400',
  };

  const statusStyles: Record<AlertStatus, string> = {
    active: 'bg-zinc-800 text-zinc-400',
    acknowledged: 'bg-violet-500/15 text-violet-400',
    resolved: 'bg-green-500/15 text-green-400',
  };

  return (
    <div className={cn('border-l-2 rounded-r-lg overflow-hidden', severityStyles[alert.severity])}>
      <div className="bg-zinc-900/80 px-4 py-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <SeverityIcon severity={alert.severity} className={iconColors[alert.severity]} />
            <span className="font-mono text-xs text-zinc-500">{alert.id}</span>
            <span className="text-xs text-zinc-600">·</span>
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(alert.timestamp)}
            </span>
            <span className="text-xs text-zinc-600">·</span>
            <span className="text-sm">{alert.agentEmoji}</span>
            <span className="text-xs text-zinc-400">{alert.agentName}</span>
          </div>
          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', statusStyles[alert.status])}>
            {alert.status.toUpperCase()}
          </span>
        </div>

        {/* Message */}
        <p className="text-sm text-zinc-200 mb-2 leading-relaxed">{alert.message}</p>

        {/* Detail expansion */}
        {alert.detail && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-400 mb-2"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        )}
        {expanded && alert.detail && (
          <pre className="text-xs text-zinc-500 bg-zinc-950 p-2 rounded mb-2 overflow-x-auto">
            {alert.detail}
          </pre>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {alert.tags.map((tag, i) => (
            <TagBadge key={i} tag={tag} />
          ))}
        </div>

        {/* Acknowledged info */}
        {alert.status === 'acknowledged' && alert.acknowledgedBy && (
          <div className="text-xs text-violet-400 mb-3 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Acknowledged by {alert.acknowledgedBy} · {formatRelativeTime(alert.acknowledgedAt!)}
          </div>
        )}

        {/* Resolved info */}
        {alert.status === 'resolved' && alert.resolvedAt && (
          <div className="text-xs text-green-400 mb-3 flex items-center gap-1">
            <Check className="w-3 h-3" />
            Resolved · {formatRelativeTime(alert.resolvedAt)}
          </div>
        )}

        {/* Actions */}
        {alert.status === 'active' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-medium transition-colors"
            >
              <Check className="w-3 h-3" />
              Acknowledge
            </button>
            <button
              onClick={() => onSnooze(alert.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium transition-colors"
            >
              <BellOff className="w-3 h-3" />
              Snooze 15m
            </button>
            <button
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium transition-colors"
            >
              <Link2 className="w-3 h-3" />
              Correlate
            </button>
            <button
              onClick={() => onResolve(alert.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs font-medium transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              Resolve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Mute Rules Drawer
// ============================================================================

function MuteRulesDrawer({
  isOpen,
  onClose,
  rules,
  onRemove,
}: {
  isOpen: boolean;
  onClose: () => void;
  rules: MuteRule[];
  onRemove: (id: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-80 bg-zinc-900 border-l border-zinc-800 rounded-l-xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellOff className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-semibold text-white">Mute Rules</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rules.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">
              <BellOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No active mute rules</p>
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="bg-zinc-800/50 rounded-lg p-3 flex items-start justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  {rule.agentName && (
                    <p className="text-xs text-violet-400 mb-0.5">{rule.agentName}</p>
                  )}
                  <p className="text-xs text-zinc-300 font-mono truncate">{rule.pattern}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                    <Timer className="w-2.5 h-2.5" />
                    Expires in {formatMuteExpiry(rule.expiresAt)}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(rule.id)}
                  className="text-zinc-500 hover:text-red-400 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-zinc-800">
          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add Rule
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function OperatorAlertFeed() {
  const [alerts, setAlerts] = useState<AlertEntry[]>(generateMockAlerts());
  const [muteRules, setMuteRules] = useState<MuteRule[]>(INITIAL_MUTE_RULES);
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [muteDrawerOpen, setMuteDrawerOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly toggle a random alert's timestamp to simulate new alerts
      setAlerts((prev) => {
        const idx = Math.floor(Math.random() * prev.length);
        const updated = [...prev];
        updated[idx] = { ...updated[idx], timestamp: new Date() };
        return updated;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: 'acknowledged' as AlertStatus, acknowledgedBy: 'Operator', acknowledgedAt: new Date() }
          : a,
      ),
    );
  }, []);

  const handleSnooze = useCallback((id: string) => {
    console.log('[AlertFeed] Snoozed:', id);
  }, []);

  const handleResolve = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: 'resolved' as AlertStatus, resolvedAt: new Date() }
          : a,
      ),
    );
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.status === 'active'
          ? { ...a, status: 'acknowledged' as AlertStatus, acknowledgedBy: 'Operator', acknowledgedAt: new Date() }
          : a,
      ),
    );
  }, []);

  const handleRemoveMuteRule = useCallback((id: string) => {
    setMuteRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Filter alerts
  const filteredAlerts = alerts.filter((a) => {
    // Time range filter
    const now = Date.now();
    const ranges: Record<TimeRange, number> = {
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };
    if (now - a.timestamp.getTime() > ranges[timeRange]) return false;

    // Status/severity filter
    if (filter === 'all') return true;
    if (filter === 'acknowledged') return a.status === 'acknowledged';
    if (filter === 'resolved') return a.status === 'resolved';
    return a.severity === filter;
  });

  // Calculate stats
  const stats: AlertStats = {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical' && a.status !== 'resolved').length,
    unacked: alerts.filter((a) => a.status === 'active').length,
    avgMtr: 4,
  };

  const severityCounts = {
    critical: alerts.filter((a) => a.severity === 'critical' && a.status !== 'resolved').length,
    error: alerts.filter((a) => a.severity === 'error' && a.status !== 'resolved').length,
    warning: alerts.filter((a) => a.severity === 'warning' && a.status !== 'resolved').length,
    info: alerts.filter((a) => a.severity === 'info' && a.status !== 'resolved').length,
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-violet-400" />
            Alert Feed
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">Real-time alert management for operators</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <SeverityBadge severity="critical" count={severityCounts.critical} />
            <SeverityBadge severity="error" count={severityCounts.error} />
            <SeverityBadge severity="warning" count={severityCounts.warning} />
            <SeverityBadge severity="info" count={severityCounts.info} />
          </div>
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Mark All Read
          </button>
          <button
            onClick={() => setMuteDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
          >
            <BellOff className="w-3.5 h-3.5" />
            Mute Rules
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Alerts" value={stats.total} icon={Layers} />
        <StatCard label="Critical" value={stats.critical} sub="Needs attention" icon={XCircle} />
        <StatCard label="Unacked" value={stats.unacked} sub="Pending review" icon={Bell} />
        <StatCard label="Avg MTTR" value={`${stats.avgMtr}m`} sub="Mean time to resolve" icon={Timer} />
      </div>

      {/* Filter Strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterButton>
          <FilterButton active={filter === 'critical'} onClick={() => setFilter('critical')}>Critical</FilterButton>
          <FilterButton active={filter === 'error'} onClick={() => setFilter('error')}>Error</FilterButton>
          <FilterButton active={filter === 'warning'} onClick={() => setFilter('warning')}>Warning</FilterButton>
          <FilterButton active={filter === 'info'} onClick={() => setFilter('info')}>Info</FilterButton>
          <div className="w-px h-5 bg-zinc-700 mx-1" />
          <FilterButton active={filter === 'acknowledged'} onClick={() => setFilter('acknowledged')}>Acknowledged</FilterButton>
          <FilterButton active={filter === 'resolved'} onClick={() => setFilter('resolved')}>Resolved</FilterButton>
        </div>
        <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          <TimeRangeButton active={timeRange === '15m'} onClick={() => setTimeRange('15m')}>15m</TimeRangeButton>
          <TimeRangeButton active={timeRange === '1h'} onClick={() => setTimeRange('1h')}>1h</TimeRangeButton>
          <TimeRangeButton active={timeRange === '6h'} onClick={() => setTimeRange('6h')}>6h</TimeRangeButton>
          <TimeRangeButton active={timeRange === '24h'} onClick={() => setTimeRange('24h')}>24h</TimeRangeButton>
        </div>
      </div>

      {/* Alert Feed */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-16 flex flex-col items-center justify-center text-zinc-500">
            <BellOff className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No alerts for this filter</p>
            <p className="text-xs text-zinc-600 mt-1">Try adjusting your filters or time range</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onSnooze={handleSnooze}
              onResolve={handleResolve}
            />
          ))
        )}
      </div>

      {/* Mute Rules Drawer */}
      <MuteRulesDrawer
        isOpen={muteDrawerOpen}
        onClose={() => setMuteDrawerOpen(false)}
        rules={muteRules}
        onRemove={handleRemoveMuteRule}
      />
    </div>
  );
}
