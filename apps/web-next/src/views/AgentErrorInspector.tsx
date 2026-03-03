import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";

type ErrorType = "timeout" | "rate-limit" | "model-error" | "tool-failure";
type Severity = "warn" | "error" | "fatal";

interface AgentError {
  id: string;
  agentId: string;
  timestamp: string;
  errorType: ErrorType;
  severity: Severity;
  message: string;
  retryCount: number;
  fallbackModel?: string;
  resolved: boolean;
  stackTrace: string;
}

interface Agent {
  id: string;
  name: string;
}

const AGENTS: Agent[] = [
  { id: "all", name: "All Agents" },
  { id: "agent-alpha", name: "Alpha Orchestrator" },
  { id: "agent-beta", name: "Beta Synthesizer" },
  { id: "agent-gamma", name: "Gamma Retriever" },
  { id: "agent-delta", name: "Delta Classifier" },
  { id: "agent-epsilon", name: "Epsilon Router" },
  { id: "agent-zeta", name: "Zeta Validator" },
];

const MOCK_ERRORS: AgentError[] = [
  {
    id: "err-001",
    agentId: "agent-alpha",
    timestamp: "2026-02-22T13:02:11Z",
    errorType: "timeout",
    severity: "fatal",
    message: "LLM inference timed out after 30s waiting for completion token",
    retryCount: 3,
    fallbackModel: "claude-haiku-3",
    resolved: false,
    stackTrace: `Error: InferenceTimeout: request exceeded 30000ms
  at LLMClient.waitForCompletion (llm-client.ts:214)
  at AgentRunner.invokeModel (runner.ts:89)
  at AgentRunner.step (runner.ts:142)
  at Orchestrator.tick (orchestrator.ts:67)
  at EventLoop.run (event-loop.ts:33)`,
  },
  {
    id: "err-002",
    agentId: "agent-beta",
    timestamp: "2026-02-22T12:58:44Z",
    errorType: "rate-limit",
    severity: "error",
    message: "OpenAI API rate limit hit: 429 Too Many Requests on gpt-4o endpoint",
    retryCount: 5,
    fallbackModel: "gpt-4o-mini",
    resolved: true,
    stackTrace: `RateLimitError: 429 Too Many Requests
  at OpenAIProvider.request (openai.ts:102)
  at ModelRouter.dispatch (model-router.ts:58)
  at AgentRunner.invokeModel (runner.ts:89)
  at AgentRunner.step (runner.ts:142)`,
  },
  {
    id: "err-003",
    agentId: "agent-gamma",
    timestamp: "2026-02-22T12:55:30Z",
    errorType: "tool-failure",
    severity: "fatal",
    message: "Tool 'web_search' returned null response; upstream provider unreachable",
    retryCount: 2,
    resolved: false,
    stackTrace: `ToolExecutionError: tool 'web_search' returned null
  at ToolRunner.execute (tool-runner.ts:77)
  at AgentRunner.callTool (runner.ts:201)
  at AgentRunner.step (runner.ts:148)
  at Orchestrator.tick (orchestrator.ts:67)`,
  },
  {
    id: "err-004",
    agentId: "agent-delta",
    timestamp: "2026-02-22T12:51:09Z",
    errorType: "model-error",
    severity: "error",
    message: "Model returned malformed JSON; failed schema validation on output",
    retryCount: 1,
    fallbackModel: "claude-sonnet-4-6",
    resolved: true,
    stackTrace: `SchemaValidationError: output does not match expected schema
  at OutputParser.parse (output-parser.ts:44)
  at AgentRunner.parseResponse (runner.ts:175)
  at AgentRunner.step (runner.ts:155)`,
  },
  {
    id: "err-005",
    agentId: "agent-epsilon",
    timestamp: "2026-02-22T12:47:33Z",
    errorType: "timeout",
    severity: "warn",
    message: "Soft timeout warning: model response at 18s, threshold is 20s",
    retryCount: 0,
    resolved: true,
    stackTrace: `Warning: SoftTimeout at 18002ms (threshold: 20000ms)
  at LLMClient.monitorLatency (llm-client.ts:198)
  at AgentRunner.invokeModel (runner.ts:89)`,
  },
  {
    id: "err-006",
    agentId: "agent-zeta",
    timestamp: "2026-02-22T12:44:17Z",
    errorType: "tool-failure",
    severity: "error",
    message: "Tool 'read_file' permission denied: path outside sandbox boundary",
    retryCount: 0,
    resolved: false,
    stackTrace: `PermissionError: EACCES: permission denied, open '/etc/passwd'
  at ToolRunner.execute (tool-runner.ts:82)
  at AgentRunner.callTool (runner.ts:201)
  at AgentRunner.step (runner.ts:148)`,
  },
  {
    id: "err-007",
    agentId: "agent-alpha",
    timestamp: "2026-02-22T12:40:55Z",
    errorType: "rate-limit",
    severity: "warn",
    message: "Approaching rate limit: 85% of token quota consumed this minute",
    retryCount: 0,
    resolved: true,
    stackTrace: `Warning: RateLimitApproaching — used 8500/10000 TPM
  at RateLimiter.check (rate-limiter.ts:61)
  at ModelRouter.dispatch (model-router.ts:42)`,
  },
  {
    id: "err-008",
    agentId: "agent-beta",
    timestamp: "2026-02-22T12:37:22Z",
    errorType: "model-error",
    severity: "fatal",
    message: "Context window exceeded: prompt + history is 132k tokens (max 128k)",
    retryCount: 1,
    resolved: false,
    stackTrace: `ContextLengthError: input tokens 132048 > max 128000
  at TokenCounter.validate (token-counter.ts:39)
  at LLMClient.prepareRequest (llm-client.ts:155)
  at AgentRunner.invokeModel (runner.ts:89)`,
  },
  {
    id: "err-009",
    agentId: "agent-gamma",
    timestamp: "2026-02-22T12:33:08Z",
    errorType: "tool-failure",
    severity: "warn",
    message: "Tool 'exec' completed with non-zero exit code 1; stderr captured",
    retryCount: 1,
    resolved: true,
    stackTrace: `ExitCodeError: process exited with code 1
stdout: ""
stderr: "bash: foo: command not found"
  at ToolRunner.execute (tool-runner.ts:95)
  at AgentRunner.callTool (runner.ts:201)`,
  },
  {
    id: "err-010",
    agentId: "agent-delta",
    timestamp: "2026-02-22T12:28:49Z",
    errorType: "timeout",
    severity: "fatal",
    message: "Agent step timed out after 60s; no progress on current task",
    retryCount: 3,
    fallbackModel: "gpt-4o-mini",
    resolved: false,
    stackTrace: `StepTimeoutError: agent step exceeded 60000ms
  at AgentRunner.step (runner.ts:160)
  at Orchestrator.tick (orchestrator.ts:67)
  at EventLoop.run (event-loop.ts:33)`,
  },
  {
    id: "err-011",
    agentId: "agent-epsilon",
    timestamp: "2026-02-22T12:24:17Z",
    errorType: "rate-limit",
    severity: "error",
    message: "Anthropic API concurrency limit reached: max 5 simultaneous requests",
    retryCount: 4,
    fallbackModel: "claude-haiku-3",
    resolved: true,
    stackTrace: `ConcurrencyError: max concurrent requests (5) exceeded
  at AnthropicProvider.request (anthropic.ts:88)
  at ModelRouter.dispatch (model-router.ts:58)`,
  },
  {
    id: "err-012",
    agentId: "agent-zeta",
    timestamp: "2026-02-22T12:20:03Z",
    errorType: "model-error",
    severity: "error",
    message: "Model refused to process request: content policy violation flagged",
    retryCount: 0,
    resolved: false,
    stackTrace: `ContentPolicyError: request blocked by model safety filters
  at LLMClient.parseResponse (llm-client.ts:241)
  at AgentRunner.invokeModel (runner.ts:93)`,
  },
  {
    id: "err-013",
    agentId: "agent-alpha",
    timestamp: "2026-02-22T12:15:44Z",
    errorType: "tool-failure",
    severity: "error",
    message: "Tool 'browser' failed to connect: Chrome DevTools Protocol handshake failed",
    retryCount: 2,
    resolved: true,
    stackTrace: `CDPConnectionError: WebSocket handshake failed (ECONNREFUSED)
  at BrowserTool.connect (browser-tool.ts:55)
  at ToolRunner.execute (tool-runner.ts:77)
  at AgentRunner.callTool (runner.ts:201)`,
  },
  {
    id: "err-014",
    agentId: "agent-beta",
    timestamp: "2026-02-22T12:11:29Z",
    errorType: "model-error",
    severity: "warn",
    message: "Model output truncated mid-sentence; finish_reason was 'length'",
    retryCount: 1,
    resolved: true,
    stackTrace: `TruncationWarning: finish_reason=length; response may be incomplete
  at OutputParser.check (output-parser.ts:31)
  at AgentRunner.parseResponse (runner.ts:170)`,
  },
  {
    id: "err-015",
    agentId: "agent-gamma",
    timestamp: "2026-02-22T12:07:55Z",
    errorType: "timeout",
    severity: "error",
    message: "Tool 'web_fetch' stalled for 25s waiting for remote server response",
    retryCount: 2,
    resolved: true,
    stackTrace: `FetchTimeoutError: request to https://slow.example.com timed out after 25000ms
  at WebFetchTool.fetch (web-fetch-tool.ts:68)
  at ToolRunner.execute (tool-runner.ts:77)
  at AgentRunner.callTool (runner.ts:201)`,
  },
];

