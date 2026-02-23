import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";

// ─── Seed Data ────────────────────────────────────────────────────────────────

const DAILY_SESSIONS: { date: string; ai: number; human: number }[] = [
  { date: "Feb 08", ai: 87, human: 34 },
  { date: "Feb 09", ai: 62, human: 21 },
  { date: "Feb 10", ai: 104, human: 42 },
  { date: "Feb 11", ai: 118, human: 38 },
  { date: "Feb 12", ai: 95, human: 31 },
  { date: "Feb 13", ai: 130, human: 45 },
  { date: "Feb 14", ai: 112, human: 40 },
  { date: "Feb 15", ai: 98, human: 36 },
  { date: "Feb 16", ai: 71, human: 24 },
  { date: "Feb 17", ai: 121, human: 44 },
  { date: "Feb 18", ai: 134, human: 48 },
  { date: "Feb 19", ai: 109, human: 39 },
  { date: "Feb 20", ai: 142, human: 52 },
  { date: "Feb 21", ai: 127, human: 46 },
];

interface AgentRow {
  agent: string;
  emoji: string;
  sessions: number;
  tokens: number;
  avgDuration: string;
  cost: number;
  successRate: number;
}

const AGENTS_DATA: AgentRow[] = [
  { agent: "Luis", emoji: "🎨", sessions: 312, tokens: 1_842_300, avgDuration: "4m 12s", cost: 18.42, successRate: 97.1 },
  { agent: "Wes", emoji: "⚙️", sessions: 287, tokens: 1_654_800, avgDuration: "3m 48s", cost: 16.55, successRate: 98.3 },
  { agent: "Quinn", emoji: "🔄", sessions: 241, tokens: 1_203_500, avgDuration: "2m 56s", cost: 12.04, successRate: 95.7 },
  { agent: "Reed", emoji: "♿", sessions: 198, tokens: 984_200, avgDuration: "3m 22s", cost: 9.84, successRate: 99.0 },
  { agent: "Piper", emoji: "✨", sessions: 176, tokens: 876_400, avgDuration: "2m 44s", cost: 8.76, successRate: 96.4 },
  { agent: "Sam", emoji: "🎬", sessions: 154, tokens: 742_100, avgDuration: "2m 18s", cost: 7.42, successRate: 97.8 },
  { agent: "Tim", emoji: "🏗️", sessions: 89, tokens: 523_600, avgDuration: "5m 31s", cost: 5.24, successRate: 94.2 },
  { agent: "Xavier", emoji: "🧠", sessions: 67, tokens: 412_900, avgDuration: "6m 05s", cost: 4.13, successRate: 99.5 },
];

const FUNNEL_STEPS = [
  { label: "Triggered", count: 1_524 },
  { label: "Started", count: 1_389 },
  { label: "Completed", count: 1_247 },
  { label: "Produced Output", count: 1_108 },
];

interface RecentSession {
  agent: string;
  emoji: string;
  status: "success" | "error" | "running";
  tokens: number;
  duration: string;
  timestamp: string;
}

const RECENT_SESSIONS: RecentSession[] = [
  { agent: "Luis", emoji: "🎨", status: "success", tokens: 8_421, duration: "3m 42s", timestamp: "2 min ago" },
  { agent: "Wes", emoji: "⚙️", status: "running", tokens: 3_104, duration: "1m 18s", timestamp: "4 min ago" },
  { agent: "Quinn", emoji: "🔄", status: "success", tokens: 5_822, duration: "2m 56s", timestamp: "8 min ago" },
  { agent: "Reed", emoji: "♿", status: "error", tokens: 1_290, duration: "0m 34s", timestamp: "11 min ago" },
  { agent: "Sam", emoji: "🎬", status: "success", tokens: 6_713, duration: "2m 05s", timestamp: "14 min ago" },
];

// ─── Utility helpers ──────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}K`;}
  return n.toLocaleString();
}

type SortKey = keyof Pick<AgentRow, "agent" | "sessions" | "tokens" | "cost" | "successRate">;
type SortDir = "asc" | "desc";

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-1"
      role="group"
      aria-label={label}
    >
      <span className="text-sm text-zinc-400 flex items-center gap-1.5">
        <span aria-hidden="true">{emoji}</span>
        {label}
      </span>
      <span className="text-2xl font-semibold text-white tracking-tight">{value}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
}

