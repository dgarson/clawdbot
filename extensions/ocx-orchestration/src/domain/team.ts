// ---------------------------------------------------------------------------
// Team CRUD + member management
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import type { OrchestrationStore } from "../storage.js";
import type { EscalationTarget, Team, TeamMember } from "../types.js";
import { addTeamToOrganization } from "./organization.js";

export async function createTeam(
  store: OrchestrationStore,
  params: {
    name: string;
    organizationId: string;
    members?: TeamMember[];
    escalationTarget?: EscalationTarget;
  },
): Promise<Team> {
  const team: Team = {
    id: `team-${crypto.randomUUID().slice(0, 8)}`,
    name: params.name,
    organizationId: params.organizationId,
    members: params.members ?? [],
    escalationTarget: params.escalationTarget,
  };
  await store.saveTeam(team);
  // Link back to the org
  await addTeamToOrganization(store, params.organizationId, team.id);
  return team;
}

export async function getTeam(store: OrchestrationStore, id: string): Promise<Team | undefined> {
  return store.getTeam(id);
}

export async function listTeams(
  store: OrchestrationStore,
  filters?: { organizationId?: string },
): Promise<Team[]> {
  const all = await store.listTeams();
  if (filters?.organizationId) {
    return all.filter((t) => t.organizationId === filters.organizationId);
  }
  return all;
}

export async function updateTeam(
  store: OrchestrationStore,
  id: string,
  patch: { name?: string; escalationTarget?: EscalationTarget },
): Promise<Team | undefined> {
  const team = await store.getTeam(id);
  if (!team) return undefined;
  if (patch.name !== undefined) team.name = patch.name;
  if (patch.escalationTarget !== undefined) team.escalationTarget = patch.escalationTarget;
  await store.saveTeam(team);
  return team;
}

export async function deleteTeam(store: OrchestrationStore, id: string): Promise<boolean> {
  return store.deleteTeam(id);
}

// -- Member management -----------------------------------------------------

export async function addMember(
  store: OrchestrationStore,
  teamId: string,
  member: TeamMember,
): Promise<Team | undefined> {
  const team = await store.getTeam(teamId);
  if (!team) return undefined;
  // Replace if agent already exists in team
  const idx = team.members.findIndex((m) => m.agentId === member.agentId);
  if (idx >= 0) {
    team.members[idx] = member;
  } else {
    team.members.push(member);
  }
  await store.saveTeam(team);
  return team;
}

export async function removeMember(
  store: OrchestrationStore,
  teamId: string,
  agentId: string,
): Promise<Team | undefined> {
  const team = await store.getTeam(teamId);
  if (!team) return undefined;
  team.members = team.members.filter((m) => m.agentId !== agentId);
  await store.saveTeam(team);
  return team;
}

export async function listMembers(
  store: OrchestrationStore,
  teamId: string,
): Promise<TeamMember[]> {
  const team = await store.getTeam(teamId);
  return team?.members ?? [];
}
