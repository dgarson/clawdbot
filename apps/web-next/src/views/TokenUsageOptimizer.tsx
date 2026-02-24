import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "analysis" | "optimization" | "budget";
type ModelName = "claude-3-5-sonnet" | "gpt-4o" | "gemini-1.5-pro";
type Effort = "low" | "medium" | "high";
type RecCategory = "compression" | "pruning" | "routing" | "caching";
type SortField =
  | "name"
  | "totalTokens"
  | "sessions"
  | "avgTokensPerSession"
  | "outputRatio"
  | "wastePercent"
  | "cost";
type SortDir = "asc" | "desc";

interface Agent {
  id: string;
  name: string;
  model: ModelName;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  sessions: number;
  cost: number;
  wastePercent: number;
  outputRatio: number;
  trend: number[];
  budget: number;
  teamId: string;
}

interface HourlyUsage {
  hour: number;
  tokens: number;
  label: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: RecCategory;
  estimatedSavings: number;
  estimatedCostSavings: number;
  effort: Effort;
  agentIds: string[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
  {
    id: "piper",
    name: "Piper",
    model: "claude-3-5-sonnet",
    totalTokens: 2840000,
    inputTokens: 1920000,
    outputTokens: 920000,
    sessions: 142,
    cost: 8.52,
    wastePercent: 12.4,
    outputRatio: 0.323,
    trend: [18000, 22000, 19500, 24000, 21000, 26000, 23500],
    budget: 15.0,
    teamId: "product-ui",
  },
  {
    id: "quinn",
    name: "Quinn",
    model: "claude-3-5-sonnet",
    totalTokens: 3210000,
    inputTokens: 2100000,
    outputTokens: 1110000,
    sessions: 167,
    cost: 9.63,
    wastePercent: 8.7,
    outputRatio: 0.346,
    trend: [22000, 20000, 25000, 23000, 28000, 26000, 30000],
    budget: 15.0,
    teamId: "product-ui",
  },
  {
    id: "reed",
    name: "Reed",
    model: "gpt-4o",
    totalTokens: 1940000,
    inputTokens: 1380000,
    outputTokens: 560000,
    sessions: 98,
    cost: 14.55,
    wastePercent: 18.2,
    outputRatio: 0.289,
    trend: [14000, 16000, 15000, 19000, 17000, 20000, 18000],
    budget: 20.0,
    teamId: "product-ui",
  },
  {
    id: "wes",
    name: "Wes",
    model: "gpt-4o",
    totalTokens: 2560000,
    inputTokens: 1780000,
    outputTokens: 780000,
    sessions: 124,
    cost: 19.2,
    wastePercent: 22.1,
    outputRatio: 0.305,
    trend: [19000, 21000, 24000, 22000, 26000, 23000, 27000],
    budget: 25.0,
    teamId: "product-ui",
  },
  {
    id: "sam",
    name: "Sam",
    model: "gemini-1.5-pro",
    totalTokens: 4820000,
    inputTokens: 3440000,
    outputTokens: 1380000,
    sessions: 203,
    cost: 6.75,
    wastePercent: 9.3,
    outputRatio: 0.286,
    trend: [32000, 35000, 38000, 36000, 42000, 39000, 45000],
    budget: 10.0,
    teamId: "product-ui",
  },
  {
    id: "roman",
    name: "Roman",
    model: "claude-3-5-sonnet",
    totalTokens: 5640000,
    inputTokens: 3820000,
    outputTokens: 1820000,
    sessions: 287,
    cost: 16.92,
    wastePercent: 6.8,
    outputRatio: 0.323,
    trend: [40000, 44000, 41000, 48000, 45000, 52000, 49000],
    budget: 20.0,
    teamId: "platform-core",
  },
  {
    id: "claire",
    name: "Claire",
    model: "gpt-4o",
    totalTokens: 3380000,
    inputTokens: 2340000,
    outputTokens: 1040000,
    sessions: 156,
    cost: 25.35,
    wastePercent: 15.6,
    outputRatio: 0.308,
    trend: [24000, 26000, 23000, 28000, 25000, 30000, 27000],
    budget: 30.0,
    teamId: "feature-dev",
  },
  {
    id: "xavier",
    name: "Xavier",
    model: "claude-3-5-sonnet",
    totalTokens: 1820000,
    inputTokens: 1240000,
    outputTokens: 580000,
    sessions: 89,
    cost: 5.46,
    wastePercent: 5.2,
    outputRatio: 0.319,
    trend: [12000, 14000, 13000, 16000, 15000, 17000, 16000],
    budget: 10.0,
    teamId: "leadership",
  },
  {
    id: "tim",
    name: "Tim",
    model: "gpt-4o",
    totalTokens: 2140000,
    inputTokens: 1480000,
    outputTokens: 660000,
    sessions: 103,
    cost: 16.05,
    wastePercent: 11.8,
    outputRatio: 0.308,
    trend: [15000, 17000, 16000, 20000, 18000, 21000, 19000],
    budget: 20.0,
    teamId: "leadership",
  },
  {
    id: "amadeus",
    name: "Amadeus",
    model: "claude-3-5-sonnet",
    totalTokens: 940000,
    inputTokens: 640000,
    outputTokens: 300000,
    sessions: 47,
    cost: 2.82,
    wastePercent: 3.1,
    outputRatio: 0.319,
    trend: [6000, 7000, 6500, 8000, 7500, 9000, 8500],
    budget: 5.0,
    teamId: "leadership",
  },
];

const HOURLY_USAGE: HourlyUsage[] = [
  { hour: 0, tokens: 12000, label: "12a" },
  { hour: 1, tokens: 8500, label: "1a" },
  { hour: 2, tokens: 6200, label: "2a" },
  { hour: 3, tokens: 5100, label: "3a" },
  { hour: 4, tokens: 7300, label: "4a" },
  { hour: 5, tokens: 14000, label: "5a" },
  { hour: 6, tokens: 28000, label: "6a" },
  { hour: 7, tokens: 52000, label: "7a" },
  { hour: 8, tokens: 78000, label: "8a" },
  { hour: 9, tokens: 95000, label: "9a" },
  { hour: 10, tokens: 112000, label: "10a" },
  { hour: 11, tokens: 118000, label: "11a" },
  { hour: 12, tokens: 104000, label: "12p" },
  { hour: 13, tokens: 122000, label: "1p" },
  { hour: 14, tokens: 135000, label: "2p" },
  { hour: 15, tokens: 128000, label: "3p" },
  { hour: 16, tokens: 119000, label: "4p" },
  { hour: 17, tokens: 98000, label: "5p" },
  { hour: 18, tokens: 74000, label: "6p" },
  { hour: 19, tokens: 58000, label: "7p" },
  { hour: 20, tokens: 45000, label: "8p" },
  { hour: 21, tokens: 38000, label: "9p" },
  { hour: 22, tokens: 29000, label: "10p" },
  { hour: 23, tokens: 19000, label: "11p" },
];

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-1",
    title: "Enable prompt compression for Wes",
    description:
      "Wes shows 22% token waste. Applying automatic prompt compression to system prompts could reduce input tokens by ~18% with negligible quality impact.",
    category: "compression",
    estimatedSavings: 460800,
    estimatedCostSavings: 3.46,
    effort: "low",
    agentIds: ["wes"],
  },
  {
    id: "rec-2",
    title: "Prune context window for Reed",
    description:
      "Reed's sessions average 19,800 tokens but output ratio is only 28.9%. Truncating stale context after 10 turns could save up to 20% of input tokens.",
    category: "pruning",
    estimatedSavings: 388000,
    estimatedCostSavings: 2.91,
    effort: "medium",
    agentIds: ["reed"],
  },
  {
    id: "rec-3",
    title: "Route Sam's tasks to Gemini Flash",
    description:
      "Sam processes high-volume, lower-complexity tasks on Gemini 1.5 Pro. Routing 60% to Gemini 1.5 Flash could cut costs by 80% on those calls.",
    category: "routing",
    estimatedSavings: 2892000,
    estimatedCostSavings: 2.9,
    effort: "medium",
    agentIds: ["sam"],
  },
  {
    id: "rec-4",
    title: "Cache repeated system prompts across Product & UI Squad",
    description:
      "Piper, Quinn, Reed, Wes, and Sam all load similar base system prompts each session. Shared prompt caching could eliminate ~15% of input tokens squad-wide.",
    category: "caching",
    estimatedSavings: 2088000,
    estimatedCostSavings: 7.2,
    effort: "high",
    agentIds: ["piper", "quinn", "reed", "wes", "sam"],
  },
  {
    id: "rec-5",
    title: "Compress Claire's analysis prompts",
    description:
      "Claire's input prompts average 15,000 tokens. Structured data extraction using JSON schemas instead of verbose instructions could reduce prompt length by 30%.",
    category: "compression",
    estimatedSavings: 702000,
    estimatedCostSavings: 5.27,
    effort: "medium",
    agentIds: ["claire"],
  },
  {
    id: "rec-6",
    title: "Route Xavier's briefings to Claude Haiku",
    description:
      "Xavier's sessions are short, high-frequency status briefings. Switching to Claude 3 Haiku for these would maintain quality at 90% cost reduction.",
    category: "routing",
    estimatedSavings: 1092000,
    estimatedCostSavings: 4.37,
    effort: "low",
    agentIds: ["xavier"],
  },
  {
    id: "rec-7",
    title: "Implement semantic deduplication for Quinn",
    description:
      "Quinn's sessions show 12% repeated context across turns. Semantic deduplication of context blocks could reduce input tokens by an estimated 10%.",
    category: "pruning",
    estimatedSavings: 210000,
    estimatedCostSavings: 0.63,
    effort: "high",
    agentIds: ["quinn"],
  },
  {
    id: "rec-8",
    title: "Cache tool definitions across all agents",
    description:
      "All agents load identical tool definitions on every call. Tool definition caching would eliminate these tokens entirely—estimated 8-12% of total input tokens.",
    category: "caching",
    estimatedSavings: 2940000,
    estimatedCostSavings: 10.2,
    effort: "medium",
    agentIds: ["piper", "quinn", "reed", "wes", "sam", "roman", "claire", "xavier", "tim", "amadeus"],
  },
  {
    id: "rec-9",
    title: "Batch Tim's architecture reviews",
    description:
      "Tim opens many short 1-2 turn sessions for code reviews. Batching these into longer sessions would reduce per-session overhead tokens by ~40%.",
    category: "pruning",
    estimatedSavings: 385200,
    estimatedCostSavings: 2.89,
    effort: "low",
    agentIds: ["tim"],
  },
  {
    id: "rec-10",
    title: "Summarize Roman's long-running sessions",
    description:
      "Roman has the highest session count. Periodic mid-session summarization of conversation history would keep context lean for his longest sessions.",
    category: "compression",
    estimatedSavings: 1128000,
    estimatedCostSavings: 3.38,
    effort: "medium",
    agentIds: ["roman"],
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1000000) {return `${(n / 1000000).toFixed(1)}M`;}
  if (n >= 1000) {return `${Math.round(n / 1000)}K`;}
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

