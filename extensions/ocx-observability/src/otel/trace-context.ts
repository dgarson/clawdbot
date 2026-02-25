/**
 * Trace context generation and propagation.
 *
 * Generates traceId from lineageId (deterministic) or random, and random spanIds.
 * Stores per-run trace context for propagation via core C2 fields.
 */

import { createHash, randomBytes } from "node:crypto";

// =============================================================================
// Trace Context
// =============================================================================

export type TraceContext = {
  traceId: string;
  spanId: string;
};

/**
 * In-memory map of runId -> TraceContext.
 * Cleared when runs complete.
 */
const runTraceContexts = new Map<string, TraceContext>();

// =============================================================================
// Generation
// =============================================================================

/**
 * Generate a 32-character hex trace ID.
 * If a lineageId is provided, derive deterministically via SHA-256.
 * Otherwise generate a random 16-byte trace ID.
 */
export function generateTraceId(lineageId?: string): string {
  if (lineageId) {
    return deriveTraceId(lineageId);
  }
  return randomBytes(16).toString("hex");
}

/**
 * Derive a deterministic trace ID from a lineage ID.
 * Uses the first 16 bytes of SHA-256(lineageId) as the trace ID.
 */
export function deriveTraceId(lineageId: string): string {
  const hash = createHash("sha256").update(lineageId).digest("hex");
  return hash.slice(0, 32);
}

/**
 * Generate a random 16-character hex span ID (8 bytes).
 */
export function generateSpanId(): string {
  return randomBytes(8).toString("hex");
}

// =============================================================================
// Run Context Storage
// =============================================================================

/** Store trace context for a given runId. */
export function setRunTraceContext(runId: string, ctx: TraceContext): void {
  runTraceContexts.set(runId, ctx);
}

/** Retrieve trace context for a given runId. */
export function getRunTraceContext(runId: string): TraceContext | undefined {
  return runTraceContexts.get(runId);
}

/** Remove trace context when a run completes. */
export function clearRunTraceContext(runId: string): void {
  runTraceContexts.delete(runId);
}

/** Clear all stored trace contexts (used on shutdown). */
export function clearAllTraceContexts(): void {
  runTraceContexts.clear();
}
