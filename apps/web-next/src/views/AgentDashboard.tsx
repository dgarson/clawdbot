import { useState } from 'react';
import { Bot } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatRelativeTime } from '../mock-data';
import { useGateway } from '../hooks/useGateway';
import { MOCK_AGENTS, MOCK_SESSIONS } from '../mock-data';
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';
import type { AgentStatus, AgentHealth } from '../types';

// ============================================================================
// Types (local for component)
// ============================================================================

type StatusBadgeVariant = 'active' | 'idle' | 'offline' | 'error' | 'healthy' | 'degraded' | 'connected';

interface ActivityItem {
  id: string;
  type: 'agent_response' | 'cron_run' | 'session_start' | 'user_message' | 'error';
  title: string;
  description: string;
  timestamp: string;
  agentEmoji?: string;
  agentName?: string;
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ variant, pulse }: { variant: StatusBadgeVariant; pulse?: boolean }) {
  const colors: Record<StatusBadgeVariant, string> = {
    active: 'bg-green-500',
    idle: 'bg-amber-500',
    offline: 'bg-surface-3',
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
      <span className={cn('w-2 h-2 rounded-full', colors[variant], pulse && 'animate-pulse')} aria-hidden="true" />
      <span className="text-fg-secondary">{labels[variant]}</span>
    </span>
  );
}

// ============================================================================
// Activity Feed Item
// ============================================================================

