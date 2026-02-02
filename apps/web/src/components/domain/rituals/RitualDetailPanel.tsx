"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DetailPanel } from "@/components/composed/DetailPanel";
import { ConfirmDialog } from "@/components/composed/ConfirmDialog";
import { TokenCostIndicator } from "@/components/composed/TokenCostIndicator";
import { RitualScheduler } from "./RitualScheduler";
import { useGuidancePackStore } from "@/stores/useGuidancePackStore";
import {
  RefreshCw,
  Calendar,
  Clock,
  Play,
  Pause,
  Trash2,
  Bot,
  CheckCircle2,
  XCircle,
  AlertCircle,
  History,
  Settings,
  Zap,
  ArrowUpRight,
  SkipForward,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Ritual, RitualExecution, RitualStatus, RitualFrequency } from "@/hooks/queries/useRituals";

interface RitualDetailPanelProps {
  ritual: Ritual | null;
  executions?: RitualExecution[];
  open: boolean;
  onClose: () => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onDelete?: (id: string) => void;
  onTrigger?: (id: string) => void;
  onSkipNext?: (id: string) => void;
  onUpdateSchedule?: (id: string, schedule: { time: string; frequency: RitualFrequency }) => void;
  agents?: { id: string; name: string }[];
  className?: string;
}

const statusConfig: Record<RitualStatus, { color: string; bgColor: string; label: string; icon: typeof CheckCircle2 }> = {
  active: { color: "text-green-500", bgColor: "bg-green-500/20", label: "Active", icon: CheckCircle2 },
  paused: { color: "text-orange-500", bgColor: "bg-orange-500/20", label: "Paused", icon: Pause },
  completed: { color: "text-blue-500", bgColor: "bg-blue-500/20", label: "Completed", icon: CheckCircle2 },
  failed: { color: "text-red-500", bgColor: "bg-red-500/20", label: "Failed", icon: XCircle },
};

const frequencyLabels: Record<RitualFrequency, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

const executionStatusStyles: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  success: {
    label: "Success",
    className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
    icon: XCircle,
  },
  running: {
    label: "Waiting",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    icon: AlertCircle,
  },
  waiting: {
    label: "Waiting",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    icon: AlertCircle,
  },
  waiting_approval: {
    label: "Waiting",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    icon: AlertCircle,
  },
  timed_out: {
    label: "Timed Out",
    className: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    icon: AlertCircle,
  },
  timeout: {
    label: "Timed Out",
    className: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    icon: AlertCircle,
  },
  skipped: {
    label: "Skipped",
    className: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
    icon: AlertCircle,
  },
};

function resolveExecutionBadge(status?: string) {
  if (!status) {
    return {
      label: "Unknown",
      className: "bg-muted/40 text-muted-foreground border border-border/60",
      icon: AlertCircle,
    };
  }
  return executionStatusStyles[status] ?? {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    className: "bg-muted/40 text-muted-foreground border border-border/60",
    icon: AlertCircle,
  };
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (Math.abs(diffMins) < 60) {
    if (diffMins < 0) return `${Math.abs(diffMins)} minutes ago`;
    return `in ${diffMins} minutes`;
  }
  if (Math.abs(diffHours) < 24) {
    if (diffHours < 0) return `${Math.abs(diffHours)} hours ago`;
    return `in ${diffHours} hours`;
  }
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return `in ${diffDays} days`;
}

