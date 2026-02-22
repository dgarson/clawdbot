import React, { useState, useMemo, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = "critical" | "error" | "warning";
type CrashStatus = "new" | "acknowledged" | "resolved";

interface AgentContext {
  name: string;
  emoji: string;
  role: string;
  model: string;
  sessionId: string;
}

interface SystemContext {
  nodeVersion: string;
  os: string;
  memoryUsageMb: number;
  memoryTotalMb: number;
}

interface ToolCallContext {
  toolName: string;
  parameters: Record<string, string>;
  timeoutMs?: number;
}

interface CrashReport {
  id: string;
  severity: Severity;
  status: CrashStatus;
  errorType: string;
  message: string;
  stackTrace: string;
  timestamp: Date;
  agent: AgentContext;
  system: SystemContext;
  toolCall?: ToolCallContext;
}

type FilterChip =
  | "all"
  | "new"
  | "acknowledged"
  | "resolved"
  | "critical"
  | "error"
  | "warning";

type SortField = "severity" | "time";
type SortDirection = "asc" | "desc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number): Date => new Date(now.getTime() - ms);
const mins = (n: number): number => n * 60_000;
const hrs = (n: number): number => n * 3_600_000;

function relativeTime(date: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) {return "just now";}
  if (diffMins < 60) {return `${diffMins}m ago`;}
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) {return `${diffHrs}h ago`;}
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  error: 1,
  warning: 2,
};

// ─── Seed Data ───────────────────────────────────────────────────────────────

