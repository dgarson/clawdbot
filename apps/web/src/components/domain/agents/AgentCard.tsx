"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Settings, Play, Pause, History, PlusCircle } from "lucide-react";

export type AgentStatus = "online" | "offline" | "busy" | "paused";

export interface Agent {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  status: AgentStatus;
  description?: string;
  tags?: string[];
  taskCount?: number;
  lastActive?: string;
}

interface AgentCardProps {
  agent: Agent;
  variant?: "expanded" | "compact";
  onChat?: () => void;
  onSettings?: () => void;
  onToggle?: () => void;
  onViewSession?: () => void;
  onNewSession?: () => void;
  onCardClick?: () => void;
  className?: string;
}

const statusConfig: Record<AgentStatus, { color: string; label: string; animate: boolean }> = {
  online: { color: "bg-green-500", label: "Online", animate: true },
  offline: { color: "bg-gray-400", label: "Offline", animate: false },
  busy: { color: "bg-yellow-500", label: "Working", animate: true },
  paused: { color: "bg-orange-500", label: "Paused", animate: false },
};

export function AgentCard({
  agent,
  variant = "expanded",
  onChat,
  onSettings,
  onToggle,
  onViewSession,
  onNewSession,
  onCardClick,
  className,
}: AgentCardProps) {
  const status = statusConfig[agent.status];

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        whileHover={{ scale: 1.02 }}
        className={cn("group", onCardClick && "cursor-pointer", className)}
        onClick={onCardClick}
      >
        <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
          <CardContent className="flex items-center gap-4 p-4">
            {/* Avatar */}
            <div className="relative h-10 w-10 shrink-0">
              <div className="h-full w-full overflow-hidden rounded-full bg-secondary ring-2 ring-border/50">
                {agent.avatar ? (
                  <img
                    src={agent.avatar}
                    alt={agent.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                    {agent.name.charAt(0)}
                  </div>
                )}
              </div>
              {/* Status dot */}
              <div className="absolute -bottom-0.5 -right-0.5">
                <div className="relative flex h-4 w-4 items-center justify-center">
                  <span className={cn(
                    "h-3 w-3 rounded-full shadow-lg border-2 border-card",
                    status.color,
                    status.animate && "shadow-[0_0_8px_1px]",
                    status.color === "bg-green-500" && status.animate && "shadow-green-500/60",
                    status.color === "bg-yellow-500" && status.animate && "shadow-yellow-500/60",
                    status.color === "bg-orange-500" && status.animate && "shadow-orange-500/60"
                  )} />
                  {status.animate && (
                    <span className={cn("absolute h-3 w-3 rounded-full animate-ping opacity-60", status.color)} />
                  )}
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="truncate text-sm font-medium text-foreground">{agent.name}</h4>
              <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
            </div>

            {/* Quick action */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChat?.();
              }}
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("group relative", onCardClick && "cursor-pointer", className)}
      onClick={onCardClick}
    >
      <Card className="relative overflow-hidden rounded-2xl border-border/50 bg-gradient-to-br from-card via-card to-card/80 backdrop-blur-sm transition-all duration-500 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
        {/* Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-accent to-primary opacity-60" />

        {/* Glow effect on hover */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <CardContent className="relative p-6">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-5 w-5 items-center justify-center">
                <span className={cn(
                  "h-3.5 w-3.5 rounded-full shadow-lg",
                  status.color,
                  status.animate && "shadow-[0_0_12px_2px]",
                  status.color === "bg-green-500" && status.animate && "shadow-green-500/60",
                  status.color === "bg-yellow-500" && status.animate && "shadow-yellow-500/60",
                  status.color === "bg-orange-500" && status.animate && "shadow-orange-500/60"
                )} />
                {status.animate && (
                  <span className={cn(
                    "absolute h-3.5 w-3.5 rounded-full animate-ping",
                    status.color,
                    "opacity-60"
                  )} />
                )}
              </div>
              <span className="text-sm font-medium text-foreground">{status.label}</span>
            </div>
            {agent.taskCount !== undefined && agent.taskCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {agent.taskCount} task{agent.taskCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {/* Avatar and info */}
          <div className="mb-5 flex items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-60" />
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-secondary ring-2 ring-border/50 shadow-lg transition-all duration-300 group-hover:ring-primary/30">
                {agent.avatar ? (
                  <img
                    src={agent.avatar}
                    alt={agent.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                    {agent.name.charAt(0)}
                  </div>
                )}
              </div>
            </motion.div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xl font-semibold tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary">
                {agent.name}
              </h3>
              <p className="text-sm text-muted-foreground">{agent.role}</p>
            </div>
          </div>

          {/* Description */}
          {agent.description && (
            <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
              {agent.description}
            </p>
          )}

          {/* Tags */}
          {agent.tags && agent.tags.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {agent.tags.map((tag, index) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-full bg-secondary/80 px-3 py-1 text-xs font-medium text-secondary-foreground border border-border/50 transition-all duration-200 hover:bg-secondary hover:border-primary/30"
                >
                  {tag}
                </motion.span>
              ))}
            </div>
          )}

          {/* Session Actions */}
          <div className="flex gap-2 mb-3">
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onViewSession?.();
              }}
              className="flex-1 h-10 rounded-xl bg-secondary/50 hover:bg-secondary transition-all"
              variant="ghost"
            >
              <History className="mr-2 h-4 w-4" />
              View Session
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNewSession?.();
              }}
              className="flex-1 h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all"
              variant="ghost"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </div>

          {/* Other Actions */}
          <div className="flex gap-2">
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChat?.();
              }}
              className="flex-1 h-11 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all"
              variant="ghost"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Chat
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggle?.();
              }}
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-xl bg-secondary/50 hover:bg-secondary transition-all"
            >
              {agent.status === "paused" ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSettings?.();
              }}
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-xl bg-secondary/50 hover:bg-secondary transition-all"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {/* Last active */}
          {agent.lastActive && (
            <p className="mt-4 text-center text-xs text-muted-foreground/70">
              Last active {agent.lastActive}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default AgentCard;
