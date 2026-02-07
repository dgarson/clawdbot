export type GraphitiNodeDTO = {
  id: string;
  label: string;
  properties?: Record<string, unknown>;
};

export type GraphitiEdgeDTO = {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  properties?: Record<string, unknown>;
};

export type GraphitiIngestRequest = {
  nodes: GraphitiNodeDTO[];
  edges: GraphitiEdgeDTO[];
  source?: string;
  traceId?: string;
};

export type GraphitiIngestResponse = {
  ok: boolean;
  nodeCount: number;
  edgeCount: number;
  error?: string;
};

export type GraphitiQueryRequest = {
  query: string;
  limit?: number;
  filters?: Record<string, unknown>;
  traceId?: string;
};

export type GraphitiQueryResponse = {
  nodes: GraphitiNodeDTO[];
  edges: GraphitiEdgeDTO[];
  latencyMs?: number;
  error?: string;
};

export interface GraphitiAdapter {
  ingest(request: GraphitiIngestRequest): Promise<GraphitiIngestResponse>;
  query(request: GraphitiQueryRequest): Promise<GraphitiQueryResponse>;
  health?(): Promise<{ ok: boolean; message?: string }>;
}
