import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = "workspace" | "discussions" | "notes" | "activity";

type Availability = "available" | "busy" | "away" | "offline";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  availability: Availability;
  currentTask: string;
  skills: string[];
  capacityPercent: number;
}

interface Reply {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timestamp: string;
}

type DiscussionTag = "question" | "announcement" | "idea" | "bug";

interface Discussion {
  id: string;
  title: string;
  author: string;
  avatar: string;
  replyCount: number;
  lastActivity: string;
  tags: DiscussionTag[];
  preview: string;
  replies: Reply[];
}

interface NoteSection {
  id: string;
  title: string;
  content: string;
  lastEditedBy: string;
  lastEditedAt: string;
}

type ActivityKind = "commit" | "pr_review" | "deploy" | "config" | "comment" | "merge" | "branch";

interface ActivityItem {
  id: string;
  actor: string;
  avatar: string;
  kind: ActivityKind;
  description: string;
  target: string;
  timestamp: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "workspace", label: "Workspace", icon: "👥" },
  { id: "discussions", label: "Discussions", icon: "💬" },
  { id: "notes", label: "Shared Notes", icon: "📋" },
  { id: "activity", label: "Activity", icon: "⚡" },
];

const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "piper",
    name: "Piper",
    role: "Component Architect",
    avatar: "🟣",
    availability: "available",
    currentTask: "Design system token migration",
    skills: ["React", "Tailwind", "Radix UI", "Storybook"],
    capacityPercent: 65,
  },
  {
    id: "quinn",
    name: "Quinn",
    role: "Interaction Designer",
    avatar: "🔵",
    availability: "busy",
    currentTask: "Onboarding flow redesign",
    skills: ["UX Research", "Accessibility", "Figma", "Motion"],
    capacityPercent: 90,
  },
  {
    id: "reed",
    name: "Reed",
    role: "State Management Lead",
    avatar: "🟢",
    availability: "available",
    currentTask: "Client data layer refactor",
    skills: ["Zustand", "React Query", "TypeScript", "Testing"],
    capacityPercent: 45,
  },
  {
    id: "wes",
    name: "Wes",
    role: "Performance Engineer",
    avatar: "🟠",
    availability: "away",
    currentTask: "Bundle size optimization",
    skills: ["Vite", "Profiling", "Web Vitals", "SSR"],
    capacityPercent: 30,
  },
  {
    id: "sam",
    name: "Sam",
    role: "API Integration Specialist",
    avatar: "🔴",
    availability: "busy",
    currentTask: "WebSocket event system",
    skills: ["REST", "GraphQL", "WebSockets", "Auth"],
    capacityPercent: 85,
  },
  {
    id: "alex",
    name: "Alex",
    role: "QA & Testing Lead",
    avatar: "🟡",
    availability: "offline",
    currentTask: "E2E test suite expansion",
    skills: ["Playwright", "Vitest", "CI/CD", "Coverage"],
    capacityPercent: 0,
  },
  {
    id: "morgan",
    name: "Morgan",
    role: "Design Technologist",
    avatar: "🟤",
    availability: "available",
    currentTask: "Animation library prototype",
    skills: ["Framer Motion", "CSS", "Canvas", "WebGL"],
    capacityPercent: 55,
  },
];

