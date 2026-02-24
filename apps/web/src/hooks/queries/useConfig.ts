/**
 * React Query hooks for gateway configuration.
 */

import { useQuery } from "@tanstack/react-query";
import {
  getConfig,
  getConfigSchema,
  type ConfigSnapshot,
} from "@/lib/api";

// Query keys factory
export const configKeys = {
  all: ["config"] as const,
  snapshot: () => [...configKeys.all, "snapshot"] as const,
  schema: () => [...configKeys.all, "schema"] as const,
};

/**
 * Hook to get the current gateway configuration
 */
export function useConfig() {
  return useQuery({
    queryKey: configKeys.snapshot(),
    queryFn: getConfig,
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to get the configuration schema
 */
export function useConfigSchema() {
  return useQuery({
    queryKey: configKeys.schema(),
    queryFn: () => getConfigSchema(),
    staleTime: 1000 * 60 * 60, // 1 hour (schema rarely changes)
  });
}

// Re-export types
export type { ConfigSnapshot };
