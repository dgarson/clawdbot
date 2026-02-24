import React, { useState } from "react";
import { cn } from "../lib/utils";

type ResourceKind = "cpu" | "memory" | "disk" | "network" | "gpu";
type AlertThreshold = "ok" | "warning" | "critical";

interface TimePoint {
  t: string; // HH:MM
  value: number; // 0-100 for cpu/mem/disk, MBps for network
}

interface ResourceMetric {
  kind: ResourceKind;
  label: string;
  current: number;
  peak: number;
  avg: number;
  unit: string;
  threshold: AlertThreshold;
  history: TimePoint[]; // last 12 data points
}

interface ProcessRow {
  pid: number;
  name: string;
  cpu: number;
  mem: number; // MB
  threads: number;
  started: string;
}

interface NodeInfo {
  hostname: string;
  os: string;
  arch: string;
  uptime: string;
  totalCpuCores: number;
  totalMemMB: number;
  totalDiskGB: number;
}

const NODE: NodeInfo = {
  hostname: "David's MacBook Pro (3)",
  os: "Darwin 24.6.0",
  arch: "arm64",
  uptime: "3d 14h 22m",
  totalCpuCores: 12,
  totalMemMB: 32768,
  totalDiskGB: 2000,
};

function genHistory(base: number, variance: number, count: number): TimePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const hour = Math.floor((2 + i * 0.083) % 24);
    const min = Math.floor((i * 5) % 60);
    return {
      t: `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
      value: Math.max(0, Math.min(100, base + (Math.sin(i * 0.8) * variance) + (Math.random() * variance * 0.5))),
    };
  });
}

const METRICS: ResourceMetric[] = [
  {
    kind: "cpu",
    label: "CPU",
    current: 67,
    peak: 94,
    avg: 52,
    unit: "%",
    threshold: "warning",
    history: [
      { t: "02:00", value: 42 }, { t: "02:05", value: 58 }, { t: "02:10", value: 81 },
      { t: "02:15", value: 94 }, { t: "02:20", value: 72 }, { t: "02:25", value: 68 },
      { t: "02:30", value: 71 }, { t: "02:35", value: 67 }, { t: "02:40", value: 55 },
      { t: "02:45", value: 63 }, { t: "02:50", value: 70 }, { t: "02:55", value: 67 },
    ],
  },
  {
    kind: "memory",
    label: "Memory",
    current: 84,
    peak: 91,
    avg: 78,
    unit: "%",
    threshold: "critical",
    history: [
      { t: "02:00", value: 76 }, { t: "02:05", value: 78 }, { t: "02:10", value: 80 },
      { t: "02:15", value: 84 }, { t: "02:20", value: 87 }, { t: "02:25", value: 91 },
      { t: "02:30", value: 88 }, { t: "02:35", value: 84 }, { t: "02:40", value: 82 },
      { t: "02:45", value: 83 }, { t: "02:50", value: 85 }, { t: "02:55", value: 84 },
    ],
  },
  {
    kind: "disk",
    label: "Disk I/O",
    current: 38,
    peak: 72,
    avg: 28,
    unit: "%",
    threshold: "ok",
    history: [
      { t: "02:00", value: 12 }, { t: "02:05", value: 68 }, { t: "02:10", value: 72 },
      { t: "02:15", value: 45 }, { t: "02:20", value: 28 }, { t: "02:25", value: 18 },
      { t: "02:30", value: 22 }, { t: "02:35", value: 38 }, { t: "02:40", value: 44 },
      { t: "02:45", value: 31 }, { t: "02:50", value: 28 }, { t: "02:55", value: 38 },
    ],
  },
  {
    kind: "network",
    label: "Network",
    current: 12,
    peak: 48,
    avg: 8,
    unit: "MB/s",
    threshold: "ok",
    history: [
      { t: "02:00", value: 4 }, { t: "02:05", value: 18 }, { t: "02:10", value: 48 },
      { t: "02:15", value: 32 }, { t: "02:20", value: 14 }, { t: "02:25", value: 8 },
      { t: "02:30", value: 6 }, { t: "02:35", value: 12 }, { t: "02:40", value: 24 },
      { t: "02:45", value: 16 }, { t: "02:50", value: 10 }, { t: "02:55", value: 12 },
    ],
  },
];

const PROCESSES: ProcessRow[] = [
  { pid: 4821, name: "openclaw-gateway", cpu: 18.2, mem: 512, threads: 24, started: "2026-02-19 12:00" },
  { pid: 5102, name: "node (agent:luis)", cpu: 24.8, mem: 840, threads: 18, started: "2026-02-22 02:05" },
  { pid: 5218, name: "node (agent:wes)", cpu: 8.4, mem: 420, threads: 14, started: "2026-02-22 02:21" },
  { pid: 5220, name: "node (agent:quinn)", cpu: 6.1, mem: 380, threads: 14, started: "2026-02-22 02:22" },
  { pid: 5108, name: "pnpm build", cpu: 31.2, mem: 1240, threads: 8, started: "2026-02-22 02:21" },
  { pid: 4940, name: "redis-server", cpu: 0.8, mem: 48, threads: 4, started: "2026-02-19 12:00" },
  { pid: 3201, name: "node (openclaw-ui)", cpu: 2.1, mem: 220, threads: 6, started: "2026-02-19 12:02" },
  { pid: 2880, name: "node (mcp-server)", cpu: 1.4, mem: 180, threads: 8, started: "2026-02-19 12:01" },
];

const THRESHOLD_STYLES: Record<AlertThreshold, string> = {
  ok: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-rose-400",
};

const THRESHOLD_BG: Record<AlertThreshold, string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
};

const KIND_ICON: Record<ResourceKind, string> = {
  cpu: "⚡",
  memory: "🧠",
  disk: "💾",
  network: "🌐",
  gpu: "🎮",
};

function MiniSparkline({ history, threshold }: { history: TimePoint[]; threshold: AlertThreshold }) {
  const max = Math.max(...history.map((h) => h.value), 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {history.map((pt, i) => (
        <div
          key={i}
          className={cn("w-2 rounded-sm opacity-80", THRESHOLD_BG[threshold])}
          style={{ height: `${(pt.value / max) * 100}%` }}
          title={`${pt.t}: ${Math.round(pt.value)}`}
        />
      ))}
    </div>
  );
}

function GaugeBar({ value, threshold }: { value: number; threshold: AlertThreshold }) {
  return (
    <div className="h-2.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", THRESHOLD_BG[threshold])}
        style={{ width: `${Math.min(value, 100)}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export default function ResourceMonitor() {
  const [selectedKind, setSelectedKind] = useState<ResourceKind>("cpu");
  const [procSort, setProcSort] = useState<"cpu" | "mem">("cpu");

  const selected = METRICS.find((m) => m.kind === selectedKind) ?? METRICS[0];
  const sortedProcs = [...PROCESSES].toSorted((a, b) => b[procSort] - a[procSort]);

  const memUsed = Math.round((NODE.totalMemMB * 0.84) / 1024);

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] px-5 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Resource Monitor</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{NODE.hostname} · {NODE.os} · {NODE.arch} · uptime {NODE.uptime}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-1 bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20 rounded font-medium">
            Memory critical
          </span>
          <span className="text-xs px-2 py-1 bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 rounded font-medium">
            CPU warning
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="shrink-0 grid grid-cols-4 gap-3 px-5 py-3 border-b border-[var(--color-border)]">
        {METRICS.map((metric) => (
          <button
            key={metric.kind}
            onClick={() => setSelectedKind(metric.kind)}
            className={cn(
              "text-left p-3 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              metric.kind === selectedKind
                ? "bg-[var(--color-surface-2)] border-indigo-500/50"
                : "bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-border)]"
            )}
            aria-pressed={metric.kind === selectedKind}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{KIND_ICON[metric.kind]}</span>
                <span className="text-xs font-medium text-[var(--color-text-primary)]">{metric.label}</span>
              </div>
              <span className={cn("text-xs font-bold", THRESHOLD_STYLES[metric.threshold])}>
                {Math.round(metric.current)}{metric.unit}
              </span>
            </div>
            <GaugeBar value={metric.kind === "network" ? (metric.current / metric.peak) * 100 : metric.current} threshold={metric.threshold} />
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Detail panel */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-[var(--color-border)]">
          {/* Selected metric chart */}
          <div className="shrink-0 p-5 border-b border-[var(--color-border)]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{KIND_ICON[selected.kind]}</span>
                  <span className="text-base font-semibold text-[var(--color-text-primary)]">{selected.label}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded font-medium", {
                    ok: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
                    warning: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
                    critical: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
                  }[selected.threshold])}>
                    {selected.threshold}
                  </span>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-right">
                  <div className={cn("text-2xl font-bold", THRESHOLD_STYLES[selected.threshold])}>
                    {Math.round(selected.current)}{selected.unit}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">current</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-[var(--color-text-primary)]">{Math.round(selected.peak)}{selected.unit}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">peak</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-[var(--color-text-primary)]">{Math.round(selected.avg)}{selected.unit}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">avg</div>
                </div>
              </div>
            </div>

            {/* Full sparkline */}
            <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-3">
              <div className="flex items-end gap-1 h-20">
                {selected.history.map((pt, i) => {
                  const max = Math.max(...selected.history.map((h) => h.value), 1);
                  const heightPct = (pt.value / max) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${pt.t}: ${Math.round(pt.value)}${selected.unit}`}>
                      <div
                        className={cn("w-full rounded-sm opacity-80", THRESHOLD_BG[selected.threshold])}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                <span>{selected.history[0].t}</span>
                <span>now</span>
              </div>
            </div>

            {/* Node info */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="bg-[var(--color-surface-1)] rounded border border-[var(--color-border)] p-2">
                <div className="text-[var(--color-text-muted)]">CPU Cores</div>
                <div className="text-[var(--color-text-primary)] font-medium">{NODE.totalCpuCores} cores</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded border border-[var(--color-border)] p-2">
                <div className="text-[var(--color-text-muted)]">Memory</div>
                <div className="text-[var(--color-text-primary)] font-medium">{memUsed} GB / {NODE.totalMemMB / 1024} GB</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded border border-[var(--color-border)] p-2">
                <div className="text-[var(--color-text-muted)]">Disk</div>
                <div className="text-[var(--color-text-primary)] font-medium">{NODE.totalDiskGB} GB total</div>
              </div>
            </div>
          </div>

          {/* Process table */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-2 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-surface-0)] z-10">
              <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                Processes ({PROCESSES.length})
              </span>
              <div className="flex gap-1">
                {(["cpu", "mem"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setProcSort(s)}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      procSort === s ? "bg-indigo-600 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]"
                    )}
                  >
                    Sort by {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-5 py-2 text-[var(--color-text-muted)] font-medium">Process</th>
                  <th className="text-right px-3 py-2 text-[var(--color-text-muted)] font-medium">PID</th>
                  <th className="text-right px-3 py-2 text-[var(--color-text-muted)] font-medium">CPU%</th>
                  <th className="text-right px-3 py-2 text-[var(--color-text-muted)] font-medium">MEM MB</th>
                  <th className="text-right px-5 py-2 text-[var(--color-text-muted)] font-medium">Threads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/50">
                {sortedProcs.map((proc) => (
                  <tr key={proc.pid} className="hover:bg-[var(--color-surface-2)]/30">
                    <td className="px-5 py-2 text-[var(--color-text-primary)] font-mono">{proc.name}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-muted)]">{proc.pid}</td>
                    <td className={cn("px-3 py-2 text-right font-medium", proc.cpu > 20 ? "text-amber-400" : "text-[var(--color-text-primary)]")}>
                      {proc.cpu.toFixed(1)}%
                    </td>
                    <td className={cn("px-3 py-2 text-right font-medium", proc.mem > 800 ? "text-rose-400" : "text-[var(--color-text-primary)]")}>
                      {proc.mem}
                    </td>
                    <td className="px-5 py-2 text-right text-[var(--color-text-muted)]">{proc.threads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
