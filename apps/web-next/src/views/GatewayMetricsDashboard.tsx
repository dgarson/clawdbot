import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  RefreshCw,
  Server,
  Zap,
  BarChart2,
  TrendingUp,
  TrendingDown,
  WifiOff,
  CircleDot,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type GatewayStatus = 'healthy' | 'degraded' | 'down';
type MetricTrend = 'up' | 'down' | 'stable';

interface GatewayNode {
  id: string;
  name: string;
  region: string;
  status: GatewayStatus;
  requestsPerSec: number;
  latencyP50: number;
  latencyP99: number;
  errorRate: number;
  uptimePercent: number;
}

interface MetricSnapshot {
  timestamp: number;
  totalRps: number;
  avgLatency: number;
  errorRate: number;
  activeConnections: number;
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  nodeId: string;
  timestamp: Date;
  resolved: boolean;
}

// ============================================================================
// Config
// ============================================================================

const STATUS_CONFIG: Record<GatewayStatus, { label: string; color: string; bg: string; dotColor: string }> = {
  healthy: { label: 'Healthy', color: 'text-green-400', bg: 'bg-green-400/10', dotColor: 'bg-green-400' },
  degraded: { label: 'Degraded', color: 'text-amber-400', bg: 'bg-amber-400/10', dotColor: 'bg-amber-400' },
  down: { label: 'Down', color: 'text-red-400', bg: 'bg-red-400/10', dotColor: 'bg-red-400' },
};

const ALERT_SEVERITY: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-400/10' },
  warning: { label: 'Warning', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  info: { label: 'Info', color: 'text-blue-400', bg: 'bg-blue-400/10' },
};

// ============================================================================
// Mock Data + Generators
// ============================================================================

const GATEWAY_NODES: GatewayNode[] = [
  { id: 'gw1', name: 'Gateway US-East', region: 'us-east-1', status: 'healthy', requestsPerSec: 1247, latencyP50: 48, latencyP99: 142, errorRate: 0.12, uptimePercent: 99.98 },
  { id: 'gw2', name: 'Gateway US-West', region: 'us-west-2', status: 'healthy', requestsPerSec: 843, latencyP50: 52, latencyP99: 158, errorRate: 0.08, uptimePercent: 99.99 },
  { id: 'gw3', name: 'Gateway EU-Central', region: 'eu-central-1', status: 'degraded', requestsPerSec: 612, latencyP50: 89, latencyP99: 412, errorRate: 2.14, uptimePercent: 98.71 },
  { id: 'gw4', name: 'Gateway AP-Southeast', region: 'ap-southeast-1', status: 'healthy', requestsPerSec: 389, latencyP50: 67, latencyP99: 198, errorRate: 0.31, uptimePercent: 99.95 },
  { id: 'gw5', name: 'Gateway SA-East', region: 'sa-east-1', status: 'down', requestsPerSec: 0, latencyP50: 0, latencyP99: 0, errorRate: 100, uptimePercent: 94.2 },
];

const INITIAL_ALERTS: Alert[] = [
  { id: 'al1', severity: 'critical', message: 'Gateway SA-East is unreachable. Failover activated.', nodeId: 'gw5', timestamp: new Date(Date.now() - 420000), resolved: false },
  { id: 'al2', severity: 'warning', message: 'EU-Central P99 latency exceeded 400ms threshold for >5 min.', nodeId: 'gw3', timestamp: new Date(Date.now() - 780000), resolved: false },
  { id: 'al3', severity: 'warning', message: 'EU-Central error rate is 2.14%, above 1% SLA threshold.', nodeId: 'gw3', timestamp: new Date(Date.now() - 900000), resolved: false },
  { id: 'al4', severity: 'info', message: 'US-East auto-scaled from 4 to 6 instances to handle load spike.', nodeId: 'gw1', timestamp: new Date(Date.now() - 1800000), resolved: true },
];

function generateMetricHistory(): MetricSnapshot[] {
  const now = Date.now();
  return Array.from({ length: 20 }, (_, i) => ({
    timestamp: now - (19 - i) * 15000,
    totalRps: 2800 + Math.floor(Math.sin(i * 0.5) * 200 + Math.random() * 100),
    avgLatency: 62 + Math.floor(Math.sin(i * 0.3) * 15 + Math.random() * 8),
    errorRate: 0.4 + Math.sin(i * 0.7) * 0.2 + Math.random() * 0.1,
    activeConnections: 4200 + Math.floor(Math.random() * 500),
  }));
}

// ============================================================================
// Helpers
// ============================================================================