function ActivityItemComponent({ item }: { item: ActivityItem }) {
  const icons: Record<ActivityItem['type'], string> = {
    agent_response: '💬',
    cron_run: '⏰',
    session_start: '🚀',
    user_message: '👤',
    error: '⚠️',
  };

  return (
    <div className="flex gap-3 py-3">
      <span className="text-lg" aria-hidden="true">{icons[item.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-fg-primary truncate">
          {item.agentEmoji && <span className="mr-1" aria-hidden="true">{item.agentEmoji}</span>}
          {item.title}
        </p>
        <p className="text-xs text-fg-muted truncate">{item.description}</p>
      </div>
      <span className="text-xs text-fg-muted whitespace-nowrap">
        {formatRelativeTime(item.timestamp)}
      </span>
    </div>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

export default function AgentDashboard() {
  const { connectionState, isConnected } = useGateway();
  const [isLoading] = useState(false);

  // Get current date
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Determine greeting based on time
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Calculate stats
  const activeAgents = MOCK_AGENTS.filter((a) => a.status === 'active').length;
  const totalAgents = MOCK_AGENTS.length;
  const sessionsToday = MOCK_SESSIONS.length;
  const dailyCost = MOCK_SESSIONS.reduce((acc, s) => acc + (s.cost || 0), 0);

  // Mock activity feed data
  const recentActivity: ActivityItem[] = [
    {
      id: '1',
      type: 'agent_response',
      title: 'Luis completed UI work',
      description: 'Built AgentDashboard component with full styling',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      agentEmoji: '🎨',
      agentName: 'Luis',
    },
    {
      id: '2',
      type: 'cron_run',
      title: 'Hourly UX Check ran',
      description: 'UX Work Check completed successfully',
      timestamp: new Date(Date.now() - 3540000).toISOString(),
    },
    {
      id: '3',
      type: 'session_start',
      title: 'New session started',
      description: 'Architecture Review session with Xavier',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      agentEmoji: '🧠',
      agentName: 'Xavier',
    },
    {
      id: '4',
      type: 'agent_response',
      title: 'Harry processed queue',
      description: 'Completed 3 pending tasks from work queue',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      agentEmoji: '⚡',
      agentName: 'Harry',
    },
    {
      id: '5',
      type: 'user_message',
      title: 'You sent a message',
      description: 'Started new chat with Luis',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: '6',
      type: 'cron_run',
      title: 'Daily Briefing ran',
      description: 'Generated morning summary',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  // Get status color helper
  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case 'active':
        return 'text-green-500';
      case 'idle':
        return 'text-amber-500';
      case 'offline':
        return 'text-fg-muted';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-fg-muted';
    }
  };

  // Get health color helper
  const getHealthColor = (health: AgentHealth) => {
    switch (health) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-amber-500';
      case 'unhealthy':
        return 'text-red-500';
      default:
        return 'text-fg-muted';
    }
  };

  return (
    <>
      {/* Skip link */}
      <a
        href="#agent-dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:rounded-lg focus:font-medium focus:outline-none"
      >
        Skip to main content
      </a>

      <div className="min-h-screen bg-surface-0 text-fg-primary">
        {/* Header */}
        <header className="border-b border-tok-border bg-surface-1/50 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-semibold">
                {greeting} <span aria-hidden="true">👋</span>
              </h1>
              <p className="text-sm text-fg-secondary mt-1">{dateStr}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-fg-secondary">Gateway:</span>
              <StatusBadge variant={isConnected ? 'connected' : 'offline'} pulse={!isConnected} />
            </div>
          </div>
        </header>

        <main id="agent-dashboard-main" className="p-3 sm:p-4 md:p-6 space-y-6">
          {/* Stats Row */}
          <section aria-label="Summary statistics">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Active Agents */}
              <div className="bg-surface-1 border border-tok-border rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-fg-secondary">Active Agents</p>
                    <p className="text-3xl font-bold mt-1">
                      {activeAgents}
                      <span className="text-lg text-fg-muted font-normal">/{totalAgents}</span>
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center text-2xl" aria-hidden="true">
                    🤖
                  </div>
                </div>
              </div>

              {/* System Health */}
              <div className="bg-surface-1 border border-tok-border rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-fg-secondary">System Health</p>
                    <p className="text-3xl font-bold mt-1 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                      Online
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-2xl" aria-hidden="true">
                    ✓
                  </div>
                </div>
              </div>

              {/* Chat Sessions Today */}
              <div className="bg-surface-1 border border-tok-border rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-fg-secondary">Chat Sessions Today</p>
                    <p className="text-3xl font-bold mt-1">{sessionsToday}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl" aria-hidden="true">
                    💬
                  </div>
                </div>
              </div>

              {/* Daily Cost */}
              <div className="bg-surface-1 border border-tok-border rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-fg-secondary">Daily Cost</p>
                    <p className="text-3xl font-bold mt-1">
                      ${dailyCost.toFixed(2)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl" aria-hidden="true">
                    💰
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section aria-label="Quick actions">
            <div className="flex flex-wrap gap-3">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-fg-primary rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
                <span aria-hidden="true">🤖</span>
                <span className="font-medium">New Agent</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-fg-primary rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
                <span aria-hidden="true">💬</span>
                <span className="font-medium">New Chat</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-surface-2 hover:bg-surface-3 text-fg-primary border border-tok-border rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
                <span aria-hidden="true">⏰</span>
                <span className="font-medium">New Schedule</span>
              </button>
            </div>
          </section>

          {/* Agent Grid & Activity Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent Grid */}
            <section aria-label="Agents" className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-semibold">Agents</h2>
              {MOCK_AGENTS.length === 0 ? (
                <ContextualEmptyState
                  icon={Bot}
                  title="No agents configured"
                  description="Create your first agent to start automating tasks."
                  primaryAction={{ label: 'Create Agent', onClick: () => {} }}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {MOCK_AGENTS.map((agent) => (
                    <div
                      key={agent.id}
                      className="bg-surface-1 border border-tok-border rounded-xl p-4 hover:border-tok-border transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-3xl" aria-hidden="true">{agent.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold truncate">{agent.name}</h3>
                            {/* Decorative dot — status text below carries the meaning */}
                            <span className={cn('w-2 h-2 rounded-full', getStatusColor(agent.status))} aria-hidden="true" />
                          </div>
                          <p className="text-sm text-fg-secondary truncate">{agent.role}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn('text-xs', getStatusColor(agent.status))}>
                              ● {agent.status}
                            </span>
                            <span className="text-xs text-fg-muted" aria-hidden="true">•</span>
                            <span className="text-xs text-fg-muted">{agent.model}</span>
                          </div>
                          <p className="text-xs text-fg-muted mt-1">
                            Last active {formatRelativeTime(agent.lastActive)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* New Agent Card */}
                  <button
                    className="bg-surface-1/50 border border-tok-border border-dashed rounded-xl p-4 hover:border-violet-600 hover:bg-surface-1 transition-colors flex flex-col items-center justify-center min-h-[120px] focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                    aria-label="Create new agent"
                  >
                    <span className="text-3xl mb-2" aria-hidden="true">+</span>
                    <p className="text-sm text-fg-secondary">New Agent</p>
                  </button>
                </div>
              )}
            </section>

            {/* Activity Feed */}
            <section aria-label="Recent Activity" className="space-y-4">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <div
                className="bg-surface-1 border border-tok-border rounded-xl p-4 max-h-[400px] overflow-y-auto"
                aria-live="polite"
                aria-label="Live activity feed"
              >
                <div className="divide-y divide-tok-border">
                  {recentActivity.map((item) => (
                    <ActivityItemComponent key={item.id} item={item} />
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* System Health Bar */}
          <section aria-label="Gateway connection status">
            <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn('w-3 h-3 rounded-full', isConnected ? 'bg-green-500' : 'bg-red-500')}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium">Gateway Connection</span>
                  <span className="text-xs text-fg-muted">
                    {isConnected ? 'Connected to ws://localhost:18789' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-fg-muted">
                  <span>
                    <span className="text-fg-secondary">Status:</span>{' '}
                    <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                      {connectionState}
                    </span>
                  </span>
                  <span>
                    <span className="text-fg-secondary">Latency:</span> 12ms
                  </span>
                  <span>
                    <span className="text-fg-secondary">Uptime:</span> 99.9%
                  </span>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
