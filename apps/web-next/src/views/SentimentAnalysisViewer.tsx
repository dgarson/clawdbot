import React, { useState } from "react";
import { cn } from "../lib/utils";

type Sentiment = "positive" | "negative" | "neutral" | "mixed";
type Source = "reviews" | "support" | "social" | "nps" | "all";

interface SentimentEntry {
  id: string;
  text: string;
  sentiment: Sentiment;
  score: number; // -1 to 1
  confidence: number; // 0-1
  source: Source;
  entity: string;
  topics: string[];
  timestamp: string;
  language: string;
}

interface TopicSentiment {
  topic: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  trend: number; // +/- delta
}

interface DailyTrend {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
}

interface EntityScore {
  entity: string;
  avgScore: number;
  count: number;
  change: number;
}

const ENTRIES: SentimentEntry[] = [
  {
    id: "e1",
    text: "The new dashboard is absolutely amazing! Super intuitive and the dark theme is chef's kiss.",
    sentiment: "positive",
    score: 0.91,
    confidence: 0.97,
    source: "reviews",
    entity: "Dashboard",
    topics: ["UI", "Theme", "Usability"],
    timestamp: "2026-02-22T14:32:00Z",
    language: "en",
  },
  {
    id: "e2",
    text: "API latency has been terrible this week. Getting 5–8 second response times on basic queries.",
    sentiment: "negative",
    score: -0.82,
    confidence: 0.94,
    source: "support",
    entity: "API",
    topics: ["Performance", "Latency"],
    timestamp: "2026-02-22T13:15:00Z",
    language: "en",
  },
  {
    id: "e3",
    text: "Onboarding flow is okay but could be clearer about which plan features are included.",
    sentiment: "mixed",
    score: -0.15,
    confidence: 0.76,
    source: "nps",
    entity: "Onboarding",
    topics: ["Onboarding", "Pricing", "Clarity"],
    timestamp: "2026-02-22T12:45:00Z",
    language: "en",
  },
  {
    id: "e4",
    text: "The agent scheduling feature saved us hours every week. Incredible ROI.",
    sentiment: "positive",
    score: 0.88,
    confidence: 0.95,
    source: "reviews",
    entity: "Agent Scheduler",
    topics: ["Automation", "ROI", "Scheduling"],
    timestamp: "2026-02-22T11:20:00Z",
    language: "en",
  },
  {
    id: "e5",
    text: "Billing page is confusing. Not sure what I'm being charged for.",
    sentiment: "negative",
    score: -0.67,
    confidence: 0.89,
    source: "support",
    entity: "Billing",
    topics: ["Billing", "Clarity", "UX"],
    timestamp: "2026-02-22T10:55:00Z",
    language: "en",
  },
  {
    id: "e6",
    text: "Decent product. Does what it says on the tin.",
    sentiment: "neutral",
    score: 0.05,
    confidence: 0.82,
    source: "social",
    entity: "General",
    topics: ["General"],
    timestamp: "2026-02-22T10:10:00Z",
    language: "en",
  },
  {
    id: "e7",
    text: "The model comparison view is exactly what we needed for our evals pipeline.",
    sentiment: "positive",
    score: 0.79,
    confidence: 0.91,
    source: "social",
    entity: "Model Comparison",
    topics: ["Evaluation", "ML", "Features"],
    timestamp: "2026-02-22T09:40:00Z",
    language: "en",
  },
  {
    id: "e8",
    text: "Export keeps failing silently. No error message, just nothing happens.",
    sentiment: "negative",
    score: -0.75,
    confidence: 0.93,
    source: "support",
    entity: "Data Export",
    topics: ["Export", "Bugs", "Error Handling"],
    timestamp: "2026-02-22T09:15:00Z",
    language: "en",
  },
  {
    id: "e9",
    text: "Integration with Slack works flawlessly. The notifications are well-formatted.",
    sentiment: "positive",
    score: 0.84,
    confidence: 0.96,
    source: "reviews",
    entity: "Slack Integration",
    topics: ["Integrations", "Notifications"],
    timestamp: "2026-02-22T08:50:00Z",
    language: "en",
  },
  {
    id: "e10",
    text: "Search results could be better ranked. Sometimes the most relevant item is third or fourth.",
    sentiment: "mixed",
    score: -0.28,
    confidence: 0.78,
    source: "nps",
    entity: "Search",
    topics: ["Search", "Ranking", "UX"],
    timestamp: "2026-02-22T08:20:00Z",
    language: "en",
  },
  {
    id: "e11",
    text: "Absolutely love how the permissions model works. Granular and makes sense.",
    sentiment: "positive",
    score: 0.86,
    confidence: 0.94,
    source: "reviews",
    entity: "Permissions",
    topics: ["Security", "RBAC", "UX"],
    timestamp: "2026-02-21T17:30:00Z",
    language: "en",
  },
  {
    id: "e12",
    text: "The mobile experience is just not there. Everything is too small.",
    sentiment: "negative",
    score: -0.71,
    confidence: 0.88,
    source: "social",
    entity: "Mobile",
    topics: ["Mobile", "Responsive", "UX"],
    timestamp: "2026-02-21T16:45:00Z",
    language: "en",
  },
];

