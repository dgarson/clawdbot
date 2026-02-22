import * as React from "react";
import { useOptionalGateway } from "@/providers/GatewayProvider";
import { useAgentStore } from "@/stores/useAgentStore";
import { showError, showSuccess } from "@/lib/toast";
import type { PendingApproval } from "@/components/domain/approvals";

export function useToolCallActions(approvals: PendingApproval[]) {
  const gatewayCtx = useOptionalGateway();
  const updateAgentWith = useAgentStore((s) => s.updateAgentWith);

  const approveToolCall = React.useCallback(async (toolCallId: string) => {
    const approval = approvals.find((a) => a.toolCall.toolCallId === toolCallId);
    if (!approval) {return;}
    if (!gatewayCtx?.isConnected) { showError("Gateway not connected."); return; }
    try {
      await gatewayCtx.client.request("tool.approve", { toolCallId });
      updateAgentWith(approval.agentId, (agent) => {
        const remaining = (agent.pendingToolCallIds ?? []).filter((id) => id !== toolCallId);
        return { ...agent, pendingToolCallIds: remaining, pendingApprovals: remaining.length };
      });
      showSuccess("Approved.");
    } catch {
      showError("Failed to approve. The request may have expired.");
    }
  }, [approvals, gatewayCtx, updateAgentWith]);

  const rejectToolCall = React.useCallback(async (toolCallId: string) => {
    const approval = approvals.find((a) => a.toolCall.toolCallId === toolCallId);
    if (!approval) {return;}
    if (!gatewayCtx?.isConnected) { showError("Gateway not connected."); return; }
    try {
      await gatewayCtx.client.request("tool.reject", { toolCallId, reason: "Denied by operator" });
      updateAgentWith(approval.agentId, (agent) => {
        const remaining = (agent.pendingToolCallIds ?? []).filter((id) => id !== toolCallId);
        return { ...agent, pendingToolCallIds: remaining, pendingApprovals: remaining.length };
      });
      showSuccess("Rejected.");
    } catch {
      showError("Failed to reject. The request may have expired.");
    }
  }, [approvals, gatewayCtx, updateAgentWith]);

  const approveAllForAgent = React.useCallback(async (agentId: string) => {
    if (!gatewayCtx?.isConnected) { showError("Gateway not connected."); return; }
    const agentApprovals = approvals.filter((a) => a.agentId === agentId);
    if (!agentApprovals.length) {return;}
    try {
      await Promise.all(
        agentApprovals.map((a) => gatewayCtx.client.request("tool.approve", { toolCallId: a.toolCall.toolCallId }))
      );
      updateAgentWith(agentId, (agent) => ({ ...agent, pendingToolCallIds: [], pendingApprovals: 0 }));
      showSuccess(`Approved ${agentApprovals.length} requests.`);
    } catch {
      showError("Failed to approve all. Some requests may have expired.");
    }
  }, [approvals, gatewayCtx, updateAgentWith]);

  const rejectAllForAgent = React.useCallback(async (agentId: string) => {
    if (!gatewayCtx?.isConnected) { showError("Gateway not connected."); return; }
    const agentApprovals = approvals.filter((a) => a.agentId === agentId);
    if (!agentApprovals.length) {return;}
    try {
      await Promise.all(
        agentApprovals.map((a) => gatewayCtx.client.request("tool.reject", { toolCallId: a.toolCall.toolCallId, reason: "Denied by operator" }))
      );
      updateAgentWith(agentId, (agent) => ({ ...agent, pendingToolCallIds: [], pendingApprovals: 0 }));
      showSuccess(`Rejected ${agentApprovals.length} requests.`);
    } catch {
      showError("Failed to reject all. Some requests may have expired.");
    }
  }, [approvals, gatewayCtx, updateAgentWith]);

  return { approveToolCall, rejectToolCall, approveAllForAgent, rejectAllForAgent };
}
