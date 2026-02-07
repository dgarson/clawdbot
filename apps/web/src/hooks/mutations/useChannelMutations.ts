/**
 * React Query mutation hooks for channel operations.
 *
 * Provides:
 * - useChannelLogout: Logout from a channel
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logoutChannel } from "@/lib/api";
import { channelKeys } from "@/hooks/queries/useChannels";
import { toast } from "sonner";

export interface ChannelLogoutParams {
  channelId: string;
}

/**
 * Hook to logout from a channel
 */
export function useChannelLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ChannelLogoutParams) => {
      await logoutChannel(params.channelId);
      return params.channelId;
    },
    onSuccess: (channelId) => {
      // Invalidate channel status queries to refetch
      void queryClient.invalidateQueries({
        queryKey: channelKeys.status(),
      });
      toast.success(`Logged out from ${channelId}`);
    },
    onError: (error, params) => {
      console.error("[useChannelLogout] Failed to logout:", error);
      toast.error(`Failed to logout from ${params.channelId}`);
    },
  });
}
