import * as React from "react";
import type { GraphData, GraphEdge, GraphNode } from "./types";

type ReagraphNodeLike<TNodeData> = {
  id: string;
  label?: string;
  data?: TNodeData;
  [key: string]: unknown;
};

type ReagraphEdgeLike<TEdgeData> = {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: TEdgeData;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringField(obj: unknown, field: string): string | null {
  if (!isRecord(obj)) {return null;}
  const value = obj[field];
  return typeof value === "string" ? value : null;
}

export type ReagraphViewProps<TNodeData = unknown, TEdgeData = unknown> = {
  graph: GraphData<TNodeData, TEdgeData>;
  className?: string;
  style?: React.CSSProperties;

  nodeToReagraph?: (node: GraphNode<TNodeData>) => ReagraphNodeLike<TNodeData>;
  edgeToReagraph?: (edge: GraphEdge<TEdgeData>) => ReagraphEdgeLike<TEdgeData>;
  reagraphProps?: Record<string, unknown>;
  canvasRef?: React.Ref<unknown>;

  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onCanvasClick?: () => void;
};

type GraphCanvasModule = {
  GraphCanvas: React.ComponentType<Record<string, unknown>>;
};

async function loadReagraphModule(): Promise<GraphCanvasModule> {
  const moduleId = "reagraph";
  const mod = (await import(
    /* @vite-ignore */
    moduleId
  )) as unknown;

  if (!isRecord(mod)) {
    throw new Error(`Expected "${moduleId}" to export an object module`);
  }

  const GraphCanvas = mod.GraphCanvas;
  if (typeof GraphCanvas !== "function" && !isRecord(GraphCanvas)) {
    throw new Error(`Expected "${moduleId}" to export GraphCanvas`);
  }

  return { GraphCanvas: GraphCanvas as GraphCanvasModule["GraphCanvas"] };
}

export function ReagraphView<TNodeData = unknown, TEdgeData = unknown>({
  graph,
  className,
  style,
  nodeToReagraph,
  edgeToReagraph,
  reagraphProps,
  canvasRef,
  onNodeClick,
  onEdgeClick,
  onCanvasClick,
}: ReagraphViewProps<TNodeData, TEdgeData>) {
  const [GraphCanvas, setGraphCanvas] = React.useState<GraphCanvasModule["GraphCanvas"] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    loadReagraphModule()
      .then(({ GraphCanvas }) => {
        if (cancelled) {return;}
        setGraphCanvas(() => GraphCanvas);
      })
      .catch((err: unknown) => {
        if (cancelled) {return;}
        const message = err instanceof Error ? err.message : String(err);
        setLoadError(message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const nodes = React.useMemo(() => {
    const mapper =
      nodeToReagraph ??
      ((node: GraphNode<TNodeData>): ReagraphNodeLike<TNodeData> => ({
        id: node.id,
        label: node.label ?? node.id,
        data: node.data,
      }));
    return graph.nodes.map(mapper);
  }, [graph.nodes, nodeToReagraph]);

  const edges = React.useMemo(() => {
    const mapper =
      edgeToReagraph ??
      ((edge: GraphEdge<TEdgeData>): ReagraphEdgeLike<TEdgeData> => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        data: edge.data,
      }));
    return graph.edges.map(mapper);
  }, [graph.edges, edgeToReagraph]);

  const handleNodeClick = React.useCallback(
    (node: unknown) => {
      const nodeId = readStringField(node, "id");
      if (!nodeId) {return;}
      onNodeClick?.(nodeId);
    },
    [onNodeClick]
  );

  const handleEdgeClick = React.useCallback(
    (edge: unknown) => {
      const edgeId = readStringField(edge, "id");
      if (!edgeId) {return;}
      onEdgeClick?.(edgeId);
    },
    [onEdgeClick]
  );

  if (loadError) {
    return (
      <div className={className} style={style}>
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <div className="font-medium text-foreground">Graph renderer unavailable</div>
          <div className="mt-1">
            Install <code className="font-mono">reagraph</code> to enable the graph view.
          </div>
          <div className="mt-2 font-mono text-xs">{loadError}</div>
        </div>
      </div>
    );
  }

  if (!GraphCanvas) {
    return (
      <div className={className} style={style}>
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading graph renderer…
        </div>
      </div>
    );
  }

  const props: Record<string, unknown> = {
    ...reagraphProps,
    nodes,
    edges,
  };

  const externalOnNodeClick = (reagraphProps ?? {}).onNodeClick;
  const externalOnEdgeClick = (reagraphProps ?? {}).onEdgeClick;
  const externalOnCanvasClick = (reagraphProps ?? {}).onCanvasClick;

  const mergedOnNodeClick = (node: unknown, ...rest: unknown[]) => {
    handleNodeClick(node);
    if (typeof externalOnNodeClick === "function") {(externalOnNodeClick as (...args: unknown[]) => void)(node, ...rest);}
  };

  const mergedOnEdgeClick = (edge: unknown, ...rest: unknown[]) => {
    handleEdgeClick(edge);
    if (typeof externalOnEdgeClick === "function") {(externalOnEdgeClick as (...args: unknown[]) => void)(edge, ...rest);}
  };

  const mergedOnCanvasClick = (...args: unknown[]) => {
    onCanvasClick?.();
    if (typeof externalOnCanvasClick === "function") {(externalOnCanvasClick as (...args: unknown[]) => void)(...args);}
  };

  return React.createElement(GraphCanvas, {
    ...props,
    ref: canvasRef,
    onNodeClick: mergedOnNodeClick,
    onEdgeClick: mergedOnEdgeClick,
    onCanvasClick: mergedOnCanvasClick,
    className,
    style,
  });
}
