// M9: responsive pass
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Skeleton } from '../components/ui/Skeleton';
import {
  Search,
  X,
  LayoutDashboard,
  Crosshair,
  Network,
  Sun,
  Play,
  Flag,
  DollarSign,
  Zap,
  Shield,
  Bell,
  Bot,
  FileText,
  Settings,
  Server,
  Database,
  Palette,
  BarChart3,
  Lock,
  Plus,
  MessageSquare,
  Terminal,
  XCircle,
  RefreshCw,
  Activity,
  GitPullRequest,
  BookOpen,
  Keyboard,
  Bug,
  Clock,
  ClipboardList,
  Globe,
  AlertTriangle,
  Cog,
  Brain,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

type CommandGroup =
  | 'Recent'
  | 'Navigation'
  | 'Agent Actions'
  | 'System'
  | 'Help';

interface CommandItem {
  id: string;
  group: CommandGroup;
  label: string;
  description?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  shortcut?: string;
}

// ─── NL Intent Detection ──────────────────────────────────────────────────────

interface NLIntent {
  label: string;
  target: string;
}

function detectIntent(query: string): NLIntent | null {
  const q = query.toLowerCase();
  if (!q.trim() || q.length < 4) return null;

  if (/error|errors|fail|crash|exception/.test(q))
    return { label: 'Filter by error state', target: 'Agents view' };
  if (/cost|spend|billing|budget|price/.test(q))
    return { label: 'Open Cost Dashboard', target: 'Billing view' };
  if (/slow|lag|latency|perf|performance/.test(q))
    return { label: 'Filter by latency', target: 'Performance view' };
  if (/spawn|new agent|create agent/.test(q))
    return { label: 'Spawn new subagent', target: 'Mission Control' };
  if (/log|logs|output|stdout/.test(q))
    return { label: 'View agent logs', target: 'Log viewer' };
  if (/security|threat|vuln|attack/.test(q))
    return { label: 'Open threat overview', target: 'Security Dashboard' };
  if (/deploy|release|ship|publish/.test(q))
    return { label: 'Check deployment status', target: 'CI / CD view' };

  return null;
}

// ─── Command Data ─────────────────────────────────────────────────────────────

const COMMANDS: CommandItem[] = [
  // Recent (hardcoded last 3 visited)
  {
    id: 'recent-dashboard',
    group: 'Recent',
    label: 'Dashboard',
    description: 'Main overview',
    icon: LayoutDashboard,
    shortcut: '⌘D',
  },
  {
    id: 'recent-mission-control',
    group: 'Recent',
    label: 'Mission Control',
    description: 'Agent command center',
    icon: Crosshair,
    shortcut: '⌘M',
  },
  {
    id: 'recent-topology',
    group: 'Recent',
    label: 'Agent Topology',
    description: 'Graph of running agents',
    icon: Network,
  },

  // Navigation (16 views)
  {
    id: 'nav-dashboard',
    group: 'Navigation',
    label: 'Dashboard',
    description: 'High-level metrics & status',
    icon: LayoutDashboard,
    shortcut: '⌘D',
  },
  {
    id: 'nav-mission-control',
    group: 'Navigation',
    label: 'Mission Control',
    description: 'Oversee all active agents',
    icon: Crosshair,
    shortcut: '⌘M',
  },
  {
    id: 'nav-topology',
    group: 'Navigation',
    label: 'Agent Topology',
    description: 'Visual agent graph',
    icon: Network,
  },
  {
    id: 'nav-morning-packet',
    group: 'Navigation',
    label: 'Morning Packet',
    description: 'Daily briefing digest',
    icon: Sun,
    shortcut: 'Alt+1',
  },
  {
    id: 'nav-discovery',
    group: 'Navigation',
    label: 'Discovery Runs',
    description: 'Scheduled exploration runs',
    icon: Play,
    shortcut: 'Alt+2',
  },
  {
    id: 'nav-findings',
    group: 'Navigation',
    label: 'Findings',
    description: 'Surfaced insights & alerts',
    icon: Flag,
    shortcut: 'Alt+3',
  },
  {
    id: 'nav-cost',
    group: 'Navigation',
    label: 'Cost Dashboard',
    description: 'Token spend & billing',
    icon: DollarSign,
    shortcut: 'Alt+4',
  },
  {
    id: 'nav-performance',
    group: 'Navigation',
    label: 'Performance',
    description: 'Latency, throughput & health',
    icon: Zap,
  },
  {
    id: 'nav-security',
    group: 'Navigation',
    label: 'Security Dashboard',
    description: 'Threats & access control',
    icon: Shield,
  },
  {
    id: 'nav-alerts',
    group: 'Navigation',
    label: 'Alert Center',
    description: 'Active incidents & alerts',
    icon: Bell,
  },
  {
    id: 'nav-agent-builder',
    group: 'Navigation',
    label: 'Agent Builder',
    description: 'Create & configure agents',
    icon: Bot,
  },
  {
    id: 'nav-audit',
    group: 'Navigation',
    label: 'Audit Log',
    description: 'Full event audit trail',
    icon: ClipboardList,
  },
  {
    id: 'nav-api-gateway',
    group: 'Navigation',
    label: 'API Gateway',
    description: 'Routes, limits & keys',
    icon: Globe,
  },
  {
    id: 'nav-storage',
    group: 'Navigation',
    label: 'Storage Explorer',
    description: 'Files, embeddings & blobs',
    icon: Database,
  },
  {
    id: 'nav-theme',
    group: 'Navigation',
    label: 'Theme Editor',
    description: 'Customize the UI palette',
    icon: Palette,
  },
  {
    id: 'nav-benchmark',
    group: 'Navigation',
    label: 'Model Benchmark',
    description: 'Compare model performance',
    icon: BarChart3,
  },
  {
    id: 'nav-access',
    group: 'Navigation',
    label: 'Access Control',
    description: 'Roles, permissions & SSO',
    icon: Lock,
  },
  {
    id: 'nav-reports',
    group: 'Navigation',
    label: 'Reports',
    description: 'Exportable analytics reports',
    icon: FileText,
  },

  // Agent Actions
  {
    id: 'agent-spawn',
    group: 'Agent Actions',
    label: 'Spawn subagent',
    description: 'Launch a new agent session',
    icon: Plus,
    shortcut: '⌘⇧N',
  },
  {
    id: 'agent-message',
    group: 'Agent Actions',
    label: 'Send message to agent',
    description: 'Direct message any active agent',
    icon: MessageSquare,
  },
  {
    id: 'agent-logs',
    group: 'Agent Actions',
    label: 'View agent logs',
    description: 'Tail live agent output',
    icon: Terminal,
  },
  {
    id: 'agent-kill',
    group: 'Agent Actions',
    label: 'Kill session',
    description: 'Terminate a running agent',
    icon: XCircle,
  },

  // System
  {
    id: 'sys-restart-gateway',
    group: 'System',
    label: 'Restart gateway',
    description: 'Soft-restart the OpenClaw gateway',
    icon: RefreshCw,
  },
  {
    id: 'sys-health',
    group: 'System',
    label: 'Run health check',
    description: 'Full system diagnostic',
    icon: Activity,
    shortcut: '⌘H',
  },
  {
    id: 'sys-settings',
    group: 'System',
    label: 'Open settings',
    description: 'Global workspace configuration',
    icon: Cog,
    shortcut: '⌘,',
  },
  {
    id: 'sys-pr-status',
    group: 'System',
    label: 'Check PR status',
    description: 'Latest open pull requests',
    icon: GitPullRequest,
  },

  // Help
  {
    id: 'help-docs',
    group: 'Help',
    label: 'Open docs',
    description: 'Full OpenClaw documentation',
    icon: BookOpen,
  },
  {
    id: 'help-shortcuts',
    group: 'Help',
    label: 'Keyboard shortcuts',
    description: 'View all key bindings',
    icon: Keyboard,
    shortcut: '?',
  },
  {
    id: 'help-bug',
    group: 'Help',
    label: 'Report a bug',
    description: 'File an issue on GitHub',
    icon: Bug,
  },
];

const GROUP_ORDER: CommandGroup[] = [
  'Recent',
  'Navigation',
  'Agent Actions',
  'System',
  'Help',
];

// ─── NL Sidebar Examples ──────────────────────────────────────────────────────

const NL_EXAMPLES = [
  'show me agent errors',
  "what's our spend this month",
  'why is response slow',
  'spawn a new agent',
  'check security threats',
];

// ─── Command Row Component ────────────────────────────────────────────────────

interface CommandRowProps {
  item: CommandItem;
  isSelected: boolean;
  query: string;
  onActivate: () => void;
  onHover: () => void;
}

function CommandRow({ item, isSelected, query, onActivate, onHover }: CommandRowProps) {
  const Icon = item.icon;

  // Highlight matching substring
  function highlightLabel(text: string): React.ReactNode {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-violet-500/30 text-violet-200 rounded-sm px-0.5 not-italic">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  }

  return (
    <button
      onClick={onActivate}
      onMouseEnter={onHover}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-150 group focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none',
        isSelected
          ? 'bg-violet-600/20 text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]/60 hover:text-[var(--color-text-primary)]'
      )}
      aria-selected={isSelected}
    >
      {/* Icon */}
      <span
        className={cn(
          'shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors',
          isSelected ? 'text-violet-400' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]'
        )}
      >
        <Icon size={15} />
      </span>

      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{highlightLabel(item.label)}</p>
        {item.description && (
          <p className="text-xs text-[var(--color-text-muted)] truncate">{item.description}</p>
        )}
      </div>

      {/* Shortcut badge */}
      {item.shortcut && (
        <kbd
          className={cn(
            'shrink-0 text-[10px] px-1.5 py-0.5 rounded font-mono border',
            isSelected
              ? 'bg-violet-900/40 border-violet-700 text-violet-300'
              : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)]'
          )}
        >
          {item.shortcut}
        </kbd>
      )}
    </button>
  );
}

