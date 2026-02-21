"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Conversation } from "@/hooks/queries/useConversations";
import type { Agent } from "@/stores/useAgentStore";

interface ConversationItemProps {
  conversation: Conversation;
  agent?: Agent;
  isActive?: boolean;
  hasUnread?: boolean;
  onClick?: () => void;
  className?: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {return "Just now";}
  if (diffMins < 60) {return `${diffMins}m ago`;}
  if (diffHours < 24) {return `${diffHours}h ago`;}
  if (diffDays === 1) {return "Yesterday";}
  if (diffDays < 7) {return `${diffDays}d ago`;}
  return date.toLocaleDateString();
}

export function ConversationItem({
  conversation,
  agent,
  isActive = false,
  hasUnread = false,
  onClick,
  className,
}: ConversationItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      role="button"
      tabIndex={0}
      aria-selected={isActive}
      aria-label={`Conversation: ${conversation.title}${hasUnread ? " (unread)" : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "group flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200",
        "border border-transparent hover:border-border/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive
          ? "bg-primary/10 border-primary/30"
          : "hover:bg-secondary/50",
        className
      )}
    >
      {/* Agent Avatar */}
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10">
          {agent?.avatar && <AvatarImage src={agent.avatar} alt={agent.name} />}
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            {agent?.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        {/* Unread indicator */}
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className={cn(
            "truncate text-sm font-medium",
            hasUnread ? "text-foreground" : "text-foreground/90"
          )}>
            {conversation.title}
          </h4>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(conversation.updatedAt)}
          </span>
        </div>

        {/* Agent name */}
        {agent && (
          <p className="text-xs text-muted-foreground mb-1">
            {agent.name}
          </p>
        )}

        {/* Preview */}
        {conversation.preview && (
          <p className={cn(
            "text-sm line-clamp-2",
            hasUnread ? "text-foreground/80" : "text-muted-foreground"
          )}>
            {conversation.preview}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default ConversationItem;
