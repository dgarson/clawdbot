/**
 * Agent Relationship Graph Route
 *
 * Live visualization of all agents and their spawn/delegation relationships.
 * Nodes = agents, edges = parent-child session relationships derived from
 * session key patterns (agent:{parent}:subagent:{child}).
 *
 * Uses the GraphExplorer + ReagraphView integration for interactive drill-down.
 */

import * as React from "react";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  GitFork,
  Bot,
  Activity,
  AlertCircle,
  Clock,
  Zap,
  RefreshCw,
  Network,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ReagraphView } from "@/integrations/graph";
import type { GraphData, GraphNode, GraphEdge } from "@/integrations/graph";
import {
  useAgentStatusDashboard,
  type AgentStatusEntry,
  type AgentHealthStatus,
} from "@/hooks/queries/useAgentStatus";
import { useOptionalGateway } from "@/providers/GatewayProvider";

// ── Route ──────────────────────────────────────────────────────────

export const Route = createLazyFileRoute("/agents/graph")({
  component: AgentGraphPage,
});

// ── Types ──────────────────────────────────────────────────────────

type AgentNodeData = {
  health: AgentHealthStatus;
  model?: string;
  currentTask?: string;
  sessionKey?: string;
  sessionCount: number;
  tokensUsed: number;
  estimatedCost: number;
  lastActivityAt: number;
  tags?: string[];
};

type AgentEdgeData = {
  kind: "spawn" | "channel" | "delegation";
  sessionKey?: string;
};

// ── Session key parser ─────────────────────────────────────────────

/**
 * Parse a session key to extract the parent agent ID.
 *
 * Patterns:
 *   agent:{parentId}:subagent:{subId}   → parent is {parentId}
 *   agent:{agentId}:{channel}:{...}     → no parent (top-level channel)
 */
function parseSessionKeyParent(sessionKey: string): string | null {
  const parts = sessionKey.split(":");
  if (parts.length < 4) return null;
  if (parts[0] !== "agent") return null;
  if (parts[2] === "subagent") {
    return parts[1]; // parent agent ID
  }
  return null;
}

/**
 * Extract edge kind from session key.
 */
function parseEdgeKind(sessionKey: string): AgentEdgeData["kind"] {
  if (sessionKey.includes(":subagent:")) return "spawn";
  if (sessionKey.includes(":channel:")) return "channel";
  return "delegation";
}

// ── Graph builder ──────────────────────────────────────────────────

function buildAgentGraph(
  agents: AgentStatusEntry[]
): GraphData<AgentNodeData, AgentEdgeData> {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const nodes: GraphNode<AgentNodeData>[] = agents.map((agent) => ({
    id: agent.id,
    label: agent.name || agent.id,
    kind: "agent",
    data: {
      health: agent.health,
      model: agent.model,
      currentTask: agent.currentTask,
      sessionKey: agent.sessionKey,
      sessionCount: agent.sessionCount,
      tokensUsed: agent.resources.tokensUsed,
      estimatedCost: agent.resources.estimatedCost,
      lastActivityAt: agent.lastActivityAt,
      tags: agent.tags,
    },
  }));

  const edges: GraphEdge<AgentEdgeData>[] = [];
  const seenEdges = new Set<string>();

  for (const agent of agents) {
    if (!agent.sessionKey) continue;

    const parentId = parseSessionKeyParent(agent.sessionKey);
    if (!parentId || !agentMap.has(parentId)) continue;

    // Avoid duplicate edges
    const edgeId = `${parentId}→${agent.id}`;
    if (seenEdges.has(edgeId)) continue;
    seenEdges.add(edgeId);

    edges.push({
      id: edgeId,
      source: parentId,
      target: agent.id,
      label: parseEdgeKind(agent.sessionKey),
      data: {
        kind: parseEdgeKind(agent.sessionKey),
        sessionKey: agent.sessionKey,
      },
    });
  }

  return { nodes, edges };
}

