/**
 * React Query mutation hooks for configuration changes.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  patchConfig,
  applyConfig,
  verifyProviderApiKey,
  saveProviderApiKey,
  removeProviderApiKey,
  logoutChannel,
  type ConfigSnapshot,
  type ConfigPatchParams,
  type ConfigPatchResponse,
  type ModelProviderId,
  type ProviderVerifyResponse,
  type ClawdbrainConfig,
} from "@/lib/api";
import { configKeys } from "../queries/useConfig";
import { channelKeys } from "../queries/useChannels";
import { modelKeys } from "../queries/useModels";
import { gatewayKeys } from "../queries/useGateway";

/**
 * Hook to patch the gateway configuration
 */
export function usePatchConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: ConfigPatchParams) => patchConfig(params),
    onSuccess: (result) => {
      // Invalidate config queries to refetch
      queryClient.invalidateQueries({ queryKey: configKeys.all });
      // Also invalidate related queries that might be affected
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
      queryClient.invalidateQueries({ queryKey: modelKeys.all });
      queryClient.invalidateQueries({ queryKey: gatewayKeys.all });

      if (result.restart?.scheduled) {
        toast.info("Configuration saved. Gateway will restart shortly.");
      } else {
        toast.success("Configuration updated");
      }
    },
    onError: (error) => {
      toast.error(
        `Failed to update configuration: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

/**
 * Hook to apply a full configuration
 */
export function useApplyConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      baseHash,
      config,
      options,
    }: {
      baseHash: string;
      config: ClawdbrainConfig;
      options?: { sessionKey?: string; note?: string; restartDelayMs?: number };
    }) => applyConfig(baseHash, config, options),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: configKeys.all });
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
      queryClient.invalidateQueries({ queryKey: modelKeys.all });
      queryClient.invalidateQueries({ queryKey: gatewayKeys.all });

      if (result.restart?.scheduled) {
        toast.info("Configuration applied. Gateway will restart shortly.");
      } else {
        toast.success("Configuration applied");
      }
    },
    onError: (error) => {
      toast.error(
        `Failed to apply configuration: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

/**
 * Hook to verify a model provider API key
 */
export function useVerifyProviderApiKey() {
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: ModelProviderId; apiKey: string }) =>
      verifyProviderApiKey(provider, apiKey),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`API key verified for ${result.provider}`);
      }
    },
    onError: (error) => {
      toast.error(
        `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

/**
 * Hook to save a model provider API key
 */
export function useSaveProviderApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      provider,
      apiKey,
      currentConfig,
    }: {
      provider: ModelProviderId;
      apiKey: string;
      currentConfig: ConfigSnapshot;
    }) => saveProviderApiKey(provider, apiKey, currentConfig),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: configKeys.all });
      queryClient.invalidateQueries({ queryKey: modelKeys.all });
      toast.success(`${variables.provider} API key configured`);
    },
    onError: (error) => {
      toast.error(
        `Failed to save API key: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

/**
 * Hook to remove a model provider API key
 */
export function useRemoveProviderApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      provider,
      currentConfig,
    }: {
      provider: ModelProviderId;
      currentConfig: ConfigSnapshot;
    }) => removeProviderApiKey(provider, currentConfig),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: configKeys.all });
      queryClient.invalidateQueries({ queryKey: modelKeys.all });
      toast.success(`${variables.provider} API key removed`);
    },
    onError: (error) => {
      toast.error(
        `Failed to remove API key: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

/**
 * Hook to logout from a channel
 */
export function useLogoutChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channel, accountId }: { channel: string; accountId?: string }) =>
      logoutChannel(channel, accountId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
      toast.success(`Logged out from ${result.channel}`);
    },
    onError: (error) => {
      toast.error(
        `Failed to logout: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

// Re-export types
export type {
  ConfigSnapshot,
  ConfigPatchParams,
  ConfigPatchResponse,
  ModelProviderId,
  ProviderVerifyResponse,
};
