import { useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  ChevronDown,
  Clock,
  Database,
  Gauge,
  Globe,
  Hash,
  Layers,
  Link2,
  RefreshCw,
  Route,
  Server,
  Settings,
  Shield,
  Signal,
  SignalSlash,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type ProviderStatus = 'active' | 'degraded' | 'offline';

interface Provider {
  id: string;
  name: string;
  logo: string;
  status: ProviderStatus;
  latency: number;
  reqPerMin: number;
  maxRpm: number;
  fallbackEnabled: boolean;
  models: string[];
  region: string;
}

interface RoutingRule {
  id: string;
  model: string;
  primaryProvider: string;
  fallbackProvider: string;
  priority: number;
  weight: number;
  enabled: boolean;
  conditions: string[];
}

interface FailoverEvent {
  id: string;
  timestamp: Date;
  model: string;
  fromProvider: string;
  toProvider: string;
  reason: string;
  latency: number;
  recovered: boolean;
}

interface TrafficData {
  provider: string;
  requests: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

interface Stats {
  totalProviders: number;
  activeProviders: number;
  activeRoutes: number;
  failoversToday: number;
  avgLatency: number;
  totalRequests: number;
}

// ============================================================================
// Mock Data Generation
// ============================================================================

const PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    logo: '🔵',
    status: 'active',
    latency: 245,
    reqPerMin: 450,
    maxRpm: 500,
    fallbackEnabled: true,
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini'],
    region: 'us-east-1',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    logo: '🟠',
    status: 'active',
    latency: 312,
    reqPerMin: 280,
    maxRpm: 300,
    fallbackEnabled: true,
    models: ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3'],
    region: 'us-west-2',
  },
  {
    id: 'xai',
    name: 'xAI',
    logo: '⚡',
    status: 'active',
    latency: 189,
    reqPerMin: 620,
    maxRpm: 800,
    fallbackEnabled: true,
    models: ['grok-4', 'grok-4-beta', 'grok-2-vision'],
    region: 'us-central-1',
  },
  {
    id: 'zai',
    name: 'ZAI',
    logo: '🟣',
    status: 'degraded',
    latency: 478,
    reqPerMin: 120,
    maxRpm: 200,
    fallbackEnabled: true,
    models: ['glm-5', 'glm-4-flash', 'glm-4-plus'],
    region: 'ap-south-1',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    logo: '🌐',
    status: 'active',
    latency: 298,
    reqPerMin: 340,
    maxRpm: 400,
    fallbackEnabled: false,
    models: ['openrouter/*'],
    region: 'eu-west-1',
  },
];

const ROUTING_RULES: RoutingRule[] = [
  {
    id: '1',
    model: 'claude-opus-4',
    primaryProvider: 'Anthropic',
    fallbackProvider: 'OpenRouter',
    priority: 1,
    weight: 100,
    enabled: true,
    conditions: ['latency < 500ms', 'cost < $0.02/1k tokens'],
  },
  {
    id: '2',
    model: 'gpt-4o',
    primaryProvider: 'OpenAI',
    fallbackProvider: 'OpenRouter',
    priority: 2,
    weight: 100,
    enabled: true,
    conditions: ['latency < 400ms', 'availability > 99%'],
  },
  {
    id: '3',
    model: 'grok-4',
    primaryProvider: 'xAI',
    fallbackProvider: 'OpenAI',
    priority: 3,
    weight: 100,
    enabled: true,
    conditions: ['latency < 300ms'],
  },
  {
    id: '4',
    model: 'glm-5',
    primaryProvider: 'ZAI',
    fallbackProvider: 'OpenRouter',
    priority: 4,
    weight: 80,
    enabled: true,
    conditions: ['cost < $0.01/1k tokens'],
  },
  {
    id: '5',
    model: 'claude-sonnet-4',
    primaryProvider: 'Anthropic',
    fallbackProvider: 'OpenRouter',
    priority: 5,
    weight: 100,
    enabled: true,
    conditions: ['latency < 450ms'],
  },
  {
    id: '6',
    model: 'o1',
    primaryProvider: 'OpenAI',
    fallbackProvider: 'Anthropic',
    priority: 6,
    weight: 100,
    enabled: true,
    conditions: ['reasoning mode'],
  },
  {
    id: '7',
    model: 'grok-2-vision',
    primaryProvider: 'xAI',
    fallbackProvider: 'OpenRouter',
    priority: 7,
    weight: 60,
    enabled: false,
    conditions: ['vision mode'],
  },
  {
    id: '8',
    model: 'default',
    primaryProvider: 'xAI',
    fallbackProvider: 'OpenAI',
    priority: 99,
    weight: 100,
    enabled: true,
    conditions: [],
  },
];

