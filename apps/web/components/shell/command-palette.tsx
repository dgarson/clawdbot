"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useUiStore } from "@/lib/stores/ui";
import { useGatewayStore } from "@/lib/stores/gateway";
import { useProficiency, useProficiencyStore } from "@/lib/stores/proficiency";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Clock,
  Zap,
  Link2,
  Smartphone,
  BarChart3,
  Settings,
  Plus,
  Search,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Gauge,
  Shield,
  Command,
  CornerDownLeft,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  section: string;
  keywords?: string[];
  action: () => void;
  minLevel?: "beginner" | "standard" | "expert";
};

// (CommandItem type handles all variants via optional minLevel)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setTheme = useUiStore((s) => s.setTheme);
  const { isAtLeast } = useProficiency();
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Keyboard shortcut to open
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      // Escape handled by Radix Dialog
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  // Build command list
  const commands = React.useMemo<CommandItem[]>(() => {
    const nav = (label: string, href: string, icon: typeof LayoutDashboard, desc?: string, minLevel?: "beginner" | "standard" | "expert"): CommandItem => ({
      id: `nav-${href}`,
      label,
      description: desc ?? `Go to ${label}`,
      icon,
      section: "Navigation",
      keywords: [href.replace("/", "")],
      action: () => { router.push(href); setOpen(false); },
      minLevel,
    });

    const all: CommandItem[] = [
      // Navigation
      nav("Dashboard", "/dashboard", LayoutDashboard, "Overview and quick stats"),
      nav("Agents", "/agents", Bot, "View all agents"),
      nav("Chat", "/chat", MessageSquare, "Chat with agents"),
      nav("Automations", "/cron", Clock, "Scheduled jobs & cron", "standard"),
      nav("Skills", "/skills", Zap, "Browse skill marketplace", "standard"),
      nav("Channels", "/channels", Link2, "Messaging channels", "standard"),
      nav("Nodes", "/nodes", Smartphone, "Connected devices", "standard"),
      nav("Templates", "/templates", Bot, "Browse agent templates"),
      nav("Sessions", "/sessions", BarChart3, "Session management", "expert"),
      nav("Analytics", "/analytics", BarChart3, "Usage analytics", "standard"),
      nav("Onboarding", "/onboarding", Sparkles, "Re-run setup wizard"),
      nav("Settings", "/settings", Settings, "App configuration"),

      // Actions
      {
        id: "action-new-agent",
        label: "Create New Agent",
        description: "Start the agent builder wizard",
        icon: Plus,
        section: "Actions",
        keywords: ["new", "create", "add", "agent", "build"],
        action: () => { router.push("/agents/new"); setOpen(false); },
      },

      // Theme
      {
        id: "theme-light",
        label: "Switch to Light Mode",
        icon: Sun,
        section: "Appearance",
        keywords: ["theme", "light", "bright"],
        action: () => { setTheme("light"); setOpen(false); },
      },
      {
        id: "theme-dark",
        label: "Switch to Dark Mode",
        icon: Moon,
        section: "Appearance",
        keywords: ["theme", "dark", "night"],
        action: () => { setTheme("dark"); setOpen(false); },
      },
      {
        id: "theme-system",
        label: "Use System Theme",
        icon: Monitor,
        section: "Appearance",
        keywords: ["theme", "system", "auto"],
        action: () => { setTheme("system"); setOpen(false); },
      },

      // Proficiency
      {
        id: "prof-beginner",
        label: "Simple Mode",
        description: "Minimal options, guided experience",
        icon: Sparkles,
        section: "Interface",
        keywords: ["proficiency", "simple", "beginner", "easy"],
        action: () => {
          useProficiencyStore.getState().setLevel("beginner");
          setOpen(false);
        },
      },
      {
        id: "prof-standard",
        label: "Standard Mode",
        description: "Balanced feature set",
        icon: Gauge,
        section: "Interface",
        keywords: ["proficiency", "standard", "normal"],
        action: () => {
          useProficiencyStore.getState().setLevel("standard");
          setOpen(false);
        },
      },
      {
        id: "prof-expert",
        label: "Expert Mode",
        description: "Full access, dense layouts",
        icon: Shield,
        section: "Interface",
        keywords: ["proficiency", "expert", "advanced", "power"],
        action: () => {
          useProficiencyStore.getState().setLevel("expert");
          setOpen(false);
        },
      },
    ];

    return all.filter((cmd) => !cmd.minLevel || isAtLeast(cmd.minLevel));
  }, [router, setOpen, setTheme, isAtLeast]);

  // Filter commands
  const filtered = React.useMemo(() => {
    if (!query.trim()) {return commands;}
    const q = query.toLowerCase();
    return commands.filter((cmd) => {
      return (
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.keywords?.some((kw) => kw.includes(q))
      );
    });
  }, [commands, query]);

  // Group by section
  const grouped = React.useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.section) ?? [];
      arr.push(item);
      map.set(item.section, arr);
    }
    return map;
  }, [filtered]);

  // Reset selection on query change
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
        break;
    }
  };

  // Scroll selected into view
  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  let flatIndex = -1;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-card shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Dialog.Title className="sr-only">Command palette</Dialog.Title>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              esc
            </kbd>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-[320px] overflow-y-auto overscroll-contain py-2"
          >
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No results for &ldquo;{query}&rdquo;
                </p>
              </div>
            ) : (
              Array.from(grouped.entries()).map(([section, items]) => (
                <div key={section}>
                  <div className="px-4 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {section}
                    </p>
                  </div>
                  {items.map((item) => {
                    flatIndex++;
                    const idx = flatIndex;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={() => item.action()}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                          isSelected
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-accent/50"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{item.label}</span>
                          {item.description && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <CornerDownLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono">esc</kbd>
                close
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Command className="h-3 w-3" />
              <span>K</span>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
