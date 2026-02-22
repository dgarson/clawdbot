"use client";
import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  MessageSquare,
  Terminal,
  FileText,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  GitBranch,
  Search,
  Send,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────
type ActivityType =
  | "message_sent"
  | "message_received"
  | "tool_call"
  | "tool_result"
  | "session_start"
  | "session_end"
  | "error"
  | "sub_agent_spawn"
  | "file_write"
  | "web_search"
  | "approval_pending"
  | "approval_resolved";

type ActivityEvent = {
  id: string;
  type: ActivityType;
  agentId: string;
  agentEmoji?: string;
  timestamp: number;
  summary: string;
  detail?: string;
  sessionKey?: string;
  status?: "success" | "error" | "pending";
};

// ─── Activity Icon ───────────────────────────────────────
function ActivityIcon({ type, status }: { type: ActivityType; status?: string }) {
  const iconClass = "h-3.5 w-3.5";

  switch (type) {
    case "message_sent":
      return <Send className={`${iconClass} text-primary`} />;
    case "message_received":
      return <MessageSquare className={`${iconClass} text-blue-500`} />;
    case "tool_call":
      return <Terminal className={`${iconClass} text-amber-500`} />;
    case "tool_result":
      return status === "error"
        ? <XCircle className={`${iconClass} text-red-500`} />
        : <CheckCircle2 className={`${iconClass} text-emerald-500`} />;
    case "session_start":
      return <Zap className={`${iconClass} text-primary`} />;
    case "session_end":
      return <Clock className={`${iconClass} text-muted-foreground`} />;
    case "error":
      return <XCircle className={`${iconClass} text-red-500`} />;
    case "sub_agent_spawn":
      return <GitBranch className={`${iconClass} text-violet-500`} />;
    case "file_write":
      return <FileText className={`${iconClass} text-cyan-500`} />;
    case "web_search":
      return <Search className={`${iconClass} text-orange-500`} />;
    case "approval_pending":
      return <Loader2 className={`${iconClass} text-amber-500 animate-spin`} />;
    case "approval_resolved":
      return <CheckCircle2 className={`${iconClass} text-emerald-500`} />;
    default:
      return <Bot className={`${iconClass} text-muted-foreground`} />;
  }
}

// ─── Time Format ─────────────────────────────────────────
function formatTime(ms: number): string {
  const date = new Date(ms);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) {return "just now";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Activity Row ────────────────────────────────────────
function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="group flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center pt-0.5">
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
          <ActivityIcon type={event.type} status={event.status} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium truncate">{event.summary}</span>
          {event.status === "error" && (
            <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-600 border-red-500/20">
              error
            </Badge>
          )}
          {event.status === "pending" && (
            <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">
              pending
            </Badge>
          )}
        </div>
        {event.detail && (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {event.detail}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <div className="shrink-0 text-right">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          {formatTime(event.timestamp)}
        </span>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap group-hover:hidden">
          {relativeTime(event.timestamp)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export function AgentActivityTimeline({
  agentId,
  limit = 20,
  compact = false,
}: {
  agentId?: string;
  limit?: number;
  compact?: boolean;
}) {
  const connected = useGatewayStore((s) => s.connected);
  const addEventListener = useGatewayStore((s) => s.addEventListener);

  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [isLive] = React.useState(true);

  // Listen for real-time events
  React.useEffect(() => {
    if (!connected) {return;}

    const unsub = addEventListener("*", (payload: unknown) => {
      const evt = payload as { event?: string; payload?: Record<string, unknown> };
      if (!evt.event) {return;}

      // Map gateway events to activity events
      const activity = mapGatewayEvent(evt, agentId);
      if (activity) {
        setEvents((prev) => [activity, ...prev].slice(0, limit));
      }
    });

    return unsub;
  }, [connected, addEventListener, agentId, limit]);

  if (events.length === 0) {
    return (
      <div className={`text-center ${compact ? "py-6" : "py-10"} text-muted-foreground`}>
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No recent activity</p>
        <p className="text-xs mt-1">Events will appear here in real-time</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {/* Live indicator */}
      {isLive && (
        <div className="flex items-center gap-2 px-3 py-1.5 mb-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-600 font-medium">Live</span>
        </div>
      )}

      {events.map((event) => (
        <ActivityRow key={event.id} event={event} />
      ))}
    </div>
  );
}

// ─── Event Mapper ────────────────────────────────────────
function mapGatewayEvent(
  evt: { event?: string; payload?: Record<string, unknown> },
  filterAgentId?: string
): ActivityEvent | null {
  const event = evt.event;
  const payload = (evt.payload ?? {});

  // Filter by agent if specified
  if (filterAgentId && payload.agentId && payload.agentId !== filterAgentId) {
    return null;
  }

  const base = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agentId: (payload.agentId as string) || "unknown",
    agentEmoji: payload.agentEmoji as string | undefined,
    timestamp: Date.now(),
    sessionKey: payload.sessionKey as string | undefined,
  };

  switch (event) {
    case "chat.delta":
    case "chat.final":
      return {
        ...base,
        type: "message_received",
        summary: `Agent responded`,
        detail: typeof payload.content === "string"
          ? payload.content.slice(0, 100)
          : undefined,
        status: event === "chat.final" ? "success" : undefined,
      };

    case "chat.error":
      return {
        ...base,
        type: "error",
        summary: "Chat error",
        detail: payload.errorMessage as string | undefined,
        status: "error",
      };

    case "exec.pending":
      return {
        ...base,
        type: "approval_pending",
        summary: `Approval needed: ${String(payload.tool ?? "exec")}`,
        detail: payload.command as string | undefined,
        status: "pending",
      };

    case "exec.resolved":
      return {
        ...base,
        type: "approval_resolved",
        summary: `Approval resolved`,
        status: "success",
      };

    case "session.start":
      return {
        ...base,
        type: "session_start",
        summary: `Session started`,
        detail: payload.label as string | undefined,
      };

    case "session.end":
      return {
        ...base,
        type: "session_end",
        summary: `Session ended`,
      };

    default:
      return null;
  }
}
