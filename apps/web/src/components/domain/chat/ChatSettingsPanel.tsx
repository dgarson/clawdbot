"use client";

import { Trash2, Info, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DetailPanel } from "@/components/composed/DetailPanel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/composed/StatusBadge";
import type { Conversation } from "@/hooks/queries/useConversations";
import type { Agent } from "@/stores/useAgentStore";

interface ChatSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  conversation?: Conversation;
  agent?: Agent;
  messageCount?: number;
  onClearHistory?: () => void;
  onDeleteConversation?: () => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function ChatSettingsPanel({
  open,
  onClose,
  conversation,
  agent,
  messageCount = 0,
  onClearHistory,
  onDeleteConversation,
}: ChatSettingsPanelProps) {
  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      title="Conversation Settings"
      width="sm"
    >
      <div className="space-y-6">
        {/* Agent Info */}
        {agent && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {agent.avatar && (
                  <AvatarImage src={agent.avatar} alt={agent.name} />
                )}
                <AvatarFallback className="bg-secondary text-lg">
                  {agent.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-medium text-foreground">{agent.name}</h3>
                <p className="text-sm text-muted-foreground">{agent.role}</p>
              </div>
            </div>
            <StatusBadge status={agent.status} size="md" />
          </div>
        )}

        <Separator />

        {/* Session Info */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Info className="h-4 w-4" />
            Session Information
          </h4>

          <div className="space-y-3">
            {conversation && (
              <>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground flex items-center gap-2 min-w-0">
                    <Clock className="h-3.5 w-3.5" />
                    Created
                  </span>
                  <span className="text-foreground whitespace-nowrap tabular-nums shrink-0">
                    {formatDate(conversation.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground flex items-center gap-2 min-w-0">
                    <Clock className="h-3.5 w-3.5" />
                    Last Updated
                  </span>
                  <span className="text-foreground whitespace-nowrap tabular-nums shrink-0">
                    {formatDate(conversation.updatedAt)}
                  </span>
                </div>
              </>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Messages
              </span>
              <span className="text-foreground">{messageCount}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Danger Zone */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-destructive">
            Danger Zone
          </h4>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={onClearHistory}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Chat History
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDeleteConversation}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Conversation
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Deleting this conversation will permanently remove all messages and
            cannot be undone.
          </p>
        </div>
      </div>
    </DetailPanel>
  );
}

export default ChatSettingsPanel;
