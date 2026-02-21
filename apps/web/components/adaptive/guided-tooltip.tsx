"use client";
import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProficiency } from "@/lib/stores/proficiency";
import { HelpCircle } from "lucide-react";

interface GuidedTooltipProps {
  content: string;
  /** Only show for proficiency levels at or below this */
  maxLevel?: "beginner" | "standard" | "expert";
  children: React.ReactNode;
  showIcon?: boolean;
}

export function GuidedTooltip({
  content,
  maxLevel = "standard",
  children,
  showIcon = true,
}: GuidedTooltipProps) {
  const { isAtLeast } = useProficiency();
  const levelOrder = ["beginner", "standard", "expert"] as const;
  const maxIdx = levelOrder.indexOf(maxLevel);
  const shouldShow = !isAtLeast(levelOrder[maxIdx + 1] ?? "expert");

  if (!shouldShow) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1">
          {children}
          {showIcon && (
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}
