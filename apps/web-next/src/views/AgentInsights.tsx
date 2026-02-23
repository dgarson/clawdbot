import React, { useState, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentStat {
  id: string;
  name: string;
  emoji: string;
  role: string;
  model: string;
  totalSessions: number;
  totalTokens: number;
  totalCostUsd: number;
  avgSessionDuration: number; // seconds
  avgResponseMs: number;
  errorRate: number; // 0-100
  successRate: number; // 0-100
  lastActive: Date;
  status: "active" | "idle" | "offline";
  weeklyTokens: number[]; // 7 values (Mon-Sun)
  weeklySessionCounts: number[]; // 7 values
  topActions: { action: string; count: number }[];
  collaborators: string[]; // agent names they interact with most
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const mins = (n: number) => n * 60_000;
const hrs = (n: number) => n * 3_600_000;
const days = (n: number) => n * 86_400_000;

const AGENTS: AgentStat[] = [
  {
    id: "luis",
    name: "Luis",
    emoji: "🎨",
    role: "Principal UX Engineer",
    model: "claude-sonnet-4-6",
    totalSessions: 284,
    totalTokens: 8_420_000,
    totalCostUsd: 42.10,
    avgSessionDuration: 1240,
    avgResponseMs: 1820,
    errorRate: 0.7,
    successRate: 99.3,
    lastActive: ago(mins(2)),
    status: "active",
    weeklyTokens: [820_000, 1_100_000, 980_000, 1_200_000, 1_400_000, 1_650_000, 1_270_000],
    weeklySessionCounts: [28, 34, 30, 41, 48, 58, 45],
    topActions: [
      { action: "file.write", count: 312 },
      { action: "exec.run", count: 289 },
      { action: "session.spawn", count: 78 },
      { action: "git.commit", count: 64 },
    ],
    collaborators: ["Piper", "Quinn", "Reed"],
  },
  {
    id: "xavier",
    name: "Xavier",
    emoji: "🏗️",
    role: "CTO",
    model: "claude-opus-4-6",
    totalSessions: 147,
    totalTokens: 12_800_000,
    totalCostUsd: 192.00,
    avgSessionDuration: 2100,
    avgResponseMs: 2840,
    errorRate: 0.3,
    successRate: 99.7,
    lastActive: ago(hrs(4)),
    status: "idle",
    weeklyTokens: [1_200_000, 1_800_000, 1_600_000, 2_100_000, 1_900_000, 2_400_000, 1_800_000],
    weeklySessionCounts: [12, 18, 15, 22, 19, 28, 33],
    topActions: [
      { action: "session.review", count: 189 },
      { action: "message.send", count: 156 },
      { action: "pr.review", count: 78 },
      { action: "agent.config", count: 45 },
    ],
    collaborators: ["Tim", "Roman", "Luis"],
  },
  {
    id: "piper",
    name: "Piper",
    emoji: "🖌️",
    role: "Worker — Product & UI",
    model: "minimax-m2.5",
    totalSessions: 89,
    totalTokens: 2_100_000,
    totalCostUsd: 3.15,
    avgSessionDuration: 890,
    avgResponseMs: 940,
    errorRate: 2.1,
    successRate: 97.9,
    lastActive: ago(hrs(1)),
    status: "idle",
    weeklyTokens: [180_000, 290_000, 240_000, 320_000, 280_000, 410_000, 380_000],
    weeklySessionCounts: [8, 12, 10, 14, 11, 18, 16],
    topActions: [
      { action: "file.write", count: 234 },
      { action: "exec.build", count: 89 },
      { action: "file.read", count: 67 },
      { action: "git.push", count: 42 },
    ],
    collaborators: ["Luis", "Quinn"],
  },
  {
    id: "stephan",
    name: "Stephan",
    emoji: "📣",
    role: "CMO",
    model: "claude-sonnet-4-6",
    totalSessions: 211,
    totalTokens: 5_600_000,
    totalCostUsd: 28.00,
    avgSessionDuration: 980,
    avgResponseMs: 1640,
    errorRate: 0.5,
    successRate: 99.5,
    lastActive: ago(hrs(2)),
    status: "idle",
    weeklyTokens: [420_000, 590_000, 680_000, 720_000, 800_000, 940_000, 650_000],
    weeklySessionCounts: [18, 24, 28, 31, 35, 44, 31],
    topActions: [
      { action: "message.send", count: 487 },
      { action: "file.write", count: 234 },
      { action: "web.search", count: 189 },
      { action: "file.read", count: 156 },
    ],
    collaborators: ["Xavier", "Luis"],
  },
  {
    id: "tim",
    name: "Tim",
    emoji: "⚙️",
    role: "VP Architecture",
    model: "claude-sonnet-4-6",
    totalSessions: 128,
    totalTokens: 4_200_000,
    totalCostUsd: 21.00,
    avgSessionDuration: 1560,
    avgResponseMs: 1920,
    errorRate: 0.8,
    successRate: 99.2,
    lastActive: ago(days(1)),
    status: "idle",
    weeklyTokens: [320_000, 480_000, 560_000, 640_000, 580_000, 720_000, 900_000],
    weeklySessionCounts: [9, 14, 17, 19, 16, 22, 31],
    topActions: [
      { action: "pr.review", count: 312 },
      { action: "code.review", count: 189 },
      { action: "message.send", count: 145 },
      { action: "exec.run", count: 89 },
    ],
    collaborators: ["Xavier", "Roman", "Luis"],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(0)}K`;}
  return n.toString();
}

function fmtDuration(secs: number): string {
  if (secs < 60) {return `${secs}s`;}
  if (secs < 3600) {return `${Math.floor(secs / 60)}m ${secs % 60}s`;}
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) {return "just now";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Mini bar chart (7-day) ───────────────────────────────────────────────────

interface BarChartProps {
  data: number[];
  labels: string[];
  color: string;
  label: string;
  formatValue: (v: number) => string;
}

function BarChart({ data, labels, color, label, formatValue }: BarChartProps) {
  const max = Math.max(...data);
  const H = 60;
  const barW = 24;
  const gap = 8;
  const W = data.length * (barW + gap) - gap;

  return (
    <div>
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{label}</p>
      <div className="flex items-end gap-0" aria-label={label}>
        {data.map((v, i) => {
          const barH = max > 0 ? Math.max(4, (v / max) * H) : 4;
          return (
            <div key={i} className="flex flex-col items-center gap-1" style={{ width: barW + gap, paddingRight: gap }}>
              <span className="text-xs text-zinc-600 tabular-nums" style={{ fontSize: "0.6rem" }}>{formatValue(v)}</span>
              <div
                className={cn("w-full rounded-t-sm transition-all", color)}
                style={{ height: barH, width: barW }}
                title={`${labels[i]}: ${formatValue(v)}`}
              />
              <span className="text-zinc-600 tabular-nums" style={{ fontSize: "0.6rem" }}>{labels[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AgentStat["status"] }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ring-1",
      status === "active"  && "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
      status === "idle"    && "bg-zinc-500/15 text-zinc-400 ring-zinc-500/25",
      status === "offline" && "bg-rose-500/15 text-rose-300 ring-rose-500/25",
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === "active"  && "bg-emerald-500",
        status === "idle"    && "bg-zinc-500",
        status === "offline" && "bg-rose-500",
      )} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Agent List Item ──────────────────────────────────────────────────────────

interface AgentListItemProps {
  agent: AgentStat;
  selected: boolean;
  onSelect: () => void;
}

function AgentListItem({ agent, selected, onSelect }: AgentListItemProps) {
  return (
    <button
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-zinc-800/50 transition-colors",
        "hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
        selected && "bg-zinc-900 border-l-2 border-l-indigo-500"
      )}
    >
      <div className="flex-none h-9 w-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg">
        {agent.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{agent.name}</span>
          <StatusBadge status={agent.status} />
        </div>
        <p className="text-xs text-zinc-500 truncate">{agent.role}</p>
      </div>
      <div className="text-right flex-none">
        <p className="text-xs font-mono text-zinc-300">{fmtTokens(agent.totalTokens)}</p>
        <p className="text-xs text-zinc-600">tokens</p>
      </div>
    </button>
  );
}

// ─── Agent Detail Panel ───────────────────────────────────────────────────────

function AgentDetailPanel({ agent }: { agent: AgentStat }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-3xl">
            {agent.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{agent.name}</h2>
              <StatusBadge status={agent.status} />
            </div>
            <p className="text-sm text-zinc-500">{agent.role}</p>
            <p className="text-xs text-zinc-600 mt-0.5 font-mono">{agent.model} · last active {relTime(agent.lastActive)}</p>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="flex-none grid grid-cols-2 sm:grid-cols-4 gap-px bg-zinc-800 border-b border-zinc-800">
        {[
          { label: "Total Sessions",  value: agent.totalSessions.toLocaleString(), sub: "all time" },
          { label: "Total Tokens",    value: fmtTokens(agent.totalTokens),         sub: `$${agent.totalCostUsd.toFixed(2)} spent` },
          { label: "Avg Session",     value: fmtDuration(agent.avgSessionDuration), sub: "duration" },
          { label: "Avg Response",    value: `${agent.avgResponseMs.toLocaleString()}ms`, sub: "response time" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-zinc-950 px-5 py-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="text-lg font-semibold text-white mt-1 tabular-nums">{value}</p>
            <p className="text-xs text-zinc-600">{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="flex-none px-6 py-5 border-b border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-8">
        <BarChart
          data={agent.weeklyTokens}
          labels={DAY_LABELS}
          color="bg-indigo-500"
          label="Tokens this week"
          formatValue={(v) => fmtTokens(v)}
        />
        <BarChart
          data={agent.weeklySessionCounts}
          labels={DAY_LABELS}
          color="bg-emerald-500"
          label="Sessions this week"
          formatValue={(v) => v.toString()}
        />
      </div>

      {/* Performance + actions row */}
      <div className="flex-none px-6 py-5 border-b border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Performance */}
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Performance</p>
          <div className="space-y-3">
            {[
              { label: "Success Rate", value: agent.successRate, bar: "bg-emerald-500", text: "text-emerald-400", fmt: (v: number) => `${v.toFixed(1)}%` },
              { label: "Error Rate",   value: agent.errorRate,   bar: "bg-rose-500",    text: "text-rose-400",    fmt: (v: number) => `${v.toFixed(1)}%`, invert: true },
            ].map(({ label, value, bar, text, fmt, invert }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-400">{label}</span>
                  <span className={cn("text-xs font-mono font-semibold", text)}>{fmt(value)}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full">
                  <div
                    className={cn("h-1.5 rounded-full", bar)}
                    style={{ width: `${invert ? value * 10 : value}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-xs text-zinc-500">Cost / Session</p>
                <p className="text-sm font-mono text-zinc-200 mt-0.5">${(agent.totalCostUsd / agent.totalSessions).toFixed(3)}</p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-xs text-zinc-500">Tokens / Session</p>
                <p className="text-sm font-mono text-zinc-200 mt-0.5">{fmtTokens(Math.round(agent.totalTokens / agent.totalSessions))}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top actions */}
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Top Actions</p>
          <div className="space-y-2">
            {agent.topActions.map((action, i) => {
              const max = agent.topActions[0].count;
              return (
                <div key={action.action}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-zinc-400">{action.action}</span>
                    <span className="text-xs text-zinc-500 tabular-nums">{action.count}</span>
                  </div>
                  <div className="h-1 w-full bg-zinc-800 rounded-full">
                    <div
                      className="h-1 rounded-full bg-indigo-500 opacity-80"
                      style={{ width: `${(action.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Collaborators */}
      <div className="flex-none px-6 py-5">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Top Collaborators</p>
        <div className="flex flex-wrap gap-2">
          {agent.collaborators.map((name) => {
            const collab = AGENTS.find((a) => a.name === name);
            return (
              <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-base">{collab?.emoji ?? "🤖"}</span>
                <span className="text-sm text-zinc-300">{name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type SortKey = "tokens" | "sessions" | "cost" | "name";

export default function AgentInsights() {
  const [selectedId, setSelectedId] = useState<string>(AGENTS[0].id);
  const [sortKey, setSortKey] = useState<SortKey>("tokens");
  const [search, setSearch] = useState("");

  const filtered = AGENTS
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.role.toLowerCase().includes(search.toLowerCase()))
    .toSorted((a, b) => {
      if (sortKey === "tokens")   {return b.totalTokens - a.totalTokens;}
      if (sortKey === "sessions") {return b.totalSessions - a.totalSessions;}
      if (sortKey === "cost")     {return b.totalCostUsd - a.totalCostUsd;}
      return a.name.localeCompare(b.name);
    });

  const selectedAgent = AGENTS.find((a) => a.id === selectedId) ?? AGENTS[0];

  // Summary stats across all agents
  const totalTokens = AGENTS.reduce((s, a) => s + a.totalTokens, 0);
  const totalCost = AGENTS.reduce((s, a) => s + a.totalCostUsd, 0);
  const totalSessions = AGENTS.reduce((s, a) => s + a.totalSessions, 0);
  const activeCount = AGENTS.filter((a) => a.status === "active").length;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-white">Agent Insights</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Per-agent analytics, performance, and usage breakdowns</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span><span className="text-white font-semibold">{AGENTS.length}</span> agents</span>
            <span><span className="text-emerald-400 font-semibold">{activeCount}</span> active</span>
            <span><span className="text-indigo-400 font-semibold">{fmtTokens(totalTokens)}</span> total tokens</span>
            <span><span className="text-amber-400 font-semibold">${totalCost.toFixed(2)}</span> total cost</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: Agent list */}
        <div className="w-64 flex-none flex flex-col border-r border-zinc-800">
          {/* Search + sort */}
          <div className="flex-none px-3 py-2 border-b border-zinc-800 space-y-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter agents…"
              aria-label="Filter agents"
              className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Sort agents by"
              className="w-full py-1 pl-2 pr-6 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              <option value="tokens">Most Tokens</option>
              <option value="sessions">Most Sessions</option>
              <option value="cost">Highest Cost</option>
              <option value="name">A–Z</option>
            </select>
          </div>

          {/* List */}
          <div role="listbox" aria-label="Select agent" className="flex-1 overflow-y-auto">
            {filtered.map((agent) => (
              <AgentListItem
                key={agent.id}
                agent={agent}
                selected={selectedId === agent.id}
                onSelect={() => setSelectedId(agent.id)}
              />
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-xs text-zinc-600 text-center">No agents match</p>
            )}
          </div>
        </div>

        {/* Right: Detail */}
        <div className="flex-1 min-w-0">
          <AgentDetailPanel agent={selectedAgent} />
        </div>
      </div>
    </div>
  );
}
