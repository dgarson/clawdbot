import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueryEntry {
  id: string;
  query: string;
  searches: number;
  resultCount: number;
  ctr: number;
  avgPosition: number;
  trend: number[];
}

interface ZeroResultEntry {
  id: string;
  query: string;
  count: number;
  lastSearched: string;
  category: string;
  suggestedFix: string;
}

interface DayVolume {
  date: string;
  label: string;
  count: number;
}

interface LatencyPercentile {
  label: string;
  value: number;
  max: number;
}

interface ClickDistribution {
  position: number;
  clicks: number;
}

interface IndexRelevance {
  index: string;
  precision: number;
  recall: number;
  ndcg: number;
}

interface ABTest {
  name: string;
  control: number;
  variant: number;
  delta: number;
  status: "winning" | "losing" | "neutral";
}

interface SatisfactionCategory {
  category: string;
  thumbsUp: number;
  thumbsDown: number;
}

interface CategoryZeroRate {
  category: string;
  rate: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const DAILY_VOLUME: DayVolume[] = [
  { date: "2026-02-08", label: "Feb 8", count: 4120 },
  { date: "2026-02-09", label: "Feb 9", count: 3870 },
  { date: "2026-02-10", label: "Feb 10", count: 5230 },
  { date: "2026-02-11", label: "Feb 11", count: 4910 },
  { date: "2026-02-12", label: "Feb 12", count: 6450 },
  { date: "2026-02-13", label: "Feb 13", count: 7120 },
  { date: "2026-02-14", label: "Feb 14", count: 6890 },
  { date: "2026-02-15", label: "Feb 15", count: 5340 },
  { date: "2026-02-16", label: "Feb 16", count: 4780 },
  { date: "2026-02-17", label: "Feb 17", count: 6210 },
  { date: "2026-02-18", label: "Feb 18", count: 7430 },
  { date: "2026-02-19", label: "Feb 19", count: 8110 },
  { date: "2026-02-20", label: "Feb 20", count: 7650 },
  { date: "2026-02-21", label: "Feb 21", count: 6980 },
];

const LATENCY_PERCENTILES: LatencyPercentile[] = [
  { label: "p50", value: 42, max: 500 },
  { label: "p95", value: 187, max: 500 },
  { label: "p99", value: 412, max: 500 },
];

const QUERY_ENTRIES: QueryEntry[] = [
  {
    id: "q1",
    query: "machine learning tutorials",
    searches: 3840,
    resultCount: 248,
    ctr: 0.62,
    avgPosition: 2.1,
    trend: [320, 290, 410, 380, 460, 510, 480],
  },
  {
    id: "q2",
    query: "typescript generics",
    searches: 2910,
    resultCount: 184,
    ctr: 0.55,
    avgPosition: 2.8,
    trend: [210, 240, 260, 290, 310, 280, 320],
  },
  {
    id: "q3",
    query: "react hooks tutorial",
    searches: 2750,
    resultCount: 312,
    ctr: 0.71,
    avgPosition: 1.9,
    trend: [230, 250, 270, 240, 290, 310, 360],
  },
  {
    id: "q4",
    query: "kubernetes deployment",
    searches: 2340,
    resultCount: 97,
    ctr: 0.44,
    avgPosition: 3.4,
    trend: [180, 190, 200, 220, 210, 240, 260],
  },
  {
    id: "q5",
    query: "docker compose network",
    searches: 2180,
    resultCount: 143,
    ctr: 0.51,
    avgPosition: 2.6,
    trend: [170, 195, 185, 200, 215, 230, 240],
  },
  {
    id: "q6",
    query: "graphql subscriptions",
    searches: 1920,
    resultCount: 76,
    ctr: 0.38,
    avgPosition: 4.1,
    trend: [150, 160, 155, 170, 175, 185, 200],
  },
  {
    id: "q7",
    query: "tailwind css grid",
    searches: 1760,
    resultCount: 201,
    ctr: 0.68,
    avgPosition: 2.2,
    trend: [130, 145, 155, 160, 175, 185, 195],
  },
  {
    id: "q8",
    query: "rust ownership model",
    searches: 1640,
    resultCount: 119,
    ctr: 0.57,
    avgPosition: 2.9,
    trend: [120, 130, 140, 150, 155, 165, 175],
  },
  {
    id: "q9",
    query: "postgres full text search",
    searches: 1520,
    resultCount: 88,
    ctr: 0.46,
    avgPosition: 3.3,
    trend: [110, 120, 125, 130, 140, 150, 160],
  },
  {
    id: "q10",
    query: "next.js app router",
    searches: 1380,
    resultCount: 167,
    ctr: 0.63,
    avgPosition: 2.4,
    trend: [95, 105, 115, 130, 145, 155, 165],
  },
  {
    id: "q11",
    query: "redis cache strategies",
    searches: 1250,
    resultCount: 94,
    ctr: 0.49,
    avgPosition: 3.1,
    trend: [90, 98, 105, 110, 118, 125, 132],
  },
  {
    id: "q12",
    query: "openai embeddings api",
    searches: 1140,
    resultCount: 52,
    ctr: 0.41,
    avgPosition: 3.8,
    trend: [80, 88, 95, 100, 108, 115, 122],
  },
  {
    id: "q13",
    query: "github actions workflow",
    searches: 1050,
    resultCount: 211,
    ctr: 0.72,
    avgPosition: 1.8,
    trend: [75, 82, 88, 92, 98, 105, 112],
  },
  {
    id: "q14",
    query: "prisma schema relations",
    searches: 980,
    resultCount: 73,
    ctr: 0.45,
    avgPosition: 3.5,
    trend: [70, 75, 80, 85, 90, 95, 100],
  },
];

const CLICK_DISTRIBUTIONS: Record<string, ClickDistribution[]> = {
  q1: [
    { position: 1, clicks: 1420 },
    { position: 2, clicks: 860 },
    { position: 3, clicks: 480 },
    { position: 4, clicks: 290 },
    { position: 5, clicks: 180 },
    { position: 6, clicks: 110 },
    { position: 7, clicks: 80 },
    { position: 8, clicks: 50 },
  ],
  q2: [
    { position: 1, clicks: 980 },
    { position: 2, clicks: 610 },
    { position: 3, clicks: 390 },
    { position: 4, clicks: 210 },
    { position: 5, clicks: 140 },
    { position: 6, clicks: 80 },
    { position: 7, clicks: 45 },
    { position: 8, clicks: 30 },
  ],
};

const ZERO_RESULT_ENTRIES: ZeroResultEntry[] = [
  {
    id: "z1",
    query: "llm fine-tuning cost calculator",
    count: 847,
    lastSearched: "2 hours ago",
    category: "AI/ML",
    suggestedFix: "Index pricing guides and LLM benchmarks documentation",
  },
  {
    id: "z2",
    query: "webgpu shader examples",
    count: 612,
    lastSearched: "4 hours ago",
    category: "Graphics",
    suggestedFix: "Add WebGPU tutorial collection and MDN mirror",
  },
  {
    id: "z3",
    query: "bun package manager speed",
    count: 534,
    lastSearched: "1 hour ago",
    category: "Tooling",
    suggestedFix: "Index Bun documentation and benchmark articles",
  },
  {
    id: "z4",
    query: "htmx vs react comparison",
    count: 489,
    lastSearched: "6 hours ago",
    category: "Frontend",
    suggestedFix: "Create comparison articles for modern frontend frameworks",
  },
  {
    id: "z5",
    query: "deno 2.0 migration guide",
    count: 421,
    lastSearched: "3 hours ago",
    category: "Runtime",
    suggestedFix: "Index Deno official docs and community migration guides",
  },
  {
    id: "z6",
    query: "astro islands architecture",
    count: 387,
    lastSearched: "8 hours ago",
    category: "Frontend",
    suggestedFix: "Add Astro documentation to content index",
  },
  {
    id: "z7",
    query: "turborepo monorepo setup 2026",
    count: 342,
    lastSearched: "5 hours ago",
    category: "Tooling",
    suggestedFix: "Index updated Turborepo guides and year-specific tutorials",
  },
  {
    id: "z8",
    query: "claude api tool use streaming",
    count: 298,
    lastSearched: "2 hours ago",
    category: "AI/ML",
    suggestedFix: "Index Anthropic API documentation and streaming examples",
  },
  {
    id: "z9",
    query: "vite 6 plugin api changes",
    count: 276,
    lastSearched: "7 hours ago",
    category: "Tooling",
    suggestedFix: "Add Vite changelog and migration documentation",
  },
  {
    id: "z10",
    query: "effect-ts error handling patterns",
    count: 254,
    lastSearched: "9 hours ago",
    category: "Libraries",
    suggestedFix: "Index Effect-TS documentation and community recipes",
  },
];

const CATEGORY_ZERO_RATES: CategoryZeroRate[] = [
  { category: "AI/ML", rate: 18.4 },
  { category: "Graphics", rate: 24.1 },
  { category: "Tooling", rate: 14.7 },
  { category: "Frontend", rate: 11.2 },
  { category: "Runtime", rate: 16.8 },
  { category: "Libraries", rate: 13.5 },
  { category: "Backend", rate: 8.3 },
  { category: "DevOps", rate: 9.7 },
];

const INDEX_RELEVANCE: IndexRelevance[] = [
  { index: "docs-primary", precision: 0.84, recall: 0.76, ndcg: 0.81 },
  { index: "docs-community", precision: 0.71, recall: 0.68, ndcg: 0.72 },
  { index: "tutorials", precision: 0.79, recall: 0.83, ndcg: 0.78 },
  { index: "api-reference", precision: 0.91, recall: 0.65, ndcg: 0.85 },
  { index: "blog-posts", precision: 0.63, recall: 0.71, ndcg: 0.65 },
  { index: "stackoverflow-mirror", precision: 0.67, recall: 0.88, ndcg: 0.70 },
];

const AB_TESTS: ABTest[] = [
  {
    name: "BM25 vs Neural Rerank",
    control: 0.52,
    variant: 0.67,
    delta: 28.8,
    status: "winning",
  },
  {
    name: "Semantic Boost Factor 1.5x",
    control: 0.61,
    variant: 0.58,
    delta: -4.9,
    status: "losing",
  },
  {
    name: "Query Expansion via Synonyms",
    control: 0.48,
    variant: 0.54,
    delta: 12.5,
    status: "winning",
  },
  {
    name: "Recency Decay 30-day",
    control: 0.55,
    variant: 0.56,
    delta: 1.8,
    status: "neutral",
  },
  {
    name: "Typo Tolerance Threshold 2",
    control: 0.43,
    variant: 0.51,
    delta: 18.6,
    status: "winning",
  },
];

const SATISFACTION_CATEGORIES: SatisfactionCategory[] = [
  { category: "AI/ML", thumbsUp: 1240, thumbsDown: 310 },
  { category: "Frontend", thumbsUp: 2180, thumbsDown: 420 },
  { category: "Backend", thumbsUp: 1870, thumbsDown: 380 },
  { category: "DevOps", thumbsUp: 1430, thumbsDown: 290 },
  { category: "Tooling", thumbsUp: 980, thumbsDown: 210 },
  { category: "Libraries", thumbsUp: 1120, thumbsDown: 340 },
  { category: "Database", thumbsUp: 890, thumbsDown: 180 },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-zinc-500 text-xs font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className={cn("text-3xl font-bold", accent)}>{value}</span>
      <span className="text-zinc-400 text-sm">{sub}</span>
    </div>
  );
}

