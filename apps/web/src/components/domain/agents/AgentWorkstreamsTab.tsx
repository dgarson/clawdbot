"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/composed";
import { useWorkstreamsByOwner } from "@/hooks/queries/useWorkstreams";
import type { WorkstreamStatus } from "@/hooks/queries/useWorkstreams";
import {
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Plus,
} from "lucide-react";

interface AgentWorkstreamsTabProps {
  agentId: string;
}

const statusConfig: Record<
  WorkstreamStatus,
  { color: string; icon: React.ElementType; label: string }
> = {
  active: { color: "text-green-500", icon: CheckCircle2, label: "Active" },
  paused: { color: "text-orange-500", icon: Clock, label: "Paused" },
  completed: { color: "text-blue-500", icon: CheckCircle2, label: "Completed" },
  archived: { color: "text-gray-400", icon: AlertCircle, label: "Archived" },
};

export function AgentWorkstreamsTab({ agentId }: AgentWorkstreamsTabProps) {
  const { data: workstreams, isLoading, error } = useWorkstreamsByOwner(agentId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="p-6 text-center">
          <p className="text-destructive">Failed to load workstreams</p>
        </CardContent>
      </Card>
    );
  }

  if (!workstreams || workstreams.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Layers className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-medium">No workstreams assigned</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
            Assign this agent to workstreams to track their progress and tasks
          </p>
          <Button className="mt-4 gap-2" variant="outline">
            <Plus className="h-4 w-4" />
            Assign Workstream
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{workstreams.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">
              {workstreams.filter((w) => w.status === "active").length}
            </p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">
              {workstreams.filter((w) => w.status === "completed").length}
            </p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {workstreams.reduce((sum, w) => sum + w.tasks.length, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Total Tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Workstream List */}
      {workstreams.map((workstream, index) => {
        const config = statusConfig[workstream.status];
        const StatusIcon = config.icon;
        const completedTasks = workstream.tasks.filter(
          (t) => t.status === "done"
        ).length;

        return (
          <motion.div
            key={workstream.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
          >
            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIcon className={cn("h-4 w-4", config.color)} />
                      <h4 className="font-semibold text-foreground truncate">
                        {workstream.name}
                      </h4>
                    </div>
                    {workstream.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {workstream.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{workstream.progress}%</span>
                  </div>
                  <Progress value={workstream.progress} className="h-2" />
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {completedTasks}/{workstream.tasks.length} tasks
                    </span>
                    {workstream.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due {new Date(workstream.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {workstream.tags?.slice(0, 2).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs px-2 py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

export default AgentWorkstreamsTab;
