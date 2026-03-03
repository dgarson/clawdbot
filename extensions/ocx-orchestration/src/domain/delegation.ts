// ---------------------------------------------------------------------------
// Delegation tracking
// ---------------------------------------------------------------------------

import type { OrchestrationStore } from "../storage.js";
import type { Delegation, DelegationStatus } from "../types.js";

/**
 * Record a new delegation on a work item.
 */
export async function addDelegation(
  store: OrchestrationStore,
  workItemId: string,
  delegation: Delegation,
): Promise<Delegation | undefined> {
  const item = await store.getWorkItem(workItemId);
  if (!item) return undefined;
  item.delegations.push(delegation);
  item.state = "in_progress";
  await store.saveWorkItem(item);
  return delegation;
}

/**
 * Find the currently active delegation for a work item.
 */
export function findActiveDelegation(delegations: Delegation[]): Delegation | undefined {
  return delegations.find((d) => d.status === "active");
}

/**
 * Find an active delegation by session key across all work items.
 */
export async function findActiveDelegationBySessionKey(
  store: OrchestrationStore,
  sessionKey: string,
): Promise<{ workItemId: string; delegation: Delegation } | undefined> {
  const items = await store.listWorkItems();
  for (const item of items) {
    const delegation = item.delegations.find(
      (d) => d.sessionKey === sessionKey && d.status === "active",
    );
    if (delegation) {
      return { workItemId: item.id, delegation };
    }
  }
  return undefined;
}

/**
 * Update a delegation's status and outcome. Also adjusts work item state
 * based on the delegation outcome.
 */
export async function completeDelegation(
  store: OrchestrationStore,
  workItemId: string,
  sessionKey: string,
  status: DelegationStatus,
  outcome?: string,
): Promise<Delegation | undefined> {
  const item = await store.getWorkItem(workItemId);
  if (!item) return undefined;

  const delegation = item.delegations.find(
    (d) => d.sessionKey === sessionKey && d.status === "active",
  );
  if (!delegation) return undefined;

  delegation.status = status;
  delegation.completedAt = new Date().toISOString();
  if (outcome) delegation.outcome = outcome;

  // Adjust work item state based on delegation result
  if (status === "completed") {
    // Move to in_review if all delegations are done
    const hasActive = item.delegations.some((d) => d.status === "active");
    if (!hasActive) {
      item.state = "in_review";
    }
  } else if (status === "failed") {
    item.state = "blocked";
  }

  await store.saveWorkItem(item);
  return delegation;
}
