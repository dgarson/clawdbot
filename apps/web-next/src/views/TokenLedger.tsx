import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type LedgerPeriod = "today" | "week" | "month" | "custom";
type CostCategory = "input" | "output" | "cache_read" | "cache_write";

interface TokenEntry {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  modelId: string;
  modelName: string;
  provider: string;
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number; // USD
  taskType: string;
}

interface DailySummary {
  date: string; // YYYY-MM-DD
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheRead: number;
  totalCost: number;
  byAgent: Record<string, number>; // agentId -> cost
  byModel: Record<string, number>;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const ENTRIES: TokenEntry[] = [
  { id: "tl-001", timestamp: "2026-02-22T01:18:00Z", agentId: "luis", agentName: "Luis", modelId: "claude-sonnet-4-6", modelName: "Claude Sonnet 4.6", provider: "anthropic", sessionId: "sess-e61f", inputTokens: 42000, outputTokens: 8200, cacheReadTokens: 180000, cacheWriteTokens: 0, totalCost: 0.1730, taskType: "view-generation" },
  { id: "tl-002", timestamp: "2026-02-22T00:55:00Z", agentId: "piper", agentName: "Piper", modelId: "minimax-m2-5", modelName: "MiniMax M2.5", provider: "minimax", sessionId: "sess-piper-1", inputTokens: 54000, outputTokens: 10200, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0.0643, taskType: "component-build" },
  { id: "tl-003", timestamp: "2026-02-22T00:48:00Z", agentId: "reed", agentName: "Reed", modelId: "gemini-3-flash", modelName: "Gemini 3 Flash", provider: "google", sessionId: "sess-reed-1", inputTokens: 78000, outputTokens: 7900, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0.0259, taskType: "data-view" },
  { id: "tl-004", timestamp: "2026-02-22T00:35:00Z", agentId: "wes", agentName: "Wes", modelId: "glm-5", modelName: "GLM-5", provider: "zai", sessionId: "sess-wes-1", inputTokens: 32000, outputTokens: 6100, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0.0190, taskType: "export-view" },
  { id: "tl-005", timestamp: "2026-02-22T00:30:00Z", agentId: "xavier", agentName: "Xavier", modelId: "claude-opus-4-6", modelName: "Claude Opus 4.6", provider: "anthropic", sessionId: "sess-xavier-1", inputTokens: 12000, outputTokens: 3400, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0.2310, taskType: "sprint-planning" },
  { id: "tl-006", timestamp: "2026-02-22T00:15:00Z", agentId: "luis", agentName: "Luis", modelId: "claude-sonnet-4-6", modelName: "Claude Sonnet 4.6", provider: "anthropic", sessionId: "sess-e61f", inputTokens: 38000, outputTokens: 7400, cacheReadTokens: 160000, cacheWriteTokens: 0, totalCost: 0.1540, taskType: "view-generation" },
  { id: "tl-007", timestamp: "2026-02-22T00:05:00Z", agentId: "quinn", agentName: "Quinn", modelId: "gemini-3-flash", modelName: "Gemini 3 Flash", provider: "google", sessionId: "sess-quinn-1", inputTokens: 122000, outputTokens: 7800, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0.0330, taskType: "ux-view" },
  { id: "tl-008", timestamp: "2026-02-21T23:45:00Z", agentId: "tim", agentName: "Tim", modelId: "claude-sonnet-4-6", modelName: "Claude Sonnet 4.6", provider: "anthropic", sessionId: "sess-tim-1", inputTokens: 21000, outputTokens: 4200, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0.0735, taskType: "pr-review" },
  { id: "tl-009", timestamp: "2026-02-21T22:30:00Z", agentId: "stephan", agentName: "Stephan", modelId: "gpt-4o", modelName: "GPT-4o", provider: "openai", sessionId: "sess-stephan-1", inputTokens: 8900, outputTokens: 2100, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0.0555, taskType: "brand-review" },
  { id: "tl-010", timestamp: "2026-02-21T21:00:00Z", agentId: "luis", agentName: "Luis", modelId: "claude-sonnet-4-6", modelName: "Claude Sonnet 4.6", provider: "anthropic", sessionId: "sess-prev", inputTokens: 35000, outputTokens: 6800, cacheReadTokens: 140000, cacheWriteTokens: 0, totalCost: 0.1428, taskType: "view-generation" },
];

const DAILY_SUMMARIES: DailySummary[] = [
  { date: "2026-02-22", totalInputTokens: 399900, totalOutputTokens: 59300, totalCacheRead: 480000, totalCost: 0.693,
    byAgent: { luis: 0.469, piper: 0.064, reed: 0.026, wes: 0.019, xavier: 0.231, quinn: 0.033, tim: 0.074 },
    byModel: { "claude-sonnet-4-6": 0.470, "claude-opus-4-6": 0.231, "gemini-3-flash": 0.059, "minimax-m2-5": 0.064, "glm-5": 0.019 },
  },
  { date: "2026-02-21", totalInputTokens: 520000, totalOutputTokens: 78000, totalCacheRead: 820000, totalCost: 1.244,
    byAgent: { luis: 0.612, xavier: 0.298, stephan: 0.056, tim: 0.182, piper: 0.096 },
    byModel: { "claude-sonnet-4-6": 0.847, "claude-opus-4-6": 0.298, "gpt-4o": 0.056, "minimax-m2-5": 0.043 },
  },
  { date: "2026-02-20", totalInputTokens: 430000, totalOutputTokens: 62000, totalCacheRead: 680000, totalCost: 0.987,
    byAgent: { luis: 0.498, xavier: 0.241, tim: 0.143, piper: 0.105 },
    byModel: { "claude-sonnet-4-6": 0.640, "claude-opus-4-6": 0.241, "minimax-m2-5": 0.106 },
  },
  { date: "2026-02-19", totalInputTokens: 310000, totalOutputTokens: 47000, totalCacheRead: 420000, totalCost: 0.712,
    byAgent: { luis: 0.356, xavier: 0.198, stephan: 0.074, tim: 0.084 },
    byModel: { "claude-sonnet-4-6": 0.440, "claude-opus-4-6": 0.198, "gpt-4o": 0.074 },
  },
  { date: "2026-02-18", totalInputTokens: 280000, totalOutputTokens: 42000, totalCacheRead: 380000, totalCost: 0.631,
    byAgent: { luis: 0.318, xavier: 0.178, stephan: 0.068, quinn: 0.067 },
    byModel: { "claude-sonnet-4-6": 0.385, "claude-opus-4-6": 0.178, "gemini-3-flash": 0.068 },
  },
  { date: "2026-02-17", totalInputTokens: 350000, totalOutputTokens: 53000, totalCacheRead: 520000, totalCost: 0.847,
    byAgent: { luis: 0.424, xavier: 0.220, tim: 0.128, piper: 0.075 },
    byModel: { "claude-sonnet-4-6": 0.544, "claude-opus-4-6": 0.220, "minimax-m2-5": 0.083 },
  },
  { date: "2026-02-16", totalInputTokens: 410000, totalOutputTokens: 61000, totalCacheRead: 640000, totalCost: 0.921,
    byAgent: { luis: 0.461, xavier: 0.259, stephan: 0.082, tim: 0.119 },
    byModel: { "claude-sonnet-4-6": 0.580, "claude-opus-4-6": 0.259, "gpt-4o": 0.082 },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function barH(value: number, max: number, maxPx: number = 60): number {
  return max === 0 ? 0 : Math.max(4, (value / max) * maxPx);
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-orange-500",
  openai:    "bg-emerald-500",
  google:    "bg-blue-500",
  minimax:   "bg-purple-500",
  zai:       "bg-pink-500",
  meta:      "bg-indigo-500",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CostBarChart({ summaries }: { summaries: DailySummary[] }) {
  const maxCost = Math.max(...summaries.map(s => s.totalCost));
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      <h3 className="text-sm font-semibold text-white mb-4">Daily Cost — Last 7 Days</h3>
      <div className="flex items-end gap-2 h-20">
        {[...summaries].reverse().map(day => (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-zinc-500 font-mono">${day.totalCost.toFixed(2)}</span>
            <div
              className="w-full bg-indigo-500 rounded-t transition-all"
              style={{ height: `${barH(day.totalCost, maxCost)}px` }}
              role="presentation"
            />
            <span className="text-[9px] text-zinc-600">
              {new Date(day.date).toLocaleDateString([], { weekday: "short" })}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>Total 7d: <span className="text-white font-mono font-semibold">${summaries.reduce((a, s) => a + s.totalCost, 0).toFixed(2)}</span></span>
        <span>Avg/day: <span className="text-white font-mono">${(summaries.reduce((a, s) => a + s.totalCost, 0) / summaries.length).toFixed(2)}</span></span>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type TabId = "ledger" | "summary" | "breakdown";

export default function TokenLedger() {
  const [tab, setTab] = useState<TabId>("ledger");
  const [agentFilter, setAgentFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");

  const agents = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string }> = [];
    for (const e of ENTRIES) {
      if (!seen.has(e.agentId)) { seen.add(e.agentId); list.push({ id: e.agentId, name: e.agentName }); }
    }
    return list;
  }, []);

  const models = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string }> = [];
    for (const e of ENTRIES) {
      if (!seen.has(e.modelId)) { seen.add(e.modelId); list.push({ id: e.modelId, name: e.modelName }); }
    }
    return list;
  }, []);

  const filteredEntries = useMemo(() => {
    return ENTRIES.filter(e => {
      if (agentFilter !== "all" && e.agentId !== agentFilter) return false;
      if (modelFilter !== "all" && e.modelId !== modelFilter) return false;
      return true;
    });
  }, [agentFilter, modelFilter]);

  const totals = useMemo(() => ({
    input:  filteredEntries.reduce((a, e) => a + e.inputTokens, 0),
    output: filteredEntries.reduce((a, e) => a + e.outputTokens, 0),
    cache:  filteredEntries.reduce((a, e) => a + e.cacheReadTokens, 0),
    cost:   filteredEntries.reduce((a, e) => a + e.totalCost, 0),
  }), [filteredEntries]);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "ledger",    label: "Transaction Ledger" },
    { id: "summary",   label: "7-Day Summary" },
    { id: "breakdown", label: "Cost Breakdown" },
  ];

  // Today's summary
  const today = DAILY_SUMMARIES[0];

  return (
    <main className="flex flex-col h-full bg-zinc-950 text-white overflow-hidden" role="main" aria-label="Token Ledger">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-white">Token Ledger</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Full token consumption and cost accounting across agents and models</p>
          </div>
          {/* Today KPIs */}
          <div className="flex items-center gap-5 text-xs">
            {[
              { label: "Today cost",   value: `$${today.totalCost.toFixed(3)}`,       color: "text-white" },
              { label: "Input tokens", value: fmtTokens(today.totalInputTokens),       color: "text-zinc-300" },
              { label: "Cache hits",   value: fmtTokens(today.totalCacheRead),         color: "text-emerald-400" },
            ].map(k => (
              <div key={k.label} className="text-center">
                <p className={cn("text-lg font-bold font-mono", k.color)}>{k.value}</p>
                <p className="text-zinc-500">{k.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1" role="tablist">
          {tabs.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm transition-colors",
                "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                tab === t.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "ledger" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <select
                value={agentFilter}
                onChange={e => setAgentFilter(e.target.value)}
                aria-label="Filter by agent"
                className={cn("bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white", "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none")}
              >
                <option value="all">All agents</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select
                value={modelFilter}
                onChange={e => setModelFilter(e.target.value)}
                aria-label="Filter by model"
                className={cn("bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white", "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none")}
              >
                <option value="all">All models</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <div className="flex items-center gap-4 ml-auto text-xs text-zinc-400">
                <span>Input: <span className="text-white font-mono">{fmtTokens(totals.input)}</span></span>
                <span>Output: <span className="text-white font-mono">{fmtTokens(totals.output)}</span></span>
                <span>Cost: <span className="text-emerald-400 font-mono font-bold">{fmtCost(totals.cost)}</span></span>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table" aria-label="Token ledger">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50">
                      <th className="text-left p-3 text-zinc-500 font-medium">Time</th>
                      <th className="text-left p-3 text-zinc-500 font-medium">Agent</th>
                      <th className="text-left p-3 text-zinc-500 font-medium">Model</th>
                      <th className="text-left p-3 text-zinc-500 font-medium">Task</th>
                      <th className="text-right p-3 text-zinc-500 font-medium">Input</th>
                      <th className="text-right p-3 text-zinc-500 font-medium">Output</th>
                      <th className="text-right p-3 text-zinc-500 font-medium">Cache</th>
                      <th className="text-right p-3 text-zinc-500 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map(entry => (
                      <tr key={entry.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                        <td className="p-3 text-xs text-zinc-500 whitespace-nowrap">{relTime(entry.timestamp)}</td>
                        <td className="p-3 text-white text-xs">{entry.agentName}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", PROVIDER_COLORS[entry.provider] ?? "bg-zinc-500")} aria-hidden="true" />
                            <span className="text-xs text-zinc-300">{entry.modelName}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-zinc-500">{entry.taskType}</td>
                        <td className="p-3 text-right text-xs font-mono text-zinc-300">{fmtTokens(entry.inputTokens)}</td>
                        <td className="p-3 text-right text-xs font-mono text-zinc-300">{fmtTokens(entry.outputTokens)}</td>
                        <td className="p-3 text-right text-xs font-mono text-emerald-500">
                          {entry.cacheReadTokens > 0 ? fmtTokens(entry.cacheReadTokens) : "—"}
                        </td>
                        <td className="p-3 text-right text-xs font-mono text-white font-semibold">{fmtCost(entry.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "summary" && (
          <div className="space-y-4 max-w-3xl">
            <CostBarChart summaries={DAILY_SUMMARIES} />

            {/* Daily rows */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white">Daily Totals</h3>
              </div>
              <div className="divide-y divide-zinc-800">
                {DAILY_SUMMARIES.map(day => (
                  <div key={day.date} className="px-4 py-3 flex items-center gap-4">
                    <span className="text-sm text-zinc-300 w-24 font-mono">
                      {new Date(day.date).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                    <div className="flex-1 flex items-center gap-6 text-xs">
                      <span className="text-zinc-400">In: <span className="text-white font-mono">{fmtTokens(day.totalInputTokens)}</span></span>
                      <span className="text-zinc-400">Out: <span className="text-white font-mono">{fmtTokens(day.totalOutputTokens)}</span></span>
                      <span className="text-zinc-400">Cache: <span className="text-emerald-400 font-mono">{fmtTokens(day.totalCacheRead)}</span></span>
                    </div>
                    <span className="text-sm font-bold font-mono text-white">${day.totalCost.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "breakdown" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            {/* By agent */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-4">Cost by Agent (Today)</h3>
              <div className="space-y-3">
                {Object.entries(today.byAgent)
                  .sort(([, a], [, b]) => b - a)
                  .map(([agentId, cost]) => {
                    const maxCost = Math.max(...Object.values(today.byAgent));
                    return (
                      <div key={agentId}>
                        <div className="flex items-center justify-between mb-1 text-xs">
                          <span className="text-zinc-300 capitalize">{agentId}</span>
                          <span className="text-white font-mono">{fmtCost(cost)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${(cost / maxCost) * 100}%` }}
                            role="presentation"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* By model */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-4">Cost by Model (Today)</h3>
              <div className="space-y-3">
                {Object.entries(today.byModel)
                  .sort(([, a], [, b]) => b - a)
                  .map(([modelId, cost]) => {
                    const maxCost = Math.max(...Object.values(today.byModel));
                    return (
                      <div key={modelId}>
                        <div className="flex items-center justify-between mb-1 text-xs">
                          <span className="text-zinc-300">{modelId}</span>
                          <span className="text-white font-mono">{fmtCost(cost)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${(cost / maxCost) * 100}%` }}
                            role="presentation"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
