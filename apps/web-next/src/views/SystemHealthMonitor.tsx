import { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  Globe,
  Info,
  Layers,
  Power,
  RefreshCcw,
  Server,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type ServiceStatus = 'UP' | 'DEGRADED' | 'DOWN';
type OverallStatus = 'Healthy' | 'Degraded' | 'Critical';

interface Service {
  name: string;
  status: ServiceStatus;
  uptime: number; // percentage
  latency: number[]; // last 10 readings in ms
  lastError?: string;
}

interface Provider {
  name: string;
  used: number;
  limit: number;
  resetsAt: string; // timestamp
  rpm: number; // requests per minute
}

interface GatewayMetrics {
  activeSessions: number;
  memoryUsage: number; // MB
  cpu: number; // percentage
  uptime: string; // formatted
  restartCount: number;
}

interface Incident {
  timestamp: Date;
  service: string;
  description: string;
  resolved: boolean;
}

type HeatmapDay = { date: Date; status: ServiceStatus };

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_SERVICES: Service[] = [
  {
    name: 'Gateway',
    status: 'UP',
    uptime: 99.98,
    latency: [120, 115, 130, 118, 125, 122, 119, 128, 116, 123],
  },
  {
    name: 'Slack',
    status: 'UP',
    uptime: 100.0,
    latency: [80, 82, 78, 85, 79, 81, 83, 77, 84, 80],
  },
  {
    name: 'GitHub',
    status: 'DEGRADED',
    uptime: 95.2,
    latency: [250, 280, 300, 260, 290, 270, 310, 255, 285, 265],
    lastError: 'API rate limit warning - 80% capacity',
  },
  {
    name: 'Anthropic API',
    status: 'UP',
    uptime: 99.9,
    latency: [150, 145, 155, 148, 152, 149, 153, 147, 154, 151],
  },
  {
    name: 'OpenAI API',
    status: 'DEGRADED',
    uptime: 97.5,
    latency: [200, 210, 220, 205, 215, 208, 218, 203, 213, 209],
    lastError: 'Intermittent timeouts on vision endpoints',
  },
  {
    name: 'xAI API',
    status: 'UP',
    uptime: 99.99,
    latency: [90, 88, 92, 89, 91, 87, 93, 86, 94, 90],
  },
  {
    name: 'MiniMax API',
    status: 'DOWN',
    uptime: 0.0,
    latency: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    lastError: 'Service outage - maintenance in progress',
  },
  {
    name: 'ZAI API',
    status: 'UP',
    uptime: 99.8,
    latency: [110, 105, 115, 108, 112, 109, 113, 107, 114, 111],
  },
];

const MOCK_PROVIDERS: Provider[] = [
  {
    name: 'Anthropic',
    used: 4200,
    limit: 5000,
    resetsAt: '2024-02-23T03:00:00Z',
    rpm: 45,
  },
  {
    name: 'OpenAI',
    used: 18500,
    limit: 20000,
    resetsAt: '2024-02-23T04:00:00Z',
    rpm: 120,
  },
  {
    name: 'xAI',
    used: 280,
    limit: 1000,
    resetsAt: '2024-02-23T05:00:00Z',
    rpm: 15,
  },
  {
    name: 'MiniMax',
    used: 0,
    limit: 500,
    resetsAt: '2024-02-23T06:00:00Z',
    rpm: 0,
  },
  {
    name: 'ZAI',
    used: 1500,
    limit: 2000,
    resetsAt: '2024-02-23T07:00:00Z',
    rpm: 30,
  },
];

const MOCK_GATEWAY: GatewayMetrics = {
  activeSessions: 12,
  memoryUsage: 1568, // MB
  cpu: 42.5,
  uptime: '2d 14h 23m',
  restartCount: 3,
};

const MOCK_INCIDENTS: Incident[] = [
  {
    timestamp: new Date(Date.now() - 3600000), // 1 hour ago
    service: 'GitHub',
    description: 'Rate limit exceeded - automatic backoff triggered',
    resolved: true,
  },
  {
    timestamp: new Date(Date.now() - 7200000), // 2 hours ago
    service: 'OpenAI API',
    description: 'Endpoint timeout - retried successfully',
    resolved: true,
  },
  {
    timestamp: new Date(Date.now() - 18000000), // 5 hours ago
    service: 'MiniMax API',
    description: 'Service unavailable - emergency maintenance',
    resolved: false,
  },
];

// Generate 30-day heatmap mock data per service
function generateHeatmap(service: string): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    // Mock status based on service
    let status: ServiceStatus = 'UP';
    if (service === 'GitHub' && Math.random() < 0.1) status = 'DEGRADED';
    if (service === 'OpenAI API' && Math.random() < 0.05) status = 'DEGRADED';
    if (service === 'MiniMax API' && i < 5) status = 'DOWN';
    days.push({ date, status });
  }
  return days;
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
}

