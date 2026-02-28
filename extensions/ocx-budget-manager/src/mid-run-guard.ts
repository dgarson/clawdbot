import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BudgetManagerConfig } from "./config.js";
import type { Ledger } from "./ledger.js";
import type { ScopeResolver } from "./scope-resolver.js";

/** Threshold above which mid-run hard-blocks kick in. */
const HARD_BLOCK_THRESHOLD = 0.95;

/**
 * Register the before_tool_call hook for mid-run budget checks.
 * Only hard-blocks when usage exceeds 95% of a hard limit.
 */
export function registerMidRunGuardHook(
  api: OpenClawPluginApi,
  scopeResolver: ScopeResolver,
  ledger: Ledger,
  config: BudgetManagerConfig,
): void {
  api.on("before_tool_call", async (_event, ctx) => {
    // Only enforce mid-run guards in hard mode
    if (config.enforcement !== "hard") return;

    const agentId = ctx.agentId ?? "default";
    const sessionKey = ctx.sessionKey;
    const allocations = scopeResolver.resolveScopes(agentId, sessionKey);

    for (const allocation of allocations) {
      // Mid-run guard only applies to scopes with "block" breach action
      if (allocation.breachAction !== "block") continue;

      const usage = await ledger.getCurrentUsage(allocation);
      const maxUtilization = Math.max(0, ...Object.values(usage.utilizationPct));

      if (maxUtilization >= HARD_BLOCK_THRESHOLD) {
        const scope = allocation.scope;
        api.logger.warn(
          `budget-manager: mid-run block for agent "${agentId}" — ` +
            `${scope.level}/${scope.id} at ${(maxUtilization * 100).toFixed(1)}%`,
        );
        return {
          block: true,
          blockReason: `Budget exhausted for ${scope.level}/${scope.id} (${(maxUtilization * 100).toFixed(1)}% used)`,
        };
      }
    }

    // No hard limit exceeded — allow the tool call
  });
}
