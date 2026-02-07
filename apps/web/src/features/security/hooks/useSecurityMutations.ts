/**
 * Security mutation hooks
 *
 * React Query mutations for security operations.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  setupPassword,
  changePassword,
  unlock,
  lock,
  disableLock,
  setup2fa,
  verify2fa,
  disable2fa,
} from "../lib/security-api";
import { securityKeys, useSecurity } from "../SecurityProvider";
import type {
  SecuritySetupPasswordParams,
  SecurityChangePasswordParams,
  SecurityUnlockParams,
  SecurityDisableParams,
  SecuritySetup2faParams,
  SecurityVerify2faParams,
  SecurityDisable2faParams,
} from "../types";

// =============================================================================
// Password Mutations
// =============================================================================

/**
 * Mutation to set up password protection.
 */
export function useSetupPassword() {
  const queryClient = useQueryClient();
  const { setUnlocked } = useSecurity();

  return useMutation({
    mutationFn: (params: SecuritySetupPasswordParams) => setupPassword(params),
    onSuccess: (result) => {
      if (result.success && result.session) {
        setUnlocked(result.session);
        toast.success("Password protection enabled");
      }
      queryClient.invalidateQueries({ queryKey: securityKeys.all });
    },
    onError: (error) => {
      toast.error(`Failed to set up password: ${error.message}`);
    },
  });
}

/**
 * Mutation to change password.
 */
export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: SecurityChangePasswordParams) => changePassword(params),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Password changed successfully");
      }
      queryClient.invalidateQueries({ queryKey: securityKeys.all });
    },
    onError: (error) => {
      toast.error(`Failed to change password: ${error.message}`);
    },
  });
}

/**
 * Mutation to unlock the app.
 */
export function useUnlock() {
  const queryClient = useQueryClient();
  const { setUnlocked } = useSecurity();

  return useMutation({
    mutationFn: (params: SecurityUnlockParams) => unlock(params),
    onSuccess: (result) => {
      if (result.success && result.session) {
        setUnlocked(result.session);
      }
      queryClient.invalidateQueries({ queryKey: securityKeys.all });
    },
    onError: (error) => {
      toast.error(`Failed to unlock: ${error.message}`);
    },
  });
}

/**
 * Mutation to lock the app.
 */
export function useLock() {
  const queryClient = useQueryClient();
  const { setLocked } = useSecurity();

  return useMutation({
    mutationFn: () => lock(),
    onSuccess: (result) => {
      if (result.success) {
        setLocked();
        toast.info("App locked");
      }
      queryClient.invalidateQueries({ queryKey: securityKeys.all });
    },
    onError: (error) => {
      toast.error(`Failed to lock: ${error.message}`);
    },
  });
}

/**
 * Mutation to disable password protection.
 */
export function useDisableLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: SecurityDisableParams) => disableLock(params),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Password protection disabled");
      }
      queryClient.invalidateQueries({ queryKey: securityKeys.all });
    },
    onError: (error) => {
      toast.error(`Failed to disable lock: ${error.message}`);
    },
  });
}

// =============================================================================
// 2FA Mutations
// =============================================================================

/**
 * Mutation to start 2FA setup.
 */
export function useSetup2fa() {
  return useMutation({
    mutationFn: (params: SecuritySetup2faParams) => setup2fa(params),
    onError: (error) => {
      toast.error(`Failed to start 2FA setup: ${error.message}`);
    },
  });
}

/**
 * Mutation to verify 2FA setup.
 */
export function useVerify2fa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: SecurityVerify2faParams) => verify2fa(params),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Two-factor authentication enabled");
      }
      queryClient.invalidateQueries({ queryKey: securityKeys.all });
    },
    onError: (error) => {
      toast.error(`Failed to verify 2FA: ${error.message}`);
    },
  });
}

/**
 * Mutation to disable 2FA.
 */
export function useDisable2fa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: SecurityDisable2faParams) => disable2fa(params),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Two-factor authentication disabled");
      }
      queryClient.invalidateQueries({ queryKey: securityKeys.all });
    },
    onError: (error) => {
      toast.error(`Failed to disable 2FA: ${error.message}`);
    },
  });
}
