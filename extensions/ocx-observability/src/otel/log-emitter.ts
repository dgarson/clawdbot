/**
 * Map agent events to OTEL log records with severity levels.
 *
 * Severity mapping per plan:
 *   system.error                  ERROR    Error message + code
 *   budget.admission (blocked)    WARN     "Budget exhausted for {scope}"
 *   tool.blocked                  WARN     "Tool {name} blocked: {reason}"
 *   subagent.ended (failed)       WARN     "Subagent {key} failed: {outcome}"
 *   model.fallback                INFO     "Provider fallback: {from} -> {to}"
 *   All others                    DEBUG    Event summary
 */

import type { SeverityNumber } from "@opentelemetry/api-logs";
import type { Logger as OtelLogger } from "@opentelemetry/api-logs";

type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };

// =============================================================================
// Severity Mapping
// =============================================================================

/**
 * OTEL SeverityNumber constants used for log emission.
 * Aligned with the OpenTelemetry specification.
 */
const SEVERITY = {
  DEBUG: 5 as SeverityNumber,
  INFO: 9 as SeverityNumber,
  WARN: 13 as SeverityNumber,
  ERROR: 17 as SeverityNumber,
} as const;

export type AgentLogEvent = {
  eventType: string;
  agentId: string;
  message: string;
  attributes?: Record<string, string | number | boolean>;
};

// =============================================================================
// Log Emitter
// =============================================================================

export type LogEmitter = {
  /** Emit a log record for an agent event. */
  emit(event: AgentLogEvent): void;
};

export function createLogEmitter(otelLogger: OtelLogger, logger: Logger): LogEmitter {
  return {
    emit(event) {
      try {
        const { severity, severityText } = resolveSeverity(event.eventType);
        const attributes: Record<string, string | number | boolean> = {
          "agent.id": event.agentId,
          "agent.event.type": event.eventType,
          ...(event.attributes ?? {}),
        };

        otelLogger.emit({
          body: event.message,
          severityNumber: severity,
          severityText,
          attributes,
          timestamp: new Date(),
        });
      } catch (err) {
        logger.warn(`observability: log emission failed for ${event.eventType}: ${String(err)}`);
      }
    },
  };
}

// =============================================================================
// Severity Resolution
// =============================================================================

type SeverityInfo = { severity: SeverityNumber; severityText: string };

function resolveSeverity(eventType: string): SeverityInfo {
  switch (eventType) {
    case "system.error":
      return { severity: SEVERITY.ERROR, severityText: "ERROR" };

    case "budget.admission.blocked":
    case "tool.blocked":
    case "subagent.ended.failed":
      return { severity: SEVERITY.WARN, severityText: "WARN" };

    case "model.fallback":
      return { severity: SEVERITY.INFO, severityText: "INFO" };

    default:
      return { severity: SEVERITY.DEBUG, severityText: "DEBUG" };
  }
}
