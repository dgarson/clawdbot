import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { getConfig } from "@/lib/api";
import { getAgentsList, mapAgentEntryToAgent } from "@/lib/agents";
import { useUIStore } from "@/stores/useUIStore";
import { useAgentStore } from "@/stores/useAgentStore";
import {
  useLiveAgents,
  useLiveAgentIdentity,
  type AgentsListResult,
  type AgentIdentityResult,
} from "@/lib/api/gateway-hooks";

// Re-export types from store for consistency
export type { Agent, AgentStatus } from "../../stores/useAgentStore";
import type { Agent } from "../../stores/useAgentStore";

// Query keys factory for type-safe cache management
export const agentKeys = {
  all: ["agents"] as const,
  lists: () => [...agentKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...agentKeys.lists(), filters] as const,
  details: () => [...agentKeys.all, "detail"] as const,
  detail: (id: string, mode?: "live" | "mock") => [...agentKeys.details(), id, mode] as const,
};

// ---------------------------------------------------------------------------
// Mock data for dev mode without gateway
// ---------------------------------------------------------------------------

const mockAgents: Agent[] = [
  {
    id: "1",
    name: "Research Assistant",
    role: "Researcher",
    model: "anthropic/claude-3.5-sonnet",
    runtime: "pi",
    status: "online",
    description: "Helps with research tasks and information gathering",
    tags: ["research", "analysis", "data"],
    taskCount: 5,
    lastActive: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Code Helper",
    role: "Developer",
    model: "openai/gpt-4o",
    runtime: "pi",
    status: "busy",
    currentTask: "Refactoring routing guardrails",
    description: "Assists with coding, debugging, and code reviews",
    tags: ["code", "debug", "review"],
    taskCount: 3,
    lastActive: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "3",
    name: "Writing Coach",
    role: "Editor",
    model: "anthropic/claude-3-opus",
    runtime: "pi",
    status: "online",
    description: "Helps improve writing and provides editorial feedback",
    tags: ["writing", "editing", "grammar"],
    taskCount: 2,
    lastActive: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "4",
    name: "Task Manager",
    role: "Coordinator",
    model: "openai/gpt-4-turbo",
    runtime: "pi",
    status: "paused",
    currentTask: "Approve tool access for export flow",
    pendingApprovals: 2,
    pendingToolCallIds: ["tool-approval-1", "tool-approval-2"],
    description: "Coordinates tasks and manages workflows",
    tags: ["tasks", "coordination", "planning"],
    taskCount: 8,
    lastActive: new Date(Date.now() - 86400000).toISOString(),
  },
];

async function fetchMockAgents(): Promise<Agent[]> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return mockAgents;
}

// ---------------------------------------------------------------------------
// Map gateway data to UI Agent type
// ---------------------------------------------------------------------------

function mapGatewayAgentToAgent(
  row: AgentsListResult["agents"][number],
  identity?: AgentIdentityResult | null,
  isDefault?: boolean,
): Agent {
  const name = identity?.name ?? row.identity?.name ?? row.name ?? row.id;
  const emoji = identity?.emoji ?? row.identity?.emoji;
  const avatar = identity?.avatar ?? row.identity?.avatar ?? row.identity?.avatarUrl;

  return {
    id: row.id,
    name,
    role: row.identity?.theme ?? "Agent",
    model: undefined, // Model comes from config, not agent list
    runtime: "pi",
    avatar: avatar ?? undefined,
    status: "online", // Status comes from live events, default to online
    description: emoji ? `${emoji} ${name}` : undefined,
    tags: [],
    taskCount: 0,
    lastActive: undefined,
  };
}

// ---------------------------------------------------------------------------
// Legacy config-based fetch (fallback)
// ---------------------------------------------------------------------------

