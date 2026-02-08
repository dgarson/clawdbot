import type { AnyAgentTool } from "../tools/common.js";
import type { GatewayCallFn, ToolApprovalContext, ToolApprovalResult } from "./types.js";
import { ToolApprovalManager } from "../../gateway/tool-approval-manager.js";
import { assessToolRisk } from "../tool-risk/tool-risk-resolver.js";
import { decideToolApproval } from "./tool-approval-decision-engine.js";
import { summarizeToolParams } from "./tool-approval-request.js";

// ---------------------------------------------------------------------------
// Default timeout for approval requests (ms)
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Tool Approval Orchestrator
//
// Sits in the tool invocation path. Given a tool call (name + params + ctx),
// runs the risk assessment, applies the decision engine, and if approval is
// required, sends a request through the gateway and waits for resolution.
// ---------------------------------------------------------------------------

export type OrchestratorOptions = {
  /** Gateway call function (injected for testability). */
  callGateway?: GatewayCallFn;
};

/**
 * Evaluate a tool call against the approval policy and return an allow/block result.
 *
 * This is the single centralized approval seam that every tool invocation
 * should pass through before execution.
 */
export async function evaluateToolApproval(
  toolName: string,
  params: Record<string, unknown>,
  ctx: ToolApprovalContext,
  tool?: AnyAgentTool | null,
  opts?: OrchestratorOptions,
): Promise<ToolApprovalResult> {
  // Assess the tool's risk
  const assessment = assessToolRisk(toolName, params, tool);

  // Apply decision engine
  const decision = decideToolApproval(assessment, ctx);

  if (decision === "allow") {
    return { allowed: true };
  }

  if (decision === "deny") {
    return {
      allowed: false,
      code: "TOOL_APPROVAL_BLOCKED",
      reason: "policy_deny",
      toolName: assessment.toolName,
      riskClass: assessment.riskClass,
      message: `Tool "${assessment.toolName}" blocked by policy (risk class ${assessment.riskClass})`,
    };
  }

  // decision === "approval_required" — request approval from gateway
  const callGateway = opts?.callGateway;
  if (!callGateway) {
    // No gateway call function available — cannot request approval, block.
    return {
      allowed: false,
      code: "TOOL_APPROVAL_BLOCKED",
      reason: "approval_request_failed",
      toolName: assessment.toolName,
      riskClass: assessment.riskClass,
      message: `Tool "${assessment.toolName}" requires approval but no gateway is available`,
    };
  }

  const timeoutMs = ctx.toolApprovalsConfig?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const paramsSummary = summarizeToolParams(params);
  const requestHash = ToolApprovalManager.computeRequestHash({
    toolName: assessment.toolName,
    paramsSummary,
    sessionKey: ctx.sessionKey ?? null,
    agentId: ctx.agentId ?? null,
  });

  try {
    const result = await callGateway({
      method: "tool.approval.request",
      params: {
        toolName: assessment.toolName,
        paramsSummary,
        riskClass: assessment.riskClass,
        sideEffects: assessment.sideEffects,
        reasonCodes: assessment.reasonCodes,
        sessionKey: ctx.sessionKey ?? null,
        agentId: ctx.agentId ?? null,
        requestHash,
        timeoutMs,
      },
      timeoutMs: timeoutMs + 5_000, // add buffer for network round-trip
    });

    const gatewayDecision = result?.decision;
    if (gatewayDecision === "allow-once" || gatewayDecision === "allow-always") {
      return { allowed: true };
    }

    if (gatewayDecision === "deny") {
      return {
        allowed: false,
        code: "TOOL_APPROVAL_BLOCKED",
        reason: "approval_denied",
        toolName: assessment.toolName,
        riskClass: assessment.riskClass,
        message: `Tool "${assessment.toolName}" was denied by approver`,
      };
    }

    // null decision = timeout
    return {
      allowed: false,
      code: "TOOL_APPROVAL_BLOCKED",
      reason: "approval_timeout",
      toolName: assessment.toolName,
      riskClass: assessment.riskClass,
      message: `Tool "${assessment.toolName}" approval timed out`,
    };
  } catch {
    return {
      allowed: false,
      code: "TOOL_APPROVAL_BLOCKED",
      reason: "approval_request_failed",
      toolName: assessment.toolName,
      riskClass: assessment.riskClass,
      message: `Tool "${assessment.toolName}" approval request failed`,
    };
  }
}