function BarChart({
  data,
  height = 120,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1 w-full" style={{ height }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div
            key={i}
            className="flex flex-col items-center gap-1 flex-1 group"
          >
            <div className="w-full relative flex items-end" style={{ height: height - 20 }}>
              <div
                className="w-full bg-indigo-600 group-hover:bg-indigo-500 rounded-t transition-colors relative"
                style={{ height: `${pct}%` }}
                title={`${d.label}: ${d.value.toLocaleString()}`}
              />
            </div>
            <span className="text-zinc-500 text-xs truncate w-full text-center">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MiniBarChart({ trend }: { trend: number[] }) {
  const max = Math.max(...trend, 1);
  return (
    <div className="flex items-end gap-px h-6">
      {trend.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-indigo-600 rounded-sm opacity-70"
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  const pct = value * 100;
  const color =
    value >= 0.8
      ? "bg-emerald-500"
      : value >= 0.65
      ? "bg-amber-400"
      : "bg-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-300 w-10 text-right">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab() {
  const totalSearches = DAILY_VOLUME.reduce((s, d) => s + d.count, 0);
  const avgResultCount = 152;
  const ctr = 0.567;
  const zeroResultRate = 0.124;

  const topSearches = QUERY_ENTRIES.slice(0, 8);

  const volumeData = DAILY_VOLUME.map((d) => ({
    label: d.label.replace("Feb ", ""),
    value: d.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Total Searches"
          value={totalSearches.toLocaleString()}
          sub="Last 14 days"
          accent="text-white"
        />
        <MetricCard
          label="Avg Result Count"
          value={avgResultCount.toString()}
          sub="Per query"
          accent="text-indigo-400"
        />
        <MetricCard
          label="Click-Through Rate"
          value={`${(ctr * 100).toFixed(1)}%`}
          sub="+3.2% vs prev period"
          accent="text-emerald-400"
        />
        <MetricCard
          label="Zero-Result Rate"
          value={`${(zeroResultRate * 100).toFixed(1)}%`}
          sub="-0.8% vs prev period"
          accent="text-amber-400"
        />
      </div>

      {/* Volume chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white font-semibold">Search Volume Trend</span>
          <span className="text-zinc-500 text-sm">Daily — Feb 8–21</span>
        </div>
        <BarChart data={volumeData} height={160} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Top searches */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <span className="text-white font-semibold block mb-4">
            Top Searches
          </span>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                <th className="text-left pb-2">Query</th>
                <th className="text-right pb-2">Results</th>
                <th className="text-right pb-2">CTR</th>
              </tr>
            </thead>
            <tbody>
              {topSearches.map((q) => (
                <tr
                  key={q.id}
                  className="border-b border-zinc-800 last:border-0"
                >
                  <td className="py-2 text-zinc-300 truncate max-w-0 w-48">
                    {q.query}
                  </td>
                  <td className="py-2 text-right text-zinc-400">
                    {q.resultCount}
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={cn(
                        "font-medium",
                        q.ctr >= 0.6
                          ? "text-emerald-400"
                          : q.ctr >= 0.45
                          ? "text-zinc-300"
                          : "text-amber-400"
                      )}
                    >
                      {(q.ctr * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Latency distribution */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <span className="text-white font-semibold block mb-4">
            Search Latency Distribution
          </span>
          <div className="flex flex-col gap-6">
            {LATENCY_PERCENTILES.map((p) => (
              <div key={p.label} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-sm font-medium">
                    {p.label}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold",
                      p.value < 100
                        ? "text-emerald-400"
                        : p.value < 300
                        ? "text-amber-400"
                        : "text-rose-400"
                    )}
                  >
                    {p.value}ms
                  </span>
                </div>
                <ProgressBar
                  value={p.value}
                  max={p.max}
                  color={
                    p.value < 100
                      ? "bg-emerald-500"
                      : p.value < 300
                      ? "bg-amber-400"
                      : "bg-rose-400"
                  }
                />
                <span className="text-zinc-500 text-xs">
                  {p.label === "p50"
                    ? "Median — typical user experience"
                    : p.label === "p95"
                    ? "95th percentile — most users"
                    : "99th percentile — tail latency"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-800 grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-emerald-400 font-bold text-lg">98.7%</div>
              <div className="text-zinc-500 text-xs">Under 200ms</div>
            </div>
            <div className="text-center">
              <div className="text-amber-400 font-bold text-lg">1.1%</div>
              <div className="text-zinc-500 text-xs">200–400ms</div>
            </div>
            <div className="text-center">
              <div className="text-rose-400 font-bold text-lg">0.2%</div>
              <div className="text-zinc-500 text-xs">Over 400ms</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Queries ─────────────────────────────────────────────────────────────

function QueriesTab() {
  const [selectedId, setSelectedId] = useState<string>("q1");
  const selected = QUERY_ENTRIES.find((q) => q.id === selectedId) ?? QUERY_ENTRIES[0];

  const clickDist: ClickDistribution[] =
    CLICK_DISTRIBUTIONS[selectedId] ?? CLICK_DISTRIBUTIONS["q1"];

  const maxClicks = Math.max(...clickDist.map((c) => c.clicks), 1);

  const similarQueries: string[] = [
    `${selected.query} examples`,
    `${selected.query} best practices`,
    `advanced ${selected.query}`,
    `${selected.query} 2026`,
  ];

  const trendData = selected.trend.map((v, i) => ({
    label: `D${i + 1}`,
    value: v,
  }));

  return (
    <div className="flex gap-4 h-full">
      {/* Left: query list */}
      <div className="w-80 flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800">
          <span className="text-white font-semibold text-sm">
            Recent Queries
          </span>
        </div>
        <div className="overflow-y-auto flex-1">
          {QUERY_ENTRIES.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelectedId(q.id)}
              className={cn(
                "w-full px-4 py-3 border-b border-zinc-800 last:border-0 flex flex-col gap-1 text-left transition-colors",
                selectedId === q.id
                  ? "bg-indigo-600/20"
                  : "hover:bg-zinc-800"
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium truncate",
                  selectedId === q.id ? "text-indigo-300" : "text-zinc-200"
                )}
              >
                {q.query}
              </span>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{q.searches.toLocaleString()} searches</span>
                <span>CTR {(q.ctr * 100).toFixed(0)}%</span>
                <span>pos {q.avgPosition}</span>
              </div>
              <MiniBarChart trend={q.trend} />
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold text-lg">
                "{selected.query}"
              </h3>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-zinc-400 text-sm">
                  {selected.searches.toLocaleString()} searches
                </span>
                <span className="text-zinc-400 text-sm">
                  {selected.resultCount} avg results
                </span>
                <span className="text-emerald-400 text-sm font-medium">
                  {(selected.ctr * 100).toFixed(1)}% CTR
                </span>
                <span className="text-zinc-400 text-sm">
                  Avg pos {selected.avgPosition}
                </span>
              </div>
            </div>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
              Last 7 days
            </span>
          </div>

          {/* Trend mini chart */}
          <div>
            <span className="text-zinc-500 text-xs uppercase tracking-wide mb-2 block">
              Daily Trend
            </span>
            <BarChart data={trendData} height={80} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Click distribution */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <span className="text-white font-semibold text-sm block mb-4">
              Click Position Distribution
            </span>
            <div className="flex flex-col gap-2">
              {clickDist.map((c) => (
                <div key={c.position} className="flex items-center gap-3">
                  <span className="text-zinc-500 text-xs w-12">
                    Pos {c.position}
                  </span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(c.clicks / maxClicks) * 100}%` }}
                    />
                  </div>
                  <span className="text-zinc-400 text-xs w-16 text-right">
                    {c.clicks.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Similar queries */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <span className="text-white font-semibold text-sm block mb-4">
              Similar Query Suggestions
            </span>
            <div className="flex flex-col gap-2">
              {similarQueries.map((sq, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-zinc-800 rounded-lg"
                >
                  <span className="text-zinc-300 text-sm truncate">{sq}</span>
                  <button className="text-xs text-indigo-400 hover:text-indigo-300 ml-2 whitespace-nowrap">
                    Add
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <span className="text-zinc-500 text-xs">
                Suggestions based on semantic similarity and co-occurrence
                patterns.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Zero Results ────────────────────────────────────────────────────────

function ZeroResultsTab() {
  const [sortBy, setSortBy] = useState<"count" | "recent">("count");

  const sorted = [...ZERO_RESULT_ENTRIES].toSorted((a, b) => {
    if (sortBy === "count") {return b.count - a.count;}
    return a.lastSearched.localeCompare(b.lastSearched);
  });

  const maxRate = Math.max(...CATEGORY_ZERO_RATES.map((c) => c.rate), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary banner */}
      <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-4 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        <span className="text-amber-300 text-sm">
          <strong>12.4%</strong> of searches returned zero results this period —
          above the 10% target. 10 recurring queries identified for immediate
          indexing action.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Zero result list */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-white font-semibold text-sm">
              Zero-Result Queries
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSortBy("count")}
                className={cn(
                  "text-xs px-2 py-1 rounded",
                  sortBy === "count"
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                By Count
              </button>
              <button
                onClick={() => setSortBy("recent")}
                className={cn(
                  "text-xs px-2 py-1 rounded",
                  sortBy === "recent"
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Recent
              </button>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
            {sorted.map((z) => (
              <div
                key={z.id}
                className="px-4 py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-zinc-200 text-sm font-medium truncate">
                    {z.query}
                  </span>
                  <span className="text-rose-400 font-bold text-sm flex-shrink-0">
                    {z.count.toLocaleString()}×
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-zinc-500">{z.lastSearched}</span>
                  <span className="text-xs text-zinc-600">·</span>
                  <span className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                    {z.category}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 bg-zinc-800/60 rounded p-2">
                  <span className="text-emerald-400 font-medium">Fix: </span>
                  {z.suggestedFix}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zero result rate by category */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <span className="text-white font-semibold text-sm block mb-4">
            Zero-Result Rate by Category
          </span>
          <div className="flex flex-col gap-4">
            {CATEGORY_ZERO_RATES.map((c) => (
              <div key={c.category} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{c.category}</span>
                  <span
                    className={cn(
                      "font-medium",
                      c.rate >= 20
                        ? "text-rose-400"
                        : c.rate >= 14
                        ? "text-amber-400"
                        : "text-emerald-400"
                    )}
                  >
                    {c.rate}%
                  </span>
                </div>
                <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      c.rate >= 20
                        ? "bg-rose-500"
                        : c.rate >= 14
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                    )}
                    style={{ width: `${(c.rate / maxRate) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800">
            <span className="text-zinc-500 text-xs font-medium block mb-2">
              Threshold Legend
            </span>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-2 rounded-full bg-emerald-500" />
                <span className="text-zinc-400 text-xs">Under 14% — on target</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-2 rounded-full bg-amber-400" />
                <span className="text-zinc-400 text-xs">14–20% — needs attention</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-2 rounded-full bg-rose-500" />
                <span className="text-zinc-400 text-xs">Over 20% — critical</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Relevance ───────────────────────────────────────────────────────────

function RelevanceTab() {
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {/* Index scoring */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <span className="text-white font-semibold block mb-4">
          Relevance Scores by Index
        </span>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                <th className="text-left pb-3">Index</th>
                <th className="text-left pb-3 w-48">Precision</th>
                <th className="text-left pb-3 w-48">Recall</th>
                <th className="text-left pb-3 w-48">NDCG</th>
                <th className="text-right pb-3">Health</th>
              </tr>
            </thead>
            <tbody>
              {INDEX_RELEVANCE.map((idx) => {
                const avg = (idx.precision + idx.recall + idx.ndcg) / 3;
                return (
                  <tr key={idx.index} className="border-b border-zinc-800 last:border-0">
                    <td className="py-3 text-zinc-300 font-medium font-mono text-xs">
                      {idx.index}
                    </td>
                    <td className="py-3 pr-6">
                      <ScoreBar value={idx.precision} />
                    </td>
                    <td className="py-3 pr-6">
                      <ScoreBar value={idx.recall} />
                    </td>
                    <td className="py-3 pr-6">
                      <ScoreBar value={idx.ndcg} />
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          avg >= 0.78
                            ? "bg-emerald-500/20 text-emerald-400"
                            : avg >= 0.68
                            ? "bg-amber-400/20 text-amber-400"
                            : "bg-rose-400/20 text-rose-400"
                        )}
                      >
                        {avg >= 0.78 ? "Healthy" : avg >= 0.68 ? "Fair" : "Poor"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* A/B tests */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-white font-semibold text-sm">
              Ranking Algorithm A/B Tests
            </span>
          </div>
          <div className="divide-y divide-zinc-800">
            {AB_TESTS.map((test) => (
              <div key={test.name}>
                <button
                  onClick={() =>
                    setExpandedTest(expandedTest === test.name ? null : test.name)
                  }
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800 transition-colors text-left"
                >
                  <span className="text-zinc-300 text-sm">{test.name}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-bold",
                        test.status === "winning"
                          ? "text-emerald-400"
                          : test.status === "losing"
                          ? "text-rose-400"
                          : "text-zinc-400"
                      )}
                    >
                      {test.delta > 0 ? "+" : ""}
                      {test.delta.toFixed(1)}%
                    </span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        test.status === "winning"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : test.status === "losing"
                          ? "bg-rose-400/20 text-rose-400"
                          : "bg-zinc-700 text-zinc-400"
                      )}
                    >
                      {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                    </span>
                  </div>
                </button>
                {expandedTest === test.name && (
                  <div className="px-4 pb-4 bg-zinc-800/40">
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <div className="bg-zinc-800 rounded-lg p-3">
                        <div className="text-zinc-500 text-xs mb-1">
                          Control CTR
                        </div>
                        <div className="text-white font-bold text-lg">
                          {(test.control * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-3">
                        <div className="text-zinc-500 text-xs mb-1">
                          Variant CTR
                        </div>
                        <div
                          className={cn(
                            "font-bold text-lg",
                            test.variant > test.control
                              ? "text-emerald-400"
                              : "text-rose-400"
                          )}
                        >
                          {(test.variant * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500"
                          style={{ width: `${test.control * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500">vs</span>
                      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full",
                            test.variant > test.control
                              ? "bg-emerald-500"
                              : "bg-rose-500"
                          )}
                          style={{ width: `${test.variant * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* User satisfaction */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <span className="text-white font-semibold text-sm block mb-4">
            User Satisfaction by Category
          </span>
          <div className="flex flex-col gap-4">
            {SATISFACTION_CATEGORIES.map((s) => {
              const total = s.thumbsUp + s.thumbsDown;
              const upPct = total > 0 ? (s.thumbsUp / total) * 100 : 0;
              const downPct = total > 0 ? (s.thumbsDown / total) * 100 : 0;
              return (
                <div key={s.category}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-zinc-300 font-medium">
                      {s.category}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400">
                        👍 {s.thumbsUp.toLocaleString()}
                      </span>
                      <span className="text-rose-400">
                        👎 {s.thumbsDown.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden gap-px">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${upPct}%` }}
                      title={`${upPct.toFixed(1)}% positive`}
                    />
                    <div
                      className="bg-rose-500 h-full"
                      style={{ width: `${downPct}%` }}
                      title={`${downPct.toFixed(1)}% negative`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1 text-zinc-500">
                    <span>{upPct.toFixed(0)}% positive</span>
                    <span>{downPct.toFixed(0)}% negative</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type TabId = "overview" | "queries" | "zero-results" | "relevance";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "overview", label: "Overview" },
  { id: "queries", label: "Queries" },
  { id: "zero-results", label: "Zero Results" },
  { id: "relevance", label: "Relevance" },
];

export default function SearchAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Search Analytics
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Performance, relevance, and query intelligence — last 14 days
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Index healthy
              </div>
              <button className="text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg transition-colors">
                Export CSV
              </button>
              <button className="text-sm text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors">
                Configure Indexes
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-zinc-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === tab.id
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t" />
              )}
              {tab.id === "zero-results" && (
                <span className="ml-1.5 text-xs bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                  10
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "queries" && <QueriesTab />}
          {activeTab === "zero-results" && <ZeroResultsTab />}
          {activeTab === "relevance" && <RelevanceTab />}
        </div>
      </div>
    </div>
  );
}
