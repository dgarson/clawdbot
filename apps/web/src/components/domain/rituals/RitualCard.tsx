"use client";

import * as React from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/composed/ConfirmDialog";
import RitualAssignDialog, {
  type AssignableAgent,
  type RitualAssignPayload,
} from "./RitualAssignDialog";
import {
  RefreshCw,
  Clock,
  Calendar,
  Bot,
  Play,
  Pause,
  Settings,
  ChevronDown,
  ChevronUp,
  Zap,
  SkipForward,
  AlarmClock,
  ArrowUpRight,
} from "lucide-react";
import { RitualScheduler } from "./RitualScheduler";
import { useRitualExecutions } from "@/hooks/queries/useRituals";

export type RitualFrequency = "hourly" | "daily" | "weekly" | "monthly" | "custom";
export type RitualStatus = "active" | "paused" | "completed" | "failed";

export interface Ritual {
  id: string;
  name: string;
  description?: string;
  frequency: RitualFrequency;
  time: string; // HH:mm format
  enabled: boolean;
  status?: RitualStatus;
  successRate?: number;
  agentId?: string;
  agentName?: string;
  nextOccurrence?: Date;
  lastRun?: Date;
  customCron?: string; // For custom frequency
}

interface RitualCardProps {
  ritual: Ritual;
  variant?: "expanded" | "compact";
  onToggle?: () => void;
  onTrigger?: () => void;
  onSkipNext?: () => void;
  onSnooze?: () => void;
  onUpdateSchedule?: (schedule: { time: string; frequency: RitualFrequency }) => void;
  onSettings?: () => void;
  onAgentClick?: () => void;
  onAssign?: (payload: RitualAssignPayload) => void;
  agents?: AssignableAgent[];
  className?: string;
}

const frequencyConfig: Record<RitualFrequency, { label: string; color: string; hover: string; icon: typeof RefreshCw }> = {
  hourly: {
    label: "Hourly",
    color: "bg-slate-500/20 text-slate-500",
    hover: "hover:bg-slate-500/20 hover:text-slate-400",
    icon: Clock,
  },
  daily: {
    label: "Daily",
    color: "bg-blue-500/20 text-blue-500",
    hover: "hover:bg-blue-500/20 hover:text-blue-400",
    icon: RefreshCw,
  },
  weekly: {
    label: "Weekly",
    color: "bg-purple-500/20 text-purple-500",
    hover: "hover:bg-purple-500/20 hover:text-purple-400",
    icon: Calendar,
  },
  monthly: {
    label: "Monthly",
    color: "bg-green-500/20 text-green-500",
    hover: "hover:bg-green-500/20 hover:text-green-400",
    icon: Calendar,
  },
  custom: {
    label: "Custom",
    color: "bg-orange-500/20 text-orange-500",
    hover: "hover:bg-orange-500/20 hover:text-orange-400",
    icon: Clock,
  },
};

