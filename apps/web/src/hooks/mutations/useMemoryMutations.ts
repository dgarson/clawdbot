import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Memory, MemoryType } from "../queries/useMemories";

interface CreateMemoryInput {
  title: string;
  content: string;
  type: MemoryType;
  tags: string[];
}

interface UpdateMemoryInput {
  id: string;
  content: string;
  tags: string[];
}

interface MemoryTagsInput {
  id: string;
  tags: string[];
}

interface ChangeMemoryTypeInput {
  id: string;
  type: MemoryType;
}

async function readonlyMemoryMutation<TData>(message: string): Promise<TData> {
  throw new Error(message);
}

// Mutation hooks
export function useCreateMemory() {
  return useMutation<Memory, Error, CreateMemoryInput>({
    mutationFn: (_input) =>
      readonlyMemoryMutation<Memory>("Memories are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to save memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateMemory() {
  return useMutation<Memory, Error, UpdateMemoryInput>({
    mutationFn: (_input) =>
      readonlyMemoryMutation<Memory>("Memories are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to update memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useDeleteMemory() {
  return useMutation<string, Error, string>({
    mutationFn: (_id) =>
      readonlyMemoryMutation<string>("Memories are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to delete memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useAddMemoryTags() {
  return useMutation<Memory, Error, MemoryTagsInput>({
    mutationFn: (_input) =>
      readonlyMemoryMutation<Memory>("Memories are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to add tags: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useRemoveMemoryTags() {
  return useMutation<Memory, Error, MemoryTagsInput>({
    mutationFn: (_input) =>
      readonlyMemoryMutation<Memory>("Memories are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to remove tags: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useChangeMemoryType() {
  return useMutation<Memory, Error, ChangeMemoryTypeInput>({
    mutationFn: (_input) =>
      readonlyMemoryMutation<Memory>("Memories are read-only until gateway support lands."),
    onError: (error) => {
      toast.error(
        `Failed to change memory type: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
