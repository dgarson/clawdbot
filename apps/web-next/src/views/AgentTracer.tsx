import React, { useState } from "react";
import { cn } from "../lib/utils";

type SpanStatus = "ok" | "error" | "timeout";
type SpanKind = "session" | "llm" | "tool" | "subagent" | "webhook" | "cron";

interface Span {
  id: string;
  traceId: string;
  parentId: string | null;
  name: string;
  kind: SpanKind;
  status: SpanStatus;
  startMs: number; // relative ms from trace start
  durationMs: number;
  agent: string;
  model?: string;
  tokens?: number;
  tags: Record<string, string>;
  events: SpanEvent[];
}

interface SpanEvent {
  offsetMs: number;
  name: string;
  level: "info" | "warn" | "error";
  message: string;
}

interface Trace {
  id: string;
  name: string;
  agent: string;
  startedAt: string;
  totalMs: number;
  status: SpanStatus;
  spanCount: number;
}

const TRACES: Trace[] = [
  { id: "t-001", name: "Morning heartbeat — Luis", agent: "Luis", startedAt: "2026-02-22 02:05:00", totalMs: 14320, status: "ok", spanCount: 12 },
  { id: "t-002", name: "PR review dispatch", agent: "Xavier", startedAt: "2026-02-22 01:48:22", totalMs: 3850, status: "ok", spanCount: 6 },
  { id: "t-003", name: "Cron: daily digest", agent: "Stephan", startedAt: "2026-02-22 01:00:05", totalMs: 8710, status: "error", spanCount: 9 },
  { id: "t-004", name: "Webhook delivery — GitHub", agent: "Sam", startedAt: "2026-02-22 00:55:14", totalMs: 1240, status: "ok", spanCount: 4 },
  { id: "t-005", name: "Build verification", agent: "Tim", startedAt: "2026-02-21 23:40:00", totalMs: 22100, status: "ok", spanCount: 15 },
  { id: "t-006", name: "Sub-agent: horizon-analytics", agent: "Wes", startedAt: "2026-02-21 23:15:30", totalMs: 181941, status: "ok", spanCount: 22 },
  { id: "t-007", name: "Knowledge base sync", agent: "Quinn", startedAt: "2026-02-21 22:58:11", totalMs: 4520, status: "timeout", spanCount: 7 },
  { id: "t-008", name: "Token audit sweep", agent: "Reed", startedAt: "2026-02-21 22:30:00", totalMs: 2110, status: "ok", spanCount: 5 },
];

