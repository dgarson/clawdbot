
import * as React from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGoals } from "@/hooks/queries";
import { Target, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

interface GoalProgressPanelProps {
  maxGoals?: number;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

function CircularProgress({
  progress,
  size = 56,
  strokeWidth = 4,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="rotate-[-90deg]" width={size} height={size}>
        {/* Background circle */}
        <circle
          className="text-secondary"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <motion.circle
          className={cn(
            progress >= 100
              ? "text-green-500"
              : progress >= 75
                ? "text-primary"
                : progress >= 50
                  ? "text-yellow-500"
                  : "text-blue-500"
          )}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold text-foreground">
          {progress}%
        </span>
      </div>
    </div>
  );
}

export function GoalProgressPanel({
  maxGoals = 4,
  className,
}: GoalProgressPanelProps) {
  const { data: goals, isLoading, error } = useGoals();

  // Filter in-progress goals and sort by progress
  const activeGoals = React.useMemo(() => {
    if (!goals) {return [];}
    return goals
      .filter((g) => g.status === "in_progress" || g.status === "not_started")
      .toSorted((a, b) => b.progress - a.progress)
      .slice(0, maxGoals);
  }, [goals, maxGoals]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
      className={cn("", className)}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
              <Target className="h-4 w-4 text-green-500" />
            </div>
            <CardTitle className="text-lg">Goal Progress</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/goals">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Failed to load goals
            </div>
          ) : activeGoals.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No active goals
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {activeGoals.map((goal) => {
                const completedMilestones = goal.milestones.filter(
                  (m) => m.completed
                ).length;
                const totalMilestones = goal.milestones.length;

                return (
                  <motion.div
                    key={goal.id}
                    variants={itemVariants}
                    className="group flex items-center gap-4 rounded-lg border border-border/50 bg-secondary/30 p-4 transition-all duration-200 hover:border-primary/30 hover:bg-secondary/50"
                  >
                    <CircularProgress progress={goal.progress} />

                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {goal.title}
                      </h4>
                      {goal.description && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {goal.description}
                        </p>
                      )}
                      {totalMilestones > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>
                            {completedMilestones}/{totalMilestones} milestones
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Mini progress bar for mobile */}
                    <div className="hidden sm:block w-24">
                      <Progress value={goal.progress} className="h-1.5" />
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default GoalProgressPanel;
