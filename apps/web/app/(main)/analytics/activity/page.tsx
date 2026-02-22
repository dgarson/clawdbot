"use client";

import * as React from "react";
import Link from "next/link";
import { useGatewayStore } from "@/lib/stores/gateway";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SessionsUsageResult } from "@/lib/gateway/types";
import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Terminal,
  XCircle,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

const EVENT_TYPE_LABELS: Record<ActivityType, string> = {
  message_sent: "Sent",
  message_received: "Received",
  tool_call: "Tool Call",
  tool_result: "Tool Result",
  session_start: "Session Start",
  session_end: "Session End",
  error: "Error",
  sub_agent_spawn: "Sub-agent",
  file_write: "File Write",
  web_search: "Web Search",
  approval_pending: "Approval",
  approval_resolved: "Approved",
};

const MAX_EVENTS = 100;
const POLL_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ms: number): string {
  const date = new Date(ms);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return (
    date.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) {return "just now";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ---------------------------------------------------------------------------
// Activity icon
// ---------------------------------------------------------------------------

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
      return status === "error" ? (
        <XCircle className={`${iconClass} text-red-500`} />
      ) : (
        <CheckCircle2 className={`${iconClass} text-emerald-500`} />
      );
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

// ---------------------------------------------------------------------------
// Event mapper (gateway event → activity event)
// ---------------------------------------------------------------------------

function mapGatewayEvent(
  evt: { event?: string; payload?: Record<string, unknown> },
  filterAgentId?: string,
): ActivityEvent | null {
  const event = evt.event;
  const payload = evt.payload ?? {};

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
      return null; // Skip streaming deltas
    case "chat.final":
      return {
        ...base,
        type: "message_received",
        summary: "Agent responded",
        detail:
          typeof payload.content === "string" ? payload.content.slice(0, 120) : undefined,
        status: "success",
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
        summary: `Approval needed: ${typeof payload.tool === "string" ? payload.tool : "exec"}`,
        detail: payload.command as string | undefined,
        status: "pending",
      };
    case "exec.resolved":
      return {
        ...base,
        type: "approval_resolved",
        summary: "Approval resolved",
        status: "success",
      };
    case "session.start":
      return {
        ...base,
        type: "session_start",
        summary: "Session started",
        detail: payload.label as string | undefined,
      };
    case "session.end":
      return { ...base, type: "session_end", summary: "Session ended" };
    case "tool.call":
      return {
        ...base,
        type: "tool_call",
        summary: `Tool: ${typeof payload.name === "string" ? payload.name : typeof payload.tool === "string" ? payload.tool : "unknown"}`,
        detail: payload.input
          ? JSON.stringify(payload.input).slice(0, 120)
          : undefined,
      };
    case "tool.result":
      return {
        ...base,
        type: "tool_result",
        summary: `Tool result: ${typeof payload.name === "string" ? payload.name : "unknown"}`,
        status: payload.error ? "error" : "success",
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Activity row
// ---------------------------------------------------------------------------

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="group flex items-start gap-3 py-2.5 px-4 hover:bg-accent/30 transition-colors border-b last:border-0">
      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <ActivityIcon type={event.type} status={event.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{event.summary}</span>
          {event.status === "error" && (
            <Badge
              variant="outline"
              className="text-[9px] bg-red-500/10 text-red-600 border-red-500/20"
            >
              error
            </Badge>
          )}
          {event.status === "pending" && (
            <Badge
              variant="outline"
              className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20"
            >
              pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{event.agentId}</span>
          {event.sessionKey && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
              · {event.sessionKey}
            </span>
          )}
        </div>
        {event.detail && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-mono">
            {event.detail}
          </p>
        )}
      </div>
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ActivityDashboardPage() {
  const { connected, addEventListener, request } = useGatewayStore();

  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [stats, setStats] = React.useState<{
    activeSessions: number;
    toolCallsToday: number;
    messagesToday: number;
    errorsToday: number;
  }>({ activeSessions: 0, toolCallsToday: 0, messagesToday: 0, errorsToday: 0 });
  const [agentFilter] = React.useState<string | null>(null);
  const [typeFilters, setTypeFilters] = React.useState<Set<ActivityType>>(new Set());
  const [isLive, setIsLive] = React.useState(true);

  // Listen for real-time gateway events
  React.useEffect(() => {
    if (!connected || !isLive) {return;}

    const unsub = addEventListener("*", (payload: unknown) => {
      const evt = payload as { event?: string; payload?: Record<string, unknown> };
      if (!evt.event) {return;}

      const activity = mapGatewayEvent(evt, agentFilter ?? undefined);
      if (activity) {
        setEvents((prev) => [activity, ...prev].slice(0, MAX_EVENTS));
      }
    });

    return unsub;
  }, [connected, addEventListener, agentFilter, isLive]);

  // Poll usage stats periodically
  const fetchStats = React.useCallback(async () => {
    if (!connected) {return;}
    try {
      const today = new Date().toISOString().split("T")[0];
      const result = await request<SessionsUsageResult>("sessions.usage", {
        startDate: today,
        endDate: today,
        limit: 200,
      });
      if (result.aggregates) {
        setStats({
          activeSessions: result.sessions.length,
          toolCallsToday: result.aggregates.tools.totalCalls,
          messagesToday: result.aggregates.messages.total,
          errorsToday: result.aggregates.messages.errors,
        });
      }
    } catch {
      // Silently fail — stats are supplementary
    }
  }, [connected, request]);

  React.useEffect(() => {
    void fetchStats();
    const id = setInterval(() => void fetchStats(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStats]);

  // Toggle type filter
  const toggleTypeFilter = (type: ActivityType) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {next.delete(type);}
      else {next.add(type);}
      return next;
    });
  };

  // Filtered events
  const filteredEvents = React.useMemo(() => {
    if (typeFilters.size === 0) {return events;}
    return events.filter((e) => typeFilters.has(e.type));
  }, [events, typeFilters]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/analytics">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Analytics
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Live Activity</h1>
          <p className="text-sm text-muted-foreground">
            Real-time gateway events and agent activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-600 font-medium">Live</span>
            </div>
          )}
          <Button
            variant={isLive ? "default" : "outline"}
            size="sm"
            onClick={() => setIsLive(!isLive)}
          >
            {isLive ? "Pause" : "Resume"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEvents([])}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.activeSessions}</p>
              <p className="text-xs text-muted-foreground">Active Sessions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Terminal className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.toolCallsToday}</p>
              <p className="text-xs text-muted-foreground">Tool Calls Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.messagesToday}</p>
              <p className="text-xs text-muted-foreground">Messages Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-500/10 p-2">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.errorsToday}</p>
              <p className="text-xs text-muted-foreground">Errors Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(EVENT_TYPE_LABELS) as ActivityType[]).map((type) => (
          <Button
            key={type}
            variant={typeFilters.has(type) ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => toggleTypeFilter(type)}
          >
            {EVENT_TYPE_LABELS[type]}
          </Button>
        ))}
        {typeFilters.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setTypeFilters(new Set())}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Event feed */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Events ({filteredEvents.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchStats}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh Stats
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Activity className="h-8 w-8 text-muted-foreground mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">No events yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isLive
                  ? "Events will appear here in real-time as agents work"
                  : "Resume live feed to capture new events"}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-500px)]">
              <div>
                {filteredEvents.map((event) => (
                  <ActivityRow key={event.id} event={event} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
