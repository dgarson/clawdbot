/**
 * React Query hooks for model providers and models.
 */

import { useQuery } from "@tanstack/react-query";
import {
  listModels,
  type ModelsListResponse,
  type ModelEntry,
} from "@/lib/api";

// Query keys factory
export const modelKeys = {
  all: ["models"] as const,
  list: () => [...modelKeys.all, "list"] as const,
};

/**
 * Hook to list available models
 */
export function useModels() {
  return useQuery({
    queryKey: modelKeys.list(),
    queryFn: listModels,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get models grouped by provider
 */
export function useModelsByProvider() {
  const query = useModels();

  const modelsByProvider = query.data?.models.reduce(
    (acc, model) => {
      const provider = model.provider || "unknown";
      if (!acc[provider]) {
        acc[provider] = [];
      }
      acc[provider].push(model);
      return acc;
    },
    {} as Record<string, ModelEntry[]>
  );

  return {
    ...query,
    modelsByProvider,
  };
}

// Re-export types
export type { ModelsListResponse, ModelEntry };
