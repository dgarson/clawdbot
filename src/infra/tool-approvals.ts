import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Canonical decision values
// ---------------------------------------------------------------------------

export const TOOL_APPROVAL_DECISIONS = ["allow-once", "allow-always", "deny"] as const;
export type ToolApprovalDecision = (typeof TOOL_APPROVAL_DECISIONS)[number];

// ---------------------------------------------------------------------------
// Risk class taxonomy (mirrors agents/tool-risk but usable from infra layer)
// ---------------------------------------------------------------------------

export const TOOL_RISK_CLASSES = ["R0", "R1", "R2", "R3", "R4"] as const;
export type ToolRiskClass = (typeof TOOL_RISK_CLASSES)[number];

// ---------------------------------------------------------------------------
// Enhanced hash input
// ---------------------------------------------------------------------------

export type ToolApprovalHashInput = {
  toolName: string;
  paramsSummary?: string | null;
  policyVersion?: string | null;
  riskClass?: string | null;
  sideEffects?: string[];
  reasonCodes?: string[];
  sessionKey?: string | null;
  agentId?: string | null;
};

function normalizeList(items?: string[]): string[] {
  if (!items?.length) {
    return [];
  }
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .toSorted();
}

/**
 * Compute a deterministic SHA-256 request hash for tool approval anti-stale validation.
 *
 * Backward compatible: when only `toolName`, `paramsSummary`, `sessionKey`, and `agentId`
 * are provided, the extra fields default to empty strings/arrays and produce the same hash
 * as the legacy 4-field version.
 */
export function computeToolApprovalRequestHash(input: ToolApprovalHashInput): string {
  const normalized = {
    toolName: (input.toolName ?? "").trim(),
    paramsSummary: (input.paramsSummary ?? "").trim(),
    policyVersion: (input.policyVersion ?? "").trim(),
    riskClass: (input.riskClass ?? "").trim(),
    sideEffects: normalizeList(input.sideEffects),
    reasonCodes: normalizeList(input.reasonCodes),
    sessionKey: (input.sessionKey ?? "").trim(),
    agentId: (input.agentId ?? "").trim(),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
