"use client";

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
  ChevronRight,
  ArrowLeft,
  LayoutDashboard,
  Palette,
  Monitor,
  Globe,
  Cog,
  type LucideIcon,
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

// ─── Types ──────────────────────────────────────────────────────

type CommandPage = "root" | "navigation" | "agents" | "settings" | "appearance";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts?: () => void;
}

// ─── Sub-menu definitions ───────────────────────────────────────

interface SubMenuDef {
  id: CommandPage;
  label: string;
  icon: LucideIcon;
}

const SUB_MENUS: SubMenuDef[] = [
  { id: "navigation", label: "Navigate to...", icon: Globe },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "settings", label: "Settings & Config", icon: Cog },
];

// ─── Component ──────────────────────────────────────────────────

export function CommandPalette({
  open,
  onOpenChange,
  onShowShortcuts,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [page, setPage] = React.useState<CommandPage>("root");
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

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
  const approvals = React.useMemo(
    () => derivePendingApprovalsSummary(agents),
    [agents]
  );

  // Reset page and search when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setPage("root");
      setSearch("");
    }
  }, [open]);

  // Handle back navigation with Backspace on empty search
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (page !== "root" && e.key === "Backspace" && !search) {
        e.preventDefault();
        setPage("root");
        setSearch("");
      }
      if (e.key === "Escape" && page !== "root") {
        e.preventDefault();
        setPage("root");
        setSearch("");
      }
    },
    [page, search]
  );

  const handleSelect = React.useCallback(
    (action: () => void) => {
      action();
      onOpenChange(false);
    },
    [onOpenChange]
  );

  const goToPage = React.useCallback((p: CommandPage) => {
    setPage(p);
    setSearch("");
    // Re-focus input after page change
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // ─── Action handlers ────────────────────────────────────────

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
      navigate({
        to: "/conversations/$id",
        params: { id: conversationId },
      });
    },
    [navigate]
  );

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

  // ─── Navigation items ───────────────────────────────────────

  const navigationItems = [
    { label: "Home", to: "/" as const, icon: LayoutDashboard },
    { label: "Conversations", to: "/conversations" as const, icon: MessageCircle },
    { label: "Agents", to: "/agents" as const, icon: Bot },
    { label: "Goals", to: "/goals" as const, icon: Target },
    { label: "Memories", to: "/memories" as const, icon: Brain },
    { label: "Rituals", to: "/rituals" as const, icon: RefreshCw },
    { label: "Automations", to: "/automations" as const, icon: Zap },
    { label: "Workstreams", to: "/workstreams" as const, icon: ListTodo },
    { label: "Settings", to: "/you" as const, icon: Settings },
    { label: "Agent Dashboard", to: "/agents/dashboard" as const, icon: Monitor },
  ];

  // Determine input placeholder based on page
  const placeholder =
    page === "root"
      ? "Type a command or search..."
      : page === "navigation"
        ? "Search pages..."
        : page === "agents"
          ? "Search agents..."
          : page === "appearance"
            ? "Search appearance settings..."
            : page === "settings"
              ? "Search settings..."
              : "Search...";

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      description="Search for commands, navigate, or perform actions"
    >
      {/* Breadcrumb for sub-pages */}
      {page !== "root" && (
        <div className="flex items-center gap-1.5 px-3 pt-3 pb-0">
          <button
            onClick={() => {
              setPage("root");
              setSearch("");
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-xs font-medium text-foreground">
            {SUB_MENUS.find((m) => m.id === page)?.label ?? page}
          </span>
        </div>
      )}

      <CommandInput
        ref={inputRef}
        placeholder={placeholder}
        value={search}
        onValueChange={setSearch}
        onKeyDown={handleKeyDown}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* ═══ ROOT PAGE ═══ */}
        {page === "root" && (
          <>
            {/* Quick Actions */}
            <CommandGroup heading="Quick Actions">
              <CommandItem
                onSelect={() => handleSelect(handleNewConversation)}
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>New Conversation</span>
                <CommandShortcut>N</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSelect(handleToggleTheme)}
              >
                {theme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                <span>Toggle Theme</span>
                <CommandShortcut>D</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSelect(handleToggleSidebar)}
              >
                <PanelLeftClose className="mr-2 h-4 w-4" />
                <span>Toggle Sidebar</span>
                <CommandShortcut>\</CommandShortcut>
              </CommandItem>
              {onShowShortcuts && (
                <CommandItem
                  onSelect={() => handleSelect(onShowShortcuts)}
                >
                  <Keyboard className="mr-2 h-4 w-4" />
                  <span>Show Keyboard Shortcuts</span>
                  <CommandShortcut>?</CommandShortcut>
                </CommandItem>
              )}
            </CommandGroup>

            {/* Pending Approvals */}
            {approvals.pendingApprovals > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Approvals">
                  <CommandItem
                    onSelect={() =>
                      handleSelect(() =>
                        navigate({
                          to: "/agents",
                          search: { status: "waiting" },
                        })
                      )
                    }
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    <span>Review waiting approvals</span>
                    <CommandShortcut>W</CommandShortcut>
                  </CommandItem>
                  {approvals.nextAgentId && (
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
                  )}
                  <CommandItem
                    onSelect={() =>
                      handleSelect(() => {
                        setAttentionSnoozeUntilMs(
                          Date.now() + 15 * 60_000
                        );
                        showInfo(
                          "Approval reminders snoozed for 15 minutes."
                        );
                      })
                    }
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    <span>Snooze approval reminders (15m)</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            <CommandSeparator />

            {/* Sub-menu launchers */}
            <CommandGroup heading="Categories">
              {SUB_MENUS.map((menu) => (
                <CommandItem
                  key={menu.id}
                  onSelect={() => goToPage(menu.id)}
                >
                  <menu.icon className="mr-2 h-4 w-4" />
                  <span>{menu.label}</span>
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Inline Navigation (top 5 for quick access) */}
            <CommandSeparator />
            <CommandGroup heading="Go to">
              {navigationItems.slice(0, 5).map((item) => (
                <CommandItem
                  key={item.to}
                  onSelect={() =>
                    handleSelect(() => navigate({ to: item.to }))
                  }
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Inline Agents (top 3 for quick chat) */}
            {agents.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Chat with Agent">
                  {agents.slice(0, 3).map((agent) => (
                    <CommandItem
                      key={`chat-${agent.id}`}
                      onSelect={() =>
                        handleSelect(() => handleChatWithAgent(agent.id))
                      }
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      <span>Chat with {agent.name}</span>
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
                  {conversations.slice(0, 3).map((conversation) => (
                    <CommandItem
                      key={conversation.id}
                      onSelect={() =>
                        handleSelect(() =>
                          handleGoToConversation(conversation.id)
                        )
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
          </>
        )}

        {/* ═══ NAVIGATION PAGE ═══ */}
        {page === "navigation" && (
          <CommandGroup heading="Pages">
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
        )}

        {/* ═══ AGENTS PAGE ═══ */}
        {page === "agents" && (
          <>
            {agents.length > 0 ? (
              <>
                <CommandGroup heading="Chat with Agent">
                  {agents.map((agent) => (
                    <CommandItem
                      key={`chat-${agent.id}`}
                      onSelect={() =>
                        handleSelect(() => handleChatWithAgent(agent.id))
                      }
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      <span>Chat with {agent.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="View Agent">
                  {agents.map((agent) => (
                    <CommandItem
                      key={agent.id}
                      onSelect={() =>
                        handleSelect(() => handleGoToAgent(agent.id))
                      }
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
            ) : (
              <CommandGroup heading="Agents">
                <CommandItem
                  onSelect={() =>
                    handleSelect(() => navigate({ to: "/agents" }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span>Go to Agents</span>
                </CommandItem>
              </CommandGroup>
            )}
          </>
        )}

        {/* ═══ APPEARANCE PAGE ═══ */}
        {page === "appearance" && (
          <CommandGroup heading="Appearance">
            <CommandItem
              onSelect={() => handleSelect(handleToggleTheme)}
            >
              {theme === "dark" ? (
                <Sun className="mr-2 h-4 w-4" />
              ) : (
                <Moon className="mr-2 h-4 w-4" />
              )}
              <span>
                Switch to {theme === "dark" ? "Light" : "Dark"} Theme
              </span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                handleSelect(() => setTheme("dark"))
              }
            >
              <Moon className="mr-2 h-4 w-4" />
              <span>Dark Theme</span>
              {theme === "dark" && (
                <span className="ml-auto text-xs text-primary">✓</span>
              )}
            </CommandItem>
            <CommandItem
              onSelect={() =>
                handleSelect(() => setTheme("light"))
              }
            >
              <Sun className="mr-2 h-4 w-4" />
              <span>Light Theme</span>
              {theme === "light" && (
                <span className="ml-auto text-xs text-primary">✓</span>
              )}
            </CommandItem>
            <CommandSeparator />
            <CommandItem
              onSelect={() => handleSelect(handleTogglePowerUser)}
            >
              <Zap className="mr-2 h-4 w-4" />
              <span>
                {powerUserMode ? "Disable" : "Enable"} Power User Mode
              </span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(handleToggleSidebar)}
            >
              <PanelLeftClose className="mr-2 h-4 w-4" />
              <span>Toggle Sidebar</span>
            </CommandItem>
          </CommandGroup>
        )}

        {/* ═══ SETTINGS PAGE ═══ */}
        {page === "settings" && (
          <CommandGroup heading="Settings">
            <CommandItem
              onSelect={() =>
                handleSelect(() => navigate({ to: "/you" }))
              }
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Profile & Preferences</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                handleSelect(() => navigate({ to: "/settings" }))
              }
            >
              <Cog className="mr-2 h-4 w-4" />
              <span>Gateway Configuration</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                handleSelect(() => navigate({ to: "/nodes" }))
              }
            >
              <Monitor className="mr-2 h-4 w-4" />
              <span>Nodes & Devices</span>
            </CommandItem>
            {onShowShortcuts && (
              <CommandItem
                onSelect={() => handleSelect(onShowShortcuts)}
              >
                <Keyboard className="mr-2 h-4 w-4" />
                <span>Keyboard Shortcuts</span>
              </CommandItem>
            )}
            <CommandItem
              onSelect={() => handleSelect(handleTogglePowerUser)}
            >
              <Zap className="mr-2 h-4 w-4" />
              <span>
                {powerUserMode ? "Disable" : "Enable"} Power User Mode
              </span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export default CommandPalette;
