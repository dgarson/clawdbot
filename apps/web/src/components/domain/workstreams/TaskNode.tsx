"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  CircleDot,
  Flag,
  Loader2,
  X,
} from "lucide-react";
import type { Task, TaskStatus, TaskPriority } from "@/hooks/queries/useWorkstreams";
import type { Agent } from "@/stores/useAgentStore";

interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  agent?: Agent | null;
  layoutDirection?: "horizontal" | "vertical";
}

type TaskFlowNode = Node<TaskNodeData, "taskNode">;

// Theme config with higher contrast backgrounds and readable text
// Labels are user-friendly for non-technical users
const statusTheme: Record<
  TaskStatus,
  { border: string; bg: string; accent: string; textColor: string; icon: React.ReactNode; label: string }
> = {
  todo: {
    border: "border-muted-foreground/60",
    bg: "bg-muted/40",
    accent: "text-muted-foreground",
    textColor: "text-foreground",
    icon: <CircleDot className="size-3" />,
    label: "Not Started",
  },
  in_progress: {
    border: "border-primary/70",
    bg: "bg-primary/30",
    accent: "text-primary",
    textColor: "text-foreground",
    icon: <Loader2 className="size-3 animate-spin" />,
    label: "Working",
  },
  review: {
    border: "border-[color:var(--warning)]/70",
    bg: "bg-[color:var(--warning)]/30",
    accent: "text-[color:var(--warning)]",
    textColor: "text-foreground",
    icon: <CircleDot className="size-3" />,
    label: "Needs Review",
  },
  done: {
    border: "border-[color:var(--success)]/70",
    bg: "bg-[color:var(--success)]/30",
    accent: "text-[color:var(--success)]",
    textColor: "text-foreground",
    icon: <Check className="size-3" />,
    label: "Completed",
  },
  blocked: {
    border: "border-destructive/70",
    bg: "bg-destructive/30",
    accent: "text-destructive",
    textColor: "text-foreground",
    icon: <X className="size-3" />,
    label: "On Hold",
  },
};

const priorityConfig: Record<
  TaskPriority,
  { color: string; bgColor: string; label: string }
> = {
  low: {
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
    label: "Low",
  },
  medium: {
    color: "text-primary",
    bgColor: "bg-primary/10",
    label: "Medium",
  },
  high: {
    color: "text-[color:var(--warning)]",
    bgColor: "bg-[color:var(--warning)]/10",
    label: "High",
  },
  urgent: {
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    label: "Urgent",
  },
};

function getAgentInitials(agent: Agent | null | undefined): string {
  if (!agent?.name) {return "?";}
  return agent.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StatusIndicator({ status, theme }: { status: TaskStatus; theme: typeof statusTheme[TaskStatus] }) {
  const base = "relative flex size-5 items-center justify-center rounded-full text-white";

  switch (status) {
    case "in_progress":
      return (
        <span className={cn(base, "bg-primary")}>
          {theme.icon}
          <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
        </span>
      );
    case "done":
      return (
        <span className={cn(base, "bg-[color:var(--success)]")}>
          {theme.icon}
        </span>
      );
    case "blocked":
      return (
        <span className={cn(base, "bg-destructive")}>
          {theme.icon}
          <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping" />
        </span>
      );
    case "review":
      return (
        <span className={cn(base, "bg-[color:var(--warning)]")}>
          {theme.icon}
          <span className="absolute inset-0 rounded-full bg-[color:var(--warning)]/40 animate-ping" />
        </span>
      );
    case "todo":
    default:
      return <span className={cn(base, "bg-muted-foreground")}>{theme.icon}</span>;
  }
}

export const TaskNode = memo(function TaskNode({
  data,
  selected,
}: NodeProps<TaskFlowNode>) {
  const { task, agent, layoutDirection = "vertical" } = data;
  const theme = statusTheme[task.status];
  const priority = priorityConfig[task.priority];

  // Handle positions based on layout direction
  const targetPosition = layoutDirection === "horizontal" ? Position.Left : Position.Top;
  const sourcePosition = layoutDirection === "horizontal" ? Position.Right : Position.Bottom;

  return (
    <>
      {/* Input handle - position changes based on layout */}
      <Handle
        type="target"
        position={targetPosition}
        className="!size-2 !border-2 !border-background !bg-muted-foreground"
      />

      {/* Node content - solid card background with status color tint */}
      <div
        className={cn(
          "relative w-[260px] overflow-hidden rounded-xl border p-4 shadow-sm transition-shadow",
          "bg-card", // Solid base background - hides grid dots completely
          theme.border,
          selected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
        )}
      >
        {/* Status color overlay - positioned behind content */}
        <div className={cn("absolute inset-0 pointer-events-none", theme.bg)} />

        {/* Header with status indicator - relative to appear above overlay */}
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <StatusIndicator status={task.status} theme={theme} />
              <div className="min-w-0">
                <div className={cn("truncate text-sm font-semibold", theme.textColor)}>{task.title}</div>
                <div className={cn("truncate text-xs font-medium", theme.accent)}>{theme.label}</div>
              </div>
            </div>
          </div>

          {/* Priority badge */}
          {task.priority !== "medium" && (
            <Badge
              variant="outline"
              className={cn(
                "h-5 shrink-0 gap-1 px-1.5 text-[10px]",
                priority.color,
                priority.bgColor
              )}
            >
              <Flag className="size-2.5" />
              {priority.label}
            </Badge>
          )}
        </div>

        {/* Description if available */}
        {task.description && (
          <p className="relative mt-3 line-clamp-2 text-xs text-foreground/80">
            {task.description}
          </p>
        )}

        {/* Tags and metadata */}
        {((task.tags && task.tags.length > 0) || agent) && (
          <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
            {task.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="h-5 px-1.5 text-[10px]">
                {tag}
              </Badge>
            ))}
            {agent && (
              <Avatar className="ml-auto size-6 border border-border">
                <AvatarImage src={agent.avatar} alt={agent.name} />
                <AvatarFallback className="text-[10px]">
                  {getAgentInitials(agent)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}

        {/* Dependencies indicator */}
        {task.dependencies && task.dependencies.length > 0 && (
          <div className="relative mt-3 border-t border-foreground/20 pt-2 text-[10px] text-foreground/60">
            {task.dependencies.length} dependenc{task.dependencies.length === 1 ? "y" : "ies"}
          </div>
        )}
      </div>

      {/* Output handle - position changes based on layout */}
      <Handle
        type="source"
        position={sourcePosition}
        className="!size-2 !border-2 !border-background !bg-muted-foreground"
      />
    </>
  );
});

export default TaskNode;
