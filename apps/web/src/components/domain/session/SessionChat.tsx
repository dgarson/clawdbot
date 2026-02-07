"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { SessionChatMessage } from "./SessionChatMessage";
import { SessionChatInput } from "./SessionChatInput";
import { ChatMessageSkeleton } from "@/components/composed";
import type { ChatMessage, ToolCall } from "@/lib/api/sessions";
import type { StreamingMessage } from "@/stores/useSessionStore";
import type { VercelToolCall } from "@/integrations/vercel-ai/vercel-agent-adapter";
import type { VercelChatMessage, VercelStreamingMessage } from "@/stores/useVercelSessionStore";

type IncomingMessage = ChatMessage | VercelChatMessage;
type IncomingStreamingMessage = StreamingMessage | VercelStreamingMessage;

function isGatewayToolCall(call: ToolCall | VercelToolCall): call is ToolCall {
  return typeof (call as ToolCall).status === "string";
}

function normalizeToolCalls(toolCalls: ToolCall[] | VercelToolCall[] | undefined): ToolCall[] | undefined {
  if (!toolCalls || toolCalls.length === 0) {return undefined;}
  return toolCalls.map((call, index) => {
    if (isGatewayToolCall(call)) {return call;}
    const id = call.id ?? call.toolCallId ?? `tool-${index}`;
    const name = call.name ?? call.toolName ?? "tool";
    const args = call.arguments ?? call.args;
    return {
      id,
      name,
      status: "done",
      input: args ? JSON.stringify(args) : undefined,
    };
  });
}

export interface SessionChatProps {
  /** Chat messages to display */
  messages: ReadonlyArray<IncomingMessage>;
  /** Streaming message state (if currently streaming) */
  streamingMessage?: IncomingStreamingMessage | null;
  /** Agent name for avatar */
  agentName: string;
  /** Agent status for avatar */
  agentStatus?: "active" | "ready";
  /** Whether messages are loading */
  isLoading?: boolean;
  /** Callback when message is sent */
  onSend: (message: string) => void;
  /** Callback to abort current stream */
  onStop?: () => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function SessionChat({
  messages,
  streamingMessage,
  agentName,
  agentStatus = "ready",
  isLoading = false,
  onSend,
  onStop,
  disabled = false,
  className,
}: SessionChatProps) {
  const {
    scrollRef,
    isAtBottom,
    scrollToBottom,
    disableAutoScroll,
  } = useAutoScroll({
    smooth: true,
    content: messages.length + (streamingMessage?.content?.length ?? 0),
  });

  // Build display messages including streaming
  const displayMessages = React.useMemo(() => {
    const result: Array<ChatMessage & {
      id?: string;
      agentName?: string;
      agentStatus?: "active" | "ready";
      isStreaming?: boolean;
    }> = messages.map((msg, i) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      toolCalls: normalizeToolCalls(msg.toolCalls),
      id: `msg-${i}`,
      agentName: msg.role === "assistant" ? agentName : undefined,
      agentStatus: msg.role === "assistant" ? agentStatus : undefined,
    }));

    // Add streaming message if present
    if (streamingMessage && streamingMessage.isStreaming) {
      result.push({
        role: "assistant",
        content: streamingMessage.content,
        toolCalls: normalizeToolCalls(streamingMessage.toolCalls),
        id: "streaming",
        agentName,
        agentStatus: "active",
        isStreaming: true,
      });
    }

    return result;
  }, [messages, streamingMessage, agentName, agentStatus]);

  const isStreaming = streamingMessage?.isStreaming ?? false;
  const starterPrompts = [
    "Summarize the current session goals.",
    "Draft a plan and checklist for this task.",
    "Review the latest outputs and suggest next steps.",
  ];

  return (
    <div className={cn("flex flex-col h-full min-h-0 bg-background", className)}>
      {/* Message list - uses flex-1 with min-h-0 to allow proper shrinking */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto px-4 py-6 scrollbar-thin"
          onWheel={disableAutoScroll}
          onTouchMove={disableAutoScroll}
        >
          <div className="mx-auto max-w-3xl space-y-6 pb-4">
            {isLoading ? (
              <>
                <ChatMessageSkeleton />
                <ChatMessageSkeleton />
                <ChatMessageSkeleton />
              </>
            ) : displayMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-2xl bg-muted/50 p-6">
                  <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Send a message to begin chatting with {agentName}. The agent
                    can help you with tasks, answer questions, and more.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {starterPrompts.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => onSend(prompt)}
                        disabled={disabled || isLoading || isStreaming}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              displayMessages.map((msg) => (
                <SessionChatMessage key={msg.id} message={msg} />
              ))
            )}
          </div>
        </div>

        {/* Scroll to bottom button */}
        {!isAtBottom && (
          <Button
            onClick={scrollToBottom}
            size="icon"
            variant="outline"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md z-10 bg-background"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Chat input - shrink-0 ensures it keeps its height */}
      <div className="shrink-0">
        <SessionChatInput
          onSend={onSend}
          isStreaming={isStreaming}
          onStop={onStop}
          disabled={disabled || isLoading}
          placeholder={`Message ${agentName}...`}
        />
      </div>
    </div>
  );
}

export default SessionChat;
