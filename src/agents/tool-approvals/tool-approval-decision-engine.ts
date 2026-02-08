import type { ToolRiskAssessment } from "../tool-risk/types.js";
import type { ToolApprovalContext, ToolApprovalDecisionOutcome } from "./types.js";
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
// Decision Engine
//
// Applies the config-driven policy to a risk assessment and returns
// a deterministic decision: allow, deny, or approval_required.
// ---------------------------------------------------------------------------

export function decideToolApproval(
  assessment: ToolRiskAssessment,
  ctx: ToolApprovalContext,
): ToolApprovalDecisionOutcome {
  const config = ctx.toolApprovalsConfig;

  // No config or disabled = allow (backward-compatible default)
  if (!config || config.enabled === false) {
    return "allow";
  }

  const mode = config.mode ?? "off";

  // mode=off -> always allow
  if (mode === "off") {
    return "allow";
  }

  const policy = config.policy;

  // Check deny threshold first (deny wins over approval)
  if (policy?.denyAtOrAbove) {
    if (compareRiskClass(assessment.riskClass, policy.denyAtOrAbove) >= 0) {
      return "deny";
    }
  }

  // mode=always -> everything not denied requires approval
  if (mode === "always") {
    return "approval_required";
  }

  // mode=adaptive -> use policy thresholds
  const approvalThreshold = policy?.requireApprovalAtOrAbove ?? "R3";
  if (compareRiskClass(assessment.riskClass, approvalThreshold) >= 0) {
    return "approval_required";
  }

  // Check side-effect-based policy flags
  if (policy?.requireApprovalForExternalWrite) {
    const hasExternalWrite = assessment.sideEffects.some((effect) =>
      EXTERNAL_WRITE_EFFECTS.has(effect),
    );
    if (hasExternalWrite) {
      return "approval_required";
    }
  }

  if (policy?.requireApprovalForMessagingSend) {
    const hasMessaging = assessment.sideEffects.some((effect) =>
      MESSAGING_SEND_EFFECTS.has(effect),
    );
    if (hasMessaging) {
      return "approval_required";
    }
  }

  return "allow";
}
