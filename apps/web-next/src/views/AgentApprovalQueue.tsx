import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Layers,
  Settings,
  ToggleLeft,
  ToggleRight,
  Users,
  X,
  XCircle,
  AlertTriangle,
  GitBranch,
  Terminal,
  FileText,
  MessageSquare,
  Globe,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';
import { Skeleton } from '../components/ui/Skeleton';

// ============================================================================
// Types
// ============================================================================

type SessionType = 'main' | 'subagent' | 'cron';
type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'escalated' | 'timed_out';

interface ApprovalItem {
  id: string;
  agentName: string;
  agentEmoji: string;
  sessionType: SessionType;
  actionDescription: string;
  riskLevel: RiskLevel;
  toolName: string;
  parameters: Record<string, unknown>;
  parametersPreview: string;
  reason: string;
  waitingSeconds: number;
  status: ApprovalStatus;
  decidedAt?: Date;
  decidedBy?: string;
  outcome?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_APPROVALS: ApprovalItem[] = [
  {
    id: 'ap1',
    agentName: 'Luis',
    agentEmoji: '🎨',
    sessionType: 'main',
    actionDescription: 'Spawn subagent for UI redesign task',
    riskLevel: 'Medium',
    toolName: 'sessions_spawn',
    parameters: {
      task: 'Redesign onboarding flow',
      label: 'ui-redesign',
      model: 'claude-3-5-sonnet-20241022',
      thinking: 'medium',
      timeoutSeconds: 3600,
    },
    parametersPreview: '{task: "Redesign onboarding flow", label: "ui-redesign", model: "claude-3-5-sonnet-20241022", ...}',
    reason: 'Requires spawning a new session which may consume additional resources',
    waitingSeconds: 45,
    status: 'pending',
  },
  {
    id: 'ap2',
    agentName: 'Quinn',
    agentEmoji: '⚡',
    sessionType: 'subagent',
    actionDescription: 'Execute git commit and push to remote',
    riskLevel: 'High',
    toolName: 'exec',
    parameters: {
      command: 'git commit -m "Update dashboard" && git push origin main',
    },
    parametersPreview: '{command: "git commit -m \\"Update dashboard\\" && git push origin main"}',
    reason: 'Direct repository modifications with push to main branch',
    waitingSeconds: 130,
    status: 'pending',
  },
  {
    id: 'ap3',
    agentName: 'Xavier',
    agentEmoji: '🏗️',
    sessionType: 'cron',
    actionDescription: 'Write configuration to production.env',
    riskLevel: 'Critical',
    toolName: 'write',
    parameters: {
      path: '/etc/clawdbot/production.env',
      content: '# Updated config\nAPI_KEY=sk-12345\nDEBUG=true',
    },
    parametersPreview: '{path: "/etc/clawdbot/production.env", content: "# Updated config\\nAPI_KEY=sk-12345\\nDEBUG=true"}',
    reason: 'Modifying production configuration files',
    waitingSeconds: 200,
    status: 'pending',
  },
  {
    id: 'ap4',
    agentName: 'Reed',
    agentEmoji: '♿',
    sessionType: 'main',
    actionDescription: 'Send message to #deployments channel',
    riskLevel: 'Low',
    toolName: 'message',
    parameters: {
      action: 'send',
      channel: 'slack',
      target: '#deployments',
      message: 'Deployment successful v1.2.3',
    },
    parametersPreview: '{action: "send", channel: "slack", target: "#deployments", message: "Deployment successful v1.2.3"}',
    reason: 'Posting update to team channel',
    waitingSeconds: 30,
    status: 'pending',
  },
  {
    id: 'ap5',
    agentName: 'Piper',
    agentEmoji: '📊',
    sessionType: 'subagent',
    actionDescription: 'Browse external analytics dashboard',
    riskLevel: 'Medium',
    toolName: 'browser',
    parameters: {
      action: 'navigate',
      targetUrl: 'https://analytics.example.com/dashboard',
    },
    parametersPreview: '{action: "navigate", targetUrl: "https://analytics.example.com/dashboard"}',
    reason: 'Accessing external website with potential login',
    waitingSeconds: 95,
    status: 'pending',
  },
  {
    id: 'ap6',
    agentName: 'Stephan',
    agentEmoji: '📣',
    sessionType: 'cron',
    actionDescription: 'Read logs from /var/log/system.log',
    riskLevel: 'Low',
    toolName: 'read',
    parameters: {
      path: '/var/log/system.log',
      limit: 100,
    },
    parametersPreview: '{path: "/var/log/system.log", limit: 100}',
    reason: 'Accessing system logs for monitoring',
    waitingSeconds: 160,
    status: 'pending',
  },
  // History items
  {
    id: 'ap7',
    agentName: 'Luis',
    agentEmoji: '🎨',
    sessionType: 'main',
    actionDescription: 'Spawn subagent for documentation update',
    riskLevel: 'Low',
    toolName: 'sessions_spawn',
    parameters: { task: 'Update README' },
    parametersPreview: '{task: "Update README"}',
    reason: 'Routine documentation task',
    waitingSeconds: 45,
    status: 'approved',
    decidedAt: new Date(Date.now() - 3600000),
    decidedBy: 'David',
    outcome: 'Subagent spawned successfully',
  },
  {
    id: 'ap8',
    agentName: 'Quinn',
    agentEmoji: '⚡',
    sessionType: 'subagent',
    actionDescription: 'Execute npm install',
    riskLevel: 'Medium',
    toolName: 'exec',
    parameters: { command: 'npm install' },
    parametersPreview: '{command: "npm install"}',
    reason: 'Installing dependencies',
    waitingSeconds: 120,
    status: 'denied',
    decidedAt: new Date(Date.now() - 7200000),
    decidedBy: 'System',
    outcome: 'Denied: Potential security risk',
  },
  {
    id: 'ap9',
    agentName: 'Xavier',
    agentEmoji: '🏗️',
    sessionType: 'main',
    actionDescription: 'Write to config.json',
    riskLevel: 'High',
    toolName: 'write',
    parameters: { path: 'config.json', content: '{}' },
    parametersPreview: '{path: "config.json", content: "{}"}',
    reason: 'Modifying config',
    waitingSeconds: 180,
    status: 'escalated',
    decidedAt: new Date(Date.now() - 10800000),
    decidedBy: 'David',
    outcome: 'Escalated to admin review',
  },
  {
    id: 'ap10',
    agentName: 'Reed',
    agentEmoji: '♿',
    sessionType: 'subagent',
    actionDescription: 'Read accessibility report',
    riskLevel: 'Low',
    toolName: 'read',
    parameters: { path: 'a11y-report.txt' },
    parametersPreview: '{path: "a11y-report.txt"}',
    reason: 'Reading report file',
    waitingSeconds: 300,
    status: 'timed_out',
    decidedAt: new Date(Date.now() - 14400000),
    decidedBy: 'System',
    outcome: 'Auto-denied after timeout',
  },
];

// ============================================================================
// Helpers
// ============================================================================

function formatWaiting(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function isTimedOut(seconds: number): boolean {
  return seconds > 120;
}

// ============================================================================
// Sub-components
// ============================================================================

function SessionTypeBadge({ type }: { type: SessionType }) {
  const styles: Record<SessionType, string> = {
    main: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    subagent: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    cron: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  };
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium border', styles[type])}>
      {type}
    </span>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    Low: 'bg-green-500/15 text-green-400 border-green-500/30',
    Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    High: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    Critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium border', styles[level])}>
      {level}
    </span>
  );
}

function ToolBadge({ toolName }: { toolName: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono bg-surface-2 text-fg-primary">
      <Terminal aria-hidden="true" className="w-3 h-3" />
      {toolName}
    </span>
  );
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const styles: Record<ApprovalStatus, string> = {
    pending: 'bg-amber-500/15 text-amber-400',
    approved: 'bg-green-500/15 text-green-400',
    denied: 'bg-red-500/15 text-red-400',
    escalated: 'bg-violet-500/15 text-violet-400',
    timed_out: 'bg-surface-3/15 text-fg-secondary',
  };
  const icons: Record<ApprovalStatus, React.ElementType> = {
    pending: Clock,
    approved: CheckCircle,
    denied: XCircle,
    escalated: AlertTriangle,
    timed_out: AlertCircle,
  };
  const Icon = icons[status];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium', styles[status])}>
      <Icon aria-hidden="true" className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
    </span>
  );
}