// ─── Skeleton Loading State ────────────────────────────────────────────────────

function CommandPaletteSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] flex flex-col items-center justify-start pt-6 sm:pt-12 md:pt-16 pb-6 sm:pb-16 px-2 sm:px-4">
      <div className="mb-6 text-center">
        <Skeleton variant="text" className="h-3 w-52 mx-auto" />
        <Skeleton variant="text" className="h-2.5 w-64 mx-auto mt-2" />
      </div>
      <div className="flex items-start gap-4 w-full max-w-[860px]">
        <div className="flex-1 w-full max-w-full sm:max-w-[640px]">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-2xl">
            {/* Search bar skeleton */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
              <Skeleton variant="rect" className="w-4 h-4 rounded" />
              <Skeleton variant="rect" className="flex-1 h-5 rounded" />
              <Skeleton variant="rect" className="w-8 h-5 rounded" />
            </div>
            {/* Command rows skeleton */}
            <div className="p-2 space-y-1">
              {/* Group header */}
              <Skeleton variant="text" className="h-2.5 w-14 ml-3 mt-2 mb-1" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`r-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <Skeleton variant="rect" className="w-7 h-7 rounded-md" />
                  <div className="flex-1 space-y-1">
                    <Skeleton variant="text" className="h-3.5 w-28" />
                    <Skeleton variant="text" className="h-2.5 w-40" />
                  </div>
                  <Skeleton variant="rect" className="h-4 w-8 rounded" />
                </div>
              ))}
              <Skeleton variant="text" className="h-2.5 w-20 ml-3 mt-3 mb-1" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`n-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <Skeleton variant="rect" className="w-7 h-7 rounded-md" />
                  <div className="flex-1 space-y-1">
                    <Skeleton variant="text" className="h-3.5 w-32" />
                    <Skeleton variant="text" className="h-2.5 w-48" />
                  </div>
                </div>
              ))}
            </div>
            {/* Footer skeleton */}
            <div className="border-t border-[var(--color-border)] px-4 py-2 flex items-center gap-4">
              <Skeleton variant="text" className="h-2.5 w-20" />
              <Skeleton variant="text" className="h-2.5 w-16" />
              <Skeleton variant="text" className="h-2.5 w-14" />
              <div className="ml-auto">
                <Skeleton variant="text" className="h-2.5 w-24" />
              </div>
            </div>
          </div>
        </div>
        {/* Sidebar skeleton — hidden on mobile */}
        <div className="shrink-0 w-48 hidden md:block space-y-3">
          <div className="bg-[var(--color-surface-1)]/60 border border-[var(--color-border)] rounded-xl p-4 space-y-3">
            <Skeleton variant="text" className="h-2.5 w-20" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="text" className="h-3 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function CommandPaletteV2({ isLoading = false }: { isLoading?: boolean }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isClosed, setIsClosed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // NL intent detection
  const intent = useMemo(() => detectIntent(query), [query]);

  // Filter commands
  const filteredItems = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    );
  }, [query]);

  // Group filtered items preserving GROUP_ORDER
  const groupedItems = useMemo(() => {
    const map = new Map<CommandGroup, CommandItem[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const item of filteredItems) {
      map.get(item.group)?.push(item);
    }
    // Remove empty groups
    const result: Array<{ group: CommandGroup; items: CommandItem[] }> = [];
    for (const [group, items] of map.entries()) {
      if (items.length > 0) result.push({ group, items });
    }
    return result;
  }, [filteredItems]);

  // Flat list for index tracking
  const flatItems = useMemo(() => filteredItems, [filteredItems]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Global keyboard listeners
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isClosed) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) {
          console.log('[CommandPaletteV2] Activated:', item.id, item.label);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        console.log('[CommandPaletteV2] Closed via Escape');
        setIsClosed(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClosed, flatItems, selectedIndex]);

  // Focus input on open
  useEffect(() => {
    if (!isClosed) {
      inputRef.current?.focus();
    }
  }, [isClosed]);

  // Track flat index across groups for selectedIndex alignment
  let flatCounter = 0;

  if (isLoading) return <CommandPaletteSkeleton />;

  // M9: responsive pass — full-screen on mobile, no floating modal
  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] flex flex-col items-center justify-start pt-6 sm:pt-12 md:pt-16 pb-6 sm:pb-16 px-2 sm:px-4">
      {/* Page label */}
      <div className="mb-6 text-center">
        <p className="text-sm text-[var(--color-text-muted)] font-mono tracking-wide">
          ⌘K anywhere in the app opens this
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Horizon M5 · Universal Command Palette · View #315
        </p>
      </div>

      {/* Main layout: palette + sidebar — M9: sidebar hidden on mobile */}
      <div className="flex items-start gap-4 w-full max-w-[860px]">

        {/* ── Palette panel ── M9: full-width on mobile */}
        <div className="flex-1 w-full max-w-full sm:max-w-[640px]">
          {isClosed ? (
            /* Closed state */
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl p-8 text-center shadow-2xl">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-surface-2)] mx-auto mb-4">
                <Search size={20} className="text-[var(--color-text-secondary)]" />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-1">Command palette closed</p>
              <p className="text-xs text-[var(--color-text-muted)] mb-5">Press ⌘K or click below to reopen</p>
              <button
                onClick={() => setIsClosed(false)}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 active:scale-95 text-[var(--color-text-primary)] text-sm rounded-lg transition-all duration-150 font-medium focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              >
                Reopen palette
              </button>
            </div>
          ) : (
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-2xl">

              {/* Search bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
                <Search size={16} className="text-[var(--color-text-muted)] shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a command, view, or ask anything…"
                  className="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm outline-none"
                  aria-label="Command search"
                />
                {/* Hint badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono">
                    ⌘K
                  </kbd>
                  <span className="text-[var(--color-text-muted)] text-xs">·</span>
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono">
                    Esc
                  </kbd>
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ml-1"
                      aria-label="Clear"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* NL intent badge */}
              {intent && (
                <div className="px-4 py-2 border-b border-[var(--color-border)]/60 flex items-center gap-2">
                  <Brain size={13} className="text-violet-400 shrink-0" />
                  <span className="text-xs text-violet-300">
                    <span className="font-semibold">Intent:</span>{' '}
                    {intent.label}
                    <span className="text-[var(--color-text-muted)] mx-1">→</span>
                    <span className="text-violet-200 font-medium">{intent.target}</span>
                  </span>
                </div>
              )}

              {/* Command groups */}
              <div className="max-h-[440px] overflow-y-auto overscroll-contain p-2">
                {flatItems.length === 0 ? (
                  <ContextualEmptyState
                    icon={Search}
                    title="No matching commands"
                    description={`No commands match "${query}". Try a different search term.`}
                    size="sm"
                  />
                ) : (
                  groupedItems.map(({ group, items }) => (
                    <div key={group} className="mb-1">
                      {/* Group header */}
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-1.5">
                        {group === 'Recent' && (
                          <Clock size={9} className="opacity-60" />
                        )}
                        {group}
                      </p>
                      {/* Items */}
                      {items.map((item) => {
                        const idx = flatCounter++;
                        return (
                          <CommandRow
                            key={item.id}
                            item={item}
                            isSelected={selectedIndex === idx}
                            query={query}
                            onActivate={() => {
                              console.log('[CommandPaletteV2] Activated:', item.id, item.label);
                            }}
                            onHover={() => setSelectedIndex(idx)}
                          />
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-[var(--color-border)] px-4 py-2 flex items-center gap-4 text-[10px] text-[var(--color-text-muted)]">
                <span>
                  <kbd className="font-mono mr-0.5">↑↓</kbd> navigate
                </span>
                <span>
                  <kbd className="font-mono mr-0.5">↵</kbd> select
                </span>
                <span>
                  <kbd className="font-mono mr-0.5">Esc</kbd> close
                </span>
                <span className="ml-auto">
                  {flatItems.length} command{flatItems.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── NL examples sidebar ── M9: responsive pass — hidden on mobile */}
        <div className="shrink-0 w-48 hidden md:block">
          <div className="bg-[var(--color-surface-1)]/60 border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mb-3">
              Try typing…
            </p>
            <ul className="space-y-2">
              {NL_EXAMPLES.map((phrase) => (
                <li key={phrase}>
                  <button
                    onClick={() => {
                      setQuery(phrase);
                      setIsClosed(false);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="w-full text-left group"
                  >
                    <span className="block text-xs text-[var(--color-text-secondary)] group-hover:text-violet-300 transition-colors leading-snug italic">
                      "{phrase}"
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
              <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                Natural language phrases trigger 🧠 intent detection — no commands to memorize.
              </p>
            </div>
          </div>

          {/* Keyboard nav hint card */}
          <div className="mt-3 bg-[var(--color-surface-1)]/40 border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
              Keys
            </p>
            <dl className="space-y-1.5">
              {[
                { key: '↑ ↓', desc: 'Move' },
                { key: '↵', desc: 'Activate' },
                { key: 'Esc', desc: 'Close' },
                { key: '⌘K', desc: 'Open' },
              ].map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-secondary)] font-mono">
                    {key}
                  </kbd>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{desc}</span>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
