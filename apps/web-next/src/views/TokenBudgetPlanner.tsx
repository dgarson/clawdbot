import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type ScenarioKey = "conservative" | "current" | "growth";

interface AgentData {
  name: string;
  model: string;
  monthlyBudget: number;
  used: number;
  projected: number;
  costPerMToken: number;
  dailyUsage: number[];
}

interface MonthlyTrend {
  label: string;
  usage: number;
  isProjected?: boolean;
}

// ── Seed Data ────────────────────────────────────────────────────────────────

const AGENTS: AgentData[] = [
  { name: "Luis",    model: "claude-sonnet-4-6",   monthlyBudget: 12_000_000, used: 8_420_000,  projected: 11_800_000, costPerMToken: 3.00,  dailyUsage: [410_000, 385_000, 420_000, 395_000, 440_000, 370_000, 400_000] },
  { name: "Xavier",  model: "claude-opus-4-6",     monthlyBudget: 18_000_000, used: 14_200_000, projected: 19_900_000, costPerMToken: 15.00, dailyUsage: [680_000, 720_000, 650_000, 710_000, 690_000, 740_000, 710_000] },
  { name: "Stephan", model: "gpt-4o",              monthlyBudget: 8_000_000,  used: 5_100_000,  projected: 7_140_000,  costPerMToken: 2.50,  dailyUsage: [240_000, 260_000, 230_000, 250_000, 270_000, 220_000, 245_000] },
  { name: "Roman",   model: "claude-sonnet-4-6",   monthlyBudget: 10_000_000, used: 9_600_000,  projected: 13_440_000, costPerMToken: 3.00,  dailyUsage: [460_000, 480_000, 500_000, 470_000, 510_000, 490_000, 475_000] },
  { name: "Claire",  model: "claude-sonnet-4-6",   monthlyBudget: 10_000_000, used: 6_300_000,  projected: 8_820_000,  costPerMToken: 3.00,  dailyUsage: [300_000, 310_000, 290_000, 280_000, 320_000, 305_000, 295_000] },
  { name: "Piper",   model: "MiniMax-M2.5",        monthlyBudget: 6_000_000,  used: 3_800_000,  projected: 5_320_000,  costPerMToken: 1.20,  dailyUsage: [180_000, 190_000, 175_000, 195_000, 185_000, 170_000, 182_000] },
  { name: "Quinn",   model: "MiniMax-M2.5",        monthlyBudget: 6_000_000,  used: 4_900_000,  projected: 6_860_000,  costPerMToken: 1.20,  dailyUsage: [235_000, 240_000, 250_000, 230_000, 245_000, 255_000, 238_000] },
  { name: "Reed",    model: "claude-haiku-3.5",     monthlyBudget: 4_000_000,  used: 2_100_000,  projected: 2_940_000,  costPerMToken: 0.25,  dailyUsage: [100_000, 95_000, 110_000, 105_000, 98_000, 102_000, 108_000] },
];

const MONTHLY_TRENDS: MonthlyTrend[] = [
  { label: "Sep",  usage: 52_000_000 },
  { label: "Oct",  usage: 58_400_000 },
  { label: "Nov",  usage: 61_200_000 },
  { label: "Dec",  usage: 55_800_000 },
  { label: "Jan",  usage: 64_100_000 },
  { label: "Feb",  usage: 76_220_000, isProjected: true },
];