const SEED_CRASHES: CrashReport[] = [
  {
    id: "crash-001",
    severity: "critical",
    status: "new",
    errorType: "ToolCallError",
    message:
      "Tool call 'exec' timed out after 30000ms. The command did not produce output within the expected window. Agent was attempting to run a long-running build process without background flag.",
    stackTrace: `ToolCallError: Tool call 'exec' timed out after 30000ms
    at ToolRunner.execute (/opt/openclaw/core/tool-runner.ts:142:15)
    at async AgentLoop.invokeToolCall (/opt/openclaw/core/agent-loop.ts:387:22)
    at async AgentLoop.processToolUse (/opt/openclaw/core/agent-loop.ts:291:18)
    at async AgentLoop.step (/opt/openclaw/core/agent-loop.ts:178:14)
    at async AgentLoop.run (/opt/openclaw/core/agent-loop.ts:94:9)
    at async SessionManager.executeAgent (/opt/openclaw/core/session-manager.ts:203:5)
    at async CronScheduler.dispatch (/opt/openclaw/core/cron.ts:89:7)`,
    timestamp: ago(mins(12)),
    agent: {
      name: "Luis",
      emoji: "🎨",
      role: "Principal UX Engineer",
      model: "claude-sonnet-4-6",
      sessionId: "agent:luis:cron:e61f3c46",
    },
    system: {
      nodeVersion: "v22.22.0",
      os: "Darwin 24.6.0 (arm64)",
      memoryUsageMb: 1842,
      memoryTotalMb: 16384,
    },
    toolCall: {
      toolName: "exec",
      parameters: { command: "pnpm build", workdir: "/apps/web-next" },
      timeoutMs: 30000,
    },
  },
  {
    id: "crash-002",
    severity: "critical",
    status: "new",
    errorType: "UnhandledRejection",
    message:
      "Unhandled promise rejection: Cannot read properties of undefined (reading 'content'). The API response was missing expected nested fields after a model retry cycle.",
    stackTrace: `TypeError: Cannot read properties of undefined (reading 'content')
    at parseModelResponse (/opt/openclaw/core/model-client.ts:267:34)
    at async ModelClient.chat (/opt/openclaw/core/model-client.ts:189:20)
    at async AgentLoop.getCompletion (/opt/openclaw/core/agent-loop.ts:234:22)
    at async AgentLoop.step (/opt/openclaw/core/agent-loop.ts:165:18)
    at async AgentLoop.run (/opt/openclaw/core/agent-loop.ts:94:9)
    at async SessionManager.executeAgent (/opt/openclaw/core/session-manager.ts:203:5)`,
    timestamp: ago(mins(34)),
    agent: {
      name: "Stephan",
      emoji: "🧠",
      role: "Strategic Advisor",
      model: "o3",
      sessionId: "agent:stephan:chat:b2d91e4a",
    },
    system: {
      nodeVersion: "v22.22.0",
      os: "Darwin 24.6.0 (arm64)",
      memoryUsageMb: 2104,
      memoryTotalMb: 16384,
    },
  },
  {
    id: "crash-003",
    severity: "critical",
    status: "acknowledged",
    errorType: "OutOfMemoryError",
    message:
      "FATAL ERROR: Reached heap limit — Allocation failed — JavaScript heap out of memory. Process was consuming 15.8GB at time of crash during large file analysis.",
    stackTrace: `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
 1: 0x100f1a0b4 node::Abort()
 2: 0x100f1a22c node::ModifyCodeGenerationFromStrings()
 3: 0x101092f70 v8::Utils::ReportOOMFailure()
 4: 0x101092f0c v8::internal::V8::FatalProcessOutOfMemory()
 5: 0x10126b364 v8::internal::Heap::FatalProcessOutOfMemory()
 6: 0x10126d0f0 v8::internal::Heap::CollectGarbage()
    at ImageAnalyzer.processBuffer (/opt/openclaw/plugins/image/analyzer.ts:94:11)
    at async AgentLoop.invokeToolCall (/opt/openclaw/core/agent-loop.ts:387:22)`,
    timestamp: ago(hrs(1) + mins(15)),
    agent: {
      name: "Piper",
      emoji: "✨",
      role: "Interaction Designer",
      model: "claude-sonnet-4-6",
      sessionId: "agent:piper:subagent:d7c8e57e",
    },
    system: {
      nodeVersion: "v22.22.0",
      os: "Darwin 24.6.0 (arm64)",
      memoryUsageMb: 15820,
      memoryTotalMb: 16384,
    },
    toolCall: {
      toolName: "image",
      parameters: { image: "/tmp/large-screenshot.png", prompt: "Analyze layout" },
    },
  },
  {
    id: "crash-004",
    severity: "error",
    status: "new",
    errorType: "RateLimitError",
    message:
      "API rate limit exceeded for model 'o3'. Retry-After: 45s. Agent had exhausted the 60-request/min tier limit during a batch orchestration run.",
    stackTrace: `RateLimitError: 429 Too Many Requests — rate limit exceeded
    at ModelClient.handleResponse (/opt/openclaw/core/model-client.ts:301:13)
    at async ModelClient.chat (/opt/openclaw/core/model-client.ts:195:18)
    at async RetryPolicy.execute (/opt/openclaw/core/retry.ts:42:16)
    at async AgentLoop.getCompletion (/opt/openclaw/core/agent-loop.ts:234:22)
    at async AgentLoop.step (/opt/openclaw/core/agent-loop.ts:165:18)
    at async AgentLoop.run (/opt/openclaw/core/agent-loop.ts:94:9)
    at async OrchestratorLoop.dispatchBatch (/opt/openclaw/core/orchestrator.ts:118:11)`,
    timestamp: ago(hrs(2) + mins(5)),
    agent: {
      name: "Xavier",
      emoji: "⚡",
      role: "CTO",
      model: "o3",
      sessionId: "agent:xavier:chat:f9a213cc",
    },
    system: {
      nodeVersion: "v22.22.0",
      os: "Darwin 24.6.0 (arm64)",
      memoryUsageMb: 1523,
      memoryTotalMb: 16384,
    },
  },
  {
    id: "crash-005",
    severity: "error",
    status: "resolved",
    errorType: "FileNotFoundError",
    message:
      "ENOENT: no such file or directory, open '/Users/openclaw/.openclaw/workspace/reed/TOOLS.md'. File was expected by agent startup sequence but had been moved during a workspace reorganization.",
    stackTrace: `Error: ENOENT: no such file or directory, open '/Users/openclaw/.openclaw/workspace/reed/TOOLS.md'
    at Object.openSync (node:fs:603:3)
    at readFileSync (node:fs:471:35)
    at WorkspaceLoader.loadAgentFiles (/opt/openclaw/core/workspace.ts:87:22)
    at async AgentBootstrap.initialize (/opt/openclaw/core/bootstrap.ts:54:14)
    at async SessionManager.createSession (/opt/openclaw/core/session-manager.ts:112:9)
    at async Gateway.handleSpawn (/opt/openclaw/gateway/routes.ts:201:16)`,
    timestamp: ago(hrs(3) + mins(42)),
    agent: {
      name: "Reed",
      emoji: "♿",
      role: "Accessibility Specialist",
      model: "claude-sonnet-4-6",
      sessionId: "agent:reed:subagent:a4e72b19",
    },
    system: {
      nodeVersion: "v22.22.0",
      os: "Darwin 24.6.0 (arm64)",
      memoryUsageMb: 987,
      memoryTotalMb: 16384,
    },
  },
  {
    id: "crash-006",
    severity: "error",
    status: "new",
    errorType: "ParseError",
    message:
      "Unexpected token '<' at position 0 in JSON response. The model returned HTML instead of JSON, likely due to a proxy or CDN error page being served in place of the API response.",
    stackTrace: `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
    at JSON.parse (<anonymous>)
    at ResponseParser.parseJSON (/opt/openclaw/core/response-parser.ts:38:23)
    at async ModelClient.chat (/opt/openclaw/core/model-client.ts:202:24)
    at async AgentLoop.getCompletion (/opt/openclaw/core/agent-loop.ts:234:22)
    at async AgentLoop.step (/opt/openclaw/core/agent-loop.ts:165:18)
    at async AgentLoop.run (/opt/openclaw/core/agent-loop.ts:94:9)`,
    timestamp: ago(hrs(4) + mins(18)),
    agent: {
      name: "Quinn",
      emoji: "🔄",
      role: "State Management Specialist",
      model: "claude-sonnet-4-6",
      sessionId: "agent:quinn:subagent:c5f89d21",
    },
    system: {
      nodeVersion: "v22.22.0",
      os: "Darwin 24.6.0 (arm64)",
      memoryUsageMb: 1356,
      memoryTotalMb: 16384,
    },
  },
  {
    id: "crash-007",
    severity: "warning",
    status: "acknowledged",
    errorType: "SpawnLimitError",
    message:
      "Session spawn limit exceeded: 12/10 concurrent sub-agents. The orchestrator attempted to spawn additional workers beyond the configured concurrency ceiling.",
    stackTrace: `SpawnLimitError: Maximum concurrent sub-agents (10) exceeded — attempted 12
    at SessionManager.validateSpawnLimit (/opt/openclaw/core/session-manager.ts:78:13)
    at async SessionManager.spawnSubAgent (/opt/openclaw/core/session-manager.ts:134:5)
    at async AgentLoop.handleSpawnRequest (/opt/openclaw/core/agent-loop.ts:412:18)
    at async AgentLoop.processToolUse (/opt/openclaw/core/agent-loop.ts:295:18)
    at async AgentLoop.step (/opt/openclaw/core/agent-loop.ts:178:14)
    at async AgentLoop.run (/opt/openclaw/core/agent-loop.ts:94:9)`,
    timestamp: ago(hrs(5) + mins(30)),
    agent: {
      name: "Tim",
      emoji: "🏗️",
      role: "VP Architecture",
      model: "o3",
      sessionId: "agent:tim:cron:87d4e5f1",
    },
    system: {
      nodeVersion: "v22.22.0",
      os: "Darwin 24.6.0 (arm64)",
      memoryUsageMb: 2890,
      memoryTotalMb: 16384,
    },
    toolCall: {
      toolName: "sessions_spawn",
      parameters: { task: "Review PR #142", label: "pr-review-142" },
    },
  },
  {
    id: "crash-008",
    severity: "warning",
    status: "new",
    errorType: "InvalidResponseFormat",
    message:
      "Model response did not match expected structured output schema. Expected tool_use block but received text-only response after 3 retry attempts. Falling back to unstructured parsing.",
    stackTrace: `InvalidResponseFormat: Expected content_block of type 'tool_use', received 'text'
    at ResponseValidator.validate (/opt/openclaw/core/response-validator.ts:56:11)
    at async ModelClient.chat (/opt/openclaw/core/model-client.ts:208:18)
    at async RetryPolicy.execute (/opt/openclaw/core/retry.ts:48:16)
    at async AgentLoop.getCompletion (/opt/openclaw/core/agent-loop.ts:234:22)
    at async AgentLoop.step (/opt/openclaw/core/agent-loop.ts:165:18)
    at async AgentLoop.run (/opt/openclaw/core/agent-loop.ts:94:9)`,
    timestamp: ago(hrs(6) + mins(10)),
    agent: {
      name: "Wes",
      emoji: "🧩",
      role: "Component Architecture Specialist",
      model: "zai/glm-5",
      sessionId: "agent:wes:subagent:ce1c759d",
    },
    system: {
      nodeVersion: "v22.22.0",
      os: "Darwin 24.6.0 (arm64)",
      memoryUsageMb: 1198,
      memoryTotalMb: 16384,
    },
  },
];

