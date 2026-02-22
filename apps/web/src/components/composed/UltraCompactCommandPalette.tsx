
import * as React from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Command, Search, X } from "lucide-react";

export interface CommandCategory {
  name: string;
  icon?: React.ElementType;
}

export interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  category: string;
  icon: React.ElementType;
  shortcut?: string;
  keywords?: string[];
  badge?: number | string | null;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  hasSubmenu?: boolean;
}

export interface UltraCompactCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Record<string, CommandCategory>;
  commands: PaletteCommand[];
  recentCommandIds?: string[];
  onExecute?: (command: PaletteCommand) => void;
  maxRecent?: number;
  className?: string;
}

type Group = {
  id: string;
  name: string;
  icon?: React.ElementType;
  commands: PaletteCommand[];
};

export function UltraCompactCommandPalette({
  open,
  onOpenChange,
  categories,
  commands,
  recentCommandIds = [],
  onExecute,
  maxRecent = 3,
  className,
}: UltraCompactCommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const recentSet = React.useMemo(() => new Set(recentCommandIds), [recentCommandIds]);

  const filteredCommands = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands.filter((cmd) => {
      if (cmd.disabled) {return false;}
      if (activeCategory && cmd.category !== activeCategory) {return false;}
      if (!q) {return true;}
      if (cmd.label.toLowerCase().includes(q)) {return true;}
      if (cmd.description?.toLowerCase().includes(q)) {return true;}
      if (cmd.keywords?.some((k) => k.toLowerCase().includes(q))) {return true;}
      if (cmd.shortcut?.toLowerCase() === q) {return true;}
      return false;
    });
  }, [commands, query, activeCategory]);

  const groupedCommands: Group[] = React.useMemo(() => {
    const isSearching = query.trim() !== "";
    const isFiltering = activeCategory !== null;
    const showRecent = !isSearching && !isFiltering && recentCommandIds.length > 0;

    const groups: Group[] = [];

    if (showRecent) {
      const recent = recentCommandIds
        .map((id) => commands.find((c) => c.id === id))
        .filter((c): c is PaletteCommand => Boolean(c))
        .filter((c) => !c.disabled)
        .slice(0, maxRecent);
      if (recent.length > 0) {
        groups.push({ id: "recent", name: "Recent", icon: undefined, commands: recent });
      }
    }

    const presentCategories = Array.from(new Set(filteredCommands.map((c) => c.category)));
    for (const catId of presentCategories) {
      const meta = categories[catId];
      let catCommands = filteredCommands.filter((c) => c.category === catId);
      if (showRecent) {catCommands = catCommands.filter((c) => !recentSet.has(c.id));}
      if (catCommands.length === 0) {continue;}
      groups.push({
        id: catId,
        name: meta?.name ?? catId,
        icon: meta?.icon,
        commands: catCommands,
      });
    }

    return groups;
  }, [query, activeCategory, recentCommandIds, maxRecent, commands, filteredCommands, categories, recentSet]);

  const flatCommands = React.useMemo(
    () => groupedCommands.flatMap((g) => g.commands),
    [groupedCommands]
  );

  const execute = React.useCallback(
    (cmd: PaletteCommand) => {
      onExecute?.(cmd);
      if (!cmd.hasSubmenu) {onOpenChange(false);}
    },
    [onExecute, onOpenChange]
  );

  React.useEffect(() => {
    if (!open) {return;}
    setQuery("");
    setSelectedIndex(0);
    setActiveCategory(null);
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  React.useEffect(() => {
    const selectedEl = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`
    );
    selectedEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {return;}

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, Math.max(flatCommands.length - 1, 0)));
          return;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          return;
        case "Enter":
          e.preventDefault();
          if (flatCommands[selectedIndex]) {execute(flatCommands[selectedIndex]);}
          return;
        case "Escape":
          e.preventDefault();
          onOpenChange(false);
          return;
        case "Tab": {
          e.preventDefault();
          const catIds = [null, ...Object.keys(categories)];
          const current = catIds.indexOf(activeCategory);
          const next = e.shiftKey
            ? current <= 0
              ? catIds.length - 1
              : current - 1
            : current >= catIds.length - 1
              ? 0
              : current + 1;
          setActiveCategory(catIds[next]);
          return;
        }
        default: {
          const isSingleKey = e.key.length === 1;
          const hasModifiers = e.ctrlKey || e.metaKey || e.altKey;
          if (isSingleKey && !hasModifiers && query.trim() === "") {
            const cmd = flatCommands.find(
              (c) => c.shortcut?.toLowerCase() === e.key.toLowerCase()
            );
            if (cmd) {
              e.preventDefault();
              execute(cmd);
            }
          }
        }
      }
    },
    [open, flatCommands, selectedIndex, activeCategory, categories, query, execute, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "top-[15vh] translate-y-0 p-0 sm:max-w-md",
          "bg-card text-foreground border-border overflow-hidden",
          className
        )}
        onKeyDown={onKeyDown}
      >
        {/* Search */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Command className="size-3.5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          ) : null}
          <kbd className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
            esc
          </kbd>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 border-b border-border px-2 py-1 overflow-x-auto scrollbar-thin">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap",
              !activeCategory
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            All
          </button>
          {Object.entries(categories).map(([id, cat]) => {
            const Icon = cat.icon;
            const isActive = activeCategory === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveCategory(isActive ? null : id)}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                {Icon ? <Icon className="size-3" /> : null}
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div ref={listRef} className="max-h-[280px] overflow-y-auto scrollbar-thin">
          {groupedCommands.length === 0 ? (
            <div className="px-3 py-5 text-center">
              <Search className="mx-auto mb-1 size-4 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground">No commands found</p>
            </div>
          ) : (
            groupedCommands.map((group) => (
              <div key={group.id}>
                <div className="sticky top-0 flex items-center gap-1 bg-card/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                  {group.icon ? <group.icon className="size-3" /> : null}
                  {group.name}
                  <span className="ml-auto text-muted-foreground">{group.commands.length}</span>
                </div>
                {group.commands.map((cmd) => {
                  const globalIndex = flatCommands.indexOf(cmd);
                  const isSelected = globalIndex === selectedIndex;
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      data-index={globalIndex}
                      onClick={() => execute(cmd)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={cn(
                        "flex w-full items-center gap-2 px-2 py-1 text-left transition-colors",
                        isSelected ? "bg-accent/60" : "hover:bg-secondary/50",
                        cmd.danger && "text-destructive"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-3 shrink-0",
                          cmd.active
                            ? "text-[color:var(--success)]"
                            : cmd.danger
                              ? "text-destructive"
                              : isSelected
                                ? "text-foreground"
                                : "text-muted-foreground"
                        )}
                      />

                      <span className="flex-1 truncate text-[11px] font-medium">
                        {cmd.label}
                      </span>

                      {cmd.badge != null ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          {cmd.badge}
                        </span>
                      ) : null}

                      {cmd.shortcut ? (
                        <kbd className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                          {cmd.shortcut}
                        </kbd>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-muted px-1 py-0.5 text-[9px]">↑↓</kbd>
              nav
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-muted px-1 py-0.5 text-[9px]">↵</kbd>
              run
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-muted px-1 py-0.5 text-[9px]">tab</kbd>
              filter
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {flatCommands.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
