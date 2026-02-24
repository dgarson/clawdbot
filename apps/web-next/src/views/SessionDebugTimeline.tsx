import React, { useState, useRef } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType =
  | "user"
  | "assistant"
  | "tool_call"
  | "tool_result"
  | "context_shift"
  | "error"
  | "system";

type EventStatus = "ok" | "error" | "warning" | "pending";

interface ContextSnapshot {
  tokensBefore: number;
  tokensAfter: number;
  compacted: boolean;
}

interface ToolInvocation {
  name: string;
  input: string;
  output: string;
  durationMs: number;
  success: boolean;
}

interface DebugEvent {
  id: string;
  offsetMs: number;
  type: EventType;
  status: EventStatus;
  title: string;
  summary: string;
  detail: string;
  tokens: number;
  latencyMs: number;
  tool?: ToolInvocation;
  context?: ContextSnapshot;
  model?: string;
  role?: "user" | "assistant" | "system";
}

interface DebugSession {
  id: string;
  label: string;
  agentName: string;
  model: string;
  startedAt: string;
  durationMs: number;
  totalTokens: number;
  events: DebugEvent[];
}

type PlaybackSpeed = 1 | 2 | 5 | 10;
type FilterType = "all" | EventType;
type PanelTab = "detail" | "raw" | "context";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SESSION_A: DebugEvent[] = [
  {
    id: "e1",
    offsetMs: 0,
    type: "system",
    status: "ok",
    title: "Session started",
    summary: "Agent initialized with SOUL.md + USER.md context loaded",
    detail:
      'Session created. Profile: production. Model: claude-3-5-sonnet. Context: SOUL.md (2,140 tokens), USER.md (880 tokens), CONTEXT.md (1,200 tokens). Total preload: 4,220 tokens.',
    tokens: 4220,
    latencyMs: 0,
    model: "claude-3-5-sonnet",
  },
  {
    id: "e2",
    offsetMs: 312,
    type: "user",
    status: "ok",
    title: "User message",
    summary: "What's the current status of the Horizon UI sprint?",
    detail:
      'Role: user\nContent: "What\'s the current status of the Horizon UI sprint?"\nTokens: 14\nChannel: webchat\nTimestamp: 2026-02-22T06:05:12Z',
    tokens: 14,
    latencyMs: 312,
    role: "user",
  },
  {
    id: "e3",
    offsetMs: 820,
    type: "tool_call",
    status: "ok",
    title: "read: UX_WORK_QUEUE.md",
    summary: "Reading sprint work queue to fetch current status",
    detail:
      'Tool: read\nInput path: /Users/openclaw/.openclaw/workspace/luis/UX_WORK_QUEUE.md\nCall ID: tool-call-0a3f\nModel decided to read the sprint queue before answering.',
    tokens: 0,
    latencyMs: 508,
    tool: {
      name: "read",
      input: '{"path": "/Users/openclaw/.openclaw/workspace/luis/UX_WORK_QUEUE.md"}',
      output: "# UX Work Queue — OpenClaw Horizon\n\n**Sprint Status:** ✅ ABSOLUTELY CRUSHED — **48 views** shipped...",
      durationMs: 142,
      success: true,
    },
  },
  {
    id: "e4",
    offsetMs: 962,
    type: "tool_result",
    status: "ok",
    title: "read result — 8,420 bytes",
    summary: "File read successfully: 48 views complete, 0 TS errors",
    detail:
      "Tool result for call-0a3f. Content length: 8,420 bytes. Exit code: 0. Read latency: 142ms.",
    tokens: 1840,
    latencyMs: 142,
  },
  {
    id: "e5",
    offsetMs: 2240,
    type: "assistant",
    status: "ok",
    title: "Assistant response",
    summary: "The Horizon UI sprint is complete — 48 views shipped…",
    detail:
      'Role: assistant\nModel: claude-3-5-sonnet\nContent: "The Horizon UI sprint is complete — 48 views shipped, all builds passing (0 TypeScript errors). The original goal was 10-12 views by 7:30 AM; we shipped 48 by ~2:00 AM — 5 hours early and 2.5× the goal. All lazy-loaded chunks are wired into App.tsx. Currently queued: ActivityFeed, CommandPalette, SupportCenter, TroubleshootingWizard, ReleasePipeline."\nTokens: 112\nGeneration time: 1,278ms\nFinish reason: stop',
    tokens: 112,
    latencyMs: 1278,
    model: "claude-3-5-sonnet",
    role: "assistant",
  },
  {
    id: "e6",
    offsetMs: 3100,
    type: "user",
    status: "ok",
    title: "User message",
    summary: "Can you check if the build is still clean? Run pnpm check.",
    detail:
      'Role: user\nContent: "Can you check if the build is still clean? Run pnpm check."\nTokens: 18',
    tokens: 18,
    latencyMs: 860,
    role: "user",
  },
  {
    id: "e7",
    offsetMs: 3640,
    type: "tool_call",
    status: "ok",
    title: "exec: pnpm check",
    summary: "Running type-check, lint, and tests",
    detail:
      'Tool: exec\nInput: {"command": "cd /Users/openclaw/.openclaw/workspace/luis/apps/web-next && pnpm check"}\nCall ID: tool-call-1b7c',
    tokens: 0,
    latencyMs: 540,
    tool: {
      name: "exec",
      input: '{"command": "cd apps/web-next && pnpm check"}',
      output: "$ tsc --noEmit && eslint src/ && vitest run\n✓ 0 errors, 0 warnings\n✓ built in 1.55s\n✓ 48 lazy-loaded chunks",
      durationMs: 4820,
      success: true,
    },
  },
  {
    id: "e8",
    offsetMs: 8460,
    type: "tool_result",
    status: "ok",
    title: "exec result — clean",
    summary: "0 TS errors, 0 lint warnings, build in 1.55s",
    detail:
      "Tool result for call-1b7c. Exit code: 0. Stdout: tsc clean, eslint clean, built in 1.55s. Duration: 4,820ms.",
    tokens: 210,
    latencyMs: 4820,
  },
  {
    id: "e9",
    offsetMs: 9900,
    type: "assistant",
    status: "ok",
    title: "Assistant response",
    summary: "Build is clean — 0 TypeScript errors, 0 lint warnings, 1.55s build.",
    detail:
      'Role: assistant\nModel: claude-3-5-sonnet\nContent: "Build is clean — 0 TypeScript errors, 0 lint warnings, built in 1.55s. All 48 lazy-loaded view chunks are intact."\nTokens: 44\nGeneration time: 1,440ms\nFinish reason: stop',
    tokens: 44,
    latencyMs: 1440,
    model: "claude-3-5-sonnet",
    role: "assistant",
  },
  {
    id: "e10",
    offsetMs: 10800,
    type: "context_shift",
    status: "warning",
    title: "Context window approaching limit",
    summary: "Context at 74% capacity — compaction eligible",
    detail:
      "Context window utilization: 74% (148,000 / 200,000 tokens). Compaction threshold: 80%. Next compaction will trigger if 3+ more tool calls with large outputs occur.",
    tokens: 0,
    latencyMs: 0,
    context: { tokensBefore: 148000, tokensAfter: 148000, compacted: false },
  },
  {
    id: "e11",
    offsetMs: 11200,
    type: "user",
    status: "ok",
    title: "User message",
    summary: "Commit everything and push to master.",
    detail:
      'Role: user\nContent: "Commit everything and push to master."\nTokens: 9',
    tokens: 9,
    latencyMs: 400,
    role: "user",
  },
  {
    id: "e12",
    offsetMs: 11700,
    type: "tool_call",
    status: "ok",
    title: "exec: git add -A && git commit",
    summary: "Staging all changes and committing",
    detail:
      'Tool: exec\nInput: {"command": "cd /Users/openclaw/.openclaw/workspace/luis && git add -A && git commit -m \\"Views #249-250: SessionDebugTimeline, StreamingDebugger — wire all\\""}\nCall ID: tool-call-2c9d',
    tokens: 0,
    latencyMs: 500,
    tool: {
      name: "exec",
      input: '{"command": "git add -A && git commit -m \\"Views #249-250\\""}',
      output: "[master ae7b249] Views #249-250: SessionDebugTimeline, StreamingDebugger\n 3 files changed, 1847 insertions(+)",
      durationMs: 890,
      success: true,
    },
  },
  {
    id: "e13",
    offsetMs: 13580,
    type: "tool_result",
    status: "ok",
    title: "exec result — committed",
    summary: "master ae7b249 — 3 files, 1847 insertions",
    detail: "Tool result for call-2c9d. Exit code: 0. Committed successfully. Hash: ae7b249.",
    tokens: 88,
    latencyMs: 890,
  },
  {
    id: "e14",
    offsetMs: 15200,
    type: "tool_call",
    status: "error",
    title: "exec: git push origin master",
    summary: "Push failed — remote rejected (stale ref)",
    detail:
      'Tool: exec\nInput: {"command": "git push origin master"}\nCall ID: tool-call-3d1e\nError: remote rejected push due to stale ref. Needs rebase.',
    tokens: 0,
    latencyMs: 1620,
    tool: {
      name: "exec",
      input: '{"command": "git push origin master"}',
      output:
        "error: failed to push some refs to 'origin'\nhint: Updates were rejected because the remote contains work that you do\nnot have locally. Integrate the remote changes (e.g.\n'git pull ...') before pushing again.",
      durationMs: 1620,
      success: false,
    },
  },
  {
    id: "e15",
    offsetMs: 16820,
    type: "error",
    status: "error",
    title: "Tool error: git push rejected",
    summary: "Remote ahead of local — rebase required before push",
    detail:
      "Tool call-3d1e returned non-zero exit code. Remote has commits not present locally. Recovery: git pull --rebase then repush.",
    tokens: 0,
    latencyMs: 0,
  },
  {
    id: "e16",
    offsetMs: 17100,
    type: "tool_call",
    status: "ok",
    title: "exec: git pull --rebase",
    summary: "Rebasing local changes on top of remote",
    detail:
      'Tool: exec\nInput: {"command": "git pull --rebase origin master"}\nCall ID: tool-call-4e2f',
    tokens: 0,
    latencyMs: 280,
    tool: {
      name: "exec",
      input: '{"command": "git pull --rebase origin master"}',
      output: "Successfully rebased and updated refs/heads/master.",
      durationMs: 1240,
      success: true,
    },
  },
  {
    id: "e17",
    offsetMs: 19620,
    type: "tool_result",
    status: "ok",
    title: "exec result — rebased",
    summary: "Rebase successful. Clean to push.",
    detail: "Tool result for call-4e2f. Exit code: 0. Rebase successful.",
    tokens: 64,
    latencyMs: 1240,
  },
  {
    id: "e18",
    offsetMs: 22000,
    type: "assistant",
    status: "ok",
    title: "Assistant response",
    summary: "Rebased and pushed successfully. All 250 views on master.",
    detail:
      'Role: assistant\nContent: "Hit a stale ref on push — rebased and pushed successfully. All 250 views are now on master."\nTokens: 32\nGeneration time: 980ms\nFinish reason: stop',
    tokens: 32,
    latencyMs: 980,
    model: "claude-3-5-sonnet",
    role: "assistant",
  },
];

