"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
  type NodeChange,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./flow-dark-theme.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailPanel } from "@/components/composed/DetailPanel";
import { ThemeToggle } from "@/components/composed/ThemeToggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkflowNode } from "./WorkflowNode";
import { WorkflowEdge } from "./WorkflowEdge";
import { WorkflowLogPanel } from "./WorkflowLogPanel";
import type { WorkflowLogEntry, WorkflowVizEdge, WorkflowVizNode } from "./types";
import { FileText, Maximize2, RotateCcw, Terminal, Keyboard, Undo2, Redo2 } from "lucide-react";

const nodeTypes: NodeTypes = { workflowNode: WorkflowNode };
const edgeTypes: EdgeTypes = { workflowEdge: WorkflowEdge };

interface ToFlowOptions {
  onViewDetails?: (nodeId: string) => void;
  onStepInto?: (nodeId: string) => void;
}

function toFlow(
  nodes: WorkflowVizNode[],
  edges: WorkflowVizEdge[],
  options?: ToFlowOptions
): { nodes: Array<Node<WorkflowVizNode>>; edges: Edge[] } {
  const flowNodes: Array<Node<WorkflowVizNode>> = nodes.map((n) => ({
    id: n.id,
    position: n.position,
    type: "workflowNode",
    data: {
      ...n,
      onViewDetails: options?.onViewDetails,
      onStepInto: options?.onStepInto,
    },
    style: { width: n.width ?? 260 },
  }));

  const flowEdges: Array<Edge> = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "workflowEdge",
    animated: e.animated ?? false,
    data: { edgeType: e.type ?? "default", label: e.label, isActive: e.isActive },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
  }));

  return { nodes: flowNodes, edges: flowEdges };
}

type Pattern = {
  id: string;
  name: string;
  nodes: WorkflowVizNode[];
  edges: WorkflowVizEdge[];
};

const patterns: Pattern[] = [
  {
    id: "parallel",
    name: "Parallel execution",
    nodes: [
      { id: "start", type: "start", title: "Start Workflow", subtitle: "Initialize orchestrator", description: "Input: Feature request", status: "success", position: { x: 40, y: 180 }, metadata: { duration: "0.2s" } },
      { id: "orch", type: "orchestrator", title: "Orchestrator", subtitle: "Plan + delegate", description: "Chooses tools + parallelizes work", status: "running", position: { x: 340, y: 180 }, metadata: { model: "gpt-4o", step: 1 }, progress: 42 },
      { id: "w1", type: "worker", title: "Worker A", subtitle: "Docs scan", description: "Reads documentation", status: "running", position: { x: 640, y: 60 }, metadata: { model: "o4-mini" }, progress: 65 },
      { id: "w2", type: "worker", title: "Worker B", subtitle: "Code review", description: "Inspects code paths", status: "waiting", position: { x: 640, y: 180 }, metadata: { model: "o4-mini" }, progress: 18 },
      { id: "w3", type: "worker", title: "Worker C", subtitle: "Repro + tests", description: "Builds minimal repro", status: "idle", position: { x: 640, y: 300 }, metadata: { model: "o4-mini" } },
      { id: "end", type: "complete", title: "Complete", subtitle: "Workflow finished", description: "All steps complete", status: "idle", position: { x: 940, y: 180 }, metadata: { execution: "—" } },
    ],
    edges: [
      { id: "e1", source: "start", target: "orch", type: "default", isActive: true },
      { id: "e2", source: "orch", target: "w1", type: "parallel", isActive: true },
      { id: "e3", source: "orch", target: "w2", type: "parallel", isActive: true },
      { id: "e4", source: "orch", target: "w3", type: "parallel", isActive: false },
      { id: "e5", source: "w2", target: "end", type: "default", isActive: false },
    ],
  },
  {
    id: "conditional",
    name: "Conditional routing",
    nodes: [
      { id: "start", type: "start", title: "Start Workflow", subtitle: "Initialize routing", description: "Input: Customer query", status: "success", position: { x: 40, y: 180 }, metadata: { duration: "0.1s" } },
      { id: "classify", type: "router", title: "Classify Query", subtitle: "Pick route", description: "general / refund / technical", status: "success", position: { x: 340, y: 180 }, metadata: { model: "gpt-4o", step: 1 } },
      { id: "r1", type: "agent", title: "Route: General", subtitle: "General agent", description: "Handles general inquiries", status: "idle", position: { x: 640, y: 60 }, metadata: { model: "gpt-4o-mini" } },
      { id: "r2", type: "agent", title: "Route: Refund", subtitle: "Refund agent", description: "Handles refunds", status: "running", position: { x: 640, y: 180 }, metadata: { model: "gpt-4o-mini" }, progress: 78 },
      { id: "r3", type: "agent", title: "Route: Technical", subtitle: "Tech agent", description: "Handles technical support", status: "idle", position: { x: 640, y: 300 }, metadata: { model: "gpt-4o-mini" } },
      { id: "end", type: "complete", title: "Complete", subtitle: "Workflow finished", description: "Response generated", status: "idle", position: { x: 940, y: 180 }, metadata: { execution: "—" } },
    ],
    edges: [
      { id: "e1", source: "start", target: "classify", type: "default", isActive: true },
      { id: "e2", source: "classify", target: "r1", type: "conditional", label: "general", isActive: false },
      { id: "e3", source: "classify", target: "r2", type: "conditional", label: "refund", isActive: true },
      { id: "e4", source: "classify", target: "r3", type: "conditional", label: "technical", isActive: false },
      { id: "e5", source: "r2", target: "end", type: "default", isActive: false },
    ],
  },
];

