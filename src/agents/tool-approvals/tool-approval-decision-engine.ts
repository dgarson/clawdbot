import type { RiskClass, ToolRiskAssessment } from "../tool-risk/types.js";
import type {
  ToolApprovalContext,
  ToolApprovalDecisionOutcome,
  ToolApprovalDecisionReason,
} from "./types.js";
import { compareRiskClass } from "../tool-risk/types.js";

// ---------------------------------------------------------------------------
// Side effect types that trigger policy flags
// ---------------------------------------------------------------------------

const EXTERNAL_WRITE_EFFECTS = new Set([
  "network_egress",
  "deployment",
  "billing_mutation",
  "data_delete",
  "config_mutation",
  "system_state",
]);

const MESSAGING_SEND_EFFECTS = new Set(["message_send"]);

// ---------------------------------------------------------------------------
// Structured decision result
// ---------------------------------------------------------------------------

export type ToolApprovalDecisionResult = {
  outcome: ToolApprovalDecisionOutcome;
  reason: ToolApprovalDecisionReason;
};

// ---------------------------------------------------------------------------
// Config resolution with smart defaults
// ---------------------------------------------------------------------------

export type ResolvedToolApprovalConfig = {
  enabled: boolean;
  mode: "off" | "adaptive" | "always";
  timeoutMs: number;
  requireApprovalAtOrAbove: RiskClass;
  denyAtOrAbove: RiskClass | null;
  requireApprovalForExternalWrite: boolean;
  requireApprovalForMessagingSend: boolean;
};

const DEFAULTS = {
  mode: "off" as const,
  timeoutMs: 120_000,
  requireApprovalAtOrAbove: "R3" as RiskClass,
  denyAtOrAbove: null,
  requireApprovalForExternalWrite: false,
  requireApprovalForMessagingSend: false,
};

export function resolveToolApprovalConfig(
  config?: ToolApprovalContext["toolApprovalsConfig"],
): ResolvedToolApprovalConfig {
  if (!config || config.enabled === false) {
    return { enabled: false, ...DEFAULTS };
  }
  return {
    enabled: true,
    mode: config.mode ?? DEFAULTS.mode,
    timeoutMs: config.timeoutMs ?? DEFAULTS.timeoutMs,
    requireApprovalAtOrAbove:
      config.policy?.requireApprovalAtOrAbove ?? DEFAULTS.requireApprovalAtOrAbove,
    denyAtOrAbove: config.policy?.denyAtOrAbove ?? DEFAULTS.denyAtOrAbove,
    requireApprovalForExternalWrite:
      config.policy?.requireApprovalForExternalWrite ?? DEFAULTS.requireApprovalForExternalWrite,
    requireApprovalForMessagingSend:
      config.policy?.requireApprovalForMessagingSend ?? DEFAULTS.requireApprovalForMessagingSend,
  };
}

// ---------------------------------------------------------------------------
// Decision Engine
//
// Applies the config-driven policy to a risk assessment and returns
// a deterministic decision: allow, deny, or approval_required.
// ---------------------------------------------------------------------------

export function decideToolApproval(
  assessment: ToolRiskAssessment,
  ctx: ToolApprovalContext,
): ToolApprovalDecisionResult {
  const config = ctx.toolApprovalsConfig;

  // No config or disabled = allow (backward-compatible default)
  if (!config || config.enabled === false) {
    return { outcome: "allow", reason: "config_disabled" };
  }

  const mode = config.mode ?? "off";

  // mode=off -> always allow
  if (mode === "off") {
    return { outcome: "allow", reason: "mode_off" };
  }

  const policy = config.policy;

  // Check deny threshold first (deny wins over approval)
  if (policy?.denyAtOrAbove) {
    if (compareRiskClass(assessment.riskClass, policy.denyAtOrAbove) >= 0) {
      return { outcome: "deny", reason: "policy_deny" };
    }
  }

  // mode=always -> everything not denied requires approval
  if (mode === "always") {
    return { outcome: "approval_required", reason: "mode_always" };
  }

  // mode=adaptive -> use policy thresholds
  const approvalThreshold = policy?.requireApprovalAtOrAbove ?? "R3";
  if (compareRiskClass(assessment.riskClass, approvalThreshold) >= 0) {
    return { outcome: "approval_required", reason: "policy_threshold" };
  }

  // Check side-effect-based policy flags
  if (policy?.requireApprovalForExternalWrite) {
    const hasExternalWrite = assessment.sideEffects.some((effect) =>
      EXTERNAL_WRITE_EFFECTS.has(effect),
    );
    if (hasExternalWrite) {
      return { outcome: "approval_required", reason: "policy_external_write" };
    }
  }

  if (policy?.requireApprovalForMessagingSend) {
    const hasMessaging = assessment.sideEffects.some((effect) =>
      MESSAGING_SEND_EFFECTS.has(effect),
    );
    if (hasMessaging) {
      return { outcome: "approval_required", reason: "policy_message_send" };
    }
  }

  return { outcome: "allow", reason: "policy_allow" };
}
