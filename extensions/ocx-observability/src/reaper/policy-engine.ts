/**
 * Reaper policy engine: evaluate health state against policies and apply actions.
 *
 * Default policies:
 *   stuck:  alert (broadcast), requireConfirmation: false
 *   rogue:  alert + throttle + cancel_run, requireConfirmation: true
 *   zombie: alert + terminate_session, requireConfirmation: true
 */

import { randomUUID } from "node:crypto";
import type {
  HealthEvaluation,
  HealthState,
  PendingConfirmation,
  ReaperAction,
  ReaperActionRecord,
  ReaperPolicy,
} from "../types.js";
import type { ReaperActionExecutor } from "./actions.js";

type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };

// =============================================================================
// Default Policies
// =============================================================================

export const DEFAULT_REAPER_POLICIES: Record<string, ReaperPolicy> = {
  stuck: {
    triggerState: "stuck",
    actions: [{ kind: "alert", target: "broadcast" }],
    requireConfirmation: false,
  },
  rogue: {
    triggerState: "rogue",
    actions: [
      { kind: "alert", target: "broadcast" },
      { kind: "throttle", delayMs: 30_000 },
      { kind: "cancel_run" },
    ],
    requireConfirmation: true,
  },
  zombie: {
    triggerState: "zombie",
    actions: [
      { kind: "alert", target: "broadcast" },
      { kind: "terminate_session", reason: "Zombie session detected" },
    ],
    requireConfirmation: true,
  },
};

// =============================================================================
// Policy Engine State
// =============================================================================

const actionHistory: ReaperActionRecord[] = [];
const pendingConfirmations = new Map<string, PendingConfirmation>();

// =============================================================================
// Policy Engine
// =============================================================================

export type PolicyEngine = {
  /**
   * Evaluate an agent's health state and execute matching policy actions.
   * Stops at actions requiring confirmation.
   */
  evaluateAndExecute(evaluation: HealthEvaluation): Promise<void>;

  /** Confirm a pending destructive action by confirmation ID. */
  confirmAction(confirmationId: string): Promise<boolean>;

  /** Get all registered policies. */
  getPolicies(): Record<string, ReaperPolicy>;

  /** Update a policy for a given trigger state. */
  updatePolicy(triggerState: string, policy: ReaperPolicy): void;

  /** Get action history, optionally filtered by agentId. */
  getHistory(agentId?: string, limit?: number): ReaperActionRecord[];

  /** Get pending confirmations. */
  getPendingConfirmations(): PendingConfirmation[];

  /** Reset all state. */
  reset(): void;
};

export function createPolicyEngine(
  executor: ReaperActionExecutor,
  logger: Logger,
  initialPolicies?: Record<string, ReaperPolicy>,
): PolicyEngine {
  const policies: Record<string, ReaperPolicy> = { ...DEFAULT_REAPER_POLICIES, ...initialPolicies };

  const isDestructiveAction = (action: ReaperAction): boolean => {
    return action.kind === "cancel_run" || action.kind === "terminate_session";
  };

  return {
    async evaluateAndExecute(evaluation) {
      // Only apply policies for unhealthy states
      if (evaluation.state === "healthy" || evaluation.state === "degraded") {
        return;
      }

      const policy = Object.values(policies).find((p) => p.triggerState === evaluation.state);
      if (!policy) {
        return;
      }

      logger.info(
        `observability: reaper evaluating agent ${evaluation.agentId} (state=${evaluation.state})`,
      );

      for (const action of policy.actions) {
        // For destructive actions with requireConfirmation, stop and emit request
        if (policy.requireConfirmation && isDestructiveAction(action)) {
          const confirmId = randomUUID();
          const pending: PendingConfirmation = {
            id: confirmId,
            agentId: evaluation.agentId,
            state: evaluation.state,
            action,
            createdAt: new Date().toISOString(),
          };
          pendingConfirmations.set(confirmId, pending);

          const record: ReaperActionRecord = {
            id: randomUUID(),
            agentId: evaluation.agentId,
            state: evaluation.state,
            action,
            executedAt: new Date().toISOString(),
            confirmed: false,
            pendingConfirmation: true,
          };
          actionHistory.push(record);

          logger.info(
            `observability: reaper requires confirmation for ${action.kind} on agent ${evaluation.agentId} (id=${confirmId})`,
          );
          return; // Stop here -- wait for human
        }

        // Execute non-destructive action (or destructive without confirmation requirement)
        try {
          await executor.execute(evaluation.agentId, action);

          const record: ReaperActionRecord = {
            id: randomUUID(),
            agentId: evaluation.agentId,
            state: evaluation.state,
            action,
            executedAt: new Date().toISOString(),
            confirmed: true,
            pendingConfirmation: false,
          };
          actionHistory.push(record);
        } catch (err) {
          logger.error(
            `observability: reaper action ${action.kind} failed for agent ${evaluation.agentId}: ${String(err)}`,
          );
        }
      }

      // Cap history
      if (actionHistory.length > 5000) {
        actionHistory.splice(0, actionHistory.length - 5000);
      }
    },

    async confirmAction(confirmationId) {
      const pending = pendingConfirmations.get(confirmationId);
      if (!pending) {
        return false;
      }

      pendingConfirmations.delete(confirmationId);

      try {
        await executor.execute(pending.agentId, pending.action);

        const record: ReaperActionRecord = {
          id: randomUUID(),
          agentId: pending.agentId,
          state: pending.state,
          action: pending.action,
          executedAt: new Date().toISOString(),
          confirmed: true,
          pendingConfirmation: false,
        };
        actionHistory.push(record);

        logger.info(
          `observability: reaper confirmed and executed ${pending.action.kind} on agent ${pending.agentId}`,
        );
        return true;
      } catch (err) {
        logger.error(
          `observability: reaper confirmed action ${pending.action.kind} failed: ${String(err)}`,
        );
        return false;
      }
    },

    getPolicies() {
      return { ...policies };
    },

    updatePolicy(triggerState, policy) {
      policies[triggerState] = policy;
    },

    getHistory(agentId, limit) {
      let result = agentId
        ? actionHistory.filter((r) => r.agentId === agentId)
        : [...actionHistory];

      if (limit && limit > 0) {
        result = result.slice(-limit);
      }
      return result;
    },

    getPendingConfirmations() {
      return Array.from(pendingConfirmations.values());
    },

    reset() {
      actionHistory.length = 0;
      pendingConfirmations.clear();
    },
  };
}
