/**
 * React Query hooks for gateway health and status.
 */

import { useQuery } from "@tanstack/react-query";
import {
  getHealth,
  getStatus,
  type HealthResponse,
  type StatusResponse,
} from "@/lib/api";

// Query keys factory
export const gatewayKeys = {
  all: ["gateway"] as const,
  health: () => [...gatewayKeys.all, "health"] as const,
  healthWithProbe: (probe: boolean) => [...gatewayKeys.health(), { probe }] as const,
  status: () => [...gatewayKeys.all, "status"] as const,
};

/**
 * Hook to get gateway health status
 */
export function useGatewayHealth(probe = false) {
  return useQuery({
    queryKey: gatewayKeys.healthWithProbe(probe),
    queryFn: () => getHealth(probe),
    staleTime: probe ? 0 : 1000 * 10, // 10 seconds when not probing
    refetchInterval: 1000 * 30, // Auto-refresh every 30 seconds
  });
}

/**
 * Hook to get overall system status
 */
export function useGatewayStatus() {
  return useQuery({
    queryKey: gatewayKeys.status(),
    queryFn: getStatus,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Auto-refresh every 60 seconds
  });
}

/**
 * Hook to check if gateway is connected
 */
export function useGatewayConnected() {
  const { data, isLoading, isError, refetch, isFetching } = useGatewayHealth();

  return {
    isConnected: data?.ok ?? false,
    isLoading,
    isError,
    version: data?.version,
    uptime: data?.uptime,
    refetch,
    isFetching,
  };
}

// Re-export types
export type { HealthResponse, StatusResponse };
