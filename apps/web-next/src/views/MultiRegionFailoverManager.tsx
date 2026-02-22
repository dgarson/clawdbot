import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type RegionStatus = "primary" | "standby" | "failed" | "degraded";
type FailoverTrigger = "auto" | "manual";
type FailoverOutcome = "success" | "failed" | "partial";
type TabId = "regions" | "events" | "metrics" | "config";

interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  current: number;
}

interface RegionMetrics {
  latency: LatencyMetrics;
  errorRate: number;
  requestVolume: number;
  uptime: number;
  healthScore: number;
}

interface FailoverEvent {
  id: string;
  timestamp: string;
  fromRegion: string;
  toRegion: string;
  trigger: FailoverTrigger;
  durationSeconds: number;
  outcome: FailoverOutcome;
  reason: string;
}

interface Region {
  id: string;
  name: string;
  displayName: string;
  status: RegionStatus;
  metrics: RegionMetrics;
  failoverHistory: FailoverEvent[];
  lastChecked: string;
  replicaCount: number;
  healthyReplicas: number;
}

interface FailoverConfig {
  autoFailoverEnabled: boolean;
  healthCheckIntervalSeconds: number;
  minimumHealthyReplicas: number;
  failoverThresholdPercent: number;
  notifyEmail: boolean;
  notifyPagerDuty: boolean;
  notifySlack: boolean;
}

