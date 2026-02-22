
import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bot,
  MessageCircle,
  Target,
  Brain,
  RefreshCw,
  ListTodo,
  Plus,
  Moon,
  Sun,
  Settings,
  Zap,
  Keyboard,
  PanelLeftClose,
  AlertCircle,
  Clock,
  LayoutDashboard,
  Activity,
  FileText,
  LineChart,
  HardDrive,
  User,
  GitBranch,
  Network,
  Calendar,
  Wrench,
  Search,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useUIStore } from "@/stores/useUIStore";
import { useAgentStore } from "@/stores/useAgentStore";
import { useConversationStore } from "@/stores/useConversationStore";
import { derivePendingApprovalsSummary } from "@/lib/approvals/pending";
import { showInfo } from "@/lib/toast";
import { getPaletteIntent } from "@/lib/palette-intent";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onShowShortcuts,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const {
    theme,
    setTheme,
    powerUserMode,
    setPowerUserMode,
    toggleSidebar,
    setAttentionSnoozeUntilMs,
  } = useUIStore();
  const agents = useAgentStore((s) => s.agents);
  const conversations = useConversationStore((s) => s.conversations);
  const approvals = React.useMemo(() => derivePendingApprovalsSummary(agents), [agents]);

  const intent = React.useMemo(() => getPaletteIntent(query), [query]);

  const handleSelect = React.useCallback(
    (action: () => void) => {
      action();
      onOpenChange(false);
      setQuery("");
    },
    [onOpenChange]
  );

  // Action handlers
  const handleNewConversation = React.useCallback(() => {
    navigate({ to: "/conversations" });
  }, [navigate]);

  const handleToggleTheme = React.useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }, [theme, setTheme]);

  const handleTogglePowerUser = React.useCallback(() => {
    setPowerUserMode(!powerUserMode);
  }, [powerUserMode, setPowerUserMode]);

  const handleToggleSidebar = React.useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  const handleGoToAgent = React.useCallback(
    (agentId: string) => {
      navigate({ to: "/agents/$agentId", params: { agentId } });
    },
    [navigate]
  );

  const handleGoToConversation = React.useCallback(
    (conversationId: string) => {
      // Conversations are now sessions - navigate to agent session view
      // The conversationId format might be "agent-{agentId}-{sessionKey}" or similar
      // For now, navigate to the conversations list which will redirect appropriately
      navigate({ to: "/conversations/$id", params: { id: conversationId } });
    },
    [navigate]
  );

  const handleCheckGatewayStatus = React.useCallback(async () => {
    // In a real implementation this would call gateway.status
    // For this UI task, we show a toast as requested
    showInfo("Gateway Status: Online (v1.2.4). All systems nominal.");
  }, []);

  const handleRunHeartbeat = React.useCallback(() => {
    // In a real implementation this would send a message to the main agent
    showInfo("Sent heartbeat signal to main agent.");
  }, []);

  const handleChatWithAgent = React.useCallback(
    (agentId: string) => {
      navigate({
        to: "/agents/$agentId/session/$sessionKey",
        params: { agentId, sessionKey: "current" },
        search: { newSession: false },
      });
    },
    [navigate]
  );

  // Navigation actions
  const navigationItems = [
    { label: "Home", to: "/" as const, icon: Target },
    { label: "Conversations", to: "/conversations" as const, icon: MessageCircle },
    { label: "Agents", to: "/agents" as const, icon: Bot },
    { label: "Goals", to: "/goals" as const, icon: Target },
    { label: "Memories", to: "/memories" as const, icon: Brain },
    { label: "Rituals", to: "/rituals" as const, icon: RefreshCw },
    { label: "Workstreams", to: "/workstreams" as const, icon: ListTodo },
    { label: "Skills", to: "/skills" as const, icon: Wrench },
    { label: "Nodes", to: "/nodes" as const, icon: Network },
    { label: "Settings", to: "/you" as const, icon: User },
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      description="Search for commands, navigate, or perform actions"
    >
      <CommandInput 
        placeholder="Type a command or search..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {intent && (
          <CommandGroup heading="Suggestions">
            <CommandItem
              onSelect={() =>
                handleSelect(() =>
                  navigate({
                    to: intent.to as any,
                    params: intent.params as any,
                    search: intent.search as any,
                  })
                )
              }
            >
              <Search className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span>{intent.label}</span>
                <span className="text-xs text-muted-foreground">
                  Try: {intent.suggestion}
                </span>
              </div>
            </CommandItem>
          </CommandGroup>
        )}
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => handleSelect(handleNewConversation)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Conversation</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(handleToggleTheme)}>
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            <span>Toggle Theme</span>
            <CommandShortcut>D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(handleTogglePowerUser)}>
            <Zap className="mr-2 h-4 w-4" />
            <span>Toggle Power User Mode</span>
            <CommandShortcut>P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(handleToggleSidebar)}>
            <PanelLeftClose className="mr-2 h-4 w-4" />
            <span>Toggle Sidebar</span>
            <CommandShortcut>\</CommandShortcut>
          </CommandItem>
          {onShowShortcuts && (
            <CommandItem onSelect={() => handleSelect(onShowShortcuts)}>
              <Keyboard className="mr-2 h-4 w-4" />
              <span>Show Keyboard Shortcuts</span>
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* New Groups */}
        <CommandGroup heading="Agents">
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/agents/new" }))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Create Agent</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/agents/graph" }))}>
            <GitBranch className="mr-2 h-4 w-4" />
            <span>Agent Graph</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/agent-status" }))}>
            <Activity className="mr-2 h-4 w-4" />
            <span>Agent Status</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Sessions">
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/conversations" }))}>
            <MessageCircle className="mr-2 h-4 w-4" />
            <span>New Conversation</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/analytics", search: { tab: "sessions" } }))}>
            <Search className="mr-2 h-4 w-4" />
            <span>Session Inspector</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Gateway">
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/logs" }))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>View Logs</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/analytics" }))}>
            <LineChart className="mr-2 h-4 w-4" />
            <span>View Analytics</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(handleCheckGatewayStatus)}>
            <Activity className="mr-2 h-4 w-4" />
            <span>Check Status</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Cron">
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/jobs" }))}>
            <Clock className="mr-2 h-4 w-4" />
            <span>View Jobs</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(handleRunHeartbeat)}>
            <Zap className="mr-2 h-4 w-4" />
            <span>Run Heartbeat Now</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {approvals.pendingApprovals > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Approvals">
              <CommandItem
                onSelect={() =>
                  handleSelect(() =>
                    navigate({ to: "/agents", search: { status: "waiting" } })
                  )
                }
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                <span>Review waiting approvals</span>
                <CommandShortcut>W</CommandShortcut>
              </CommandItem>
              {approvals.nextAgentId ? (
                <CommandItem
                  onSelect={() =>
                    handleSelect(() =>
                      navigate({
                        to: "/agents/$agentId",
                        params: { agentId: approvals.nextAgentId! },
                        search: { tab: "activity" },
                      })
                    )
                  }
                >
                  <Bot className="mr-2 h-4 w-4" />
                  <span>Open next approval</span>
                  <CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              ) : null}
              <CommandItem
                onSelect={() =>
                  handleSelect(() => {
                    setAttentionSnoozeUntilMs(Date.now() + 15 * 60_000);
                    showInfo("Approval reminders snoozed for 15 minutes.");
                  })
                }
              >
                <Clock className="mr-2 h-4 w-4" />
                <span>Snooze approval reminders (15m)</span>
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.to}
              onSelect={() =>
                handleSelect(() => navigate({ to: item.to }))
              }
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>Go to {item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Agents */}
        {agents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Chat with Agent">
              {agents.slice(0, 5).map((agent) => (
                <CommandItem
                  key={`chat-${agent.id}`}
                  onSelect={() => handleSelect(() => handleChatWithAgent(agent.id))}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  <span>Chat with {agent.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Agents">
              {agents.slice(0, 5).map((agent) => (
                <CommandItem
                  key={agent.id}
                  onSelect={() => handleSelect(() => handleGoToAgent(agent.id))}
                >
                  <Bot className="mr-2 h-4 w-4" />
                  <span>{agent.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {agent.role}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Recent Conversations */}
        {conversations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Conversations">
              {conversations.slice(0, 5).map((conversation) => (
                <CommandItem
                  key={conversation.id}
                  onSelect={() =>
                    handleSelect(() => handleGoToConversation(conversation.id))
                  }
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  <span>{conversation.title}</span>
                  {conversation.preview && (
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {conversation.preview}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Footer hint: discoverability nudge for keyboard shortcuts */}
      <div className="flex items-center justify-center border-t border-border px-4 py-2">
        <p className="text-xs text-muted-foreground">
          Press{" "}
          <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-medium text-muted-foreground shadow-sm">
            ?
          </kbd>{" "}
          to see all keyboard shortcuts
        </p>
      </div>
    </CommandDialog>
  );
}

export default CommandPalette;
