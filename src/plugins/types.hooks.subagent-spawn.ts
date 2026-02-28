/**
 * before_subagent_spawn hook types (#4).
 * Fires before every subagent spawn (unlike subagent_spawning which only fires
 * for thread-binding spawns). Allows plugins to gate, redirect, or enrich spawns.
 * Extracted to keep types.ts focused. types.ts re-exports from here.
 */

export type PluginHookBeforeSubagentSpawnEvent = {
  agentId: string;
  task: string;
  label?: string;
  mode: "run" | "session";
  /** Spawn depth of the requester (0 = top-level agent spawning a child). */
  spawnDepth: number;
  requesterSessionKey?: string;
  isolated?: boolean;
};

export type PluginHookBeforeSubagentSpawnResult = {
  /**
   * When true the spawn is rejected before any resources are allocated.
   * The caller receives `{ status: "error", error: rejectReason }`.
   */
  reject?: boolean;
  /** Internal rejection reason (logged, not shown to the end user). */
  rejectReason?: string;
  /** Override the target agent ID (e.g. redirect to a specialist agent). */
  agentIdOverride?: string;
  /** Override the task prompt passed to the child agent. */
  taskOverride?: string;
  /**
   * Metadata to merge into the child agent's spawn params.
   * Useful for budget tracking, team labels, escalation context, etc.
   */
  metadataOverride?: Record<string, unknown>;
};
