import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uuidv7 } from "@/lib/ids";
import type { Memory, MemoryType } from "../queries/useMemories";
import { memoryKeys } from "../queries/useMemories";

// Mock API functions
async function createMemory(
  data: Omit<Memory, "id" | "createdAt" | "updatedAt">
): Promise<Memory> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const now = new Date().toISOString();
  return {
    ...data,
    id: uuidv7(),
    createdAt: now,
    updatedAt: now,
  };
}

async function updateMemory(
  data: Partial<Memory> & { id: string }
): Promise<Memory> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    ...data,
    updatedAt: new Date().toISOString(),
  } as Memory;
}

async function deleteMemory(id: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return id;
}

async function addTags(
  id: string,
  tags: string[]
): Promise<{ id: string; tags: string[] }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { id, tags };
}

async function removeTags(
  id: string,
  tags: string[]
): Promise<{ id: string; removedTags: string[] }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { id, removedTags: tags };
}

async function changeType(
  id: string,
  type: MemoryType
): Promise<{ id: string; type: MemoryType }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { id, type };
}

// Mutation hooks
export function useCreateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMemory,
    onSuccess: (newMemory) => {
      queryClient.setQueryData<Memory[]>(memoryKeys.lists(), (old) =>
        old ? [newMemory, ...old] : [newMemory]
      );
      queryClient.invalidateQueries({ queryKey: memoryKeys.all });
      toast.success("Memory saved successfully");
    },
    onError: (error) => {
      toast.error(
        `Failed to save memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMemory,
    onMutate: async (updatedMemory) => {
      await queryClient.cancelQueries({
        queryKey: memoryKeys.detail(updatedMemory.id),
      });

      const previousMemory = queryClient.getQueryData<Memory>(
        memoryKeys.detail(updatedMemory.id)
      );

      queryClient.setQueryData<Memory>(
        memoryKeys.detail(updatedMemory.id),
        (old) => (old ? { ...old, ...updatedMemory } : undefined)
      );

      return { previousMemory };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: memoryKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: memoryKeys.lists() });
      toast.success("Memory updated successfully");
    },
    onError: (_error, variables, context) => {
      if (context?.previousMemory) {
        queryClient.setQueryData(
          memoryKeys.detail(variables.id),
          context.previousMemory
        );
      }
      toast.error("Failed to update memory");
    },
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMemory,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: memoryKeys.lists() });

      const previousMemories = queryClient.getQueryData<Memory[]>(
        memoryKeys.lists()
      );

      queryClient.setQueryData<Memory[]>(memoryKeys.lists(), (old) =>
        old ? old.filter((memory) => memory.id !== id) : []
      );

      return { previousMemories };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.all });
      toast.success("Memory deleted successfully");
    },
    onError: (_error, _, context) => {
      if (context?.previousMemories) {
        queryClient.setQueryData(memoryKeys.lists(), context.previousMemories);
      }
      toast.error("Failed to delete memory");
    },
  });
}

export function useAddMemoryTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
      addTags(id, tags),
    onMutate: async ({ id, tags }) => {
      await queryClient.cancelQueries({ queryKey: memoryKeys.detail(id) });

      const previousMemory = queryClient.getQueryData<Memory>(
        memoryKeys.detail(id)
      );

      queryClient.setQueryData<Memory>(memoryKeys.detail(id), (old) =>
        old
          ? {
              ...old,
              tags: [...new Set([...old.tags, ...tags])],
            }
          : undefined
      );

      return { previousMemory };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.detail(id) });
      toast.success("Tags added");
    },
    onError: (_error, { id }, context) => {
      if (context?.previousMemory) {
        queryClient.setQueryData(memoryKeys.detail(id), context.previousMemory);
      }
      toast.error("Failed to add tags");
    },
  });
}

export function useRemoveMemoryTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
      removeTags(id, tags),
    onMutate: async ({ id, tags }) => {
      await queryClient.cancelQueries({ queryKey: memoryKeys.detail(id) });

      const previousMemory = queryClient.getQueryData<Memory>(
        memoryKeys.detail(id)
      );

      queryClient.setQueryData<Memory>(memoryKeys.detail(id), (old) =>
        old
          ? {
              ...old,
              tags: old.tags.filter((t) => !tags.includes(t)),
            }
          : undefined
      );

      return { previousMemory };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.detail(id) });
      toast.success("Tags removed");
    },
    onError: (_error, { id }, context) => {
      if (context?.previousMemory) {
        queryClient.setQueryData(memoryKeys.detail(id), context.previousMemory);
      }
      toast.error("Failed to remove tags");
    },
  });
}

export function useChangeMemoryType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: MemoryType }) =>
      changeType(id, type),
    onMutate: async ({ id, type }) => {
      await queryClient.cancelQueries({ queryKey: memoryKeys.detail(id) });

      const previousMemory = queryClient.getQueryData<Memory>(
        memoryKeys.detail(id)
      );

      queryClient.setQueryData<Memory>(memoryKeys.detail(id), (old) =>
        old ? { ...old, type } : undefined
      );

      return { previousMemory };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: memoryKeys.lists() });
      toast.success("Memory type updated");
    },
    onError: (_error, { id }, context) => {
      if (context?.previousMemory) {
        queryClient.setQueryData(memoryKeys.detail(id), context.previousMemory);
      }
      toast.error("Failed to update memory type");
    },
  });
}
