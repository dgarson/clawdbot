import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
type LevelFilter = "ALL" | LogLevel;

interface LogLine {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  detail?: string;
}

interface Agent {
  id: string;
  name: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
  { id: "agent-luis", name: "luis (primary)" },
  { id: "agent-cron", name: "cron-scheduler" },
  { id: "agent-monitor", name: "monitor-watchdog" },
  { id: "agent-relay", name: "gateway-relay" },
];

const LEVEL_STYLES: Record<LogLevel, string> = {
  DEBUG: "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]",
  INFO:  "bg-blue-900 text-blue-300",
  WARN:  "bg-yellow-900 text-yellow-300",
  ERROR: "bg-red-900 text-red-400",
};

const LEVEL_ROW_HIGHLIGHT: Record<LogLevel, string> = {
  DEBUG: "",
  INFO:  "",
  WARN:  "bg-yellow-950/20",
  ERROR: "bg-red-950/30",
};

// ─── Mock log data ─────────────────────────────────────────────────────────────

function buildMockLogs(): LogLine[] {
  const base = new Date("2026-02-22T13:00:00Z");
  const entries: Array<{ level: LogLevel; message: string; detail?: string }> = [
    { level: "INFO",  message: "Agent session initialised — channel: slack, model: claude-sonnet-4-6" },
    { level: "DEBUG", message: "Loading system prompt from ~/.openclaw/agents/luis/system.md (4 218 bytes)" },
    { level: "INFO",  message: "Gateway connection established on ws://localhost:18789" },
    { level: "DEBUG", message: "Registered tools: read, write, edit, exec, browser, canvas, nodes (7 total)" },
    { level: "INFO",  message: "Waiting for inbound message on channel slack…" },
    { level: "DEBUG", message: "Heartbeat tick #1 — uptime 0s, memory 142 MB" },
    { level: "INFO",  message: "Received message from @peter: 'build the AgentLogStream view'" },
    { level: "DEBUG", message: "Routing decision: tool=sessions_spawn, label=AgentLogStream, model=default" },
    { level: "INFO",  message: "Spawning sub-agent — task AgentLogStream (depth 1/2)" },
    { level: "DEBUG", message: "Sub-agent session key: agent:luis:subagent:55289b5f" },
    { level: "INFO",  message: "Sub-agent acknowledged and running" },
    { level: "WARN",  message: "Tool exec: shell command exceeded 5 000 ms — consider background flag" },
    { level: "DEBUG", message: "Heartbeat tick #2 — uptime 15s, memory 148 MB" },
    { level: "INFO",  message: "Canvas present called — url: about:blank, node: default" },
    { level: "DEBUG", message: "Browser profile resolved: openclaw (isolated)" },
    { level: "INFO",  message: "Sub-agent checkpoint: file written src/views/AgentLogStream.tsx" },
    { level: "DEBUG", message: "TypeScript check invoked: npx tsc --noEmit" },
    { level: "ERROR", message: "tsc: Type 'string | undefined' is not assignable to type 'string'",
      detail: "File: AgentLogStream.tsx:112\nCode: TS2322\nExpected: string\nReceived: string | undefined\nFix: add nullish coalescing or narrowing guard." },
    { level: "DEBUG", message: "Applying fix — adding ?? '' guard to optional field" },
    { level: "INFO",  message: "TypeScript check passed (0 errors)" },
    { level: "DEBUG", message: "ls src/views/AgentLogStream.tsx → 11 852 bytes" },
    { level: "INFO",  message: "Sub-agent completed successfully, announcing to requester" },
    { level: "DEBUG", message: "Heartbeat tick #3 — uptime 42s, memory 151 MB" },
    { level: "INFO",  message: "Outbound reply assembled — 420 chars, channel: slack" },
    { level: "WARN",  message: "Slack rate-limit header: X-RateLimit-Remaining=3, throttling send" },
    { level: "INFO",  message: "Message delivered to @peter — 2026-02-22T13:01:03Z" },
    { level: "DEBUG", message: "Session state persisted to ~/.openclaw/sessions/luis/current.jsonl" },
    { level: "INFO",  message: "Waiting for inbound message on channel slack…" },
    { level: "DEBUG", message: "Heartbeat tick #4 — uptime 60s, memory 149 MB" },
    { level: "WARN",  message: "Gateway WS ping timeout — reconnecting (attempt 1/3)" },
    { level: "INFO",  message: "Gateway reconnected successfully on attempt 1" },
    { level: "DEBUG", message: "Tool budget reset for new turn — max_tokens: 8 192" },
    { level: "INFO",  message: "Received message from @peter: 'show me agent health'" },
    { level: "DEBUG", message: "Routing decision: tool=browser, action=snapshot, profile=chrome" },
    { level: "ERROR", message: "Browser relay: no attached tab found for profile 'chrome'",
      detail: "Profile: chrome\nAction: snapshot\nReason: No tab connected via Browser Relay extension.\nFix: Click the OpenClaw Browser Relay toolbar icon on the target tab to attach it, then retry." },
    { level: "WARN",  message: "Falling back to openclaw profile (isolated browser)" },
    { level: "INFO",  message: "Browser snapshot captured — 3 412 nodes, 1 280×800" },
    { level: "DEBUG", message: "Summarising snapshot for model context (compact mode)" },
    { level: "INFO",  message: "Reply sent: agent health summary delivered to @peter" },
    { level: "DEBUG", message: "Heartbeat tick #5 — uptime 90s, memory 153 MB" },
  ];

  return entries.map((e, i) => ({
    id: i + 1,
    timestamp: new Date(base.getTime() + i * 2_300).toISOString().replace("T", " ").slice(0, 23),
    level: e.level,
    message: e.message,
    detail: e.detail,
  }));
}