const ERROR_TYPE_COLORS: Record<ErrorType, string> = {
  timeout: "bg-orange-900/60 text-orange-300 border border-orange-700",
  "rate-limit": "bg-yellow-900/60 text-yellow-300 border border-yellow-700",
  "model-error": "bg-purple-900/60 text-purple-300 border border-purple-700",
  "tool-failure": "bg-red-900/60 text-red-300 border border-red-700",
};

const SEVERITY_COLORS: Record<Severity, string> = {
  warn: "text-orange-400",
  error: "text-yellow-400",
  fatal: "text-red-400",
};

const SEVERITY_ROW_COLORS: Record<Severity, string> = {
  warn: "border-l-2 border-orange-500",
  error: "border-l-2 border-yellow-500",
  fatal: "border-l-2 border-red-500",
};

function formatTs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function Badge({ type }: { type: ErrorType }) {
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase tracking-wide", ERROR_TYPE_COLORS[type])}>
      {type}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: Severity }) {
  const icons: Record<Severity, string> = { warn: "⚠", error: "✖", fatal: "☠" };
  return <span className={cn("text-sm font-bold", SEVERITY_COLORS[severity])}>{icons[severity]}</span>;
}

export default function AgentErrorInspector() {
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [filterType, setFilterType] = useState<ErrorType | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return MOCK_ERRORS.filter((e) => {
      if (selectedAgent !== "all" && e.agentId !== selectedAgent) {return false;}
      if (filterType !== "all" && e.errorType !== filterType) {return false;}
      if (filterSeverity !== "all" && e.severity !== filterSeverity) {return false;}
      if (search && !e.message.toLowerCase().includes(search.toLowerCase())) {return false;}
      return true;
    });
  }, [selectedAgent, filterType, filterSeverity, search]);

  const stats = useMemo(() => {
    const base = selectedAgent === "all" ? MOCK_ERRORS : MOCK_ERRORS.filter((e) => e.agentId === selectedAgent);
    const total = base.length;
    const resolved = base.filter((e) => e.resolved).length;
    const avgRetry = total > 0 ? (base.reduce((s, e) => s + e.retryCount, 0) / total).toFixed(1) : "0";
    const typeCounts: Partial<Record<ErrorType, number>> = {};
    base.forEach((e) => { typeCounts[e.errorType] = (typeCounts[e.errorType] ?? 0) + 1; });
    const mostCommon = (Object.entries(typeCounts).toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? "—") as ErrorType | "—";
    const pctResolved = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, avgRetry, mostCommon, pctResolved };
  }, [selectedAgent]);

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 p-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Agent Error Inspector</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Drill-down error diagnostics for agent runs</p>
        </div>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Errors", value: stats.total, accent: "text-red-400" },
          { label: "Most Common", value: stats.mostCommon, accent: "text-orange-400" },
          { label: "Avg Retries", value: stats.avgRetry, accent: "text-yellow-400" },
          { label: "% Resolved", value: `${stats.pctResolved}%`, accent: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={cn("text-2xl font-bold font-mono", s.accent)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 mb-5 bg-zinc-800 p-3 rounded-xl border border-zinc-700">
        <input
          type="text"
          placeholder="Search by message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-600 text-zinc-100 rounded-lg px-3 py-1.5 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ErrorType | "all")}
          className="bg-zinc-900 border border-zinc-600 text-zinc-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="all">All Types</option>
          <option value="timeout">Timeout</option>
          <option value="rate-limit">Rate Limit</option>
          <option value="model-error">Model Error</option>
          <option value="tool-failure">Tool Failure</option>
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as Severity | "all")}
          className="bg-zinc-900 border border-zinc-600 text-zinc-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="all">All Severities</option>
          <option value="fatal">Fatal</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
        </select>
        <span className="text-zinc-400 text-sm self-center">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Error List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-zinc-500">
            <p className="text-4xl mb-3">✓</p>
            <p className="text-lg font-medium">No errors match your filters</p>
          </div>
        )}
        {filtered.map((err) => {
          const isExpanded = expandedId === err.id;
          const agentName = AGENTS.find((a) => a.id === err.agentId)?.name ?? err.agentId;
          return (
            <div
              key={err.id}
              className={cn(
                "bg-zinc-800 rounded-xl border border-zinc-700 overflow-hidden transition-all",
                SEVERITY_ROW_COLORS[err.severity]
              )}
            >
              {/* Row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : err.id)}
                className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-zinc-750 focus:outline-none group"
              >
                <SeverityIcon severity={err.severity} />
                <span className="text-zinc-400 text-xs font-mono w-20 shrink-0">{formatTs(err.timestamp)}</span>
                <Badge type={err.errorType} />
                <span className="flex-1 text-sm text-zinc-200 min-w-[180px] truncate">{err.message}</span>
                <span className="text-xs text-zinc-500 shrink-0">
                  Agent: <span className="text-zinc-300">{agentName}</span>
                </span>
                <span className="text-xs text-zinc-500 shrink-0">
                  Retries: <span className={cn("font-mono", err.retryCount >= 3 ? "text-red-400" : "text-zinc-300")}>{err.retryCount}</span>
                </span>
                {err.fallbackModel && (
                  <span className="text-xs bg-blue-900/50 border border-blue-700 text-blue-300 px-2 py-0.5 rounded font-mono shrink-0">
                    ↪ {err.fallbackModel}
                  </span>
                )}
                {err.resolved ? (
                  <span className="text-xs text-emerald-400 font-semibold shrink-0">✓ resolved</span>
                ) : (
                  <span className="text-xs text-red-400 font-semibold shrink-0">● active</span>
                )}
                <span className={cn("text-zinc-500 text-xs shrink-0 transition-transform", isExpanded && "rotate-180")}>▼</span>
              </button>

              {/* Expanded stack trace */}
              {isExpanded && (
                <div className="border-t border-zinc-700 bg-zinc-950 px-4 py-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 font-semibold">Stack Trace</p>
                  <pre className="text-xs font-mono text-green-300 leading-relaxed whitespace-pre-wrap break-all">
                    {err.stackTrace}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
