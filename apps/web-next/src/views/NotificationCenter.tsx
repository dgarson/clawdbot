import React, { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type NotifSeverity = "critical" | "warning" | "info" | "success";
type NotifCategory = "agent" | "system" | "cron" | "model" | "session" | "file";

interface Notification {
  id: string;
  severity: NotifSeverity;
  category: NotifCategory;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  agentName?: string;
  agentEmoji?: string;
  action?: { label: string; kind: "retry" | "view" | "dismiss" | "open" };
  meta?: string;
  pinned?: boolean;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED: Omit<Notification, "id" | "timestamp" | "read">[] = [
  {
    severity: "critical",
    category: "agent",
    title: "Agent unresponsive — Zara",
    body: "Zara has not responded to its last 3 heartbeats. Auto-restart queued.",
    agentName: "Zara",
    agentEmoji: "🦁",
    action: { label: "Force Restart", kind: "retry" },
    meta: "ops/zara",
  },
  {
    severity: "warning",
    category: "model",
    title: "Token budget at 87% — Opus 4.6",
    body: "Daily token budget for claude-opus-4-6 is 87% consumed. Current pace hits cap ~3 AM.",
    action: { label: "View Usage", kind: "view" },
    meta: "claude-opus-4-6",
  },
  {
    severity: "success",
    category: "cron",
    title: "Cron job completed — UX Work Check",
    body: "Hourly UX work check (Luis) completed in 14.2s. 17 views shipped.",
    agentName: "Luis",
    agentEmoji: "🎨",
    meta: "cron:e61f3c46",
  },
  {
    severity: "info",
    category: "session",
    title: "New session opened — Xavier",
    body: "Xavier started a new reasoning session. Topic: UX review for Horizon UI.",
    agentName: "Xavier",
    agentEmoji: "🏛️",
    action: { label: "Join Session", kind: "open" },
  },
  {
    severity: "success",
    category: "agent",
    title: "PR #44 opened — luis/ui-redesign",
    body: "Product & UI megabranch is ready for review. 17 views, full P2 polish, WCAG 2.1 AA.",
    agentName: "Luis",
    agentEmoji: "🎨",
    action: { label: "View PR", kind: "open" },
    meta: "dgarson/clawdbot#44",
  },
  {
    severity: "warning",
    category: "agent",
    title: "Agent idle — Piper",
    body: "Piper has been idle for 47 minutes with no active tasks or pending messages.",
    agentName: "Piper",
    agentEmoji: "📐",
    action: { label: "Assign Task", kind: "view" },
  },
  {
    severity: "info",
    category: "file",
    title: "Workspace snapshot created",
    body: "Auto-snapshot of /workspace/luis created (23 files, 4.2 MB). Kept for 7 days.",
    meta: "2026-02-21T22:04",
  },
  {
    severity: "success",
    category: "system",
    title: "Gateway daemon healthy",
    body: "All 3 nodes connected. Latency p99: 82 ms. Uptime: 14d 6h.",
    meta: "gateway:v2.4.1",
  },
  {
    severity: "info",
    category: "session",
    title: "Session archived — Roman sprint planning",
    body: "Session auto-archived after 2h inactivity. 847 messages, 14 tool calls.",
    agentName: "Roman",
    agentEmoji: "🏗️",
  },
  {
    severity: "critical",
    category: "system",
    title: "Disk usage warning — 91% full",
    body: "/Users/openclaw: 91% capacity used (456 GB / 500 GB). Clean up workspace or expand storage.",
    action: { label: "View Files", kind: "view" },
    pinned: true,
  },
  {
    severity: "info",
    category: "cron",
    title: "Scheduled job queued — Daily digest",
    body: "Daily digest cron will fire in 8h 54m. Recipients: Xavier, Tim, Joey.",
    meta: "cron:daily-digest",
  },
  {
    severity: "success",
    category: "model",
    title: "New model available — claude-haiku-4-5",
    body: "claude-haiku-4-5 is now available in your account. 35% faster than 4.0 at same price.",
    action: { label: "Try Model", kind: "open" },
  },
];

function makeNotifs(): Notification[] {
  const now = Date.now();
  return SEED.map((s, i) => ({
    ...s,
    id: `notif-${i}`,
    timestamp: new Date(now - i * 4.7 * 60 * 1000),
    read: i > 4,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  NotifSeverity,
  { label: string; dot: string; badge: string; ring: string; icon: string }
> = {
  critical: {
    label: "Critical",
    dot: "bg-red-500",
    badge: "bg-red-500/15 text-red-400 border border-red-500/30",
    ring: "ring-1 ring-red-500/30",
    icon: "🚨",
  },
  warning: {
    label: "Warning",
    dot: "bg-amber-400",
    badge: "bg-amber-400/15 text-amber-400 border border-amber-400/30",
    ring: "ring-1 ring-amber-400/20",
    icon: "⚠️",
  },
  success: {
    label: "Success",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    ring: "",
    icon: "✅",
  },
  info: {
    label: "Info",
    dot: "bg-blue-400",
    badge: "bg-blue-400/15 text-blue-400 border border-blue-400/30",
    ring: "",
    icon: "ℹ️",
  },
};

const CATEGORY_CONFIG: Record<NotifCategory, { label: string; icon: string }> = {
  agent:   { label: "Agent",   icon: "🤖" },
  system:  { label: "System",  icon: "⚙️" },
  cron:    { label: "Cron",    icon: "⏰" },
  model:   { label: "Model",   icon: "🧠" },
  session: { label: "Session", icon: "🌳" },
  file:    { label: "File",    icon: "📁" },
};

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

// ─── Notification Card ────────────────────────────────────────────────────────

interface NotifCardProps {
  notif: Notification;
  selected: boolean;
  onSelect: () => void;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onPin: (id: string) => void;
}

function NotifCard({ notif, selected, onSelect, onRead, onDismiss, onPin }: NotifCardProps) {
  const sc = SEVERITY_CONFIG[notif.severity];
  const cc = CATEGORY_CONFIG[notif.category];

  return (
    <button
      type="button"
      onClick={() => { onSelect(); if (!notif.read) onRead(notif.id); }}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-zinc-800/60 transition-colors",
        "hover:bg-zinc-800/40 focus-visible:outline-none focus-visible:bg-zinc-800/60",
        selected && "bg-zinc-800/60",
        !notif.read && "bg-zinc-900",
        sc.ring
      )}
      aria-selected={selected}
      aria-label={`${notif.severity}: ${notif.title}`}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="flex-shrink-0 mt-1.5">
          {!notif.read ? (
            <span className={cn("block w-2 h-2 rounded-full", sc.dot)} aria-hidden />
          ) : (
            <span className="block w-2 h-2" aria-hidden />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={cn("text-xs rounded-full px-2 py-0.5 font-medium leading-none", sc.badge)}>
              {sc.label}
            </span>
            <span className="text-xs text-zinc-500">{cc.icon} {cc.label}</span>
            {notif.agentName && (
              <span className="text-xs text-zinc-400">{notif.agentEmoji} {notif.agentName}</span>
            )}
            {notif.pinned && (
              <span className="text-xs text-amber-400" aria-label="Pinned">📌</span>
            )}
            <span className="ml-auto text-xs text-zinc-500 flex-shrink-0">{relativeTime(notif.timestamp)}</span>
          </div>

          {/* Title */}
          <p className={cn("text-sm font-semibold leading-snug", notif.read ? "text-zinc-300" : "text-white")}>
            {notif.title}
          </p>

          {/* Body preview */}
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">{notif.body}</p>

          {/* Meta */}
          {notif.meta && (
            <p className="text-xs text-zinc-600 mt-1 font-mono">{notif.meta}</p>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  notif: Notification | null;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onPin: (id: string) => void;
}

function DetailPanel({ notif, onRead, onDismiss, onPin }: DetailPanelProps) {
  if (!notif) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">🔔</div>
          <p className="text-zinc-400 text-sm font-medium">Select a notification</p>
          <p className="text-zinc-600 text-xs mt-1">Click any item to see details and actions</p>
        </div>
      </div>
    );
  }

  const sc = SEVERITY_CONFIG[notif.severity];
  const cc = CATEGORY_CONFIG[notif.category];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={cn("text-xs rounded-full px-2.5 py-1 font-semibold", sc.badge)}>
            {sc.icon} {sc.label}
          </span>
          <span className="text-sm text-zinc-400">{cc.icon} {cc.label}</span>
          {notif.pinned && <span className="text-sm text-amber-400">📌 Pinned</span>}
        </div>
        <h2 className="text-lg font-bold text-white leading-snug">{notif.title}</h2>
        <p className="text-xs text-zinc-500 mt-1">{notif.timestamp.toLocaleString()}</p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Agent info */}
        {notif.agentName && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-zinc-800/50">
            <span className="text-2xl" aria-hidden>{notif.agentEmoji}</span>
            <div>
              <p className="text-sm font-semibold text-zinc-200">{notif.agentName}</p>
              <p className="text-xs text-zinc-500">Source agent</p>
            </div>
          </div>
        )}

        {/* Body text */}
        <p className="text-sm text-zinc-300 leading-relaxed mb-4">{notif.body}</p>

        {/* Meta */}
        {notif.meta && (
          <div className="p-3 rounded-lg bg-zinc-800/40 mb-4">
            <p className="text-xs text-zinc-500 font-medium mb-1 uppercase tracking-wide">Identifier</p>
            <code className="text-xs text-zinc-300 font-mono">{notif.meta}</code>
          </div>
        )}

        {/* Timeline context */}
        <div className="p-3 rounded-lg bg-zinc-800/40">
          <p className="text-xs text-zinc-500 font-medium mb-2 uppercase tracking-wide">Event Details</p>
          <dl className="space-y-2">
            <div className="flex justify-between text-xs">
              <dt className="text-zinc-500">Fired</dt>
              <dd className="text-zinc-300">{notif.timestamp.toLocaleTimeString()}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-zinc-500">Relative</dt>
              <dd className="text-zinc-300">{relativeTime(notif.timestamp)}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-zinc-500">Category</dt>
              <dd className="text-zinc-300">{cc.label}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-zinc-500">Read</dt>
              <dd className={notif.read ? "text-emerald-400" : "text-amber-400"}>
                {notif.read ? "Yes" : "Unread"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 pt-2 border-t border-zinc-800 flex flex-col gap-2">
        {notif.action && (
          <button
            type="button"
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            {notif.action.label}
          </button>
        )}
        <div className="flex gap-2">
          {!notif.read && (
            <button
              type="button"
              onClick={() => onRead(notif.id)}
              className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
            >
              Mark read
            </button>
          )}
          <button
            type="button"
            onClick={() => onPin(notif.id)}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
              notif.pinned
                ? "bg-amber-400/20 text-amber-400 hover:bg-amber-400/30 focus-visible:ring-amber-400"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 focus-visible:ring-zinc-500"
            )}
          >
            {notif.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            onClick={() => onDismiss(notif.id)}
            className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type FilterSeverity = NotifSeverity | "all";
type FilterRead = "all" | "unread" | "read";

export default function NotificationCenter() {
  const [notifs, setNotifs] = useState<Notification[]>(makeNotifs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>("all");
  const [filterRead, setFilterRead] = useState<FilterRead>("all");
  const [filterCategory, setFilterCategory] = useState<NotifCategory | "all">("all");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Live simulation: inject a new info notif every ~45s
  useEffect(() => {
    const LIVE_EVENTS: Omit<Notification, "id" | "timestamp" | "read">[] = [
      {
        severity: "info",
        category: "session",
        title: "Session heartbeat — Tim",
        body: "Tim's architecture review session is still active (112 minutes).",
        agentName: "Tim",
        agentEmoji: "🏛️",
      },
      {
        severity: "success",
        category: "cron",
        title: "Cron completed — Agent mail drain",
        body: "agent-mail.sh drain: 0 new messages in inbox.",
        meta: "cron:agent-mail",
      },
    ];
    let idx = 0;
    const t = setInterval(() => {
      const ev = LIVE_EVENTS[idx % LIVE_EVENTS.length];
      idx++;
      setNotifs((prev) => [
        {
          ...ev,
          id: `live-${Date.now()}`,
          timestamp: new Date(),
          read: false,
        },
        ...prev,
      ]);
    }, 45_000);
    return () => clearInterval(t);
  }, []);

  // Keyboard: Cmd+K → focus search; Escape → clear search; ?-key handled by App
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    setSelectedId((sel) => (sel === id ? null : sel));
  }, []);

  const pin = useCallback((id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  }, []);

  // Filter + sort (pinned first, then by timestamp desc)
  const filtered = notifs
    .filter((n) => {
      if (filterSeverity !== "all" && n.severity !== filterSeverity) return false;
      if (filterRead === "unread" && n.read) return false;
      if (filterRead === "read" && !n.read) return false;
      if (filterCategory !== "all" && n.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !n.title.toLowerCase().includes(q) &&
          !n.body.toLowerCase().includes(q) &&
          !(n.agentName?.toLowerCase().includes(q))
        )
          return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

  const unreadCount = notifs.filter((n) => !n.read).length;
  const selected = notifs.find((n) => n.id === selectedId) ?? null;

  const SEVERITY_FILTERS: { value: FilterSeverity; label: string; color: string }[] = [
    { value: "all",      label: "All",      color: "text-zinc-400" },
    { value: "critical", label: "Critical", color: "text-red-400"   },
    { value: "warning",  label: "Warning",  color: "text-amber-400" },
    { value: "success",  label: "Success",  color: "text-emerald-400" },
    { value: "info",     label: "Info",     color: "text-blue-400"  },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* ── Top Bar ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Notification Center</h1>
          {unreadCount > 0 && (
            <span className="text-xs bg-violet-600 text-white rounded-full px-2 py-0.5 font-bold" aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={() => setNotifs((prev) => prev.filter((n) => n.pinned || !n.read ? true : false))}
            className="text-xs text-zinc-400 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            Clear read
          </button>
        </div>
      </header>

      {/* ── Stats row ── */}
      <div className="flex gap-4 px-6 py-3 border-b border-zinc-800 flex-shrink-0 overflow-x-auto">
        {(["critical", "warning", "success", "info"] as NotifSeverity[]).map((sev) => {
          const count = notifs.filter((n) => n.severity === sev).length;
          const cfg = SEVERITY_CONFIG[sev];
          return (
            <div key={sev} className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} aria-hidden />
              <span className="text-xs font-semibold text-zinc-300">{count}</span>
              <span className="text-xs text-zinc-500">{cfg.label}</span>
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-zinc-500">Total:</span>
          <span className="text-xs font-semibold text-zinc-300">{notifs.length}</span>
        </div>
      </div>

      {/* ── Body: List + Detail ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left pane: filters + list */}
        <div className="w-96 flex-shrink-0 flex flex-col border-r border-zinc-800 overflow-hidden">
          {/* Search */}
          <div className="px-3 pt-3 pb-2 border-b border-zinc-800/60 flex-shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm select-none" aria-hidden>
                🔍
              </span>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications… (⌘F)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                aria-label="Search notifications"
              />
            </div>
          </div>

          {/* Severity filter chips */}
          <div className="flex gap-1 px-3 py-2 border-b border-zinc-800/60 overflow-x-auto flex-shrink-0">
            {SEVERITY_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilterSeverity(f.value)}
                className={cn(
                  "flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                  filterSeverity === f.value
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}
                aria-pressed={filterSeverity === f.value}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Read / Category filters */}
          <div className="flex gap-2 px-3 py-2 border-b border-zinc-800/60 overflow-x-auto flex-shrink-0">
            {(["all", "unread", "read"] as FilterRead[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilterRead(v)}
                className={cn(
                  "flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 capitalize",
                  filterRead === v ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}
                aria-pressed={filterRead === v}
              >
                {v}
              </button>
            ))}
            <div className="w-px bg-zinc-700 mx-1 flex-shrink-0" aria-hidden />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as NotifCategory | "all")}
              className="flex-shrink-0 text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {(Object.keys(CATEGORY_CONFIG) as NotifCategory[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_CONFIG[c].icon} {CATEGORY_CONFIG[c].label}</option>
              ))}
            </select>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto" role="listbox" aria-label="Notifications">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-zinc-400 text-sm font-medium">All clear</p>
                <p className="text-zinc-600 text-xs mt-1">No notifications match your filters</p>
              </div>
            ) : (
              filtered.map((n) => (
                <NotifCard
                  key={n.id}
                  notif={n}
                  selected={n.id === selectedId}
                  onSelect={() => setSelectedId(n.id)}
                  onRead={markRead}
                  onDismiss={dismiss}
                  onPin={pin}
                />
              ))
            )}
          </div>
        </div>

        {/* Right pane: detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <DetailPanel notif={selected} onRead={markRead} onDismiss={dismiss} onPin={pin} />
        </div>
      </div>
    </div>
  );
}
