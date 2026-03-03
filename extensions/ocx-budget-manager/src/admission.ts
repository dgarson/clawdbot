import { emitAgentEvent } from "openclaw/plugin-sdk";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BudgetManagerConfig } from "./config.js";
import type { Ledger } from "./ledger.js";
import type { ScopeResolver } from "./scope-resolver.js";
import type { AdmissionDecision } from "./types.js";

/**
 * Evaluate admission for an agent run by checking all applicable budget scopes
 * bottom-up (agent -> team -> org -> system).
 */
function evaluateAdmission(
  agentId: string,
  scopeResolver: ScopeResolver,
  ledger: Ledger,
  config: BudgetManagerConfig,
  sessionKey?: string,
): AdmissionDecision {
  const allocations = scopeResolver.resolveScopes(agentId, sessionKey);

  // In read-only mode, always allow
  if (config.enforcement === "read-only") {
    return { decision: "allow" };
  }

  for (const allocation of allocations) {
    const usage = ledger.getCurrentUsage(allocation);

    // Check if any dimension has hit or exceeded 100%
    const maxUtilization = Math.max(0, ...Object.values(usage.utilizationPct));
    if (maxUtilization < 1.0) continue;

    switch (allocation.breachAction) {
      case "block":
        // In soft mode, degrade instead of blocking
        if (config.enforcement === "soft") {
          if (allocation.degradeModel) {
            return {
              decision: "degrade",
              limitScope: allocation.scope,
              degradeModel: allocation.degradeModel,
            };
          }
          // No degrade model configured; allow with warning
          return { decision: "allow" };
        }
        return { decision: "block", blockingScope: allocation.scope };

      case "degrade":
        if (allocation.degradeModel) {
          return {
            decision: "degrade",
            limitScope: allocation.scope,
            degradeModel: allocation.degradeModel,
          };
        }
        // No degrade model configured; fall through to allow
        return { decision: "allow" };

      case "warn":
        // Warn-only: allow the run, logging is handled by the hook
        continue;
    }
  }

  return { decision: "allow" };
}

/**
 * Register the before_model_resolve hook for admission control.
 * Runs at priority 200 — before routing policy.
 */
export function registerAdmissionHook(
  api: OpenClawPluginApi,
  scopeResolver: ScopeResolver,
  ledger: Ledger,
  config: BudgetManagerConfig,
): void {
  api.on(
    "before_model_resolve",
    (event, ctx) => {
      const agentId = ctx.agentId ?? "default";
      const sessionKey = ctx.sessionKey;
      const admission = evaluateAdmission(agentId, scopeResolver, ledger, config, sessionKey);

      // Emit admission event for observability
      const runId = (event as Record<string, unknown>).runId as string | undefined;
      if (runId) {
        const scopeInfo =
          admission.decision === "block"
            ? admission.blockingScope
            : admission.decision === "degrade"
              ? admission.limitScope
              : undefined;
        emitAgentEvent({
          runId,
          stream: "budget",
          data: {
            family: "budget",
            type: "budget.admission",
            decision: admission.decision,
            agentId,
            ...(scopeInfo ? { scope: `${scopeInfo.level}/${scopeInfo.id}` } : {}),
            ...(admission.decision === "degrade" ? { degradeModel: admission.degradeModel } : {}),
          },
        });
      }

      if (admission.decision === "block") {
        api.logger.warn(
          `budget-manager: blocked run for agent "${agentId}" — ` +
            `budget exhausted at ${admission.blockingScope.level}/${admission.blockingScope.id}`,
        );
        // Return a model override that signals the budget error.
        // The hook system does not support returning errors directly,
        // so we log and let the caller handle it via the model override mechanism.
        return {
          modelOverride: `__budget_blocked__:${admission.blockingScope.level}/${admission.blockingScope.id}`,
        };
      }

      if (admission.decision === "degrade") {
        api.logger.info(
          `budget-manager: degrading model for agent "${agentId}" to "${admission.degradeModel}" — ` +
            `limit reached at ${admission.limitScope.level}/${admission.limitScope.id}`,
        );
        return { modelOverride: admission.degradeModel };
      }

      // Allow — no override
    },
    { priority: 200 },
  );
}