function getModelColor(model: ModelName): string {
  switch (model) {
    case "claude-3-5-sonnet":
      return "#6366f1";
    case "gpt-4o":
      return "#10b981";
    case "gemini-1.5-pro":
      return "#f59e0b";
  }
}

function getEffortBadgeClass(effort: Effort): string {
  switch (effort) {
    case "low":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "medium":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "high":
      return "text-rose-400 bg-rose-400/10 border-rose-400/20";
  }
}

function getCategoryIcon(category: RecCategory): string {
  switch (category) {
    case "compression":
      return "⚡";
    case "pruning":
      return "✂";
    case "routing":
      return "↗";
    case "caching":
      return "◈";
  }
}

function getCategoryBadgeClass(category: RecCategory): string {
  switch (category) {
    case "compression":
      return "text-indigo-400 bg-indigo-400/10 border-indigo-400/20";
    case "pruning":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "routing":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "caching":
      return "text-sky-400 bg-sky-400/10 border-sky-400/20";
  }
}

// ─── Micro-components ─────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string;
  sub?: string;
  trendLabel?: string;
  trendUp?: boolean;
  valueClass?: string;
}

function KpiCard({ title, value, sub, trendLabel, trendUp, valueClass = "text-white" }: KpiCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-2">
      <span className="text-zinc-400 text-sm font-medium">{title}</span>
      <span className={cn("text-3xl font-bold tracking-tight", valueClass)}>{value}</span>
      {sub && <span className="text-zinc-500 text-xs">{sub}</span>}
      {trendLabel && (
        <span className={cn("text-xs font-medium", trendUp ? "text-emerald-400" : "text-rose-400")}>
          {trendUp ? "▲" : "▼"} {trendLabel}
        </span>
      )}
    </div>
  );
}

