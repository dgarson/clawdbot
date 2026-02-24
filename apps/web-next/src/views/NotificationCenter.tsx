import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { BellOff } from "lucide-react";
import { cn } from "../lib/utils";
import { Skeleton } from "../components/ui/Skeleton";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";

// ─── Types ───────────────────────────────────────────────────────────────────

type NotifSeverity = "critical" | "warning" | "info" | "success";
type NotifCategory = "agent" | "system" | "cron" | "model" | "session" | "file";
type ConnectionStatus = "live" | "reconnecting" | "offline";

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

interface NotificationSettings {
  categories: Record<NotifCategory, boolean>;
  severities: {
    warning: boolean;
    info: boolean;
    success: boolean;
    // critical always on
  };
  markAllReadOnOpen: boolean;
}

interface GroupedNotification {
  isGroup: true;
  agentName: string;
  agentEmoji?: string;
  count: number;
  notifications: Notification[];
  latestTimestamp: Date;
}

type ListableNotification = Notification | GroupedNotification;

// ─── Settings Helpers ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: NotificationSettings = {
  categories: {
    agent: true,
    system: true,
    cron: true,
    model: true,
    session: true,
    file: true,
  },
  severities: {
    warning: true,
    info: true,
    success: true,
  },
  markAllReadOnOpen: false,
};

function loadSettings(): NotificationSettings {
  try {
    const stored = localStorage.getItem("notif-settings");
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem("notif-settings", JSON.stringify(settings));
  } catch {
    // ignore
  }
}

// ─── useNotificationStream Hook ──────────────────────────────────────────────

function useNotificationStream(
  onNewNotification: (n: Omit<Notification, "id" | "timestamp" | "read">) => void
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("live");

  useEffect(() => {
    // Simulate connection status cycling
    const statusInterval = setInterval(() => {
      setStatus((prev) => {
        const rand = Math.random();
        if (prev === "live") {
          // 5% chance to go reconnecting
          return rand < 0.05 ? "reconnecting" : "live";
        } else if (prev === "reconnecting") {
          // 80% chance to reconnect, 20% stay reconnecting
          return rand < 0.8 ? "live" : "reconnecting";
        }
        return prev;
      });
    }, 5000);

    // Simulate new notifications every 30s
    const notifInterval = setInterval(() => {
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
        {
          severity: "info",
          category: "agent",
          title: "Agent idle — Luis",
          body: "Luis has been idle for 12 minutes.",
          agentName: "Luis",
          agentEmoji: "🎨",
        },
      ];
      const idx = Math.floor(Math.random() * LIVE_EVENTS.length);
      onNewNotification(LIVE_EVENTS[idx]);
    }, 30000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(notifInterval);
    };
  }, [onNewNotification]);

  return status;
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
  {
    severity: "info",
    category: "agent",
    title: "Task assigned — Luis",
    body: "Luis was assigned a new task: UI review for M8.",
    agentName: "Luis",
    agentEmoji: "🎨",
  },
  {
    severity: "info",
    category: "agent",
    title: "Task completed — Luis",
    body: "Luis completed the assigned task.",
    agentName: "Luis",
    agentEmoji: "🎨",
  },
  {
    severity: "warning",
    category: "agent",
    title: "High latency — Luis",
    body: "Luis is experiencing high response latency.",
    agentName: "Luis",
    agentEmoji: "🎨",
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

const CONNECTION_CONFIG: Record<ConnectionStatus, { dot: string; label: string }> = {
  live:         { dot: "bg-emerald-500", label: "Live updates active" },
  reconnecting: { dot: "bg-amber-400",   label: "Reconnecting..." },
  offline:      { dot: "bg-surface-3",    label: "Offline" },
};

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) {return "just now";}
  if (diffMin < 60) {return `${diffMin}m ago`;}
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {return `${diffH}h ago`;}
  return `${Math.floor(diffH / 24)}d ago`;
}

function isGrouped(n: ListableNotification): n is GroupedNotification {
  return  (n as GroupedNotification).isGroup;
}

