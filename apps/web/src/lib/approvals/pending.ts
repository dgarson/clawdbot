import type { Agent } from "@/stores/useAgentStore";

export function getAgentPendingApprovalCount(agent: Agent): number {
  const ids = agent.pendingToolCallIds;
  if (Array.isArray(ids)) {return ids.length;}
  if (typeof agent.pendingApprovals === "number") {return agent.pendingApprovals;}
  return 0;
}

function parseLastActiveMs(agent: Agent): number {
  if (!agent.lastActive) {return 0;}
  const ms = Date.parse(agent.lastActive);
  return Number.isFinite(ms) ? ms : 0;
}

export type PendingApprovalsSummary = {
  pendingApprovals: number;
  pendingAgents: number;
  nextAgentId: string | null;
};

export function derivePendingApprovalsSummary(
  agents: Agent[] | null | undefined,
): PendingApprovalsSummary {
  if (!agents || agents.length === 0) {
    return { pendingApprovals: 0, pendingAgents: 0, nextAgentId: null };
  }

  const candidates: Array<{ agent: Agent; pending: number; lastActiveMs: number }> = [];
  let pendingApprovals = 0;

  for (const agent of agents) {
    const pending = getAgentPendingApprovalCount(agent);
    if (pending <= 0) {continue;}
    pendingApprovals += pending;
    candidates.push({
      agent,
      pending,
      lastActiveMs: parseLastActiveMs(agent),
    });
  }

  candidates.sort((a, b) => {
    if (b.pending !== a.pending) {return b.pending - a.pending;}
    if (b.lastActiveMs !== a.lastActiveMs) {return b.lastActiveMs - a.lastActiveMs;}
    return a.agent.name.localeCompare(b.agent.name);
  });

  return {
    pendingApprovals,
    pendingAgents: candidates.length,
    nextAgentId: candidates[0]?.agent.id ?? null,
  };
}

