import * as React from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScrollText,
  Search,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Download,
  ChevronDown,
  AlertTriangle,
  Info,
  Bug,
  AlertCircle,
  Terminal,
} from "lucide-react";

export const Route = createFileRoute("/logs/")({
  component: LogsPage,
});

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  subsystem?: string;
  details?: Record<string, unknown>;
}

const levelConfig: Record<LogLevel, { color: string; bg: string; icon: React.ElementType }> = {
  trace: { color: "text-muted-foreground", bg: "bg-muted/30", icon: Terminal },
  debug: { color: "text-muted-foreground", bg: "bg-muted/50", icon: Bug },
  info: { color: "text-blue-500", bg: "bg-blue-500/5", icon: Info },
  warn: { color: "text-yellow-500", bg: "bg-yellow-500/5", icon: AlertTriangle },
  error: { color: "text-destructive", bg: "bg-destructive/5", icon: AlertCircle },
  fatal: { color: "text-destructive", bg: "bg-destructive/10", icon: AlertCircle },
};

// Generate sample log entries for UI development
function generateSampleLogs(): LogEntry[] {
  const now = Date.now();
  const subsystems = ["gateway", "sessions", "agents", "channels", "security", "skills", "cron"];
  const entries: LogEntry[] = [];
  const messages = [
    { level: "info" as LogLevel, msg: "Gateway started on port 8080" },
    { level: "debug" as LogLevel, msg: "Session compaction triggered for agent:merlin:main" },
    { level: "info" as LogLevel, msg: "Agent 'xavier' session resumed" },
    { level: "warn" as LogLevel, msg: "Rate limit approaching for anthropic provider (85%)" },
    { level: "error" as LogLevel, msg: "Failed to connect to Discord gateway: ECONNREFUSED" },
    { level: "info" as LogLevel, msg: "Skill 'web-search' reloaded successfully" },
    { level: "debug" as LogLevel, msg: "Heartbeat sent to 12 agents" },
    { level: "info" as LogLevel, msg: "Cron job 'daily-backup' completed in 3.2s" },
    { level: "warn" as LogLevel, msg: "Memory file exceeds 50KB, consider archiving" },
    { level: "trace" as LogLevel, msg: "HTTP GET /api/v1/agents → 200 (12ms)" },
    { level: "info" as LogLevel, msg: "New session created: agent:luis:cron:abc123" },
    { level: "error" as LogLevel, msg: "Tool execution failed: browser.navigate timeout after 30s" },
    { level: "debug" as LogLevel, msg: "TanStack query cache invalidated for ['agents']" },
    { level: "info" as LogLevel, msg: "Channel 'slack' reconnected after 2s downtime" },
    { level: "fatal" as LogLevel, msg: "Unrecoverable error in session manager — restarting" },
  ];

  for (let i = 0; i < 50; i++) {
    const template = messages[i % messages.length];
    entries.push({
      id: `log-${i}`,
      timestamp: new Date(now - i * 15000).toISOString(),
      level: template.level,
      message: template.msg,
      subsystem: subsystems[Math.floor(Math.random() * subsystems.length)],
    });
  }

  return entries;
}

function LogsPage() {
  const powerUserMode = useUIStore((s) => s.powerUserMode);
  const [logs] = React.useState<LogEntry[]>(generateSampleLogs);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [levelFilter, setLevelFilter] = React.useState<LogLevel | "all">("all");
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [paused, setPaused] = React.useState(false);
  const [expandedLog, setExpandedLog] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  if (!powerUserMode) {
    return <Navigate to="/" />;
  }

  // Filter logs
  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== "all" && log.level !== levelFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          log.message.toLowerCase().includes(query) ||
          log.subsystem?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [logs, searchQuery, levelFilter]);

  // Level counts
  const levelCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: logs.length };
    for (const log of logs) {
      counts[log.level] = (counts[log.level] || 0) + 1;
    }
    return counts;
  }, [logs]);

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  const handleExport = () => {
    const content = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.subsystem ? `[${l.subsystem}] ` : ""}${l.message}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openclaw-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <ScrollText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
              <p className="text-muted-foreground">
                Gateway log stream — {filteredLogs.length} entries
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={paused ? "default" : "outline"}
              size="sm"
              onClick={() => setPaused(!paused)}
              className="gap-2"
            >
              {paused ? (
                <>
                  <Play className="h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 font-mono text-sm"
          />
        </div>
        <Select
          value={levelFilter}
          onValueChange={(v) => setLevelFilter(v as LogLevel | "all")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels ({levelCounts.all})</SelectItem>
            <SelectItem value="trace">Trace ({levelCounts.trace || 0})</SelectItem>
            <SelectItem value="debug">Debug ({levelCounts.debug || 0})</SelectItem>
            <SelectItem value="info">Info ({levelCounts.info || 0})</SelectItem>
            <SelectItem value="warn">Warn ({levelCounts.warn || 0})</SelectItem>
            <SelectItem value="error">Error ({levelCounts.error || 0})</SelectItem>
            <SelectItem value="fatal">Fatal ({levelCounts.fatal || 0})</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="auto-scroll"
            checked={autoScroll}
            onCheckedChange={setAutoScroll}
          />
          <label htmlFor="auto-scroll" className="text-sm text-muted-foreground cursor-pointer">
            Auto-scroll
          </label>
        </div>
      </motion.div>

      {/* Log Stream */}
      <Card className="overflow-hidden">
        <CardHeader className="py-2 px-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full",
                paused ? "bg-yellow-500" : "bg-green-500 animate-pulse"
              )} />
              {paused ? "Paused" : "Live"}
            </CardTitle>
            <div className="flex items-center gap-1">
              {(["error", "warn", "info"] as const).map((level) => (
                <Badge
                  key={level}
                  variant="secondary"
                  className={cn("text-xs cursor-pointer", levelConfig[level].color)}
                  onClick={() => setLevelFilter(levelFilter === level ? "all" : level)}
                >
                  {levelCounts[level] || 0} {level}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px]" ref={scrollRef}>
            <div className="font-mono text-xs">
              {filteredLogs.map((log) => {
                const config = levelConfig[log.level];
                const Icon = config.icon;
                const isExpanded = expandedLog === log.id;

                return (
                  <div
                    key={log.id}
                    className={cn(
                      "flex items-start gap-2 px-4 py-1.5 border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors",
                      config.bg
                    )}
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  >
                    <span className="text-muted-foreground whitespace-nowrap shrink-0 tabular-nums">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px] px-1.5 py-0 shrink-0 uppercase font-bold", config.color)}
                    >
                      {log.level.slice(0, 3)}
                    </Badge>
                    {log.subsystem && (
                      <span className="text-primary/70 shrink-0">
                        [{log.subsystem}]
                      </span>
                    )}
                    <span className={cn("flex-1 break-all", log.level === "error" || log.level === "fatal" ? "text-destructive" : "text-foreground")}>
                      {log.message}
                    </span>
                    {log.details && (
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
}
