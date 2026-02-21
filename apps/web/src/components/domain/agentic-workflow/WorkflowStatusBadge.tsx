"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Clock,
  Pause,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { WorkflowStatus } from "./types";

const statusConfig: Record<
  WorkflowStatus,
  { label: string; dot: string; icon: React.ElementType; pulse?: boolean }
> = {
  idle: { label: "Ready", dot: "bg-muted-foreground", icon: CircleDot },
  thinking: { label: "Thinking…", dot: "bg-[color:var(--warning)]", icon: Sparkles, pulse: true },
  executing: { label: "Executing…", dot: "bg-primary", icon: Loader2, pulse: true },
  waiting_approval: { label: "Awaiting approval", dot: "bg-[color:var(--warning)]", icon: Clock },
  waiting_input: { label: "Input required", dot: "bg-accent", icon: Clock },
  paused: { label: "Paused", dot: "bg-[color:var(--warning)]", icon: Pause },
  complete: { label: "Complete", dot: "bg-[color:var(--success)]", icon: CheckCircle2 },
  error: { label: "Error", dot: "bg-destructive", icon: AlertCircle, pulse: true },
};

export function WorkflowStatusBadge({
  status,
  label,
  className,
}: {
  status: WorkflowStatus;
  label?: string;
  className?: string;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5",
        className
      )}
    >
      <span className="relative flex items-center justify-center">
        <span className={cn("size-2 rounded-full", config.dot)} />
        {config.pulse ? (
          <span className={cn("absolute size-2 rounded-full opacity-40 animate-ping", config.dot)} />
        ) : null}
      </span>
      <Icon
        className={cn(
          "size-3.5 text-muted-foreground",
          status === "executing" && "animate-spin"
        )}
      />
      <span className="text-xs font-medium text-foreground/90">
        {label ?? config.label}
      </span>
    </div>
  );
}

