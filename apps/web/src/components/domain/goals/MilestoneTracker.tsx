"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Target } from "lucide-react";
import type { Milestone } from "./GoalCard";

interface MilestoneTrackerProps {
  milestones: Milestone[];
  variant?: "horizontal" | "vertical";
  showLabels?: boolean;
  className?: string;
}

export function MilestoneTracker({
  milestones,
  variant = "horizontal",
  showLabels = true,
  className,
}: MilestoneTrackerProps) {
  const completedCount = milestones.filter((m) => m.completed).length;

  if (milestones.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/50">
          <Target className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No milestones defined</p>
      </div>
    );
  }

  if (variant === "vertical") {
    return (
      <div className={cn("space-y-1", className)}>
        {/* Progress header */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Milestones</span>
          <span className="text-sm text-muted-foreground">
            {completedCount} of {milestones.length} completed
          </span>
        </div>

        {/* Vertical timeline */}
        <div className="relative ml-3">
          {/* Milestones */}
          <div className="space-y-4">
            {milestones.map((milestone, index) => {
              const isLast = index === milestones.length - 1;
              const segmentIsComplete = milestone.completed;
              return (
                <motion.div
                  key={milestone.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="relative flex items-start gap-4 pl-6"
                >
                  {!isLast && (
                    <span
                      className={cn(
                        "absolute left-[7px] top-4 h-[calc(100%+1rem)] w-0.5",
                        segmentIsComplete ? "bg-success" : "bg-border"
                      )}
                    />
                  )}

                  {/* Checkpoint icon */}
                  <div className="absolute left-0 flex h-4 w-4 items-center justify-center rounded-full bg-background">
                    {milestone.completed ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, delay: index * 0.1 }}
                      >
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </motion.div>
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Milestone content */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium transition-colors",
                        milestone.completed
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {milestone.title}
                    </p>
                    {milestone.completedAt && (
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        Completed {new Date(milestone.completedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Horizontal variant
  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Milestones</span>
        <span className="text-sm text-muted-foreground">
          {completedCount} of {milestones.length}
        </span>
      </div>

      {/* Horizontal progress track */}
      <div className="relative">
        {/* Background track */}
        <div className="absolute left-2 right-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />

        {/* Progress fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{
            width: milestones.length > 1
              ? `calc(${(completedCount / (milestones.length - 1)) * 100}% - 1rem)`
              : "0%",
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute left-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-success"
        />

        {/* Checkpoints */}
        <div className="relative flex justify-between">
          {milestones.map((milestone, index) => (
            <motion.div
              key={milestone.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1, type: "spring", stiffness: 500 }}
              className="group relative flex flex-col items-center"
            >
              {/* Checkpoint circle */}
              <div
                className={cn(
                  "relative z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-300",
                  milestone.completed
                    ? "border-success bg-success text-success-foreground"
                    : "border-muted-foreground/40 bg-card text-muted-foreground"
                )}
              >
                {milestone.completed ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Circle className="h-2 w-2" />
                )}
              </div>

              {/* Label */}
              {showLabels && (
                <div className="absolute top-7 w-20 text-center">
                  <p
                    className={cn(
                      "truncate text-xs transition-colors",
                      milestone.completed
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    )}
                    title={milestone.title}
                  >
                    {milestone.title}
                  </p>
                </div>
              )}

              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute -top-10 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-popover px-3 py-1.5 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                {milestone.title}
                {milestone.completedAt && (
                  <span className="ml-1 text-muted-foreground">
                    ({new Date(milestone.completedAt).toLocaleDateString()})
                  </span>
                )}
                {/* Arrow */}
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-popover" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Spacer for labels */}
      {showLabels && <div className="h-6" />}
    </div>
  );
}

export default MilestoneTracker;
