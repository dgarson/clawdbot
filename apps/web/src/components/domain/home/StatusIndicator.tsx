"use client";

import { Wifi, WifiOff, Lock, Unlock, ShieldAlert } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useGatewayConnected } from "@/hooks/queries";
import { useSecurity } from "@/features/security/SecurityProvider";
import { useAgentStore } from "@/stores/useAgentStore";
import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  className?: string;
}

/**
 * Small inline status dots showing gateway connection, unlock state,
 * and pending approvals count. Placed in the home page header strip.
 */
export function StatusIndicator({ className }: StatusIndicatorProps) {
  const { isConnected: isGatewayConnected } = useGatewayConnected();
  const { state } = useSecurity();
  const agents = useAgentStore((s) => s.agents);

  const totalPending = agents.reduce(
    (sum, a) => sum + (a.pendingApprovals ?? 0),
    0
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Gateway */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {isGatewayConnected ? (
              <Wifi className="size-3.5 text-green-500" />
            ) : (
              <WifiOff className="size-3.5 text-destructive" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isGatewayConnected ? "Gateway connected" : "Gateway disconnected"}
        </TooltipContent>
      </Tooltip>

      {/* Unlock state */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {state.isUnlocked ? (
              <Unlock className="size-3.5 text-green-500" />
            ) : (
              <Lock className="size-3.5 text-muted-foreground" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {state.isUnlocked ? "Console unlocked" : "Console locked"}
        </TooltipContent>
      </Tooltip>

      {/* Pending approvals */}
      {totalPending > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs">
              <ShieldAlert className="size-3.5 text-warning" />
              <span className="font-medium text-warning">{totalPending}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {totalPending} pending approval{totalPending !== 1 ? "s" : ""}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
