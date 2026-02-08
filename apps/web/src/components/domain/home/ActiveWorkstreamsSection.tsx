"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ListItemSkeleton } from "@/components/composed";
import { useWorkstreams } from "@/hooks/queries";
import { GitBranch, ArrowRight, CheckCircle2 } from "lucide-react";

interface ActiveWorkstreamsSectionProps {
  maxWorkstreams?: number;
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
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

function getTaskCounts(
  tasks: { status: string }[]
): { total: number; done: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  return { total, done };
}

export function ActiveWorkstreamsSection({
  maxWorkstreams = 4,
  className,
}: ActiveWorkstreamsSectionProps) {
  const { data: workstreams, isLoading, error } = useWorkstreams();

  // Filter active workstreams and sort by progress
  const activeWorkstreams = React.useMemo(() => {
    if (!workstreams) {return [];}
    return workstreams
      .filter((w) => w.status === "active")
      .toSorted((a, b) => b.progress - a.progress)
      .slice(0, maxWorkstreams);
  }, [workstreams, maxWorkstreams]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
      className={cn("", className)}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
              <GitBranch className="h-4 w-4 text-purple-500" />
            </div>
            <CardTitle className="text-lg">Active Workstreams</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/workstreams">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <ListItemSkeleton key={index} />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Failed to load workstreams
            </div>
          ) : activeWorkstreams.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No active workstreams
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {activeWorkstreams.map((workstream) => {
                const { total, done } = getTaskCounts(workstream.tasks);
                return (
                  <motion.div
                    key={workstream.id}
                    variants={itemVariants}
                    className="group rounded-lg border border-border/50 bg-secondary/30 p-4 transition-all duration-200 hover:border-primary/30 hover:bg-secondary/50"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {workstream.name}
                        </h4>
                        {workstream.description && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {workstream.description}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "shrink-0 text-xs",
                          workstream.progress >= 80
                            ? "bg-green-500/20 text-green-600"
                            : workstream.progress >= 50
                              ? "bg-yellow-500/20 text-yellow-600"
                              : "bg-blue-500/20 text-blue-600"
                        )}
                      >
                        {workstream.progress}%
                      </Badge>
                    </div>

                    <div className="mb-2">
                      <Progress value={workstream.progress} className="h-2" />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>
                          {done}/{total} tasks
                        </span>
                      </div>
                      {workstream.tags && workstream.tags.length > 0 && (
                        <div className="flex gap-1">
                          {workstream.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-secondary px-2 py-0.5"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
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

export default ActiveWorkstreamsSection;
