/**
 * React Query hooks for overseer goal management.
 */

import { useQuery } from "@tanstack/react-query";
import {
  getOverseerStatus,
  listOverseerGoals,
  getGoalStatus,
  type OverseerStatusResult,
  type OverseerGoalStatusResult,
  type OverseerGoal,
} from "@/lib/api/overseer";

// Re-export types for convenience
export type { OverseerStatusResult, OverseerGoalStatusResult };
export type OverseerGoalSummary = OverseerGoal;
export type OverseerGoalDetail = OverseerGoalStatusResult;

// Query keys factory
export const overseerKeys = {
  all: ["overseer"] as const,
  status: () => [...overseerKeys.all, "status"] as const,
  goals: () => [...overseerKeys.all, "goals"] as const,
  goalsList: (filters: Record<string, unknown>) =>
    [...overseerKeys.goals(), "list", filters] as const,
  goalDetail: (id: string) => [...overseerKeys.goals(), "detail", id] as const,
  stalledAssignments: () => [...overseerKeys.all, "stalled"] as const,
};

/**
 * Hook to get current overseer status
 */
export function useOverseerStatus() {
  return useQuery({
    queryKey: overseerKeys.status(),
    queryFn: getOverseerStatus,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to list all overseer goals
 */
export function useOverseerGoals(params?: {
  status?: OverseerGoal["status"];
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: overseerKeys.goalsList(params ?? {}),
    queryFn: () => listOverseerGoals(params),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to get a specific overseer goal
 */
export function useOverseerGoal(goalId: string) {
  return useQuery({
    queryKey: overseerKeys.goalDetail(goalId),
    queryFn: () => getGoalStatus(goalId),
    enabled: !!goalId,
  });
}

/**
 * Hook to get stalled goal assignments
 * (goals that have been running longer than expected)
 */
export function useOverseerStalledAssignments() {
  return useQuery({
    queryKey: overseerKeys.stalledAssignments(),
    queryFn: async (): Promise<OverseerGoal[]> => {
      const result = await listOverseerGoals({ status: "running" });
      // Filter for goals running longer than 1 hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      return result.goals.filter((goal) => {
        if (!goal.startedAt) return false;
        return new Date(goal.startedAt).getTime() < oneHourAgo;
      });
    },
    staleTime: 1000 * 60, // 1 minute
  });
}