function formatNextOccurrence(date?: Date): string {
  if (!date) return "Not scheduled";

  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (diff < 0) return "Overdue";
  if (hours < 1) return "Less than an hour";
  if (hours < 24) return `In ${hours} hour${hours !== 1 ? "s" : ""}`;
  if (days < 7) return `In ${days} day${days !== 1 ? "s" : ""}`;

  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function formatSessionTime(dateString?: string): string {
  if (!dateString) return "Unknown time";
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const BUSY_WINDOW_MS = 15 * 60 * 1000;

const executionStatusStyles: Record<
  string,
  { label: string; className: string }
> = {
  success: {
    label: "Success",
    className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  },
  failed: {
    label: "Failed",
    className: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
  },
  running: {
    label: "Waiting",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  },
  waiting: {
    label: "Waiting",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  },
  waiting_approval: {
    label: "Waiting",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  },
  timed_out: {
    label: "Timed Out",
    className: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  },
  timeout: {
    label: "Timed Out",
    className: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  },
  skipped: {
    label: "Skipped",
    className: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
  },
};

function resolveExecutionBadge(status?: string) {
  if (!status) {
    return {
      label: "Unknown",
      className: "bg-muted/40 text-muted-foreground border border-border/60",
    };
  }
  return executionStatusStyles[status] ?? {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    className: "bg-muted/40 text-muted-foreground border border-border/60",
  };
}

function getActivityState(ritual: Ritual) {
  const status = ritual.status ?? (ritual.enabled ? "active" : "paused");

  // Distinguish between paused and other inactive states
  if (status === "paused") {
    return {
      label: "Paused",
      textClass: "text-orange-500",
      dotClass: "bg-orange-500",
      pulse: false,
    };
  }

  if (status !== "active") {
    return {
      label: "Inactive",
      textClass: "text-muted-foreground",
      dotClass: "bg-muted-foreground",
      pulse: false,
    };
  }

  const now = Date.now();
  const lastRunMs = ritual.lastRun?.getTime();
  const nextRunMs = ritual.nextOccurrence?.getTime();
  const isBusy =
    (lastRunMs ? now - lastRunMs <= BUSY_WINDOW_MS : false) ||
    (nextRunMs ? nextRunMs - now <= BUSY_WINDOW_MS : false);

  if (isBusy) {
    return {
      label: "Busy",
      textClass: "text-amber-500",
      dotClass: "bg-amber-500",
      pulse: true,
    };
  }

  if (lastRunMs || nextRunMs) {
    return {
      label: "Idle",
      textClass: "text-emerald-500",
      dotClass: "bg-emerald-500",
      pulse: false,
    };
  }

  return {
    label: "Active",
    textClass: "text-emerald-500",
    dotClass: "bg-emerald-500",
    pulse: true,
  };
}

export function RitualCard({
  ritual,
  variant = "expanded",
  onToggle,
  onTrigger,
  onSkipNext,
  onSnooze,
  onUpdateSchedule,
  onSettings,
  onAgentClick,
  onAssign,
  agents = [],
  className,
}: RitualCardProps) {
  const freq = frequencyConfig[ritual.frequency];
  const FreqIcon = freq.icon;
  const activity = getActivityState(ritual);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showScheduler, setShowScheduler] = React.useState(false);
  const [pendingSchedule, setPendingSchedule] = React.useState<{
    time: string;
    frequency: RitualFrequency;
  } | null>(null);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const { data: executions } = useRitualExecutions(isExpanded ? ritual.id : "");
  const sessionExecutions = executions ?? [];

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        whileHover={{ scale: 1.02 }}
        className={cn("group", className)}
      >
        <Card className={cn(
          "overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300",
          ritual.status === "paused"
            ? "opacity-75 border-orange-500/30 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5"
            : "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* Status indicator */}
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                <RefreshCw className={cn("h-5 w-5", ritual.enabled ? "text-primary" : "text-muted-foreground")} />
                {ritual.enabled && (
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-card" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px] font-medium transition-colors", freq.color, freq.hover)}
                      >
                        <FreqIcon className="mr-1 h-3 w-3" />
                        {freq.label}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-medium", activity.textClass)}>
                          {activity.label}
                        </span>
                        <div className="relative flex h-3 w-3 items-center justify-center">
                          <span className={cn("h-2.5 w-2.5 rounded-full", activity.dotClass)} />
                          {activity.pulse && (
                            <span className={cn("absolute h-2.5 w-2.5 rounded-full opacity-40 animate-ping", activity.dotClass)} />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <h4 className="truncate text-base font-semibold text-foreground">
                        {ritual.name}
                      </h4>
                      <Button
                        onClick={onTrigger}
                        variant="ghost"
                        size="sm"
                        disabled={!onTrigger || (ritual.status ?? (ritual.enabled ? "active" : "paused")) !== "active"}
                        className="h-8 rounded-lg bg-secondary/50 text-foreground hover:bg-secondary"
                      >
                        <Zap className="mr-1 h-3.5 w-3.5" />
                        Run Now
                      </Button>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatTime(ritual.time)} - {freq.label}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onToggle}
                      disabled={!onToggle}
                      className={cn(
                        "h-8 w-8 rounded-lg bg-secondary/40 text-muted-foreground hover:text-foreground",
                        ritual.enabled ? "hover:bg-orange-500/20" : "hover:bg-green-500/20"
                      )}
                      aria-label={ritual.enabled ? "Pause ritual" : "Resume ritual"}
                    >
                      {ritual.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsExpanded((prev) => !prev)}
                      className="h-8 w-8 rounded-lg bg-secondary/40 text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onSettings}
                      className="h-8 w-8 rounded-lg bg-secondary/40 text-muted-foreground hover:text-foreground"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-secondary/30 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Next:</span>
                    <span className="font-medium text-foreground">
                      {formatNextOccurrence(ritual.nextOccurrence)}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={onSnooze}
                        disabled={!onSnooze}
                        className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <AlarmClock className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={onSkipNext}
                        disabled={!onSkipNext}
                        className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <SkipForward className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {ritual.lastRun && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Last:</span>
                      <span className="font-medium text-foreground">
                        {ritual.lastRun.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      {typeof ritual.successRate === "number" && (
                        <span className={cn(
                          "ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium",
                          ritual.successRate >= 90
                            ? "bg-emerald-500/15 text-emerald-500"
                            : ritual.successRate >= 70
                              ? "bg-amber-500/15 text-amber-500"
                              : "bg-rose-500/15 text-rose-500"
                        )}>
                          {ritual.successRate}% success
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 space-y-3">
                {ritual.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {ritual.description}
                  </p>
                )}

                {ritual.agentName && (
                  <button
                    onClick={onAgentClick}
                    className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-left transition-all hover:border-primary/30 hover:bg-secondary/50"
                  >
                    <Bot className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Assigned to:</span>
                    <span className="text-sm font-medium text-foreground">
                      {ritual.agentName}
                    </span>
                  </button>
                )}

                {onUpdateSchedule && (
                  <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Schedule</p>
                        <p className="text-sm font-medium text-foreground">
                          {formatTime(ritual.time)} - {freq.label}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowScheduler((prev) => !prev)}
                        className="rounded-lg"
                      >
                        {showScheduler ? "Close" : "Edit"}
                      </Button>
                    </div>

                    {showScheduler && (
                      <div className="mt-3">
                        <RitualScheduler
                          initialTime={ritual.time}
                          initialFrequency={ritual.frequency === "custom" ? "daily" : ritual.frequency}
                          variant="inline"
                          onSchedule={(time, frequency) => {
                            setPendingSchedule({ time, frequency });
                            setShowConfirm(true);
                          }}
                          onCancel={() => setShowScheduler(false)}
                          className="max-w-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {sessionExecutions.length > 0 && (
                  <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                    <div className="text-xs font-medium text-muted-foreground">Recent sessions</div>
                    <div className="mt-3 space-y-2">
                      {sessionExecutions.map((execution) => {
                        const sessionKey = execution.sessionKey ?? execution.id;
                        const sessionHref = ritual.agentId
                          ? `/agents/${encodeURIComponent(ritual.agentId)}/session/${encodeURIComponent(sessionKey)}`
                          : undefined;
                        return (
                          <div key={execution.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">
                                {execution.result ?? execution.error ?? "Ritual execution"}
                              </div>
                              <div className="text-muted-foreground">
                                {formatSessionTime(execution.startedAt)}
                              </div>
                            </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] uppercase tracking-wide",
                                resolveExecutionBadge(execution.status).className
                              )}
                            >
                              {resolveExecutionBadge(execution.status).label}
                            </Badge>
                            {sessionHref ? (
                              <Button asChild variant="ghost" size="sm" className="h-7 rounded-md gap-1">
                                <Link to={sessionHref}>
                                    Open session
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <ConfirmDialog
          open={showConfirm}
          onOpenChange={(open) => {
            setShowConfirm(open);
            if (!open) {
              setPendingSchedule(null);
            }
          }}
          title="Confirm schedule change"
          resource={{
            title: ritual.name,
            subtitle: freq.label,
          }}
          description={
            pendingSchedule
              ? `Update this ritual to run ${pendingSchedule.frequency} at ${formatTime(pendingSchedule.time)}?`
              : "Update schedule?"
          }
          confirmLabel="Confirm"
          onConfirm={() => {
            if (pendingSchedule) {
              onUpdateSchedule?.(pendingSchedule);
              setShowScheduler(false);
              setPendingSchedule(null);
            }
          }}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("group relative", className)}
    >
      <Card className={cn(
        "relative overflow-hidden rounded-2xl border-border/50 bg-gradient-to-br from-card via-card to-card/80 backdrop-blur-sm transition-all duration-500",
        ritual.status === "paused"
          ? "opacity-75 border-orange-500/30 hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/10"
          : "hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10"
      )}>
        {/* Gradient accent line */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r opacity-60",
          ritual.status === "paused"
            ? "from-orange-500 via-orange-400 to-orange-500"
            : ritual.enabled
              ? "from-primary via-accent to-primary"
              : "from-muted via-muted-foreground/30 to-muted"
        )} />

        {/* Glow effect on hover */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <CardContent className="relative p-6">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <Badge
              variant="secondary"
              className={cn("text-xs font-medium transition-colors", freq.color, freq.hover)}
            >
              <FreqIcon className="mr-1 h-3 w-3" />
              {freq.label}
            </Badge>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-medium", activity.textClass)}>
                {activity.label}
              </span>
              <div className="relative flex h-3 w-3 items-center justify-center">
                <span className={cn("h-2.5 w-2.5 rounded-full", activity.dotClass)} />
                {activity.pulse && (
                  <span className={cn("absolute h-2.5 w-2.5 rounded-full opacity-40 animate-ping", activity.dotClass)} />
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="h-8 w-8 rounded-lg bg-secondary/40 text-muted-foreground hover:text-foreground"
                aria-label={isExpanded ? "Collapse ritual card" : "Expand ritual card"}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Icon and info */}
          <div className="mb-5 flex items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 15 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-60" />
              <div className={cn(
                "relative flex h-16 w-16 items-center justify-center rounded-full ring-2 ring-border/50 shadow-lg transition-all duration-300 group-hover:ring-primary/30",
                ritual.enabled ? "bg-primary/10" : "bg-secondary"
              )}>
                <RefreshCw className={cn(
                  "h-8 w-8",
                  ritual.enabled ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="truncate text-xl font-semibold tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary">
                  {ritual.name}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={onTrigger}
                    disabled={!onTrigger || (ritual.status ?? (ritual.enabled ? "active" : "paused")) !== "active"}
                    className="h-9 rounded-lg px-3 bg-secondary/60 text-foreground hover:bg-secondary"
                    variant="ghost"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Run Now
                  </Button>
                  <Button
                    onClick={onToggle}
                    variant="ghost"
                    size="icon"
                    disabled={!onToggle}
                    className={cn(
                      "h-9 w-9 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground",
                      ritual.enabled ? "hover:bg-orange-500/20" : "hover:bg-green-500/20"
                    )}
                    aria-label={ritual.enabled ? "Pause ritual" : "Resume ritual"}
                  >
                    {ritual.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={onSettings}
                    variant="ghost"
                    size="icon"
                    disabled={!onSettings}
                    className="h-9 w-9 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTime(ritual.time)}</span>
              </div>
            </div>
          </div>

          {/* Next occurrence */}
          <div className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Next:</span>
              <span className="text-sm font-medium text-foreground">
                {formatNextOccurrence(ritual.nextOccurrence)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={onSnooze}
                disabled={!onSnooze}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
              >
                <AlarmClock className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={onSkipNext}
                disabled={!onSkipNext}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-5 space-y-4">
              {/* Description */}
              {ritual.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {ritual.description}
                </p>
              )}

              {/* Agent association */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Assigned to:</span>
                  <button
                    type="button"
                    onClick={onAgentClick}
                    className="truncate text-sm font-medium text-foreground hover:text-primary"
                    disabled={!onAgentClick}
                  >
                    {ritual.agentName ?? "Unassigned"}
                  </button>
                </div>
                {onAssign ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignOpen(true)}
                    className="rounded-lg"
                  >
                    {ritual.agentName ? "Reassign" : "Assign"}
                  </Button>
                ) : null}
              </div>

              {onUpdateSchedule && (
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Schedule</p>
                      <p className="text-sm font-medium text-foreground">
                        {formatTime(ritual.time)} - {freq.label}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowScheduler((prev) => !prev)}
                      className="rounded-lg"
                    >
                      {showScheduler ? "Close" : "Edit"}
                    </Button>
                  </div>

                  {showScheduler && (
                    <div className="mt-3">
                      <RitualScheduler
                        initialTime={ritual.time}
                        initialFrequency={ritual.frequency === "custom" ? "daily" : ritual.frequency}
                        variant="inline"
                        onSchedule={(time, frequency) => {
                          setPendingSchedule({ time, frequency });
                          setShowConfirm(true);
                        }}
                        onCancel={() => setShowScheduler(false)}
                        className="max-w-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {sessionExecutions.length > 0 && (
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Recent sessions</div>
                  <div className="mt-3 space-y-2">
                    {sessionExecutions.map((execution) => {
                      const sessionKey = execution.sessionKey ?? execution.id;
                      const sessionHref = ritual.agentId
                        ? `/agents/${encodeURIComponent(ritual.agentId)}/session/${encodeURIComponent(sessionKey)}`
                        : undefined;
                      return (
                        <div key={execution.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {execution.result ?? execution.error ?? "Ritual execution"}
                            </div>
                            <div className="text-muted-foreground">
                              {formatSessionTime(execution.startedAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {execution.status}
                            </Badge>
                            {sessionHref ? (
                              <Button asChild variant="ghost" size="sm" className="h-7 rounded-md">
                                <Link to={sessionHref}>Open session</Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Last run */}
              {ritual.lastRun && (
                <p className="text-center text-xs text-muted-foreground/70">
                  Last run {ritual.lastRun.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                  })}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {onAssign ? (
        <RitualAssignDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          agents={agents}
          initialAgentId={ritual.agentId}
          onConfirm={(payload) => onAssign(payload)}
        />
      ) : null}
    </motion.div>
  );
}

export default RitualCard;
