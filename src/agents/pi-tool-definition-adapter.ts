import type {
  AgentTool,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-agent-core";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { ClientToolDefinition } from "./pi-embedded-runner/run/params.js";
import type { HookContext } from "./pi-tools.before-tool-call.js";
import { logDebug, logError, logWarn } from "../logger.js";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import { isPlainObject } from "../utils.js";
import {
  consumeAdjustedParamsForToolCall,
  isToolWrappedWithBeforeToolCallHook,
  runBeforeToolCallHook,
} from "./pi-tools.before-tool-call.js";
import { sanitizeToolCallId } from "./tool-call-id.js";
import { validateAndRepairToolCall } from "./tool-call-validator.js";
import { normalizeToolName } from "./tool-policy.js";
import { jsonResult } from "./tools/common.js";

type AnyAgentTool = AgentTool;
type UnknownRecord = Record<string, unknown>;

type ToolCompatibilityOptions = {
  provider?: string;
  model?: string;
  sessionKey?: string;
};

type ToolExecuteArgsCurrent = [
  string,
  unknown,
  AbortSignal | undefined,
  AgentToolUpdateCallback<unknown> | undefined,
  unknown,
];
type ToolExecuteArgsLegacy = [
  string,
  unknown,
  AgentToolUpdateCallback<unknown> | undefined,
  unknown,
  AbortSignal | undefined,
];
type ToolExecuteArgs = ToolDefinition["execute"] extends (...args: infer P) => unknown
  ? P
  : ToolExecuteArgsCurrent;
type ToolExecuteArgsAny = ToolExecuteArgs | ToolExecuteArgsLegacy | ToolExecuteArgsCurrent;

function isAbortSignal(value: unknown): value is AbortSignal {
  return typeof value === "object" && value !== null && "aborted" in value;
}

function isLegacyToolExecuteArgs(args: ToolExecuteArgsAny): args is ToolExecuteArgsLegacy {
  const third = args[2];
  const fifth = args[4];
  if (typeof third === "function") {
    return true;
  }
  return isAbortSignal(fifth);
}

function describeToolExecutionError(err: unknown): {
  message: string;
  stack?: string;
} {
  if (err instanceof Error) {
    const message = err.message?.trim() ? err.message : String(err);
    return { message, stack: err.stack };
  }
  return { message: String(err) };
}

function splitToolExecuteArgs(args: ToolExecuteArgsAny): {
  toolCallId: string;
  params: unknown;
  onUpdate: AgentToolUpdateCallback<unknown> | undefined;
  signal: AbortSignal | undefined;
} {
  if (isLegacyToolExecuteArgs(args)) {
    const [toolCallId, params, onUpdate, _ctx, signal] = args;
    return {
      toolCallId,
      params,
      onUpdate,
      signal,
    };
  }
  const [toolCallId, params, signal, onUpdate] = args;
  return {
    toolCallId,
    params,
    onUpdate,
    signal,
  };
}

function buildRepairFailureResult(params: {
  toolName: string;
  reason?: string;
  diagnostics: string[];
  originalError: string;
}): AgentToolResult<unknown> {
  return jsonResult({
    status: "error",
    tool: params.toolName,
    stage: "tool-call-validation",
    error: params.originalError,
    note:
      "Please retry with strict JSON matching the tool schema. " +
      "Example fields: keep exact key names and valid JSON types.",
    reason: params.reason,
    diagnostics: params.diagnostics,
  });
}

function toRecord(value: unknown): UnknownRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as UnknownRecord;
}

