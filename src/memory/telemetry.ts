export type MemoryMetricName =
  | "memory.pipeline.events"
  | "memory.pipeline.errors"
  | "memory.ingest.duration_ms"
  | "memory.query.duration_ms"
  | "memory.context_pack.duration_ms";

export type MemoryMetricEvent = {
  name: MemoryMetricName;
  value: number;
  ts: string;
  tags?: Record<string, string>;
};

export type MemoryAuditEvent = {
  id: string;
  ts: string;
  actor?: string;
  action:
    | "ingest"
    | "query"
    | "context_pack"
    | "graph_write"
    | "graph_query"
    | "vector_write"
    | "vector_query";
  sessionKey?: string;
  traceId?: string;
  status: "success" | "failure";
  details?: Record<string, unknown>;
};
