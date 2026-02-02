// ============================================================================
// COMMAND PALETTE ULTRA COMPACT - TYPESCRIPT VERSION
// Ultra-compact command palette with recent commands, category filtering,
// keyboard shortcuts, and deduplication logic
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  Search, Command, X, Settings, Plus, Trash2, Copy, Save, Download, Upload, RefreshCw,
  Play, Pause, Square, Zap, Shield, ShieldOff, Eye, EyeOff,
  Folder, FolderOpen, File, FileText, Code, Terminal, Globe, Database,
  Sun, Moon, Palette, Layout, Layers, Grid3X3, List, Filter,
  ChevronRight, Hash, Clock, Star, Bookmark,
  MessageSquare, Send, Bot, User, Lock, Unlock,
  HelpCircle, Info, AlertTriangle, CheckCircle, XCircle,
  Keyboard, Sparkles, Wand2, History, RotateCcw, ExternalLink,
  Maximize2, Minimize2, PanelLeft, SplitSquareHorizontal,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Command category identifiers */
export type CommandCategoryId =
  | 'tools'
  | 'workflow'
  | 'permissions'
  | 'view'
  | 'navigation'
  | 'settings'
  | 'help';

/** Theme type */
export type ThemeType = 'dark' | 'light';

/** Command category configuration */
export interface CommandCategoryConfig {
  name: string;
  icon: LucideIcon;
  color: string;
}

/** Context for command generation */
export interface CommandContext {
  autoApprove?: boolean;
  pendingCount?: number;
  theme?: ThemeType;
}

/** Command definition */
export interface CommandDefinition {
  id: string;
  label: string;
  description?: string;
  category: CommandCategoryId;
  icon: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  active?: boolean;
  badge?: number | null;
  hasSubmenu?: boolean;
  danger?: boolean;
  action?: () => void;
}

/** Grouped commands for display */
export interface CommandGroup {
  category: string;
  name: string;
  icon?: LucideIcon;
  commands: CommandDefinition[];
}

/** Execution log entry */
export interface ExecutionLogEntry {
  id: string;
  time: string;
}

/** Command palette props */
export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  context?: CommandContext;
  onCommandExecute?: (commandId: string) => void;
  recentCommands?: string[];
}

/** Demo component props (empty) */
export interface CommandPaletteDemoProps {}

// ============================================================================
// CONSTANTS
// ============================================================================

const COMMAND_CATEGORIES: Record<CommandCategoryId, CommandCategoryConfig> = {
  tools: { name: 'Tools', icon: Wand2, color: 'purple' },
  workflow: { name: 'Workflow', icon: Play, color: 'green' },
  permissions: { name: 'Permissions', icon: Shield, color: 'amber' },
  view: { name: 'View', icon: Layout, color: 'blue' },
  navigation: { name: 'Navigation', icon: Folder, color: 'cyan' },
  settings: { name: 'Settings', icon: Settings, color: 'gray' },
  help: { name: 'Help', icon: HelpCircle, color: 'pink' },
};

// ============================================================================
// COMMAND FACTORY
// ============================================================================

