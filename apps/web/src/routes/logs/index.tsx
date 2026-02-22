
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  Download,
  Pause,
  Play,
  ArrowDown,
  Search,
  X,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/PageHeader";
import { useOptionalGateway } from "@/providers/GatewayProvider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/logs/")({
  component: LogsPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

interface LogEntry {
  raw: string;
  time?: string | null;
  level?: LogLevel | null;
  subsystem?: string | null;
  message: string;
  meta?: Record<string, unknown>;
}

interface LogsTailResponse {
  file?: string;
  cursor?: number;
  size?: number;
  lines?: string[];
  truncated?: boolean;
  reset?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LOG_LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];
const LOG_BUFFER_LIMIT = 2000;
const POLL_INTERVAL_MS = 3000;
const MAX_BYTES = 512 * 1024;
const FETCH_LIMIT = 500;

const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: "text-zinc-400 bg-zinc-400/10",
  debug: "text-blue-400 bg-blue-400/10",
  info: "text-emerald-400 bg-emerald-400/10",
  warn: "text-amber-400 bg-amber-400/10",
  error: "text-red-400 bg-red-400/10",
  fatal: "text-red-600 bg-red-600/15 font-bold",
};

const LEVEL_SET = new Set<LogLevel>(LOG_LEVELS);

// ─── Parsing ─────────────────────────────────────────────────────────────────

function normalizeLevel(value: unknown): LogLevel | null {
  if (typeof value !== "string") {return null;}
  const lowered = value.toLowerCase() as LogLevel;
  return LEVEL_SET.has(lowered) ? lowered : null;
}

function parseMaybeJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") {return null;}
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {return null;}
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseLogLine(line: string): LogEntry {
  if (!line.trim()) {return { raw: line, message: line };}
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    const meta =
      obj._meta && typeof obj._meta === "object"
        ? (obj._meta as Record<string, unknown>)
        : null;

    const time =
      typeof obj.time === "string"
        ? obj.time
        : typeof meta?.date === "string"
          ? (meta.date as string)
          : null;

    const level = normalizeLevel(meta?.logLevelName ?? meta?.level);

    // Extract subsystem
    const contextCandidate =
      typeof obj["0"] === "string"
        ? (obj["0"] as string)
        : typeof meta?.name === "string"
          ? (meta.name as string)
          : null;
    const contextObj = parseMaybeJson(contextCandidate);
    let subsystem: string | null = null;
    if (contextObj) {
      subsystem =
        typeof contextObj.subsystem === "string"
          ? contextObj.subsystem
          : typeof contextObj.module === "string"
            ? contextObj.module
            : null;
    }
    if (!subsystem && contextCandidate && contextCandidate.length < 120) {
      subsystem = contextCandidate;
    }

    // Extract message
    let message: string | null = null;
    if (typeof obj["1"] === "string") {
      message = obj["1"] as string;
    } else if (!contextObj && typeof obj["0"] === "string") {
      message = obj["0"] as string;
    } else if (typeof obj.message === "string") {
      message = obj.message as string;
    }

    return { raw: line, time, level, subsystem, message: message ?? line, meta: meta ?? undefined };
  } catch {
    return { raw: line, message: line };
  }
}

