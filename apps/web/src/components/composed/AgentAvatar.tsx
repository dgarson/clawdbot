"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AgentStatusDot, type AgentDotStatus } from "@/components/ui/AgentStatusDot";

export type AgentAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AgentAvatarStatus = "active" | "ready" | "busy" | "paused" | "offline";

/** Map legacy AgentAvatarStatus values to AgentDotStatus */
const statusToDot: Record<AgentAvatarStatus, AgentDotStatus> = {
  active: "online",
  ready: "online",
  busy: "busy",
  paused: "busy",
  offline: "offline",
};

export interface AgentAvatarProps {
  /** Agent name (used for initials and color generation) */
  name: string;
  /** Optional avatar image URL */
  avatarUrl?: string;
  /** Size variant */
  size?: AgentAvatarSize;
  /** Status indicator (legacy enum, mapped to AgentDotStatus) */
  status?: AgentAvatarStatus;
  /** Direct dot status — takes precedence over `status` */
  dotStatus?: AgentDotStatus;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the status dot */
  showStatus?: boolean;
}

const sizeClasses: Record<AgentAvatarSize, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-xl",
};

const dotSizeMap: Record<AgentAvatarSize, "sm" | "md"> = {
  xs: "sm",
  sm: "sm",
  md: "sm",
  lg: "md",
  xl: "md",
};

const borderRadii: Record<AgentAvatarSize, string> = {
  xs: "rounded-md",
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-2xl",
};

/**
 * Extract initials from a name (max 2 characters)
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Generate a deterministic color class based on the name
 */
function getColorFromName(name: string): string {
  const colors = [
    "bg-chart-1/15 text-chart-1",
    "bg-chart-2/15 text-chart-2",
    "bg-chart-3/15 text-chart-3",
    "bg-chart-4/20 text-chart-4",
    "bg-chart-5/15 text-chart-5",
    "bg-primary/15 text-primary",
    "bg-accent/15 text-accent",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const AgentAvatar = React.memo(function AgentAvatar({
  name,
  avatarUrl,
  size = "md",
  status,
  dotStatus,
  className,
  showStatus = true,
}: AgentAvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const showImage = avatarUrl && !imageError;

  // Resolve which dot status to render (direct dotStatus prop wins)
  const resolvedDotStatus: AgentDotStatus | undefined =
    dotStatus ?? (status ? statusToDot[status] : undefined);

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center font-medium overflow-hidden",
          sizeClasses[size],
          borderRadii[size],
          !showImage && getColorFromName(name)
        )}
      >
        {showImage ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          getInitials(name)
        )}
      </div>
      {showStatus && resolvedDotStatus && (
        <AgentStatusDot status={resolvedDotStatus} size={dotSizeMap[size]} />
      )}
    </div>
  );
});

export default AgentAvatar;
