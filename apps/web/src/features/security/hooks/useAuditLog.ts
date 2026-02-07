/**
 * Audit log hooks
 *
 * React Query hooks for audit log queries.
 */

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { queryAuditLog } from "../lib/security-api";
import { AUDIT_LOG_STALE_TIME } from "../lib/security-config";
import type { AuditQueryParams, AuditCategory, AuditSeverity, AuditAction } from "../types";

// =============================================================================
// Query Keys
// =============================================================================

export const auditKeys = {
  all: ["audit"] as const,
  query: (params: AuditQueryParams) => [...auditKeys.all, "query", params] as const,
};

// =============================================================================
// Queries
// =============================================================================

/**
 * Query hook for audit log with filters.
 */
export function useAuditLog(params: AuditQueryParams = {}) {
  return useQuery({
    queryKey: auditKeys.query(params),
    queryFn: () => queryAuditLog(params),
    staleTime: AUDIT_LOG_STALE_TIME,
  });
}

/**
 * Infinite query hook for paginated audit log.
 */
export function useInfiniteAuditLog(params: Omit<AuditQueryParams, "offset"> = {}) {
  const limit = params.limit ?? 50;

  return useInfiniteQuery({
    queryKey: auditKeys.query({ ...params, limit }),
    queryFn: ({ pageParam = 0 }) =>
      queryAuditLog({ ...params, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) {return undefined;}
      return allPages.length * limit;
    },
    staleTime: AUDIT_LOG_STALE_TIME,
  });
}

// =============================================================================
// Filter Helpers
// =============================================================================

/**
 * Build audit query params from filter state.
 */
export function buildAuditQueryParams(filters: {
  category?: AuditCategory | null;
  action?: AuditAction | null;
  severity?: AuditSeverity | null;
  startDate?: Date | null;
  endDate?: Date | null;
  limit?: number;
}): AuditQueryParams {
  const params: AuditQueryParams = {};

  if (filters.category) {
    params.category = filters.category;
  }

  if (filters.action) {
    params.action = filters.action;
  }

  if (filters.severity) {
    params.severity = filters.severity;
  }

  if (filters.startDate) {
    params.startTs = filters.startDate.getTime();
  }

  if (filters.endDate) {
    params.endTs = filters.endDate.getTime();
  }

  if (filters.limit) {
    params.limit = filters.limit;
  }

  return params;
}
