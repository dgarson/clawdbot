import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw, Search, X, Maximize2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  mergeGraphById,
  type GraphSelection,
  type GraphData,
  type GraphExplorerAdapter,
} from "@/integrations/graph";
import { ReagraphView } from "@/integrations/graph";

export type GraphExplorerProps<
  TParams,
  TNodeData = unknown,
  TEdgeData = unknown,
  TNodeDetails = unknown,
  TEdgeDetails = unknown,
> = {
  adapter: GraphExplorerAdapter<TParams, TNodeData, TEdgeData, TNodeDetails, TEdgeDetails>;
  params: TParams;
  className?: string;
  graphClassName?: string;
  graphStyle?: React.CSSProperties;

  initialSelection?: GraphSelection;
  onSelectionChange?: (selection: GraphSelection) => void;

  renderNodeDetails?: (input: {
    nodeId: string;
    node: GraphData<TNodeData, TEdgeData>["nodes"][number];
    details: TNodeDetails | null;
    actions: GraphExplorerActions;
  }) => React.ReactNode;
  renderEdgeDetails?: (input: {
    edgeId: string;
    edge: GraphData<TNodeData, TEdgeData>["edges"][number];
    details: TEdgeDetails | null;
    actions: GraphExplorerActions;
  }) => React.ReactNode;

  reagraphProps?: Record<string, unknown>;
};

export type GraphExplorerActions = {
  refetch: () => void;
  clearSelection: () => void;
  selectNode: (nodeId: string) => void;
  selectEdge: (edgeId: string) => void;
  expandSelectedNode: () => void;
};

function formatCount(count: number): string {
  return new Intl.NumberFormat("en-US").format(count);
}

export function GraphExplorer<
  TParams,
  TNodeData = unknown,
  TEdgeData = unknown,
  TNodeDetails = unknown,
  TEdgeDetails = unknown,
