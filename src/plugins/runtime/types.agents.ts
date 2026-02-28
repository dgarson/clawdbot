/**
 * runtime.agents namespace types (#2).
 * Extracted to keep types.ts focused on the high-level PluginRuntime shape.
 */

export type PluginAgentEntry = {
  /** Canonical agent identifier (normalized). */
  id: string;
  /** Human-readable label from agent config, if set. */
  label?: string;
  /** Arbitrary metadata from agent config. */
  metadata?: Record<string, unknown>;
  /** True when this agent is the default/primary agent. */
  isDefault?: boolean;
};

export type PluginAgentsNamespace = {
  /** List all configured agents. */
  list(): Promise<PluginAgentEntry[]>;
  /**
   * Resolve a single agent by ID.
   * Returns null when the agent is not found in config.
   */
  resolve(agentId: string): Promise<PluginAgentEntry | null>;
};
