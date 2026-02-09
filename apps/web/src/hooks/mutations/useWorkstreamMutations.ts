import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

async function readonlyWorkstreamMutation(message: string): Promise<never> {
  throw new Error(message);
}

// Mutation hooks
export function useCreateWorkstream() {
  return useMutation({
    mutationFn: () =>
      readonlyWorkstreamMutation("Workstreams are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to create workstream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateWorkstream() {
  return useMutation({
    mutationFn: () =>
      readonlyWorkstreamMutation("Workstreams are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to update workstream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useDeleteWorkstream() {
  return useMutation({
    mutationFn: () =>
      readonlyWorkstreamMutation("Workstreams are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to delete workstream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateWorkstreamStatus() {
  return useMutation({
    mutationFn: () =>
      readonlyWorkstreamMutation("Workstreams are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to update workstream status: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useCreateTask() {
  return useMutation({
    mutationFn: () =>
      readonlyWorkstreamMutation("Workstream tasks are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateTask() {
  return useMutation({
    mutationFn: () =>
      readonlyWorkstreamMutation("Workstream tasks are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useDeleteTask() {
  return useMutation({
    mutationFn: () =>
      readonlyWorkstreamMutation("Workstream tasks are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to delete task: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateTaskStatus() {
  return useMutation({
    mutationFn: () =>
      readonlyWorkstreamMutation("Workstream tasks are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to update task status: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateTaskPriority() {
  return useMutation({
    mutationFn: () =>
      readonlyWorkstreamMutation("Workstream tasks are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to update task priority: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
