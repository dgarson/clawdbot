// ---------------------------------------------------------------------------
// Organization CRUD operations
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import type { OrchestrationStore } from "../storage.js";
import type { Organization } from "../types.js";

export async function createOrganization(
  store: OrchestrationStore,
  params: { name: string },
): Promise<Organization> {
  const org: Organization = {
    id: `org-${crypto.randomUUID().slice(0, 8)}`,
    name: params.name,
    teams: [],
  };
  await store.saveOrganization(org);
  return org;
}

export async function getOrganization(
  store: OrchestrationStore,
  id: string,
): Promise<Organization | undefined> {
  return store.getOrganization(id);
}

export async function listOrganizations(store: OrchestrationStore): Promise<Organization[]> {
  return store.listOrganizations();
}

export async function updateOrganization(
  store: OrchestrationStore,
  id: string,
  patch: { name?: string },
): Promise<Organization | undefined> {
  const org = await store.getOrganization(id);
  if (!org) return undefined;
  if (patch.name !== undefined) org.name = patch.name;
  await store.saveOrganization(org);
  return org;
}

export async function deleteOrganization(store: OrchestrationStore, id: string): Promise<boolean> {
  return store.deleteOrganization(id);
}

/**
 * Link a team ID to an organization (idempotent).
 */
export async function addTeamToOrganization(
  store: OrchestrationStore,
  orgId: string,
  teamId: string,
): Promise<Organization | undefined> {
  const org = await store.getOrganization(orgId);
  if (!org) return undefined;
  if (!org.teams.includes(teamId)) {
    org.teams.push(teamId);
    await store.saveOrganization(org);
  }
  return org;
}
