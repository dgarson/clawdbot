/**
 * Memory Operations Log — types and event shapes.
 *
 * Structured JSONL-based diagnostic log for all memory subsystem operations:
 * queries, ingestion, graphiti interactions, progressive store mutations, sync events.
 */

// ─── Actions ────────────────────────────────────────────────────────────────

export type MemoryOpsAction =
  | "query.start"
  | "query.backend_result"
  | "query.merged"
  | "query.delivered"
  | "ingest.start"
  | "ingest.stage_complete"
  | "ingest.complete"
  | "graphiti.query"
  | "graphiti.ingest"
  | "graphiti.health"
  | "progressive.store"
  | "progressive.recall"
  | "progressive.dedup"
  | "progressive.merge"
  | "sync.start"
  | "sync.file_indexed"
  | "sync.file_skipped"
  | "sync.complete"
  | "context_pack.build"
  | "feedback.evaluated";

// ─── Core event ─────────────────────────────────────────────────────────────

export type MemoryOpsEvent = {
  id: string;
  ts: string;
  action: MemoryOpsAction;
  sessionKey?: string;
  traceId?: string;
  runId?: string;
  backend?: string;
  status: "success" | "failure" | "partial";
  durationMs?: number;
  detail: Record<string, unknown>;
};

// ─── Typed detail shapes ────────────────────────────────────────────────────

export type QueryStartDetail = {
  query: string;
  maxResults?: number;
  minScore?: number;
  intent?: { entities: string[]; topics: string[]; timeHints: unknown[] };
  activeBackends: string[];
};

export type QueryBackendResultDetail = {
  backend: string;
  weight: number;
  resultCount: number;
  results: Array<{
    path: string;
    score: number;
    snippetPreview: string;
    startLine: number;
    endLine: number;
  }>;
  error?: string;
};

export type QueryMergedDetail = {
  totalBeforeDedup: number;
  totalAfterDedup: number;
  dedupStats: {
    duplicatesRemoved: number;
    byBackend: Record<string, number>;
  };
  finalResults: Array<{
    path: string;
    score: number;
    snippetPreview: string;
  }>;
};

export type GraphitiQueryDetail = {
  query: string;
  limit?: number;
  factCount: number;
  nodeIds: string[];
  episodeIds: string[];
};

export type GraphitiIngestDetail = {
  episodeCount: number;
  nodeCount: number;
  edgeCount: number;
  episodeIds: string[];
  warnings?: string[];
};

export type SyncFileDetail = {
  path: string;
  reason: "new" | "hash-changed" | "stale-removed";
  chunkCount?: number;
};

export type ProgressiveStoreDetail = {
  id: string;
  category: string;
  deduplicated: boolean;
  mergedWithId?: string;
  tokenCost: number;
};

export type ProgressiveRecallDetail = {
  query: string;
  resultCount: number;
  topScores: number[];
};

export type IngestStageDetail = {
  stage: string;
  ok: boolean;
  durationMs: number;
  itemCount?: number;
  error?: string;
};

// ─── Query params ───────────────────────────────────────────────────────────

export type MemoryOpsQueryParams = {
  action?: MemoryOpsAction;
  backend?: string;
  traceId?: string;
  sessionKey?: string;
  status?: "success" | "failure" | "partial";
  startTs?: string;
  endTs?: string;
  limit?: number;
  offset?: number;
};

export type MemoryOpsQueryResult = {
  events: MemoryOpsEvent[];
  total: number;
  hasMore: boolean;
};

// ─── Constants ──────────────────────────────────────────────────────────────

export const MEMORY_OPS_RETENTION_DAYS = 30;
export const MAX_MEMORY_OPS_EVENTS_PER_QUERY = 500;

/** Max characters for snippet previews in ops events. */
export const SNIPPET_PREVIEW_LENGTH = 120;
