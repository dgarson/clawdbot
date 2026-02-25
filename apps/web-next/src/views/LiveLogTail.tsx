import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";
import {
  Pause,
  Play,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowDownToLine,
  WrapText,
  Filter,
  X,
  Radio,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
type LogSource = "system" | "agent" | "llm" | "tool" | "webhook" | "cron";
type StreamTab = "all" | "agent" | "llm" | "tool" | "system" | "webhook";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: LogSource;
  agentName?: string;
  agentEmoji?: string;
  message: string;
  metadata: Record<string, string>;
}

interface LiveLogTailProps {
  defaultStream?: string;
  agentFilter?: string;
}

// ---------------------------------------------------------------------------
// Constants & style maps
// ---------------------------------------------------------------------------

const LEVEL_BADGE: Record<LogLevel, string> = {
  TRACE: "bg-[var(--color-surface-3)]/40 text-[var(--color-text-muted)]",
  DEBUG: "bg-[var(--color-surface-3)]/30 text-[var(--color-text-secondary)]",
  INFO: "bg-sky-500/10 text-sky-400",
  WARN: "bg-amber-500/10 text-amber-400",
  ERROR: "bg-rose-500/10 text-rose-400",
  FATAL: "bg-red-600/20 text-red-400 font-bold",
};

const LEVEL_ROW_BG: Record<LogLevel, string> = {
  TRACE: "",
  DEBUG: "",
  INFO: "",
  WARN: "bg-amber-500/[0.02]",
  ERROR: "bg-rose-500/[0.03]",
  FATAL: "bg-red-500/[0.05] border-l-2 border-red-500",
};

const SOURCE_BADGE: Record<LogSource, string> = {
  system: "bg-[var(--color-surface-3)]/30 text-[var(--color-text-secondary)]",
  agent: "bg-primary/10 text-primary",
  llm: "bg-primary/10 text-primary",
  tool: "bg-emerald-500/10 text-emerald-400",
  webhook: "bg-sky-500/10 text-sky-400",
  cron: "bg-amber-500/10 text-amber-400",
};

const STREAM_TABS: { id: StreamTab; label: string; emoji: string }[] = [
  { id: "all", label: "All Logs", emoji: "+" },
  { id: "agent", label: "Agent Activity", emoji: "A" },
  { id: "llm", label: "LLM Calls", emoji: "L" },
  { id: "tool", label: "Tool Execution", emoji: "T" },
  { id: "system", label: "System", emoji: "S" },
  { id: "webhook", label: "Webhooks", emoji: "W" },
];

const STREAM_SOURCE_MAP: Record<StreamTab, LogSource[]> = {
  all: ["system", "agent", "llm", "tool", "webhook", "cron"],
  agent: ["agent"],
  llm: ["llm"],
  tool: ["tool"],
  system: ["system", "cron"],
  webhook: ["webhook"],
};

