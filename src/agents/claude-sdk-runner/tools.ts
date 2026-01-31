/**
 * MCP tool bridge: OpenClaw tools → Claude Agent SDK MCP tools.
 *
 * Uses createSdkMcpServer to provide tools to the SDK session.
 * Tool handlers invoke the original OpenClaw tool execute() methods.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  createSdkMcpServer,
  type SdkMcpToolDefinition,
} from "@anthropic-ai/claude-agent-sdk/sdk.mjs";

import { emitAgentEvent } from "../../infra/agent-events.js";
import { normalizeToolParameters } from "../pi-tools.schema.js";
import { normalizeToolParams, patchToolSchemaForClaudeCompatibility } from "../pi-tools.read.js";
import { isMessagingTool, isMessagingToolSendAction } from "../pi-embedded-messaging.js";
import {
  extractMessagingToolSend,
  extractToolErrorMessage,
  isToolResultError,
  sanitizeToolResult,
} from "../pi-embedded-subscribe.tools.js";
import { inferToolMetaFromArgs } from "../pi-embedded-utils.js";
import { normalizeToolName } from "../tool-policy.js";
import { jsonSchemaToZodRawShape } from "./schema.js";
import type { AnyAgentTool } from "../pi-tools.types.js";
import type { ClaudeSdkRunState } from "./types.js";
import { log } from "./logger.js";

type ToolExecutionContext = {
  runId: string;
  state: ClaudeSdkRunState;
  abortSignal?: AbortSignal;
};

/**
 * Convert an OpenClaw tool to an SDK MCP tool definition.
 */
function convertToolToSdkMcp(
  tool: AnyAgentTool,
  ctx: ToolExecutionContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): SdkMcpToolDefinition<any> {
  // Normalize and patch the schema for Claude compatibility
  const normalized = normalizeToolParameters(tool);
  const patched = patchToolSchemaForClaudeCompatibility(normalized);
  const schema = (patched.parameters ?? {}) as Record<string, unknown>;
  const zodShape = jsonSchemaToZodRawShape(schema);

  return {
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: zodShape,
    handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      const toolCallId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const toolName = normalizeToolName(tool.name);
      const toolStartTime = Date.now();

      log.debug(`tool call start: ${toolName} callId=${toolCallId}`);

      // Normalize params (e.g. file_path → path)
      const normalizedArgs = normalizeToolParams(args) ?? args;

      // Track tool meta
      const meta = inferToolMetaFromArgs(toolName, normalizedArgs);
      ctx.state.toolMetaById.set(toolCallId, meta);

      // Emit tool start event
      emitAgentEvent({
        runId: ctx.runId,
        stream: "tool",
        data: {
          phase: "start",
          name: toolName,
          toolCallId,
          args: normalizedArgs,
        },
      });

      // Track pending messaging tool sends
      if (isMessagingTool(toolName)) {
        if (isMessagingToolSendAction(toolName, normalizedArgs)) {
          const sendTarget = extractMessagingToolSend(toolName, normalizedArgs);
          if (sendTarget) {
            ctx.state.pendingMessagingTargets.set(toolCallId, sendTarget);
            log.debug(
              `messaging tool detected: ${toolName} provider=${sendTarget.provider} to=${sendTarget.to ?? "unknown"}`,
            );
          }
          const text = (normalizedArgs.content as string) ?? (normalizedArgs.message as string);
          if (text && typeof text === "string") {
            ctx.state.pendingMessagingTexts.set(toolCallId, text);
          }
        }
      }

      let result: unknown;
      let isError = false;
      try {
        // Check abort before executing
        if (ctx.abortSignal?.aborted) {
          throw new Error("Tool execution aborted");
        }
        result = await tool.execute(
          toolCallId,
          normalizedArgs,
          ctx.abortSignal ?? new AbortController().signal,
          undefined, // onUpdate - could wire to agent events if needed
        );
      } catch (err) {
        isError = true;
        result = {
          content: [{ type: "text", text: String(err) }],
          details: { status: "error", error: String(err) },
        };
      }

      const sanitizedResult = sanitizeToolResult(result);
      const isToolError = isError || isToolResultError(result);

      // Track tool meta and error
      ctx.state.toolMetas.push({ toolName, meta });
      ctx.state.toolMetaById.delete(toolCallId);

      if (isToolError) {
        const errorMessage = extractToolErrorMessage(sanitizedResult);
        ctx.state.lastToolError = { toolName, meta, error: errorMessage };
      }

      // Commit/discard messaging tool text
      const pendingText = ctx.state.pendingMessagingTexts.get(toolCallId);
      const pendingTarget = ctx.state.pendingMessagingTargets.get(toolCallId);
      if (pendingText) {
        ctx.state.pendingMessagingTexts.delete(toolCallId);
        if (!isToolError) {
          ctx.state.messagingToolSentTexts.push(pendingText);
          ctx.state.messagingToolSentTextsNormalized.push(
            pendingText.toLowerCase().replace(/\s+/g, " ").trim(),
          );
        }
      }
      if (pendingTarget) {
        ctx.state.pendingMessagingTargets.delete(toolCallId);
        if (!isToolError) {
          ctx.state.messagingToolSentTargets.push(pendingTarget);
        }
      }

      // Emit tool end event
      emitAgentEvent({
        runId: ctx.runId,
        stream: "tool",
        data: {
          phase: "result",
          name: toolName,
          toolCallId,
          meta,
          isError: isToolError,
          result: sanitizedResult,
        },
      });

      const toolDurationMs = Date.now() - toolStartTime;
      const resultSize = JSON.stringify(sanitizedResult).length;
      log.debug(
        `tool call complete: ${toolName} callId=${toolCallId} isError=${isToolError} durationMs=${toolDurationMs} resultSize=${resultSize}`,
      );

      // Convert to MCP result format
      return convertToMcpResult(sanitizedResult, isToolError);
    },
  };
}

