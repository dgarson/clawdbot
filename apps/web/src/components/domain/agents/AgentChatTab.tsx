
import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/composed";
import { useAgentSessions } from "@/hooks/queries/useSessions";
import { MessageSquare, ArrowUpRight, Plus, Clock } from "lucide-react";

interface AgentChatTabProps {
  agentId: string;
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {return "Just now";}
  if (diffMins < 60) {return `${diffMins}m ago`;}
  if (diffHours < 24) {return `${diffHours}h ago`;}
  if (diffDays < 7) {return `${diffDays}d ago`;}
  return new Date(ts).toLocaleDateString();
}

export function AgentChatTab({ agentId }: AgentChatTabProps) {
  const { data: sessions, isLoading } = useAgentSessions(agentId);
  const navigate = useNavigate();

  function handleNewSession() {
    void navigate({
      to: "/agents/$agentId/session/$sessionKey",
      params: { agentId, sessionKey: "current" },
      search: { newSession: true },
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-medium">No sessions yet</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
            Start a new session to begin chatting with this agent
          </p>
          <Button className="mt-4 gap-2" onClick={handleNewSession}>
            <Plus className="h-4 w-4" />
            New Session
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={handleNewSession}>
          <Plus className="h-4 w-4" />
          New Session
        </Button>
      </div>

      {sessions.map((session, index) => (
        <motion.div
          key={session.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.05 }}
        >
          <Link
            to="/agents/$agentId/session/$sessionKey"
            params={{ agentId, sessionKey: session.key }}
            className="block"
          >
            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground truncate">
                      {session.derivedTitle ?? session.label ?? session.key}
                    </h4>
                    {session.lastMessage && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                        {session.lastMessage}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {session.lastMessageAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(session.lastMessageAt)}
                        </span>
                      )}
                      {session.messageCount !== undefined && (
                        <span>{session.messageCount} messages</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    tabIndex={-1}
                    asChild
                  >
                    <span>
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

export default AgentChatTab;
