/**
 * UTEE (Unified Tool Execution Envelope) configuration types.
 *
 * Phase 1 configuration for the observability pass-through adapter layer.
 */

/**
 * UTEE Phase 1 configuration.
 */
export type UteeConfig = {
  /**
   * Enable UTEE Phase 1 observability layer.
   * When enabled, all tool invocations will emit structured logs and metrics.
   * Default: false (disabled until explicitly enabled).
   */
  enabled?: boolean;

  /**
   * Log level for UTEE structured logs.
   * Default: "debug" (non-intrusive).
   */
  logLevel?: "debug" | "info" | "warn" | "error";

  /**
   * Enable metrics collection.
   * Default: true when utee.enabled is true.
   */
  metrics?: {
    enabled?: boolean;
  };

  /**
   * Enable trace context propagation across async boundaries.
   * Requires Node.js AsyncLocalStorage.
   * Default: true when utee.enabled is true.
   */
  tracePropagation?: {
    enabled?: boolean;
  };
};
