import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActivityKind =
  | "agent-session"
  | "code-push"
  | "pr-merged"
  | "pr-opened"
  | "view-shipped"
  | "alert-fired"
  | "alert-resolved"
  | "cron-run"
  | "webhook"
  | "deploy"
  | "member-joined"
  | "feature-flag"
  | "comment"
  | "mention"
  | "build";

type ActivityActor = {
  id: string;
  name: string;
  emoji: string;
  kind: "agent" | "system" | "user";
};

interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  actor: ActivityActor;
  title: string;
  body?: string;
  timestamp: string;
  metadata?: Record<string, string>;
  link?: string;
  important?: boolean;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const EVENTS: ActivityEvent[] = [
  {
    id: "ev-001",
    kind: "view-shipped",
    actor: { id: "luis", name: "Luis", emoji: "🎨", kind: "agent" },
    title: "Shipped views #47 ThemeEditor + #48 PermissionsManager",
    body: "48 Horizon UI views now live. Sprint goal (10-12) exceeded 4× over.",
    timestamp: "2026-02-22T02:02:00Z",
    metadata: { commit: "d2ab301", views: "48" },
    important: true,
  },
  {
    id: "ev-002",
    kind: "alert-fired",
    actor: { id: "system", name: "Alert Monitor", emoji: "🚨", kind: "system" },
    title: "Gemini 3 Flash token budget exhausted",
    body: "Hourly token limit (3M) reached. Requests queued pending reset.",
    timestamp: "2026-02-22T00:47:00Z",
    metadata: { severity: "critical", model: "gemini-3-flash" },
    important: true,
  },
  {
    id: "ev-003",
    kind: "agent-session",
    actor: { id: "piper", name: "Piper", emoji: "🧩", kind: "agent" },
    title: "Started sub-agent session: horizon-theme-editor",
    body: "Building ThemeEditor component with live preview panel and CSS variable export.",
    timestamp: "2026-02-22T01:53:00Z",
    metadata: { model: "MiniMax-M2.5", tokens: "30K" },
  },
  {
    id: "ev-004",
    kind: "cron-run",
    actor: { id: "system", name: "Cron Scheduler", emoji: "⏰", kind: "system" },
    title: "Hourly heartbeat — Luis UX Work Check",
    body: "Triggered at 01:05 AM MST. Sprint at 35 views, continued building.",
    timestamp: "2026-02-22T08:05:00Z",
    metadata: { cron: "5 * * * *", result: "success" },
  },
  {
    id: "ev-005",
    kind: "agent-session",
    actor: { id: "wes", name: "Wes", emoji: "⚡", kind: "agent" },
    title: "Completed: horizon-webhook-manager",
    body: "WebhookManager.tsx shipped — endpoint grid, delivery log table, add modal.",
    timestamp: "2026-02-22T01:43:00Z",
    metadata: { lines: "850", gzip: "5.70 kB" },
  },
  {
    id: "ev-006",
    kind: "view-shipped",
    actor: { id: "quinn", name: "Quinn", emoji: "🎯", kind: "agent" },
    title: "Shipped ConversationHistory view",
    body: "Session archive with message replay, export JSON, filter by agent.",
    timestamp: "2026-02-22T01:40:00Z",
    metadata: { commit: "d06fa79" },
  },
  {
    id: "ev-007",
    kind: "build",
    actor: { id: "system", name: "CI Build", emoji: "🔨", kind: "system" },
    title: "Horizon UI built successfully — 44 views",
    body: "✓ built in 1.50s. 0 TypeScript errors.",
    timestamp: "2026-02-22T01:40:00Z",
    metadata: { duration: "1.50s", chunks: "44" },
  },
  {
    id: "ev-008",
    kind: "alert-resolved",
    actor: { id: "xavier", name: "Xavier", emoji: "🎯", kind: "agent" },
    title: "Acknowledged: Global token budget at 86%",
    body: "Xavier acknowledged the global budget warning. Monitoring closely.",
    timestamp: "2026-02-22T00:43:00Z",
    metadata: { alertId: "al-002" },
  },
  {
    id: "ev-009",
    kind: "agent-session",
    actor: { id: "reed", name: "Reed", emoji: "📊", kind: "agent" },
    title: "Completed: horizon-permissions-manager",
    body: "PermissionsManager.tsx shipped — permission matrix, 5 agent profiles, edit mode.",
    timestamp: "2026-02-22T01:51:00Z",
    metadata: { lines: "480", gzip: "2.82 kB" },
  },
  {
    id: "ev-010",
    kind: "view-shipped",
    actor: { id: "luis", name: "Luis", emoji: "🎨", kind: "agent" },
    title: "Shipped views #45 AgentScheduler + #46 TokenLedger",
    body: "AgentScheduler with calendar view. TokenLedger with 3-tab cost accounting.",
    timestamp: "2026-02-22T01:58:00Z",
    metadata: { commit: "c7bc4cb", views: "47" },
  },
  {
    id: "ev-011",
    kind: "feature-flag",
    actor: { id: "xavier", name: "Xavier", emoji: "🎯", kind: "agent" },
    title: "Feature flag enabled: horizon_ui_enabled",
    body: "Horizon UI rolled out to 100% of workspace.",
    timestamp: "2026-02-21T18:00:00Z",
    metadata: { flag: "horizon_ui_enabled", rollout: "100%" },
  },
  {
    id: "ev-012",
    kind: "code-push",
    actor: { id: "luis", name: "Luis", emoji: "🎨", kind: "agent" },
    title: "Pushed 12 commits to master",
    body: "feat(horizon): views #36-48 — KnowledgeBase, CrashReporter, Benchmark, Limits, Tasks, Storage, Alerts, Webhooks, History, Scheduler, Ledger, Theme, Perms",
    timestamp: "2026-02-22T02:00:00Z",
    metadata: { commits: "12", branch: "master" },
  },
  {
    id: "ev-013",
    kind: "pr-merged",
    actor: { id: "piper", name: "Piper", emoji: "🧩", kind: "agent" },
    title: "PR merged: feat/team-management → feat/horizon-mvp",
    body: "TeamManagement view — 1074 lines. Reviewed and merged by Luis.",
    timestamp: "2026-02-22T00:32:00Z",
    metadata: { pr: "#89", files: "1" },
  },
  {
    id: "ev-014",
    kind: "webhook",
    actor: { id: "system", name: "GitHub Webhook", emoji: "🔗", kind: "system" },
    title: "PR #142 opened: feat/rate-limit-dashboard",
    body: "Branch pushed, CI triggered. Awaiting review.",
    timestamp: "2026-02-22T01:30:00Z",
    metadata: { pr: "#142" },
  },
  {
    id: "ev-015",
    kind: "mention",
    actor: { id: "stephan", name: "Stephan", emoji: "📣", kind: "agent" },
    title: "Mentioned @Luis in #cb-activity",
    body: "Great sprint output on Horizon UI! The theme editor especially — love the live preview.",
    timestamp: "2026-02-22T02:05:00Z",
    metadata: { channel: "#cb-activity" },
    important: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const KIND_EMOJIS: Record<ActivityKind, string> = {
  "agent-session": "🤖",
  "code-push":     "📌",
  "pr-merged":     "✅",
  "pr-opened":     "🔀",
  "view-shipped":  "🚀",
  "alert-fired":   "🚨",
  "alert-resolved": "✅",
  "cron-run":      "⏰",
  "webhook":       "🔗",
  "deploy":        "🚀",
  "member-joined": "👋",
  "feature-flag":  "🚩",
  "comment":       "💬",
  "mention":       "📣",
  "build":         "🔨",
};

const KIND_LABELS: Record<ActivityKind, string> = {
  "agent-session": "Agent",
  "code-push":     "Code",
  "pr-merged":     "PR",
  "pr-opened":     "PR",
  "view-shipped":  "Ship",
  "alert-fired":   "Alert",
  "alert-resolved": "Alert",
  "cron-run":      "Cron",
  "webhook":       "Webhook",
  "deploy":        "Deploy",
  "member-joined": "Team",
  "feature-flag":  "Flag",
  "comment":       "Comment",
  "mention":       "Mention",
  "build":         "Build",
};

const KIND_COLORS: Record<ActivityKind, string> = {
  "agent-session": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "code-push":     "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  "pr-merged":     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "pr-opened":     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "view-shipped":  "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "alert-fired":   "bg-rose-500/10 text-rose-400 border-rose-500/20",
  "alert-resolved": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "cron-run":      "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "webhook":       "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "deploy":        "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "member-joined": "bg-green-500/10 text-green-400 border-green-500/20",
  "feature-flag":  "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "comment":       "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  "mention":       "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "build":         "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) {return `${secs}s ago`;}
  const mins = Math.floor(secs / 60);
  if (mins < 60) {return `${mins}m ago`;}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {return `${hrs}h ago`;}
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ActivityItemProps {
  event: ActivityEvent;
  selected: boolean;
  onSelect: () => void;
}

function ActivityItem({ event, selected, onSelect }: ActivityItemProps) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full text-left px-4 py-3.5 border-b border-zinc-800 last:border-b-0 transition-colors",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 focus-visible:outline-none",
        selected ? "bg-indigo-950/30" : "hover:bg-zinc-800/30",
        event.important && !selected && "border-l-2 border-l-indigo-500"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Actor avatar */}
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm",
          event.actor.kind === "system" ? "bg-zinc-800" : "bg-indigo-950"
        )}>
          {event.actor.emoji}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className="text-xs font-medium text-zinc-300">{event.actor.name}</span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", KIND_COLORS[event.kind])}>
                  {KIND_LABELS[event.kind]}
                </span>
                {event.important && (
                  <span className="text-[10px] text-indigo-400">★</span>
                )}
              </div>
              <p className="text-sm text-white truncate">{event.title}</p>
              {event.body && (
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{event.body}</p>
              )}
            </div>
            <span className="text-xs text-zinc-600 shrink-0 whitespace-nowrap">{relTime(event.timestamp)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

const ALL_KINDS = Array.from(new Set(EVENTS.map(e => e.kind)));
type KindFilter = ActivityKind | "all";
type ActorFilter = string; // agentId or "all"

export default function ActivityFeed() {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [actorFilter, setActorFilter] = useState<ActorFilter>("all");
  const [importantOnly, setImportantOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(EVENTS[0].id);

  const actors = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string; emoji: string }> = [];
    for (const e of EVENTS) {
      if (!seen.has(e.actor.id)) {
        seen.add(e.actor.id);
        list.push({ id: e.actor.id, name: e.actor.name, emoji: e.actor.emoji });
      }
    }
    return list;
  }, []);

  const filtered = useMemo(() => {
    return EVENTS.filter(e => {
      if (kindFilter !== "all" && e.kind !== kindFilter) {return false;}
      if (actorFilter !== "all" && e.actor.id !== actorFilter) {return false;}
      if (importantOnly && !e.important) {return false;}
      if (search && !e.title.toLowerCase().includes(search.toLowerCase()) &&
          !(e.body ?? "").toLowerCase().includes(search.toLowerCase())) {return false;}
      return true;
    }).toSorted((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [kindFilter, actorFilter, importantOnly, search]);

  const selected = useMemo(() => EVENTS.find(e => e.id === selectedId) ?? null, [selectedId]);

  const kindOptions: Array<{ value: KindFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "view-shipped", label: "Ships 🚀" },
    { value: "agent-session", label: "Agents" },
    { value: "alert-fired", label: "Alerts" },
    { value: "build", label: "Builds" },
    { value: "code-push", label: "Code" },
    { value: "pr-merged", label: "PRs" },
    { value: "cron-run", label: "Cron" },
    { value: "mention", label: "Mentions" },
  ];

  return (
    <main className="flex h-full bg-zinc-950 text-white overflow-hidden" role="main" aria-label="Activity Feed">
      {/* Left: Feed */}
      <div className="w-96 shrink-0 flex flex-col border-r border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white">Activity</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportantOnly(v => !v)}
                aria-pressed={importantOnly}
                className={cn(
                  "text-xs px-2 py-1 rounded border transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  importantOnly
                    ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                    : "border-zinc-700 text-zinc-400 hover:text-white"
                )}
              >
                ★ Important
              </button>
              <span className="text-xs text-zinc-600">{filtered.length}</span>
            </div>
          </div>

          {/* Search */}
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search activity…"
            aria-label="Search activity"
            className={cn(
              "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-500 mb-2",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            )}
          />

          {/* Kind chips */}
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by type">
            {kindOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setKindFilter(opt.value)}
                aria-pressed={kindFilter === opt.value}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded border transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  kindFilter === opt.value
                    ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                    : "border-zinc-800 text-zinc-500 hover:text-white"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actor filter */}
        <div className="px-3 py-2 border-b border-zinc-800">
          <select
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value)}
            aria-label="Filter by actor"
            className={cn(
              "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            )}
          >
            <option value="all">All actors</option>
            {actors.map(a => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
            ))}
          </select>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto" role="feed" aria-label="Activity events" aria-live="polite">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm text-zinc-400">No activity matches filters</p>
            </div>
          ) : (
            filtered.map(ev => (
              <ActivityItem
                key={ev.id}
                event={ev}
                selected={selectedId === ev.id}
                onSelect={() => setSelectedId(ev.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <div className="max-w-xl space-y-5">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0",
                selected.actor.kind === "system" ? "bg-zinc-800" : "bg-indigo-950"
              )}>
                {selected.actor.emoji}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-white">{selected.actor.name}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", KIND_COLORS[selected.kind])}>
                    {KIND_EMOJIS[selected.kind]} {KIND_LABELS[selected.kind]}
                  </span>
                  {selected.important && (
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
                      ★ Important
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500">{new Date(selected.timestamp).toLocaleString()}</p>
              </div>
            </div>

            {/* Title + body */}
            <div>
              <h2 className="text-lg font-bold text-white mb-2">{selected.title}</h2>
              {selected.body && (
                <p className="text-sm text-zinc-400 leading-relaxed">{selected.body}</p>
              )}
            </div>

            {/* Metadata */}
            {selected.metadata && Object.keys(selected.metadata).length > 0 && (
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Metadata</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(selected.metadata).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-zinc-500 capitalize">{k.replace(/-/g, " ")}</p>
                      <p className="text-sm font-mono text-white">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related events (same actor) */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white">More from {selected.actor.name}</h3>
              </div>
              <div className="divide-y divide-zinc-800">
                {EVENTS.filter(e => e.actor.id === selected.actor.id && e.id !== selected.id).slice(0, 3).map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedId(ev.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-zinc-800/40 transition-colors flex items-start gap-3",
                      "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 focus-visible:outline-none"
                    )}
                  >
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border mt-0.5 shrink-0", KIND_COLORS[ev.kind])}>
                      {KIND_LABELS[ev.kind]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{ev.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{relTime(ev.timestamp)}</p>
                    </div>
                  </button>
                ))}
                {EVENTS.filter(e => e.actor.id === selected.actor.id && e.id !== selected.id).length === 0 && (
                  <p className="px-4 py-3 text-xs text-zinc-600">No other events from this actor</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-lg font-semibold text-white">Select an event</p>
            <p className="text-sm text-zinc-500 mt-1">Choose an activity from the feed to view details</p>
          </div>
        )}
      </div>
    </main>
  );
}
