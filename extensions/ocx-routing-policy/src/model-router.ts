/**
 * before_model_resolve hook handler.
 *
 * Matches the inbound request against RoutingPolicy conditions. When multiple
 * policies match, the one with the highest priority value wins.
 */

import type { RoutingPolicyConfig } from "./config.js";
import type { ClassificationResult, RoutingCondition, RoutingPolicy } from "./types.js";

/** Subset of the agent context provided by the before_model_resolve hook. */
type AgentHookContext = {
  agentId?: string;
  sessionKey?: string;
  messageProvider?: string;
};

// ---------------------------------------------------------------------------
// Context used to evaluate conditions
// ---------------------------------------------------------------------------

export type MatchContext = {
  agentId?: string;
  channel?: string;
  classification?: ClassificationResult;
  /** Budget remaining as a fraction 0..1 (undefined = unknown). */
  budgetRemaining?: number;
  toolCount?: number;
  sessionDepth?: number;
};

// ---------------------------------------------------------------------------
// Condition matching
// ---------------------------------------------------------------------------

function matchCondition(condition: RoutingCondition, ctx: MatchContext): boolean {
  switch (condition.kind) {
    case "agent":
      return ctx.agentId === condition.agentId;

    case "channel":
      return ctx.channel === condition.channel;

    case "classification":
      return ctx.classification?.label === condition.label;

    case "budget_remaining": {
      if (ctx.budgetRemaining === undefined) return false;
      return condition.operator === "gt"
        ? ctx.budgetRemaining > condition.threshold
        : ctx.budgetRemaining < condition.threshold;
    }

    case "tool_count": {
      if (ctx.toolCount === undefined) return false;
      return condition.operator === "gt"
        ? ctx.toolCount > condition.threshold
        : ctx.toolCount < condition.threshold;
    }

    case "hour_of_day": {
      const hour = new Date().getHours();
      // Handles wrapping (e.g., from: 22, to: 6)
      if (condition.from <= condition.to) {
        return hour >= condition.from && hour < condition.to;
      }
      return hour >= condition.from || hour < condition.to;
    }

    case "session_depth": {
      if (ctx.sessionDepth === undefined) return false;
      return condition.operator === "gt"
        ? ctx.sessionDepth > condition.threshold
        : ctx.sessionDepth < condition.threshold;
    }

    default:
      return false;
  }
}

/** Check if ALL conditions of a policy match the given context. */
function matchesPolicy(policy: RoutingPolicy, ctx: MatchContext): boolean {
  // A policy with no conditions never matches (safety guard).
  if (policy.conditions.length === 0) return false;
  return policy.conditions.every((c) => matchCondition(c, ctx));
}

// ---------------------------------------------------------------------------
// Policy selection
// ---------------------------------------------------------------------------

/**
 * Find the best matching routing policy.
 * Returns the highest-priority matching policy, or undefined if none match.
 */
export function selectPolicy(
  policies: RoutingPolicy[],
  ctx: MatchContext,
): RoutingPolicy | undefined {
  let best: RoutingPolicy | undefined;
  for (const policy of policies) {
    if (!matchesPolicy(policy, ctx)) continue;
    if (!best || policy.priority > best.priority) {
      best = policy;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Hook result builder
// ---------------------------------------------------------------------------

export type ModelRouteResult = {
  modelOverride?: string;
  providerOverride?: string;
  policyId?: string;
};

/**
 * Build the hook result from a matched policy and the plugin config defaults.
 */
export function buildModelRouteResult(
  policy: RoutingPolicy | undefined,
  config: RoutingPolicyConfig,
): ModelRouteResult | undefined {
  if (policy) {
    return {
      modelOverride: policy.target.model,
      providerOverride: policy.target.provider,
      policyId: policy.id,
    };
  }

  // No matching policy, but a default model is configured.
  if (config.defaultModel) {
    return { modelOverride: config.defaultModel };
  }

  return undefined;
}

/**
 * Build match context from the hook event and agent context.
 */
export function buildMatchContext(
  _event: { prompt: string },
  ctx: AgentHookContext,
  classification: ClassificationResult | undefined,
): MatchContext {
  return {
    agentId: ctx.agentId,
    channel: ctx.messageProvider,
    classification,
    // budgetRemaining, toolCount, sessionDepth are not available in the
    // current hook event shape. They will be populated when the budget
    // plugin (section 03) and orchestration layer (section 04) are integrated.
  };
}