const SESSION_B: DebugEvent[] = [
  {
    id: "b1",
    offsetMs: 0,
    type: "system",
    status: "ok",
    title: "Session started",
    summary: "Xavier session — architecture review context loaded",
    detail: "Session created. Profile: xavier. Model: claude-opus-4. Context preload: 3,100 tokens.",
    tokens: 3100,
    latencyMs: 0,
    model: "claude-opus-4",
  },
  {
    id: "b2",
    offsetMs: 240,
    type: "user",
    status: "ok",
    title: "User message",
    summary: "Review the StreamingDebugger PR and leave feedback",
    detail:
      'Role: user\nContent: "Review the StreamingDebugger PR and leave feedback"\nTokens: 11',
    tokens: 11,
    latencyMs: 240,
    role: "user",
  },
  {
    id: "b3",
    offsetMs: 720,
    type: "tool_call",
    status: "ok",
    title: "exec: gh pr list",
    summary: "Fetching open PRs from dgarson/clawdbot",
    detail: 'Tool: exec\nInput: {"command": "gh pr list --repo dgarson/clawdbot"}\nCall ID: tool-call-b01',
    tokens: 0,
    latencyMs: 480,
    tool: {
      name: "exec",
      input: '{"command": "gh pr list --repo dgarson/clawdbot"}',
      output: "#42  feat/streaming-debugger  OPEN  reed/streaming-debugger → feat/horizon-ui",
      durationMs: 780,
      success: true,
    },
  },
  {
    id: "b4",
    offsetMs: 2100,
    type: "tool_call",
    status: "ok",
    title: "exec: gh pr diff 42",
    summary: "Reading StreamingDebugger diff",
    detail: 'Tool: exec\nInput: {"command": "gh pr diff 42 --repo dgarson/clawdbot"}\nCall ID: tool-call-b02',
    tokens: 0,
    latencyMs: 880,
    tool: {
      name: "exec",
      input: '{"command": "gh pr diff 42 --repo dgarson/clawdbot"}',
      output: "diff --git a/apps/web-next/src/views/StreamingDebugger.tsx b/...\n+++ b/apps/web-next/src/views/StreamingDebugger.tsx\n@@ -1,3 +1,1221 @@\n+import React, { useState } from \"react\";\n+import { cn } from \"../lib/utils\";\n...",
      durationMs: 1100,
      success: true,
    },
  },
  {
    id: "b5",
    offsetMs: 5400,
    type: "assistant",
    status: "ok",
    title: "PR review complete",
    summary: "Approved with minor notes. Merged into feat/horizon-ui.",
    detail:
      'Role: assistant\nContent: "Reviewed PR #42 — StreamingDebugger. Solid implementation. Approved and merged."\nTokens: 88\nGeneration time: 2,100ms',
    tokens: 88,
    latencyMs: 2100,
    model: "claude-opus-4",
    role: "assistant",
  },
  {
    id: "b6",
    offsetMs: 6200,
    type: "context_shift",
    status: "ok",
    title: "Context compacted",
    summary: "Compaction ran — context trimmed from 82% to 31%",
    detail:
      "Context compaction triggered at 82% utilization (164,000 tokens). Post-compaction: 62,000 tokens (31%). Oldest 40 turns summarized.",
    tokens: 0,
    latencyMs: 320,
    context: { tokensBefore: 164000, tokensAfter: 62000, compacted: true },
  },
];