function formatTime(value?: string | null) {
  if (!value) {return "";}
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {return value;}
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

function LogsPage() {
  const gateway = useOptionalGateway();
  const client = gateway?.isConnected ? gateway.client : null;

  // State
  const [entries, setEntries] = React.useState<LogEntry[]>([]);
  const [cursor, setCursor] = React.useState<number | null>(null);
  const [logFile, setLogFile] = React.useState<string | null>(null);
  const [truncated, setTruncated] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filterText, setFilterText] = React.useState("");
  const [levelFilters, setLevelFilters] = React.useState<Record<LogLevel, boolean>>(
    () => Object.fromEntries(LOG_LEVELS.map((l) => [l, true])) as Record<LogLevel, boolean>
  );
  const [autoFollow, setAutoFollow] = React.useState(true);
  const [paused, setPaused] = React.useState(false);

  const streamRef = React.useRef<HTMLDivElement>(null);
  const cursorRef = React.useRef(cursor);
  cursorRef.current = cursor;

  // Fetch logs
  const fetchLogs = React.useCallback(
    async (reset = false) => {
      if (!client) {return;}
      setLoading(true);
      setError(null);
      try {
        const res = (await client.request("logs.tail", {
          cursor: reset ? undefined : (cursorRef.current ?? undefined),
          limit: FETCH_LIMIT,
          maxBytes: MAX_BYTES,
        })) as LogsTailResponse;

        const lines = Array.isArray(res.lines)
          ? res.lines.filter((l): l is string => typeof l === "string")
          : [];
        const parsed = lines.map(parseLogLine);
        const shouldReset = reset || res.reset || cursorRef.current == null;

        setEntries((prev) =>
          shouldReset ? parsed : [...prev, ...parsed].slice(-LOG_BUFFER_LIMIT)
        );
        if (typeof res.cursor === "number") {setCursor(res.cursor);}
        if (typeof res.file === "string") {setLogFile(res.file);}
        setTruncated(Boolean(res.truncated));
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  // Initial load
  React.useEffect(() => {
    if (client) {
      void fetchLogs(true);
    }
  }, [client, fetchLogs]);

  // Polling
  React.useEffect(() => {
    if (!client || paused) {return;}
    const interval = setInterval(() => {
      void fetchLogs(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [client, paused, fetchLogs]);

  // Auto-scroll
  React.useEffect(() => {
    if (autoFollow && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [entries, autoFollow]);

  // Handle scroll — disable auto-follow when user scrolls up
  const handleScroll = React.useCallback(() => {
    if (!streamRef.current) {return;}
    const el = streamRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (!atBottom && autoFollow) {setAutoFollow(false);}
  }, [autoFollow]);

  const scrollToBottom = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
      setAutoFollow(true);
    }
  }, []);

  // Filter entries
  const needle = filterText.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    if (entry.level && !levelFilters[entry.level]) {return false;}
    if (!needle) {return true;}
    const haystack = [entry.message, entry.subsystem, entry.raw]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  // Level toggle
  const toggleLevel = (level: LogLevel) => {
    setLevelFilters((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  // Export
  const handleExport = () => {
    const blob = new Blob(
      [filtered.map((e) => e.raw).join("\n")],
      { type: "application/x-ndjson" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openclaw-logs-${new Date().toISOString().slice(0, 19)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Level counts
  const levelCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      if (entry.level) {counts[entry.level] = (counts[entry.level] ?? 0) + 1;}
    }
    return counts;
  }, [entries]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs"
        description="Real-time gateway log stream"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaused((p) => !p)}
              className="gap-2"
            >
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs(true)}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="gap-2"
            >
              <Download className="size-4" />
              Export
            </Button>
          </div>
        }
      />

      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter logs..."
            className="pl-9 pr-9"
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Level chips */}
        <div className="flex flex-wrap gap-1.5">
          {LOG_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                "border border-transparent",
                levelFilters[level]
                  ? LEVEL_COLORS[level]
                  : "text-muted-foreground bg-muted/30 line-through"
              )}
            >
              <span className="uppercase">{level}</span>
              {levelCounts[level] ? (
                <span className="text-[10px] opacity-70">
                  {levelCounts[level]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {logFile && (
          <span className="flex items-center gap-1.5">
            <FileText className="size-3" />
            <span className="font-mono">{logFile}</span>
          </span>
        )}
        <Separator orientation="vertical" className="h-3" />
        <span>{entries.length.toLocaleString()} entries</span>
        {needle || LOG_LEVELS.some((l) => !levelFilters[l]) ? (
          <>
            <Separator orientation="vertical" className="h-3" />
            <span>{filtered.length.toLocaleString()} shown</span>
          </>
        ) : null}
        {truncated && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <span className="text-amber-500 flex items-center gap-1">
              <AlertTriangle className="size-3" />
              Truncated
            </span>
          </>
        )}
        <div className="flex-1" />
        {!autoFollow && (
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollToBottom}
            className="gap-1.5 text-xs h-7"
          >
            <ArrowDown className="size-3" />
            Jump to bottom
          </Button>
        )}
        <Badge
          variant={paused ? "destructive" : "default"}
          className="text-[10px] px-1.5 py-0"
        >
          {paused ? "PAUSED" : autoFollow ? "LIVE" : "SCROLLED"}
        </Badge>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="py-3 text-sm text-destructive">
                {error}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not connected state */}
      {!client && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 size-8 opacity-40" />
            <p>Connect to the gateway to view logs</p>
          </CardContent>
        </Card>
      )}

      {/* Log stream */}
      {client && (
        <div
          ref={streamRef}
          onScroll={handleScroll}
          className={cn(
            "h-[calc(100vh-22rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-zinc-950",
            "font-mono text-[13px] leading-relaxed scrollbar-thin"
          )}
        >
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {entries.length === 0
                ? loading
                  ? "Loading logs..."
                  : "No log entries yet"
                : "No entries match current filters"}
            </div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {filtered.map((entry, i) => (
                  <tr
                    key={`${entry.time ?? ""}-${i}`}
                    className={cn(
                      "group border-b border-zinc-800/50 hover:bg-zinc-900/60 transition-colors",
                      entry.level === "error" && "bg-red-950/20",
                      entry.level === "fatal" && "bg-red-950/40",
                      entry.level === "warn" && "bg-amber-950/10"
                    )}
                  >
                    <td className="px-3 py-1 text-zinc-500 whitespace-nowrap align-top w-[90px]">
                      {formatTime(entry.time)}
                    </td>
                    <td className="px-2 py-1 align-top w-[56px]">
                      {entry.level && (
                        <span
                          className={cn(
                            "inline-block rounded px-1.5 py-0.5 text-[11px] uppercase font-medium",
                            LEVEL_COLORS[entry.level]
                          )}
                        >
                          {entry.level.slice(0, 3)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-violet-400/70 whitespace-nowrap align-top w-[140px] truncate max-w-[140px]">
                      {entry.subsystem}
                    </td>
                    <td className="px-2 py-1 text-zinc-200 break-all">
                      {entry.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