>({
  adapter,
  params,
  className,
  graphClassName,
  graphStyle,
  initialSelection = { type: "none" },
  onSelectionChange,
  renderNodeDetails,
  renderEdgeDetails,
  reagraphProps,
}: GraphExplorerProps<TParams, TNodeData, TEdgeData, TNodeDetails, TEdgeDetails>) {
  const [selection, setSelection] = React.useState<GraphSelection>(initialSelection);
  const [search, setSearch] = React.useState("");
  const [graph, setGraph] = React.useState<GraphData<TNodeData, TEdgeData>>({ nodes: [], edges: [] });

  const query = useQuery({
    queryKey: adapter.queryKey(params),
    queryFn: ({ signal }) => adapter.loadGraph(params, { signal }),
  });

  React.useEffect(() => {
    if (!query.data) {return;}
    setGraph(query.data);
    setSelection((prev) => (prev.type === "none" ? prev : { type: "none" }));
  }, [query.data]);

  const changeSelection = React.useCallback(
    (next: GraphSelection) => {
      setSelection(next);
      onSelectionChange?.(next);
    },
    [onSelectionChange]
  );

  const selectedNode = React.useMemo(() => {
    if (selection.type !== "node") {return null;}
    return graph.nodes.find((n) => n.id === selection.id) ?? null;
  }, [graph.nodes, selection]);

  const selectedEdge = React.useMemo(() => {
    if (selection.type !== "edge") {return null;}
    return graph.edges.find((e) => e.id === selection.id) ?? null;
  }, [graph.edges, selection]);

  const expandNode = useMutation({
    mutationFn: async (nodeId: string) => {
      if (!adapter.expandNode) {return null;}
      const controller = new AbortController();
      return adapter.expandNode(nodeId, params, { signal: controller.signal });
    },
    onSuccess: (patch) => {
      if (!patch) {return;}
      const merger = adapter.mergeGraph ?? mergeGraphById;
      setGraph((prev) => merger(prev, patch));
    },
  });

  const nodeDetailsQuery = useQuery({
    queryKey: [...adapter.queryKey(params), "nodeDetails", selection.type === "node" ? selection.id : null] as const,
    queryFn: ({ signal }) => {
      if (selection.type !== "node" || !adapter.loadNodeDetails) {return Promise.resolve(null);}
      return adapter.loadNodeDetails(selection.id, params, { signal });
    },
    enabled: selection.type === "node" && !!adapter.loadNodeDetails,
  });

  const edgeDetailsQuery = useQuery({
    queryKey: [...adapter.queryKey(params), "edgeDetails", selection.type === "edge" ? selection.id : null] as const,
    queryFn: ({ signal }) => {
      if (selection.type !== "edge" || !adapter.loadEdgeDetails) {return Promise.resolve(null);}
      return adapter.loadEdgeDetails(selection.id, params, { signal });
    },
    enabled: selection.type === "edge" && !!adapter.loadEdgeDetails,
  });

  const filteredGraph = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {return graph;}
    const nodes = graph.nodes.filter((n) => (n.label ?? n.id).toLowerCase().includes(q));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { nodes, edges };
  }, [graph, search]);

  const onGraphNodeClick = React.useCallback(
    (nodeId: string) => changeSelection({ type: "node", id: nodeId }),
    [changeSelection]
  );

  const onGraphEdgeClick = React.useCallback(
    (edgeId: string) => changeSelection({ type: "edge", id: edgeId }),
    [changeSelection]
  );

  const onGraphCanvasClick = React.useCallback(() => changeSelection({ type: "none" }), [changeSelection]);

  const showExpand = selection.type === "node" && !!adapter.expandNode;

  const actions = React.useMemo<GraphExplorerActions>(() => {
    return {
      refetch: () => void query.refetch(),
      clearSelection: () => changeSelection({ type: "none" }),
      selectNode: (nodeId: string) => changeSelection({ type: "node", id: nodeId }),
      selectEdge: (edgeId: string) => changeSelection({ type: "edge", id: edgeId }),
      expandSelectedNode: () => {
        if (selection.type !== "node") {return;}
        if (!adapter.expandNode) {return;}
        expandNode.mutate(selection.id);
      },
    };
  }, [adapter.expandNode, changeSelection, expandNode, query, selection]);

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[1fr_360px]", className)}>
      <div className="min-w-0">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-foreground">Graph Explorer</div>
              <Badge variant="secondary">
                {formatCount(graph.nodes.length)} nodes · {formatCount(graph.edges.length)} edges
              </Badge>
              {query.isFetching && <Badge variant="outline">Loading…</Badge>}
              {expandNode.isPending && <Badge variant="outline">Expanding…</Badge>}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search nodes…"
                  className="pl-8"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={actions.clearSelection}
                disabled={selection.type === "none"}
              >
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          {query.error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {query.error instanceof Error ? query.error.message : String(query.error)}
            </div>
          )}

          <div className={cn("min-h-[520px] w-full overflow-hidden rounded-xl border border-border bg-background", graphClassName)} style={graphStyle}>
            <ReagraphView
              graph={filteredGraph}
              className="h-full w-full"
              onNodeClick={onGraphNodeClick}
              onEdgeClick={onGraphEdgeClick}
              onCanvasClick={onGraphCanvasClick}
              reagraphProps={reagraphProps}
            />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between p-4">
            <div className="text-sm font-medium text-foreground">Details</div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" title="Fit view (renderer-dependent)" disabled>
                <Maximize2 className="h-4 w-4" />
              </Button>
              {showExpand && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={actions.expandSelectedNode}
                  disabled={expandNode.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Expand
                </Button>
              )}
            </div>
          </div>
          <Separator />
          <ScrollArea className="h-[560px] p-4">
            {selection.type === "none" && (
              <div className="text-sm text-muted-foreground">
                Click a node or edge to inspect it. Use the adapter hooks to fetch details and to expand neighbors.
              </div>
            )}

            {selection.type === "node" && selectedNode && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Node</div>
                  <div className="font-medium">{selectedNode.label ?? selectedNode.id}</div>
                  <div className="text-xs text-muted-foreground font-mono">{selectedNode.id}</div>
                </div>

                {adapter.loadNodeDetails ? (
                  renderNodeDetails ? (
                  renderNodeDetails({
                      nodeId: selectedNode.id,
                      node: selectedNode,
                      details: (nodeDetailsQuery.data ?? null) as TNodeDetails | null,
                      actions,
                    })
                  ) : (
                    <pre className="whitespace-pre-wrap rounded-xl border border-border bg-background p-3 text-xs">
                      {JSON.stringify(nodeDetailsQuery.data ?? null, null, 2)}
                    </pre>
                  )
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Provide <code className="font-mono">adapter.loadNodeDetails</code> to populate this panel.
                  </div>
                )}
              </div>
            )}

            {selection.type === "edge" && selectedEdge && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Edge</div>
                  <div className="font-medium">{selectedEdge.label ?? selectedEdge.id}</div>
                  <div className="text-xs text-muted-foreground font-mono">{selectedEdge.id}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedEdge.source} → {selectedEdge.target}
                  </div>
                </div>

                {adapter.loadEdgeDetails ? (
                  renderEdgeDetails ? (
                  renderEdgeDetails({
                      edgeId: selectedEdge.id,
                      edge: selectedEdge,
                      details: (edgeDetailsQuery.data ?? null) as TEdgeDetails | null,
                      actions,
                    })
                  ) : (
                    <pre className="whitespace-pre-wrap rounded-xl border border-border bg-background p-3 text-xs">
                      {JSON.stringify(edgeDetailsQuery.data ?? null, null, 2)}
                    </pre>
                  )
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Provide <code className="font-mono">adapter.loadEdgeDetails</code> to populate this panel.
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
