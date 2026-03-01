import type { GatewayRequestHandlerOptions, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { getActiveAlerts } from "./alerts.js";
import type { BudgetManagerConfig } from "./config.js";
import type { Ledger } from "./ledger.js";
import { persistHierarchy, type ScopeResolver } from "./scope-resolver.js";
import type { BudgetScope } from "./types.js";

/**
 * Register gateway methods for budget reporting and management.
 */
export function registerReportingMethods(
  api: OpenClawPluginApi,
  scopeResolver: ScopeResolver,
  ledger: Ledger,
  config: BudgetManagerConfig,
  stateDir: string,
): void {
  // budget.usage — current usage for a scope
  api.registerGatewayMethod(
    "budget.usage",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      const level = params.level as BudgetScope["level"] | undefined;
      const id = params.id as string | undefined;

      if (!level || !id) {
        respond(false, undefined, { code: "INVALID_PARAMS", message: "level and id are required" });
        return;
      }

      const allocation = scopeResolver.getAllocation(level, id);
      if (!allocation) {
        respond(false, undefined, {
          code: "NOT_FOUND",
          message: `No allocation found for ${level}/${id}`,
        });
        return;
      }

      const usage = ledger.getCurrentUsage(allocation);
      respond(true, { usage, allocation });
    },
  );

  // budget.usage.history — historical usage over a time range
  api.registerGatewayMethod(
    "budget.usage.history",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      const level = params.level as BudgetScope["level"] | undefined;
      const id = params.id as string | undefined;
      const fromStr = params.from as string | undefined;
      const toStr = params.to as string | undefined;

      if (!level || !id) {
        respond(false, undefined, { code: "INVALID_PARAMS", message: "level and id are required" });
        return;
      }

      const scope: BudgetScope = {
        level,
        id,
        parentId: null, // parentId not needed for historical queries
      };

      const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const to = toStr ? new Date(toStr) : new Date();

      const entries = await ledger.getHistoricalUsage(scope, from, to);
      respond(true, { entries, from: from.toISOString(), to: to.toISOString() });
    },
  );

  // budget.allocations — list/get/set allocations
  api.registerGatewayMethod(
    "budget.allocations",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      const action = params.action as string | undefined;
      const level = params.level as BudgetScope["level"] | undefined;
      const id = params.id as string | undefined;

      // SET — update or create an allocation
      if (action === "set") {
        if (!level || !id) {
          respond(false, undefined, {
            code: "INVALID_PARAMS",
            message: "level and id are required for set action",
          });
          return;
        }

        const limits = params.limits as Record<string, number> | undefined;
        const breachAction = params.breachAction as string | undefined;
        const degradeModel = params.degradeModel as string | undefined;
        const alertAt = params.alertAt as number[] | undefined;

        scopeResolver.setAllocation(level, id, {
          ...(limits ? { limits } : {}),
          ...(breachAction ? { breachAction: breachAction as "warn" | "degrade" | "block" } : {}),
          ...(degradeModel ? { degradeModel } : {}),
          ...(alertAt ? { alertAt } : {}),
        });

        // Persist to disk
        await persistHierarchy(scopeResolver, stateDir, config.hierarchyFile, api.logger);

        const allocation = scopeResolver.getAllocation(level, id);
        respond(true, { allocation });
        return;
      }

      // GET — single allocation by level + id
      if (level && id) {
        const allocation = scopeResolver.getAllocation(level, id);
        if (!allocation) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `No allocation found for ${level}/${id}`,
          });
          return;
        }
        respond(true, { allocation });
        return;
      }

      // LIST — all scopes and their allocations
      const scopes = scopeResolver.listScopes();
      const allocations = scopes
        .map((s) => scopeResolver.getAllocation(s.level, s.id))
        .filter(Boolean);

      respond(true, { allocations });
    },
  );

  // budget.burn_rate — current burn rate and projected exhaustion
  api.registerGatewayMethod(
    "budget.burn_rate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      const level = params.level as BudgetScope["level"] | undefined;
      const id = params.id as string | undefined;

      if (!level || !id) {
        respond(false, undefined, { code: "INVALID_PARAMS", message: "level and id are required" });
        return;
      }

      const allocation = scopeResolver.getAllocation(level, id);
      if (!allocation) {
        respond(false, undefined, {
          code: "NOT_FOUND",
          message: `No allocation found for ${level}/${id}`,
        });
        return;
      }

      const usage = ledger.getCurrentUsage(allocation);
      const windowStart = new Date(usage.windowStart);
      const windowEnd = new Date(usage.windowEnd);
      const elapsed = Date.now() - windowStart.getTime();
      const windowDuration = windowEnd.getTime() - windowStart.getTime();
      const elapsedFraction = elapsed / windowDuration;

      // Compute per-dimension burn rates
      const burnRate: Record<string, { current: number; projected: number; exhaustsAt?: string }> =
        {};

      for (const [dim, pct] of Object.entries(usage.utilizationPct)) {
        const ratePerMs = elapsedFraction > 0 ? pct / elapsed : 0;
        const projectedAtWindowEnd = ratePerMs * windowDuration;

        let exhaustsAt: string | undefined;
        if (ratePerMs > 0 && pct < 1.0) {
          const msToExhaustion = (1.0 - pct) / ratePerMs;
          exhaustsAt = new Date(Date.now() + msToExhaustion).toISOString();
        }

        burnRate[dim] = {
          current: pct,
          projected: projectedAtWindowEnd,
          exhaustsAt,
        };
      }

      respond(true, {
        scope: allocation.scope,
        usage,
        burnRate,
        windowElapsedPct: elapsedFraction,
      });
    },
  );

  // budget.alerts — active alerts
  api.registerGatewayMethod("budget.alerts", async ({ respond }: GatewayRequestHandlerOptions) => {
    const alerts = getActiveAlerts();
    respond(true, { alerts });
  });
}
