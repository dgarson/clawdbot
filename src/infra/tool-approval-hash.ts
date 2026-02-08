import { computeToolApprovalRequestHash as computeHash } from "./tool-approvals.js";

/**
 * Compute a deterministic SHA-256 request hash for tool approval anti-stale validation.
 *
 * Delegates to the canonical implementation in `./tool-approvals.ts`, passing
 * only the legacy 4 fields so existing callers continue to work without import changes.
 */
export function computeToolApprovalRequestHash(payload: {
  toolName: string;
  paramsSummary?: string | null;
  sessionKey?: string | null;
  agentId?: string | null;
}): string {
  return computeHash({
    toolName: payload.toolName,
    paramsSummary: payload.paramsSummary,
    sessionKey: payload.sessionKey,
    agentId: payload.agentId,
  });
}
