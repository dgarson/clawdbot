import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type MetricCategory = "latency" | "throughput" | "errors" | "cost" | "tokens" | "sessions";
type Granularity = "1m" | "5m" | "1h" | "1d";
type Dimension = "agent" | "model" | "squad" | "tool";

interface DataPoint {
  ts: string; // label (e.g. "14:00", "Mon")
  value: number;
  breakdown?: Record<string, number>;
}

interface MetricSeries {
  id: string;
  name: string;
  category: MetricCategory;
  unit: string;
  description: string;
  currentValue: number;
  previousValue: number;
  trend: "up" | "down" | "flat";
  data: DataPoint[];
  dimensions: Record<Dimension, Array<{ name: string; value: number; pct: number }>>;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

function makeTimeSeries(count: number, base: number, variance: number): DataPoint[] {
  const hours = ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"];
  return hours.slice(0, count).map((h) => ({
    ts: `${h}:00`,
    value: Math.max(0, base + (Math.random() - 0.5) * variance * 2),
  }));
}

const METRICS: MetricSeries[] = [
  {
    id: "latency-p95",
    name: "P95 Latency",
    category: "latency",
    unit: "ms",
    description: "95th percentile end-to-end request latency",
    currentValue: 2340,
    previousValue: 2890,
    trend: "down",
    data: [
      { ts: "00:00", value: 2100 },
      { ts: "02:00", value: 1980 },
      { ts: "04:00", value: 2050 },
      { ts: "06:00", value: 2400 },
      { ts: "08:00", value: 3200 },
      { ts: "10:00", value: 2890 },
      { ts: "12:00", value: 2650 },
      { ts: "14:00", value: 2340 },
      { ts: "16:00", value: 2180 },
      { ts: "18:00", value: 2420 },
      { ts: "20:00", value: 2100 },
      { ts: "22:00", value: 1950 },
    ],
    dimensions: {
      agent: [
        { name: "Xavier", value: 4200, pct: 35 },
        { name: "Luis", value: 2800, pct: 23 },
        { name: "Roman", value: 2100, pct: 18 },
        { name: "Claire", value: 1800, pct: 15 },
        { name: "Others", value: 1100, pct: 9 },
      ],
      model: [
        { name: "claude-opus-4-6", value: 4800, pct: 40 },
        { name: "claude-sonnet-4-6", value: 2200, pct: 18 },
        { name: "MiniMax-M2.5", value: 1400, pct: 12 },
        { name: "gemini-flash", value: 900, pct: 8 },
        { name: "Others", value: 2700, pct: 22 },
      ],
      squad: [
        { name: "Platform Core", value: 3100, pct: 26 },
        { name: "Feature Dev", value: 2800, pct: 23 },
        { name: "Product & UI", value: 2600, pct: 22 },
        { name: "Leadership", value: 3800, pct: 29 },
      ],
      tool: [
        { name: "exec", value: 4100, pct: 34 },
        { name: "browser", value: 3200, pct: 27 },
        { name: "sessions_spawn", value: 2400, pct: 20 },
        { name: "write", value: 1200, pct: 10 },
        { name: "Others", value: 1100, pct: 9 },
      ],
    },
  },
  {
    id: "req-per-min",
    name: "Requests / Min",
    category: "throughput",
    unit: "req/m",
    description: "Total agent requests processed per minute",
    currentValue: 847,
    previousValue: 720,
    trend: "up",
    data: [
      { ts: "00:00", value: 520 },
      { ts: "02:00", value: 480 },
      { ts: "04:00", value: 460 },
      { ts: "06:00", value: 590 },
      { ts: "08:00", value: 760 },
      { ts: "10:00", value: 890 },
      { ts: "12:00", value: 920 },
      { ts: "14:00", value: 847 },
      { ts: "16:00", value: 880 },
      { ts: "18:00", value: 760 },
      { ts: "20:00", value: 640 },
      { ts: "22:00", value: 540 },
    ],
    dimensions: {
      agent: [
        { name: "Luis", value: 280, pct: 33 },
        { name: "Roman", value: 210, pct: 25 },
        { name: "Claire", value: 170, pct: 20 },
        { name: "Xavier", value: 120, pct: 14 },
        { name: "Others", value: 67, pct: 8 },
      ],
      model: [
        { name: "MiniMax-M2.5", value: 340, pct: 40 },
        { name: "claude-sonnet-4-6", value: 255, pct: 30 },
        { name: "gemini-flash", value: 170, pct: 20 },
        { name: "claude-opus-4-6", value: 82, pct: 10 },
      ],
      squad: [
        { name: "Product & UI", value: 310, pct: 37 },
        { name: "Platform Core", value: 254, pct: 30 },
        { name: "Feature Dev", value: 200, pct: 24 },
        { name: "Leadership", value: 83, pct: 9 },
      ],
      tool: [
        { name: "read", value: 250, pct: 30 },
        { name: "write", value: 180, pct: 21 },
        { name: "exec", value: 160, pct: 19 },
        { name: "message", value: 130, pct: 15 },
        { name: "Others", value: 127, pct: 15 },
      ],
    },
  },
  {
    id: "error-rate",
    name: "Error Rate",
    category: "errors",
    unit: "%",
    description: "Percentage of requests that resulted in an error",
    currentValue: 1.4,
    previousValue: 2.1,
    trend: "down",
    data: [
      { ts: "00:00", value: 1.2 },
      { ts: "02:00", value: 0.8 },
      { ts: "04:00", value: 0.6 },
      { ts: "06:00", value: 1.4 },
      { ts: "08:00", value: 2.8 },
      { ts: "10:00", value: 3.1 },
      { ts: "12:00", value: 2.2 },
      { ts: "14:00", value: 1.4 },
      { ts: "16:00", value: 1.1 },
      { ts: "18:00", value: 1.8 },
      { ts: "20:00", value: 1.2 },
      { ts: "22:00", value: 0.9 },
    ],
    dimensions: {
      agent: [
        { name: "Quinn", value: 3.2, pct: 35 },
        { name: "Wes", value: 2.1, pct: 23 },
        { name: "Sam", value: 1.8, pct: 20 },
        { name: "Reed", value: 1.2, pct: 13 },
        { name: "Others", value: 0.9, pct: 9 },
      ],
      model: [
        { name: "gemini-flash", value: 2.8, pct: 38 },
        { name: "MiniMax-M2.5", value: 1.6, pct: 22 },
        { name: "claude-sonnet-4-6", value: 1.1, pct: 15 },
        { name: "claude-opus-4-6", value: 0.6, pct: 8 },
        { name: "Others", value: 1.2, pct: 17 },
      ],
      squad: [
        { name: "Feature Dev", value: 2.1, pct: 32 },
        { name: "Product & UI", value: 1.8, pct: 28 },
        { name: "Platform Core", value: 1.4, pct: 22 },
        { name: "Ops", value: 1.2, pct: 18 },
      ],
      tool: [
        { name: "sessions_spawn", value: 3.4, pct: 40 },
        { name: "browser", value: 2.1, pct: 25 },
        { name: "exec", value: 1.6, pct: 19 },
        { name: "voice_call", value: 1.4, pct: 16 },
      ],
    },
  },
  {
    id: "token-usage",
    name: "Token Usage",
    category: "tokens",
    unit: "K/h",
    description: "Total tokens consumed per hour across all agents",
    currentValue: 142800,
    previousValue: 118400,
    trend: "up",
    data: [
      { ts: "00:00", value: 98000 },
      { ts: "02:00", value: 85000 },
      { ts: "04:00", value: 79000 },
      { ts: "06:00", value: 108000 },
      { ts: "08:00", value: 156000 },
      { ts: "10:00", value: 184000 },
      { ts: "12:00", value: 168000 },
      { ts: "14:00", value: 142800 },
      { ts: "16:00", value: 152000 },
      { ts: "18:00", value: 128000 },
      { ts: "20:00", value: 104000 },
      { ts: "22:00", value: 89000 },
    ],
    dimensions: {
      agent: [
        { name: "Luis", value: 48000, pct: 34 },
        { name: "Xavier", value: 32000, pct: 22 },
        { name: "Roman", value: 24000, pct: 17 },
        { name: "Stephan", value: 18000, pct: 13 },
        { name: "Others", value: 20800, pct: 14 },
      ],
      model: [
        { name: "claude-opus-4-6", value: 58000, pct: 41 },
        { name: "claude-sonnet-4-6", value: 42000, pct: 29 },
        { name: "MiniMax-M2.5", value: 28000, pct: 20 },
        { name: "gemini-flash", value: 14800, pct: 10 },
      ],
      squad: [
        { name: "Product & UI", value: 52000, pct: 36 },
        { name: "Leadership", value: 38000, pct: 27 },
        { name: "Platform Core", value: 32000, pct: 22 },
        { name: "Feature Dev", value: 20800, pct: 15 },
      ],
      tool: [
        { name: "sessions_spawn", value: 62000, pct: 43 },
        { name: "exec", value: 34000, pct: 24 },
        { name: "browser", value: 24000, pct: 17 },
        { name: "message", value: 14000, pct: 10 },
        { name: "Others", value: 8800, pct: 6 },
      ],
    },
  },
];

const CATEGORY_CONFIG: Record<MetricCategory, { color: string; bg: string; border: string }> = {
  latency: { color: "text-amber-400", bg: "bg-amber-900/20", border: "border-amber-700/50" },
  throughput: { color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-700/50" },
  errors: { color: "text-rose-400", bg: "bg-rose-900/20", border: "border-rose-700/50" },
  cost: { color: "text-purple-400", bg: "bg-purple-900/20", border: "border-purple-700/50" },
  tokens: { color: "text-blue-400", bg: "bg-blue-900/20", border: "border-blue-700/50" },
  sessions: { color: "text-indigo-400", bg: "bg-indigo-900/20", border: "border-indigo-700/50" },
};

function formatValue(value: number, unit: string): string {
  if (unit === "ms") {return `${Math.round(value).toLocaleString()}ms`;}
  if (unit === "%") {return `${value.toFixed(1)}%`;}
  if (unit === "K/h") {return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : `${Math.round(value)}`;}
  return `${Math.round(value).toLocaleString()} ${unit}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MetricsDrilldown() {
  const [selectedMetric, setSelectedMetric] = useState<MetricSeries>(METRICS[0]);
  const [dimension, setDimension] = useState<Dimension>("agent");
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const m = selectedMetric;
  const cc = CATEGORY_CONFIG[m.category];
  const maxVal = Math.max(...m.data.map((d) => d.value));
  const changePct = Math.abs(((m.currentValue - m.previousValue) / m.previousValue) * 100);
  const isPositive = m.trend === "up" ? m.category === "throughput" || m.category === "sessions" : m.trend === "down";
  const trendColor = m.trend === "flat" ? "text-[var(--color-text-secondary)]" : isPositive ? "text-emerald-400" : "text-rose-400";
  const trendArrow = m.trend === "up" ? "↑" : m.trend === "down" ? "↓" : "→";

  const dimData = m.dimensions[dimension];

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Metrics Drilldown</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">Deep-dive into system performance metrics</p>
          </div>
          <div className="flex items-center gap-2">
            {(["1m", "5m", "1h", "1d"] as Granularity[]).map((g) => (
              <button
                key={g}
                className={cn(
                  "px-2.5 py-1 rounded text-xs",
                  g === "1h" ? "bg-indigo-600 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Metric selector cards */}
        <div className="grid grid-cols-4 gap-3">
          {METRICS.map((metric) => {
            const mc = CATEGORY_CONFIG[metric.category];
            const isSelected = selectedMetric.id === metric.id;
            const chg = Math.abs(((metric.currentValue - metric.previousValue) / metric.previousValue) * 100);
            const arrow = metric.trend === "up" ? "↑" : metric.trend === "down" ? "↓" : "→";
            return (
              <button
                key={metric.id}
                onClick={() => setSelectedMetric(metric)}
                className={cn(
                  "text-left p-3 rounded-xl border transition-all",
                  isSelected
                    ? `${mc.bg} ${mc.border} ring-1 ring-offset-0`
                    : "bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-surface-3)]"
                )}
                style={isSelected ? {} : {}}
              >
                <div className={cn("text-xs font-medium mb-1", mc.color)}>{metric.category}</div>
                <div className="text-lg font-bold text-[var(--color-text-primary)]">{formatValue(metric.currentValue, metric.unit)}</div>
                <div className="text-xs text-[var(--color-text-secondary)] mb-1">{metric.name}</div>
                <div className={cn("text-xs", metric.trend === "down" && metric.category !== "errors" ? "text-emerald-400" :
                  metric.trend === "up" && metric.category !== "throughput" ? "text-rose-400" : "text-[var(--color-text-secondary)]")}>
                  {arrow} {chg.toFixed(1)}% vs prev
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex gap-0">
        {/* Main chart area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Chart header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{m.name}</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{m.description}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{formatValue(m.currentValue, m.unit)}</div>
              <div className={cn("text-sm font-medium", trendColor)}>
                {trendArrow} {changePct.toFixed(1)}% vs previous period
              </div>
            </div>
          </div>

          {/* Time series chart */}
          <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-5 mb-5">
            <div className="flex items-end gap-1.5 h-48">
              {m.data.map((point, i) => {
                const heightPct = maxVal > 0 ? (point.value / maxVal) * 100 : 0;
                const isHovered = hoveredPoint === i;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(i)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Tooltip */}
                    <div className={cn(
                      "text-[10px] text-[var(--color-text-primary)] bg-[var(--color-surface-2)] rounded px-1.5 py-0.5 border border-[var(--color-border)] whitespace-nowrap transition-opacity",
                      isHovered ? "opacity-100" : "opacity-0"
                    )}>
                      {formatValue(point.value, m.unit)}
                    </div>
                    {/* Bar */}
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={cn("w-full rounded-t transition-all", cc.bg, isHovered ? "brightness-150" : "")}
                        style={{ height: `${heightPct}%`, minHeight: 2, borderTop: `2px solid`, borderTopColor: isHovered ? "currentColor" : "transparent" }}
                      >
                        <div
                          className="w-full h-full rounded-t"
                          style={{ background: `linear-gradient(to top, rgba(99,102,241,0.3), rgba(99,102,241,0.6))` }}
                        />
                      </div>
                    </div>
                    {/* Label */}
                    <div className={cn("text-[9px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors", i % 2 !== 0 && "opacity-0")}>
                      {point.ts}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dimension breakdown */}
          <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Breakdown by</h3>
              <div className="flex gap-1">
                {(["agent", "model", "squad", "tool"] as Dimension[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDimension(d)}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs capitalize",
                      dimension === d ? "bg-indigo-600 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {dimData.map((item) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[var(--color-text-primary)]">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-xs font-medium", cc.color)}>{formatValue(item.value, m.unit)}</span>
                      <span className="text-xs text-[var(--color-text-muted)] w-8 text-right">{item.pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.pct}%`,
                        background: "linear-gradient(to right, rgba(99,102,241,0.6), rgba(99,102,241,0.9))",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: stats sidebar */}
        <div className="flex-shrink-0 w-56 border-l border-[var(--color-border)] bg-[var(--color-surface-1)]/30 p-4 overflow-y-auto">
          <div className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wide mb-3">Stats</div>
          <div className="space-y-3">
            {[
              { label: "Current", value: formatValue(m.currentValue, m.unit) },
              { label: "Previous", value: formatValue(m.previousValue, m.unit) },
              { label: "Max (24h)", value: formatValue(maxVal, m.unit) },
              { label: "Min (24h)", value: formatValue(Math.min(...m.data.map((d) => d.value)), m.unit) },
              { label: "Avg (24h)", value: formatValue(m.data.reduce((s, d) => s + d.value, 0) / m.data.length, m.unit) },
            ].map((s) => (
              <div key={s.label} className="bg-[var(--color-surface-2)]/50 rounded-lg p-3">
                <div className="text-xs text-[var(--color-text-muted)] mb-0.5">{s.label}</div>
                <div className={cn("text-sm font-bold", cc.color)}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wide mt-5 mb-3">All Metrics</div>
          <div className="space-y-1">
            {METRICS.map((metric) => {
              const mc = CATEGORY_CONFIG[metric.category];
              const isSelected = selectedMetric.id === metric.id;
              return (
                <button
                  key={metric.id}
                  onClick={() => setSelectedMetric(metric)}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-lg transition-all text-xs",
                    isSelected ? `${mc.bg} ${mc.color}` : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  <div className="font-medium">{metric.name}</div>
                  <div className="text-[var(--color-text-muted)]">{formatValue(metric.currentValue, metric.unit)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
