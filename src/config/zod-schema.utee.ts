/**
 * Zod schema for UTEE (Unified Tool Execution Envelope) configuration.
 */

import { z } from "zod";

/**
 * UTEE Phase 1 configuration schema.
 */
export const UteeSchema = z
  .object({
    /**
     * Enable UTEE Phase 1 observability layer.
     * Default: false (disabled until explicitly enabled).
     */
    enabled: z.boolean().optional(),
    /**
     * Log level for UTEE structured logs.
     * Default: "debug" (non-intrusive).
     */
    logLevel: z.enum(["debug", "info", "warn", "error"]).optional(),
    /**
     * Enable metrics collection.
     */
    metrics: z
      .object({
        enabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
    /**
     * Enable trace context propagation across async boundaries.
     */
    tracePropagation: z
      .object({
        enabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