const SPANS: Record<string, Span[]> = {
  "t-001": [
    {
      id: "s-001-root", traceId: "t-001", parentId: null, name: "session:luis:cron", kind: "session", status: "ok",
      startMs: 0, durationMs: 14320, agent: "Luis", tags: { trigger: "cron", channel: "slack" },
      events: [
        { offsetMs: 12, name: "session.start", level: "info", message: "Heartbeat session started" },
        { offsetMs: 14300, name: "session.end", level: "info", message: "Session completed successfully" },
      ]
    },
    {
      id: "s-001-llm1", traceId: "t-001", parentId: "s-001-root", name: "llm:claude-sonnet:plan", kind: "llm", status: "ok",
      startMs: 180, durationMs: 2100, agent: "Luis", model: "claude-sonnet-4-6", tokens: 1840,
      tags: { "llm.temperature": "1", "llm.stream": "true" },
      events: [
        { offsetMs: 50, name: "llm.request", level: "info", message: "Sending planning prompt (1.2k tokens)" },
        { offsetMs: 2080, name: "llm.response", level: "info", message: "Received plan (640 tokens)" },
      ]
    },
    {
      id: "s-001-tool1", traceId: "t-001", parentId: "s-001-root", name: "tool:read:CONTEXT.md", kind: "tool", status: "ok",
      startMs: 320, durationMs: 45, agent: "Luis", tags: { "tool.name": "read", "fs.path": "CONTEXT.md" },
      events: [{ offsetMs: 44, name: "tool.result", level: "info", message: "File read: 4.2 kB" }]
    },
    {
      id: "s-001-subagent1", traceId: "t-001", parentId: "s-001-root", name: "subagent:piper:api-playground", kind: "subagent", status: "ok",
      startMs: 3100, durationMs: 152771, agent: "Piper", tags: { model: "MiniMax-M2.5", label: "horizon-api-playground" },
      events: [
        { offsetMs: 0, name: "spawn", level: "info", message: "Spawning horizon-api-playground" },
        { offsetMs: 152771, name: "done", level: "info", message: "Agent completed in 3m" },
      ]
    },
    {
      id: "s-001-llm2", traceId: "t-001", parentId: "s-001-root", name: "llm:claude-sonnet:AgentTracer", kind: "llm", status: "ok",
      startMs: 5200, durationMs: 3800, agent: "Luis", model: "claude-sonnet-4-6", tokens: 4120,
      tags: { "llm.temperature": "1", purpose: "code-generation" },
      events: [
        { offsetMs: 100, name: "llm.request", level: "info", message: "Sending code gen prompt (2.1k tokens)" },
        { offsetMs: 3750, name: "llm.response", level: "info", message: "Received component code (2.0k tokens)" },
      ]
    },
    {
      id: "s-001-tool2", traceId: "t-001", parentId: "s-001-root", name: "tool:write:AgentTracer.tsx", kind: "tool", status: "ok",
      startMs: 9100, durationMs: 88, agent: "Luis", tags: { "tool.name": "write", "fs.bytes": "19824" },
      events: [{ offsetMs: 87, name: "tool.result", level: "info", message: "File written: 19.8 kB" }]
    },
    {
      id: "s-001-tool3", traceId: "t-001", parentId: "s-001-root", name: "tool:exec:pnpm build", kind: "tool", status: "ok",
      startMs: 10200, durationMs: 1640, agent: "Luis", tags: { "tool.name": "exec", cmd: "pnpm build" },
      events: [
        { offsetMs: 1620, name: "tool.result", level: "info", message: "Build succeeded in 1.64s, 0 errors" },
      ]
    },
    {
      id: "s-001-tool4", traceId: "t-001", parentId: "s-001-root", name: "tool:exec:git commit", kind: "tool", status: "ok",
      startMs: 12100, durationMs: 420, agent: "Luis", tags: { "tool.name": "exec", cmd: "git commit" },
      events: [{ offsetMs: 418, name: "tool.result", level: "info", message: "Committed: 81a5453" }]
    },
  ],
  "t-003": [
    {
      id: "s-003-root", traceId: "t-003", parentId: null, name: "session:stephan:cron-digest", kind: "session", status: "error",
      startMs: 0, durationMs: 8710, agent: "Stephan", tags: { trigger: "cron", channel: "slack" },
      events: [
        { offsetMs: 10, name: "session.start", level: "info", message: "Daily digest cron triggered" },
        { offsetMs: 8700, name: "session.error", level: "error", message: "Unhandled exception in digest generation" },
      ]
    },
    {
      id: "s-003-llm1", traceId: "t-003", parentId: "s-003-root", name: "llm:gpt-4o:digest-gen", kind: "llm", status: "error",
      startMs: 200, durationMs: 7900, agent: "Stephan", model: "gpt-4o", tokens: 0,
      tags: { "llm.temperature": "0.7" },
      events: [
        { offsetMs: 150, name: "llm.request", level: "info", message: "Sending digest prompt" },
        { offsetMs: 7890, name: "llm.error", level: "error", message: "API timeout after 7.9s (rate limit)" },
      ]
    },
    {
      id: "s-003-webhook", traceId: "t-003", parentId: "s-003-root", name: "webhook:slack:failed", kind: "webhook", status: "error",
      startMs: 8100, durationMs: 590, agent: "Stephan", tags: { destination: "slack", event: "digest" },
      events: [{ offsetMs: 580, name: "webhook.failed", level: "error", message: "Slack API 429 — rate limited" }]
    },
  ],
};

const KIND_COLORS: Record<SpanKind, string> = {
  session: "bg-primary",
  llm: "bg-primary",
  tool: "bg-emerald-500",
  subagent: "bg-amber-500",
  webhook: "bg-sky-500",
  cron: "bg-rose-500",
};