const DISCUSSIONS: Discussion[] = [
  {
    id: "d1",
    title: "Should we adopt server components for the dashboard?",
    author: "Piper",
    avatar: "🟣",
    replyCount: 8,
    lastActivity: "2h ago",
    tags: ["question"],
    preview:
      "I've been looking into RSC for the main dashboard views. The data-fetching pattern could simplify a lot of our loading state management...",
    replies: [
      {
        id: "r1a",
        author: "Quinn",
        avatar: "🔵",
        content:
          "I think RSC makes sense for the read-heavy pages, but we need to be careful about interactive widgets. The composition model changes significantly.",
        timestamp: "4h ago",
      },
      {
        id: "r1b",
        author: "Reed",
        avatar: "🟢",
        content:
          "Agreed with Quinn. We'd also need to rethink how Zustand stores interact with server-rendered trees. Happy to spike on that.",
        timestamp: "3h ago",
      },
      {
        id: "r1c",
        author: "Wes",
        avatar: "🟠",
        content:
          "From a perf standpoint, the streaming model is a huge win. Initial bundle could drop 30-40% for those views.",
        timestamp: "2h ago",
      },
    ],
  },
  {
    id: "d2",
    title: "🚀 Design system v2.0 launch plan",
    author: "Luis",
    avatar: "🎨",
    replyCount: 12,
    lastActivity: "30m ago",
    tags: ["announcement"],
    preview:
      "The design system v2.0 milestone is set for March 15. Here's the rollout plan with phase gates and team assignments...",
    replies: [
      {
        id: "r2a",
        author: "Piper",
        avatar: "🟣",
        content:
          "Token migration is on track. I'll have the color and spacing tokens done by EOW. Typography tokens next week.",
        timestamp: "1h ago",
      },
      {
        id: "r2b",
        author: "Morgan",
        avatar: "🟤",
        content:
          "Animation tokens are a new concept for us. I've drafted a proposal for easing curves and duration scales — will share tomorrow.",
        timestamp: "30m ago",
      },
    ],
  },
  {
    id: "d3",
    title: "Accessibility audit findings — critical issues",
    author: "Quinn",
    avatar: "🔵",
    replyCount: 6,
    lastActivity: "1h ago",
    tags: ["bug"],
    preview:
      "Ran a full axe-core scan plus manual screen reader testing. Found 14 critical issues across 5 views. Priority list attached...",
    replies: [
      {
        id: "r3a",
        author: "Reed",
        avatar: "🟢",
        content:
          "The focus management issues in the modal stack are mine. I'll fix those as part of the data layer refactor this sprint.",
        timestamp: "1h ago",
      },
    ],
  },
  {
    id: "d4",
    title: "Idea: AI-assisted component scaffolding tool",
    author: "Morgan",
    avatar: "🟤",
    replyCount: 4,
    lastActivity: "5h ago",
    tags: ["idea"],
    preview:
      "What if we built a CLI tool that uses our design system tokens and component patterns to scaffold new components? It could generate the boilerplate, tests, and stories...",
    replies: [
      {
        id: "r4a",
        author: "Alex",
        avatar: "🟡",
        content:
          "Love this. If it auto-generates test stubs with proper a11y assertions, that alone saves hours per component.",
        timestamp: "5h ago",
      },
    ],
  },
  {
    id: "d5",
    title: "WebSocket reconnection strategy",
    author: "Sam",
    avatar: "🔴",
    replyCount: 3,
    lastActivity: "3h ago",
    tags: ["question", "bug"],
    preview:
      "We're seeing connection drops under load. Need to decide between exponential backoff with jitter vs. a sliding window approach...",
    replies: [
      {
        id: "r5a",
        author: "Wes",
        avatar: "🟠",
        content:
          "Exponential backoff with jitter is the standard. But we should also implement a heartbeat ping to detect stale connections early.",
        timestamp: "3h ago",
      },
    ],
  },
  {
    id: "d6",
    title: "RFC: Unified error boundary pattern",
    author: "Reed",
    avatar: "🟢",
    replyCount: 7,
    lastActivity: "45m ago",
    tags: ["idea", "announcement"],
    preview:
      "Proposing a consistent error boundary pattern across all views. Currently we have 4 different approaches which leads to inconsistent error UX...",
    replies: [
      {
        id: "r6a",
        author: "Piper",
        avatar: "🟣",
        content:
          "Strong +1. The inconsistency is confusing for users. Let's also add a retry mechanism built into the boundary component.",
        timestamp: "1h ago",
      },
      {
        id: "r6b",
        author: "Quinn",
        avatar: "🔵",
        content:
          "From a UX perspective, we need different error states: network errors, permission errors, and unexpected errors should all look distinct.",
        timestamp: "45m ago",
      },
    ],
  },
];

