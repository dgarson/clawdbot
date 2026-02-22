import React, { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "../lib/utils";

type LogLevel = "debug" | "info" | "warn" | "error" | "trace";
type LogSource = "system" | "agent" | "llm" | "tool" | "webhook" | "cron";

interface LogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  source: LogSource;
  agent?: string;
  message: string;
  meta?: Record<string, string | number | boolean>;
}

const LEVEL_STYLES: Record<LogLevel, string> = {
  trace: "text-zinc-600",
  debug: "text-zinc-500",
  info: "text-sky-400",
  warn: "text-amber-400",
  error: "text-rose-400",
};

const LEVEL_BG: Record<LogLevel, string> = {
  trace: "bg-zinc-800 text-zinc-500",
  debug: "bg-zinc-800 text-zinc-400",
  info: "bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20",
  warn: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  error: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
};

const SOURCE_COLORS: Record<LogSource, string> = {
  system: "text-zinc-500",
  agent: "text-indigo-400",
  llm: "text-violet-400",
  tool: "text-emerald-400",
  webhook: "text-sky-400",
  cron: "text-amber-400",
};

const SEED_LOGS: LogEntry[] = [
  { id: "l-001", ts: "02:09:42.881", level: "info", source: "system", message: "OpenClaw gateway started on :8080", meta: { pid: 4821, version: "1.14.2" } },
  { id: "l-002", ts: "02:09:43.012", level: "info", source: "cron", message: "Cron scheduler initialized, 12 jobs registered" },
  { id: "l-003", ts: "02:09:43.204", level: "debug", source: "system", message: "Loading agent manifests from workspace/", meta: { count: 18 } },
  { id: "l-004", ts: "02:09:44.110", level: "info", source: "agent", agent: "Luis", message: "Session started — cron:e61f3c46 heartbeat triggered" },
  { id: "l-005", ts: "02:09:44.291", level: "debug", source: "llm", agent: "Luis", message: "LLM request queued: claude-sonnet-4-6 (1841 tokens)" },
  { id: "l-006", ts: "02:09:46.403", level: "info", source: "llm", agent: "Luis", message: "LLM response received: 642 tokens in 2112ms" },
  { id: "l-007", ts: "02:09:46.780", level: "debug", source: "tool", agent: "Luis", message: "tool:read executing — path=CONTEXT.md" },
  { id: "l-008", ts: "02:09:46.824", level: "debug", source: "tool", agent: "Luis", message: "tool:read complete — 4218 bytes in 44ms" },
  { id: "l-009", ts: "02:09:47.100", level: "info", source: "agent", agent: "Piper", message: "Sub-agent spawned — label=horizon-api-playground model=MiniMax-M2.5" },
  { id: "l-010", ts: "02:09:47.200", level: "info", source: "agent", agent: "Reed", message: "Sub-agent spawned — label=horizon-workspace-settings model=gemini-3-flash-preview" },
  { id: "l-011", ts: "02:09:48.001", level: "warn", source: "webhook", message: "Webhook delivery slow — endpoint=https://hooks.slack.com latency=1840ms" },
  { id: "l-012", ts: "02:09:48.500", level: "debug", source: "llm", agent: "Luis", message: "LLM request queued: claude-sonnet-4-6 (3820 tokens) — code generation" },
  { id: "l-013", ts: "02:09:50.100", level: "warn", source: "system", message: "Memory usage high: 84% of 8GB", meta: { used_mb: 6912, total_mb: 8192 } },
  { id: "l-014", ts: "02:09:52.301", level: "info", source: "llm", agent: "Luis", message: "LLM response received: 2041 tokens in 3801ms" },
  { id: "l-015", ts: "02:09:52.388", level: "debug", source: "tool", agent: "Luis", message: "tool:write executing — path=AgentWorkload.tsx size=19824" },
  { id: "l-016", ts: "02:09:52.476", level: "debug", source: "tool", agent: "Luis", message: "tool:write complete — 88ms" },
  { id: "l-017", ts: "02:10:08.312", level: "info", source: "agent", agent: "Reed", message: "Sub-agent complete — WorkspaceSettings.tsx written (19389 bytes)" },
  { id: "l-018", ts: "02:10:40.860", level: "info", source: "agent", agent: "Piper", message: "Sub-agent complete — ApiPlayground.tsx written (18383 bytes)" },
  { id: "l-019", ts: "02:10:41.100", level: "debug", source: "tool", agent: "Luis", message: "tool:exec executing — cmd='pnpm build'" },
  { id: "l-020", ts: "02:10:42.740", level: "info", source: "tool", agent: "Luis", message: "Build succeeded in 1.64s — 63 chunks, 0 errors" },
  { id: "l-021", ts: "02:10:42.810", level: "debug", source: "tool", agent: "Luis", message: "tool:exec executing — cmd='git commit'" },
  { id: "l-022", ts: "02:10:43.230", level: "info", source: "tool", agent: "Luis", message: "git commit 81a5453 — 103 files changed" },
  { id: "l-023", ts: "02:10:50.001", level: "error", source: "webhook", message: "Webhook delivery failed — endpoint=https://api.external.com/hook status=503 after 3 retries" },
  { id: "l-024", ts: "02:10:50.100", level: "error", source: "system", message: "Circuit breaker OPEN for api.external.com — 5 failures in 60s" },
  { id: "l-025", ts: "02:11:00.000", level: "info", source: "cron", message: "Cron job triggered: daily-digest — agent=Stephan" },
  { id: "l-026", ts: "02:11:00.200", level: "info", source: "agent", agent: "Stephan", message: "Session started — cron daily-digest" },
  { id: "l-027", ts: "02:11:00.400", level: "debug", source: "llm", agent: "Stephan", message: "LLM request queued: gpt-4o (2200 tokens)" },
  { id: "l-028", ts: "02:11:07.900", level: "error", source: "llm", agent: "Stephan", message: "LLM timeout after 7.5s — gpt-4o rate limit", meta: { status: 429, retry_after: 60 } },
  { id: "l-029", ts: "02:11:08.000", level: "error", source: "agent", agent: "Stephan", message: "Session failed — unhandled LLM timeout exception" },
  { id: "l-030", ts: "02:12:01.000", level: "info", source: "agent", agent: "Wes", message: "Sub-agent spawned — label=horizon-cost-optimizer model=MiniMax-M2.5" },
  { id: "l-031", ts: "02:12:01.100", level: "info", source: "agent", agent: "Quinn", message: "Sub-agent spawned — label=horizon-plugin-manager model=gemini-3-flash-preview" },
  { id: "l-032", ts: "02:12:05.200", level: "trace", source: "system", message: "GC cycle: minor collection 14ms — freed 124MB" },
  { id: "l-033", ts: "02:12:10.800", level: "info", source: "agent", agent: "Luis", message: "AgentTracer.tsx written — 21612 bytes" },
  { id: "l-034", ts: "02:12:11.000", level: "info", source: "agent", agent: "Luis", message: "DataPipelineViewer.tsx written — 21415 bytes" },
  { id: "l-035", ts: "02:12:12.000", level: "info", source: "tool", agent: "Luis", message: "Build succeeded in 1.61s — 65 chunks, 0 errors" },
];

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-400/30 text-amber-200 rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function LogViewer() {
  const [levelFilters, setLevelFilters] = useState<Set<LogLevel>>(new Set(["debug", "info", "warn", "error", "trace"]));
  const [sourceFilter, setSourceFilter] = useState<LogSource | "all">("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tail, setTail] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const agents = useMemo(() => {
    const s = new Set<string>();
    SEED_LOGS.forEach((l) => { if (l.agent) s.add(l.agent); });
    return Array.from(s).sort();
  }, []);

  const filtered = useMemo(() => {
    return SEED_LOGS.filter((log) => {
      if (!levelFilters.has(log.level)) return false;
      if (sourceFilter !== "all" && log.source !== sourceFilter) return false;
      if (agentFilter !== "all" && log.agent !== agentFilter) return false;
      if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [levelFilters, sourceFilter, agentFilter, search]);

  useEffect(() => {
    if (tail && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [filtered, tail]);

  const selectedLog = SEED_LOGS.find((l) => l.id === selectedId) ?? null;

  function toggleLevel(level: LogLevel) {
    setLevelFilters((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  const LEVEL_ORDER: LogLevel[] = ["trace", "debug", "info", "warn", "error"];

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden font-mono text-xs">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-zinc-800 px-4 py-2 flex items-center gap-3 flex-wrap">
        <span className="text-zinc-400 font-sans text-sm font-semibold not-italic">Log Viewer</span>

        {/* Level toggles */}
        <div className="flex gap-1">
          {LEVEL_ORDER.map((level) => (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                LEVEL_BG[level],
                !levelFilters.has(level) && "opacity-30"
              )}
              aria-pressed={levelFilters.has(level)}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as LogSource | "all")}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          aria-label="Filter by source"
        >
          <option value="all">all sources</option>
          {(["system", "agent", "llm", "tool", "webhook", "cron"] as LogSource[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Agent filter */}
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          aria-label="Filter by agent"
        >
          <option value="all">all agents</option>
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Search */}
        <input
          type="search"
          placeholder="search messages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-32 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono placeholder-zinc-600"
          aria-label="Search log messages"
        />

        {/* Stats */}
        <span className="text-zinc-600 shrink-0">
          {filtered.length} / {SEED_LOGS.length} lines
        </span>

        {/* Tail toggle */}
        <button
          onClick={() => setTail((t) => !t)}
          aria-pressed={tail}
          className={cn(
            "px-2 py-0.5 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 font-sans",
            tail ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
          )}
        >
          {tail ? "↓ tailing" : "tail off"}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Log stream */}
        <div
          className="flex-1 overflow-y-auto"
          role="log"
          aria-live="polite"
          aria-label="Log output"
        >
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-600 font-sans">
              No logs match current filters
            </div>
          ) : (
            filtered.map((log) => (
              <button
                key={log.id}
                onClick={() => setSelectedId(log.id === selectedId ? null : log.id)}
                className={cn(
                  "w-full text-left flex items-start gap-2 px-3 py-0.5 hover:bg-zinc-800/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-indigo-500",
                  log.id === selectedId && "bg-zinc-800/60",
                  log.level === "error" && "border-l-2 border-rose-500",
                  log.level === "warn" && "border-l-2 border-amber-500"
                )}
              >
                {/* timestamp */}
                <span className="shrink-0 text-zinc-600 w-24">{log.ts}</span>
                {/* level */}
                <span className={cn("shrink-0 w-9 uppercase font-bold", LEVEL_STYLES[log.level])}>
                  {log.level === "debug" ? "DBG" : log.level === "trace" ? "TRC" : log.level.toUpperCase()}
                </span>
                {/* source */}
                <span className={cn("shrink-0 w-14", SOURCE_COLORS[log.source])}>{log.source}</span>
                {/* agent */}
                <span className="shrink-0 w-16 text-indigo-300/70 truncate">{log.agent ?? ""}</span>
                {/* message */}
                <span className="text-zinc-300 break-all">
                  {highlight(log.message, search)}
                </span>
              </button>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Detail panel */}
        {selectedLog && (
          <aside className="w-72 shrink-0 border-l border-zinc-800 overflow-y-auto font-sans">
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <span className={cn("text-xs px-2 py-0.5 rounded font-medium", LEVEL_BG[selectedLog.level])}>
                  {selectedLog.level.toUpperCase()}
                </span>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-zinc-500 hover:text-zinc-300 text-lg leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                  aria-label="Close detail panel"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wide">Message</div>
                <p className="text-xs text-zinc-200 break-words font-mono">{selectedLog.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-zinc-600 mb-0.5">Timestamp</div>
                  <div className="text-xs text-zinc-300 font-mono">{selectedLog.ts}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600 mb-0.5">Source</div>
                  <div className={cn("text-xs font-medium", SOURCE_COLORS[selectedLog.source])}>{selectedLog.source}</div>
                </div>
                {selectedLog.agent && (
                  <div>
                    <div className="text-xs text-zinc-600 mb-0.5">Agent</div>
                    <div className="text-xs text-indigo-400">{selectedLog.agent}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-zinc-600 mb-0.5">ID</div>
                  <div className="text-xs text-zinc-500 font-mono">{selectedLog.id}</div>
                </div>
              </div>

              {selectedLog.meta && Object.keys(selectedLog.meta).length > 0 && (
                <div>
                  <div className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Metadata</div>
                  <div className="bg-zinc-900 rounded border border-zinc-800 p-3 space-y-1">
                    {Object.entries(selectedLog.meta).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs gap-2">
                        <span className="text-zinc-500">{k}</span>
                        <span className="text-zinc-300 font-mono">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Status bar */}
      <div className="shrink-0 border-t border-zinc-800 px-4 py-1 flex items-center gap-4 text-xs text-zinc-600 font-sans">
        <span>
          {SEED_LOGS.filter((l) => l.level === "error").length} errors ·{" "}
          {SEED_LOGS.filter((l) => l.level === "warn").length} warnings
        </span>
        <span className="ml-auto">35 total entries · live simulation</span>
      </div>
    </div>
  );
}
