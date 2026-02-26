import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";
import { Search, X } from "lucide-react";

interface CommandPaletteProps {
  onNavigate: (viewId: string) => void;
  currentView: string;
}

interface NavItem {
  id: string;
  label: string;
  emoji: string;
}

interface Action {
  id: string;
  label: string;
  emoji: string;
  action: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", emoji: "📊" },
  { id: "chat", label: "Chat", emoji: "💬" },
  { id: "builder", label: "Agent Builder", emoji: "🔧" },
  { id: "soul-editor", label: "Soul Editor", emoji: "✨" },
  { id: "identity", label: "Identity Cards", emoji: "🪪" },
  { id: "models", label: "Models", emoji: "🤖" },
  { id: "providers", label: "Providers", emoji: "🔐" },
  { id: "cron", label: "Schedules", emoji: "⏰" },
  { id: "skills", label: "Skills", emoji: "🧩" },
  { id: "sessions", label: "Sessions", emoji: "🌳" },
  { id: "config-review", label: "Config Review", emoji: "🔍" },
  { id: "settings", label: "Settings", emoji: "⚙️" },
  { id: "nodes", label: "Nodes", emoji: "📱" },
  { id: "usage", label: "Usage & Costs", emoji: "📈" },
  { id: "files", label: "Files", emoji: "📁" },
  { id: "onboarding", label: "Onboarding", emoji: "🚀" },
];

const ACTIONS: Action[] = [
  { id: "new-agent", label: "New Agent", emoji: "🆕", action: () => {} },
  { id: "new-schedule", label: "New Schedule", emoji: "📅", action: () => {} },
  { id: "open-settings", label: "Open Settings", emoji: "⚙️", action: () => {} },
  { id: "view-usage", label: "View Usage", emoji: "📊", action: () => {} },
];

const RECENT_STORAGE_KEY = "openclaw-command-palette-recent";

function getRecentViews(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentViews(viewIds: string[]) {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(viewIds));
  } catch {
    // Ignore storage errors
  }
}

export default function CommandPalette({ onNavigate, currentView }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentViews, setRecentViews] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Initialize recent views
  useEffect(() => {
    setRecentViews(getRecentViews());
  }, []);

  // Track current view in recent (skip if already first)
  useEffect(() => {
    if (!currentView) return;
    
    const updated = [currentView, ...recentViews.filter(v => v !== currentView)].slice(0, 3);
    setRecentViews(updated);
    saveRecentViews(updated);
  }, [currentView]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }

    const flatItems = getFilteredItems(search);
    const itemCount = flatItems.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % itemCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + itemCount) % itemCount);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) {
        handleSelect(item);
      }
    }
  }, [search, selectedIndex]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Scroll selected item into view
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    
    const selected = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleSelect = (item: NavItem | Action): void => {
    if ("action" in item && item.action) {
      item.action();
    }
    if ("id" in item) {
      onNavigate(item.id);
    }
    setIsOpen(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  // Build filtered items
  const getFilteredItems = (query: string): (NavItem | Action)[] => {
    const q = query.toLowerCase().trim();
    
    // Recent views
    const recent = recentViews
      .map(id => NAV_ITEMS.find(n => n.id === id))
      .filter((n): n is NavItem => n !== undefined);
    
    // Navigation items
    const navResults = NAV_ITEMS.filter(
      item => !q || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
    );
    
    // Actions
    const actionResults = ACTIONS.filter(
      item => !q || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
    );

    return [...recent, ...navResults, ...actionResults];
  };

  const filteredItems = useMemo(() => getFilteredItems(search), [search, recentViews]);

  // Determine group boundaries for rendering
  const recentCount = recentViews.length;
  const navCount = NAV_ITEMS.filter(
    item => !search || item.label.toLowerCase().includes(search) || item.id.toLowerCase().includes(search)
  ).length;
  const actionCount = ACTIONS.filter(
    item => !search || item.label.toLowerCase().includes(search) || item.id.toLowerCase().includes(search)
  ).length;

  const getItemGroup = (index: number): "recent" | "navigation" | "actions" => {
    if (search) {
      // In search mode, group based on type
      if (index < recentViews.length) return "recent";
      const navFilteredCount = NAV_ITEMS.filter(
        item => !search || item.label.toLowerCase().includes(search) || item.id.toLowerCase().includes(search)
      ).length;
      if (index < recentViews.length + navFilteredCount) return "navigation";
      return "actions";
    }
    
    if (index < recentCount) return "recent";
    if (index < recentCount + navCount) return "navigation";
    return "actions";
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {/* Recent Views */}
          {recentViews.length > 0 && !search && (
            <div className="mb-2">
              <div className="px-4 py-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                Recent
              </div>
              {recentViews.map((viewId, idx) => {
                const item = NAV_ITEMS.find(n => n.id === viewId);
                if (!item) return null;
                return (
                  <button
                    key={item.id}
                    data-index={idx}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      selectedIndex === idx
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <span className="text-base">{item.emoji}</span>
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Navigation */}
          {(() => {
            const navItems = NAV_ITEMS.filter(
              item => !search || item.label.toLowerCase().includes(search) || item.id.toLowerCase().includes(search)
            );
            
            if (navItems.length > 0) {
              return (
                <div className="mb-2">
                  {(search || recentViews.length === 0) && (
                    <div className="px-4 py-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                      Navigation
                    </div>
                  )}
                  {navItems.map((item, idx) => {
                    const actualIndex = recentViews.length + idx;
                    return (
                      <button
                        key={item.id}
                        data-index={actualIndex}
                        onClick={() => handleSelect(item)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          selectedIndex === actualIndex
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-secondary/50"
                        )}
                      >
                        <span className="text-base">{item.emoji}</span>
                        <span className="text-sm">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            }
            return null;
          })()}

          {/* Actions */}
          {(() => {
            const actionItems = ACTIONS.filter(
              item => !search || item.label.toLowerCase().includes(search) || item.id.toLowerCase().includes(search)
            );
            
            if (actionItems.length > 0) {
              const startIdx = recentViews.length + NAV_ITEMS.filter(
                item => !search || item.label.toLowerCase().includes(search) || item.id.toLowerCase().includes(search)
              ).length;
              
              return (
                <div>
                  <div className="px-4 py-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                    Actions
                  </div>
                  {actionItems.map((item, idx) => {
                    const actualIndex = startIdx + idx;
                    return (
                      <button
                        key={item.id}
                        data-index={actualIndex}
                        onClick={() => handleSelect(item)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          selectedIndex === actualIndex
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-secondary/50"
                        )}
                      >
                        <span className="text-base">{item.emoji}</span>
                        <span className="text-sm">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            }
            return null;
          })()}

          {/* Empty State */}
          {filteredItems.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No results found
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border flex items-center justify-end gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">↓</kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">↵</kbd>
            to select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">esc</kbd>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
