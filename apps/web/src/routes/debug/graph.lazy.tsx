"use client";

import * as React from "react";
import { Navigate, createLazyFileRoute } from "@tanstack/react-router";
import { GraphExplorer } from "@/components/integrations";
import type { GraphData, GraphExplorerAdapter } from "@/integrations/graph";
import { useUIStore } from "@/stores/useUIStore";

export const Route = createLazyFileRoute("/debug/graph")({
  component: DebugGraphPage,
});

type DebugGraphParams = {
  seed?: string;
};

type DebugNode = {
  category: "system" | "domain" | "infra";
  description: string;
};

type DebugEdge = {
  reason: string;
};

type DebugNodeDetails = {
  title: string;
  description: string;
  suggestedDrilldowns: string[];
};

const baseGraph: GraphData<DebugNode, DebugEdge> = {
  nodes: [
    { id: "gateway", label: "Gateway", data: { category: "infra", description: "Connection + message routing surface" } },
    { id: "agents", label: "Agents", data: { category: "domain", description: "Agent definitions and runtime state" } },
    { id: "conversations", label: "Conversations", data: { category: "domain", description: "User conversations and threads" } },
    { id: "memories", label: "Memories", data: { category: "domain", description: "Memory store and retrieval" } },
    { id: "workstreams", label: "Workstreams", data: { category: "domain", description: "Workstream planning + execution" } },
    { id: "observability", label: "Observability", data: { category: "system", description: "Logs, traces, events, probes" } },
  ],
  edges: [
    { id: "gateway->agents", source: "gateway", target: "agents", label: "routes", data: { reason: "Messages are routed to agents" } },
    { id: "agents->conversations", source: "agents", target: "conversations", label: "writes", data: { reason: "Agents produce conversation output" } },
    { id: "conversations->memories", source: "conversations", target: "memories", label: "enriches", data: { reason: "Conversation turns can be stored as memories" } },
    { id: "workstreams->agents", source: "workstreams", target: "agents", label: "assigns", data: { reason: "Workstreams can assign agent tasks" } },
    { id: "observability->gateway", source: "observability", target: "gateway", label: "probes", data: { reason: "Gateway health checks and status" } },
  ],
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDebugGraphAdapter(): GraphExplorerAdapter<
  DebugGraphParams,
  DebugNode,
  DebugEdge,
  DebugNodeDetails,
  Record<string, unknown>
> {
  return {
    queryKey: (params) => ["debugGraph", params.seed ?? "default"] as const,
    loadGraph: async (params, ctx) => {
      void params;
      void ctx;
      await sleep(150);
      return baseGraph;
    },

    loadNodeDetails: async (nodeId, params, ctx) => {
      void params;
      void ctx;
      await sleep(120);
      const node = baseGraph.nodes.find((n) => n.id === nodeId);
      return {
        title: node?.label ?? nodeId,
        description: node?.data?.description ?? "No description available",
        suggestedDrilldowns: ["Expand neighbors", "Fetch live details", "Open related list view"],
      };
    },

    loadEdgeDetails: async (edgeId, params, ctx) => {
      void params;
      void ctx;
      await sleep(80);
      const edge = baseGraph.edges.find((e) => e.id === edgeId);
      return { ...edge, resolvedAt: new Date().toISOString() };
    },

    expandNode: async (nodeId, params, ctx) => {
      void params;
      void ctx;
      await sleep(250);
      const childA = `${nodeId}:detail`;
      const childB = `${nodeId}:events`;
      return {
        nodes: [
          {
            id: childA,
            label: "Detail",
            data: { category: "system", description: `Details for ${nodeId}` },
          },
          {
            id: childB,
            label: "Events",
            data: { category: "system", description: `Event stream for ${nodeId}` },
          },
        ],
        edges: [
          {
            id: `${nodeId}->${childA}`,
            source: nodeId,
            target: childA,
            label: "drilldown",
            data: { reason: `Drilldown from ${nodeId}` },
          },
          {
            id: `${nodeId}->${childB}`,
            source: nodeId,
            target: childB,
            label: "drilldown",
            data: { reason: `Drilldown from ${nodeId}` },
          },
        ],
      };
    },
  };
}

function DebugGraphPage() {
  const powerUserMode = useUIStore((s) => s.powerUserMode);
  const adapter = React.useMemo(() => buildDebugGraphAdapter(), []);

  if (!powerUserMode) {
    return <Navigate to="/" />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <GraphExplorer
        adapter={adapter}
        params={{ seed: "debug" }}
        reagraphProps={{
          // Keep this bag for easy renderer-specific tuning later.
          // Example (when reagraph is installed): layoutType: "forceDirected2d",
        }}
        renderNodeDetails={({ details }) => (
          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium">{details?.title ?? "Node"}</div>
              <div className="mt-1 text-sm text-muted-foreground">{details?.description ?? "—"}</div>
            </div>
            {details?.suggestedDrilldowns?.length ? (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Suggested drilldowns</div>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {details.suggestedDrilldowns.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