const FAILOVER_EVENTS: FailoverEvent[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 120000),
    model: 'glm-5',
    fromProvider: 'ZAI',
    toProvider: 'OpenRouter',
    reason: 'High latency (1200ms)',
    latency: 1200,
    recovered: false,
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 300000),
    model: 'gpt-4o',
    fromProvider: 'OpenAI',
    toProvider: 'OpenRouter',
    reason: 'Rate limit exceeded',
    latency: 45,
    recovered: true,
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 600000),
    model: 'claude-opus-4',
    fromProvider: 'Anthropic',
    toProvider: 'OpenRouter',
    reason: 'Connection timeout',
    latency: 30000,
    recovered: true,
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 900000),
    model: 'grok-4',
    fromProvider: 'xAI',
    toProvider: 'OpenAI',
    reason: '503 Service Unavailable',
    latency: 500,
    recovered: true,
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 1200000),
    model: 'glm-5',
    fromProvider: 'ZAI',
    toProvider: 'OpenRouter',
    reason: 'High latency (980ms)',
    latency: 980,
    recovered: false,
  },
  {
    id: '6',
    timestamp: new Date(Date.now() - 1800000),
    model: 'claude-sonnet-4',
    fromProvider: 'Anthropic',
    toProvider: 'OpenRouter',
    reason: 'High error rate (15%)',
    latency: 890,
    recovered: true,
  },
  {
    id: '7',
    timestamp: new Date(Date.now() - 2400000),
    model: 'gpt-4o-mini',
    fromProvider: 'OpenAI',
    toProvider: 'OpenRouter',
    reason: 'Maintenance window',
    latency: 120,
    recovered: true,
  },
  {
    id: '8',
    timestamp: new Date(Date.now() - 3600000),
    model: 'grok-4-beta',
    fromProvider: 'xAI',
    toProvider: 'OpenAI',
    reason: 'Model unavailable',
    latency: 340,
    recovered: true,
  },
  {
    id: '9',
    timestamp: new Date(Date.now() - 4200000),
    model: 'glm-4-flash',
    fromProvider: 'ZAI',
    toProvider: 'OpenRouter',
    reason: 'High latency (750ms)',
    latency: 750,
    recovered: true,
  },
  {
    id: '10',
    timestamp: new Date(Date.now() - 5400000),
    model: 'o1-mini',
    fromProvider: 'OpenAI',
    toProvider: 'Anthropic',
    reason: 'Circuit breaker triggered',
    latency: 2500,
    recovered: true,
  },
];

const TRAFFIC_DATA: TrafficData[] = [
  { provider: 'xAI', requests: 12450, percentage: 34.2, trend: 'up' },
  { provider: 'OpenAI', requests: 9870, percentage: 27.1, trend: 'stable' },
  { provider: 'OpenRouter', requests: 7580, percentage: 20.8, trend: 'up' },
  { provider: 'Anthropic', requests: 4620, percentage: 12.7, trend: 'down' },
  { provider: 'ZAI', requests: 1680, percentage: 5.2, trend: 'down' },
];

function generateMockStats(): Stats {
  return {
    totalProviders: 5,
    activeProviders: 4,
    activeRoutes: 7,
    failoversToday: 10,
    avgLatency: 284,
    totalRequests: 36200,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toString();
}

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getStatusColor(status: ProviderStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-500';
    case 'degraded':
      return 'bg-amber-500';
    case 'offline':
      return 'bg-red-500';
  }
}

