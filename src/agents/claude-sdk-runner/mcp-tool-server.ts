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
import { truncateUtf16Safe } from "../../utils.js";
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

const TOOL_RESULT_STRING_MAX_CHARS = 120_000;

function truncateDeepStrings(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length <= TOOL_RESULT_STRING_MAX_CHARS) {
      return value;
    }
    return `${truncateUtf16Safe(value, TOOL_RESULT_STRING_MAX_CHARS)}\n…(truncated)…`;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => truncateDeepStrings(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        truncateDeepStrings(entry),
      ]),
    );
  }
  return value;
}

/**
 * Formats an OpenClaw tool result into MCP-protocol format.
 * Handles text, image (mediaUrls), and object results.
 */
function buildPersistedToolResultContent(result: unknown): Array<{ type: "text"; text: string }> {
  const normalized = truncateDeepStrings(result);
  if (typeof normalized === "string") {
    return [{ type: "text", text: normalized }];
  }
  if (normalized && typeof normalized === "object") {
    const content = (normalized as { content?: unknown }).content;
    if (Array.isArray(content) && content.length > 0) {
      return content.map((entry) => {
        if (entry && typeof entry === "object" && (entry as { type?: unknown }).type === "text") {
          const text = (entry as { text?: unknown }).text;
          return {
            type: "text",
            text: typeof text === "string" ? text : JSON.stringify(entry),
          };
        }
        return { type: "text", text: JSON.stringify(entry) };
      });
    }
  }
  return [{ type: "text", text: JSON.stringify(normalized) }];
}

function formatToolResultForMcp(result: unknown): McpToolResult {
  const normalized = truncateDeepStrings(result);

  // String result → text
  if (typeof normalized === "string") {
    return { content: [{ type: "text", text: normalized }] };
  }

  // Object with AgentToolResult shape (content array)
  if (
    normalized &&
    typeof normalized === "object" &&
    Array.isArray((normalized as { content?: unknown }).content)
  ) {
    const items = (
      normalized as {
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
    return {
      content: content.length > 0 ? content : [{ type: "text", text: "" }],
    };
  }

  // Object with mediaUrls → image content blocks
  if (normalized && typeof normalized === "object") {
    const obj = normalized as { text?: string; mediaUrls?: string[] };
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
      return {
        content: content.length > 0 ? content : [{ type: "text", text: obj.text ?? "" }],
      };
    }
  }

  // Fallback: JSON serialize
  return { content: [{ type: "text", text: JSON.stringify(normalized) }] };
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
        await emitEvent({
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
            void emitEvent({
              ...(update && typeof update === "object" ? update : {}),
              type: "tool_execution_update",
              toolCallId,
              toolName: openClawTool.name,
            } as never);
          });

          // Emit tool_execution_end with result.
          // Fields match the Pi AgentEvent type: toolCallId, toolName, result, isError
          await emitEvent({
            type: "tool_execution_end",
            toolCallId,
            toolName: openClawTool.name,
            result,
            isError: false,
          } as never);

          // Persist raw tool result first so transcript continuity survives
          // MCP result formatting failures.
          try {
            params.sessionManager?.appendMessage?.({
              role: "toolResult",
              toolCallId,
              toolName: openClawTool.name,
              content: buildPersistedToolResultContent(result),
              isError: false,
              timestamp: Date.now(),
            });
          } catch {
            // Non-fatal — toolResult persistence failure
          }

          const mcpResult = formatToolResultForMcp(result);
          return mcpResult;
        } catch (err) {
          const errorText = err instanceof Error ? err.message : String(err);

          // Emit tool_execution_end with error (isError: true, result is the error message string)
          await emitEvent({
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
