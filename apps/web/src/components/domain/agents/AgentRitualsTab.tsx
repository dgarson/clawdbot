
import * as React from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CardSkeleton } from "@/components/composed";
import { useRitualsByAgent } from "@/hooks/queries/useRituals";
import { useAgents } from "@/hooks/queries/useAgents";
import { useCreateRitual } from "@/hooks/mutations/useRitualMutations";
import { useQueryClient } from "@tanstack/react-query";
import { ritualKeys } from "@/hooks/queries/useRituals";
import { CreateRitualModal } from "@/components/domain/rituals";
import type { RitualStatus, RitualFrequency } from "@/hooks/queries/useRituals";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Zap,
  ChevronRight,
} from "lucide-react";

interface AgentRitualsTabProps {
  agentId: string;
}

const statusConfig: Record<
  RitualStatus,
  { color: string; bgColor: string; label: string }
> = {
  active: { color: "text-green-500", bgColor: "bg-green-500/10", label: "Active" },
  paused: { color: "text-orange-500", bgColor: "bg-orange-500/10", label: "Paused" },
  completed: { color: "text-blue-500", bgColor: "bg-blue-500/10", label: "Completed" },
  failed: { color: "text-red-500", bgColor: "bg-red-500/10", label: "Failed" },
};

const frequencyConfig: Record<RitualFrequency, { icon: React.ElementType; label: string }> = {
  hourly: { icon: RefreshCw, label: "Every hour" },
  daily: { icon: Calendar, label: "Daily" },
  weekly: { icon: Calendar, label: "Weekly" },
  monthly: { icon: Calendar, label: "Monthly" },
  custom: { icon: Clock, label: "Custom" },
};

export function AgentRitualsTab({ agentId }: AgentRitualsTabProps) {
  const { data: rituals, isLoading, error } = useRitualsByAgent(agentId);
  const { data: agents } = useAgents();
  const createRitual = useCreateRitual();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newRitualId, setNewRitualId] = React.useState<string | null>(null);
  const [highlightedRitualId, setHighlightedRitualId] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!newRitualId || !rituals?.length) {return;}
    const target = document.querySelector(`[data-ritual-id="${newRitualId}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedRitualId(newRitualId);
      setNewRitualId(null);
    }
  }, [newRitualId, rituals]);

  React.useEffect(() => {
    if (!highlightedRitualId) {return;}
    const timer = window.setTimeout(() => setHighlightedRitualId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [highlightedRitualId]);

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
          <p className="text-destructive">Failed to load rituals</p>
        </CardContent>
      </Card>
    );
  }

  if (!rituals || rituals.length === 0) {
    return (
      <>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No rituals configured</h3>
            <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
              Create automated rituals for this agent to perform on a schedule
            </p>
            <Button className="mt-4 gap-2" variant="outline" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Ritual
            </Button>
          </CardContent>
        </Card>
        <CreateRitualModal
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          agents={(agents ?? []).map((agent) => ({ id: agent.id, name: agent.name }))}
          initialAgentId={agentId}
          isLoading={createRitual.isPending}
          onSubmit={(data) => {
            createRitual.mutate(data, {
              onSuccess: (created) => {
                queryClient.setQueryData(
                  ritualKeys.list({ agentId }),
                  (old: typeof rituals) => {
                    const next = old ? [created, ...old] : [created];
                    return next.filter((entry) => entry.agentId === agentId);
                  }
                );
                setNewRitualId(created.id);
                setIsCreateOpen(false);
              },
            });
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{rituals.length}</p>
            <p className="text-xs text-muted-foreground">Total Rituals</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">
              {rituals.filter((r) => r.status === "active").length}
            </p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {rituals.reduce((sum, r) => sum + (r.executionCount || 0), 0)}
            </p>
            <p className="text-xs text-muted-foreground">Executions</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {Math.round(
                rituals.reduce((sum, r) => sum + (r.successRate || 0), 0) /
                  (rituals.length || 1)
              )}
              %
            </p>
            <p className="text-xs text-muted-foreground">Avg Success</p>
          </CardContent>
        </Card>
      </div>

      {/* Rituals List */}
      {rituals.map((ritual, index) => {
        const status = statusConfig[ritual.status];
        const frequency = frequencyConfig[ritual.frequency];
        const FreqIcon = frequency.icon;

        return (
          <motion.div
            key={ritual.id}
            data-ritual-id={ritual.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            className={ritual.id === highlightedRitualId ? "ritual-new-highlight" : undefined}
          >
            <Card className="border-border/50 hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground truncate">
                        {ritual.name}
                      </h4>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          status.bgColor,
                          status.color
                        )}
                      >
                        {status.label}
                      </Badge>
                    </div>
                    {ritual.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                        {ritual.description}
                      </p>
                    )}

                    {/* Schedule & Stats */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FreqIcon className="h-3 w-3" />
                        {frequency.label}
                      </span>
                      {ritual.nextRun && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Next: {formatDate(new Date(ritual.nextRun))}
                        </span>
                      )}
                      {ritual.executionCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {ritual.executionCount} runs
                        </span>
                      )}
                      {ritual.successRate !== undefined && (
                        <span
                          className={cn(
                            "flex items-center gap-1",
                            ritual.successRate >= 90
                              ? "text-green-500"
                              : ritual.successRate >= 70
                                ? "text-yellow-500"
                                : "text-red-500"
                          )}
                        >
                          {ritual.successRate >= 90 ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {ritual.successRate}% success
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    {ritual.actions && ritual.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {ritual.actions.map((action) => (
                          <Badge
                            key={action}
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {action}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="sm" asChild className="gap-1">
                      <Link to="/rituals" search={{ ritualId: ritual.id }}>
                        View
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Switch
                      checked={ritual.status === "active"}
                      onCheckedChange={() => {
                        // Toggle ritual status
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      {/* Add Ritual Button */}
      <Button
        variant="outline"
        className="w-full gap-2 border-dashed"
        onClick={() => setIsCreateOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Add New Ritual
      </Button>

      <CreateRitualModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        agents={(agents ?? []).map((agent) => ({ id: agent.id, name: agent.name }))}
        initialAgentId={agentId}
        isLoading={createRitual.isPending}
        onSubmit={(data) => {
          createRitual.mutate(data, {
            onSuccess: (created) => {
              queryClient.setQueryData(
                ritualKeys.list({ agentId }),
                (old: typeof rituals) => {
                  const next = old ? [created, ...old] : [created];
                  return next.filter((entry) => entry.agentId === agentId);
                }
              );
              setNewRitualId(created.id);
              setIsCreateOpen(false);
            },
          });
        }}
      />
    </div>
  );
}

function formatDate(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) {
    return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default AgentRitualsTab;