/**
 * Convert an OpenClaw tool result to MCP CallToolResult format.
 */
function convertToMcpResult(result: unknown, isError: boolean): CallToolResult {
  if (!result || typeof result !== "object") {
    // For primitives (string, number, boolean) and null/undefined, stringify directly
    let text = "";
    if (result != null) {
      text = typeof result === "string" ? result : JSON.stringify(result);
    }
    return {
      content: [{ type: "text", text }],
      isError,
    };
  }

  const record = result as Record<string, unknown>;

  // If result already has MCP-compatible content array, use it
  if (Array.isArray(record.content)) {
    return {
      content: record.content.map((item: unknown) => {
        if (!item || typeof item !== "object") {
          return { type: "text" as const, text: String(item) };
        }
        const entry = item as Record<string, unknown>;
        if (entry.type === "text" && typeof entry.text === "string") {
          return { type: "text" as const, text: entry.text };
        }
        if (entry.type === "image" && typeof entry.data === "string") {
          return {
            type: "image" as const,
            data: entry.data,
            mimeType: (entry.mimeType as string) ?? "image/png",
          };
        }
        return { type: "text" as const, text: JSON.stringify(entry) };
      }),
      isError,
    };
  }

  // Fallback: stringify the result
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    isError,
  };
}

/**
 * Create an SDK MCP server with the provided OpenClaw tools.
 */
export function createOpenClawMcpServer(params: {
  tools: AnyAgentTool[];
  runId: string;
  state: ClaudeSdkRunState;
  abortSignal?: AbortSignal;
}) {
  const ctx: ToolExecutionContext = {
    runId: params.runId,
    state: params.state,
    abortSignal: params.abortSignal,
  };

  const sdkTools = params.tools.map((tool) => convertToolToSdkMcp(tool, ctx));

  log.debug(`MCP server created: toolCount=${sdkTools.length} runId=${params.runId}`);

  return createSdkMcpServer({
    name: "openclaw-tools",
    version: "1.0.0",
    tools: sdkTools,
  });
}
