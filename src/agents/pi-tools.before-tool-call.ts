import type { GatewayCallFn, ToolApprovalContext } from "./tool-approvals/types.js";
import type { AnyAgentTool } from "./tools/common.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import { evaluateToolApproval } from "./tool-approvals/tool-approval-orchestrator.js";
import { normalizeToolName } from "./tool-policy.js";

type HookContext = {
  agentId?: string;
  sessionKey?: string;
};

/**
 * Extended context for the before-tool-call wrapper that includes
 * orchestrator-relevant fields.
 */
export type BeforeToolCallContext = HookContext & {
  /** Tool approval orchestration context. */
  toolApproval?: ToolApprovalContext & {
    callGateway?: GatewayCallFn;
  };
};

type HookOutcome = { blocked: true; reason: string } | { blocked: false; params: unknown };

const log = createSubsystemLogger("agents/tools");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Stable, machine-readable error thrown when a tool call is blocked
 * by the tool approval orchestrator.
 */
export class ToolApprovalBlockedError extends Error {
  readonly code = "TOOL_APPROVAL_BLOCKED" as const;
  readonly reason: string;
  readonly toolName: string;
  readonly riskClass: string;

  constructor(opts: { reason: string; toolName: string; riskClass: string; message: string }) {
    super(opts.message);
    this.name = "ToolApprovalBlockedError";
    this.reason = opts.reason;
    this.toolName = opts.toolName;
    this.riskClass = opts.riskClass;
  }
}

export async function runBeforeToolCallHook(args: {
  toolName: string;
  params: unknown;
  toolCallId?: string;
  ctx?: HookContext;
}): Promise<HookOutcome> {
  const hookRunner = getGlobalHookRunner();
  if (!hookRunner?.hasHooks("before_tool_call")) {
    return { blocked: false, params: args.params };
  }

  const toolName = normalizeToolName(args.toolName || "tool");
  const params = args.params;
  try {
    const normalizedParams = isPlainObject(params) ? params : {};
    const hookResult = await hookRunner.runBeforeToolCall(
      {
        toolName,
        params: normalizedParams,
      },
      {
        toolName,
        agentId: args.ctx?.agentId,
        sessionKey: args.ctx?.sessionKey,
      },
    );

    if (hookResult?.block) {
      return {
        blocked: true,
        reason: hookResult.blockReason || "Tool call blocked by plugin hook",
      };
    }

    if (hookResult?.params && isPlainObject(hookResult.params)) {
      if (isPlainObject(params)) {
        return { blocked: false, params: { ...params, ...hookResult.params } };
      }
      return { blocked: false, params: hookResult.params };
    }
  } catch (err) {
    const toolCallId = args.toolCallId ? ` toolCallId=${args.toolCallId}` : "";
    log.warn(`before_tool_call hook failed: tool=${toolName}${toolCallId} error=${String(err)}`);
  }

  return { blocked: false, params };
}

export function wrapToolWithBeforeToolCallHook(
  tool: AnyAgentTool,
  ctx?: BeforeToolCallContext,
): AnyAgentTool {
  const execute = tool.execute;
  if (!execute) {
    return tool;
  }
  const toolName = tool.name || "tool";
  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      // 1. Run plugin before_tool_call hooks (may mutate params or block)
      const outcome = await runBeforeToolCallHook({
        toolName,
        params,
        toolCallId,
        ctx,
      });
      if (outcome.blocked) {
        throw new Error(outcome.reason);
      }

      // 2. Run tool approval orchestrator on the (possibly mutated) params
      if (ctx?.toolApproval) {
        const finalParams = isPlainObject(outcome.params) ? outcome.params : {};
        const approvalResult = await evaluateToolApproval(
          toolName,
          finalParams,
          ctx.toolApproval,
          tool,
          { callGateway: ctx.toolApproval.callGateway },
        );
        if (!approvalResult.allowed) {
          throw new ToolApprovalBlockedError({
            reason: approvalResult.reason,
            toolName: approvalResult.toolName,
            riskClass: approvalResult.riskClass,
            message: approvalResult.message,
          });
        }
      }

      // 3. Execute the tool
      return await execute(toolCallId, outcome.params, signal, onUpdate);
    },
  };
}

export const __testing = {
  runBeforeToolCallHook,
  isPlainObject,
};
