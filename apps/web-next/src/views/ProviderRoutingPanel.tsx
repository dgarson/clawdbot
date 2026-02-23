import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Cpu,
  Network,
  RefreshCw,
  Server,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { cn } from '../lib/utils'

interface Provider {
  id: string
  name: string
  status: 'active' | 'degraded' | 'offline'
  latency: number
  requestsPerMin: number
  successRate: number
  modelCount: number
  color: string
}

interface RoutingRule {
  id: string
  model: string
  primaryProvider: string
  fallbackProvider: string
  priority: number
  active: boolean
}

interface FailoverEvent {
  id: string
  timestamp: string
  model: string
  fromProvider: string
  toProvider: string
  reason: string
}

const mockProviders: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    status: 'active',
    latency: 142,
    requestsPerMin: 847,
    successRate: 99.2,
    modelCount: 12,
    color: 'bg-emerald-500',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    status: 'active',
    latency: 189,
    requestsPerMin: 623,
    successRate: 99.7,
    modelCount: 8,
    color: 'bg-orange-500',
  },
  {
    id: 'xai',
    name: 'xAI',
    status: 'active',
    latency: 156,
    requestsPerMin: 234,
    successRate: 98.4,
    modelCount: 3,
    color: 'bg-blue-500',
  },
  {
    id: 'zai',
    name: 'ZAI',
    status: 'degraded',
    latency: 312,
    requestsPerMin: 156,
    successRate: 94.1,
    modelCount: 5,
    color: 'bg-violet-500',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    status: 'active',
    latency: 198,
    requestsPerMin: 412,
    successRate: 97.8,
    modelCount: 45,
    color: 'bg-cyan-500',
  },
]

const mockRoutingRules: RoutingRule[] = [
  {
    id: '1',
    model: 'gpt-4-turbo',
    primaryProvider: 'OpenAI',
    fallbackProvider: 'OpenRouter',
    priority: 1,
    active: true,
  },
  {
    id: '2',
    model: 'gpt-4',
    primaryProvider: 'OpenAI',
    fallbackProvider: 'Anthropic',
    priority: 2,
    active: true,
  },
  {
    id: '3',
    model: 'claude-3-opus',
    primaryProvider: 'Anthropic',
    fallbackProvider: 'OpenRouter',
    priority: 1,
    active: true,
  },
  {
    id: '4',
    model: 'claude-3-sonnet',
    primaryProvider: 'Anthropic',
    fallbackProvider: 'OpenAI',
    priority: 2,
    active: true,
  },
  {
    id: '5',
    model: 'grok-beta',
    primaryProvider: 'xAI',
    fallbackProvider: 'OpenRouter',
    priority: 1,
    active: true,
  },
  {
    id: '6',
    model: 'glm-4',
    primaryProvider: 'ZAI',
    fallbackProvider: 'OpenAI',
    priority: 1,
    active: false,
  },
  {
    id: '7',
    model: 'mixtral-8x7b',
    primaryProvider: 'OpenRouter',
    fallbackProvider: 'Anthropic',
    priority: 3,
    active: true,
  },
  {
    id: '8',
    model: 'gpt-3.5-turbo',
    primaryProvider: 'OpenAI',
    fallbackProvider: 'xAI',
    priority: 4,
    active: true,
  },
  {
    id: '9',
    model: 'claude-3-haiku',
    primaryProvider: 'Anthropic',
    fallbackProvider: 'OpenAI',
    priority: 3,
    active: true,
  },
  {
    id: '10',
    model: 'llama-2-70b',
    primaryProvider: 'OpenRouter',
    fallbackProvider: 'ZAI',
    priority: 2,
    active: true,
  },
]

