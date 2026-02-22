/**
 * React Query hooks for channel status and management.
 */

import { useQuery } from "@tanstack/react-query";
import {
  getChannelsStatus,
  type ChannelStatusResponse,
  type ChannelAccountSnapshot,
  type ChannelSummary,
  type ChannelMetaEntry,
} from "@/lib/api";

// Query keys factory
export const channelKeys = {
  all: ["channels"] as const,
  status: () => [...channelKeys.all, "status"] as const,
  statusWithProbe: (probe: boolean) => [...channelKeys.status(), { probe }] as const,
};

export interface UseChannelsStatusOptions {
  /** Whether to probe channels for real-time status */
  probe?: boolean;
  /** Timeout for probe requests in ms */
  timeoutMs?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Hook to get channel status
 */
export function useChannelsStatus(options: UseChannelsStatusOptions = {}) {
  const { probe = false, timeoutMs = 10000, enabled = true } = options;

  return useQuery({
    queryKey: channelKeys.statusWithProbe(probe),
    queryFn: () => getChannelsStatus({ probe, timeoutMs }),
    staleTime: probe ? 0 : 1000 * 30, // No caching when probing
    enabled,
  });
}

/**
 * Hook to get channels status without probing (faster, uses cached data)
 */
export function useChannelsStatusFast() {
  return useChannelsStatus({ probe: false });
}

/**
 * Hook to get channels status with probing (slower, real-time data)
 */
export function useChannelsStatusDeep() {
  return useChannelsStatus({ probe: true, timeoutMs: 15000 });
}

// Re-export types
export type {
  ChannelStatusResponse,
  ChannelAccountSnapshot,
  ChannelSummary,
  ChannelMetaEntry,
};
