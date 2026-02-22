import React, { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "./lib/utils";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";
import {
  DashboardSkeleton,
  TableSkeleton,
  CardGridSkeleton,
  ChatSkeleton,
  ContentSkeleton,
} from "./components/Skeleton";
import { ToastProvider, useToast } from "./components/Toast";
import { ProficiencyProvider, useProficiency } from "./stores/proficiencyStore";
import ProficiencyBadge from "./components/ProficiencyBadge";

// Component prop types
interface ChatInterfaceProps {
  agentId?: string;
  agentName?: string;
  agentEmoji?: string;
}

interface AgentSoulEditorProps {
  agentName?: string;
  agentEmoji?: string;
}

// Lazy-load all views with proper typing
const AgentDashboard = React.lazy(() => import("./views/AgentDashboard"));
const AgentBuilderWizard = React.lazy(() => import("./views/AgentBuilderWizard"));
const AgentSoulEditor = React.lazy<React.ComponentType<AgentSoulEditorProps>>(() => import("./views/AgentSoulEditor"));
const AgentIdentityCard = React.lazy(() => import("./views/AgentIdentityCard"));
const ModelSelector = React.lazy(() => import("./views/ModelSelector"));
const ChatInterface = React.lazy<React.ComponentType<ChatInterfaceProps>>(() => import("./views/ChatInterface"));
const CronScheduleBuilder = React.lazy(() => import("./views/CronScheduleBuilder"));
const SkillsMarketplace = React.lazy(() => import("./views/SkillsMarketplace"));
const SessionExplorer = React.lazy(() => import("./views/SessionExplorer"));
const OnboardingFlow = React.lazy(() => import("./views/OnboardingFlow"));
const AgentConfigReview = React.lazy(() => import("./views/AgentConfigReview"));
const SettingsDashboard = React.lazy(() => import("./views/SettingsDashboard"));
const NodeManager = React.lazy(() => import("./views/NodeManager"));
const UsageDashboard = React.lazy(() => import("./views/UsageDashboard"));
const WorkspaceFileBrowser = React.lazy(() => import("./views/WorkspaceFileBrowser"));
const ProviderAuthManager = React.lazy(() => import("./views/ProviderAuthManager"));
const AgentPulseMonitor = React.lazy(() => import("./views/AgentPulseMonitor"));
const NotificationCenter = React.lazy(() => import("./views/NotificationCenter"));
const ApiKeysManager = React.lazy(() => import("./views/ApiKeysManager"));
const AuditLog = React.lazy(() => import("./views/AuditLog"));
const BillingSubscription = React.lazy(() => import("./views/BillingSubscription"));

export const navItems = [
  { id: "dashboard",     label: "Dashboard",     emoji: "📊", shortcut: "1" },
  { id: "chat",          label: "Chat",           emoji: "💬", shortcut: "2" },
  { id: "builder",       label: "Agent Builder",  emoji: "🔧", shortcut: "3" },
  { id: "soul-editor",   label: "Soul Editor",    emoji: "✨", shortcut: "4" },
  { id: "identity",      label: "Identity Cards", emoji: "🪪", shortcut: "5" },
  { id: "models",        label: "Models",         emoji: "🤖", shortcut: "6" },
  { id: "providers",     label: "Providers",      emoji: "🔐", shortcut: "7" },
  { id: "cron",          label: "Schedules",      emoji: "⏰", shortcut: "8" },
  { id: "skills",        label: "Skills",         emoji: "🧩", shortcut: "9" },
  { id: "sessions",      label: "Sessions",       emoji: "🌳", shortcut: null },
  { id: "config-review", label: "Config Review",  emoji: "🔍", shortcut: null },
  { id: "settings",      label: "Settings",       emoji: "⚙️", shortcut: null },
  { id: "nodes",         label: "Nodes",          emoji: "📱", shortcut: null },
  { id: "usage",         label: "Usage & Costs",  emoji: "📈", shortcut: null },
  { id: "files",         label: "Files",          emoji: "📁", shortcut: null },
  { id: "onboarding",    label: "Onboarding",     emoji: "🚀", shortcut: null },
  { id: "pulse",         label: "Agent Pulse",    emoji: "📡", shortcut: null },
  { id: "notifications", label: "Notifications",  emoji: "🔔", shortcut: null },
  { id: "api-keys",      label: "API & Integrations", emoji: "🗝️", shortcut: null },
  { id: "audit-log",    label: "Audit Log",          emoji: "🔎", shortcut: null },
  { id: "billing",      label: "Billing",            emoji: "💳", shortcut: null },
];

const SKELETON_MAP: Record<string, React.ReactNode> = {
  dashboard:     <DashboardSkeleton />,
  chat:          <ChatSkeleton />,
  sessions:      <TableSkeleton rows={8} />,
  nodes:         <TableSkeleton rows={6} />,
  usage:         <DashboardSkeleton />,
  skills:        <CardGridSkeleton count={9} />,
  identity:      <CardGridSkeleton count={6} />,
  models:        <CardGridSkeleton count={6} />,
  builders:      <ContentSkeleton />,
  settings:      <ContentSkeleton />,
  files:         <ContentSkeleton />,
  providers:     <ContentSkeleton />,
  cron:          <TableSkeleton rows={5} />,
  "soul-editor": <ContentSkeleton />,
  "config-review": <ContentSkeleton />,
  onboarding:    <ContentSkeleton />,
  pulse:         <DashboardSkeleton />,
  notifications: <TableSkeleton rows={8} />,
  "api-keys":    <TableSkeleton rows={6} />,
  "audit-log":   <TableSkeleton rows={10} />,
  "billing":     <ContentSkeleton />,
};

function LoadingFallback({ viewId }: { viewId: string }) {
  const skeleton = SKELETON_MAP[viewId];
  if (skeleton) {
    return <div className="p-6 max-w-7xl mx-auto">{skeleton}</div>;
  }
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-pulse-soft text-muted-foreground text-sm">Loading...</div>
    </div>
  );
}

