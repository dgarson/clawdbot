import { useState } from 'react';
import { cn } from '../lib/utils';
import { formatRelativeTime } from '../mock-data';
import { useGateway } from '../hooks/useGateway';
import { MOCK_AGENTS, MOCK_SESSIONS } from '../mock-data';
import type { AgentStatus, AgentHealth } from '../types';
import { EmptyState } from '../components/ui/empty-state';

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
    offline: 'bg-gray-500',
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
      <span className={cn('w-2 h-2 rounded-full', colors[variant], pulse && 'animate-pulse')} />
      <span className="text-gray-400">{labels[variant]}</span>
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
      <span className="text-lg">{icons[item.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">
          {item.agentEmoji && <span className="mr-1">{item.agentEmoji}</span>}
          {item.title}
        </p>
        <p className="text-xs text-gray-500 truncate">{item.description}</p>
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">
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
        return 'text-gray-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
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
        return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {greeting} 👋
            </h1>
            <p className="text-sm text-gray-400 mt-1">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Gateway:</span>
            <StatusBadge variant={isConnected ? 'connected' : 'offline'} pulse={!isConnected} />
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Agents */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Agents</p>
                <p className="text-3xl font-bold mt-1">
                  {activeAgents}
                  <span className="text-lg text-gray-500 font-normal">/{totalAgents}</span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center text-2xl">
                🤖
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">System Health</p>
                <p className="text-3xl font-bold mt-1 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  Online
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-2xl">
                ✓
              </div>
            </div>
          </div>

          {/* Chat Sessions Today */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Chat Sessions Today</p>
                <p className="text-3xl font-bold mt-1">{sessionsToday}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl">
                💬
              </div>
            </div>
          </div>

          {/* Daily Cost */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Daily Cost</p>
                <p className="text-3xl font-bold mt-1">
                  ${dailyCost.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl">
                💰
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors">
            <span>🤖</span>
            <span className="font-medium">New Agent</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors">
            <span>💬</span>
            <span className="font-medium">New Chat</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 rounded-xl transition-colors">
            <span>⏰</span>
            <span className="font-medium">New Schedule</span>
          </button>
        </div>

        {/* Agent Grid & Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Grid */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">Agents</h2>
            {MOCK_AGENTS.length === 0 ? (
              <EmptyState
                variant="no-agents"
                action={{
                  label: 'Create Agent',
                  onClick: () => console.log('Create agent'),
                }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MOCK_AGENTS.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{agent.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold truncate">{agent.name}</h3>
                        <span className={cn('w-2 h-2 rounded-full', getStatusColor(agent.status))} />
                      </div>
                      <p className="text-sm text-gray-400 truncate">{agent.role}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn('text-xs', getStatusColor(agent.status))}>
                          ● {agent.status}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-500">{agent.model}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Last active {formatRelativeTime(agent.lastActive)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* New Agent Card */}
              <div className="bg-gray-900/50 border border-gray-800 border-dashed rounded-xl p-4 hover:border-violet-600 hover:bg-gray-900 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[120px]">
                <span className="text-3xl mb-2">+</span>
                <p className="text-sm text-gray-400">New Agent</p>
              </div>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 max-h-[400px] overflow-y-auto">
              <div className="divide-y divide-gray-800">
                {recentActivity.map((item) => (
                  <ActivityItemComponent key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* System Health Bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('w-3 h-3 rounded-full', isConnected ? 'bg-green-500' : 'bg-red-500')} />
              <span className="text-sm font-medium">Gateway Connection</span>
              <span className="text-xs text-gray-500">
                {isConnected ? 'Connected to ws://localhost:18789' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>
                <span className="text-gray-400">Status:</span>{' '}
                <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                  {connectionState}
                </span>
              </span>
              <span>
                <span className="text-gray-400">Latency:</span> 12ms
              </span>
              <span>
                <span className="text-gray-400">Uptime:</span> 99.9%
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
