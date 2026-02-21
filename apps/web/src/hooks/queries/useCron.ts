/**
 * React Query hooks for cron job management.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCronJobs,
  getCronJob,
  type CronJob,
  type CronJobListResult,
} from "@/lib/api/cron";

// Additional types for status and run history
export interface CronStatusResult {
  enabled: boolean;
  totalJobs: number;
  enabledJobs: number;
  runningJobs: number;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface CronRunLogEntry {
  runId: string;
  jobId: string;
  jobName: string;
  startedAt: string;
  completedAt?: string;
  success: boolean;
  error?: string;
  duration?: number;
}

export interface CronRunsResult {
  runs: CronRunLogEntry[];
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
      const runningJobs = result.jobs.filter(
        (job) => job.lastResult && !job.lastResult.success
      );

      // Find the most recent last run and earliest next run
      const lastRunTimes = result.jobs
        .filter((job) => job.lastRunAt)
        .map((job) => new Date(job.lastRunAt!).getTime());
      const nextRunTimes = result.jobs
        .filter((job) => job.nextRunAt && job.enabled)
        .map((job) => new Date(job.nextRunAt!).getTime());

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
      // This would need a proper API endpoint
      // For now, return mock data
      return {
        runs: [],
        total: 0,
      };
    },
    staleTime: 1000 * 60, // 1 minute
  });
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
