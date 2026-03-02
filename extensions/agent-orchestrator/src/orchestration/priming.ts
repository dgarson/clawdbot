import { ROLE_INSTRUCTIONS, type AgentRole } from "../types.js";

export type FleetMember = {
  role: AgentRole | string;
  sessionKey: string;
  status: string;
};

export function buildRoleContext(
  role: AgentRole | undefined,
  taskDescription: string | undefined,
  fleetMembers: FleetMember[],
): string {
  if (!role) return "";

  const sections: string[] = [];

  // Role instructions
  const instructions = ROLE_INSTRUCTIONS[role];
  if (instructions) {
    sections.push(instructions);
  }

  // Task description
  if (taskDescription) {
    sections.push(`[Current Task] ${taskDescription}`);
  }

  // Fleet status (orchestrator and lead only)
  if ((role === "orchestrator" || role === "lead") && fleetMembers.length > 0) {
    const lines = fleetMembers.map((m) => `  ${m.role} (${m.sessionKey}): ${m.status}`);
    sections.push(`Active workers:\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}
