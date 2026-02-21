"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { SessionChatMessage } from "./SessionChatMessage";
import { SessionChatInput } from "./SessionChatInput";
import { ChatMessageSkeleton } from "@/components/composed";
import type { ChatMessage } from "@/lib/api/sessions";
import type { StreamingMessage } from "@/stores/useSessionStore";

export interface SessionChatProps {
  /** Chat messages to display */
  messages: ReadonlyArray<ChatMessage>;
  /** Streaming message state (if currently streaming) */
  streamingMessage?: StreamingMessage | null;
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
      reasoningContent: msg.reasoningContent,
      timestamp: msg.timestamp,
      toolCalls: msg.toolCalls,
      id: `msg-${i}`,
      agentName: msg.role === "assistant" ? agentName : undefined,
      agentStatus: msg.role === "assistant" ? agentStatus : undefined,
    }));

    // Add streaming message if present
    if (streamingMessage && streamingMessage.isStreaming) {
      result.push({
        role: "assistant",
        content: streamingMessage.content,
        reasoningContent: streamingMessage.reasoningContent,
        toolCalls: streamingMessage.toolCalls,
        id: "streaming",
        agentName,
        agentStatus: "active",
        isStreaming: true,
      });
    }

    return result;
  }, [messages, streamingMessage, agentName, agentStatus]);

  const isStreaming = streamingMessage?.isStreaming ?? false;

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
