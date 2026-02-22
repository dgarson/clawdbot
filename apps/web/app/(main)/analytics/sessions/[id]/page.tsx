"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
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
import type {
  SessionsUsageResult,
  SessionLogEntry,
} from "@/lib/gateway/types";
import {
  ArrowLeft,
  Bot,
  Clock,
  Coins,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Terminal,
  User,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(usd: number): string {
  if (usd >= 1) {return `$${usd.toFixed(2)}`;}
  if (usd >= 0.01) {return `$${usd.toFixed(3)}`;}
  return `$${usd.toFixed(6)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}k`;}
  return n.toString();
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(startMs: number, endMs: number): string {
  const diff = endMs - startMs;
  if (diff < 60_000) {return `${Math.round(diff / 1000)}s`;}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ${Math.floor((diff % 60_000) / 1000)}s`;}
  return `${Math.floor(diff / 3_600_000)}h ${Math.floor((diff % 3_600_000) / 60_000)}m`;
}

// ---------------------------------------------------------------------------
// Event icon
// ---------------------------------------------------------------------------

function EventIcon({ entry }: { entry: SessionLogEntry }) {
  const iconClass = "h-3.5 w-3.5";
  if (entry.error) {return <XCircle className={`${iconClass} text-red-500`} />;}

  switch (entry.role) {
    case "user":
      return <User className={`${iconClass} text-blue-500`} />;
    case "assistant":
      return <Bot className={`${iconClass} text-primary`} />;
    case "tool":
      return <Terminal className={`${iconClass} text-amber-500`} />;
    case "system":
      return <MessageSquare className={`${iconClass} text-muted-foreground`} />;
    default:
      if (entry.type === "tool_call" || entry.toolName) {
        return <Terminal className={`${iconClass} text-amber-500`} />;
      }
      if (entry.type === "model_request") {
        return <Send className={`${iconClass} text-primary`} />;
      }
      return <MessageSquare className={`${iconClass} text-muted-foreground`} />;
  }
}

// ---------------------------------------------------------------------------
// Event row
// ---------------------------------------------------------------------------

function EventRow({ entry, index }: { entry: SessionLogEntry; index: number }) {
  const [expanded, setExpanded] = React.useState(false);
  const content = entry.content ?? "";
  const isLong = content.length > 200;
  const displayContent = expanded ? content : content.slice(0, 200);

  return (
    <div
      className={cn(
        "group flex gap-3 py-3 px-4 hover:bg-accent/30 transition-colors border-b last:border-0",
        entry.error && "bg-red-500/5",
      )}
    >
      {/* Timeline */}
      <div className="flex flex-col items-center pt-1">
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
          <EventIcon entry={entry} />
        </div>
        <div className="flex-1 w-px bg-border mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
          {entry.role && (
            <Badge
              variant={entry.role === "user" ? "default" : "secondary"}
              className="text-[10px] px-1.5 py-0"
            >
              {entry.role}
            </Badge>
          )}
          {entry.type && entry.type !== entry.role && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.type}</Badge>
          )}
          {entry.toolName && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20"
            >
              {entry.toolName}
            </Badge>
          )}
          {entry.model && (
            <span className="text-[10px] text-muted-foreground">
              {entry.provider ? `${entry.provider}/` : ""}{entry.model}
            </span>
          )}
          {entry.error && (
            <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20">
              error
            </Badge>
          )}
          {entry.traceId && (
            <a
              href={`http://localhost:16686/trace/${entry.traceId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-400"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Trace
            </a>
          )}
        </div>

        {content && (
          <div className="text-sm text-foreground/80 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
            {displayContent}
            {isLong && !expanded && "…"}
          </div>
        )}

        {entry.error && <p className="text-xs text-red-500 font-mono">{entry.error}</p>}

        {entry.usage && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {entry.usage.totalTokens !== undefined && (
              <span className="flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5" />
                {formatTokens(entry.usage.totalTokens)}
              </span>
            )}
            {entry.usage.cost !== undefined && entry.usage.cost > 0 && (
              <span className="flex items-center gap-0.5">
                <Coins className="h-2.5 w-2.5" />
                {formatCost(entry.usage.cost)}
              </span>
            )}
          </div>
        )}

        {isLong && (
          <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-primary hover:underline">
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      {/* Timestamp */}
      <div className="shrink-0 text-right">
        {entry.timestamp && (
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {formatTimestamp(entry.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SessionReplayPage() {
  const params = useParams();
  const router = useRouter();
  const { connected, request } = useGatewayStore();

  const sessionKey = typeof params.id === "string" ? decodeURIComponent(params.id) : "";

  const [logs, setLogs] = React.useState<SessionLogEntry[]>([]);
  const [sessionData, setSessionData] = React.useState<SessionsUsageResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!connected || !sessionKey) {return;}
    setLoading(true);
    setError(null);
    try {
      const [logsResult, usageResult] = await Promise.all([
        request<{ logs: SessionLogEntry[] }>("sessions.usage.logs", {
          key: sessionKey,
          limit: 500,
        }).catch(() => ({ logs: [] as SessionLogEntry[] })),
        request<SessionsUsageResult>("sessions.usage", {
          key: sessionKey,
        }).catch(() => null),
      ]);
      setLogs(logsResult.logs);
      setSessionData(usageResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session data");
    } finally {
      setLoading(false);
    }
  }, [connected, request, sessionKey]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const session = sessionData?.sessions?.[0];
  const usage = session?.usage;
  const firstTs = logs.length > 0 && logs[0].timestamp ? logs[0].timestamp : undefined;
  const lastTs = logs.length > 0 && logs[logs.length - 1].timestamp ? logs[logs.length - 1].timestamp : undefined;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/analytics")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Session Replay</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono truncate">{sessionKey}</p>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 w-20 rounded bg-muted mb-2" />
                <div className="h-6 w-16 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : session ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Agent</p>
              <p className="text-sm font-medium truncate">{session.agentId ?? "—"}</p>
              {session.model && <p className="text-xs text-muted-foreground mt-0.5">{session.model}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Tokens</p>
              <p className="text-lg font-bold">{formatTokens(usage?.totalTokens ?? 0)}</p>
              <p className="text-xs text-muted-foreground">
                {formatTokens(usage?.input ?? 0)} in / {formatTokens(usage?.output ?? 0)} out
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Cost</p>
              <p className="text-lg font-bold">{formatCost(usage?.totalCost ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Duration</p>
              <p className="text-lg font-bold">{firstTs && lastTs ? formatDuration(firstTs, lastTs) : "—"}</p>
              <p className="text-xs text-muted-foreground">{logs.length} events</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Message counts */}
      {session?.usage?.messageCounts && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">{session.usage.messageCounts.user} user</Badge>
          <Badge variant="secondary" className="text-xs">{session.usage.messageCounts.assistant} assistant</Badge>
          <Badge variant="secondary" className="text-xs">{session.usage.messageCounts.toolCalls} tool calls</Badge>
          {session.usage.messageCounts.errors > 0 && (
            <Badge variant="destructive" className="text-xs">{session.usage.messageCounts.errors} errors</Badge>
          )}
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Event Timeline
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Clock className="h-8 w-8 text-muted-foreground mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">No events found for this session</p>
              <p className="text-xs text-muted-foreground mt-1">
                Session events are recorded in JSONL transcript files
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-450px)]">
              <div>
                {logs.map((entry, index) => (
                  <EventRow key={`${entry.timestamp}-${index}`} entry={entry} index={index} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
