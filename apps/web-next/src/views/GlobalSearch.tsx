import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ResultKind = "agent" | "session" | "file" | "event" | "skill" | "view";

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle: string;
  description?: string;
  timestamp?: Date;
  tags?: string[];
  badge?: string;
  badgeColor?: string;
  score: number; // 0-1 relevance
}

// ─── Search Index (seed data) ─────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const mins = (n: number) => n * 60_000;
const hrs = (n: number) => n * 3_600_000;
const days = (n: number) => n * 86_400_000;

const ALL_RESULTS: SearchResult[] = [
  // Agents
  { id: "a1", kind: "agent", title: "Luis", subtitle: "Principal UX Engineer", description: "Leads Product & UI Squad. Owns UX, frontend, design system.", tags: ["UX", "frontend", "React"], badge: "Active", badgeColor: "emerald", score: 1 },
  { id: "a2", kind: "agent", title: "Xavier", subtitle: "CTO", description: "Engineering strategy, architecture, team oversight.", tags: ["strategy", "architecture"], badge: "Active", badgeColor: "emerald", score: 1 },
  { id: "a3", kind: "agent", title: "Piper", subtitle: "Worker — Product & UI", description: "Component architecture, design system implementation.", tags: ["components", "design-system"], badge: "Active", badgeColor: "emerald", score: 0.9 },
  { id: "a4", kind: "agent", title: "Quinn", subtitle: "Worker — Product & UI", description: "User flows, interaction design, accessibility.", tags: ["UX", "a11y"], badge: "Active", badgeColor: "emerald", score: 0.9 },
  { id: "a5", kind: "agent", title: "Stephan", subtitle: "CMO", description: "Brand, marketing, content, social strategy.", tags: ["marketing", "brand"], badge: "Active", badgeColor: "emerald", score: 0.85 },
  { id: "a6", kind: "agent", title: "Tim", subtitle: "VP Architecture", description: "Frontend architecture, megabranch PRs, engineering standards.", tags: ["architecture", "engineering"], badge: "Active", badgeColor: "emerald", score: 0.85 },
  { id: "a7", kind: "agent", title: "Roman", subtitle: "Lead — Platform Core", description: "Platform infrastructure, Gateway, backend services.", tags: ["backend", "infrastructure"], badge: "Active", badgeColor: "emerald", score: 0.8 },
  { id: "a8", kind: "agent", title: "Wes", subtitle: "Worker — Product & UI", description: "Performance, rendering optimization, bundle size.", tags: ["performance", "optimization"], badge: "Idle", badgeColor: "zinc", score: 0.8 },
  { id: "a9", kind: "agent", title: "Sam", subtitle: "Worker — Product & UI", description: "API integration, client networking, data layer.", tags: ["API", "networking"], badge: "Idle", badgeColor: "zinc", score: 0.75 },
  { id: "a10", kind: "agent", title: "Reed", subtitle: "Worker — Product & UI", description: "State management, client data, offline support.", tags: ["state", "data"], badge: "Idle", badgeColor: "zinc", score: 0.75 },

  // Sessions
  { id: "s1", kind: "session", title: "UX Work Check (Hourly)", subtitle: "agent:luis · cron", description: "Building Horizon UI views — 24 views completed.", timestamp: ago(mins(5)), tags: ["cron", "UX"], badge: "Active", badgeColor: "emerald", score: 1 },
  { id: "s2", kind: "session", title: "Brand Review Cron", subtitle: "agent:stephan · cron", description: "Weekly brand consistency review across all content.", timestamp: ago(hrs(2)), tags: ["cron", "brand"], badge: "Done", badgeColor: "zinc", score: 0.7 },
  { id: "s3", kind: "session", title: "Chat with Luis", subtitle: "user:david · chat", description: "Discussion about Horizon UI architecture and design system.", timestamp: ago(days(1)), tags: ["chat", "design"], badge: "Done", badgeColor: "zinc", score: 0.85 },
  { id: "s4", kind: "session", title: "Architecture Review", subtitle: "agent:tim · manual", description: "Review of megabranch PR strategy and frontend patterns.", timestamp: ago(days(2)), tags: ["architecture", "PR"], badge: "Done", badgeColor: "zinc", score: 0.8 },
  { id: "s5", kind: "session", title: "Piper: TeamManagement view", subtitle: "agent:piper · subagent", description: "Built TeamManagement.tsx — 1074 lines, clean build.", timestamp: ago(hrs(1)), tags: ["code", "UI"], badge: "Done", badgeColor: "zinc", score: 0.9 },
  { id: "s6", kind: "session", title: "Quinn: BillingSubscription", subtitle: "agent:quinn · subagent", description: "Built BillingSubscription.tsx — plan/usage/invoices tabs.", timestamp: ago(hrs(1) + mins(30)), tags: ["code", "billing"], badge: "Done", badgeColor: "zinc", score: 0.9 },

  // Files
  { id: "f1", kind: "file", title: "CONTEXT.md", subtitle: "luis/CONTEXT.md", description: "Product context, current priorities, and project status.", timestamp: ago(hrs(6)), tags: ["context", "docs"], score: 0.8 },
  { id: "f2", kind: "file", title: "UI_SPEC.md", subtitle: "luis/UI_SPEC.md", description: "Horizon UI specification — framework, architecture, design system.", timestamp: ago(days(1)), tags: ["spec", "design"], score: 0.85 },
  { id: "f3", kind: "file", title: "UX_WORK_QUEUE.md", subtitle: "luis/UX_WORK_QUEUE.md", description: "Active task queue — 24 views done, sprint exceeded.", timestamp: ago(mins(30)), tags: ["tasks", "queue"], score: 0.9 },
  { id: "f4", kind: "file", title: "App.tsx", subtitle: "apps/web-next/src/App.tsx", description: "Main app shell — nav, routing, command palette, keyboard shortcuts.", timestamp: ago(mins(10)), tags: ["React", "routing"], score: 1 },
  { id: "f5", kind: "file", title: "AGENTS.md", subtitle: "luis/AGENTS.md", description: "Agent configuration — role, squad, reporting, protocol.", timestamp: ago(days(3)), tags: ["config", "agent"], score: 0.75 },
  { id: "f6", kind: "file", title: "AuditLog.tsx", subtitle: "apps/web-next/src/views/AuditLog.tsx", description: "Audit log view — 15 event types, CSV export, search, filters.", timestamp: ago(hrs(0.5)), tags: ["view", "compliance"], score: 0.95 },

  // Audit Events
  { id: "e1", kind: "event", title: "agent.file.write — AuditLog.tsx", subtitle: "agent:luis · 30m ago", description: "AuditLog.tsx created — 17.90 kB, 0 TS errors.", timestamp: ago(mins(30)), tags: ["file", "write"], badge: "Success", badgeColor: "emerald", score: 0.9 },
  { id: "e2", kind: "event", title: "api.token.validate — failure", subtitle: "api:unknown · 4h ago", description: "Invalid API token from 198.51.100.44 — 3 attempts.", timestamp: ago(hrs(4)), tags: ["auth", "security"], badge: "Failure", badgeColor: "rose", score: 0.85 },
  { id: "e3", kind: "event", title: "billing.budget.alert", subtitle: "system · 2h ago", description: "Daily token budget at 87% — claude-opus-4-6.", timestamp: ago(hrs(2)), tags: ["billing", "alert"], badge: "Warning", badgeColor: "amber", score: 0.8 },
  { id: "e4", kind: "event", title: "cron.job.execute — data-sync failure", subtitle: "system · 1h ago", description: "Cron data-sync timed out after 30s.", timestamp: ago(hrs(1) + mins(10)), tags: ["cron", "error"], badge: "Failure", badgeColor: "rose", score: 0.85 },
  { id: "e5", kind: "event", title: "auth.login — david", subtitle: "user:david · 1h ago", description: "David signed in via browser session (Safari/19).", timestamp: ago(hrs(1)), tags: ["auth", "user"], badge: "Success", badgeColor: "emerald", score: 0.7 },

  // Skills
  { id: "sk1", kind: "skill", title: "Web Search", subtitle: "Brave Search API", description: "Search the web and retrieve current information for agents.", tags: ["search", "web", "API"], badge: "Active", badgeColor: "emerald", score: 0.85 },
  { id: "sk2", kind: "skill", title: "Browser Control", subtitle: "OpenClaw Browser", description: "Control web browsers, take screenshots, interact with pages.", tags: ["browser", "automation"], badge: "Active", badgeColor: "emerald", score: 0.8 },
  { id: "sk3", kind: "skill", title: "Code Execution", subtitle: "Shell + Node.js", description: "Execute shell commands, run scripts, manage processes.", tags: ["code", "shell"], badge: "Active", badgeColor: "emerald", score: 0.8 },
  { id: "sk4", kind: "skill", title: "Voice Call", subtitle: "OpenAI Voice", description: "Make phone calls and have voice conversations.", tags: ["voice", "phone"], badge: "Active", badgeColor: "emerald", score: 0.75 },
  { id: "sk5", kind: "skill", title: "File I/O", subtitle: "Workspace FS", description: "Read, write, and manage files in agent workspaces.", tags: ["files", "storage"], badge: "Active", badgeColor: "emerald", score: 0.75 },

  // Views
  { id: "v1", kind: "view", title: "Agent Dashboard", subtitle: "Overview of all agents", description: "Activity, status, recent sessions, model usage at a glance.", tags: ["dashboard", "agents"], badge: "View", badgeColor: "indigo", score: 0.9 },
  { id: "v2", kind: "view", title: "Chat Interface", subtitle: "Talk to an agent", description: "Full-featured chat with markdown, code blocks, file context.", tags: ["chat", "agents"], badge: "View", badgeColor: "indigo", score: 0.9 },
  { id: "v3", kind: "view", title: "Usage Dashboard", subtitle: "Costs and token usage", description: "Daily/monthly breakdowns, model costs, agent spend.", tags: ["usage", "billing"], badge: "View", badgeColor: "indigo", score: 0.85 },
  { id: "v4", kind: "view", title: "Audit Log", subtitle: "System event history", description: "Compliance-grade log of all API calls, auth events, changes.", tags: ["audit", "security"], badge: "View", badgeColor: "indigo", score: 0.9 },
  { id: "v5", kind: "view", title: "System Health", subtitle: "Service status", description: "Real-time health of gateway, APIs, integrations.", tags: ["health", "ops"], badge: "View", badgeColor: "indigo", score: 0.85 },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<ResultKind, { label: string; emoji: string; color: string }> = {
  agent:   { label: "Agent",   emoji: "🤖", color: "text-indigo-400"  },
  session: { label: "Session", emoji: "🌳", color: "text-emerald-400" },
  file:    { label: "File",    emoji: "📄", color: "text-amber-400"   },
  event:   { label: "Event",   emoji: "📋", color: "text-rose-400"    },
  skill:   { label: "Skill",   emoji: "🧩", color: "text-violet-400"  },
  view:    { label: "View",    emoji: "🖥️", color: "text-cyan-400"    },
};

const BADGE_COLORS: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  rose:    "bg-rose-500/15 text-rose-300 ring-rose-500/25",
  amber:   "bg-amber-500/15 text-amber-300 ring-amber-500/25",
  zinc:    "bg-zinc-700/50 text-zinc-400 ring-zinc-600/25",
  indigo:  "bg-indigo-500/15 text-indigo-300 ring-indigo-500/25",
  violet:  "bg-violet-500/15 text-violet-300 ring-violet-500/25",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-indigo-500/30 text-indigo-200 rounded px-0.5">{part}</mark> : part
  );
}

