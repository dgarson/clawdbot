/**
 * All telemetry event kinds produced by the collector.
 * See docs/design/telemetry/00-architecture-overview.md §5.
 */
export type TelemetryEventKind =
  | "session.start"
  | "session.end"
  | "run.start"
  | "run.end"
  | "llm.input"
  | "llm.output"
  | "llm.call" // per-call usage snapshot from model.call diagnostic event
  | "tool.start"
  | "tool.end"
  | "message.inbound"
  | "message.outbound"
  | "subagent.spawn"
  | "subagent.stop"
  | "subagent.end"
  | "compaction.start"
  | "compaction.end"
  | "usage.snapshot" // per-call usage delta from model.usage diagnostic event
  | "error";

/**
 * A reference to an externalized blob file for large tool inputs/outputs.
 */
export type BlobRef = {
  /** Unique blob identifier (matches filename stem) */
  id: string;
  /** Absolute path to the blob file */
  path: string;
  /** Size in bytes */
  size: number;
  /** Optional content hash (sha256 hex) */
  hash?: string;
  /** Human-readable role: "input" | "result" */
  role?: string;
};

/**
 * Unified telemetry event schema. All events (regardless of hook/stream source)
 * are normalized into this shape before being written to JSONL.
 */
export type TelemetryEvent = {
  // Identity
  /** Unique event ID (evt_<random>) */
  id: string;
  /** Unix timestamp (ms) */
  ts: number;
  /** Monotonic sequence number within the current writer session */
  seq: number;

  // Correlation
  /** Agent that owns this event */
  agentId: string;
  /** Session key */
  sessionKey: string;
  /** Session UUID */
  sessionId: string;
  /** Run UUID — absent for session-level events */
  runId?: string;

  // Classification
  kind: TelemetryEventKind;
  /** Sub-classification (e.g. agent event stream name) */
  stream?: string;

  // Payload
  /** Event-specific data */
  data: Record<string, unknown>;
  /** Present when the event represents a failure */
  error?: {
    message: string;
    code?: string;
    stack?: string;
    /** Which component errored (tool | llm | compaction | agent) */
    source?: string;
  };

  // Provenance
  source: "hook" | "agent_event" | "diagnostic_event";
  /** Hook name when source is "hook" */
  hookName?: string;

  /** References to externalized blobs (large tool I/O) */
  blobRefs?: BlobRef[];
};

/**
 * Plugin configuration shape. Mirrors the JSON schema in openclaw.plugin.json.
 */
export type TelemetryConfig = {
  enabled?: boolean;
  captureToolResults?: "none" | "summary" | "full";
  captureToolInputs?: "none" | "summary" | "full";
  captureLlmPayloads?: boolean;
  rotationPolicy?: "daily" | "weekly" | "none";
  retentionDays?: number;
  blobThresholdBytes?: number;
  dataDir?: string;
};
