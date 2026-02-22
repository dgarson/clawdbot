
import { CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Goal, Milestone } from "@/hooks/queries/useGoals";

export interface MilestoneItemProps {
  milestone: Milestone;
  goal: Goal;
  completedAt: string; // goal.updatedAt for now — replace when backend provides per-milestone timestamps
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
