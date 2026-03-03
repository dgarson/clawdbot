import { useQuery } from "@tanstack/react-query";

export type ActivityType =
  | "session_started"
  | "message_sent"
  | "tool_called"
  | "task_completed"
  | "task_failed"
  | "agent_spawned"
  | "file_edited";

export interface AgentActivity {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  type: ActivityType;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Mock activity data — structured for easy swap to real gateway API.
 * TODO: Replace with `api.getAgentActivity({ limit })` when endpoint exists.
 */
function generateMockActivity(): AgentActivity[] {
  const now = Date.now();

  return [
    {
      id: "act-1",
      agentId: "xavier",
      agentName: "Xavier",
      type: "tool_called",
      description: "Ran shell command: git status",
      timestamp: new Date(now - 2 * 60 * 1000).toISOString(),
    },
    {
      id: "act-2",
      agentId: "luis",
      agentName: "Luis",
      type: "file_edited",
      description: "Updated AppShell.tsx — skip navigation",
      timestamp: new Date(now - 8 * 60 * 1000).toISOString(),
    },
    {
      id: "act-3",
      agentId: "stephan",
      agentName: "Stephan",
      type: "session_started",
      description: "New session: marketing copy review",
      timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
    },
    {
      id: "act-4",
      agentId: "julia",
      agentName: "Julia",
      type: "task_completed",
      description: "PR #247 review completed — approved",
      timestamp: new Date(now - 22 * 60 * 1000).toISOString(),
    },
    {
      id: "act-5",
      agentId: "xavier",
      agentName: "Xavier",
      type: "message_sent",
      description: "Replied in #engineering channel",
      timestamp: new Date(now - 35 * 60 * 1000).toISOString(),
    },
    {
      id: "act-6",
      agentId: "luis",
      agentName: "Luis",
      type: "agent_spawned",
      description: "Spawned sub-agent for accessibility audit",
      timestamp: new Date(now - 48 * 60 * 1000).toISOString(),
    },
    {
      id: "act-7",
      agentId: "stephan",
      agentName: "Stephan",
      type: "task_failed",
      description: "Twitter API rate limit exceeded",
      timestamp: new Date(now - 62 * 60 * 1000).toISOString(),
    },
    {
      id: "act-8",
      agentId: "julia",
      agentName: "Julia",
      type: "tool_called",
      description: "Web search: Vite 7 migration guide",
      timestamp: new Date(now - 80 * 60 * 1000).toISOString(),
    },
  ];
}

export function useAgentActivity(limit: number = 8) {
  return useQuery({
    queryKey: ["agent-activity", limit],
    queryFn: async () => {
      // TODO: Replace with real API call
      // const data = await api.getAgentActivity({ limit });
      return generateMockActivity().slice(0, limit);
    },
    refetchInterval: 30_000, // Auto-refresh every 30s
    staleTime: 15_000,
  });
}
