/**
 * React Query hooks for cron job management.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import {
  listCronJobs,
  getCronJob,
  type CronJob,
  type CronJobListResult,
  getCronRuns,
  type CronRunEntry,
  getCronRunLog,
  type CronRunTimelineEntry,
} from "@/lib/api/cron";
import { useOptionalGateway } from "@/providers/GatewayProvider";

// Additional types for status and run history
export interface CronStatusResult {
  enabled: boolean;
  totalJobs: number;
  enabledJobs: number;
  runningJobs: number;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface CronRunLogResult {
  entries: CronRunTimelineEntry[];
}

export interface CronRunsResult {
  runs: CronRunEntry[];
  total: number;
}

// Query keys factory
export const cronKeys = {
  all: ["cron"] as const,
  status: () => [...cronKeys.all, "status"] as const,
  lists: () => [...cronKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...cronKeys.lists(), filters] as const,
  details: () => [...cronKeys.all, "detail"] as const,
  detail: (id: string) => [...cronKeys.details(), id] as const,
  runs: () => [...cronKeys.all, "runs"] as const,
  runHistory: (jobId?: string) => [...cronKeys.runs(), jobId ?? "all"] as const,
  runLog: (sessionKey?: string) => [...cronKeys.runs(), "log", sessionKey ?? "none"] as const,
};

/**
 * Hook to list all cron jobs
 */
export function useCronJobs(params?: { enabled?: boolean; agentId?: string }) {
  return useQuery({
    queryKey: cronKeys.list(params ?? {}),
    queryFn: () => listCronJobs(params),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to get a specific cron job
 */
export function useCronJob(id: string) {
  return useQuery({
    queryKey: cronKeys.detail(id),
    queryFn: () => getCronJob(id),
    enabled: !!id,
  });
}

/**
 * Hook to get cron jobs filtered by agent
 */
export function useCronJobsByAgent(agentId: string) {
  return useCronJobs({ agentId });
}

/**
 * Hook to get only enabled cron jobs
 */
export function useEnabledCronJobs() {
  return useCronJobs({ enabled: true });
}

/**
 * Hook to get overall cron status
 */
export function useCronStatus() {
  return useQuery({
    queryKey: cronKeys.status(),
    queryFn: async (): Promise<CronStatusResult> => {
      const result = await listCronJobs();
      const enabledJobs = result.jobs.filter((job) => job.enabled);
      const runningJobs = result.jobs.filter((job) => job.state.runningAtMs);

      // Find the most recent last run and earliest next run
      const lastRunTimes = result.jobs
        .filter((job) => job.state.lastRunAtMs)
        .map((job) => job.state.lastRunAtMs!);
      const nextRunTimes = result.jobs
        .filter((job) => job.state.nextRunAtMs && job.enabled)
        .map((job) => job.state.nextRunAtMs!);

      return {
        enabled: enabledJobs.length > 0,
        totalJobs: result.total,
        enabledJobs: enabledJobs.length,
        runningJobs: runningJobs.length,
        lastRunAt:
          lastRunTimes.length > 0
            ? new Date(Math.max(...lastRunTimes)).toISOString()
            : undefined,
        nextRunAt:
          nextRunTimes.length > 0
            ? new Date(Math.min(...nextRunTimes)).toISOString()
            : undefined,
      };
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to get run history for cron jobs
 * @param jobId - Optional job ID to filter runs
 */
export function useCronRunHistory(jobId?: string) {
  return useQuery({
    queryKey: cronKeys.runHistory(jobId),
    queryFn: async (): Promise<CronRunsResult> => {
      if (!jobId) {
        return { runs: [], total: 0 };
      }
      const result = await getCronRuns({ id: jobId });
      return {
        runs: result.entries,
        total: result.entries.length,
      };
    },
    enabled: !!jobId,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useCronRunLog(params: { sessionKey?: string; limit?: number }) {
  return useQuery({
    queryKey: cronKeys.runLog(params.sessionKey),
    queryFn: async (): Promise<CronRunLogResult> => {
      if (!params.sessionKey) {
        return { entries: [] };
      }
      return getCronRunLog({ sessionKey: params.sessionKey, limit: params.limit });
    },
    enabled: !!params.sessionKey,
    staleTime: 1000 * 30,
  });
}

export function useCronEventSubscription() {
  const queryClient = useQueryClient();
  const gatewayCtx = useOptionalGateway();

  const handleEvent = useCallback(
    (event: { event: string }) => {
      if (event.event !== "cron") {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: cronKeys.all });
    },
    [queryClient]
  );

  useEffect(() => {
    if (!gatewayCtx) {
      return;
    }
    return gatewayCtx.addEventListener(handleEvent);
  }, [gatewayCtx, handleEvent]);
}

/**
 * Hook to invalidate all cron queries
 */
export function useInvalidateCron() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: cronKeys.all });
}

// Re-export types
export type { CronJob, CronJobListResult };
