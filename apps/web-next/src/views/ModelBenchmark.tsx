import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ModelProvider = "anthropic" | "openai" | "google" | "minimax" | "meta";
type TaskCategory = "reasoning" | "coding" | "creative" | "instruction" | "retrieval" | "multimodal";

interface BenchmarkScore {
  category: TaskCategory;
  score: number; // 0–100
  latencyMs: number;
  tokensPerSec: number;
  costPer1kTokens: number; // USD
  sampleCount: number;
}

interface ModelResult {
  id: string;
  name: string;
  provider: ModelProvider;
  contextWindow: number;
  releaseDate: string;
  scores: BenchmarkScore[];
  avgScore: number;
  avgLatencyMs: number;
  avgCostPer1k: number;
  highlighted?: boolean;
}

const CATEGORIES: TaskCategory[] = ["reasoning", "coding", "creative", "instruction", "retrieval", "multimodal"];

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  reasoning: "Reasoning",
  coding: "Coding",
  creative: "Creative",
  instruction: "Instruction Following",
  retrieval: "Retrieval",
  multimodal: "Multimodal",
};

const CATEGORY_EMOJIS: Record<TaskCategory, string> = {
  reasoning: "🧠",
  coding: "💻",
  creative: "✨",
  instruction: "📋",
  retrieval: "🔍",
  multimodal: "🖼️",
};

const PROVIDER_COLORS: Record<ModelProvider, string> = {
  anthropic: "text-orange-400",
  openai: "text-emerald-400",
  google: "text-blue-400",
  minimax: "text-purple-400",
  meta: "text-indigo-400",
};

// ─── Seed Data ────────────────────────────────────────────────────────────────

