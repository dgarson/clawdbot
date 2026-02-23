
import { useState } from "react";
import { useGoals } from "@/hooks/queries/useGoals";
import { MilestoneItem } from "./MilestoneItem";
import { GoalDetailPanel } from "@/components/domain/goals";
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

  // Derive completed milestones from all goals.
  // NOTE: Using goal.updatedAt as proxy for completedAt until backend provides per-milestone timestamps.
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
      <GoalDetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        goal={selected?.goal ?? null}
        highlightMilestoneId={selected?.milestone.id}
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
  const buckets = [
    { label: "Today", fn: (d: Date) => isToday(d) },
    { label: "Yesterday", fn: (d: Date) => isYesterday(d) },
    { label: "This Week", fn: (d: Date) => isThisWeek(d) && !isToday(d) && !isYesterday(d) },
    { label: "Older", fn: (_d: Date) => true },
  ];

  const groups: { label: string; items: FlatMilestone[] }[] = [];
  const assigned = new Set<string>();

  for (const bucket of buckets) {
    const matched = items.filter((i) => {
      const key = `${i.goal.id}-${i.milestone.id}`;
      return !assigned.has(key) && bucket.fn(new Date(i.completedAt));
    });
    if (matched.length > 0) {
      for (const m of matched) {assigned.add(`${m.goal.id}-${m.milestone.id}`);}
      groups.push({ label: bucket.label, items: matched });
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
