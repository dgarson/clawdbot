"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Wifi,
  WifiOff,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import * as Collapsible from "@radix-ui/react-collapsible";

export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

interface ConnectionStepProps {
  status: ConnectionStatus;
  gatewayUrl: string;
  onUrlChange?: (url: string) => void;
  onRetry?: () => void;
  errorMessage?: string;
  className?: string;
}

const TROUBLESHOOT_ITEMS = [
  {
    title: "Wrong URL or port",
    description:
      "The default Gateway URL is ws://127.0.0.1:18789. Double-check the address and port number.",
  },
  {
    title: "Gateway not running",
    description:
      "Start the Gateway with `clawdbrain gateway run` or launch the Clawdbrain desktop app.",
  },
  {
    title: "Authentication required",
    description:
      "If the Gateway requires a password or token, you will be prompted after connecting.",
  },
  {
    title: "Network or firewall issues",
    description:
      "Ensure your browser can reach the Gateway host. Check for VPN, proxy, or firewall blocks.",
  },
] as const;

/**
 * Gateway connection step for the Console Access flow.
 * Shows connection status, editable URL, and troubleshooting help.
 */
export function ConnectionStep({
  status,
  gatewayUrl,
  onUrlChange,
  onRetry,
  errorMessage,
  className,
}: ConnectionStepProps) {
  const [showHelp, setShowHelp] = React.useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = React.useState(false);

  const StatusIcon = {
    connected: CheckCircle2,
    connecting: Loader2,
    disconnected: WifiOff,
    error: AlertCircle,
  }[status];

  const statusLabel = {
    connected: "Connected",
    connecting: "Connecting...",
    disconnected: "Not connected",
    error: "Connection failed",
  }[status];

  const statusColor = {
    connected: "text-green-500",
    connecting: "text-yellow-500 animate-spin",
    disconnected: "text-muted-foreground",
    error: "text-destructive",
  }[status];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Status indicator */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            status === "connected" ? "bg-green-500/10" : "bg-muted"
          )}
        >
          <StatusIcon className={cn("size-4", statusColor)} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{statusLabel}</p>
          {errorMessage && (
            <p className="text-xs text-destructive mt-0.5">{errorMessage}</p>
          )}
        </div>
        {(status === "disconnected" || status === "error") && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <Wifi className="size-3.5" />
            Retry
          </Button>
        )}
      </div>

      {/* Gateway URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Gateway URL
        </label>
        <Input
          value={gatewayUrl}
          onChange={(e) => onUrlChange?.(e.target.value)}
          placeholder="ws://127.0.0.1:18789"
          className="font-mono text-sm"
        />
      </div>

      {/* How to start help */}
      <Collapsible.Root open={showHelp} onOpenChange={setShowHelp}>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <HelpCircle className="size-3.5" />
            <span>How to start the Gateway</span>
            <ChevronDown
              className={cn(
                "size-3 ml-auto transition-transform",
                showHelp && "rotate-180"
              )}
            />
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div className="mt-3 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground space-y-2">
            <p>Run this command in your terminal:</p>
            <code className="block rounded bg-background px-3 py-2 font-mono text-xs text-foreground">
              clawdbrain gateway run
            </code>
            <p>
              Or launch the Clawdbrain desktop app -- the Gateway starts
              automatically.
            </p>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {/* Troubleshoot drawer */}
      <Collapsible.Root open={showTroubleshoot} onOpenChange={setShowTroubleshoot}>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <AlertCircle className="size-3.5" />
            <span>Troubleshoot connection issues</span>
            <ChevronDown
              className={cn(
                "size-3 ml-auto transition-transform",
                showTroubleshoot && "rotate-180"
              )}
            />
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div className="mt-3 space-y-3">
            {TROUBLESHOOT_ITEMS.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-border bg-muted/30 p-3"
              >
                <p className="text-sm font-medium text-foreground">
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}
