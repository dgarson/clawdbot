import type { MemoryContentObject } from "../models/memory.js";
import type { MemClawdIngestEvent } from "./events.js";

export type MemClawdIngestionStage =
  | "normalize"
  | "extract"
  | "classify"
  | "enrich"
  | "entity_extract"
  | "embed"
  | "graph_write"
  | "vector_index"
  | "audit";

export type MemClawdPipelineErrorCode =
  | "not_configured"
  | "invalid_input"
  | "adapter_unavailable"
  | "rate_limited"
  | "timeout"
  | "upstream_error"
  | "serialization_error"
  | "unknown";

export type MemClawdPipelineError = {
  code: MemClawdPipelineErrorCode;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
};

export type MemClawdStageResult = {
  stage: MemClawdIngestionStage;
  ok: boolean;
  durationMs?: number;
  error?: MemClawdPipelineError;
  output?: MemoryContentObject[];
};

export type MemClawdIngestRunStatus = "queued" | "running" | "completed" | "failed";

export type MemClawdIngestRun = {
  runId: string;
  eventId: string;
  status: MemClawdIngestRunStatus;
  stages: MemClawdIngestionStage[];
  stageResults?: MemClawdStageResult[];
  errors?: MemClawdPipelineError[];
  startedAt?: string;
  completedAt?: string;
};

export type MemClawdIngestRequest = {
  event: MemClawdIngestEvent;
  sync?: boolean;
};

export type MemClawdIngestResponse = {
  runId: string;
  status: MemClawdIngestRunStatus;
  acceptedAt: string;
};
