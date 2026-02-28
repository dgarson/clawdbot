/**
 * Periodic health evaluation: healthy / degraded / stuck / rogue / zombie.
 *
 * Evaluates each active agent using deterministic criteria (not AI-based).
 * State derivation priority: zombie > rogue > stuck > degraded > healthy.
 */

import type { ObservabilityConfig } from "../config.js";
import type {
  AgentStats,
  HealthCriteria,
  HealthEvaluation,
  HealthSignal,
  HealthState,
} from "../types.js";
import { evaluateAnomalyRules } from "./anomaly-rules.js";

type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };

// =============================================================================
// State Store
// =============================================================================

/** Per-agent stats collected from events. */
const agentStatsMap = new Map<string, AgentStats>();

/** Previous health evaluations per agent. */
const healthHistory: HealthEvaluation[] = [];

/** Latest evaluation per agent. */
const currentHealth = new Map<string, HealthEvaluation>();

/** Health monitor interval handle. */
let monitorInterval: ReturnType<typeof setInterval> | undefined;

// =============================================================================
// Health State Derivation
// =============================================================================

/**
 * Derive overall health state from a set of signals.
 * Priority: zombie > rogue > stuck > degraded > healthy.
 */
export function deriveHealthState(signals: HealthSignal[]): HealthState {
  const criticalSignals = signals.filter((s) => s.severity === "critical");
  const warningSignals = signals.filter((s) => s.severity === "warning");

  // Zombie: heartbeat timeout (critical)
  if (criticalSignals.some((s) => s.kind === "heartbeat_timeout")) {
    return "zombie";
  }

  // Rogue: token spike OR tool loop (critical)
  if (criticalSignals.some((s) => s.kind === "token_spike" || s.kind === "tool_loop")) {
    return "rogue";
  }

  // Stuck: no events timeout (critical)
  if (criticalSignals.some((s) => s.kind === "no_events_timeout")) {
    return "stuck";
  }

  // Degraded: any warning signals
  if (warningSignals.length > 0) {
    return "degraded";
  }

  return "healthy";
}

// =============================================================================
// Agent Stats Management
// =============================================================================

/** Create default agent stats. */
export function createDefaultStats(): AgentStats {
  return {
    lastEventAt: Date.now(),
    lastHeartbeatAt: Date.now(),
    totalTokensWindow: 0,
    movingAvgTokens: 0,
    errorsInWindow: 0,
    totalRunsInWindow: 0,
    budgetUtilization: 0,
    consecutiveToolFailures: 0,
    toolCallsWindow: new Map(),
    costWindow: 0,
    previousCostWindow: 0,
    activeSessions: 0,
    maxSessions: 100,
    modelsUsed: new Set(),
    configuredModels: new Set(),
  };
}

/** Get or create stats for an agent. */
export function getOrCreateStats(agentId: string): AgentStats {
  let stats = agentStatsMap.get(agentId);
  if (!stats) {
    stats = createDefaultStats();
    agentStatsMap.set(agentId, stats);
  }
  return stats;
}

/** Get stats map (read-only access for gateway methods). */
export function getAgentStatsMap(): ReadonlyMap<string, AgentStats> {
  return agentStatsMap;
}

// =============================================================================
// Single Agent Evaluation
// =============================================================================

