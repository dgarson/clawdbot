"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GoalCard, type Goal, type GoalStatus } from "./GoalCard";

type FilterStatus = GoalStatus | "all";

interface GoalListProps {
  goals: Goal[];
  variant?: "grid" | "list";
  onViewDetails?: (goal: Goal) => void;
  onEdit?: (goal: Goal) => void;
  className?: string;
}

const filterTabs: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export function GoalList({
  goals,
  variant = "grid",
  onViewDetails,
  onEdit,
  className,
}: GoalListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");

  const filteredGoals = useMemo(() => {
    if (activeFilter === "all") {
      return goals;
    }
    return goals.filter((goal) => goal.status === activeFilter);
  }, [goals, activeFilter]);

  const counts = useMemo(() => {
    return {
      all: goals.length,
      active: goals.filter((g) => g.status === "active").length,
      completed: goals.filter((g) => g.status === "completed").length,
      archived: goals.filter((g) => g.status === "archived").length,
    };
  }, [goals]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Filter tabs */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap gap-2"
      >
        {filterTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={activeFilter === tab.value ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveFilter(tab.value)}
            className={cn(
              "rounded-full transition-all",
              activeFilter === tab.value
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-secondary/50 text-secondary-foreground hover:bg-secondary"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "ml-2 rounded-full px-1.5 py-0.5 text-xs",
                activeFilter === tab.value
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {counts[tab.value]}
            </span>
          </Button>
        ))}
      </motion.div>

      {/* Goals grid/list */}
      <AnimatePresence mode="popLayout">
        {filteredGoals.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50">
              <span className="text-3xl">🎯</span>
            </div>
            <h3 className="text-lg font-medium text-foreground">No goals found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeFilter === "all"
                ? "Create your first goal to get started"
                : `No ${activeFilter} goals at the moment`}
            </p>
          </motion.div>
        ) : (
          <motion.div
            layout
            className={cn(
              variant === "grid"
                ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col gap-4"
            )}
          >
            <AnimatePresence mode="popLayout">
              {filteredGoals.map((goal, index) => (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                    layout: { duration: 0.3 },
                  }}
                >
                  <GoalCard
                    goal={goal}
                    variant={variant === "list" ? "compact" : "expanded"}
                    onViewDetails={() => onViewDetails?.(goal)}
                    onEdit={() => onEdit?.(goal)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GoalList;
