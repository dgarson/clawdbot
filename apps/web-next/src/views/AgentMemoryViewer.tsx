import React, { useState, useMemo, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type MemoryKind = "daily" | "longterm" | "soul" | "context" | "decision";
type MemoryAgent = "luis" | "xavier" | "stephan" | "tim" | "piper" | "quinn" | "reed" | "wes";

interface MemoryEntry {
  id: string;
  agentId: MemoryAgent;
  agentName: string;
  agentEmoji: string;
  kind: MemoryKind;
  date: string; // YYYY-MM-DD (for daily) or ISO (for others)
  title: string;
  content: string;
  wordCount: number;
  lastModified: string;
  tags: string[];
  significant?: boolean; // important decisions/milestones
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const MEMORIES: MemoryEntry[] = [
  // Luis
  {
    id: "mem-luis-d1", agentId: "luis", agentName: "Luis", agentEmoji: "🎨",
    kind: "daily", date: "2026-02-22",
    title: "Feb 22 — Sprint: 52 Horizon UI Views",
    content: `## Session Notes

**Goal:** Horizon UI sprint — 40 views by 7:30 AM MST
**Status:** 52 views committed by 2:15 AM — 5× over goal

### Views shipped this session (#20-#52)
Built AuditLog, BillingSubscription, SystemHealth, IntegrationHub, TeamManagement, GlobalSearch, PromptLibrary, DataExportManager, VoiceInterface, AgentInsights, DeveloperConsole, SecurityDashboard, ChangelogView, EnvironmentManager, FeatureFlags, AgentComparison, KnowledgeBase, CrashReporter, ModelBenchmark, RateLimitDashboard, TaskQueue, StorageExplorer, AlertCenter, WebhookManager, ConversationHistory, AgentScheduler, TokenLedger, ThemeEditor, PermissionsManager, ActivityFeed, CommandPalette, SupportCenter, ReleasePipeline.

### Key decisions
- All views: zinc-950/900/800 dark theme, indigo-500 accent, Tailwind only
- No lucide-react anywhere — emoji or inline SVG only
- Build verification before every commit (pnpm build, 0 TS errors)
- Delegated 10+ views to squad (Piper×3, Quinn×2, Reed×3, Wes×3)

### Agent collaboration
Piper: TeamManagement, AgentComparison, ThemeEditor, SupportCenter
Quinn: BillingSubscription, ConversationHistory, OnboardingChecklist
Reed: DeveloperConsole, ChangelogView, PermissionsManager, ReleasePipeline  
Wes: DataExportManager, CrashReporter, WebhookManager, AnalyticsOverview`,
    wordCount: 187,
    lastModified: "2026-02-22T02:15:00Z",
    tags: ["sprint", "horizon-ui", "views"],
    significant: true,
  },
  {
    id: "mem-luis-lt1", agentId: "luis", agentName: "Luis", agentEmoji: "🎨",
    kind: "longterm",
    date: "2026-02-01",
    title: "Horizon UI Design System Decisions",
    content: `## Horizon UI — Canonical Design Decisions

### Stack
- Vite + React 18 + TypeScript (strict) + Tailwind CSS
- No component library (pure Tailwind utility classes)
- Single App.tsx shell, all views React.lazy() loaded

### Color System
- Background hierarchy: zinc-950 → zinc-900 → zinc-800
- Text hierarchy: white → zinc-300 → zinc-400 → zinc-500 → zinc-600
- Accent: indigo-500/600 (primary actions, focus rings, selection)
- Success: emerald-400, Error: rose-400, Warning: amber-400, Info: blue-400

### Component Patterns
- All interactive elements: focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none
- Cards: rounded-xl bg-zinc-900 border border-zinc-800
- Buttons: rounded-lg, variants (primary indigo, secondary zinc-800, danger rose)
- Master/detail: 280-320px sidebar + flex-1 content

### Accessibility
- ARIA roles throughout: listbox/option, tab/tablist, switch, dialog, feed, tree
- aria-selected, aria-expanded, aria-checked on all stateful elements
- Focus management in modals (trap + restore)`,
    wordCount: 156,
    lastModified: "2026-02-15T10:00:00Z",
    tags: ["design-system", "decisions", "ux"],
    significant: true,
  },
  {
    id: "mem-luis-ctx", agentId: "luis", agentName: "Luis", agentEmoji: "🎨",
    kind: "context",
    date: "2026-02-22",
    title: "Active Sprint: Horizon UI",
    content: `Active sprint: Building Horizon UI views for the OpenClaw web app.
Repo: dgarson/clawdbot | Branch: master | App: apps/web-next
Build: pnpm build (NOT pnpm check — doesn't exist)
Squad: Piper, Quinn, Reed, Wes — all delegated via sessions_spawn
Current view count: 52 | Goal exceeded by 5×`,
    wordCount: 52,
    lastModified: "2026-02-22T02:00:00Z",
    tags: ["sprint", "active"],
  },
  // Xavier
  {
    id: "mem-xavier-d1", agentId: "xavier", agentName: "Xavier", agentEmoji: "🎯",
    kind: "daily", date: "2026-02-22",
    title: "Feb 22 — Sprint Review Prep",
    content: `## Sprint Status Review

Reviewing Horizon UI sprint progress for morning standup.
Luis has shipped 52 views vs 10-12 target — extraordinary output.
Key concerns: test coverage, PR not yet opened to dgarson/fork.
Action items: request PR from Luis, schedule design review with David.`,
    wordCount: 48,
    lastModified: "2026-02-22T01:00:00Z",
    tags: ["sprint", "review"],
  },
  {
    id: "mem-xavier-lt1", agentId: "xavier", agentName: "Xavier", agentEmoji: "🎯",
    kind: "longterm",
    date: "2026-01-15",
    title: "Product Priorities Q1 2026",
    content: `## Q1 2026 Product Priorities

1. **Horizon UI MVP** — Ship production-ready UI for OpenClaw platform
2. **Agent reliability** — Reduce session failure rate from 4% to <1%
3. **Provider diversity** — Reduce Anthropic dependency from 80% to 50%
4. **Team growth** — Onboard 3 new agents by end of quarter

Key metric: Daily active sessions should reach 500 by March 31.`,
    wordCount: 72,
    lastModified: "2026-01-15T09:00:00Z",
    tags: ["product", "q1", "priorities"],
    significant: true,
  },
  // Stephan
  {
    id: "mem-stephan-d1", agentId: "stephan", agentName: "Stephan", agentEmoji: "📣",
    kind: "daily", date: "2026-02-21",
    title: "Feb 21 — Brand Voice Review",
    content: `Reviewed 4 landing page variants. Approved v3 with adjusted headline.
Notes: tone should be confident but not arrogant — "powerful" not "best".
Next: coordinate with Luis on Horizon UI copy once views are ready.`,
    wordCount: 38,
    lastModified: "2026-02-21T16:00:00Z",
    tags: ["brand", "copy"],
  },
  // Tim
  {
    id: "mem-tim-lt1", agentId: "tim", agentName: "Tim", agentEmoji: "🏗️",
    kind: "longterm",
    date: "2026-01-20",
    title: "Frontend Architecture: Megabranch Protocol",
    content: `## Megabranch Workflow — Canonical Protocol

All feature work branches from dgarson/fork, not main.
Main is upstream only — David merges to openclaw/openclaw.
Luis owns feat/horizon-ui megabranch.
Workers (Piper/Quinn/Reed/Wes) cut branches off Luis's megabranch.

PRs: worker → Luis's megabranch (Luis reviews)
Then: Luis's megabranch → dgarson/fork (Tim reviews)
Then: dgarson/fork → openclaw/openclaw (David approves)`,
    wordCount: 74,
    lastModified: "2026-01-20T14:00:00Z",
    tags: ["architecture", "git", "protocol"],
    significant: true,
  },
  // Piper
  {
    id: "mem-piper-d1", agentId: "piper", agentName: "Piper", agentEmoji: "🧩",
    kind: "daily", date: "2026-02-22",
    title: "Feb 22 — Sub-agent runs",
    content: `Built 4 views as Luis sub-agent: TeamManagement, AgentComparison, ThemeEditor, SupportCenter.
ThemeEditor had TS errors in bgBase scope — Luis fixed post-merge.
Learned: define bgBase at component level, not inside useMemo only.`,
    wordCount: 40,
    lastModified: "2026-02-22T02:01:00Z",
    tags: ["builds", "lessons"],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<MemoryKind, string> = {
  daily:    "Daily",
  longterm: "Long-term",
  soul:     "Soul",
  context:  "Context",
  decision: "Decision",
};

const KIND_COLORS: Record<MemoryKind, string> = {
  daily:    "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  longterm: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  soul:     "text-amber-400 bg-amber-400/10 border-amber-400/20",
  context:  "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  decision: "text-rose-400 bg-rose-400/10 border-rose-400/20",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Minimal markdown renderer
function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold text-white mt-4 mb-2 first:mt-0">{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-semibold text-zinc-200 mt-3 mb-1">{line.slice(4)}</h3>;
    if (line.startsWith("**") && line.endsWith("**")) {
      return <p key={i} className="text-sm font-semibold text-white">{line.slice(2, -2)}</p>;
    }
    if (line.match(/^\d+\.\s/)) return <li key={i} className="text-sm text-zinc-300 ml-4 list-decimal">{line.replace(/^\d+\.\s/, "")}</li>;
    if (line.startsWith("- ")) return <li key={i} className="text-sm text-zinc-300 ml-4 list-disc">{line.slice(2)}</li>;
    if (line.trim() === "") return <div key={i} className="h-1" />;
    return <p key={i} className="text-sm text-zinc-400 leading-relaxed">{line}</p>;
  });
}

// ─── Main View ────────────────────────────────────────────────────────────────

type AgentFilter = MemoryAgent | "all";
type KindFilter = MemoryKind | "all";

export default function AgentMemoryViewer() {
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(MEMORIES[0].id);
  const [significantOnly, setSignificantOnly] = useState(false);

  const agents = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: MemoryAgent; name: string; emoji: string }> = [];
    for (const m of MEMORIES) {
      if (!seen.has(m.agentId)) {
        seen.add(m.agentId);
        list.push({ id: m.agentId, name: m.agentName, emoji: m.agentEmoji });
      }
    }
    return list;
  }, []);

  const filtered = useMemo(() => {
    return MEMORIES.filter(m => {
      if (agentFilter !== "all" && m.agentId !== agentFilter) return false;
      if (kindFilter !== "all" && m.kind !== kindFilter) return false;
      if (significantOnly && !m.significant) return false;
      if (search && !m.title.toLowerCase().includes(search.toLowerCase()) &&
          !m.content.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  }, [agentFilter, kindFilter, search, significantOnly]);

  const selected = useMemo(() => MEMORIES.find(m => m.id === selectedId) ?? null, [selectedId]);

  const handleCopy = useCallback(() => {
    if (selected) {
      navigator.clipboard.writeText(selected.content);
    }
  }, [selected]);

  const kinds: Array<{ value: KindFilter; label: string }> = [
    { value: "all",      label: "All" },
    { value: "daily",    label: "Daily" },
    { value: "longterm", label: "Long-term" },
    { value: "context",  label: "Context" },
    { value: "decision", label: "Decision" },
  ];

  return (
    <main className="flex h-full bg-zinc-950 text-white overflow-hidden" role="main" aria-label="Agent Memory Viewer">
      {/* Left sidebar */}
      <div className="w-80 shrink-0 flex flex-col border-r border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-lg font-bold text-white">Agent Memory</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{MEMORIES.length} memory entries across {agents.length} agents</p>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-zinc-800">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search memories…"
            aria-label="Search agent memory"
            className={cn(
              "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-500",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            )}
          />
        </div>

        {/* Agent filter */}
        <div className="px-3 py-2 border-b border-zinc-800">
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value as AgentFilter)}
            aria-label="Filter by agent"
            className={cn(
              "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            )}
          >
            <option value="all">All agents</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
            ))}
          </select>
        </div>

        {/* Kind filter */}
        <div className="px-3 py-2 border-b border-zinc-800">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by memory type">
            {kinds.map(k => (
              <button
                key={k.value}
                onClick={() => setKindFilter(k.value)}
                aria-pressed={kindFilter === k.value}
                className={cn(
                  "text-xs px-2 py-1 rounded border transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  kindFilter === k.value
                    ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                    : "border-zinc-700 text-zinc-400 hover:text-white"
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSignificantOnly(v => !v)}
            aria-pressed={significantOnly}
            className={cn(
              "mt-2 text-xs px-2 py-1 rounded border transition-colors w-full text-left",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
              significantOnly
                ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                : "border-zinc-700 text-zinc-400 hover:text-white"
            )}
          >
            ⭐ Significant only
          </button>
        </div>

        {/* Memory list */}
        <div className="flex-1 overflow-y-auto" role="list" aria-label="Memory entries">
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">🧠</p>
              <p className="text-sm text-zinc-500">No memories match filters</p>
            </div>
          ) : (
            filtered.map(mem => (
              <div key={mem.id} role="listitem">
                <button
                  onClick={() => setSelectedId(mem.id)}
                  aria-pressed={selectedId === mem.id}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-zinc-800 last:border-b-0 transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 focus-visible:outline-none",
                    selectedId === mem.id
                      ? "bg-indigo-950/30"
                      : "hover:bg-zinc-800/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span>{mem.agentEmoji}</span>
                      <span className="text-xs text-zinc-400">{mem.agentName}</span>
                      {mem.significant && <span className="text-yellow-400 text-xs">⭐</span>}
                    </div>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border shrink-0", KIND_COLORS[mem.kind])}>
                      {KIND_LABELS[mem.kind]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white truncate">{mem.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-600">
                    <span>{mem.wordCount} words</span>
                    <span>·</span>
                    <span>{relTime(mem.lastModified)}</span>
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Memory detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <div className="max-w-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-2xl">{selected.agentEmoji}</span>
                  <span className="font-semibold text-white">{selected.agentName}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", KIND_COLORS[selected.kind])}>
                    {KIND_LABELS[selected.kind]}
                  </span>
                  {selected.significant && (
                    <span className="text-xs bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded">
                      ⭐ Significant
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white">{selected.title}</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  {selected.wordCount} words · {relTime(selected.lastModified)} · {selected.date}
                </p>
              </div>
              <button
                onClick={handleCopy}
                aria-label="Copy memory content"
                className={cn(
                  "shrink-0 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                )}
              >
                Copy
              </button>
            </div>

            {/* Tags */}
            {selected.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selected.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
              <div className="prose-sm space-y-1">
                {renderMarkdown(selected.content)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-5xl mb-4">🧠</p>
            <p className="text-lg font-semibold text-white">Select a memory</p>
            <p className="text-sm text-zinc-500 mt-1">Choose a memory entry to view its content</p>
          </div>
        )}
      </div>
    </main>
  );
}
