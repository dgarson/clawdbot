"use client";

import { cn } from "@/lib/utils";

interface SkeletonBaseProps {
  className?: string;
}

// Base skeleton component with shimmer effect
function SkeletonBase({ className }: SkeletonBaseProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted/50",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-muted/30 before:to-transparent",
        className
      )}
    />
  );
}

// Card skeleton - matches Card component layout
export function CardSkeleton({ className }: SkeletonBaseProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/80 p-6",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <SkeletonBase className="h-4 w-24" />
        <SkeletonBase className="h-6 w-16 rounded-full" />
      </div>

      {/* Avatar and title */}
      <div className="flex items-center gap-4 mb-5">
        <SkeletonBase className="h-12 w-12 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBase className="h-5 w-32" />
          <SkeletonBase className="h-3 w-20" />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2 mb-5">
        <SkeletonBase className="h-3 w-full" />
        <SkeletonBase className="h-3 w-3/4" />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <SkeletonBase className="h-11 flex-1 rounded-xl" />
        <SkeletonBase className="h-11 w-11 rounded-xl" />
        <SkeletonBase className="h-11 w-11 rounded-xl" />
      </div>
    </div>
  );
}

// List item skeleton - for list rows
export function ListItemSkeleton({ className }: SkeletonBaseProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border border-border/50 bg-card/80 p-4",
        className
      )}
    >
      <SkeletonBase className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonBase className="h-4 w-32" />
        <SkeletonBase className="h-3 w-48" />
      </div>
      <SkeletonBase className="h-8 w-8 shrink-0 rounded-lg" />
    </div>
  );
}

// Avatar skeleton with size variants
interface AvatarSkeletonProps extends SkeletonBaseProps {
  size?: "sm" | "md" | "lg";
}

const avatarSizes = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

export function AvatarSkeleton({ size = "md", className }: AvatarSkeletonProps) {
  return (
    <SkeletonBase
      className={cn("shrink-0 rounded-full", avatarSizes[size], className)}
    />
  );
}

// Text skeleton with configurable line count
interface TextSkeletonProps extends SkeletonBaseProps {
  lines?: number;
}

export function TextSkeleton({ lines = 3, className }: TextSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBase
          key={index}
          className={cn(
            "h-3",
            // Last line is shorter for natural look
            index === lines - 1 ? "w-2/3" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

// Metric card skeleton
export function MetricCardSkeleton({ className }: SkeletonBaseProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/80 p-6",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <SkeletonBase className="h-3 w-20" />
          <SkeletonBase className="h-8 w-24" />
        </div>
        <SkeletonBase className="h-10 w-10 rounded-xl" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <SkeletonBase className="h-5 w-16 rounded-full" />
        <SkeletonBase className="h-3 w-20" />
      </div>
    </div>
  );
}

// Chat message skeleton
export function ChatMessageSkeleton({ className }: SkeletonBaseProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <SkeletonBase className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <SkeletonBase className="h-3 w-20" />
          <SkeletonBase className="h-2 w-12" />
        </div>
        <SkeletonBase className="h-16 w-full max-w-md rounded-xl" />
      </div>
    </div>
  );
}

// Add shimmer animation to global styles via tailwind config or inline
// This is a fallback definition if not in tailwind config
const shimmerKeyframes = `
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
`;

// Inject keyframes if not already defined
if (typeof document !== "undefined") {
  const styleId = "skeleton-shimmer-keyframes";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = shimmerKeyframes;
    document.head.appendChild(style);
  }
}

export default {
  CardSkeleton,
  ListItemSkeleton,
  AvatarSkeleton,
  TextSkeleton,
  MetricCardSkeleton,
  ChatMessageSkeleton,
};
