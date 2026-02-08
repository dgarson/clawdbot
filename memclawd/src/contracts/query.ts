import type { MemoryContentObject } from "../models/memory.js";

export type MemClawdQueryMode = "hybrid" | "vector" | "graph" | "keyword";

export type MemClawdGraphTraversalRequest = {
  nodeIds: string[];
  depth: number;
  edgeTypes?: string[];
};

export type MemClawdQueryContextPackRequest = {
  includeSources?: boolean;
  maxTokens?: number;
};

export type MemClawdQueryRequest = {
  query: string;
  agentId?: string;
  sessionKey?: string;
  limit?: number;
  filters?: Record<string, unknown>;
  mode?: MemClawdQueryMode;
  topK?: number;
  graphTraversal?: MemClawdGraphTraversalRequest;
  contextPack?: MemClawdQueryContextPackRequest;
};

export type MemClawdContextPack = {
  packId: string;
  text: string;
  sources?: MemoryContentObject[];
};

export type MemClawdGraphNode = {
  id: string;
  label: string;
  properties?: Record<string, unknown>;
};

export type MemClawdGraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties?: Record<string, unknown>;
};

export type MemClawdGraphTraversalResult = {
  nodes: MemClawdGraphNode[];
  edges: MemClawdGraphEdge[];
};

export type MemClawdQueryResult = {
  queryId: string;
  results: Array<
    MemoryContentObject & { score?: number; source?: MemClawdQueryMode | (string & {}) }
  >;
  contextPacks?: MemClawdContextPack[];
  graph?: MemClawdGraphTraversalResult;
  latencyMs?: number;
};
