import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addCronJob,
  disableCronJob,
  enableCronJob,
  removeCronJob,
  runCronJob,
  updateCronJob,
  type CronJob,
  type CronJobCreateParams,
  type CronJobPatch,
} from "@/lib/api/cron";
import type { Ritual, RitualStatus } from "../queries/useRituals";
import { ritualKeys } from "../queries/useRituals";
import { useGatewayEnabled, useGatewayModeKey } from "../useGatewayEnabled";

function buildRitualPayload(data: { name: string; description?: string }) {
  return {
    kind: "agentTurn" as const,
    message: data.description?.trim() || `Ritual: ${data.name}`,
  };
}

function buildCronCreateParams(
  data: Omit<Ritual, "id" | "createdAt" | "updatedAt" | "executionCount" | "successRate">
): CronJobCreateParams {
  return {
    name: data.name,
    description: data.description,
    enabled: data.status === "active",
    schedule: {
      kind: "cron",
      expr: data.schedule,
    },
    agentId: data.agentId ?? null,
    sessionTarget: "main",
    wakeMode: "next-heartbeat",
    payload: buildRitualPayload({ name: data.name, description: data.description }),
  };
}

function buildCronPatch(update: Partial<Ritual>): CronJobPatch {
  const patch: CronJobPatch = {};
  if (update.name) {
    patch.name = update.name;
  }
  if (update.description !== undefined) {
    patch.description = update.description;
  }
  if (update.schedule) {
    patch.schedule = { kind: "cron", expr: update.schedule };
  }
  if (update.agentId !== undefined) {
    patch.agentId = update.agentId ?? null;
  }
  if (update.status) {
    patch.enabled = update.status === "active";
  }
  if (update.name || update.description) {
    patch.payload = buildRitualPayload({
      name: update.name ?? "Ritual",
      description: update.description,
    });
  }
  return patch;
}

function mapCronToRitual(job: CronJob): Ritual {
  return {
    id: job.id,
    name: job.name,
    description: job.description,
    schedule: job.schedule.kind === "cron" ? job.schedule.expr : job.name,
    frequency: "custom",
    status: job.enabled ? "active" : "paused",
    createdAt: new Date(job.createdAtMs).toISOString(),
    updatedAt: new Date(job.updatedAtMs).toISOString(),
  };
}

// Mutation hooks
export function useCreateRitual() {
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();
  const modeKey = useGatewayModeKey();

  return useMutation({
    mutationFn: (data: Omit<Ritual, "id" | "createdAt" | "updatedAt" | "executionCount" | "successRate">) =>
      liveMode
        ? addCronJob(buildCronCreateParams(data))
        : Promise.reject(new Error("Rituals require a live gateway connection.")),
    onSuccess: (newJob) => {
      const newRitual = mapCronToRitual(newJob);
      queryClient.setQueryData<Ritual[]>(ritualKeys.list({ mode: modeKey }), (old) =>
        old ? [newRitual, ...old] : [newRitual]
      );
      queryClient.invalidateQueries({ queryKey: ritualKeys.all });
      toast.success("Ritual created successfully");
    },
    onError: (error) => {
      toast.error(
        `Failed to create ritual: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateRitual() {
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();

  return useMutation({
    mutationFn: (data: Partial<Ritual> & { id: string }) =>
      liveMode
        ? updateCronJob({ id: data.id, patch: buildCronPatch(data) })
        : Promise.reject(new Error("Rituals require a live gateway connection.")),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ritualKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ritualKeys.lists() });
      toast.success("Ritual updated successfully");
    },
    onError: (error) => {
      toast.error(
        `Failed to update ritual: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useDeleteRitual() {
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();

  return useMutation({
    mutationFn: (id: string) =>
      liveMode
        ? removeCronJob(id)
        : Promise.reject(new Error("Rituals require a live gateway connection.")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ritualKeys.all });
      toast.success("Ritual deleted successfully");
    },
    onError: (error) => {
      toast.error(
        `Failed to delete ritual: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateRitualStatus() {
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RitualStatus }) => {
      if (!liveMode) {
        return Promise.reject(new Error("Rituals require a live gateway connection."));
      }
      if (status === "active") {
        return enableCronJob(id);
      }
      if (status === "paused") {
        return disableCronJob(id);
      }
      return Promise.reject(new Error("Only active/paused ritual status updates are supported."));
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ritualKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ritualKeys.lists() });
      toast.success(`Ritual ${variables.status}`);
    },
    onError: (error) => {
      toast.error(
        `Failed to update ritual status: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useTriggerRitual() {
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();

  return useMutation({
    mutationFn: (id: string) =>
      liveMode
        ? runCronJob(id, "force")
        : Promise.reject(new Error("Rituals require a live gateway connection.")),
    onSuccess: (_, ritualId) => {
      queryClient.invalidateQueries({ queryKey: ritualKeys.executions(ritualId) });
      toast.success("Ritual triggered successfully");
    },
    onError: (error) => {
      toast.error(
        `Failed to trigger ritual: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function usePauseRitual() {
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();

  return useMutation({
    mutationFn: (id: string) =>
      liveMode
        ? disableCronJob(id)
        : Promise.reject(new Error("Rituals require a live gateway connection.")),
    onSuccess: (_, ritualId) => {
      queryClient.invalidateQueries({ queryKey: ritualKeys.detail(ritualId) });
      queryClient.invalidateQueries({ queryKey: ritualKeys.lists() });
      toast.success("Ritual paused");
    },
    onError: (error) => {
      toast.error(
        `Failed to pause ritual: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useResumeRitual() {
  const queryClient = useQueryClient();
  const liveMode = useGatewayEnabled();

  return useMutation({
    mutationFn: (id: string) =>
      liveMode
        ? enableCronJob(id)
        : Promise.reject(new Error("Rituals require a live gateway connection.")),
    onSuccess: (_, ritualId) => {
      queryClient.invalidateQueries({ queryKey: ritualKeys.detail(ritualId) });
      queryClient.invalidateQueries({ queryKey: ritualKeys.lists() });
      toast.success("Ritual resumed");
    },
    onError: (error) => {
      toast.error(
        `Failed to resume ritual: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
