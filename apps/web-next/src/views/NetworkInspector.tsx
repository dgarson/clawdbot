import React, { useState, useMemo, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "WS";
type RequestStatus = "success" | "error" | "pending" | "cancelled";

interface Header { name: string; value: string; }

interface NetworkRequest {
  id: string;
  method: RequestMethod;
  url: string;
  status: RequestStatus;
  statusCode?: number;
  duration: number; // ms
  requestSize: number; // bytes
  responseSize: number; // bytes
  timestamp: string;
  contentType: string;
  requestHeaders: Header[];
  responseHeaders: Header[];
  requestBody?: string;
  responseBody?: string;
  initiator: string; // which component/agent triggered this
  agentId?: string;
}

type InspectorTab = "all" | "xhr" | "ws" | "errors";

// ─── Seed Data ────────────────────────────────────────────────────────────────

const REQUESTS: NetworkRequest[] = [
  {
    id: "req-001",
    method: "POST",
    url: "https://api.anthropic.com/v1/messages",
    status: "success", statusCode: 200,
    duration: 1823, requestSize: 4201, responseSize: 12480,
    timestamp: "2026-02-22T02:10:00Z",
    contentType: "application/json",
    requestHeaders: [
      { name: "Authorization", value: "Bearer sk-ant-***" },
      { name: "Content-Type", value: "application/json" },
      { name: "anthropic-version", value: "2023-06-01" },
    ],
    responseHeaders: [
      { name: "Content-Type", value: "application/json; charset=utf-8" },
      { name: "X-Request-Id", value: "req_014BKJtQBBWpB3D" },
    ],
    requestBody: `{"model":"claude-sonnet-4-6","max_tokens":4096,"messages":[{"role":"user","content":"Build a NetworkInspector view..."}]}`,
    responseBody: `{"id":"msg_014BKJtQBBWpB3D","type":"message","role":"assistant","content":[{"type":"text","text":"..."}],"model":"claude-sonnet-4-6-20241022","stop_reason":"end_turn","usage":{"input_tokens":1842,"output_tokens":3204}}`,
    initiator: "AgentRunner",
    agentId: "luis",
  },
  {
    id: "req-002",
    method: "GET",
    url: "https://api.clawdbot.io/v1/sessions?limit=20&status=active",
    status: "success", statusCode: 200,
    duration: 145, requestSize: 0, responseSize: 8320,
    timestamp: "2026-02-22T02:09:45Z",
    contentType: "application/json",
    requestHeaders: [
      { name: "Authorization", value: "Bearer oclaw-***" },
      { name: "Accept", value: "application/json" },
    ],
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
      { name: "X-Total-Count", value: "7" },
    ],
    responseBody: `{"sessions":[{"id":"sess-e61f","agent_id":"luis","status":"active"},...],"total":7}`,
    initiator: "SessionsView",
  },
  {
    id: "req-003",
    method: "WS",
    url: "wss://gateway.clawdbot.io/ws?token=***",
    status: "success",
    duration: 45230, requestSize: 1240, responseSize: 89400,
    timestamp: "2026-02-22T01:24:00Z",
    contentType: "application/octet-stream",
    requestHeaders: [
      { name: "Upgrade", value: "websocket" },
      { name: "Connection", value: "Upgrade" },
      { name: "Sec-WebSocket-Key", value: "dGhlIHNhbXBsZQ==" },
    ],
    responseHeaders: [
      { name: "Upgrade", value: "websocket" },
      { name: "Connection", value: "Upgrade" },
    ],
    initiator: "GatewayRelay",
    agentId: "luis",
  },
  {
    id: "req-004",
    method: "POST",
    url: "https://api.openai.com/v1/audio/speech",
    status: "success", statusCode: 200,
    duration: 2341, requestSize: 384, responseSize: 184320,
    timestamp: "2026-02-22T02:05:00Z",
    contentType: "audio/mpeg",
    requestHeaders: [
      { name: "Authorization", value: "Bearer sk-***" },
      { name: "Content-Type", value: "application/json" },
    ],
    responseHeaders: [
      { name: "Content-Type", value: "audio/mpeg" },
      { name: "Content-Length", value: "184320" },
    ],
    requestBody: `{"model":"tts-1-hd","voice":"shimmer","input":"Sprint complete. 53 views shipped."}`,
    initiator: "TTSScript",
  },
  {
    id: "req-005",
    method: "POST",
    url: "https://api.github.com/repos/dgarson/clawdbot/git/refs",
    status: "error", statusCode: 422,
    duration: 890, requestSize: 180, responseSize: 240,
    timestamp: "2026-02-22T01:30:00Z",
    contentType: "application/json",
    requestHeaders: [
      { name: "Authorization", value: "Bearer ghp_***" },
      { name: "Content-Type", value: "application/json" },
    ],
    responseHeaders: [
      { name: "Content-Type", value: "application/json; charset=utf-8" },
      { name: "X-GitHub-Request-Id", value: "AB12:CD34" },
    ],
    requestBody: `{"ref":"refs/heads/feat/test-branch","sha":"abc123"}`,
    responseBody: `{"message":"Reference already exists","documentation_url":"https://docs.github.com/rest"}`,
    initiator: "GitWorker",
  },
  {
    id: "req-006",
    method: "GET",
    url: "https://api.clawdbot.io/v1/agents/luis/soul",
    status: "success", statusCode: 200,
    duration: 67, requestSize: 0, responseSize: 4821,
    timestamp: "2026-02-22T01:05:00Z",
    contentType: "text/markdown",
    requestHeaders: [
      { name: "Authorization", value: "Bearer oclaw-***" },
    ],
    responseHeaders: [
      { name: "Content-Type", value: "text/markdown" },
      { name: "Cache-Control", value: "no-cache" },
    ],
    initiator: "AgentLoader",
    agentId: "luis",
  },
  {
    id: "req-007",
    method: "POST",
    url: "https://hooks.slack.com/services/T01/B01/xxx",
    status: "success", statusCode: 200,
    duration: 312, requestSize: 890, responseSize: 2,
    timestamp: "2026-02-22T02:02:00Z",
    contentType: "application/json",
    requestHeaders: [
      { name: "Content-Type", value: "application/json" },
    ],
    responseHeaders: [
      { name: "Content-Type", value: "text/html" },
    ],
    requestBody: `{"text":"✅ Horizon UI: 52 views shipped!","channel":"#cb-activity"}`,
    responseBody: "ok",
    initiator: "SlackNotifier",
  },
  {
    id: "req-008",
    method: "POST",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
    status: "error", statusCode: 429,
    duration: 234, requestSize: 2100, responseSize: 180,
    timestamp: "2026-02-22T00:47:00Z",
    contentType: "application/json",
    requestHeaders: [
      { name: "X-Goog-Api-Key", value: "AIza***" },
      { name: "Content-Type", value: "application/json" },
    ],
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
    ],
    requestBody: `{"contents":[{"role":"user","parts":[{"text":"Build changelog view..."}]}]}`,
    responseBody: `{"error":{"code":429,"message":"RESOURCE_EXHAUSTED: Quota exceeded","status":"RESOURCE_EXHAUSTED"}}`,
    initiator: "ProviderRouter",
    agentId: "quinn",
  },
  {
    id: "req-009",
    method: "DELETE",
    url: "https://api.clawdbot.io/v1/sessions/sess-old-123",
    status: "success", statusCode: 204,
    duration: 89, requestSize: 0, responseSize: 0,
    timestamp: "2026-02-22T00:00:00Z",
    contentType: "",
    requestHeaders: [
      { name: "Authorization", value: "Bearer oclaw-***" },
    ],
    responseHeaders: [],
    initiator: "SessionCleanup",
  },
  {
    id: "req-010",
    method: "PATCH",
    url: "https://api.clawdbot.io/v1/agents/piper/config",
    status: "success", statusCode: 200,
    duration: 124, requestSize: 310, responseSize: 890,
    timestamp: "2026-02-22T01:40:00Z",
    contentType: "application/json",
    requestHeaders: [
      { name: "Authorization", value: "Bearer oclaw-***" },
      { name: "Content-Type", value: "application/merge-patch+json" },
    ],
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
    ],
    requestBody: `{"model":"minimax-portal/MiniMax-M2.5","max_tokens":8192}`,
    responseBody: `{"agent_id":"piper","config":{"model":"minimax-portal/MiniMax-M2.5","max_tokens":8192}}`,
    initiator: "AgentConfigService",
    agentId: "xavier",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<RequestMethod, string> = {
  GET:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  POST:   "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  PUT:    "text-amber-400 bg-amber-400/10 border-amber-400/20",
  PATCH:  "text-blue-400 bg-blue-400/10 border-blue-400/20",
  DELETE: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  WS:     "text-violet-400 bg-violet-400/10 border-violet-400/20",
};