const STATUS_COLORS: Record<SpanStatus, string> = {
  ok: "text-emerald-400",
  error: "text-rose-400",
  timeout: "text-amber-400",
};

const STATUS_BG: Record<SpanStatus, string> = {
  ok: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  error: "bg-rose-500/10 text-rose-400 ring-rose-500/20",
  timeout: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
};

function formatMs(ms: number): string {
  if (ms >= 60000) {return `${(ms / 60000).toFixed(1)}m`;}
  if (ms >= 1000) {return `${(ms / 1000).toFixed(2)}s`;}
  return `${ms}ms`;
}

// Duration bucketing for color-coded pills
type DurationBucket = "fast" | "normal" | "slow" | "critical";

function durationBucket(ms: number): DurationBucket {
  if (ms < 1000) return "fast";
  if (ms < 10000) return "normal";
  if (ms < 60000) return "slow";
  return "critical";
}

const DURATION_PILL: Record<DurationBucket, string> = {
  fast: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  normal: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20",
  slow: "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20",
  critical: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
};

// Kind pills — translucent background variant of KIND_COLORS
const KIND_PILL: Record<SpanKind, string> = {
  session: "bg-primary/10 text-primary ring-1 ring-indigo-500/20",
  llm: "bg-primary/10 text-primary ring-1 ring-violet-500/20",
  tool: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  subagent: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  webhook: "bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20",
  cron: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
};

// Semantic colors for status filter buttons
const STATUS_FILTER_ACTIVE: Record<string, string> = {
  all: "bg-primary text-white",
  ok: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
  timeout: "bg-amber-600 text-white",
};

// Relative time formatting
function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr.replace(" ", "T"));
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return dateStr;
}

function SpanRow({
  span,
  depth,
  totalMs,
  selected,
  onSelect,
  isLast,
  ancestorIsLast,
}: {
  span: Span;
  depth: number;
  totalMs: number;
  selected: boolean;
  onSelect: () => void;
  isLast: boolean;
  ancestorIsLast: boolean[];
}) {
  const leftPct = (span.startMs / totalMs) * 100;
  const widthPct = Math.max((span.durationMs / totalMs) * 100, 0.5);
  const bucket = durationBucket(span.durationMs);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        selected && "bg-zinc-800",
      )}
    >
      {/* Tree connector lines */}
      {depth > 0 ? (
        <div style={{ width: depth * 20 }} className="shrink-0 relative self-stretch">
          {/* Vertical continuation lines for ancestors with more siblings */}
          {Array.from({ length: depth - 1 }, (_, i) =>
            !ancestorIsLast[i + 1] ? (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-zinc-700/40"
                style={{ left: i * 20 + 10 }}
              />
            ) : null,
          )}
          {/* Parent connector: vertical segment */}
          <div
            className="absolute border-l border-zinc-700/40"
            style={{
              left: (depth - 1) * 20 + 10,
              top: 0,
              height: isLast ? "50%" : "100%",
            }}
          />
          {/* Parent connector: horizontal segment */}
          <div
            className="absolute border-t border-zinc-700/40"
            style={{
              left: (depth - 1) * 20 + 10,
              top: "50%",
              width: 10,
            }}
          />
        </div>
      ) : (
        <div className="shrink-0" style={{ width: 0 }} />
      )}
      {/* kind dot */}
      <span className={cn("w-2 h-2 rounded-full shrink-0", KIND_COLORS[span.kind])} />
      {/* name (wider, with tooltip for overflow) */}
      <span className="text-xs text-zinc-300 truncate shrink-0 min-w-44 max-w-56" title={span.name}>
        {span.name}
      </span>
      {/* waterfall bar with gridlines */}
      <div className="flex-1 relative h-4 bg-zinc-800/50 rounded overflow-hidden">
        <div className="absolute inset-y-0 left-1/4 w-px bg-zinc-700/30" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-700/30" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-zinc-700/30" />
        <div
          className={cn("absolute h-full rounded opacity-80", KIND_COLORS[span.kind])}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
      </div>
      {/* duration pill — color-bucketed by speed */}
      <span className={cn("text-xs shrink-0 px-1.5 py-0.5 rounded-md font-medium tabular-nums", DURATION_PILL[bucket])}>
        {formatMs(span.durationMs)}
      </span>
    </button>
  );
}

