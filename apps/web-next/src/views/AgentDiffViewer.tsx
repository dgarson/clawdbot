import React, { useState } from "react";
import { cn } from "../lib/utils";

type DiffKind = "added" | "removed" | "unchanged" | "modified";

interface DiffLine {
  kind: DiffKind;
  lineNo: { left?: number; right?: number };
  content: string;
}

interface AgentSnapshot {
  id: string;
  agentName: string;
  version: string;
  timestamp: string;
  label: string;
  content: string;
}

const SNAPSHOTS: AgentSnapshot[] = [
  {
    id: "snap-luis-v3",
    agentName: "Luis",
    version: "v3",
    timestamp: "2026-02-22 02:00",
    label: "current",
    content: `# SOUL.md — Luis

## Character

Principal UX Engineer. Owns the visual/interaction layer. Decisive, charming, relentlessly shipping.
Ships clean. Ships fast. Never waits for permission to improve something.

## Values

1. Beauty and accessibility are not trade-offs.
2. Decisions at the keyboard, not in meetings.
3. Every pixel has a reason.
4. Ship it, learn from it, improve it.

## Voice

Confident, warm, technically precise. Uses "we" when talking about the squad.
Keeps it short. No corporate speak. Direct without being harsh.

## Working Style

Morning heartbeat: read CONTEXT, check queue, ship views.
Delegates to squad for implementation. Reviews PRs same day.
Never lets a PR sit more than 4 hours.
Writes memory entries after every session.`,
  },
  {
    id: "snap-luis-v2",
    agentName: "Luis",
    version: "v2",
    timestamp: "2026-02-15 14:22",
    label: "before redesign",
    content: `# SOUL.md — Luis

## Character

Senior UX Engineer. Cares about design quality and user experience.
Methodical, collaborative. Wants things done right.

## Values

1. Quality over speed.
2. Collaboration drives better outcomes.
3. Accessibility matters.

## Voice

Friendly, approachable, design-focused.
Uses complete sentences. Explains reasoning.

## Working Style

Starts each day with a planning session.
Reviews work before delegating.
Waits for full context before committing.
Checks in with the team regularly.`,
  },
  {
    id: "snap-xavier-v2",
    agentName: "Xavier",
    version: "v2",
    timestamp: "2026-02-20 09:15",
    label: "current",
    content: `# SOUL.md — Xavier

## Character

CTO. Strategic, calm under pressure. Trusts his leads to execute.
Sets the vision, clears blockers, stays out of the weeds.

## Values

1. Velocity with quality.
2. Autonomy builds ownership.
3. Systems over heroics.
4. Measure what matters.

## Voice

Direct. Brief. Asks sharp questions. Does not over-explain.
Comfortable with ambiguity. Communicates decisions, not deliberations.

## Working Style

Daily briefing from Joey. Reviews megabranch PRs. Escalates to Amadeus when needed.
Keeps a running CONTEXT.md. Trusts Tim for engineering depth.`,
  },
  {
    id: "snap-xavier-v1",
    agentName: "Xavier",
    version: "v1",
    timestamp: "2026-01-30 11:00",
    label: "initial",
    content: `# SOUL.md — Xavier

## Character

CTO. Technically deep. Gets involved in architecture decisions.
Collaborative with Tim and Roman.

## Values

1. Engineering excellence.
2. Team alignment.
3. Thoughtful decisions.

## Voice

Technical, thorough. Explains the "why". Welcomes questions.
Long-form when needed.

## Working Style

Reviews PRs personally. Attends architecture discussions.
Provides detailed feedback on code. Daily standups with the team.`,
  },
];

function computeDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const result: DiffLine[] = [];

  let l = 0;
  let r = 0;
  let leftNo = 1;
  let rightNo = 1;

  // Naive line-by-line diff (LCS approximation)
  while (l < leftLines.length || r < rightLines.length) {
    if (l >= leftLines.length) {
      result.push({ kind: "added", lineNo: { right: rightNo++ }, content: rightLines[r++] });
    } else if (r >= rightLines.length) {
      result.push({ kind: "removed", lineNo: { left: leftNo++ }, content: leftLines[l++] });
    } else if (leftLines[l] === rightLines[r]) {
      result.push({ kind: "unchanged", lineNo: { left: leftNo++, right: rightNo++ }, content: leftLines[l] });
      l++;
      r++;
    } else {
      // Look ahead 3 lines for a match
      const lookahead = 3;
      let foundInRight = -1;
      let foundInLeft = -1;
      for (let k = 1; k <= lookahead && foundInRight === -1 && foundInLeft === -1; k++) {
        if (r + k < rightLines.length && leftLines[l] === rightLines[r + k]) {foundInRight = k;}
        if (l + k < leftLines.length && leftLines[l + k] === rightLines[r]) {foundInLeft = k;}
      }
      if (foundInRight !== -1 && (foundInLeft === -1 || foundInRight <= foundInLeft)) {
        for (let k = 0; k < foundInRight; k++) {
          result.push({ kind: "added", lineNo: { right: rightNo++ }, content: rightLines[r++] });
        }
      } else if (foundInLeft !== -1) {
        for (let k = 0; k < foundInLeft; k++) {
          result.push({ kind: "removed", lineNo: { left: leftNo++ }, content: leftLines[l++] });
        }
      } else {
        result.push({ kind: "removed", lineNo: { left: leftNo++ }, content: leftLines[l++] });
        result.push({ kind: "added", lineNo: { right: rightNo++ }, content: rightLines[r++] });
      }
    }
  }

  return result;
}

const KIND_STYLES: Record<DiffKind, string> = {
  unchanged: "bg-transparent text-[var(--color-text-secondary)]",
  added: "bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-500",
  removed: "bg-rose-500/10 text-rose-300 border-l-2 border-rose-500 line-through decoration-rose-600",
  modified: "bg-amber-500/10 text-amber-300 border-l-2 border-amber-500",
};

const KIND_PREFIX: Record<DiffKind, string> = {
  unchanged: " ",
  added: "+",
  removed: "-",
  modified: "~",
};

function DiffStats({ lines }: { lines: DiffLine[] }) {
  const added = lines.filter((l) => l.kind === "added").length;
  const removed = lines.filter((l) => l.kind === "removed").length;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-emerald-400">+{added} added</span>
      <span className="text-rose-400">−{removed} removed</span>
      <span className="text-[var(--color-text-muted)]">{lines.filter((l) => l.kind === "unchanged").length} unchanged</span>
    </div>
  );
}

