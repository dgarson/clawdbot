import { useState, useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  GitBranch,
  Network,
  RefreshCw,
  Server,
  Shield,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState'
import { Skeleton } from '../components/ui/Skeleton'

// Types
interface Provider {
  id: string
  name: string
  status: 'active' | 'degraded' | 'offline'
  latency: number
  requestsPerMinute: number
  successRate: number
  modelCount: number
  trafficShare: number
  color: string
}

interface RoutingRule {
  id: string
  modelName: string
  modelId: string
  primaryProvider: string
  fallbackProvider: string
  priority: 1 | 2 | 3
  isActive: boolean
}

interface FailoverEvent {
  id: string
  timestamp: Date
  model: string
  fromProvider: string
  toProvider: string
  reason: 'rate_limit' | 'timeout' | 'error'
}

// Mock Data
const mockProviders: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    status: 'active',
    latency: 142,
    requestsPerMinute: 2847,
    successRate: 99.7,
    modelCount: 12,
    trafficShare: 38,
    color: 'bg-emerald-500',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    status: 'active',
    latency: 198,
    requestsPerMinute: 1923,
    successRate: 99.4,
    modelCount: 8,
    trafficShare: 28,
    color: 'bg-orange-500',
  },
  {
    id: 'xai',
    name: 'xAI',
    status: 'active',
    latency: 167,
    requestsPerMinute: 892,
    successRate: 98.9,
    modelCount: 4,
    trafficShare: 14,
    color: 'bg-blue-500',
  },
  {
    id: 'zai',
    name: 'ZAI',
    status: 'degraded',
    latency: 342,
    requestsPerMinute: 456,
    successRate: 94.2,
    modelCount: 6,
    trafficShare: 12,
    color: 'bg-violet-500',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    status: 'active',
    latency: 223,
    requestsPerMinute: 634,
    successRate: 97.8,
    modelCount: 45,
    trafficShare: 8,
    color: 'bg-cyan-500',
  },
]

const mockRoutingRules: RoutingRule[] = [
  {
    id: '1',
    modelName: 'GPT-4o',
    modelId: 'gpt-4o',
    primaryProvider: 'OpenAI',
    fallbackProvider: 'Anthropic',
    priority: 1,
    isActive: true,
  },
  {
    id: '2',
    modelName: 'GPT-4 Turbo',
    modelId: 'gpt-4-turbo',
    primaryProvider: 'OpenAI',
    fallbackProvider: 'OpenRouter',
    priority: 1,
    isActive: true,
  },
  {
    id: '3',
    modelName: 'Claude 3.5 Sonnet',
    modelId: 'claude-3-5-sonnet',
    primaryProvider: 'Anthropic',
    fallbackProvider: 'OpenAI',
    priority: 2,
    isActive: true,
  },
  {
    id: '4',
    modelName: 'Claude 3 Opus',
    modelId: 'claude-3-opus',
    primaryProvider: 'Anthropic',
    fallbackProvider: 'OpenAI',
    priority: 1,
    isActive: true,
  },
  {
    id: '5',
    modelName: 'Grok-2',
    modelId: 'grok-2',
    primaryProvider: 'xAI',
    fallbackProvider: 'OpenRouter',
    priority: 2,
    isActive: true,
  },
  {
    id: '6',
    modelName: 'GLM-4 Plus',
    modelId: 'glm-4-plus',
    primaryProvider: 'ZAI',
    fallbackProvider: 'OpenAI',
    priority: 3,
    isActive: true,
  },
  {
    id: '7',
    modelName: 'Gemini 1.5 Pro',
    modelId: 'gemini-1-5-pro',
    primaryProvider: 'OpenRouter',
    fallbackProvider: 'Anthropic',
    priority: 2,
    isActive: true,
  },
  {
    id: '8',
    modelName: 'Llama 3.1 405B',
    modelId: 'llama-3-1-405b',
    primaryProvider: 'OpenRouter',
    fallbackProvider: 'xAI',
    priority: 3,
    isActive: false,
  },
  {
    id: '9',
    modelName: 'Mistral Large 2',
    modelId: 'mistral-large-2',
    primaryProvider: 'OpenRouter',
    fallbackProvider: 'Anthropic',
    priority: 2,
    isActive: true,
  },
  {
    id: '10',
    modelName: 'DeepSeek V3',
    modelId: 'deepseek-v3',
    primaryProvider: 'ZAI',
    fallbackProvider: 'OpenRouter',
    priority: 3,
    isActive: true,
  },
]

