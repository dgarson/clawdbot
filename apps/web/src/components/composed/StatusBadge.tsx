"use client";

import { cn } from "@/lib/utils";

export type StatusType =
  | "online"
  | "offline"
  | "busy"
  | "paused"
  | "error"
  | "success"
  | "warning"
  | "pending";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md";
  showDot?: boolean;
  animate?: boolean;
  className?: string;
}

const statusConfig: Record<
  StatusType,
  { color: string; defaultLabel: string }
> = {
  online: { color: "bg-green-500", defaultLabel: "Online" },
  offline: { color: "bg-gray-400", defaultLabel: "Offline" },
  busy: { color: "bg-yellow-500", defaultLabel: "Busy" },
  paused: { color: "bg-orange-500", defaultLabel: "Paused" },
  error: { color: "bg-red-500", defaultLabel: "Error" },
  success: { color: "bg-green-500", defaultLabel: "Success" },
  warning: { color: "bg-amber-500", defaultLabel: "Warning" },
  pending: { color: "bg-gray-400", defaultLabel: "Pending" },
};

const sizeConfig = {
  sm: {
    badge: "px-2 py-0.5 text-xs gap-1.5",
    dot: "h-1.5 w-1.5",
  },
  md: {
    badge: "px-2.5 py-1 text-sm gap-2",
    dot: "h-2 w-2",
  },
};

export function StatusBadge({
  status,
  label,
  size = "sm",
  showDot = true,
  animate = false,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const displayLabel = label ?? config.defaultLabel;

  // Only animate for certain statuses by default
  const shouldAnimate =
    animate || (status === "online" || status === "busy" || status === "pending");

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border/50 bg-secondary/50 font-medium text-foreground",
        sizes.badge,
        className
      )}
    >
      {showDot && (
        <span className="relative flex items-center justify-center">
          <span className={cn("rounded-full", config.color, sizes.dot)} />
          {shouldAnimate && (
            <span
              className={cn(
                "absolute rounded-full opacity-40 animate-ping",
                config.color,
                sizes.dot
              )}
            />
          )}
        </span>
      )}
      <span>{displayLabel}</span>
    </div>
  );
}

export default StatusBadge;
