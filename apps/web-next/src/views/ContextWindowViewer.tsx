import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";

type MessageRole = "system" | "user" | "assistant" | "tool";
type TokenBucket = "system" | "user" | "assistant" | "tool" | "overhead";

interface ContextMessage {
  id: string;
  role: MessageRole;
  content: string;
  tokens: number;
  important: boolean; // pinned/important messages
  collapsible: boolean;
}

interface ContextSession {
  id: string;
  agent: string;
  model: string;
  contextLimit: number;
  usedTokens: number;
  messages: ContextMessage[];
  startedAt: string;
}

const SESSIONS: ContextSession[] = [
  {
    id: "ctx-001",
    agent: "Luis",
    model: "claude-sonnet-4-6",
    contextLimit: 200000,
    usedTokens: 42840,
    startedAt: "2026-02-22 02:05:00",
    messages: [
      { id: "m1", role: "system", content: "You are Luis, Principal UX Engineer at OpenClaw. You lead the Product & UI Squad. You report to Xavier (CTO) and Tim (VP Arch). Your squad: Piper, Quinn, Reed, Wes, Sam.\n\nSelf-Direction Mandate: You do not wait for direction. Ever.\n\nDecision Authority:\n- UX/UI design: autonomous\n- Frontend stack: React, TypeScript, Shadcn/Radix\n- Design system, component library, interaction patterns\n\nEvery session: Read SOUL.md, USER.md, CONTEXT.md, today's memory.", tokens: 840, important: true, collapsible: false },
      { id: "m2", role: "user", content: "[cron:e61f3c46 Luis UX Work Check (Hourly)] You are Luis, Principal UX Engineer at OpenClaw. Hourly work check. Sprint mandate: Build as many Horizon UI views as possible before 7:30 AM MST. The goal was 10-12 views. You've shipped 35 so far. Sprint ends at 7:30 AM MST. Keep building.", tokens: 180, important: true, collapsible: false },
      { id: "m3", role: "assistant", content: "Picking up from where we left off — AgentWorkload.tsx was written but not yet wired. Let me wire it into App.tsx, check on Piper (ApiPlayground) and Reed (WorkspaceSettings) sub-agents, then commit and continue building.\n\nStarting parallel: wiring AgentWorkload + checking sub-agents.", tokens: 92, important: false, collapsible: false },
      { id: "m4", role: "tool", content: 'exec: "grep -n \\"AnalyticsOverview\\\\|OnboardingChecklist\\" App.tsx | tail -20"\n---\n82: const AnalyticsOverview = React.lazy(() => import("./views/AnalyticsOverview"));\n83: const OnboardingChecklist = React.lazy(() => import("./views/OnboardingChecklist"));\n140: { id: "analytics", label: "Analytics", emoji: "📉", shortcut: null },\n141: { id: "setup", label: "Setup Guide", emoji: "✅", shortcut: null },', tokens: 210, important: false, collapsible: true },
      { id: "m5", role: "tool", content: 'subagents:list\n---\n{\n  "active": [],\n  "recent": [\n    { "label": "horizon-workspace-settings", "status": "done", "runtime": "1m" },\n    { "label": "horizon-api-playground", "status": "done", "runtime": "3m" },\n    ...\n  ]\n}', tokens: 280, important: false, collapsible: true },
      { id: "m6", role: "assistant", content: "Both agents done. Wiring all three (AgentWorkload #57, ApiPlayground #58, WorkspaceSettings #59) into App.tsx now.", tokens: 48, important: false, collapsible: false },
      { id: "m7", role: "tool", content: "edit: App.tsx — added lazy imports for AgentWorkload, ApiPlayground, WorkspaceSettings\n---\nSuccessfully replaced text in /Users/openclaw/.openclaw/workspace/luis/apps/web-next/src/App.tsx", tokens: 85, important: false, collapsible: true },
      { id: "m8", role: "tool", content: "exec: pnpm build 2>&1 | grep -E 'AgentWorkload|ApiPlayground|WorkspaceSettings|error|built in'\n---\ndist/assets/ApiPlayground-wtLYj21G.js   10.64 kB\ndist/assets/AgentWorkload-tdtP2Z64.js  12.40 kB\ndist/assets/WorkspaceSettings-cPXjGKe3.js  14.23 kB\n✓ built in 1.64s", tokens: 160, important: true, collapsible: false },
      { id: "m9", role: "tool", content: 'exec: git commit -m "feat: views #57-59"\n---\n[master 81a5453] feat: views #57-59 — AgentWorkload, ApiPlayground, WorkspaceSettings\n103 files changed, 2116 insertions(+), 320 deletions(-)', tokens: 95, important: false, collapsible: true },
      { id: "m10", role: "assistant", content: "59 views committed. Spawning Wes → CostOptimizer and Quinn → PluginManager while I build AgentTracer (#60) and DataPipelineViewer (#61) directly.", tokens: 65, important: false, collapsible: false },
      { id: "m11", role: "tool", content: "sessions_spawn: wes — horizon-cost-optimizer\n---\n{ status: 'accepted', childSessionKey: 'agent:wes:subagent:50908f18' }", tokens: 72, important: false, collapsible: true },
      { id: "m12", role: "tool", content: "write: AgentTracer.tsx — 21612 bytes\n---\nSuccessfully wrote 21612 bytes to .../views/AgentTracer.tsx", tokens: 48, important: false, collapsible: true },
      { id: "m13", role: "tool", content: "write: DataPipelineViewer.tsx — 21415 bytes\n---\nSuccessfully wrote 21415 bytes to .../views/DataPipelineViewer.tsx", tokens: 48, important: false, collapsible: true },
      { id: "m14", role: "assistant", content: "Wiring AgentTracer and DataPipelineViewer into App.tsx, building to verify 0 TS errors before commit.", tokens: 40, important: false, collapsible: false },
      { id: "m15", role: "tool", content: "exec: pnpm build 2>&1 | grep -E 'AgentTracer|DataPipeline|error|built in'\n---\ndist/assets/AgentTracer-xSc8A1r4.js  14.17 kB\ndist/assets/DataPipelineViewer-BzdEwWBh.js  14.51 kB\n✓ built in 1.61s", tokens: 145, important: true, collapsible: false },
    ],
  },
  {
    id: "ctx-002",
    agent: "Stephan",
    model: "gpt-4o",
    contextLimit: 128000,
    usedTokens: 8420,
    startedAt: "2026-02-22 02:11:00",
    messages: [
      { id: "m1", role: "system", content: "You are Stephan, Chief Marketing Officer at OpenClaw. You own brand voice, external communications, and user-facing content strategy.", tokens: 420, important: true, collapsible: false },
      { id: "m2", role: "user", content: "[cron] Daily digest — summarize yesterday's agent activity for the team", tokens: 88, important: true, collapsible: false },
      { id: "m3", role: "assistant", content: "Generating daily digest for #cb-standup. Pulling session summaries from yesterday.", tokens: 52, important: false, collapsible: false },
      { id: "m4", role: "tool", content: "exec: curl -X POST https://api.openai.com/v1/chat/completions\n---\ncurl: (28) Operation timed out after 7500ms with 0 bytes received", tokens: 80, important: true, collapsible: false },
      { id: "m5", role: "assistant", content: "LLM API timed out — GPT-4o rate limited. Digest generation failed.", tokens: 38, important: false, collapsible: false },
    ],
  },
  {
    id: "ctx-003",
    agent: "Xavier",
    model: "claude-sonnet-4-6",
    contextLimit: 200000,
    usedTokens: 18200,
    startedAt: "2026-02-22 01:48:00",
    messages: [
      { id: "m1", role: "system", content: "You are Xavier, CTO of OpenClaw. You set technical direction, review megabranch PRs, and keep CONTEXT.md current.", tokens: 380, important: true, collapsible: false },
      { id: "m2", role: "user", content: "Review Luis's sprint progress. Update CONTEXT.md.", tokens: 62, important: true, collapsible: false },
      { id: "m3", role: "tool", content: "read: workspace/luis/UX_WORK_QUEUE.md\n---\n# UX_WORK_QUEUE.md\n## SPRINT STATUS: ABSOLUTELY CRUSHED — 48 views shipped...", tokens: 340, important: false, collapsible: true },
      { id: "m4", role: "assistant", content: "Luis is on a tear — 48+ views and counting. Updating CONTEXT.md to reflect the sprint status. This is landmark progress for Horizon UI.", tokens: 78, important: false, collapsible: false },
      { id: "m5", role: "tool", content: "edit: _shared/CONTEXT.md — sprint status update\n---\nSuccessfully replaced text", tokens: 42, important: false, collapsible: true },
    ],
  },
];