const generateFailoverEvents = (): FailoverEvent[] => {
  const events: FailoverEvent[] = []
  const models = ['GPT-4o', 'Claude 3.5 Sonnet', 'Grok-2', 'GLM-4 Plus', 'Gemini 1.5 Pro']
  const providers = ['OpenAI', 'Anthropic', 'xAI', 'ZAI', 'OpenRouter']
  const reasons: ('rate_limit' | 'timeout' | 'error')[] = ['rate_limit', 'timeout', 'error']

  const now = new Date()
  for (let i = 0; i < 10; i++) {
    const fromIdx = Math.floor(Math.random() * providers.length)
    let toIdx = Math.floor(Math.random() * providers.length)
    while (toIdx === fromIdx) {
      toIdx = Math.floor(Math.random() * providers.length)
    }

    const timestamp = new Date(now.getTime() - i * (Math.random() * 1800000 + 300000))
    events.push({
      id: `event-${i}`,
      timestamp,
      model: models[Math.floor(Math.random() * models.length)],
      fromProvider: providers[fromIdx],
      toProvider: providers[toIdx],
      reason: reasons[Math.floor(Math.random() * reasons.length)],
    })
  }

  return events.toSorted((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

// Status Badge Component
const StatusBadge = ({ status }: { status: 'active' | 'degraded' | 'offline' }) => {
  const config = {
    active: {
      bg: 'bg-green-500/20',
      text: 'text-green-400',
      icon: CheckCircle2,
      label: 'Active',
    },
    degraded: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      icon: AlertTriangle,
      label: 'Degraded',
    },
    offline: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      icon: XCircle,
      label: 'Offline',
    },
  }

  const { bg, text, icon: Icon, label } = config[status]

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', bg, text)}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </span>
  )
}

// Reason Badge Component
const ReasonBadge = ({ reason }: { reason: 'rate_limit' | 'timeout' | 'error' }) => {
  const config = {
    rate_limit: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      label: 'Rate Limit',
    },
    timeout: {
      bg: 'bg-orange-500/20',
      text: 'text-orange-400',
      label: 'Timeout',
    },
    error: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      label: 'Error',
    },
  }

  const { bg, text, label } = config[reason]

  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', bg, text)}>
      {label}
    </span>
  )
}

// Stat Card Component
const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accent = false,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: { value: number; up: boolean }
  accent?: boolean
}) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-zinc-500 text-sm font-medium">{title}</p>
        <p className={cn('text-2xl font-bold mt-1', accent ? 'text-violet-400' : 'text-white')}>
          {value}
        </p>
        {subtitle && <p className="text-zinc-500 text-xs mt-1">{subtitle}</p>}
        {trend && (
          <p className={cn('text-xs mt-2 flex items-center gap-1', trend.up ? 'text-green-400' : 'text-red-400')}>
            <TrendingUp className={cn('w-3 h-3', !trend.up && 'rotate-180')} aria-hidden="true" />
            {trend.value}% from yesterday
          </p>
        )}
      </div>
      <div className={cn('p-2.5 rounded-lg', accent ? 'bg-violet-500/20' : 'bg-zinc-800')}>
        <Icon className={cn('w-5 h-5', accent ? 'text-violet-400' : 'text-zinc-400')} aria-hidden="true" />
      </div>
    </div>
  </div>
)

