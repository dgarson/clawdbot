import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import * as Collapsible from "@radix-ui/react-collapsible";
import { cn } from "@/lib/utils";
import { CardSkeleton } from "@/components/composed";
import {
  SessionHeader,
  SessionChat,
  SessionActivityFeed,
  SessionWorkspacePane,
  SessionOverviewPanel,
  TerminalStatusIcon,
  type Activity,
} from "@/components/domain/session";
import { CoreFilesSheet } from "@/components/domain/agents";
import { useAgent } from "@/hooks/queries/useAgents";
import { useAgentSessions, useChatHistory } from "@/hooks/queries/useSessions";
import { useGatewayConnected } from "@/hooks/queries/useGateway";
import { useChatBackend } from "@/hooks/useChatBackend";
import { useSessionShortcuts } from "@/hooks/useSessionShortcuts";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { useVercelSessionStore } from "@/stores/useVercelSessionStore";
import { buildAgentSessionKey, type ChatMessage } from "@/lib/api/sessions";
import type { StreamingMessage } from "@/stores/useSessionStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, TerminalSquare, Timer, X } from "lucide-react";
import { formatRelativeTime, getSessionLabel } from "@/components/domain/session/session-helpers";
import { useCronRunLog } from "@/hooks/queries/useCron";

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

function getLatestMessageTimestamp(messages: ReadonlyArray<ChatMessage>): number | undefined {
  return messages.reduce<number | undefined>((latest, message) => {
    if (!message.timestamp) {return latest;}
    const parsed = Date.parse(message.timestamp);
    if (Number.isNaN(parsed)) {return latest;}
    if (!latest || parsed > latest) {return parsed;}
    return latest;
  }, undefined);
}

function formatDurationMs(durationMs?: number): string | null {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
    return null;
  }
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }
  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function getCronStatusClass(status?: string) {
  switch (status) {
    case "ok":
      return "bg-emerald-500";
    case "error":
      return "bg-rose-500";
    case "skipped":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground/40";
  }
}

interface SessionSummaryStripProps {
  sessionLabel: string;
  messageCount: number;
  lastActiveAt?: number;
  chatBackend: "gateway" | "vercel-ai";
}

