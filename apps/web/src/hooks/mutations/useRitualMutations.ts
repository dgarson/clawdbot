import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uuidv7 } from "@/lib/ids";
import type { Ritual, RitualStatus } from "../queries/useRituals";
import { ritualKeys } from "../queries/useRituals";

// Mock API functions
async function createRitual(
  data: Omit<Ritual, "id" | "createdAt" | "updatedAt" | "executionCount" | "successRate">
): Promise<Ritual> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const now = new Date().toISOString();
  return {
    ...data,
    id: uuidv7(),
    createdAt: now,
    updatedAt: now,
    executionCount: 0,
    successRate: 100,
  };
}

async function updateRitual(
  data: Partial<Ritual> & { id: string }
): Promise<Ritual> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    ...data,
    updatedAt: new Date().toISOString(),
  } as Ritual;
}

async function deleteRitual(id: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return id;
}

async function updateRitualStatus(
  id: string,
  status: RitualStatus
): Promise<{ id: string; status: RitualStatus }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { id, status };
}

async function triggerRitual(id: string): Promise<{ id: string; triggered: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { id, triggered: true };
}

async function pauseRitual(id: string): Promise<{ id: string; status: RitualStatus }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { id, status: "paused" };
}

async function resumeRitual(id: string): Promise<{ id: string; status: RitualStatus }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { id, status: "active" };
}

// Mutation hooks
export function useCreateRitual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRitual,
    onSuccess: (newRitual) => {
      queryClient.setQueryData<Ritual[]>(ritualKeys.lists(), (old) =>
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

  return useMutation({
    mutationFn: updateRitual,
    onMutate: async (updatedRitual) => {
      await queryClient.cancelQueries({
        queryKey: ritualKeys.detail(updatedRitual.id),
      });

      const previousRitual = queryClient.getQueryData<Ritual>(
        ritualKeys.detail(updatedRitual.id)
      );

      queryClient.setQueryData<Ritual>(
        ritualKeys.detail(updatedRitual.id),
        (old) => (old ? { ...old, ...updatedRitual } : undefined)
      );

      return { previousRitual };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ritualKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: ritualKeys.lists() });
      toast.success("Ritual updated successfully");
    },
    onError: (_error, variables, context) => {
      if (context?.previousRitual) {
        queryClient.setQueryData(
          ritualKeys.detail(variables.id),
          context.previousRitual
        );
      }
      toast.error("Failed to update ritual");
    },
  });
}

export function useDeleteRitual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRitual,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ritualKeys.lists() });

      const previousRituals = queryClient.getQueryData<Ritual[]>(
        ritualKeys.lists()
      );

      queryClient.setQueryData<Ritual[]>(ritualKeys.lists(), (old) =>
        old ? old.filter((ritual) => ritual.id !== id) : []
      );

      return { previousRituals };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ritualKeys.all });
      toast.success("Ritual deleted successfully");
    },
    onError: (_error, _, context) => {
      if (context?.previousRituals) {
        queryClient.setQueryData(ritualKeys.lists(), context.previousRituals);
      }
      toast.error("Failed to delete ritual");
    },
  });
}

export function useUpdateRitualStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RitualStatus }) =>
      updateRitualStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ritualKeys.detail(id) });

      const previousRitual = queryClient.getQueryData<Ritual>(
        ritualKeys.detail(id)
      );

      queryClient.setQueryData<Ritual>(ritualKeys.detail(id), (old) =>
        old ? { ...old, status } : undefined
      );

      queryClient.setQueryData<Ritual[]>(ritualKeys.lists(), (old) =>
        old
          ? old.map((ritual) =>
              ritual.id === id ? { ...ritual, status } : ritual
            )
          : []
      );

      return { previousRitual };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ritualKeys.detail(variables.id),
      });
      toast.success(`Ritual ${variables.status}`);
    },
    onError: (_error, variables, context) => {
      if (context?.previousRitual) {
        queryClient.setQueryData(
          ritualKeys.detail(variables.id),
          context.previousRitual
        );
      }
      toast.error("Failed to update ritual status");
    },
  });
}

export function useTriggerRitual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerRitual,
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ritualKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ritualKeys.executions(id) });
      toast.success("Ritual triggered successfully");
    },
    onError: () => {
      toast.error("Failed to trigger ritual");
    },
  });
}

export function usePauseRitual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pauseRitual,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ritualKeys.detail(id) });

      const previousRitual = queryClient.getQueryData<Ritual>(
        ritualKeys.detail(id)
      );

      queryClient.setQueryData<Ritual>(ritualKeys.detail(id), (old) =>
        old ? { ...old, status: "paused" } : undefined
      );

      return { previousRitual };
    },
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ritualKeys.detail(id) });
      toast.success("Ritual paused");
    },
    onError: (_error, id, context) => {
      if (context?.previousRitual) {
        queryClient.setQueryData(ritualKeys.detail(id), context.previousRitual);
      }
      toast.error("Failed to pause ritual");
    },
  });
}

export function useResumeRitual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resumeRitual,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ritualKeys.detail(id) });

      const previousRitual = queryClient.getQueryData<Ritual>(
        ritualKeys.detail(id)
      );

      queryClient.setQueryData<Ritual>(ritualKeys.detail(id), (old) =>
        old ? { ...old, status: "active" } : undefined
      );

      return { previousRitual };
    },
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ritualKeys.detail(id) });
      toast.success("Ritual resumed");
    },
    onError: (_error, id, context) => {
      if (context?.previousRitual) {
        queryClient.setQueryData(ritualKeys.detail(id), context.previousRitual);
      }
      toast.error("Failed to resume ritual");
    },
  });
}
