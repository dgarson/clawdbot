"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProgressRing } from "./ProgressRing";
import type { WorkflowVizNode } from "./types";
import { Check, ChevronDown, CircleDot, Eye, Loader2, MonitorCog, X } from "lucide-react";

export type WorkflowFlowNode = Node<WorkflowVizNode, "workflowNode">;

const typeTheme: Record<
  WorkflowVizNode["type"],
  { border: string; bg: string; accent: string }
> = {
  start: { border: "border-[color:var(--success)]/50", bg: "bg-[color:var(--success)]/20", accent: "text-[color:var(--success)]" },
  complete: { border: "border-primary/50", bg: "bg-primary/20", accent: "text-primary" },
  result: { border: "border-primary/50", bg: "bg-primary/20", accent: "text-primary" },
  worker: { border: "border-accent/50", bg: "bg-accent/20", accent: "text-accent" },
  router: { border: "border-[color:var(--warning)]/50", bg: "bg-[color:var(--warning)]/20", accent: "text-[color:var(--warning)]" },
  orchestrator: { border: "border-accent/50", bg: "bg-accent/20", accent: "text-accent" },
  quality_check: { border: "border-[color:var(--warning)]/50", bg: "bg-[color:var(--warning)]/20", accent: "text-[color:var(--warning)]" },
  agent: { border: "border-accent/50", bg: "bg-accent/20", accent: "text-accent" },
  process: { border: "border-border", bg: "bg-card", accent: "text-muted-foreground" },
};

function StatusIndicator({ status }: { status: WorkflowVizNode["status"] }) {
  const base = "relative flex size-5 items-center justify-center rounded-full text-white";
  switch (status) {
    case "running":
      return (
        <span className={cn(base, "bg-primary")}>
          <Loader2 className="size-3 animate-spin" />
          <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
        </span>
      );
    case "success":
      return (
        <span className={cn(base, "bg-[color:var(--success)]")}>
          <Check className="size-3" />
        </span>
      );
    case "error":
      return (
        <span className={cn(base, "bg-destructive")}>
          <X className="size-3" />
          <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping" />
        </span>
      );
    case "waiting":
      return (
        <span className={cn(base, "bg-[color:var(--warning)]")}>
          <CircleDot className="size-3" />
          <span className="absolute inset-0 rounded-full bg-[color:var(--warning)]/40 animate-ping" />
        </span>
      );
    case "skipped":
      return <span className={cn(base, "bg-muted-foreground")} />;
    case "idle":
    default:
      return <span className={cn(base, "bg-muted-foreground")} />;
  }
}

export interface WorkflowNodeCallbacks {
  onViewDetails?: (nodeId: string) => void;
  onStepInto?: (nodeId: string) => void;
}

export function WorkflowNode({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const theme = typeTheme[data.type] ?? typeTheme.process;
  const progress = typeof data.progress === "number" ? data.progress : null;

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onViewDetails?.(data.id);
  };

  const handleStepInto = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onStepInto?.(data.id);
  };

  return (
    <>
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-background !bg-muted-foreground" />
      <div
        className={cn(
          "w-[260px] rounded-xl border p-4 shadow-sm transition-shadow",
          theme.border,
          theme.bg,
          selected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <StatusIndicator status={data.status} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{data.title}</div>
                {data.subtitle ? (
                  <div className="truncate text-xs text-muted-foreground">{data.subtitle}</div>
                ) : null}
              </div>
            </div>
          </div>

          {progress != null ? (
            <div className={cn("shrink-0", theme.accent)}>
              <ProgressRing progress={progress} size={34} />
            </div>
          ) : null}
        </div>

        {data.description ? (
          <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
            {data.description}
          </p>
        ) : null}

        {data.metadata && Object.keys(data.metadata).length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(data.metadata)
              .slice(0, 3)
              .map(([k, v]) => (
                <Badge key={k} variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {k}: {String(v)}
                </Badge>
              ))}
          </div>
        ) : null}

        {/* Split Button / Multi-Action */}
        <div className="mt-3 flex justify-end">
          <div className="inline-flex rounded-md shadow-sm">
            <Button
              variant="secondary"
              size="xs"
              className="rounded-r-none border-r-0"
              onClick={handleViewDetails}
            >
              <Eye className="size-3" />
              Details
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="xs"
                  className="rounded-l-none px-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleViewDetails}>
                  <Eye className="size-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleStepInto}>
                  <MonitorCog className="size-4" />
                  Step Into (Command & Control)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!size-2 !border-2 !border-background !bg-muted-foreground" />
    </>
  );
}
