import { useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import { formatRelativeTime } from '../mock-data';
import { useGateway } from '../hooks/useGateway';
import { MOCK_AGENTS, MOCK_SESSIONS } from '../mock-data';
import type { AgentHealth, AgentStatus } from '../types';
import { SlideOverPanel } from '../components/ui/horizon/SlideOverPanel';
import { SurfaceSection } from '../components/ui/horizon/SurfaceSection';
import { ViewDensityToggle } from '../components/ui/horizon/ViewDensityToggle';
import { WorkflowModal } from '../components/ui/horizon/WorkflowModal';

type StatusBadgeVariant = 'active' | 'idle' | 'offline' | 'error' | 'healthy' | 'degraded' | 'connected';
type DashboardSection = 'overview' | 'agents' | 'activity';
type FocusMode = 'operator' | 'manager' | 'builder';
type DetailPanel = 'agents' | 'health' | 'sessions' | 'cost' | 'gateway' | null;
type ModalKind = 'new-agent' | 'new-chat' | 'new-schedule' | 'export';
type PriorityLane = 'now' | 'next' | 'later';
type ViewDensity = 'comfortable' | 'compact';

interface ActivityItem {
  id: string;
  type: 'agent_response' | 'cron_run' | 'session_start' | 'user_message' | 'error' | 'tool_call' | 'handoff' | 'completion' | 'decision';
  title: string;
  description: string;
  timestamp: string;
  agentEmoji?: string;
  lane: PriorityLane;
  /** Which agent "owns" this item — used in Manager lens for grouping by delegation */
  owner?: string;
  /** Whether the user can act on this item — used in Builder lens */
  actionable?: boolean;
}

function tokenColorClass(total: number): string {
  if (total === 0) return 'text-red-400';
  if (total >= 160000) return 'text-red-400';
  if (total >= 100000) return 'text-orange-400';
  if (total >= 50000) return 'text-amber-400';
  if (total >= 10000) return 'text-blue-400';
  return 'text-green-400';
}

function costColorClass(cost: number): string {
  if (cost > 5) return 'text-red-400';
  if (cost > 2) return 'text-orange-400';
  if (cost > 1) return 'text-amber-400';
  if (cost > 0.5) return 'text-blue-400';
  if (cost > 0.2) return 'text-[var(--color-text-primary)]';
  return 'text-green-400';
}

function StatusBadge({ variant, pulse }: { variant: StatusBadgeVariant; pulse?: boolean }) {
  const colors: Record<StatusBadgeVariant, string> = {
    active: 'bg-green-500',
    idle: 'bg-amber-500',
    offline: 'bg-[var(--color-surface-3)]',
    error: 'bg-red-500',
    healthy: 'bg-green-500',
    degraded: 'bg-amber-500',
    connected: 'bg-green-500',
  };

  const labels: Record<StatusBadgeVariant, string> = {
    active: 'Active',
    idle: 'Idle',
    offline: 'Offline',
    error: 'Error',
    healthy: 'Healthy',
    degraded: 'Degraded',
    connected: 'Connected',
  };

  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={cn('size-2 rounded-full', colors[variant], pulse && 'animate-pulse')} />
      <span className="text-muted-foreground">{labels[variant]}</span>
    </span>
  );
}

function ActivityRow({ item, density }: { item: ActivityItem; density: ViewDensity }) {
  const icons: Record<ActivityItem['type'], string> = {
    agent_response: '💬',
    cron_run: '⏰',
    session_start: '🚀',
    user_message: '👤',
    error: '⚠️',
    tool_call: '🔧',
    handoff: '🤝',
    completion: '✅',
    decision: '🎯',
  };

  const isCompact = density === 'compact';

  return (
    <div className={cn('flex', isCompact ? 'gap-2 py-1.5' : 'gap-3 py-3')}>
      <span className={isCompact ? 'text-sm' : 'text-base'} aria-hidden="true">{icons[item.type]}</span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-foreground', isCompact ? 'text-[11px]' : 'text-sm')}>
          {item.agentEmoji && <span className="mr-1">{item.agentEmoji}</span>}
          {item.title}
        </p>
        {!isCompact && (
          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
        )}
      </div>
      <span className={cn('whitespace-nowrap text-muted-foreground', isCompact ? 'text-[11px]' : 'text-xs')}>{formatRelativeTime(item.timestamp)}</span>
    </div>
  );
}

