import { useQuery } from "@tanstack/react-query";
import {
  listToolApprovals,
  type ToolApprovalEntry,
  type ToolApprovalsListResult,
} from "@/lib/api/tool-approvals";
import { useGateway } from "@/providers";
import { useGatewayEnabled } from "../useGatewayEnabled";

export const toolApprovalKeys = {
  all: ["toolApprovals"] as const,
  list: () => [...toolApprovalKeys.all, "list"] as const,
};

const mockApprovals: ToolApprovalEntry[] = [
  {
    id: "approval-001",
    toolName: "browser",
    paramsSummary: "Navigate to dashboard",
    riskClass: "R2",
    requestHash: "mock-hash-001",
    agentId: "main",
    sessionKey: "agent:main:browser",
    createdAtMs: Date.now() - 120000,
    expiresAtMs: Date.now() + 180000,
  },
];

async function fetchToolApprovals(live: boolean): Promise<ToolApprovalsListResult> {
  if (!live) {
    await new Promise((r) => setTimeout(r, 300));
    return { approvals: mockApprovals };
  }
  return listToolApprovals();
}

export function useToolApprovals() {
  const { isConnected } = useGateway();
  const gatewayEnabled = useGatewayEnabled();
  const live = gatewayEnabled || isConnected;
  return useQuery({
    queryKey: toolApprovalKeys.list(),
    queryFn: () => fetchToolApprovals(live),
    staleTime: 1000 * 15,
  });
}

export type { ToolApprovalEntry, ToolApprovalsListResult } from "@/lib/api/tool-approvals";
