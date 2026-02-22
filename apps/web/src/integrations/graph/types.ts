export type GraphNode<TData = unknown> = {
  id: string;
  label?: string;
  kind?: string;
  data?: TData;
};

export type GraphEdge<TData = unknown> = {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind?: string;
  data?: TData;
};

export type GraphData<TNodeData = unknown, TEdgeData = unknown> = {
  nodes: Array<GraphNode<TNodeData>>;
  edges: Array<GraphEdge<TEdgeData>>;
};

export type GraphSelection =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | { type: "none" };

export type GraphLoadContext = {
  signal: AbortSignal;
};

export type GraphExpandContext = {
  signal: AbortSignal;
};

export type GraphExpandResult<TNodeData = unknown, TEdgeData = unknown> = GraphData<
  TNodeData,
  TEdgeData
>;

export interface GraphExplorerAdapter<
  TParams,
  TNodeData = unknown,
  TEdgeData = unknown,
  TNodeDetails = unknown,
  TEdgeDetails = unknown,
> {
  queryKey: (params: TParams) => readonly unknown[];
  loadGraph: (params: TParams, ctx: GraphLoadContext) => Promise<GraphData<TNodeData, TEdgeData>>;

  loadNodeDetails?: (nodeId: string, params: TParams, ctx: GraphLoadContext) => Promise<TNodeDetails>;
  loadEdgeDetails?: (edgeId: string, params: TParams, ctx: GraphLoadContext) => Promise<TEdgeDetails>;

  expandNode?: (nodeId: string, params: TParams, ctx: GraphExpandContext) => Promise<GraphExpandResult<TNodeData, TEdgeData>>;

  mergeGraph?: (
    base: GraphData<TNodeData, TEdgeData>,
    patch: GraphExpandResult<TNodeData, TEdgeData>
  ) => GraphData<TNodeData, TEdgeData>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function mergeGraphById<TNodeData, TEdgeData>(
  base: GraphData<TNodeData, TEdgeData>,
  patch: GraphExpandResult<TNodeData, TEdgeData>
): GraphData<TNodeData, TEdgeData> {
  const nodeById = new Map(base.nodes.map((n) => [n.id, n] as const));
  const edgeById = new Map(base.edges.map((e) => [e.id, e] as const));

  for (const node of patch.nodes) {nodeById.set(node.id, node);}
  for (const edge of patch.edges) {edgeById.set(edge.id, edge);}

  return {
    nodes: [...nodeById.values()],
    edges: [...edgeById.values()],
  };
}

export function normalizeSelection(input: unknown): GraphSelection {
  if (!isRecord(input)) {return { type: "none" };}
  const type = input.type;
  const id = input.id;
  if (type === "node" && typeof id === "string") {return { type: "node", id };}
  if (type === "edge" && typeof id === "string") {return { type: "edge", id };}
  return { type: "none" };
}

