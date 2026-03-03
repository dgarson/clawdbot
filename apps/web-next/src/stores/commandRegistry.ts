import { create } from 'zustand';

export interface Command {
  id: string;
  label: string;
  category: 'recent' | 'navigation' | 'actions' | 'agents' | 'search' | string;
  keywords?: string[];
  emoji?: string;
  shortcut?: string;
  action: () => void;
}

interface CommandRegistryState {
  commands: Command[];
  recentCommands: string[]; // command IDs
  initialized: boolean;
  addCommand: (command: Command) => void;
  removeCommand: (id: string) => void;
  executeCommand: (id: string) => void;
  getCommands: () => Command[];
  initialize: () => void;
}

const MAX_RECENT = 10;

export const useCommandRegistry = create<CommandRegistryState>((set, get) => ({
  commands: [],
  recentCommands: [],
  initialized: false,

  addCommand: (command) => {
    set((state) => {
      const exists = state.commands.find((c) => c.id === command.id);
      if (exists) return state;
      return { commands: [...state.commands, command] };
    });
  },

  removeCommand: (id) => {
    set((state) => ({
      commands: state.commands.filter((c) => c.id !== id),
      recentCommands: state.recentCommands.filter((rid) => rid !== id),
    }));
  },

  executeCommand: (id) => {
    const command = get().commands.find((c) => c.id === id);
    if (command) {
      command.action();
      // Add to recent
      set((state) => {
        const filtered = state.recentCommands.filter((rid) => rid !== id);
        return {
          recentCommands: [id, ...filtered].slice(0, MAX_RECENT),
        };
      });
    }
  },

  getCommands: () => {
    const state = get();
    // Sort recent commands first
    const recentCmds = state.recentCommands
      .map((id) => state.commands.find((c) => c.id === id))
      .filter(Boolean) as Command[];
    const otherCmds = state.commands.filter(
      (c) => !state.recentCommands.includes(c.id)
    );
    return [...recentCmds, ...otherCmds];
  },

  initialize: () => {
    const state = get();
    if (state.initialized) return;
    
    // Navigation commands
    state.addCommand({
      id: 'nav-agents',
      label: 'Go to Agents',
      category: 'navigation',
      keywords: ['agents', 'list', 'view'],
      emoji: '🤖',
      action: () => {
        window.location.href = '/agents';
      },
    });

    state.addCommand({
      id: 'nav-settings',
      label: 'Go to Settings',
      category: 'navigation',
      keywords: ['settings', 'config', 'preferences'],
      emoji: '⚙️',
      action: () => {
        window.location.href = '/settings';
      },
    });

    state.addCommand({
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      category: 'navigation',
      keywords: ['dashboard', 'home', 'overview'],
      emoji: '📊',
      action: () => {
        window.location.href = '/';
      },
    });

    state.addCommand({
      id: 'nav-channels',
      label: 'Go to Channels',
      category: 'navigation',
      keywords: ['channels', 'connections', 'integrations'],
      emoji: '💬',
      action: () => {
        window.location.href = '/channels';
      },
    });

    state.addCommand({
      id: 'nav-sessions',
      label: 'Go to Sessions',
      category: 'navigation',
      keywords: ['sessions', 'history', 'conversations'],
      emoji: '💭',
      action: () => {
        window.location.href = '/sessions';
      },
    });

    // Action commands
    state.addCommand({
      id: 'action-create-agent',
      label: 'Create New Agent',
      category: 'actions',
      keywords: ['create', 'new', 'agent', 'add'],
      emoji: '✨',
      shortcut: 'N',
      action: () => {
        window.location.href = '/agents/new';
      },
    });

    state.addCommand({
      id: 'action-create-channel',
      label: 'Add Channel',
      category: 'actions',
      keywords: ['add', 'channel', 'connect', 'new'],
      emoji: '🔗',
      action: () => {
        window.location.href = '/channels/new';
      },
    });

    state.addCommand({
      id: 'action-toggle-theme',
      label: 'Toggle Theme',
      category: 'actions',
      keywords: ['theme', 'dark', 'light', 'mode', 'toggle'],
      emoji: '🌓',
      action: () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem(
          'theme',
          document.documentElement.classList.contains('dark') ? 'dark' : 'light'
        );
      },
    });

    set({ initialized: true });
  },
}));
