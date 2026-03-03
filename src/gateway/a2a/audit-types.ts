/**
 * Agent-to-Agent (A2A) Communication Protocol — Audit Types
 *
 * Types for the audit logging and query subsystem.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

// ─── Lightweight A2A Message Interface ───────────────────────────────────────
// This is a minimal interface matching the A2A envelope shape.
// When Workstream A types are integrated, this can be replaced with the full
// A2AMessage import. For now, we keep the audit module independent.

export interface A2AMessageLike {
  protocol: string;
  messageId: string;
  timestamp: string;
  from: { agentId: string; role: string; sessionKey?: string };
  to: { agentId: string; role: string; sessionKey?: string };
  type: string;
  priority: string;
  correlationId?: string | null;
  payload: Record<string, unknown>;
}

// ─── Audit Entry ─────────────────────────────────────────────────────────────

export type DeliveryStatus = "delivered" | "failed" | "pending" | "dropped";

export interface AuditEntryMeta {
  /** When the audit system received this message */
  receivedAt: string;
  /** Delivery outcome */
  deliveryStatus: DeliveryStatus;
  /** How long message processing took (ms) */
  processingTimeMs: number;
  /** Hostname or node where the message was processed */
  processedBy?: string;
}

export interface AuditEntry {
  /** The full A2A message */
  message: A2AMessageLike;
  /** Audit metadata */
  meta: AuditEntryMeta;
}

// ─── Query Filters ───────────────────────────────────────────────────────────

export interface AuditQueryFilters {
  /** Filter by agent (matches both from.agentId and to.agentId) */
  agentId?: string;
  /** Filter by message type */
  type?: string;
  /** Filter messages from this timestamp onward (ISO 8601) */
  since?: string;
  /** Filter messages up to this timestamp (ISO 8601) */
  until?: string;
  /** Filter by correlation ID */
  correlationId?: string;
  /** Filter by priority */
  priority?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip (for pagination) */
  offset?: number;
}

// ─── Query Result ────────────────────────────────────────────────────────────

export interface AuditQueryResult {
  /** Matching entries */
  entries: AuditEntry[];
  /** Total count matching filters (before limit/offset) */
  totalCount: number;
  /** Applied filters (echoed back for clarity) */
  filters: AuditQueryFilters;
}
