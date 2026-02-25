import React, { useState, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HourlyBucket {
  hour: number;
  queries: number;
}

interface DiscoveryRun {
  id: string;
  queriesUsed: number;
  timestamp: string;
}

interface QuotaData {
  dailyLimit: number;
  usedToday: number;
  resetAtEpoch: number; // unix ms
  hourlyBuckets: HourlyBucket[];
  topRuns: DiscoveryRun[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

function buildMockData(): QuotaData {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const buckets: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => {
    if (h > now.getHours()) {return { hour: h, queries: 0 };}
    if (h === now.getHours()) {return { hour: h, queries: 87 };}
    // rough bell curve peaking at noon
    const dist = Math.abs(h - 11);
    const base = Math.max(0, 120 - dist * 14);
    return { hour: h, queries: Math.round(base + Math.random() * 30) };
  });

  return {
    dailyLimit: 2000,
    usedToday: 1247,
    resetAtEpoch: midnight.getTime(),
    hourlyBuckets: buckets,
    topRuns: [
      { id: "run_9f3a2c", queriesUsed: 214, timestamp: "2026-02-22 11:04" },
      { id: "run_7b1e90", queriesUsed: 187, timestamp: "2026-02-22 09:31" },
      { id: "run_4d8f11", queriesUsed: 153, timestamp: "2026-02-22 08:15" },
      { id: "run_2c5a77", queriesUsed: 98, timestamp: "2026-02-22 07:02" },
      { id: "run_0e6b3d", queriesUsed: 76, timestamp: "2026-02-22 06:48" },
    ],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatResetIn(resetEpoch: number): string {
  const diffMs = Math.max(0, resetEpoch - Date.now());
  const totalMinutes = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

function usageColor(pct: number): string {
  if (pct < 0.5) {return "#22c55e";} // green-500
  if (pct < 0.75) {return "#eab308";} // yellow-500
  return "#ef4444"; // red-500
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] p-5 flex flex-col gap-1 min-w-0">
      <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-text-secondary)]">
        {label}
      </span>
      <span
        className="text-3xl font-bold tabular-nums leading-tight"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</span>}
    </div>
  );
}

interface ProgressBarProps {
  used: number;
  total: number;
}

function ProgressBar({ used, total }: ProgressBarProps) {
  const pct = Math.min(1, used / total);
  const color = usageColor(pct);
  const pctDisplay = Math.round(pct * 100);

  return (
    <div className="rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Daily Usage</span>
        <span className="text-sm tabular-nums text-[var(--color-text-secondary)]">
          {used.toLocaleString()} / {total.toLocaleString()} queries ({pctDisplay}%)
        </span>
      </div>
      <div className="h-4 w-full rounded-full bg-[var(--color-surface-3)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pctDisplay}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-[var(--color-text-muted)]">
        <span>0</span>
        <span>{(total / 2).toLocaleString()}</span>
        <span>{total.toLocaleString()}</span>
      </div>
    </div>
  );
}

interface HourlyChartProps {
  buckets: HourlyBucket[];
  currentHour: number;
}