function SessionVolumeChart({ data }: { data: typeof DAILY_SESSIONS }) {
  const maxTotal = useMemo(() => Math.max(...data.map((d) => d.ai + d.human)), [data]);
  const chartHeight = 180;
  const barGap = 4;

  // Week-over-week trend values (total per day)
  const totals = data.map((d) => d.ai + d.human);
  const week1Avg = totals.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
  const week2Avg = totals.slice(7, 14).reduce((a, b) => a + b, 0) / 7;
  const trendPct = ((week2Avg - week1Avg) / week1Avg) * 100;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">📊 Session Volume (14 days)</h3>
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            trendPct >= 0
              ? "bg-emerald-400/10 text-emerald-400"
              : "bg-rose-400/10 text-rose-400"
          )}
        >
          {trendPct >= 0 ? "↑" : "↓"} {Math.abs(trendPct).toFixed(1)}% WoW
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-500" aria-hidden="true" />
          AI Sessions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-500/30" aria-hidden="true" />
          Human Sessions
        </span>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-x-auto" role="img" aria-label="Bar chart showing daily session counts over 14 days">
        <svg
          viewBox={`0 0 ${data.length * 48} ${chartHeight + 28}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {data.map((d, i) => {
            const barW = 48 - barGap * 2;
            const x = i * 48 + barGap;
            const total = d.ai + d.human;
            const totalH = maxTotal > 0 ? (total / maxTotal) * chartHeight : 0;
            const aiH = maxTotal > 0 ? (d.ai / maxTotal) * chartHeight : 0;
            const humanH = totalH - aiH;
            const baseY = chartHeight;

            return (
              <g key={d.date}>
                {/* Human segment (bottom, lighter) */}
                <rect
                  x={x}
                  y={baseY - humanH}
                  width={barW}
                  height={Math.max(humanH, 0)}
                  rx={4}
                  className="fill-indigo-500/30"
                />
                {/* AI segment (stacked on top) */}
                <rect
                  x={x}
                  y={baseY - totalH}
                  width={barW}
                  height={Math.max(aiH, 0)}
                  rx={4}
                  className="fill-indigo-500"
                />
                {/* Hover target with title for a11y */}
                <rect
                  x={x}
                  y={0}
                  width={barW}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-default"
                >
                  <title>{`${d.date}: ${d.ai} AI, ${d.human} Human (${total} total)`}</title>
                </rect>
                {/* Date label */}
                <text
                  x={x + barW / 2}
                  y={chartHeight + 16}
                  textAnchor="middle"
                  className="fill-zinc-500"
                  fontSize={10}
                >
                  {d.date.split(" ")[1]}
                </text>
              </g>
            );
          })}

          {/* Trend line (connect midpoints of each bar) */}
          <polyline
            points={data
              .map((d, i) => {
                const barW = 48 - barGap * 2;
                const cx = i * 48 + barGap + barW / 2;
                const total = d.ai + d.human;
                const cy = chartHeight - (maxTotal > 0 ? (total / maxTotal) * chartHeight : 0);
                return `${cx},${cy}`;
              })
              .join(" ")}
            fill="none"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 3"
            opacity={0.6}
          />
        </svg>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400 whitespace-nowrap">
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded px-1 -mx-1",
          active && "text-white"
        )}
        onClick={() => onSort(sortKey)}
        aria-sort={active ? (currentDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        {active && (
          <span aria-hidden="true" className="text-[10px]">
            {currentDir === "asc" ? "▲" : "▼"}
          </span>
        )}
      </button>
    </th>
  );
}

function TopAgentsTable({ agents }: { agents: AgentRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("sessions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...agents];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return copy;
  }, [agents, sortKey, sortDir]);

  const headerProps = { currentKey: sortKey, currentDir: sortDir, onSort: handleSort };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-white mb-4">🏆 Top Agents</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="grid" aria-label="Top agents ranked by activity">
          <thead>
            <tr className="border-b border-zinc-800">
              <SortableHeader label="Agent" sortKey="agent" {...headerProps} />
              <SortableHeader label="Sessions" sortKey="sessions" {...headerProps} />
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Tokens</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Avg Duration</th>
              <SortableHeader label="Cost" sortKey="cost" {...headerProps} />
              <SortableHeader label="Success" sortKey="successRate" {...headerProps} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr
                key={row.agent}
                className={cn(
                  "border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/40",
                  idx === sorted.length - 1 && "border-b-0"
                )}
              >
                <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">
                  <span aria-hidden="true">{row.emoji}</span> {row.agent}
                </td>
                <td className="px-3 py-2.5 text-zinc-400 tabular-nums">{row.sessions.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-zinc-400 tabular-nums">{formatNumber(row.tokens)}</td>
                <td className="px-3 py-2.5 text-zinc-400 tabular-nums">{row.avgDuration}</td>
                <td className="px-3 py-2.5 text-zinc-400 tabular-nums">${row.cost.toFixed(2)}</td>
                <td className="px-3 py-2.5 tabular-nums">
                  <span
                    className={cn(
                      row.successRate >= 97 ? "text-emerald-400" : row.successRate >= 95 ? "text-amber-400" : "text-rose-400"
                    )}
                  >
                    {row.successRate.toFixed(1)}%
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

function FunnelViz({ steps }: { steps: typeof FUNNEL_STEPS }) {
  const maxCount = steps[0].count;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-white mb-4">🔻 Session Funnel</h3>
      <div className="space-y-3" role="list" aria-label="Session funnel showing drop-off at each stage">
        {steps.map((step, i) => {
          const widthPct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
          const dropOff = i > 0 ? ((steps[i - 1].count - step.count) / steps[i - 1].count) * 100 : 0;

          return (
            <div key={step.label} role="listitem" aria-label={`${step.label}: ${step.count.toLocaleString()} sessions${i > 0 ? `, ${dropOff.toFixed(1)}% drop-off` : ""}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-400">{step.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium tabular-nums">
                    {step.count.toLocaleString()}
                  </span>
                  {i > 0 && (
                    <span className="text-rose-400 tabular-nums">
                      −{dropOff.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="h-6 w-full rounded bg-zinc-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded transition-all",
                    i === 0 ? "bg-indigo-500" :
                    i === 1 ? "bg-indigo-500/80" :
                    i === 2 ? "bg-indigo-500/60" :
                    "bg-indigo-500/40"
                  )}
                  style={{ width: `${widthPct}%` }}
                  role="progressbar"
                  aria-valuenow={step.count}
                  aria-valuemin={0}
                  aria-valuemax={maxCount}
                />
              </div>
            </div>
          );
        })}
      </div>
      {/* Overall conversion */}
      <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
        <span className="text-zinc-500">Overall conversion</span>
        <span className="text-emerald-400 font-medium tabular-nums">
          {maxCount > 0 ? ((steps[steps.length - 1].count / maxCount) * 100).toFixed(1) : 0}%
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RecentSession["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
        status === "success" && "bg-emerald-400/10 text-emerald-400",
        status === "error" && "bg-rose-400/10 text-rose-400",
        status === "running" && "bg-amber-400/10 text-amber-400"
      )}
      role="status"
      aria-label={`Status: ${status}`}
    >
      <span aria-hidden="true" className="text-[8px]">●</span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function RecentSessionsTable({ sessions }: { sessions: RecentSession[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-white mb-4">🕐 Recent Sessions</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Recent sessions">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Agent</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Tokens</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Duration</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Time</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, idx) => (
              <tr
                key={`${s.agent}-${idx}`}
                className={cn(
                  "border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/40",
                  idx === sessions.length - 1 && "border-b-0"
                )}
              >
                <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">
                  <span aria-hidden="true">{s.emoji}</span> {s.agent}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-3 py-2.5 text-zinc-400 tabular-nums">{formatNumber(s.tokens)}</td>
                <td className="px-3 py-2.5 text-zinc-400 tabular-nums">{s.duration}</td>
                <td className="px-3 py-2.5 text-zinc-500 text-xs whitespace-nowrap">{s.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsOverview() {
  // Derived KPIs from seed data
  const weekSessions = useMemo(
    () => DAILY_SESSIONS.slice(-7).reduce((sum, d) => sum + d.ai + d.human, 0),
    []
  );
  const totalTokens = useMemo(
    () => AGENTS_DATA.reduce((sum, a) => sum + a.tokens, 0),
    []
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-white tracking-tight">
            📈 Analytics Overview
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Workspace performance at a glance — week of Feb 15–21, 2026
          </p>
        </div>

        {/* KPI Row */}
        <section aria-label="Key performance indicators" className="mb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              emoji="📋"
              label="Sessions this week"
              value={weekSessions.toLocaleString()}
              sub="+12.4% vs last week"
            />
            <KpiCard
              emoji="🪙"
              label="Total tokens consumed"
              value={formatNumber(totalTokens)}
              sub="Across all agents"
            />
            <KpiCard
              emoji="🤖"
              label="Active agents"
              value={String(AGENTS_DATA.length)}
              sub="6 AI · 2 supervisory"
            />
            <KpiCard
              emoji="⏱️"
              label="Avg session duration"
              value="3m 28s"
              sub="↓ 8s from last week"
            />
          </div>
        </section>

        {/* Session Volume Chart */}
        <section aria-label="Session volume over time" className="mb-6">
          <SessionVolumeChart data={DAILY_SESSIONS} />
        </section>

        {/* Two-column: Top Agents + Funnel */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-5 mb-6">
          <div className="lg:col-span-3">
            <TopAgentsTable agents={AGENTS_DATA} />
          </div>
          <div className="lg:col-span-2">
            <FunnelViz steps={FUNNEL_STEPS} />
          </div>
        </section>

        {/* Recent Sessions */}
        <section aria-label="Recent sessions">
          <RecentSessionsTable sessions={RECENT_SESSIONS} />
        </section>
      </div>
    </div>
  );
}