const SESSION_C: DebugEvent[] = [
  {
    id: "c1",
    offsetMs: 0,
    type: "system",
    status: "ok",
    title: "Session started",
    summary: "Piper subagent — spawned by Luis for TeamManagement component",
    detail: "Subagent session. Parent: luis. Task: Build TeamManagement.tsx. Model: claude-sonnet-4-6.",
    tokens: 1200,
    latencyMs: 0,
    model: "claude-sonnet-4-6",
  },
  {
    id: "c2",
    offsetMs: 188,
    type: "tool_call",
    status: "ok",
    title: "write: TeamManagement.tsx",
    summary: "Writing 892-line TeamManagement component",
    detail: 'Tool: write\nInput: {"path": "...TeamManagement.tsx", "content": "..."}\nCall ID: tool-call-c01',
    tokens: 0,
    latencyMs: 188,
    tool: {
      name: "write",
      input: '{"path": "apps/web-next/src/views/TeamManagement.tsx"}',
      output: "Successfully wrote 45,210 bytes to TeamManagement.tsx",
      durationMs: 95,
      success: true,
    },
  },
  {
    id: "c3",
    offsetMs: 1100,
    type: "tool_call",
    status: "error",
    title: "exec: pnpm check",
    summary: "Build failed — 3 TypeScript errors",
    detail: 'Tool: exec\nInput: {"command": "pnpm check"}\nCall ID: tool-call-c02',
    tokens: 0,
    latencyMs: 912,
    tool: {
      name: "exec",
      input: '{"command": "pnpm check"}',
      output:
        "src/views/TeamManagement.tsx:142:7 - error TS2322: Type 'string | undefined' is not assignable to type 'string'.\nsrc/views/TeamManagement.tsx:198:3 - error TS7006: Parameter 'e' implicitly has an 'any' type.",
      durationMs: 3200,
      success: false,
    },
  },
  {
    id: "c4",
    offsetMs: 5400,
    type: "error",
    status: "error",
    title: "TypeScript errors detected",
    summary: "2 type errors in TeamManagement.tsx — self-correcting",
    detail:
      "Errors:\n1. TS2322 line 142: string | undefined not assignable to string\n2. TS7006 line 198: implicit any on event handler param\nSelf-correction initiated.",
    tokens: 0,
    latencyMs: 0,
  },
  {
    id: "c5",
    offsetMs: 5800,
    type: "tool_call",
    status: "ok",
    title: "edit: fix TS errors",
    summary: "Applying 2 targeted fixes to TeamManagement.tsx",
    detail: 'Tool: edit (×2)\nFix 1: Add ?? "" to string | undefined field\nFix 2: Type event param as React.ChangeEvent<HTMLInputElement>',
    tokens: 0,
    latencyMs: 400,
    tool: {
      name: "edit",
      input: '{"file_path": "TeamManagement.tsx", "oldText": "...", "newText": "..."}',
      output: "Edit applied successfully.",
      durationMs: 60,
      success: true,
    },
  },
  {
    id: "c6",
    offsetMs: 7200,
    type: "tool_result",
    status: "ok",
    title: "Build clean after fix",
    summary: "0 TS errors — component ready for PR",
    detail: "pnpm check: 0 errors, 0 warnings. Built in 1.48s.",
    tokens: 0,
    latencyMs: 3100,
  },
  {
    id: "c7",
    offsetMs: 9800,
    type: "system",
    status: "ok",
    title: "Subagent complete",
    summary: "Task finished. Result announced to parent (luis).",
    detail: "Subagent run complete. Output: TeamManagement.tsx (892 lines, 0 errors). Notified parent agent.",
    tokens: 0,
    latencyMs: 0,
  },
];

