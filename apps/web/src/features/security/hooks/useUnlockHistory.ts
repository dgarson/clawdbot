/**
 * Unlock history hooks
 *
 * React Query hooks for unlock history queries.
 */

import { useQuery } from "@tanstack/react-query";
import { getUnlockHistory } from "../lib/security-api";
import { securityKeys } from "../SecurityProvider";
import { UNLOCK_HISTORY_STALE_TIME } from "../lib/security-config";
import type { SecurityGetHistoryParams } from "../types";

// =============================================================================
// Queries
// =============================================================================

/**
 * Query hook for unlock history.
 */
export function useUnlockHistory(params: SecurityGetHistoryParams = {}) {
  return useQuery({
    queryKey: securityKeys.history(params),
    queryFn: () => getUnlockHistory(params),
    staleTime: UNLOCK_HISTORY_STALE_TIME,
  });
}

/**
 * Query hook for recent unlock history (last 10 events).
 */
export function useRecentUnlockHistory() {
  return useUnlockHistory({ limit: 10 });
}