/** Evaluate health for a single agent. */
export function evaluateAgent(agentId: string, criteria: HealthCriteria): HealthEvaluation {
  const stats = getOrCreateStats(agentId);
  const now = Date.now();
  const signals: HealthSignal[] = [];

  // If no sessions are currently active for this agent, treat the agent as dormant and
  // skip lifecycle-only health transitions (stuck/zombie) that can fire after completion.
  const hasActiveSessions = stats.activeSessions > 0;

  if (hasActiveSessions) {
    // Check stuck: no events for stuckTimeoutMinutes
    const stuckThresholdMs = criteria.stuckTimeoutMinutes * 60 * 1000;
    const timeSinceLastEvent = now - stats.lastEventAt;
    if (timeSinceLastEvent > stuckThresholdMs) {
      signals.push({
        kind: "no_events_timeout",
        severity: "critical",
        value: timeSinceLastEvent / 60_000,
        threshold: criteria.stuckTimeoutMinutes,
        message: `No events for ${Math.round(timeSinceLastEvent / 60_000)} minutes`,
      });
    }

    // Check zombie: heartbeat timeout
    const heartbeatThresholdMs = criteria.heartbeatTimeoutMinutes * 60 * 1000;
    const timeSinceHeartbeat = now - stats.lastHeartbeatAt;
    if (timeSinceHeartbeat > heartbeatThresholdMs) {
      signals.push({
        kind: "heartbeat_timeout",
        severity: "critical",
        value: timeSinceHeartbeat / 60_000,
        threshold: criteria.heartbeatTimeoutMinutes,
        message: `No heartbeat for ${Math.round(timeSinceHeartbeat / 60_000)} minutes`,
      });
    }

    // Anomaly rules (token_spike, error_burst, tool_loop, cost_spike, etc.)
    const anomalySignals = evaluateAnomalyRules({ agentId, criteria, stats });
    signals.push(...anomalySignals);

    // Check budget degradation
    if (stats.budgetUtilization > criteria.budgetDegradedThreshold) {
      signals.push({
        kind: "budget_high",
        severity: "warning",
        value: stats.budgetUtilization,
        threshold: criteria.budgetDegradedThreshold,
        message: `Budget utilization at ${Math.round(stats.budgetUtilization * 100)}%`,
      });
    }

    // Check consecutive tool failures
    if (stats.consecutiveToolFailures > criteria.maxConsecutiveToolFailures) {
      signals.push({
        kind: "consecutive_tool_failures",
        severity: "warning",
        value: stats.consecutiveToolFailures,
        threshold: criteria.maxConsecutiveToolFailures,
        message: `${stats.consecutiveToolFailures} consecutive tool failures`,
      });
    }
  }

  const state = deriveHealthState(signals);
  const previous = currentHealth.get(agentId);

  const evaluation: HealthEvaluation = {
    agentId,
    state,
    signals,
    evaluatedAt: new Date().toISOString(),
    previousState: previous?.state,
    stateChangedAt: previous?.state !== state ? new Date().toISOString() : previous?.stateChangedAt,
  };

  currentHealth.set(agentId, evaluation);
  healthHistory.push(evaluation);

  // Cap history to avoid unbounded growth (keep last 10000 entries)
  if (healthHistory.length > 10_000) {
    healthHistory.splice(0, healthHistory.length - 10_000);
  }

  return evaluation;
}

// =============================================================================
// Monitor Lifecycle
// =============================================================================

export type HealthMonitorCallbacks = {
  onStateChange?: (evaluation: HealthEvaluation) => void;
};

/** Start periodic health evaluation. */
export function startHealthMonitor(
  config: ObservabilityConfig,
  callbacks: HealthMonitorCallbacks,
  logger: Logger,
): void {
  if (monitorInterval) {
    return;
  }

  const intervalMs = config.healthCheckIntervalSeconds * 1000;
  logger.info(
    `observability: health monitor started (interval=${config.healthCheckIntervalSeconds}s)`,
  );

  monitorInterval = setInterval(() => {
    for (const agentId of agentStatsMap.keys()) {
      const evaluation = evaluateAgent(agentId, config.criteria);
      if (evaluation.previousState !== evaluation.state && callbacks.onStateChange) {
        callbacks.onStateChange(evaluation);
      }
    }
  }, intervalMs);
}

/** Stop the health monitor. */
export function stopHealthMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = undefined;
  }
}

// =============================================================================
// Query Methods (for gateway)
// =============================================================================

/** Get current health for all agents. */
export function getAllCurrentHealth(): HealthEvaluation[] {
  return Array.from(currentHealth.values());
}

/** Get health history, optionally filtered by agentId. */
export function getHealthHistory(agentId?: string, limit?: number): HealthEvaluation[] {
  let result = agentId ? healthHistory.filter((h) => h.agentId === agentId) : [...healthHistory];

  if (limit && limit > 0) {
    result = result.slice(-limit);
  }
  return result;
}

/** Clear all state (used in tests or shutdown). */
export function resetHealthState(): void {
  agentStatsMap.clear();
  currentHealth.clear();
  healthHistory.length = 0;
  stopHealthMonitor();
}

/** Remove all in-memory health and stats for an agent once it becomes dormant. */
export function retireAgentState(agentId: string): void {
  agentStatsMap.delete(agentId);
  currentHealth.delete(agentId);
}

/** Record a session start for an agent and mark it as active. */
export function recordSessionStart(agentId: string): void {
  const stats = getOrCreateStats(agentId);
  stats.activeSessions += 1;
  stats.lastEventAt = Date.now();
  stats.lastHeartbeatAt = Date.now();
}

/** Record a session end for an agent and retire inactive session state. */
export function recordSessionEnd(agentId: string): void {
  const stats = agentStatsMap.get(agentId);
  if (!stats) {
    return;
  }

  stats.activeSessions = Math.max(0, stats.activeSessions - 1);
  stats.lastEventAt = Date.now();

  if (stats.activeSessions === 0) {
    retireAgentState(agentId);
  }
}
