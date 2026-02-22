# Approvals + Milestone Feed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reusable approvals queue + milestone feed that surfaces in a sidebar slide-out panel (urgent items only) and a dedicated `/approvals` page (full triage + history).

**Architecture:** Five shared components (`ApprovalsQueue`, `ApprovalItem`, `MilestoneFeed`, `MilestoneItem`, `MilestoneDetailPanel`) used in two surfaces: a `Sheet`-based `InboxPanel` triggered from the sidebar, and a new `/approvals` page. The page uses `full` mode (grouping, bulk actions, filters); the panel uses `compact` mode (top 8 urgent + top 8 milestones).

**Tech Stack:** React, TanStack Router (file-based, dual-file pattern), TanStack Query, shadcn `Sheet`, existing `ToolApprovalCard`, `useAgentApprovalActions`, `useGoals`, Zustand agent store, Tailwind CSS.

---

## Reference Files

Before starting, read these:

- `apps/web/src/components/domain/agentic-workflow/ToolApprovalCard.tsx` — reuse this inside ApprovalItem
- `apps/web/src/lib/approvals/pending.ts` — `derivePendingApprovalsSummary`, `PendingApprovalsSummary`
- `apps/web/src/hooks/useAgentApprovalActions.ts` — `{ approvePending, denyPending }`
- `apps/web/src/hooks/queries/useGoals.ts` — `useGoals()` returns `UseQueryResult<Goal[]>`
- `apps/web/src/components/ui/sheet.tsx` — `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`
- `apps/web/src/components/layout/Sidebar.tsx` — add inbox icon in bottom actions section (~line 413)
- `apps/web/src/routes/agents/graph.tsx` + `graph.lazy.tsx` — copy this dual-file route pattern
- `apps/web/src/stores/` — find the agent store to understand `Agent` shape with `pendingToolCallIds`

---

## Task 1: ApprovalItem component

**Files:**

- Create: `apps/web/src/components/domain/approvals/ApprovalItem.tsx`
- Create: `apps/web/src/components/domain/approvals/index.ts`

**What it does:** Renders a single pending approval inline. In `compact` mode: risk badge + tool name + agent name + age + Approve/Reject buttons. In `full` mode: wraps the existing `ToolApprovalCard` with a collapsible expand-to-edit behavior. This is NOT a new card design — it reuses `ToolApprovalCard` for the expanded state.

**Step 1: Create the component**

```tsx
// apps/web/src/components/domain/approvals/ApprovalItem.tsx
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToolApprovalCard } from "@/components/domain/agentic-workflow/ToolApprovalCard";
import type { ToolCall, RiskLevel } from "@/components/domain/agentic-workflow/types";

export interface ApprovalItemProps {
  toolCall: ToolCall;
  agentName: string;
  agentId: string;
  createdAtMs: number;
  mode: "compact" | "full";
  onApprove: (toolCallId: string, modifiedArgs?: Record<string, unknown>) => void;
  onReject: (toolCallId: string) => void;
}

const riskColors: Record<RiskLevel, string> = {
  low: "bg-green-500/10 text-green-600 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  high: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function ApprovalItem({
  toolCall,
  agentName,
  agentId,
  createdAtMs,
  mode,
  onApprove,
  onReject,
}: ApprovalItemProps) {
  const [expanded, setExpanded] = useState(false);
  const risk = toolCall.risk ?? "low";
  const age = formatDistanceToNow(new Date(createdAtMs), { addSuffix: true });

  if (mode === "full" && expanded) {
    return (
      <div className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="size-3 rotate-180" /> Collapse
        </button>
        <ToolApprovalCard
          toolCall={toolCall}
          onApprove={onApprove}
          onReject={onReject}
          className="border-0 shadow-none"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border px-3 py-2",
        "hover:bg-accent/30 transition-colors",
      )}
    >
      <Badge variant="outline" className={cn("shrink-0 text-xs", riskColors[risk])}>
        {risk}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{toolCall.toolName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {agentName} · {age}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {mode === "full" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setExpanded(true)}
          >
            <ChevronDown className="size-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={() => onReject(toolCall.toolCallId)}
        >
          Reject
        </Button>
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onApprove(toolCall.toolCallId)}
        >
          Approve
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Create barrel export**

```ts
// apps/web/src/components/domain/approvals/index.ts
export { ApprovalItem } from "./ApprovalItem";
export type { ApprovalItemProps } from "./ApprovalItem";
```

**Step 3: Commit**

```bash
git add apps/web/src/components/domain/approvals/
git commit -m "feat(approvals): add ApprovalItem component"
```

---

## Task 2: ApprovalsQueue component

**Files:**

- Create: `apps/web/src/components/domain/approvals/ApprovalsQueue.tsx`
- Modify: `apps/web/src/components/domain/approvals/index.ts`

**What it does:**

- `compact` mode: flat list of high/medium-risk items only, max 8, sorted oldest-first
- `full` mode: all pending items grouped by agent (3+ → group card with bulk Approve All/Reject All), filter chips (All/High/Medium/Low/Resolved), resolved items collapsed under disclosure

**Data:** Reads from the Zustand agent store. Look at how `derivePendingApprovalsSummary` works and how the agent store is structured (`pendingToolCallIds` on each `Agent`). You'll need to get individual `ToolCall` objects — check how `ToolApprovalCard` is currently used in the codebase (look for its usages) to understand how tool calls are accessed per agent.

**Step 1: Understand agent + tool call data access**

Before writing, search for `ToolApprovalCard` usages:

```bash
grep -r "ToolApprovalCard" apps/web/src --include="*.tsx" -l
```

Read those files to understand how `ToolCall` objects are fetched per agent. This is the critical data path.

**Step 2: Create ApprovalsQueue**

```tsx
// apps/web/src/components/domain/approvals/ApprovalsQueue.tsx
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApprovalItem } from "./ApprovalItem";
import type { RiskLevel } from "@/components/domain/agentic-workflow/types";
import type { ToolCall } from "@/components/domain/agentic-workflow/types";