interface SparklineProps {
  data: number[];
  barColor: string;
  height?: number;
}

function Sparkline({ data, barColor, height = 24 }: SparklineProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: `${height}px`, width: "56px" }}>
      {data.map((v, i) => {
        const pct = ((v - min) / range) * 100;
        const barH = Math.max(3, (pct / 100) * height);
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${barH}px`,
              backgroundColor: barColor,
              borderRadius: "2px",
              opacity: 0.4 + (i / (data.length - 1)) * 0.6,
            }}
          />
        );
      })}
    </div>
  );
}

interface HBarProps {
  label: string;
  value: number;
  max: number;
  barColor: string;
  suffix: string;
}

function HBar({ label, value, max, barColor, suffix }: HBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
      <span style={{ color: "#a1a1aa", fontSize: "13px", width: "150px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: "8px", backgroundColor: "#27272a", borderRadius: "4px", overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: barColor,
            borderRadius: "4px",
          }}
        />
      </div>
      <span style={{ color: "#e4e4e7", fontSize: "13px", width: "72px", textAlign: "right", flexShrink: 0, fontFamily: "monospace" }}>
        {suffix}
      </span>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const totalTokens = AGENTS.reduce((acc, a) => acc + a.totalTokens, 0);
  const totalCost = AGENTS.reduce((acc, a) => acc + a.cost, 0);
  const totalSessions = AGENTS.reduce((acc, a) => acc + a.sessions, 0);
  const avgPerSession = Math.round(totalTokens / totalSessions);
  const avgWaste = AGENTS.reduce((acc, a) => acc + a.wastePercent, 0) / AGENTS.length;
  const efficiencyScore = Math.round(100 - avgWaste);

  const maxHourly = Math.max(...HOURLY_USAGE.map((h) => h.tokens));
  const totalHourly = HOURLY_USAGE.reduce((acc, h) => acc + h.tokens, 0);

  const modelTotals: Record<ModelName, number> = {
    "claude-3-5-sonnet": 0,
    "gpt-4o": 0,
    "gemini-1.5-pro": 0,
  };
  for (const agent of AGENTS) {
    modelTotals[agent.model] += agent.totalTokens;
  }
  const maxModelTokens = Math.max(...(Object.values(modelTotals)));

  const topConsumers = [...AGENTS].toSorted((a, b) => b.totalTokens - a.totalTokens).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Tokens Used"
          value={formatTokens(totalTokens)}
          sub="Last 30 days"
          trendLabel="8.3% vs prior period"
          trendUp={true}
        />
        <KpiCard
          title="Total Cost"
          value={formatCost(totalCost)}
          sub={`${AGENTS.length} active agents`}
          trendLabel="5.1% vs prior period"
          trendUp={false}
          valueClass="text-amber-400"
        />
        <KpiCard
          title="Avg Tokens / Session"
          value={formatTokens(avgPerSession)}
          sub={`${totalSessions} total sessions`}
          trendLabel="2.4% vs prior period"
          trendUp={false}
        />
        <KpiCard
          title="Efficiency Score"
          value={`${efficiencyScore}/100`}
          sub={`Avg waste: ${formatPercent(avgWaste)}`}
          trendLabel="1.2pt improvement"
          trendUp={true}
          valueClass="text-emerald-400"
        />
      </div>

      {/* 24h Bar Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Token Usage — Last 24 Hours</h3>
          <span className="text-zinc-500 text-xs font-mono">{formatTokens(totalHourly)} total</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "120px", padding: "0 2px" }}>
          {HOURLY_USAGE.map((h) => {
            const pct = (h.tokens / maxHourly) * 100;
            const isBusinessHour = h.hour >= 9 && h.hour <= 17;
            return (
              <div
                key={h.hour}
                title={`${h.label}: ${formatTokens(h.tokens)}`}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(4, (pct / 100) * 112)}px`,
                    backgroundColor: isBusinessHour ? "#6366f1" : "#4338ca",
                    borderRadius: "3px 3px 0 0",
                    opacity: isBusinessHour ? 1 : 0.55,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "3px", padding: "4px 2px 0" }}>
          {HOURLY_USAGE.map((h) => (
            <div
              key={h.hour}
              style={{ flex: 1, textAlign: "center", fontSize: "9px", color: "#71717a", overflow: "hidden" }}
            >
              {h.hour % 4 === 0 ? h.label : ""}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Model Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Model Breakdown</h3>
          {(Object.entries(modelTotals) as [ModelName, number][]).map(([model, tokens]) => (
            <HBar
              key={model}
              label={model}
              value={tokens}
              max={maxModelTokens}
              barColor={getModelColor(model)}
              suffix={formatTokens(tokens)}
            />
          ))}
          <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-4">
            {(Object.keys(modelTotals) as ModelName[]).map((model) => (
              <span key={model} className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: getModelColor(model) }} />
                {formatPercent((modelTotals[model] / totalTokens) * 100)}
              </span>
            ))}
          </div>
        </div>

        {/* Top Consumers */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Top Consumers</h3>
          <div className="space-y-3">
            {topConsumers.map((agent, i) => (
              <div key={agent.id} className="flex items-center gap-3">
                <span className="text-zinc-600 font-mono text-xs" style={{ width: "16px", textAlign: "right", flexShrink: 0 }}>
                  {i + 1}
                </span>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: getModelColor(agent.model),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: "11px",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  {agent.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-medium">{agent.name}</span>
                    <span className="text-zinc-400 text-sm font-mono">{formatTokens(agent.totalTokens)}</span>
                  </div>
                  <div style={{ height: "4px", backgroundColor: "#27272a", borderRadius: "2px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${(agent.totalTokens / topConsumers[0].totalTokens) * 100}%`,
                        height: "100%",
                        backgroundColor: getModelColor(agent.model),
                        borderRadius: "2px",
                      }}
                    />
                  </div>
                </div>
                <span className="text-zinc-500 text-xs font-mono" style={{ flexShrink: 0, width: "48px", textAlign: "right" }}>
                  {formatCost(agent.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analysis Tab ─────────────────────────────────────────────────────────────

function AnalysisTab() {
  const [modelFilter, setModelFilter] = useState<ModelName | "all">("all");
  const [sortField, setSortField] = useState<SortField>("totalTokens");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allModels: ModelName[] = ["claude-3-5-sonnet", "gpt-4o", "gemini-1.5-pro"];

  const filtered = AGENTS.filter((a) => modelFilter === "all" || a.model === modelFilter);

  const sorted = [...filtered].toSorted((a, b) => {
    if (sortField === "name") {
      return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    let aVal = 0;
    let bVal = 0;
    switch (sortField) {
      case "totalTokens":
        aVal = a.totalTokens;
        bVal = b.totalTokens;
        break;
      case "sessions":
        aVal = a.sessions;
        bVal = b.sessions;
        break;
      case "avgTokensPerSession":
        aVal = a.totalTokens / a.sessions;
        bVal = b.totalTokens / b.sessions;
        break;
      case "outputRatio":
        aVal = a.outputRatio;
        bVal = b.outputRatio;
        break;
      case "wastePercent":
        aVal = a.wastePercent;
        bVal = b.wastePercent;
        break;
      case "cost":
        aVal = a.cost;
        bVal = b.cost;
        break;
      default:
        aVal = 0;
        bVal = 0;
    }
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortBtn({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field;
    return (
      <button
        onClick={() => toggleSort(field)}
        className={cn("text-xs font-medium text-left transition-colors hover:text-white", active ? "text-indigo-400" : "text-zinc-500")}
      >
        {label} {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </button>
    );
  }

  const colTemplate = "160px 110px 70px 120px 110px 85px 60px 60px";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-zinc-500 text-sm">Model:</span>
        <button
          onClick={() => setModelFilter("all")}
          className={cn(
            "px-3 py-1 rounded-lg text-sm border transition-colors",
            modelFilter === "all" ? "bg-indigo-600 border-indigo-500 text-white" : "border-zinc-800 text-zinc-400 hover:text-white"
          )}
        >
          All
        </button>
        {allModels.map((m) => (
          <button
            key={m}
            onClick={() => setModelFilter(m)}
            className={cn(
              "px-3 py-1 rounded-lg text-sm border transition-colors",
              modelFilter === m ? "bg-indigo-600 border-indigo-500 text-white" : "border-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: colTemplate,
            padding: "10px 16px",
            borderBottom: "1px solid #27272a",
            gap: "8px",
          }}
        >
          <SortBtn field="name" label="Agent" />
          <SortBtn field="totalTokens" label="Total Tokens" />
          <SortBtn field="sessions" label="Sessions" />
          <SortBtn field="avgTokensPerSession" label="Avg / Session" />
          <SortBtn field="outputRatio" label="Output Ratio" />
          <SortBtn field="wastePercent" label="Waste %" />
          <SortBtn field="cost" label="Cost" />
          <span className="text-xs font-medium text-zinc-500">Trend</span>
        </div>

        {sorted.map((agent) => {
          const isExpanded = expandedId === agent.id;
          const avgPS = Math.round(agent.totalTokens / agent.sessions);
          return (
            <React.Fragment key={agent.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                className="w-full hover:bg-zinc-800/50 transition-colors text-left"
                style={{ borderBottom: "1px solid #27272a" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: colTemplate,
                    padding: "12px 16px",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {/* Agent name + model dot */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: getModelColor(agent.model),
                        flexShrink: 0,
                      }}
                    />
                    <span className="text-white text-sm font-medium truncate">{agent.name}</span>
                  </div>
                  {/* Total Tokens */}
                  <span className="text-zinc-300 text-sm font-mono">{formatTokens(agent.totalTokens)}</span>
                  {/* Sessions */}
                  <span className="text-zinc-400 text-sm">{agent.sessions}</span>
                  {/* Avg / Session */}
                  <span className="text-zinc-300 text-sm font-mono">{formatTokens(avgPS)}</span>
                  {/* Output Ratio */}
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: "36px", height: "4px", backgroundColor: "#27272a", borderRadius: "2px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${agent.outputRatio * 100}%`,
                          height: "100%",
                          backgroundColor: "#6366f1",
                          borderRadius: "2px",
                        }}
                      />
                    </div>
                    <span className="text-zinc-400 text-xs">{formatPercent(agent.outputRatio * 100)}</span>
                  </div>
                  {/* Waste % */}
                  <span
                    className={cn(
                      "text-sm font-mono",
                      agent.wastePercent > 15 ? "text-rose-400" : agent.wastePercent > 10 ? "text-amber-400" : "text-emerald-400"
                    )}
                  >
                    {formatPercent(agent.wastePercent)}
                  </span>
                  {/* Cost */}
                  <span className="text-zinc-400 text-sm font-mono">{formatCost(agent.cost)}</span>
                  {/* Sparkline */}
                  <Sparkline data={agent.trend} barColor={getModelColor(agent.model)} height={24} />
                </div>
              </button>

              {isExpanded && (
                <div
                  style={{
                    padding: "16px 24px 20px",
                    borderBottom: "1px solid #27272a",
                    backgroundColor: "rgba(39,39,42,0.3)",
                  }}
                >
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-zinc-500 text-xs mb-1">Input Tokens</div>
                      <div className="text-white font-mono text-sm">{formatTokens(agent.inputTokens)}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-xs mb-1">Output Tokens</div>
                      <div className="text-white font-mono text-sm">{formatTokens(agent.outputTokens)}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-xs mb-1">Model</div>
                      <div className="text-sm font-medium" style={{ color: getModelColor(agent.model) }}>
                        {agent.model}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-xs mb-1">Team</div>
                      <div className="text-zinc-300 text-sm">{agent.teamId}</div>
                    </div>
                  </div>

                  {/* Token split visual */}
                  <div>
                    <div className="text-zinc-500 text-xs mb-2">Token Split (Input vs Output)</div>
                    <div
                      style={{
                        height: "12px",
                        borderRadius: "6px",
                        overflow: "hidden",
                        display: "flex",
                        maxWidth: "360px",
                      }}
                    >
                      <div style={{ flex: agent.inputTokens, backgroundColor: "#6366f1" }} />
                      <div style={{ flex: agent.outputTokens, backgroundColor: "#10b981" }} />
                    </div>
                    <div className="flex gap-4 mt-1.5">
                      <span className="text-xs text-zinc-500">
                        <span style={{ color: "#6366f1" }}>●</span> Input {formatPercent((agent.inputTokens / agent.totalTokens) * 100)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        <span style={{ color: "#10b981" }}>●</span> Output {formatPercent((agent.outputTokens / agent.totalTokens) * 100)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {sorted.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-sm">No agents match the current filter.</div>
        )}
      </div>
    </div>
  );
}

// ─── Optimization Tab ─────────────────────────────────────────────────────────

function OptimizationTab() {
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<RecCategory | "all">("all");

  const allCategories: RecCategory[] = ["compression", "pruning", "routing", "caching"];

  const totalPotentialCostSavings = RECOMMENDATIONS.reduce((acc, r) => acc + r.estimatedCostSavings, 0);
  const appliedCostSavings = RECOMMENDATIONS.filter((r) => applied.has(r.id)).reduce((acc, r) => acc + r.estimatedCostSavings, 0);
  const appliedTokenSavings = RECOMMENDATIONS.filter((r) => applied.has(r.id)).reduce((acc, r) => acc + r.estimatedSavings, 0);

  const visible = RECOMMENDATIONS.filter((r) => {
    if (dismissed.has(r.id)) {return false;}
    if (categoryFilter !== "all" && r.category !== categoryFilter) {return false;}
    return true;
  });

  function applyRec(id: string) {
    const next = new Set(applied);
    next.add(id);
    setApplied(next);
  }

  function undoRec(id: string) {
    const next = new Set(applied);
    next.delete(id);
    setApplied(next);
  }

  function dismissRec(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
  }

  return (
    <div className="space-y-4">
      {/* Potential savings summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-white font-semibold">Optimization Opportunities</div>
            <div className="text-zinc-400 text-xs mt-0.5">
              {RECOMMENDATIONS.length} recommendations · {formatCost(totalPotentialCostSavings)}/mo potential savings
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-zinc-500 text-xs">Applied</div>
              <div className="text-emerald-400 font-bold text-lg">{applied.size}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Savings Locked In</div>
              <div className="text-white font-bold text-lg">{formatCost(appliedCostSavings)}<span className="text-zinc-500 text-xs font-normal">/mo</span></div>
            </div>
          </div>
        </div>
        {applied.size > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-zinc-500 text-xs">Progress toward potential</span>
              <span className="text-zinc-400 text-xs">{formatPercent((appliedCostSavings / totalPotentialCostSavings) * 100)}</span>
            </div>
            <div style={{ height: "6px", backgroundColor: "#27272a", borderRadius: "3px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${(appliedCostSavings / totalPotentialCostSavings) * 100}%`,
                  height: "100%",
                  backgroundColor: "#34d399",
                  borderRadius: "3px",
                }}
              />
            </div>
            <div className="text-zinc-500 text-xs mt-1">
              {formatTokens(appliedTokenSavings)} tokens / month saved
            </div>
          </div>
        )}
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setCategoryFilter("all")}
          className={cn(
            "px-3 py-1 rounded-lg text-sm border transition-colors",
            categoryFilter === "all" ? "bg-indigo-600 border-indigo-500 text-white" : "border-zinc-800 text-zinc-400 hover:text-white"
          )}
        >
          All
        </button>
        {allCategories.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={cn(
              "px-3 py-1 rounded-lg text-sm border transition-colors capitalize",
              categoryFilter === c ? "bg-indigo-600 border-indigo-500 text-white" : "border-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            {getCategoryIcon(c)} {c}
          </button>
        ))}
      </div>

      {/* Recommendation cards */}
      <div className="space-y-3">
        {visible.map((rec) => {
          const isApplied = applied.has(rec.id);
          return (
            <div
              key={rec.id}
              className={cn(
                "bg-zinc-900 border rounded-xl p-5 transition-colors",
                isApplied ? "border-emerald-400/30" : "border-zinc-800"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium capitalize", getCategoryBadgeClass(rec.category))}>
                      {getCategoryIcon(rec.category)} {rec.category}
                    </span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium capitalize", getEffortBadgeClass(rec.effort))}>
                      {rec.effort} effort
                    </span>
                    {isApplied && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-400/10 border-emerald-400/20 text-emerald-400 font-medium">
                        ✓ Applied
                      </span>
                    )}
                  </div>
                  <h4 className="text-white font-semibold text-sm mb-1">{rec.title}</h4>
                  <p className="text-zinc-400 text-sm leading-relaxed">{rec.description}</p>
                  <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                    <span className="text-zinc-500 text-xs">
                      Est. cost savings:{" "}
                      <span className="text-emerald-400 font-semibold">{formatCost(rec.estimatedCostSavings)}/mo</span>
                    </span>
                    <span className="text-zinc-500 text-xs">
                      Tokens saved:{" "}
                      <span className="text-indigo-400 font-semibold">{formatTokens(rec.estimatedSavings)}</span>
                    </span>
                    <span className="text-zinc-500 text-xs">
                      Affects:{" "}
                      <span className="text-zinc-300">{rec.agentIds.length} agent{rec.agentIds.length > 1 ? "s" : ""}</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isApplied ? (
                    <button
                      onClick={() => undoRec(rec.id)}
                      className="px-3 py-1.5 border border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-white text-sm rounded-lg transition-colors"
                    >
                      Undo
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => applyRec(rec.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => dismissRec(rec.id)}
                        className="px-2 py-1.5 text-zinc-600 hover:text-zinc-400 text-sm rounded-lg transition-colors"
                        title="Dismiss"
                        aria-label="Dismiss recommendation"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <div className="text-zinc-500 text-sm">No recommendations in this category.</div>
          </div>
        )}
      </div>

      {/* Dismissed count */}
      {dismissed.size > 0 && (
        <button
          onClick={() => setDismissed(new Set())}
          className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
        >
          {dismissed.size} recommendation{dismissed.size > 1 ? "s" : ""} dismissed — restore all
        </button>
      )}
    </div>
  );
}

// ─── Budget Tab ───────────────────────────────────────────────────────────────

function buildInitialBudgets(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const agent of AGENTS) {
    result[agent.id] = agent.budget;
  }
  return result;
}

function BudgetTab() {
  const [budgets, setBudgets] = useState<Record<string, number>>(buildInitialBudgets());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  function startEdit(agentId: string) {
    setEditingId(agentId);
    setEditValue(String(budgets[agentId]));
  }

  function commitEdit() {
    if (editingId !== null) {
      const parsed = parseFloat(editValue);
      if (!isNaN(parsed) && parsed >= 0) {
        setBudgets({ ...budgets, [editingId]: parsed });
      }
      setEditingId(null);
      setEditValue("");
    }
  }

  const totalBudget = Object.values(budgets).reduce((acc, v) => acc + v, 0);
  const totalActual = AGENTS.reduce((acc, a) => acc + a.cost, 0);
  const overBudgetAgents = AGENTS.filter((a) => a.cost > budgets[a.id]);
  const budgetUtilPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  const maxBarValue = Math.max(...AGENTS.map((a) => Math.max(budgets[a.id] ?? 0, a.cost)));

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard
          title="Total Budget"
          value={formatCost(totalBudget)}
          sub="All agents, current period"
        />
        <KpiCard
          title="Total Actual Spend"
          value={formatCost(totalActual)}
          sub={`${formatPercent(budgetUtilPct)} of total budget utilized`}
          valueClass={budgetUtilPct > 90 ? "text-rose-400" : budgetUtilPct > 75 ? "text-amber-400" : "text-emerald-400"}
        />
        <KpiCard
          title="Remaining Budget"
          value={formatCost(totalBudget - totalActual)}
          sub={`${overBudgetAgents.length} agent${overBudgetAgents.length !== 1 ? "s" : ""} over budget`}
          valueClass={totalBudget - totalActual < 0 ? "text-rose-400" : "text-white"}
        />
      </div>

      {/* Overage warnings */}
      {overBudgetAgents.length > 0 && (
        <div className="bg-rose-400/10 border border-rose-400/20 rounded-xl p-4">
          <div className="text-rose-400 font-semibold text-sm mb-1">
            {overBudgetAgents.length} agent{overBudgetAgents.length > 1 ? "s" : ""} over budget
          </div>
          <div className="flex flex-wrap gap-2">
            {overBudgetAgents.map((a) => (
              <span key={a.id} className="text-xs text-rose-300 bg-rose-400/10 px-2 py-0.5 rounded-full border border-rose-400/20">
                {a.name}: +{formatCost(a.cost - budgets[a.id])} over
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Budget vs Actual Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Budget vs Actual — Per Agent</h3>
        <div className="space-y-4">
          {AGENTS.map((agent) => {
            const budget = budgets[agent.id] ?? 0;
            const isOver = agent.cost > budget;
            const utilPct = budget > 0 ? Math.min(150, (agent.cost / budget) * 100) : 0;
            const barColor = isOver ? "#f43f5e" : utilPct > 75 ? "#f59e0b" : "#10b981";
            return (
              <div key={agent.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: getModelColor(agent.model),
                      }}
                    />
                    <span className="text-white text-sm font-medium">{agent.name}</span>
                    {isOver && (
                      <span className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-1.5 py-0.5 rounded-full">
                        Over
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-xs font-mono">
                      {formatCost(agent.cost)} <span className="text-zinc-700">/</span> {formatCost(budget)}
                    </span>
                    <span className={cn("text-xs font-mono", isOver ? "text-rose-400" : utilPct > 75 ? "text-amber-400" : "text-emerald-400")}>
                      {formatPercent((agent.cost / (budget || 1)) * 100)}
                    </span>
                  </div>
                </div>
                {/* Bar with budget marker */}
                <div style={{ height: "8px", backgroundColor: "#27272a", borderRadius: "4px", position: "relative", overflow: "visible" }}>
                  {/* Budget limit marker */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${(budget / maxBarValue) * 100}%`,
                      top: "-3px",
                      bottom: "-3px",
                      width: "2px",
                      backgroundColor: "#52525b",
                      borderRadius: "1px",
                      zIndex: 2,
                    }}
                  />
                  {/* Actual bar */}
                  <div
                    style={{
                      width: `${Math.min(100, (agent.cost / maxBarValue) * 100)}%`,
                      height: "100%",
                      backgroundColor: barColor,
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <span className="text-xs text-zinc-500 flex items-center gap-1.5">
            <div style={{ width: "8px", height: "8px", backgroundColor: "#10b981", borderRadius: "2px" }} />
            Under 75%
          </span>
          <span className="text-xs text-zinc-500 flex items-center gap-1.5">
            <div style={{ width: "8px", height: "8px", backgroundColor: "#f59e0b", borderRadius: "2px" }} />
            75–100%
          </span>
          <span className="text-xs text-zinc-500 flex items-center gap-1.5">
            <div style={{ width: "8px", height: "8px", backgroundColor: "#f43f5e", borderRadius: "2px" }} />
            Over budget
          </span>
          <span className="text-xs text-zinc-500 flex items-center gap-1.5">
            <div style={{ width: "2px", height: "10px", backgroundColor: "#52525b", borderRadius: "1px" }} />
            Budget limit
          </span>
        </div>
      </div>

      {/* Budget Allocation Editor */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Budget Allocation Editor</h3>
          <span className="text-zinc-500 text-xs">Click any budget to edit</span>
        </div>
        <div className="space-y-2">
          {AGENTS.map((agent) => {
            const budget = budgets[agent.id] ?? 0;
            const isEditing = editingId === agent.id;
            const isOver = agent.cost > budget;
            const utilPct = budget > 0 ? (agent.cost / budget) * 100 : 0;
            return (
              <div
                key={agent.id}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-lg border transition-colors",
                  isOver ? "border-rose-400/30 bg-rose-400/5" : "border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: getModelColor(agent.model),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: "11px",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  {agent.name[0]}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{agent.name}</span>
                    <span className="text-zinc-600 text-xs hidden sm:inline">{agent.model}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div style={{ width: "80px", height: "3px", backgroundColor: "#27272a", borderRadius: "2px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, utilPct)}%`,
                          height: "100%",
                          backgroundColor: isOver ? "#f43f5e" : utilPct > 75 ? "#f59e0b" : "#10b981",
                        }}
                      />
                    </div>
                    <span className="text-zinc-500 text-xs">{formatPercent(utilPct)} used</span>
                    {isOver && (
                      <span className="text-rose-400 text-xs">+{formatCost(agent.cost - budget)} over</span>
                    )}
                  </div>
                </div>

                <span className="text-zinc-500 text-xs font-mono hidden md:inline">
                  Actual: {formatCost(agent.cost)}
                </span>

                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-400 text-sm">$</span>
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {commitEdit();}
                        if (e.key === "Escape") {
                          setEditingId(null);
                          setEditValue("");
                        }
                      }}
                      autoFocus
                      className="bg-zinc-800 border border-indigo-500 text-white rounded px-2 py-1 text-sm font-mono w-20 outline-none"
                      min="0"
                      step="0.01"
                    />
                    <button
                      onClick={commitEdit}
                      className="text-emerald-400 hover:text-emerald-300 text-xs px-1 transition-colors"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(agent.id)}
                    className="flex items-center gap-1.5 text-sm font-mono text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-600 px-2 py-1 rounded transition-colors"
                  >
                    {formatCost(budget)}
                    <span className="text-zinc-600 text-xs">✎</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-zinc-500 text-sm">Total budget allocation</span>
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 text-xs font-mono">Actual: {formatCost(totalActual)}</span>
            <span className="text-white font-semibold font-mono">{formatCost(totalBudget)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function TokenUsageOptimizer() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "analysis", label: "Analysis" },
    { id: "optimization", label: "Optimization" },
    { id: "budget", label: "Budget" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Token Usage Optimizer</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Monitor, analyze, and optimize token consumption across all agents
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#34d399",
                boxShadow: "0 0 6px #34d399",
              }}
            />
            <span className="text-zinc-500 text-xs font-mono">Live · Updated just now</span>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-0 border-b border-zinc-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-zinc-400 hover:text-white hover:border-zinc-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "analysis" && <AnalysisTab />}
        {activeTab === "optimization" && <OptimizationTab />}
        {activeTab === "budget" && <BudgetTab />}
      </div>
    </div>
  );
}