const TOPIC_SENTIMENTS: TopicSentiment[] = [
  { topic: "UI/UX", positive: 68, negative: 18, neutral: 14, total: 412, trend: 4.2 },
  { topic: "Performance", positive: 31, negative: 54, neutral: 15, total: 287, trend: -6.1 },
  { topic: "Onboarding", positive: 52, negative: 28, neutral: 20, total: 198, trend: 2.7 },
  { topic: "Billing", positive: 22, negative: 61, neutral: 17, total: 165, trend: -3.4 },
  { topic: "Integrations", positive: 74, negative: 12, neutral: 14, total: 301, trend: 8.9 },
  { topic: "Search", positive: 41, negative: 38, neutral: 21, total: 143, trend: -1.2 },
  { topic: "Security/RBAC", positive: 79, negative: 9, neutral: 12, total: 224, trend: 5.5 },
  { topic: "Mobile", positive: 18, negative: 68, neutral: 14, total: 97, trend: -9.2 },
];

const DAILY_TRENDS: DailyTrend[] = [
  { date: "Feb 16", positive: 58, negative: 22, neutral: 14, mixed: 6 },
  { date: "Feb 17", positive: 62, negative: 20, neutral: 12, mixed: 6 },
  { date: "Feb 18", positive: 55, negative: 27, neutral: 13, mixed: 5 },
  { date: "Feb 19", positive: 60, negative: 24, neutral: 11, mixed: 5 },
  { date: "Feb 20", positive: 64, negative: 19, neutral: 11, mixed: 6 },
  { date: "Feb 21", positive: 61, negative: 21, neutral: 12, mixed: 6 },
  { date: "Feb 22", positive: 66, negative: 18, neutral: 10, mixed: 6 },
];

const ENTITY_SCORES: EntityScore[] = [
  { entity: "Dashboard", avgScore: 0.78, count: 312, change: 0.06 },
  { entity: "API", avgScore: -0.31, count: 244, change: -0.12 },
  { entity: "Billing", avgScore: -0.44, count: 187, change: -0.08 },
  { entity: "Onboarding", avgScore: 0.21, count: 156, change: 0.03 },
  { entity: "Integrations", avgScore: 0.71, count: 289, change: 0.11 },
  { entity: "Search", avgScore: 0.04, count: 121, change: -0.02 },
  { entity: "Mobile", avgScore: -0.52, count: 88, change: -0.14 },
  { entity: "Security/RBAC", avgScore: 0.69, count: 203, change: 0.07 },
];

const TABS = ["Overview", "Feed", "Topics", "Entities"] as const;
type Tab = typeof TABS[number];

function sentimentColor(s: Sentiment): string {
  switch (s) {
    case "positive": return "text-emerald-400";
    case "negative": return "text-rose-400";
    case "neutral":  return "text-zinc-400";
    case "mixed":    return "text-amber-400";
  }
}

function sentimentBg(s: Sentiment): string {
  switch (s) {
    case "positive": return "bg-emerald-400/10 border-emerald-400/30";
    case "negative": return "bg-rose-400/10 border-rose-400/30";
    case "neutral":  return "bg-zinc-400/10 border-zinc-400/30";
    case "mixed":    return "bg-amber-400/10 border-amber-400/30";
  }
}

function scoreBar(score: number): React.ReactElement {
  const pct = Math.round(((score + 1) / 2) * 100);
  const color = score > 0.2 ? "bg-emerald-400" : score < -0.2 ? "bg-rose-400" : "bg-amber-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-zinc-400 font-mono">{score > 0 ? "+" : ""}{score.toFixed(2)}</span>
    </div>
  );
}