const MODELS: ModelResult[] = [
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    contextWindow: 200000,
    releaseDate: "2025-11",
    highlighted: true,
    scores: [
      { category: "reasoning",    score: 94, latencyMs: 1820, tokensPerSec: 68,  costPer1kTokens: 0.003, sampleCount: 200 },
      { category: "coding",       score: 92, latencyMs: 1940, tokensPerSec: 65,  costPer1kTokens: 0.003, sampleCount: 200 },
      { category: "creative",     score: 88, latencyMs: 1750, tokensPerSec: 71,  costPer1kTokens: 0.003, sampleCount: 200 },
      { category: "instruction",  score: 96, latencyMs: 1600, tokensPerSec: 74,  costPer1kTokens: 0.003, sampleCount: 200 },
      { category: "retrieval",    score: 91, latencyMs: 1700, tokensPerSec: 72,  costPer1kTokens: 0.003, sampleCount: 200 },
      { category: "multimodal",   score: 85, latencyMs: 2100, tokensPerSec: 58,  costPer1kTokens: 0.003, sampleCount: 200 },
    ],
    avgScore: 91,
    avgLatencyMs: 1818,
    avgCostPer1k: 0.003,
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    contextWindow: 200000,
    releaseDate: "2025-11",
    scores: [
      { category: "reasoning",    score: 98, latencyMs: 3100, tokensPerSec: 32,  costPer1kTokens: 0.015, sampleCount: 200 },
      { category: "coding",       score: 97, latencyMs: 3400, tokensPerSec: 29,  costPer1kTokens: 0.015, sampleCount: 200 },
      { category: "creative",     score: 96, latencyMs: 2800, tokensPerSec: 36,  costPer1kTokens: 0.015, sampleCount: 200 },
      { category: "instruction",  score: 99, latencyMs: 2700, tokensPerSec: 38,  costPer1kTokens: 0.015, sampleCount: 200 },
      { category: "retrieval",    score: 95, latencyMs: 2900, tokensPerSec: 34,  costPer1kTokens: 0.015, sampleCount: 200 },
      { category: "multimodal",   score: 93, latencyMs: 3600, tokensPerSec: 27,  costPer1kTokens: 0.015, sampleCount: 200 },
    ],
    avgScore: 96,
    avgLatencyMs: 3083,
    avgCostPer1k: 0.015,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: 128000,
    releaseDate: "2024-05",
    scores: [
      { category: "reasoning",    score: 91, latencyMs: 2200, tokensPerSec: 45,  costPer1kTokens: 0.005, sampleCount: 200 },
      { category: "coding",       score: 93, latencyMs: 2400, tokensPerSec: 42,  costPer1kTokens: 0.005, sampleCount: 200 },
      { category: "creative",     score: 87, latencyMs: 2100, tokensPerSec: 47,  costPer1kTokens: 0.005, sampleCount: 200 },
      { category: "instruction",  score: 92, latencyMs: 2000, tokensPerSec: 49,  costPer1kTokens: 0.005, sampleCount: 200 },
      { category: "retrieval",    score: 89, latencyMs: 2150, tokensPerSec: 46,  costPer1kTokens: 0.005, sampleCount: 200 },
      { category: "multimodal",   score: 94, latencyMs: 2500, tokensPerSec: 40,  costPer1kTokens: 0.005, sampleCount: 200 },
    ],
    avgScore: 91,
    avgLatencyMs: 2225,
    avgCostPer1k: 0.005,
  },
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash",
    provider: "google",
    contextWindow: 1000000,
    releaseDate: "2025-09",
    scores: [
      { category: "reasoning",    score: 85, latencyMs: 980,  tokensPerSec: 102, costPer1kTokens: 0.001, sampleCount: 200 },
      { category: "coding",       score: 83, latencyMs: 1100, tokensPerSec: 91,  costPer1kTokens: 0.001, sampleCount: 200 },
      { category: "creative",     score: 79, latencyMs: 900,  tokensPerSec: 111, costPer1kTokens: 0.001, sampleCount: 200 },
      { category: "instruction",  score: 87, latencyMs: 850,  tokensPerSec: 118, costPer1kTokens: 0.001, sampleCount: 200 },
      { category: "retrieval",    score: 88, latencyMs: 880,  tokensPerSec: 114, costPer1kTokens: 0.001, sampleCount: 200 },
      { category: "multimodal",   score: 90, latencyMs: 1050, tokensPerSec: 95,  costPer1kTokens: 0.001, sampleCount: 200 },
    ],
    avgScore: 85,
    avgLatencyMs: 960,
    avgCostPer1k: 0.001,
  },
  {
    id: "minimax-m2-5",
    name: "MiniMax M2.5",
    provider: "minimax",
    contextWindow: 1000000,
    releaseDate: "2025-10",
    scores: [
      { category: "reasoning",    score: 82, latencyMs: 1400, tokensPerSec: 71,  costPer1kTokens: 0.002, sampleCount: 200 },
      { category: "coding",       score: 80, latencyMs: 1550, tokensPerSec: 65,  costPer1kTokens: 0.002, sampleCount: 200 },
      { category: "creative",     score: 84, latencyMs: 1300, tokensPerSec: 77,  costPer1kTokens: 0.002, sampleCount: 200 },
      { category: "instruction",  score: 83, latencyMs: 1250, tokensPerSec: 80,  costPer1kTokens: 0.002, sampleCount: 200 },
      { category: "retrieval",    score: 79, latencyMs: 1350, tokensPerSec: 74,  costPer1kTokens: 0.002, sampleCount: 200 },
      { category: "multimodal",   score: 77, latencyMs: 1600, tokensPerSec: 63,  costPer1kTokens: 0.002, sampleCount: 200 },
    ],
    avgScore: 81,
    avgLatencyMs: 1408,
    avgCostPer1k: 0.002,
  },
  {
    id: "llama-3-3-70b",
    name: "Llama 3.3 70B",
    provider: "meta",
    contextWindow: 128000,
    releaseDate: "2024-12",
    scores: [
      { category: "reasoning",    score: 78, latencyMs: 2800, tokensPerSec: 36,  costPer1kTokens: 0.0009, sampleCount: 200 },
      { category: "coding",       score: 76, latencyMs: 3100, tokensPerSec: 32,  costPer1kTokens: 0.0009, sampleCount: 200 },
      { category: "creative",     score: 74, latencyMs: 2600, tokensPerSec: 39,  costPer1kTokens: 0.0009, sampleCount: 200 },
      { category: "instruction",  score: 80, latencyMs: 2500, tokensPerSec: 40,  costPer1kTokens: 0.0009, sampleCount: 200 },
      { category: "retrieval",    score: 75, latencyMs: 2700, tokensPerSec: 37,  costPer1kTokens: 0.0009, sampleCount: 200 },
      { category: "multimodal",   score: 0,  latencyMs: 0,    tokensPerSec: 0,   costPer1kTokens: 0.0009, sampleCount: 0 },
    ],
    avgScore: 77,
    avgLatencyMs: 2740,
    avgCostPer1k: 0.0009,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (ms === 0) {return "N/A";}
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function fmtCtx(tokens: number): string {
  return tokens >= 1000000 ? `${(tokens / 1000000).toFixed(0)}M` : `${(tokens / 1000).toFixed(0)}K`;
}

function scoreColor(score: number): string {
  if (score >= 90) {return "text-emerald-400";}
  if (score >= 80) {return "text-indigo-400";}
  if (score >= 70) {return "text-amber-400";}
  if (score === 0) {return "text-zinc-600";}
  return "text-rose-400";
}

function scoreBg(score: number): string {
  if (score >= 90) {return "bg-emerald-400";}
  if (score >= 80) {return "bg-indigo-400";}
  if (score >= 70) {return "bg-amber-400";}
  if (score === 0) {return "bg-zinc-700";}
  return "bg-rose-400";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  return (
    <div className="relative h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", scoreBg(score))}
        style={{ width: score === 0 ? "0%" : `${(score / max) * 100}%` }}
        role="presentation"
      />
    </div>
  );
}

