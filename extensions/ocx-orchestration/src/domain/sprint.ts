// ---------------------------------------------------------------------------
// Sprint lifecycle + state machine transitions
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import type { OrchestrationStore } from "../storage.js";
import type { Sprint, SprintState } from "../types.js";

// ---------------------------------------------------------------------------
// State machine: allowed transitions
//   planning -> active
//   active   -> review
//   review   -> retrospective
//   review   -> active (reopen)
//   retrospective -> closed
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<SprintState, SprintState[]> = {
  planning: ["active"],
  active: ["review"],
  review: ["retrospective", "active"],
  retrospective: ["closed"],
  closed: [],
};

export class InvalidSprintTransitionError extends Error {
  constructor(from: SprintState, to: SprintState) {
    super(`Invalid sprint transition: ${from} -> ${to}`);
    this.name = "InvalidSprintTransitionError";
  }
}

/**
 * Check whether a sprint state transition is legal.
 */
export function isValidTransition(from: SprintState, to: SprintState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createSprint(
  store: OrchestrationStore,
  params: {
    teamId: string;
    name: string;
    budgetScopeId?: string;
  },
): Promise<Sprint> {
  const now = new Date().toISOString();
  const sprint: Sprint = {
    id: `sprint-${crypto.randomUUID().slice(0, 8)}`,
    teamId: params.teamId,
    name: params.name,
    state: "planning",
    budgetScopeId: params.budgetScopeId,
    workItems: [],
    createdAt: now,
    updatedAt: now,
  };
  await store.saveSprint(sprint);
  return sprint;
}

export async function getSprint(
  store: OrchestrationStore,
  id: string,
): Promise<Sprint | undefined> {
  return store.getSprint(id);
}

export async function listSprints(
  store: OrchestrationStore,
  filters?: { teamId?: string; state?: SprintState },
): Promise<Sprint[]> {
  const all = await store.listSprints();
  return all.filter((s) => {
    if (filters?.teamId && s.teamId !== filters.teamId) return false;
    if (filters?.state && s.state !== filters.state) return false;
    return true;
  });
}

/**
 * Transition a sprint to a new state. Enforces the state machine -- throws
 * InvalidSprintTransitionError if the transition is not allowed.
 */
export async function transitionSprint(
  store: OrchestrationStore,
  sprintId: string,
  targetState: SprintState,
): Promise<Sprint> {
  const sprint = await store.getSprint(sprintId);
  if (!sprint) {
    throw new Error(`Sprint not found: ${sprintId}`);
  }
  if (!isValidTransition(sprint.state, targetState)) {
    throw new InvalidSprintTransitionError(sprint.state, targetState);
  }
  sprint.state = targetState;
  sprint.updatedAt = new Date().toISOString();
  await store.saveSprint(sprint);
  return sprint;
}

/**
 * Add a work item ID to a sprint's list (idempotent).
 */
export async function addWorkItemToSprint(
  store: OrchestrationStore,
  sprintId: string,
  workItemId: string,
): Promise<Sprint | undefined> {
  const sprint = await store.getSprint(sprintId);
  if (!sprint) return undefined;
  if (!sprint.workItems.includes(workItemId)) {
    sprint.workItems.push(workItemId);
    sprint.updatedAt = new Date().toISOString();
    await store.saveSprint(sprint);
  }
  return sprint;
}

/**
 * Generate a sprint status report summarising work item counts by state.
 */
export async function getSprintReport(
  store: OrchestrationStore,
  sprintId: string,
): Promise<
  | {
      sprint: Sprint;
      workItemCounts: Record<string, number>;
      totalItems: number;
    }
  | undefined
> {
  const sprint = await store.getSprint(sprintId);
  if (!sprint) return undefined;

  const items = await store.listWorkItems();
  const sprintItems = items.filter((w) => w.sprintId === sprintId);

  const workItemCounts: Record<string, number> = {};
  for (const item of sprintItems) {
    workItemCounts[item.state] = (workItemCounts[item.state] ?? 0) + 1;
  }

  return { sprint, workItemCounts, totalItems: sprintItems.length };
}
