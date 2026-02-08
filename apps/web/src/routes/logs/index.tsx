import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Search,
  ScrollText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGatewayClient } from "@/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
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
import { RouteErrorFallback } from "@/components/composed";

export const Route = createFileRoute("/logs/")({
  component: LogsPage,
  errorComponent: RouteErrorFallback,
  validateSearch: (
    search: Record<string, unknown>
  ): { agentId?: string; sessionKey?: string; scope?: string } => ({
    agentId: typeof search.agentId === "string" ? search.agentId : undefined,
    sessionKey: typeof search.sessionKey === "string" ? search.sessionKey : undefined,
    scope: typeof search.scope === "string" ? search.scope : undefined,
  }),
});

const logLevels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
type LogLevel = (typeof logLevels)[number];

type LogFilterLevel = LogLevel | "all";

interface LogEntry {
  id: string;
  raw: string;
  message: string;
  level: LogLevel;
  time?: string;
  subsystem?: string;
  meta?: Record<string, unknown>;
}

const LOG_BUFFER_LIMIT = 2000;
const logLevelSet = new Set<LogLevel>(logLevels);

function parseMaybeJsonString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeLevel(value: unknown): LogLevel | null {
  if (typeof value !== "string") {
    return null;
  }
  const lowered = value.toLowerCase() as LogLevel;
  return logLevelSet.has(lowered) ? lowered : null;
}

function parseLogLine(line: string, fallbackId: string): LogEntry {
  if (!line.trim()) {
    return { id: fallbackId, raw: line, message: line, level: "info" };
  }
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    const meta =
      obj && typeof obj._meta === "object" && obj._meta !== null
        ? (obj._meta as Record<string, unknown>)
        : null;
    const time =
      typeof obj.time === "string"
        ? obj.time
        : typeof meta?.date === "string"
          ? meta?.date
          : undefined;
    const level = normalizeLevel(meta?.logLevelName ?? meta?.level) ?? "info";

    const contextCandidate =
      typeof obj["0"] === "string" ? obj["0"] : typeof meta?.name === "string" ? meta?.name : null;
    const contextObj = parseMaybeJsonString(contextCandidate);
    let subsystem: string | undefined;
    if (contextObj) {
      if (typeof contextObj.subsystem === "string") {
        subsystem = contextObj.subsystem;
      } else if (typeof contextObj.module === "string") {
        subsystem = contextObj.module;
      }
    }
    if (!subsystem && contextCandidate && contextCandidate.length < 120) {
      subsystem = contextCandidate;
    }

    let message: string | null = null;
    if (typeof obj["1"] === "string") {
      message = obj["1"];
    } else if (!contextObj && typeof obj["0"] === "string") {
      message = obj["0"];
    } else if (typeof obj.message === "string") {
      message = obj.message;
    }

    return {
      id: fallbackId,
      raw: line,
      time,
      level,
      subsystem,
      message: message ?? line,
      meta: meta ?? undefined,
    };
  } catch {
    return { id: fallbackId, raw: line, message: line, level: "info" };
  }
}

function getLevelColor(level: LogLevel) {
  switch (level) {
    case "trace":
      return "text-muted-foreground";
    case "debug":
      return "text-blue-500";
    case "info":
      return "text-green-500";
    case "warn":
      return "text-yellow-500";
    case "error":
      return "text-red-500";
    case "fatal":
      return "text-red-700 font-semibold";
    default:
      return "text-foreground";
  }
}

function getLevelBadge(level: LogLevel) {
  switch (level) {
    case "trace":
    case "debug":
      return "secondary";
    case "info":
      return "success";
    case "warn":
      return "warning";
    case "error":
    case "fatal":
      return "error";
    default:
      return "secondary";
  }
}

