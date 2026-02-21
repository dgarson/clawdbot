/**
 * In-Process MCP Tool Server
 *
 * Creates an MCP server that exposes OpenClaw tools to the Claude Agent SDK's
 * agentic loop. The MCP handler dispatches to existing wrapped .execute() methods,
 * which automatically fire before_tool_call hooks, tool loop detection, and abort
 * signal propagation (applied upstream at pi-tools.ts:492-497).
 *
 * Tool lifecycle events (tool_execution_start/update/end) are emitted here to the
 * subscriber list, NOT from the event-adapter. This keeps tool execution self-contained.
 *
 * Per implementation-plan.md Section 4.3 and 4.7.
 */

import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import type { TSchema } from "@sinclair/typebox";
import { typeboxToZod } from "./schema-adapter.js";
import type { ClaudeSdkMcpToolServerParams } from "./types.js";

// ---------------------------------------------------------------------------
// Tool result formatting for MCP protocol
// ---------------------------------------------------------------------------

type McpContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

type McpToolResult = {
  content: McpContent[];
  isError?: boolean;
};

/**
 * Formats an OpenClaw tool result into MCP-protocol format.
 * Handles text, image (mediaUrls), and object results.
 */
function formatToolResultForMcp(result: unknown): McpToolResult {
  // String result → text
  if (typeof result === "string") {
    return { content: [{ type: "text", text: result }] };
  }

  // Object with AgentToolResult shape (content array)
  if (
    result &&
    typeof result === "object" &&
    Array.isArray((result as { content?: unknown }).content)
  ) {
    const items = (
      result as {
        content: Array<{
          type?: string;
          text?: string;
          url?: string;
          data?: string;
          mediaType?: string;
        }>;
      }
    ).content;
    const content: McpContent[] = [];
    for (const item of items) {
      if (item.type === "image" || item.type === "image_url") {
        const data = item.data ?? item.url ?? "";
        const mimeType = item.mediaType ?? "image/png";
        // Handle data URLs
        if (data.startsWith("data:")) {
          const [header, base64] = data.split(",", 2);
          const mime = header.split(":")[1]?.split(";")[0] ?? mimeType;
          content.push({ type: "image", data: base64 ?? data, mimeType: mime });
        } else {
          content.push({ type: "image", data, mimeType });
        }
      } else {
        content.push({ type: "text", text: item.text ?? JSON.stringify(item) });
      }
    }
    return { content: content.length > 0 ? content : [{ type: "text", text: "" }] };
  }

  // Object with mediaUrls → image content blocks
  if (result && typeof result === "object") {
    const obj = result as { text?: string; mediaUrls?: string[] };
    if (Array.isArray(obj.mediaUrls) && obj.mediaUrls.length > 0) {
      const content: McpContent[] = [];
      if (obj.text) {
        content.push({ type: "text", text: obj.text });
      }
      for (const url of obj.mediaUrls) {
        if (url.startsWith("data:")) {
          const [header, base64] = url.split(",", 2);
          const mimeType = header.split(":")[1]?.split(";")[0] ?? "image/png";
          content.push({ type: "image", data: base64 ?? url, mimeType });
        } else {
          content.push({ type: "image", data: url, mimeType: "image/png" });
        }
      }
      return { content: content.length > 0 ? content : [{ type: "text", text: obj.text ?? "" }] };
    }
  }

  // Fallback: JSON serialize
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}

// ---------------------------------------------------------------------------
// MCP tool server factory
// ---------------------------------------------------------------------------

/**
 * Creates an in-process MCP server from an array of OpenClaw tools.
 * Each tool is registered with its name, description, and Zod-converted schema.
 * The handler calls the tool's wrapped .execute() method (which fires before_tool_call hook).
 */
export function createClaudeSdkMcpToolServer(
  params: ClaudeSdkMcpToolServerParams,
): ReturnType<typeof createSdkMcpServer> {
  const { tools, emitEvent, getAbortSignal } = params;

  const mcpTools = tools.map((openClawTool) => {
    let zodSchema: ReturnType<typeof typeboxToZod>;
    try {
      zodSchema = typeboxToZod(openClawTool.parameters as TSchema);
    } catch {
      // Fallback to passthrough schema if conversion fails
      zodSchema = {};
    }

    return tool(
      openClawTool.name,
      openClawTool.description ?? "",
      zodSchema,
      async (args: Record<string, unknown>, extra: unknown) => {
        // Derive a toolCallId from the MCP call metadata
        const extraRecord =
          extra && typeof extra === "object" ? (extra as Record<string, unknown>) : {};
        const toolCallId =
          typeof extraRecord.toolCallId === "string" ? extraRecord.toolCallId : crypto.randomUUID();
        const signal = getAbortSignal();

        // Emit tool_execution_start BEFORE calling .execute()
        // Fields match the Pi AgentEvent type: toolCallId, toolName, args
        emitEvent({
          type: "tool_execution_start",
          toolName: openClawTool.name,
          toolCallId,
          args,
        } as never);

        try {
          // Call the wrapped .execute() method.
          // The before_tool_call hook wrapper fires automatically here because
          // wrapToolWithBeforeToolCallHook() was applied upstream at pi-tools.ts:492-497.
          const result = await openClawTool.execute(toolCallId, args, signal, (update: unknown) => {
            // Emit tool_execution_update for any progress notifications.
            // Spread update payload first, then override type/toolCallId/toolName so
            // a payload with its own `type` field cannot corrupt the event type.
            emitEvent({
              ...(update && typeof update === "object" ? update : {}),
              type: "tool_execution_update",
              toolCallId,
              toolName: openClawTool.name,
            } as never);
          });

          // Emit tool_execution_end with result.
          // Fields match the Pi AgentEvent type: toolCallId, toolName, result, isError
          emitEvent({
            type: "tool_execution_end",
            toolCallId,
            toolName: openClawTool.name,
            result,
            isError: false,
          } as never);

          const mcpResult = formatToolResultForMcp(result);

          // Persist toolResult to session transcript so the session-tool-result-guard
          // does not insert synthetic "missing tool result" error messages.
          try {
            params.sessionManager?.appendMessage?.({
              role: "toolResult",
              toolCallId,
              toolName: openClawTool.name,
              content: mcpResult.content.map((block) =>
                block.type === "text"
                  ? { type: "text", text: block.text }
                  : { type: "text", text: JSON.stringify(block) },
              ),
              isError: false,
              timestamp: Date.now(),
            });
          } catch {
            // Non-fatal — toolResult persistence failure
          }

          return mcpResult;
        } catch (err) {
          const errorText = err instanceof Error ? err.message : String(err);

          // Emit tool_execution_end with error (isError: true, result is the error message string)
          emitEvent({
            type: "tool_execution_end",
            toolCallId,
            toolName: openClawTool.name,
            result: errorText,
            isError: true,
          } as never);

          // Persist error toolResult to session transcript.
          try {
            params.sessionManager?.appendMessage?.({
              role: "toolResult",
              toolCallId,
              toolName: openClawTool.name,
              content: [{ type: "text", text: errorText }],
              isError: true,
              timestamp: Date.now(),
            });
          } catch {
            // Non-fatal — toolResult persistence failure
          }

          // Return MCP error result so SDK can continue
          return {
            content: [{ type: "text" as const, text: errorText }],
            isError: true,
          };
        }
      },
    );
  });

  return createSdkMcpServer({
    name: "openclaw-tools",
    version: "1.0.0",
    tools: mcpTools,
  });
}