const SESSIONS: DebugSession[] = [
  {
    id: "sess-luis-main",
    label: "Luis main — Sprint recap + push",
    agentName: "luis",
    model: "claude-sonnet-4-6",
    startedAt: "2026-02-22T06:05:12Z",
    durationMs: 22000,
    totalTokens: 6641,
    events: SESSION_A,
  },
  {
    id: "sess-xavier-review",
    label: "Xavier — PR review + compaction",
    agentName: "xavier",
    model: "claude-opus-4",
    startedAt: "2026-02-22T05:48:00Z",
    durationMs: 6520,
    totalTokens: 3299,
    events: SESSION_B,
  },
  {
    id: "sess-piper-sub",
    label: "Piper subagent — TeamManagement build",
    agentName: "piper",
    model: "claude-sonnet-4-6",
    startedAt: "2026-02-22T04:22:10Z",
    durationMs: 9800,
    totalTokens: 1200,
    events: SESSION_C,
  },
];

// ─── Constants & Helpers ───────────────────────────────────────────────────────

const EVENT_COLORS: Record<EventType, string> = {
  user: "bg-indigo-500",
  assistant: "bg-emerald-500",
  tool_call: "bg-amber-500",
  tool_result: "bg-amber-400/60",
  context_shift: "bg-purple-500",
  error: "bg-rose-500",
  system: "bg-[var(--color-surface-3)]",
};

