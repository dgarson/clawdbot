/**
 * Attach experiment context to OpenTelemetry spans.
 *
 * Works with the OTel Span interface from @opentelemetry/api.
 * OBS-01 is adding `src/telemetry/tracer.ts` with span helpers —
 * this module is designed to integrate with those spans.
 */

import type { ExperimentContext } from "./flags.ts";

/**
 * Minimal Span interface — compatible with @opentelemetry/api Span.
 * We define this locally to avoid a hard dependency on the OTel package
 * until OBS-01 merges. Any object with setAttribute works.
 */
export interface SpanLike {
  setAttribute(key: string, value: string | number | boolean): void;
}

/**
 * Semantic attribute keys for experiment context on OTel spans.
 * Following OpenTelemetry semantic conventions style (dot-separated namespace).
 */
export const EXPERIMENT_SPAN_ATTRIBUTES = {
  EXPERIMENT_ID: "experiment.id",
  EXPERIMENT_VARIANT: "experiment.variant",
  EXPERIMENT_COHORT: "experiment.cohort",
} as const;

/**
 * Sets experiment context attributes on an OpenTelemetry span.
 *
 * After calling this, the span will carry:
 * - `experiment.id` — the experiment identifier
 * - `experiment.variant` — the assigned variant name
 * - `experiment.cohort` — the stable cohort hash
 *
 * These attributes flow through to Jaeger/Grafana for filtering
 * and A/B comparison dashboards.
 *
 * @example
 * ```ts
 * import { withSpan } from '../telemetry/tracer.ts'
 * import { setExperimentSpanAttributes } from '../experiments/context.ts'
 *
 * await withSpan('handle-request', async (span) => {
 *   const ctx = manager.getVariant('model-routing-test', sessionId)
 *   if (ctx) setExperimentSpanAttributes(span, ctx)
 *   // ... rest of handler
 * })
 * ```
 */
export function setExperimentSpanAttributes(span: SpanLike, ctx: ExperimentContext): void {
  span.setAttribute(EXPERIMENT_SPAN_ATTRIBUTES.EXPERIMENT_ID, ctx.experimentId);
  span.setAttribute(EXPERIMENT_SPAN_ATTRIBUTES.EXPERIMENT_VARIANT, ctx.variant);
  span.setAttribute(EXPERIMENT_SPAN_ATTRIBUTES.EXPERIMENT_COHORT, ctx.cohort);
}