const NOTE_SECTIONS: NoteSection[] = [
  {
    id: "n1",
    title: "Architecture Decision Records",
    content: `# ADR-001: Component Library Strategy

## Status: Accepted

## Context
We need a consistent approach to building and maintaining UI components across the application. The current state has organic growth with inconsistent patterns.

## Decision
Adopt a layered component architecture:

\`\`\`
primitives/     ← Radix-based unstyled primitives
components/     ← Styled, composable components
views/          ← Page-level compositions
layouts/        ← Shell and navigation wrappers
\`\`\`

## Consequences
- All new components follow this layering
- Existing components migrated over 2 sprints
- Design tokens are the single source of truth for styling

# ADR-002: State Management

## Status: Accepted

## Decision
Use Zustand for client state, React Query for server state. No Redux.

\`\`\`typescript
// Client state example
const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: "dark",
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
\`\`\``,
    lastEditedBy: "Reed",
    lastEditedAt: "2h ago",
  },
  {
    id: "n2",
    title: "Sprint Playbook & Conventions",
    content: `# Sprint Conventions

## Branch Naming
- Features: \`feat/<agent>/<short-description>\`
- Fixes: \`fix/<agent>/<issue-id>\`
- Experiments: \`poc/<agent>/<name>\`

## PR Checklist
1. TypeScript strict — no \`any\`
2. Tests for new logic (vitest)
3. Accessibility: keyboard nav + screen reader
4. Responsive: mobile-first, test at 375px
5. Run \`pnpm check\` before opening PR

## Code Review SLA
- Worker PRs reviewed within **4 hours**
- Megabranch PRs reviewed within **24 hours**
- Blocking issues flagged immediately in Slack

## Component File Structure
\`\`\`
ComponentName/
  index.tsx          ← public export
  ComponentName.tsx  ← implementation
  types.ts           ← prop types
  hooks.ts           ← component-specific hooks
  utils.ts           ← helpers
  __tests__/         ← test files
\`\`\``,
    lastEditedBy: "Piper",
    lastEditedAt: "6h ago",
  },
  {
    id: "n3",
    title: "Design System Token Reference",
    content: `# Design Tokens v2.0

## Colors
\`\`\`
--color-bg-page:       zinc-950
--color-bg-card:       zinc-900
--color-bg-elevated:   zinc-800
--color-border:        zinc-800
--color-text-primary:  white
--color-text-secondary: zinc-400
--color-accent:        indigo-500
--color-success:       emerald-400
--color-error:         rose-400
--color-warning:       amber-400
\`\`\`

## Spacing Scale
\`\`\`
xs:  4px   (0.25rem)
sm:  8px   (0.5rem)
md:  16px  (1rem)
lg:  24px  (1.5rem)
xl:  32px  (2rem)
2xl: 48px  (3rem)
\`\`\`

## Typography
\`\`\`
heading-xl:  text-2xl  font-bold    tracking-tight
heading-lg:  text-xl   font-semibold
heading-md:  text-lg   font-semibold
body:        text-sm   font-normal
caption:     text-xs   font-normal  text-[var(--color-text-secondary)]
code:        text-sm   font-mono    bg-[var(--color-surface-2)]/50
\`\`\`

## Border Radius
\`\`\`
sm:   4px
md:   8px
lg:   12px
full: 9999px
\`\`\``,
    lastEditedBy: "Morgan",
    lastEditedAt: "1h ago",
  },
];

