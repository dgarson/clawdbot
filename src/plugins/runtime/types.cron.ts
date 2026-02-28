/**
 * runtime.cron namespace types (#7).
 * Interval-based in-process scheduler for plugins.
 * Extracted to keep types.ts focused on the high-level PluginRuntime shape.
 */

export type PluginCronNamespace = {
  /**
   * Schedule a periodic handler that fires every `intervalMs` milliseconds.
   * `id` is plugin-scoped — duplicate IDs replace the previous schedule.
   * The handler must not throw; uncaught errors are swallowed with a warning.
   */
  schedule(id: string, intervalMs: number, handler: () => void | Promise<void>): void;
  /** Cancel a scheduled handler by ID. No-op if not found. */
  cancel(id: string): void;
  /** List all active schedule IDs for this plugin. */
  list(): string[];
};