function fuzzySearch(results: SearchResult[], query: string): SearchResult[] {
  if (!query.trim()) return results;
  const q = query.toLowerCase();
  return results
    .map((r) => {
      let score = 0;
      const titleMatch = r.title.toLowerCase().includes(q);
      const subtitleMatch = r.subtitle.toLowerCase().includes(q);
      const descMatch = r.description?.toLowerCase().includes(q) ?? false;
      const tagMatch = r.tags?.some((t) => t.toLowerCase().includes(q)) ?? false;
      if (titleMatch) score += 3;
      if (subtitleMatch) score += 2;
      if (descMatch) score += 1;
      if (tagMatch) score += 1;
      return { ...r, _matchScore: score };
    })
    .filter((r) => (r as typeof r & { _matchScore: number })._matchScore > 0)
    .sort((a, b) => (b as typeof b & { _matchScore: number })._matchScore - (a as typeof a & { _matchScore: number })._matchScore);
}

// ─── Result Item ─────────────────────────────────────────────────────────────

interface ResultItemProps {
  result: SearchResult;
  query: string;
  selected: boolean;
  onSelect: () => void;
}

function ResultItem({ result, query, selected, onSelect }: ResultItemProps) {
  const kindCfg = KIND_CONFIG[result.kind];
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <button
      ref={ref}
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-zinc-800/60 last:border-0",
        "hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
        selected && "bg-zinc-900 ring-1 ring-inset ring-indigo-500/30"
      )}
    >
      {/* Kind icon */}
      <div className="flex-none mt-0.5 h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm">
        {kindCfg.emoji}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-xs font-semibold", kindCfg.color)}>{kindCfg.label}</span>
          {result.badge && result.badgeColor && (
            <span className={cn("px-1.5 py-0.5 text-xs font-medium rounded-full ring-1", BADGE_COLORS[result.badgeColor])}>
              {result.badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm font-semibold text-white leading-snug">
          {highlight(result.title, query)}
        </p>
        <p className="text-xs text-zinc-500 truncate">
          {highlight(result.subtitle, query)}
        </p>
        {result.description && (
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed line-clamp-2">
            {highlight(result.description, query)}
          </p>
        )}
        {result.tags && result.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {result.tags.slice(0, 4).map((t) => (
              <span key={t} className="px-1.5 py-0.5 text-xs rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50">{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Timestamp */}
      {result.timestamp && (
        <div className="flex-none text-right">
          <p className="text-xs text-zinc-600">{relTime(result.timestamp)}</p>
        </div>
      )}
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 px-8 text-center">
      <div className="h-16 w-16 rounded-2xl bg-zinc-800/50 border border-zinc-700 flex items-center justify-center text-3xl">
        🔍
      </div>
      <div>
        <p className="text-sm font-semibold text-white">No results for "{query}"</p>
        <p className="text-xs text-zinc-500 mt-1">Try searching for agents, sessions, files, events, or views</p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-2">
        {["Luis", "Session", "AuditLog", "System Health"].map((suggestion) => (
          <span key={suggestion} className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 text-center cursor-default">
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Landing state ────────────────────────────────────────────────────────────

function LandingState() {
  const recentSearches = ["Luis", "session", "audit", "billing"];
  const quickLinks: { emoji: string; label: string; kind: ResultKind }[] = [
    { emoji: "🤖", label: "Agents", kind: "agent" },
    { emoji: "🌳", label: "Sessions", kind: "session" },
    { emoji: "📄", label: "Files", kind: "file" },
    { emoji: "📋", label: "Events", kind: "event" },
    { emoji: "🧩", label: "Skills", kind: "skill" },
    { emoji: "🖥️", label: "Views", kind: "view" },
  ];
  return (
    <div className="px-6 py-8">
      <div className="grid grid-cols-3 gap-2 mb-8">
        {quickLinks.map(({ emoji, label }) => (
          <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-400 cursor-default">
            <span className="text-base">{emoji}</span>
            {label}
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Recent Searches</p>
        <div className="flex flex-wrap gap-2">
          {recentSearches.map((s) => (
            <span key={s} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-400 border border-zinc-700 cursor-default">
              <svg className="h-3 w-3 text-zinc-600" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" d="M9 9l-2.5-2.5M7 4.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

const ALL_KINDS: (ResultKind | "all")[] = ["all", "agent", "session", "file", "event", "skill", "view"];

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<ResultKind | "all">("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const baseResults = kindFilter === "all" ? ALL_RESULTS : ALL_RESULTS.filter((r) => r.kind === kindFilter);
  const results = query.trim() ? fuzzySearch(baseResults, query) : baseResults.sort((a, b) => b.score - a.score);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        // In real app: navigate to selected result
        console.log("Navigate to:", results[selectedIndex]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [results, selectedIndex]);

  // Reset selected on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, kindFilter]);

  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  // Group results by kind when showing all
  const grouped = kindFilter === "all" && results.length > 0
    ? (["agent", "session", "file", "event", "skill", "view"] as ResultKind[]).reduce<Record<ResultKind, SearchResult[]>>(
        (acc, kind) => {
          acc[kind] = results.filter((r) => r.kind === kind);
          return acc;
        },
        {} as Record<ResultKind, SearchResult[]>
      )
    : null;

  const totalCount = results.length;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Search input */}
      <div className="flex-none px-6 py-5 border-b border-zinc-800">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 pointer-events-none" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="9" cy="9" r="5.5" />
            <path strokeLinecap="round" d="M13.5 13.5l4 4" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents, sessions, files, events, skills…"
            aria-label="Global search"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            className="w-full pl-12 pr-4 py-3 text-base bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-500 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>

        {/* Kind filter tabs */}
        <div role="tablist" aria-label="Filter by type" className="flex items-center gap-1 mt-3 overflow-x-auto pb-px">
          {ALL_KINDS.map((kind) => {
            const cfg = kind === "all" ? null : KIND_CONFIG[kind];
            const count = kind === "all" ? totalCount : results.filter((r) => r.kind === kind).length;
            return (
              <button
                key={kind}
                role="tab"
                aria-selected={kindFilter === kind}
                onClick={() => setKindFilter(kind)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  kindFilter === kind ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                )}
              >
                {cfg && <span>{cfg.emoji}</span>}
                <span className="capitalize">{kind === "all" ? "All" : cfg?.label}</span>
                {count > 0 && (
                  <span className={cn("px-1.5 py-0.5 rounded-full text-xs tabular-nums", kindFilter === kind ? "bg-indigo-500 text-white" : "bg-zinc-700 text-zinc-400")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div
        role="listbox"
        aria-label="Search results"
        className="flex-1 overflow-y-auto"
      >
        {!query.trim() && kindFilter === "all" && <LandingState />}

        {query.trim() && results.length === 0 && <EmptyState query={query} />}

        {results.length > 0 && (
          <>
            {query.trim() && (
              <div className="px-4 py-2 border-b border-zinc-800">
                <p className="text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-300">{totalCount}</span> result{totalCount !== 1 ? "s" : ""} for "{query}"
                  {kindFilter !== "all" && ` in ${KIND_CONFIG[kindFilter].label}s`}
                  <span className="ml-2 text-zinc-700">↑↓ to navigate · Enter to open</span>
                </p>
              </div>
            )}

            {/* Grouped by kind */}
            {grouped && kindFilter === "all" ? (
              (["agent", "session", "file", "event", "skill", "view"] as ResultKind[]).map((kind) => {
                const items = grouped[kind];
                if (!items || items.length === 0) return null;
                const cfg = KIND_CONFIG[kind];
                // Find offset for index
                const offset = (["agent", "session", "file", "event", "skill", "view"] as ResultKind[])
                  .slice(0, (["agent", "session", "file", "event", "skill", "view"] as ResultKind[]).indexOf(kind))
                  .reduce((sum, k) => sum + (grouped[k]?.length ?? 0), 0);
                return (
                  <div key={kind}>
                    <div className="px-4 py-2 flex items-center gap-2 bg-zinc-900/50 border-b border-zinc-800 sticky top-0 z-10">
                      <span className="text-xs">{cfg.emoji}</span>
                      <span className={cn("text-xs font-semibold uppercase tracking-wider", cfg.color)}>{cfg.label}s</span>
                      <span className="text-xs text-zinc-600">({items.length})</span>
                    </div>
                    {items.map((result, i) => (
                      <ResultItem
                        key={result.id}
                        result={result}
                        query={query}
                        selected={selectedIndex === offset + i}
                        onSelect={() => handleSelect(offset + i)}
                      />
                    ))}
                  </div>
                );
              })
            ) : (
              results.map((result, i) => (
                <ResultItem
                  key={result.id}
                  result={result}
                  query={query}
                  selected={selectedIndex === i}
                  onSelect={() => handleSelect(i)}
                />
              ))
            )}
          </>
        )}

        {/* Not-yet-searched, kind filter active */}
        {!query.trim() && kindFilter !== "all" && results.length > 0 && (
          results.map((result, i) => (
            <ResultItem
              key={result.id}
              result={result}
              query={query}
              selected={selectedIndex === i}
              onSelect={() => handleSelect(i)}
            />
          ))
        )}
      </div>
    </div>
  );
}