const createCommands = (context: CommandContext = {}): CommandDefinition[] => [
  // Tools
  { id: 'tool-search', label: 'Search Tools', description: 'Find and filter available tools', category: 'tools', icon: Search, shortcut: 'T', keywords: ['find', 'filter', 'search', 'tool'] },
  { id: 'tool-enable-all', label: 'Enable All Tools', description: 'Allow all tools for this session', category: 'tools', icon: CheckCircle, keywords: ['allow', 'enable', 'all'] },
  { id: 'tool-disable-all', label: 'Disable All Tools', description: 'Block all tools for this session', category: 'tools', icon: XCircle, keywords: ['block', 'disable', 'none'] },
  { id: 'tool-add-custom', label: 'Add Custom Tool', description: 'Define a new custom tool', category: 'tools', icon: Plus, shortcut: 'N', keywords: ['new', 'create', 'custom', 'add'] },
  { id: 'tool-import', label: 'Import Tool Configuration', description: 'Load tools from a config file', category: 'tools', icon: Upload, keywords: ['import', 'load', 'config'] },
  { id: 'tool-export', label: 'Export Tool Configuration', description: 'Save current tool setup to file', category: 'tools', icon: Download, shortcut: 'E', keywords: ['export', 'save', 'download'] },

  // Workflow
  { id: 'workflow-start', label: 'Start Workflow', description: 'Begin executing the current workflow', category: 'workflow', icon: Play, shortcut: 'R', keywords: ['run', 'start', 'execute'] },
  { id: 'workflow-pause', label: 'Pause Workflow', description: 'Temporarily halt execution', category: 'workflow', icon: Pause, shortcut: 'P', keywords: ['pause', 'halt', 'stop'] },
  { id: 'workflow-cancel', label: 'Cancel Workflow', description: 'Stop and reset the current workflow', category: 'workflow', icon: Square, keywords: ['cancel', 'stop', 'abort'] },
  { id: 'workflow-retry', label: 'Retry Last Action', description: 'Re-execute the last failed action', category: 'workflow', icon: RefreshCw, keywords: ['retry', 'again', 'redo'] },
  { id: 'workflow-history', label: 'View Workflow History', description: 'See past workflow executions', category: 'workflow', icon: History, shortcut: 'H', keywords: ['history', 'past', 'log'] },

  // Permissions
  { id: 'perm-auto-approve', label: 'Toggle Auto-Approve', description: context.autoApprove ? 'Currently ON' : 'Currently OFF', category: 'permissions', icon: Zap, shortcut: 'A', keywords: ['auto', 'approve'], active: context.autoApprove },
  { id: 'perm-approve-pending', label: 'Approve All Pending', description: 'Approve all waiting requests', category: 'permissions', icon: CheckCircle, shortcut: 'Y', keywords: ['approve', 'accept', 'yes'], badge: context.pendingCount && context.pendingCount > 0 ? context.pendingCount : null },
  { id: 'perm-reject-pending', label: 'Reject All Pending', description: 'Reject all waiting requests', category: 'permissions', icon: XCircle, keywords: ['reject', 'deny', 'no'] },
  { id: 'perm-switch-profile', label: 'Switch Permission Profile', description: 'Change permission preset', category: 'permissions', icon: Layers, shortcut: 'S', keywords: ['profile', 'preset'], hasSubmenu: true },

  // View
  { id: 'view-toggle-sidebar', label: 'Toggle Sidebar', description: 'Show or hide side panel', category: 'view', icon: PanelLeft, shortcut: 'B', keywords: ['sidebar', 'panel'] },
  { id: 'view-split', label: 'Split View', description: 'Open a split pane view', category: 'view', icon: SplitSquareHorizontal, keywords: ['split', 'pane'] },
  { id: 'view-fullscreen', label: 'Toggle Fullscreen', description: 'Enter or exit fullscreen', category: 'view', icon: Maximize2, shortcut: 'F', keywords: ['fullscreen', 'maximize'] },
  { id: 'view-list', label: 'List View', description: 'Display as list', category: 'view', icon: List, keywords: ['list', 'rows'] },
  { id: 'view-grid', label: 'Grid View', description: 'Display as grid', category: 'view', icon: Grid3X3, keywords: ['grid', 'tiles'] },
  { id: 'view-theme-toggle', label: 'Toggle Theme', description: 'Switch light/dark mode', category: 'view', icon: context.theme === 'dark' ? Sun : Moon, shortcut: 'D', keywords: ['theme', 'dark', 'light'] },

  // Navigation
  { id: 'nav-sessions', label: 'Go to Sessions', description: 'View all workflow sessions', category: 'navigation', icon: Folder, shortcut: '1', keywords: ['sessions', 'workflows'] },
  { id: 'nav-tools', label: 'Go to Tools', description: 'Manage available tools', category: 'navigation', icon: Wand2, shortcut: '2', keywords: ['tools', 'manage'] },
  { id: 'nav-settings', label: 'Go to Settings', description: 'Open settings panel', category: 'navigation', icon: Settings, shortcut: ',', keywords: ['settings', 'preferences'] },
  { id: 'nav-recent', label: 'Recent Items', description: 'View recently accessed', category: 'navigation', icon: Clock, keywords: ['recent', 'history'], hasSubmenu: true },

  // Settings
  { id: 'settings-model', label: 'Change Model', description: 'Select a different AI model', category: 'settings', icon: Bot, shortcut: 'M', keywords: ['model', 'ai', 'claude'], hasSubmenu: true },
  { id: 'settings-keyboard', label: 'Keyboard Shortcuts', description: 'View and customize shortcuts', category: 'settings', icon: Keyboard, shortcut: '?', keywords: ['keyboard', 'shortcuts'] },
  { id: 'settings-reset', label: 'Reset All Settings', description: 'Restore defaults', category: 'settings', icon: RotateCcw, keywords: ['reset', 'default'], danger: true },

  // Help
  { id: 'help-docs', label: 'Documentation', description: 'Open the docs', category: 'help', icon: FileText, keywords: ['docs', 'help', 'guide'] },
  { id: 'help-shortcuts', label: 'Shortcuts Reference', description: 'View all shortcuts', category: 'help', icon: Keyboard, keywords: ['shortcuts', 'keys'] },
  { id: 'help-feedback', label: 'Send Feedback', description: 'Report issues or suggest features', category: 'help', icon: MessageSquare, keywords: ['feedback', 'bug'] },
  { id: 'help-whats-new', label: "What's New", description: 'See recent updates', category: 'help', icon: Sparkles, keywords: ['new', 'updates'] },
];

