/**
 * Agent Status Dashboard hooks.
 *
 * Combines React Query polling with gateway WebSocket events
 * for a real-time view of running agents.
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAgentStatus,
  type AgentStatusSnapshot,
  type AgentStatusEntry,
  type AgentHealthStatus,
} from "@/lib/api/agent-status";
import { useOptionalGateway } from "@/providers/GatewayProvider";
import type { GatewayEvent } from "@/lib/api";
import { useGatewayEnabled } from "../useGatewayEnabled";

// Re-export types for consumers
export type { AgentStatusEntry, AgentHealthStatus, AgentStatusSnapshot } from "@/lib/api/agent-status";

// ── Query keys ─────────────────────────────────────────────────────

export const agentStatusKeys = {
  all: ["agent-status"] as const,
  snapshot: () => [...agentStatusKeys.all, "snapshot"] as const,
};

// ── Main hook ──────────────────────────────────────────────────────

export interface UseAgentStatusDashboardOptions {
  /** Polling interval in ms (default: 10000) */
  pollInterval?: number;
  /** Enable WebSocket live updates (default: true) */
  enableStreaming?: boolean;
}

export function useAgentStatusDashboard(options: UseAgentStatusDashboardOptions = {}) {
  const { pollInterval = 10_000, enableStreaming = true } = options;

  const liveMode = useGatewayEnabled();

  const queryClient = useQueryClient();
  const gatewayCtx = useOptionalGateway();

  // ── Query for initial + polled data ─────────────────────────────
  const query = useQuery({
    queryKey: agentStatusKeys.snapshot(),
    queryFn: () => getAgentStatus(liveMode),
    refetchInterval: pollInterval,
    staleTime: 5_000,
  });

  // ── WebSocket streaming updates ─────────────────────────────────
  React.useEffect(() => {
    if (!enableStreaming || !gatewayCtx) return;

    const handleEvent = (event: GatewayEvent) => {
      // Handle agent-level events
      if (event.event === "agent" || event.event === "agent.status") {
        const payload = event.payload as Record<string, unknown> | undefined;
        if (!payload) return;

        const agentId =
          typeof payload.agentId === "string"
            ? payload.agentId
            : typeof payload.id === "string"
              ? payload.id
              : null;

        if (!agentId) return;

        // Optimistic update of cached snapshot
        queryClient.setQueryData<AgentStatusSnapshot>(
          agentStatusKeys.snapshot(),
          (prev) => {
            if (!prev) return prev;
            const agents = prev.agents.map((a) => {
              if (a.id !== agentId) return a;
              return {
                ...a,
                health: (typeof payload.health === "string"
                  ? payload.health
                  : a.health) as AgentHealthStatus,
                currentTask:
                  typeof payload.currentTask === "string"
                    ? payload.currentTask
                    : a.currentTask,
                lastActivityAt:
                  typeof payload.lastActivityAt === "number"
                    ? payload.lastActivityAt
                    : Date.now(),
                resources: {
                  ...a.resources,
                  ...(typeof payload.tokensUsed === "number"
                    ? { tokensUsed: payload.tokensUsed }
                    : {}),
                  ...(typeof payload.estimatedCost === "number"
                    ? { estimatedCost: payload.estimatedCost }
                    : {}),
                },
              };
            });
            return { ...prev, agents, timestamp: Date.now() };
          }
        );
      }

      // Handle chat events to mark agent as active
      if (event.event === "chat") {
        const payload = event.payload as Record<string, unknown> | undefined;
        const sessionKey = typeof payload?.sessionKey === "string" ? payload.sessionKey : null;
        if (!sessionKey) return;

        const agentIdMatch = sessionKey.match(/^agent:([^:]+)/);
        if (!agentIdMatch) return;
        const agentId = agentIdMatch[1];

        queryClient.setQueryData<AgentStatusSnapshot>(
          agentStatusKeys.snapshot(),
          (prev) => {
            if (!prev) return prev;
            const agents = prev.agents.map((a) => {
              if (a.id !== agentId) return a;
              return { ...a, health: "active" as const, lastActivityAt: Date.now() };
            });
            return { ...prev, agents, timestamp: Date.now() };
          }
        );
      }

      // Handle tool.pending events
      if (event.event === "tool.pending") {
        const payload = event.payload as Record<string, unknown> | undefined;
        const agentId = typeof payload?.agentId === "string" ? payload.agentId : null;
        if (!agentId) return;

        queryClient.setQueryData<AgentStatusSnapshot>(
          agentStatusKeys.snapshot(),
          (prev) => {
            if (!prev) return prev;
            const agents = prev.agents.map((a) => {
              if (a.id !== agentId) return a;
              return {
                ...a,
                health: "stalled" as const,
                pendingApprovals: (a.pendingApprovals ?? 0) + 1,
                lastActivityAt: Date.now(),
              };
            });
            return { ...prev, agents, timestamp: Date.now() };
          }
        );
      }
    };

    return gatewayCtx.addEventListener(handleEvent);
  }, [enableStreaming, gatewayCtx, queryClient]);

  return query;
}

// ── Derived hooks ──────────────────────────────────────────────────

/** Summary stats for the dashboard header */
export function useAgentStatusSummary(agents: AgentStatusEntry[] | undefined) {
  return React.useMemo(() => {
    if (!agents) {
      return { total: 0, active: 0, idle: 0, stalled: 0, errored: 0, totalCost: 0, totalTokens: 0 };
    }
    return {
      total: agents.length,
      active: agents.filter((a) => a.health === "active").length,
      idle: agents.filter((a) => a.health === "idle").length,
      stalled: agents.filter((a) => a.health === "stalled").length,
      errored: agents.filter((a) => a.health === "errored").length,
      totalCost: agents.reduce((sum, a) => sum + a.resources.estimatedCost, 0),
      totalTokens: agents.reduce((sum, a) => sum + a.resources.tokensUsed, 0),
    };
  }, [agents]);
}
