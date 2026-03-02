import { ROLE_BLOCKED_TOOLS, ORCHESTRATION_ONLY_TOOLS, type AgentRole } from "../types.js";

export type BlockResult = { block: true; reason: string } | null;

export function shouldBlockTool(role: AgentRole | undefined, toolName: string): BlockResult {
  if (!role) return null;

  // Check role-specific blocked tools
  const blocked = ROLE_BLOCKED_TOOLS[role];
  if (blocked?.includes(toolName)) {
    return {
      block: true,
      reason: `[orchestrator] ${role} agents cannot use ${toolName}`,
    };
  }

  // Check orchestration-only tools
  if (ORCHESTRATION_ONLY_TOOLS.includes(toolName) && role !== "orchestrator" && role !== "lead") {
    return {
      block: true,
      reason: `[orchestrator] ${role} agents cannot use ${toolName} (orchestration-only)`,
    };
  }

  return null;
}
