// ---------------------------------------------------------------------------
// Escalation detection + notification
//
// Escalation does not require new hooks -- the orchestration plugin's
// background service monitors events and triggers escalations via existing
// tools (sessions_send to notify agents, HTTP routes for webhooks).
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import { emitAgentEvent } from "openclaw/plugin-sdk";
import type { OrchestrationStore } from "./storage.js";
import type { EscalationRecord, EscalationTarget, EscalationTrigger } from "./types.js";

type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };

export type EscalationEvent = {
  trigger: EscalationTrigger;
  target: EscalationTarget;
  workItemId?: string;
  sprintId?: string;
  teamId?: string;
  agentId?: string;
  message: string;
};

/**
 * Create and persist an escalation record, then dispatch notification.
 */
export async function raiseEscalation(
  store: OrchestrationStore,
  event: EscalationEvent,
  logger: Logger,
): Promise<EscalationRecord> {
  const record: EscalationRecord = {
    id: `esc-${crypto.randomUUID().slice(0, 8)}`,
    trigger: event.trigger,
    target: event.target,
    workItemId: event.workItemId,
    sprintId: event.sprintId,
    teamId: event.teamId,
    agentId: event.agentId,
    message: event.message,
    createdAt: new Date().toISOString(),
  };

  await store.saveEscalation(record);
  await dispatchNotification(record, logger);

  emitAgentEvent({
    runId: `orch-${record.id}`,
    stream: "orchestration",
    data: {
      family: "orchestration",
      type: "escalation.raised",
      trigger: event.trigger,
      agentId: event.agentId,
      workItemId: event.workItemId,
      sprintId: event.sprintId,
      teamId: event.teamId,
    },
  });

  return record;
}

/**
 * Resolve (close) an open escalation.
 */
export async function resolveEscalation(
  store: OrchestrationStore,
  escalationId: string,
  resolution: string,
): Promise<EscalationRecord | undefined> {
  const record = await store.getEscalation(escalationId);
  if (!record) return undefined;
  if (record.resolvedAt) return record; // already resolved

  record.resolvedAt = new Date().toISOString();
  record.resolution = resolution;
  await store.saveEscalation(record);
  return record;
}

/**
 * List open (unresolved) escalations.
 */
export async function listOpenEscalations(
  store: OrchestrationStore,
  filters?: { teamId?: string; sprintId?: string },
): Promise<EscalationRecord[]> {
  const all = await store.listEscalations();
  return all.filter((e) => {
    if (e.resolvedAt) return false;
    if (filters?.teamId && e.teamId !== filters.teamId) return false;
    if (filters?.sprintId && e.sprintId !== filters.sprintId) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Notification dispatch
// ---------------------------------------------------------------------------

async function dispatchNotification(record: EscalationRecord, logger: Logger): Promise<void> {
  const { target } = record;

  switch (target.kind) {
    case "agent":
      // In a full implementation this would use sessions_send to the agent.
      // For now, log so the monitor/gateway layer can pick it up.
      logger.info(
        `[orchestration] Escalation ${record.id} -> agent ${target.agentId}: ${record.message}`,
      );
      break;
    case "team":
      logger.info(
        `[orchestration] Escalation ${record.id} -> team ${target.teamId}: ${record.message}`,
      );
      break;
    case "webhook":
      try {
        await fetch(target.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });
        logger.info(`[orchestration] Escalation ${record.id} webhook sent to ${target.url}`);
      } catch (err) {
        logger.error(
          `[orchestration] Escalation ${record.id} webhook failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      break;
  }
}