function formatUptime(uptime: number): string {
  return `${uptime.toFixed(2)}%`;
}

function getStatusColor(status: ServiceStatus): string {
  switch (status) {
    case 'UP': return 'text-green-400 bg-green-500/15 border-green-500/30';
    case 'DEGRADED': return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    case 'DOWN': return 'text-red-400 bg-red-500/15 border-red-500/30';
  }
}

function getOverallStatus(health: number): OverallStatus {
  if (health > 90) return 'Healthy';
  if (health > 70) return 'Degraded';
  return 'Critical';
}

function getRingColor(health: number): string {
  if (health > 90) return 'text-green-400';
  if (health > 70) return 'text-amber-400';
  return 'text-red-400';
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusBadge({ status }: { status: ServiceStatus | OverallStatus }) {
  const isOverall = ['Healthy', 'Degraded', 'Critical'].includes(status);
  const color = isOverall 
    ? status === 'Healthy' ? 'bg-green-500/15 text-green-400' 
      : status === 'Degraded' ? 'bg-amber-500/15 text-amber-400' 
      : 'bg-red-500/15 text-red-400'
    : getStatusColor(status as ServiceStatus);

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium', color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', 
        status === 'UP' || status === 'Healthy' ? 'bg-green-500' :
        status === 'DEGRADED' ? 'bg-amber-500' :
        'bg-red-500'
      )} />
      {status}
    </span>
  );
}

function Sparkline({ data, color = 'stroke-green-400' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1); // Avoid div by zero
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (v / max) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="w-full h-6" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const color = getStatusColor(service.status);
  const sparkColor = service.status === 'UP' ? 'stroke-green-400' : 
                     service.status === 'DEGRADED' ? 'stroke-amber-400' : 
                     'stroke-red-400';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">{service.name}</span>
        <StatusBadge status={service.status} />
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <TrendingUp className="w-3 h-3" />
        Uptime: {formatUptime(service.uptime)}
      </div>
      <div className="mt-1">
        <Sparkline data={service.latency} color={sparkColor} />
      </div>
      {service.lastError && (
        <div className="flex items-start gap-2 text-xs text-red-400">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{service.lastError}</span>
        </div>
      )}
    </div>
  );
}

function ProviderRow({ provider }: { provider: Provider }) {
  const usagePct = (provider.used / provider.limit) * 100;
  const color = usagePct > 90 ? 'text-red-400' : usagePct > 70 ? 'text-amber-400' : 'text-green-400';

  return (
    <tr className="border-b border-zinc-800/50 last:border-0">
      <td className="py-3 px-4 text-sm text-white">{provider.name}</td>
      <td className="py-3 px-4 text-sm text-zinc-300">
        {provider.used}/{provider.limit} 
        <span className="text-xs text-zinc-500"> ({usagePct.toFixed(1)}%)</span>
      </td>
      <td className="py-3 px-4 text-sm text-zinc-300">{provider.rpm} RPM</td>
      <td className="py-3 px-4 text-sm text-zinc-500">{formatTimestamp(new Date(provider.resetsAt))}</td>
    </tr>
  );
}

function IncidentRow({ incident }: { incident: Incident }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 last:border-0">
      <span className="text-xs text-zinc-500 whitespace-nowrap">{formatTimestamp(incident.timestamp)}</span>
      <span className="text-xs font-medium text-white min-w-[100px]">{incident.service}</span>
      <span className="flex-1 text-xs text-zinc-300">{incident.description}</span>
      <StatusBadge status={incident.resolved ? 'UP' : 'DEGRADED'} />
    </div>
  );
}

