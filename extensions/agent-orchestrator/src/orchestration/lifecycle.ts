import { SPAWN_RULES, type AgentRole } from "../types.js";

const VALID_ROLES: Set<string> = new Set(["orchestrator", "lead", "scout", "builder", "reviewer"]);

export function extractRoleFromLabel(label: string | undefined): AgentRole | undefined {
  if (!label) return undefined;
  const candidate = label.includes(":") ? label.split(":")[0] : label;
  return VALID_ROLES.has(candidate) ? (candidate as AgentRole) : undefined;
}

/** Resolve role from config-driven agentId→role mapping. */
export function resolveAgentRoleFromConfig(
  agentId: string | undefined,
  agentRoles: Record<string, string> | undefined,
): AgentRole | undefined {
  if (!agentId || !agentRoles) return undefined;
  const candidate = agentRoles[agentId];
  if (!candidate) return undefined;
  return VALID_ROLES.has(candidate) ? (candidate as AgentRole) : undefined;
}

export type SpawnValidation = { allowed: true } | { allowed: false; reason: string };

export function validateSpawn(
  parentRole: AgentRole,
  childRole: AgentRole,
  parentDepth: number,
  maxDepth: number,
  activeAgentCount: number,
  maxConcurrentAgents: number,
): SpawnValidation {
  // Hierarchy check
  const allowed = SPAWN_RULES[parentRole];
  if (!allowed?.includes(childRole)) {
    return {
      allowed: false,
      reason: `${parentRole} cannot spawn ${childRole}. Allowed: ${allowed?.join(", ") || "none"}`,
    };
  }

  // Depth check
  const childDepth = parentDepth + 1;
  if (childDepth > maxDepth) {
    return {
      allowed: false,
      reason: `Max depth ${maxDepth} exceeded (child would be depth ${childDepth})`,
    };
  }

  // Concurrency check
  if (activeAgentCount >= maxConcurrentAgents) {
    return {
      allowed: false,
      reason: `Max concurrent agents (${maxConcurrentAgents}) reached`,
    };
  }

  return { allowed: true };
}