async function fetchAgentsFromConfig(liveMode: boolean): Promise<Agent[]> {
  if (!liveMode) {
    return fetchMockAgents();
  }
  try {
    const snapshot = await getConfig();
    if (snapshot?.config) {
      const list = getAgentsList(snapshot.config);
      return list.map(mapAgentEntryToAgent);
    }
    return [];
  } catch {
    return fetchMockAgents();
  }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Primary hook for fetching agents.
 *
 * When connected to a live gateway, uses the `agents.list` RPC.
 * Falls back to mock data in dev mode without gateway.
 */
export function useAgents() {
  const useLiveGateway = useUIStore((state) => state.useLiveGateway);
  const isDev = import.meta.env?.DEV ?? false;
  const liveMode = !isDev || useLiveGateway;

  const upsertAgents = useAgentStore((s) => s.upsertAgents);
  const storeAgents = useAgentStore((s) => s.agents);

  // Live gateway query
  const liveQuery = useLiveAgents();

  // Fallback mock query (only when not using live gateway)
  const mockQuery = useQuery({
    queryKey: agentKeys.list({ mode: "mock" }),
    queryFn: () => fetchMockAgents(),
    staleTime: 1000 * 60 * 5,
    enabled: !liveMode,
  });

  // Choose active data source
  const isLive = liveMode && liveQuery.data != null;
  const isLoading = liveMode ? liveQuery.isLoading : mockQuery.isLoading;
  const error = liveMode ? liveQuery.error : mockQuery.error;

  // Map live agents to UI type
  const liveAgents = React.useMemo(() => {
    if (!liveQuery.data?.agents) return [];
    return liveQuery.data.agents.map((row) =>
      mapGatewayAgentToAgent(row, null, row.id === liveQuery.data!.defaultId),
    );
  }, [liveQuery.data]);

  const agents = isLive ? liveAgents : (mockQuery.data ?? []);

  // Sync to zustand store
  React.useEffect(() => {
    if (agents.length > 0) {
      upsertAgents(agents);
    }
  }, [agents, upsertAgents]);

  // Merge with live store data (status updates from events, etc.)
  const mergedAgents = React.useMemo(() => {
    if (storeAgents.length === 0) return agents;
    const byId = new Map(storeAgents.map((agent) => [agent.id, agent]));
    return agents.map((agent) => {
      const live = byId.get(agent.id);
      if (!live) return agent;
      return {
        ...agent,
        ...live,
        currentTask: live.currentTask ?? agent.currentTask,
        pendingApprovals: live.pendingApprovals ?? agent.pendingApprovals,
        pendingToolCallIds: live.pendingToolCallIds ?? agent.pendingToolCallIds,
      };
    });
  }, [agents, storeAgents]);

  return {
    data: mergedAgents,
    isLoading,
    error,
    isLive,
    refetch: liveMode ? liveQuery.refetch : mockQuery.refetch,
  };
}

export function useAgent(id: string) {
  const { data: agents, isLoading, error, isLive } = useAgents();
  const agent = React.useMemo(
    () => agents?.find((a) => a.id === id) ?? null,
    [agents, id],
  );
  return { data: agent, isLoading, error, isLive };
}

export function useAgentsByStatus(status: Agent["status"]) {
  const { data: agents, isLoading, error, isLive } = useAgents();
  const filtered = React.useMemo(
    () => agents?.filter((a) => a.status === status) ?? [],
    [agents, status],
  );
  return { data: filtered, isLoading, error, isLive };
}

/**
 * Hook to fetch a single agent's full identity (name, avatar, emoji).
 */
export function useAgentIdentity(agentId: string | undefined) {
  return useLiveAgentIdentity(agentId);
}

/**
 * Update an agent's status (e.g., from gateway events).
 */
export function useUpdateAgentStatus() {
  const patchAgent = useAgentStore((s) => s.patchAgent);
  return React.useCallback(
    (agentId: string, status: Agent["status"]) => {
      patchAgent(agentId, { status });
    },
    [patchAgent],
  );
}
