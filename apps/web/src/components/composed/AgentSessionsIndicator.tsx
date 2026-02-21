"use client";

import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, AlertCircle, Check, Info, X } from "lucide-react";
import { useAgents } from "@/hooks/queries/useAgents";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AgentStatusDot } from "@/components/ui/AgentStatusDot";
import { deriveAgentDotStatus } from "@/hooks/useAgentStatus";
import { cn } from "@/lib/utils";
import { useAgentApprovalActions } from "@/hooks/useAgentApprovalActions";

export interface AgentSessionsIndicatorProps {
  /** Whether the sidebar is collapsed */
  collapsed?: boolean;
  /** Additional className */
  className?: string;
}

export function AgentSessionsIndicator({
  collapsed = false,
  className,
}: AgentSessionsIndicatorProps) {
  const { data: agents, isLoading } = useAgents();
  const [waitingOpen, setWaitingOpen] = React.useState(false);
  const { approvePending, denyPending } = useAgentApprovalActions();
  const navigate = useNavigate();

  const formatCollapsedCount = React.useCallback((count: number) => {
    return String(Math.min(count, 99));
  }, []);

  // Calculate stats from agents
  const stats = React.useMemo(() => {
    if (!agents) {return { active: 0, waiting: 0 };}
    return {
      // "busy" = actively working
      active: agents.filter((a) => a.status === "busy").length,
      // "paused" = waiting for user input/approval (treating paused as waiting)
      waiting: agents.filter((a) => a.status === "paused").length,
    };
  }, [agents]);

  const waitingAgents = React.useMemo(() => {
    if (!agents) {return [];}
    return agents.filter((agent) => agent.status === "paused");
  }, [agents]);

  // Don't render if loading or no agents
  if (isLoading || !agents || agents.length === 0) {
    return null;
  }

  // Only show if there are active or waiting sessions
  if (stats.active === 0 && stats.waiting === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      {/* Active sessions */}
      {stats.active > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/agents"
              search={{ status: "busy" }}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                collapsed && "px-2 gap-2"
              )}
              aria-label={
                collapsed
                  ? `${stats.active} agent${stats.active !== 1 ? "s" : ""} active`
                  : undefined
              }
            >
              <span className="relative flex size-5 shrink-0 items-center justify-center">
                <Bot className="size-5 text-emerald-500" />
              </span>
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    <span className="text-emerald-500 font-semibold">{stats.active}</span>
                    <span className="text-muted-foreground"> active</span>
                  </motion.span>
                )}
              </AnimatePresence>
              {collapsed && (
                <span className="flex items-center justify-center min-w-[20px] h-5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 text-[11px] font-semibold text-emerald-500">
                  {formatCollapsedCount(stats.active)}
                </span>
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <div className="font-medium">
              {stats.active} agent{stats.active !== 1 ? "s" : ""} actively working
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Waiting/blocked sessions */}
      {stats.waiting > 0 && (
        <Popover open={waitingOpen} onOpenChange={setWaitingOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    collapsed && "px-2 gap-2"
                  )}
                  aria-label="View waiting agents"
                >
                  <span className="relative flex size-5 shrink-0 items-center justify-center">
                    <AlertCircle className="size-5 text-amber-500" />
                  </span>
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        <span className="text-amber-500 font-semibold">{stats.waiting}</span>
                        <span className="text-muted-foreground"> waiting</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {collapsed && (
                    <span className="flex items-center justify-center min-w-[20px] h-5 rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 text-[11px] font-semibold text-amber-500">
                      {formatCollapsedCount(stats.waiting)}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <div className="font-medium">
                {stats.waiting} agent{stats.waiting !== 1 ? "s" : ""} waiting for your input
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Click to view and respond
              </div>
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            align="end"
            side="right"
            sideOffset={12}
            className="w-96 p-0"
          >
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Waiting for approval</div>
                <Link
                  to="/agents"
                  search={{ status: "waiting" }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setWaitingOpen(false)}
                >
                  View all
                </Link>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.waiting} agent{stats.waiting !== 1 ? "s" : ""} need your decision
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {waitingAgents.map((agent) => {
                const approvals = agent.pendingApprovals ?? 0;
                const taskLabel = agent.currentTask ?? "Waiting for your input";
                return (
                  <Link
                    key={agent.id}
                    to="/agents/$agentId"
                    params={{ agentId: agent.id }}
                    search={{ tab: "activity" }}
                    className="block"
                    onClick={() => setWaitingOpen(false)}
                  >
                    <div className="group flex items-center gap-3 border-b border-border/60 px-4 py-3 transition-colors hover:bg-foreground/5 focus-within:bg-foreground/5">
                      <div className="relative h-9 w-9 shrink-0">
                        <div className="h-full w-full overflow-hidden rounded-full bg-secondary ring-1 ring-border/60">
                          {agent.avatar ? (
                            <img
                              src={agent.avatar}
                              alt={agent.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                              {agent.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <AgentStatusDot status={deriveAgentDotStatus(agent)} size="sm" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {agent.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {taskLabel}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-600">
                          {approvals} approval{approvals !== 1 ? "s" : ""}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-foreground hover:bg-muted/40"
                            aria-label={`More info for ${agent.name}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              navigate({
                                to: "/agents/$agentId",
                                params: { agentId: agent.id },
                                search: { tab: "activity" },
                              });
                              setWaitingOpen(false);
                            }}
                          >
                            <Info className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 focus-visible:ring-emerald-500/30"
                            aria-label={`Approve ${agent.name}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void approvePending(agent.id);
                            }}
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 focus-visible:ring-rose-500/30"
                            aria-label={`Deny ${agent.name}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void denyPending(agent.id);
                            }}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default AgentSessionsIndicator;