// Provider Card Component
const ProviderCard = ({ provider }: { provider: Provider }) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', provider.color)}>
          <Server className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-white font-semibold">{provider.name}</h3>
          <StatusBadge status={provider.status} />
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-zinc-500 text-xs mb-1">Latency</p>
        <p className={cn(
          'text-lg font-semibold',
          provider.latency < 200 ? 'text-green-400' : provider.latency < 300 ? 'text-amber-400' : 'text-red-400'
        )}>
          {provider.latency}ms
        </p>
      </div>
      <div>
        <p className="text-zinc-500 text-xs mb-1">Req/min</p>
        <p className="text-lg font-semibold text-white">
          {provider.requestsPerMinute.toLocaleString()}
        </p>
      </div>
      <div>
        <p className="text-zinc-500 text-xs mb-1">Success Rate</p>
        <p className={cn(
          'text-lg font-semibold',
          provider.successRate >= 99 ? 'text-green-400' : provider.successRate >= 95 ? 'text-amber-400' : 'text-red-400'
        )}>
          {provider.successRate}%
        </p>
      </div>
      <div>
        <p className="text-zinc-500 text-xs mb-1">Models</p>
        <p className="text-lg font-semibold text-white">{provider.modelCount}</p>
      </div>
    </div>

    <div className="mt-4 pt-4 border-t border-zinc-800">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Traffic Share</span>
        <span className="text-zinc-400 font-medium">{provider.trafficShare}%</span>
      </div>
      <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', provider.color)}
          style={{ width: `${provider.trafficShare}%` }}
        />
      </div>
    </div>
  </div>
)

