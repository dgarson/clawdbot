import React from "react";
import { cn } from "../lib/utils";

// Mock data types
interface ModelMetrics {
  modelName: string;
  successRate: number;
  totalCalls: number;
  failures: number;
  topFailure?: string;
  status: "reliable" | "needs-validation";
}

interface FailureLogEntry {
  id: string;
  time: string;
  agent: string;
  model: string;
  toolCalled: string;
  error: string;
  autoRecovered: boolean;
}

// Mock data
const summaryMetrics = {
  overallSuccessRate: 94.2,
  totalToolCalls: 1847,
  failuresIntercepted: 108,
};

const modelMetrics: ModelMetrics[] = [
  {
    modelName: "Claude Sonnet 4.6",
    successRate: 98.5,
    totalCalls: 22,
    failures: 0,
    status: "reliable",
  },
  {
    modelName: "MiniMax M2.5",
    successRate: 89.2,
    totalCalls: 1203,
    failures: 87,
    topFailure: "malformed JSON in tool_use block",
    status: "needs-validation",
  },
  {
    modelName: "Grok 4",
    successRate: 91.8,
    totalCalls: 622,
    failures: 9,
    topFailure: "extra unknown fields",
    status: "needs-validation",
  },
];

const failureLog: FailureLogEntry[] = [
  {
    id: "f1",
    time: "10:15:23",
    agent: "agent-alpha",
    model: "MiniMax M2.5",
    toolCalled: "filesystem_read",
    error: "malformed JSON in tool_use block",
    autoRecovered: true,
  },
  {
    id: "f2",
    time: "10:14:47",
    agent: "agent-beta",
    model: "Grok 4",
    toolCalled: "http_request",
    error: "extra unknown fields",
    autoRecovered: true,
  },
  {
    id: "f3",
    time: "10:12:31",
    agent: "agent-gamma",
    model: "MiniMax M2.5",
    toolCalled: "database_query",
    error: "malformed JSON in tool_use block",
    autoRecovered: true,
  },
  {
    id: "f4",
    time: "10:11:05",
    agent: "agent-delta",
    model: "MiniMax M2.5",
    toolCalled: "api_invoke",
    error: "malformed JSON in tool_use block",
    autoRecovered: false,
  },
  {
    id: "f5",
    time: "10:09:22",
    agent: "agent-alpha",
    model: "Grok 4",
    toolCalled: "shell_exec",
    error: "extra unknown fields",
    autoRecovered: true,
  },
  {
    id: "f6",
    time: "10:07:58",
    agent: "agent-epsilon",
    model: "MiniMax M2.5",
    toolCalled: "env_get",
    error: "malformed JSON in tool_use block",
    autoRecovered: true,
  },
  {
    id: "f7",
    time: "10:05:14",
    agent: "agent-beta",
    model: "MiniMax M2.5",
    toolCalled: "memory_store",
    error: "malformed JSON in tool_use block",
    autoRecovered: true,
  },
  {
    id: "f8",
    time: "10:03:41",
    agent: "agent-zeta",
    model: "Grok 4",
    toolCalled: "tool_list",
    error: "extra unknown fields",
    autoRecovered: true,
  },
];

export default function ToolReliabilityDashboard() {
  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Tool Reliability Dashboard</h1>
          <span className="px-3 py-1 text-sm font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full">
            PR #68 — Validation Layer (Intercept Mode)
          </span>
        </div>
        <p className="text-[var(--color-text-secondary)] text-sm">
          Last updated: Feb 22, 2026 10:00 AM MST
        </p>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Overall Success Rate */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
          <div className="text-sm text-[var(--color-text-secondary)] mb-1">Overall Success Rate</div>
          <div className="text-3xl font-bold text-green-400">
            {summaryMetrics.overallSuccessRate}%
          </div>
        </div>

        {/* Total Tool Calls Today */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
          <div className="text-sm text-[var(--color-text-secondary)] mb-1">Total Tool Calls Today</div>
          <div className="text-3xl font-bold text-[var(--color-text-primary)]">
            {summaryMetrics.totalToolCalls.toLocaleString()}
          </div>
        </div>

        {/* Failures Intercepted */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
          <div className="text-sm text-[var(--color-text-secondary)] mb-1">Failures Intercepted</div>
          <div className="text-3xl font-bold text-red-400">
            {summaryMetrics.failuresIntercepted}
          </div>
        </div>
      </div>

      {/* Per-Model Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {modelMetrics.map((model) => (
          <div
            key={model.modelName}
            className={cn(
              "bg-[var(--color-surface-1)] border rounded-lg p-5",
              model.status === "reliable"
                ? "border-green-500/30"
                : "border-amber-500/30"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--color-text-primary)]">{model.modelName}</h3>
              <span
                className={cn(
                  "text-lg",
                  model.status === "reliable" ? "text-green-400" : "text-amber-400"
                )}
              >
                {model.status === "reliable" ? "✅" : "⚠️"}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-secondary)]">Success Rate</span>
                <span
                  className={cn(
                    "font-semibold",
                    model.successRate >= 95
                      ? "text-green-400"
                      : model.successRate >= 90
                      ? "text-amber-400"
                      : "text-red-400"
                  )}
                >
                  {model.successRate}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-secondary)]">Total Calls</span>
                <span className="text-[var(--color-text-primary)]">{model.totalCalls.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-secondary)]">Failures</span>
                <span
                  className={cn(
                    "font-semibold",
                    model.failures === 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  {model.failures}
                </span>
              </div>
              {model.topFailure && (
                <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">Top Failure</div>
                  <div className="text-sm text-red-300">{model.topFailure}</div>
                </div>
              )}
              <div className="mt-2">
                <span
                  className={cn(
                    "text-xs px-2 py-1 rounded",
                    model.status === "reliable"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-amber-500/20 text-amber-400"
                  )}
                >
                  {model.status === "reliable" ? "Reliable" : "Needs validation"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Failure Log Table */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Failure Log (Last 8)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-surface-2)]/50 text-left text-sm text-[var(--color-text-secondary)]">
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Agent</th>
                <th className="px-5 py-3 font-medium">Model</th>
                <th className="px-5 py-3 font-medium">Tool Called</th>
                <th className="px-5 py-3 font-medium">Error</th>
                <th className="px-5 py-3 font-medium">Auto-recovered?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {failureLog.map((entry) => (
                <tr key={entry.id} className="hover:bg-[var(--color-surface-2)]/30">
                  <td className="px-5 py-3 text-[var(--color-text-primary)] font-mono text-sm">
                    {entry.time}
                  </td>
                  <td className="px-5 py-3 text-[var(--color-text-primary)]">{entry.agent}</td>
                  <td className="px-5 py-3 text-[var(--color-text-primary)]">{entry.model}</td>
                  <td className="px-5 py-3 text-[var(--color-text-primary)] font-mono text-sm">
                    {entry.toolCalled}
                  </td>
                  <td className="px-5 py-3 text-red-300 text-sm">{entry.error}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
                        entry.autoRecovered
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      )}
                    >
                      {entry.autoRecovered ? "✓ Yes" : "✗ No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-amber-400 text-xl">⚠️</span>
          <div>
            <div className="text-amber-400 font-medium mb-1">
              PR #68 not yet merged
            </div>
            <div className="text-amber-200/80 text-sm">
              Validation layer running in intercept mode. Recommend merging before Wave 1{" "}
              <span className="font-semibold">(Feb 23 10 AM MST)</span> to prevent unhandled errors in MiniMax and Grok agents.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
