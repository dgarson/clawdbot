import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";

type NodeKind = "agent" | "model" | "tool" | "service" | "storage";
type EdgeKind = "uses" | "depends-on" | "spawns" | "writes-to" | "reads-from";

interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  description: string;
  x: number;
  y: number;
  health: "healthy" | "degraded" | "down";
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  label?: string;
}

const SEED_NODES: GraphNode[] = [
  { id: "luis", label: "Luis", kind: "agent", description: "Principal UX Engineer, Product & UI Squad lead", x: 20, y: 20, health: "healthy" },
  { id: "xavier", label: "Xavier", kind: "agent", description: "CTO, technology leadership", x: 50, y: 10, health: "healthy" },
  { id: "piper", label: "Piper", kind: "agent", description: "Interaction design specialist", x: 10, y: 50, health: "healthy" },
  { id: "reed", label: "Reed", kind: "agent", description: "Accessibility specialist", x: 30, y: 50, health: "healthy" },
  { id: "wes", label: "Wes", kind: "agent", description: "Component architecture specialist", x: 50, y: 50, health: "healthy" },
  { id: "claude-sonnet", label: "Claude Sonnet", kind: "model", description: "Anthropic Claude model for reasoning tasks", x: 80, y: 20, health: "healthy" },
  { id: "gpt-4o", label: "GPT-4o", kind: "model", description: "OpenAI GPT-4o model", x: 80, y: 50, health: "degraded" },
  { id: "gemini-flash", label: "Gemini Flash", kind: "model", description: "Google Gemini Flash for fast inference", x: 80, y: 80, health: "healthy" },
  { id: "slack", label: "Slack", kind: "service", description: "Team communication platform", x: 50, y: 80, health: "healthy" },
  { id: "github", label: "GitHub", kind: "service", description: "Code repository and CI/CD", x: 20, y: 80, health: "healthy" },
  { id: "s3-storage", label: "S3 Storage", kind: "storage", description: "AWS S3 for persistent storage", x: 65, y: 65, health: "healthy" },
  { id: "openclaw-gateway", label: "OpenClaw Gateway", kind: "service", description: "Gateway service for agent communication", x: 50, y: 35, health: "healthy" },
];

const SEED_EDGES: GraphEdge[] = [
  { id: "e1", from: "luis", to: "claude-sonnet", kind: "uses" },
  { id: "e2", from: "luis", to: "piper", kind: "spawns" },
  { id: "e3", from: "luis", to: "reed", kind: "spawns" },
  { id: "e4", from: "luis", to: "wes", kind: "spawns" },
  { id: "e5", from: "luis", to: "openclaw-gateway", kind: "uses" },
  { id: "e6", from: "luis", to: "github", kind: "reads-from" },
  { id: "e7", from: "xavier", to: "claude-sonnet", kind: "uses" },
  { id: "e8", from: "xavier", to: "openclaw-gateway", kind: "uses" },
  { id: "e9", from: "piper", to: "gemini-flash", kind: "uses" },
  { id: "e10", from: "reed", to: "gemini-flash", kind: "uses" },
  { id: "e11", from: "wes", to: "gpt-4o", kind: "uses" },
  { id: "e12", from: "openclaw-gateway", to: "s3-storage", kind: "writes-to" },
  { id: "e13", from: "openclaw-gateway", to: "s3-storage", kind: "reads-from" },
  { id: "e14", from: "luis", to: "slack", kind: "writes-to" },
  { id: "e15", from: "xavier", to: "slack", kind: "writes-to" },
];

const KIND_COLORS: Record<NodeKind, string> = {
  agent: "bg-primary hover:bg-primary",
  model: "bg-primary hover:bg-primary",
  tool: "bg-emerald-600 hover:bg-emerald-500",
  service: "bg-sky-600 hover:bg-sky-500",
  storage: "bg-amber-600 hover:bg-amber-500",
};

const HEALTH_COLORS: Record<GraphNode["health"], string> = {
  healthy: "bg-emerald-400",
  degraded: "bg-amber-400",
  down: "bg-rose-400",
};

const KIND_LABELS: Record<NodeKind, string> = {
  agent: "Agents",
  model: "Models",
  tool: "Tools",
  service: "Services",
  storage: "Storage",
};