// ── Health helpers ─────────────────────────────────────────────────

function healthColor(health: AgentHealthStatus): string {
  switch (health) {
    case "active":
      return "text-emerald-500";
    case "idle":
      return "text-amber-500";
    case "stalled":
      return "text-orange-500";
    case "errored":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

function healthBadgeVariant(
  health: AgentHealthStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (health) {
    case "active":
      return "default";
    case "idle":
      return "secondary";
    case "stalled":
      return "outline";
    case "errored":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// ── Agent detail panel ─────────────────────────────────────────────

type AgentDetailPanelProps = {
  node: GraphNode<AgentNodeData> | null;
  agents: AgentStatusEntry[];
  onClose: () => void;
};

function AgentDetailPanel({ node, agents, onClose }: AgentDetailPanelProps) {
  if (!node) return null;

  const data = node.data;
  const agent = agents.find((a) => a.id === node.id);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.15 }}
      className="flex h-full flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Bot className={cn("h-4 w-4 shrink-0", data ? healthColor(data.health) : "")} />
            <span className="truncate font-semibold">{node.label ?? node.id}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{node.id}</span>
            {data && (
              <Badge variant={healthBadgeVariant(data.health)} className="h-4 px-1 text-[10px]">
                {data.health}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <span className="text-muted-foreground">×</span>
        </Button>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Current task */}
        {data?.currentTask && (
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Activity className="h-3 w-3" />
              Current Task
            </div>
            <p className="text-sm">{data.currentTask}</p>
          </div>
        )}

        {/* Model */}
        {data?.model && (
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Zap className="h-3 w-3" />
              Model
            </div>
            <p className="font-mono text-xs">{data.model}</p>
          </div>
        )}

        {/* Resource stats */}
        {data && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">Tokens</div>
              <div className="text-sm font-semibold">{formatTokens(data.tokensUsed)}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">Cost</div>
              <div className="text-sm font-semibold">{formatCost(data.estimatedCost)}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">Sessions</div>
              <div className="text-sm font-semibold">{data.sessionCount}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">Last active</div>
              <div className="text-sm font-semibold">{timeAgo(data.lastActivityAt)}</div>
            </div>
          </div>
        )}

        {/* Session key */}
        {data?.sessionKey && (
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <GitFork className="h-3 w-3" />
              Session Key
            </div>
            <p className="break-all font-mono text-xs text-muted-foreground">{data.sessionKey}</p>
          </div>
        )}

        {/* Tags */}
        {data?.tags && data.tags.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Tags</div>
            <div className="flex flex-wrap gap-1">
              {data.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <Separator />
        <div className="space-y-2">
          <Link
            to="/agents/$agentId"
            params={{ agentId: node.id }}
            className="block"
          >
            <Button variant="outline" size="sm" className="w-full">
              Open Agent Config
            </Button>
          </Link>
          {agent && (
            <Link
              to="/agent-status"
              search={{ health: "all" }}
              className="block"
            >
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
                View in Status Dashboard
              </Button>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty state ────────────────────────────────────────────────────

function EmptyGraphState({
  isConnected,
  agentCount,
}: {
  isConnected: boolean;
  agentCount: number;
}) {
  if (!isConnected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <div className="font-medium">Not connected to gateway</div>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Connect to your OpenClaw gateway to see the live agent relationship graph.
          </p>
        </div>
      </div>
    );
  }

  if (agentCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <Network className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <div className="font-medium">No agents found</div>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            No agent relationships to display. Create some agents to see their connections here.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/agents">
            <Bot className="mr-2 h-4 w-4" />
            View Agents
          </Link>
        </Button>
      </div>
    );
  }

  return null;
}

// ── Legend ─────────────────────────────────────────────────────────

function GraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Legend</span>
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        Active
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        Idle
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
        Stalled
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        Errored
      </div>
      <Separator orientation="vertical" className="h-4" />
      <div className="flex items-center gap-1.5">
        <GitFork className="h-3 w-3" />
        Spawned subagent
      </div>
    </div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────

function GraphStatsBar({ agents }: { agents: AgentStatusEntry[] }) {
  const active = agents.filter((a) => a.health === "active").length;
  const totalCost = agents.reduce((sum, a) => sum + a.resources.estimatedCost, 0);
  const totalTokens = agents.reduce((sum, a) => sum + a.resources.tokensUsed, 0);

  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Bot className="h-4 w-4" />
        <span>
          <span className="font-semibold text-foreground">{agents.length}</span> agents
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Activity className="h-4 w-4 text-emerald-500" />
        <span>
          <span className="font-semibold text-foreground">{active}</span> active
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Zap className="h-4 w-4" />
        <span>
          <span className="font-semibold text-foreground">{formatTokens(totalTokens)}</span> tokens
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>
          <span className="font-semibold text-foreground">{formatCost(totalCost)}</span> total cost
        </span>
      </div>
    </div>
  );
}

// ── CSS-based graph fallback ──────────────────────────────────────
// When reagraph isn't installed, render a clean hierarchical card view

type FallbackGraphProps = {
  graph: GraphData<AgentNodeData, AgentEdgeData>;
  agents: AgentStatusEntry[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
};

function FallbackAgentGraph({
  graph,
  agents,
  selectedNodeId,
  onNodeClick,
}: FallbackGraphProps) {
  // Group: root nodes (no incoming edges) and child nodes
  const childIds = new Set(graph.edges.map((e) => e.target));
  const rootNodes = graph.nodes.filter((n) => !childIds.has(n.id));
  const childByParent = new Map<string, GraphNode<AgentNodeData>[]>();

  for (const edge of graph.edges) {
    const arr = childByParent.get(edge.source) ?? [];
    arr.push(graph.nodes.find((n) => n.id === edge.target)!);
    childByParent.set(edge.source, arr.filter(Boolean));
  }

  const renderNode = (node: GraphNode<AgentNodeData>, depth = 0) => {
    const data = node.data;
    const children = childByParent.get(node.id) ?? [];
    const isSelected = selectedNodeId === node.id;

    return (
      <div key={node.id} className={cn("flex flex-col", depth > 0 && "ml-6 border-l border-border pl-4")}>
        <button
          onClick={() => onNodeClick(node.id)}
          className={cn(
            "group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all",
            isSelected
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
          )}
        >
          <div
            className={cn(
              "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
              data?.health === "active" && "bg-emerald-500",
              data?.health === "idle" && "bg-amber-500",
              data?.health === "stalled" && "bg-orange-500",
              data?.health === "errored" && "bg-red-500",
              !data?.health && "bg-muted-foreground/50"
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-sm">{node.label}</span>
              {data?.model && (
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {data.model.split("/").pop()}
                </span>
              )}
            </div>
            {data?.currentTask && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{data.currentTask}</p>
            )}
            <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
              <span>{formatTokens(data?.tokensUsed ?? 0)} tokens</span>
              <span>{formatCost(data?.estimatedCost ?? 0)}</span>
              <span>{timeAgo(data?.lastActivityAt ?? Date.now())}</span>
            </div>
          </div>
        </button>

        {children.length > 0 && (
          <div className="mt-2 space-y-2">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (rootNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No agents to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Network className="h-3.5 w-3.5" />
        Hierarchical view (install <code className="mx-1 font-mono">reagraph</code> for interactive graph)
      </div>
      {rootNodes.map((node) => renderNode(node))}
    </div>
  );
}

// ── Graph canvas wrapper ───────────────────────────────────────────

type GraphCanvasWrapperProps = {
  graph: GraphData<AgentNodeData, AgentEdgeData>;
  agents: AgentStatusEntry[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  onCanvasClick: () => void;
};

function GraphCanvasWrapper({
  graph,
  agents,
  selectedNodeId,
  onNodeClick,
  onCanvasClick,
}: GraphCanvasWrapperProps) {
  // Try reagraph first; fall back to CSS tree on load error
  const [reagraphFailed, setReagraphFailed] = React.useState(false);

  if (reagraphFailed) {
    return (
      <FallbackAgentGraph
        graph={graph}
        agents={agents}
        selectedNodeId={selectedNodeId}
        onNodeClick={onNodeClick}
      />
    );
  }

  // Custom node renderer: color by health
  const nodeToReagraph = React.useCallback(
    (node: GraphNode<AgentNodeData>) => {
      const healthFill = {
        active: "#10b981",   // emerald-500
        idle: "#f59e0b",     // amber-500
        stalled: "#f97316",  // orange-500
        errored: "#ef4444",  // red-500
      }[node.data?.health ?? "idle"] ?? "#6b7280";

      return {
        id: node.id,
        label: node.label ?? node.id,
        data: node.data,
        fill: healthFill,
        activeFill: healthFill,
        opacity: node.data?.health === "idle" ? 0.7 : 1,
        size: node.data?.health === "active" ? 8 : 6,
      };
    },
    []
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-muted/20">
      <React.Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading graph renderer…</p>
          </div>
        }
      >
        <ReagraphView
          graph={graph}
          className="h-full w-full"
          nodeToReagraph={nodeToReagraph}
          onNodeClick={onNodeClick}
          onCanvasClick={onCanvasClick}
          reagraphProps={{
            layoutType: "forceDirected2d",
            edgeLabelPosition: "natural",
            animated: true,
          }}
        />
      </React.Suspense>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────

function AgentGraphPage() {
  const gatewayCtx = useOptionalGateway();
  const isConnected = gatewayCtx?.isConnected ?? false;

  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  const {
    data: snapshot,
    isLoading,
    refetch,
    isFetching,
  } = useAgentStatusDashboard({ pollInterval: 15_000 });

  const agents = snapshot?.agents ?? [];

  const graph = React.useMemo<GraphData<AgentNodeData, AgentEdgeData>>(
    () => buildAgentGraph(agents),
    [agents]
  );

  const selectedNode = React.useMemo(
    () => (selectedNodeId ? graph.nodes.find((n) => n.id === selectedNodeId) ?? null : null),
    [selectedNodeId, graph.nodes]
  );

  const handleNodeClick = React.useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleCanvasClick = React.useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const showEmpty = !isLoading && (!isConnected || agents.length === 0);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Link to="/agents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Agent Relationship Graph</h1>
            <p className="text-sm text-muted-foreground">
              Live visualization of agent spawn hierarchies and delegation chains
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Stats */}
      {agents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <GraphStatsBar agents={agents} />
        </motion.div>
      )}

      {/* Main content: graph + side panel */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Graph area */}
        <motion.div
          className="min-w-0 flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {isLoading ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-border bg-muted/20">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Loading agent graph…</p>
              </div>
            </div>
          ) : showEmpty ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-border bg-muted/20">
              <EmptyGraphState isConnected={isConnected} agentCount={agents.length} />
            </div>
          ) : (
            <GraphCanvasWrapper
              graph={graph}
              agents={agents}
              selectedNodeId={selectedNodeId}
              onNodeClick={handleNodeClick}
              onCanvasClick={handleCanvasClick}
            />
          )}
        </motion.div>

        {/* Side panel: agent detail */}
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 16, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 280 }}
            exit={{ opacity: 0, x: 16, width: 0 }}
            transition={{ duration: 0.2 }}
            className="w-[280px] shrink-0 overflow-hidden rounded-lg border border-border bg-card"
          >
            <AgentDetailPanel
              node={selectedNode}
              agents={agents}
              onClose={() => setSelectedNodeId(null)}
            />
          </motion.div>
        )}
      </div>

      {/* Legend */}
      {!showEmpty && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <GraphLegend />
        </motion.div>
      )}
    </div>
  );
}