// History entry for undo/redo
interface HistoryEntry {
  nodes: Array<Node<WorkflowVizNode>>;
  edges: Edge[];
}

function WorkflowVisualizationInner({ className }: { className?: string }) {
  const { fitView } = useReactFlow();

  const handleResetView = React.useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);
  const [patternId, setPatternId] = React.useState(patterns[0]!.id);
  const pattern = patterns.find((p) => p.id === patternId) ?? patterns[0]!;

  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [logOpen, setLogOpen] = React.useState(false);
  const [logs, setLogs] = React.useState<WorkflowLogEntry[]>([]);

  // Callbacks for node actions
  const handleViewDetails = React.useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleStepInto = React.useCallback((nodeId: string) => {
    // TODO: Navigate to Agent Command & Control view
    console.log("Step into node:", nodeId);
    // For now, show details and add a log entry
    setSelectedNodeId(nodeId);
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${prev.length + 1}`,
        timestamp: new Date().toLocaleTimeString(),
        level: "info",
        nodeId,
        message: `Stepping into node "${nodeId}" (Agent Command & Control mode coming soon)`,
      },
    ]);
  }, []);

  const initialFlow = React.useMemo(
    () => toFlow(pattern.nodes, pattern.edges, {
      onViewDetails: handleViewDetails,
      onStepInto: handleStepInto,
    }),
    [pattern.nodes, pattern.edges, handleViewDetails, handleStepInto]
  );

  // Use state for nodes/edges to enable editing and undo/redo
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);

  // Undo/redo history
  const historyRef = React.useRef<HistoryEntry[]>([{ nodes: initialFlow.nodes, edges: initialFlow.edges }]);
  const historyIndexRef = React.useRef(0);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);

  // Track node drag end to save to history
  const handleNodesChange = React.useCallback((changes: NodeChange<Node<WorkflowVizNode>>[]) => {
    onNodesChange(changes);

    // Check if any change is a position change that's complete (not dragging)
    const positionChanges = changes.filter(
      (c) => c.type === "position" && !("dragging" in c && c.dragging)
    );

    if (positionChanges.length > 0) {
      // Save to history after drag completes
      setTimeout(() => {
        setNodes((currentNodes: Array<Node<WorkflowVizNode>>) => {
          // Trim any redo history
          historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
          // Add new entry
          historyRef.current.push({ nodes: currentNodes, edges });
          historyIndexRef.current = historyRef.current.length - 1;
          setCanUndo(historyIndexRef.current > 0);
          setCanRedo(false);
          return currentNodes;
        });
      }, 0);
    }
  }, [onNodesChange, edges, setNodes]);

  // Undo action
  const handleUndo = React.useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const entry = historyRef.current[historyIndexRef.current];
      if (entry) {
        setNodes(entry.nodes);
        setEdges(entry.edges);
      }
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }
  }, [setNodes, setEdges]);

  // Redo action
  const handleRedo = React.useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const entry = historyRef.current[historyIndexRef.current];
      if (entry) {
        setNodes(entry.nodes);
        setEdges(entry.edges);
      }
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }
  }, [setNodes, setEdges]);

  // Reset when pattern changes
  React.useEffect(() => {
    const flow = toFlow(pattern.nodes, pattern.edges, {
      onViewDetails: handleViewDetails,
      onStepInto: handleStepInto,
    });
    setNodes(flow.nodes);
    setEdges(flow.edges);
    historyRef.current = [{ nodes: flow.nodes, edges: flow.edges }];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, [pattern.nodes, pattern.edges, handleViewDetails, handleStepInto, setNodes, setEdges]);

  const selectedNode = React.useMemo(
    () => pattern.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [pattern.nodes, selectedNodeId]
  );

  // Keyboard shortcuts including undo/redo
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedNodeId(null);
      }
      if (e.key === "l" && !e.metaKey && !e.ctrlKey) {
        setLogOpen((v) => !v);
      }
      // Undo: Ctrl+Z or Cmd+Z
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Y or Cmd+Shift+Z
      if ((e.key === "y" && (e.metaKey || e.ctrlKey)) || (e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  React.useEffect(() => {
    setSelectedNodeId(null);
    setLogs([
      { id: "log-1", timestamp: new Date().toLocaleTimeString(), level: "success", nodeId: "start", message: "Workflow initialized" },
    ]);
  }, [patternId]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Workflow Visualization</h2>
          <p className="text-sm text-muted-foreground">
            Reference implementation inspired by `src/ui-refs/workflow-visualization (3).html`.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle variant="buttons" />
        </div>
      </div>

      <Card className="relative overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-card/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <Select value={patternId} onValueChange={setPatternId}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Pattern" />
              </SelectTrigger>
              <SelectContent>
                {patterns.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedNodeId(null)}>
              <RotateCcw className="size-4" />
              Reset selection
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleResetView}>
              <Maximize2 className="size-4" />
              Reset View
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleUndo}
              disabled={!canUndo}
            >
              <Undo2 className="size-4" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleRedo}
              disabled={!canRedo}
            >
              <Redo2 className="size-4" />
              Redo
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setLogOpen(true)}>
              <Terminal className="size-4" />
              Log
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                L
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                setLogs((prev) => [
                  ...prev,
                  {
                    id: `log-${prev.length + 1}`,
                    timestamp: new Date().toLocaleTimeString(),
                    level: "info",
                    nodeId: selectedNodeId ?? undefined,
                    message: "Sample log entry",
                  },
                ])
              }
            >
              <FileText className="size-4" />
              Add log
            </Button>
          </div>
        </div>

        <div className="h-[65vh] min-h-[520px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={true}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            panOnScroll
            zoomOnScroll
            zoomOnPinch
            minZoom={0.1}
            maxZoom={2}
            onNodeClick={(_event: React.MouseEvent, node: Node<WorkflowVizNode>) => setSelectedNodeId(node.id)}
            className="bg-background"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls
              showInteractive={false}
              className="bg-card border border-border rounded-lg shadow-md"
            />
            <MiniMap
              className="bg-card border border-border rounded-lg shadow-md"
              nodeColor={(node) => {
                const data = node.data as WorkflowVizNode | undefined;
                if (!data) {return "#64748b";}
                switch (data.status) {
                  case "success": return "#22c55e";
                  case "running": return "#3b82f6";
                  case "error": return "#ef4444";
                  case "waiting": return "#f97316";
                  default: return "#64748b";
                }
              }}
              maskColor="hsl(var(--background) / 0.8)"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>

        {/* Bottom toolbar for selection actions */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-card/30 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Keyboard className="size-3" />
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+Z</kbd> undo
            </span>
            <span className="text-muted-foreground">|</span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+Y</kbd> redo
            </span>
            <span className="text-muted-foreground">|</span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">L</kbd> log
            </span>
            <span className="text-muted-foreground">|</span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd> clear
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">Drag nodes to reposition</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setSelectedNodeId(pattern.nodes[0]?.id ?? null)}>
              Select first
            </Button>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setSelectedNodeId(pattern.nodes.at(-1)?.id ?? null)}>
              Select last
            </Button>
          </div>
        </div>
      </Card>

      <DetailPanel
        open={selectedNode != null}
        onClose={() => setSelectedNodeId(null)}
        title={selectedNode?.title ?? "Node"}
        width="md"
      >
        {selectedNode ? (
          <div className="space-y-4">
            {selectedNode.subtitle ? (
              <p className="text-sm text-muted-foreground">{selectedNode.subtitle}</p>
            ) : null}
            {selectedNode.description ? (
              <p className="text-sm">{selectedNode.description}</p>
            ) : null}

            {selectedNode.metadata ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">Metadata</div>
                <pre className="rounded-lg border border-border bg-muted/30 p-3 text-xs overflow-auto scrollbar-thin">
                  {JSON.stringify(selectedNode.metadata, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </DetailPanel>

      <WorkflowLogPanel
        open={logOpen}
        onOpenChange={setLogOpen}
        logs={logs}
        onClear={() => setLogs([])}
      />
    </div>
  );
}

export function WorkflowVisualization({ className }: { className?: string }) {
  return (
    <ReactFlowProvider>
      <WorkflowVisualizationInner className={className} />
    </ReactFlowProvider>
  );
}
