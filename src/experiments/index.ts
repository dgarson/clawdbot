/**
 * A/B Testing + Experiment Tracking module.
 *
 * Provides deterministic feature flag evaluation and experiment variant
 * assignment with OpenTelemetry span integration.
 *
 * @module experiments
 */

export {
  ExperimentManager,
  type Experiment,
  type ExperimentContext,
  type ExperimentsConfig,
} from "./flags.ts";

export {
  setExperimentSpanAttributes,
  EXPERIMENT_SPAN_ATTRIBUTES,
  type SpanLike,
} from "./context.ts";

export {
  type ExperimentTelemetryEvent,
  type ExperimentTelemetryBatch,
  validateExperimentEvent,
} from "./schema.ts";
