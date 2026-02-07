import { create } from "zustand";

export type AgentStatus = "online" | "offline" | "busy" | "paused";

export interface Agent {
  id: string;
  name: string;
  role: string;
  model?: string;
  runtime?: "pi" | "claude";
  claudeSdkOptions?: {
    provider?: "anthropic" | "zai" | "openrouter";
    models?: {
      opus?: string;
      sonnet?: string;
      haiku?: string;
      subagent?: string;
    };
  };
  avatar?: string;
  status: AgentStatus;
  description?: string;
  tags?: string[];
  taskCount?: number;
  lastActive?: string;
  currentTask?: string;
  pendingApprovals?: number;
  pendingToolCallIds?: string[];
}

export interface AgentState {
  agents: Agent[];
  selectedAgentId: string | null;
}

export interface AgentActions {
  selectAgent: (id: string | null) => void;
  updateAgentStatus: (id: string, status: AgentStatus) => void;
  setAgents: (agents: Agent[]) => void;
  upsertAgents: (agents: Agent[]) => void;
  upsertAgent: (agent: Agent) => void;
  patchAgent: (id: string, patch: Partial<Agent>) => void;
  updateAgentWith: (id: string, updater: (agent: Agent) => Agent) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
}

export type AgentStore = AgentState & AgentActions;

export const useAgentStore = create<AgentStore>()((set) => ({
  // State
  agents: [],
  selectedAgentId: null,

  // Actions
  selectAgent: (id) => set({ selectedAgentId: id }),

  updateAgentStatus: (id, status) =>
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id ? { ...agent, status } : agent
      ),
    })),

  setAgents: (agents) => set({ agents }),

  upsertAgents: (agents) =>
    set((state) => {
      const map = new Map(state.agents.map((agent) => [agent.id, agent]));
      agents.forEach((agent) => {
        const existing = map.get(agent.id);
        map.set(agent.id, {
          ...existing,
          ...agent,
          currentTask: agent.currentTask ?? existing?.currentTask,
          pendingApprovals: agent.pendingApprovals ?? existing?.pendingApprovals,
          pendingToolCallIds: agent.pendingToolCallIds ?? existing?.pendingToolCallIds,
        });
      });
      return { agents: Array.from(map.values()) };
    }),

  upsertAgent: (agent) =>
    set((state) => {
      const existing = state.agents.find((entry) => entry.id === agent.id);
      if (!existing) {
        return { agents: [...state.agents, agent] };
      }
      return {
        agents: state.agents.map((entry) =>
          entry.id === agent.id
            ? {
                ...entry,
                ...agent,
                currentTask: agent.currentTask ?? entry.currentTask,
                pendingApprovals: agent.pendingApprovals ?? entry.pendingApprovals,
                pendingToolCallIds: agent.pendingToolCallIds ?? entry.pendingToolCallIds,
              }
            : entry
        ),
      };
    }),

  patchAgent: (id, patch) =>
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id ? { ...agent, ...patch } : agent
      ),
    })),

  updateAgentWith: (id, updater) =>
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id ? updater(agent) : agent
      ),
    })),

  addAgent: (agent) =>
    set((state) => ({
      agents: [...state.agents, agent],
    })),

  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((agent) => agent.id !== id),
      selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
    })),
}));
