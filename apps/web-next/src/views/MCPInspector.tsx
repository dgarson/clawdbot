import React, { useState } from "react";
import { cn } from "../lib/utils";

type ToolKind = "read" | "write" | "exec" | "browser" | "message" | "network" | "process" | "spawn";
type ParamType = "string" | "number" | "boolean" | "object" | "array";

interface ToolParam {
  name: string;
  type: ParamType;
  required: boolean;
  description: string;
  enum?: string[];
}

interface ToolInvocation {
  id: string;
  ts: string;
  agent: string;
  input: Record<string, unknown>;
  output: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

interface MCPTool {
  name: string;
  kind: ToolKind;
  description: string;
  params: ToolParam[];
  invocations: ToolInvocation[];
  totalCalls: number;
  avgDurationMs: number;
  errorRate: number;
}

const TOOLS: MCPTool[] = [
  {
    name: "read",
    kind: "read",
    description: "Read the contents of a file. Supports text files and images. Output truncated to 2000 lines or 50KB.",
    params: [
      { name: "path", type: "string", required: true, description: "Absolute or relative path to the file" },
      { name: "offset", type: "number", required: false, description: "Line offset to start reading from" },
      { name: "limit", type: "number", required: false, description: "Maximum number of lines to read" },
    ],
    totalCalls: 1482,
    avgDurationMs: 38,
    errorRate: 0.8,
    invocations: [
      { id: "i1", ts: "02:09:46", agent: "Luis", input: { path: "CONTEXT.md" }, output: "4218 bytes read", durationMs: 44, success: true },
      { id: "i2", ts: "02:09:47", agent: "Luis", input: { path: "UX_WORK_QUEUE.md" }, output: "3102 bytes read", durationMs: 32, success: true },
      { id: "i3", ts: "02:05:12", agent: "Xavier", input: { path: "BACKLOG.md" }, output: "6840 bytes read", durationMs: 41, success: true },
      { id: "i4", ts: "02:02:00", agent: "Tim", input: { path: "nonexistent.md" }, output: "", durationMs: 8, success: false, error: "ENOENT: no such file or directory" },
    ],
  },
  {
    name: "write",
    kind: "write",
    description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories.",
    params: [
      { name: "path", type: "string", required: true, description: "Absolute or relative path to write to" },
      { name: "content", type: "string", required: true, description: "Content to write to the file" },
    ],
    totalCalls: 384,
    avgDurationMs: 72,
    errorRate: 0.3,
    invocations: [
      { id: "i1", ts: "02:12:10", agent: "Luis", input: { path: "src/views/AgentTracer.tsx", content: "<21612 bytes>" }, output: "Successfully wrote 21612 bytes", durationMs: 88, success: true },
      { id: "i2", ts: "02:09:52", agent: "Luis", input: { path: "src/views/AgentWorkload.tsx", content: "<19824 bytes>" }, output: "Successfully wrote 19824 bytes", durationMs: 76, success: true },
      { id: "i3", ts: "02:08:12", agent: "Reed", input: { path: "src/views/WorkspaceSettings.tsx", content: "<19389 bytes>" }, output: "Successfully wrote 19389 bytes", durationMs: 64, success: true },
    ],
  },
  {
    name: "edit",
    kind: "write",
    description: "Edit a file by replacing exact text. The oldText must match exactly (including whitespace). Use for precise, surgical edits.",
    params: [
      { name: "path", type: "string", required: true, description: "Path to the file to edit" },
      { name: "old_string", type: "string", required: true, description: "Exact text to replace (must match precisely)" },
      { name: "new_string", type: "string", required: true, description: "Replacement text" },
    ],
    totalCalls: 820,
    avgDurationMs: 54,
    errorRate: 4.2,
    invocations: [
      { id: "i1", ts: "02:21:00", agent: "Luis", input: { path: "App.tsx", old_string: "const LogViewer…", new_string: "…+ABTestManager" }, output: "Successfully replaced text", durationMs: 48, success: true },
      { id: "i2", ts: "02:18:00", agent: "Luis", input: { path: "App.tsx", old_string: "case 'plugins'…", new_string: "…+ab-tests+quotas" }, output: "Successfully replaced text", durationMs: 52, success: true },
      { id: "i3", ts: "01:52:00", agent: "Luis", input: { path: "App.tsx", old_string: "duplicate text that no longer exists" }, output: "", durationMs: 12, success: false, error: "Text not found in file" },
    ],
  },
  {
    name: "exec",
    kind: "exec",
    description: "Execute shell commands with background continuation. Use yieldMs/background to continue later via process tool.",
    params: [
      { name: "command", type: "string", required: true, description: "Shell command to execute" },
      { name: "workdir", type: "string", required: false, description: "Working directory for the command" },
      { name: "timeout", type: "number", required: false, description: "Timeout in milliseconds" },
      { name: "pty", type: "boolean", required: false, description: "Use a PTY (pseudo-terminal) for TTY-required commands" },
      { name: "background", type: "boolean", required: false, description: "Run in background and return immediately" },
      { name: "yieldMs", type: "number", required: false, description: "Yield after this many ms and continue via process tool" },
    ],
    totalCalls: 642,
    avgDurationMs: 1840,
    errorRate: 2.1,
    invocations: [
      { id: "i1", ts: "02:21:50", agent: "Luis", input: { command: "date && git log --oneline | head -12", workdir: "/workspace" }, output: "Sun Feb 22 02:21:50 MST 2026\n5b83d69 feat: views #66-67…", durationMs: 180, success: true },
      { id: "i2", ts: "02:21:40", agent: "Luis", input: { command: "pnpm build 2>&1 | grep -E 'ABTest|error|built'", workdir: "/workspace/apps/web-next" }, output: "ABTestManager 17.20kB\n✓ built in 1.72s", durationMs: 1720, success: true },
      { id: "i3", ts: "02:11:08", agent: "Stephan", input: { command: "curl -X POST https://api.openai.com/v1/chat/completions" }, output: "curl: (28) Operation timed out after 7500ms", durationMs: 7512, success: false, error: "Command exited with code 28" },
    ],
  },
  {
    name: "browser",
    kind: "browser",
    description: "Control the browser via OpenClaw's browser control server (status/start/stop/tabs/open/snapshot/screenshot/actions).",
    params: [
      { name: "action", type: "string", required: true, description: "Browser action", enum: ["status", "start", "stop", "tabs", "open", "focus", "close", "snapshot", "screenshot", "navigate", "act"] },
      { name: "profile", type: "string", required: false, description: "Browser profile (chrome|openclaw)" },
      { name: "targetId", type: "string", required: false, description: "Target tab ID for actions" },
      { name: "request", type: "object", required: false, description: "Action request object (kind, ref, text, etc.)" },
    ],
    totalCalls: 88,
    avgDurationMs: 420,
    errorRate: 5.7,
    invocations: [
      { id: "i1", ts: "00:42:10", agent: "Xavier", input: { action: "snapshot", profile: "chrome" }, output: "Snapshot captured — 42 interactive elements", durationMs: 380, success: true },
    ],
  },
  {
    name: "message",
    kind: "message",
    description: "Send, delete, and manage messages via channel plugins. Current channel (slack) supports send, react, read, edit, delete, pin.",
    params: [
      { name: "action", type: "string", required: true, description: "Message action", enum: ["send", "react", "read", "edit", "delete", "pin", "unpin"] },
      { name: "channel", type: "string", required: false, description: "Slack channel name or ID" },
      { name: "message", type: "string", required: false, description: "Message content to send" },
      { name: "messageId", type: "string", required: false, description: "Message ID for edit/delete/react" },
    ],
    totalCalls: 314,
    avgDurationMs: 210,
    errorRate: 0.6,
    invocations: [
      { id: "i1", ts: "01:05:00", agent: "Luis", input: { action: "send", channel: "#cb-activity", message: "Views #60-61 committed — AgentTracer, DataPipelineViewer" }, output: "Message sent: T01234/F98765", durationMs: 188, success: true },
      { id: "i2", ts: "01:02:00", agent: "Stephan", input: { action: "send", channel: "#cb-standup", message: "Daily digest…" }, output: "", durationMs: 2400, success: false, error: "Slack API 429: Too Many Requests" },
    ],
  },
  {
    name: "sessions_spawn",
    kind: "spawn",
    description: "Spawn a background sub-agent run in an isolated session and announce the result back to the requester chat.",
    params: [
      { name: "agentId", type: "string", required: true, description: "Agent ID to spawn (e.g. piper, quinn, reed, wes)" },
      { name: "task", type: "string", required: true, description: "Task description for the sub-agent" },
      { name: "label", type: "string", required: false, description: "Human-readable label for the sub-agent run" },
      { name: "model", type: "string", required: false, description: "Model override for this run" },
    ],
    totalCalls: 156,
    avgDurationMs: 4200,
    errorRate: 1.9,
    invocations: [
      { id: "i1", ts: "02:12:01", agent: "Luis", input: { agentId: "wes", label: "horizon-cost-optimizer", model: "MiniMax-M2.5" }, output: "accepted — childSessionKey: agent:wes:subagent:50908f18", durationMs: 280, success: true },
      { id: "i2", ts: "02:12:01", agent: "Luis", input: { agentId: "quinn", label: "horizon-plugin-manager" }, output: "accepted — childSessionKey: agent:quinn:subagent:a6dc9b74", durationMs: 310, success: true },
    ],
  },
  {
    name: "process",
    kind: "process",
    description: "Manage running exec sessions: list, poll, log, write, send-keys, submit, paste, kill.",
    params: [
      { name: "action", type: "string", required: true, description: "Process action", enum: ["list", "poll", "log", "write", "send-keys", "submit", "paste", "kill"] },
      { name: "sessionId", type: "string", required: false, description: "Target process session ID" },
      { name: "data", type: "string", required: false, description: "Data to write or paste" },
      { name: "timeout", type: "number", required: false, description: "Poll timeout in ms" },
    ],
    totalCalls: 42,
    avgDurationMs: 88,
    errorRate: 0,
    invocations: [
      { id: "i1", ts: "01:30:00", agent: "Tim", input: { action: "poll", sessionId: "sess-4821", timeout: 5000 }, output: "Process still running — output: '…building…'", durationMs: 92, success: true },
    ],
  },
];

const KIND_STYLES: Record<ToolKind, string> = {
  read: "bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20",
  write: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  exec: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
  browser: "bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20",
  message: "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20",
  network: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  process: "bg-[var(--color-surface-3)]/10 text-[var(--color-text-secondary)] ring-1 ring-zinc-500/20",
  spawn: "bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20",
};

const PARAM_TYPE_COLORS: Record<ParamType, string> = {
  string: "text-emerald-400",
  number: "text-amber-400",
  boolean: "text-sky-400",
  object: "text-violet-400",
  array: "text-indigo-400",
};

export default function MCPInspector() {
  const [selectedName, setSelectedName] = useState<string>("read");
  const [tab, setTab] = useState<"schema" | "history">("schema");
  const [kindFilter, setKindFilter] = useState<ToolKind | "all">("all");

  const filteredTools = TOOLS.filter((t) => kindFilter === "all" || t.kind === kindFilter);
  const selected = TOOLS.find((t) => t.name === selectedName) ?? TOOLS[0];

  const totalCalls = TOOLS.reduce((acc, t) => acc + t.totalCalls, 0);

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] px-5 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">MCP Inspector</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{TOOLS.length} registered tools · {totalCalls.toLocaleString()} total invocations</p>
        </div>
        {/* Kind filter */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setKindFilter("all")}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              kindFilter === "all" ? "bg-indigo-600 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            All
          </button>
          {(Array.from(new Set(TOOLS.map((t) => t.kind)))).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                kindFilter === k ? "bg-indigo-600 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Tool list */}
        <ul className="w-60 shrink-0 border-r border-[var(--color-border)] overflow-y-auto divide-y divide-[var(--color-border)]/50" role="listbox" aria-label="MCP tools">
          {filteredTools.map((tool) => (
            <li key={tool.name}>
              <button
                role="option"
                aria-selected={tool.name === selectedName}
                onClick={() => { setSelectedName(tool.name); setTab("schema"); }}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-[var(--color-surface-2)]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
                  tool.name === selectedName && "bg-[var(--color-surface-2)] border-l-2 border-indigo-500"
                )}
              >
                <div className="flex items-center gap-2">
                  <code className="text-xs font-semibold text-[var(--color-text-primary)]">{tool.name}</code>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", KIND_STYLES[tool.kind])}>
                    {tool.kind}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <span>{tool.totalCalls.toLocaleString()} calls</span>
                  <span>·</span>
                  <span className={tool.errorRate > 3 ? "text-rose-400" : tool.errorRate > 0 ? "text-amber-400" : "text-emerald-400"}>
                    {tool.errorRate.toFixed(1)}% err
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {/* Tool detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tool header */}
          <div className="shrink-0 border-b border-[var(--color-border)] px-5 py-4">
            <div className="flex items-center gap-3">
              <code className="text-base font-bold text-[var(--color-text-primary)]">{selected.name}</code>
              <span className={cn("text-xs px-2 py-0.5 rounded font-medium", KIND_STYLES[selected.kind])}>
                {selected.kind}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">{selected.description}</p>
            {/* Stats row */}
            <div className="mt-3 flex gap-6">
              <div className="text-center">
                <div className="text-sm font-bold text-[var(--color-text-primary)]">{selected.totalCalls.toLocaleString()}</div>
                <div className="text-xs text-[var(--color-text-muted)]">Total calls</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-[var(--color-text-primary)]">{selected.avgDurationMs}ms</div>
                <div className="text-xs text-[var(--color-text-muted)]">Avg duration</div>
              </div>
              <div className="text-center">
                <div className={cn("text-sm font-bold", selected.errorRate > 3 ? "text-rose-400" : selected.errorRate > 0 ? "text-amber-400" : "text-emerald-400")}>
                  {selected.errorRate.toFixed(1)}%
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">Error rate</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-[var(--color-text-primary)]">{selected.params.length}</div>
                <div className="text-xs text-[var(--color-text-muted)]">Parameters</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="shrink-0 border-b border-[var(--color-border)] px-5 flex" role="tablist">
            {(["schema", "history"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  tab === t ? "border-indigo-500 text-indigo-400" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {t === "schema" ? "Schema" : `History (${selected.invocations.length})`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5">
            {tab === "schema" && (
              <div className="space-y-4">
                <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                    Parameters
                  </div>
                  <div className="divide-y divide-[var(--color-border)]/50">
                    {selected.params.map((param) => (
                      <div key={param.name} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-semibold text-[var(--color-text-primary)]">{param.name}</code>
                          <span className={cn("text-xs font-mono font-medium", PARAM_TYPE_COLORS[param.type])}>
                            {param.type}
                          </span>
                          {param.required && (
                            <span className="text-xs px-1.5 py-0.5 bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20 rounded font-medium">
                              required
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">{param.description}</p>
                        {param.enum && (
                          <div className="mt-2 flex gap-1 flex-wrap">
                            {param.enum.map((v) => (
                              <code key={v} className="text-xs px-1.5 py-0.5 bg-[var(--color-surface-2)] text-[var(--color-text-primary)] rounded">
                                "{v}"
                              </code>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "history" && (
              <div className="space-y-3">
                {selected.invocations.map((inv) => (
                  <div
                    key={inv.id}
                    className={cn(
                      "bg-[var(--color-surface-1)] rounded-lg border p-4",
                      inv.success ? "border-[var(--color-border)]" : "border-rose-500/30"
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded", inv.success ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                        {inv.success ? "success" : "error"}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">{inv.ts}</span>
                      <span className="text-xs text-indigo-400">{inv.agent}</span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-auto">{inv.durationMs}ms</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Input</div>
                        <pre className="text-xs text-[var(--color-text-primary)] bg-[var(--color-surface-0)] rounded p-2 overflow-x-auto font-mono">
                          {JSON.stringify(inv.input, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1">{inv.success ? "Output" : "Error"}</div>
                        <pre className={cn("text-xs rounded p-2 overflow-x-auto font-mono", inv.success ? "bg-[var(--color-surface-0)] text-[var(--color-text-primary)]" : "bg-rose-950 text-rose-300")}>
                          {inv.error ?? inv.output}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
