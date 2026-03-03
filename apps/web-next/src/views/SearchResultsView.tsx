import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultKind = "agent" | "session" | "file" | "commit" | "message" | "tool" | "config" | "log";
type ResultRelevance = "high" | "medium" | "low";

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  excerpt: string;
  meta: Record<string, string>;
  relevance: ResultRelevance;
  score: number; // 0-1
  timestamp: string;
  url: string;
  highlights: string[]; // matched phrases
}

interface SearchFacet {
  id: string;
  label: string;
  kind?: ResultKind;
  count: number;
}

interface RecentSearch {
  query: string;
  timestamp: string;
  resultCount: number;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const RECENT_SEARCHES: RecentSearch[] = [
  { query: "horizon ui sprint views", timestamp: "2026-02-22T02:00:00Z", resultCount: 142 },
  { query: "typescript error ServiceMap", timestamp: "2026-02-22T01:30:00Z", resultCount: 8 },
  { query: "pnpm build error", timestamp: "2026-02-22T01:00:00Z", resultCount: 24 },
  { query: "agent model not allowed", timestamp: "2026-02-21T23:00:00Z", resultCount: 12 },
];

function makeResults(query: string): SearchResult[] {
  if (!query.trim()) {return [];}
  return [
    {
      id: "r1",
      kind: "session",
      title: "Luis — Horizon UI Sprint Session",
      excerpt: `Active session building ${query} across 95+ views for the Horizon UI system. Currently in cron-triggered autonomous mode.`,
      meta: { model: "claude-sonnet-4-6", status: "active", tokens: "184,200" },
      relevance: "high",
      score: 0.98,
      timestamp: "2026-02-22T02:15:00Z",
      url: "#sessions/luis-main",
      highlights: [query],
    },
    {
      id: "r2",
      kind: "file",
      title: "apps/web-next/src/App.tsx",
      excerpt: `Main application shell router. Contains ${query} lazy imports, nav items, skeleton map, and routing switch for all views.`,
      meta: { size: "24.8 KB", lines: "650", language: "TypeScript" },
      relevance: "high",
      score: 0.94,
      timestamp: "2026-02-22T02:14:00Z",
      url: "#files/App.tsx",
      highlights: [query, "lazy imports", "routing switch"],
    },
    {
      id: "r3",
      kind: "commit",
      title: "feat: views #94-95 wired — CapacityPlanner, ExperimentDashboard",
      excerpt: `Added ${query} related views to the Horizon UI dashboard. 130 files changed, build clean, 0 TypeScript errors.`,
      meta: { sha: "64dbb15", author: "Luis", branch: "master" },
      relevance: "high",
      score: 0.91,
      timestamp: "2026-02-22T02:10:00Z",
      url: "#commits/64dbb15",
      highlights: [query, "TypeScript errors"],
    },
    {
      id: "r4",
      kind: "agent",
      title: "Luis — Principal UX Engineer",
      excerpt: `Agent currently building ${query} views. Leads Product & UI Squad. Autonomous sprint mode active since 01:05 AM MST.`,
      meta: { status: "busy", squad: "product-ui", tier: "principal" },
      relevance: "high",
      score: 0.89,
      timestamp: "2026-02-22T02:15:00Z",
      url: "#agents/luis",
      highlights: [query, "Product & UI Squad"],
    },
    {
      id: "r5",
      kind: "message",
      title: "#cb-activity — Horizon UI views update",
      excerpt: `95 views committed so far. Next batch: SearchResultsView, HealthChecklist, ChatRoomView, BudgetTracker. ${query} sprint continues.`,
      meta: { channel: "#cb-activity", author: "Luis" },
      relevance: "medium",
      score: 0.82,
      timestamp: "2026-02-22T02:00:00Z",
      url: "#messages/cb-activity-123",
      highlights: [query],
    },
    {
      id: "r6",
      kind: "config",
      title: "AGENTS.md — Luis Principal UX Engineer",
      excerpt: `Configuration file for Luis agent. Defines role, decision authority, squad roster, memory protocol, and ${query} build lifecycle.`,
      meta: { type: "agent-config", version: "v3" },
      relevance: "medium",
      score: 0.79,
      timestamp: "2026-02-20T14:00:00Z",
      url: "#config/AGENTS.md",
      highlights: [query, "decision authority"],
    },
    {
      id: "r7",
      kind: "tool",
      title: "sessions_spawn — Sub-agent spawning tool",
      excerpt: `Tool used to spawn worker agents (Piper, Quinn, Reed, Wes) for parallel ${query} development. Supports model selection.`,
      meta: { category: "sessions", schema: "OpenClaw MCP" },
      relevance: "medium",
      score: 0.74,
      timestamp: "2026-02-22T01:00:00Z",
      url: "#tools/sessions_spawn",
      highlights: [query, "Sub-agent spawning"],
    },
    {
      id: "r8",
      kind: "log",
      title: "pnpm build — 2026-02-22 02:14",
      excerpt: `Build succeeded in 1.94s. 95 chunks built, 0 errors, 0 TypeScript issues. ${query} views all compiled correctly.`,
      meta: { duration: "1.94s", exit: "0", warnings: "0" },
      relevance: "low",
      score: 0.61,
      timestamp: "2026-02-22T02:14:00Z",
      url: "#logs/build-latest",
      highlights: [query],
    },
  ];
}

const KIND_CONFIG: Record<ResultKind, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  agent: { emoji: "🤖", label: "Agent", color: "text-indigo-400", bg: "bg-indigo-900/20", border: "border-indigo-700/50" },
  session: { emoji: "💬", label: "Session", color: "text-blue-400", bg: "bg-blue-900/20", border: "border-blue-700/50" },
  file: { emoji: "📄", label: "File", color: "text-zinc-300", bg: "bg-zinc-800/50", border: "border-zinc-700" },
  commit: { emoji: "🔀", label: "Commit", color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-700/50" },
  message: { emoji: "💬", label: "Message", color: "text-purple-400", bg: "bg-purple-900/20", border: "border-purple-700/50" },
  tool: { emoji: "🔧", label: "Tool", color: "text-amber-400", bg: "bg-amber-900/20", border: "border-amber-700/50" },
  config: { emoji: "⚙️", label: "Config", color: "text-teal-400", bg: "bg-teal-900/20", border: "border-teal-700/50" },
  log: { emoji: "📋", label: "Log", color: "text-zinc-400", bg: "bg-zinc-800/30", border: "border-zinc-700" },
};

const RELEVANCE_CONFIG: Record<ResultRelevance, { color: string; label: string }> = {
  high: { color: "text-emerald-400", label: "High" },
  medium: { color: "text-amber-400", label: "Medium" },
  low: { color: "text-zinc-500", label: "Low" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchResultsView() {
  const [query, setQuery] = useState("horizon ui sprint");
  const [activeQuery, setActiveQuery] = useState("horizon ui sprint");
  const [filterKind, setFilterKind] = useState<ResultKind | "all">("all");
  const [filterRelevance, setFilterRelevance] = useState<ResultRelevance | "all">("all");
  const [sortBy, setSortBy] = useState<"relevance" | "date">("relevance");
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const allResults = makeResults(activeQuery);

  const filtered = allResults
    .filter((r) => filterKind === "all" || r.kind === filterKind)
    .filter((r) => filterRelevance === "all" || r.relevance === filterRelevance)
    .toSorted((a, b) => sortBy === "relevance" ? b.score - a.score : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const facets: SearchFacet[] = [
    { id: "all", label: "All Results", count: allResults.length },
    ...Object.keys(KIND_CONFIG).map((k) => ({
      id: k,
      label: KIND_CONFIG[k as ResultKind].label,
      kind: k as ResultKind,
      count: allResults.filter((r) => r.kind === k).length,
    })).filter((f) => f.count > 0),
  ];

  function handleSearch() {
    setIsSearching(true);
    setSelectedResult(null);
    setTimeout(() => {
      setActiveQuery(query);
      setIsSearching(false);
    }, 600);
  }

  function highlight(text: string, phrases: string[]): React.ReactNode {
    if (!phrases.length) {return text;}
    const regex = new RegExp(`(${phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      phrases.some((p) => p.toLowerCase() === part.toLowerCase())
        ? <mark key={i} className="bg-indigo-500/20 text-indigo-300 rounded px-0.5">{part}</mark>
        : part
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header + search */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Search</h1>
          <div className="text-xs text-zinc-500">
            {allResults.length > 0 ? `${allResults.length} results for "${activeQuery}"` : "No results"}
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search agents, sessions, files, commits, messages…"
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder:text-zinc-500 pr-10"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 animate-spin">⟳</div>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
          >
            Search
          </button>
        </div>

        {/* Sort + filter row */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(["relevance", "date"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs capitalize",
                  sortBy === s ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                )}
              >
                Sort: {s}
              </button>
            ))}
          </div>
          <div className="h-4 border-l border-zinc-700" />
          <div className="flex gap-1">
            {(["all", "high", "medium", "low"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setFilterRelevance(r)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs capitalize",
                  filterRelevance === r ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                )}
              >
                {r === "all" ? "All relevance" : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Facets sidebar */}
        <div className="flex-shrink-0 w-48 border-r border-zinc-800 p-4 overflow-y-auto">
          <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-3">Type</div>
          <div className="space-y-1">
            {facets.map((facet) => {
              const kc = facet.kind ? KIND_CONFIG[facet.kind] : null;
              const isActive = filterKind === (facet.kind ?? "all");
              return (
                <button
                  key={facet.id}
                  onClick={() => setFilterKind(facet.kind ?? "all")}
                  className={cn(
                    "w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                    isActive ? "bg-indigo-900/30 text-indigo-300" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {kc && <span className="text-xs">{kc.emoji}</span>}
                    <span>{facet.label}</span>
                  </span>
                  <span className="text-xs text-zinc-600">{facet.count}</span>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide mt-5 mb-3">Recent</div>
          <div className="space-y-1">
            {RECENT_SEARCHES.map((rs, i) => (
              <button
                key={i}
                onClick={() => { setQuery(rs.query); setActiveQuery(rs.query); }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
              >
                <div className="text-zinc-300 truncate">{rs.query}</div>
                <div className="text-zinc-600">{rs.resultCount} results</div>
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isSearching ? (
            <div className="flex items-center justify-center h-48 text-zinc-500">
              <div className="text-center">
                <div className="text-2xl mb-2 animate-pulse">🔍</div>
                <div>Searching…</div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-zinc-500">
              <div className="text-center">
                <div className="text-2xl mb-2">🔎</div>
                <div>No results found for "{activeQuery}"</div>
                <div className="text-xs mt-1">Try different keywords or broaden your filters</div>
              </div>
            </div>
          ) : (
            filtered.map((result) => {
              const kc = KIND_CONFIG[result.kind];
              const rc = RELEVANCE_CONFIG[result.relevance];
              const isSelected = selectedResult?.id === result.id;
              return (
                <button
                  key={result.id}
                  onClick={() => setSelectedResult(isSelected ? null : result)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all",
                    isSelected ? "bg-indigo-900/20 border-indigo-600/50" : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Kind badge */}
                    <div className={cn("flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm border", kc.bg, kc.border)}>
                      {kc.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white truncate">{result.title}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0", kc.bg, kc.color, kc.border)}>
                          {kc.label}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 leading-relaxed mb-2">
                        {highlight(result.excerpt, result.highlights)}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {Object.entries(result.meta).map(([k, v]) => (
                          <span key={k} className="text-[10px] text-zinc-600">
                            <span className="text-zinc-500">{k}:</span> {v}
                          </span>
                        ))}
                        <span className="text-[10px] text-zinc-600 ml-auto">{result.timestamp.slice(0, 10)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <div className={cn("text-xs font-medium", rc.color)}>{rc.label}</div>
                      <div className="text-[10px] text-zinc-600">{Math.round(result.score * 100)}% match</div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <div className="flex gap-2">
                        <a
                          href={result.url}
                          onClick={(e) => e.preventDefault()}
                          className="text-xs text-indigo-400 bg-indigo-900/20 border border-indigo-700/50 px-2 py-1 rounded"
                        >
                          Open →
                        </a>
                        <button className="text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded hover:text-white">
                          Copy link
                        </button>
                        <button className="text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded hover:text-white">
                          Preview
                        </button>
                      </div>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