export default function DependencyGraph() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<NodeKind>>(
    new Set(["agent", "model", "tool", "service", "storage"])
  );

  const filteredNodes = useMemo(() => {
    return SEED_NODES.filter((node) => activeFilters.has(node.kind));
  }, [activeFilters]);

  const filteredNodeIds = useMemo(() => {
    return new Set(filteredNodes.map((n) => n.id));
  }, [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return SEED_EDGES.filter(
      (edge) => filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to)
    );
  }, [filteredNodeIds]);

  const selectedNode = useMemo(() => {
    return SEED_NODES.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId]);

  const selectedNodeEdges = useMemo(() => {
    if (!selectedNodeId) {return { incoming: [], outgoing: [] };}
    const incoming = filteredEdges
      .filter((e) => e.to === selectedNodeId)
      .map((e) => {
        const fromNode = SEED_NODES.find((n) => n.id === e.from);
        return { edge: e, fromNode };
      });
    const outgoing = filteredEdges
      .filter((e) => e.from === selectedNodeId)
      .map((e) => {
        const toNode = SEED_NODES.find((n) => n.id === e.to);
        return { edge: e, toNode };
      });
    return { incoming, outgoing };
  }, [selectedNodeId, filteredEdges]);

  const toggleFilter = (kind: NodeKind) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
    if (selectedNodeId && !filteredNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  };

  return (
    <div className="flex h-full w-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Graph Canvas */}
      <div className="relative flex-[65%] bg-[var(--color-surface-1)] overflow-hidden" style={{ minWidth: 0 }}>
        <div className="absolute inset-0">
          {filteredNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              className={cn(
                "absolute flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-150 cursor-pointer",
                "w-20 h-12 text-xs font-medium",
                KIND_COLORS[node.kind],
                selectedNodeId === node.id && "ring-2 ring-white ring-offset-2 ring-offset-zinc-900"
              )}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <span className="truncate flex-1 text-left">{node.label}</span>
              <span
                className={cn("w-2 h-2 rounded-full flex-shrink-0", HEALTH_COLORS[node.health])}
                title={node.health}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-[35%] bg-[var(--color-surface-0)] border-l border-[var(--color-border)] flex flex-col" style={{ minWidth: 280 }}>
        {/* Filter Chips */}
        <div className="p-4 border-b border-[var(--color-border)]">
          <h3 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
            Filter by Kind
          </h3>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KIND_COLORS) as NodeKind[]).map((kind) => {
              const isActive = activeFilters.has(kind);
              return (
                <button
                  key={kind}
                  onClick={() => toggleFilter(kind)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150",
                    isActive
                      ? KIND_COLORS[kind].replace("hover:", "")
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]"
                  )}
                >
                  {KIND_LABELS[kind]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Node Details */}
        <div className="flex-1 overflow-auto p-4">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold",
                    KIND_COLORS[selectedNode.kind].replace("hover:", "")
                  )}
                >
                  {selectedNode.label.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{selectedNode.label}</h2>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        HEALTH_COLORS[selectedNode.health]
                      )}
                    />
                    <span className="text-sm text-[var(--color-text-secondary)] capitalize">
                      {selectedNode.health}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)]">
                <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                  Description
                </span>
                <p className="text-sm mt-1 text-[var(--color-text-primary)]">{selectedNode.description}</p>
              </div>

              <div className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)]">
                <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                  Details
                </span>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Kind</span>
                    <span className="capitalize">{selectedNode.kind}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Position</span>
                    <span>
                      {selectedNode.x}%, {selectedNode.y}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Connections */}
              <div className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)]">
                <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                  Connections
                </span>
                <div className="mt-2 space-y-2">
                  {selectedNodeEdges.outgoing.length > 0 && (
                    <div>
                      <span className="text-xs text-[var(--color-text-muted)]">Outgoing</span>
                      {selectedNodeEdges.outgoing.map(({ edge, toNode }) => (
                        <div
                          key={edge.id}
                          className="text-sm py-1 flex items-center gap-2"
                        >
                          <span className="text-emerald-400">→</span>
                          <span className="text-[var(--color-text-primary)]">
                            to {toNode?.label ?? edge.to} ({edge.kind})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedNodeEdges.incoming.length > 0 && (
                    <div>
                      <span className="text-xs text-[var(--color-text-muted)]">Incoming</span>
                      {selectedNodeEdges.incoming.map(({ edge, fromNode }) => (
                        <div
                          key={edge.id}
                          className="text-sm py-1 flex items-center gap-2"
                        >
                          <span className="text-rose-400">←</span>
                          <span className="text-[var(--color-text-primary)]">
                            from {fromNode?.label ?? edge.from} ({edge.kind})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedNodeEdges.incoming.length === 0 &&
                    selectedNodeEdges.outgoing.length === 0 && (
                      <span className="text-sm text-[var(--color-text-muted)]">No connections</span>
                    )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
              <svg
                className="w-16 h-16 mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <p className="text-sm">Select a node to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