interface ManualFailoverState {
  open: boolean;
  confirmed: boolean;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const FAILOVER_EVENTS: FailoverEvent[] = [
  {
    id: "fe-001",
    timestamp: "2026-02-20T14:23:11Z",
    fromRegion: "us-east-1",
    toRegion: "eu-west-1",
    trigger: "auto",
    durationSeconds: 34,
    outcome: "success",
    reason: "Error rate exceeded threshold (12.4%)",
  },
  {
    id: "fe-002",
    timestamp: "2026-02-18T09:05:42Z",
    fromRegion: "ap-southeast-1",
    toRegion: "us-east-1",
    trigger: "manual",
    durationSeconds: 61,
    outcome: "success",
    reason: "Planned maintenance window",
  },
  {
    id: "fe-003",
    timestamp: "2026-02-15T22:47:08Z",
    fromRegion: "eu-west-1",
    toRegion: "us-west-2",
    trigger: "auto",
    durationSeconds: 28,
    outcome: "success",
    reason: "Network partition detected",
  },
  {
    id: "fe-004",
    timestamp: "2026-02-12T03:14:55Z",
    fromRegion: "us-west-2",
    toRegion: "us-east-1",
    trigger: "auto",
    durationSeconds: 102,
    outcome: "partial",
    reason: "Latency spike exceeded 2000ms",
  },
  {
    id: "fe-005",
    timestamp: "2026-02-08T16:30:22Z",
    fromRegion: "us-east-1",
    toRegion: "ap-southeast-1",
    trigger: "manual",
    durationSeconds: 45,
    outcome: "failed",
    reason: "Capacity test — destination not ready",
  },
  {
    id: "fe-006",
    timestamp: "2026-02-01T11:58:03Z",
    fromRegion: "eu-west-1",
    toRegion: "us-east-1",
    trigger: "auto",
    durationSeconds: 22,
    outcome: "success",
    reason: "Health check failure (3 consecutive)",
  },
];

const REGIONS: Region[] = [
  {
    id: "us-east-1",
    name: "us-east-1",
    displayName: "US East (N. Virginia)",
    status: "primary",
    metrics: {
      latency: { p50: 12, p95: 45, p99: 89, current: 18 },
      errorRate: 0.4,
      requestVolume: 142800,
      uptime: 99.97,
      healthScore: 97,
    },
    failoverHistory: [FAILOVER_EVENTS[0], FAILOVER_EVENTS[3], FAILOVER_EVENTS[5]],
    lastChecked: "2026-02-22T07:04:51Z",
    replicaCount: 5,
    healthyReplicas: 5,
  },
  {
    id: "eu-west-1",
    name: "eu-west-1",
    displayName: "EU West (Ireland)",
    status: "standby",
    metrics: {
      latency: { p50: 18, p95: 62, p99: 115, current: 24 },
      errorRate: 0.7,
      requestVolume: 88400,
      uptime: 99.91,
      healthScore: 92,
    },
    failoverHistory: [FAILOVER_EVENTS[0], FAILOVER_EVENTS[2]],
    lastChecked: "2026-02-22T07:04:48Z",
    replicaCount: 3,
    healthyReplicas: 3,
  },
  {
    id: "ap-southeast-1",
    name: "ap-southeast-1",
    displayName: "AP Southeast (Singapore)",
    status: "degraded",
    metrics: {
      latency: { p50: 38, p95: 142, p99: 380, current: 210 },
      errorRate: 3.8,
      requestVolume: 54200,
      uptime: 99.2,
      healthScore: 61,
    },
    failoverHistory: [FAILOVER_EVENTS[1], FAILOVER_EVENTS[4]],
    lastChecked: "2026-02-22T07:04:44Z",
    replicaCount: 3,
    healthyReplicas: 2,
  },
  {
    id: "us-west-2",
    name: "us-west-2",
    displayName: "US West (Oregon)",
    status: "standby",
    metrics: {
      latency: { p50: 14, p95: 51, p99: 98, current: 16 },
      errorRate: 0.5,
      requestVolume: 71600,
      uptime: 99.94,
      healthScore: 95,
    },
    failoverHistory: [FAILOVER_EVENTS[2], FAILOVER_EVENTS[3]],
    lastChecked: "2026-02-22T07:04:50Z",
    replicaCount: 3,
    healthyReplicas: 3,
  },
];

const DEFAULT_CONFIG: FailoverConfig = {
  autoFailoverEnabled: true,
  healthCheckIntervalSeconds: 30,
  minimumHealthyReplicas: 2,
  failoverThresholdPercent: 5,
  notifyEmail: true,
  notifyPagerDuty: true,
  notifySlack: false,
};

const ERROR_SPARKLINES: Record<string, number[]> = {
  "us-east-1": [0.3, 0.4, 0.2, 0.5, 0.4, 0.3, 0.6, 0.4, 0.3, 0.4, 0.4, 0.4],
  "eu-west-1": [0.5, 0.8, 0.6, 0.7, 0.9, 0.6, 0.8, 0.7, 0.6, 0.7, 0.7, 0.7],
  "ap-southeast-1": [1.2, 2.1, 3.4, 2.8, 4.1, 3.9, 3.2, 3.8, 4.0, 3.5, 3.8, 3.8],
  "us-west-2": [0.4, 0.3, 0.5, 0.4, 0.6, 0.5, 0.4, 0.5, 0.5, 0.4, 0.5, 0.5],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: RegionStatus): string {
  switch (status) {
    case "primary":   return "text-emerald-400";
    case "standby":   return "text-indigo-400";
    case "failed":    return "text-rose-400";
    case "degraded":  return "text-amber-400";
  }
}

function statusBadgeClass(status: RegionStatus): string {
  switch (status) {
    case "primary":   return "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20";
    case "standby":   return "bg-indigo-400/10 text-indigo-400 border border-indigo-400/20";
    case "failed":    return "bg-rose-400/10 text-rose-400 border border-rose-400/20";
    case "degraded":  return "bg-amber-400/10 text-amber-400 border border-amber-400/20";
  }
}

function outcomeBadgeClass(outcome: FailoverOutcome): string {
  switch (outcome) {
    case "success":   return "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20";
    case "failed":    return "bg-rose-400/10 text-rose-400 border border-rose-400/20";
    case "partial":   return "bg-amber-400/10 text-amber-400 border border-amber-400/20";
  }
}

function healthBarColor(score: number): string {
  if (score >= 90) return "bg-emerald-400";
  if (score >= 70) return "bg-amber-400";
  return "bg-rose-400";
}

function statusDotClass(status: RegionStatus): string {
  switch (status) {
    case "primary":   return "bg-emerald-400";
    case "standby":   return "bg-indigo-400";
    case "failed":    return "bg-rose-400";
    case "degraded":  return "bg-amber-400";
  }
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatVolume(v: number): string {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

// ── Primitive Components ──────────────────────────────────────────────────────

interface HealthBarProps {
  score: number;
}

function HealthBar({ score }: HealthBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", healthBarColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-zinc-400 w-8 text-right">{score}%</span>
    </div>
  );
}

interface LatencyBarProps {
  label: string;
  value: number;
  maxValue: number;
}

function LatencyBar({ label, value, maxValue }: LatencyBarProps) {
  const pct = Math.min(100, Math.round((value / maxValue) * 100));
  const barColor = value > 200 ? "bg-rose-400" : value > 80 ? "bg-amber-400" : "bg-indigo-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-zinc-800 rounded overflow-hidden">
        <div
          className={cn("h-full rounded flex items-center px-2 transition-all", barColor)}
          style={{ width: `${pct}%` }}
        >
          {pct > 15 && (
            <span className="text-xs font-medium text-white whitespace-nowrap">{value}ms</span>
          )}
        </div>
      </div>
      {pct <= 15 && (
        <span className="text-xs text-zinc-300 w-12">{value}ms</span>
      )}
    </div>
  );
}

interface ErrorSparklineProps {
  values: number[];
}

function ErrorSparkline({ values }: ErrorSparklineProps) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => {
        const heightPct = Math.max(4, Math.round((v / max) * 100));
        const barColor = v > 3 ? "bg-rose-400" : v > 1 ? "bg-amber-400" : "bg-emerald-400";
        return (
          <div
            key={i}
            className={cn("flex-1 rounded-sm", barColor)}
            style={{ height: `${heightPct}%` }}
            title={`${v}%`}
          />
        );
      })}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900",
        checked ? "bg-indigo-500" : "bg-zinc-600"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