// ─── Severity / Status Config ────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Severity, { label: string; className: string }> = {
  critical: {
    label: "Critical",
    className: "bg-rose-500/20 text-rose-400 border border-rose-500/30",
  },
  error: {
    label: "Error",
    className: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  },
  warning: {
    label: "Warning",
    className: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  },
};

const STATUS_CONFIG: Record<CrashStatus, { label: string; dotClass: string; textClass: string }> = {
  new: { label: "New", dotClass: "bg-rose-400", textClass: "text-rose-400" },
  acknowledged: {
    label: "Acknowledged",
    dotClass: "bg-amber-400",
    textClass: "text-amber-400",
  },
  resolved: {
    label: "Resolved",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-400",
  },
};

const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "resolved", label: "Resolved" },
  { key: "critical", label: "Critical" },
  { key: "error", label: "Error" },
  { key: "warning", label: "Warning" },
];

// ─── Sub-Components ──────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

function StatusIndicator({ status }: { status: CrashStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("h-2 w-2 rounded-full", config.dotClass)}
        aria-hidden="true"
      />
      <span className={cn("text-xs font-medium", config.textClass)}>
        {config.label}
      </span>
    </span>
  );
}

function StatsStrip({
  crashes,
}: {
  crashes: CrashReport[];
}) {
  const totalToday = crashes.length;
  const unresolved = crashes.filter((c) => c.status !== "resolved").length;

  const agentCounts = crashes.reduce<Record<string, number>>((acc, c) => {
    acc[c.agent.name] = (acc[c.agent.name] ?? 0) + 1;
    return acc;
  }, {});

  const mostAffected = Object.entries(agentCounts).toSorted(
    ([, a], [, b]) => b - a
  )[0];

  const stats = [
    { label: "Crashes today", value: String(totalToday), accent: "text-white" },
    {
      label: "Unresolved",
      value: String(unresolved),
      accent: unresolved > 0 ? "text-rose-400" : "text-emerald-400",
    },
    {
      label: "Most affected",
      value: mostAffected ? `${mostAffected[0]} (${mostAffected[1]})` : "—",
      accent: "text-amber-400",
    },
  ];

  return (
    <div className="flex items-center gap-6 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
      {stats.map((stat, i) => (
        <React.Fragment key={stat.label}>
          {i > 0 && (
            <div className="h-8 w-px bg-zinc-800" aria-hidden="true" />
          )}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              {stat.label}
            </span>
            <span className={cn("text-sm font-semibold", stat.accent)}>
              {stat.value}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function CrashListItem({
  crash,
  isSelected,
  onSelect,
}: {
  crash: CrashReport;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-selected={isSelected}
      aria-label={`${crash.severity} crash: ${crash.errorType} from ${crash.agent.name}`}
      className={cn(
        "w-full text-left px-3 py-3 border-b border-zinc-800/50 transition-colors",
        "hover:bg-zinc-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset",
        isSelected && "bg-zinc-800/70 border-l-2 border-l-indigo-500"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <SeverityBadge severity={crash.severity} />
        <StatusIndicator status={crash.status} />
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <code className="text-xs font-mono font-semibold text-zinc-200">
          {crash.errorType}
        </code>
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm" aria-hidden="true">
          {crash.agent.emoji}
        </span>
        <span className="text-xs text-zinc-400">{crash.agent.name}</span>
      </div>
      <p className="text-xs text-zinc-500 line-clamp-2 mb-1.5 leading-relaxed">
        {crash.message}
      </p>
      <time
        className="text-[11px] text-zinc-600"
        dateTime={crash.timestamp.toISOString()}
        title={formatTimestamp(crash.timestamp)}
      >
        {relativeTime(crash.timestamp)}
      </time>
    </button>
  );
}

function LineNumberedCode({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="flex text-xs font-mono" role="region" aria-label="Stack trace">
      <div
        className="select-none pr-3 text-right text-zinc-600 border-r border-zinc-800 shrink-0"
        aria-hidden="true"
      >
        {lines.map((_, i) => (
          <div key={i} className="leading-6">
            {i + 1}
          </div>
        ))}
      </div>
      <pre className="pl-3 overflow-x-auto text-zinc-300 leading-6 whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <h3
        id={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
        className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailPanel({
  crash,
  onUpdateStatus,
}: {
  crash: CrashReport;
  onUpdateStatus: (id: string, status: CrashStatus) => void;
}) {
  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={crash.severity} />
            <StatusIndicator status={crash.status} />
          </div>
          <h2 className="text-lg font-bold text-white">
            <code className="font-mono">{crash.errorType}</code>
          </h2>
        </div>
        <time
          className="text-xs text-zinc-500 shrink-0 pt-1"
          dateTime={crash.timestamp.toISOString()}
        >
          {formatTimestamp(crash.timestamp)}
        </time>
      </div>

      {/* Error Message */}
      <DetailSection title="Error Message">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <p className="text-sm text-zinc-300 leading-relaxed">{crash.message}</p>
        </div>
      </DetailSection>

      {/* Stack Trace */}
      <DetailSection title="Stack Trace">
        <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <LineNumberedCode code={crash.stackTrace} />
        </div>
      </DetailSection>

      {/* Agent Context */}
      <DetailSection title="Agent Context">
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              label: "Agent",
              value: `${crash.agent.emoji} ${crash.agent.name}`,
            },
            { label: "Role", value: crash.agent.role },
            { label: "Model", value: crash.agent.model },
            { label: "Session ID", value: crash.agent.sessionId },
            { label: "Timestamp", value: formatTimestamp(crash.timestamp) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2"
            >
              <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {item.label}
              </span>
              <span className="block text-sm text-zinc-300 font-mono mt-0.5 truncate">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </DetailSection>

      {/* System Context */}
      <DetailSection title="System Context">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Node.js", value: crash.system.nodeVersion },
            { label: "OS", value: crash.system.os },
            {
              label: "Memory Usage",
              value: `${crash.system.memoryUsageMb.toLocaleString()} MB`,
            },
            {
              label: "Memory Total",
              value: `${crash.system.memoryTotalMb.toLocaleString()} MB`,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2"
            >
              <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {item.label}
              </span>
              <span className="block text-sm text-zinc-300 font-mono mt-0.5 truncate">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </DetailSection>

      {/* Tool Call (if applicable) */}
      {crash.toolCall && (
        <DetailSection title="Tool Call">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Tool
              </span>
              <code className="text-sm text-indigo-400 font-mono font-semibold">
                {crash.toolCall.toolName}
              </code>
            </div>
            {crash.toolCall.timeoutMs !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Timeout
                </span>
                <span className="text-sm text-zinc-300 font-mono">
                  {crash.toolCall.timeoutMs.toLocaleString()}ms
                </span>
              </div>
            )}
            <div>
              <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
                Parameters
              </span>
              <pre className="text-xs font-mono text-zinc-400 bg-zinc-950 rounded-md p-2 overflow-x-auto">
                {JSON.stringify(crash.toolCall.parameters, null, 2)}
              </pre>
            </div>
          </div>
        </DetailSection>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
        {crash.status !== "acknowledged" && (
          <button
            type="button"
            onClick={() => onUpdateStatus(crash.id, "acknowledged")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "bg-amber-500/10 text-amber-400 border border-amber-500/30",
              "hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            )}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Mark Acknowledged
          </button>
        )}
        {crash.status !== "resolved" && (
          <button
            type="button"
            onClick={() => onUpdateStatus(crash.id, "resolved")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
              "hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            )}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Mark Resolved
          </button>
        )}
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ml-auto",
            "bg-zinc-800 text-zinc-300 border border-zinc-700",
            "hover:bg-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          )}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          Create GitHub Issue
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CrashReporter() {
  const [crashes, setCrashes] = useState<CrashReport[]>(SEED_CRASHES);
  const [selectedId, setSelectedId] = useState<string>(SEED_CRASHES[0].id);
  const [activeFilter, setActiveFilter] = useState<FilterChip>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("time");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleUpdateStatus = useCallback(
    (id: string, status: CrashStatus) => {
      setCrashes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status } : c))
      );
    },
    []
  );

  const filteredAndSorted = useMemo(() => {
    let result = [...crashes];

    // Apply filter chip
    if (activeFilter !== "all") {
      const statusFilters: CrashStatus[] = ["new", "acknowledged", "resolved"];
      const severityFilters: Severity[] = ["critical", "error", "warning"];

      if (statusFilters.includes(activeFilter as CrashStatus)) {
        result = result.filter((c) => c.status === activeFilter);
      } else if (severityFilters.includes(activeFilter as Severity)) {
        result = result.filter((c) => c.severity === activeFilter);
      }
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.agent.name.toLowerCase().includes(q) ||
          c.errorType.toLowerCase().includes(q) ||
          c.message.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp: number;
      if (sortField === "severity") {
        cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      } else {
        cmp = b.timestamp.getTime() - a.timestamp.getTime();
      }
      return sortDirection === "asc" ? -cmp : cmp;
    });

    return result;
  }, [crashes, activeFilter, searchQuery, sortField, sortDirection]);

  const selectedCrash = crashes.find((c) => c.id === selectedId);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField]
  );

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-white">
      {/* Top Bar */}
      <header className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20">
              <svg
                className="h-4 w-4 text-rose-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-white">Crash Reporter</h1>
          </div>
          <StatsStrip crashes={crashes} />
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              placeholder="Search agent or error type…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search crash reports"
              className={cn(
                "w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-9 pr-3 text-sm text-zinc-200",
                "placeholder:text-zinc-600",
                "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              )}
            />
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Filter crash reports">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setActiveFilter(chip.key)}
                aria-pressed={activeFilter === chip.key}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  activeFilter === chip.key
                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content — Master/Detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: crash list */}
        <nav
          className="w-80 shrink-0 overflow-y-auto border-r border-zinc-800"
          aria-label="Crash report list"
        >
          {/* Sort controls */}
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
              Sort:
            </span>
            {(["time", "severity"] as const).map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => toggleSort(field)}
                aria-label={`Sort by ${field}`}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  sortField === field
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
                {sortField === field && (
                  <span className="ml-0.5" aria-hidden="true">
                    {sortDirection === "desc" ? "↓" : "↑"}
                  </span>
                )}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-zinc-600">
              {filteredAndSorted.length} result{filteredAndSorted.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
              <span className="text-2xl" aria-hidden="true">
                🔍
              </span>
              <p className="text-sm text-zinc-500 text-center">
                No crash reports match your filters.
              </p>
            </div>
          ) : (
            <div role="listbox" aria-label="Crash reports">
              {filteredAndSorted.map((crash) => (
                <CrashListItem
                  key={crash.id}
                  crash={crash}
                  isSelected={crash.id === selectedId}
                  onSelect={() => setSelectedId(crash.id)}
                />
              ))}
            </div>
          )}
        </nav>

        {/* Right panel: detail */}
        <main className="flex-1 overflow-hidden">
          {selectedCrash ? (
            <DetailPanel
              crash={selectedCrash}
              onUpdateStatus={handleUpdateStatus}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-600">
              <svg
                className="h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm">Select a crash report to view details</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
