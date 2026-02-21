/**
 * React Query mutation hooks for cron job operations.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addCronJob,
  updateCronJob,
  removeCronJob,
  enableCronJob,
  disableCronJob,
  runCronJob,
  type CronJobCreateParams,
  type CronJobUpdateParams,
} from "@/lib/api/cron";
import { cronKeys } from "@/hooks/queries/useCron";

/**
 * Hook to create a new cron job
 */
export function useCreateCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CronJobCreateParams) => addCronJob(params),
    onSuccess: (newJob) => {
      void queryClient.invalidateQueries({ queryKey: cronKeys.lists() });
      toast.success(`Cron job "${newJob.name}" created`);
    },
    onError: (error) => {
      console.error("[useCreateCronJob] Failed:", error);
      toast.error("Failed to create cron job");
    },
  });
}

/**
 * Hook to update a cron job
 */
export function useUpdateCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CronJobUpdateParams) => updateCronJob(params),
    onSuccess: (updatedJob) => {
      void queryClient.invalidateQueries({ queryKey: cronKeys.detail(updatedJob.id) });
      void queryClient.invalidateQueries({ queryKey: cronKeys.lists() });
      toast.success(`Cron job "${updatedJob.name}" updated`);
    },
    onError: (error) => {
      console.error("[useUpdateCronJob] Failed:", error);
      toast.error("Failed to update cron job");
    },
  });
}

/**
 * Hook to delete a cron job
 */
export function useDeleteCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => removeCronJob(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cronKeys.lists() });
      toast.success("Cron job deleted");
    },
    onError: (error) => {
      console.error("[useDeleteCronJob] Failed:", error);
      toast.error("Failed to delete cron job");
    },
  });
}

/**
 * Hook to enable a cron job
 */
export function useEnableCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => enableCronJob(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: cronKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: cronKeys.lists() });
      toast.success("Cron job enabled");
    },
    onError: (error) => {
      console.error("[useEnableCronJob] Failed:", error);
      toast.error("Failed to enable cron job");
    },
  });
}

/**
 * Hook to disable a cron job
 */
export function useDisableCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => disableCronJob(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: cronKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: cronKeys.lists() });
      toast.success("Cron job disabled");
    },
    onError: (error) => {
      console.error("[useDisableCronJob] Failed:", error);
      toast.error("Failed to disable cron job");
    },
  });
}

/**
 * Hook to run a cron job immediately
 */
export function useRunCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mode = "async" }: { id: string; mode?: "sync" | "async" }) =>
      runCronJob(id, mode),
    onSuccess: (result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: cronKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: cronKeys.lists() });
      if (result.started) {
        toast.success(`Cron job started (run ID: ${result.runId})`);
      }
    },
    onError: (error) => {
      console.error("[useRunCronJob] Failed:", error);
      toast.error("Failed to run cron job");
    },
  });
}

// Re-export types
export type { CronJobCreateParams, CronJobUpdateParams };