interface TabButtonProps {
  id: TabId;
  label: string;
  active: boolean;
  onClick: (id: TabId) => void;
}

function TabButton({ id, label, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-indigo-500 text-white"
          : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
      )}
    >
      {label}
    </button>
  );
}

// ── Regions Tab ───────────────────────────────────────────────────────────────

function RegionsTab() {
  const [selectedId, setSelectedId] = useState<string>(REGIONS[0].id);
  const selected: Region = REGIONS.find((r) => r.id === selectedId) ?? REGIONS[0];

  return (
    <div className="flex gap-4">
      {/* Sidebar list */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        {REGIONS.map((region) => (
          <button
            key={region.id}
            type="button"
            onClick={() => setSelectedId(region.id)}
            className={cn(
              "text-left p-3 rounded-lg border transition-colors",
              selectedId === region.id
                ? "border-indigo-500 bg-zinc-800"
                : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-white">{region.name}</span>
              <span className={cn("text-xs px-1.5 py-0.5 rounded uppercase font-semibold tracking-wide", statusBadgeClass(region.status))}>
                {region.status}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-2">{region.displayName}</p>
            <HealthBar score={region.metrics.healthScore} />
            <div className="flex gap-3 mt-2 text-xs text-zinc-400">
              <span>{region.metrics.latency.current}ms</span>
              <span className={region.metrics.errorRate > 2 ? "text-rose-400" : "text-zinc-400"}>
                {region.metrics.errorRate}% err
              </span>
              <span>{formatVolume(region.metrics.requestVolume)}/m</span>
            </div>
          </button>
        ))}
      </div>

      {/* Detail panel */}
      <div className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 rounded-lg p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">{selected.displayName}</h2>
            <p className="text-sm text-zinc-400 font-mono">{selected.name}</p>
          </div>
          <span className={cn("text-xs px-2 py-1 rounded uppercase font-bold tracking-wide", statusBadgeClass(selected.status))}>
            {selected.status}
          </span>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Latency p50", value: `${selected.metrics.latency.p50}ms`, warn: false },
            { label: "Latency p95", value: `${selected.metrics.latency.p95}ms`, warn: false },
            { label: "Latency p99", value: `${selected.metrics.latency.p99}ms`, warn: selected.metrics.latency.p99 > 200 },
            { label: "Error Rate",  value: `${selected.metrics.errorRate}%`,    warn: selected.metrics.errorRate > 2 },
            { label: "Request Vol", value: `${formatVolume(selected.metrics.requestVolume)}/m`, warn: false },
            { label: "Uptime",      value: `${selected.metrics.uptime}%`,       warn: selected.metrics.uptime < 99.5 },
          ].map((m) => (
            <div key={m.label} className="bg-zinc-800 rounded-md p-3">
              <p className="text-xs text-zinc-400 mb-1">{m.label}</p>
              <p className={cn("text-lg font-semibold", m.warn ? "text-rose-400" : "text-white")}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Health bars */}
        <div className="mb-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Health Overview</h3>
          <div className="flex flex-col gap-2.5">
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Overall Health Score</span>
                <span>{selected.metrics.healthScore}%</span>
              </div>
              <HealthBar score={selected.metrics.healthScore} />
            </div>
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Healthy Replicas</span>
                <span>{selected.healthyReplicas} / {selected.replicaCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${(selected.healthyReplicas / selected.replicaCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-8 text-right">
                  {Math.round((selected.healthyReplicas / selected.replicaCount) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mb-5">
          {selected.status !== "primary" && (
            <button
              type="button"
              className="px-3 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
            >
              Promote to Primary
            </button>
          )}
          <button
            type="button"
            className="px-3 py-2 text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors"
          >
            Initiate Failover
          </button>
          <div className="flex-1" />
          <p className="text-xs text-zinc-500">
            Last checked: {formatTimestamp(selected.lastChecked)}
          </p>
        </div>

        {/* Failover history */}
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Failover History</h3>
          {selected.failoverHistory.length === 0 ? (
            <p className="text-sm text-zinc-500">No failover events for this region.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {selected.failoverHistory.map((evt) => (
                <div key={evt.id} className="flex items-center gap-3 bg-zinc-800 rounded-md px-3 py-2 text-xs">
                  <span className="text-zinc-400 w-40 shrink-0">{formatTimestamp(evt.timestamp)}</span>
                  <span className="text-zinc-300">{evt.fromRegion} → {evt.toRegion}</span>
                  <span className={cn("px-1.5 py-0.5 rounded uppercase font-semibold ml-auto shrink-0", outcomeBadgeClass(evt.outcome))}>
                    {evt.outcome}
                  </span>
                  <span className="text-zinc-400 shrink-0">{formatDuration(evt.durationSeconds)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Failover Events Tab ───────────────────────────────────────────────────────

function FailoverEventsTab() {
  const [failoverState, setFailoverState] = useState<ManualFailoverState>({
    open: false,
    confirmed: false,
  });

  function openModal() {
    setFailoverState({ open: true, confirmed: false });
  }

  function closeModal() {
    setFailoverState({ open: false, confirmed: false });
  }

  function confirmFailover() {
    setFailoverState({ open: true, confirmed: true });
    const timer = setTimeout(() => {
      setFailoverState({ open: false, confirmed: false });
    }, 1800);
    return timer;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-white">Failover Event History</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{FAILOVER_EVENTS.length} events recorded</p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="px-3 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-colors"
        >
          Trigger Manual Failover
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-700">
              <th className="pb-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide pr-4">Timestamp</th>
              <th className="pb-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide pr-4">From</th>
              <th className="pb-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide pr-4">To</th>
              <th className="pb-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide pr-4">Trigger</th>
              <th className="pb-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide pr-4">Duration</th>
              <th className="pb-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide pr-4">Outcome</th>
              <th className="pb-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">Reason</th>
            </tr>
          </thead>
          <tbody>
            {FAILOVER_EVENTS.map((evt) => (
              <tr key={evt.id} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                <td className="py-3 pr-4 text-zinc-300 text-xs whitespace-nowrap">{formatTimestamp(evt.timestamp)}</td>
                <td className="py-3 pr-4 text-white font-mono text-xs">{evt.fromRegion}</td>
                <td className="py-3 pr-4 text-white font-mono text-xs">{evt.toRegion}</td>
                <td className="py-3 pr-4">
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded uppercase font-semibold",
                    evt.trigger === "auto"
                      ? "bg-zinc-700 text-zinc-300"
                      : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  )}>
                    {evt.trigger}
                  </span>
                </td>
                <td className="py-3 pr-4 text-zinc-300 text-xs">{formatDuration(evt.durationSeconds)}</td>
                <td className="py-3 pr-4">
                  <span className={cn("text-xs px-1.5 py-0.5 rounded uppercase font-semibold", outcomeBadgeClass(evt.outcome))}>
                    {evt.outcome}
                  </span>
                </td>
                <td className="py-3 text-zinc-400 text-xs">{evt.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {failoverState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-1">Confirm Manual Failover</h3>
            <p className="text-sm text-zinc-400 mb-4">
              This will initiate a failover from{" "}
              <span className="text-white font-medium">ap-southeast-1</span> to{" "}
              <span className="text-white font-medium">us-east-1</span>. This action cannot be undone immediately.
            </p>

            <div className="bg-zinc-800 rounded-lg p-3 mb-5 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">Source region</span>
                <span className="text-white font-mono text-xs">ap-southeast-1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Target region</span>
                <span className="text-white font-mono text-xs">us-east-1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Trigger type</span>
                <span className="text-indigo-400">manual</span>
              </div>
            </div>

            {failoverState.confirmed ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm py-2">
                <span className="text-base">✓</span>
                <span>Failover initiated successfully</span>
              </div>
            ) : (
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { confirmFailover(); }}
                  className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-colors font-medium"
                >
                  Confirm Failover
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Health Metrics Tab ────────────────────────────────────────────────────────

function HealthMetricsTab() {
  const maxP99 = Math.max(...REGIONS.map((r) => r.metrics.latency.p99));
  const chartMax = maxP99 * 1.15;

  return (
    <div className="flex flex-col gap-5">
      {/* p99 Latency bar chart */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-1">p99 Latency by Region</h3>
        <p className="text-xs text-zinc-500 mb-4">Higher is worse — threshold: 200ms</p>
        <div className="flex flex-col gap-3">
          {REGIONS.map((r) => (
            <LatencyBar
              key={r.id}
              label={r.name}
              value={r.metrics.latency.p99}
              maxValue={chartMax}
            />
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-500" />
            Normal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />
            Elevated
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-400" />
            Critical
          </span>
        </div>
      </div>

      {/* Error rate sparklines */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Error Rate Trend</h3>
        <p className="text-xs text-zinc-500 mb-4">Last 12 health-check intervals</p>
        <div className="grid grid-cols-2 gap-4">
          {REGIONS.map((r) => {
            const sparkData: number[] = ERROR_SPARKLINES[r.id] ?? [];
            const current: number = sparkData.length > 0 ? (sparkData[sparkData.length - 1] ?? 0) : 0;
            const currentColor = current > 3
              ? "text-rose-400"
              : current > 1
                ? "text-amber-400"
                : "text-emerald-400";
            return (
              <div key={r.id} className="bg-zinc-800 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white font-medium">{r.name}</span>
                  <span className={cn("text-sm font-semibold", currentColor)}>{current}%</span>
                </div>
                <ErrorSparkline values={sparkData} />
                <p className="text-xs text-zinc-500 mt-1.5">Current error rate</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Percentile summary table */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Latency Percentile Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="pb-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide pr-6">Region</th>
                <th className="pb-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wide pr-6">p50</th>
                <th className="pb-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wide pr-6">p95</th>
                <th className="pb-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wide pr-6">p99</th>
                <th className="pb-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wide pr-6">Current</th>
                <th className="pb-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wide pr-6">Err Rate</th>
                <th className="pb-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {REGIONS.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 pr-6 text-white font-mono text-xs">{r.name}</td>
                  <td className="py-3 pr-6 text-right text-zinc-300 text-sm">{r.metrics.latency.p50}ms</td>
                  <td className="py-3 pr-6 text-right text-zinc-300 text-sm">{r.metrics.latency.p95}ms</td>
                  <td className={cn("py-3 pr-6 text-right font-semibold text-sm", r.metrics.latency.p99 > 200 ? "text-rose-400" : "text-zinc-300")}>
                    {r.metrics.latency.p99}ms
                  </td>
                  <td className="py-3 pr-6 text-right text-zinc-300 text-sm">{r.metrics.latency.current}ms</td>
                  <td className={cn("py-3 pr-6 text-right text-sm font-medium", r.metrics.errorRate > 2 ? "text-rose-400" : r.metrics.errorRate > 1 ? "text-amber-400" : "text-emerald-400")}>
                    {r.metrics.errorRate}%
                  </td>
                  <td className="py-3 text-right">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded uppercase font-semibold", statusBadgeClass(r.status))}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Config Tab ────────────────────────────────────────────────────────────────

function ConfigTab() {
  const [config, setConfig] = useState<FailoverConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState<boolean>(false);

  function updateBoolean(key: keyof FailoverConfig, value: boolean) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function updateNumber(key: keyof FailoverConfig, value: number) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const intervalOptions: number[] = [10, 15, 30, 60, 120];
  const replicaOptions: number[] = [1, 2, 3, 4, 5];

  return (
    <div className="max-w-xl flex flex-col gap-5">
      {/* Failover Policy */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Failover Policy</h3>
        <div className="flex flex-col gap-5">
          {/* Auto-failover */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white">Auto-Failover</p>
              <p className="text-xs text-zinc-400 mt-0.5">Automatically trigger failover when thresholds are exceeded</p>
            </div>
            <Toggle
              checked={config.autoFailoverEnabled}
              onChange={(v) => updateBoolean("autoFailoverEnabled", v)}
            />
          </div>

          {/* Health check interval */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white">Health Check Interval</p>
              <p className="text-xs text-zinc-400 mt-0.5">How often to poll each region's health endpoint</p>
            </div>
            <select
              value={config.healthCheckIntervalSeconds}
              onChange={(e) => updateNumber("healthCheckIntervalSeconds", Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-600 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {intervalOptions.map((s) => (
                <option key={s} value={s}>{s}s</option>
              ))}
            </select>
          </div>

          {/* Min healthy replicas */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white">Min Healthy Replicas</p>
              <p className="text-xs text-zinc-400 mt-0.5">Minimum replicas that must be healthy before failover triggers</p>
            </div>
            <select
              value={config.minimumHealthyReplicas}
              onChange={(e) => updateNumber("minimumHealthyReplicas", Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-600 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {replicaOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Failover threshold */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white">Failover Threshold</p>
              <p className="text-xs text-zinc-400 mt-0.5">Error rate % that triggers automatic failover</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                value={config.failoverThresholdPercent}
                onChange={(e) => updateNumber("failoverThresholdPercent", Number(e.target.value))}
                className="w-16 bg-zinc-800 border border-zinc-600 text-white text-sm rounded-md px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm text-zinc-400">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Notification Preferences</h3>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white">Email</p>
              <p className="text-xs text-zinc-400 mt-0.5">Send failover alerts to configured email addresses</p>
            </div>
            <Toggle
              checked={config.notifyEmail}
              onChange={(v) => updateBoolean("notifyEmail", v)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white">PagerDuty</p>
              <p className="text-xs text-zinc-400 mt-0.5">Trigger PagerDuty incidents on critical failover events</p>
            </div>
            <Toggle
              checked={config.notifyPagerDuty}
              onChange={(v) => updateBoolean("notifyPagerDuty", v)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white">Slack</p>
              <p className="text-xs text-zinc-400 mt-0.5">Post failover notifications to configured Slack channels</p>
            </div>
            <Toggle
              checked={config.notifySlack}
              onChange={(v) => updateBoolean("notifySlack", v)}
            />
          </div>
        </div>
      </div>

      {/* Current config summary */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Active Configuration</h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <span className="text-zinc-400">Auto-failover</span>
          <span className={config.autoFailoverEnabled ? "text-emerald-400" : "text-zinc-500"}>
            {config.autoFailoverEnabled ? "Enabled" : "Disabled"}
          </span>
          <span className="text-zinc-400">Check interval</span>
          <span className="text-zinc-300">{config.healthCheckIntervalSeconds}s</span>
          <span className="text-zinc-400">Min replicas</span>
          <span className="text-zinc-300">{config.minimumHealthyReplicas}</span>
          <span className="text-zinc-400">Threshold</span>
          <span className="text-zinc-300">{config.failoverThresholdPercent}%</span>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
        >
          Save Configuration
        </button>
        {saved && (
          <span className="text-sm text-emerald-400 flex items-center gap-1.5">
            <span>✓</span>
            <span>Configuration saved</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MultiRegionFailoverManager() {
  const [activeTab, setActiveTab] = useState<TabId>("regions");

  const primaryCount = REGIONS.filter((r) => r.status === "primary").length;
  const degradedCount = REGIONS.filter((r) => r.status === "degraded" || r.status === "failed").length;

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "regions",  label: "Regions" },
    { id: "events",   label: "Failover Events" },
    { id: "metrics",  label: "Health Metrics" },
    { id: "config",   label: "Config" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Multi-Region Failover Manager
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Monitor and control cross-region failover policies in real time
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 font-medium">
              {primaryCount} Primary
            </span>
            {degradedCount > 0 && (
              <span className="px-2 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 font-medium">
                {degradedCount} Degraded
              </span>
            )}
          </div>
        </div>

        {/* Region status overview strip */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {REGIONS.map((r) => (
            <div
              key={r.id}
              className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 flex items-center gap-3"
            >
              <div className={cn("w-2 h-2 rounded-full shrink-0", statusDotClass(r.status))} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">{r.name}</p>
                <p className={cn("text-xs capitalize", statusColor(r.status))}>{r.status}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-zinc-300 font-mono">{r.metrics.latency.current}ms</p>
                <p className={cn("text-xs", r.metrics.errorRate > 2 ? "text-rose-400" : "text-zinc-500")}>
                  {r.metrics.errorRate}% err
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Tab nav */}
        <div className="border-b border-zinc-700 mb-6 flex gap-0">
          {tabs.map((t) => (
            <TabButton
              key={t.id}
              id={t.id}
              label={t.label}
              active={activeTab === t.id}
              onClick={setActiveTab}
            />
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "regions"  && <RegionsTab />}
        {activeTab === "events"   && <FailoverEventsTab />}
        {activeTab === "metrics"  && <HealthMetricsTab />}
        {activeTab === "config"   && <ConfigTab />}
      </div>
    </div>
  );
}