function RadarCell({ score }: { score: number }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[56px]">
      <span className={cn("text-sm font-mono font-semibold", scoreColor(score))}>
        {score === 0 ? "—" : score}
      </span>
      <ScoreBar score={score} />
    </div>
  );
}

type SortKey = "avgScore" | "avgLatencyMs" | "avgCostPer1k";

interface ModelCardProps {
  model: ModelResult;
  rank: number;
  selected: boolean;
  onSelect: () => void;
}

function ModelCard({ model, rank, selected, onSelect }: ModelCardProps) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${model.name} - rank ${rank}`}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all",
        "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
        selected
          ? "border-indigo-500 bg-indigo-950/40"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl font-black text-zinc-600 w-7 shrink-0">#{rank}</span>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{model.name}</p>
            <p className={cn("text-xs capitalize", PROVIDER_COLORS[model.provider])}>
              {model.provider}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-xl font-bold font-mono", scoreColor(model.avgScore))}>
            {model.avgScore}
          </p>
          <p className="text-xs text-zinc-500">avg score</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-zinc-500 mb-0.5">Latency</p>
          <p className="text-white font-mono">{fmtMs(model.avgLatencyMs)}</p>
        </div>
        <div>
          <p className="text-zinc-500 mb-0.5">Context</p>
          <p className="text-white font-mono">{fmtCtx(model.contextWindow)}</p>
        </div>
        <div>
          <p className="text-zinc-500 mb-0.5">$/1K tok</p>
          <p className="text-white font-mono">${model.avgCostPer1k.toFixed(4)}</p>
        </div>
      </div>

      {model.highlighted && (
        <div className="mt-2 inline-block rounded text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          ⭐ Current default
        </div>
      )}
    </button>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function ModelBenchmark() {
  const [sortKey, setSortKey] = useState<SortKey>("avgScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | "all">("all");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(MODELS[0].id);
  const [providerFilter, setProviderFilter] = useState<ModelProvider | "all">("all");

  const sorted = useMemo(() => {
    let list = [...MODELS];
    if (providerFilter !== "all") {list = list.filter(m => m.provider === providerFilter);}
    list.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return list;
  }, [sortKey, sortAsc, providerFilter]);

  const selected = useMemo(
    () => MODELS.find(m => m.id === selectedModelId) ?? null,
    [selectedModelId]
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {setsSortAsc(v => !v);}
    else { setSortKey(key); setSortAsc(key === "avgLatencyMs" || key === "avgCostPer1k"); }
  }

  function setsSortAsc(fn: (v: boolean) => boolean) { setSortAsc(fn); }

  const providers: Array<ModelProvider | "all"> = ["all", "anthropic", "openai", "google", "minimax", "meta"];

  // Score for leaderboard: filter by category if selected
  function displayScore(model: ModelResult): number {
    if (selectedCategory === "all") {return model.avgScore;}
    const s = model.scores.find(sc => sc.category === selectedCategory);
    return s?.score ?? 0;
  }

  const leaderboard = useMemo(() => {
    let list = [...MODELS];
    if (providerFilter !== "all") {list = list.filter(m => m.provider === providerFilter);}
    return [...list].toSorted((a, b) => displayScore(b) - displayScore(a));
  }, [providerFilter, selectedCategory]);

  return (
    <main className="flex h-full bg-zinc-950 text-white overflow-hidden" role="main" aria-label="Model Benchmark">
      {/* Left: Leaderboard */}
      <div className="w-80 shrink-0 flex flex-col border-r border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-lg font-bold text-white">Model Benchmark</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Performance across {MODELS.length} models · {200} samples/task</p>
        </div>

        {/* Provider filter */}
        <div className="p-3 border-b border-zinc-800">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by provider">
            {providers.map(p => (
              <button
                key={p}
                onClick={() => setProviderFilter(p)}
                aria-pressed={providerFilter === p}
                className={cn(
                  "text-xs px-2 py-1 rounded capitalize transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  providerFilter === p
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                )}
              >
                {p === "all" ? "All" : p}
              </button>
            ))}
          </div>
        </div>

        {/* Category filter */}
        <div className="p-3 border-b border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2">Score by category</p>
          <div className="flex flex-col gap-1" role="group" aria-label="Score category">
            <button
              onClick={() => setSelectedCategory("all")}
              aria-pressed={selectedCategory === "all"}
              className={cn(
                "text-xs px-2 py-1 rounded text-left transition-colors",
                "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                selectedCategory === "all"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              📊 Overall Average
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={selectedCategory === cat}
                className={cn(
                  "text-xs px-2 py-1 rounded text-left transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  selectedCategory === cat
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {CATEGORY_EMOJIS[cat]} {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2" role="list" aria-label="Model rankings">
          {leaderboard.map((model, i) => (
            <div key={model.id} role="listitem">
              <ModelCard
                model={model}
                rank={i + 1}
                selected={selectedModelId === model.id}
                onSelect={() => setSelectedModelId(model.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Right: Detail */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-6 space-y-6">
            {/* Model header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white">{selected.name}</h2>
                  {selected.highlighted && (
                    <span className="rounded text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Default
                    </span>
                  )}
                </div>
                <p className={cn("text-sm capitalize mt-1", PROVIDER_COLORS[selected.provider])}>
                  {selected.provider} · Context: {fmtCtx(selected.contextWindow)} tokens · Released {selected.releaseDate}
                </p>
              </div>
              <div className="text-right">
                <p className={cn("text-4xl font-black font-mono", scoreColor(selected.avgScore))}>
                  {selected.avgScore}
                </p>
                <p className="text-xs text-zinc-500">overall score</p>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Avg Latency",     value: fmtMs(selected.avgLatencyMs),              sub: "per response" },
                { label: "Cost / 1K tokens", value: `$${selected.avgCostPer1k.toFixed(4)}`,   sub: "USD" },
                { label: "Context Window",  value: fmtCtx(selected.contextWindow),             sub: "max tokens" },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                  <p className="text-xs text-zinc-500">{kpi.label}</p>
                  <p className="text-2xl font-bold text-white mt-1 font-mono">{kpi.value}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Category breakdown */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Category Breakdown</h3>
              <div className="space-y-5">
                {selected.scores.map(sc => (
                  <div key={sc.category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span>{CATEGORY_EMOJIS[sc.category]}</span>
                        <span className="text-sm text-zinc-300">{CATEGORY_LABELS[sc.category]}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-zinc-500">{fmtMs(sc.latencyMs)}</span>
                        <span className="text-zinc-500">{sc.tokensPerSec > 0 ? `${sc.tokensPerSec} tok/s` : "—"}</span>
                        <span className={cn("font-semibold text-sm", scoreColor(sc.score))}>
                          {sc.score === 0 ? "N/A" : sc.score}
                        </span>
                      </div>
                    </div>
                    <ScoreBar score={sc.score} />
                  </div>
                ))}
              </div>
            </div>

            {/* Competitive comparison table */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Head-to-Head Comparison</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {selectedCategory === "all" ? "Overall average scores" : `${CATEGORY_LABELS[selectedCategory]} task scores`}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table" aria-label="Model comparison">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left p-3 text-zinc-500 font-medium">Model</th>
                      {CATEGORIES.map(cat => (
                        <th key={cat} className="text-center p-3 text-zinc-500 font-medium min-w-[60px]">
                          {CATEGORY_EMOJIS[cat]}
                        </th>
                      ))}
                      <th className="text-center p-3 text-zinc-500 font-medium">Avg</th>
                      <th className="text-center p-3 text-zinc-500 font-medium">Latency</th>
                      <th className="text-center p-3 text-zinc-500 font-medium">$/1K</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODELS.map(model => (
                      <tr
                        key={model.id}
                        className={cn(
                          "border-b border-zinc-800/50 transition-colors",
                          model.id === selected.id
                            ? "bg-indigo-950/30"
                            : "hover:bg-zinc-800/40"
                        )}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {model.id === selected.id && (
                              <span className="text-indigo-400">▶</span>
                            )}
                            <span className={cn("font-medium", model.id === selected.id ? "text-white" : "text-zinc-300")}>
                              {model.name}
                            </span>
                          </div>
                        </td>
                        {CATEGORIES.map(cat => {
                          const s = model.scores.find(sc => sc.category === cat);
                          return (
                            <td key={cat} className="text-center p-3">
                              <RadarCell score={s?.score ?? 0} />
                            </td>
                          );
                        })}
                        <td className="text-center p-3">
                          <span className={cn("font-bold font-mono text-sm", scoreColor(model.avgScore))}>
                            {model.avgScore}
                          </span>
                        </td>
                        <td className="text-center p-3 text-zinc-400 font-mono text-xs">
                          {fmtMs(model.avgLatencyMs)}
                        </td>
                        <td className="text-center p-3 text-zinc-400 font-mono text-xs">
                          ${model.avgCostPer1k.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500">Sort leaderboard by:</span>
              {([
                ["avgScore", "Score"],
                ["avgLatencyMs", "Latency"],
                ["avgCostPer1k", "Cost"],
              ] as [SortKey, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleSort(key)}
                  aria-pressed={sortKey === key}
                  className={cn(
                    "px-3 py-1 rounded border transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                    sortKey === key
                      ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                      : "border-zinc-700 text-zinc-400 hover:text-white"
                  )}
                >
                  {label} {sortKey === key ? (sortAsc ? "↑" : "↓") : ""}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-lg font-semibold text-white">Select a model</p>
            <p className="text-sm text-zinc-500 mt-1">Choose a model from the leaderboard to view detailed benchmarks</p>
          </div>
        )}
      </div>
    </main>
  );
}
