/**
 * Gateway Stream Handler Hook
 *
 * Processes gateway streaming events and routes them appropriately:
 * - Text deltas go to message content
 * - Tool outputs go ONLY to tool calls (not message content)
 */

import { useEffect, useCallback } from "react";
import { getGatewayClient, type GatewayEvent } from "@/lib/api";
import { useSessionStore } from "@/stores/useSessionStore";
import type { ToolCall } from "@/lib/api/sessions";

interface GatewayChatEvent {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "error" | "aborted";
  message?: {
    role: string;
    content?: Array<{ type: string; text?: string; [key: string]: unknown }>;
    toolUse?: Array<{
      id: string;
      name: string;
      input?: unknown;
    }>;
    [key: string]: unknown;
  };
  delta?: {
    type: string;
    text?: string;
  };
  errorMessage?: string;
}

interface GatewayToolEvent {
  runId: string;
  sessionKey: string;
  toolCallId: string;
  toolName: string;
  status: "running" | "done" | "error";
  input?: string;
  output?: string;
  duration?: string;
  error?: string;
}

/**
 * Detects if text contains tool output markers
 * Tool outputs typically have patterns like:
 * - "exec" followed by output block
 * - Tool result formatting
 */
function isToolOutputText(text: string): boolean {
  // Common tool output patterns
  const toolOutputPatterns = [
    /^exec\s*$/m,                    // "exec" command marker
    /^```[\s\S]*?```$/m,             // Code blocks (often tool output)
    /^total \d+\s*$/m,               // ls output
    /^drwxr-xr-x/m,                  // File permissions (ls -la)
    /^\w+@\w+:/m,                    // Terminal prompts
  ];

  return toolOutputPatterns.some(pattern => pattern.test(text));
}

/**
 * Extracts text content from message structure
 */
function extractTextContent(message: GatewayChatEvent["message"]): string {
  if (!message?.content) {return "";}

  const textBlocks = message.content
    .filter(block => block.type === "text")
    .map(block => block.text || "");

  return textBlocks.join("\n");
}

/**
 * Extracts tool calls from message structure
 */
function extractToolCalls(message: GatewayChatEvent["message"]): ToolCall[] {
  if (!message?.toolUse || !Array.isArray(message.toolUse)) {
    return [];
  }

  return message.toolUse.map(tool => ({
    id: tool.id,
    name: tool.name,
    status: "done" as const,
    input: typeof tool.input === "string" ? tool.input : JSON.stringify(tool.input, null, 2),
  }));
}

export interface UseGatewayStreamHandlerOptions {
  /** Enable/disable the handler */
  enabled?: boolean;
}

/**
 * Hook that processes gateway streaming events and updates session store appropriately.
 *
 * Ensures tool outputs are NEVER added to message content - they only go to tool calls.
 */
export function useGatewayStreamHandler(
  options: UseGatewayStreamHandlerOptions = {}
) {
  const { enabled = true } = options;
  const sessionStore = useSessionStore();

  const handleChatEvent = useCallback((event: GatewayChatEvent) => {
    const { sessionKey, state } = event;

    switch (state) {
      case "delta": {
        // Only append text deltas that are NOT tool outputs
        if (event.delta?.type === "text" && event.delta.text) {
          const text = event.delta.text;

          // Skip if this looks like tool output
          if (isToolOutputText(text)) {
            console.debug("[StreamHandler] Skipping tool output from message content:", text.substring(0, 50));
            return;
          }

          sessionStore.appendStreamingContent(sessionKey, text);
        }
        break;
      }

      case "final": {
        // Extract text content and tool calls separately
        if (event.message) {
          const textContent = extractTextContent(event.message);
          const toolCalls = extractToolCalls(event.message);

          // Only set text content if it's not empty and not a tool output
          if (textContent && !isToolOutputText(textContent)) {
            sessionStore.appendStreamingContent(sessionKey, textContent);
          }

          // Add tool calls separately
          toolCalls.forEach(toolCall => {
            sessionStore.updateToolCall(sessionKey, toolCall);
          });
        }

        sessionStore.finishStreaming(sessionKey);
        break;
      }

      case "error": {
        console.error("[StreamHandler] Chat error:", event.errorMessage);
        sessionStore.finishStreaming(sessionKey);
        break;
      }

      case "aborted": {
        console.debug("[StreamHandler] Chat aborted");
        sessionStore.clearStreaming(sessionKey);
        break;
      }
    }
  }, [sessionStore]);

  const handleToolEvent = useCallback((event: GatewayToolEvent) => {
    const { sessionKey, toolCallId, toolName, status, input, output, duration, error } = event;

    sessionStore.updateToolCall(sessionKey, {
      id: toolCallId,
      name: toolName,
      status,
      input,
      output,
      duration,
      // Don't include error in the tool call - it's handled separately
    });

    if (error) {
      console.error(`[StreamHandler] Tool error (${toolName}):`, error);
    }
  }, [sessionStore]);

  const handleEvent = useCallback((event: GatewayEvent) => {
    // Handle chat streaming events
    if (event.event === "chat") {
      handleChatEvent(event.payload as GatewayChatEvent);
      return;
    }

    // Handle tool-specific events
    if (event.event === "tool") {
      handleToolEvent(event.payload as GatewayToolEvent);
      return;
    }
  }, [handleChatEvent, handleToolEvent]);

  useEffect(() => {
    if (!enabled) {return;}

    try {
      const client = getGatewayClient({
        onEvent: handleEvent,
      });

      // Connect if not already connected
      if (!client.isConnected()) {
        void client.connect();
      }

      return () => {
        // Cleanup is handled by the gateway client
      };
    } catch (error) {
      console.error("[StreamHandler] Failed to setup event handler:", error);
    }
  }, [enabled, handleEvent]);
}
