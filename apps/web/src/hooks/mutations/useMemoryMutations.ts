import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

async function readonlyMemoryMutation(message: string): Promise<never> {
  throw new Error(message);
}

// Mutation hooks
export function useCreateMemory() {
  return useMutation({
    mutationFn: () =>
      readonlyMemoryMutation("Memories are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to save memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateMemory() {
  return useMutation({
    mutationFn: () =>
      readonlyMemoryMutation("Memories are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to update memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useDeleteMemory() {
  return useMutation({
    mutationFn: () =>
      readonlyMemoryMutation("Memories are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to delete memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useAddMemoryTags() {
  return useMutation({
    mutationFn: () =>
      readonlyMemoryMutation("Memories are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to add tags: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useRemoveMemoryTags() {
  return useMutation({
    mutationFn: () =>
      readonlyMemoryMutation("Memories are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to remove tags: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