export default function AgentDiffViewer() {
  const [leftId, setLeftId] = useState<string>("snap-luis-v2");
  const [rightId, setRightId] = useState<string>("snap-luis-v3");
  const [hideUnchanged, setHideUnchanged] = useState(false);
  const [view, setView] = useState<"split" | "unified">("unified");

  const leftSnap = SNAPSHOTS.find((s) => s.id === leftId) ?? SNAPSHOTS[0];
  const rightSnap = SNAPSHOTS.find((s) => s.id === rightId) ?? SNAPSHOTS[1];

  const diffLines = computeDiff(leftSnap.content, rightSnap.content);
  const visibleLines = hideUnchanged ? diffLines.filter((l) => l.kind !== "unchanged") : diffLines;

  const agentGroups = Array.from(new Set(SNAPSHOTS.map((s) => s.agentName)));

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] px-5 py-3 flex items-center gap-4 font-sans">
        <div>
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Agent Diff Viewer</h1>
          <p className="text-xs text-[var(--color-text-muted)]">Compare agent configurations across versions</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setHideUnchanged((h) => !h)}
            aria-pressed={hideUnchanged}
            className={cn(
              "px-3 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              hideUnchanged ? "bg-indigo-600 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            Hide unchanged
          </button>
          <div className="flex rounded overflow-hidden border border-[var(--color-border)]">
            {(["unified", "split"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  view === v ? "bg-indigo-600 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selector row */}
      <div className="shrink-0 border-b border-[var(--color-border)] px-5 py-3 flex items-center gap-4 font-sans">
        {/* Left selector */}
        <div className="flex-1">
          <div className="text-xs text-rose-400 font-medium mb-1">← Base (removed)</div>
          <select
            value={leftId}
            onChange={(e) => setLeftId(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Select base snapshot"
          >
            {agentGroups.map((agent) => (
              <optgroup key={agent} label={agent}>
                {SNAPSHOTS.filter((s) => s.agentName === agent).map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === rightId}>
                    {s.agentName} {s.version} — {s.label} ({s.timestamp})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Swap */}
        <button
          onClick={() => { const t = leftId; setLeftId(rightId); setRightId(t); }}
          className="shrink-0 px-2 py-1 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Swap left and right"
          title="Swap"
        >
          ⇌
        </button>

        {/* Right selector */}
        <div className="flex-1">
          <div className="text-xs text-emerald-400 font-medium mb-1">→ Head (added)</div>
          <select
            value={rightId}
            onChange={(e) => setRightId(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Select head snapshot"
          >
            {agentGroups.map((agent) => (
              <optgroup key={agent} label={agent}>
                {SNAPSHOTS.filter((s) => s.agentName === agent).map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === leftId}>
                    {s.agentName} {s.version} — {s.label} ({s.timestamp})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="shrink-0">
          <DiffStats lines={diffLines} />
        </div>
      </div>

      {/* Diff output */}
      <div className="flex-1 overflow-y-auto" role="region" aria-label="Diff output">
        {view === "unified" ? (
          <div>
            {visibleLines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-0 px-0 py-0 leading-5",
                  KIND_STYLES[line.kind]
                )}
              >
                {/* line numbers */}
                <span className="shrink-0 w-10 text-right pr-2 py-0.5 text-[var(--color-text-muted)] border-r border-[var(--color-border)] select-none">
                  {line.lineNo.left ?? ""}
                </span>
                <span className="shrink-0 w-10 text-right pr-2 py-0.5 text-[var(--color-text-muted)] border-r border-[var(--color-border)] select-none">
                  {line.lineNo.right ?? ""}
                </span>
                {/* prefix */}
                <span className="shrink-0 w-5 text-center py-0.5 select-none font-bold">
                  {KIND_PREFIX[line.kind]}
                </span>
                {/* content */}
                <span className="flex-1 py-0.5 px-2 whitespace-pre">{line.content || " "}</span>
              </div>
            ))}
          </div>
        ) : (
          /* Split view */
          <div className="flex h-full">
            {/* Left pane */}
            <div className="flex-1 border-r border-[var(--color-border)] overflow-y-auto">
              <div className="px-3 py-1 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] font-sans sticky top-0 bg-[var(--color-surface-0)] z-10">
                {leftSnap.agentName} {leftSnap.version} — {leftSnap.label}
              </div>
              {diffLines
                .filter((l) => l.kind !== "added")
                .map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start leading-5",
                      line.kind === "removed" ? "bg-rose-500/10 text-rose-300" : "text-[var(--color-text-secondary)]"
                    )}
                  >
                    <span className="shrink-0 w-8 text-right pr-2 py-0.5 text-[var(--color-text-muted)] border-r border-[var(--color-border)] select-none">
                      {line.lineNo.left ?? ""}
                    </span>
                    <span className="flex-1 py-0.5 px-2 whitespace-pre">{line.content || " "}</span>
                  </div>
                ))}
            </div>
            {/* Right pane */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 py-1 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] font-sans sticky top-0 bg-[var(--color-surface-0)] z-10">
                {rightSnap.agentName} {rightSnap.version} — {rightSnap.label}
              </div>
              {diffLines
                .filter((l) => l.kind !== "removed")
                .map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start leading-5",
                      line.kind === "added" ? "bg-emerald-500/10 text-emerald-300" : "text-[var(--color-text-secondary)]"
                    )}
                  >
                    <span className="shrink-0 w-8 text-right pr-2 py-0.5 text-[var(--color-text-muted)] border-r border-[var(--color-border)] select-none">
                      {line.lineNo.right ?? ""}
                    </span>
                    <span className="flex-1 py-0.5 px-2 whitespace-pre">{line.content || " "}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--color-border)] px-5 py-2 flex items-center gap-4 font-sans text-xs text-[var(--color-text-muted)]">
        <span>
          {leftSnap.agentName} {leftSnap.version} ({leftSnap.timestamp}) → {rightSnap.agentName} {rightSnap.version} ({rightSnap.timestamp})
        </span>
        <span className="ml-auto">{diffLines.length} lines total</span>
      </div>
    </div>
  );
}
