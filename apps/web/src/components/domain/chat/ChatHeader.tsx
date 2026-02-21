"use client";

import { ArrowLeft, Settings, MoreVertical, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/composed/StatusBadge";
import type { Agent } from "@/stores/useAgentStore";
import type { Conversation, Message } from "@/stores/useConversationStore";
import { exportSingleConversation, downloadBlob } from "@/lib/export";

interface ChatHeaderProps {
  agent?: Agent;
  title?: string;
  conversation?: Conversation;
  messages?: Message[];
  onBack?: () => void;
  onSettings?: () => void;
  className?: string;
}

export function ChatHeader({
  agent,
  title,
  conversation,
  messages = [],
  onBack,
  onSettings,
  className,
}: ChatHeaderProps) {
  const handleExport = (format: "json" | "markdown") => {
    if (!conversation) {
      toast.error("No conversation to export");
      return;
    }

    try {
      const result = exportSingleConversation({
        conversation,
        messages,
        agentName: agent?.name,
        format,
        options: {
          includeTimestamps: true,
          includeAgentNames: true,
        },
      });

      const blob = new Blob([result.content], { type: result.mimeType });
      downloadBlob(blob, result.filename);

      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Failed to export conversation");
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      {/* Back button */}
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 h-9 w-9 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back to conversations</span>
        </Button>
      )}

      {/* Agent info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {agent && (
          <Avatar className="h-9 w-9 shrink-0">
            {agent.avatar && <AvatarImage src={agent.avatar} alt={agent.name} />}
            <AvatarFallback className="bg-secondary text-sm">
              {agent.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-foreground truncate">
              {title || agent?.name || "Conversation"}
            </h2>
            {agent && (
              <StatusBadge
                status={agent.status}
                size="sm"
                className="shrink-0"
              />
            )}
          </div>
          {agent?.role && (
            <p className="text-xs text-muted-foreground truncate">
              {agent.role}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {onSettings && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettings}
            className="h-9 w-9 rounded-lg"
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => handleExport("json")}
              disabled={!conversation}
            >
              <FileJson className="h-4 w-4" />
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleExport("markdown")}
              disabled={!conversation}
            >
              <FileText className="h-4 w-4" />
              Export as Markdown
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default ChatHeader;