export function toToolDefinitions(
  tools: AnyAgentTool[],
  compatibility?: ToolCompatibilityOptions,
): ToolDefinition[] {
  const sessionPrefix = compatibility?.sessionKey ? `[${compatibility.sessionKey}] ` : "";
  const toolCallIdSeen = new Map<string, number>();

  const normalizeToolCallIdWithDupes = (
    toolCallId: string,
  ): { resolved: string; isDuplicate: boolean } => {
    const sanitized = sanitizeToolCallId(toolCallId);
    const next = (toolCallIdSeen.get(sanitized) ?? 0) + 1;
    toolCallIdSeen.set(sanitized, next);
    return {
      resolved: next === 1 ? sanitized : `${sanitized}_${next}`,
      isDuplicate: next > 1,
    };
  };

  return tools.map((tool) => {
    const name = tool.name || "tool";
    const normalizedName = normalizeToolName(name);
    const beforeHookWrapped = isToolWrappedWithBeforeToolCallHook(tool);
    const schema = tool.parameters as UnknownRecord | undefined;
    return {
      name,
      label: tool.label ?? name,
      description: tool.description ?? "",
      parameters: tool.parameters,
      execute: async (...args: ToolExecuteArgs): Promise<AgentToolResult<unknown>> => {
        const { toolCallId, params, onUpdate, signal } = splitToolExecuteArgs(args);
        const { resolved: resolvedToolCallId, isDuplicate } = normalizeToolCallIdWithDupes(
          typeof toolCallId === "string" ? toolCallId : "",
        );
        if (isDuplicate) {
          const sessionHint = compatibility?.sessionKey
            ? ` session=${compatibility.sessionKey}`
            : "";
          logWarn(
            `tools: duplicate toolCallId tool=${name} id=${String(toolCallId)} normalized=${resolvedToolCallId}${sessionHint}`,
          );
        }
        let executeParams = params;
        try {
          if (!beforeHookWrapped) {
            const hookOutcome = await runBeforeToolCallHook({
              toolName: name,
              params,
              toolCallId: resolvedToolCallId,
            });
            if (hookOutcome.blocked) {
              throw new Error(hookOutcome.reason);
            }
            executeParams = hookOutcome.params;
          }

          if (schema && compatibility?.provider) {
            const validation = validateAndRepairToolCall({
              toolName: name,
              args: executeParams,
              schema,
              provider: compatibility.provider,
              model: compatibility.model,
              toolCallId: resolvedToolCallId,
            });
            if (!validation.valid) {
              return buildRepairFailureResult({
                toolName: normalizedName,
                reason: validation.reason,
                diagnostics: validation.diagnostics,
                originalError: validation.reason ?? "Tool arguments failed validation",
              });
            }
            executeParams = validation.args;
            if (validation.repaired || !validation.skipped) {
              const record = toRecord(executeParams);
              logDebug(
                `tools: tool args ${validation.repaired ? "repaired" : "validated"} ` +
                  `tool=${name} provider=${compatibility.provider} ` +
                  `model=${compatibility.model ?? ""} id=${resolvedToolCallId} params=${record ? Object.keys(record).join(",") : "(non-object)"}`,
              );
            }
          }

          const result = await tool.execute(resolvedToolCallId, executeParams, signal, onUpdate);
          const afterParams = beforeHookWrapped
            ? (consumeAdjustedParamsForToolCall(resolvedToolCallId) ?? executeParams)
            : executeParams;

          // Call after_tool_call hook
          const hookRunner = getGlobalHookRunner();
          if (hookRunner?.hasHooks("after_tool_call")) {
            try {
              await hookRunner.runAfterToolCall(
                {
                  toolName: name,
                  params: isPlainObject(afterParams) ? afterParams : {},
                  result,
                },
                { toolName: name },
              );
            } catch (hookErr) {
              logDebug(
                `${sessionPrefix}after_tool_call hook failed: tool=${normalizedName} error=${String(hookErr)}`,
              );
            }
          }

          return result;
        } catch (err) {
          if (signal?.aborted) {
            throw err;
          }
          const name =
            err && typeof err === "object" && "name" in err
              ? String((err as { name?: unknown }).name)
              : "";
          if (name === "AbortError") {
            throw err;
          }
          if (beforeHookWrapped) {
            consumeAdjustedParamsForToolCall(resolvedToolCallId);
          }
          const described = describeToolExecutionError(err);
          if (described.stack && described.stack !== described.message) {
            logDebug(`${sessionPrefix}tools: ${normalizedName} failed stack:\n${described.stack}`);
          }
          logError(`${sessionPrefix}[tools] ${normalizedName} failed: ${described.message}`);

          const errorResult = jsonResult({
            status: "error",
            tool: normalizedName,
            error: described.message,
          });

          // Call after_tool_call hook for errors too
          const hookRunner = getGlobalHookRunner();
          if (hookRunner?.hasHooks("after_tool_call")) {
            try {
              await hookRunner.runAfterToolCall(
                {
                  toolName: normalizedName,
                  params: isPlainObject(params) ? params : {},
                  error: described.message,
                },
                { toolName: normalizedName },
              );
            } catch (hookErr) {
              logDebug(
                `after_tool_call hook failed: tool=${normalizedName} error=${String(hookErr)}`,
              );
            }
          }

          return errorResult;
        }
      },
    } satisfies ToolDefinition;
  });
}

// Convert client tools (OpenResponses hosted tools) to ToolDefinition format
// These tools are intercepted to return a "pending" result instead of executing
export function toClientToolDefinitions(
  tools: ClientToolDefinition[],
  onClientToolCall?: (toolName: string, params: Record<string, unknown>) => void,
  hookContext?: HookContext,
): ToolDefinition[] {
  return tools.map((tool) => {
    const func = tool.function;
    return {
      name: func.name,
      label: func.name,
      description: func.description ?? "",
      parameters: func.parameters as ToolDefinition["parameters"],
      execute: async (...args: ToolExecuteArgs): Promise<AgentToolResult<unknown>> => {
        const { toolCallId, params } = splitToolExecuteArgs(args);
        const outcome = await runBeforeToolCallHook({
          toolName: func.name,
          params,
          toolCallId,
          ctx: hookContext,
        });
        if (outcome.blocked) {
          throw new Error(outcome.reason);
        }
        const adjustedParams = outcome.params;
        const paramsRecord = isPlainObject(adjustedParams) ? adjustedParams : {};
        // Notify handler that a client tool was called
        if (onClientToolCall) {
          onClientToolCall(func.name, paramsRecord);
        }
        // Return a pending result - the client will execute this tool
        return jsonResult({
          status: "pending",
          tool: func.name,
          message: "Tool execution delegated to client",
        });
      },
    } satisfies ToolDefinition;
  });
}