function buildTree(spans: Span[]): Array<{ span: Span; depth: number; isLast: boolean; ancestorIsLast: boolean[] }> {
  const result: Array<{ span: Span; depth: number; isLast: boolean; ancestorIsLast: boolean[] }> = [];
  const addChildren = (parentId: string | null, depth: number, ancestors: boolean[]) => {
    const children = spans.filter((s) => s.parentId === parentId);
    for (let i = 0; i < children.length; i++) {
      const isLast = i === children.length - 1;
      result.push({ span: children[i], depth, isLast, ancestorIsLast: [...ancestors] });
      addChildren(children[i].id, depth + 1, [...ancestors, isLast]);
    }
  };
  addChildren(null, 0, []);
  return result;
}

export default function AgentTracer() {
  const [selectedTraceId, setSelectedTraceId] = useState<string>("t-001");
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>("s-001-root");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const agents = Array.from(new Set(TRACES.map((t) => t.agent)));

  const filtered = TRACES.filter((t) => {
    if (agentFilter !== "all" && t.agent !== agentFilter) {return false;}
    if (statusFilter !== "all" && t.status !== statusFilter) {return false;}
    return true;
  });

  const selectedTrace = TRACES.find((t) => t.id === selectedTraceId) ?? TRACES[0];
  const spans = SPANS[selectedTraceId] ?? [];
  const tree = buildTree(spans);
  const totalMs = selectedTrace.totalMs;

  const selectedSpan = spans.find((s) => s.id === selectedSpanId) ?? null;

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Agent Tracer</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Distributed trace viewer — spans, events, timing</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Trace list */}
        <aside className="w-72 shrink-0 border-r border-zinc-700 flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="shrink-0 p-3 border-b border-zinc-800 space-y-2">
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Filter by agent"
            >
              <option value="all">All agents</option>
              {agents.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <div className="flex gap-1.5">
              {(["all", "ok", "error", "timeout"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-2 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    statusFilter === s
                      ? STATUS_FILTER_ACTIVE[s]
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Trace list */}
          <ul className="flex-1 overflow-y-auto divide-y divide-zinc-800/50" role="listbox" aria-label="Traces">
            {filtered.map((trace) => (
              <li key={trace.id}>
                <button
                  role="option"
                  aria-selected={trace.id === selectedTraceId}
                  onClick={() => {
                    setSelectedTraceId(trace.id);
                    setSelectedSpanId(null);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
                    trace.id === selectedTraceId && "bg-primary/5 border-l-[3px] border-primary"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-200 leading-tight">{trace.name}</span>
                    <span className={cn("shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ring-1", STATUS_BG[trace.status])}>
                      {trace.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                    <span>{trace.agent}</span>
                    <span className="text-zinc-700">·</span>
                    <span className={cn("px-1 py-0.5 rounded text-xs tabular-nums", DURATION_PILL[durationBucket(trace.totalMs)])}>{formatMs(trace.totalMs)}</span>
                    <span className="text-zinc-700">·</span>
                    <span>{trace.spanCount} spans</span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500" title={trace.startedAt}>{relativeTime(trace.startedAt)}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Trace detail: waterfall + span detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Trace summary bar */}
          <div className="shrink-0 border-b border-zinc-800 px-5 py-3 flex items-center gap-6">
            <div>
              <div className="text-sm font-semibold text-white">{selectedTrace.name}</div>
              <div className="text-xs text-zinc-500">{selectedTrace.startedAt} · {selectedTrace.agent}</div>
            </div>
            <div className="flex items-center gap-4 ml-auto">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{formatMs(selectedTrace.totalMs)}</div>
                <div className="text-xs text-zinc-500">Duration</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white bg-zinc-800 px-2.5 py-0.5 rounded-md inline-block">{selectedTrace.spanCount}</div>
                <div className="text-xs text-zinc-500 mt-0.5">Spans</div>
              </div>
              <span className={cn("px-2 py-0.5 rounded text-xs font-medium ring-1", STATUS_BG[selectedTrace.status])}>
                {selectedTrace.status}
              </span>
            </div>
          </div>

          {/* Waterfall + detail split */}
          <div className="flex-1 flex overflow-hidden">
            {/* Waterfall */}
            <div className="flex-1 overflow-y-auto">
              {/* Time ruler */}
              <div className="flex items-center gap-2 px-3 py-1 border-b border-zinc-800/50 sticky top-0 bg-zinc-950 z-10">
                <div className="w-2 shrink-0" />
                <div className="w-44 shrink-0" />
                <div className="flex-1 flex justify-between text-xs text-zinc-400 px-1">
                  <span>0</span>
                  <span>{formatMs(totalMs / 4)}</span>
                  <span>{formatMs(totalMs / 2)}</span>
                  <span>{formatMs((totalMs * 3) / 4)}</span>
                  <span>{formatMs(totalMs)}</span>
                </div>
                <div className="w-16" />
              </div>

              {tree.map(({ span, depth, isLast, ancestorIsLast }) => (
                <SpanRow
                  key={span.id}
                  span={span}
                  depth={depth}
                  totalMs={totalMs}
                  selected={span.id === selectedSpanId}
                  onSelect={() => setSelectedSpanId(span.id === selectedSpanId ? null : span.id)}
                  isLast={isLast}
                  ancestorIsLast={ancestorIsLast}
                />
              ))}
            </div>

            {/* Span detail */}
            {selectedSpan && (
              <aside className="w-72 shrink-0 border-l border-zinc-700 overflow-y-auto">
                <div className="p-4 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", KIND_COLORS[selectedSpan.kind])} />
                    <span className="text-xs font-semibold text-white truncate">{selectedSpan.name}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded ring-1", STATUS_BG[selectedSpan.status])}>
                      {selectedSpan.status}
                    </span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded capitalize", KIND_PILL[selectedSpan.kind])}>{selectedSpan.kind}</span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Timing */}
                  <div>
                    <div className="text-xs font-medium text-zinc-400 mb-2 pb-1 border-b border-zinc-700/50 uppercase tracking-wide">Timing</div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Start</span>
                        <span className="text-zinc-300">{formatMs(selectedSpan.startMs)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Duration</span>
                        <span className="text-zinc-300 font-medium">{formatMs(selectedSpan.durationMs)}</span>
                      </div>
                      {selectedSpan.tokens !== undefined && (
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">Tokens</span>
                          <span className="text-zinc-300 font-mono bg-zinc-800 px-1.5 py-0.5 rounded">{selectedSpan.tokens.toLocaleString()}</span>
                        </div>
                      )}
                      {selectedSpan.model && (
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">Model</span>
                          <span className="text-zinc-300">{selectedSpan.model}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {Object.keys(selectedSpan.tags).length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-zinc-400 mb-2 pb-1 border-b border-zinc-700/50 uppercase tracking-wide">Tags</div>
                      <div className="space-y-1">
                        {Object.entries(selectedSpan.tags).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs gap-2">
                            <span className="text-zinc-500 truncate">{k}</span>
                            <span className="text-zinc-300 truncate font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Events */}
                  {selectedSpan.events.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-zinc-400 mb-2 pb-1 border-b border-zinc-700/50 uppercase tracking-wide">Events</div>
                      <ul className="space-y-2">
                        {selectedSpan.events.map((ev, i) => (
                          <li key={i} className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  ev.level === "error" ? "bg-rose-400" : ev.level === "warn" ? "bg-amber-400" : "bg-emerald-400"
                                )}
                                role="img"
                                aria-label={ev.level}
                              />
                              <span className="text-zinc-400 font-medium">{ev.name}</span>
                              <span className="text-zinc-500 ml-auto tabular-nums">+{formatMs(ev.offsetMs)}</span>
                            </div>
                            <p className="text-zinc-500 mt-0.5 pl-3">{ev.message}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>

          {/* Legend */}
          <div className="shrink-0 border-t border-zinc-800 px-5 py-2 flex items-center gap-4 flex-wrap">
            {(Object.keys(KIND_COLORS) as SpanKind[]).map((k) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={cn("w-2.5 h-2.5 rounded-full", KIND_COLORS[k])} />
                <span className="text-xs text-zinc-400 capitalize">{k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
