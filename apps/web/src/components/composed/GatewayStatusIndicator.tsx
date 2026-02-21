"use client";

import * as React from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useGatewayConnected } from "@/hooks/queries/useGateway";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { showInfo, showWarning } from "@/lib/toast";

export interface GatewayStatusIndicatorProps {
  /** Whether the sidebar is collapsed */
  collapsed?: boolean;
  /** Additional className */
  className?: string;
}

type ConnectionStatus = "connected" | "disconnected" | "connecting";

const statusConfig: Record<
  ConnectionStatus,
  { color: string; label: string; description: string }
> = {
  connected: {
    color: "bg-green-500",
    label: "Connected",
    description: "Gateway is connected and running",
  },
  disconnected: {
    color: "bg-red-500",
    label: "Disconnected",
    description: "Gateway is not reachable",
  },
  connecting: {
    color: "bg-yellow-500",
    label: "Connecting",
    description: "Attempting to connect to gateway...",
  },
};

export function GatewayStatusIndicator({
  collapsed = false,
  className,
}: GatewayStatusIndicatorProps) {
  const { isConnected, isLoading, version, uptime } = useGatewayConnected();
  const previousStatusRef = React.useRef<ConnectionStatus | null>(null);

  // Determine current connection status
  const status: ConnectionStatus = isLoading
    ? "connecting"
    : isConnected
      ? "connected"
      : "disconnected";

  const config = statusConfig[status];

  // Show toast on status transitions (after initial load)
  React.useEffect(() => {
    const previousStatus = previousStatusRef.current;

    // Skip initial mount and loading states
    if (previousStatus === null || isLoading) {
      previousStatusRef.current = status;
      return;
    }

    // Only notify on actual transitions
    if (previousStatus !== status) {
      if (status === "connected" && previousStatus === "disconnected") {
        showInfo("Gateway connected", {
          description: version ? `Version ${version}` : undefined,
          duration: 3000,
        });
      } else if (status === "disconnected" && previousStatus === "connected") {
        showWarning("Gateway disconnected", {
          description: "Check your gateway status",
          duration: 5000,
        });
      }
      previousStatusRef.current = status;
    }
  }, [status, isLoading, version]);

  // Build detailed tooltip content
  const tooltipContent = React.useMemo(() => {
    const lines = [config.description];
    if (version) {
      lines.push(`Version: ${version}`);
    }
    if (uptime !== undefined) {
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      lines.push(`Uptime: ${hours}h ${minutes}m`);
    }
    return lines;
  }, [config.description, version, uptime]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/settings"
          search={{ section: "gateway" }}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            collapsed && "justify-center px-2",
            className
          )}
        >
          {/* Status dot - sized to align with NavItem icons (size-5 = 20px) */}
          <span className="relative flex size-5 shrink-0 items-center justify-center">
            {status === "connecting" ? (
              <Loader2 className="size-4 animate-spin text-yellow-500" />
            ) : (
              <>
                <span className={cn(
                  "size-3 rounded-full shadow-lg",
                  config.color,
                  status === "connected" && "shadow-[0_0_8px_2px] shadow-green-500/50",
                  status === "disconnected" && "shadow-[0_0_8px_2px] shadow-red-500/50"
                )} />
                {status === "connected" && (
                  <span
                    className={cn(
                      "absolute size-3 rounded-full opacity-50 animate-ping",
                      config.color
                    )}
                  />
                )}
              </>
            )}
          </span>

          {/* Label (hidden when collapsed) */}
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                {config.label}
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <div className="space-y-0.5">
          {tooltipContent.map((line, i) => (
            <div key={i} className={i === 0 ? "font-medium" : "text-muted"}>
              {line}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default GatewayStatusIndicator;
