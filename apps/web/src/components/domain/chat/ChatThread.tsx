"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatMessageList } from "./ChatMessageList";
import {
  ChatBubble,
  ChatBubbleMessage,
  ChatBubbleAvatar,
} from "./ChatBubble";
import { ToolCallCard, type ToolCall } from "./ToolCallCard";
import type { Message } from "@/hooks/queries/useConversations";
import type { Agent } from "@/stores/useAgentStore";

interface ChatThreadProps {
  messages: Message[];
  agent?: Agent;
  isLoading?: boolean;
  className?: string;
}

// Extended message type to support tool calls
interface ExtendedMessage extends Message {
  toolCalls?: ToolCall[];
}

export function ChatThread({
  messages,
  agent,
  isLoading = false,
  className,
}: ChatThreadProps) {
  if (isLoading) {
    return (
      <div className={cn("flex-1 p-4 space-y-4", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn("flex-1 flex items-center justify-center p-8", className)}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          {agent && (
            <div className="mb-4 flex justify-center">
              <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                <span className="text-2xl font-semibold text-muted-foreground">
                  {agent.name.charAt(0)}
                </span>
              </div>
            </div>
          )}
          <h3 className="text-lg font-medium text-foreground mb-2">
            {agent ? `Start chatting with ${agent.name}` : "Start a conversation"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {agent?.description || "Send a message to begin the conversation."}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ChatMessageList smooth className={cn("flex-1", className)}>
      {(messages as ExtendedMessage[]).map((message, index) => {
        const isUser = message.role === "user";
        const isSystem = message.role === "system";

        // System messages
        if (isSystem) {
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center my-4"
            >
              <span className="px-3 py-1.5 rounded-full bg-secondary/50 text-xs text-muted-foreground">
                {message.content}
              </span>
            </motion.div>
          );
        }

        return (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <ChatBubble variant={isUser ? "sent" : "received"}>
              {!isUser && (
                <ChatBubbleAvatar
                  src={agent?.avatar}
                  fallback={agent?.name?.charAt(0) || "AI"}
                />
              )}
              <div className="flex flex-col gap-2 max-w-[80%]">
                <ChatBubbleMessage variant={isUser ? "sent" : "received"}>
                  {message.content}
                </ChatBubbleMessage>

                {/* Tool calls for assistant messages */}
                {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="space-y-2">
                    {message.toolCalls.map((toolCall) => (
                      <ToolCallCard key={toolCall.id} toolCall={toolCall} />
                    ))}
                  </div>
                )}
              </div>
            </ChatBubble>
          </motion.div>
        );
      })}
    </ChatMessageList>
  );
}

export default ChatThread;
