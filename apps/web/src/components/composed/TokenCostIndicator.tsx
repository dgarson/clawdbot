"use client";

import { cn } from "@/lib/utils";
import { Coins, Hash, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TokenCostIndicatorProps {
  tokens?: number;
  costUsd?: number;
  onRequestUpdate?: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function TokenCostIndicator({
  tokens,
  costUsd,
  onRequestUpdate,
  size = "sm",
  className,
}: TokenCostIndicatorProps) {
  const hasTokens = tokens !== undefined;
  const hasCost = costUsd !== undefined;

  if (!hasTokens && !hasCost) {return null;}

  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className={cn("flex items-center gap-2 rounded-full border border-border/60 bg-secondary/30 px-3 py-1", className)}>
      {hasTokens && (
        <div className={cn("flex items-center gap-1 text-muted-foreground", textSize)}>
          <Hash className={iconSize} />
          <span className="font-medium text-foreground">
            {new Intl.NumberFormat("en-US").format(tokens ?? 0)}
          </span>
          <span>tokens</span>
        </div>
      )}
      {hasTokens && hasCost && <span className="text-muted-foreground">•</span>}
      {hasCost && (
        <div className={cn("flex items-center gap-1 text-muted-foreground", textSize)}>
          <Coins className={iconSize} />
          <span className="font-medium text-foreground">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            }).format(costUsd ?? 0)}
          </span>
        </div>
      )}
      {onRequestUpdate && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-6 w-6 rounded-full text-muted-foreground hover:text-foreground", size === "md" && "h-7 w-7")}
          onClick={onRequestUpdate}
        >
          <RotateCw className={cn(iconSize, "h-3.5 w-3.5")} />
        </Button>
      )}
    </div>
  );
}

export default TokenCostIndicator;