function HourlyChart({ buckets, currentHour }: HourlyChartProps) {
  const W = 600;
  const H = 140;
  const PAD = { top: 12, right: 16, bottom: 28, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxQ = Math.max(...buckets.map((b) => b.queries), 1);
  const xStep = chartW / 23;

  const toX = (h: number) => PAD.left + h * xStep;
  const toY = (q: number) => PAD.top + chartH - (q / maxQ) * chartH;

  const points = buckets.map((b) => ({ x: toX(b.hour), y: toY(b.queries) }));
  const areaPath =
    `M ${points[0].x} ${PAD.top + chartH}` +
    points.map((p) => ` L ${p.x} ${p.y}`).join("") +
    ` L ${points[23].x} ${PAD.top + chartH} Z`;
  const linePath =
    `M ${points[0].x} ${points[0].y}` +
    points
      .slice(1)
      .map((p) => ` L ${p.x} ${p.y}`)
      .join("");

  const yTicks = [0, Math.round(maxQ / 2), maxQ];
  const xLabels = [0, 6, 12, 18, 23];

  return (
    <div className="rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] p-5">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">Hourly Burn Rate</span>
      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ minWidth: 320, maxHeight: 160 }}
          aria-label="Hourly query usage area chart"
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Y grid lines */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={PAD.left + chartW}
                y1={toY(v)}
                y2={toY(v)}
                stroke="#3f3f46"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <text
                x={PAD.left - 6}
                y={toY(v)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#71717a"
                fontSize={9}
              >
                {v}
              </text>
            </g>
          ))}

          {/* Current-hour highlight column */}
          <rect
            x={toX(currentHour) - xStep / 2}
            y={PAD.top}
            width={xStep}
            height={chartH}
            fill="#6366f1"
            fillOpacity={0.12}
            rx={3}
          />

          {/* Area fill */}
          <path d={areaPath} fill="url(#areaGrad)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#818cf8"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Dots for each bucket */}
          {points.map((p, h) => (
            <circle
              key={h}
              cx={p.x}
              cy={p.y}
              r={h === currentHour ? 4 : 2.5}
              fill={h === currentHour ? "#f0abfc" : "#818cf8"}
              stroke={h === currentHour ? "#1e1b4b" : "none"}
              strokeWidth={1.5}
            />
          ))}

          {/* X-axis labels */}
          {xLabels.map((h) => (
            <text
              key={h}
              x={toX(h)}
              y={H - 6}
              textAnchor="middle"
              fill="#71717a"
              fontSize={9}
            >
              {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

interface TopRunsTableProps {
  runs: DiscoveryRun[];
}

function TopRunsTable({ runs }: TopRunsTableProps) {
  return (
    <div className="rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] p-5">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">Top Consuming Discovery Runs</span>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
              <th className="pb-2 pr-4 font-medium">Run ID</th>
              <th className="pb-2 pr-4 font-medium text-right">Queries</th>
              <th className="pb-2 font-medium">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, i) => (
              <tr
                key={run.id}
                className={cn(
                  "border-b border-[var(--color-border)]/50 last:border-0",
                  i === 0 && "text-indigo-300"
                )}
              >
                <td className="py-2 pr-4 font-mono text-xs text-[var(--color-text-primary)]">{run.id}</td>
                <td className="py-2 pr-4 text-right tabular-nums font-semibold">
                  {run.queriesUsed}
                </td>
                <td className="py-2 text-[var(--color-text-secondary)] text-xs">{run.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function BraveSearchQuotaTracker() {
  const [data, setData] = useState<QuotaData>(buildMockData);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setData(buildMockData());
      setLastRefreshed(new Date());
      setRefreshing(false);
    }, 600);
  }, []);

  // Auto-refresh countdown every minute
  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const [resetIn, setResetIn] = useState(() => formatResetIn(data.resetAtEpoch));
  useEffect(() => {
    const id = setInterval(() => setResetIn(formatResetIn(data.resetAtEpoch)), 30_000);
    return () => clearInterval(id);
  }, [data.resetAtEpoch]);

  const remaining = data.dailyLimit - data.usedToday;
  const pct = data.usedToday / data.dailyLimit;
  const currentHour = new Date().getHours();

  const timeStr = lastRefreshed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[var(--color-surface-1)] text-[var(--color-text-primary)] p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brave Search Quota</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Last refreshed: {timeStr}</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            "bg-primary hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <svg
            className={cn("w-4 h-4", refreshing && "animate-spin")}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Low-quota alert */}
      {remaining < 200 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/50 bg-red-950/50 px-5 py-4">
          <svg
            className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <div>
            <p className="font-semibold text-red-300 text-sm">Low Quota Warning</p>
            <p className="text-xs text-red-400 mt-0.5">
              Only <strong>{remaining}</strong> queries remaining today. Discovery runs may be
              throttled or paused to protect your daily limit. Quota resets in {resetIn}.
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Daily Limit" value={data.dailyLimit.toLocaleString()} sub="queries / day" />
        <StatCard
          label="Used Today"
          value={data.usedToday.toLocaleString()}
          sub={`${Math.round(pct * 100)}% of limit`}
          accent={usageColor(pct)}
        />
        <StatCard
          label="Remaining"
          value={remaining.toLocaleString()}
          sub="queries left"
          accent={remaining < 200 ? "#ef4444" : remaining < 500 ? "#eab308" : "#22c55e"}
        />
        <StatCard label="Reset In" value={resetIn} sub="until midnight UTC" accent="#818cf8" />
      </div>

      {/* Progress bar */}
      <ProgressBar used={data.usedToday} total={data.dailyLimit} />

      {/* Hourly chart */}
      <HourlyChart buckets={data.hourlyBuckets} currentHour={currentHour} />

      {/* Top runs table */}
      <TopRunsTable runs={data.topRuns} />
    </div>
  );
}
