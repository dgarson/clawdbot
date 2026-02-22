import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type CommandKind =
  | "navigate"
  | "action"
  | "agent"
  | "file"
  | "model"
  | "setting"
  | "search"
  | "shortcut";

interface Command {
  id: string;
  kind: CommandKind;
  label: string;
  description?: string;
  emoji: string;
  shortcut?: string[];
  keywords: string[];
  category: string;
  recent?: boolean;
  pinned?: boolean;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const COMMANDS: Command[] = [
  // Navigate
  { id: "nav-dashboard",    kind: "navigate", label: "Go to Dashboard",       emoji: "📊", category: "Navigation", keywords: ["dash", "home", "main"], shortcut: ["G", "D"] },
  { id: "nav-chat",         kind: "navigate", label: "Open Chat",             emoji: "💬", category: "Navigation", keywords: ["chat", "message", "talk"], shortcut: ["G", "C"] },
  { id: "nav-builder",      kind: "navigate", label: "Agent Builder",         emoji: "🔧", category: "Navigation", keywords: ["build", "create", "wizard"], recent: true },
  { id: "nav-soul",         kind: "navigate", label: "Soul Editor",           emoji: "👁️", category: "Navigation", keywords: ["soul", "persona", "identity"] },
  { id: "nav-audit",        kind: "navigate", label: "Audit Log",             emoji: "🔎", category: "Navigation", keywords: ["audit", "log", "compliance"] },
  { id: "nav-security",     kind: "navigate", label: "Security Dashboard",    emoji: "🛡️", category: "Navigation", keywords: ["security", "threats", "shield"] },
  { id: "nav-alerts",       kind: "navigate", label: "Alert Center",          emoji: "🚨", category: "Navigation", keywords: ["alerts", "incidents", "fire"] },
  { id: "nav-benchmark",    kind: "navigate", label: "Model Benchmark",       emoji: "📈", category: "Navigation", keywords: ["benchmark", "compare", "perf"] },
  { id: "nav-storage",      kind: "navigate", label: "Storage Explorer",      emoji: "💾", category: "Navigation", keywords: ["storage", "files", "fs"] },
  { id: "nav-theme",        kind: "navigate", label: "Theme Editor",          emoji: "🎨", category: "Navigation", keywords: ["theme", "dark", "color", "ui"], recent: true },
  // Actions
  { id: "act-new-session",  kind: "action",   label: "Start New Session",     emoji: "▶️", category: "Actions", keywords: ["new", "session", "start", "run"] },
  { id: "act-export",       kind: "action",   label: "Export Data",           emoji: "📦", category: "Actions", keywords: ["export", "download", "csv"] },
  { id: "act-invite",       kind: "action",   label: "Invite Team Member",    emoji: "👋", category: "Actions", keywords: ["invite", "team", "add", "member"], shortcut: ["⌘", "I"] },
  { id: "act-new-agent",    kind: "action",   label: "Create New Agent",      emoji: "🤖", category: "Actions", keywords: ["create", "agent", "new"], shortcut: ["⌘", "N"] },
  { id: "act-copy-key",     kind: "action",   label: "Copy API Key",          emoji: "🗝️", category: "Actions", keywords: ["api", "key", "copy", "token"] },
  { id: "act-run-cron",     kind: "action",   label: "Run Cron Now",          emoji: "⏰", category: "Actions", keywords: ["cron", "run", "trigger", "schedule"], recent: true },
  { id: "act-clear-cache",  kind: "action",   label: "Clear Session Cache",   emoji: "🗑️", category: "Actions", keywords: ["clear", "cache", "reset"] },
  // Agents
  { id: "ag-luis",          kind: "agent",    label: "Message Luis",          emoji: "🎨", category: "Agents", keywords: ["luis", "ux", "design"], description: "Principal UX Engineer" },
  { id: "ag-xavier",        kind: "agent",    label: "Message Xavier",        emoji: "🎯", category: "Agents", keywords: ["xavier", "cto", "tech"], description: "CTO" },
  { id: "ag-stephan",       kind: "agent",    label: "Message Stephan",       emoji: "📣", category: "Agents", keywords: ["stephan", "cmo", "brand"], description: "CMO" },
  { id: "ag-tim",           kind: "agent",    label: "Message Tim",           emoji: "🏗️", category: "Agents", keywords: ["tim", "vp", "arch"], description: "VP Architecture" },
  { id: "ag-piper",         kind: "agent",    label: "Message Piper",         emoji: "🧩", category: "Agents", keywords: ["piper", "ui", "component"], description: "UI Specialist" },
  // Models
  { id: "mdl-sonnet",       kind: "model",    label: "Switch to Claude Sonnet 4.6",  emoji: "🟠", category: "Models", keywords: ["claude", "sonnet", "anthropic"] },
  { id: "mdl-opus",         kind: "model",    label: "Switch to Claude Opus 4.6",    emoji: "🟠", category: "Models", keywords: ["claude", "opus", "anthropic"] },
  { id: "mdl-flash",        kind: "model",    label: "Switch to Gemini 3 Flash",     emoji: "🔵", category: "Models", keywords: ["gemini", "flash", "google"] },
  // Settings
  { id: "set-dark",         kind: "setting",  label: "Toggle Dark Mode",      emoji: "🌙", category: "Settings", keywords: ["dark", "light", "mode", "theme"] },
  { id: "set-notif",        kind: "setting",  label: "Notification Settings", emoji: "🔔", category: "Settings", keywords: ["notify", "notification", "alert"] },
  { id: "set-api",          kind: "setting",  label: "API Settings",          emoji: "⚙️", category: "Settings", keywords: ["api", "setting", "config"] },
  // Shortcuts
  { id: "sh-help",          kind: "shortcut", label: "Show Keyboard Shortcuts", emoji: "⌨️", category: "Help", keywords: ["help", "keyboard", "shortcut"], shortcut: ["?"], pinned: true },
  { id: "sh-search",        kind: "shortcut", label: "Search Everything",       emoji: "🔍", category: "Help", keywords: ["search", "find", "query"], shortcut: ["⌘", "K"], pinned: true },
];

const RECENT_IDS = new Set(["nav-theme", "nav-builder", "act-run-cron"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const KIND_COLORS: Record<CommandKind, string> = {
  navigate: "text-indigo-400",
  action:   "text-emerald-400",
  agent:    "text-violet-400",
  file:     "text-zinc-400",
  model:    "text-orange-400",
  setting:  "text-amber-400",
  search:   "text-blue-400",
  shortcut: "text-pink-400",
};

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) {return text;}
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) {return text;}
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-indigo-500/30 text-indigo-200 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CommandItemProps {
  command: Command;
  active: boolean;
  query: string;
  onActivate: () => void;
}

function CommandItem({ command, active, query, onActivate }: CommandItemProps) {
  return (
    <button
      onClick={onActivate}
      aria-selected={active}
      className={cn(
        "w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 focus-visible:outline-none",
        active ? "bg-indigo-600/20 text-white" : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
      )}
    >
      <span className="text-lg w-7 text-center shrink-0" aria-hidden="true">{command.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {highlight(command.label, query)}
        </p>
        {command.description && (
          <p className="text-xs text-zinc-500 truncate">{command.description}</p>
        )}
      </div>
      {command.shortcut && (
        <div className="flex items-center gap-1 shrink-0">
          {command.shortcut.map((k, i) => (
            <kbd
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 border border-zinc-600 text-zinc-300 font-mono"
            >
              {k}
            </kbd>
          ))}
        </div>
      )}
      <span className={cn("text-xs shrink-0", KIND_COLORS[command.kind])}>
        {command.kind}
      </span>
    </button>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function CommandPalette() {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      // Show pinned + recent
      const pinned = COMMANDS.filter(c => c.pinned);
      const recent = COMMANDS.filter(c => RECENT_IDS.has(c.id) && !c.pinned);
      return [...pinned, ...recent].slice(0, 8);
    }

    return COMMANDS.filter(c => {
      return (
        c.label.toLowerCase().includes(q) ||
        c.keywords.some(k => k.includes(q)) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }).slice(0, 12);
  }, [query]);

  // Group results by category
  const grouped = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of results) {
      const cat = query.trim() ? cmd.category : (cmd.pinned ? "Pinned" : "Recent");
      if (!groups[cat]) {groups[cat] = [];}
      groups[cat].push(cmd);
    }
    return groups;
  }, [results, query]);

  const flatResults = useMemo(() => results, [results]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatResults[activeIndex]) {
        handleExecute(flatResults[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setQuery("");
    }
  }, [flatResults, activeIndex]);

  function handleExecute(cmd: Command) {
    setLastExecuted(cmd.id);
    setTimeout(() => setLastExecuted(null), 1500);
    console.log("Execute command:", cmd.id, cmd.label);
  }

  // Reset active index on query change
  useEffect(() => { setActiveIndex(0); }, [query]);

  let flatIndex = 0;

  return (
    <main className="flex flex-col h-full bg-zinc-950 text-white overflow-hidden" role="main" aria-label="Command Palette">
      <div className="flex flex-col h-full max-w-2xl mx-auto w-full px-6 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Command Palette</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Keyboard-driven command interface. Press <kbd className="text-xs bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded font-mono">⌘K</kbd> anywhere to open.
          </p>
        </div>

        {/* Palette UI */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-2xl">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
            <span className="text-zinc-500 text-lg" aria-hidden="true">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search…"
              aria-label="Command search"
              aria-autocomplete="list"
              aria-controls="command-results"
              role="combobox"
              aria-expanded="true"
              aria-activedescendant={flatResults[activeIndex] ? `cmd-${flatResults[activeIndex].id}` : undefined}
              className={cn(
                "flex-1 bg-transparent text-white placeholder:text-zinc-500 text-base outline-none",
                "focus-visible:outline-none"
              )}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className={cn(
                  "text-zinc-500 hover:text-white transition-colors text-sm",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded"
                )}
              >
                ✕
              </button>
            )}
            <kbd className="text-xs text-zinc-600 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded font-mono">Esc</kbd>
          </div>

          {/* Results */}
          <div
            id="command-results"
            role="listbox"
            aria-label="Commands"
            className="max-h-96 overflow-y-auto p-2"
          >
            {flatResults.length === 0 ? (
              <div className="text-center py-10 text-zinc-500">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-sm">No commands match "{query}"</p>
              </div>
            ) : (
              Object.entries(grouped).map(([cat, cmds]) => (
                <div key={cat}>
                  <p className="px-4 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                    {cat}
                  </p>
                  {cmds.map(cmd => {
                    const idx = flatIndex++;
                    return (
                      <div key={cmd.id} role="option" id={`cmd-${cmd.id}`} aria-selected={activeIndex === idx}>
                        <CommandItem
                          command={cmd}
                          active={activeIndex === idx}
                          query={query}
                          onActivate={() => handleExecute(cmd)}
                        />
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-800 px-4 py-2 flex items-center gap-4 text-[10px] text-zinc-600">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> execute</span>
            <span><kbd className="font-mono">Esc</kbd> clear</span>
            <span className="ml-auto">{flatResults.length} results</span>
          </div>
        </div>

        {/* Last executed */}
        {lastExecuted && (
          <div className="mt-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 px-4 py-3 flex items-center gap-2" role="status" aria-live="polite">
            <span className="text-emerald-400 text-sm">✓</span>
            <span className="text-sm text-emerald-300">
              Executed: <span className="font-semibold">{COMMANDS.find(c => c.id === lastExecuted)?.label}</span>
            </span>
          </div>
        )}

        {/* Shortcut cheatsheet */}
        <div className="mt-6 rounded-xl bg-zinc-900 border border-zinc-800 p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Keyboard Shortcuts</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { keys: ["⌘", "K"],    label: "Open command palette" },
              { keys: ["⌘", "N"],    label: "New agent" },
              { keys: ["⌘", "I"],    label: "Invite member" },
              { keys: ["G", "D"],    label: "Go to dashboard" },
              { keys: ["G", "C"],    label: "Open chat" },
              { keys: ["?"],          label: "Show shortcuts" },
              { keys: ["↑", "↓"],   label: "Navigate results" },
              { keys: ["↵"],          label: "Execute command" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="flex items-center gap-1 shrink-0">
                  {s.keys.map((k, i) => (
                    <kbd key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono">
                      {k}
                    </kbd>
                  ))}
                </div>
                <span className="text-xs text-zinc-500">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category summary */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: "Navigation", count: COMMANDS.filter(c => c.kind === "navigate").length, color: "text-indigo-400" },
            { label: "Actions",    count: COMMANDS.filter(c => c.kind === "action").length,   color: "text-emerald-400" },
            { label: "Agents",     count: COMMANDS.filter(c => c.kind === "agent").length,    color: "text-violet-400" },
            { label: "Models",     count: COMMANDS.filter(c => c.kind === "model").length,    color: "text-orange-400" },
          ].map(cat => (
            <div key={cat.label} className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center">
              <p className={cn("text-xl font-bold", cat.color)}>{cat.count}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{cat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
