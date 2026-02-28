/**
 * Event Ledger core types.
 *
 * Every event recorded in the ledger uses the canonical EventEnvelope schema.
 * Families group related event types for filtering and retention.
 */

import type { ISOTimestamp } from "@openclaw/ocx-platform";

// ---------------------------------------------------------------------------
// Event families — groups related event types
// ---------------------------------------------------------------------------

export type EventFamily =
  | "model"
  | "tool"
  | "session"
  | "message"
  | "subagent"
  | "prompt"
  | "budget"
  | "orchestration"
  | "evaluation"
  | "system";

// ---------------------------------------------------------------------------
// EventEnvelope — the canonical event wrapper
// ---------------------------------------------------------------------------

export type EventEnvelope = {
  /** Monotonic event ID within the ledger instance */
  eventId: string;
  /** ISO-8601 timestamp */
  ts: ISOTimestamp;
  /** Schema version for this envelope format */
  version: 1;
  /** Event family — groups related event types */
  family: EventFamily;
  /** Specific event type within the family */
  type: string;
  /** Agent run that produced this event */
  runId: string;
  /** Root run of the subagent chain (for lineage joins) */
  lineageId?: string;
  /** Session key for session-scoped queries */
  sessionKey?: string;
  /** Agent ID */
  agentId?: string;
  /** OTEL trace context (populated by observability plugin) */
  traceId?: string;
  spanId?: string;
  /** Typed payload — schema depends on family+type */
  data: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// RunSummary — materialized summary for a completed run
// ---------------------------------------------------------------------------

export type RunSummaryOutcome = "completed" | "error" | "timeout" | "killed";

export type RunSummary = {
  runId: string;
  lineageId?: string;
  agentId: string;
  sessionKey: string;
  startedAt: ISOTimestamp;
  endedAt: ISOTimestamp;
  durationMs: number;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  toolCalls: number;
  toolFailures: number;
  outcome: RunSummaryOutcome;
};

// ---------------------------------------------------------------------------
// Query filter used by queryEvents
// ---------------------------------------------------------------------------

export type EventQueryFilter = {
  family?: EventFamily;
  type?: string;
  runId?: string;
  sessionKey?: string;
  agentId?: string;
  /** ISO-8601 inclusive lower bound */
  from?: ISOTimestamp;
  /** ISO-8601 inclusive upper bound */
  to?: ISOTimestamp;
  /** Pagination: number of events to return (default 100) */
  limit?: number;
  /** Pagination: opaque cursor from a previous response */
  cursor?: string;
};

export type EventQueryResult = {
  events: EventEnvelope[];
  /** Opaque cursor for the next page; undefined when no more results */
  nextCursor?: string;
};
