import { ROLE_INSTRUCTIONS, type AgentRole } from "../types.js";

// Concise behavioral triggers for proactive mail usage (per role)
export const ROLE_MAIL_GUIDANCE: Record<AgentRole, string> = {
  orchestrator:
    "[Mail Guidance] Check inbox between planning steps and after spawning agents. " +
    "Send task assignments immediately after spawning. " +
    "Request status updates for long-running agents via mail.",
  lead:
    "[Mail Guidance] Check inbox between planning steps and after spawning agents. " +
    "Send task assignments immediately after spawning. " +
    "Request status updates for long-running agents via mail.",
  scout:
    "[Mail Guidance] Always mail your lead when done with findings. " +
    "Check inbox every 3–4 tool calls for clarifications or priority changes. " +
    "Acknowledge received messages promptly.",
  builder:
    "[Mail Guidance] Always mail your lead when done with results. " +
    "Check inbox every 3–4 tool calls for clarifications or priority changes. " +
    "Acknowledge received messages promptly.",
  reviewer:
    "[Mail Guidance] Always mail your lead when done with your verdict. " +
    "Check inbox every 3–4 tool calls for clarifications or priority changes. " +
    "Acknowledge received messages promptly.",
};

export type FleetMember = {
  role: AgentRole | string;
  sessionKey: string;
  status: string;
};

/**
 * Optional skill-sourced role instructions. When provided, these override ROLE_INSTRUCTIONS.
 * Parsed from the orchestrate skill file at startup.
 */
export type SkillRoleInstructions = Partial<Record<AgentRole, string>>;

export function buildRoleContext(
  role: AgentRole | undefined,
  taskDescription: string | undefined,
  fleetMembers: FleetMember[],
  skillInstructions?: SkillRoleInstructions,
): string {
  if (!role) return "";

  const sections: string[] = [];

  // Role instructions — prefer skill-sourced, fall back to hardcoded
  const instructions = skillInstructions?.[role] ?? ROLE_INSTRUCTIONS[role];
  if (instructions) {
    sections.push(instructions);
  }

  // Mail guidance — proactive behavioral triggers
  const mailGuidance = ROLE_MAIL_GUIDANCE[role];
  if (mailGuidance) {
    sections.push(mailGuidance);
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
