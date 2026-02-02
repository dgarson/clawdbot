/* eslint-disable react-refresh/only-export-components */
"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSecurityState } from "./lib/security-api";
import {
  getStoredSession,
  isStoredSessionValid,
  storeSession,
  clearStoredSession,
  SECURITY_STATE_STALE_TIME,
} from "./lib/security-config";
import type { SecurityState, UnlockSession } from "./types";

// =============================================================================
// Context Types
// =============================================================================

interface SecurityContextValue {
  /** Current security state */
  state: SecurityState;
  /** Whether security state is loading */
  isLoading: boolean;
  /** Any error from loading security state */
  error: Error | null;
  /** Refresh security state from server */
  refetch: () => Promise<void>;
  /** Update local state after successful unlock */
  setUnlocked: (session: UnlockSession) => void;
  /** Update local state after lock */
  setLocked: () => void;
  /** Whether security feature is enabled (lock configured) */
  isSecurityEnabled: boolean;
}

const SecurityContext = React.createContext<SecurityContextValue | null>(null);

// =============================================================================
// Query Keys
// =============================================================================

export const securityKeys = {
  all: ["security"] as const,
  state: () => [...securityKeys.all, "state"] as const,
  history: (params?: { limit?: number; offset?: number }) =>
    [...securityKeys.all, "history", params] as const,
};

// =============================================================================
// Provider Component
// =============================================================================

interface SecurityProviderProps {
  children: React.ReactNode;
}

/**
 * Security context provider.
 *
 * Manages unlock state, session persistence, and security configuration.
 * Wraps the entire app to provide security context to all components.
 */
export function SecurityProvider({ children }: SecurityProviderProps) {
  const queryClient = useQueryClient();

  // Local state for immediate UI updates
  const [localUnlocked, setLocalUnlocked] = React.useState<boolean | null>(null);
  const [localSession, setLocalSession] = React.useState<UnlockSession | null>(null);

  // Check localStorage on mount for persisted session
  React.useEffect(() => {
    if (isStoredSessionValid()) {
      const stored = getStoredSession();
      if (stored) {
        setLocalUnlocked(true);
        setLocalSession({
          id: stored.id,
          createdAt: 0, // Unknown from localStorage
          expiresAt: stored.expiry,
          valid: true,
        });
      }
    }
  }, []);

  // Query security state from gateway
  const {
    data: serverState,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: securityKeys.state(),
    queryFn: getSecurityState,
    staleTime: SECURITY_STATE_STALE_TIME,
    refetchOnWindowFocus: true,
    // Don't refetch on mount if we have localStorage session
    refetchOnMount: !isStoredSessionValid(),
  });

  // Sync server state with local state
  React.useEffect(() => {
    if (serverState) {
      // If server says we're not unlocked but we thought we were, clear local state
      if (!serverState.isUnlocked && localUnlocked === true) {
        setLocalUnlocked(false);
        setLocalSession(null);
        clearStoredSession();
      }
      // If server says we're unlocked and we didn't know, update local state
      if (serverState.isUnlocked && serverState.session && localUnlocked !== true) {
        setLocalUnlocked(true);
        setLocalSession(serverState.session);
        storeSession(serverState.session.id, serverState.session.expiresAt);
      }
    }
  }, [serverState, localUnlocked]);

  // Handlers for updating state after unlock/lock
  const setUnlocked = React.useCallback((session: UnlockSession) => {
    setLocalUnlocked(true);
    setLocalSession(session);
    storeSession(session.id, session.expiresAt);
    queryClient.invalidateQueries({ queryKey: securityKeys.state() });
  }, [queryClient]);

  const setLocked = React.useCallback(() => {
    setLocalUnlocked(false);
    setLocalSession(null);
    clearStoredSession();
    queryClient.invalidateQueries({ queryKey: securityKeys.state() });
  }, [queryClient]);

  const handleRefetch = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Compute final state
  const state: SecurityState = React.useMemo(() => {
    // If lock is not enabled, always unlocked
    if (serverState && !serverState.lockEnabled) {
      return {
        lockEnabled: false,
        isUnlocked: true,
        session: null,
        twoFactorEnabled: serverState.twoFactorEnabled,
        twoFactorSetupPending: false,
      };
    }

    // Use local state for immediate feedback, fall back to server state
    const isUnlocked = localUnlocked ?? serverState?.isUnlocked ?? false;
    const session = localSession ?? serverState?.session ?? null;

    return {
      lockEnabled: serverState?.lockEnabled ?? false,
      isUnlocked,
      session,
      twoFactorEnabled: serverState?.twoFactorEnabled ?? false,
      twoFactorSetupPending: false,
    };
  }, [serverState, localUnlocked, localSession]);

  const value: SecurityContextValue = React.useMemo(
    () => ({
      state,
      isLoading,
      error: error instanceof Error ? error : null,
      refetch: handleRefetch,
      setUnlocked,
      setLocked,
      isSecurityEnabled: state.lockEnabled,
    }),
    [state, isLoading, error, handleRefetch, setUnlocked, setLocked]
  );

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access security context.
 *
 * @throws if used outside SecurityProvider
 */
export function useSecurity(): SecurityContextValue {
  const context = React.useContext(SecurityContext);
  if (!context) {
    throw new Error("useSecurity must be used within a SecurityProvider");
  }
  return context;
}

/**
 * Hook to check if user needs to unlock.
 * Returns true if lock is enabled and user is not unlocked.
 */
export function useNeedsUnlock(): boolean {
  const { state, isLoading } = useSecurity();

  // While loading, assume no unlock needed to prevent flash
  if (isLoading) {return false;}

  // If lock not enabled, no unlock needed
  if (!state.lockEnabled) {return false;}

  // If already unlocked, no unlock needed
  if (state.isUnlocked) {return false;}

  return true;
}

export default SecurityProvider;