// Error boundary for views
class ViewErrorBoundary extends React.Component<
  { children: React.ReactNode; viewId: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; viewId: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
          <div className="text-4xl">⚠️</div>
          <p className="text-sm">Something went wrong loading this view.</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ProficiencyProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ProficiencyProvider>
  );
}

function AppContent() {
  const [activeView, setActiveView] = useState("dashboard");
  const [navHistory, setNavHistory] = useState<string[]>(["dashboard"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { visitView, recordInteraction } = useProficiency();

  const currentNav = navItems.find((n) => n.id === activeView) ?? navItems[0];
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < navHistory.length - 1;

  // Navigate and update history + recents
  const navigate = useCallback((viewId: string, pushHistory = true) => {
    setActiveView(viewId);
    setMobileSidebarOpen(false);
    setCmdPaletteOpen(false);
    setSearchQuery("");
    visitView(viewId);
    recordInteraction();

    if (pushHistory) {
      setNavHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        // Don't push if same as current
        if (trimmed[trimmed.length - 1] === viewId) return prev;
        return [...trimmed, viewId];
      });
      setHistoryIndex((i) => {
        const trimmed = navHistory.slice(0, i + 1);
        if (trimmed[trimmed.length - 1] === viewId) return i;
        return i + 1;
      });
    }

    // Track recents
    try {
      const recents: string[] = JSON.parse(localStorage.getItem("oc_recent_views") ?? "[]");
      const updated = [viewId, ...recents.filter((r) => r !== viewId)].slice(0, 5);
      localStorage.setItem("oc_recent_views", JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, [historyIndex, navHistory, visitView, recordInteraction]);

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setActiveView(navHistory[newIndex]);
  }, [canGoBack, historyIndex, navHistory]);

  const goForward = useCallback(() => {
    if (!canGoForward) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setActiveView(navHistory[newIndex]);
  }, [canGoForward, historyIndex, navHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      // Cmd+K / Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
        setSearchQuery("");
        setHighlightedIndex(0);
        return;
      }

      // Escape — close in priority order
      if (e.key === "Escape") {
        if (cmdPaletteOpen) { setCmdPaletteOpen(false); return; }
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (mobileSidebarOpen) { setMobileSidebarOpen(false); return; }
      }

      if (isInput || cmdPaletteOpen || shortcutsOpen) return;

      // ? — keyboard shortcuts help
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // Alt+← / Alt+→ — back/forward navigation
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        if (e.key === "ArrowLeft") { e.preventDefault(); goBack(); return; }
        if (e.key === "ArrowRight") { e.preventDefault(); goForward(); return; }

        // Alt+1–9 for quick nav
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
          const item = navItems.find((n) => n.shortcut === String(num));
          if (item) { e.preventDefault(); navigate(item.id); }
        }
      }

      // [ / ] — collapse/expand sidebar
      if (e.key === "[" || e.key === "]") {
        setSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cmdPaletteOpen, shortcutsOpen, mobileSidebarOpen, navigate, goBack, goForward]);

  // Focus search when palette opens
  useEffect(() => {
    if (cmdPaletteOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [cmdPaletteOpen]);

  // Filtered commands for palette
  const filteredNav = navItems.filter(
    (n) =>
      searchQuery === "" ||
      n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.id.includes(searchQuery.toLowerCase())
  );

  const recentIds: string[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("oc_recent_views") ?? "[]");
    } catch {
      return [];
    }
  })();
  const recentItems = recentIds
    .map((id) => navItems.find((n) => n.id === id))
    .filter(Boolean)
    .slice(0, 3) as typeof navItems;

  const allPaletteItems = searchQuery
    ? filteredNav
    : [...(recentItems.length ? recentItems : []), ...navItems.filter((n) => !recentIds.includes(n.id))];

  // Palette keyboard nav
  const handlePaletteKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, allPaletteItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const item = allPaletteItems[highlightedIndex];
      if (item) navigate(item.id);
    }
  };

  const renderView = () => {
    switch (activeView) {
      case "dashboard":     return <AgentDashboard />;
      case "chat":          return <ChatInterface agentName="Luis" agentEmoji="🎨" />;
      case "builder":       return <AgentBuilderWizard />;
      case "soul-editor":   return <AgentSoulEditor agentName="Luis" agentEmoji="🎨" />;
      case "identity":      return <AgentIdentityCard />;
      case "models":        return <ModelSelector />;
      case "providers":     return <ProviderAuthManager />;
      case "cron":          return <CronScheduleBuilder />;
      case "skills":        return <SkillsMarketplace />;
      case "sessions":      return <SessionExplorer />;
      case "config-review": return <AgentConfigReview />;
      case "settings":      return <SettingsDashboard />;
      case "nodes":         return <NodeManager />;
      case "usage":         return <UsageDashboard />;
      case "files":         return <WorkspaceFileBrowser />;
      case "onboarding":    return <OnboardingFlow />;
      case "pulse":         return <AgentPulseMonitor />;
      case "notifications": return <NotificationCenter />;
      case "api-keys":      return <ApiKeysManager />;
      case "audit-log":     return <AuditLog />;
      case "billing":       return <BillingSubscription />;
      default:              return <AgentDashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-300 z-40",
          // Desktop: collapsible width
          "hidden md:flex",
          sidebarCollapsed ? "w-16" : "w-56",
          // Mobile: slide-in overlay
          mobileSidebarOpen && "flex fixed inset-y-0 left-0 w-64 shadow-2xl"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-xl hover:opacity-80 transition-opacity"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar (])" : "Collapse sidebar ([)"}
          >
            🐾
          </button>
          {!sidebarCollapsed && (
            <span className="font-bold text-lg text-foreground">OpenClaw</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                activeView === item.id
                  ? "bg-primary/10 text-primary border-r-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
              aria-current={activeView === item.id ? "page" : undefined}
              title={
                item.shortcut
                  ? `${item.label} (Alt+${item.shortcut})`
                  : item.label
              }
            >
              <span className="text-base" aria-hidden="true">{item.emoji}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
              {!sidebarCollapsed && item.shortcut && (
                <span className="ml-auto text-xs text-muted-foreground/50 font-mono">
                  ⌥{item.shortcut}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border flex flex-col gap-2">
          {/* Proficiency Level Badge */}
          {!sidebarCollapsed && <ProficiencyBadge />}
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">v0.1.0</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShortcutsOpen(true)}
                  className="text-xs text-muted-foreground/50 font-mono bg-secondary/50 px-1.5 py-0.5 rounded border border-border hover:text-muted-foreground hover:bg-secondary transition-colors"
                  aria-label="Show keyboard shortcuts"
                  title="Keyboard shortcuts (?)"
                >
                  ?
                </button>
                <button
                  onClick={() => setCmdPaletteOpen(true)}
                  className="text-xs text-muted-foreground/50 font-mono bg-secondary/50 px-1.5 py-0.5 rounded border border-border hover:text-muted-foreground hover:bg-secondary transition-colors"
                  aria-label="Open command palette"
                  title="Open command palette (⌘K)"
                >
                  ⌘K
                </button>
                <button
                  onClick={() => toast({ message: 'Hello from OpenClaw!', type: 'success' })}
                  className="text-xs text-muted-foreground/50 bg-secondary/50 px-1.5 py-0.5 rounded border border-border hover:text-muted-foreground hover:bg-secondary transition-colors"
                  aria-label="Test Toast"
                  title="Test Toast"
                >
                  ✨
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setCmdPaletteOpen(true)}
                className="text-xs text-muted-foreground/50 font-mono"
                aria-label="Open command palette"
                title="Open command palette (⌘K)"
              >
                ⌘
              </button>
              <button
                onClick={() => setShortcutsOpen(true)}
                className="text-xs text-muted-foreground/50 font-mono"
                aria-label="Show keyboard shortcuts"
                title="Keyboard shortcuts (?)"
              >
                ?
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile sidebar (separate element for overlay) */}
      {mobileSidebarOpen && (
        <aside
          role="navigation"
          aria-label="Main navigation"
          className="flex flex-col fixed inset-y-0 left-0 w-64 border-r border-border bg-card z-40 shadow-2xl md:hidden"
        >
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <span className="text-xl">🐾</span>
            <span className="font-bold text-lg text-foreground">OpenClaw</span>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="ml-auto text-muted-foreground hover:text-foreground"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                  activeView === item.id
                    ? "bg-primary/10 text-primary border-r-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
                aria-current={activeView === item.id ? "page" : undefined}
              >
                <span className="text-base" aria-hidden="true">{item.emoji}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <rect y="2" width="18" height="2" rx="1" />
              <rect y="8" width="18" height="2" rx="1" />
              <rect y="14" width="18" height="2" rx="1" />
            </svg>
          </button>

          {/* Back / Forward */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={goBack}
              disabled={!canGoBack}
              className={cn(
                "p-1.5 rounded-md text-sm transition-colors",
                canGoBack
                  ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  : "text-muted-foreground/20 cursor-not-allowed"
              )}
              aria-label="Go back (Alt+←)"
              title="Go back (Alt+←)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2L4 7l5 5" />
              </svg>
            </button>
            <button
              onClick={goForward}
              disabled={!canGoForward}
              className={cn(
                "p-1.5 rounded-md text-sm transition-colors",
                canGoForward
                  ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  : "text-muted-foreground/20 cursor-not-allowed"
              )}
              aria-label="Go forward (Alt+→)"
              title="Go forward (Alt+→)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 2l5 5-5 5" />
              </svg>
            </button>
          </div>

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground/50">OpenClaw</span>
            <span className="text-muted-foreground/30">/</span>
            <span className="text-foreground font-medium flex items-center gap-1.5">
              <span aria-hidden="true">{currentNav.emoji}</span>
              {currentNav.label}
            </span>
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search trigger */}
          <button
            onClick={() => setCmdPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-secondary/50 border border-border rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Open command palette"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="5.5" cy="5.5" r="4" />
              <path d="m9 9 2.5 2.5" strokeLinecap="round" />
            </svg>
            <span>Search...</span>
            <span className="font-mono bg-background/60 px-1 py-0.5 rounded text-[10px]">⌘K</span>
          </button>
        </header>

        {/* Skip nav link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
        >
          Skip to main content
        </a>

        {/* View content */}
        <main id="main-content" className="flex-1 overflow-y-auto" role="main">
          <ViewErrorBoundary viewId={activeView}>
            <React.Suspense fallback={<LoadingFallback viewId={activeView} />}>
              <div key={activeView} className="p-6 max-w-7xl mx-auto animate-slide-in">
                {renderView()}
              </div>
            </React.Suspense>
          </ViewErrorBoundary>
        </main>
      </div>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Command Palette */}
      {cmdPaletteOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setCmdPaletteOpen(false)}
            aria-hidden="true"
          />

          {/* Palette modal */}
          <div
            role="dialog"
            aria-label="Command palette"
            aria-modal="true"
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg animate-slide-in"
          >
            <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-muted-foreground shrink-0"
                  aria-hidden="true"
                >
                  <circle cx="6.5" cy="6.5" r="5" />
                  <path d="m11 11 3 3" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search views and commands..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handlePaletteKey}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  aria-autocomplete="list"
                  aria-controls="palette-results"
                  autoComplete="off"
                />
                <kbd className="text-[10px] text-muted-foreground/50 font-mono bg-secondary/60 px-1.5 py-0.5 rounded border border-border">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div
                id="palette-results"
                role="listbox"
                className="max-h-80 overflow-y-auto py-1"
              >
                {allPaletteItems.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No results for "{searchQuery}"
                  </p>
                ) : (
                  <>
                    {!searchQuery && recentItems.length > 0 && (
                      <div className="px-3 pt-2 pb-1">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
                          Recent
                        </span>
                      </div>
                    )}
                    {allPaletteItems.map((item, idx) => {
                      const isRecent = !searchQuery && idx < recentItems.length;
                      const showNavHeader =
                        !searchQuery &&
                        recentItems.length > 0 &&
                        idx === recentItems.length;
                      return (
                        <React.Fragment key={item.id}>
                          {showNavHeader && (
                            <div className="px-3 pt-3 pb-1 border-t border-border mt-1">
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
                                Navigation
                              </span>
                            </div>
                          )}
                          <button
                            role="option"
                            aria-selected={idx === highlightedIndex}
                            onClick={() => navigate(item.id)}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors cursor-pointer",
                              idx === highlightedIndex
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-secondary/50"
                            )}
                          >
                            <span className="text-base w-6 text-center" aria-hidden="true">
                              {item.emoji}
                            </span>
                            <span className="flex-1 text-left">{item.label}</span>
                            {isRecent && (
                              <span className="text-[10px] text-muted-foreground/40">Recent</span>
                            )}
                            {item.shortcut && (
                              <kbd className="text-[10px] text-muted-foreground/50 font-mono bg-secondary/60 px-1.5 py-0.5 rounded">
                                ⌥{item.shortcut}
                              </kbd>
                            )}
                            {item.id === activeView && (
                              <span className="text-[10px] text-muted-foreground/40">Current</span>
                            )}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-secondary/20">
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <kbd className="font-mono">↑↓</kbd> navigate
                </span>
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <kbd className="font-mono">↵</kbd> open
                </span>
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <kbd className="font-mono">ESC</kbd> close
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