export function RitualDetailPanel({
  ritual,
  executions = [],
  open,
  onClose,
  onPause,
  onResume,
  onDelete,
  onTrigger,
  onSkipNext,
  onUpdateSchedule,
  agents = [],
  className,
}: RitualDetailPanelProps) {
  // Early return BEFORE any hooks
  if (!ritual) return null;

  const [showScheduler, setShowScheduler] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showScheduleConfirm, setShowScheduleConfirm] = React.useState(false);
  const [toolsOpen, setToolsOpen] = React.useState(false);
  const [pendingSchedule, setPendingSchedule] = React.useState<{
    time: string;
    frequency: RitualFrequency;
  } | null>(null);
  const sortedExecutions = React.useMemo(() => {
    return [...executions].sort((a, b) => {
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
  }, [executions]);
  const latestExecution = sortedExecutions[0];
  const isRunning = executions.some((execution) => execution.status === "running");
  const canSkipNext = Boolean(onSkipNext);

  const status = statusConfig[ritual.status];
  const StatusIcon = status.icon;

  const handlePauseResume = () => {
    if (ritual.status === "active") {
      onPause?.(ritual.id);
    } else if (ritual.status === "paused") {
      onResume?.(ritual.id);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete?.(ritual.id);
    onClose();
  };

  const handleScheduleUpdate = (time: string, frequency: RitualFrequency) => {
    setPendingSchedule({ time, frequency });
    setShowScheduleConfirm(true);
  };

  // Extract time from schedule string (simplified - in real app, parse cron)
  const getTimeFromSchedule = () => {
    // For mock purposes, extract from nextRun or default
    if (ritual.nextRun) {
      const date = new Date(ritual.nextRun);
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }
    return "09:00";
  };

  const assignedAgent = agents.find((a) => a.id === ritual.agentId);
  const guidancePacks = useGuidancePackStore((state) => state.packs);
  const attachedPacks = React.useMemo(() => {
    if (!ritual.guidancePackIds?.length) return [];
    const byId = new Map(guidancePacks.map((pack) => [pack.id, pack]));
    return ritual.guidancePackIds
      .map((id) => byId.get(id))
      .filter((pack): pack is NonNullable<typeof pack> => Boolean(pack));
  }, [guidancePacks, ritual.guidancePackIds]);

  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      title="Ritual Details"
      width="lg"
      className={className}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl ring-2 ring-border/50",
              ritual.status === "active" ? "bg-primary/10" : "bg-secondary"
            )}>
              <RefreshCw className={cn(
                "h-8 w-8",
                ritual.status === "active" ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn(status.bgColor, status.color, "border-0 gap-1")}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3 w-3" />
                {frequencyLabels[ritual.frequency]}
              </Badge>
              {isRunning && (
                <div className="flex items-center gap-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Running
                </div>
              )}
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-1">
              {ritual.name}
            </h3>
            {ritual.description && (
              <p className="text-sm text-muted-foreground">
                {ritual.description}
              </p>
            )}
          </div>
        </div>

        {/* Schedule Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3"
        >
          {ritual.nextRun && (
            <div className="rounded-xl bg-secondary/30 p-4 border border-border/50">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Next Run</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onSkipNext?.(ritual.id)}
                  disabled={!canSkipNext}
                >
                  <SkipForward className="mr-1 h-3.5 w-3.5" />
                  Skip next
                </Button>
              </div>
              <p className="text-sm font-medium text-foreground">
                {formatDate(ritual.nextRun)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRelativeTime(ritual.nextRun)}
              </p>
            </div>
          )}
          {ritual.lastRun && (
            <div className="rounded-xl bg-secondary/30 p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Last Run</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {formatDate(ritual.lastRun)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRelativeTime(ritual.lastRun)}
              </p>
            </div>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="rounded-xl bg-secondary/30 p-4 border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Executions</span>
              <span className="text-2xl font-bold text-foreground">
                {ritual.executionCount ?? 0}
              </span>
            </div>
          </div>
          <div className="rounded-xl bg-secondary/30 p-4 border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Success Rate</span>
              <span className={cn(
                "text-2xl font-bold",
                (ritual.successRate ?? 0) >= 90 ? "text-green-500" :
                (ritual.successRate ?? 0) >= 70 ? "text-yellow-500" : "text-red-500"
              )}>
                {ritual.successRate ?? 0}%
              </span>
            </div>
          </div>
        </motion.div>

        {/* Assigned Agent */}
        {ritual.agentId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl bg-secondary/30 p-4 border border-border/50"
          >
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Assigned Agent
            </h4>
            <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 text-lg font-semibold text-foreground">
                {(assignedAgent?.name ?? ritual.agentId).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">
                  {assignedAgent?.name || `Agent #${ritual.agentId}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  Click to view agent profile
                </div>
              </div>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg bg-secondary/50 hover:bg-secondary"
              >
                <Link to={`/agents/${encodeURIComponent(ritual.agentId)}`}>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        {ritual.actions && ritual.actions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="rounded-xl bg-secondary/30 p-4 border border-border/50"
          >
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Goals
            </h4>
            <div className="flex flex-wrap gap-2">
              {ritual.actions.map((action, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {action.replace(/-/g, " ")}
                </Badge>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border/60 bg-background/40">
              <button
                type="button"
                onClick={() => setToolsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <span>Tools used in latest session</span>
                {toolsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {toolsOpen && (
                <div className="border-t border-border/60 px-3 py-2">
                  {latestExecution?.tools && latestExecution.tools.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {latestExecution.tools.map((tool, index) => (
                        <Badge key={`${tool}-${index}`} variant="outline" className="text-xs">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      No tools recorded for the latest session.
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {attachedPacks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="rounded-xl bg-secondary/30 p-4 border border-border/50"
          >
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Guidance Packs
            </h4>
            <div className="flex flex-wrap gap-2">
              {attachedPacks.map((pack) => (
                <Badge key={pack.id} variant="secondary" className="text-xs">
                  {pack.name}
                </Badge>
              ))}
            </div>
          </motion.div>
        )}

        {/* Execution History */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Recent Executions
          </h4>
          {sortedExecutions.length > 0 ? (
            <div className="space-y-2">
              {sortedExecutions.slice(0, 5).map((execution) => {
                const sessionHref = ritual.agentId && execution.sessionKey
                  ? `/agents/${encodeURIComponent(ritual.agentId)}/session/${encodeURIComponent(execution.sessionKey)}`
                  : null;
                const statusBadge = resolveExecutionBadge(execution.status);
                const StatusIcon = statusBadge.icon;
                return (
                <div
                  key={execution.id}
                  className="flex items-center gap-3 rounded-lg bg-secondary/30 p-3 border border-border/50"
                >
                  <StatusIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {execution.result || execution.error || "Completed"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(execution.startedAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px] uppercase tracking-wide", statusBadge.className)}
                      >
                        {statusBadge.label}
                      </Badge>
                      {execution.toolCalls !== undefined && (
                        <Badge variant="outline" className="text-[10px]">
                          {execution.toolCalls} tool calls
                        </Badge>
                      )}
                      <TokenCostIndicator
                        tokens={execution.tokens}
                        costUsd={execution.costUsd}
                        size="sm"
                      />
                    </div>
                  </div>
                  {sessionHref && (
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-background/50">
                      <Link to={sessionHref}>
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              );
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-secondary/20 p-4 border border-border/50 text-center">
              <p className="text-sm text-muted-foreground">
                No execution history yet
              </p>
            </div>
          )}
        </motion.div>

        {/* Schedule Editor */}
        {showScheduler && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <RitualScheduler
              initialTime={getTimeFromSchedule()}
              initialFrequency={ritual.frequency === "custom" ? "daily" : ritual.frequency}
              variant="inline"
              onSchedule={handleScheduleUpdate}
              onCancel={() => setShowScheduler(false)}
            />
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-3 pt-2"
        >
          {/* Trigger Now */}
          {onTrigger && ritual.status === "active" && (
            <Button
              onClick={() => onTrigger(ritual.id)}
              variant="outline"
              className="flex-1 h-11 rounded-xl gap-2"
            >
              <Play className="h-4 w-4" />
              Run Now
            </Button>
          )}

          {/* Pause/Resume */}
          {(onPause || onResume) && ritual.status !== "completed" && ritual.status !== "failed" && (
            <Button
              onClick={handlePauseResume}
              variant="outline"
              className={cn(
                "flex-1 h-11 rounded-xl gap-2",
                ritual.status === "active"
                  ? "text-orange-500 hover:text-orange-600"
                  : "text-green-500 hover:text-green-600"
              )}
            >
              {ritual.status === "active" ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Resume
                </>
              )}
            </Button>
          )}

          {/* Edit Schedule */}
          {onUpdateSchedule && !showScheduler && (
            <Button
              onClick={() => setShowScheduler(true)}
              variant="outline"
              className="flex-1 h-11 rounded-xl gap-2"
            >
              <Settings className="h-4 w-4" />
              Edit Schedule
            </Button>
          )}

          {/* Delete */}
          {onDelete && (
            <Button
              onClick={handleDelete}
              variant="outline"
              className="h-11 rounded-xl gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </motion.div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Ritual"
        resource={{
          title: ritual.name,
          subtitle: frequencyLabels[ritual.frequency],
        }}
        description={`Are you sure you want to delete "${ritual.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={showScheduleConfirm}
        onOpenChange={(open) => {
          setShowScheduleConfirm(open);
          if (!open) {
            setPendingSchedule(null);
          }
        }}
        title="Confirm schedule change"
        resource={{
          title: ritual.name,
          subtitle: frequencyLabels[ritual.frequency],
        }}
        description={
          pendingSchedule
            ? `Update this ritual to run ${pendingSchedule.frequency} at ${pendingSchedule.time}?`
            : "Update schedule?"
        }
        confirmLabel="Confirm"
        onConfirm={() => {
          if (pendingSchedule) {
            onUpdateSchedule?.(ritual.id, pendingSchedule);
            setShowScheduler(false);
            setPendingSchedule(null);
          }
        }}
      />
    </DetailPanel>
  );
}

export default RitualDetailPanel;