function SessionSummaryStrip({
  sessionLabel,
  messageCount,
  lastActiveAt,
  chatBackend,
}: SessionSummaryStripProps) {
  return (
    <div className="px-4 pb-3 xl:hidden">
      <Card className="border-border/60 bg-card/40">
        <CardContent className="p-3 flex flex-wrap items-center gap-3 text-xs">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Session</p>
            <p className="text-sm font-semibold truncate">{sessionLabel}</p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Timer className="h-3.5 w-3.5" />
            <span>{lastActiveAt ? formatRelativeTime(lastActiveAt) : "Waiting"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <TerminalSquare className="h-3.5 w-3.5" />
            <span>{messageCount} messages</span>
          </div>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            {chatBackend === "gateway" ? "Gateway" : "Vercel AI"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentSessionPage() {
  const { agentId, sessionKey: sessionKeyParam } = Route.useParams();
  const navigate = Route.useNavigate();

  // State
  const [workspacePaneMaximized, setWorkspacePaneMaximized] = React.useState(false);
  const [coreFilesSheetOpen, setCoreFilesSheetOpen] = React.useState(false);
  const [activities] = React.useState<Activity[]>(mockActivities);

  // Preferences (backend + session layout)
  const chatBackend = usePreferencesStore((s) => s.chatBackend);
  const sessionLeftPanelCollapsed = usePreferencesStore((s) => s.sessionLeftPanelCollapsed);
  const sessionRightPanelCollapsed = usePreferencesStore((s) => s.sessionRightPanelCollapsed);
  const sessionRightPanelTab = usePreferencesStore((s) => s.sessionRightPanelTab);
  const sessionFocusMode = usePreferencesStore((s) => s.sessionFocusMode);
  const toggleSessionLeftPanel = usePreferencesStore((s) => s.toggleSessionLeftPanel);
  const toggleSessionRightPanel = usePreferencesStore((s) => s.toggleSessionRightPanel);
  const setSessionRightPanelTab = usePreferencesStore((s) => s.setSessionRightPanelTab);
  const toggleSessionFocusMode = usePreferencesStore((s) => s.toggleSessionFocusMode);

  const leftHidden = sessionFocusMode || sessionLeftPanelCollapsed;
  const rightHidden = sessionFocusMode || sessionRightPanelCollapsed;

  // Gateway connection status (for terminal icon)
  const { isConnected: isGatewayConnected } = useGatewayConnected();

  const vercelStore = useVercelSessionStore();

  // Session shortcuts
  useSessionShortcuts({
    onToggleTerminal: () => {
      setSessionRightPanelTab("workspace");
      setWorkspacePaneMaximized(true);
    },
    onOpenCoreFiles: () => setCoreFilesSheetOpen(true),
    onCloseMaximized: () => {
      if (workspacePaneMaximized) setWorkspacePaneMaximized(false);
      if (coreFilesSheetOpen) setCoreFilesSheetOpen(false);
    },
  });

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

  const isCronSession = React.useMemo(
    () =>
      sessionKey.startsWith(`agent:${agentId}:cron:`) ||
      sessionKey.startsWith("cron:"),
    [sessionKey, agentId]
  );
  const { data: cronRunLog } = useCronRunLog({
    sessionKey: isCronSession ? sessionKey : undefined,
    limit: 20,
  });
  const [cronLogOpen, setCronLogOpen] = React.useState(true);

  // Use unified chat backend hook
  const { streamingMessage, handleSend, handleStop, isStreaming } = useChatBackend(sessionKey, agent ?? undefined);

  // Get messages based on active backend
  // Type assertion: VercelChatMessage is structurally compatible with ChatMessage for display
  const messages = React.useMemo((): ChatMessage[] => {
    if (chatBackend === "vercel-ai") {
      // Use Vercel AI local history (cast for type compatibility)
      return vercelStore.getHistory(sessionKey) as ChatMessage[];
    }
    // Use gateway history from server
    return chatHistory?.messages ?? [];
  }, [chatBackend, sessionKey, chatHistory?.messages, vercelStore]);

  const selectedSession = React.useMemo(
    () => sessions?.find((session) => session.key === sessionKey),
    [sessions, sessionKey]
  );
  const messageCount = selectedSession?.messageCount ?? messages.length;
  const derivedLastActive = getLatestMessageTimestamp(messages);
  const lastActiveAt = selectedSession?.lastMessageAt ?? derivedLastActive;

  // Handle session change (switching to an existing session)
  const handleSessionChange = React.useCallback(
    (newSessionKey: string) => {
      navigate({
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
    navigate({
      to: "/agents/$agentId/session/$sessionKey",
      params: { agentId, sessionKey: newKey },
      search: { newSession: true },
    });
  }, [navigate, agentId]);

  // Compute dynamic grid columns (must be before early returns per Rules of Hooks)
  const gridCols = React.useMemo(() => {
    if (workspacePaneMaximized) return "grid-cols-1";
    if (leftHidden && rightHidden) return "grid-cols-1";
    if (leftHidden) return "xl:grid-cols-[minmax(0,1fr)_300px]";
    if (rightHidden) return "xl:grid-cols-[240px_minmax(0,1fr)]";
    return "xl:grid-cols-[240px_minmax(0,1fr)_300px]";
  }, [workspacePaneMaximized, leftHidden, rightHidden]);

  const openTerminal = React.useCallback(() => {
    if (rightHidden) toggleSessionRightPanel();
    setSessionRightPanelTab("workspace");
    setWorkspacePaneMaximized(true);
  }, [rightHidden, toggleSessionRightPanel, setSessionRightPanelTab]);

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
            <Button variant="outline" onClick={() => navigate({ to: "/agents" })}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground overflow-hidden">
      {/* Session Header */}
      <SessionHeader
        agent={agent}
        sessions={sessions ?? []}
        selectedSessionKey={sessionKey}
        onSessionChange={handleSessionChange}
        onNewSession={handleNewSession}
      />

      <SessionSummaryStrip
        sessionLabel={selectedSession ? getSessionLabel(selectedSession) : "Current session"}
        messageCount={messageCount}
        lastActiveAt={lastActiveAt}
        chatBackend={chatBackend}
      />

      {/* Main content area */}
      <div className={cn("flex-1 min-h-0 grid gap-0 grid-cols-1", gridCols)}>
        {/* Left sidebar - collapsible */}
        <AnimatePresence initial={false}>
          {!leftHidden && !workspacePaneMaximized && (
            <motion.aside
              key="left-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="hidden xl:flex flex-col border-r border-border/50 bg-muted/20 overflow-hidden min-h-0"
            >
              <div className="min-w-[240px] p-3 flex-1 min-h-0 overflow-y-auto">
                <SessionOverviewPanel
                  agent={agent}
                  session={selectedSession}
                  messageCount={messageCount}
                  lastActiveAt={lastActiveAt}
                  workspaceDir={`~/.openclaw/agents/${agentId}/workspace`}
                  chatBackend={chatBackend}
                  onNewSession={handleNewSession}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Chat section (center) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "min-w-0 min-h-0 flex flex-col relative",
            workspacePaneMaximized && "hidden"
          )}
        >
          {/* Collapse toggle: expand left sidebar */}
          <AnimatePresence>
            {leftHidden && !workspacePaneMaximized && (
              <motion.button
                key="expand-left"
                type="button"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleSessionLeftPanel}
                className="hidden xl:flex absolute left-1 top-3 z-10 h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-card shadow-sm hover:bg-accent transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Collapse toggle: expand right sidebar */}
          <AnimatePresence>
            {rightHidden && !workspacePaneMaximized && (
              <motion.button
                key="expand-right"
                type="button"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleSessionRightPanel}
                className="hidden xl:flex absolute right-1 top-3 z-10 h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-card shadow-sm hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Focus mode indicator */}
          <AnimatePresence>
            {sessionFocusMode && (
              <motion.div
                key="focus-indicator"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border border-border/60 bg-card/90 px-3 py-1 shadow-sm text-xs text-muted-foreground backdrop-blur-sm"
              >
                <span>Focus Mode</span>
                <button
                  type="button"
                  onClick={toggleSessionFocusMode}
                  className="rounded-full p-0.5 hover:bg-muted transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {isCronSession && (
            <div className="px-4 pt-4">
              <Collapsible.Root open={cronLogOpen} onOpenChange={setCronLogOpen}>
                <div className="rounded-xl border border-border/50 bg-card/40">
                  <Collapsible.Trigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <Timer className="h-4 w-4 text-muted-foreground" />
                        Cron Run Log
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          cronLogOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </Collapsible.Trigger>
                  <Collapsible.Content className="px-4 pb-4">
                    {cronRunLog?.entries.length ? (
                      <ul className="space-y-3 text-xs">
                        {cronRunLog.entries.map((entry, index) => {
                          const finishAtMs = entry.finishAtMs;
                          const durationMs = finishAtMs
                            ? Math.max(0, finishAtMs - entry.startAtMs)
                            : undefined;
                          const durationLabel = formatDurationMs(durationMs);
                          const startLabel = formatRelativeTime(entry.startAtMs);
                          const finishLabel = finishAtMs ? formatRelativeTime(finishAtMs) : null;
                          return (
                            <li key={`${entry.jobId}-${entry.startAtMs}-${index}`} className="flex gap-3">
                              <span
                                className={cn(
                                  "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
                                  getCronStatusClass(entry.status)
                                )}
                              />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">Job {entry.jobId}</span>
                                  {entry.status && (
                                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                      {entry.status}
                                    </Badge>
                                  )}
                                  {durationLabel && (
                                    <span className="text-[10px] text-muted-foreground">{durationLabel}</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {finishLabel ? `${startLabel} \u2192 ${finishLabel}` : startLabel}
                                </div>
                                {entry.summary && (
                                  <div className="text-xs text-muted-foreground line-clamp-2">
                                    {entry.summary}
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">No cron run entries yet.</p>
                    )}
                  </Collapsible.Content>
                </div>
              </Collapsible.Root>
            </div>
          )}
          <SessionChat
            messages={messages}
            streamingMessage={streamingMessage as StreamingMessage | null}
            agentName={agent.name}
            agentStatus={agent.status === "online" ? "active" : "ready"}
            isLoading={chatBackend === "gateway" ? chatLoading : false}
            onSend={handleSend}
            onStop={handleStop}
            disabled={isStreaming}
          />
        </motion.div>

        {/* Right sidebar - collapsible */}
        <AnimatePresence initial={false}>
          {!rightHidden && (
            <motion.aside
              key="right-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={cn(
                "min-h-0 flex flex-col border-l border-border/50 bg-card/30 overflow-hidden",
                workspacePaneMaximized && "border-l-0"
              )}
            >
              <div className="min-w-[300px] flex-1 min-h-0 flex flex-col">
                <Tabs
                  value={sessionRightPanelTab}
                  onValueChange={(v) => setSessionRightPanelTab(v as "activity" | "workspace")}
                  className="flex-1 min-h-0"
                >
                  <div className="px-2.5 pt-2.5">
                    <TabsList variant="line" className="w-full justify-start">
                      <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
                      <TabsTrigger value="workspace" className="text-xs">Workspace</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="activity" className="flex-1 min-h-0 px-2.5 pb-2.5">
                    <div className="h-full border border-border/50 rounded-lg overflow-hidden bg-card/40">
                      <div className="px-3 py-2.5 border-b border-border/50">
                        <h3 className="text-xs font-medium">Activity</h3>
                      </div>
                      <SessionActivityFeed activities={activities} maxItems={12} />
                    </div>
                  </TabsContent>

                  <TabsContent value="workspace" className="flex-1 min-h-0 px-2.5 pb-2.5">
                    <SessionWorkspacePane
                      isMaximized={workspacePaneMaximized}
                      onToggleMaximize={() => setWorkspacePaneMaximized((v) => !v)}
                      sessionKey={sessionKey}
                      workspaceDir={`~/.openclaw/agents/${agentId}/workspace`}
                      agentId={agentId}
                      className="h-full"
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Terminal status icon - shown when terminal is not visible */}
      {(rightHidden || sessionRightPanelTab !== "workspace") && !workspacePaneMaximized && (
        <TerminalStatusIcon connected={isGatewayConnected} onClick={openTerminal} />
      )}

      {/* Core Files editor sheet */}
      <CoreFilesSheet open={coreFilesSheetOpen} onOpenChange={setCoreFilesSheetOpen} agentId={agentId} />
    </div>
  );
}

export default AgentSessionPage;
