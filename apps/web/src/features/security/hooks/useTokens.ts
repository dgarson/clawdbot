/**
 * Token management hooks
 *
 * React Query hooks for API token operations.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listTokens, createToken, revokeToken } from "../lib/security-api";
import { TOKENS_STALE_TIME } from "../lib/security-config";
import type { TokensCreateParams, TokensRevokeParams } from "../types";

// =============================================================================
// Query Keys
// =============================================================================

export const tokenKeys = {
  all: ["tokens"] as const,
  list: () => [...tokenKeys.all, "list"] as const,
};

// =============================================================================
// Queries
// =============================================================================

/**
 * Query hook for listing all API tokens.
 */
export function useTokens() {
  return useQuery({
    queryKey: tokenKeys.list(),
    queryFn: listTokens,
    staleTime: TOKENS_STALE_TIME,
    select: (data) => data.tokens,
  });
}

// =============================================================================
// Mutations
// =============================================================================

/**
 * Mutation to create a new API token.
 */
export function useCreateToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: TokensCreateParams) => createToken(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.all });
    },
    onError: (error) => {
      toast.error(`Failed to create token: ${error.message}`);
    },
  });
}

/**
 * Mutation to revoke an API token.
 */
export function useRevokeToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: TokensRevokeParams) => revokeToken(params),
    onSuccess: () => {
      toast.success("Token revoked");
      queryClient.invalidateQueries({ queryKey: tokenKeys.all });
    },
    onError: (error) => {
      toast.error(`Failed to revoke token: ${error.message}`);
    },
  });
}