// Traffic Distribution Bar Component
const TrafficDistributionBar = ({ providers }: { providers: Provider[] }) => {
  const totalShare = providers.reduce((sum, p) => sum + p.trafficShare, 0)
  
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Network className="w-5 h-5 text-violet-400" aria-hidden="true" />
          Traffic Distribution
        </h3>
        <span className="text-zinc-500 text-sm">Last 24 hours</span>
      </div>

      <div className="h-8 rounded-lg overflow-hidden flex">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={cn('h-full transition-all relative group', provider.color)}
            style={{ width: `${(provider.trafficShare / totalShare) * 100}%` }}
            aria-label={`${provider.name}: ${provider.trafficShare}%`}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                {provider.trafficShare}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        {providers.map((provider) => (
          <div key={provider.id} className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded', provider.color)} aria-hidden="true" />
            <span className="text-zinc-400 text-sm">{provider.name}</span>
            <span className="text-zinc-500 text-xs">({provider.trafficShare}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Main Component
export default function ProviderRoutingPanel({ isLoading = false }: { isLoading?: boolean }) {
  const [providers] = useState<Provider[]>(mockProviders)
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>(mockRoutingRules)
  const [failoverEvents, setFailoverEvents] = useState<FailoverEvent[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Initialize failover events
  useEffect(() => {
    setFailoverEvents(generateFailoverEvents())
  }, [])

  // Calculate stats
  const stats = {
    totalProviders: providers.length,
    activeRoutes: routingRules.filter(r => r.isActive).length,
    failoversToday: failoverEvents.filter(e => {
      const today = new Date()
      return e.timestamp.toDateString() === today.toDateString()
    }).length,
    avgLatency: Math.round(
      providers.reduce((sum, p) => sum + p.latency, 0) / providers.length
    ),
  }

  // Toggle routing rule
  const toggleRule = (ruleId: string) => {
    setRoutingRules(rules =>
      rules.map(r =>
        r.id === ruleId ? { ...r, isActive: !r.isActive } : r
      )
    )
  }

  // Refresh failover log
  const refreshFailoverLog = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setFailoverEvents(generateFailoverEvents())
      setIsRefreshing(false)
    }, 500)
  }

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) {return 'Just now'}
    if (minutes < 60) {return `${minutes}m ago`}
    if (minutes < 1440) {return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`}
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      <a href="#prp-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:rounded-md">Skip to main content</a>
      <main id="prp-main" className="bg-zinc-950 min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <GitBranch className="w-7 h-7 text-violet-400" aria-hidden="true" />
            Provider Routing
          </h1>
          <p className="text-zinc-500 mt-1">Manage AI model routing and failover configuration</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
            <Shield className="w-4 h-4" aria-hidden="true" />
            Health Check
          </button>
          <button className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
            <Zap className="w-4 h-4" aria-hidden="true" />
            Configure Routes
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Providers"
          value={stats.totalProviders}
          subtitle="3 active, 1 degraded, 1 offline"
          icon={Server}
        />
        <StatCard
          title="Active Routes"
          value={stats.activeRoutes}
          subtitle={`${routingRules.length} total configured`}
          icon={GitBranch}
          trend={{ value: 8, up: true }}
        />
        <StatCard
          title="Failovers Today"
          value={stats.failoversToday}
          subtitle="Auto-recovered"
          icon={RefreshCw}
          trend={{ value: 25, up: false }}
        />
        <StatCard
          title="Avg Latency"
          value={`${stats.avgLatency}ms`}
          subtitle="Across all providers"
          icon={Clock}
          accent
        />
      </div>

      {/* Provider Cards Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-violet-400" aria-hidden="true" />
          Provider Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {providers.map(provider => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      </div>

      {/* Traffic Distribution */}
      <TrafficDistributionBar providers={providers} />

      {/* Routing Rules Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-violet-400" aria-hidden="true" />
            Routing Rules
          </h3>
          <span className="text-zinc-500 text-sm" role="status">
            {routingRules.filter(r => r.isActive).length} of {routingRules.length} active
          </span>
        </div>

        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-4 py-3">Model</th>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-4 py-3">Primary Provider</th>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-4 py-3">Fallback Provider</th>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-4 py-3">Priority</th>
                  <th className="text-center text-zinc-400 text-xs font-medium uppercase tracking-wider px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton variant="text" className="w-24" />
                    </td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton variant="circle" className="h-6 w-6" /></td>
                    <td className="px-4 py-3 flex justify-center"><Skeleton className="h-6 w-11" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : routingRules.length === 0 ? (
          <div className="p-6">
            <ContextualEmptyState
              icon={GitBranch}
              title="No routing rules defined"
              description="Create routing rules to control how AI model requests are directed across providers."
              primaryAction={{ label: 'Create a routing rule', onClick: () => console.log('Create routing rule') }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-4 py-3">
                    Model
                  </th>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-4 py-3">
                    Primary Provider
                  </th>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-4 py-3">
                    Fallback Provider
                  </th>
                  <th className="text-left text-zinc-400 text-xs font-medium uppercase tracking-wider px-4 py-3">
                    Priority
                  </th>
                  <th className="text-center text-zinc-400 text-xs font-medium uppercase tracking-wider px-4 py-3">
                    Active
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {routingRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">{rule.modelName}</p>
                        <p className="text-zinc-500 text-xs font-mono">{rule.modelId}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-300">{rule.primaryProvider}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-3 h-3 text-zinc-600" aria-hidden="true" />
                        <span className="text-zinc-400">{rule.fallbackProvider}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold',
                        rule.priority === 1 ? 'bg-green-500/20 text-green-400' :
                        rule.priority === 2 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      )}>
                        {rule.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleRule(rule.id)}
                        aria-label={`${rule.isActive ? 'Disable' : 'Enable'} routing rule for ${rule.modelName}`}
                        aria-pressed={rule.isActive}
                        className={cn(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none',
                          rule.isActive ? 'bg-violet-600' : 'bg-zinc-700'
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                            rule.isActive ? 'translate-x-6' : 'translate-x-1'
                          )}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Failover Log */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-400" aria-hidden="true" />
            Failover Log
          </h3>
          <button
            onClick={refreshFailoverLog}
            disabled={isRefreshing}
            className="text-zinc-400 hover:text-zinc-300 text-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="divide-y divide-zinc-800" aria-live="polite" aria-atomic="false">
          {failoverEvents.map((event) => (
            <div key={event.id} className="px-4 py-3 hover:bg-zinc-800/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-zinc-500 text-sm w-24">
                    {formatTimestamp(event.timestamp)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{event.model}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-400">{event.fromProvider}</span>
                    <ArrowRight className="w-3 h-3 text-violet-400" aria-hidden="true" />
                    <span className="text-violet-400">{event.toProvider}</span>
                  </div>
                </div>
                <ReasonBadge reason={event.reason} />
              </div>
            </div>
          ))}
        </div>

        {failoverEvents.length === 0 && (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-zinc-400">No failover events recorded</p>
            <p className="text-zinc-500 text-sm mt-1">All providers operating normally</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
        <p className="text-zinc-500 text-sm">
          Last updated: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <div className="flex items-center gap-3">
          <button className="text-zinc-400 hover:text-zinc-300 text-sm flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
            <Activity className="w-4 h-4" aria-hidden="true" />
            View Metrics
          </button>
          <button className="text-zinc-400 hover:text-zinc-300 text-sm flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
            Export Logs
          </button>
        </div>
      </div>
      </main>
    </>
  )
}
