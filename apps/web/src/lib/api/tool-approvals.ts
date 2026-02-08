/**
 * Tool approvals API functions.
 *
 * Maps to gateway RPC methods:
 *   - tool.approvals.get
 *   - tool.approval.resolve
 */

import { getGatewayClient } from "./gateway-client";

export type ToolApprovalDecision = "allow-once" | "allow-always" | "deny";

export interface ToolApprovalEntry {
  id: string;
  toolName: string;
  paramsSummary?: string | null;
  riskClass?: string | null;
  sideEffects?: string[] | null;
  reasonCodes?: string[] | null;
  requestHash: string;
  sessionKey?: string | null;
  agentId?: string | null;
  createdAtMs: number;
  expiresAtMs: number;
}

export interface ToolApprovalsListResult {
  approvals: ToolApprovalEntry[];
}

export async function listToolApprovals(): Promise<ToolApprovalsListResult> {
  const client = getGatewayClient();
  return client.request<ToolApprovalsListResult>("tool.approvals.get", {});
}

export async function resolveToolApproval(params: {
  id: string;
  decision: ToolApprovalDecision;
  requestHash: string;
}): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request("tool.approval.resolve", params);
}
