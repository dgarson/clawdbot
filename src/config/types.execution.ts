/**
 * Execution layer configuration types.
 *
 * @see src/execution/types.ts for the canonical type definitions
 * @see docs/design/plans/opus/01-agent-execution-layer.md
 */

/**
 * Per-entry-point feature flags for gradual migration.
 * Each entry point can be migrated independently with its own flag.
 */
export type ExecutionEntryPointFlags = {
  /** Enable for CLI agent command (src/commands/agent.ts). */
  cli?: boolean;
  /** Enable for auto-reply runner (src/auto-reply/reply/agent-runner-execution.ts). */
  autoReply?: boolean;
  /** Enable for followup runner (src/auto-reply/reply/followup-runner.ts). */
  followup?: boolean;
  /** Enable for cron runner (src/cron/isolated-agent/run.ts). */
  cron?: boolean;
  /** Enable for hybrid planner (src/agents/hybrid-planner.ts). */
  hybridPlanner?: boolean;
};

/**
 * Execution layer configuration.
 */
export type ExecutionConfig = {
  /**
   * Per-entry-point feature flags for gradual migration.
   * Each flag controls whether that entry point uses the new ExecutionKernel.
   * Default: all false (use legacy paths).
   */
  useNewLayer?: ExecutionEntryPointFlags;

  /**
   * Global kill switch to disable new layer for all entry points.
   * When false, all entry points use legacy paths regardless of per-entry flags.
   * Default: true (per-entry flags are respected).
   */
  enabled?: boolean;
};
