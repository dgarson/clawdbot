// ---------------------------------------------------------------------------
// Work item CRUD + state transitions
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import type { OrchestrationStore } from "../storage.js";
import type { AgentRole, WorkItem, WorkItemState } from "../types.js";
import { addWorkItemToSprint } from "./sprint.js";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export type CreateWorkItemParams = {
  sprintId: string;
  title: string;
  description: string;
  assigneeAgentId?: string;
  requiredRole?: AgentRole;
  acceptanceCriteria?: string[];
  externalRefs?: string[];
};

export async function createWorkItem(
  store: OrchestrationStore,
  params: CreateWorkItemParams,
): Promise<WorkItem> {
  const item: WorkItem = {
    id: `wi-${crypto.randomUUID().slice(0, 8)}`,
    sprintId: params.sprintId,
    title: params.title,
    description: params.description,
    state: "backlog",
    assigneeAgentId: params.assigneeAgentId,
    requiredRole: params.requiredRole,
    acceptanceCriteria: params.acceptanceCriteria ?? [],
    delegations: [],
    reviews: [],
    externalRefs: params.externalRefs ?? [],
  };
  await store.saveWorkItem(item);
  // Link to sprint
  await addWorkItemToSprint(store, params.sprintId, item.id);
  return item;
}

export async function getWorkItem(
  store: OrchestrationStore,
  id: string,
): Promise<WorkItem | undefined> {
  return store.getWorkItem(id);
}

export async function listWorkItems(
  store: OrchestrationStore,
  filters?: { sprintId?: string; state?: WorkItemState; assigneeAgentId?: string },
): Promise<WorkItem[]> {
  const all = await store.listWorkItems();
  return all.filter((w) => {
    if (filters?.sprintId && w.sprintId !== filters.sprintId) return false;
    if (filters?.state && w.state !== filters.state) return false;
    if (filters?.assigneeAgentId && w.assigneeAgentId !== filters.assigneeAgentId) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

export async function updateWorkItemState(
  store: OrchestrationStore,
  id: string,
  state: WorkItemState,
): Promise<WorkItem | undefined> {
  const item = await store.getWorkItem(id);
  if (!item) return undefined;
  item.state = state;
  await store.saveWorkItem(item);
  return item;
}

// ---------------------------------------------------------------------------
// Field updates
// ---------------------------------------------------------------------------

export type WorkItemPatch = {
  title?: string;
  description?: string;
  state?: WorkItemState;
  assigneeAgentId?: string;
  requiredRole?: AgentRole;
  acceptanceCriteria?: string[];
  externalRefs?: string[];
};

export async function updateWorkItem(
  store: OrchestrationStore,
  id: string,
  patch: WorkItemPatch,
): Promise<WorkItem | undefined> {
  const item = await store.getWorkItem(id);
  if (!item) return undefined;
  if (patch.title !== undefined) item.title = patch.title;
  if (patch.description !== undefined) item.description = patch.description;
  if (patch.state !== undefined) item.state = patch.state;
  if (patch.assigneeAgentId !== undefined) item.assigneeAgentId = patch.assigneeAgentId;
  if (patch.requiredRole !== undefined) item.requiredRole = patch.requiredRole;
  if (patch.acceptanceCriteria !== undefined) item.acceptanceCriteria = patch.acceptanceCriteria;
  if (patch.externalRefs !== undefined) item.externalRefs = patch.externalRefs;
  await store.saveWorkItem(item);
  return item;
}

// ---------------------------------------------------------------------------
// External ref helpers
// ---------------------------------------------------------------------------

export async function addExternalRef(
  store: OrchestrationStore,
  id: string,
  ref: string,
): Promise<WorkItem | undefined> {
  const item = await store.getWorkItem(id);
  if (!item) return undefined;
  if (!item.externalRefs.includes(ref)) {
    item.externalRefs.push(ref);
    await store.saveWorkItem(item);
  }
  return item;
}

/**
 * Find a work item that references the given external URL.
 */
export async function findByExternalRef(
  store: OrchestrationStore,
  ref: string,
): Promise<WorkItem | undefined> {
  const all = await store.listWorkItems();
  return all.find((w) => w.externalRefs.includes(ref));
}