const INITIAL_LOGS = buildMockLogs();

// ─── Sub-components ────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: LogLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0",
        LEVEL_STYLES[level]
      )}
    >
      {level}
    </span>
  );
}

function LiveDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      )}
      <span
        className={cn(
          "relative inline-flex rounded-full h-2.5 w-2.5",
          active ? "bg-green-400" : "bg-[var(--color-surface-3)]"
        )}
      />
    </span>
  );
}

interface SidePanelProps {
  line: LogLine;
  onClose: () => void;
}

function SidePanel({ line, onClose }: SidePanelProps) {
  return (
    <div className="w-80 shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface-1)] flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <span className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
          Error Detail
        </span>
        <button
          onClick={onClose}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Timestamp</p>
          <p className="text-xs text-[var(--color-text-primary)] font-mono">{line.timestamp}</p>
        </div>

        <div>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Level</p>
          <LevelBadge level={line.level} />
        </div>

        <div>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Message</p>
          <p className="text-xs text-red-300 font-mono break-all leading-relaxed">{line.message}</p>
        </div>

        {line.detail && (
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Detail</p>
            <pre className="text-xs text-[var(--color-text-primary)] font-mono whitespace-pre-wrap break-all leading-relaxed bg-[var(--color-surface-0)] rounded p-3">
              {line.detail}
            </pre>
          </div>
        )}
      </div>

      {/* Panel footer */}
      <div className="px-4 py-3 border-t border-[var(--color-border)]">
        <button
          onClick={() => alert(`[mock] Opening line #${line.id} in Inspector…`)}
          className="w-full rounded bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-xs font-medium py-2 transition-colors"
        >
          Open in Inspector
        </button>
      </div>
    </div>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────────

export default function AgentLogStream() {
  const [selectedAgent, setSelectedAgent] = useState<string>(AGENTS[0].id);
  const [isLive, setIsLive] = useState(true);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");
  const [searchText, setSearchText] = useState("");
  const [logs, setLogs] = useState<LogLine[]>(INITIAL_LOGS);
  const [selectedLine, setSelectedLine] = useState<LogLine | null>(null);
  const [isPausedByScroll, setIsPausedByScroll] = useState(false);
  const [copied, setCopied] = useState(false);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const nextIdRef = useRef(INITIAL_LOGS.length + 1);

  // ── Filter logic ──────────────────────────────────────────────────────────
  const filteredLogs = logs.filter((line) => {
    const matchLevel = levelFilter === "ALL" || line.level === levelFilter;
    const matchSearch =
      searchText.trim() === "" ||
      line.message.toLowerCase().includes(searchText.toLowerCase());
    return matchLevel && matchSearch;
  });

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    const el = logContainerRef.current;
    if (el) {el.scrollTop = el.scrollHeight;}
  }, []);

  useEffect(() => {
    if (isLive && !isPausedByScroll) {
      scrollToBottom();
    }
  }, [filteredLogs, isLive, isPausedByScroll, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) {return;}
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distFromBottom < 40;
    if (isLive && !isAtBottomRef.current) {
      setIsPausedByScroll(true);
    }
  }, [isLive]);

  const handleResume = () => {
    setIsPausedByScroll(false);
    scrollToBottom();
  };

  // ── Simulate live log lines ───────────────────────────────────────────────
  useEffect(() => {
    if (!isLive) {return;}

    const liveMsgs: Array<{ level: LogLevel; message: string }> = [
      { level: "DEBUG", message: "Heartbeat tick — memory stable" },
      { level: "INFO",  message: "Polling channel for new messages…" },
      { level: "WARN",  message: "Model token budget at 80% — consider truncating context" },
      { level: "INFO",  message: "Tool call dispatched: exec(ls src/views)" },
      { level: "DEBUG", message: "Response received in 312 ms" },
      { level: "ERROR", message: "Plugin load failed: @openclaw/msteams not found in node_modules" },
    ];

    let idx = 0;
    const interval = setInterval(() => {
      const entry = liveMsgs[idx % liveMsgs.length];
      const now = new Date().toISOString().replace("T", " ").slice(0, 23);
      setLogs((prev) => [
        ...prev,
        { id: nextIdRef.current++, timestamp: now, level: entry.level, message: entry.message },
      ]);
      idx++;
    }, 2500);

    return () => clearInterval(interval);
  }, [isLive, selectedAgent]);

  // ── Copy all ──────────────────────────────────────────────────────────────
  const handleCopyAll = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`)
      .join("\n");
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  // ── Line click ────────────────────────────────────────────────────────────
  const handleLineClick = (line: LogLine) => {
    if (line.level === "ERROR") {
      setSelectedLine((prev) => (prev?.id === line.id ? null : line));
    }
  };

  // ── Toggle live ───────────────────────────────────────────────────────────
  const handleToggleLive = () => {
    setIsLive((v) => {
      if (!v) {setIsPausedByScroll(false);}
      return !v;
    });
  };

  const LEVEL_FILTERS: LevelFilter[] = ["ALL", "DEBUG", "INFO", "WARN", "ERROR"];

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-1)] text-[var(--color-text-primary)] overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-[var(--color-text-primary)] tracking-tight">
            Agent Log Stream
          </h1>

          {/* Agent selector */}
          <select
            value={selectedAgent}
            onChange={(e) => {
              setSelectedAgent(e.target.value);
              setLogs(buildMockLogs());
              nextIdRef.current = INITIAL_LOGS.length + 1;
              setSelectedLine(null);
            }}
            className="rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Live toggle */}
        <button
          onClick={handleToggleLive}
          className={cn(
            "flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium border transition-colors",
            isLive
              ? "border-green-700 bg-green-950 text-green-300 hover:bg-green-900"
              : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <LiveDot active={isLive} />
          {isLive ? "Live" : "Paused"}
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-[var(--color-border)] shrink-0 flex-wrap">
        {/* Level chips */}
        <div className="flex items-center gap-1.5">
          {LEVEL_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setLevelFilter(f)}
              className={cn(
                "rounded px-2.5 py-0.5 text-xs font-medium border transition-colors",
                levelFilter === f
                  ? "border-blue-600 bg-blue-900 text-blue-200"
                  : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-surface-3)]"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search messages…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="flex-1 min-w-[160px] rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-xs px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />

        {/* Line count */}
        <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
          {filteredLogs.length} line{filteredLogs.length !== 1 ? "s" : ""}
        </span>

        {/* Copy All */}
        <button
          onClick={handleCopyAll}
          className="rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-surface-3)] text-xs px-3 py-1.5 transition-colors whitespace-nowrap"
        >
          {copied ? "✓ Copied" : "Copy All"}
        </button>
      </div>

      {/* ── Body: log area + optional side panel ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Log list */}
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-[var(--color-surface-0)] font-mono text-xs leading-relaxed relative"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
              No log lines match the current filter.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {filteredLogs.map((line) => {
                  const isSelected = selectedLine?.id === line.id;
                  const isError = line.level === "ERROR";
                  return (
                    <tr
                      key={line.id}
                      onClick={() => handleLineClick(line)}
                      className={cn(
                        "group border-b border-[var(--color-border)] transition-colors",
                        LEVEL_ROW_HIGHLIGHT[line.level],
                        isSelected && "ring-1 ring-inset ring-red-600 bg-red-950/50",
                        isError && !isSelected && "cursor-pointer hover:bg-red-950/20",
                        !isError && "cursor-default"
                      )}
                    >
                      {/* Line number */}
                      <td className="w-10 pl-3 pr-2 py-1 text-[var(--color-text-muted)] text-right select-none align-top tabular-nums">
                        {line.id}
                      </td>

                      {/* Timestamp */}
                      <td className="w-48 pr-3 py-1 text-[var(--color-text-muted)] whitespace-nowrap align-top tabular-nums">
                        {line.timestamp}
                      </td>

                      {/* Level badge */}
                      <td className="w-16 pr-3 py-1 align-top">
                        <LevelBadge level={line.level} />
                      </td>

                      {/* Message */}
                      <td className="py-1 pr-4 align-top break-all">
                        <span
                          className={cn(
                            "text-[var(--color-text-primary)]",
                            line.level === "ERROR" && "text-red-300",
                            line.level === "WARN" && "text-yellow-200",
                            line.level === "DEBUG" && "text-[var(--color-text-muted)]"
                          )}
                        >
                          {line.message}
                        </span>
                        {isError && !isSelected && (
                          <span className="ml-2 text-[10px] text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            click for detail ↗
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Resume button (scroll-paused) */}
          {isPausedByScroll && isLive && (
            <div className="sticky bottom-4 flex justify-center pointer-events-none">
              <button
                onClick={handleResume}
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] border border-[var(--color-surface-3)] text-[var(--color-text-primary)] text-xs font-medium px-4 py-2 shadow-lg transition-colors"
              >
                <LiveDot active />
                Resume live scroll ↓
              </button>
            </div>
          )}
        </div>

        {/* Side panel */}
        {selectedLine && (
          <SidePanel line={selectedLine} onClose={() => setSelectedLine(null)} />
        )}
      </div>
    </div>
  );
}
