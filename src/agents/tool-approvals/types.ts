import type { RiskClass, SideEffectType, ToolRiskAssessment } from "../tool-risk/types.js";

// ---------------------------------------------------------------------------
// Decision outcomes
// ---------------------------------------------------------------------------

export type ToolApprovalDecisionOutcome = "allow" | "deny" | "approval_required";

// ---------------------------------------------------------------------------
// Decision reason codes (machine-readable, stable)
// ---------------------------------------------------------------------------

export type ToolApprovalDecisionReason =
  | "mode_off"
  | "mode_always"
  | "config_disabled"
  | "policy_deny"
  | "policy_threshold"
  | "policy_external_write"
  | "policy_message_send"
  | "policy_allow";

// ---------------------------------------------------------------------------
// Blocked reason codes (machine-readable, stable)
// ---------------------------------------------------------------------------

export type ToolApprovalBlockedReason =
  | "policy_deny"
  | "approval_denied"
  | "approval_timeout"
  | "approval_request_failed";

// ---------------------------------------------------------------------------
// Orchestrator context — passed from the tool invocation path
// ---------------------------------------------------------------------------

export type ToolApprovalContext = {
  agentId?: string;
  sessionKey?: string;
  channel?: string;
  /** The resolved approvals.tools config. Undefined = feature disabled. */
  toolApprovalsConfig?: {
    enabled?: boolean;
    mode?: "off" | "adaptive" | "always";
    timeoutMs?: number;
    policy?: {
      requireApprovalAtOrAbove?: RiskClass;
      denyAtOrAbove?: RiskClass;
      requireApprovalForExternalWrite?: boolean;
      requireApprovalForMessagingSend?: boolean;
    };
  };
};

// ---------------------------------------------------------------------------
// Orchestrator result
// ---------------------------------------------------------------------------

export type ToolApprovalResult =
  | { allowed: true }
  | {
      allowed: false;
      code: "TOOL_APPROVAL_BLOCKED";
      reason: ToolApprovalBlockedReason;
      toolName: string;
      riskClass: RiskClass;
      message: string;
    };

// ---------------------------------------------------------------------------
// Approval request payload (sent to gateway)
// ---------------------------------------------------------------------------

export type ToolApprovalGatewayRequest = {
  toolName: string;
  paramsSummary: string;
  riskClass: RiskClass;
  sideEffects: SideEffectType[];
  reasonCodes: string[];
  sessionKey?: string | null;
  agentId?: string | null;
  requestHash: string;
  timeoutMs: number;
};

// ---------------------------------------------------------------------------
// Gateway call function signature (injected for testability)
// ---------------------------------------------------------------------------

export type GatewayCallFn = (opts: {
  method: string;
  params: Record<string, unknown>;
  timeoutMs: number;
}) => Promise<{ decision: string | null }>;

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------

export type { RiskClass, ToolRiskAssessment };
