import { emitAgentEvent } from "openclaw/plugin-sdk";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { checkAlerts, deliverAlerts } from "./alerts.js";
import type { BudgetManagerConfig } from "./config.js";
import type { Ledger } from "./ledger.js";
import type { PriceTable } from "./price-table.js";
import type { ScopeResolver } from "./scope-resolver.js";
import type { UsageIncrement } from "./types.js";

/**
 * Register the llm_output hook to accumulate usage into all applicable scopes.
 */
export function registerTrackerHook(
  api: OpenClawPluginApi,
  scopeResolver: ScopeResolver,
  ledger: Ledger,
  priceTable: PriceTable,
  config: BudgetManagerConfig,
): void {
  api.on("llm_output", async (event, ctx) => {
    const agentId = ctx.agentId ?? "default";
    const inputTokens = event.inputTokens ?? event.usage?.input ?? 0;
    const outputTokens = event.outputTokens ?? event.usage?.output ?? 0;
    const totalTokens = event.totalTokens ?? inputTokens + outputTokens;

    // Use provider cost if available, otherwise estimate from price table
    const estimatedCostUsd =
      event.estimatedCostUsd ?? priceTable.estimateCost(event.model, inputTokens, outputTokens);

    const usage: UsageIncrement = {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd,
      runId: event.runId,
      agentId,
      model: event.model,
    };

    // Emit usage tracking event
    emitAgentEvent({
      runId: event.runId,
      stream: "budget",
      data: {
        family: "budget",
        type: "budget.usage",
        agentId,
        model: event.model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
      },
    });

    // Accumulate into all applicable scopes
    const sessionKey = ctx.sessionKey;
    const allocations = scopeResolver.resolveScopes(agentId, sessionKey);
    for (const allocation of allocations) {
      await ledger.accumulateUsage(allocation, usage);

      // Check alert thresholds after accumulation
      const currentUsage = await ledger.getCurrentUsage(allocation);
      const alerts = checkAlerts(allocation, currentUsage, api.logger);

      if (alerts.length > 0) {
        // Emit alert events
        for (const alert of alerts) {
          emitAgentEvent({
            runId: event.runId,
            stream: "budget",
            data: {
              family: "budget",
              type: "budget.alert",
              scope: `${alert.scope.level}/${alert.scope.id}`,
              threshold: alert.threshold,
              dimension: alert.dimension,
              currentPct: alert.currentPct,
            },
          });
        }
        await deliverAlerts(alerts, config, api.logger);
      }
    }
  });
}
