import React, { useState } from 'react';
import { Globe, Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw, ArrowRightLeft, Server, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

type RegionStatus = 'primary' | 'standby' | 'failover' | 'degraded' | 'offline';

interface Region {
  id: string;
  name: string;
  location: string;
  status: RegionStatus;
  latencyMs: number;
  requestsPerSec: number;
  errorRate: number;
  uptime: number;
  lastCheck: string;
  services: { name: string; healthy: boolean }[];
}

const MOCK_REGIONS: Region[] = [
  {
    id: 'us-west-2',
    name: 'US West (Oregon)',
    location: '45.5°N 122.7°W',
    status: 'primary',
    latencyMs: 12,
    requestsPerSec: 4821,
    errorRate: 0.02,
    uptime: 99.98,
    lastCheck: new Date(Date.now() - 30000).toISOString(),
    services: [
      { name: 'Gateway', healthy: true },
      { name: 'Agent Runtime', healthy: true },
      { name: 'Database', healthy: true },
      { name: 'Cache', healthy: true },
    ],
  },
  {
    id: 'us-east-1',
    name: 'US East (Virginia)',
    location: '37.8°N 78.0°W',
    status: 'standby',
    latencyMs: 28,
    requestsPerSec: 0,
    errorRate: 0,
    uptime: 99.95,
    lastCheck: new Date(Date.now() - 45000).toISOString(),
    services: [
      { name: 'Gateway', healthy: true },
      { name: 'Agent Runtime', healthy: true },
      { name: 'Database', healthy: true },
      { name: 'Cache', healthy: true },
    ],
  },
  {
    id: 'eu-west-1',
    name: 'EU West (Ireland)',
    location: '53.3°N 6.3°W',
    status: 'standby',
    latencyMs: 95,
    requestsPerSec: 0,
    errorRate: 0,
    uptime: 99.91,
    lastCheck: new Date(Date.now() - 60000).toISOString(),
    services: [
      { name: 'Gateway', healthy: true },
      { name: 'Agent Runtime', healthy: true },
      { name: 'Database', healthy: false },
      { name: 'Cache', healthy: true },
    ],
  },
  {
    id: 'ap-southeast-1',
    name: 'AP Southeast (Singapore)',
    location: '1.3°N 103.8°E',
    status: 'degraded',
    latencyMs: 187,
    requestsPerSec: 0,
    errorRate: 0.41,
    uptime: 97.23,
    lastCheck: new Date(Date.now() - 120000).toISOString(),
    services: [
      { name: 'Gateway', healthy: true },
      { name: 'Agent Runtime', healthy: false },
      { name: 'Database', healthy: true },
      { name: 'Cache', healthy: false },
    ],
  },
];

const STATUS_CONFIG: Record<RegionStatus, { label: string; color: string; dot: string }> = {
  primary: { label: 'Primary', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
  standby: { label: 'Standby', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', dot: 'bg-blue-400' },
  failover: { label: 'Failover', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', dot: 'bg-amber-400' },
  degraded: { label: 'Degraded', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', dot: 'bg-orange-400' },
  offline: { label: 'Offline', color: 'text-red-400 bg-red-400/10 border-red-400/20', dot: 'bg-red-400' },
};

function formatRelativeTime(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) {return `${diffSec}s ago`;}
  if (diffSec < 3600) {return `${Math.floor(diffSec / 60)}m ago`;}
  return `${Math.floor(diffSec / 3600)}h ago`;
}

function LatencyBar({ ms }: { ms: number }) {
  const max = 250;
  const pct = Math.min((ms / max) * 100, 100);
  const color = ms < 50 ? 'bg-emerald-500' : ms < 100 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--color-text-primary)] font-mono w-12 text-right">{ms}ms</span>
    </div>
  );
}

export default function MultiRegionFailoverManager() {
  const [selected, setSelected] = useState<Region>(MOCK_REGIONS[0]);
  const [failing, setFailing] = useState(false);

  const handleFailover = () => {
    setFailing(true);
    setTimeout(() => setFailing(false), 2500);
  };

  return (
    <div className="flex h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Left panel */}
      <div className="w-[340px] shrink-0 border-r border-[var(--color-border)] flex flex-col">
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-violet-400" />
            <h1 className="text-sm font-semibold">Multi-Region Failover</h1>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">Monitor regions and trigger failover</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {MOCK_REGIONS.map((region) => {
            const cfg = STATUS_CONFIG[region.status];
            const unhealthy = region.services.filter((s) => !s.healthy).length;
            return (
              <button
                key={region.id}
                type="button"
                onClick={() => setSelected(region)}
                className={cn(
                  'w-full text-left p-3 border rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                  selected.id === region.id
                    ? 'border-violet-500 bg-violet-500/5'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-1)]/50 hover:border-[var(--color-border)]'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{region.name}</span>
                  </div>
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-lg border', cfg.color)}>
                    {cfg.label}
                  </span>
                </div>
                <LatencyBar ms={region.latencyMs} />
                <div className="flex items-center justify-between mt-1.5 text-xs text-[var(--color-text-muted)]">
                  <span>{region.uptime}% uptime</span>
                  {unhealthy > 0 && (
                    <span className="flex items-center gap-1 text-orange-400">
                      <AlertTriangle className="w-3 h-3" />
                      {unhealthy} issue{unhealthy > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{selected.name}</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{selected.location} · Last checked {formatRelativeTime(selected.lastCheck)}</p>
            </div>
            <span className={cn('flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border font-medium', STATUS_CONFIG[selected.status].color)}>
              <div className={cn('w-2 h-2 rounded-full', STATUS_CONFIG[selected.status].dot)} />
              {STATUS_CONFIG[selected.status].label}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Latency', value: `${selected.latencyMs}ms`, icon: Zap, color: selected.latencyMs < 50 ? 'text-emerald-400' : selected.latencyMs < 100 ? 'text-amber-400' : 'text-red-400' },
              { label: 'Req/s', value: selected.requestsPerSec.toLocaleString(), icon: Activity, color: 'text-blue-400' },
              { label: 'Error Rate', value: `${selected.errorRate}%`, icon: XCircle, color: selected.errorRate > 0.1 ? 'text-red-400' : 'text-emerald-400' },
              { label: 'Uptime', value: `${selected.uptime}%`, icon: CheckCircle, color: selected.uptime > 99 ? 'text-emerald-400' : 'text-amber-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-3 text-center">
                <Icon className={cn('w-4 h-4 mx-auto mb-1', color)} />
                <p className={cn('text-lg font-bold', color)}>{value}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
              </div>
            ))}
          </div>

          {/* Services */}
          <div className="mb-6">
            <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Server className="w-3 h-3" />
              Services
            </p>
            <div className="grid grid-cols-2 gap-3">
              {selected.services.map((svc) => (
                <div key={svc.name} className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  svc.healthy ? 'border-emerald-800/50 bg-emerald-900/10' : 'border-red-800/50 bg-red-900/10'
                )}>
                  <span className="text-sm text-[var(--color-text-primary)]">{svc.name}</span>
                  {svc.healthy
                    ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />}
                </div>
              ))}
            </div>
          </div>

          {/* Failover actions */}
          {selected.status !== 'primary' && (
            <div className="p-4 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Promote to Primary</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Route all traffic to this region. Current primary will become standby.</p>
                </div>
                <button
                  type="button"
                  onClick={handleFailover}
                  disabled={failing || selected.status === 'offline'}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                    failing
                      ? 'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] cursor-not-allowed'
                      : 'bg-violet-600 hover:bg-violet-500 text-[var(--color-text-primary)]'
                  )}
                >
                  {failing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  )}
                  {failing ? 'Switching…' : 'Failover'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