function getStatusTextColor(status: ProviderStatus): string {
  switch (status) {
    case 'active':
      return 'text-green-400';
    case 'degraded':
      return 'text-amber-400';
    case 'offline':
      return 'text-red-400';
  }
}

function getLatencyColor(latency: number): string {
  if (latency < 250) return 'text-green-400';
  if (latency < 400) return 'text-amber-400';
  return 'text-red-400';
}

// ============================================================================
// Sub-components
// ============================================================================

function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'stable';
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-400">{title}</span>
        <Icon className="w-4 h-4 text-violet-400" />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {trend && (
          <span
            className={cn(
              'text-xs mb-1',
              trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-400',
            )}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
    </div>
  );
}

function ProviderCard({ provider }: { provider: Provider }) {
  const utilization = (provider.reqPerMin / provider.maxRpm) * 100;
  const utilizationColor = utilization < 50 ? 'bg-green-500' : utilization < 75 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{provider.logo}</span>
          <div>
            <h3 className="font-semibold text-white">{provider.name}</h3>
            <p className="text-xs text-zinc-500">{provider.region}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', getStatusColor(provider.status))} />
          <span className={cn('text-xs font-medium capitalize', getStatusTextColor(provider.status))}>
            {provider.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
            <Timer className="w-3 h-3" />
            <span>Latency</span>
          </div>
          <span className={cn('text-sm font-medium', getLatencyColor(provider.latency))}>
            {formatLatency(provider.latency)}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
            <Gauge className="w-3 h-3" />
            <span>Req/min</span>
          </div>
          <span className="text-sm font-medium text-white">{provider.reqPerMin}</span>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
            <Activity className="w-3 h-3" />
            <span>Max</span>
          </div>
          <span className="text-sm font-medium text-zinc-400">{provider.maxRpm}</span>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-zinc-500">Utilization</span>
          <span className="text-zinc-400">{utilization.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all', utilizationColor)}
            style={{ width: `${utilization}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {provider.models.slice(0, 3).map((model) => (
          <span
            key={model}
            className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400"
          >
            {model}
          </span>
        ))}
        {provider.models.length > 3 && (
          <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-500">
            +{provider.models.length - 3}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-1 text-xs">
          <Link2 className="w-3 h-3 text-zinc-500" />
          <span className={cn(provider.fallbackEnabled ? 'text-green-400' : 'text-zinc-500')}>
            Fallback {provider.fallbackEnabled ? 'ON' : 'OFF'}
          </span>
        </div>
        <button className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
          <Settings className="w-3 h-3" />
          Configure
        </button>
      </div>
    </div>
  );
}

function TrafficChart({ data }: { data: TrafficData[] }) {
  const maxRequests = Math.max(...data.map((d) => d.requests));
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-sky-500', 'bg-amber-500', 'bg-red-500'];
  const totalRequests = data.reduce((sum, d) => sum + d.requests, 0);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-violet-400" />
          Traffic Distribution
        </h3>
        <span className="text-xs text-zinc-500">{formatNumber(totalRequests)} total</span>
      </div>

      {/* Horizontal Bar Chart */}
      <div className="space-y-3 mb-4">
        {data.map((item, index) => (
          <div key={item.provider} className="group">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-zinc-400">{item.provider}</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{formatNumber(item.requests)}</span>
                <span className="text-zinc-500">({item.percentage}%)</span>
                {item.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-400" />}
                {item.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
                {item.trend === 'stable' && <Activity className="w-3 h-3 text-zinc-500" />}
              </div>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn('h-full transition-all', colors[index])}
                style={{ width: `${(item.requests / maxRequests) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Pie Chart SVG */}
      <div className="flex items-center justify-center">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            {data.reduce(
              (acc, item, index) => {
                const offset = acc.offset;
                const percentage = item.percentage / 100;
                const dashArray = percentage * 100;
                acc.elements.push(
                  <circle
                    key={item.provider}
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="transparent"
                    stroke={index === 0 ? '#8b5cf6' : index === 1 ? '#3b82f6' : index === 2 ? '#0ea5e9' : index === 3 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="4"
                    strokeDasharray={`${dashArray} ${100 - dashArray}`}
                    strokeDashoffset={100 - offset * 100}
                  />,
                );
                acc.offset += percentage;
                return acc;
              },
              { elements: [] as React.ReactNode[], offset: 0 },
            ).elements}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{formatNumber(totalRequests)}</div>
              <div className="text-xs text-zinc-500">reqs</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="ml-4 space-y-1">
          {data.map((item, index) => (
            <div key={item.provider} className="flex items-center gap-2 text-xs">
              <div
                className={cn('w-2 h-2 rounded-full', colors[index])}
              />
              <span className="text-zinc-400">{item.provider}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoutingRulesTable({ rules }: { rules: RoutingRule[] }) {
  const [sortBy, setSortBy] = useState<'priority' | 'model'>('priority');

  const sortedRules = [...rules].sort((a, b) => {
    if (sortBy === 'priority') return a.priority - b.priority;
    return a.model.localeCompare(b.model);
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Route className="w-4 h-4 text-violet-400" />
          Request Routing Rules
        </h3>
        <button className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
          <Settings className="w-3 h-3" />
          Manage
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800">
              <th className="pb-2 font-medium">Priority</th>
              <th className="pb-2 font-medium">Model</th>
              <th className="pb-2 font-medium">Primary</th>
              <th className="pb-2 font-medium">Fallback</th>
              <th className="pb-2 font-medium">Weight</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedRules.map((rule) => (
              <tr
                key={rule.id}
                className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50"
              >
                <td className="py-2 text-zinc-400">#{rule.priority}</td>
                <td className="py-2">
                  <span className="text-white font-medium">{rule.model}</span>
                </td>
                <td className="py-2">
                  <span className="text-violet-400">{rule.primaryProvider}</span>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-1">
                    <ArrowDown className="w-3 h-3 text-zinc-500" />
                    <span className="text-zinc-400">{rule.fallbackProvider}</span>
                  </div>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500"
                        style={{ width: `${rule.weight}%` }}
                      />
                    </div>
                    <span className="text-zinc-400">{rule.weight}%</span>
                  </div>
                </td>
                <td className="py-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      rule.enabled ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-400',
                    )}
                  >
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FailoverLog({ events }: { events: FailoverEvent[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-amber-400" />
          Failover Log
        </h3>
        <span className="text-xs text-zinc-500">Last 10 events</span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {events.map((event) => (
          <div
            key={event.id}
            className={cn(
              'p-3 rounded-lg border',
              event.recovered
                ? 'bg-zinc-800/30 border-zinc-800'
                : 'bg-red-500/10 border-red-500/30',
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white">{event.model}</span>
                <ArrowRight className="w-3 h-3 text-zinc-500" />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-red-400">{event.fromProvider}</span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-500" />
                  <span className="text-xs text-green-400">{event.toProvider}</span>
                </div>
              </div>
              <span className="text-xs text-zinc-500">{formatTimeSince(event.timestamp)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">{event.reason}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Latency: {formatLatency(event.latency)}</span>
                {event.recovered ? (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-400" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthIndicator() {
  const [health] = useState({
    uptime: 99.94,
    errors: 0.12,
    p99: 450,
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-400" />
          System Health
        </h3>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-400">Operational</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-lg font-bold text-green-400">{health.uptime}%</div>
          <div className="text-xs text-zinc-500">Uptime</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-amber-400">{health.errors}%</div>
          <div className="text-xs text-zinc-500">Error Rate</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-violet-400">{health.p99}ms</div>
          <div className="text-xs text-zinc-500">P99 Latency</div>
        </div>
      </div>
    </div>
  );
}

function RegionStatus() {
  const regions = [
    { name: 'us-east-1', status: 'active', latency: 180 },
    { name: 'us-west-2', status: 'active', latency: 220 },
    { name: 'eu-west-1', status: 'active', latency: 290 },
    { name: 'ap-south-1', status: 'degraded', latency: 450 },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-sky-400" />
          Region Status
        </h3>
      </div>

      <div className="space-y-2">
        {regions.map((region) => (
          <div key={region.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-3 h-3 text-zinc-500" />
              <span className="text-xs text-zinc-400">{region.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs', getLatencyColor(region.latency))}>
                {region.latency}ms
              </span>
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  region.status === 'active' ? 'bg-green-500' : 'bg-amber-500',
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CircuitBreakerStatus() {
  const breakers = [
    { provider: 'ZAI', state: 'open', failures: 3, threshold: 5 },
    { provider: 'OpenAI', state: 'closed', failures: 0, threshold: 5 },
    { provider: 'Anthropic', state: 'half-open', failures: 2, threshold: 5 },
    { provider: 'xAI', state: 'closed', failures: 0, threshold: 5 },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Hash className="w-4 h-4 text-rose-400" />
          Circuit Breakers
        </h3>
      </div>

      <div className="space-y-2">
        {breakers.map((breaker) => (
          <div key={breaker.provider} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">{breaker.provider}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: breaker.threshold }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      i < breaker.failures
                        ? breaker.state === 'open'
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                        : 'bg-zinc-700',
                    )}
                  />
                ))}
              </div>
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded',
                  breaker.state === 'open'
                    ? 'bg-red-500/20 text-red-400'
                    : breaker.state === 'half-open'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-green-500/20 text-green-400',
                )}
              >
                {breaker.state}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ProviderRoutingPanel() {
  const [stats] = useState<Stats>(generateMockStats());

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Route className="w-6 h-6 text-violet-400" />
              Provider Routing
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              AI model request routing, failover management, and traffic distribution
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Clock className="w-4 h-4" />
              Last updated: {new Date().toLocaleTimeString()}
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors">
              <Settings className="w-4 h-4" />
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-6 gap-4">
        <StatsCard
          title="Total Providers"
          value={stats.totalProviders}
          subtitle={`${stats.activeProviders} active`}
          icon={Server}
        />
        <StatsCard
          title="Active Routes"
          value={stats.activeRoutes}
          subtitle="Configured"
          icon={Route}
        />
        <StatsCard
          title="Failovers Today"
          value={stats.failoversToday}
          subtitle="+2 from yesterday"
          trend="up"
          icon={RefreshCw}
        />
        <StatsCard
          title="Avg Latency"
          value={`${stats.avgLatency}ms`}
          subtitle="-12ms from avg"
          trend="down"
          icon={Timer}
        />
        <StatsCard
          title="Total Requests"
          value={formatNumber(stats.totalRequests)}
          subtitle="This hour"
          icon={Users}
        />
        <StatsCard
          title="Success Rate"
          value="99.88%"
          subtitle="Last 24h"
          trend="stable"
          icon={CheckCircle}
        />
      </div>

      {/* Provider Cards */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-violet-400" />
          Provider Status
        </h2>
        <div className="grid grid-cols-5 gap-4">
          {PROVIDERS.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      </div>

      {/* Traffic & Rules */}
      <div className="grid grid-cols-2 gap-6">
        <TrafficChart data={TRAFFIC_DATA} />
        <RoutingRulesTable rules={ROUTING_RULES} />
      </div>

      {/* Failover & Health */}
      <div className="grid grid-cols-3 gap-6">
        <FailoverLog events={FAILOVER_EVENTS} />
        <HealthIndicator />
        <CircuitBreakerStatus />
      </div>

      {/* Regions */}
      <div className="grid grid-cols-2 gap-6">
        <RegionStatus />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Signal className="w-4 h-4 text-blue-400" />
              Real-time Metrics
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Requests/sec</div>
              <div className="text-xl font-bold text-white">124.5</div>
              <div className="text-xs text-green-400">+8.2%</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Error/sec</div>
              <div className="text-xl font-bold text-white">0.14</div>
              <div className="text-xs text-red-400">+0.02</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Active Connections</div>
              <div className="text-xl font-bold text-white">1,847</div>
              <div className="text-xs text-green-400">+156</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Queue Depth</div>
              <div className="text-xl font-bold text-white">12</div>
              <div className="text-xs text-zinc-400">Stable</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