const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: "conservative", label: "Conservative" },
  { key: "current",      label: "Current" },
  { key: "growth",       label: "Growth" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function applyScenario(agents: AgentData[], scenario: ScenarioKey): AgentData[] {
  if (scenario === "current") return agents;

  if (scenario === "conservative") {
    return agents.map((a) => ({
      ...a,
      monthlyBudget: Math.round(a.monthlyBudget * 0.8),
    }));
  }

  // Growth: top 3 by usage get 50% budget increase
  const sorted = [...agents].sort((a, b) => b.used - a.used);
  const topThreeNames = new Set(sorted.slice(0, 3).map((a) => a.name));
  return agents.map((a) => ({
    ...a,
    monthlyBudget: topThreeNames.has(a.name)
      ? Math.round(a.monthlyBudget * 1.5)
      : a.monthlyBudget,
  }));
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function fmtDollars(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function usageColor(ratio: number): string {
  if (ratio >= 1) return "bg-rose-500";
  if (ratio >= 0.8) return "bg-amber-500";
  return "bg-emerald-500";
}

function deltaColor(delta: number): string {
  if (delta > 0) return "text-rose-400";
  if (delta < 0) return "text-emerald-400";
  return "text-zinc-500";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TokenBudgetPlanner() {
  const [scenario, setScenario] = useState<ScenarioKey>("current");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const agents = applyScenario(AGENTS, scenario);
  const baselineAgents = AGENTS; // always "current" for delta comparison

  const totalBudget    = agents.reduce((s, a) => s + a.monthlyBudget, 0);
  const totalUsed      = agents.reduce((s, a) => s + a.used, 0);
  const totalProjected = agents.reduce((s, a) => s + a.projected, 0);
  const totalCost      = agents.reduce((s, a) => s + (a.projected / 1_000_000) * a.costPerMToken, 0);

  const trendMax = Math.max(...MONTHLY_TRENDS.map((m) => m.usage));

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Token Budget Planner</h1>
        <div className="flex items-center gap-3">
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as ScenarioKey)}
            className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm"
          >
            {SCENARIOS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm transition-colors">
            Export
          </button>
        </div>
      </div>

      {/* ── Summary Bar ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Budget",    value: fmtTokens(totalBudget),    sub: "tokens" },
          { label: "Total Used",      value: fmtTokens(totalUsed),      sub: `${((totalUsed / totalBudget) * 100).toFixed(1)}% of budget` },
          { label: "Total Projected", value: fmtTokens(totalProjected), sub: totalProjected > totalBudget ? "Over budget" : "Under budget" },
          { label: "Est. Monthly Cost", value: fmtDollars(totalCost),   sub: "projected" },
        ].map((card) => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">{card.label}</div>
            <div className="text-xl font-semibold">{card.value}</div>
            <div className={cn(
              "text-xs mt-1",
              card.sub === "Over budget" ? "text-rose-400" : "text-zinc-500",
            )}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Agent Budget Table ─────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_2fr] gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
          <div>Agent</div>
          <div>Model</div>
          <div className="text-right">Budget</div>
          <div className="text-right">Used</div>
          <div className="text-right">Projected</div>
          <div className="text-right">Cost Est.</div>
          <div className="text-right">Over/Under</div>
          <div className="pl-4">Usage</div>
        </div>

        {agents.map((agent) => {
          const ratio = agent.used / agent.monthlyBudget;
          const projRatio = agent.projected / agent.monthlyBudget;
          const delta = agent.projected - agent.monthlyBudget;
          const cost = (agent.projected / 1_000_000) * agent.costPerMToken;
          const isExpanded = expandedAgent === agent.name;
          const dailyMax = Math.max(...agent.dailyUsage);

          return (
            <React.Fragment key={agent.name}>
              <div
                onClick={() => setExpandedAgent(isExpanded ? null : agent.name)}
                className={cn(
                  "grid grid-cols-[1fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_2fr] gap-2 px-4 py-3 items-center cursor-pointer transition-colors",
                  isExpanded ? "bg-zinc-800/50" : "hover:bg-zinc-800/30",
                  "border-b border-zinc-800/50",
                )}
              >
                <div className="font-medium flex items-center gap-2">
                  <span className={cn(
                    "inline-block w-1.5 h-1.5 rounded-full",
                    ratio >= 1 ? "bg-rose-400" : ratio >= 0.8 ? "bg-amber-400" : "bg-emerald-400",
                  )} />
                  {agent.name}
                </div>
                <div className="text-zinc-400 text-sm truncate">{agent.model}</div>
                <div className="text-right text-sm">{fmtTokens(agent.monthlyBudget)}</div>
                <div className="text-right text-sm">{fmtTokens(agent.used)}</div>
                <div className="text-right text-sm">{fmtTokens(agent.projected)}</div>
                <div className="text-right text-sm text-zinc-400">{fmtDollars(cost)}</div>
                <div className={cn("text-right text-sm font-mono", deltaColor(delta))}>
                  {delta > 0 ? "+" : ""}{fmtTokens(delta)}
                </div>
                <div className="pl-4">
                  <div className="relative h-5 bg-zinc-800 rounded overflow-hidden">
                    <div
                      className={cn("h-full rounded-l transition-all", usageColor(ratio))}
                      style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                    />
                    {/* Projected marker */}
                    <div
                      className="absolute top-0 h-full w-0.5 bg-white/60"
                      style={{ left: `${Math.min(projRatio * 100, 100)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-[10px] text-white/80 font-mono">
                        {(ratio * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded daily breakdown */}
              {isExpanded && (
                <div className="col-span-full bg-zinc-800/30 border-b border-zinc-800/50 px-4 py-4">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
                    Last 7 Days — Daily Token Usage
                  </div>
                  <div className="flex items-end gap-2 h-20">
                    {agent.dailyUsage.map((day, i) => {
                      const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                      const pct = (day / dailyMax) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="text-[10px] text-zinc-400 font-mono">{fmtTokens(day)}</div>
                          <div className="w-full flex items-end justify-center" style={{ height: 48 }}>
                            <div
                              className={cn("w-full max-w-[28px] rounded-t transition-all", usageColor(ratio))}
                              style={{ height: `${pct}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-zinc-500">{dayLabels[i]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Scenario Impact Panel ──────────────────────────────────────── */}
      {scenario !== "current" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-4">
            Scenario Impact: {SCENARIOS.find((s) => s.key === scenario)?.label}
          </h2>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div className="text-zinc-500 font-medium">Agent</div>
            <div className="text-zinc-500 font-medium text-right">Current Budget</div>
            <div className="text-zinc-500 font-medium text-right">New Budget</div>
            <div className="text-zinc-500 font-medium text-right">Delta</div>

            {agents.map((agent, i) => {
              const baseline = baselineAgents[i];
              const budgetDelta = agent.monthlyBudget - baseline.monthlyBudget;
              return (
                <React.Fragment key={agent.name}>
                  <div className="text-zinc-300">{agent.name}</div>
                  <div className="text-right text-zinc-400">{fmtTokens(baseline.monthlyBudget)}</div>
                  <div className="text-right">{fmtTokens(agent.monthlyBudget)}</div>
                  <div className={cn("text-right font-mono", deltaColor(budgetDelta))}>
                    {budgetDelta > 0 ? "+" : ""}{fmtTokens(budgetDelta)}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Summary line */}
          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between text-sm">
            <span className="text-zinc-400">
              Total budget change:
            </span>
            {(() => {
              const baseTotal = baselineAgents.reduce((s, a) => s + a.monthlyBudget, 0);
              const newTotal = totalBudget;
              const diff = newTotal - baseTotal;
              const costDiff = agents.reduce((s, a) => s + (a.projected / 1_000_000) * a.costPerMToken, 0)
                - baselineAgents.reduce((s, a) => s + (a.projected / 1_000_000) * a.costPerMToken, 0);
              return (
                <div className="flex gap-6">
                  <span className={cn("font-mono", deltaColor(diff))}>
                    {diff > 0 ? "+" : ""}{fmtTokens(diff)} tokens
                  </span>
                  <span className={cn("font-mono", deltaColor(costDiff))}>
                    {costDiff > 0 ? "+" : ""}{fmtDollars(Math.abs(costDiff))} {costDiff <= 0 ? "savings" : "increase"}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Monthly Trend ──────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Organization Token Usage — 6 Month Trend
        </h2>
        <div className="flex items-end gap-4 h-44">
          {MONTHLY_TRENDS.map((month) => {
            const pct = (month.usage / trendMax) * 100;
            return (
              <div key={month.label} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-xs text-zinc-400 font-mono">{fmtTokens(month.usage)}</div>
                <div className="w-full flex items-end justify-center" style={{ height: 120 }}>
                  <div
                    className={cn(
                      "w-full max-w-[48px] rounded-t transition-all",
                      month.isProjected
                        ? "bg-indigo-500/40 border-2 border-dashed border-indigo-500"
                        : "bg-indigo-500",
                    )}
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-zinc-500">
                  {month.label}
                  {month.isProjected && (
                    <span className="block text-[10px] text-indigo-400">proj.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer Legend ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 text-xs text-zinc-500 pt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <span>Under 80%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span>80–99%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-rose-500" />
          <span>At or over budget</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-5 border border-dashed border-indigo-500 bg-indigo-500/30 rounded-sm" />
          <span>Projected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-5 bg-white/60" />
          <span>Projected marker</span>
        </div>
      </div>
    </div>
  );
}
