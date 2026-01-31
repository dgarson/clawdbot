import type { AgentEvent } from "@mariozechner/pi-agent-core";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import {
  createSdkMcpServer,
  tool as sdkTool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";

import type { ClientToolDefinition } from "../pi-embedded-runner/run/params.js";
import type { AnyAgentTool } from "../pi-tools.types.js";
import { normalizeToolParams, patchToolSchemaForClaudeCompatibility } from "../pi-tools.read.js";
import { normalizeToolParameters as normalizeToolSchema } from "../pi-tools.schema.js";

import { jsonSchemaToZod } from "./schema.js";

export type ClaudeSdkToolBridgeOptions = {
  emit: (evt: AgentEvent) => void;
  abortSignal?: AbortSignal;
  onToolResultMessage?: (message: ToolResultMessage) => void;
  onClientToolCall?: (toolName: string, params: Record<string, unknown>) => void;
};

type ToolHandlerContext = ClaudeSdkToolBridgeOptions & {
  nextToolCallId: () => string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const combineAbortSignals = (a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined => {
  if (!a && !b) {
    return undefined;
  }
  if (a && !b) {
    return a;
  }
  if (b && !a) {
    return b;
  }
  if (a?.aborted) {
    return a;
  }
  if (b?.aborted) {
    return b;
  }
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([a as AbortSignal, b as AbortSignal]);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a?.addEventListener("abort", onAbort, { once: true });
  b?.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
};

const resolveToolCallId = (extra: unknown, fallback: () => string): string => {
  if (isRecord(extra)) {
    const candidates = [
      extra.toolUseID,
      extra.tool_use_id,
      extra.toolUseId,
      extra.tool_useId,
      extra.tool_call_id,
      extra.toolCallId,
      extra.toolCallID,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  return fallback();
};

const normalizeArgs = (args: unknown): Record<string, unknown> | undefined => {
  const normalized = normalizeToolParams(args);
  if (normalized && typeof normalized === "object") {
    return normalized;
  }
  if (isRecord(args)) {
    return args;
  }
  return undefined;
};

const buildToolResultMessage = (params: {
  toolCallId: string;
  toolName: string;
  result: AgentToolResult<unknown>;
  isError: boolean;
}): ToolResultMessage => ({
  role: "toolResult",
  toolCallId: params.toolCallId,
  toolName: params.toolName,
  content: params.result.content,
  details: params.result.details,
  isError: params.isError,
  timestamp: Date.now(),
});

const buildOpenClawToolHandler =
  (tool: AnyAgentTool, ctx: ToolHandlerContext) =>
  async (args: Record<string, unknown>, extra: unknown) => {
    const toolCallId = resolveToolCallId(extra, ctx.nextToolCallId);
    const normalizedArgs = normalizeArgs(args) ?? {};
    const signal = combineAbortSignals(
      ctx.abortSignal,
      isRecord(extra) ? (extra.signal as any) : undefined,
    );

    ctx.emit({
      type: "tool_execution_start",
      toolCallId,
      toolName: tool.name,
      args: normalizedArgs,
    });

    let result: AgentToolResult<unknown>;
    let isError = false;

    try {
      if (signal?.aborted) {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }
      result = await tool.execute(toolCallId, normalizedArgs, signal, (partial) => {
        ctx.emit({
          type: "tool_execution_update",
          toolCallId,
          toolName: tool.name,
          args: normalizedArgs,
          partialResult: partial,
        });
      });
    } catch (err) {
      if (signal?.aborted) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      result = {
        content: [{ type: "text", text: message }],
        details: { status: "error", error: message },
      };
      isError = true;
    }

    ctx.emit({
      type: "tool_execution_end",
      toolCallId,
      toolName: tool.name,
      result,
      isError,
    });

    const toolMessage = buildToolResultMessage({
      toolCallId,
      toolName: tool.name,
      result,
      isError,
    });
    ctx.onToolResultMessage?.(toolMessage);

    return { content: result.content, isError };
  };

const buildClientToolHandler =
  (tool: ClientToolDefinition, ctx: ToolHandlerContext) =>
  async (args: Record<string, unknown>, extra: unknown) => {
    const toolCallId = resolveToolCallId(extra, ctx.nextToolCallId);
    const normalizedArgs = normalizeArgs(args) ?? {};

    ctx.emit({
      type: "tool_execution_start",
      toolCallId,
      toolName: tool.function.name,
      args: normalizedArgs,
    });

    ctx.onClientToolCall?.(tool.function.name, normalizedArgs);

    const result: AgentToolResult<unknown> = {
      content: [{ type: "text", text: "Tool execution delegated to client" }],
      details: { status: "pending", tool: tool.function.name },
    };

    ctx.emit({
      type: "tool_execution_end",
      toolCallId,
      toolName: tool.function.name,
      result,
      isError: false,
    });

    const toolMessage = buildToolResultMessage({
      toolCallId,
      toolName: tool.function.name,
      result,
      isError: false,
    });
    ctx.onToolResultMessage?.(toolMessage);

    return { content: result.content, isError: false };
  };

export function createOpenClawSdkMcpServer(params: {
  tools: AnyAgentTool[];
  clientTools?: ClientToolDefinition[];
  options: ClaudeSdkToolBridgeOptions;
}): McpSdkServerConfigWithInstance | null {
  const tools = params.tools ?? [];
  const clientTools = params.clientTools ?? [];
  if (tools.length === 0 && clientTools.length === 0) {
    return null;
  }

  let counter = 0;
  const nextToolCallId = () => `tool_${Date.now()}_${counter++}`;
  const ctx: ToolHandlerContext = {
    ...params.options,
    nextToolCallId,
  };

  const mcpTools = tools.map((rawTool) => {
    const patched = patchToolSchemaForClaudeCompatibility(rawTool);
    const normalized = normalizeToolSchema(patched);
    const schema = jsonSchemaToZod(normalized.parameters as Record<string, unknown>);
    return sdkTool(
      normalized.name,
      normalized.description ?? "",
      schema as any,
      buildOpenClawToolHandler(normalized, ctx),
    );
  });

  for (const clientTool of clientTools) {
    const schema = jsonSchemaToZod(
      (clientTool.function.parameters ?? {}) as Record<string, unknown>,
    );
    mcpTools.push(
      sdkTool(
        clientTool.function.name,
        clientTool.function.description ?? "",
        schema as any,
        buildClientToolHandler(clientTool, ctx),
      ),
    );
  }

  return createSdkMcpServer({
    name: "openclaw",
    tools: mcpTools,
  });
}