function formatRps(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) { return 'just now'; }
  if (mins < 60) { return `${mins}m ago`; }
  return `${Math.floor(mins / 60)}h ago`;
}

// ============================================================================
// StatusBadge — text + dot (not color-only)
// ============================================================================

function GatewayStatusBadge({ status }: { status: GatewayStatus }) {
  const { label, color, bg, dotColor } = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', bg, color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} aria-hidden="true" />
      {label}
    </span>
  );
}

// ============================================================================
// SparkBar — simple ASCII-style bar for metric history
// ============================================================================

function SparkBar({ values, max, label }: { values: number[]; max: number; label: string }) {
  return (
    <div
      className="flex items-end gap-px h-8"
      role="img"
      aria-label={`${label} trend chart — last 20 readings`}
    >
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-primary/60 rounded-sm transition-all"
          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// MetricCard
// ============================================================================

function MetricCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  sparkValues,
  sparkMax,
  status,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend: MetricTrend;
  trendValue: string;
  sparkValues: number[];
  sparkMax: number;
  status?: 'good' | 'warn' | 'bad';
}) {
  const statusColor = status === 'good' ? 'text-green-400' : status === 'warn' ? 'text-amber-400' : status === 'bad' ? 'text-red-400' : 'text-[var(--color-text-primary)]';
  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : CircleDot;
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-[var(--color-text-secondary)]';

  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide font-medium mb-2" id={`metric-${label.replace(/\s+/g, '-').toLowerCase()}`}>{label}</div>
      {/* aria-atomic="true" + aria-label ensure the full value (number + unit) is announced atomically — WCAG 4.1.3 */}
      <div
        className={cn('text-2xl font-bold mb-1', statusColor)}
        aria-atomic="true"
        aria-label={`${label}: ${value}${unit ? ' ' + unit : ''}`}
      >
        {value}{unit && <span className="text-base font-normal text-[var(--color-text-secondary)] ml-0.5">{unit}</span>}
      </div>
      <div className="flex items-center gap-1 text-xs mb-3">
        <TrendIcon className={cn('w-3 h-3', trendColor)} aria-hidden="true" />
        {/* trendValue conveys direction in text (e.g. "+42 req/s", "▲ vs prev") — color is supplemental */}
        <span className={trendColor}>{trendValue}</span>
      </div>
      <SparkBar values={sparkValues} max={sparkMax} label={label} />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function GatewayMetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricSnapshot[]>(() => generateMetricHistory());
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const doRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setMetrics((prev) => {
        const last = prev[prev.length - 1];
        const next: MetricSnapshot = {
          timestamp: Date.now(),
          totalRps: Math.max(2000, (last.totalRps ?? 2800) + Math.floor((Math.random() - 0.5) * 200)),
          avgLatency: Math.max(30, (last.avgLatency ?? 62) + Math.floor((Math.random() - 0.5) * 10)),
          errorRate: Math.max(0, (last.errorRate ?? 0.4) + (Math.random() - 0.5) * 0.2),
          activeConnections: Math.max(3000, (last.activeConnections ?? 4200) + Math.floor((Math.random() - 0.5) * 300)),
        };
        return [...prev.slice(1), next];
      });
      setLastUpdated(new Date());
      setRefreshing(false);
      setStatusMessage('Metrics refreshed');
      setTimeout(() => setStatusMessage(''), 2000);
    }, 600);
  }, []);

  useEffect(() => {
    if (!autoRefresh) { return; }
    const interval = setInterval(doRefresh, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, doRefresh]);

  const latest = metrics[metrics.length - 1];
  const prev = metrics[metrics.length - 2];

  const totalHealthy = GATEWAY_NODES.filter((n) => n.status === 'healthy').length;
  const totalDegraded = GATEWAY_NODES.filter((n) => n.status === 'degraded').length;
  const totalDown = GATEWAY_NODES.filter((n) => n.status === 'down').length;
  const unresolvedAlerts = alerts.filter((a) => !a.resolved).length;

  return (
    <>
      {/* Skip link — WCAG 2.4.1 */}
      <a
        href="#gateway-metrics-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-[var(--color-text-primary)] focus:rounded-lg focus:font-medium focus:outline-none"
      >
        Skip to main content
      </a>

      <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
        <main id="gateway-metrics-main" className="p-6 space-y-6 max-w-7xl mx-auto">

          {/* Live status announcements — WCAG 4.1.3 */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {statusMessage}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <Activity className="w-6 h-6 text-primary" aria-hidden="true" />
                Gateway Metrics Dashboard
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                Real-time performance and health monitoring across all gateway nodes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-[var(--color-surface-3)] bg-[var(--color-surface-2)] text-primary focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                />
                Auto-refresh (15s)
              </label>
              <button
                onClick={doRefresh}
                disabled={refreshing}
                aria-label={refreshing ? 'Refreshing metrics…' : 'Refresh metrics now'}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary text-[var(--color-text-primary)] rounded-lg font-medium text-sm disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              >
                <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} aria-hidden="true" />
                Refresh
              </button>
            </div>
          </div>

          {/* Last-updated live region */}
          <div
            aria-live="polite"
            aria-label={`Last updated: ${lastUpdated.toLocaleTimeString()}`}
            className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5"
          >
            <Clock className="w-3 h-3" aria-hidden="true" />
            Last updated: <time dateTime={lastUpdated.toISOString()}>{lastUpdated.toLocaleTimeString()}</time>
            {autoRefresh && <span className="text-[var(--color-text-muted)]">· auto-refresh on</span>}
          </div>

          {/* Fleet overview */}
          <section aria-label="Fleet health overview">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Nodes', value: GATEWAY_NODES.length, icon: Server, color: 'text-[var(--color-text-primary)]' },
                { label: 'Healthy', value: totalHealthy, icon: CheckCircle2, color: 'text-green-400' },
                { label: 'Degraded', value: totalDegraded, icon: AlertTriangle, color: 'text-amber-400' },
                { label: 'Down', value: totalDown, icon: WifiOff, color: 'text-red-400' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-4">
                  <div className={cn('p-2.5 rounded-lg bg-[var(--color-surface-2)]', color)}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</div>
                    <div className={cn('text-2xl font-bold mt-0.5', color)}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Real-time metrics */}
          <section aria-label="Real-time metrics" aria-live="polite">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" aria-hidden="true" />
              Live Metrics
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <MetricCard
                label="Total RPS"
                value={formatRps(latest.totalRps)}
                trend={latest.totalRps > prev.totalRps ? 'up' : 'down'}
                trendValue={`${latest.totalRps > prev.totalRps ? '+' : ''}${latest.totalRps - prev.totalRps} req/s`}
                sparkValues={metrics.map((m) => m.totalRps)}
                sparkMax={4000}
                status="good"
              />
              <MetricCard
                label="Avg Latency"
                value={latest.avgLatency}
                unit="ms"
                trend={latest.avgLatency > prev.avgLatency ? 'up' : 'down'}
                trendValue={`${latest.avgLatency > prev.avgLatency ? '+' : ''}${latest.avgLatency - prev.avgLatency}ms vs prev`}
                sparkValues={metrics.map((m) => m.avgLatency)}
                sparkMax={200}
                status={latest.avgLatency < 80 ? 'good' : latest.avgLatency < 150 ? 'warn' : 'bad'}
              />
              <MetricCard
                label="Error Rate"
                value={latest.errorRate.toFixed(2)}
                unit="%"
                trend={latest.errorRate > prev.errorRate ? 'up' : 'down'}
                trendValue={`${latest.errorRate > prev.errorRate ? '▲' : '▼'} vs prev interval`}
                sparkValues={metrics.map((m) => m.errorRate * 10)}
                sparkMax={30}
                status={latest.errorRate < 0.5 ? 'good' : latest.errorRate < 2 ? 'warn' : 'bad'}
              />
              <MetricCard
                label="Active Connections"
                value={formatRps(latest.activeConnections)}
                trend="stable"
                trendValue="within normal range"
                sparkValues={metrics.map((m) => m.activeConnections)}
                sparkMax={5000}
                status="good"
              />
            </div>
          </section>

          {/* Node table */}
          <section aria-label="Gateway node health table">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" aria-hidden="true" />
              Node Health
            </h2>
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Gateway node health — {GATEWAY_NODES.length} nodes</caption>
                  <thead className="bg-[var(--color-surface-2)]/50">
                    <tr>
                      <th scope="col" className="text-left text-[var(--color-text-secondary)] font-medium px-4 py-3">Node</th>
                      <th scope="col" className="text-left text-[var(--color-text-secondary)] font-medium px-4 py-3">Region</th>
                      <th scope="col" className="text-left text-[var(--color-text-secondary)] font-medium px-4 py-3">Status</th>
                      <th scope="col" className="text-right text-[var(--color-text-secondary)] font-medium px-4 py-3">RPS</th>
                      <th scope="col" className="text-right text-[var(--color-text-secondary)] font-medium px-4 py-3">P50 Latency</th>
                      <th scope="col" className="text-right text-[var(--color-text-secondary)] font-medium px-4 py-3">P99 Latency</th>
                      <th scope="col" className="text-right text-[var(--color-text-secondary)] font-medium px-4 py-3">Error Rate</th>
                      <th scope="col" className="text-right text-[var(--color-text-secondary)] font-medium px-4 py-3">Uptime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/50">
                    {GATEWAY_NODES.map((node) => (
                      <tr
                        key={node.id}
                        className={cn(
                          'hover:bg-[var(--color-surface-2)]/30 transition-colors',
                          node.status === 'down' && 'opacity-60'
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" aria-hidden="true" />
                            <span className="font-medium text-[var(--color-text-primary)]">{node.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-[var(--color-text-secondary)]">{node.region}</code>
                        </td>
                        <td className="px-4 py-3">
                          <GatewayStatusBadge status={node.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[var(--color-text-primary)] font-medium">{node.status === 'down' ? '—' : formatRps(node.requestsPerSec)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'font-medium',
                            node.latencyP50 === 0 ? 'text-[var(--color-text-muted)]' :
                            node.latencyP50 < 60 ? 'text-green-400' :
                            node.latencyP50 < 100 ? 'text-amber-400' : 'text-red-400'
                          )}>
                            {node.status === 'down' ? '—' : `${node.latencyP50}ms`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'font-medium',
                            node.latencyP99 === 0 ? 'text-[var(--color-text-muted)]' :
                            node.latencyP99 < 200 ? 'text-green-400' :
                            node.latencyP99 < 400 ? 'text-amber-400' : 'text-red-400'
                          )}>
                            {node.status === 'down' ? '—' : `${node.latencyP99}ms`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {/* Error rate: color + text value, not color-only */}
                          <span className={cn(
                            'font-medium',
                            node.status === 'down' ? 'text-red-400' :
                            node.errorRate < 0.5 ? 'text-green-400' :
                            node.errorRate < 2 ? 'text-amber-400' : 'text-red-400'
                          )}>
                            {node.status === 'down' ? '100%' : `${node.errorRate}%`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'font-medium',
                            node.uptimePercent >= 99.9 ? 'text-green-400' :
                            node.uptimePercent >= 99 ? 'text-amber-400' : 'text-red-400'
                          )}>
                            {node.uptimePercent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Alerts */}
          <section aria-label="Active alerts" aria-live="polite" aria-relevant="additions">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" aria-hidden="true" />
                Alerts
                {unresolvedAlerts > 0 && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">
                    {unresolvedAlerts} active
                  </span>
                )}
              </h2>
            </div>

            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]/50">
              {alerts.length === 0 ? (
                <div className="px-4 py-6 text-center text-[var(--color-text-muted)] text-sm">No alerts</div>
              ) : (
                alerts.map((alert) => {
                  const sev = ALERT_SEVERITY[alert.severity];
                  return (
                    <div
                      key={alert.id}
                      className={cn('px-4 py-3 flex items-start gap-3', alert.resolved && 'opacity-50')}
                    >
                      <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 mt-0.5', sev.bg, sev.color)}>
                        {/* Text label, not just color */}
                        {sev.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--color-text-primary)]">{alert.message}</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{timeAgo(alert.timestamp)}</p>
                      </div>
                      {!alert.resolved && (
                        <button
                          onClick={() => setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, resolved: true } : a))}
                          aria-label={`Dismiss alert: ${alert.message}`}
                          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2 py-1 rounded border border-[var(--color-border)] hover:border-[var(--color-surface-3)] flex-shrink-0 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                        >
                          Dismiss
                        </button>
                      )}
                      {alert.resolved && (
                        <span className="text-xs text-green-400 flex items-center gap-1 flex-shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Resolved
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Throughput trends summary */}
          <section aria-label="Throughput and latency trends">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" aria-hidden="true" />
              Trend Summary (last 5 min)
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  label: 'Requests per Second',
                  values: metrics.slice(-10).map((m) => m.totalRps),
                  peak: Math.max(...metrics.map((m) => m.totalRps)),
                  unit: 'req/s',
                  icon: TrendingUp,
                },
                {
                  label: 'Average Latency',
                  values: metrics.slice(-10).map((m) => m.avgLatency),
                  peak: Math.max(...metrics.map((m) => m.avgLatency)),
                  unit: 'ms',
                  icon: TrendingDown,
                },
              ].map(({ label, values, peak, unit, icon: Icon }) => (
                <div key={label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                      <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                      {label}
                    </h3>
                    <span className="text-xs text-[var(--color-text-muted)]">Peak: {peak} {unit}</span>
                  </div>
                  <SparkBar values={values} max={peak * 1.2} label={label} />
                  <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                    <span>5 min ago</span>
                    <span>now</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </main>
      </div>
    </>
  );
}