const mockFailoverEvents: FailoverEvent[] = [
  {
    id: '1',
    timestamp: '2026-02-23 03:12:45',
    model: 'gpt-4-turbo',
    fromProvider: 'OpenAI',
    toProvider: 'OpenRouter',
    reason: 'Rate limit exceeded',
  },
  {
    id: '2',
    timestamp: '2026-02-23 02:58:23',
    model: 'claude-3-opus',
    fromProvider: 'Anthropic',
    toProvider: 'OpenRouter',
    reason: 'High latency (>5s)',
  },
  {
    id: '3',
    timestamp: '2026-02-23 02:34:11',
    model: 'glm-4',
    fromProvider: 'ZAI',
    toProvider: 'OpenAI',
    reason: 'Provider degraded',
  },
  {
    id: '4',
    timestamp: '2026-02-23 02:15:08',
    model: 'gpt-4',
    fromProvider: 'OpenAI',
    toProvider: 'Anthropic',
    reason: 'Timeout exceeded',
  },
  {
    id: '5',
    timestamp: '2026-02-23 01:52:33',
    model: 'grok-beta',
    fromProvider: 'xAI',
    toProvider: 'OpenRouter',
    reason: 'API error 503',
  },
  {
    id: '6',
    timestamp: '2026-02-23 01:28:19',
    model: 'claude-3-sonnet',
    fromProvider: 'Anthropic',
    toProvider: 'OpenAI',
    reason: 'Quota reached',
  },
  {
    id: '7',
    timestamp: '2026-02-23 01:05:42',
    model: 'mixtral-8x7b',
    fromProvider: 'OpenRouter',
    toProvider: 'Anthropic',
    reason: 'Connection reset',
  },
  {
    id: '8',
    timestamp: '2026-02-23 00:41:56',
    model: 'gpt-3.5-turbo',
    fromProvider: 'OpenAI',
    toProvider: 'xAI',
    reason: 'Rate limit exceeded',
  },
  {
    id: '9',
    timestamp: '2026-02-23 00:18:27',
    model: 'glm-4',
    fromProvider: 'ZAI',
    toProvider: 'OpenAI',
    reason: 'Provider offline',
  },
  {
    id: '10',
    timestamp: '2026-02-22 23:55:14',
    model: 'claude-3-haiku',
    fromProvider: 'Anthropic',
    toProvider: 'OpenAI',
    reason: 'Model unavailable',
  },
]

const trafficDistribution = [
  { provider: 'OpenAI', percentage: 38, color: 'bg-emerald-500' },
  { provider: 'Anthropic', percentage: 28, color: 'bg-orange-500' },
  { provider: 'OpenRouter', percentage: 18, color: 'bg-cyan-500' },
  { provider: 'xAI', percentage: 11, color: 'bg-blue-500' },
  { provider: 'ZAI', percentage: 5, color: 'bg-violet-500' },
]

function StatusBadge({ status }: { status: 'active' | 'degraded' | 'offline' }) {
  const config = {
    active: {
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      icon: CheckCircle2,
      label: 'Active',
    },
    degraded: {
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      icon: AlertTriangle,
      label: 'Degraded',
    },
    offline: {
      color: 'text-red-400',
      bg: 'bg-red-400/10',
      icon: CircleDot,
      label: 'Offline',
    },
  }

  const { color, bg, icon: Icon, label } = config[status]

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium', bg, color)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-zinc-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && (
            <div className="flex items-center gap-1 mt-1">
              {trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-green-400" />}
              {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
              <span className="text-zinc-500 text-xs">{subtitle}</span>
            </div>
          )}
        </div>
        <div className="p-2 bg-violet-600/10 rounded-lg">
          <Icon className="w-5 h-5 text-violet-400" />
        </div>
      </div>
    </div>
  )
}

function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', provider.color)}>
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold">{provider.name}</h3>
            <StatusBadge status={provider.status} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 text-sm">Latency</span>
          <div className="flex items-center gap-1.5">
            <Zap
              className={cn(
                'w-3.5 h-3.5',
                provider.latency < 150
                  ? 'text-green-400'
                  : provider.latency < 250
                    ? 'text-amber-400'
                    : 'text-red-400'
              )}
            />
            <span className="text-white font-medium">{provider.latency}ms</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400 text-sm">Requests/min</span>
          <span className="text-white font-medium">{provider.requestsPerMin.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400 text-sm">Success Rate</span>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  provider.successRate >= 99
                    ? 'bg-green-400'
                    : provider.successRate >= 95
                      ? 'bg-amber-400'
                      : 'bg-red-400'
                )}
                style={{ width: `${provider.successRate}%` }}
              />
            </div>
            <span className="text-white font-medium text-sm">{provider.successRate}%</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400 text-sm">Models</span>
          <span className="text-white font-medium">{provider.modelCount}</span>
        </div>
      </div>
    </div>
  )
}

