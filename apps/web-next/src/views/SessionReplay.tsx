import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventKind =
  | "message"
  | "tool-call"
  | "tool-result"
  | "subagent-spawn"
  | "subagent-done"
  | "system"
  | "error";

type MessageRole = "user" | "assistant" | "system";

interface ReplayEvent {
  id: string;
  offsetMs: number;
  kind: EventKind;
  role?: MessageRole;
  content: string;
  toolName?: string;
  duration?: number;
  tokens?: number;
  important?: boolean;
}

interface ReplaySession {
  id: string;
  agentName: string;
  label: string;
  totalMs: number;
  startedAt: string;
  events: ReplayEvent[];
  totalTokens: number;
  totalTools: number;
}

// ---------------------------------------------------------------------------
// Filter type
// ---------------------------------------------------------------------------

type FilterChip = "all" | "messages" | "tools" | "system" | "errors";

const FILTER_CHIPS: { label: string; value: FilterChip }[] = [
  { label: "All", value: "all" },
  { label: "Messages", value: "messages" },
  { label: "Tools", value: "tools" },
  { label: "System", value: "system" },
  { label: "Errors", value: "errors" },
];

type PlaybackSpeed = 0.5 | 1 | 2 | 5;
const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 5];

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const SEED_SESSIONS: ReplaySession[] = [
  {
    id: "sess-001",
    agentName: "Luis",
    label: "Morning Heartbeat",
    totalMs: 14320,
    startedAt: "2026-02-22T07:00:00Z",
    totalTokens: 4870,
    totalTools: 8,
    events: [
      { id: "e-001-01", offsetMs: 0, kind: "system", content: "Session started — agent Luis, model gpt-4o" },
      { id: "e-001-02", offsetMs: 120, kind: "message", role: "system", content: "You are Luis, Principal UX Engineer. Run the morning heartbeat: check PR queue, summarize blockers, post standup." },
      { id: "e-001-03", offsetMs: 340, kind: "message", role: "assistant", content: "Starting morning heartbeat. First I'll check the open PR queue for dgarson/clawdbot.", tokens: 82 },
      { id: "e-001-04", offsetMs: 980, kind: "tool-call", toolName: "exec", content: "gh pr list --repo dgarson/clawdbot --state open --limit 20", duration: 1240 },
      { id: "e-001-05", offsetMs: 2220, kind: "tool-result", toolName: "exec", content: "5 open PRs: #412 wes/badge-variants, #410 reed/aria-listbox, #408 sam/motion-tokens, #405 quinn/loading-states, #401 piper/hover-focus" },
      { id: "e-001-06", offsetMs: 2580, kind: "message", role: "assistant", content: "5 open PRs found. Let me check for any failing CI checks.", tokens: 64 },
      { id: "e-001-07", offsetMs: 3100, kind: "tool-call", toolName: "exec", content: "gh pr checks 412 --repo dgarson/clawdbot", duration: 890 },
      { id: "e-001-08", offsetMs: 3990, kind: "tool-result", toolName: "exec", content: "All checks passing ✓" },
      { id: "e-001-09", offsetMs: 4200, kind: "tool-call", toolName: "read", content: "Reading memory/2026-02-21.md for yesterday's context", duration: 210 },
      { id: "e-001-10", offsetMs: 4410, kind: "tool-result", toolName: "read", content: "Yesterday: shipped badge component, Reed flagged a11y gap in Dropdown, Sam blocked on motion token naming." },
      { id: "e-001-11", offsetMs: 4800, kind: "message", role: "assistant", content: "Two blockers from yesterday: Reed's a11y gap in Dropdown and Sam's motion token naming. Let me spawn subagents to check status on each.", tokens: 120, important: true },
      { id: "e-001-12", offsetMs: 5400, kind: "subagent-spawn", content: "Spawned subagent reed-a11y-check: 'Check if Dropdown a11y gap from yesterday is resolved'" },
      { id: "e-001-13", offsetMs: 5600, kind: "subagent-spawn", content: "Spawned subagent sam-motion-check: 'Check motion token naming blocker status'" },
      { id: "e-001-14", offsetMs: 7200, kind: "subagent-done", content: "reed-a11y-check complete: Reed pushed fix in #410, ARIA listbox role now applied. Gap resolved." },
      { id: "e-001-15", offsetMs: 8100, kind: "subagent-done", content: "sam-motion-check complete: Sam still blocked — waiting on Luis decision for duration.fast vs timing.fast naming." },
      { id: "e-001-16", offsetMs: 8500, kind: "message", role: "assistant", content: "Reed's Dropdown fix is merged. Sam is still blocked on token naming — I need to make a decision on that. Using 'duration.*' prefix.", tokens: 95, important: true },
      { id: "e-001-17", offsetMs: 9200, kind: "tool-call", toolName: "write", content: "Writing decision to memory/2026-02-22.md: motion tokens use 'duration.*' prefix", duration: 180 },
      { id: "e-001-18", offsetMs: 9380, kind: "tool-result", toolName: "write", content: "File written successfully." },
      { id: "e-001-19", offsetMs: 10400, kind: "tool-call", toolName: "exec", content: "Posting standup summary to #ui-squad channel", duration: 620 },
      { id: "e-001-20", offsetMs: 11020, kind: "tool-result", toolName: "exec", content: "Message sent to #ui-squad" },
      { id: "e-001-21", offsetMs: 12800, kind: "message", role: "assistant", content: "Morning heartbeat complete. 5 PRs open, 1 blocker resolved (Reed a11y), 1 decision made (duration.* tokens for Sam). Standup posted.", tokens: 110 },
      { id: "e-001-22", offsetMs: 14320, kind: "system", content: "Session completed — 4870 tokens, 8 tool calls, 2 subagents" },
    ],
  },
  {
    id: "sess-002",
    agentName: "Stephan",
    label: "Daily Digest",
    totalMs: 8710,
    startedAt: "2026-02-22T08:15:00Z",
    totalTokens: 1240,
    totalTools: 3,
    events: [
      { id: "e-002-01", offsetMs: 0, kind: "system", content: "Session started — agent Stephan, model gpt-4o" },
      { id: "e-002-02", offsetMs: 200, kind: "message", role: "system", content: "You are Stephan, the daily digest curator. Summarize commits, PRs, and notable changes from the last 24h." },
      { id: "e-002-03", offsetMs: 600, kind: "message", role: "assistant", content: "I'll pull the commit log and PR activity for the last 24 hours.", tokens: 45 },
      { id: "e-002-04", offsetMs: 1200, kind: "tool-call", toolName: "exec", content: "gh api repos/dgarson/clawdbot/commits?since=2026-02-21T08:15:00Z", duration: 1800 },
      { id: "e-002-05", offsetMs: 3000, kind: "tool-result", toolName: "exec", content: "14 commits across 4 branches: badge variants, aria listbox, motion tokens, loading states" },
      { id: "e-002-06", offsetMs: 3400, kind: "tool-call", toolName: "exec", content: "gh pr list --repo dgarson/clawdbot --state merged --search 'merged:>2026-02-21'", duration: 1500 },
      { id: "e-002-07", offsetMs: 4900, kind: "tool-result", toolName: "exec", content: "2 PRs merged: #398 piper/tooltip-positioning, #396 quinn/form-validation-states" },
      { id: "e-002-08", offsetMs: 5800, kind: "error", content: "LLM call timed out after 2500ms — model overloaded. Retrying is not configured for this session.", important: true },
      { id: "e-002-09", offsetMs: 8710, kind: "system", content: "Session terminated — incomplete due to LLM timeout. 1240 tokens consumed, 3 tool calls." },
    ],
  },
  {
    id: "sess-003",
    agentName: "Reed",
    label: "Workspace Settings",
    totalMs: 46353,
    startedAt: "2026-02-22T09:30:00Z",
    totalTokens: 8920,
    totalTools: 5,
    events: [
      { id: "e-003-01", offsetMs: 0, kind: "system", content: "Session started — agent Reed, model gpt-4o" },
      { id: "e-003-02", offsetMs: 300, kind: "message", role: "system", content: "You are Reed, accessibility specialist. Update workspace settings for the a11y audit tooling configuration." },
      { id: "e-003-03", offsetMs: 1200, kind: "message", role: "assistant", content: "I'll start by reading the current workspace settings to understand what's configured.", tokens: 52 },
      { id: "e-003-04", offsetMs: 2800, kind: "tool-call", toolName: "read", content: "Reading .openclaw/workspace/reed/settings.json", duration: 340 },
      { id: "e-003-05", offsetMs: 3140, kind: "tool-result", toolName: "read", content: '{"auditLevel": "AA", "contrastChecker": true, "ariaLinter": false, "keyboardTrap": true, "focusVisible": true}' },
      { id: "e-003-06", offsetMs: 8400, kind: "message", role: "assistant", content: "Current settings have ariaLinter disabled. I need to enable it and add the new screenReaderTesting flag. Let me also bump auditLevel to AAA for the new compliance target.", tokens: 340, important: true },
      { id: "e-003-07", offsetMs: 18200, kind: "tool-call", toolName: "write", content: 'Writing updated settings.json with ariaLinter: true, auditLevel: "AAA", screenReaderTesting: true', duration: 280 },
      { id: "e-003-08", offsetMs: 18480, kind: "tool-result", toolName: "write", content: "File written successfully." },
      { id: "e-003-09", offsetMs: 24600, kind: "message", role: "assistant", content: "Settings updated. Now let me verify the configuration is valid by running the audit dry-run.", tokens: 78 },
      { id: "e-003-10", offsetMs: 32000, kind: "tool-call", toolName: "exec", content: "npx a11y-audit --dry-run --config .openclaw/workspace/reed/settings.json", duration: 8200 },
      { id: "e-003-11", offsetMs: 40200, kind: "tool-result", toolName: "exec", content: "Dry run passed. 0 errors, 2 warnings (color-contrast edge cases in Badge component). Configuration valid." },
      { id: "e-003-12", offsetMs: 46353, kind: "system", content: "Session completed — 8920 tokens, 5 tool calls. Workspace settings updated successfully." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  if (ms < 1000) {return `${ms}ms`;}
  if (ms < 60000) {return `${(ms / 1000).toFixed(1)}s`;}
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatOffset(ms: number): string {
  if (ms === 0) {return "+0s";}
  if (ms < 1000) {return `+${ms}ms`;}
  return `+${(ms / 1000).toFixed(1)}s`;
}

function kindIcon(kind: EventKind): string {
  switch (kind) {
    case "message":
      return "💬";
    case "tool-call":
      return "🔧";
    case "tool-result":
      return "📋";
    case "subagent-spawn":
      return "🚀";
    case "subagent-done":
      return "✅";
    case "system":
      return "⚙️";
    case "error":
      return "❌";
  }
}

function kindColor(kind: EventKind): string {
  switch (kind) {
    case "message":
      return "text-primary";
    case "tool-call":
      return "text-amber-400";
    case "tool-result":
      return "text-emerald-400";
    case "subagent-spawn":
      return "text-primary";
    case "subagent-done":
      return "text-emerald-400";
    case "system":
      return "text-[var(--color-text-secondary)]";
    case "error":
      return "text-rose-400";
  }
}

function matchesFilter(event: ReplayEvent, filter: FilterChip): boolean {
  if (filter === "all") {return true;}
  if (filter === "messages") {return event.kind === "message";}
  if (filter === "tools")
    {return event.kind === "tool-call" || event.kind === "tool-result";}
  if (filter === "system")
    {return (
      event.kind === "system" ||
      event.kind === "subagent-spawn" ||
      event.kind === "subagent-done"
    );}
  if (filter === "errors") {return event.kind === "error";}
  return true;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SessionListItem({
  session,
  isSelected,
  onSelect,
}: {
  session: ReplaySession;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-[var(--color-border)] transition-colors",
        "hover:bg-[var(--color-surface-2)]/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset",
        isSelected ? "bg-[var(--color-surface-2)] border-l-2 border-l-indigo-500" : "border-l-2 border-l-transparent"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
          {session.agentName}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)] tabular-nums ml-2 shrink-0">
          {formatMs(session.totalMs)}
        </span>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] truncate mb-1.5">{session.label}</p>
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span>{session.events.length} events</span>
        <span>{session.totalTokens.toLocaleString()} tok</span>
        <span>{session.totalTools} tools</span>
      </div>
    </button>
  );
}

function EventRow({
  event,
  isCurrent,
  isExpanded,
  onToggle,
}: {
  event: ReplayEvent;
  isCurrent: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full text-left px-3 py-2.5 border-b border-[var(--color-border)]/50 transition-colors",
        "hover:bg-[var(--color-surface-2)]/40 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-inset",
        isCurrent && "bg-primary/15 border-l-2 border-l-indigo-500",
        !isCurrent && "border-l-2 border-l-transparent"
      )}
    >
      {/* Row header */}
      <div className="flex items-start gap-2">
        {/* Offset badge */}
        <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]">
          {formatOffset(event.offsetMs)}
        </span>

        {/* Icon */}
        <span className="shrink-0 mt-0.5 text-sm" aria-hidden="true">
          {kindIcon(event.kind)}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                kindColor(event.kind)
              )}
            >
              {event.kind}
            </span>
            {event.role && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                ({event.role})
              </span>
            )}
            {event.toolName && (
              <span className="text-[10px] font-mono text-amber-400/70">
                {event.toolName}
              </span>
            )}
            {event.tokens != null && (
              <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                {event.tokens} tok
              </span>
            )}
            {event.duration != null && (
              <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                {formatMs(event.duration)}
              </span>
            )}
            {event.important && (
              <span className="text-[10px] text-amber-400">★</span>
            )}
          </div>

          {/* Content line — truncated unless expanded */}
          <p
            className={cn(
              "text-xs text-[var(--color-text-primary)]",
              !isExpanded && "truncate"
            )}
          >
            {event.content}
          </p>
        </div>

        {/* Expand indicator */}
        <span className="shrink-0 mt-1 text-[var(--color-text-muted)] text-xs select-none">
          {isExpanded ? "▾" : "▸"}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SessionReplay() {
  // Session selection
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    SEED_SESSIONS[0].id
  );
  const selectedSession =
    SEED_SESSIONS.find((s) => s.id === selectedSessionId) ?? SEED_SESSIONS[0];

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  // Filter
  const [activeFilter, setActiveFilter] = useState<FilterChip>("all");

  // Expanded event
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Ref for interval cleanup
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref for scrolling to current event
  const currentEventRef = useRef<HTMLDivElement | null>(null);
  const eventListRef = useRef<HTMLDivElement | null>(null);

  // Filtered events
  const filteredEvents = selectedSession.events.filter((ev) =>
    matchesFilter(ev, activeFilter)
  );

  // Current event in filtered list
  const currentEvent =
    currentEventIndex < filteredEvents.length
      ? filteredEvents[currentEventIndex]
      : null;

  // Progress (0–100)
  const progressPercent =
    currentEvent && selectedSession.totalMs > 0
      ? (currentEvent.offsetMs / selectedSession.totalMs) * 100
      : filteredEvents.length > 0 && currentEventIndex >= filteredEvents.length
        ? 100
        : 0;

  // Reset playback on session change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentEventIndex(0);
    setExpandedEventId(null);
    setActiveFilter("all");
  }, [selectedSessionId]);

  // Reset index when filter changes
  useEffect(() => {
    setCurrentEventIndex(0);
    setIsPlaying(false);
  }, [activeFilter]);

  // Playback interval
  useEffect(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isPlaying) {return;}
    if (currentEventIndex >= filteredEvents.length - 1) {
      setIsPlaying(false);
      return;
    }

    const currentEvt = filteredEvents[currentEventIndex];
    const nextEvt = filteredEvents[currentEventIndex + 1];
    if (!currentEvt || !nextEvt) {
      setIsPlaying(false);
      return;
    }

    const deltaMs = nextEvt.offsetMs - currentEvt.offsetMs;
    const scaledDelay = Math.max(50, deltaMs / speed);

    intervalRef.current = setTimeout(() => {
      setCurrentEventIndex((prev) => prev + 1);
    }, scaledDelay);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, currentEventIndex, speed, filteredEvents]);

  // Auto-scroll to current event
  useEffect(() => {
    if (currentEventRef.current && eventListRef.current) {
      currentEventRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentEventIndex]);

  // Seek via progress bar
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetMs = pct * selectedSession.totalMs;

      // Find the closest event at or before targetMs
      let closest = 0;
      for (let i = 0; i < filteredEvents.length; i++) {
        if (filteredEvents[i].offsetMs <= targetMs) {
          closest = i;
        } else {
          break;
        }
      }
      setCurrentEventIndex(closest);
    },
    [selectedSession.totalMs, filteredEvents]
  );

  const togglePlay = useCallback(() => {
    if (currentEventIndex >= filteredEvents.length - 1) {
      setCurrentEventIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [currentEventIndex, filteredEvents.length]);

  const toggleExpand = useCallback((eventId: string) => {
    setExpandedEventId((prev) => (prev === eventId ? null : eventId));
  }, []);

  return (
    <div className="flex h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* ---- Left panel: session list ---- */}
      <aside className="w-72 shrink-0 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-surface-0)]">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
            Sessions
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {SEED_SESSIONS.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              isSelected={session.id === selectedSessionId}
              onSelect={() => setSelectedSessionId(session.id)}
            />
          ))}
        </div>
      </aside>

      {/* ---- Right panel: timeline player ---- */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-4 shrink-0">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold truncate">
              {selectedSession.agentName}{" "}
              <span className="text-[var(--color-text-secondary)] font-normal">
                — {selectedSession.label}
              </span>
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {selectedSession.startedAt} · {formatMs(selectedSession.totalMs)} ·{" "}
              {selectedSession.events.length} events ·{" "}
              {selectedSession.totalTokens.toLocaleString()} tokens
            </p>
          </div>
        </header>

        {/* Progress bar (seekable) */}
        <div
          className="h-2 bg-[var(--color-surface-2)] cursor-pointer shrink-0 group"
          onClick={handleSeek}
          role="slider"
          aria-label="Playback progress"
          aria-valuenow={Math.round(progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        >
          <div
            className="h-full bg-primary transition-all duration-150 group-hover:bg-primary"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Transport controls */}
        <div className="px-5 py-2.5 border-b border-[var(--color-border)] flex items-center gap-4 shrink-0">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              "bg-primary hover:bg-primary text-[var(--color-text-primary)]",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            )}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="currentColor"
              >
                <rect x="2" y="1" width="3.5" height="12" rx="1" />
                <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="currentColor"
              >
                <path d="M3 1.5v11l9-5.5z" />
              </svg>
            )}
          </button>

          {/* Current time */}
          <span className="text-xs text-[var(--color-text-secondary)] font-mono tabular-nums min-w-[4.5rem]">
            {currentEvent ? formatMs(currentEvent.offsetMs) : "—"} /{" "}
            {formatMs(selectedSession.totalMs)}
          </span>

          {/* Speed selector */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mr-1">
              Speed
            </span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={cn(
                  "px-2 py-1 rounded text-xs font-mono transition-colors",
                  "focus:outline-none focus:ring-1 focus:ring-indigo-500",
                  s === speed
                    ? "bg-primary/20 text-primary font-semibold"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div className="px-5 py-2 border-b border-[var(--color-border)] flex items-center gap-2 shrink-0 flex-wrap">
          {FILTER_CHIPS.map((chip) => {
            const count =
              chip.value === "all"
                ? selectedSession.events.length
                : selectedSession.events.filter((ev) =>
                    matchesFilter(ev, chip.value)
                  ).length;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setActiveFilter(chip.value)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs transition-colors",
                  "focus:outline-none focus:ring-1 focus:ring-indigo-500",
                  chip.value === activeFilter
                    ? "bg-primary/20 text-primary font-semibold"
                    : "bg-[var(--color-surface-2)]/60 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
                )}
              >
                {chip.label}
                <span className="ml-1.5 text-[var(--color-text-muted)]">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Event list */}
        <div
          ref={eventListRef}
          className="flex-1 overflow-y-auto"
        >
          {filteredEvents.length === 0 && (
            <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)] text-sm">
              No events match this filter.
            </div>
          )}

          {filteredEvents.map((event, idx) => {
            const isCurrent = idx === currentEventIndex;
            return (
              <div
                key={event.id}
                ref={isCurrent ? currentEventRef : undefined}
              >
                <EventRow
                  event={event}
                  isCurrent={isCurrent}
                  isExpanded={expandedEventId === event.id}
                  onToggle={() => toggleExpand(event.id)}
                />
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