const STATUS_COLORS: Record<RequestStatus, string> = {
  success:   "text-emerald-400",
  error:     "text-rose-400",
  pending:   "text-amber-400",
  cancelled: "text-[var(--color-text-muted)]",
};

function fmtSize(bytes: number): string {
  if (bytes === 0) {return "0 B";}
  if (bytes >= 1024 * 1024) {return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;}
  if (bytes >= 1024) {return `${(bytes / 1024).toFixed(0)} KB`;}
  return `${bytes} B`;
}

function fmtDuration(ms: number): string {
  if (ms >= 60000) {return `${(ms / 60000).toFixed(1)}m`;}
  if (ms >= 1000) {return `${(ms / 1000).toFixed(2)}s`;}
  return `${ms}ms`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {return "just now";}
  if (mins < 60) {return `${mins}m ago`;}
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function statusCodeColor(code?: number): string {
  if (!code) {return "text-[var(--color-text-muted)]";}
  if (code < 300) {return "text-emerald-400";}
  if (code < 400) {return "text-amber-400";}
  return "text-rose-400";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface HeadersTableProps { headers: Header[]; title: string; }
function HeadersTable({ headers, title }: HeadersTableProps) {
  if (headers.length === 0) {return <p className="text-xs text-[var(--color-text-muted)]">No {title.toLowerCase()}</p>;}
  return (
    <div className="space-y-0.5">
      {headers.map(h => (
        <div key={h.name} className="flex items-baseline gap-2 text-xs">
          <span className="text-[var(--color-text-secondary)] font-mono shrink-0">{h.name}:</span>
          <span className="text-[var(--color-text-muted)] font-mono break-all">{h.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type DetailTab = "headers" | "body" | "timing";

export default function NetworkInspector() {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<RequestMethod | "all">("all");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(REQUESTS[0].id);
  const [detailTab, setDetailTab] = useState<DetailTab>("headers");

  const filtered = useMemo(() => {
    return REQUESTS.filter(r => {
      if (methodFilter !== "all" && r.method !== methodFilter) {return false;}
      if (statusFilter !== "all" && r.status !== statusFilter) {return false;}
      if (search && !r.url.toLowerCase().includes(search.toLowerCase()) &&
          !r.initiator.toLowerCase().includes(search.toLowerCase())) {return false;}
      return true;
    }).toSorted((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [search, methodFilter, statusFilter]);

  const selected = useMemo(() => REQUESTS.find(r => r.id === selectedId) ?? null, [selectedId]);

  const totalRequests = REQUESTS.length;
  const errorCount = REQUESTS.filter(r => r.status === "error").length;
  const avgDuration = Math.round(REQUESTS.reduce((a, r) => a + r.duration, 0) / REQUESTS.length);

  const methods: Array<RequestMethod | "all"> = ["all", "GET", "POST", "PUT", "PATCH", "DELETE", "WS"];
  const statuses: Array<RequestStatus | "all"> = ["all", "success", "error", "pending"];

  const detailTabs: Array<{ id: DetailTab; label: string }> = [
    { id: "headers", label: "Headers" },
    { id: "body",    label: "Body" },
    { id: "timing",  label: "Timing" },
  ];

  return (
    <main className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden" role="main" aria-label="Network Inspector">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Network Inspector</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">HTTP/WebSocket request log — all agent API calls</p>
          </div>
          <div className="flex items-center gap-5 text-xs">
            {[
              { label: "Requests", value: totalRequests,            color: "text-[var(--color-text-primary)]" },
              { label: "Errors",   value: errorCount,               color: "text-rose-400" },
              { label: "Avg time", value: fmtDuration(avgDuration), color: "text-[var(--color-text-primary)]" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={cn("text-xl font-bold font-mono", s.color)}>{s.value}</p>
                <p className="text-[var(--color-text-muted)]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by URL or initiator…"
            aria-label="Filter requests"
            className={cn(
              "bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] w-56",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            )}
          />
          <div className="flex gap-1" role="group" aria-label="Filter by method">
            {methods.map(m => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                aria-pressed={methodFilter === m}
                className={cn(
                  "text-xs px-2 py-1 rounded border transition-colors font-mono",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  methodFilter === m
                    ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {m === "all" ? "All" : m}
              </button>
            ))}
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as RequestStatus | "all")}
            aria-label="Filter by status"
            className={cn("bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm text-[var(--color-text-primary)]", "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none")}
          >
            {statuses.map(s => <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>)}
          </select>
          <span className="text-xs text-[var(--color-text-muted)] ml-auto">{filtered.length} requests</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Request list */}
        <div className="w-[420px] shrink-0 flex flex-col border-r border-[var(--color-border)] overflow-hidden">
          {/* Table header */}
          <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/50 flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
            <span className="w-14">Method</span>
            <span className="flex-1">URL</span>
            <span className="w-12 text-right">Status</span>
            <span className="w-14 text-right">Time</span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto" role="list" aria-label="Network requests">
            {filtered.map(req => (
              <div key={req.id} role="listitem">
                <button
                  onClick={() => setSelectedId(req.id)}
                  aria-pressed={selectedId === req.id}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-[var(--color-border)]/60 transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 focus-visible:outline-none",
                    selectedId === req.id ? "bg-indigo-950/30" : "hover:bg-[var(--color-surface-2)]/30",
                    req.status === "error" && selectedId !== req.id && "border-l-2 border-l-rose-500"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0 w-14 text-center", METHOD_COLORS[req.method])}>
                      {req.method}
                    </span>
                    <span className="text-xs text-[var(--color-text-primary)] truncate flex-1 font-mono">
                      {req.url.replace(/^https?:\/\//, "").split("?")[0]}
                    </span>
                    <span className={cn("text-xs font-mono shrink-0 w-12 text-right", statusCodeColor(req.statusCode))}>
                      {req.statusCode ?? "WS"}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono shrink-0 w-14 text-right">
                      {fmtDuration(req.duration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--color-text-muted)] ml-14">
                    <span>{req.initiator}</span>
                    {req.agentId && <span className="text-[var(--color-text-muted)]">· {req.agentId}</span>}
                    <span className="ml-auto">{relTime(req.timestamp)}</span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              {/* Detail header */}
              <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-xs px-2 py-0.5 rounded border font-mono", METHOD_COLORS[selected.method])}>
                    {selected.method}
                  </span>
                  <span className={cn("text-sm font-mono font-bold", statusCodeColor(selected.statusCode))}>
                    {selected.statusCode ?? "—"}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] font-mono">{fmtDuration(selected.duration)}</span>
                </div>
                <p className="text-sm text-[var(--color-text-primary)] font-mono break-all">{selected.url}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--color-text-muted)]">
                  <span>↑ {fmtSize(selected.requestSize)}</span>
                  <span>↓ {fmtSize(selected.responseSize)}</span>
                  <span>Initiator: {selected.initiator}</span>
                  <span>{relTime(selected.timestamp)}</span>
                </div>
              </div>

              {/* Detail tabs */}
              <div className="px-4 border-b border-[var(--color-border)] flex gap-0" role="tablist">
                {detailTabs.map(t => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={detailTab === t.id}
                    onClick={() => setDetailTab(t.id)}
                    className={cn(
                      "px-4 py-2 text-sm border-b-2 transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                      detailTab === t.id
                        ? "border-indigo-500 text-[var(--color-text-primary)]"
                        : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Detail content */}
              <div className="flex-1 overflow-y-auto p-4">
                {detailTab === "headers" && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Request Headers</h3>
                      <HeadersTable headers={selected.requestHeaders} title="Request Headers" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Response Headers</h3>
                      <HeadersTable headers={selected.responseHeaders} title="Response Headers" />
                    </div>
                  </div>
                )}

                {detailTab === "body" && (
                  <div className="space-y-4">
                    {selected.requestBody && (
                      <div>
                        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Request Body</h3>
                        <pre className="bg-[var(--color-surface-2)] rounded-lg p-3 text-xs text-[var(--color-text-primary)] font-mono overflow-x-auto whitespace-pre-wrap">
                          {selected.requestBody}
                        </pre>
                      </div>
                    )}
                    {selected.responseBody && (
                      <div>
                        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Response Body</h3>
                        <pre className="bg-[var(--color-surface-2)] rounded-lg p-3 text-xs text-[var(--color-text-primary)] font-mono overflow-x-auto whitespace-pre-wrap">
                          {selected.responseBody}
                        </pre>
                      </div>
                    )}
                    {!selected.requestBody && !selected.responseBody && (
                      <p className="text-xs text-[var(--color-text-muted)]">No body data available</p>
                    )}
                  </div>
                )}

                {detailTab === "timing" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Total Duration", value: fmtDuration(selected.duration) },
                        { label: "Status Code",    value: String(selected.statusCode ?? "—") },
                        { label: "Request Size",   value: fmtSize(selected.requestSize) },
                        { label: "Response Size",  value: fmtSize(selected.responseSize) },
                        { label: "Content-Type",   value: selected.contentType || "—" },
                        { label: "Timestamp",      value: new Date(selected.timestamp).toLocaleTimeString() },
                      ].map(m => (
                        <div key={m.label} className="rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] p-3">
                          <p className="text-xs text-[var(--color-text-muted)] mb-1">{m.label}</p>
                          <p className="text-sm font-mono text-[var(--color-text-primary)]">{m.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Waterfall bar */}
                    <div className="rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] p-4">
                      <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Waterfall</h3>
                      <div className="space-y-2">
                        {[
                          { name: "DNS Lookup",    pct: 5,  color: "bg-emerald-500" },
                          { name: "TCP Connect",   pct: 10, color: "bg-blue-500" },
                          { name: "Request Sent",  pct: 5,  color: "bg-amber-500" },
                          { name: "Waiting (TTFB)", pct: 60, color: "bg-indigo-500" },
                          { name: "Content Download", pct: 20, color: "bg-violet-500" },
                        ].map(s => (
                          <div key={s.name} className="flex items-center gap-3">
                            <span className="text-xs text-[var(--color-text-muted)] w-36 shrink-0">{s.name}</span>
                            <div className="flex-1 h-3 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", s.color)}
                                style={{ width: `${s.pct}%` }}
                                role="presentation"
                              />
                            </div>
                            <span className="text-xs font-mono text-[var(--color-text-secondary)] w-16 text-right">
                              {fmtDuration(Math.round(selected.duration * s.pct / 100))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-5xl mb-4">🌐</p>
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">Select a request</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">Click a network request to inspect headers, body, and timing</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
