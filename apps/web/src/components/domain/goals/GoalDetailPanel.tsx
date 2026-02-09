"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DetailPanel } from "@/components/composed/DetailPanel";
import { MilestoneTracker } from "./MilestoneTracker";
import { InlineTextField, InlineListField } from "./GoalInlineEditor";
import {
  Target,
  Calendar,
  GitBranch,
  CheckCircle2,
  Clock,
  TrendingUp,
  ListChecks,
  ShieldAlert,
} from "lucide-react";
import type { GoalStatus } from "./GoalCard";

// Use the type from the query hook for consistency
import type { Goal, Milestone } from "@/hooks/queries/useGoals";

interface GoalDetailPanelProps {
  goal: Goal | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (goal: Goal) => void;
  onUpdate?: (goalId: string, data: Partial<Goal>) => void;
  isUpdating?: boolean;
  className?: string;
}

const statusConfig: Record<GoalStatus | string, { color: string; bgColor: string; label: string }> = {
  active: { color: "text-primary", bgColor: "bg-primary/20", label: "Active" },
  in_progress: { color: "text-primary", bgColor: "bg-primary/20", label: "In Progress" },
  not_started: { color: "text-muted-foreground", bgColor: "bg-muted", label: "Not Started" },
  completed: { color: "text-green-500", bgColor: "bg-green-500/20", label: "Completed" },
  paused: { color: "text-orange-500", bgColor: "bg-orange-500/20", label: "Paused" },
  archived: { color: "text-muted-foreground", bgColor: "bg-muted", label: "Archived" },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} days overdue`;
  } else if (diffDays === 0) {
    return "Due today";
  } else if (diffDays === 1) {
    return "Due tomorrow";
  } else if (diffDays <= 7) {
    return `${diffDays} days left`;
  } else if (diffDays <= 30) {
    return `${Math.ceil(diffDays / 7)} weeks left`;
  }
  return formatDate(dateString);
}

// Convert Goal from query hook to Milestone format for MilestoneTracker
function convertMilestones(milestones: Milestone[]): { id: string; title: string; completed: boolean; completedAt?: string }[] {
  return milestones.map((m) => ({
    id: m.id,
    title: m.title,
    completed: m.completed,
    completedAt: m.completed ? new Date().toISOString() : undefined,
  }));
}

export function GoalDetailPanel({
  goal,
  open,
  onClose,
  onEdit,
  onUpdate,
  isUpdating,
  className,
}: GoalDetailPanelProps) {
  if (!goal) {return null;}

  const status = statusConfig[goal.status] || statusConfig.active;
  const completedMilestones = goal.milestones.filter((m) => m.completed).length;
  const canEdit = goal.status !== "completed" && !!onUpdate;

  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      title="Goal Details"
      width="lg"
      className={className}
    >
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-start gap-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="relative"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-2 ring-border/50">
              <Target className={cn("h-8 w-8", status.color)} />
            </div>
            {isUpdating && (
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary animate-pulse" />
            )}
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn(status.bgColor, status.color, "border-0")}>
                {status.label}
              </Badge>
              {goal.tags && goal.tags.length > 0 && (
                <div className="flex gap-1">
                  {goal.tags.slice(0, 2).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Inline editable title */}
            <InlineTextField
              value={goal.title}
              onSave={(title) => onUpdate?.(goal.id, { title })}
              placeholder="Goal title"
              disabled={!canEdit}
              className="mb-1"
            />

            {/* Inline editable description / problem statement */}
            <InlineTextField
              value={goal.description ?? ""}
              onSave={(description) => onUpdate?.(goal.id, { description })}
              label="Problem Statement"
              placeholder="Describe what this goal aims to solve..."
              multiline
              disabled={!canEdit}
            />
          </div>
        </div>

        {/* Progress Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-secondary/30 p-4 border border-border/50"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Progress</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{goal.progress}%</span>
          </div>
          <Progress value={goal.progress} className="h-3" />
          <p className="mt-2 text-xs text-muted-foreground">
            {completedMilestones} of {goal.milestones.length} milestones completed
          </p>
        </motion.div>

        {/* Success Criteria — Inline Editable */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-xl bg-secondary/30 p-4 border border-border/50"
        >
          <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Success Criteria
          </h4>
          <InlineListField
            items={goal.successCriteria ?? []}
            onSave={(successCriteria) => onUpdate?.(goal.id, { successCriteria })}
            label=""
            placeholder="Add success criterion..."
            emptyMessage="No success criteria defined yet. Click to add."
            disabled={!canEdit}
          />
        </motion.div>

        {/* Constraints — Inline Editable */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="rounded-xl bg-secondary/30 p-4 border border-border/50"
        >
          <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-orange-500" />
            Constraints
          </h4>
          <InlineListField
            items={goal.constraints ?? []}
            onSave={(constraints) => onUpdate?.(goal.id, { constraints })}
            label=""
            placeholder="Add constraint..."
            emptyMessage="No constraints defined. Click to add."
            disabled={!canEdit}
          />
        </motion.div>

        {/* Key Dates */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="grid grid-cols-2 gap-3"
        >
          {goal.dueDate && (
            <div className="rounded-xl bg-secondary/30 p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Due Date</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {formatDate(goal.dueDate)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRelativeDate(goal.dueDate)}
              </p>
            </div>
          )}
          <div className="rounded-xl bg-secondary/30 p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Created</span>
            </div>
            <p className="text-sm font-medium text-foreground">
              {formatDate(goal.createdAt)}
            </p>
          </div>
        </motion.div>

        {/* Milestones Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Milestones
          </h4>
          <MilestoneTracker
            milestones={convertMilestones(goal.milestones)}
            variant="vertical"
            showLabels
          />
        </motion.div>

        {/* Related Workstreams Section (placeholder) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl bg-secondary/20 p-4 border border-border/50"
        >
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Related Workstreams
          </h4>
          <p className="text-sm text-muted-foreground">
            No workstreams linked to this goal yet.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 pt-2"
        >
          <Button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl"
          >
            Close
          </Button>
        </motion.div>
      </div>
    </DetailPanel>
  );
}

export default GoalDetailPanel;