function LogsPage() {
  const client = useGatewayClient();
  const { agentId, sessionKey, scope } = Route.useSearch();
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = React.useState<LogFilterLevel>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [scopeInput, setScopeInput] = React.useState("");
  const [scopeTokens, setScopeTokens] = React.useState<string[]>(() => {
    const tokens = new Set<string>();
    if (agentId) {
      tokens.add(agentId);
      tokens.add(`agent:${agentId}`);
    }
    if (sessionKey) {
      tokens.add(sessionKey);
    }
    if (scope) {
      scope
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .forEach((token) => tokens.add(token));
    }
    return Array.from(tokens);
  });
  const [showScopedOnly, setShowScopedOnly] = React.useState(
    Boolean(agentId || sessionKey || scope)
  );
  const [sortChronologically, setSortChronologically] = React.useState(true);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [logsError, setLogsError] = React.useState<string | null>(null);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [logsCursor, setLogsCursor] = React.useState<number | null>(null);
  const [logsFile, setLogsFile] = React.useState<string | null>(null);
  const [logsTruncated, setLogsTruncated] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const tokens = new Set<string>();
    if (agentId) {
      tokens.add(agentId);
      tokens.add(`agent:${agentId}`);
    }
    if (sessionKey) {
      tokens.add(sessionKey);
    }
    if (scope) {
      scope
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .forEach((token) => tokens.add(token));
    }
    setScopeTokens(Array.from(tokens));
    setShowScopedOnly(Boolean(agentId || sessionKey || scope));
  }, [agentId, sessionKey, scope]);

  const loadLogs = React.useCallback(
    async (opts?: { reset?: boolean; quiet?: boolean }) => {
      if (!client) {
        setLogsError("Gateway is not connected.");
        return;
      }
      if (logsLoading && !opts?.quiet) {
        return;
      }
      if (!opts?.quiet) {
        setLogsLoading(true);
      }
      setLogsError(null);
      try {
        const response = await client.request<{
          file?: string;
          cursor?: number;
          size?: number;
          lines?: unknown;
          truncated?: boolean;
          reset?: boolean;
        }>("logs.tail", {
          cursor: opts?.reset ? undefined : logsCursor ?? undefined,
          limit: 200,
          maxBytes: 250000,
        });
        const lines = Array.isArray(response.lines)
          ? response.lines.filter((line) => typeof line === "string")
          : [];
        const entries = lines.map((line, index) =>
          parseLogLine(line, `log-${response.cursor ?? logsCursor ?? Date.now()}-${index}`)
        );
        const shouldReset = Boolean(opts?.reset || response.reset || logsCursor == null);
        setLogs((prev) =>
          (shouldReset ? entries : [...prev, ...entries]).slice(-LOG_BUFFER_LIMIT)
        );
        if (typeof response.cursor === "number") {
          setLogsCursor(response.cursor);
        }
        if (typeof response.file === "string") {
          setLogsFile(response.file);
        }
        setLogsTruncated(Boolean(response.truncated));
      } catch (err) {
        setLogsError(String(err));
      } finally {
        if (!opts?.quiet) {
          setLogsLoading(false);
        }
      }
    },
    [client, logsCursor, logsLoading]
  );

  React.useEffect(() => {
    void loadLogs({ reset: true });
  }, [loadLogs]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      void loadLogs({ quiet: true });
    }, 2000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  React.useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = React.useMemo(() => {
    const scopeTokensNormalized = scopeTokens.map((token) => token.toLowerCase());
    const queryNormalized = searchQuery.toLowerCase();

    const matchesScope = (log: LogEntry) => {
      if (!showScopedOnly || scopeTokensNormalized.length === 0) {
        return true;
      }
      const candidates = [
        log.raw,
        log.message,
        log.subsystem ?? "",
        JSON.stringify(log.meta ?? {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return scopeTokensNormalized.some((token) => candidates.includes(token));
    };

    const matchesSearch = (log: LogEntry) => {
      if (!queryNormalized) {
        return true;
      }
      const messageMatch = log.message.toLowerCase().includes(queryNormalized);
      const subsystemMatch = log.subsystem?.toLowerCase().includes(queryNormalized);
      const rawMatch = log.raw.toLowerCase().includes(queryNormalized);
      return messageMatch || subsystemMatch || rawMatch;
    };

    const filtered = logs.filter((log) => {
      if (selectedLevel !== "all" && log.level !== selectedLevel) {
        return false;
      }
      if (!matchesScope(log)) {
        return false;
      }
      if (!matchesSearch(log)) {
        return false;
      }
      return true;
    });

    if (!sortChronologically) {
      return filtered;
    }

    return filtered
      .map((log, index) => {
        const timestamp = log.time ? Date.parse(log.time) : Number.NaN;
        return { log, index, timestamp };
      })
      .sort((a, b) => {
        if (!Number.isNaN(a.timestamp) && !Number.isNaN(b.timestamp)) {
          return a.timestamp - b.timestamp;
        }
        if (!Number.isNaN(a.timestamp)) {
          return -1;
        }
        if (!Number.isNaN(b.timestamp)) {
          return 1;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.log);
  }, [logs, searchQuery, selectedLevel, showScopedOnly, scopeTokens, sortChronologically]);

  const handleScopeCommit = (value: string) => {
    const tokens = value
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length === 0) {
      return;
    }
    setScopeTokens((prev) => {
      const next = new Set(prev);
      tokens.forEach((token) => next.add(token));
      return Array.from(next);
    });
    setScopeInput("");
  };

  const handleRemoveScopeToken = (token: string) => {
    setScopeTokens((prev) => prev.filter((item) => item !== token));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <ScrollText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Logs Tail
              </h1>
              <p className="text-muted-foreground">
                Stream gateway logs in real time
              </p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-4">
          {/* Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="pl-10"
                  />
                </div>

                <Select
                  value={selectedLevel}
                  onValueChange={(value) => setSelectedLevel(value as LogFilterLevel)}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Log level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All levels</SelectItem>
                    {logLevels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Switch
                    id="scope-only"
                    checked={showScopedOnly}
                    onCheckedChange={setShowScopedOnly}
                  />
                  <Label htmlFor="scope-only" className="text-sm">
                    Scoped only
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="sort-chronological"
                    checked={sortChronologically}
                    onCheckedChange={setSortChronologically}
                  />
                  <Label htmlFor="sort-chronological" className="text-sm">
                    Sort by time
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-scroll"
                    checked={autoScroll}
                    onCheckedChange={setAutoScroll}
                  />
                  <Label htmlFor="auto-scroll" className="text-sm">
                    Auto-scroll
                  </Label>
                </div>

                <Button
                  variant="outline"
                  onClick={() => loadLogs({ reset: true })}
                  className="gap-2"
                  disabled={logsLoading || !client}
                >
                  <RefreshCw className={cn("h-4 w-4", logsLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Label className="text-xs text-muted-foreground">Scope filters</Label>
                <Input
                  value={scopeInput}
                  onChange={(event) => setScopeInput(event.target.value)}
                  onBlur={(event) => handleScopeCommit(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleScopeCommit(scopeInput);
                    }
                  }}
                  placeholder="Add scope terms (comma-separated)"
                  className="w-full max-w-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {scopeTokens.map((token) => (
                    <Badge key={token} variant="secondary" className="gap-1">
                      {token}
                      <button
                        type="button"
                        onClick={() => handleRemoveScopeToken(token)}
                        className="rounded-full p-0.5 hover:bg-muted"
                        aria-label={`Remove ${token}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              {logsError ? (
                <p className="mt-3 text-sm text-destructive">{logsError}</p>
              ) : null}
            </CardContent>
          </Card>

          {/* Log Entries */}
          <Card>
            <CardHeader>
              <CardTitle>Log Entries</CardTitle>
              <CardDescription>
                Showing {filteredLogs.length} of {logs.length} entries
                {logsFile ? ` • ${logsFile}` : ""}
                {logsTruncated ? " • truncated" : ""}
                {scopeTokens.length > 0 ? ` • scoped: ${scopeTokens.join(", ")}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px]" ref={scrollRef}>
                <div className="selectable-text space-y-1 font-mono text-sm">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-2 rounded p-2 transition-colors hover:bg-muted/50"
                    >
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {log.time ? new Date(log.time).toLocaleTimeString() : "—"}
                      </span>
                      <Badge
                        variant={getLevelBadge(log.level) as "secondary" | "success" | "warning" | "error"}
                        className="text-xs uppercase"
                      >
                        {log.level}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        [{log.subsystem ?? "unknown"}]
                      </span>
                      <span className={cn("flex-1", getLevelColor(log.level))}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