export default function SentimentAnalysisViewer(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Overview");
  const [feedFilter, setFeedFilter] = useState<Sentiment | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<Source | "all">("all");
  const [selectedEntry, setSelectedEntry] = useState<SentimentEntry | null>(null);

  const filteredEntries = ENTRIES.filter((e) => {
    if (feedFilter !== "all" && e.sentiment !== feedFilter) return false;
    if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
    return true;
  });

  // Summary stats
  const total = ENTRIES.length;
  const positiveCount = ENTRIES.filter(e => e.sentiment === "positive").length;
  const negativeCount = ENTRIES.filter(e => e.sentiment === "negative").length;
  const neutralCount  = ENTRIES.filter(e => e.sentiment === "neutral").length;
  const mixedCount    = ENTRIES.filter(e => e.sentiment === "mixed").length;
  const avgScore      = ENTRIES.reduce((a, e) => a + e.score, 0) / total;

  const maxTrendVal = Math.max(...DAILY_TRENDS.map(d => d.positive + d.negative + d.neutral + d.mixed));

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Sentiment Analysis</h1>
          <p className="text-xs text-zinc-400 mt-0.5">NLP-powered analysis of customer feedback & sentiment trends</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-500">Last updated: 2 min ago</div>
          <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors">
            Run Analysis
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-zinc-800 shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-indigo-400 border-indigo-500"
                : "text-zinc-400 border-transparent hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* ── OVERVIEW ── */}
        {tab === "Overview" && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Total Analyzed", value: "2,847", sub: "+214 today" },
                { label: "Avg Score", value: avgScore.toFixed(2), sub: "Overall sentiment", accent: avgScore > 0 ? "text-emerald-400" : "text-rose-400" },
                { label: "Positive", value: `${Math.round((positiveCount / total) * 100)}%`, sub: `${positiveCount} entries`, accent: "text-emerald-400" },
                { label: "Negative", value: `${Math.round((negativeCount / total) * 100)}%`, sub: `${negativeCount} entries`, accent: "text-rose-400" },
                { label: "Mixed/Neutral", value: `${Math.round(((mixedCount + neutralCount) / total) * 100)}%`, sub: `${mixedCount + neutralCount} entries`, accent: "text-amber-400" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="text-xs text-zinc-400 mb-1">{kpi.label}</div>
                  <div className={cn("text-2xl font-bold", kpi.accent ?? "text-white")}>{kpi.value}</div>
                  <div className="text-xs text-zinc-500 mt-1">{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Sentiment trend bars */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">7-Day Sentiment Trend</h3>
              <div className="flex items-end gap-2 h-40">
                {DAILY_TRENDS.map((day) => {
                  const total2 = day.positive + day.negative + day.neutral + day.mixed;
                  const scale = 128 / maxTrendVal;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex flex-col-reverse gap-0.5 w-full">
                        {[
                          { val: day.positive, color: "bg-emerald-500" },
                          { val: day.neutral,  color: "bg-zinc-500" },
                          { val: day.mixed,    color: "bg-amber-500" },
                          { val: day.negative, color: "bg-rose-500" },
                        ].map((seg, si) => (
                          <div
                            key={si}
                            className={cn("w-full rounded-sm", seg.color)}
                            style={{ height: Math.round(seg.val * scale) }}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-zinc-500">{day.date.replace("Feb ", "")}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-3">
                {[
                  { label: "Positive", color: "bg-emerald-500" },
                  { label: "Negative", color: "bg-rose-500" },
                  { label: "Neutral",  color: "bg-zinc-500" },
                  { label: "Mixed",    color: "bg-amber-500" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className={cn("w-2.5 h-2.5 rounded-sm", l.color)} />
                    <span className="text-xs text-zinc-400">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top positive / negative */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <h3 className="text-sm font-medium text-emerald-400 mb-3">Top Positive Mentions</h3>
                <div className="space-y-2">
                  {ENTRIES.filter(e => e.sentiment === "positive").slice(0, 3).map((e) => (
                    <div key={e.id} className="p-3 bg-zinc-800/50 rounded-lg">
                      <div className="text-xs text-zinc-300 leading-relaxed line-clamp-2">"{e.text}"</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">{e.entity}</span>
                        <span className="text-[10px] text-zinc-500">{e.source}</span>
                        {scoreBar(e.score)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <h3 className="text-sm font-medium text-rose-400 mb-3">Top Negative Mentions</h3>
                <div className="space-y-2">
                  {ENTRIES.filter(e => e.sentiment === "negative").slice(0, 3).map((e) => (
                    <div key={e.id} className="p-3 bg-zinc-800/50 rounded-lg">
                      <div className="text-xs text-zinc-300 leading-relaxed line-clamp-2">"{e.text}"</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-400/10 text-rose-400 border border-rose-400/20">{e.entity}</span>
                        <span className="text-[10px] text-zinc-500">{e.source}</span>
                        {scoreBar(e.score)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── FEED ── */}
        {tab === "Feed" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500 mr-1">Sentiment:</span>
                {(["all", "positive", "negative", "neutral", "mixed"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFeedFilter(s)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md border transition-colors",
                      feedFilter === s
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500 mr-1">Source:</span>
                {(["all", "reviews", "support", "social", "nps"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSourceFilter(s)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md border transition-colors",
                      sourceFilter === s
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-zinc-500">{filteredEntries.length} entries</div>

            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
                  className={cn(
                    "bg-zinc-900 border rounded-lg p-4 cursor-pointer transition-colors",
                    selectedEntry?.id === entry.id ? "border-indigo-500/50" : "border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-zinc-200 leading-relaxed flex-1">"{entry.text}"</p>
                    <div className={cn("shrink-0 px-2 py-0.5 text-xs rounded border font-medium", sentimentBg(entry.sentiment), sentimentColor(entry.sentiment))}>
                      {entry.sentiment}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{entry.source}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{entry.entity}</span>
                    <span className="text-[10px] text-zinc-500">{entry.timestamp.slice(0, 10)}</span>
                    {scoreBar(entry.score)}
                    <span className="text-[10px] text-zinc-500">conf: {Math.round(entry.confidence * 100)}%</span>
                  </div>
                  {selectedEntry?.id === entry.id && (
                    <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-xs text-zinc-400">Topics:</span>
                        {entry.topics.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600/10 border border-indigo-600/30 text-indigo-300">{t}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div><span className="text-zinc-500">Score: </span><span className={sentimentColor(entry.sentiment)}>{entry.score.toFixed(3)}</span></div>
                        <div><span className="text-zinc-500">Confidence: </span><span className="text-white">{Math.round(entry.confidence * 100)}%</span></div>
                        <div><span className="text-zinc-500">Language: </span><span className="text-white">{entry.language.toUpperCase()}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TOPICS ── */}
        {tab === "Topics" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-medium">Topic Sentiment Breakdown</h3>
              </div>
              <div className="divide-y divide-zinc-800">
                {TOPIC_SENTIMENTS.map((ts) => (
                  <div key={ts.topic} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{ts.topic}</span>
                        <span className="text-xs text-zinc-500">{ts.total.toLocaleString()} mentions</span>
                      </div>
                      <div className={cn("text-xs font-mono", ts.trend >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {ts.trend >= 0 ? "+" : ""}{ts.trend.toFixed(1)}%
                      </div>
                    </div>
                    {/* Stacked bar */}
                    <div className="flex h-3 rounded-full overflow-hidden gap-px">
                      <div className="bg-emerald-500" style={{ width: `${ts.positive}%` }} title={`Positive ${ts.positive}%`} />
                      <div className="bg-zinc-500" style={{ width: `${ts.neutral}%` }} title={`Neutral ${ts.neutral}%`} />
                      <div className="bg-rose-500" style={{ width: `${ts.negative}%` }} title={`Negative ${ts.negative}%`} />
                    </div>
                    <div className="flex gap-4 mt-1.5">
                      <span className="text-[10px] text-emerald-400">{ts.positive}% positive</span>
                      <span className="text-[10px] text-zinc-400">{ts.neutral}% neutral</span>
                      <span className="text-[10px] text-rose-400">{ts.negative}% negative</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ENTITIES ── */}
        {tab === "Entities" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-medium">Entity Sentiment Scores</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Average sentiment score per product entity (-1 very negative → +1 very positive)</p>
              </div>
              <div className="divide-y divide-zinc-800">
                {ENTITY_SCORES.sort((a, b) => b.avgScore - a.avgScore).map((es) => (
                  <div key={es.entity} className="px-5 py-4 flex items-center gap-4">
                    <div className="w-36 shrink-0">
                      <div className="text-sm font-medium">{es.entity}</div>
                      <div className="text-xs text-zinc-500">{es.count} mentions</div>
                    </div>
                    <div className="flex-1">
                      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
                        {/* Center line */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-600" />
                        {es.avgScore >= 0 ? (
                          <div
                            className="absolute top-0 bottom-0 bg-emerald-500 rounded-r"
                            style={{ left: "50%", width: `${Math.abs(es.avgScore) * 50}%` }}
                          />
                        ) : (
                          <div
                            className="absolute top-0 bottom-0 bg-rose-500 rounded-l"
                            style={{ right: "50%", width: `${Math.abs(es.avgScore) * 50}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <div className={cn("w-14 text-right text-sm font-mono font-semibold", es.avgScore >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {es.avgScore > 0 ? "+" : ""}{es.avgScore.toFixed(2)}
                    </div>
                    <div className={cn("w-16 text-right text-xs font-mono", es.change >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {es.change >= 0 ? "▲" : "▼"} {Math.abs(es.change).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
