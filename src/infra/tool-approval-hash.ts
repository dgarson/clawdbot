import { createHash } from "node:crypto";

/**
 * Compute a deterministic SHA-256 request hash for tool approval anti-stale validation.
 * Follows the same canonical field contract as ToolApprovalManager.computeRequestHash.
 */
export function computeToolApprovalRequestHash(payload: {
  toolName: string;
  paramsSummary?: string | null;
  sessionKey?: string | null;
  agentId?: string | null;
}): string {
  const canonical = JSON.stringify({
    toolName: payload.toolName,
    paramsSummary: payload.paramsSummary ?? "",
    sessionKey: payload.sessionKey ?? "",
    agentId: payload.agentId ?? "",
  });
  return createHash("sha256").update(canonical).digest("hex");
}