const EVENT_ICONS: Record<EventType, string> = {
  user: "💬",
  assistant: "🤖",
  tool_call: "🔧",
  tool_result: "📬",
  context_shift: "🪟",
  error: "⚠️",
  system: "⚙️",
};

const STATUS_COLORS: Record<EventStatus, string> = {
  ok: "text-emerald-400",
  error: "text-rose-400",
  warning: "text-amber-400",
  pending: "text-[var(--color-text-secondary)]",
};

const FILTER_OPTIONS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "User", value: "user" },
  { label: "Assistant", value: "assistant" },
  { label: "Tools", value: "tool_call" },
  { label: "Context", value: "context_shift" },
  { label: "Errors", value: "error" },
  { label: "System", value: "system" },
];

function fmtMs(ms: number): string {
  if (ms === 0) {return "0ms";}
  if (ms < 1000) {return `${ms}ms`;}
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtOffset(ms: number): string {
  if (ms < 1000) {return `+${ms}ms`;}
  return `+${(ms / 1000).toFixed(1)}s`;
}

function fmtTimestamp(iso: string): string {
  return iso.replace("T", " ").slice(0, 19) + " UTC";
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScrubBar({
  durationMs,
  currentMs,
  events,
  onScrub,
}: {
  durationMs: number;
  currentMs: number;
  events: DebugEvent[];
  onScrub: (ms: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) {return;}
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onScrub(Math.round(pct * durationMs));
  };

  const progressPct = durationMs > 0 ? (currentMs / durationMs) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div
        ref={trackRef}
        onClick={handleClick}
        className="relative h-6 bg-[var(--color-surface-2)] rounded-lg cursor-pointer group"
      >
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-indigo-600/40 rounded-lg transition-none"
          style={{ width: `${progressPct}%` }}
        />
        {/* Event markers */}
        {events.map((ev) => {
          const pct = durationMs > 0 ? (ev.offsetMs / durationMs) * 100 : 0;
          return (
            <div
              key={ev.id}
              className={cn(
                "absolute top-1 w-1.5 h-4 rounded-sm opacity-80",
                EVENT_COLORS[ev.type]
              )}
              style={{ left: `calc(${pct}% - 3px)` }}
              title={ev.title}
            />
          );
        })}
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-glow"
          style={{ left: `${progressPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs font-mono text-[var(--color-text-muted)]">
        <span>0ms</span>
        <span className="text-[var(--color-text-secondary)]">{fmtOffset(currentMs)}</span>
        <span>{fmtMs(durationMs)}</span>
      </div>
    </div>
  );
}

function EventRow({
  event,
  selected,
  onClick,
  prevOffsetMs,
}: {
  event: DebugEvent;
  selected: boolean;
  onClick: () => void;
  prevOffsetMs: number;
}) {
  const gapMs = event.offsetMs - prevOffsetMs;
  return (
    <>
      {gapMs > 500 && (
        <div className="flex items-center gap-2 py-1 px-3">
          <div className="flex-1 h-px bg-[var(--color-surface-2)]/60" />
          <span className="text-xs font-mono text-[var(--color-text-muted)]">{fmtMs(gapMs)} gap</span>
          <div className="flex-1 h-px bg-[var(--color-surface-2)]/60" />
        </div>
      )}
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left flex items-start gap-3 px-3 py-2.5 transition-colors rounded-lg",
          selected
            ? "bg-indigo-600/20 border border-indigo-500/40"
            : "hover:bg-[var(--color-surface-2)]/60 border border-transparent"
        )}
      >
        <div className="flex flex-col items-center gap-1 pt-0.5 min-w-[36px]">
          <span className="text-base leading-none">{EVENT_ICONS[event.type]}</span>
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{fmtOffset(event.offsetMs)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={cn("text-xs font-medium", STATUS_COLORS[event.status])}
            >
              {event.status === "error" ? "✗" : event.status === "warning" ? "⚠" : "✓"}
            </span>
            <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{event.title}</span>
            {event.tokens > 0 && (
              <span className="ml-auto shrink-0 text-xs font-mono text-[var(--color-text-muted)]">
                {event.tokens.toLocaleString()} tok
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] truncate">{event.summary}</p>
        </div>
        {event.latencyMs > 0 && (
          <div className="shrink-0 text-right">
            <span
              className={cn(
                "text-xs font-mono",
                event.latencyMs > 3000
                  ? "text-amber-400"
                  : event.latencyMs > 1000
                  ? "text-[var(--color-text-secondary)]"
                  : "text-[var(--color-text-muted)]"
              )}
            >
              {fmtMs(event.latencyMs)}
            </span>
          </div>
        )}
      </button>
    </>
  );
}

function EventInspector({
  event,
  session,
}: {
  event: DebugEvent;
  session: DebugSession;
}) {
  const [panelTab, setPanelTab] = useState<PanelTab>("detail");

  return (
    <div className="flex flex-col h-full">
      {/* Inspector header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-xl">{EVENT_ICONS[event.type]}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{event.title}</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{event.summary}</p>
          </div>
          <span
            className={cn(
              "shrink-0 text-xs px-2 py-0.5 rounded-full font-medium",
              event.status === "ok"
                ? "bg-emerald-500/20 text-emerald-400"
                : event.status === "error"
                ? "bg-rose-500/20 text-rose-400"
                : "bg-amber-500/20 text-amber-400"
            )}
          >
            {event.status}
          </span>
        </div>
        <div className="flex gap-3 text-xs font-mono text-[var(--color-text-muted)]">
          <span>Offset: {fmtOffset(event.offsetMs)}</span>
          {event.latencyMs > 0 && <span>Latency: {fmtMs(event.latencyMs)}</span>}
          {event.tokens > 0 && <span>Tokens: {event.tokens.toLocaleString()}</span>}
        </div>
      </div>

      {/* Panel tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-1">
        {(["detail", "raw", "context"] as PanelTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setPanelTab(t)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-colors capitalize",
              panelTab === t
                ? "bg-indigo-600 text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {panelTab === "detail" && (
          <>
            <div className="bg-[var(--color-surface-0)] rounded-lg p-3 font-mono text-xs text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
              {event.detail}
            </div>

            {event.tool && (
              <div className="space-y-2">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Tool I/O</p>
                <div className="space-y-1.5">
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">Input</p>
                    <div className="bg-[var(--color-surface-0)] rounded p-2 font-mono text-xs text-indigo-300 whitespace-pre-wrap">
                      {event.tool.input}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">
                      Output{" "}
                      <span
                        className={cn(
                          "ml-1",
                          event.tool.success ? "text-emerald-500" : "text-rose-500"
                        )}
                      >
                        {event.tool.success ? "✓" : "✗"}
                      </span>{" "}
                      <span className="text-[var(--color-text-muted)]">{fmtMs(event.tool.durationMs)}</span>
                    </p>
                    <div
                      className={cn(
                        "bg-[var(--color-surface-0)] rounded p-2 font-mono text-xs whitespace-pre-wrap max-h-36 overflow-y-auto",
                        event.tool.success ? "text-[var(--color-text-primary)]" : "text-rose-300"
                      )}
                    >
                      {event.tool.output}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {event.context && (
              <div className="space-y-2">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Context Window</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[var(--color-surface-0)] rounded p-3">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">Before</p>
                    <p className="text-lg font-bold font-mono text-[var(--color-text-primary)]">
                      {event.context.tokensBefore.toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">tokens</p>
                  </div>
                  <div className="bg-[var(--color-surface-0)] rounded p-3">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">After</p>
                    <p
                      className={cn(
                        "text-lg font-bold font-mono",
                        event.context.compacted ? "text-emerald-400" : "text-[var(--color-text-primary)]"
                      )}
                    >
                      {event.context.tokensAfter.toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {event.context.compacted ? "compacted" : "tokens"}
                    </p>
                  </div>
                </div>
                {event.context.compacted && (
                  <div className="bg-[var(--color-surface-2)] rounded p-2 text-xs text-[var(--color-text-secondary)]">
                    Saved{" "}
                    <span className="text-emerald-400 font-mono">
                      {(event.context.tokensBefore - event.context.tokensAfter).toLocaleString()}
                    </span>{" "}
                    tokens (
                    {Math.round(
                      ((event.context.tokensBefore - event.context.tokensAfter) /
                        event.context.tokensBefore) *
                        100
                    )}
                    % reduction)
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {panelTab === "raw" && (
          <div className="bg-[var(--color-surface-0)] rounded-lg p-3 font-mono text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(
              {
                id: event.id,
                offsetMs: event.offsetMs,
                type: event.type,
                status: event.status,
                title: event.title,
                tokens: event.tokens,
                latencyMs: event.latencyMs,
                model: event.model,
                role: event.role,
                tool: event.tool
                  ? {
                      name: event.tool.name,
                      durationMs: event.tool.durationMs,
                      success: event.tool.success,
                    }
                  : undefined,
                context: event.context,
              },
              null,
              2
            )}
          </div>
        )}

        {panelTab === "context" && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Session context</p>
            <div className="space-y-2">
              {[
                { label: "Session", value: session.id },
                { label: "Agent", value: session.agentName },
                { label: "Model", value: session.model },
                { label: "Started", value: fmtTimestamp(session.startedAt) },
                { label: "Duration", value: fmtMs(session.durationMs) },
                {
                  label: "Total tokens",
                  value: session.totalTokens.toLocaleString(),
                },
                {
                  label: "Event index",
                  value: `${session.events.findIndex((e) => e.id === event.id) + 1} / ${session.events.length}`,
                },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">{row.label}</span>
                  <span className="font-mono text-[var(--color-text-primary)]">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Mini token budget bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--color-text-muted)]">Token budget</span>
                <span className="font-mono text-[var(--color-text-secondary)]">
                  {session.totalTokens.toLocaleString()} / 200,000
                </span>
              </div>
              <div className="h-2 bg-[var(--color-surface-2)] rounded-full">
                <div
                  className={cn(
                    "h-2 rounded-full",
                    session.totalTokens / 200000 > 0.8
                      ? "bg-rose-500"
                      : session.totalTokens / 200000 > 0.6
                      ? "bg-amber-500"
                      : "bg-indigo-500"
                  )}
                  style={{
                    width: `${Math.min((session.totalTokens / 200000) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatsStrip({ session, currentMs }: { session: DebugSession; currentMs: number }) {
  const visibleEvents = session.events.filter((e) => e.offsetMs <= currentMs);
  const errorCount = visibleEvents.filter((e) => e.status === "error").length;
  const toolCount = visibleEvents.filter((e) => e.type === "tool_call").length;
  const tokensSoFar = visibleEvents.reduce((acc, e) => acc + e.tokens, 0);

  return (
    <div className="flex flex-wrap gap-4 px-4 py-3 bg-[var(--color-surface-1)] border-b border-[var(--color-border)] text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-text-muted)]">Events</span>
        <span className="font-mono text-[var(--color-text-primary)] font-semibold">{visibleEvents.length}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-text-muted)]">Tool calls</span>
        <span className="font-mono text-amber-400 font-semibold">{toolCount}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-text-muted)]">Errors</span>
        <span className={cn("font-mono font-semibold", errorCount > 0 ? "text-rose-400" : "text-[var(--color-text-secondary)]")}>
          {errorCount}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-text-muted)]">Tokens</span>
        <span className="font-mono text-emerald-400 font-semibold">
          {tokensSoFar.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-text-muted)]">Elapsed</span>
        <span className="font-mono text-[var(--color-text-primary)]">{fmtMs(currentMs)}</span>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SessionDebugTimeline() {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(SESSIONS[0].id);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [currentMs, setCurrentMs] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const session = SESSIONS.find((s) => s.id === selectedSessionId) ?? SESSIONS[0];
  const selectedEvent = session.events.find((e) => e.id === selectedEventId) ?? null;

  // Auto-advance playback
  React.useEffect(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!playing) {return;}

    const TICK_MS = 50;
    intervalRef.current = setInterval(() => {
      setCurrentMs((prev) => {
        const next = prev + TICK_MS * speed;
        if (next >= session.durationMs) {
          setPlaying(false);
          return session.durationMs;
        }
        return next;
      });
    }, TICK_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playing, speed, session.durationMs]);

  // Auto-select event at current position
  React.useEffect(() => {
    const visible = session.events.filter((e) => e.offsetMs <= currentMs);
    if (visible.length > 0) {
      const last = visible[visible.length - 1];
      setSelectedEventId(last.id);
    }
  }, [currentMs, session.events]);

  const handleSessionChange = (id: string) => {
    setSelectedSessionId(id);
    setSelectedEventId(null);
    setCurrentMs(0);
    setPlaying(false);
  };

  const handleScrub = (ms: number) => {
    setCurrentMs(ms);
    setPlaying(false);
  };

  const handlePlay = () => {
    if (currentMs >= session.durationMs) {setCurrentMs(0);}
    setPlaying(true);
  };

  const filteredEvents = session.events.filter((e) => {
    if (filter === "all") {return true;}
    if (filter === "tool_call") {return e.type === "tool_call" || e.type === "tool_result";}
    return e.type === filter;
  });

  const visibleEvents = filteredEvents.filter((e) => e.offsetMs <= currentMs);

  const SPEEDS: PlaybackSpeed[] = [1, 2, 5, 10];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] flex flex-col">
      {/* ── Header ── */}
      <div className="px-4 pt-5 pb-3 border-b border-[var(--color-border)] bg-[var(--color-surface-0)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <span>🎬</span> Session Debug Timeline
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Replay and inspect agent sessions event-by-event
            </p>
          </div>
          {/* Session picker */}
          <select
            value={selectedSessionId}
            onChange={(e) => handleSessionChange(e.target.value)}
            className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-xs"
          >
            {SESSIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Session metadata */}
        <div className="flex flex-wrap gap-3 text-xs">
          {[
            { label: "Agent", value: session.agentName },
            { label: "Model", value: session.model },
            { label: "Started", value: fmtTimestamp(session.startedAt) },
            { label: "Duration", value: fmtMs(session.durationMs) },
            { label: "Events", value: String(session.events.length) },
            { label: "Tokens", value: session.totalTokens.toLocaleString() },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-2.5 py-1">
              <span className="text-[var(--color-text-muted)]">{m.label}:</span>
              <span className="font-mono text-[var(--color-text-primary)]">{m.value}</span>
            </div>
          ))}
        </div>

        {/* Scrubber + controls */}
        <div className="space-y-2">
          <ScrubBar
            durationMs={session.durationMs}
            currentMs={currentMs}
            events={session.events}
            onScrub={handleScrub}
          />
          <div className="flex items-center gap-3">
            {/* Play / Pause */}
            <button
              onClick={playing ? () => setPlaying(false) : handlePlay}
              className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-[var(--color-text-primary)] transition-colors"
            >
              {playing ? "⏸" : "▶"}
            </button>
            {/* Restart */}
            <button
              onClick={() => { setCurrentMs(0); setPlaying(false); }}
              className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] flex items-center justify-center text-[var(--color-text-secondary)] transition-colors text-sm"
              title="Restart"
            >
              ↺
            </button>
            {/* Jump to end */}
            <button
              onClick={() => { setCurrentMs(session.durationMs); setPlaying(false); }}
              className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] flex items-center justify-center text-[var(--color-text-secondary)] transition-colors text-sm"
              title="Jump to end"
            >
              ⏭
            </button>

            <div className="w-px h-5 bg-[var(--color-surface-3)]" />

            {/* Speed */}
            <div className="flex items-center gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={cn(
                    "px-2 py-0.5 text-xs font-mono rounded transition-colors",
                    speed === s
                      ? "bg-indigo-600 text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-[var(--color-surface-3)]" />

            {/* Filter chips */}
            <div className="flex flex-wrap gap-1">
              {FILTER_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "px-2 py-0.5 text-xs rounded transition-colors",
                    filter === f.value
                      ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <StatsStrip session={session} currentMs={currentMs} />

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Event list */}
        <div className="w-1/2 border-r border-[var(--color-border)] overflow-y-auto flex flex-col">
          {visibleEvents.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
              {currentMs === 0 ? "Press ▶ to start replay" : "No events match the current filter"}
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {visibleEvents.map((ev, idx) => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  selected={ev.id === selectedEventId}
                  prevOffsetMs={idx === 0 ? 0 : visibleEvents[idx - 1].offsetMs}
                  onClick={() => setSelectedEventId(ev.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Inspector panel */}
        <div className="w-1/2 overflow-hidden flex flex-col">
          {selectedEvent ? (
            <EventInspector event={selectedEvent} session={session} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] gap-2">
              <span className="text-3xl">🔍</span>
              <p className="text-sm">Select an event to inspect</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Click any event in the timeline to view details, tool I/O, and context state
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface-0)]">
        <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Legend</span>
        {(Object.entries(EVENT_ICONS) as [EventType, string][]).map(([type, icon]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-sm", EVENT_COLORS[type])} />
            <span className="text-xs text-[var(--color-text-muted)] capitalize">
              {type.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