// ============================================================================
// COMMAND PALETTE COMPONENT
// ============================================================================

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  context = {},
  onCommandExecute,
  recentCommands = [],
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<CommandCategoryId | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo(() => createCommands(context), [context]);

  const filteredCommands = useMemo(() => {
    let result = commands;

    if (activeCategory) {
      result = result.filter(cmd => cmd.category === activeCategory);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(cmd =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.keywords?.some(k => k.toLowerCase().includes(q)) ||
        cmd.shortcut?.toLowerCase() === q
      );
    }

    return result;
  }, [commands, query, activeCategory]);

  // Group commands - DEDUPLICATED, max 3 recent
  const groupedCommands = useMemo((): CommandGroup[] => {
    const isSearching = query.trim() !== '';
    const isFiltering = activeCategory !== null;
    const showRecentSection = !isSearching && !isFiltering && recentCommands.length > 0;

    const groups: CommandGroup[] = [];
    const recentIds = new Set(recentCommands);

    // Recent section - MAX 3 items
    if (showRecentSection) {
      const recentCmds = recentCommands
        .map(id => commands.find(c => c.id === id))
        .filter((c): c is CommandDefinition => c !== undefined)
        .slice(0, 3); // MAX 3

      if (recentCmds.length > 0) {
        groups.push({
          category: 'recent',
          name: 'Recent',
          icon: Clock,
          commands: recentCmds,
        });
      }
    }

    // Category groups (deduplicated)
    const categories = [...new Set(filteredCommands.map(c => c.category))];
    categories.forEach(cat => {
      let catCommands = filteredCommands.filter(c => c.category === cat);

      if (showRecentSection) {
        catCommands = catCommands.filter(c => !recentIds.has(c.id));
      }

      if (catCommands.length > 0) {
        const catInfo = COMMAND_CATEGORIES[cat];
        groups.push({
          category: cat,
          name: catInfo?.name || cat,
          icon: catInfo?.icon,
          commands: catCommands,
        });
      }
    });

    return groups;
  }, [filteredCommands, query, activeCategory, recentCommands, commands]);

  const flatCommands = useMemo(
    () => groupedCommands.flatMap(g => g.commands),
    [groupedCommands]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setActiveCategory(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const executeCommand = useCallback((command: CommandDefinition) => {
    command.action?.();
    onCommandExecute?.(command.id);
    if (!command.hasSubmenu) {
      onClose();
    }
  }, [onCommandExecute, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen) {return;}

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, flatCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatCommands[selectedIndex]) {
          executeCommand(flatCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        e.preventDefault();
        const cats: (CommandCategoryId | null)[] = [null, ...Object.keys(COMMAND_CATEGORIES) as CommandCategoryId[]];
        const currentIdx = cats.indexOf(activeCategory);
        const nextIdx = e.shiftKey
          ? (currentIdx <= 0 ? cats.length - 1 : currentIdx - 1)
          : (currentIdx >= cats.length - 1 ? 0 : currentIdx + 1);
        setActiveCategory(cats[nextIdx]);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && query === '') {
          const shortcutCmd = flatCommands.find(
            cmd => cmd.shortcut?.toLowerCase() === e.key.toLowerCase()
          );
          if (shortcutCmd) {
            e.preventDefault();
            executeCommand(shortcutCmd);
          }
        }
    }
  }, [isOpen, flatCommands, selectedIndex, activeCategory, query, onClose, executeCommand]);

  if (!isOpen) {return null;}

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-md bg-gray-900 rounded-lg border border-gray-700 shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
          <Command className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-white text-xs placeholder-gray-500 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-0.5 text-gray-500 hover:text-gray-300">
              <X className="w-3 h-3" />
            </button>
          )}
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-[9px] text-gray-500">esc</kbd>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-800 overflow-x-auto">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
              !activeCategory ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            All
          </button>
          {(Object.entries(COMMAND_CATEGORIES) as [CommandCategoryId, CommandCategoryConfig][]).map(([id, cat]) => {
            const CatIcon = cat.icon;
            return (
              <button
                key={id}
                onClick={() => setActiveCategory(activeCategory === id ? null : id)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
                  activeCategory === id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                <CatIcon className="w-2.5 h-2.5" />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Command List - Ultra Compact */}
        <div ref={listRef} className="max-h-[280px] overflow-y-auto">
          {groupedCommands.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <Search className="w-4 h-4 text-gray-600 mx-auto mb-1" />
              <p className="text-[10px] text-gray-500">No commands found</p>
            </div>
          ) : (
            groupedCommands.map((group, groupIndex) => {
              const GroupIcon = group.icon;
              return (
                <div key={group.category || groupIndex}>
                  {/* Group Header */}
                  <div className="flex items-center gap-1 px-2 py-1 text-[9px] font-medium text-gray-500 uppercase tracking-wider bg-gray-800/50 sticky top-0">
                    {GroupIcon && <GroupIcon className="w-2.5 h-2.5" />}
                    {group.name}
                    <span className="text-gray-600 ml-auto">{group.commands.length}</span>
                  </div>

                  {/* Commands - Ultra Compact */}
                  {group.commands.map((command) => {
                    const globalIndex = flatCommands.indexOf(command);
                    const isSelected = globalIndex === selectedIndex;
                    const CommandIcon = command.icon;

                    return (
                      <button
                        key={`${group.category}-${command.id}`}
                        data-index={globalIndex}
                        onClick={() => executeCommand(command)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full flex items-center gap-1.5 px-2 py-1 transition-colors text-left ${
                          isSelected ? 'bg-blue-500/20' : 'hover:bg-gray-800/50'
                        } ${command.danger ? 'text-red-400' : ''}`}
                      >
                        {/* Icon */}
                        <CommandIcon className={`w-3 h-3 flex-shrink-0 ${
                          command.active ? 'text-green-400' :
                          command.danger ? 'text-red-400' :
                          isSelected ? 'text-blue-400' : 'text-gray-500'
                        }`} />

                        {/* Label */}
                        <span className={`text-[11px] flex-1 truncate ${
                          command.danger ? 'text-red-400' :
                          isSelected ? 'text-white' : 'text-gray-300'
                        }`}>
                          {command.label}
                        </span>

                        {/* Badges */}
                        {command.badge && (
                          <span className="px-1 py-0.5 bg-orange-500/20 text-orange-400 text-[9px] rounded min-w-[14px] text-center leading-none">
                            {command.badge}
                          </span>
                        )}
                        {command.active && (
                          <span className="px-1 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded leading-none">
                            ON
                          </span>
                        )}

                        {/* Shortcut */}
                        {command.shortcut && (
                          <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono leading-none ${
                            isSelected ? 'bg-blue-500/30 text-blue-300' : 'bg-gray-800 text-gray-500'
                          }`}>
                            {command.shortcut}
                          </kbd>
                        )}

                        {command.hasSubmenu && (
                          <ChevronRight className="w-2.5 h-2.5 text-gray-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-2 py-1 border-t border-gray-800 bg-gray-900/80">
          <div className="flex items-center gap-2 text-[9px] text-gray-500">
            <span className="flex items-center gap-0.5">
              <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">↑↓</kbd>
              nav
            </span>
            <span className="flex items-center gap-0.5">
              <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">↵</kbd>
              run
            </span>
            <span className="flex items-center gap-0.5">
              <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">tab</kbd>
              filter
            </span>
          </div>
          <div className="text-[9px] text-gray-600">
            {flatCommands.length}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DEMO COMPONENT
// ============================================================================

const CommandPaletteDemo: React.FC = () => {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([
    'tool-search',
    'workflow-start',
    'perm-auto-approve',
    'view-theme-toggle',
  ]);
  const [context, setContext] = useState<CommandContext>({
    autoApprove: false,
    pendingCount: 3,
    theme: 'dark',
  });
  const [executionLog, setExecutionLog] = useState<ExecutionLogEntry[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'j')) {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCommandExecute = (commandId: string) => {
    setRecentCommands(prev => {
      const filtered = prev.filter(id => id !== commandId);
      return [commandId, ...filtered].slice(0, 10);
    });

    setExecutionLog(prev => [{
      id: commandId,
      time: new Date().toLocaleTimeString(),
    }, ...prev].slice(0, 10));

    if (commandId === 'perm-auto-approve') {
      setContext(prev => ({ ...prev, autoApprove: !prev.autoApprove }));
    }
    if (commandId === 'view-theme-toggle') {
      setContext(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold mb-2">Command Palette</h1>
          <p className="text-gray-400 text-xs mb-3">
            Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300 font-mono text-[10px] mx-0.5">⌘K</kbd>
            or <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300 font-mono text-[10px] mx-0.5">Ctrl+K</kbd>
          </p>
          <button
            onClick={() => setIsPaletteOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Command className="w-3.5 h-3.5" />
            Open Palette
            <kbd className="px-1 py-0.5 bg-blue-500/50 rounded text-[10px]">⌘K</kbd>
          </button>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
            <h3 className="font-medium text-xs mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-amber-400" />
              Max 3 Recent
            </h3>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Recent items capped at 3 and deduplicated from categories.
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
            <h3 className="font-medium text-xs mb-1.5 flex items-center gap-1.5">
              <Keyboard className="w-3 h-3 text-purple-400" />
              Quick Keys
            </h3>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Single keys work when search is empty.
            </p>
          </div>
        </div>

        {/* State */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-3 mb-4">
          <div className="flex flex-wrap gap-2 text-[10px]">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded">
              <Zap className={context.autoApprove ? 'w-3 h-3 text-green-400' : 'w-3 h-3 text-gray-500'} />
              <span className="text-gray-300">Auto: {context.autoApprove ? 'ON' : 'OFF'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded">
              <Clock className="w-3 h-3 text-orange-400" />
              <span className="text-gray-300">Pending: {context.pendingCount}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded">
              {context.theme === 'dark' ? <Moon className="w-3 h-3 text-blue-400" /> : <Sun className="w-3 h-3 text-amber-400" />}
              <span className="text-gray-300">{context.theme}</span>
            </div>
          </div>
        </div>

        {/* Recent */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-3 mb-4">
          <h3 className="font-medium text-xs mb-2 flex items-center gap-1.5">
            <History className="w-3 h-3 text-blue-400" />
            Recent (showing max 3 in palette)
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {recentCommands.slice(0, 5).map((cmdId, i) => (
              <span
                key={cmdId}
                className={`px-1.5 py-0.5 text-[10px] rounded ${
                  i < 3 ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-800 text-gray-500'
                }`}
              >
                {cmdId}
              </span>
            ))}
          </div>
          <p className="text-[9px] text-gray-600 mt-2">Blue = shown in palette, gray = stored but hidden</p>
        </div>

        {/* Log */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
          <h3 className="font-medium text-xs mb-2 flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-green-400" />
            Execution Log
          </h3>
          {executionLog.length === 0 ? (
            <p className="text-[10px] text-gray-500 italic">No commands executed yet</p>
          ) : (
            <div className="space-y-0.5 max-h-24 overflow-y-auto">
              {executionLog.map((log, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-gray-600">{log.time}</span>
                  <span className="text-gray-300">{log.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shortcuts */}
        <div className="mt-4">
          <h3 className="font-medium text-xs mb-2 text-gray-400">Shortcuts</h3>
          <div className="flex flex-wrap gap-1">
            {[
              'T', 'N', 'R', 'P', 'A', 'Y', 'S', 'H', 'E', 'M', 'B', 'F', 'D', ',', '?'
            ].map(key => (
              <kbd key={key} className="px-1.5 py-0.5 bg-gray-900 border border-gray-800 rounded text-[9px] font-mono text-gray-400">
                {key}
              </kbd>
            ))}
          </div>
        </div>
      </div>

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        context={context}
        recentCommands={recentCommands}
        onCommandExecute={handleCommandExecute}
      />
    </div>
  );
};

export default CommandPaletteDemo;

// ============================================================================
// EXPORTS
// ============================================================================

export {
  CommandPalette,
  createCommands,
  COMMAND_CATEGORIES,
};

export type {
  CommandCategoryId,
  ThemeType,
  CommandCategoryConfig,
  CommandContext,
  CommandDefinition,
  CommandGroup,
  ExecutionLogEntry,
  CommandPaletteProps,
  CommandPaletteDemoProps,
};
