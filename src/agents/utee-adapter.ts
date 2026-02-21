/**
 * UTEE (Unified Tool Execution Envelope) - Phase 1
 *
 * This module provides an observability pass-through adapter layer for tool execution.
 * Phase 1 scope (strict):
 *   1. Auto-generate/propagate requestId + traceId/spanId metadata
 *   2. Structured logs for tool invocations
 *   3. Basic metrics hooks/counters
 *   4. Feature flag to enable/disable
 *
 * Guardrails (strict):
 *   - No behavior changes to existing tool result/error payloads
 *   - No retry/idempotency/capability negotiation (Phase 2+)
 *   - Keep blast radius minimal (additive only)
 *
 * @see /Users/openclaw/.openclaw/workspace/tim/memory/2026-02-21-utee-notes.md
 */

import { logDebug, logInfo } from "../logger.js";

// ============================================================================
// Types
// ============================================================================

/**
 * UTEE request metadata attached to each tool invocation.
 */
export type UteeRequestMeta = {
  /** Unique request ID (UUID v4) for correlation */
  requestId: string;
  /** Distributed trace ID propagated across calls */
  traceId: string;
  /** Current span ID for this tool call */
  spanId: string;
  /** Parent span ID if nested (optional) */
  parentSpanId?: string;
  /** ISO timestamp when the request started */
  startTime: string;
};

/**
 * UTEE response metadata added after tool execution completes.
 */
export type UteeResponseMeta = {
  /** Echoes the request ID */
  requestId: string;
  /** Echoes the trace ID */
  traceId: string;
  /** Span ID for this execution */
  spanId: string;
  /** Wall-clock execution time in milliseconds */
  durationMs: number;
  /** Execution status */
  status: "success" | "error";
};

/**
 * Structured log entry for tool invocation.
 */
export type UteeLogEntry = {
  timestamp: string;
  level: "info" | "debug" | "warn" | "error";
  event: "utee_tool_invocation" | "utee_tool_result";
  requestId: string;
  traceId: string;
  tool: string;
  action?: string;
  durationMs?: number;
  status?: "success" | "error";
  error?: string;
};

/**
 * Metrics counters for UTEE invocations.
 */
export type UteeMetrics = {
  /** Total invocations by tool name */
  invocationCount: Map<string, number>;
  /** Error count by tool name */
  errorCount: Map<string, number>;
  /** Total duration by tool name (for computing averages) */
  totalDurationMs: Map<string, number>;
  /** Max duration seen by tool name */
  maxDurationMs: Map<string, number>;
};

/**
 * Context passed through the UTEE adapter.
 */
export type UteeContext = {
  /** UTEE metadata for this invocation */
  utee: UteeRequestMeta;
  /** Session key for trace propagation (optional) */
  sessionKey?: string;
  /** Agent ID for trace propagation (optional) */
  agentId?: string;
};

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID if available, otherwise falls back to a secure random generator.
 */