function ApprovalCard({
  item,
  isSelected,
  onSelect,
  onExpand,
  isExpanded,
  onApprove,
  onDeny,
  onEscalate,
}: {
  item: ApprovalItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onExpand: (id: string) => void;
  isExpanded: boolean;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onEscalate: (id: string) => void;
}) {
  const timedOut = isTimedOut(item.waitingSeconds);
  const cardId = `approval-card-${item.id}`;
  return (
    <div
      id={cardId}
      className={cn(
        'bg-surface-1 border border-tok-border rounded-xl p-4 transition-all',
        timedOut && 'border-red-500/50 motion-safe:animate-pulse',
        isSelected && 'ring-2 ring-violet-500 ring-offset-2 ring-offset-surface-0',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(item.id)}
            aria-label={`Select ${item.agentName} — ${item.actionDescription}`}
            className="mt-1 w-4 h-4 rounded bg-surface-2 border-tok-border text-violet-500 focus:ring-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span aria-hidden="true" className="text-lg">{item.agentEmoji}</span>
              <span className="font-medium text-fg-primary">{item.agentName}</span>
              <SessionTypeBadge type={item.sessionType} />
              <RiskBadge level={item.riskLevel} />
            </div>
            <p className="text-sm text-fg-primary mb-2">{item.actionDescription}</p>
            <div className="space-y-2 text-xs text-fg-secondary">
              <div className="flex items-center gap-2">
                <ToolBadge toolName={item.toolName} />
                <span className="flex items-center gap-1">
                  <Clock aria-hidden="true" className="w-3 h-3" />
                  <span aria-live="polite">{formatWaiting(item.waitingSeconds)}</span>
                </span>
                {timedOut && (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertCircle aria-hidden="true" className="w-3 h-3" />
                    Timeout warning
                  </span>
                )}
              </div>
              <p>Context: {item.parametersPreview}</p>
              <p>Reason: {item.reason}</p>
            </div>
            {isExpanded && (
              <div
                id={`params-${item.id}`}
                className="mt-3 p-3 bg-surface-2 rounded-lg text-xs font-mono text-fg-primary"
              >
                <pre>{JSON.stringify(item.parameters, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => onExpand(item.id)}
            aria-expanded={isExpanded}
            aria-controls={`params-${item.id}`}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} parameters for ${item.agentName} — ${item.actionDescription}`}
            className="p-1 hover:bg-surface-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {isExpanded
              ? <ChevronUp aria-hidden="true" className="w-4 h-4 text-fg-secondary" />
              : <ChevronDown aria-hidden="true" className="w-4 h-4 text-fg-secondary" />
            }
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(item.id)}
              aria-label={`Approve: ${item.agentName} — ${item.actionDescription}`}
              className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Check aria-hidden="true" className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDeny(item.id)}
              aria-label={`Deny: ${item.agentName} — ${item.actionDescription}`}
              className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <X aria-hidden="true" className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEscalate(item.id)}
              aria-label={`Escalate: ${item.agentName} — ${item.actionDescription}`}
              className="p-2 bg-violet-500/20 text-violet-400 rounded-lg hover:bg-violet-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <ExternalLink aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ items }: { items: ApprovalItem[] }) {
  return (
    <section aria-label="Recent decisions" className="bg-surface-1 border border-tok-border rounded-xl flex flex-col h-full">
      <div className="px-4 py-3 border-b border-tok-border flex items-center gap-2">
        <RotateCcw aria-hidden="true" className="w-4 h-4 text-fg-secondary" />
        <span className="text-sm font-semibold text-fg-primary">Recent Decisions</span>
        <span role="status" className="ml-auto text-xs text-fg-muted">{items.length} entries</span>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-tok-border/60" aria-live="polite">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-fg-muted">
            <RotateCcw aria-hidden="true" className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No recent decisions</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="px-4 py-3 flex items-start gap-3">
              <StatusBadge status={item.status} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-fg-primary">{item.agentName}</span>
                  <RiskBadge level={item.riskLevel} />
                </div>
                <p className="text-xs text-fg-secondary">{item.actionDescription}</p>
                <div className="mt-1 text-xs text-fg-muted">
                  {item.decidedBy && `By ${item.decidedBy} · `}
                  {item.decidedAt && formatTimestamp(item.decidedAt)}
                  {item.outcome && ` · ${item.outcome}`}
                </div>
              </div>
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

function AgentApprovalQueueSkeleton() {
  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton variant="text" className="w-36 h-4" />
          <Skeleton variant="circle" className="w-9 h-9" />
        </div>
      </div>
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
          {[36, 64, 68, 48, 72, 76].map((w, i) => (
            <Skeleton key={i} className="h-8 rounded-md" style={{ width: w }} />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue cards */}
        <div className="col-span-2 space-y-4">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-surface-1 border border-tok-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Skeleton variant="circle" className="w-4 h-4 mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Skeleton variant="circle" className="w-6 h-6" />
                      <Skeleton variant="text" className="w-16 h-4" />
                      <Skeleton className="h-4 w-14" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton variant="text" className="w-64 h-4 mb-2" />
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton variant="text" className="w-10 h-3" />
                      </div>
                      <Skeleton variant="text" className="w-80 h-3" />
                      <Skeleton variant="text" className="w-64 h-3" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Skeleton variant="circle" className="w-6 h-6" />
                  <div className="flex gap-2">
                    <Skeleton variant="circle" className="w-8 h-8" />
                    <Skeleton variant="circle" className="w-8 h-8" />
                    <Skeleton variant="circle" className="w-8 h-8" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* History panel */}
        <div className="col-span-1">
          <div className="bg-surface-1 border border-tok-border rounded-xl flex flex-col h-full">
            <div className="px-4 py-3 border-b border-tok-border flex items-center gap-2">
              <Skeleton variant="circle" className="w-4 h-4" />
              <Skeleton variant="text" className="w-32 h-4" />
              <div className="ml-auto"><Skeleton variant="text" className="w-16 h-3" /></div>
            </div>
            <div className="flex-1 divide-y divide-tok-border/60">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <Skeleton className="h-5 w-20" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Skeleton variant="text" className="w-20 h-4" />
                      <Skeleton className="h-4 w-14" />
                    </div>
                    <Skeleton variant="text" className="w-40 h-3 mb-1" />
                    <Skeleton variant="text" className="w-32 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentApprovalQueue({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <AgentApprovalQueueSkeleton />;

  const [approvals, setApprovals] = useState<ApprovalItem[]>(MOCK_APPROVALS);
  const [filter, setFilter] = useState<string>('All');
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [tick, setTick] = useState(0);

  // Simulate time passing
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setApprovals((prev) =>
        prev.map((a) =>
          a.status === 'pending'
            ? { ...a, waitingSeconds: a.waitingSeconds + 1 }
            : a
        )
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-approve low-risk if toggle enabled
  useEffect(() => {
    if (autoApprove) {
      setApprovals((prev) =>
        prev.map((a) =>
          a.status === 'pending' && a.riskLevel === 'Low'
            ? { ...a, status: 'approved', decidedAt: new Date(), decidedBy: 'Auto', outcome: 'Auto-approved' }
            : a
        )
      );
    }
  }, [autoApprove, tick]);

  const filters = ['All', 'Pending', 'Approved', 'Denied', 'Escalated', 'Timed Out'];

  const filteredApprovals = approvals.filter((a) => {
    if (filter === 'All') return a.status === 'pending';
    return a.status === filter.toLowerCase().replace(' ', '_') && a.status === 'pending';
  });

  const historyItems = approvals.filter((a) => a.status !== 'pending').slice(0, 10);

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  const isAllSelected = selected.length === filteredApprovals.length && filteredApprovals.length > 0;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelected([]);
    } else {
      setSelected(filteredApprovals.map((a) => a.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleApprove = useCallback((id: string) => {
    setApprovals((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: 'approved', decidedAt: new Date(), decidedBy: 'You', outcome: 'Approved successfully' }
          : a
      )
    );
    setSelected((prev) => prev.filter((s) => s !== id));
  }, []);

  const handleDeny = useCallback((id: string) => {
    setApprovals((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: 'denied', decidedAt: new Date(), decidedBy: 'You', outcome: 'Denied by operator' }
          : a
      )
    );
    setSelected((prev) => prev.filter((s) => s !== id));
  }, []);

  const handleEscalate = useCallback((id: string) => {
    setApprovals((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: 'escalated', decidedAt: new Date(), decidedBy: 'You', outcome: 'Escalated to review' }
          : a
      )
    );
    setSelected((prev) => prev.filter((s) => s !== id));
  }, []);

  const bulkApproveLowRisk = () => {
    setApprovals((prev) =>
      prev.map((a) =>
        selected.includes(a.id) && a.riskLevel === 'Low' && a.status === 'pending'
          ? { ...a, status: 'approved', decidedAt: new Date(), decidedBy: 'Bulk', outcome: 'Bulk approved' }
          : a
      )
    );
    setSelected([]);
  };

  const bulkDeny = () => {
    setApprovals((prev) =>
      prev.map((a) =>
        selected.includes(a.id) && a.status === 'pending'
          ? { ...a, status: 'denied', decidedAt: new Date(), decidedBy: 'Bulk', outcome: 'Bulk denied' }
          : a
      )
    );
    setSelected([]);
  };

  return (
    <>
      {/* WCAG 2.1 AA — Skip navigation */}
      <a
        href="#aaq-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-[var(--color-text-primary)] focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <main id="aaq-main" className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-fg-primary">Agent Approval Queue</h1>
            {pendingCount > 0 && (
              <span
                role="status"
                aria-live="polite"
                className="px-2 py-1 rounded-full bg-violet-600 text-fg-primary text-sm font-bold leading-none"
              >
                {pendingCount} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span id="auto-approve-label" className="text-sm text-fg-secondary">
                Auto-approve low-risk
              </span>
              <button
                onClick={() => setAutoApprove(!autoApprove)}
                aria-pressed={autoApprove}
                aria-labelledby="auto-approve-label"
                aria-label={`Auto-approve low-risk: ${autoApprove ? 'on' : 'off'}`}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
              >
                {autoApprove ? (
                  <ToggleRight aria-hidden="true" className="w-6 h-6 text-green-500" />
                ) : (
                  <ToggleLeft aria-hidden="true" className="w-6 h-6 text-fg-muted" />
                )}
              </button>
            </div>
            <button
              aria-label="Queue settings"
              className="p-2 hover:bg-surface-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Settings aria-hidden="true" className="w-5 h-5 text-fg-secondary" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between">
          <div
            role="group"
            aria-label="Filter approvals by status"
            className="flex gap-1 bg-surface-2 rounded-lg p-0.5"
          >
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                  filter === f ? 'bg-surface-3 text-fg-primary' : 'text-fg-secondary hover:text-fg-primary',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleSelectAll}
              aria-pressed={isAllSelected}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-fg-primary text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <input
                type="checkbox"
                checked={isAllSelected}
                readOnly
                aria-hidden="true"
                tabIndex={-1}
                className="pointer-events-none"
              />
              Select All
            </button>
            <button
              onClick={bulkApproveLowRisk}
              disabled={selected.length === 0}
              aria-label="Bulk approve selected low-risk items"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Check aria-hidden="true" className="w-4 h-4" />
              Approve Low-Risk
            </button>
            <button
              onClick={bulkDeny}
              disabled={selected.length === 0}
              aria-label="Deny all selected items"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Trash2 aria-hidden="true" className="w-4 h-4" />
              Deny Selected
            </button>
          </div>
        </div>

        {/* Main Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section
            aria-label="Pending approvals"
            aria-live="polite"
            className="col-span-2 space-y-4"
          >
            {filteredApprovals.length === 0 ? (
              <ContextualEmptyState
                icon={CheckCircle}
                title={`No ${filter.toLowerCase()} approvals`}
                description="The queue is clear for now. New approval requests will appear here."
                size="md"
              />
            ) : (
              filteredApprovals.map((item) => (
                <ApprovalCard
                  key={item.id}
                  item={item}
                  isSelected={selected.includes(item.id)}
                  onSelect={toggleSelect}
                  isExpanded={expanded.includes(item.id)}
                  onExpand={toggleExpand}
                  onApprove={handleApprove}
                  onDeny={handleDeny}
                  onEscalate={handleEscalate}
                />
              ))
            )}
          </section>

          {/* History Panel */}
          <div className="col-span-1">
            <HistoryPanel items={historyItems} />
          </div>
        </div>
      </main>
    </>
  );
}
