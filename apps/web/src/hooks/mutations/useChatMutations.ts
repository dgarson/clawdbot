/**
 * React Query mutation hooks for chat operations.
 *
 * Provides:
 * - useSendMessage: Send a message to a session
 * - useAbortChat: Abort an active chat stream
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendChatMessage, abortChat, type ChatSendParams } from "@/lib/api/sessions";
import { sessionKeys } from "@/hooks/queries/useSessions";
import { uuidv7 } from "@/lib/ids";

export interface SendMessageParams {
  message: string;
  deliver?: boolean;
  idempotencyKey?: string;
}

export interface SendMessageResult {
  runId?: string;
  idempotencyKey: string;
}

/**
 * Hook to send a chat message to a gateway session
 */
export function useGatewaySendMessage(sessionKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendMessageParams): Promise<SendMessageResult> => {
      const idempotencyKey = params.idempotencyKey ?? uuidv7();
      const sendParams: ChatSendParams = {
        sessionKey,
        message: params.message,
        deliver: params.deliver ?? true,
        idempotencyKey,
      };

      const result = await sendChatMessage(sendParams);

      return {
        runId: result.runId,
        idempotencyKey,
      };
    },
    onSuccess: () => {
      // Invalidate session list to update last message
      void queryClient.invalidateQueries({
        queryKey: sessionKeys.lists(),
      });
    },
    onError: (error) => {
      console.error("[useSendMessage] Failed to send message:", error);
    },
  });
}

export interface AbortChatParams {
  runId?: string;
}

/**
 * Hook to abort an active chat stream
 */
export function useAbortChat(sessionKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: AbortChatParams) => {
      await abortChat(sessionKey, params?.runId);
    },
    onSuccess: () => {
      // Invalidate chat history to reflect aborted state
      void queryClient.invalidateQueries({
        queryKey: sessionKeys.history(sessionKey),
      });
    },
    onError: (error) => {
      console.error("[useAbortChat] Failed to abort chat:", error);
    },
  });
}
