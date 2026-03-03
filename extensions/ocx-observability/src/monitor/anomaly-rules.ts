/**
 * Rule-based anomaly detection.
 *
 * Rules:
 *   token_spike      critical  Current window tokens > movingAvg * multiplier
 *   error_burst      warning   >N errors in M minutes
 *   tool_loop        critical  Same tool called >N times in M minutes
 *   cost_spike       warning   Current window cost > previous window * multiplier
 *   session_overflow warning   Active sessions > configured max
 *   unusual_model    info      Model used that isn't in the agent's configured list
 */

import type { AnomalyEvalContext, AnomalyRule, HealthSignal } from "../types.js";

// =============================================================================
// Rule Definitions
// =============================================================================

const tokenSpikeRule: AnomalyRule = {
  kind: "token_spike",
  evaluate({ criteria, stats }) {
    if (stats.movingAvgTokens <= 0) {
      return undefined;
    }
    const threshold = stats.movingAvgTokens * criteria.tokenSpikeMultiplier;
    if (stats.totalTokensWindow > threshold) {
      return {
        kind: "token_spike",
        severity: "critical",
        value: stats.totalTokensWindow,
        threshold,
        message: `Token usage ${stats.totalTokensWindow} exceeds ${criteria.tokenSpikeMultiplier}x moving average (${Math.round(stats.movingAvgTokens)})`,
      };
    }
    return undefined;
  },
};

const errorBurstRule: AnomalyRule = {
  kind: "error_burst",
  evaluate({ criteria, stats }) {
    if (stats.totalRunsInWindow === 0) {
      return undefined;
    }
    const errorRate = stats.errorsInWindow / stats.totalRunsInWindow;
    if (errorRate > criteria.errorRateThreshold) {
      const severity =
        errorRate > criteria.errorRateThreshold * 2 ? ("critical" as const) : ("warning" as const);
      return {
        kind: "error_burst",
        severity,
        value: errorRate,
        threshold: criteria.errorRateThreshold,
        message: `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold ${(criteria.errorRateThreshold * 100).toFixed(1)}%`,
      };
    }
    return undefined;
  },
};

const toolLoopRule: AnomalyRule = {
  kind: "tool_loop",
  evaluate({ criteria, stats }) {
    for (const [toolName, count] of stats.toolCallsWindow) {
      if (count > criteria.toolLoopCallThreshold) {
        return {
          kind: "tool_loop",
          severity: "critical",
          value: count,
          threshold: criteria.toolLoopCallThreshold,
          message: `Tool "${toolName}" called ${count} times in window (threshold: ${criteria.toolLoopCallThreshold})`,
        };
      }
    }
    return undefined;
  },
};

const costSpikeRule: AnomalyRule = {
  kind: "cost_spike",
  evaluate({ criteria, stats }) {
    if (stats.previousCostWindow <= 0) {
      return undefined;
    }
    const threshold = stats.previousCostWindow * criteria.tokenSpikeMultiplier;
    if (stats.costWindow > threshold) {
      return {
        kind: "cost_spike",
        severity: "warning",
        value: stats.costWindow,
        threshold,
        message: `Cost $${stats.costWindow.toFixed(4)} exceeds ${criteria.tokenSpikeMultiplier}x previous window ($${stats.previousCostWindow.toFixed(4)})`,
      };
    }
    return undefined;
  },
};

const sessionOverflowRule: AnomalyRule = {
  kind: "session_overflow",
  evaluate({ stats }) {
    if (stats.activeSessions > stats.maxSessions) {
      return {
        kind: "session_overflow",
        severity: "warning",
        value: stats.activeSessions,
        threshold: stats.maxSessions,
        message: `Active sessions (${stats.activeSessions}) exceeds max (${stats.maxSessions})`,
      };
    }
    return undefined;
  },
};

const unusualModelRule: AnomalyRule = {
  kind: "unusual_model",
  evaluate({ stats }) {
    if (stats.configuredModels.size === 0) {
      return undefined;
    }
    for (const model of stats.modelsUsed) {
      if (!stats.configuredModels.has(model)) {
        return {
          kind: "unusual_model",
          severity: "info",
          value: 1,
          threshold: 0,
          message: `Model "${model}" is not in the agent's configured model list`,
        };
      }
    }
    return undefined;
  },
};

// =============================================================================
// Rule Registry
// =============================================================================

const ALL_RULES: AnomalyRule[] = [
  tokenSpikeRule,
  errorBurstRule,
  toolLoopRule,
  costSpikeRule,
  sessionOverflowRule,
  unusualModelRule,
];

/**
 * Evaluate all anomaly rules and return any triggered signals.
 */
export function evaluateAnomalyRules(ctx: AnomalyEvalContext): HealthSignal[] {
  const signals: HealthSignal[] = [];
  for (const rule of ALL_RULES) {
    const signal = rule.evaluate(ctx);
    if (signal) {
      signals.push(signal);
    }
  }
  return signals;
}

/** Get all registered anomaly rule kinds. */
export function getAnomalyRuleKinds(): string[] {
  return ALL_RULES.map((r) => r.kind);
}
