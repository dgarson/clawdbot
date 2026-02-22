
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
                void navigate({ to: "/goals" });
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
