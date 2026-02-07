/**
 * NodeCard - compact card for a connected node showing status,
 * platform, capabilities, and version.
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { NodeEntry } from "@/lib/api/nodes";
import {
  Laptop,
  Server,
  Monitor,
  Wifi,
  WifiOff,
  Cpu,
  Terminal,
} from "lucide-react";

interface NodeCardProps {
  node: NodeEntry;
  onClick?: () => void;
  selected?: boolean;
}

export function NodeCard({ node, onClick, selected }: NodeCardProps) {
  const PlatformIcon = getPlatformIcon(node.platform);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-3.5 transition-all",
        "hover:border-primary/30 hover:shadow-sm",
        selected && "border-primary/50 bg-primary/5 shadow-sm",
        !selected && "bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
              node.connected
                ? "bg-success/10 text-success"
                : "bg-muted text-muted-foreground",
            )}
          >
            <PlatformIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {node.displayName ?? node.nodeId}
            </div>
            <div className="text-xs text-muted-foreground">
              {node.platform ?? "unknown"} {node.version ? `v${node.version}` : ""}
            </div>
          </div>
        </div>

        <Badge
          variant={node.connected ? "success" : "secondary"}
          className="shrink-0 text-[10px] gap-1 px-1.5 h-5"
        >
          {node.connected ? (
            <Wifi className="h-2.5 w-2.5" />
          ) : (
            <WifiOff className="h-2.5 w-2.5" />
          )}
          {node.connected ? "Online" : "Offline"}
        </Badge>
      </div>

      {/* Capabilities */}
      {node.caps.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {node.caps.map((cap) => (
            <Badge
              key={cap}
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 font-mono"
            >
              {cap}
            </Badge>
          ))}
        </div>
      )}

      {/* Commands count */}
      {node.commands.length > 0 && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
          <Terminal className="h-2.5 w-2.5" />
          {node.commands.length} command{node.commands.length !== 1 ? "s" : ""}
        </div>
      )}
    </button>
  );
}

function getPlatformIcon(platform?: string) {
  switch (platform) {
    case "darwin":
      return Laptop;
    case "linux":
      return Server;
    case "win32":
      return Monitor;
    default:
      return Cpu;
  }
}