function generateUuid(): string {
  // Node.js 16.7+ has crypto.randomUUID
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: generate from random bytes
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Last resort: use Math.random (less secure but works everywhere)
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  // Convert to hex string with hyphens
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generate a short span ID (8 hex chars).
 */
function generateSpanId(): string {
  const bytes = new Uint8Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 4; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a trace ID (16 hex chars, W3C-compatible).
 */
function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// Global State
// ============================================================================

/**
 * Global UTEE metrics instance.
 * In Phase 1, this is a simple in-memory store.
 * Phase 2+ may use Prometheus/OpenTelemetry exporters.
 */
export const uteeMetrics: UteeMetrics = {
  invocationCount: new Map(),
  errorCount: new Map(),
  totalDurationMs: new Map(),
  maxDurationMs: new Map(),
};

/**
 * Feature flag for UTEE Phase 1.
 * Can be toggled at runtime for rollback testing.
 */
let uteeEnabled = false;

/**
 * Check if UTEE Phase 1 is enabled.
 */
export function isUteeEnabled(): boolean {
  return uteeEnabled;
}

/**
 * Enable UTEE Phase 1.
 */
export function enableUtee(): void {
  uteeEnabled = true;
  logInfo("[UTEE] Phase 1 enabled");
}

/**
 * Disable UTEE Phase 1 (for rollback).
 */
export function disableUtee(): void {
  uteeEnabled = false;
  logInfo("[UTEE] Phase 1 disabled");
}

/**
 * Toggle UTEE Phase 1 on/off.
 */
export function setUteeEnabled(enabled: boolean): void {
  uteeEnabled = enabled;
  logInfo(`[UTEE] Phase 1 ${enabled ? "enabled" : "disabled"}`);
}

// ============================================================================
// Context Propagation
// ============================================================================

/**
 * Async local storage for UTEE context propagation across async boundaries.
 * This allows child tool calls to inherit parent trace IDs.
 */
let asyncLocalStorage: {
  getStore: () => Map<string, unknown> | undefined;
  run: (store: Map<string, unknown>, callback: () => unknown) => unknown;
} | null = null;

// Try to load Node.js AsyncLocalStorage with ESM-compatible approach.
// Uses createRequire for synchronous loading in ESM, with graceful fallback.
function initAsyncLocalStorage(): typeof asyncLocalStorage {
  // Check if we're in a Node.js environment
  if (typeof process === "undefined" || !process.versions?.node) {
    return null;
  }
  try {
    // Use createRequire for ESM compatibility (synchronous require in ESM)
    const { createRequire } = require("node:module");
    const nodeRequire = createRequire(import.meta.url);
    const { AsyncLocalStorage } = nodeRequire("async_hooks");
    return new AsyncLocalStorage();
  } catch {
    // AsyncLocalStorage not available (rare edge case, non-Node runtime)
    return null;
  }
}

asyncLocalStorage = initAsyncLocalStorage();

/**
 * Get the current trace context from async local storage.
 */
export function getCurrentUteeContext(): UteeContext | undefined {
  if (!asyncLocalStorage) {
    return undefined;
  }
  const store = asyncLocalStorage.getStore();
  if (!store) {
    return undefined;
  }
  return store.get("uteeContext") as UteeContext | undefined;
}

/**
 * Run a callback with a UTEE context in async local storage.
 */
export function runWithUteeContext<T>(ctx: UteeContext, callback: () => T): T {
  if (!asyncLocalStorage) {
    return callback();
  }
  const store = new Map<string, unknown>();
  store.set("uteeContext", ctx);
  return asyncLocalStorage.run(store, callback) as T;
}

// ============================================================================
// Metadata Generation
// ============================================================================

/**
 * Create UTEE request metadata for a new tool invocation.
 * Inherits trace ID from parent context if available.
 */
export function createUteeRequestMeta(parentContext?: UteeContext): UteeRequestMeta {
  const parentTraceId = parentContext?.utee.traceId;
  const parentSpanId = parentContext?.utee.spanId;

  return {
    requestId: generateUuid(),
    traceId: parentTraceId ?? generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: parentSpanId,
    startTime: new Date().toISOString(),
  };
}

/**
 * Create UTEE response metadata after tool execution completes.
 */
export function createUteeResponseMeta(
  requestMeta: UteeRequestMeta,
  durationMs: number,
  status: "success" | "error",
): UteeResponseMeta {
  return {
    requestId: requestMeta.requestId,
    traceId: requestMeta.traceId,
    spanId: requestMeta.spanId,
    durationMs,
    status,
  };
}

// ============================================================================
// Structured Logging
// ============================================================================

/**
 * Emit a structured UTEE log entry.
 */
function emitUteeLog(entry: UteeLogEntry): void {
  const level = entry.level;
  const message = `[UTEE] ${entry.event} tool=${entry.tool} requestId=${entry.requestId} traceId=${entry.traceId}`;

  switch (level) {
    case "info":
      logInfo(message);
      break;
    case "debug":
      logDebug(message);
      break;
    case "warn":
    case "error":
      logDebug(message); // Use debug for warn/error to avoid noise
      break;
  }
}

// ============================================================================
// Metrics Collection
// ============================================================================

/**
 * Increment a counter in the metrics map.
 */
function incrementCounter(map: Map<string, number>, key: string, delta = 1): void {
  const current = map.get(key) ?? 0;
  map.set(key, current + delta);
}

/**
 * Update a max value in the metrics map.
 */
function updateMax(map: Map<string, number>, key: string, value: number): void {
  const current = map.get(key) ?? 0;
  if (value > current) {
    map.set(key, value);
  }
}

/**
 * Record metrics for a tool invocation.
 */
function recordMetrics(toolName: string, durationMs: number, isError: boolean): void {
  const normalizedTool = normalizeToolName(toolName);

  incrementCounter(uteeMetrics.invocationCount, normalizedTool);
  incrementCounter(uteeMetrics.totalDurationMs, normalizedTool, durationMs);
  updateMax(uteeMetrics.maxDurationMs, normalizedTool, durationMs);

  if (isError) {
    incrementCounter(uteeMetrics.errorCount, normalizedTool);
  }
}

/**
 * Normalize tool name for metrics (lowercase, trimmed).
 */
function normalizeToolName(name: string): string {
  return name.trim().toLowerCase();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * UTEE Phase 1 invocation record.
 * Returned by wrapWithUtee for testing/inspection.
 */
export type UteeInvocationRecord = {
  requestMeta: UteeRequestMeta;
  responseMeta?: UteeResponseMeta;
  error?: Error;
};

/**
 * Create a wrapper function that adds UTEE observability to tool execution.
 *
 * This is the main entry point for Phase 1. It wraps a tool's execute function
 * with observability hooks WITHOUT changing the behavior of the tool.
 *
 * @param toolName - The name of the tool being wrapped
 * @param execute - The original execute function
 * @returns A wrapped execute function with UTEE observability
 */
export function wrapExecuteWithUtee<T>(toolName: string, execute: T): T {
  const normalizedTool = normalizeToolName(toolName);

  // Return a wrapper that maintains the original function signature
  // Use 'any' internally to avoid complex generic constraints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapper = async (...args: any[]): Promise<any> => {
    // If UTEE is disabled, pass through without any overhead
    if (!uteeEnabled) {
      return (execute as (...args: unknown[]) => unknown)(...args);
    }

    // Get parent context for trace propagation
    const parentContext = getCurrentUteeContext();
    const requestMeta = createUteeRequestMeta(parentContext);
    const startTime = Date.now();

    // Create context for this invocation
    const ctx: UteeContext = {
      utee: requestMeta,
    };

    // Log invocation start
    emitUteeLog({
      timestamp: requestMeta.startTime,
      level: "debug",
      event: "utee_tool_invocation",
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      tool: normalizedTool,
    });

    try {
      // Run with UTEE context for nested calls
      const result = await runWithUteeContext(ctx, () =>
        (execute as (...args: unknown[]) => unknown)(...args),
      );

      const durationMs = Date.now() - startTime;

      // Log successful result
      emitUteeLog({
        timestamp: new Date().toISOString(),
        level: "debug",
        event: "utee_tool_result",
        requestId: requestMeta.requestId,
        traceId: requestMeta.traceId,
        tool: normalizedTool,
        durationMs,
        status: "success",
      });

      // Record metrics
      recordMetrics(normalizedTool, durationMs, false);

      // Return original result unchanged (pass-through)
      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Log error result
      emitUteeLog({
        timestamp: new Date().toISOString(),
        level: "debug",
        event: "utee_tool_result",
        requestId: requestMeta.requestId,
        traceId: requestMeta.traceId,
        tool: normalizedTool,
        durationMs,
        status: "error",
        error: errorMessage,
      });

      // Record metrics
      recordMetrics(normalizedTool, durationMs, true);

      // Re-throw original error unchanged (pass-through)
      throw err;
    }
  };

  return wrapper as T;
}

/**
 * Get a snapshot of current UTEE metrics.
 * Useful for health checks and monitoring.
 */
export function getUteeMetricsSnapshot(): {
  invocationCount: Record<string, number>;
  errorCount: Record<string, number>;
  avgDurationMs: Record<string, number>;
  maxDurationMs: Record<string, number>;
} {
  const invocationCount: Record<string, number> = {};
  const errorCount: Record<string, number> = {};
  const avgDurationMs: Record<string, number> = {};
  const maxDurationMs: Record<string, number> = {};

  // Convert maps to plain objects
  for (const [tool, count] of uteeMetrics.invocationCount) {
    invocationCount[tool] = count;
  }
  for (const [tool, count] of uteeMetrics.errorCount) {
    errorCount[tool] = count;
  }
  for (const [tool, total] of uteeMetrics.totalDurationMs) {
    const invocations = uteeMetrics.invocationCount.get(tool) ?? 1;
    avgDurationMs[tool] = Math.round(total / invocations);
  }
  for (const [tool, max] of uteeMetrics.maxDurationMs) {
    maxDurationMs[tool] = max;
  }

  return {
    invocationCount,
    errorCount,
    avgDurationMs,
    maxDurationMs,
  };
}

/**
 * Reset UTEE metrics (useful for testing).
 */
export function resetUteeMetrics(): void {
  uteeMetrics.invocationCount.clear();
  uteeMetrics.errorCount.clear();
  uteeMetrics.totalDurationMs.clear();
  uteeMetrics.maxDurationMs.clear();
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const __testing = {
  generateUuid,
  generateSpanId,
  generateTraceId,
  asyncLocalStorage,
  uteeMetrics,
};
