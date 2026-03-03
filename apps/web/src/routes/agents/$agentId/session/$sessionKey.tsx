import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CardSkeleton } from "@/components/composed";
import {
  SessionHeader,
  SessionChat,
  SessionActivityFeed,
  SessionWorkspacePane,
  type Activity,
} from "@/components/domain/session";
import { TerminalOverlay } from "@/components/domain/session/TerminalOverlay";
import { ChevronDown, Zap, FolderOpen } from "lucide-react";
import { useAgent } from "@/hooks/queries/useAgents";
import { useAgentSessions, useChatHistory } from "@/hooks/queries/useSessions";
import { useChatBackend } from "@/hooks/useChatBackend";
import { buildAgentSessionKey, type ChatMessage } from "@/lib/api/sessions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ApprovalAttentionNudgeConnected } from "@/components/composed/ApprovalAttentionNudge";

export const Route = createFileRoute("/agents/$agentId/session/$sessionKey")({
  component: AgentSessionPage,
  validateSearch: (search: Record<string, unknown>): { newSession?: boolean; initialMessage?: string } => {
    const newSession = search.newSession === true || search.newSession === "true";
    const initialMessage = typeof search.initialMessage === "string" ? search.initialMessage : undefined;
    return { newSession: newSession || undefined, initialMessage };
  },
});

// Mock activities for development
const mockActivities: Activity[] = [
  {
    id: "live-1",
    type: "task_live",
    title: "Processing request",
    description: "Analyzing user query...",
    progress: 65,
    timestamp: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: "1",
    type: "message",
    title: "Response generated",
    description: "Completed AI response",
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "2",
    type: "search",
    title: "Web search",
    description: "Searched for relevant information",
    timestamp: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: "3",
    type: "code",
    title: "Code execution",
    description: "Ran analysis script",
    timestamp: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "4",
    type: "task_complete",
    title: "Task completed",
    description: "Finished data processing",
    timestamp: new Date(Date.now() - 600000).toISOString(),
  },
];

function AgentSessionPage() {
  const { agentId, sessionKey: sessionKeyParam } = Route.useParams();
  const navigate = Route.useNavigate();

  // State
  const [activityOpen, setActivityOpen] = React.useState(true);
  const [filesOpen, setFilesOpen] = React.useState(false);
  const [terminalOpen, setTerminalOpen] = React.useState(false);
  const [activities] = React.useState<Activity[]>(mockActivities);

  // Queries
  const { data: agent, isLoading: agentLoading, error: agentError } = useAgent(agentId);
  const { data: sessions, defaults } = useAgentSessions(agentId);

  // Determine active session key
  const sessionKey = React.useMemo(() => {
    // If sessionKey param is "current" or empty, use the first session or build default
    if (sessionKeyParam === "current" || !sessionKeyParam) {
      if (sessions && sessions.length > 0) {
        return sessions[0].key;
      }
      return buildAgentSessionKey(agentId, defaults?.mainKey ?? "main");
    }
    return sessionKeyParam;
  }, [sessionKeyParam, sessions, agentId, defaults?.mainKey]);

  // Load chat history for the active session (gateway only)
  const { data: chatHistory, isLoading: chatLoading } = useChatHistory(sessionKey);

  const { streamingMessage, handleSend, handleStop, isStreaming } = useChatBackend(sessionKey);

  const messages = React.useMemo((): ChatMessage[] => chatHistory?.messages ?? [], [chatHistory?.messages]);

  // Handle session change (switching to an existing session)
  const handleSessionChange = React.useCallback(
    (newSessionKey: string) => {
      void navigate({
        to: "/agents/$agentId/session/$sessionKey",
        params: { agentId, sessionKey: newSessionKey },
        search: { newSession: false },
      });
    },
    [navigate, agentId]
  );

  // Handle new session (creating a fresh session)
  const handleNewSession = React.useCallback(() => {
    const newKey = buildAgentSessionKey(agentId, `session-${Date.now()}`);
    void navigate({
      to: "/agents/$agentId/session/$sessionKey",
      params: { agentId, sessionKey: newKey },
      search: { newSession: true },
    });
  }, [navigate, agentId]);

  // Loading state
  if (agentLoading) {
    return (
      <div className="min-h-full bg-background text-foreground p-6">
        <CardSkeleton />
      </div>
    );
  }

  // Error state
  if (agentError || !agent) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <Card className="border-destructive/50 bg-destructive/10 max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold text-destructive mb-2">
              Agent Not Found
            </h2>
            <p className="text-muted-foreground mb-4">
              The agent you're looking for doesn't exist or has been removed.
            </p>
            <Button variant="outline" onClick={() => void navigate({ to: "/agents" })}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const workspaceDir = `~/.clawdbrain/agents/${agentId}/workspace`;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Approval nudge */}
      <ApprovalAttentionNudgeConnected className="px-4 py-2" />

      {/* Session Header */}
      <SessionHeader
        agent={agent}
        sessions={sessions ?? []}
        selectedSessionKey={sessionKey}
        onSessionChange={handleSessionChange}
        onNewSession={handleNewSession}
        onOpenTerminal={() => setTerminalOpen((v) => !v)}
        terminalOpen={terminalOpen}
      />

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Chat */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex-1 min-w-0 min-h-0 flex flex-col"
        >
          <SessionChat
            messages={messages}
            streamingMessage={streamingMessage}
            agentName={agent.name}
            agentStatus={agent.status === "online" ? "active" : "ready"}
            isLoading={chatLoading}
            onSend={handleSend}
            onStop={handleStop}
            disabled={isStreaming}
          />
        </motion.div>

        {/* Right sidebar — accordion: Activity + Files */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="w-[340px] border-l border-border/50 flex flex-col bg-card/30"
        >
          {/* ── Activity accordion section ── */}
          <div className={cn("flex flex-col min-h-0", activityOpen && "flex-1")}>
            <button
              type="button"
              onClick={() => setActivityOpen((v) => !v)}
              className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 shrink-0 hover:bg-muted/30 transition-colors w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Activity</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                  !activityOpen && "-rotate-90"
                )}
              />
            </button>
            {activityOpen && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <SessionActivityFeed activities={activities} maxItems={20} />
              </div>
            )}
          </div>

          {/* ── Files accordion section ── */}
          <div
            className={cn(
              "flex flex-col border-t border-border/50 min-h-0 shrink-0",
              filesOpen && !activityOpen && "flex-1",
              filesOpen && activityOpen && "h-[220px]"
            )}
          >
            <button
              type="button"
              onClick={() => setFilesOpen((v) => !v)}
              className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 shrink-0 hover:bg-muted/30 transition-colors w-full text-left"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Files</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                  !filesOpen && "-rotate-90"
                )}
              />
            </button>
            {filesOpen && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <SessionWorkspacePane
                  workspaceDir={workspaceDir}
                  agentId={agentId}
                  className="h-full"
                />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Floating terminal overlay — portal-rendered, bottom 60 % × center 60 % */}
      <TerminalOverlay
        open={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        sessionKey={sessionKey}
        workspaceDir={workspaceDir}
      />
    </div>
  );
}

export default AgentSessionPage;