// Adapt these types to match what the agent store actually provides
export interface PendingApproval {
  toolCall: ToolCall;
  agentId: string;
  agentName: string;
  createdAtMs: number;
}

export interface ApprovalsQueueProps {
  approvals: PendingApproval[];
  resolvedCount?: number;
  mode: "compact" | "full";
  onApprove: (toolCallId: string, modifiedArgs?: Record<string, unknown>) => void;
  onReject: (toolCallId: string) => void;
  onApproveAllForAgent?: (agentId: string) => void;
  onRejectAllForAgent?: (agentId: string) => void;
}

type FilterChip = "all" | RiskLevel | "resolved";

const COMPACT_MAX = 8;
const GROUP_THRESHOLD = 3;

export function ApprovalsQueue({
  approvals,
  resolvedCount = 0,
  mode,
  onApprove,
  onReject,
  onApproveAllForAgent,
  onRejectAllForAgent,
}: ApprovalsQueueProps) {
  const [filter, setFilter] = useState<FilterChip>("all");
  const [resolvedExpanded, setResolvedExpanded] = useState(false);

  // compact: only high/medium, oldest first, max 8
  const visibleApprovals =
    mode === "compact"
      ? approvals
          .filter((a) => a.toolCall.risk === "high" || a.toolCall.risk === "medium")
          .sort((a, b) => a.createdAtMs - b.createdAtMs)
          .slice(0, COMPACT_MAX)
      : filter === "all"
        ? approvals
        : approvals.filter((a) => a.toolCall.risk === filter);

  // Group by agent when 3+ items from same agent (full mode only)
  const grouped = mode === "full" ? buildGroups(visibleApprovals, GROUP_THRESHOLD) : null;

  if (visibleApprovals.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No pending approvals</p>;
  }

  return (
    <div className="space-y-2">
      {mode === "full" && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {(["all", "high", "medium", "low"] as const).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setFilter(chip)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                filter === chip
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {chip === "all" ? "All" : chip.charAt(0).toUpperCase() + chip.slice(1)}
            </button>
          ))}
        </div>
      )}

      {grouped
        ? grouped.map((group) =>
            group.isGroup ? (
              <AgentGroupCard
                key={group.agentId}
                group={group}
                onApproveAll={() => onApproveAllForAgent?.(group.agentId)}
                onRejectAll={() => onRejectAllForAgent?.(group.agentId)}
                onApprove={onApprove}
                onReject={onReject}
              />
            ) : (
              <ApprovalItem
                key={group.items[0].toolCall.toolCallId}
                {...group.items[0]}
                mode="full"
                onApprove={onApprove}
                onReject={onReject}
              />
            ),
          )
        : visibleApprovals.map((a) => (
            <ApprovalItem
              key={a.toolCall.toolCallId}
              {...a}
              mode={mode}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}

      {mode === "full" && resolvedCount > 0 && (
        <button
          type="button"
          onClick={() => setResolvedExpanded((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={`size-3 transition-transform ${resolvedExpanded ? "rotate-180" : ""}`}
          />
          {resolvedExpanded ? "Hide" : `Show ${resolvedCount} resolved today`}
        </button>
      )}
    </div>
  );
}

// --- helpers ---

interface GroupEntry {
  agentId: string;
  agentName: string;
  items: PendingApproval[];
  isGroup: boolean;
}

function buildGroups(approvals: PendingApproval[], threshold: number): GroupEntry[] {
  const byAgent = new Map<string, PendingApproval[]>();
  for (const a of approvals) {
    const list = byAgent.get(a.agentId) ?? [];
    list.push(a);
    byAgent.set(a.agentId, list);
  }
  const result: GroupEntry[] = [];
  for (const [agentId, items] of byAgent) {
    result.push({
      agentId,
      agentName: items[0].agentName,
      items,
      isGroup: items.length >= threshold,
    });
  }
  return result;
}

function AgentGroupCard({
  group,
  onApproveAll,
  onRejectAll,
  onApprove,
  onReject,
}: {
  group: GroupEntry;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onApprove: ApprovalsQueueProps["onApprove"];
  onReject: ApprovalsQueueProps["onReject"];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          <span className="text-sm font-medium">{group.agentName}</span>
          <Badge variant="secondary" className="text-xs">
            {group.items.length} pending
          </Badge>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={onRejectAll}
        >
          Reject All
        </Button>
        <Button size="sm" className="h-7 px-2 text-xs" onClick={onApproveAll}>
          Approve All
        </Button>
      </div>
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
          {group.items.map((a) => (
            <ApprovalItem
              key={a.toolCall.toolCallId}
              {...a}
              mode="full"
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Export from barrel**

Add to `apps/web/src/components/domain/approvals/index.ts`:

```ts
export { ApprovalsQueue } from "./ApprovalsQueue";
export type { ApprovalsQueueProps, PendingApproval } from "./ApprovalsQueue";
```

**Step 4: Commit**

```bash
git add apps/web/src/components/domain/approvals/
git commit -m "feat(approvals): add ApprovalsQueue with compact/full modes and agent grouping"
```

---

## Task 3: MilestoneItem + MilestoneDetailPanel

**Files:**

- Create: `apps/web/src/components/domain/approvals/MilestoneItem.tsx`
- Create: `apps/web/src/components/domain/approvals/MilestoneDetailPanel.tsx`
- Modify: `apps/web/src/components/domain/approvals/index.ts`

**What MilestoneItem does:** One-liner row — checkmark icon, "[Milestone title] — [Goal title]", agent name, timestamp. Clickable to open `MilestoneDetailPanel`.

**What MilestoneDetailPanel does:** Right-anchored `Sheet`. Intermediate milestone: goal title + status + progress bar + milestone list + agent/timestamp. Final milestone (all completed): "Goal Complete" banner + full checklist + Archive/View CTAs.

**Note on timestamps:** The current `Milestone` type only has `completed: boolean`, no `completedAt`. Use the parent goal's `updatedAt` as the timestamp for now. Add a comment noting this should be replaced when the backend provides per-milestone completion timestamps.

**Step 1: Create MilestoneItem**

```tsx
// apps/web/src/components/domain/approvals/MilestoneItem.tsx
import { CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Goal, Milestone } from "@/hooks/queries/useGoals";

export interface MilestoneItemProps {
  milestone: Milestone;
  goal: Goal;
  completedAt: string; // goal.updatedAt for now
  onSelect: (milestone: Milestone, goal: Goal) => void;
}

export function MilestoneItem({ milestone, goal, completedAt, onSelect }: MilestoneItemProps) {
  const age = formatDistanceToNow(new Date(completedAt), { addSuffix: true });

  return (
    <button
      type="button"
      onClick={() => onSelect(milestone, goal)}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent/30 transition-colors"
    >
      <CheckCircle2 className="size-4 shrink-0 text-green-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-medium">{milestone.title}</span>
          <span className="text-muted-foreground"> — {goal.title}</span>
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{age}</span>
    </button>
  );
}
```

**Step 2: Create MilestoneDetailPanel**

```tsx
// apps/web/src/components/domain/approvals/MilestoneDetailPanel.tsx
import { Trophy, CheckCircle2, Circle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "@tanstack/react-router";
import type { Goal, Milestone } from "@/hooks/queries/useGoals";

export interface MilestoneDetailPanelProps {
  goal: Goal | null;
  milestone: Milestone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MilestoneDetailPanel({
  goal,
  milestone,
  open,
  onOpenChange,
}: MilestoneDetailPanelProps) {
  const navigate = useNavigate();
  if (!goal || !milestone) return null;

  const completedCount = goal.milestones.filter((m) => m.completed).length;
  const totalCount = goal.milestones.length;
  const isGoalComplete = completedCount === totalCount;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            {isGoalComplete && <Trophy className="size-5 text-yellow-500" />}
            {goal.title}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {isGoalComplete && (
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3">
              <Trophy className="size-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                  Goal Complete
                </p>
                <p className="text-xs text-muted-foreground">All milestones have been achieved</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {completedCount} of {totalCount}
              </span>
            </div>
            <Progress value={(completedCount / totalCount) * 100} className="h-2" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Milestones
            </p>
            {goal.milestones.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  m.id === milestone.id ? "bg-accent" : ""
                }`}
              >
                {m.completed ? (
                  <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className={`text-sm ${m.completed ? "" : "text-muted-foreground"}`}>
                  {m.title}
                </span>
                {m.id === milestone.id && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    Just completed
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {isGoalComplete && (
          <div className="border-t border-border px-6 py-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                navigate({ to: "/goals" });
              }}
            >
              View Goal
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Archive
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

**Step 3: Export from barrel**

```ts
// add to index.ts
export { MilestoneItem } from "./MilestoneItem";
export type { MilestoneItemProps } from "./MilestoneItem";
export { MilestoneDetailPanel } from "./MilestoneDetailPanel";
export type { MilestoneDetailPanelProps } from "./MilestoneDetailPanel";
```

**Step 4: Commit**

```bash
git add apps/web/src/components/domain/approvals/
git commit -m "feat(approvals): add MilestoneItem and MilestoneDetailPanel"
```

---

## Task 4: MilestoneFeed component

**Files:**

- Create: `apps/web/src/components/domain/approvals/MilestoneFeed.tsx`
- Modify: `apps/web/src/components/domain/approvals/index.ts`

**What it does:** Derives completed milestones from `useGoals()`, groups by date (Today/Yesterday/This Week) in `full` mode. In `compact` mode: flat list of last 8, no date grouping. Manages `MilestoneDetailPanel` open state internally.

**Step 1: Create MilestoneFeed**

```tsx
// apps/web/src/components/domain/approvals/MilestoneFeed.tsx
import { useState } from "react";
import { useGoals } from "@/hooks/queries/useGoals";
import { MilestoneItem } from "./MilestoneItem";
import { MilestoneDetailPanel } from "./MilestoneDetailPanel";
import type { Goal, Milestone } from "@/hooks/queries/useGoals";
import { isToday, isYesterday, isThisWeek } from "date-fns";

export interface MilestoneFeedProps {
  mode: "compact" | "full";
}

interface FlatMilestone {
  milestone: Milestone;
  goal: Goal;
  completedAt: string;
}

export function MilestoneFeed({ mode }: MilestoneFeedProps) {
  const { data: goals } = useGoals();
  const [selected, setSelected] = useState<{ milestone: Milestone; goal: Goal } | null>(null);

  // Derive completed milestones from all goals
  // NOTE: Using goal.updatedAt as proxy for completedAt until backend provides per-milestone timestamps
  const flat: FlatMilestone[] = (goals ?? []).flatMap((goal) =>
    goal.milestones
      .filter((m) => m.completed)
      .map((m) => ({ milestone: m, goal, completedAt: goal.updatedAt })),
  );

  // Sort newest first
  flat.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  const items = mode === "compact" ? flat.slice(0, 8) : flat;

  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">No milestone completions yet</p>
    );
  }

  return (
    <>
      {mode === "compact" ? (
        <div className="space-y-0.5">
          {items.map((item) => (
            <MilestoneItem
              key={`${item.goal.id}-${item.milestone.id}`}
              {...item}
              onSelect={(m, g) => setSelected({ milestone: m, goal: g })}
            />
          ))}
        </div>
      ) : (
        <DateGroupedFeed
          items={items}
          onSelect={(m, g) => setSelected({ milestone: m, goal: g })}
        />
      )}
      <MilestoneDetailPanel
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        goal={selected?.goal ?? null}
        milestone={selected?.milestone ?? null}
      />
    </>
  );
}

function DateGroupedFeed({
  items,
  onSelect,
}: {
  items: FlatMilestone[];
  onSelect: (m: Milestone, g: Goal) => void;
}) {
  const groups: { label: string; items: FlatMilestone[] }[] = [];
  const buckets = [
    { label: "Today", fn: isToday },
    { label: "Yesterday", fn: isYesterday },
    { label: "This Week", fn: (d: Date) => isThisWeek(d) && !isToday(d) && !isYesterday(d) },
    { label: "Older", fn: () => true },
  ];

  const remaining = [...items];
  for (const bucket of buckets) {
    const matched = remaining.filter((i) => bucket.fn(new Date(i.completedAt)));
    if (matched.length > 0) {
      groups.push({ label: bucket.label, items: matched });
      matched.forEach((m) => remaining.splice(remaining.indexOf(m), 1));
    }
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <MilestoneItem
                key={`${item.goal.id}-${item.milestone.id}`}
                {...item}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Check that `date-fns` is already a dependency**

```bash
cat apps/web/package.json | grep date-fns
```

If not present, add it: `pnpm add date-fns --filter web`

**Step 3: Export from barrel**

```ts
export { MilestoneFeed } from "./MilestoneFeed";
export type { MilestoneFeedProps } from "./MilestoneFeed";
```

**Step 4: Commit**

```bash
git add apps/web/src/components/domain/approvals/
git commit -m "feat(approvals): add MilestoneFeed with date grouping"
```

---

## Task 5: InboxPanel (slide-out)

**Files:**

- Create: `apps/web/src/components/composed/InboxPanel.tsx`

**What it does:** Right-anchored `Sheet` (~380px). "Needs Attention" section (ApprovalsQueue compact) + "Goal Activity" section (MilestoneFeed compact) + "View all" link to `/approvals`. Needs a connected data hook to assemble `PendingApproval[]` from the agent store.

**Step 1: Find how to get ToolCall objects from agent store**

Before writing, read the result of: `grep -r "pendingToolCallIds\|ToolCall" apps/web/src/stores --include="*.ts" -l` and read those files. The `PendingApproval[]` array passed to `ApprovalsQueue` requires `ToolCall` + `agentId` + `agentName` + `createdAtMs` per item.

**Step 2: Create a hook to assemble pending approvals**

```ts
// apps/web/src/hooks/usePendingApprovals.ts
// Read the agent store structure first, then implement.
// Should return PendingApproval[] derived from all agents' pendingToolCallIds.
// If ToolCall objects aren't directly on the agent store, check if there's a
// separate tool calls store or if they come via a query.
```

This hook's exact implementation depends on what you find in the stores. The shape to return:

```ts
import type { PendingApproval } from "@/components/domain/approvals";

export function usePendingApprovals(): PendingApproval[] { ... }
```

**Step 3: Create InboxPanel**

```tsx
// apps/web/src/components/composed/InboxPanel.tsx
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ApprovalsQueue } from "@/components/domain/approvals";
import { MilestoneFeed } from "@/components/domain/approvals";
import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import { useAgentApprovalActions } from "@/hooks/useAgentApprovalActions";
// import useAgentStore or however bulk approve/reject per agent is accessed

export interface InboxPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InboxPanel({ open, onOpenChange }: InboxPanelProps) {
  const approvals = usePendingApprovals();
  const { approvePending, denyPending } = useAgentApprovalActions();

  const handleApprove = (toolCallId: string) => {
    // find which agent owns this toolCallId and call approvePending(agentId)
    // OR wire individual approve — check useAgentApprovalActions for per-toolcall API
  };

  const handleReject = (toolCallId: string) => {
    // same
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle>Inbox</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Needs Attention */}
          <div className="px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Needs Attention
            </p>
            <ApprovalsQueue
              approvals={approvals}
              mode="compact"
              onApprove={handleApprove}
              onReject={handleReject}
            />
            {approvals.length > 0 && (
              <Link
                to="/approvals"
                onClick={() => onOpenChange(false)}
                className="mt-2 block text-center text-xs text-primary hover:underline"
              >
                View all approvals
              </Link>
            )}
          </div>

          <Separator />

          {/* Goal Activity */}
          <div className="px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Goal Activity
            </p>
            <MilestoneFeed mode="compact" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/src/components/composed/InboxPanel.tsx apps/web/src/hooks/usePendingApprovals.ts
git commit -m "feat(approvals): add InboxPanel slide-out with compact approvals + milestones"
```

---

## Task 6: Sidebar inbox icon + badge

**Files:**

- Modify: `apps/web/src/components/layout/Sidebar.tsx`

**What it does:** Add an inbox icon button with a live badge (pending approval count) in the sidebar bottom actions section. Clicking it opens `InboxPanel`. Add it between `KeyboardShortcutsButton` and the Settings `NavItem` (~line 413).

**Step 1: Add InboxPanel state + button to Sidebar**

```tsx
// In Sidebar.tsx, add to imports:
import { Inbox } from "lucide-react";
import { InboxPanel } from "@/components/composed/InboxPanel";
import { useAgentStore } from "@/stores/..."; // wherever agent store lives
import { derivePendingApprovalsSummary } from "@/lib/approvals/pending";

// Inside Sidebar component, add:
const [inboxOpen, setInboxOpen] = useState(false);
const agents = useAgentStore((s) => s.agents); // adjust selector to actual store shape
const { pendingApprovals } = derivePendingApprovalsSummary(agents);
```

For the button, follow the same pattern as `KeyboardShortcutsButton` (it's defined right in Sidebar.tsx around line 45). Add a similar inline component or just inline the JSX:

```tsx
{/* Inbox button — insert before Settings NavItem */}
<Tooltip delayDuration={200}>
  <TooltipTrigger asChild>
    <button
      type="button"
      onClick={() => setInboxOpen(true)}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        "text-muted-foreground hover:bg-accent/50 hover:text-foreground w-full",
        sidebarCollapsed && "w-10 h-9 mx-auto px-0 justify-center"
      )}
    >
      <span className="relative shrink-0">
        <Inbox className="size-5" />
        {pendingApprovals > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {pendingApprovals > 99 ? "99+" : pendingApprovals}
          </span>
        )}
      </span>
      {!sidebarCollapsed && <span>Inbox</span>}
      {!sidebarCollapsed && pendingApprovals > 0 && (
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {pendingApprovals > 99 ? "99+" : pendingApprovals}
        </span>
      )}
    </button>
  </TooltipTrigger>
  {sidebarCollapsed && (
    <TooltipContent side="right" align="center">Inbox</TooltipContent>
  )}
</Tooltip>

<InboxPanel open={inboxOpen} onOpenChange={setInboxOpen} />
```

**Step 2: Commit**

```bash
git add apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat(approvals): add inbox icon + badge to sidebar"
```

---

## Task 7: `/approvals` route + page

**Files:**

- Create: `apps/web/src/routes/approvals.tsx`
- Create: `apps/web/src/routes/approvals.lazy.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx` (add nav item)

**Step 1: Create route files (dual-file pattern)**

```tsx
// apps/web/src/routes/approvals.tsx
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/approvals")({});
```

```tsx
// apps/web/src/routes/approvals.lazy.tsx
import { createLazyFileRoute } from "@tanstack/react-router";
import { ApprovalsPage } from "@/components/pages/ApprovalsPage";
export const Route = createLazyFileRoute("/approvals")({ component: ApprovalsPage });
```

**Step 2: Create the page component**

```tsx
// apps/web/src/components/pages/ApprovalsPage.tsx
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ApprovalsQueue } from "@/components/domain/approvals";
import { MilestoneFeed } from "@/components/domain/approvals";
import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import { useAgentApprovalActions } from "@/hooks/useAgentApprovalActions";
import { derivePendingApprovalsSummary } from "@/lib/approvals/pending";
// import agent store

export function ApprovalsPage() {
  const approvals = usePendingApprovals();
  const { approvePending, denyPending } = useAgentApprovalActions();

  // Get low-risk approvals for the batch button
  const lowRiskAgentIds = [
    ...new Set(approvals.filter((a) => a.toolCall.risk === "low").map((a) => a.agentId)),
  ];

  const handleApproveAllLowRisk = async () => {
    for (const agentId of lowRiskAgentIds) {
      await approvePending(agentId);
    }
  };

  const handleApprove = (toolCallId: string) => {
    const approval = approvals.find((a) => a.toolCall.toolCallId === toolCallId);
    if (approval) approvePending(approval.agentId);
  };

  const handleReject = (toolCallId: string) => {
    const approval = approvals.find((a) => a.toolCall.toolCallId === toolCallId);
    if (approval) denyPending(approval.agentId);
  };

  const handleApproveAllForAgent = (agentId: string) => approvePending(agentId);
  const handleRejectAllForAgent = (agentId: string) => denyPending(agentId);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Inbox</h1>
          {approvals.length > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {approvals.length}
            </span>
          )}
        </div>
        {lowRiskAgentIds.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleApproveAllLowRisk}>
            Approve All Low-Risk
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        <ApprovalsQueue
          approvals={approvals}
          mode="full"
          onApprove={handleApprove}
          onReject={handleReject}
          onApproveAllForAgent={handleApproveAllForAgent}
          onRejectAllForAgent={handleRejectAllForAgent}
        />

        <Separator />

        <div>
          <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Goal Activity
          </p>
          <MilestoneFeed mode="full" />
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Add nav item to sidebar**

In `Sidebar.tsx`, after the Agent Graph `NavItem` in the Team section (or in bottom nav near inbox button), add:

```tsx
<NavItem
  href="/approvals"
  icon={Inbox}
  label="Inbox"
  collapsed={sidebarCollapsed}
  badge={pendingApprovals}
/>
```

Note: `Inbox` is already imported from step 6. The `pendingApprovals` count is already derived.

**Step 4: Verify route tree regenerates**

After creating the route files, confirm the dev server picked them up:

```bash
grep "approvals" apps/web/src/routeTree.gen.ts
```

Expected: see `ApprovalsRoute` entries. If not, restart the dev server.

**Step 5: Commit**

```bash
git add apps/web/src/routes/approvals.tsx apps/web/src/routes/approvals.lazy.tsx \
  apps/web/src/components/pages/ApprovalsPage.tsx \
  apps/web/src/components/layout/Sidebar.tsx \
  apps/web/src/routeTree.gen.ts
git commit -m "feat(approvals): add /approvals page with full queue and milestone feed"
```

---

## Task 8: Wire individual tool call approve/reject

**Files:**

- Modify: `apps/web/src/hooks/useAgentApprovalActions.ts` (if needed)
- Modify: `apps/web/src/hooks/usePendingApprovals.ts`

**Context:** `approvePending` and `denyPending` currently work at the agent level (bulk). The `ApprovalItem` component passes individual `toolCallId` to `onApprove`/`onReject`. Check if there's a per-toolcall approve/reject API in the gateway. Look at how `ToolApprovalCard`'s `onApprove` is wired in existing usage.

**Step 1: Search for existing per-toolcall approval wiring**

```bash
grep -r "tool.approve\|tool.reject\|onApprove" apps/web/src --include="*.ts" --include="*.tsx" -l
```

Read those files. If per-toolcall approval exists, wire it. If not, the fallback is: find the `agentId` from the `toolCallId` via `usePendingApprovals` data and call `approvePending(agentId)`.

**Step 2:** Update `handleApprove`/`handleReject` in `InboxPanel` and `ApprovalsPage` once you know the correct API.

**Step 3: Commit**

```bash
git add -p  # stage only relevant changes
git commit -m "fix(approvals): wire per-toolcall approve/reject to correct API"
```

---

## Verification

After all tasks:

1. Start dev server: `pnpm --filter web dev`
2. Navigate to `/approvals` — page renders with queue and milestone feed
3. Collapse sidebar — inbox icon shows with badge count (if any pending)
4. Click inbox icon — slide-out panel opens with compact views
5. Click a milestone item — `MilestoneDetailPanel` opens
6. If all milestones in a goal are complete — "Goal Complete" banner shows
7. Approve/reject a tool call — item disappears from queue
8. Group card: create 3+ pending approvals on one agent — group card shows with bulk actions
