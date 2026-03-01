// ---------------------------------------------------------------------------
// Background service: poll for escalation triggers
//
// Watches orchestration state for conditions that should trigger escalations:
//   - Blocked work items
//   - Budget risk (>threshold utilization)
//   - Timeout (session exceeds max duration)
//   - Repeated failures
// ---------------------------------------------------------------------------

import type { OrchestrationConfig } from "./config.js";
import { raiseEscalation } from "./escalation.js";
import type { OrchestrationStore } from "./storage.js";
import type { EscalationTarget, WorkItem } from "./types.js";

type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };

const DEFAULT_POLL_INTERVAL_MS = 30_000; // 30 seconds

export type MonitorDeps = {
  store: OrchestrationStore;
  config: OrchestrationConfig;
  logger: Logger;
};

/**
 * Start the background escalation monitor. Returns a stop function.
 */
export function startMonitor(deps: MonitorDeps): { stop: () => void } {
  const { store, config, logger } = deps;
  let timer: ReturnType<typeof setInterval> | null = null;
  let pollInFlight = false;

  async function poll() {
    if (pollInFlight) {
      logger.warn("[orchestration/monitor] Previous poll still running; skipping interval tick");
      return;
    }
    pollInFlight = true;
    try {
      await checkBlockedItems(store, logger);
      await checkTimeoutItems(store, config, logger);
    } catch (err) {
      logger.error(
        `[orchestration/monitor] Poll error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      pollInFlight = false;
    }
  }

  timer = setInterval(poll, DEFAULT_POLL_INTERVAL_MS);
  // Run once immediately (non-blocking)
  void poll();

  return {
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Check: blocked items that have no open escalation yet
// ---------------------------------------------------------------------------

async function checkBlockedItems(store: OrchestrationStore, logger: Logger): Promise<void> {
  const items = await store.listWorkItems();
  const blockedItems = items.filter((w) => w.state === "blocked");
  if (blockedItems.length === 0) return;

  const existingEscalations = await store.listEscalations();
  const openBlockedIds = new Set(
    existingEscalations
      .filter((e) => e.trigger === "blocked" && !e.resolvedAt && e.workItemId)
      .map((e) => e.workItemId),
  );

  for (const item of blockedItems) {
    if (openBlockedIds.has(item.id)) continue; // already escalated

    const target = await resolveEscalationTarget(store, item);
    if (!target) continue;

    await raiseEscalation(
      store,
      {
        trigger: "blocked",
        target,
        workItemId: item.id,
        sprintId: item.sprintId,
        message: `Work item "${item.title}" (${item.id}) is blocked.`,
      },
      logger,
    );
  }
}

// ---------------------------------------------------------------------------
// Check: items with active delegations that have exceeded timeout
// ---------------------------------------------------------------------------

async function checkTimeoutItems(
  store: OrchestrationStore,
  config: OrchestrationConfig,
  logger: Logger,
): Promise<void> {
  const timeoutMs = config.escalationTimeoutMinutes * 60 * 1000;
  const now = Date.now();

  const items = await store.listWorkItems();
  const existingEscalations = await store.listEscalations();
  const openTimeoutKeys = new Set(
    existingEscalations
      .filter((e) => e.trigger === "timeout" && !e.resolvedAt && e.workItemId)
      .map((e) => e.workItemId),
  );

  for (const item of items) {
    if (openTimeoutKeys.has(item.id)) continue;

    for (const delegation of item.delegations) {
      if (delegation.status !== "active") continue;
      const startedAt = new Date(delegation.delegatedAt).getTime();
      if (now - startedAt < timeoutMs) continue;

      const target = await resolveEscalationTarget(store, item);
      if (!target) continue;

      await raiseEscalation(
        store,
        {
          trigger: "timeout",
          target,
          workItemId: item.id,
          sprintId: item.sprintId,
          agentId: delegation.toAgentId,
          message: `Delegation to ${delegation.toAgentId} for "${item.title}" (${item.id}) exceeded ${config.escalationTimeoutMinutes}m timeout.`,
        },
        logger,
      );
      break; // one escalation per item
    }
  }
}

// ---------------------------------------------------------------------------
// Resolve the escalation target for a work item, falling back to a
// default agent target if no team-level target is configured.
// ---------------------------------------------------------------------------

async function resolveEscalationTarget(
  store: OrchestrationStore,
  item: WorkItem,
): Promise<EscalationTarget | undefined> {
  // Walk up: sprint -> team -> team.escalationTarget
  const sprint = await store.getSprint(item.sprintId);
  if (!sprint) return undefined;

  const team = await store.getTeam(sprint.teamId);
  if (!team) return undefined;

  if (team.escalationTarget) return team.escalationTarget;

  // Fallback: notify the first coordinator in the team
  const coordinator = team.members.find((m) => m.role === "coordinator");
  if (coordinator) {
    return { kind: "agent", agentId: coordinator.agentId };
  }

  return undefined;
}