const ACTIVITY_ITEMS: ActivityItem[] = [
  { id: "a1", actor: "Piper", avatar: "🟣", kind: "commit", description: "Migrated color tokens to CSS custom properties", target: "feat/piper/token-migration", timestamp: "12m ago" },
  { id: "a2", actor: "Reed", avatar: "🟢", kind: "pr_review", description: "Approved PR #247 — Zustand store refactor", target: "PR #247", timestamp: "25m ago" },
  { id: "a3", actor: "Sam", avatar: "🔴", kind: "commit", description: "Added WebSocket heartbeat ping mechanism", target: "feat/sam/ws-events", timestamp: "38m ago" },
  { id: "a4", actor: "Quinn", avatar: "🔵", kind: "comment", description: "Posted accessibility audit results", target: "Discussion: A11y Audit", timestamp: "1h ago" },
  { id: "a5", actor: "Luis", avatar: "🎨", kind: "merge", description: "Merged design system v1.9 into megabranch", target: "feat/design-system-v2", timestamp: "1h ago" },
  { id: "a6", actor: "Wes", avatar: "🟠", kind: "deploy", description: "Deployed bundle analyzer to staging", target: "staging/perf-tools", timestamp: "2h ago" },
  { id: "a7", actor: "Morgan", avatar: "🟤", kind: "commit", description: "Prototype: spring-based page transitions", target: "poc/morgan/transitions", timestamp: "2h ago" },
  { id: "a8", actor: "Alex", avatar: "🟡", kind: "config", description: "Updated Playwright config for parallel runs", target: "playwright.config.ts", timestamp: "3h ago" },
  { id: "a9", actor: "Piper", avatar: "🟣", kind: "pr_review", description: "Requested changes on PR #251 — Button variants", target: "PR #251", timestamp: "3h ago" },
  { id: "a10", actor: "Reed", avatar: "🟢", kind: "commit", description: "Implemented error boundary composition pattern", target: "feat/reed/error-boundaries", timestamp: "4h ago" },
  { id: "a11", actor: "Sam", avatar: "🔴", kind: "config", description: "Updated API base URL to use 127.0.0.1", target: ".env.development", timestamp: "4h ago" },
  { id: "a12", actor: "Quinn", avatar: "🔵", kind: "branch", description: "Created branch for onboarding flow v2", target: "feat/quinn/onboarding-v2", timestamp: "5h ago" },
  { id: "a13", actor: "Luis", avatar: "🎨", kind: "pr_review", description: "Approved and merged PR #249 — Modal focus trap", target: "PR #249", timestamp: "5h ago" },
  { id: "a14", actor: "Wes", avatar: "🟠", kind: "commit", description: "Lazy-loaded settings and analytics views", target: "feat/wes/code-splitting", timestamp: "6h ago" },
  { id: "a15", actor: "Morgan", avatar: "🟤", kind: "deploy", description: "Deployed animation storybook to preview", target: "preview/animations", timestamp: "6h ago" },
  { id: "a16", actor: "Alex", avatar: "🟡", kind: "commit", description: "Added visual regression snapshot tests", target: "feat/alex/visual-tests", timestamp: "7h ago" },
  { id: "a17", actor: "Piper", avatar: "🟣", kind: "merge", description: "Merged spacing token updates", target: "feat/design-system-v2", timestamp: "8h ago" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVAILABILITY_CONFIG: Record<Availability, { label: string; dot: string; textClass: string }> = {
  available: { label: "Available", dot: "bg-emerald-400", textClass: "text-emerald-400" },
  busy: { label: "Busy", dot: "bg-rose-400", textClass: "text-rose-400" },
  away: { label: "Away", dot: "bg-amber-400", textClass: "text-amber-400" },
  offline: { label: "Offline", dot: "bg-[var(--color-surface-3)]", textClass: "text-[var(--color-text-muted)]" },
};

const TAG_STYLES: Record<DiscussionTag, string> = {
  question: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  announcement: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  idea: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  bug: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

const ACTIVITY_ICONS: Record<ActivityKind, string> = {
  commit: "📝",
  pr_review: "🔍",
  deploy: "🚀",
  config: "⚙️",
  comment: "💬",
  merge: "🔀",
  branch: "🌿",
};

function renderNoteContent(raw: string): React.ReactNode {
  const lines = raw.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${codeKey++}`}
            className="bg-[var(--color-surface-2)]/60 border border-[var(--color-border)]/50 rounded-lg p-3 text-sm font-mono text-[var(--color-text-primary)] overflow-x-auto my-2"
          >
            {codeLines.join("\n")}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-[var(--color-text-primary)] mt-4 mb-2">
          {line.slice(2)}
        </h2>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-base font-semibold text-[var(--color-text-primary)] mt-3 mb-1">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex gap-2 text-sm text-[var(--color-text-primary)] ml-2 my-0.5">
          <span className="text-[var(--color-text-muted)]">•</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-2 text-sm text-[var(--color-text-primary)] ml-2 my-0.5">
            <span className="text-[var(--color-text-muted)] min-w-[1.2rem]">{match[1]}.</span>
            <span>{match[2]}</span>
          </div>
        );
      }
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      // inline code
      const parts = line.split(/(`[^`]+`)/g);
      const rendered = parts.map((part, pi) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={pi}
              className="bg-[var(--color-surface-2)]/60 text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={pi}>{part}</span>;
      });
      elements.push(
        <p key={i} className="text-sm text-[var(--color-text-primary)] my-0.5">
          {rendered}
        </p>
      );
    }
  }

  // flush any trailing code block
  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <pre
        key={`code-${codeKey}`}
        className="bg-[var(--color-surface-2)]/60 border border-[var(--color-border)]/50 rounded-lg p-3 text-sm font-mono text-[var(--color-text-primary)] overflow-x-auto my-2"
      >
        {codeLines.join("\n")}
      </pre>
    );
  }

  return elements;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TeamCollaboration() {
  const [activeTab, setActiveTab] = useState<TabId>("workspace");
  const [expandedDiscussion, setExpandedDiscussion] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteContents, setNoteContents] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const section of NOTE_SECTIONS) {
      map[section.id] = section.content;
    }
    return map;
  });

  // ── Team capacity summary ──
  const onlineMembers = TEAM_MEMBERS.filter((m) => m.availability !== "offline");
  const avgCapacity =
    onlineMembers.length > 0
      ? Math.round(onlineMembers.reduce((sum, m) => sum + m.capacityPercent, 0) / onlineMembers.length)
      : 0;

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                <span>👥</span>
                <span>Team Collaboration Hub</span>
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Product &amp; UI Squad — {onlineMembers.length}/{TEAM_MEMBERS.length} online
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Team Capacity</p>
                <p className="text-lg font-semibold">
                  <span
                    className={cn(
                      avgCapacity > 75
                        ? "text-rose-400"
                        : avgCapacity > 50
                          ? "text-amber-400"
                          : "text-emerald-400"
                    )}
                  >
                    {avgCapacity}%
                  </span>
                </p>
              </div>
              <div className="w-24 h-3 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    avgCapacity > 75
                      ? "bg-rose-400"
                      : avgCapacity > 50
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  )}
                  style={{ width: `${avgCapacity}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]/50"
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ══ Workspace Tab ══ */}
        {activeTab === "workspace" && (
          <div className="space-y-6">
            {/* Capacity Overview */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <span>📊</span> Team Capacity Overview
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {(
                  [
                    { label: "Available", count: TEAM_MEMBERS.filter((m) => m.availability === "available").length, cls: "text-emerald-400" },
                    { label: "Busy", count: TEAM_MEMBERS.filter((m) => m.availability === "busy").length, cls: "text-rose-400" },
                    { label: "Away", count: TEAM_MEMBERS.filter((m) => m.availability === "away").length, cls: "text-amber-400" },
                    { label: "Offline", count: TEAM_MEMBERS.filter((m) => m.availability === "offline").length, cls: "text-[var(--color-text-muted)]" },
                  ] as const
                ).map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className={cn("text-2xl font-bold", stat.cls)}>{stat.count}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{stat.label}</p>
                  </div>
                ))}
              </div>
              {/* Per-member capacity bars */}
              <div className="space-y-2">
                {TEAM_MEMBERS.filter((m) => m.availability !== "offline").map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <span className="text-sm w-20 truncate text-[var(--color-text-primary)]">{member.name}</span>
                    <div className="flex-1 h-2.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          member.capacityPercent > 75
                            ? "bg-rose-400"
                            : member.capacityPercent > 50
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                        )}
                        style={{ width: `${member.capacityPercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)] w-10 text-right">
                      {member.capacityPercent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Members Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEAM_MEMBERS.map((member) => {
                const avail = AVAILABILITY_CONFIG[member.availability];
                return (
                  <div
                    key={member.id}
                    className={cn(
                      "bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 transition-colors",
                      member.availability === "offline" && "opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <span className="text-2xl">{member.avatar}</span>
                        <div
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-border)]",
                            avail.dot
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{member.name}</h3>
                          <span className={cn("text-xs", avail.textClass)}>
                            {avail.label}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">{member.role}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs text-[var(--color-text-muted)] mb-1">Current Task</p>
                      <p className="text-sm text-[var(--color-text-primary)] truncate">{member.currentTask}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {member.skills.map((skill) => (
                        <span
                          key={skill}
                          className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)]/50"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    {member.availability !== "offline" && (
                      <div className="mt-3 pt-3 border-t border-[var(--color-border)]/50">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--color-text-muted)]">Workload</span>
                          <span
                            className={cn(
                              member.capacityPercent > 75
                                ? "text-rose-400"
                                : member.capacityPercent > 50
                                  ? "text-amber-400"
                                  : "text-emerald-400"
                            )}
                          >
                            {member.capacityPercent}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              member.capacityPercent > 75
                                ? "bg-rose-400"
                                : member.capacityPercent > 50
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
                            )}
                            style={{ width: `${member.capacityPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ Discussions Tab ══ */}
        {activeTab === "discussions" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <span>💬</span> Team Discussions
              </h2>
              <span className="text-xs text-[var(--color-text-muted)]">{DISCUSSIONS.length} threads</span>
            </div>

            {DISCUSSIONS.map((discussion) => {
              const isExpanded = expandedDiscussion === discussion.id;
              return (
                <div
                  key={discussion.id}
                  className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedDiscussion(isExpanded ? null : discussion.id)
                    }
                    className="w-full text-left p-4 hover:bg-[var(--color-surface-2)]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {discussion.title}
                          </h3>
                          {discussion.tags.map((tag) => (
                            <span
                              key={tag}
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full border",
                                TAG_STYLES[tag]
                              )}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-1">
                          {discussion.preview}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                            <span>{discussion.avatar}</span>
                            <span>{discussion.author}</span>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            {discussion.lastActivity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-1 rounded-lg">
                          <span>💬</span>
                          <span>{discussion.replyCount}</span>
                        </div>
                        <span className="text-[var(--color-text-muted)] text-sm">
                          {isExpanded ? "▼" : "▶"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[var(--color-border)]">
                      {/* Original post */}
                      <div className="p-4 bg-[var(--color-surface-1)]/50">
                        <div className="flex items-center gap-2 mb-2">
                          <span>{discussion.avatar}</span>
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            {discussion.author}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)]">•</span>
                          <span className="text-xs text-[var(--color-text-muted)]">Original post</span>
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                          {discussion.preview}
                        </p>
                      </div>

                      {/* Replies */}
                      {discussion.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="p-4 border-t border-[var(--color-border)]/50 ml-6"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm">{reply.avatar}</span>
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">
                              {reply.author}
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)]">•</span>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {reply.timestamp}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                            {reply.content}
                          </p>
                        </div>
                      ))}

                      {discussion.replyCount > discussion.replies.length && (
                        <div className="px-4 py-3 border-t border-[var(--color-border)]/50 text-center">
                          <span className="text-xs text-indigo-400">
                            + {discussion.replyCount - discussion.replies.length} more{" "}
                            {discussion.replyCount - discussion.replies.length === 1
                              ? "reply"
                              : "replies"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ Shared Notes Tab ══ */}
        {activeTab === "notes" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <span>📋</span> Shared Notes
              </h2>
              <span className="text-xs text-[var(--color-text-muted)]">
                {NOTE_SECTIONS.length} sections
              </span>
            </div>

            {NOTE_SECTIONS.map((section) => {
              const isEditing = editingNote === section.id;
              const content = noteContents[section.id] ?? section.content;
              return (
                <div
                  key={section.id}
                  className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                        <span>📄</span>
                        {section.title}
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Last edited by{" "}
                        <span className="text-[var(--color-text-secondary)]">{section.lastEditedBy}</span>{" "}
                        • {section.lastEditedAt}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setEditingNote(isEditing ? null : section.id)
                      }
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                        isEditing
                          ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                          : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
                      )}
                    >
                      {isEditing ? "✅ Done" : "✏️ Edit"}
                    </button>
                  </div>

                  <div className="p-4">
                    {isEditing ? (
                      <textarea
                        value={content}
                        onChange={(e) =>
                          setNoteContents((prev) => ({
                            ...prev,
                            [section.id]: e.target.value,
                          }))
                        }
                        className="w-full h-80 bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]/50 rounded-lg p-3 text-sm font-mono text-[var(--color-text-primary)] resize-y focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                      />
                    ) : (
                      <div className="prose-invert max-w-none">
                        {renderNoteContent(content)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ Activity Tab ══ */}
        {activeTab === "activity" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <span>⚡</span> Activity Feed
              </h2>
              <span className="text-xs text-[var(--color-text-muted)]">
                {ACTIVITY_ITEMS.length} events
              </span>
            </div>

            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden divide-y divide-[var(--color-border)]/50">
              {ACTIVITY_ITEMS.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3.5 hover:bg-[var(--color-surface-2)]/20 transition-colors"
                >
                  <span className="text-lg shrink-0 mt-0.5">
                    {ACTIVITY_ICONS[item.kind]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text-primary)]">
                      <span className="font-medium text-[var(--color-text-primary)]">{item.actor}</span>{" "}
                      <span className="text-[var(--color-text-secondary)]">{item.description}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-indigo-400/80 bg-indigo-500/10 px-2 py-0.5 rounded font-mono truncate max-w-xs">
                        {item.target}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">{item.timestamp}</span>
                    </div>
                  </div>
                  <span className="text-sm shrink-0">{item.avatar}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
