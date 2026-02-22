/**
 * Telemetry event schema extensions for A/B experiment tracking.
 *
 * These types define the shape of telemetry events that carry
 * experiment context alongside measured metrics. They complement
 * the base telemetry event schema (Drew's UTEE spec) with
 * experiment-specific fields.
 */

/**
 * A telemetry event that includes experiment context and a measured metric.
 *
 * Used to record outcomes (latency, success rate, cost, quality score, etc.)
 * alongside the experiment assignment, enabling per-variant metric comparison
 * in Grafana dashboards.
 *
 * @example
 * ```ts
 * const event: ExperimentTelemetryEvent = {
 *   experimentId: 'model-routing-test-2026-02',
 *   variant: 'gpt4-routing',
 *   cohort: 'a3f8b2c1d4e5',
 *   metric: 'response_latency_ms',
 *   value: 342,
 * }
 * ```
 */
export interface ExperimentTelemetryEvent {
  /** The experiment this event belongs to */
  experimentId: string;
  /** The variant the subject was assigned to */
  variant: string;
  /** Stable cohort identifier (hash-based) */
  cohort: string;
  /** Name of the metric being measured (e.g. "response_latency_ms", "success_rate") */
  metric: string;
  /** Numeric value of the measurement */
  value: number;
}

/**
 * Batch of experiment telemetry events for bulk export.
 */
export interface ExperimentTelemetryBatch {
  /** ISO-8601 timestamp when the batch was created */
  timestamp: string;
  /** Source agent or service that generated these events */
  source: string;
  /** The events in this batch */
  events: ExperimentTelemetryEvent[];
}

/**
 * Validates that an ExperimentTelemetryEvent has all required fields
 * and sensible values.
 */
export function validateExperimentEvent(event: ExperimentTelemetryEvent): string[] {
  const errors: string[] = [];

  if (!event.experimentId || event.experimentId.trim() === "") {
    errors.push("experimentId is required");
  }
  if (!event.variant || event.variant.trim() === "") {
    errors.push("variant is required");
  }
  if (!event.cohort || event.cohort.trim() === "") {
    errors.push("cohort is required");
  }
  if (!event.metric || event.metric.trim() === "") {
    errors.push("metric is required");
  }
  if (typeof event.value !== "number" || Number.isNaN(event.value)) {
    errors.push("value must be a valid number");
  }

  return errors;
}
