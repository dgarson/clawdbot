import * as React from "react";
import { useOptionalGateway } from "@/providers/GatewayProvider";
import { useAgentStore } from "@/stores/useAgentStore";
import { showError, showSuccess, showWarning } from "@/lib/toast";
import { toolApprovalKeys, useToolApprovals } from "@/hooks/queries/useToolApprovals";
import { resolveToolApproval } from "@/lib/api/tool-approvals";
import { useQueryClient } from "@tanstack/react-query";

export function useAgentApprovalActions() {
  const gatewayCtx = useOptionalGateway();
  const updateAgentWith = useAgentStore((s) => s.updateAgentWith);
  const { data: toolApprovals } = useToolApprovals();
  const queryClient = useQueryClient();

  const resolveApprovals = React.useCallback(
    async (agentId: string, decision: "allow-once" | "deny") => {
      const approvals = toolApprovals?.approvals ?? [];
      const agent = useAgentStore.getState().agents.find((entry) => entry.id === agentId);
      const pendingIds = new Set(agent?.pendingToolCallIds ?? []);
      let pending =
        pendingIds.size > 0
          ? approvals.filter((approval) => pendingIds.has(approval.id))
          : approvals.filter((approval) => approval.agentId === agentId);

      if (pendingIds.size > 0 && pending.length === 0) {
        pending = approvals.filter((approval) => approval.agentId === agentId);
      }

      if (!pending.length) {
        showWarning("No pending approvals for this agent.");
        return false;
      }
      if (!gatewayCtx?.isConnected) {
        showWarning("Gateway not connected — approval stubbed.");
        return false;
      }

      const missingHash = pending.find((approval) => !approval.requestHash);
      if (missingHash) {
        showWarning("Approval metadata is incomplete. Refresh and try again.");
        return false;
      }

      try {
        await Promise.all(
          pending.map((approval) =>
            resolveToolApproval({
              id: approval.id,
              decision,
              requestHash: approval.requestHash,
            })
          )
        );
        updateAgentWith(agentId, (entry) => ({
          ...entry,
          pendingToolCallIds: [],
          pendingApprovals: 0,
        }));
        void queryClient.invalidateQueries({ queryKey: toolApprovalKeys.list() });
        const verb = decision === "deny" ? "Denied" : "Approved";
        showSuccess(
          `${verb} ${pending.length} request${pending.length === 1 ? "" : "s"} for ${agent?.name ?? "agent"}.`
        );
        return true;
      } catch (error) {
        console.error("Failed to resolve pending tool approvals:", error);
        showError(
          "Failed to resolve approvals. The request may have expired in the gateway; ask the agent to retry."
        );
        return false;
      }
    },
    [gatewayCtx, queryClient, toolApprovals?.approvals, updateAgentWith]
  );

  const approvePending = React.useCallback(
    async (agentId: string) => resolveApprovals(agentId, "allow-once"),
    [resolveApprovals]
  );

  const denyPending = React.useCallback(
    async (agentId: string) => resolveApprovals(agentId, "deny"),
    [resolveApprovals]
  );

  return { approvePending, denyPending };
}

export default useAgentApprovalActions;