function Heatmap({ days }: { days: HeatmapDay[] }) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {days.map((day, i) => (
        <div 
          key={i}
          className={cn(
            'w-3 h-3 rounded-sm',
            day.status === 'UP' ? 'bg-green-500' :
            day.status === 'DEGRADED' ? 'bg-amber-500' :
            'bg-red-500',
            'opacity-80'
          )}
          title={formatTimestamp(day.date)}
        />
      ))}
    </div>
  );
}

function HeatmapPanel({ services }: { services: Service[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-white">30-Day Uptime History</span>
      </div>
      <div className="space-y-3">
        {services.map((service) => (
          <div key={service.name} className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 min-w-[100px]">{service.name}</span>
            <Heatmap days={generateHeatmap(service.name)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function SystemHealthMonitor() {
  const [lastChecked, setLastChecked] = useState(new Date());
  const [healthScore, setHealthScore] = useState(85); // Mock degraded

  useEffect(() => {
    const interval = setInterval(() => {
      setLastChecked(new Date());
      // Mock slight fluctuations
      setHealthScore(84 + Math.floor(Math.random() * 3));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const overallStatus = getOverallStatus(healthScore);
  const ringColor = getRingColor(healthScore);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">System Health</h1>
          <StatusBadge status={overallStatus} />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Last checked: {formatTimestamp(lastChecked)}
          </span>
          <button className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2">
            <RefreshCcw className="w-4 h-4" />
            Run Diagnostics
          </button>
        </div>
      </div>

      {/* Overall Health Score */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center justify-center">
        <div className="relative">
          <svg className="w-32 h-32" viewBox="0 0 100 100">
            <circle 
              cx="50" cy="50" r="45" 
              strokeWidth="10" 
              stroke="rgba(255,255,255,0.1)" 
              fill="none" 
            />
            <circle 
              cx="50" cy="50" r="45" 
              strokeWidth="10" 
              stroke="currentColor"
              fill="none"
              className={ringColor}
              strokeDasharray={`${(healthScore / 100) * 283} 283`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">{healthScore}%</span>
          </div>
        </div>
      </div>

      {/* Service Status Grid */}
      <div className="grid grid-cols-4 gap-4">
        {MOCK_SERVICES.map((service) => (
          <ServiceCard key={service.name} service={service} />
        ))}
      </div>

      {/* API Providers Panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Globe className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-white">API Providers</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide border-b border-zinc-800">
              <th className="py-2 px-4">Provider</th>
              <th className="py-2 px-4">Usage</th>
              <th className="py-2 px-4">Rate</th>
              <th className="py-2 px-4">Resets</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PROVIDERS.map((provider) => (
              <ProviderRow key={provider.name} provider={provider} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Gateway Metrics */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Active Sessions" value={MOCK_GATEWAY.activeSessions} icon={Layers} />
        <StatCard label="Memory Usage" value={`${MOCK_GATEWAY.memoryUsage} MB`} icon={Database} />
        <StatCard label="CPU" value={`${MOCK_GATEWAY.cpu}%`} icon={Cpu} />
        <StatCard label="Uptime" value={MOCK_GATEWAY.uptime} icon={Clock} />
        <StatCard label="Restarts" value={MOCK_GATEWAY.restartCount} icon={RefreshCcw} />
      </div>

      {/* Recent Incidents */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Recent Incidents</span>
        </div>
        <div>
          {MOCK_INCIDENTS.map((incident, i) => (
            <IncidentRow key={i} incident={incident} />
          ))}
        </div>
      </div>

      {/* Uptime Heatmap */}
      <HeatmapPanel services={MOCK_SERVICES} />
    </div>
  );
}

// Missing icon import added here for HeatmapPanel
import { Calendar } from 'lucide-react';

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
      <div className="mt-0.5 p-2 bg-zinc-800 rounded-lg">
        <Icon className="w-4 h-4 text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">{label}</p>
        <span className="text-xl font-bold text-white">{value}</span>
      </div>
    </div>
  );
}
