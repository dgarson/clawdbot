import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocType = "note" | "guide" | "reference" | "runbook" | "decision" | "spec";
type DocStatus = "draft" | "published" | "archived";

interface KBTag { name: string; color: string; }

interface KBDoc {
  id: string;
  title: string;
  type: DocType;
  status: DocStatus;
  excerpt: string;
  content: string;
  tags: string[];
  author: { name: string; emoji: string };
  agentContext: string[];   // which agents can access/use this
  createdAt: Date;
  updatedAt: Date;
  views: number;
  wordCount: number;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const days = (n: number) => n * 86_400_000;
const hrs = (n: number) => n * 3_600_000;

const SEED_DOCS: KBDoc[] = [
  {
    id: "kb1",
    title: "Horizon UI Architecture",
    type: "spec",
    status: "published",
    excerpt: "Technical specification for the Horizon React SPA — stack, component patterns, routing, and design system.",
    content: `# Horizon UI Architecture

## Overview
Horizon is OpenClaw's next-generation web interface, built with Vite + React + TypeScript + Tailwind CSS.

## Stack
- **Framework:** Vite + React 18 + TypeScript (strict)
- **Styling:** Tailwind CSS v4 + dark zinc theme
- **State:** React Context (no external state library)
- **Icons:** Lucide React (tree-shakeable)
- **Build:** pnpm + vitest

## Component Patterns
All views are lazy-loaded React components with a single default export.
Import only \`cn\` from \`../lib/utils\` for class merging.

## Design System
Dark theme with zinc-950 background, zinc-900 cards, zinc-800 borders.
Accent: indigo-500. Success: emerald-400. Error: rose-400. Warning: amber-400.

## Navigation
Sidebar nav with emoji + label. Cmd+K command palette. Alt+1-9 shortcuts.`,
    tags: ["architecture", "frontend", "horizon", "spec"],
    author: { name: "Luis", emoji: "🎨" },
    agentContext: ["luis", "piper", "quinn", "wes"],
    createdAt: ago(days(5)),
    updatedAt: ago(hrs(6)),
    views: 47,
    wordCount: 312,
  },
  {
    id: "kb2",
    title: "Agent PR Review Protocol",
    type: "runbook",
    status: "published",
    excerpt: "Step-by-step guide for reviewing worker PRs — when to approve, fix, or request changes.",
    content: `# Agent PR Review Protocol

## Decision Tree

### APPROVE + MERGE
All of the following are true:
- TypeScript: no \`any\`, strict types
- Tests present and meaningful
- Follows existing patterns
- No security issues
- No regressions

\`\`\`bash
gh pr review <PR> --approve
gh pr merge <PR> --squash
\`\`\`

### MINOR FIX + MERGE
Small issue, fast to fix yourself. Fix on their branch, then merge.

### REQUEST CHANGES (one revision cycle)
Substantial issues. Leave detailed feedback. Worker gets one revision.

### TAKE OWNERSHIP (worker fails twice)
After two failed cycles: complete it yourself, notify Xavier/Tim.

## What to check
1. Architecture fit
2. TypeScript strictness (NO any)
3. Test coverage
4. Accessibility (ARIA, focus management)
5. Edge cases (loading, error, empty states)
6. Security (no hardcoded secrets, safe rendering)`,
    tags: ["process", "PRs", "review", "workflow"],
    author: { name: "Luis", emoji: "🎨" },
    agentContext: ["luis"],
    createdAt: ago(days(10)),
    updatedAt: ago(days(2)),
    views: 31,
    wordCount: 198,
  },
  {
    id: "kb3",
    title: "Brand Voice Guidelines",
    type: "guide",
    status: "published",
    excerpt: "OpenClaw's brand personality, tone of voice, and writing principles for all content.",
    content: `# Brand Voice Guidelines

## Core Personality
**Confident, warm, pragmatic.** We build tools for people who get things done.

## Tone Principles
1. **Direct** — Say it once, clearly. No padding.
2. **Human** — Write like you're talking to a smart peer.
3. **Honest** — Don't oversell. If it's beta, say so.
4. **Empowering** — Every word should make the reader feel capable.

## What we never say
- "Leverage synergies"
- "Best-in-class" (prove it instead)
- "Utilize" (say "use")
- "Solution" (say what you actually built)

## Examples
❌ "Our cutting-edge AI solution leverages state-of-the-art..."
✅ "OpenClaw lets your agents search the web, write code, and send Slack messages — autonomously."

## Writing for documentation
- Short sentences (avg 15 words)
- Active voice always
- Start with the most important thing
- One idea per paragraph`,
    tags: ["brand", "writing", "tone", "content"],
    author: { name: "Stephan", emoji: "📣" },
    agentContext: ["stephan", "luis"],
    createdAt: ago(days(15)),
    updatedAt: ago(days(3)),
    views: 89,
    wordCount: 241,
  },
  {
    id: "kb4",
    title: "Gateway WebSocket Protocol",
    type: "reference",
    status: "published",
    excerpt: "Message format, event types, and authentication for the OpenClaw Gateway WebSocket API.",
    content: `# Gateway WebSocket Protocol

## Connection
Connect to: \`ws://127.0.0.1:9090\`

## Authentication
Send auth token in first message:
\`\`\`json
{ "type": "auth", "token": "YOUR_TOKEN" }
\`\`\`

## Message Format
All messages are JSON with a required \`type\` field:
\`\`\`json
{
  "type": "session.message",
  "sessionKey": "agent:luis:cron:abc123",
  "content": "Hello from Luis",
  "timestamp": "2026-02-22T01:00:00Z"
}
\`\`\`

## Core Event Types
- \`session.create\` — New session started
- \`session.message\` — Message in session
- \`session.end\` — Session terminated
- \`agent.heartbeat\` — Agent alive ping
- \`cron.fire\` — Scheduled job triggered
- \`tool.call\` — Agent invoked a tool
- \`tool.result\` — Tool returned result

## Error Handling
Reconnect with exponential backoff: 1s, 2s, 4s, 8s, max 30s.`,
    tags: ["API", "WebSocket", "protocol", "gateway", "reference"],
    author: { name: "Tim", emoji: "⚙️" },
    agentContext: ["tim", "xavier", "luis"],
    createdAt: ago(days(20)),
    updatedAt: ago(days(5)),
    views: 124,
    wordCount: 287,
  },
  {
    id: "kb5",
    title: "Megabranch Workflow",
    type: "runbook",
    status: "published",
    excerpt: "How to create, manage, and ship megabranches for multi-view feature work.",
    content: `# Megabranch Workflow

## Create
\`\`\`bash
git fetch origin
git checkout -b feat/<project> origin/dgarson/fork
git push -u origin feat/<project>
\`\`\`

## Delegate to workers
Tell each worker to branch off your megabranch, PR back to it.
Post in #cb-activity: branch name, assignments, dependencies.

## Keep healthy
\`\`\`bash
git rebase origin/dgarson/fork feat/<project>
git push --force-with-lease
\`\`\`

## Ship
1. All tasks merged into megabranch
2. \`pnpm check\` passes
3. Open PR to \`dgarson/fork\`
4. Notify Tim (engineering review) + Xavier (product review)

## PR format
Title: descriptive workstream name
Body: what shipped, affected surfaces, dependencies, testing notes`,
    tags: ["git", "workflow", "megabranch", "process"],
    author: { name: "Luis", emoji: "🎨" },
    agentContext: ["luis", "piper", "quinn", "reed", "wes"],
    createdAt: ago(days(8)),
    updatedAt: ago(days(1)),
    views: 56,
    wordCount: 178,
  },
  {
    id: "kb6",
    title: "Agent Architecture Decisions",
    type: "decision",
    status: "published",
    excerpt: "Key architectural decisions for the multi-agent system — models, memory, orchestration.",
    content: `# Agent Architecture Decisions

## Model Assignment (Feb 2026)

**Decision:** Tier models by agent complexity/cost.
- Principal agents (Luis, Xavier, Stephan): claude-sonnet-4-6
- Worker agents (Piper, Quinn, Reed, Wes, Sam): minimax-m2.5
- Heavy reasoning tasks: claude-opus-4-6 (Xavier only)

**Rationale:** Sonnet offers best quality/cost for principal roles. MiniMax is fast and cheap for worker coding tasks.

## Memory Architecture

**Decision:** Dual-layer memory: daily notes + MEMORY.md.
- Daily: \`memory/YYYY-MM-DD.md\` — session log
- Long-term: \`MEMORY.md\` — design decisions, key insights

**Rationale:** Daily files prevent MEMORY.md bloat. Agents read both on startup.

## Orchestration Pattern

**Decision:** Principal agents spawn sub-agents (not workers spawning workers).
- Max 2 medium-tier sub-agents simultaneously
- Never use Opus for prototyping (too expensive)
- Sub-agents auto-announce completion

**Rationale:** Centralized orchestration prevents runaway parallelism.`,
    tags: ["architecture", "decisions", "models", "orchestration"],
    author: { name: "Xavier", emoji: "🏗️" },
    agentContext: ["xavier", "luis", "tim"],
    createdAt: ago(days(12)),
    updatedAt: ago(days(4)),
    views: 78,
    wordCount: 267,
  },
  {
    id: "kb7",
    title: "Onboarding New Agents",
    type: "guide",
    status: "published",
    excerpt: "Step-by-step guide to creating, configuring, and deploying a new OpenClaw agent.",
    content: `# Onboarding New Agents

## 1. Define the role
Write AGENTS.md: role, responsibilities, reporting line, decision authority.

## 2. Write SOUL.md
The agent's identity, principles, and voice. Make it feel like a real person.

## 3. Create workspace
\`\`\`
mkdir ~/.openclaw/workspace/<agent-name>
cp _shared/templates/AGENTS.md <agent-name>/
cp _shared/templates/SOUL.md <agent-name>/
\`\`\`

## 4. Configure model
Choose model based on role complexity:
- Principal: claude-sonnet-4-6
- Worker: minimax-m2.5

## 5. Set capabilities
Which tools does this agent need? Start minimal, add as needed.

## 6. Write first memory file
Create \`memory/YYYY-MM-DD.md\` so the agent has context on day one.

## 7. Announce
Post to #cb-activity: new agent name, role, reporting line.
Xavier approves all new principal agents.`,
    tags: ["onboarding", "agents", "setup", "guide"],
    author: { name: "Xavier", emoji: "🏗️" },
    agentContext: ["xavier", "luis"],
    createdAt: ago(days(25)),
    updatedAt: ago(days(7)),
    views: 112,
    wordCount: 224,
  },
  {
    id: "kb8",
    title: "WCAG 2.1 AA Quick Reference",
    type: "reference",
    status: "published",
    excerpt: "Accessibility requirements Luis's squad must meet for all Horizon UI components.",
    content: `# WCAG 2.1 AA Quick Reference

## Focus Management
- All interactive elements must have visible focus rings
- \`focus-visible:ring-2 focus-visible:ring-indigo-500\`
- Tab order must be logical and predictable
- Modals must trap focus; restore on close

## Labels
- Every input needs a \`<label htmlFor="...">\` or \`aria-label\`
- Icon buttons need \`aria-label\`
- Images need \`alt\` (or \`alt=""\` if decorative)

## Color Contrast
- Normal text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- Never use color alone to convey meaning

## Dynamic Content
- Use \`aria-live="polite"\` for non-critical updates
- Use \`aria-live="assertive"\` only for critical alerts
- Loading states need descriptive text

## Key ARIA Patterns
\`\`\`tsx
// List selection
<div role="listbox" aria-label="...">
  <button role="option" aria-selected={isSelected}>

// Tabs
<div role="tablist">
  <button role="tab" aria-selected={isActive} aria-controls="panel-id">
  <div role="tabpanel" id="panel-id">

// Modal
<div role="dialog" aria-modal="true" aria-labelledby="title-id">
\`\`\``,
    tags: ["accessibility", "WCAG", "a11y", "reference", "frontend"],
    author: { name: "Luis", emoji: "🎨" },
    agentContext: ["luis", "piper", "quinn", "reed", "wes"],
    createdAt: ago(days(18)),
    updatedAt: ago(days(2)),
    views: 93,
    wordCount: 298,
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<DocType, { label: string; emoji: string; color: string }> = {
  note:      { label: "Note",      emoji: "📝", color: "text-[var(--color-text-secondary)]" },
  guide:     { label: "Guide",     emoji: "📖", color: "text-emerald-400" },
  reference: { label: "Reference", emoji: "📋", color: "text-primary" },
  runbook:   { label: "Runbook",   emoji: "⚙️", color: "text-amber-400" },
  decision:  { label: "Decision",  emoji: "⚖️", color: "text-primary" },
  spec:      { label: "Spec",      emoji: "📐", color: "text-cyan-400" },
};

const STATUS_CONFIG: Record<DocStatus, { label: string; badge: string }> = {
  draft:     { label: "Draft",     badge: "bg-[var(--color-surface-3)]/50 text-[var(--color-text-secondary)] ring-1 ring-zinc-600/30" },
  published: { label: "Published", badge: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25" },
  archived:  { label: "Archived",  badge: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]/30" },
};

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Doc Card ─────────────────────────────────────────────────────────────────

interface DocCardProps {
  doc: KBDoc;
  selected: boolean;
  onSelect: () => void;
}

function DocCard({ doc, selected, onSelect }: DocCardProps) {
  const typeCfg = TYPE_CONFIG[doc.type];
  const statusCfg = STATUS_CONFIG[doc.status];

  return (
    <button
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "w-full text-left p-4 border-b border-[var(--color-border)]/50 transition-colors",
        "hover:bg-[var(--color-surface-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
        selected && "bg-[var(--color-surface-1)] border-l-2 border-l-indigo-500"
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-base flex-none mt-0.5">{typeCfg.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">{doc.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn("text-xs", typeCfg.color)}>{typeCfg.label}</span>
            <span className={cn("px-1.5 py-0.5 text-xs rounded-full", statusCfg.badge)}>{statusCfg.label}</span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2 leading-relaxed">{doc.excerpt}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
            <span>{doc.author.emoji} {doc.author.name}</span>
            <span>{relTime(doc.updatedAt)}</span>
            <span>{doc.views} views</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Doc Detail ───────────────────────────────────────────────────────────────

function DocDetail({ doc }: { doc: KBDoc }) {
  const typeCfg = TYPE_CONFIG[doc.type];
  const statusCfg = STATUS_CONFIG[doc.status];

  // Very simple markdown-to-HTML renderer for the seed content
  const renderContent = (md: string): React.ReactNode => {
    return md.split("\n").map((line, i) => {
      if (line.startsWith("# ")) {return <h1 key={i} className="text-xl font-bold text-[var(--color-text-primary)] mt-0 mb-3">{line.slice(2)}</h1>;}
      if (line.startsWith("## ")) {return <h2 key={i} className="text-base font-semibold text-[var(--color-text-primary)] mt-5 mb-2">{line.slice(3)}</h2>;}
      if (line.startsWith("### ")) {return <h3 key={i} className="text-sm font-semibold text-[var(--color-text-primary)] mt-4 mb-1">{line.slice(4)}</h3>;}
      if (line.startsWith("- ")) {return <li key={i} className="text-sm text-[var(--color-text-secondary)] ml-4 list-disc leading-relaxed">{line.slice(2)}</li>;}
      if (line.startsWith("```")) {return <div key={i} className={line === "```" ? "mb-3" : "mt-2 px-3 py-2 bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg font-mono text-xs text-[var(--color-text-primary)]"} />;}
      if (line.startsWith("**") && line.endsWith("**")) {
        return <p key={i} className="text-sm font-semibold text-[var(--color-text-primary)] mt-2">{line.slice(2, -2)}</p>;
      }
      if (line === "") {return <div key={i} className="h-2" />;}
      if (line.startsWith("❌") || line.startsWith("✅")) {
        return <p key={i} className={cn("text-sm font-mono mt-1", line.startsWith("❌") ? "text-rose-400" : "text-emerald-400")}>{line}</p>;
      }
      // Inline code
      const parts = line.split(/(`[^`]+`)/g);
      return (
        <p key={i} className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {parts.map((part, j) =>
            part.startsWith("`") && part.endsWith("`")
              ? <code key={j} className="px-1 py-0.5 text-xs font-mono bg-[var(--color-surface-2)] text-emerald-300 rounded">{part.slice(1, -1)}</code>
              : part
          )}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex-none px-6 py-5 border-b border-[var(--color-border)]">
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-none">{typeCfg.emoji}</span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{doc.title}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={cn("text-xs", typeCfg.color)}>{typeCfg.label}</span>
              <span className={cn("px-1.5 py-0.5 text-xs rounded-full", statusCfg.badge)}>{statusCfg.label}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{doc.wordCount} words · {doc.views} views</span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
              <span>{doc.author.emoji} {doc.author.name}</span>
              <span>·</span>
              <span>Updated {relTime(doc.updatedAt)}</span>
              <span>·</span>
              <span>Created {relTime(doc.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <button aria-label="Edit document" className="py-1.5 px-3 text-xs font-medium rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors">Edit</button>
          </div>
        </div>

        {/* Agent access */}
        {doc.agentContext.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--color-text-muted)]">Access:</span>
            {doc.agentContext.map((a) => (
              <span key={a} className="text-xs px-1.5 py-0.5 rounded-md bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)] capitalize">{a}</span>
            ))}
          </div>
        )}

        {/* Tags */}
        <div className="mt-2 flex flex-wrap gap-1">
          {doc.tags.map((t) => (
            <span key={t} className="px-1.5 py-0.5 text-xs rounded bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]/50">{t}</span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-5">
        <div className="prose-custom max-w-none space-y-0.5">
          {renderContent(doc.content)}
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type DocTypeFilter = DocType | "all";
type SortOrder = "updated" | "views" | "title";

export default function KnowledgeBase() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocTypeFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("updated");
  const [selectedId, setSelectedId] = useState<string>(SEED_DOCS[0].id);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const filtered = SEED_DOCS
    .filter((d) => {
      if (typeFilter !== "all" && d.type !== typeFilter) {return false;}
      if (search.trim()) {
        const q = search.toLowerCase();
        return d.title.toLowerCase().includes(q) || d.excerpt.toLowerCase().includes(q) || d.tags.some((t) => t.toLowerCase().includes(q));
      }
      return true;
    })
    .toSorted((a, b) => {
      if (sortOrder === "views") {return b.views - a.views;}
      if (sortOrder === "title") {return a.title.localeCompare(b.title);}
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

  const selectedDoc = SEED_DOCS.find((d) => d.id === selectedId) ?? SEED_DOCS[0];

  const stats = {
    total: SEED_DOCS.length,
    published: SEED_DOCS.filter((d) => d.status === "published").length,
    totalViews: SEED_DOCS.reduce((s, d) => s + d.views, 0),
    totalWords: SEED_DOCS.reduce((s, d) => s + d.wordCount, 0),
  };

  const ALL_TYPES: { id: DocTypeFilter; label: string }[] = [
    { id: "all", label: "All" },
    ...Object.entries(TYPE_CONFIG).map(([id, cfg]) => ({ id: id as DocType, label: cfg.label })),
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)]">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Knowledge Base</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Agent documentation, runbooks, decisions, and references</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span><span className="text-[var(--color-text-primary)] font-semibold">{stats.total}</span> docs</span>
            <span><span className="text-emerald-400 font-semibold">{stats.published}</span> published</span>
            <span><span className="text-primary font-semibold">{stats.totalViews}</span> total views</span>
            <span><span className="text-[var(--color-text-secondary)] font-semibold">{(stats.totalWords / 1000).toFixed(1)}K</span> words</span>
            <button aria-label="Create new document" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-[var(--color-text-primary)] hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors font-medium">
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M7 2v10M2 7h10" /></svg>
              New Doc
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar: doc list */}
        <div className="w-72 flex-none flex flex-col border-r border-[var(--color-border)]">
          {/* Filters */}
          <div className="flex-none px-3 py-2 border-b border-[var(--color-border)] space-y-2">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)] pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="7" cy="7" r="4.5" /><path strokeLinecap="round" d="M10.5 10.5l3 3" />
              </svg>
              <input ref={searchRef} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search docs… (⌘F)" aria-label="Search knowledge base" className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex gap-2">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as DocTypeFilter)} aria-label="Filter by type" className="flex-1 py-1 pl-2 pr-6 text-xs bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                {ALL_TYPES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)} aria-label="Sort order" className="flex-1 py-1 pl-2 pr-6 text-xs bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                <option value="updated">Updated</option>
                <option value="views">Most viewed</option>
                <option value="title">A–Z</option>
              </select>
            </div>
          </div>

          {/* Doc list */}
          <div role="listbox" aria-label="Documents" className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-xs text-[var(--color-text-muted)] text-center">No docs match</p>
            ) : (
              filtered.map((doc) => (
                <DocCard key={doc.id} doc={doc} selected={selectedId === doc.id} onSelect={() => setSelectedId(doc.id)} />
              ))
            )}
          </div>
        </div>

        {/* Right: document detail */}
        <div className="flex-1 min-w-0">
          <DocDetail doc={selectedDoc} />
        </div>
      </div>
    </div>
  );
}
