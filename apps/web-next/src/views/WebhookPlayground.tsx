import React, { useState } from "react"
import { cn } from "../lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

type HttpMethod = "POST" | "PUT" | "PATCH"

interface HeaderRow {
  id: string
  key: string
  value: string
}

interface DeliveryEntry {
  id: string
  timestamp: string
  endpoint: string
  method: HttpMethod
  statusCode: number
  responseTimeMs: number
  event: string
  requestHeaders: HeaderRow[]
  requestBody: string
  responseHeaders: Record<string, string>
  responseBody: string
}

interface ResponseState {
  statusCode: number | null
  headers: Record<string, string>
  body: string
  timeMs: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let idCounter = 0
function uid(): string {
  idCounter += 1
  return `uid-${Date.now()}-${idCounter}`
}

function statusBadgeColor(code: number): string {
  if (code >= 200 && code < 300) {return "bg-emerald-400/15 text-emerald-400 border-emerald-400/30"}
  if (code >= 300 && code < 400) {return "bg-amber-400/15 text-amber-400 border-amber-400/30"}
  if (code >= 400 && code < 500) {return "bg-rose-400/15 text-rose-400 border-rose-400/30"}
  if (code >= 500) {return "bg-rose-500/15 text-rose-500 border-rose-500/30"}
  return "bg-zinc-700 text-zinc-300 border-zinc-600"
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

// ── Seed Data ────────────────────────────────────────────────────────────────

const SEED_DELIVERIES: DeliveryEntry[] = [
  {
    id: uid(),
    timestamp: "2026-02-22T03:12:04Z",
    endpoint: "https://api.acme.dev/hooks/agent-events",
    method: "POST",
    statusCode: 200,
    responseTimeMs: 142,
    event: "agent.task.completed",
    requestHeaders: [
      { id: uid(), key: "Content-Type", value: "application/json" },
      { id: uid(), key: "X-Webhook-Signature", value: "sha256=9a1f3c…e7b2" },
    ],
    requestBody: JSON.stringify(
      {
        event: "agent.task.completed",
        payload: {
          agentId: "agent_9xkLm3",
          taskId: "task_Qr82nZ",
          status: "success",
          durationMs: 4821,
          output: { summary: "Generated quarterly report", tokens: 3280 },
        },
        timestamp: "2026-02-22T03:12:04Z",
      },
      null,
      2,
    ),
    responseHeaders: {
      "Content-Type": "application/json",
      "X-Request-Id": "req_abc123",
    },
    responseBody: JSON.stringify({ received: true, id: "dlv_001" }, null, 2),
  },
  {
    id: uid(),
    timestamp: "2026-02-22T03:10:47Z",
    endpoint: "https://api.acme.dev/hooks/inference",
    method: "POST",
    statusCode: 200,
    responseTimeMs: 89,
    event: "model.inference.done",
    requestHeaders: [
      { id: uid(), key: "Content-Type", value: "application/json" },
      { id: uid(), key: "Authorization", value: "Bearer wh_live_k8…x2" },
    ],
    requestBody: JSON.stringify(
      {
        event: "model.inference.done",
        payload: {
          modelId: "minimax-m2.5",
          requestId: "inf_7hG4pL",
          inputTokens: 1240,
          outputTokens: 860,
          latencyMs: 1823,
          finishReason: "stop",
        },
        timestamp: "2026-02-22T03:10:47Z",
      },
      null,
      2,
    ),
    responseHeaders: {
      "Content-Type": "application/json",
      "X-Request-Id": "req_def456",
    },
    responseBody: JSON.stringify({ received: true, id: "dlv_002" }, null, 2),
  },
  {
    id: uid(),
    timestamp: "2026-02-22T03:08:15Z",
    endpoint: "https://api.acme.dev/hooks/sessions",
    method: "POST",
    statusCode: 201,
    responseTimeMs: 210,
    event: "session.created",
    requestHeaders: [
      { id: uid(), key: "Content-Type", value: "application/json" },
      { id: uid(), key: "X-Webhook-Signature", value: "sha256=4b2d8e…f1a9" },
    ],
    requestBody: JSON.stringify(
      {
        event: "session.created",
        payload: {
          sessionId: "sess_Mn4kP9",
          agentId: "agent_9xkLm3",
          channel: "slack",
          createdAt: "2026-02-22T03:08:15Z",
        },
        timestamp: "2026-02-22T03:08:15Z",
      },
      null,
      2,
    ),
    responseHeaders: {
      "Content-Type": "application/json",
      "X-Request-Id": "req_ghi789",
      Location: "/deliveries/dlv_003",
    },
    responseBody: JSON.stringify(
      { received: true, id: "dlv_003", queued: true },
      null,
      2,
    ),
  },
  {
    id: uid(),
    timestamp: "2026-02-22T02:59:33Z",
    endpoint: "https://api.acme.dev/hooks/billing",
    method: "POST",
    statusCode: 500,
    responseTimeMs: 3042,
    event: "billing.usage.threshold",
    requestHeaders: [
      { id: uid(), key: "Content-Type", value: "application/json" },
      { id: uid(), key: "X-Webhook-Signature", value: "sha256=e8c4a1…d3f7" },
    ],
    requestBody: JSON.stringify(
      {
        event: "billing.usage.threshold",
        payload: {
          orgId: "org_Xt9wK2",
          threshold: 0.9,
          currentUsage: 892.4,
          limit: 1000,
          currency: "USD",
        },
        timestamp: "2026-02-22T02:59:33Z",
      },
      null,
      2,
    ),
    responseHeaders: { "Content-Type": "text/plain" },
    responseBody: "Internal Server Error: database connection timeout",
  },
  {
    id: uid(),
    timestamp: "2026-02-22T02:52:11Z",
    endpoint: "https://api.acme.dev/hooks/deployments",
    method: "PUT",
    statusCode: 200,
    responseTimeMs: 174,
    event: "deployment.status.changed",
    requestHeaders: [
      { id: uid(), key: "Content-Type", value: "application/json" },
      { id: uid(), key: "X-Api-Key", value: "whk_prod_a8…q1" },
    ],
    requestBody: JSON.stringify(
      {
        event: "deployment.status.changed",
        payload: {
          deploymentId: "deploy_B3mZ7x",
          previousStatus: "building",
          newStatus: "live",
          region: "us-west-2",
          sha: "a1b2c3d",
        },
        timestamp: "2026-02-22T02:52:11Z",
      },
      null,
      2,
    ),
    responseHeaders: {
      "Content-Type": "application/json",
      "X-Request-Id": "req_jkl012",
    },
    responseBody: JSON.stringify({ received: true, id: "dlv_005" }, null, 2),
  },
  {
    id: uid(),
    timestamp: "2026-02-22T02:44:58Z",
    endpoint: "https://api.acme.dev/hooks/agent-events",
    method: "PATCH",
    statusCode: 422,
    responseTimeMs: 67,
    event: "agent.error.raised",
    requestHeaders: [
      { id: uid(), key: "Content-Type", value: "application/json" },
      { id: uid(), key: "X-Webhook-Signature", value: "sha256=1f9a3b…c4e8" },
    ],
    requestBody: JSON.stringify(
      {
        event: "agent.error.raised",
        payload: {
          agentId: "agent_9xkLm3",
          taskId: "task_Hk29bF",
          error: {
            code: "CONTEXT_LIMIT_EXCEEDED",
            message: "Input exceeded maximum context window of 200k tokens",
          },
          severity: "warning",
        },
        timestamp: "2026-02-22T02:44:58Z",
      },
      null,
      2,
    ),
    responseHeaders: { "Content-Type": "application/json" },
    responseBody: JSON.stringify(
      {
        error: "Unprocessable Entity",
        message: "Missing required field: retry_policy",
      },
      null,
      2,
    ),
  },
  {
    id: uid(),
    timestamp: "2026-02-22T02:38:02Z",
    endpoint: "https://api.acme.dev/hooks/tools",
    method: "POST",
    statusCode: 204,
    responseTimeMs: 53,
    event: "tool.execution.completed",
    requestHeaders: [
      { id: uid(), key: "Content-Type", value: "application/json" },
      { id: uid(), key: "X-Webhook-Signature", value: "sha256=7d3e9f…b2a1" },
    ],
    requestBody: JSON.stringify(
      {
        event: "tool.execution.completed",
        payload: {
          toolName: "web_search",
          sessionId: "sess_Mn4kP9",
          durationMs: 1120,
          resultCount: 8,
          cached: false,
        },
        timestamp: "2026-02-22T02:38:02Z",
      },
      null,
      2,
    ),
    responseHeaders: {},
    responseBody: "",
  },
]

// ── JSON Syntax Highlighter ──────────────────────────────────────────────────

function JsonHighlight({ text }: { text: string }): React.ReactElement {
  const formatted = formatJson(text)
  const lines = formatted.split("\n")

  return (
    <pre className="text-sm font-mono leading-relaxed whitespace-pre-wrap break-all">
      {lines.map((line, li) => {
        const parts: React.ReactElement[] = []
        let remaining = line
        let ki = 0

        // Match key: "key":
        const keyMatch = remaining.match(/^(\s*)"([^"]+)"(:)/)
        if (keyMatch) {
          parts.push(
            <span key={ki++} className="text-zinc-500">
              {keyMatch[1]}
            </span>,
          )
          parts.push(
            <span key={ki++} className="text-indigo-400">
              &quot;{keyMatch[2]}&quot;
            </span>,
          )
          parts.push(
            <span key={ki++} className="text-zinc-500">
              {keyMatch[3]}
            </span>,
          )
          remaining = remaining.slice(keyMatch[0].length)
        }

        // Match string value: "value"
        const strMatch = remaining.match(/^(\s*)"([^"]*)"(.*)$/)
        if (strMatch) {
          parts.push(
            <span key={ki++} className="text-zinc-400">
              {strMatch[1]}
            </span>,
          )
          parts.push(
            <span key={ki++} className="text-emerald-400">
              &quot;{strMatch[2]}&quot;
            </span>,
          )
          parts.push(
            <span key={ki++} className="text-zinc-500">
              {strMatch[3]}
            </span>,
          )
        } else {
          // Match numbers, booleans, null
          const valMatch = remaining.match(
            /^(\s*)(true|false|null|-?\d+\.?\d*)(.*)/,
          )
          if (valMatch) {
            parts.push(
              <span key={ki++} className="text-zinc-400">
                {valMatch[1]}
              </span>,
            )
            const cls =
              valMatch[2] === "true" || valMatch[2] === "false"
                ? "text-amber-400"
                : valMatch[2] === "null"
                  ? "text-rose-400"
                  : "text-sky-400"
            parts.push(
              <span key={ki++} className={cls}>
                {valMatch[2]}
              </span>,
            )
            parts.push(
              <span key={ki++} className="text-zinc-500">
                {valMatch[3]}
              </span>,
            )
          } else if (remaining.length > 0) {
            parts.push(
              <span key={ki++} className="text-zinc-400">
                {remaining}
              </span>,
            )
          }
        }

        return (
          <React.Fragment key={li}>
            {parts.length > 0 ? parts : <span className="text-zinc-500">{line}</span>}
            {li < lines.length - 1 ? "\n" : null}
          </React.Fragment>
        )
      })}
    </pre>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function WebhookPlayground(): React.ReactElement {
  // -- Request state
  const [url, setUrl] = useState("https://api.acme.dev/hooks/agent-events")
  const [method, setMethod] = useState<HttpMethod>("POST")
  const [headers, setHeaders] = useState<HeaderRow[]>([
    { id: uid(), key: "Content-Type", value: "application/json" },
    { id: uid(), key: "X-Webhook-Signature", value: "" },
  ])
  const [body, setBody] = useState(
    JSON.stringify(
      {
        event: "agent.task.completed",
        payload: { agentId: "agent_test", taskId: "task_test", status: "success" },
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  )

  // -- Signature verification
  const [signatureEnabled, setSignatureEnabled] = useState(false)
  const [hmacSecret, setHmacSecret] = useState("")

  // -- Response state
  const [response, setResponse] = useState<ResponseState>({
    statusCode: null,
    headers: {},
    body: "",
    timeMs: null,
  })

  // -- Sending state
  const [sending, setSending] = useState(false)
  const [lastFailed, setLastFailed] = useState(false)

  // -- Delivery history
  const [deliveries] = useState<DeliveryEntry[]>(SEED_DELIVERIES)
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null)

  // -- Active panel tab for mobile / narrow
  const [activeBottomTab, setActiveBottomTab] = useState<"history" | "config" | "response">("history")

  // -- Handlers
  function handleAddHeader(): void {
    setHeaders((prev) => [...prev, { id: uid(), key: "", value: "" }])
  }

  function handleRemoveHeader(id: string): void {
    setHeaders((prev) => prev.filter((h) => h.id !== id))
  }

  function handleHeaderChange(id: string, field: "key" | "value", val: string): void {
    setHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: val } : h)),
    )
  }

  function handleSend(): void {
    setSending(true)
    setLastFailed(false)

    // Simulate network delay + random response
    const delay = 120 + Math.floor(Math.random() * 400)
    setTimeout(() => {
      const codes = [200, 200, 200, 201, 204, 400, 500]
      const code = codes[Math.floor(Math.random() * codes.length)] as number
      const isSuccess = code >= 200 && code < 300

      setResponse({
        statusCode: code,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": `req_${Math.random().toString(36).slice(2, 10)}`,
          ...(isSuccess ? { "X-RateLimit-Remaining": "147" } : {}),
        },
        body: isSuccess
          ? JSON.stringify({ received: true, id: `dlv_${Math.random().toString(36).slice(2, 8)}` }, null, 2)
          : code === 400
            ? JSON.stringify({ error: "Bad Request", message: "Invalid payload structure" }, null, 2)
            : JSON.stringify({ error: "Internal Server Error", message: "Upstream timeout" }, null, 2),
        timeMs: delay,
      })

      setSending(false)
      setLastFailed(!isSuccess)
    }, delay)
  }

  function handleLoadDelivery(entry: DeliveryEntry): void {
    setSelectedDeliveryId(entry.id)
    setUrl(entry.endpoint)
    setMethod(entry.method)
    setHeaders(entry.requestHeaders.map((h) => ({ ...h, id: uid() })))
    setBody(entry.requestBody)
    setResponse({
      statusCode: entry.statusCode,
      headers: entry.responseHeaders,
      body: entry.responseBody,
      timeMs: entry.responseTimeMs,
    })
    setLastFailed(entry.statusCode >= 400)
  }

  function formatTime(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
  }

  // -- Render
  const methods: HttpMethod[] = ["POST", "PUT", "PATCH"]

  const inputBase =
    "bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          📨 Webhook Playground
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Test, inspect, and replay webhook deliveries
        </p>
      </div>

      {/* Top section: Left + Right panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* ── Left Panel: Endpoint Configuration ────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              📤 Request
            </h2>
            <div className="flex items-center gap-2">
              {lastFailed && (
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-400/15 text-amber-400 border border-amber-400/30 hover:bg-amber-400/25 transition-colors disabled:opacity-50"
                >
                  🔄 Retry
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={sending || !url.trim()}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                  sending
                    ? "bg-indigo-500/30 text-indigo-300 cursor-wait"
                    : "bg-indigo-500 text-white hover:bg-indigo-400 active:bg-indigo-600",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                {sending ? "⏳ Sending…" : "▶ Send"}
              </button>
            </div>
          </div>

          {/* URL + Method */}
          <div className="flex gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-indigo-400 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
            >
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className={cn(inputBase, "flex-1 font-mono")}
            />
          </div>

          {/* Signature toggle */}
          <div className="flex items-center gap-3 bg-zinc-800/50 rounded-lg px-3 py-2.5 border border-zinc-800">
            <button
              onClick={() => setSignatureEnabled(!signatureEnabled)}
              className={cn(
                "w-9 h-5 rounded-full transition-colors relative flex-shrink-0",
                signatureEnabled ? "bg-indigo-500" : "bg-zinc-700",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                  signatureEnabled ? "left-[18px]" : "left-0.5",
                )}
              />
            </button>
            <span className="text-xs text-zinc-400">HMAC-SHA256 Signature</span>
            {signatureEnabled && (
              <input
                type="text"
                value={hmacSecret}
                onChange={(e) => setHmacSecret(e.target.value)}
                placeholder="whsec_…"
                className={cn(inputBase, "flex-1 text-xs font-mono")}
              />
            )}
          </div>

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                Headers
              </span>
              <button
                onClick={handleAddHeader}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                ➕ Add
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {headers.map((h) => (
                <div key={h.id} className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={h.key}
                    onChange={(e) => handleHeaderChange(h.id, "key", e.target.value)}
                    placeholder="Key"
                    className={cn(inputBase, "w-1/3 text-xs font-mono")}
                  />
                  <input
                    type="text"
                    value={h.value}
                    onChange={(e) => handleHeaderChange(h.id, "value", e.target.value)}
                    placeholder="Value"
                    className={cn(inputBase, "flex-1 text-xs font-mono")}
                  />
                  <button
                    onClick={() => handleRemoveHeader(h.id)}
                    className="text-zinc-600 hover:text-rose-400 transition-colors text-sm px-1 flex-shrink-0"
                    title="Remove header"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Request body */}
          <div className="flex-1 flex flex-col">
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-2">
              Body
            </span>
            <div className="relative flex-1 min-h-[200px]">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
                className={cn(
                  "absolute inset-0 w-full h-full bg-transparent text-transparent caret-white",
                  "font-mono text-sm leading-relaxed p-3 resize-none",
                  "border border-zinc-700 rounded-md",
                  "focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500",
                  "z-10",
                )}
              />
              <div
                className={cn(
                  "absolute inset-0 w-full h-full overflow-auto",
                  "font-mono text-sm leading-relaxed p-3",
                  "border border-transparent rounded-md",
                  "bg-zinc-800 pointer-events-none",
                )}
              >
                <JsonHighlight text={body} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel: Response Viewer ──────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            📥 Response
          </h2>

          {response.statusCode === null ? (
            <div className="flex-1 flex items-center justify-center text-zinc-600">
              <div className="text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm">No response yet</p>
                <p className="text-xs text-zinc-700 mt-1">
                  Send a request or select a delivery
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Status + timing */}
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border",
                    statusBadgeColor(response.statusCode),
                  )}
                >
                  {response.statusCode >= 200 && response.statusCode < 300
                    ? "✅"
                    : response.statusCode >= 400
                      ? "❌"
                      : "⚠️"}{" "}
                  {response.statusCode}
                </span>
                {response.timeMs !== null && (
                  <span className="text-xs text-zinc-500 font-mono">
                    ⏱ {response.timeMs}ms
                  </span>
                )}
              </div>

              {/* Response headers */}
              <div>
                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                  Response Headers
                </span>
                <div className="mt-2 bg-zinc-800 rounded-md p-3 text-xs font-mono space-y-1 max-h-[120px] overflow-auto">
                  {Object.entries(response.headers).length === 0 ? (
                    <span className="text-zinc-600">No headers</span>
                  ) : (
                    Object.entries(response.headers).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-indigo-400">{k}</span>
                        <span className="text-zinc-600">: </span>
                        <span className="text-zinc-300">{v}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Response body */}
              <div className="flex-1 flex flex-col min-h-0">
                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-2">
                  Response Body
                </span>
                <div className="flex-1 bg-zinc-800 rounded-md p-3 overflow-auto min-h-[200px]">
                  {response.body ? (
                    <JsonHighlight text={response.body} />
                  ) : (
                    <span className="text-xs text-zinc-600 font-mono">
                      Empty response body
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom Panel: Delivery History ─────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        {/* Tabs for narrow screens */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            🕐 Delivery History
          </h2>
          <div className="flex gap-1 lg:hidden">
            {(["history", "config", "response"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveBottomTab(tab)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md transition-colors",
                  activeBottomTab === tab
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {tab === "history" ? "📋" : tab === "config" ? "📤" : "📥"}
              </button>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-3 px-3 py-2 text-xs text-zinc-500 font-medium uppercase tracking-wider border-b border-zinc-800">
          <span>Time</span>
          <span>Endpoint</span>
          <span className="text-center">Event</span>
          <span className="text-center">Status</span>
          <span className="text-right">Latency</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-zinc-800/50 max-h-[320px] overflow-auto">
          {deliveries.map((d) => (
            <button
              key={d.id}
              onClick={() => handleLoadDelivery(d)}
              className={cn(
                "w-full grid grid-cols-[1fr_2fr_auto_auto_auto] gap-3 px-3 py-3 text-left transition-colors",
                "hover:bg-zinc-800/60",
                selectedDeliveryId === d.id
                  ? "bg-indigo-500/10 border-l-2 border-l-indigo-500"
                  : "border-l-2 border-l-transparent",
              )}
            >
              <span className="text-xs text-zinc-400 font-mono tabular-nums">
                {formatTime(d.timestamp)}
              </span>
              <span className="text-xs text-zinc-300 font-mono truncate">
                <span className="text-indigo-400 font-semibold mr-1.5">
                  {d.method}
                </span>
                {d.endpoint.replace("https://", "")}
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                {d.event}
              </span>
              <span className="text-center">
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border",
                    statusBadgeColor(d.statusCode),
                  )}
                >
                  {d.statusCode}
                </span>
              </span>
              <span
                className={cn(
                  "text-xs font-mono tabular-nums text-right",
                  d.responseTimeMs > 1000
                    ? "text-amber-400"
                    : d.responseTimeMs > 500
                      ? "text-zinc-400"
                      : "text-emerald-400",
                )}
              >
                {d.responseTimeMs}ms
              </span>
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
          <span className="text-xs text-zinc-600">
            {deliveries.length} deliveries · Click to replay
          </span>
          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Success
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Warning
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Error
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
