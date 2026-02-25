import React, { useState } from "react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Variant {
  name: string;
  trafficPct: number;
  sampleSize: number;
  metricValue: number;
  metricBaseline: number;
  pValue: number;
  upliftPct: number;
  isControl: boolean;
}

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: "running" | "completed" | "paused" | "draft";
  startDate: string;
  endDate: string | null;
  owner: string;
  metric: string;
  variants: Variant[];
  totalSamples: number;
  statisticalPower: number;
  confidenceLevel: 95 | 99;
  winner: string | null;
}

type StatusFilter = "all" | Experiment["status"];

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const EXPERIMENTS: Experiment[] = [
  {
    id: "exp-001",
    name: "Embedding Model v2 Retrieval",
    hypothesis:
      "Switching to the v2 embedding model will improve retrieval recall by at least 5% without increasing latency.",
    status: "completed",
    startDate: "2026-01-05",
    endDate: "2026-02-10",
    owner: "Claire",
    metric: "Retrieval Recall@10",
    variants: [
      { name: "Control (v1)", trafficPct: 50, sampleSize: 24200, metricValue: 0.72, metricBaseline: 0.72, pValue: 1, upliftPct: 0, isControl: true },
      { name: "v2 Embed", trafficPct: 50, sampleSize: 24350, metricValue: 0.781, metricBaseline: 0.72, pValue: 0.003, upliftPct: 8.47, isControl: false },
    ],
    totalSamples: 48550,
    statisticalPower: 0.94,
    confidenceLevel: 95,
    winner: "v2 Embed",
  },
  {
    id: "exp-002",
    name: "Prompt Chain Reordering",
    hypothesis:
      "Reordering the summarisation prompt before the extraction prompt will increase task accuracy by 3%.",
    status: "running",
    startDate: "2026-02-01",
    endDate: null,
    owner: "Roman",
    metric: "Task Accuracy",
    variants: [
      { name: "Control", trafficPct: 50, sampleSize: 8700, metricValue: 0.83, metricBaseline: 0.83, pValue: 1, upliftPct: 0, isControl: true },
      { name: "Reordered", trafficPct: 50, sampleSize: 8640, metricValue: 0.856, metricBaseline: 0.83, pValue: 0.07, upliftPct: 3.13, isControl: false },
    ],
    totalSamples: 17340,
    statisticalPower: 0.68,
    confidenceLevel: 95,
    winner: null,
  },
  {
    id: "exp-003",
    name: "Adaptive Temperature Scaling",
    hypothesis:
      "Dynamically adjusting temperature based on query complexity will reduce hallucination rate by 10%.",
    status: "running",
    startDate: "2026-02-10",
    endDate: null,
    owner: "Piper",
    metric: "Hallucination Rate",
    variants: [
      { name: "Static Temp", trafficPct: 34, sampleSize: 4100, metricValue: 0.121, metricBaseline: 0.121, pValue: 1, upliftPct: 0, isControl: true },
      { name: "Adaptive Low", trafficPct: 33, sampleSize: 3980, metricValue: 0.104, metricBaseline: 0.121, pValue: 0.04, upliftPct: -14.05, isControl: false },
      { name: "Adaptive Full", trafficPct: 33, sampleSize: 3950, metricValue: 0.098, metricBaseline: 0.121, pValue: 0.008, upliftPct: -19.01, isControl: false },
    ],
    totalSamples: 12030,
    statisticalPower: 0.82,
    confidenceLevel: 99,
    winner: null,
  },
  {
    id: "exp-004",
    name: "Context Window 128k vs 64k",
    hypothesis:
      "Doubling context window to 128k tokens will improve long-doc QA F1 by 7%.",
    status: "paused",
    startDate: "2026-01-20",
    endDate: null,
    owner: "Quinn",
    metric: "QA F1 Score",
    variants: [
      { name: "64k Control", trafficPct: 50, sampleSize: 3200, metricValue: 0.74, metricBaseline: 0.74, pValue: 1, upliftPct: 0, isControl: true },
      { name: "128k Window", trafficPct: 50, sampleSize: 3180, metricValue: 0.762, metricBaseline: 0.74, pValue: 0.15, upliftPct: 2.97, isControl: false },
    ],
    totalSamples: 6380,
    statisticalPower: 0.45,
    confidenceLevel: 95,
    winner: null,
  },
  {
    id: "exp-005",
    name: "Few-Shot Example Selection",
    hypothesis:
      "BM25-selected few-shot examples outperform random selection on classification accuracy.",
    status: "completed",
    startDate: "2025-12-15",
    endDate: "2026-01-28",
    owner: "Reed",
    metric: "Classification Accuracy",
    variants: [
      { name: "Random Select", trafficPct: 50, sampleSize: 31000, metricValue: 0.865, metricBaseline: 0.865, pValue: 1, upliftPct: 0, isControl: true },
      { name: "BM25 Select", trafficPct: 50, sampleSize: 30800, metricValue: 0.901, metricBaseline: 0.865, pValue: 0.001, upliftPct: 4.16, isControl: false },
    ],
    totalSamples: 61800,
    statisticalPower: 0.97,
    confidenceLevel: 95,
    winner: "BM25 Select",
  },
  {
    id: "exp-006",
    name: "LoRA Rank Ablation",
    hypothesis:
      "LoRA rank 16 achieves comparable fine-tune quality to rank 64 with 40% less VRAM.",
    status: "draft",
    startDate: "2026-02-22",
    endDate: null,
    owner: "Sam",
    metric: "Eval Loss",
    variants: [
      { name: "Rank 64 (Ctrl)", trafficPct: 34, sampleSize: 0, metricValue: 0, metricBaseline: 0, pValue: 1, upliftPct: 0, isControl: true },
      { name: "Rank 16", trafficPct: 33, sampleSize: 0, metricValue: 0, metricBaseline: 0, pValue: 1, upliftPct: 0, isControl: false },
      { name: "Rank 8", trafficPct: 33, sampleSize: 0, metricValue: 0, metricBaseline: 0, pValue: 1, upliftPct: 0, isControl: false },
    ],
    totalSamples: 0,
    statisticalPower: 0,
    confidenceLevel: 95,
    winner: null,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<Experiment["status"], string> = {
  running: "bg-primary/20 text-primary border border-primary/40",
  completed: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
  paused: "bg-amber-500/20 text-amber-400 border border-amber-500/40",
  draft: "bg-[var(--color-surface-3)]/40 text-[var(--color-text-secondary)] border border-[var(--color-surface-3)]",
};

function sigLabel(p: number): { text: string; cls: string } {
  if (p < 0.01) {return { text: "Highly significant", cls: "text-emerald-400" };}
  if (p < 0.05) {return { text: "Significant", cls: "text-emerald-400" };}
  if (p < 0.1) {return { text: "Trending", cls: "text-amber-400" };}
  return { text: "Not significant", cls: "text-rose-400" };
}

function fmtPct(v: number, decimals = 1): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

function bestPValue(exp: Experiment): number {
  const nonControl = exp.variants.filter((v) => !v.isControl);
  if (nonControl.length === 0) {return 1;}
  return Math.min(...nonControl.map((v) => v.pValue));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExperimentDashboard() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>("exp-001");

  const filtered =
    filter === "all"
      ? EXPERIMENTS
      : EXPERIMENTS.filter((e) => e.status === filter);

  const selected = EXPERIMENTS.find((e) => e.id === selectedId) ?? null;

  // Aggregate stats
  const running = EXPERIMENTS.filter((e) => e.status === "running").length;
  const completed = EXPERIMENTS.filter((e) => e.status === "completed").length;
  const completedWithUplift = EXPERIMENTS.filter(
    (e) => e.status === "completed" && e.winner,
  );
  const avgUplift =
    completedWithUplift.length > 0
      ? completedWithUplift.reduce((sum, e) => {
          const winVariant = e.variants.find((v) => v.name === e.winner);
          return sum + (winVariant?.upliftPct ?? 0);
        }, 0) / completedWithUplift.length
      : 0;
  const significantCount = EXPERIMENTS.filter(
    (e) => bestPValue(e) < 0.05 && e.totalSamples > 0,
  ).length;

  // Determine max metric value across selected experiment's variants for bar scaling
  const maxMetric = selected
    ? Math.max(...selected.variants.map((v) => v.metricValue), 0.001)
    : 1;

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Experiment Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded px-3 py-2 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
          </select>
          <button className="bg-primary hover:bg-primary text-[var(--color-text-primary)] px-3 py-1.5 rounded text-sm font-medium">
            + New Experiment
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Running", value: running, accent: "text-primary" },
          { label: "Completed", value: completed, accent: "text-emerald-400" },
          { label: "Avg Uplift", value: `${avgUplift.toFixed(1)}%`, accent: "text-amber-400" },
          { label: "Significant Results", value: significantCount, accent: "text-emerald-400" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4"
          >
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1">
              {s.label}
            </p>
            <p className={cn("text-2xl font-semibold", s.accent)}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex gap-5">
        {/* Left column — experiment cards */}
        <div className="w-[45%] space-y-3 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
          {filtered.length === 0 && (
            <p className="text-[var(--color-text-muted)] text-sm py-8 text-center">
              No experiments match this filter.
            </p>
          )}
          {filtered.map((exp) => {
            const best = bestPValue(exp);
            const sig = sigLabel(best);
            const sampleTarget = exp.totalSamples > 0 ? exp.totalSamples : 1;
            const samplesCurrent = exp.variants.reduce(
              (s, v) => s + v.sampleSize,
              0,
            );
            const progress = Math.min(samplesCurrent / (sampleTarget * 1.2), 1);

            return (
              <button
                key={exp.id}
                onClick={() => setSelectedId(exp.id)}
                className={cn(
                  "w-full text-left bg-[var(--color-surface-1)] border rounded-lg p-4 transition-colors",
                  selectedId === exp.id
                    ? "border-primary"
                    : "border-[var(--color-border)] hover:border-[var(--color-border)]",
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">
                      {exp.name}
                    </h3>
                    <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                      {exp.owner} · {exp.metric}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ml-2",
                      STATUS_STYLES[exp.status],
                    )}
                  >
                    {exp.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-[var(--color-surface-2)] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(progress * 100).toFixed(1)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--color-text-muted)]">
                    {samplesCurrent.toLocaleString()} samples
                  </span>
                  {exp.totalSamples > 0 && (
                    <span className={cn("flex items-center gap-1", sig.cls)}>
                      {best < 0.05 && "✓ "}p={best < 0.001 ? "<.001" : best.toFixed(3)}
                    </span>
                  )}
                </div>
                {exp.winner && (
                  <p className="text-emerald-400 text-xs mt-1.5 font-medium">
                    Winner: {exp.winner}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Right panel — detail */}
        <div className="w-[55%]">
          {!selected ? (
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-8 text-center text-[var(--color-text-muted)] text-sm">
              Select an experiment to view details.
            </div>
          ) : (
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-260px)]">
              {/* Title + status */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">{selected.name}</h2>
                  <p className="text-[var(--color-text-muted)] text-xs mt-1">
                    {selected.startDate}
                    {selected.endDate ? ` → ${selected.endDate}` : " → ongoing"}{" "}
                    · Owner: {selected.owner}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded-full",
                    STATUS_STYLES[selected.status],
                  )}
                >
                  {selected.status}
                </span>
              </div>

              {/* Hypothesis */}
              <div>
                <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1">
                  Hypothesis
                </p>
                <p className="text-[var(--color-text-primary)] text-sm leading-relaxed">
                  {selected.hypothesis}
                </p>
              </div>

              {/* Variant comparison table */}
              <div>
                <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-2">
                  Variant Comparison
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[var(--color-text-muted)] text-xs uppercase border-b border-[var(--color-border)]">
                        <th className="text-left py-2 pr-2 font-medium">Variant</th>
                        <th className="text-right py-2 px-2 font-medium">Traffic</th>
                        <th className="text-right py-2 px-2 font-medium">Samples</th>
                        <th className="text-right py-2 px-2 font-medium">Metric</th>
                        <th className="text-right py-2 px-2 font-medium">Uplift</th>
                        <th className="text-right py-2 px-2 font-medium">p-value</th>
                        <th className="text-right py-2 pl-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.variants.map((v) => {
                        const sig = sigLabel(v.pValue);
                        const isWinner = selected.winner === v.name;
                        return (
                          <tr
                            key={v.name}
                            className="border-b border-[var(--color-border)]/50"
                          >
                            <td className="py-2 pr-2 font-medium">
                              {v.name}
                            </td>
                            <td className="py-2 px-2 text-right text-[var(--color-text-secondary)]">
                              {v.trafficPct}%
                            </td>
                            <td className="py-2 px-2 text-right text-[var(--color-text-secondary)]">
                              {v.sampleSize.toLocaleString()}
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                              {v.metricValue > 0 ? v.metricValue.toFixed(3) : "—"}
                            </td>
                            <td
                              className={cn(
                                "py-2 px-2 text-right font-mono",
                                v.isControl
                                  ? "text-[var(--color-text-muted)]"
                                  : v.upliftPct > 0
                                    ? "text-emerald-400"
                                    : v.upliftPct < 0
                                      ? "text-rose-400"
                                      : "text-[var(--color-text-secondary)]",
                              )}
                            >
                              {v.isControl
                                ? "baseline"
                                : `${v.upliftPct > 0 ? "+" : ""}${v.upliftPct.toFixed(2)}%`}
                            </td>
                            <td
                              className={cn(
                                "py-2 px-2 text-right font-mono",
                                v.isControl ? "text-[var(--color-text-muted)]" : sig.cls,
                              )}
                            >
                              {v.isControl
                                ? "—"
                                : v.pValue < 0.001
                                  ? "<.001"
                                  : v.pValue.toFixed(3)}
                            </td>
                            <td className="py-2 pl-2 text-right">
                              {v.isControl ? (
                                <span className="text-[var(--color-text-muted)] text-xs">control</span>
                              ) : isWinner ? (
                                <span className="text-emerald-400 text-xs font-medium">
                                  winner
                                </span>
                              ) : selected.winner && !isWinner ? (
                                <span className="text-rose-400 text-xs">loser</span>
                              ) : (
                                <span className="text-[var(--color-text-muted)] text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Visual bar comparison */}
              <div>
                <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-2">
                  Metric Comparison
                </p>
                <div className="space-y-2">
                  {selected.variants.map((v) => {
                    const barPct =
                      maxMetric > 0
                        ? (v.metricValue / maxMetric) * 100
                        : 0;
                    const isWinner = selected.winner === v.name;
                    return (
                      <div key={v.name} className="flex items-center gap-3">
                        <span className="text-xs text-[var(--color-text-secondary)] w-28 truncate shrink-0">
                          {v.name}
                        </span>
                        <div className="flex-1 h-6 bg-[var(--color-surface-2)] rounded overflow-hidden relative">
                          <div
                            className={cn(
                              "h-full rounded transition-all",
                              v.isControl
                                ? "bg-[var(--color-surface-3)]"
                                : isWinner
                                  ? "bg-emerald-500"
                                  : "bg-primary",
                            )}
                            style={{ width: `${barPct.toFixed(1)}%` }}
                          />
                          {v.metricValue > 0 && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--color-text-primary)]/80 font-mono">
                              {v.metricValue.toFixed(3)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Statistical significance + power */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-3">
                  <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1">
                    Statistical Significance
                  </p>
                  {(() => {
                    const best = bestPValue(selected);
                    const sig = sigLabel(best);
                    if (selected.totalSamples === 0) {
                      return (
                        <p className="text-[var(--color-text-muted)] text-sm">
                          No data collected yet
                        </p>
                      );
                    }
                    return best < 0.05 ? (
                      <p className={cn("text-sm font-medium", sig.cls)}>
                        Statistically significant at{" "}
                        {selected.confidenceLevel}% confidence
                      </p>
                    ) : (
                      <p className={cn("text-sm", sig.cls)}>
                        Not yet significant (p=
                        {best < 0.001 ? "<.001" : best.toFixed(3)})
                        {best < 0.1 && " — trending"}
                      </p>
                    );
                  })()}
                </div>
                <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-3">
                  <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1">
                    Power Analysis
                  </p>
                  {selected.totalSamples === 0 ? (
                    <p className="text-[var(--color-text-muted)] text-sm">Awaiting data</p>
                  ) : (
                    <p
                      className={cn(
                        "text-sm font-medium",
                        selected.statisticalPower >= 0.8
                          ? "text-emerald-400"
                          : "text-amber-400",
                      )}
                    >
                      Current power: {fmtPct(selected.statisticalPower, 0)}
                      {selected.statisticalPower < 0.8
                        ? " (need 80%+ for reliability)"
                        : " — sufficient"}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                {selected.status === "running" && (
                  <>
                    <button className="bg-emerald-600 hover:bg-emerald-500 text-[var(--color-text-primary)] px-3 py-1.5 rounded text-sm font-medium">
                      Declare Winner
                    </button>
                    <button className="bg-amber-600 hover:bg-amber-500 text-[var(--color-text-primary)] px-3 py-1.5 rounded text-sm font-medium">
                      Stop Experiment
                    </button>
                  </>
                )}
                {selected.status === "paused" && (
                  <button className="bg-primary hover:bg-primary text-[var(--color-text-primary)] px-3 py-1.5 rounded text-sm font-medium">
                    Resume Experiment
                  </button>
                )}
                {selected.status === "draft" && (
                  <button className="bg-primary hover:bg-primary text-[var(--color-text-primary)] px-3 py-1.5 rounded text-sm font-medium">
                    Start Experiment
                  </button>
                )}
                <button className="bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] px-3 py-1.5 rounded text-sm">
                  Archive
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