function TrafficBar() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-white font-semibold mb-4">Traffic Distribution</h3>
      
      <div className="h-4 bg-zinc-800 rounded-full overflow-hidden flex mb-4">
        {trafficDistribution.map((item, index) => (
          <div
            key={item.provider}
            className={cn('h-full transition-all duration-300', item.color)}
            style={{ width: `${item.percentage}%` }}
            title={`${item.provider}: ${item.percentage}%`}
          />
        ))}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {trafficDistribution.map((item) => (
          <div key={item.provider} className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className={cn('w-2 h-2 rounded-full', item.color)} />
              <span className="text-zinc-400 text-xs truncate">{item.provider}</span>
            </div>
            <span className="text-white font-semibold text-sm">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProviderRoutingPanel() {
  const [routingRules, setRoutingRules] = useState(mockRoutingRules)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleToggleRule = (ruleId: string) => {
    setRoutingRules((rules) =>
      rules.map((rule) =>
        rule.id === ruleId ? { ...rule, active: !rule.active } : rule
      )
    )
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const activeProviders = mockProviders.filter((p) => p.status === 'active').length
  const activeRoutes = routingRules.filter((r) => r.active).length
  const avgLatency = Math.round(
    mockProviders.reduce((sum, p) => sum + p.latency, 0) / mockProviders.length
  )

  return (
    <div className="bg-zinc-950 min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Network className="w-6 h-6 text-violet-400" />
              Provider Routing
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              AI model routing, load balancing, and failover management
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="Total Providers"
            value={mockProviders.length}
            subtitle={`${activeProviders} active`}
            icon={Server}
            trend="neutral"
          />
          <StatCard
            title="Active Routes"
            value={activeRoutes}
            subtitle={`${routingRules.length} total configured`}
            icon={Network}
            trend="up"
          />
          <StatCard
            title="Failovers Today"
            value={mockFailoverEvents.length}
            subtitle="Last 24 hours"
            icon={RefreshCw}
            trend="down"
          />
          <StatCard
            title="Avg Latency"
            value={`${avgLatency}ms`}
            subtitle="Across all providers"
            icon={Zap}
            trend="neutral"
          />
        </div>

        {/* Provider Cards */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-violet-400" />
            Providers
          </h2>
          <div className="grid grid-cols-5 gap-4">
            {mockProviders.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        </div>

        {/* Routing Rules Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-violet-400" />
              Routing Rules
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              Configure primary and fallback providers for each model
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-400 text-sm font-medium px-4 py-3">Model</th>
                  <th className="text-left text-zinc-400 text-sm font-medium px-4 py-3">Primary Provider</th>
                  <th className="text-left text-zinc-400 text-sm font-medium px-4 py-3">Fallback Provider</th>
                  <th className="text-left text-zinc-400 text-sm font-medium px-4 py-3">Priority</th>
                  <th className="text-left text-zinc-400 text-sm font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {routingRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className={cn(
                      'border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors',
                      !rule.active && 'opacity-50'
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className="text-white font-medium font-mono text-sm">{rule.model}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-300">{rule.primaryProvider}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                        <span className="text-zinc-400">{rule.fallbackProvider}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold',
                        rule.priority === 1
                          ? 'bg-violet-600/20 text-violet-400'
                          : rule.priority === 2
                            ? 'bg-blue-600/20 text-blue-400'
                            : rule.priority === 3
                              ? 'bg-amber-600/20 text-amber-400'
                              : 'bg-zinc-700/50 text-zinc-400'
                      )}>
                        {rule.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleRule(rule.id)}
                        className={cn(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-900',
                          rule.active ? 'bg-violet-600' : 'bg-zinc-700'
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                            rule.active ? 'translate-x-6' : 'translate-x-1'
                          )}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Traffic Distribution */}
        <TrafficBar />

        {/* Failover Log */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-violet-400" />
              Failover Log
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              Recent failover events and provider switches
            </p>
          </div>

          <div className="divide-y divide-zinc-800/50">
            {mockFailoverEvents.map((event) => (
              <div
                key={event.id}
                className="px-4 py-3 hover:bg-zinc-800/30 transition-colors flex items-center gap-4"
              >
                <div className="w-40 flex-shrink-0">
                  <span className="text-zinc-500 text-sm font-mono">{event.timestamp}</span>
                </div>

                <div className="w-36 flex-shrink-0">
                  <span className="text-white font-medium font-mono text-sm">{event.model}</span>
                </div>

                <div className="flex items-center gap-2 flex-1">
                  <span className="text-zinc-300">{event.fromProvider}</span>
                  <ArrowRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-violet-400 font-medium">{event.toProvider}</span>
                </div>

                <div className="w-40 flex-shrink-0 text-right">
                  <span className="text-zinc-500 text-sm">{event.reason}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-800/20">
            <p className="text-zinc-500 text-sm text-center">
              Showing {mockFailoverEvents.length} most recent failover events
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-zinc-500 text-sm border-t border-zinc-800 pt-4">
          <div className="flex items-center gap-4">
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
            <span>•</span>
            <span>Auto-refresh: 30s</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>System healthy</span>
          </div>
        </div>
      </div>
    </div>
  )
}
