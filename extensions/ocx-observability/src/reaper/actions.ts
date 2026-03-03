/**
 * Execute reaper actions: alert, throttle, pause, cancel_run, terminate_session.
 *
 * Destructive actions (cancel_run, terminate_session) are gated on requireConfirmation
 * in the policy engine — this module only handles execution.
 */

import type { ReaperAction } from "../types.js";

type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };

// =============================================================================
// Action Executor
// =============================================================================

export type ReaperActionExecutor = {
  execute(agentId: string, action: ReaperAction): Promise<void>;
};

export type ReaperActionDeps = {
  /** Broadcast an alert message to connected clients. */
  broadcast: (event: string, payload: unknown) => void;
  /** Logger for action execution. */
  logger: Logger;
};

/**
 * Create a reaper action executor with the given dependencies.
 *
 * - alert: broadcasts via gateway or sends to webhook
 * - throttle: sets a delay on the agent (stored in throttle map)
 * - pause: prevents new runs for durationMinutes
 * - cancel_run: cancels the active run for an agent
 * - terminate_session: terminates the agent session
 */
export function createReaperActionExecutor(deps: ReaperActionDeps): ReaperActionExecutor {
  return {
    async execute(agentId, action) {
      switch (action.kind) {
        case "alert":
          await executeAlert(agentId, action, deps);
          break;
        case "throttle":
          executeThrottle(agentId, action.delayMs, deps);
          break;
        case "pause":
          executePause(agentId, action.durationMinutes, deps);
          break;
        case "cancel_run":
          await executeCancelRun(agentId, action.runId, deps);
          break;
        case "terminate_session":
          await executeTerminateSession(agentId, action.sessionKey, action.reason, deps);
          break;
      }
    },
  };
}

// =============================================================================
// Throttle State
// =============================================================================

/** Map of agentId -> throttle delay in ms. Consumers can check this. */
const throttleMap = new Map<string, number>();
const pauseMap = new Map<string, { until: number }>();

/** Check if an agent is currently throttled. */
export function getThrottleDelay(agentId: string): number | undefined {
  return throttleMap.get(agentId);
}

/** Check if an agent is currently paused. */
export function isPaused(agentId: string): boolean {
  const entry = pauseMap.get(agentId);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    pauseMap.delete(agentId);
    return false;
  }
  return true;
}

/** Clear throttle/pause state for an agent. */
export function clearAgentRestrictions(agentId: string): void {
  throttleMap.delete(agentId);
  pauseMap.delete(agentId);
}

/** Clear all restrictions (for shutdown). */
export function clearAllRestrictions(): void {
  throttleMap.clear();
  pauseMap.clear();
}

// =============================================================================
// Action Implementations
// =============================================================================

async function executeAlert(
  agentId: string,
  action: Extract<ReaperAction, { kind: "alert" }>,
  deps: ReaperActionDeps,
): Promise<void> {
  const payload = {
    type: "observability.reaper.alert",
    agentId,
    target: action.target,
    timestamp: new Date().toISOString(),
  };

  if (action.target === "broadcast") {
    deps.broadcast("observability.reaper.alert", payload);
    deps.logger.info(`observability: reaper alert broadcast for agent ${agentId}`);
    return;
  }

  if (action.target === "webhook" && action.webhookUrl) {
    try {
      const response = await fetch(action.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        deps.logger.warn(
          `observability: webhook alert failed for agent ${agentId}: HTTP ${response.status}`,
        );
      } else {
        deps.logger.info(
          `observability: webhook alert sent for agent ${agentId} to ${action.webhookUrl}`,
        );
      }
    } catch (err) {
      deps.logger.error(`observability: webhook alert error for agent ${agentId}: ${String(err)}`);
    }
    return;
  }

  deps.logger.warn(
    `observability: alert target "${action.target}" not handled for agent ${agentId}`,
  );
}

function executeThrottle(agentId: string, delayMs: number, deps: ReaperActionDeps): void {
  throttleMap.set(agentId, delayMs);
  deps.logger.info(`observability: reaper throttle set for agent ${agentId} (delay=${delayMs}ms)`);
}

function executePause(agentId: string, durationMinutes: number, deps: ReaperActionDeps): void {
  const until = Date.now() + durationMinutes * 60 * 1000;
  pauseMap.set(agentId, { until });
  deps.logger.info(`observability: reaper paused agent ${agentId} for ${durationMinutes} minutes`);
}

async function executeCancelRun(
  agentId: string,
  runId: string | undefined,
  deps: ReaperActionDeps,
): Promise<void> {
  // Broadcast a cancel event; the gateway/runner should listen and abort
  deps.broadcast("observability.reaper.cancel_run", {
    type: "observability.reaper.cancel_run",
    agentId,
    runId: runId ?? "active",
    timestamp: new Date().toISOString(),
  });
  deps.logger.info(
    `observability: reaper cancel_run for agent ${agentId} (runId=${runId ?? "active"})`,
  );
}

async function executeTerminateSession(
  agentId: string,
  sessionKey: string | undefined,
  reason: string,
  deps: ReaperActionDeps,
): Promise<void> {
  // Broadcast a terminate event; the gateway should listen and terminate
  deps.broadcast("observability.reaper.terminate_session", {
    type: "observability.reaper.terminate_session",
    agentId,
    sessionKey: sessionKey ?? "active",
    reason,
    timestamp: new Date().toISOString(),
  });
  deps.logger.info(
    `observability: reaper terminate_session for agent ${agentId} (reason=${reason})`,
  );
}
