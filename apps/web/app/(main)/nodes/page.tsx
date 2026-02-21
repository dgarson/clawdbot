"use client";

import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { useProficiency } from "@/lib/stores/proficiency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import type { NodeEntry } from "@/lib/gateway/types";
import {
  Smartphone,
  Monitor,
  Server,
  Wifi,
  WifiOff,
  RefreshCw,
  Info,
  Clock,
  Cpu,
  Laptop,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function platformIcon(platform?: string) {
  switch (platform?.toLowerCase()) {
    case "ios":
    case "android":
      return Smartphone;
    case "macos":
    case "windows":
      return Laptop;
    case "linux":
      return Server;
    default:
      return Monitor;
  }
}

function formatLastSeen(ts?: number): string {
  if (!ts) {return "Never";}
  const diff = Date.now() - ts;
  if (diff < 60_000) {return "Just now";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return new Date(ts).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function NodeCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
          <div className="h-5 w-20 rounded-full bg-muted" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        <div className="h-3 w-40 rounded bg-muted" />
        <div className="h-3 w-28 rounded bg-muted" />
      </CardContent>
      <CardFooter>
        <div className="h-8 w-24 rounded bg-muted" />
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Monitor className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No devices paired</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          <AdaptiveLabel
            beginner="Pair a phone or computer to let your agent interact with the real world."
            standard="No nodes paired yet. Pair a device to enable camera, screen, notifications, and more."
            expert="No nodes registered. Use `openclaw pair` on a device to register it."
          />
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Node card
// ---------------------------------------------------------------------------

function NodeCard({
  node,
  onDescribe,
}: {
  node: NodeEntry;
  onDescribe: (id: string) => void;
}) {
  const Icon = platformIcon(node.platform);

  return (
    <Card
      className={cn(
        "transition-colors",
        node.connected
          ? "border-l-4 border-l-emerald-500"
          : "border-l-4 border-l-muted-foreground/30"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              node.connected ? "bg-emerald-500/10" : "bg-muted"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                node.connected
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">
              {node.name ?? node.id}
            </CardTitle>
            {node.platform && (
              <CardDescription className="text-xs capitalize">
                {node.platform}
                {node.model ? ` · ${node.model}` : ""}
              </CardDescription>
            )}
          </div>
          <Badge variant={node.connected ? "default" : "secondary"}>
            {node.connected ? (
              <span className="flex items-center gap-1">
                <Wifi className="h-3 w-3" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>

      <ComplexityGate level="standard">
        <CardContent className="pb-3 pt-0">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last seen: {formatLastSeen(node.lastSeenAt)}
            </span>
            <span className="flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              ID: {node.id.slice(0, 8)}…
            </span>
          </div>
        </CardContent>
      </ComplexityGate>

      <CardFooter className="pt-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDescribe(node.id)}
        >
          <Info className="mr-1.5 h-3.5 w-3.5" />
          <AdaptiveLabel
            beginner="Details"
            standard="Node Details"
            expert="Describe"
          />
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Detail panel (shown when a node is selected)
// ---------------------------------------------------------------------------

function NodeDetailPanel({
  detail,
  onClose,
}: {
  detail: Record<string, unknown>;
  onClose: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Node Details</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap text-xs text-muted-foreground bg-muted rounded-lg p-3 max-h-64 overflow-auto">
          {JSON.stringify(detail, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NodesPage() {
  const { connected, request } = useGatewayStore();

  const [nodes, setNodes] = React.useState<NodeEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = React.useState<Record<
    string,
    unknown
  > | null>(null);
  const [describingId, setDescribingId] = React.useState<string | null>(null);

  // Fetch node list
  const fetchNodes = React.useCallback(async () => {
    if (!connected) {return;}
    setLoading(true);
    setError(null);
    try {
      const result = await request<{ nodes: NodeEntry[] }>("node.list", {});
      setNodes(result.nodes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load nodes");
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  React.useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // Describe a single node
  const handleDescribe = React.useCallback(
    async (id: string) => {
      setDescribingId(id);
      try {
        const detail = await request<Record<string, unknown>>(
          "node.describe",
          { node: id }
        );
        setSelectedDetail(detail);
      } catch {
        setSelectedDetail({ error: "Failed to fetch node details" });
      } finally {
        setDescribingId(null);
      }
    },
    [request]
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AdaptiveLabel
              beginner="Your Devices"
              standard="Nodes"
              expert="Paired Nodes"
            />
          </h1>
          <p className="text-sm text-muted-foreground">
            <AdaptiveLabel
              beginner="Phones and computers connected to your agent."
              standard="Paired devices your agent can interact with."
              expert="Registered node endpoints for camera, screen, notifications, and shell."
            />
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchNodes}
          disabled={loading || !connected}
        >
          <RefreshCw
            className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {/* Connection warning */}
      {!connected && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-3">
            <WifiOff className="h-4 w-4 text-warning" />
            <p className="text-sm text-warning">
              Not connected to Gateway. Node data may be stale.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Detail panel */}
      {selectedDetail && (
        <NodeDetailPanel
          detail={selectedDetail}
          onClose={() => setSelectedDetail(null)}
        />
      )}

      {/* Node grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <NodeCardSkeleton key={i} />
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onDescribe={handleDescribe}
            />
          ))}
        </div>
      )}

      {/* Summary for experts */}
      <ComplexityGate level="expert">
        <p className="text-xs text-muted-foreground">
          {nodes.length} node{nodes.length !== 1 ? "s" : ""} registered ·{" "}
          {nodes.filter((n) => n.connected).length} online
        </p>
      </ComplexityGate>
    </div>
  );
}