// ─── Settings Drawer ─────────────────────────────────────────────────────────

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onUpdate: (s: NotificationSettings) => void;
}

function SettingsDrawer({ open, onClose, settings, onUpdate }: SettingsDrawerProps) {
  if (!open) {return null;}

  const toggleCategory = (cat: NotifCategory) => {
    onUpdate({
      ...settings,
      categories: { ...settings.categories, [cat]: !settings.categories[cat] },
    });
  };

  const toggleSeverity = (sev: "warning" | "info" | "success") => {
    onUpdate({
      ...settings,
      severities: { ...settings.severities, [sev]: !settings.severities[sev] },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Notification settings"
        className="relative w-80 bg-surface-1 border-l border-tok-border h-full overflow-y-auto shadow-2xl animate-slide-in"
      >
        <div className="flex items-center justify-between p-4 border-b border-tok-border">
          <h2 className="text-lg font-bold text-fg-primary">Notification Settings</h2>
          <button
            onClick={onClose}
            className="text-fg-secondary hover:text-fg-primary transition-colors"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Categories */}
          <div>
            <h3 className="text-xs uppercase tracking-wider font-semibold text-fg-muted mb-3">
              Categories
            </h3>
            <div className="space-y-2">
              {(Object.keys(CATEGORY_CONFIG) as NotifCategory[]).map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                const enabled = settings.categories[cat];
                return (
                  <label
                    key={cat}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2/50 hover:bg-surface-2 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleCategory(cat)}
                      className="w-4 h-4 rounded border-tok-border text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
                    />
                    <span className="text-sm">{cfg.icon}</span>
                    <span className={cn("text-sm", enabled ? "text-fg-primary" : "text-fg-muted")}>
                      {cfg.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Severities */}
          <div>
            <h3 className="text-xs uppercase tracking-wider font-semibold text-fg-muted mb-3">
              Severity Levels
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2/50 hover:bg-surface-2 cursor-not-allowed opacity-50">
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="w-4 h-4 rounded border-tok-border text-red-500"
                />
                <span className="text-sm">🚨</span>
                <span className="text-sm text-fg-secondary">Critical (always on)</span>
              </label>
              {(["warning", "info", "success"] as const).map((sev) => {
                const cfg = SEVERITY_CONFIG[sev];
                const enabled = settings.severities[sev];
                return (
                  <label
                    key={sev}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2/50 hover:bg-surface-2 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleSeverity(sev)}
                      className="w-4 h-4 rounded border-tok-border text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
                    />
                    <span className="text-sm">{cfg.icon}</span>
                    <span className={cn("text-sm", enabled ? "text-fg-primary" : "text-fg-muted")}>
                      {cfg.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Behavior */}
          <div>
            <h3 className="text-xs uppercase tracking-wider font-semibold text-fg-muted mb-3">
              Behavior
            </h3>
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2/50 hover:bg-surface-2 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={settings.markAllReadOnOpen}
                onChange={() =>
                  onUpdate({
                    ...settings,
                    markAllReadOnOpen: !settings.markAllReadOnOpen,
                  })
                }
                className="w-4 h-4 rounded border-tok-border text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
              />
              <span className="text-sm text-fg-primary">Mark all read on open</span>
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-tok-border">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-fg-primary text-sm font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notification Card ────────────────────────────────────────────────────────

interface NotifCardProps {
  notif: ListableNotification;
  selected: boolean;
  focused: boolean;
  onSelect: () => void;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onPin: (id: string) => void;
  onExpandGroup?: (agentName: string) => void;
  expandedGroups: Set<string>;
  // These are used in recursive calls for grouped notifications
  _recursiveDismiss?: (id: string) => void;
  _recursivePin?: (id: string) => void;
}

function NotifCard({
  notif,
  selected,
  focused,
  onSelect,
  onRead,
  onDismiss,
  onPin,
  onExpandGroup,
  expandedGroups,
  _recursiveDismiss,
  _recursivePin,
}: NotifCardProps) {
  // Use recursive callbacks for nested items, direct callbacks for top-level
  const dismissCallback = _recursiveDismiss ?? onDismiss;
  const pinCallback = _recursivePin ?? onPin;
  if (isGrouped(notif)) {
    const isExpanded = expandedGroups.has(notif.agentName);
    return (
      <div>
        <button
          type="button"
          onClick={() => onExpandGroup?.(notif.agentName)}
          className={cn(
            "w-full text-left px-4 py-3 border-b border-tok-border/60 transition-colors",
            "hover:bg-surface-2/40 focus-visible:outline-none focus-visible:bg-surface-2/60",
            focused && "ring-2 ring-inset ring-violet-500",
            selected && "bg-surface-2/60"
          )}
          aria-expanded={isExpanded}
          aria-label={`${notif.agentName}: ${notif.count} notifications`}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 mt-1.5">
              <span className="block w-2 h-2 rounded-full bg-blue-400" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs text-fg-secondary">{notif.agentEmoji} {notif.agentName}</span>
                <span className="text-xs bg-blue-500/20 text-blue-400 rounded-full px-2 py-0.5 font-medium">
                  {notif.count} notifications
                </span>
                <span className="ml-auto text-xs text-fg-muted flex-shrink-0">
                  {relativeTime(notif.latestTimestamp)}
                </span>
              </div>
              <p className="text-sm text-fg-secondary">
                {isExpanded ? "Hide" : "Show"} {notif.count} notifications from {notif.agentName}
                <span className="text-fg-muted ml-1">[{isExpanded ? "−" : "+"}{notif.count - 1} more]</span>
              </p>
            </div>
          </div>
        </button>
        {isExpanded &&
          notif.notifications.map((n) => (
            <NotifCard
              key={n.id}
              notif={n}
              selected={false}
              focused={false}
              onSelect={() => {}}
              onRead={onRead}
              onDismiss={dismissCallback}
              onPin={pinCallback}
              expandedGroups={expandedGroups}
              _recursiveDismiss={dismissCallback}
              _recursivePin={pinCallback}
            />
          ))}
      </div>
    );
  }

  const sc = SEVERITY_CONFIG[notif.severity];
  const cc = CATEGORY_CONFIG[notif.category];

  return (
    <button
      type="button"
      onClick={() => {
        onSelect();
        if (!notif.read) {onRead(notif.id);}
      }}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-tok-border/60 transition-colors",
        "hover:bg-surface-2/40 focus-visible:outline-none focus-visible:bg-surface-2/60",
        focused && "ring-2 ring-inset ring-violet-500",
        selected && "bg-surface-2/60",
        !notif.read && "bg-surface-1",
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
            <span className="text-xs text-fg-muted">{cc.icon} {cc.label}</span>
            {notif.agentName && (
              <span className="text-xs text-fg-secondary">{notif.agentEmoji} {notif.agentName}</span>
            )}
            {notif.pinned && (
              <span className="text-xs text-amber-400" aria-label="Pinned">📌</span>
            )}
            <span className="ml-auto text-xs text-fg-muted flex-shrink-0">{relativeTime(notif.timestamp)}</span>
          </div>

          {/* Title */}
          <p className={cn("text-sm font-semibold leading-snug", notif.read ? "text-fg-secondary" : "text-fg-primary")}>
            {notif.title}
          </p>

          {/* Body preview */}
          <p className="text-xs text-fg-muted mt-0.5 line-clamp-2 leading-relaxed">{notif.body}</p>

          {/* Meta */}
          {notif.meta && (
            <p className="text-xs text-fg-muted mt-1 font-mono">{notif.meta}</p>
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
          <p className="text-fg-secondary text-sm font-medium">Select a notification</p>
          <p className="text-fg-muted text-xs mt-1">Click any item to see details and actions</p>
        </div>
      </div>
    );
  }

  const sc = SEVERITY_CONFIG[notif.severity];
  const cc = CATEGORY_CONFIG[notif.category];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-tok-border">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={cn("text-xs rounded-full px-2.5 py-1 font-semibold", sc.badge)}>
            {sc.icon} {sc.label}
          </span>
          <span className="text-sm text-fg-secondary">{cc.icon} {cc.label}</span>
          {notif.pinned && <span className="text-sm text-amber-400">📌 Pinned</span>}
        </div>
        <h2 className="text-lg font-bold text-fg-primary leading-snug">{notif.title}</h2>
        <p className="text-xs text-fg-muted mt-1">{notif.timestamp.toLocaleString()}</p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Agent info */}
        {notif.agentName && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-surface-2/50">
            <span className="text-2xl" aria-hidden>{notif.agentEmoji}</span>
            <div>
              <p className="text-sm font-semibold text-fg-primary">{notif.agentName}</p>
              <p className="text-xs text-fg-muted">Source agent</p>
            </div>
          </div>
        )}

        {/* Body text */}
        <p className="text-sm text-fg-secondary leading-relaxed mb-4">{notif.body}</p>

        {/* Meta */}
        {notif.meta && (
          <div className="p-3 rounded-lg bg-surface-2/40 mb-4">
            <p className="text-xs text-fg-muted font-medium mb-1 uppercase tracking-wide">Identifier</p>
            <code className="text-xs text-fg-secondary font-mono">{notif.meta}</code>
          </div>
        )}

        {/* Timeline context */}
        <div className="p-3 rounded-lg bg-surface-2/40">
          <p className="text-xs text-fg-muted font-medium mb-2 uppercase tracking-wide">Event Details</p>
          <dl className="space-y-2">
            <div className="flex justify-between text-xs">
              <dt className="text-fg-muted">Fired</dt>
              <dd className="text-fg-secondary">{notif.timestamp.toLocaleTimeString()}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-fg-muted">Relative</dt>
              <dd className="text-fg-secondary">{relativeTime(notif.timestamp)}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-fg-muted">Category</dt>
              <dd className="text-fg-secondary">{cc.label}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-fg-muted">Read</dt>
              <dd className={notif.read ? "text-emerald-400" : "text-amber-400"}>
                {notif.read ? "Yes" : "Unread"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 pt-2 border-t border-tok-border flex flex-col gap-2">
        {notif.action && (
          <button
            type="button"
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 active:scale-95 text-fg-primary text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {notif.action.label}
          </button>
        )}
        <div className="flex gap-2">
          {!notif.read && (
            <button
              type="button"
              onClick={() => onRead(notif.id)}
              className="flex-1 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-fg-secondary text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
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
                : "bg-surface-2 hover:bg-surface-3 text-fg-secondary focus-visible:ring-zinc-500"
            )}
          >
            {notif.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            onClick={() => onDismiss(notif.id)}
            className="flex-1 py-2 rounded-lg bg-surface-2 hover:bg-red-500/20 text-fg-secondary hover:text-red-400 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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

// Export unread count for App.tsx
export function useNotificationUnreadCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    // Initial count from seed
    setCount(makeNotifs().filter((n) => !n.read).length);
  }, []);
  return count;
}

function NotificationCenterSkeleton() {
  return (
    <div className="flex flex-col h-full bg-surface-0 text-fg-primary">
      {/* Top bar skeleton */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-tok-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton variant="rect" className="h-6 w-44" />
          <Skeleton variant="rect" className="h-5 w-8 rounded-full" />
          <Skeleton variant="rect" className="h-3 w-28 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton variant="rect" className="h-7 w-24 rounded-lg" />
          <Skeleton variant="rect" className="h-7 w-20 rounded-lg" />
        </div>
      </header>
      {/* Stats skeleton */}
      <div className="flex gap-4 px-6 py-3 border-b border-tok-border flex-shrink-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Skeleton variant="circle" className="w-2 h-2" />
            <Skeleton variant="text" className="h-3 w-8" />
            <Skeleton variant="text" className="h-2.5 w-12" />
          </div>
        ))}
      </div>
      {/* Body skeleton */}
      <div className="flex flex-1 min-h-0">
        {/* List skeleton */}
        <div className="w-96 flex-shrink-0 border-r border-tok-border overflow-hidden">
          <div className="px-3 pt-3 pb-2 border-b border-tok-border/60">
            <Skeleton variant="rect" className="h-9 w-full rounded-lg" />
          </div>
          <div className="flex gap-1 px-3 py-2 border-b border-tok-border/60">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-6 w-16 rounded-full" />
            ))}
          </div>
          <div className="divide-y divide-tok-border/60">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton variant="circle" className="w-2 h-2" />
                  <Skeleton variant="rect" className="h-4 w-14 rounded-full" />
                  <Skeleton variant="text" className="h-2.5 w-16" />
                  <div className="ml-auto">
                    <Skeleton variant="text" className="h-2.5 w-10" />
                  </div>
                </div>
                <Skeleton variant="text" className="h-3.5 w-3/4" />
                <Skeleton variant="text" className="h-2.5 w-full" />
              </div>
            ))}
          </div>
        </div>
        {/* Detail skeleton */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Skeleton variant="circle" className="w-12 h-12 mx-auto" />
            <Skeleton variant="text" className="h-3.5 w-36 mx-auto" />
            <Skeleton variant="text" className="h-2.5 w-48 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationCenter({ isLoading = false }: { isLoading?: boolean }) {
  const [notifs, setNotifs] = useState<Notification[]>(makeNotifs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>("all");
  const [filterRead, setFilterRead] = useState<FilterRead>("all");
  const [filterCategory, setFilterCategory] = useState<NotifCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(loadSettings);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Real-time connection status
  const handleNewNotif = useCallback(
    (ev: Omit<Notification, "id" | "timestamp" | "read">) => {
      setNotifs((prev) => [
        {
          ...ev,
          id: `live-${Date.now()}`,
          timestamp: new Date(),
          read: false,
        },
        ...prev,
      ]);
    },
    []
  );
  const connectionStatus = useNotificationStream(handleNewNotif);

  // Save settings when changed
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Mark all read on first open
  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (!hasOpenedRef.current && settings.markAllReadOnOpen) {
      hasOpenedRef.current = true;
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }, [settings.markAllReadOnOpen]);

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

  const expandGroup = useCallback((agentName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(agentName)) {
        next.delete(agentName);
      } else {
        next.add(agentName);
      }
      return next;
    });
  }, []);

  // Filter + sort (pinned first, then by timestamp desc) + apply settings
  const filtered = useMemo(() => {
    return notifs
      .filter((n) => {
        // Settings-based filtering
        if (!settings.categories[n.category]) {return false;}
        if (n.severity !== "critical" && !settings.severities[n.severity]) {return false;}

        // UI filters
        if (filterSeverity !== "all" && n.severity !== filterSeverity) {return false;}
        if (filterRead === "unread" && n.read) {return false;}
        if (filterRead === "read" && !n.read) {return false;}
        if (filterCategory !== "all" && n.category !== filterCategory) {return false;}
        if (search) {
          const q = search.toLowerCase();
          if (
            !n.title.toLowerCase().includes(q) &&
            !n.body.toLowerCase().includes(q) &&
            !(n.agentName?.toLowerCase().includes(q))
          )
            {return false;}
        }
        return true;
      })
      .toSorted((a, b) => {
        if (a.pinned && !b.pinned) {return -1;}
        if (!a.pinned && b.pinned) {return 1;}
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
  }, [notifs, settings, filterSeverity, filterRead, filterCategory, search]);

  // Group notifications (3+ from same agent within 5 minutes)
  const listable = useMemo((): ListableNotification[] => {
    const FIVE_MINUTES = 5 * 60 * 1000;
    const groups: Map<string, Notification[]> = new Map();
    const result: ListableNotification[] = [];
    const used = new Set<string>();

    // Group by agentName within 5 minutes
    filtered.forEach((n) => {
      if (!n.agentName) {return;}
      const group = groups.get(n.agentName) || [];
      // Check if within 5 minutes of first item in group
      if (group.length === 0 || Math.abs(n.timestamp.getTime() - group[0].timestamp.getTime()) <= FIVE_MINUTES) {
        group.push(n);
        groups.set(n.agentName, group);
      }
    });

    // Build list with groups
    filtered.forEach((n) => {
      if (used.has(n.id)) {return;}

      if (n.agentName) {
        const group = groups.get(n.agentName);
        if (group && group.length >= 3 && group.includes(n)) {
          // Add as group
          result.push({
            isGroup: true,
            agentName: n.agentName,
            agentEmoji: n.agentEmoji,
            count: group.length,
            notifications: group.toSorted((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
            latestTimestamp: group[0].timestamp,
          });
          group.forEach((g) => used.add(g.id));
          return;
        }
      }

      result.push(n);
      used.add(n.id);
    });

    return result;
  }, [filtered, expandedGroups]);

  const unreadCount = notifs.filter((n) => !n.read).length;
  const selected = notifs.find((n) => n.id === selectedId) ?? null;
  const connConfig = CONNECTION_CONFIG[connectionStatus];

  // Keyboard navigation for notification list
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;
      if (isInput || settingsOpen) {return;}

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, listable.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = listable[focusedIndex];
        if (item && !isGrouped(item)) {
          setSelectedId(item.id);
          if (!item.read) {markRead(item.id);}
        }
      } else if (e.key === "m") {
        e.preventDefault();
        const item = listable[focusedIndex];
        if (item && !isGrouped(item)) {
          markRead(item.id);
        }
      } else if (e.key === "d") {
        e.preventDefault();
        const item = listable[focusedIndex];
        if (item && !isGrouped(item)) {
          dismiss(item.id);
          // Adjust focus
          setFocusedIndex((i) => Math.min(i, listable.length - 2));
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [listable, focusedIndex, settingsOpen, markRead, dismiss]);

  // Scroll focused item into view
  useEffect(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      const item = items[focusedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [focusedIndex]);

  const SEVERITY_FILTERS: { value: FilterSeverity; label: string; color: string }[] = [
    { value: "all",      label: "All",      color: "text-fg-secondary" },
    { value: "critical", label: "Critical", color: "text-red-400"   },
    { value: "warning",  label: "Warning",  color: "text-amber-400" },
    { value: "success",  label: "Success",  color: "text-emerald-400" },
    { value: "info",     label: "Info",     color: "text-blue-400"  },
  ];

  if (isLoading) return <NotificationCenterSkeleton />;

  return (
    <div className="flex flex-col h-full bg-surface-0 text-fg-primary">
      {/* ── Top Bar ── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-tok-border flex-shrink-0 gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-fg-primary">Notification Center</h1>
          {unreadCount > 0 && (
            <span className="text-xs bg-violet-600 text-fg-primary rounded-full px-2 py-0.5 font-bold" aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          )}
          {/* Connection status indicator */}
          <div
            className="flex items-center gap-1.5 cursor-help"
            title={connConfig.label}
            aria-label={connConfig.label}
          >
            <span className={cn("w-2 h-2 rounded-full", connConfig.dot)} aria-hidden />
            <span className="text-xs text-fg-muted">{connConfig.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-fg-secondary hover:text-fg-primary px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={() => setNotifs((prev) => prev.filter((n) => n.pinned || !n.read))}
            className="text-xs text-fg-secondary hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            Clear read
          </button>
          {/* Settings button */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg text-fg-secondary hover:text-fg-primary hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            aria-label="Open notification settings"
            title="Notification settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* ── Stats row ── */}
      <div className="flex gap-4 px-6 py-3 border-b border-tok-border flex-shrink-0 overflow-x-auto">
        {(["critical", "warning", "success", "info"] as NotifSeverity[]).map((sev) => {
          const count = notifs.filter((n) => n.severity === sev).length;
          const cfg = SEVERITY_CONFIG[sev];
          return (
            <div key={sev} className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} aria-hidden />
              <span className="text-xs font-semibold text-fg-secondary">{count}</span>
              <span className="text-xs text-fg-muted">{cfg.label}</span>
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-fg-muted">Total:</span>
          <span className="text-xs font-semibold text-fg-secondary">{notifs.length}</span>
        </div>
      </div>

      {/* ── Body: List + Detail ── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Left pane: filters + list */}
        <div className="md:w-96 flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-tok-border overflow-hidden">
          {/* Search */}
          <div className="px-3 pt-3 pb-2 border-b border-tok-border/60 flex-shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted text-sm select-none" aria-hidden>
                🔍
              </span>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications… (⌘F)"
                className="w-full bg-surface-2 border border-tok-border rounded-lg pl-9 pr-3 py-2 text-sm text-fg-primary placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-violet-500"
                aria-label="Search notifications"
              />
            </div>
          </div>

          {/* Severity filter chips */}
          <div className="flex gap-1 px-3 py-2 border-b border-tok-border/60 overflow-x-auto flex-shrink-0">
            {SEVERITY_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilterSeverity(f.value)}
                className={cn(
                  "flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                  filterSeverity === f.value
                    ? "bg-violet-600 text-fg-primary"
                    : "bg-surface-2 text-fg-secondary hover:bg-surface-3"
                )}
                aria-pressed={filterSeverity === f.value}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Read / Category filters */}
          <div className="flex gap-2 px-3 py-2 border-b border-tok-border/60 overflow-x-auto flex-shrink-0">
            {(["all", "unread", "read"] as FilterRead[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilterRead(v)}
                className={cn(
                  "flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 capitalize",
                  filterRead === v ? "bg-surface-3 text-fg-primary" : "bg-surface-2 text-fg-secondary hover:bg-surface-3"
                )}
                aria-pressed={filterRead === v}
              >
                {v}
              </button>
            ))}
            <div className="w-px bg-surface-3 mx-1 flex-shrink-0" aria-hidden />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as NotifCategory | "all")}
              className="flex-shrink-0 text-xs bg-surface-2 text-fg-secondary border border-tok-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {(Object.keys(CATEGORY_CONFIG) as NotifCategory[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_CONFIG[c].icon} {CATEGORY_CONFIG[c].label}</option>
              ))}
            </select>
          </div>

          {/* Notification list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto"
            role="listbox"
            aria-label="Notifications"
            tabIndex={-1}
          >
            {listable.length === 0 ? (
              <ContextualEmptyState
                icon={BellOff}
                title="All caught up"
                description="No notifications match your current filters."
                size="sm"
              />
            ) : (
              listable.map((n, idx) => (
                <NotifCard
                  key={isGrouped(n) ? `group-${n.agentName}` : n.id}
                  notif={n}
                  selected={!isGrouped(n) && n.id === selectedId}
                  focused={idx === focusedIndex}
                  onSelect={() => {
                    if (!isGrouped(n)) {
                      setSelectedId(n.id);
                      setFocusedIndex(idx);
                    }
                  }}
                  onRead={markRead}
                  onDismiss={dismiss}
                  onPin={pin}
                  onExpandGroup={expandGroup}
                  expandedGroups={expandedGroups}
                />
              ))
            )}
          </div>

          {/* Keyboard nav hint */}
          <div className="px-3 py-2 border-t border-tok-border/60 text-[10px] text-fg-muted flex gap-3 flex-shrink-0">
            <span>↑↓ navigate</span>
            <span>m mark read</span>
            <span>d dismiss</span>
            <span>↵ open</span>
          </div>
        </div>

        {/* Right pane: detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <DetailPanel notif={selected} onRead={markRead} onDismiss={dismiss} onPin={pin} />
        </div>
      </div>

      {/* Settings Drawer */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={setSettings}
      />
    </div>
  );
}
