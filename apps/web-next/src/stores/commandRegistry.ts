import { create } from 'zustand';

export interface Command {
  id: string;
  label: string;
  emoji?: string;
  category: 'navigation' | 'actions' | 'recent' | 'agents' | 'search';
  keywords?: string[];
  shortcut?: string;
  action: () => void;
}

interface CommandRegistry {
  commands: Command[];
  register: (command: Command) => void;
  unregister: (id: string) => void;
  getCommands: () => Command[];
}

export const useCommandRegistry = create<CommandRegistry>((set, get) => ({
  commands: [],
  register: (command) => set((state) => ({ 
    commands: [...state.commands.filter(c => c.id !== command.id), command] 
  })),
  unregister: (id) => set((state) => ({ 
    commands: state.commands.filter(c => c.id !== id) 
  })),
  getCommands: () => get().commands,
}));
