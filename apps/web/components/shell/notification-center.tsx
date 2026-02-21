"use client";
import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellDot,
  X,
  Check,
  CheckCheck,
  MessageSquare,
  AlertTriangle,
  Info,
  Zap,
  Bot,
  Clock,
  Trash2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────
type NotificationType = "info" | "warning" | "error" | "success" | "agent" | "system";

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
  agentId?: string;
  agentEmoji?: string;
  actionLabel?: string;
  actionHref?: string;
};

// ─── Notification Icon ───────────────────────────────────
function NotificationIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case "info":
      return <Info className="h-3.5 w-3.5 text-blue-500" />;
    case "warning":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    case "error":
      return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
    case "success":
      return <Check className="h-3.5 w-3.5 text-emerald-500" />;
    case "agent":
      return <Bot className="h-3.5 w-3.5 text-primary" />;
    case "system":
      return <Zap className="h-3.5 w-3.5 text-violet-500" />;
  }
}

// ─── Time Format ─────────────────────────────────────────
function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

// ─── Main Component ──────────────────────────────────────
export function NotificationCenter() {
  const connected = useGatewayStore((s) => s.connected);
  const addEventListener = useGatewayStore((s) => s.addEventListener);

  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [open, setOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Listen for gateway events
  React.useEffect(() => {
    if (!connected) return;

    const unsub = addEventListener("*", (payload: unknown) => {
      const evt = payload as { event?: string; payload?: Record<string, unknown> };
      if (!evt.event) return;

      const notification = mapEventToNotification(evt);
      if (notification) {
        setNotifications((prev) => [notification, ...prev].slice(0, 50));
      }
    });

    return unsub;
  }, [connected, addEventListener]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;

    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) {
            // Auto-mark as read after viewing
            setTimeout(markAllRead, 3000);
          }
        }}
        className="relative"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        {unreadCount > 0 ? (
          <>
            <BellDot className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-primary rounded-full flex items-center justify-center text-[9px] text-primary-foreground font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </>
        ) : (
          <Bell className="h-4 w-4" />
        )}
      </Button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Read all
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No notifications</p>
                <p className="text-xs mt-1">Events will appear here</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-accent/50 transition-colors ${
                    !notification.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => markRead(notification.id)}
                >
                  {/* Icon */}
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    {notification.agentEmoji ? (
                      <span className="text-sm">{notification.agentEmoji}</span>
                    ) : (
                      <NotificationIcon type={notification.type} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-medium truncate ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                        {notification.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {timeAgo(notification.timestamp)}
                      </span>
                    </div>
                    {notification.message && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                    )}
                    {!notification.read && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary absolute right-4 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {/* Dismiss */}
                  <button
                    className="shrink-0 opacity-0 hover:opacity-100 group-hover:opacity-50 p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(notification.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Event → Notification Mapper ─────────────────────────
function mapEventToNotification(
  evt: { event?: string; payload?: Record<string, unknown> }
): Notification | null {
  const payload = (evt.payload ?? {}) as Record<string, unknown>;
  const base = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    read: false,
    agentId: payload.agentId as string | undefined,
    agentEmoji: payload.agentEmoji as string | undefined,
  };

  switch (evt.event) {
    case "chat.error":
      return {
        ...base,
        type: "error",
        title: "Chat Error",
        message: String(payload.errorMessage ?? "An error occurred"),
      };

    case "exec.pending":
      return {
        ...base,
        type: "warning",
        title: "Approval Required",
        message: `Agent requests permission to run: ${String(payload.tool ?? "exec")}`,
      };

    case "session.start":
      return {
        ...base,
        type: "agent",
        title: "Session Started",
        message: payload.label ? String(payload.label) : undefined,
      };

    case "cron.error":
      return {
        ...base,
        type: "error",
        title: "Cron Job Failed",
        message: String(payload.error ?? "Automation error"),
      };

    case "gateway.update":
      return {
        ...base,
        type: "system",
        title: "Update Available",
        message: `Version ${String(payload.version ?? "")} is available`,
      };

    default:
      return null;
  }
}