const ROLE_COLORS: Record<MessageRole, string> = {
  system: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  user: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
  assistant: "bg-zinc-800/60 border-zinc-700 text-zinc-400",
  tool: "bg-emerald-500/5 border-emerald-500/20 text-emerald-400",
};

const BUCKET_COLORS: Record<TokenBucket, string> = {
  system: "bg-amber-500",
  user: "bg-indigo-500",
  assistant: "bg-zinc-500",
  tool: "bg-emerald-500",
  overhead: "bg-zinc-700",
};

function countByRole(messages: ContextMessage[]): Record<TokenBucket, number> {
  return {
    system: messages.filter((m) => m.role === "system").reduce((a, m) => a + m.tokens, 0),
    user: messages.filter((m) => m.role === "user").reduce((a, m) => a + m.tokens, 0),
    assistant: messages.filter((m) => m.role === "assistant").reduce((a, m) => a + m.tokens, 0),
    tool: messages.filter((m) => m.role === "tool").reduce((a, m) => a + m.tokens, 0),
    overhead: 120, // formatting, special tokens
  };
}

export default function ContextWindowViewer() {
  const [selectedId, setSelectedId] = useState<string>("ctx-001");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["m1", "m2", "m8", "m15"]));
  const [showImportant, setShowImportant] = useState(false);

  const session = SESSIONS.find((s) => s.id === selectedId) ?? SESSIONS[0];
  const buckets = useMemo(() => countByRole(session.messages), [session]);
  const utilPct = Math.round((session.usedTokens / session.contextLimit) * 100);

  const visibleMessages = showImportant ? session.messages.filter((m) => m.important) : session.messages;

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 px-5 py-3">
        <h1 className="text-sm font-semibold text-white">Context Window Viewer</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Inspect token usage and message breakdown per session</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Session list */}
        <aside className="w-60 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
          <ul className="flex-1 overflow-y-auto divide-y divide-zinc-800/50" role="listbox" aria-label="Sessions">
            {SESSIONS.map((s) => {
              const pct = Math.round((s.usedTokens / s.contextLimit) * 100);
              return (
                <li key={s.id}>
                  <button
                    role="option"
                    aria-selected={s.id === selectedId}
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
                      s.id === selectedId && "bg-zinc-800 border-l-2 border-indigo-500"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-200">{s.agent}</span>
                      <span className={cn("text-xs font-medium", pct > 80 ? "text-rose-400" : pct > 60 ? "text-amber-400" : "text-emerald-400")}>
                        {pct}%
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5 truncate">{s.model}</div>
                    <div className="mt-1.5 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", pct > 80 ? "bg-rose-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Context usage: ${pct}%`}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-600">
                      <span>{s.usedTokens.toLocaleString()} / {(s.contextLimit / 1000).toFixed(0)}k</span>
                      <span>{s.messages.length} msgs</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Session detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Usage header */}
          <div className="shrink-0 border-b border-zinc-800 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{session.agent} — {session.model}</div>
                <div className="text-xs text-zinc-500">{session.startedAt}</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowImportant((p) => !p)}
                  aria-pressed={showImportant}
                  className={cn(
                    "px-3 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    showImportant ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  ★ Important only
                </button>
              </div>
            </div>

            {/* Token distribution bar */}
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                <span>Token distribution</span>
                <span className={cn("font-medium", utilPct > 80 ? "text-rose-400" : utilPct > 60 ? "text-amber-400" : "text-zinc-300")}>
                  {session.usedTokens.toLocaleString()} / {session.contextLimit.toLocaleString()} ({utilPct}%)
                </span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden flex" role="img" aria-label="Token distribution by role">
                {(Object.entries(buckets) as Array<[TokenBucket, number]>).map(([bucket, count]) => {
                  const pct = (count / session.usedTokens) * utilPct;
                  return pct > 0 ? (
                    <div
                      key={bucket}
                      className={cn("h-full first:rounded-l-full last:rounded-r-full", BUCKET_COLORS[bucket])}
                      style={{ width: `${pct}%` }}
                      title={`${bucket}: ${count.toLocaleString()} tokens`}
                    />
                  ) : null;
                })}
              </div>
              <div className="flex gap-3 mt-1.5 flex-wrap">
                {(Object.entries(buckets) as Array<[TokenBucket, number]>).map(([bucket, count]) => (
                  <div key={bucket} className="flex items-center gap-1">
                    <span className={cn("w-2 h-2 rounded-full", BUCKET_COLORS[bucket])} />
                    <span className="text-xs text-zinc-500">{bucket} {count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {visibleMessages.map((msg) => {
              const expanded = expandedIds.has(msg.id);
              const preview = msg.content.slice(0, 120) + (msg.content.length > 120 ? "…" : "");

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "rounded-lg border text-xs overflow-hidden",
                    ROLE_COLORS[msg.role],
                    msg.important && "ring-1 ring-indigo-500/30"
                  )}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(msg.id)}
                    onKeyDown={(e) => e.key === "Enter" && toggleExpand(msg.id)}
                    className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                    aria-expanded={expanded}
                  >
                    <div className="shrink-0 flex flex-col items-center gap-0.5 pt-0.5">
                      <span className="font-semibold capitalize">{msg.role}</span>
                      {msg.important && <span className="text-indigo-400">★</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">
                        {expanded ? msg.content : preview}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-0.5">
                      <span className="text-zinc-600">{msg.tokens.toLocaleString()}tok</span>
                      <span className="text-zinc-700">{expanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
