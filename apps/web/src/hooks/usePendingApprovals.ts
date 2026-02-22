import { useAgentStore } from "@/stores/useAgentStore";
import type { PendingApproval } from "@/components/domain/approvals";

/**
 * Derives PendingApproval[] from all agents' pendingToolCallIds.
 *
 * NOTE: The agent store only persists tool call IDs, not full ToolCall objects.
 * We synthesize minimal ToolCall records from available agent data:
 * - toolName: parsed from agent.currentTask ("Approve X access" → "X"), or the raw ID
 * - args: {} (not available without a separate tool call details store)
 * - risk: "medium" default (not persisted per tool call)
 * - createdAtMs: from agent.lastActive if available, else Date.now()
 *
 * When the backend provides per-toolcall details (toolName, args, risk) on the
 * agent record or a separate store, update this hook accordingly.
 */
export function usePendingApprovals(): PendingApproval[] {
  const agents = useAgentStore((s) => s.agents);

  const approvals: PendingApproval[] = [];

  for (const agent of agents) {
    const ids = agent.pendingToolCallIds;
    if (!ids || ids.length === 0) continue;

    // Parse the tool name from currentTask label: "Approve read_file access" → "read_file"
    const toolNameFromTask = agent.currentTask
      ? parseToolNameFromTask(agent.currentTask)
      : null;

    const createdAtMs = agent.lastActive
      ? (Date.parse(agent.lastActive) || Date.now())
      : Date.now();

    for (const toolCallId of ids) {
      approvals.push({
        toolCall: {
          toolCallId,
          toolName: toolNameFromTask ?? toolCallId,
          args: {},
          status: "pending",
          risk: "medium",
        },
        agentId: agent.id,
        agentName: agent.name,
        createdAtMs,
      });
    }
  }

  return approvals;
}

/**
 * Extracts the tool name from a pending task label.
 * Pattern: "Approve {tool_name} access" → "{tool_name}"
 */
function parseToolNameFromTask(currentTask: string): string | null {
  const match = /^Approve (.+) access$/.exec(currentTask);
  return match ? match[1] : null;
}
