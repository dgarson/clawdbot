/**
 * runtime.quota namespace types (#5).
 * Extracted to keep types.ts focused on the high-level PluginRuntime shape.
 */

export type PluginQuotaUsage = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  turnCount: number;
};

/** Scope constraints for quota queries. All fields are optional and ANDed. */
export type PluginQuotaScope = {
  /** Filter to sessions belonging to this agent. */
  agentId?: string;
  /**
   * Filter to sessions whose agentId matches any of these group IDs.
   * Useful for agent-team quotas without a shared agent config.
   */
  groupIds?: string[];
  /** Only include sessions modified within the last `periodMs` milliseconds. */
  periodMs?: number;
};

export type PluginBudgetLimits = {
  /** Maximum total tokens (input + output) allowed in scope. */
  maxTokens?: number;
  /** Maximum total cost in USD allowed in scope. */
  maxCostUsd?: number;
};

export type PluginBudgetCheckResult = {
  exceeded: boolean;
  usage: PluginQuotaUsage;
  remaining: {
    tokens?: number;
    costUsd?: number;
  };
};

export type PluginQuotaNamespace = {
  /** Aggregate token/cost usage across all sessions matching `scope`. */
  getUsage(scope?: PluginQuotaScope): Promise<PluginQuotaUsage>;
  /**
   * Check whether aggregated usage exceeds the given limits.
   * Returns whether the budget is exceeded and how much is remaining.
   */
  checkBudget(
    scope: PluginQuotaScope,
    limits: PluginBudgetLimits,
  ): Promise<PluginBudgetCheckResult>;
};
