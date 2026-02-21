"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type AgentDotStatus = "online" | "busy" | "offline" | "error";
export type AgentDotSize = "sm" | "md";

export interface AgentStatusDotProps {
  /** Current agent status */
  status: AgentDotStatus;
  /** Size variant */
  size?: AgentDotSize;
  /** Additional CSS classes for the outer wrapper */
  className?: string;
}

const dotSizes: Record<AgentDotSize, string> = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
};

const ringSizes: Record<AgentDotSize, string> = {
  sm: "ring-[1.5px]",
  md: "ring-2",
};

const statusColors: Record<AgentDotStatus, string> = {
  online: "bg-green-500",
  busy: "bg-amber-500",
  offline: "bg-gray-400 dark:bg-gray-500",
  error: "bg-red-500",
};

const glowColors: Record<AgentDotStatus, string> = {
  online: "shadow-green-500/60",
  busy: "shadow-amber-500/60",
  offline: "",
  error: "shadow-red-500/60",
};

const statusLabels: Record<AgentDotStatus, string> = {
  online: "Online",
  busy: "Busy",
  offline: "Offline",
  error: "Error",
};

/** Pulse keyframes for framer-motion */
const pulseVariants = {
  online: {
    scale: [1, 1.8, 1],
    opacity: [0.7, 0, 0.7],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
  busy: {
    scale: [1, 2, 1],
    opacity: [0.7, 0, 0.7],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

/**
 * Status indicator dot for agent avatars.
 *
 * Designed to be placed in the bottom-right corner of an avatar
 * via absolute positioning on a `relative` parent.
 *
 * - **Online**: green, slow pulse
 * - **Busy**: amber, fast pulse
 * - **Offline**: gray, no animation
 * - **Error**: red, no pulse (static attention)
 */
export const AgentStatusDot = React.memo(function AgentStatusDot({
  status,
  size = "sm",
  className,
}: AgentStatusDotProps) {
  const shouldPulse = status === "online" || status === "busy";
  const dotSize = dotSizes[size];
  const ringSize = ringSizes[size];
  const color = statusColors[status];
  const glow = glowColors[status];
  const label = statusLabels[status];

  return (
    <span
      className={cn(
        "absolute -bottom-0.5 -right-0.5 flex items-center justify-center",
        className,
      )}
      aria-label={`Agent status: ${label}`}
      role="status"
    >
      {/* Pulse ring (only for online/busy) */}
      {shouldPulse && (
        <motion.span
          className={cn("absolute rounded-full", dotSize, color)}
          animate={pulseVariants[status]}
          aria-hidden
        />
      )}

      {/* Solid dot */}
      <span
        className={cn(
          "relative rounded-full ring-background",
          dotSize,
          ringSize,
          color,
          glow && `shadow-[0_0_6px_1px] ${glow}`,
        )}
      />
    </span>
  );
});

export default AgentStatusDot;