function DetailCard({
  title,
  value,
  subtitle,
  icon,
  onOpen,
  density,
  valueClassName,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  onOpen: () => void;
  density: ViewDensity;
  valueClassName?: string;
}) {
  const isCompact = density === 'compact';

  return (
    <button
      className={cn(
        'w-full border border-border bg-card text-left transition-colors hover:border-primary/50 hover:bg-secondary/30',
        isCompact ? 'rounded-lg p-2' : 'rounded-xl p-4'
      )}
      onClick={onOpen}
    >
      <div className={cn('flex items-center justify-between', isCompact ? 'gap-2' : 'gap-3')}>
        <div>
          <p className={cn('select-none uppercase tracking-wide text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>{title}</p>
          <p className={cn('select-none font-semibold', valueClassName || 'text-foreground', isCompact ? 'text-lg' : 'mt-1 text-2xl')}>{value}</p>
          {!isCompact && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {!isCompact && (
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-xl" aria-hidden="true">{icon}</span>
        )}
      </div>
      {!isCompact && <p className="mt-3 text-xs text-primary">View details &rarr;</p>}
    </button>
  );
}

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground" aria-label="Close dialog">
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function AgentDashboard() {
  const { connectionState, isConnected } = useGateway();
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [focusMode, setFocusMode] = useState<FocusMode>('operator');
  const [viewDensity, setViewDensity] = useState<ViewDensity>('comfortable');
  const [showComparisons, setShowComparisons] = useState(true);
  const [panel, setPanel] = useState<DetailPanel>(null);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [agentWizardStep, setAgentWizardStep] = useState(1);
  const [scheduleWizardStep, setScheduleWizardStep] = useState(1);
  const [openLane, setOpenLane] = useState<PriorityLane>('now');

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const activeAgents = MOCK_AGENTS.filter((a) => a.status === 'active').length;
  const totalAgents = MOCK_AGENTS.length;
  const sessionsToday = MOCK_SESSIONS.length;
  const dailyCost = MOCK_SESSIONS.reduce((acc, s) => acc + (s.cost || 0), 0);

  const allActivity: ActivityItem[] = useMemo(() => [
    { id: '1', type: 'agent_response', title: 'Luis completed UI pass', description: 'Updated dashboard interaction flow and mobile spacing.', timestamp: new Date(Date.now() - 120000).toISOString(), agentEmoji: '🎨', lane: 'now', owner: 'Luis', actionable: true },
    { id: '2', type: 'cron_run', title: 'Hourly UX check ran', description: 'No regressions detected in latest branch checks.', timestamp: new Date(Date.now() - 1800000).toISOString(), lane: 'next', owner: 'System' },
    { id: '3', type: 'session_start', title: 'Architecture review session started', description: 'Xavier opened model orchestration thread.', timestamp: new Date(Date.now() - 3600000).toISOString(), agentEmoji: '🧠', lane: 'now', owner: 'Xavier', actionable: true },
    { id: '4', type: 'user_message', title: 'You asked for dashboard drill-downs', description: 'Requested guided workflows and focused detail panels.', timestamp: new Date(Date.now() - 5400000).toISOString(), lane: 'later', owner: 'You' },
    { id: '5', type: 'tool_call', title: 'Xavier ran exec: pnpm test', description: 'Test suite execution completed with 42/42 passing.', timestamp: new Date(Date.now() - 600000).toISOString(), agentEmoji: '🧠', lane: 'now', owner: 'Xavier' },
    { id: '6', type: 'error', title: 'Tim health check failed', description: 'Agent unreachable — last heartbeat 24h ago.', timestamp: new Date(Date.now() - 900000).toISOString(), agentEmoji: '🏗️', lane: 'now', owner: 'Tim' },
    { id: '7', type: 'handoff', title: 'Luis handed off component to Harry', description: 'Modal component delegated for performance pass.', timestamp: new Date(Date.now() - 2400000).toISOString(), agentEmoji: '🎨', lane: 'next', owner: 'Luis' },
    { id: '8', type: 'completion', title: 'Harry finished daily standup report', description: 'Summary posted to #engineering channel.', timestamp: new Date(Date.now() - 4200000).toISOString(), agentEmoji: '⚡', lane: 'next', owner: 'Harry', actionable: true },
    { id: '9', type: 'decision', title: 'Xavier chose Opus for architecture review', description: 'Model selection based on task complexity threshold.', timestamp: new Date(Date.now() - 7200000).toISOString(), agentEmoji: '🧠', lane: 'later', owner: 'Xavier' },
    { id: '10', type: 'tool_call', title: 'Harry ran write: src/components/Modal.tsx', description: 'File updated with 47 lines changed.', timestamp: new Date(Date.now() - 1500000).toISOString(), agentEmoji: '⚡', lane: 'now', owner: 'Harry', actionable: true },
  ], []);

  // Operator: system events, tool calls, errors — no user messages, no later lane
  // Manager: decisions, completions, handoffs — no tool calls, no user messages
  // Builder: everything, but only actionable items in priority queue
  const filteredActivity = allActivity.filter((item) => {
    if (focusMode === 'operator') {
      if (item.lane === 'later') return false;
      if (item.type === 'user_message') return false;
      return true;
    }
    if (focusMode === 'manager') {
      if (item.type === 'user_message') return false;
      if (item.type === 'tool_call') return false;
      return true;
    }
    // Builder: show everything
    return true;
  });

  const laneCounts = {
    now: filteredActivity.filter((item) => item.lane === 'now').length,
    next: filteredActivity.filter((item) => item.lane === 'next').length,
    later: filteredActivity.filter((item) => item.lane === 'later').length,
  };

  // -- Operator lens: system health metrics --
  const errorCount = allActivity.filter((a) => a.type === 'error').length;
  const toolCallCount = allActivity.filter((a) => a.type === 'tool_call').length;
  const totalTokensBurned = MOCK_SESSIONS.reduce((acc, s) => acc + (s.tokenUsage?.total || 0), 0);

  // -- Manager lens: agents grouped by health --
  const healthyAgents = MOCK_AGENTS.filter((a) => a.health === 'healthy');
  const warningAgents = MOCK_AGENTS.filter((a) => a.health === 'degraded');
  const errorAgents = MOCK_AGENTS.filter((a) => a.health === 'unhealthy');

  // -- Builder lens: only running agents, code stats --
  const runningAgents = MOCK_AGENTS.filter((a) => a.status === 'active');
  // Builder queue: only actionable items
  const builderQueue = filteredActivity.filter((item) => item.actionable);

  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'idle': return 'text-amber-400';
      case 'offline': return 'text-[var(--color-text-secondary)]';
      case 'error': return 'text-red-400';
      default: return 'text-[var(--color-text-secondary)]';
    }
  };

  const getHealthColor = (health: AgentHealth) => {
    switch (health) {
      case 'healthy': return 'text-green-400';
      case 'degraded': return 'text-amber-400';
      case 'unhealthy': return 'text-red-400';
      default: return 'text-[var(--color-text-secondary)]';
    }
  };

  const sectionButton = (id: DashboardSection, label: string) => (
    <button
      key={id}
      onClick={() => setActiveSection(id)}
      className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors', activeSection === id ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border bg-secondary/20 text-muted-foreground hover:text-foreground')}
    >
      {label}
    </button>
  );

  const showOverview = activeSection === 'overview';
  const showAgents = activeSection === 'agents' || activeSection === 'overview';
  const showActivity = activeSection === 'activity' || activeSection === 'overview';

  const isCompact = viewDensity === 'compact';

  return (
    <div className={isCompact ? 'space-y-3' : 'space-y-5'}>
      <header className={cn('border border-border bg-card', isCompact ? 'rounded-lg p-3' : 'rounded-xl p-4 sm:p-5')}>
        <div className={cn('flex sm:flex-row sm:items-center sm:justify-between', isCompact ? 'flex-row items-center gap-2' : 'flex-col gap-3')}>
          <div>
            <h1 className={cn('font-semibold text-foreground', isCompact ? 'text-base' : 'text-xl sm:text-2xl')}>{greeting} {isCompact ? '' : '👋'}</h1>
            {!isCompact && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{dateStr}</p>}
          </div>
          <div className={cn('flex items-center gap-2 rounded-lg border border-border bg-secondary/20', isCompact ? 'px-2 py-1' : 'px-3 py-2')}>
            <span className={cn('text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>Gateway</span>
            <StatusBadge variant={isConnected ? 'connected' : 'offline'} pulse={!isConnected} />
          </div>
        </div>
      </header>

      <SurfaceSection
        title="Operator controls"
        subtitle={
          focusMode === 'operator' ? 'Operator lens: system events, tool calls, errors, and real-time health' :
          focusMode === 'manager' ? 'Manager lens: health grouping, cost tracking, delegation, and decisions' :
          'Builder lens: active agents only, actionable queue, and code activity'
        }
        action={<div className="flex flex-wrap gap-2">{sectionButton('overview', 'Overview')}{sectionButton('agents', 'Agents')}{sectionButton('activity', 'Activity')}</div>}
      >
        <div className={cn('flex flex-wrap items-center', isCompact ? 'gap-1.5' : 'gap-2')}>
          {(['operator', 'manager', 'builder'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFocusMode(mode)}
              className={cn('rounded-lg border font-medium capitalize', isCompact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-xs', focusMode === mode ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border bg-secondary/20 text-muted-foreground')}
            >
              {mode} lens
            </button>
          ))}
          <ViewDensityToggle value={viewDensity} onChange={setViewDensity} />
          <button className={cn('rounded-lg border border-border bg-secondary/20 text-muted-foreground', isCompact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-xs')} onClick={() => setShowComparisons((v) => !v)}>
            {showComparisons ? 'Hide trends' : 'Show trends'}
          </button>
          <button className={cn('ml-auto rounded-lg bg-primary font-medium text-primary-foreground', isCompact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-xs')} onClick={() => { setAgentWizardStep(1); setModal('new-agent'); }}>
            New Agent
          </button>
          <button className={cn('rounded-lg border border-border bg-secondary/30 text-foreground', isCompact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-xs')} onClick={() => setModal('new-chat')}>New Chat</button>
          {!isCompact && (
            <>
              <button className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground" onClick={() => { setScheduleWizardStep(1); setModal('new-schedule'); }}>New Schedule</button>
              <button className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground" onClick={() => setModal('export')}>Export</button>
            </>
          )}
        </div>
      </SurfaceSection>

      {showOverview && (
        <section className={cn('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4', isCompact ? 'gap-2' : 'gap-3')}>
          <DetailCard title="Active Agents" value={`${activeAgents}/${totalAgents}`} subtitle={showComparisons ? '↑ 2 vs yesterday' : 'Drill into workload and ownership'} icon="🤖" onOpen={() => setPanel('agents')} density={viewDensity} />
          <DetailCard title="System Health" value={isConnected ? 'Healthy' : 'Degraded'} subtitle={showComparisons ? 'Stable for 7 days' : 'Inspect gateway uptime, latency, and alerts'} icon="✅" onOpen={() => setPanel('health')} density={viewDensity} />
          <DetailCard title="Sessions Today" value={String(sessionsToday)} subtitle={showComparisons ? '↑ 14% from prior window' : 'Review active and recent conversations'} icon="💬" onOpen={() => setPanel('sessions')} density={viewDensity} />
          {/* Hide cost card in Builder lens */}
          {focusMode !== 'builder' && (
            <DetailCard title="Daily Cost" value={`$${dailyCost.toFixed(2)}`} subtitle={showComparisons ? '↓ 6% with same output' : 'See spend breakdown and anomaly risk'} icon="💰" onOpen={() => setPanel('cost')} density={viewDensity} valueClassName={costColorClass(dailyCost)} />
          )}
          {/* Builder lens: code-related stats instead of cost */}
          {focusMode === 'builder' && (
            <DetailCard title="Code Activity" value={`${toolCallCount} ops`} subtitle="Tool calls, file writes, test runs" icon="🔧" onOpen={() => setPanel('sessions')} density={viewDensity} />
          )}
        </section>
      )}

      {/* Operator lens: system health banner with live metrics */}
      {showOverview && focusMode === 'operator' && (
        <div className={cn('grid grid-cols-2 gap-2 rounded-lg border border-border bg-card sm:grid-cols-4', isCompact ? 'p-2' : 'p-3')}>
          <div className="text-center">
            <p className={cn('select-none font-mono font-bold text-green-400', isCompact ? 'text-lg' : 'text-2xl')}>{activeAgents}</p>
            <p className={cn('select-none text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>Active sessions</p>
          </div>
          <div className="text-center">
            <p className={cn('select-none font-mono font-bold', errorCount > 0 ? 'text-red-400' : 'text-green-400', isCompact ? 'text-lg' : 'text-2xl')}>{errorCount}</p>
            <p className={cn('select-none text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>Errors</p>
          </div>
          <div className="text-center">
            <p className={cn('select-none font-mono font-bold', tokenColorClass(totalTokensBurned), isCompact ? 'text-lg' : 'text-2xl')}>{(totalTokensBurned / 1000).toFixed(0)}k</p>
            <p className={cn('select-none text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>Tokens burned</p>
          </div>
          <div className="text-center">
            <p className={cn('select-none font-mono font-bold text-foreground', isCompact ? 'text-lg' : 'text-2xl')}>12ms</p>
            <p className={cn('select-none text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>Gateway latency</p>
          </div>
        </div>
      )}

      {/* Manager lens: cost and budget banner */}
      {showOverview && focusMode === 'manager' && (
        <div className={cn('rounded-lg border border-amber-500/30 bg-amber-500/5', isCompact ? 'p-2' : 'p-3')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={cn('font-medium text-foreground', isCompact ? 'text-xs' : 'text-sm')}>Cost &amp; Budget</p>
              {!isCompact && <p className="text-xs text-muted-foreground">Daily spend tracking against budget thresholds</p>}
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <p className={cn('select-none font-mono font-bold', costColorClass(dailyCost), isCompact ? 'text-sm' : 'text-lg')}>${dailyCost.toFixed(2)}</p>
                <p className={cn('select-none text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>Today</p>
              </div>
              <div className="text-right">
                <p className={cn('select-none font-mono font-bold', costColorClass(47.82), isCompact ? 'text-sm' : 'text-lg')}>$47.82</p>
                <p className={cn('select-none text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>This month</p>
              </div>
              <div className="text-right">
                <p className={cn('select-none font-mono font-bold text-green-400', isCompact ? 'text-sm' : 'text-lg')}>62%</p>
                <p className={cn('select-none text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>Budget remaining</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Builder lens: code activity stats */}
      {showOverview && focusMode === 'builder' && (
        <div className={cn('grid grid-cols-2 gap-2 rounded-lg border border-border bg-card sm:grid-cols-4', isCompact ? 'p-2' : 'p-3')}>
          <div className="text-center">
            <p className={cn('select-none font-mono font-bold text-foreground', isCompact ? 'text-lg' : 'text-2xl')}>47</p>
            <p className={cn('select-none text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>Files changed</p>
          </div>
          <div className="text-center">
            <p className={cn('select-none font-mono font-bold text-green-400', isCompact ? 'text-lg' : 'text-2xl')}>42/42</p>
            <p className={cn('select-none text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>Tests passing</p>
          </div>
          <div className="text-center">
            <p className={cn('select-none font-mono font-bold text-foreground', isCompact ? 'text-lg' : 'text-2xl')}>{toolCallCount}</p>
            <p className={cn('select-none text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>Tool calls</p>
          </div>
          <div className="text-center">
            <p className={cn('select-none font-mono font-bold text-foreground', isCompact ? 'text-lg' : 'text-2xl')}>{runningAgents.length}</p>
            <p className={cn('select-none text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>Active agents</p>
          </div>
        </div>
      )}

      {showOverview && !isCompact && (
        <SurfaceSection title="Why this matters" subtitle="Contextual insight strip to turn metrics into action">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm text-foreground">
              {focusMode === 'operator' && 'Active agents are high with low error rate, suggesting stable operations. Monitor token burn rate.'}
              {focusMode === 'manager' && 'Cost trend is down 6% while output remains stable. Handoff volume is normal — no delegation bottlenecks.'}
              {focusMode === 'builder' && 'All 42 tests passing. 47 files changed today across active agents. No blocked work items.'}
            </div>
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm text-foreground">
              {focusMode === 'operator' && 'Session volume is rising; prioritize queue triage in the Action Inbox to avoid hidden bottlenecks.'}
              {focusMode === 'manager' && 'Tim is degraded — consider redistributing architecture tasks to Xavier or scheduling maintenance.'}
              {focusMode === 'builder' && 'Luis and Harry are both active. Check the priority queue for items you can act on directly.'}
            </div>
          </div>
        </SurfaceSection>
      )}

      {/* Compare modes section: only visible in Manager lens */}
      {focusMode === 'manager' && (
        <SurfaceSection title="Compare operating modes" subtitle="Side-by-side snapshot to decide which lens fits current work">
          <div className={cn('grid lg:grid-cols-3', isCompact ? 'gap-2' : 'gap-3')}>
            <div className={cn('rounded-lg border border-border bg-secondary/20', isCompact ? 'p-2' : 'p-3')}>
              <p className={cn('font-medium text-foreground', isCompact ? 'text-xs' : 'text-sm')}>Operator lens</p>
              {!isCompact && <p className="mt-1 text-xs text-muted-foreground">Focuses on execution: tool calls, errors, system events. Hides user messages and deferred items.</p>}
              <p className={cn('text-foreground', isCompact ? 'mt-1 text-[11px]' : 'mt-2 text-xs')}>
                {allActivity.filter((item) => item.lane !== 'later' && item.type !== 'user_message').length} items visible
              </p>
            </div>
            <div className={cn('rounded-lg border border-primary/30 bg-primary/5', isCompact ? 'p-2' : 'p-3')}>
              <p className={cn('font-medium text-primary', isCompact ? 'text-xs' : 'text-sm')}>Manager lens (active)</p>
              {!isCompact && <p className="mt-1 text-xs text-muted-foreground">Prioritizes health, cost, and delegation. Shows decisions, completions, and handoffs only.</p>}
              <p className={cn('text-foreground', isCompact ? 'mt-1 text-[11px]' : 'mt-2 text-xs')}>
                {allActivity.filter((item) => item.type !== 'user_message' && item.type !== 'tool_call').length} items visible
              </p>
            </div>
            <div className={cn('rounded-lg border border-border bg-secondary/20', isCompact ? 'p-2' : 'p-3')}>
              <p className={cn('font-medium text-foreground', isCompact ? 'text-xs' : 'text-sm')}>Builder lens</p>
              {!isCompact && <p className="mt-1 text-xs text-muted-foreground">Shows everything for active agents. Queue is filtered to actionable items only.</p>}
              <p className={cn('text-foreground', isCompact ? 'mt-1 text-[11px]' : 'mt-2 text-xs')}>
                {allActivity.length} items visible ({allActivity.filter((item) => item.actionable).length} actionable)
              </p>
            </div>
          </div>
        </SurfaceSection>
      )}

      <div className={cn('grid grid-cols-1 xl:grid-cols-3', isCompact ? 'gap-2' : 'gap-4')}>
        {showAgents && (
          <SurfaceSection
            title="Agents"
            subtitle={
              focusMode === 'operator' ? 'All agents with status indicators' :
              focusMode === 'manager' ? 'Grouped by health — healthy, warning, error' :
              'Active agents only — focused on running work'
            }
            className="xl:col-span-2"
            action={<button className={cn('text-primary', isCompact ? 'text-[11px]' : 'text-xs')} onClick={() => setPanel('agents')}>Open full detail</button>}
          >
            {/* Operator lens: show all agents, status prominent */}
            {focusMode === 'operator' && (
              <div className={cn('grid grid-cols-1 sm:grid-cols-2', isCompact ? 'gap-2' : 'gap-3')}>
                {MOCK_AGENTS.map((agent) => (
                  <button key={agent.id} className={cn('border border-border bg-secondary/10 text-left hover:border-primary/40', isCompact ? 'rounded-lg p-2' : 'rounded-lg p-3')} onClick={() => setPanel('agents')}>
                    <div className={cn('flex items-start', isCompact ? 'gap-2' : 'gap-3')}>
                      {!isCompact && <span className="text-2xl" aria-hidden="true">{agent.emoji}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn('truncate font-medium text-foreground', isCompact ? 'text-[11px]' : 'text-sm')}>
                            {isCompact && <span className="mr-1">{agent.emoji}</span>}
                            {agent.name}
                          </p>
                          <span className={cn(isCompact ? 'text-[10px]' : 'text-[11px]', getStatusColor(agent.status))}>● {agent.status}</span>
                        </div>
                        {!isCompact && (
                          <>
                            <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{agent.model}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Manager lens: agents grouped by health */}
            {focusMode === 'manager' && (
              <div className={isCompact ? 'space-y-2' : 'space-y-4'}>
                {healthyAgents.length > 0 && (
                  <div>
                    <p className={cn('mb-1.5 font-medium text-green-400', isCompact ? 'text-[11px]' : 'text-xs')}>Healthy ({healthyAgents.length})</p>
                    <div className={cn('grid grid-cols-1 sm:grid-cols-2', isCompact ? 'gap-1.5' : 'gap-2')}>
                      {healthyAgents.map((agent) => (
                        <button key={agent.id} className={cn('border border-green-500/20 bg-green-500/5 text-left hover:border-green-500/40', isCompact ? 'rounded-lg p-1.5' : 'rounded-lg p-3')} onClick={() => setPanel('agents')}>
                          <div className={cn('flex items-center', isCompact ? 'gap-1.5' : 'gap-2')}>
                            {!isCompact && <span className="text-lg">{agent.emoji}</span>}
                            <div className="min-w-0 flex-1">
                              <p className={cn('truncate font-medium text-foreground', isCompact ? 'text-[11px]' : 'text-sm')}>
                                {isCompact && <span className="mr-1">{agent.emoji}</span>}
                                {agent.name}
                              </p>
                              {!isCompact && <p className="text-xs text-muted-foreground">{agent.role} &middot; {agent.model}</p>}
                            </div>
                            <span className={cn('text-green-400', isCompact ? 'text-[10px]' : 'text-[11px]')}>● healthy</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {warningAgents.length > 0 && (
                  <div>
                    <p className={cn('mb-1.5 font-medium text-amber-400', isCompact ? 'text-[11px]' : 'text-xs')}>Warning ({warningAgents.length})</p>
                    <div className={cn('grid grid-cols-1 sm:grid-cols-2', isCompact ? 'gap-1.5' : 'gap-2')}>
                      {warningAgents.map((agent) => (
                        <button key={agent.id} className={cn('border border-amber-500/20 bg-amber-500/5 text-left hover:border-amber-500/40', isCompact ? 'rounded-lg p-1.5' : 'rounded-lg p-3')} onClick={() => setPanel('agents')}>
                          <div className={cn('flex items-center', isCompact ? 'gap-1.5' : 'gap-2')}>
                            {!isCompact && <span className="text-lg">{agent.emoji}</span>}
                            <div className="min-w-0 flex-1">
                              <p className={cn('truncate font-medium text-foreground', isCompact ? 'text-[11px]' : 'text-sm')}>
                                {isCompact && <span className="mr-1">{agent.emoji}</span>}
                                {agent.name}
                              </p>
                              {!isCompact && <p className="text-xs text-muted-foreground">{agent.role} &middot; last active {formatRelativeTime(agent.lastActive)}</p>}
                            </div>
                            <span className={cn('text-amber-400', isCompact ? 'text-[10px]' : 'text-[11px]')}>● degraded</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {errorAgents.length > 0 && (
                  <div>
                    <p className={cn('mb-1.5 font-medium text-red-400', isCompact ? 'text-[11px]' : 'text-xs')}>Error ({errorAgents.length})</p>
                    <div className={cn('grid grid-cols-1 sm:grid-cols-2', isCompact ? 'gap-1.5' : 'gap-2')}>
                      {errorAgents.map((agent) => (
                        <button key={agent.id} className={cn('border border-red-500/20 bg-red-500/5 text-left hover:border-red-500/40', isCompact ? 'rounded-lg p-1.5' : 'rounded-lg p-3')} onClick={() => setPanel('agents')}>
                          <div className={cn('flex items-center', isCompact ? 'gap-1.5' : 'gap-2')}>
                            {!isCompact && <span className="text-lg">{agent.emoji}</span>}
                            <div className="min-w-0 flex-1">
                              <p className={cn('truncate font-medium text-foreground', isCompact ? 'text-[11px]' : 'text-sm')}>
                                {isCompact && <span className="mr-1">{agent.emoji}</span>}
                                {agent.name}
                              </p>
                              {!isCompact && <p className="text-xs text-muted-foreground">{agent.role} &middot; last active {formatRelativeTime(agent.lastActive)}</p>}
                            </div>
                            <span className={cn('text-red-400', isCompact ? 'text-[10px]' : 'text-[11px]')}>● unhealthy</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Builder lens: only running (active) agents */}
            {focusMode === 'builder' && (
              <div className={cn('grid grid-cols-1 sm:grid-cols-2', isCompact ? 'gap-2' : 'gap-3')}>
                {runningAgents.length === 0 && (
                  <p className="col-span-full text-center text-sm text-muted-foreground">No agents currently running</p>
                )}
                {runningAgents.map((agent) => (
                  <button key={agent.id} className={cn('border border-border bg-secondary/10 text-left hover:border-primary/40', isCompact ? 'rounded-lg p-2' : 'rounded-lg p-3')} onClick={() => setPanel('agents')}>
                    <div className={cn('flex items-start', isCompact ? 'gap-2' : 'gap-3')}>
                      {!isCompact && <span className="text-2xl" aria-hidden="true">{agent.emoji}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn('truncate font-medium text-foreground', isCompact ? 'text-[11px]' : 'text-sm')}>
                            {isCompact && <span className="mr-1">{agent.emoji}</span>}
                            {agent.name}
                          </p>
                          <span className={cn('text-green-400', isCompact ? 'text-[10px]' : 'text-[11px]')}>● running</span>
                        </div>
                        {!isCompact && (
                          <>
                            <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{agent.model}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Active {formatRelativeTime(agent.lastActive)}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SurfaceSection>
        )}

        {showActivity && (
          <SurfaceSection
            title={focusMode === 'builder' ? 'Actionable items' : 'Priority queue'}
            subtitle={
              focusMode === 'operator' ? 'Now items first, sorted by urgency' :
              focusMode === 'manager' ? 'Grouped by owner and delegation' :
              'Tasks you can act on directly'
            }
            action={<button className={cn('text-primary', isCompact ? 'text-[11px]' : 'text-xs')} onClick={() => setPanel('sessions')}>View timeline</button>}
          >
            {/* Lane tabs: hidden in Builder lens (shows only actionable items) */}
            {focusMode !== 'builder' && (
              <div className={cn('flex flex-wrap', isCompact ? 'mb-1.5 gap-1.5' : 'mb-2 gap-2')}>
                {(['now', 'next', 'later'] as const).map((lane) => (
                  <button key={lane} onClick={() => setOpenLane(lane)} className={cn('rounded-lg border capitalize', isCompact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs', openLane === lane ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border bg-secondary/20 text-muted-foreground')}>
                    {lane} ({laneCounts[lane]})
                  </button>
                ))}
              </div>
            )}

            {/* Manager lens: group by owner */}
            {focusMode === 'manager' && (() => {
              const laneItems = filteredActivity.filter((item) => item.lane === openLane);
              const owners = [...new Set(laneItems.map((item) => item.owner || 'Unknown'))];
              return (
                <div className={isCompact ? 'space-y-1.5' : 'space-y-3'}>
                  {owners.map((owner) => (
                    <div key={owner}>
                      <p className={cn('font-medium text-muted-foreground', isCompact ? 'mb-0.5 text-[10px]' : 'mb-1 text-[11px]')}>{owner}</p>
                      <div className="divide-y divide-border">
                        {laneItems.filter((item) => (item.owner || 'Unknown') === owner).map((item) => (
                          <ActivityRow key={item.id} item={item} density={viewDensity} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {laneItems.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">No items in this lane</p>}
                </div>
              );
            })()}

            {/* Operator lens: flat list by lane */}
            {focusMode === 'operator' && (
              <div className="divide-y divide-border">
                {filteredActivity.filter((item) => item.lane === openLane).map((item) => (
                  <ActivityRow key={item.id} item={item} density={viewDensity} />
                ))}
                {filteredActivity.filter((item) => item.lane === openLane).length === 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">No items in this lane</p>
                )}
              </div>
            )}

            {/* Builder lens: actionable items only, no lane tabs */}
            {focusMode === 'builder' && (
              <div className="divide-y divide-border">
                {builderQueue.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">No actionable items right now</p>}
                {builderQueue.map((item) => (
                  <div key={item.id} className={cn('flex items-center', isCompact ? 'gap-1.5' : 'gap-2')}>
                    <div className="flex-1">
                      <ActivityRow item={item} density={viewDensity} />
                    </div>
                    <span className={cn('rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-primary', isCompact ? 'text-[10px]' : 'text-[11px]')}>
                      {item.lane}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SurfaceSection>
        )}
      </div>

      <SurfaceSection
        title="Gateway health summary"
        subtitle={`Status ${connectionState} · latency 12ms · uptime 99.9%`}
        action={<button className={cn('rounded-lg border border-border bg-secondary/30 text-foreground', isCompact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-xs')} onClick={() => setPanel('gateway')}>Open gateway drilldown</button>}
      >
        {!isCompact && (
          <p className="text-xs text-muted-foreground">Focus mode <span className="capitalize text-foreground">{focusMode}</span> and <span className="text-foreground">{viewDensity}</span> density keep the overview readable while details live in drilldowns.</p>
        )}
      </SurfaceSection>

      <SlideOverPanel open={panel !== null} title={panel === 'agents' ? 'Agent Operations' : panel === 'health' ? 'System Health' : panel === 'sessions' ? 'Session Insights' : panel === 'cost' ? 'Cost Breakdown' : 'Gateway Detail'} onClose={() => setPanel(null)}>
        {panel === 'agents' && MOCK_AGENTS.map((agent) => (
          <div key={agent.id} className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-sm font-medium text-foreground">{agent.emoji} {agent.name}</p>
            <p className="text-xs text-muted-foreground">{agent.role}</p>
            <p className={cn('mt-1 text-xs', getHealthColor(agent.health))}>Health: {agent.health}</p>
            <p className="text-xs text-muted-foreground">Last active {formatRelativeTime(agent.lastActive)}</p>
          </div>
        ))}
        {panel === 'health' && (
          <>
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm text-foreground">Gateway status: {isConnected ? 'Connected' : 'Disconnected'}</div>
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm text-foreground">Model routing: stable · 3 providers online</div>
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm text-foreground">Alerts in last 24h: 2 warning-level</div>
          </>
        )}
        {panel === 'sessions' && MOCK_SESSIONS.slice(0, 8).map((session) => (
          <div key={session.key} className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-sm font-medium text-foreground">{session.label || session.key}</p>
            <p className="text-xs text-muted-foreground">{session.agentName || 'Agent'} · {session.messageCount} messages</p>
            <p className="text-xs text-muted-foreground">Updated {formatRelativeTime(session.lastActivity)}</p>
          </div>
        ))}
        {panel === 'cost' && MOCK_SESSIONS.slice(0, 8).map((session) => (
          <div key={session.key} className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-sm font-medium text-foreground">{session.label || session.key}</p>
            <p className="text-xs text-muted-foreground">Cost <span className={cn('select-none', costColorClass(session.cost ?? 0))}>${session.cost?.toFixed(2) || '0.00'}</span> · <span className={cn('select-none', tokenColorClass(session.tokenUsage?.total || 0))}>{(session.tokenUsage?.total || 0).toLocaleString()}</span> tokens</p>
          </div>
        ))}
        {panel === 'gateway' && (
          <>
            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <p className="text-sm font-medium text-foreground">Gateway endpoint</p>
              <p className="text-xs text-muted-foreground">ws://localhost:18789</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <p className="text-sm font-medium text-foreground">Reliability</p>
              <p className="text-xs text-muted-foreground">99.9% uptime over last 7 days</p>
            </div>
          </>
        )}
      </SlideOverPanel>

      <WorkflowModal
        open={modal === 'new-agent'}
        title="New Agent Wizard"
        subtitle="Create an operator-focused agent in 3 steps"
        step={agentWizardStep}
        totalSteps={3}
        nextLabel={agentWizardStep < 3 ? 'Next' : 'Create agent'}
        onClose={() => setModal(null)}
        onBack={() => setAgentWizardStep((s) => s - 1)}
        onNext={() => agentWizardStep < 3 ? setAgentWizardStep((s) => s + 1) : setModal(null)}
      >
        {agentWizardStep === 1 && <div className="space-y-2 text-sm"><p className="text-foreground">Choose mission profile</p><input className="w-full rounded border border-border bg-secondary/20 px-3 py-2 text-sm" placeholder="e.g., Incident response" /></div>}
        {agentWizardStep === 2 && <div className="space-y-2 text-sm"><p className="text-foreground">Pick model and permissions</p><input className="w-full rounded border border-border bg-secondary/20 px-3 py-2 text-sm" placeholder="e.g., Claude Sonnet + repo read" /></div>}
        {agentWizardStep === 3 && <div className="space-y-2 text-sm"><p className="text-foreground">Review and launch</p><p className="text-muted-foreground">Agent will appear in Active Agents and inherit default guardrails.</p></div>}
      </WorkflowModal>

      <WorkflowModal
        open={modal === 'new-schedule'}
        title="Schedule Wizard"
        subtitle="Set up recurring automation without leaving dashboard"
        step={scheduleWizardStep}
        totalSteps={3}
        nextLabel={scheduleWizardStep < 3 ? 'Next' : 'Save schedule'}
        onClose={() => setModal(null)}
        onBack={() => setScheduleWizardStep((s) => s - 1)}
        onNext={() => scheduleWizardStep < 3 ? setScheduleWizardStep((s) => s + 1) : setModal(null)}
      >
        {scheduleWizardStep === 1 && <input className="w-full rounded border border-border bg-secondary/20 px-3 py-2 text-sm" placeholder="Schedule name" />}
        {scheduleWizardStep === 2 && <input className="w-full rounded border border-border bg-secondary/20 px-3 py-2 text-sm" placeholder="Cron expression or interval" />}
        {scheduleWizardStep === 3 && <p className="text-sm text-muted-foreground">Confirm target agent and notification channel, then activate.</p>}
      </WorkflowModal>

      {modal === 'new-chat' && (
        <ModalShell title="Start Chat" subtitle="Target an agent and context" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <input className="w-full rounded border border-border bg-secondary/20 px-3 py-2 text-sm" placeholder="Agent name" />
            <input className="w-full rounded border border-border bg-secondary/20 px-3 py-2 text-sm" placeholder="Session title" />
            <textarea className="h-24 w-full rounded border border-border bg-secondary/20 px-3 py-2 text-sm" placeholder="Opening message" />
            <button className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground" onClick={() => setModal(null)}>Start chat</button>
          </div>
        </ModalShell>
      )}

      {modal === 'export' && (
        <ModalShell title="Export Dashboard Snapshot" subtitle="Generate shareable status summary" onClose={() => setModal(null)}>
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2 text-foreground"><input type="checkbox" defaultChecked /> Include agent health</label>
            <label className="flex items-center gap-2 text-foreground"><input type="checkbox" defaultChecked /> Include session costs</label>
            <label className="flex items-center gap-2 text-foreground"><input type="checkbox" /> Include activity timeline</label>
            <button className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground" onClick={() => setModal(null)}>Generate export</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
