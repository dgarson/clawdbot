/**
 * OpenClaw Telemetry — barrel export.
 */

// SDK lifecycle
export { initOtel, shutdownOtel, isOtelEnabled, type OtelInitConfig } from "./otel.js";

// Tracing
export { getTracer, withSpan, withSpanSync, setSpanAttributes, getActiveSpan } from "./tracer.js";

// Metrics
export {
  getMeter,
  getMetrics,
  recordSessionStart,
  recordSessionEnd,
  recordTokenUsage,
  recordSessionCost,
  recordToolCall,
  recordModelError,
  resetMetricsCache,
  type OpenClawMetrics,
  type SessionMetricAttrs,
} from "./metrics.js";

// Structured logging
export { getAgentLogger, getGatewayLogger, flushLoggers } from "./logger.js";