const ALL_LEVELS: LogLevel[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

const MAX_BUFFER = 500;
const MAX_VISIBLE = 200;

// ---------------------------------------------------------------------------
// Mock agent roster
// ---------------------------------------------------------------------------

const AGENTS = [
  { name: "Luis", emoji: "\u{1F9D1}\u200D\u{1F4BB}" },
  { name: "Xavier", emoji: "\u{1F50D}" },
  { name: "Stephan", emoji: "\u{1F4CB}" },
  { name: "Sam", emoji: "\u26A1" },
  { name: "Tim", emoji: "\u{1F527}" },
  { name: "Quinn", emoji: "\u{1F4DA}" },
  { name: "Wes", emoji: "\u{1F4CA}" },
  { name: "Piper", emoji: "\u{1F3AF}" },
  { name: "Reed", emoji: "\u{1F6E1}\uFE0F" },
];

const MODELS = ["claude-sonnet-4-6", "claude-sonnet-4-6", "gpt-4o", "gemini-2.5-flash", "claude-sonnet-4-6"];

const TOOL_NAMES = ["read", "write", "exec", "browser", "search", "list_files"];

const FILE_PATHS = [
  "src/views/Dashboard.tsx",
  "CONTEXT.md",
  "apps/api/src/routes/agents.ts",
  "packages/core/src/llm/client.ts",
  "config/horizon.yaml",
  ".env.production",
  "src/lib/utils.ts",
  "tests/agent.test.ts",
  "README.md",
  "packages/memory/src/vector-store.ts",
];

// ---------------------------------------------------------------------------
// Mock log generator
// ---------------------------------------------------------------------------

let logIdCounter = 0;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateLogEntry(): LogEntry {
  logIdCounter++;
  const id = `log-${logIdCounter}`;
  const timestamp = new Date();

  // Weighted random: most logs are INFO, some DEBUG/TRACE, fewer WARN/ERROR, rare FATAL
  const roll = Math.random();
  let level: LogLevel;
  if (roll < 0.08) level = "TRACE";
  else if (roll < 0.22) level = "DEBUG";
  else if (roll < 0.65) level = "INFO";
  else if (roll < 0.82) level = "WARN";
  else if (roll < 0.96) level = "ERROR";
  else level = "FATAL";

  // Pick a source type weighted toward agent/llm/tool
  const sourceRoll = Math.random();
  let source: LogSource;
  if (sourceRoll < 0.18) source = "system";
  else if (sourceRoll < 0.38) source = "agent";
  else if (sourceRoll < 0.58) source = "llm";
  else if (sourceRoll < 0.78) source = "tool";
  else if (sourceRoll < 0.90) source = "webhook";
  else source = "cron";

  const agent = pick(AGENTS);
  let message = "";
  const metadata: Record<string, string> = {};

  // Generate realistic messages per source type
  switch (source) {
    case "llm": {
      const model = pick(MODELS);
      const inputTokens = randInt(200, 8000);
      const outputTokens = randInt(50, 4000);
      const latency = randInt(180, 12000);
      metadata.model = model;
      metadata.input_tokens = String(inputTokens);
      metadata.output_tokens = String(outputTokens);
      metadata.latency_ms = String(latency);
      metadata.stream = Math.random() > 0.3 ? "true" : "false";

      if (level === "ERROR" || level === "FATAL") {
        const errors = [
          `API request to ${model} failed: 429 Too Many Requests (rate limit)`,
          `${model} response timeout after ${latency}ms`,
          `${model} returned invalid JSON in structured output`,
          `Token budget exceeded: ${inputTokens + outputTokens} > 8192 max`,
        ];
        message = pick(errors);
        metadata.error_code = pick(["429", "504", "500", "422"]);
      } else if (level === "WARN") {
        const warns = [
          `${model} response slow: ${latency}ms (threshold: 5000ms)`,
          `High token usage: ${inputTokens + outputTokens} tokens for single turn`,
          `${model} response truncated at max_tokens=${outputTokens}`,
          `Fallback model activated: ${model} -> claude-sonnet-4-6`,
        ];
        message = pick(warns);
      } else {
        const msgs = [
          `${model} completion: ${inputTokens} in / ${outputTokens} out (${latency}ms)`,
          `Streaming response from ${model}: ${outputTokens} tokens generated`,
          `${model} planning step complete: ${outputTokens} tokens (${latency}ms)`,
          `Code generation via ${model}: ${outputTokens} tokens output`,
        ];
        message = pick(msgs);
      }
      break;
    }

    case "tool": {
      const toolName = pick(TOOL_NAMES);
      const filePath = pick(FILE_PATHS);
      const duration = randInt(8, 3500);
      metadata.tool = toolName;
      metadata.duration_ms = String(duration);

      if (toolName === "read" || toolName === "write" || toolName === "list_files") {
        metadata.path = filePath;
        metadata.bytes = String(randInt(128, 65536));
      }
      if (toolName === "exec") {
        const cmds = ["pnpm build", "pnpm test", "git status", "git diff", "git commit", "pnpm lint"];
        metadata.command = pick(cmds);
      }
      if (toolName === "browser") {
        metadata.url = pick(["https://api.github.com/repos/...", "https://docs.anthropic.com/...", "http://localhost:3000/api/health"]);
      }

      if (level === "ERROR" || level === "FATAL") {
        const errors = [
          `Tool ${toolName} failed: ENOENT ${filePath}`,
          `Tool ${toolName} timed out after ${duration}ms`,
          `Tool exec failed: exit code 1 (pnpm build)`,
          `Tool browser error: net::ERR_CONNECTION_REFUSED`,
          `Permission denied: ${filePath}`,
        ];
        message = pick(errors);
        metadata.exit_code = "1";
      } else if (level === "WARN") {
        message = pick([
          `Tool ${toolName} slow execution: ${duration}ms`,
          `Tool ${toolName}: large file warning (${metadata.bytes || "N/A"} bytes)`,
          `Tool exec: non-zero exit code 2 for lint`,
        ]);
      } else {
        const msgs = [
          `Tool ${toolName}: ${filePath} (${duration}ms)`,
          `Tool ${toolName} completed: ${metadata.bytes || duration}${metadata.bytes ? " bytes" : "ms"}`,
          `${toolName}(${filePath.split("/").pop()}) -> OK (${duration}ms)`,
        ];
        message = pick(msgs);
      }
      break;
    }

    case "agent": {
      if (level === "ERROR" || level === "FATAL") {
        const errors = [
          `Agent ${agent.name} session crashed: unhandled promise rejection`,
          `Agent ${agent.name} exceeded max turns (50), session terminated`,
          `Agent ${agent.name} context window overflow: 200k tokens`,
          `Sub-agent spawn failed: ${pick(AGENTS).name} (pool exhausted)`,
        ];
        message = pick(errors);
        metadata.session_id = `sess_${randInt(1000, 9999)}`;
        metadata.turns = String(randInt(1, 50));
      } else if (level === "WARN") {
        message = pick([
          `Agent ${agent.name} approaching context limit: 180k/200k tokens`,
          `Agent ${agent.name} retry #${randInt(1, 3)} after tool failure`,
          `Sub-agent ${pick(AGENTS).name} running longer than expected (${randInt(30, 120)}s)`,
        ]);
        metadata.session_id = `sess_${randInt(1000, 9999)}`;
      } else {
        const msgs = [
          `Agent ${agent.name} session started (trigger: ${pick(["cron", "webhook", "manual", "sub-agent"])})`,
          `Agent ${agent.name} session complete: ${randInt(3, 25)} turns, ${randInt(1000, 50000)} tokens`,
          `Sub-agent ${pick(AGENTS).name} spawned by ${agent.name}`,
          `Agent ${agent.name} planning step: identified ${randInt(2, 8)} tasks`,
          `Agent ${agent.name} committed: ${randInt(1, 5)} files changed`,
        ];
        message = pick(msgs);
        metadata.session_id = `sess_${randInt(1000, 9999)}`;
        metadata.trigger = pick(["cron", "webhook", "manual", "sub-agent"]);
      }
      break;
    }

    case "system": {
      if (level === "ERROR" || level === "FATAL") {
        message = pick([
          "Gateway health check failed: upstream timeout (5000ms)",
          "Memory pressure critical: 94% heap used, triggering GC",
          "Database connection pool exhausted: 50/50 connections",
          "TLS certificate expires in 24h: *.horizon.internal",
        ]);
      } else if (level === "WARN") {
        message = pick([
          `Memory usage: ${randInt(70, 90)}% of 8GB heap`,
          `Event queue backpressure: ${randInt(500, 2000)} pending events`,
          "Slow downstream: vector-store latency p99 = 340ms",
          `Disk usage warning: /data at ${randInt(80, 95)}%`,
        ]);
      } else {
        message = pick([
          `Memory: ${randInt(40, 65)}% heap, ${randInt(20, 50)}% RSS (${randInt(2, 6)}GB)`,
          `Gateway: ${randInt(100, 500)} req/s, p50=${randInt(10, 80)}ms, p99=${randInt(100, 400)}ms`,
          `Active sessions: ${randInt(2, 12)}, queued: ${randInt(0, 5)}`,
          `Metrics flush: ${randInt(200, 2000)} points written to TSDB`,
          "Config reload: horizon.yaml updated, 0 errors",
          `WebSocket connections: ${randInt(5, 50)} active`,
        ]);
        metadata.uptime = `${randInt(1, 72)}h`;
        metadata.version = "0.14.2";
      }
      break;
    }

    case "cron": {
      const cronJobs = ["daily-digest", "token-audit", "memory-compaction", "metrics-rollup", "backup-snapshot", "cert-renewal-check"];
      const job = pick(cronJobs);
      metadata.job = job;
      metadata.schedule = pick(["*/5 * * * *", "0 * * * *", "0 2 * * *", "0 0 * * 0"]);

      if (level === "ERROR") {
        message = `Cron ${job} failed: ${pick(["timeout after 30s", "exit code 1", "dependency unavailable"])}`;
      } else if (level === "WARN") {
        message = `Cron ${job} running longer than expected: ${randInt(15, 60)}s`;
      } else {
        message = pick([
          `Cron ${job} triggered`,
          `Cron ${job} completed in ${randInt(100, 5000)}ms`,
          `Cron ${job} scheduled: next run in ${randInt(1, 60)}m`,
        ]);
      }
      break;
    }

    case "webhook": {
      const directions = ["inbound", "outbound"] as const;
      const dir = pick([...directions]);
      const services = ["GitHub", "Slack", "Discord", "Linear", "Vercel", "Stripe"];
      const service = pick(services);
      const status = pick([200, 200, 200, 201, 400, 429, 500, 502]);
      metadata.direction = dir;
      metadata.service = service;
      metadata.http_status = String(status);
      metadata.latency_ms = String(randInt(50, 2000));

      if (level === "ERROR" || level === "FATAL") {
        message = pick([
          `Webhook ${dir} ${service}: HTTP ${status} (${pick(["connection refused", "timeout", "invalid signature", "rate limited"])})`,
          `Webhook delivery to ${service} failed after 3 retries`,
          `Webhook ${service} signature verification failed`,
        ]);
      } else if (level === "WARN") {
        message = pick([
          `Webhook ${dir} ${service}: slow response (${metadata.latency_ms}ms)`,
          `Webhook ${service} retry #${randInt(1, 3)}: previous attempt HTTP ${status}`,
        ]);
      } else {
        const events = ["push", "pull_request", "issue_comment", "deployment", "message", "reaction_added"];
        const event = pick(events);
        message = pick([
          `Webhook ${dir} ${service}: ${event} (HTTP ${status}, ${metadata.latency_ms}ms)`,
          `Webhook delivered to ${service}: ${event} event processed`,
          `${dir === "inbound" ? "Received" : "Sent"} webhook: ${service}/${event}`,
        ]);
        metadata.event = event;
      }
      break;
    }
  }

  return {
    id,
    timestamp,
    level,
    source,
    agentName: source === "system" ? undefined : agent.name,
    agentEmoji: source === "system" ? undefined : agent.emoji,
    message,
    metadata,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatTimestamp(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LevelChip({
  level,
  active,
  count,
  onClick,
}: {
  level: LogLevel;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all",
        active ? LEVEL_BADGE[level] : "bg-[var(--color-surface-2)]/50 text-[var(--color-text-muted)] opacity-50"
      )}
    >
      {level}
      <span className="text-[10px] opacity-70">({count})</span>
    </button>
  );
}

function LogRow({
  entry,
  expanded,
  onToggle,
  wrapLines,
  searchQuery,
  isOdd,
}: {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
  wrapLines: boolean;
  searchQuery: string;
  isOdd: boolean;
}) {
  const highlightMatch = useCallback(
    (text: string) => {
      if (!searchQuery) return text;
      const idx = text.toLowerCase().indexOf(searchQuery.toLowerCase());
      if (idx === -1) return text;
      return (
        <>
          {text.slice(0, idx)}
          <span className="bg-amber-500/30 text-amber-200 rounded-sm px-0.5">
            {text.slice(idx, idx + searchQuery.length)}
          </span>
          {text.slice(idx + searchQuery.length)}
        </>
      );
    },
    [searchQuery]
  );

  const hasMetadata = Object.keys(entry.metadata).length > 0;

  return (
    <div className="group">
      <div
        onClick={onToggle}
        className={cn(
          "flex items-start gap-0 px-3 py-[3px] font-mono text-[11px] leading-[18px] cursor-pointer transition-colors",
          LEVEL_ROW_BG[entry.level],
          isOdd && "bg-white/[0.01]",
          "hover:bg-white/[0.04]",
          expanded && "bg-white/[0.03]"
        )}
      >
        {/* Expand indicator */}
        <span className="w-4 shrink-0 pt-[1px] text-[var(--color-text-muted)]">
          {hasMetadata ? (
            expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            )
          ) : null}
        </span>

        {/* Timestamp */}
        <span className="text-[var(--color-text-muted)] w-[88px] shrink-0 select-all tabular-nums">
          {formatTimestamp(entry.timestamp)}
        </span>

        {/* Level badge */}
        <span
          className={cn(
            "w-[42px] shrink-0 text-center rounded px-1 text-[10px] uppercase tracking-wider leading-[18px] mr-1.5",
            LEVEL_BADGE[entry.level]
          )}
        >
          {entry.level === "FATAL" ? "FTL" : entry.level.slice(0, 3)}
        </span>

        {/* Source badge */}
        <span
          className={cn(
            "w-[52px] shrink-0 text-center rounded px-1 text-[10px] leading-[18px] mr-1.5",
            SOURCE_BADGE[entry.source]
          )}
        >
          {entry.source}
        </span>

        {/* Agent name */}
        <span className="w-[72px] shrink-0 truncate text-primary/80 mr-1.5">
          {entry.agentEmoji && (
            <span className="mr-0.5 text-[10px]">{entry.agentEmoji}</span>
          )}
          {entry.agentName || "\u2014"}
        </span>

        {/* Message */}
        <span
          className={cn(
            "flex-1 text-[var(--color-text-primary)]",
            wrapLines ? "break-all whitespace-pre-wrap" : "truncate",
            entry.level === "ERROR" && "text-rose-300/90",
            entry.level === "FATAL" && "text-red-300 font-medium",
            entry.level === "WARN" && "text-amber-200/80"
          )}
        >
          {highlightMatch(entry.message)}
        </span>
      </div>

      {/* Expanded metadata */}
      {expanded && hasMetadata && (
        <div className="px-3 py-2 bg-[var(--color-surface-1)]/60 border-t border-[var(--color-border)]/40 border-b border-b-zinc-800/40 ml-4 mr-2 mb-0.5 rounded-b">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 font-mono text-[11px]">
            {Object.entries(entry.metadata).map(([key, value]) => (
              <React.Fragment key={key}>
                <span className="text-[var(--color-text-muted)]">{key}</span>
                <span className="text-[var(--color-text-primary)] select-all">{value}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LiveLogTail({
  defaultStream,
  agentFilter: initialAgentFilter,
}: LiveLogTailProps) {
  // State
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    // Seed with a few initial entries
    const initial: LogEntry[] = [];
    for (let i = 0; i < 30; i++) {
      initial.push(generateLogEntry());
    }
    return initial;
  });

  const [activeStream, setActiveStream] = useState<StreamTab>(
    (defaultStream as StreamTab) || "all"
  );
  const [paused, setPaused] = useState(false);
  const [enabledLevels, setEnabledLevels] = useState<Set<LogLevel>>(
    new Set(ALL_LEVELS)
  );
  const [selectedAgent, setSelectedAgent] = useState<string>(
    initialAgentFilter || "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [wrapLines, setWrapLines] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<LogEntry[]>([]);
  const userScrolledRef = useRef(false);

  // Buffer logs while paused
  useEffect(() => {
    const interval = setInterval(() => {
      const entry = generateLogEntry();

      if (paused) {
        bufferRef.current.push(entry);
        // Cap buffer too
        if (bufferRef.current.length > MAX_BUFFER) {
          bufferRef.current = bufferRef.current.slice(-MAX_BUFFER);
        }
      } else {
        setLogs((prev) => {
          const next = [...prev, entry];
          return next.length > MAX_BUFFER ? next.slice(-MAX_BUFFER) : next;
        });
      }
    }, randInt(500, 2000));

    // Also add random bursts
    const burstInterval = setInterval(() => {
      if (Math.random() < 0.3 && !paused) {
        const burst: LogEntry[] = [];
        const count = randInt(2, 5);
        for (let i = 0; i < count; i++) {
          burst.push(generateLogEntry());
        }
        setLogs((prev) => {
          const next = [...prev, ...burst];
          return next.length > MAX_BUFFER ? next.slice(-MAX_BUFFER) : next;
        });
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(burstInterval);
    };
  }, [paused]);

  // Flush buffer on resume
  useEffect(() => {
    if (!paused && bufferRef.current.length > 0) {
      setLogs((prev) => {
        const next = [...prev, ...bufferRef.current];
        bufferRef.current = [];
        return next.length > MAX_BUFFER ? next.slice(-MAX_BUFFER) : next;
      });
    }
  }, [paused]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Detect user scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;

    if (!isAtBottom && !userScrolledRef.current) {
      userScrolledRef.current = true;
      setAutoScroll(false);
    } else if (isAtBottom && userScrolledRef.current) {
      userScrolledRef.current = false;
      setAutoScroll(true);
    }
  }, []);

  // Filter logs
  const filteredLogs = useMemo(() => {
    const sourcesForStream = STREAM_SOURCE_MAP[activeStream];
    return logs.filter((log) => {
      if (!sourcesForStream.includes(log.source)) return false;
      if (!enabledLevels.has(log.level)) return false;
      if (selectedAgent !== "all" && log.agentName !== selectedAgent) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesMessage = log.message.toLowerCase().includes(q);
        const matchesMeta = Object.values(log.metadata).some((v) =>
          v.toLowerCase().includes(q)
        );
        const matchesAgent = log.agentName?.toLowerCase().includes(q) || false;
        if (!matchesMessage && !matchesMeta && !matchesAgent) return false;
      }
      return true;
    });
  }, [logs, activeStream, enabledLevels, selectedAgent, searchQuery]);

  // Cap visible entries
  const visibleLogs = useMemo(() => {
    return filteredLogs.length > MAX_VISIBLE
      ? filteredLogs.slice(-MAX_VISIBLE)
      : filteredLogs;
  }, [filteredLogs]);

  // Level counts for chips
  const levelCounts = useMemo(() => {
    const sourcesForStream = STREAM_SOURCE_MAP[activeStream];
    const counts: Record<LogLevel, number> = {
      TRACE: 0,
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      FATAL: 0,
    };
    for (const log of logs) {
      if (sourcesForStream.includes(log.source)) {
        counts[log.level]++;
      }
    }
    return counts;
  }, [logs, activeStream]);

  // Unique agents in current logs
  const activeAgents = useMemo(() => {
    const names = new Set<string>();
    for (const log of logs) {
      if (log.agentName) names.add(log.agentName);
    }
    return Array.from(names).sort();
  }, [logs]);

  // Toggle a level filter
  const toggleLevel = useCallback((level: LogLevel) => {
    setEnabledLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    bufferRef.current = [];
    setExpandedId(null);
  }, []);

  // Re-enable auto-scroll
  const jumpToBottom = useCallback(() => {
    setAutoScroll(true);
    userScrolledRef.current = false;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden">
      {/* ----------------------------------------------------------------- */}
      {/* Header */}
      {/* ----------------------------------------------------------------- */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-[var(--color-text-primary)] tracking-tight">
            Live Log Tail
          </h1>
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium",
              paused
                ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
            )}
          >
            <Radio
              className={cn("w-3 h-3", !paused && "animate-pulse")}
            />
            {paused ? "Paused" : "Streaming"}
            {paused && bufferRef.current.length > 0 && (
              <span className="text-[10px] opacity-70">
                (+{bufferRef.current.length} buffered)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded pl-7 pr-7 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:border-primary w-52 font-mono transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="w-px h-5 bg-[var(--color-surface-2)] mx-1" />

          {/* Pause / Resume */}
          <button
            onClick={() => setPaused(!paused)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors",
              paused
                ? "bg-emerald-600 hover:bg-emerald-500 text-[var(--color-text-primary)]"
                : "bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)]"
            )}
            title={paused ? "Resume stream" : "Pause stream"}
          >
            {paused ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
            {paused ? "Resume" : "Pause"}
          </button>

          {/* Clear */}
          <button
            onClick={clearLogs}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] transition-colors"
            title="Clear all logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors",
              showFilters
                ? "bg-primary text-[var(--color-text-primary)]"
                : "bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)]"
            )}
            title="Toggle filters"
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>

          <div className="w-px h-5 bg-[var(--color-surface-2)] mx-1" />

          {/* Wrap lines */}
          <button
            onClick={() => setWrapLines(!wrapLines)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors",
              wrapLines
                ? "bg-primary/10 text-primary"
                : "bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
            )}
            title="Toggle line wrapping"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          {/* Auto-scroll */}
          <button
            onClick={() => {
              if (autoScroll) {
                setAutoScroll(false);
              } else {
                jumpToBottom();
              }
            }}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors",
              autoScroll
                ? "bg-primary/10 text-primary"
                : "bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
            )}
            title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Stream tabs */}
      {/* ----------------------------------------------------------------- */}
      <div className="shrink-0 flex border-b border-[var(--color-border)] px-4">
        {STREAM_TABS.map((tab) => {
          const count = logs.filter((l) =>
            STREAM_SOURCE_MAP[tab.id].includes(l.source)
          ).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveStream(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors",
                activeStream === tab.id
                  ? "border-primary text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <span
                className={cn(
                  "w-4 h-4 flex items-center justify-center rounded text-[9px] font-bold",
                  activeStream === tab.id
                    ? "bg-primary/20 text-primary"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                )}
              >
                {tab.emoji}
              </span>
              {tab.label}
              <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Filter bar (collapsible) */}
      {/* ----------------------------------------------------------------- */}
      {showFilters && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/30">
          {/* Level filter chips */}
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium mr-1">
            Level
          </span>
          <div className="flex items-center gap-1">
            {ALL_LEVELS.map((level) => (
              <LevelChip
                key={level}
                level={level}
                active={enabledLevels.has(level)}
                count={levelCounts[level]}
                onClick={() => toggleLevel(level)}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-[var(--color-surface-2)]" />

          {/* Agent filter */}
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
            Agent
          </span>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
          >
            <option value="all">All agents</option>
            {activeAgents.map((agent) => (
              <option key={agent} value={agent}>
                {agent}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
            <span className="tabular-nums">
              {filteredLogs.length} / {logs.length} entries
            </span>
            {filteredLogs.length > MAX_VISIBLE && (
              <span className="text-amber-500/70">
                (showing last {MAX_VISIBLE})
              </span>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Column header */}
      {/* ----------------------------------------------------------------- */}
      <div className="shrink-0 flex items-center gap-0 px-3 py-1 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/50 font-mono text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider select-none">
        <span className="w-4 shrink-0" />
        <span className="w-[88px] shrink-0">Time</span>
        <span className="w-[42px] shrink-0 text-center mr-1.5">Level</span>
        <span className="w-[52px] shrink-0 text-center mr-1.5">Source</span>
        <span className="w-[72px] shrink-0 mr-1.5">Agent</span>
        <span className="flex-1">Message</span>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Log entries */}
      {/* ----------------------------------------------------------------- */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
      >
        {visibleLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
            {logs.length === 0
              ? "No log entries yet. Waiting for events..."
              : "No entries match the current filters."}
          </div>
        ) : (
          <div>
            {visibleLogs.map((entry, idx) => (
              <LogRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() =>
                  setExpandedId(expandedId === entry.id ? null : entry.id)
                }
                wrapLines={wrapLines}
                searchQuery={searchQuery}
                isOdd={idx % 2 === 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Footer status bar */}
      {/* ----------------------------------------------------------------- */}
      <div className="shrink-0 flex items-center justify-between px-4 py-1.5 border-t border-[var(--color-border)] bg-[var(--color-surface-1)]/40 text-[10px] text-[var(--color-text-muted)] font-mono">
        <div className="flex items-center gap-4">
          <span>
            Buffer: {logs.length}/{MAX_BUFFER}
          </span>
          <span>
            Visible: {visibleLogs.length}
          </span>
          <span>
            Filtered: {filteredLogs.length}
          </span>
          {!enabledLevels.has("TRACE") || !enabledLevels.has("DEBUG") ? (
            <span className="text-amber-500/60">
              Some levels hidden
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {!autoScroll && (
            <button
              onClick={jumpToBottom}
              className="flex items-center gap-1 text-primary hover:text-indigo-300 transition-colors"
            >
              <ArrowDownToLine className="w-3 h-3" />
              Jump to latest
            </button>
          )}
          <span className="tabular-nums">
            Stream: {activeStream}
          </span>
          <span>
            Auto-scroll: {autoScroll ? "ON" : "OFF"}
          </span>
        </div>
      </div>
    </div>
  );
}
