"use client";

import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { cn } from "@/lib/utils/cn";
import {
  RefreshCw,
  Search,
  Filter,
  ArrowDown,
  Pause,
  Play,
  Trash2,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug,
  WifiOff,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  details?: string;
};

const LEVEL_CONFIG: Record<
  LogLevel,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    badge: string;
  }
> = {
  debug: { icon: Bug, color: "text-muted-foreground", badge: "outline" },
  info: { icon: Info, color: "text-primary", badge: "default" },
  warn: { icon: AlertTriangle, color: "text-warning", badge: "warning" },
  error: { icon: AlertCircle, color: "text-destructive", badge: "destructive" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LogsPage() {
  const { connected, addEventListener } = useGatewayStore();
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [filter, setFilter] = React.useState("");
  const [levelFilter, setLevelFilter] = React.useState<LogLevel | "all">("all");
  const [paused, setPaused] = React.useState(false);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const logId = React.useRef(0);

  // Subscribe to gateway log events
  React.useEffect(() => {
    if (!connected) {return;}
    const unsub = addEventListener("log", (payload: unknown) => {
      if (paused) {return;}
      const entry = payload as Partial<LogEntry>;
      const log: LogEntry = {
        id: `log-${++logId.current}`,
        timestamp: entry.timestamp ?? Date.now(),
        level: entry.level ?? "info",
        source: entry.source ?? "gateway",
        message: entry.message ?? "",
        details: entry.details,
      };
      setLogs((prev) => [...prev.slice(-499), log]); // Keep last 500
    });
    return unsub;
  }, [connected, addEventListener, paused]);

  // Auto-scroll
  React.useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== "all" && log.level !== levelFilter) {return false;}
      if (filter) {
        const q = filter.toLowerCase();
        return (
          log.message.toLowerCase().includes(q) ||
          log.source.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, filter, levelFilter]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-3 p-6 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AdaptiveLabel
              beginner="Activity"
              standard="Logs"
              expert="System Logs"
            />
          </h1>
          <p className="text-sm text-muted-foreground">
            <AdaptiveLabel
              beginner="See what's happening behind the scenes."
              standard="Real-time gateway log stream."
              expert="Live log tail with level filtering."
            />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? "success" : "destructive"} className="text-[10px]">
            {connected ? "Live" : "Disconnected"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {logs.length} entries
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 pb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter logs..."
            className="pl-9 h-8 text-xs"
          />
        </div>

        <ComplexityGate level="standard">
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            {(["all", "debug", "info", "warn", "error"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                  levelFilter === level
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {level === "all" ? "All" : level.toUpperCase()}
              </button>
            ))}
          </div>
        </ComplexityGate>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setPaused(!paused)}
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setAutoScroll(!autoScroll)}
          title={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
          className={cn(autoScroll && "text-primary")}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setLogs([])}
          title="Clear logs"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Connection warning */}
      {!connected && (
        <div className="mx-6 mb-3 flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/5 px-3 py-2">
          <WifiOff className="h-4 w-4 text-warning" />
          <p className="text-xs text-warning">
            Not connected to Gateway. Log stream paused.
          </p>
        </div>
      )}

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto mx-6 mb-6 rounded-lg border bg-card font-mono text-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-3">
              <Info className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground font-sans">
              {logs.length === 0
                ? "No log entries yet. Logs will appear here in real time."
                : "No logs match your filter."}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {filteredLogs.map((log) => {
                const config = LEVEL_CONFIG[log.level];
                const Icon = config.icon;
                return (
                  <tr
                    key={log.id}
                    className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                  >
                    <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap w-24 align-top">
                      {formatTime(log.timestamp)}
                    </td>
                    <td className="px-2 py-1.5 w-6 align-top">
                      <Icon className={cn("h-3.5 w-3.5", config.color)} />
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap w-24 align-top">
                      {log.source}
                    </td>
                    <td className="px-3 py-1.5 text-foreground break-all">
                      {log.message}
                      {log.details && (
                        <span className="block text-muted-foreground mt-0.5">
                          {log.details}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer status */}
      <ComplexityGate level="expert">
        <div className="px-6 py-2 border-t text-[10px] text-muted-foreground flex items-center justify-between">
          <span>
            {filteredLogs.length} / {logs.length} entries
            {paused && " · PAUSED"}
          </span>
          <span>
            Auto-scroll: {autoScroll ? "ON" : "OFF"} ·
            Buffer: 500 max
          </span>
        </div>
      </ComplexityGate>
    </div>
  );
}
