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
  type: 'agent_response' | 'cron_run' | 'session_start' | 'user_message' | 'error';
  title: string;
  description: string;
  timestamp: string;
  agentEmoji?: string;
  lane: PriorityLane;
}

function StatusBadge({ variant, pulse }: { variant: StatusBadgeVariant; pulse?: boolean }) {
  const colors: Record<StatusBadgeVariant, string> = {
    active: 'bg-green-500',
    idle: 'bg-amber-500',
    offline: 'bg-zinc-500',
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
  };

  return (
    <div className={cn('flex gap-3', density === 'compact' ? 'py-2' : 'py-3')}>
      <span className="text-base" aria-hidden="true">{icons[item.type]}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">
          {item.agentEmoji && <span className="mr-1">{item.agentEmoji}</span>}
          {item.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">{item.description}</p>
      </div>
      <span className="whitespace-nowrap text-xs text-muted-foreground">{formatRelativeTime(item.timestamp)}</span>
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
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  onOpen: () => void;
  density: ViewDensity;
}) {
  return (
    <button
      className={cn(
        'w-full rounded-xl border border-border bg-card text-left transition-colors hover:border-primary/50 hover:bg-secondary/30',
        density === 'compact' ? 'p-3' : 'p-4'
      )}
      onClick={onOpen}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-xl" aria-hidden="true">{icon}</span>
      </div>
      <p className="mt-3 text-xs text-primary">View details →</p>
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
    { id: '1', type: 'agent_response', title: 'Luis completed UI pass', description: 'Updated dashboard interaction flow and mobile spacing.', timestamp: new Date(Date.now() - 120000).toISOString(), agentEmoji: '🎨', lane: 'now' },
    { id: '2', type: 'cron_run', title: 'Hourly UX check ran', description: 'No regressions detected in latest branch checks.', timestamp: new Date(Date.now() - 1800000).toISOString(), lane: 'next' },
    { id: '3', type: 'session_start', title: 'Architecture review session started', description: 'Xavier opened model orchestration thread.', timestamp: new Date(Date.now() - 3600000).toISOString(), agentEmoji: '🧠', lane: 'now' },
    { id: '4', type: 'user_message', title: 'You asked for dashboard drill-downs', description: 'Requested guided workflows and focused detail panels.', timestamp: new Date(Date.now() - 5400000).toISOString(), lane: 'later' },
  ], []);

  const filteredActivity = allActivity.filter((item) => {
    if (focusMode === 'operator') {return item.lane !== 'later';}
    if (focusMode === 'manager') {return item.type !== 'user_message';}
    return true;
  });

  const laneCounts = {
    now: filteredActivity.filter((item) => item.lane === 'now').length,
    next: filteredActivity.filter((item) => item.lane === 'next').length,
    later: filteredActivity.filter((item) => item.lane === 'later').length,
  };

  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'idle': return 'text-amber-400';
      case 'offline': return 'text-zinc-400';
      case 'error': return 'text-red-400';
      default: return 'text-zinc-400';
    }
  };

  const getHealthColor = (health: AgentHealth) => {
    switch (health) {
      case 'healthy': return 'text-green-400';
      case 'degraded': return 'text-amber-400';
      case 'unhealthy': return 'text-red-400';
      default: return 'text-zinc-400';
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

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{greeting} 👋</h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2">
            <span className="text-xs text-muted-foreground">Gateway</span>
            <StatusBadge variant={isConnected ? 'connected' : 'offline'} pulse={!isConnected} />
          </div>
        </div>
      </header>

      <SurfaceSection
        title="Operator controls"
        subtitle="Tune information load before drilling into details"
        action={<div className="flex flex-wrap gap-2">{sectionButton('overview', 'Overview')}{sectionButton('agents', 'Agents')}{sectionButton('activity', 'Activity')}</div>}
      >
        <div className="flex flex-wrap items-center gap-2">
          {(['operator', 'manager', 'builder'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFocusMode(mode)}
              className={cn('rounded-lg border px-3 py-2 text-xs font-medium capitalize', focusMode === mode ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border bg-secondary/20 text-muted-foreground')}
            >
              {mode} lens
            </button>
          ))}
          <ViewDensityToggle value={viewDensity} onChange={setViewDensity} />
          <button className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground" onClick={() => setShowComparisons((v) => !v)}>
            {showComparisons ? 'Hide trends' : 'Show trends'}
          </button>
          <button className="ml-auto rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground" onClick={() => { setAgentWizardStep(1); setModal('new-agent'); }}>
            New Agent
          </button>
          <button className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground" onClick={() => setModal('new-chat')}>New Chat</button>
          <button className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground" onClick={() => { setScheduleWizardStep(1); setModal('new-schedule'); }}>New Schedule</button>
          <button className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground" onClick={() => setModal('export')}>Export</button>
        </div>
      </SurfaceSection>

      {showOverview && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailCard title="Active Agents" value={`${activeAgents}/${totalAgents}`} subtitle={showComparisons ? '↑ 2 vs yesterday' : 'Drill into workload and ownership'} icon="🤖" onOpen={() => setPanel('agents')} density={viewDensity} />
          <DetailCard title="System Health" value={isConnected ? 'Healthy' : 'Degraded'} subtitle={showComparisons ? 'Stable for 7 days' : 'Inspect gateway uptime, latency, and alerts'} icon="✅" onOpen={() => setPanel('health')} density={viewDensity} />
          <DetailCard title="Sessions Today" value={String(sessionsToday)} subtitle={showComparisons ? '↑ 14% from prior window' : 'Review active and recent conversations'} icon="💬" onOpen={() => setPanel('sessions')} density={viewDensity} />
          <DetailCard title="Daily Cost" value={`$${dailyCost.toFixed(2)}`} subtitle={showComparisons ? '↓ 6% with same output' : 'See spend breakdown and anomaly risk'} icon="💰" onOpen={() => setPanel('cost')} density={viewDensity} />
        </section>
      )}



      {showOverview && (
        <SurfaceSection title="Why this matters" subtitle="Contextual insight strip to turn metrics into action">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm text-foreground">
              Active agents are high while cost trend is down, suggesting recent routing optimizations are working.
            </div>
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm text-foreground">
              Session volume is rising; prioritize queue triage in the Action Inbox to avoid hidden bottlenecks.
            </div>
          </div>
        </SurfaceSection>
      )}

      <SurfaceSection title="Compare operating modes" subtitle="Side-by-side snapshot to decide which lens fits current work">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-sm font-medium text-foreground">Operator lens</p>
            <p className="mt-1 text-xs text-muted-foreground">Focuses on immediate execution and excludes low-priority lane items.</p>
            <p className="mt-2 text-xs text-foreground">Visible activity items: {allActivity.filter((item) => item.lane !== 'later').length}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-sm font-medium text-foreground">Manager lens</p>
            <p className="mt-1 text-xs text-muted-foreground">Prioritizes service health and coordination by suppressing noisy user-message churn.</p>
            <p className="mt-2 text-xs text-foreground">Visible activity items: {allActivity.filter((item) => item.type !== 'user_message').length}</p>
          </div>
        </div>
      </SurfaceSection>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {showAgents && (
          <SurfaceSection
            title="Agents"
            subtitle={focusMode === 'manager' ? 'Manager lens prioritizes health and ownership' : 'Select an agent to inspect capabilities and activity'}
            className="xl:col-span-2"
            action={<button className="text-xs text-primary" onClick={() => setPanel('agents')}>Open full detail</button>}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MOCK_AGENTS.slice(0, focusMode === 'builder' ? 4 : 6).map((agent) => (
                <button key={agent.id} className={cn('rounded-lg border border-border bg-secondary/10 text-left hover:border-primary/40', viewDensity === 'compact' ? 'p-2.5' : 'p-3')} onClick={() => setPanel('agents')}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl" aria-hidden="true">{agent.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{agent.name}</p>
                        <span className={cn('text-[11px]', getStatusColor(agent.status))}>● {agent.status}</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{agent.model}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </SurfaceSection>
        )}

        {showActivity && (
          <SurfaceSection title="Priority queue" subtitle="Triage work by what needs action now vs later" action={<button className="text-xs text-primary" onClick={() => setPanel('sessions')}>View timeline</button>}>
            <div className="mb-2 flex flex-wrap gap-2">
              {(['now', 'next', 'later'] as const).map((lane) => (
                <button key={lane} onClick={() => setOpenLane(lane)} className={cn('rounded-lg border px-2.5 py-1 text-xs capitalize', openLane === lane ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border bg-secondary/20 text-muted-foreground')}>
                  {lane} ({laneCounts[lane]})
                </button>
              ))}
            </div>
            <div className="divide-y divide-border">
              {filteredActivity.filter((item) => item.lane === openLane).map((item) => (
                <ActivityRow key={item.id} item={item} density={viewDensity} />
              ))}
            </div>
          </SurfaceSection>
        )}
      </div>

      <SurfaceSection
        title="Gateway health summary"
        subtitle={`Status ${connectionState} · latency 12ms · uptime 99.9%`}
        action={<button className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground" onClick={() => setPanel('gateway')}>Open gateway drilldown</button>}
      >
        <p className="text-xs text-muted-foreground">Focus mode <span className="capitalize text-foreground">{focusMode}</span> and <span className="text-foreground">{viewDensity}</span> density keep the overview readable while details live in drilldowns.</p>
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
            <p className="text-xs text-muted-foreground">Cost ${session.cost?.toFixed(2) || '0.00'} · {(session.tokenUsage?.total || 0).toLocaleString()} tokens</p>
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
