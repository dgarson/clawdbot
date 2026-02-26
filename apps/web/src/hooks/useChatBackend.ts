/**
 * Unified Chat Backend Hook
 * Provides gateway chat functionality
 */

import * as React from "react";
import { useSessionStore } from "@/stores/useSessionStore";
import { useGatewaySendMessage, useAbortChat } from "@/hooks/mutations/useChatMutations";
import { uuidv7 } from "@/lib/ids";
import type { StreamingMessage } from "@/stores/useSessionStore";

export interface ChatBackendHookResult {
  /** Current streaming message (if any) */
  streamingMessage: StreamingMessage | null;
  /** Send a message */
  handleSend: (message: string) => Promise<void>;
  /** Stop/abort current stream */
  handleStop: () => Promise<void>;
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Whether a send is in progress */
  isSending: boolean;
}

/**
 * Hook that provides gateway chat send/stop handlers and streaming state
 */
export function useChatBackend(sessionKey: string): ChatBackendHookResult {
  const gatewayStore = useSessionStore();

  // Gateway mutations
  const sendMessageMutation = useGatewaySendMessage(sessionKey);
  const abortChatMutation = useAbortChat(sessionKey);

  // Get streaming state based on active backend
  const streamingMessage = React.useMemo(() => {
    return gatewayStore.streamingMessages[sessionKey] ?? null;
  }, [sessionKey, gatewayStore.streamingMessages]);

  const isStreaming = streamingMessage?.isStreaming ?? false;
  const isSending = sendMessageMutation.isPending;

  // Handle sending messages using gateway mutation hook
  const handleSend = React.useCallback(
    async (message: string) => {
      if (!sessionKey) {return;}

      const idempotencyKey = uuidv7();

      // Start streaming state
      gatewayStore.startStreaming(sessionKey, idempotencyKey);

      try {
        const result = await sendMessageMutation.mutateAsync({
          message,
          idempotencyKey,
        });

        if (result.runId) {
          gatewayStore.setCurrentRunId(sessionKey, result.runId);
        }

        // Streaming responses are handled via WebSocket events (useGatewayStreamHandler)
      } catch (error) {
        console.error("Failed to send message:", error);
        gatewayStore.finishStreaming(sessionKey);
      }
    },
    [sessionKey, gatewayStore, sendMessageMutation]
  );

  // Handle stopping the stream using gateway mutation hook
  const handleStop = React.useCallback(async () => {
    if (!sessionKey) {return;}

    const runId = gatewayStore.getCurrentRunId(sessionKey);
    try {
      await abortChatMutation.mutateAsync({ runId: runId ?? undefined });
    } catch (error) {
      console.error("Failed to abort chat:", error);
    } finally {
      gatewayStore.clearStreaming(sessionKey);
    }
  }, [sessionKey, gatewayStore, abortChatMutation]);

  return {
    streamingMessage,
    handleSend,
    handleStop,
    isStreaming,
    isSending,
  };
}
