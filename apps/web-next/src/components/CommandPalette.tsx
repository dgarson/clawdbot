import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";
import { Search, X, Command as CommandIcon, Search as SearchIcon } from "lucide-react";
import { useCommandRegistry, Command } from "../stores/commandRegistry";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { commands } = useCommandRegistry();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter and group commands
  const filteredCommands = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) {return commands;}

    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(query) ||
      cmd.id.toLowerCase().includes(query) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(query))
    );
  }, [search, commands]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {groups[cmd.category] = [];}
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const sortedCategories = ['recent', 'navigation', 'actions', 'agents', 'search'];
  const flatCommands = useMemo(() => {
      const flat: Command[] = [];
      sortedCategories.forEach(cat => {
          if (groupedCommands[cat]) {
              flat.push(...groupedCommands[cat]);
          }
      });
      // Add any other categories not in the sorted list
      Object.keys(groupedCommands).forEach(cat => {
          if (!sortedCategories.includes(cat)) {
              flat.push(...groupedCommands[cat]);
          }
      });
      return flat;
  }, [groupedCommands]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    const itemCount = flatCommands.length;
    if (itemCount === 0) {return;}

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % itemCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + itemCount) % itemCount);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatCommands[selectedIndex];
      if (item) {
        item.action();
        onClose();
      }
    }
  }, [flatCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const container = listRef.current;
    if (!container) {return;}
    
    const selected = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) {return null;}

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <SearchIcon className="w-5 h-5 text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-white placeholder:text-gray-500 outline-none text-base"
          />
          <div className="flex items-center gap-1.5">
             <kbd className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-[10px] font-mono border border-gray-700">ESC</kbd>
          </div>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {flatCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
               No commands found for "{search}"
            </div>
          ) : (
            <>
              {(() => {
                let currentIndex = 0;
                return sortedCategories.concat(Object.keys(groupedCommands).filter(c => !sortedCategories.includes(c))).map(category => {
                  const group = groupedCommands[category];
                  if (!group || group.length === 0) {return null;}
                  
                  return (
                    <div key={category} className="mb-2 last:mb-0">
                      <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider font-bold text-gray-500">
                        {category}
                      </div>
                      {group.map((cmd) => {
                        const isSelected = currentIndex === selectedIndex;
                        const index = currentIndex++;
                        return (
                          <button
                            key={cmd.id}
                            data-index={index}
                            onClick={() => {
                                cmd.action();
                                onClose();
                            }}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                              isSelected
                                ? "bg-violet-600/20 text-violet-400"
                                : "text-gray-300 hover:bg-gray-800 hover:text-white"
                            )}
                          >
                            <span className="text-base w-5 text-center">{cmd.emoji || '•'}</span>
                            <span className="flex-1 text-sm">{cmd.label}</span>
                            {cmd.shortcut && (
                                <kbd className="text-[10px] text-gray-500 font-mono bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
                                    {cmd.shortcut}
                                </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </>
          )}
        </div>

        {/* NL Action Stub / Footer */}
        <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between">
           <div className="flex items-center gap-2 text-xs text-gray-500">
                <CommandIcon className="w-3 h-3" />
                <span>Type natural language for actions (e.g. "create agent...")</span>
           </div>
           <div className="flex items-center gap-3 text-[10px] text-gray-600 font-medium">
                <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded">↑↓</kbd> Nav</span>
                <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded">↵</kbd> Select</span>
           </div>
        </div>
      </div>
    </div>
  );
}
