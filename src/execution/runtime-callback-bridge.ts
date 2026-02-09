import type { ReplyPayload } from "../auto-reply/types.js";
import type { ExecutionRequest } from "./types.js";

type CallbackBridgeLogger = {
  error?: (message: string) => void;
};

type AgentEventPayload = {
  stream: string;
  data: Record<string, unknown>;
};

export function createExecutionRuntimeCallbackBridge(params: {
  request: ExecutionRequest;
  logger?: CallbackBridgeLogger;
}) {
  const { request, logger } = params;

  const safeInvoke = async (label: string, fn: () => Promise<void> | void): Promise<void> => {
    try {
      await fn();
    } catch (err) {
      logger?.error?.(
        `[TurnExecutor] ${label} callback failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const onAssistantMessageStart = async (): Promise<void> => {
    if (!request.onAssistantMessageStart) {
      return;
    }
    await safeInvoke("onAssistantMessageStart", () => request.onAssistantMessageStart?.());
  };

  const onBlockReplyFlush = async (): Promise<void> => {
    if (!request.onBlockReplyFlush) {
      return;
    }
    await safeInvoke("onBlockReplyFlush", () => request.onBlockReplyFlush?.());
  };

  const onReasoningStream = async (payload: ReplyPayload): Promise<void> => {
    if (!request.onReasoningStream) {
      return;
    }
    await safeInvoke("onReasoningStream", () => request.onReasoningStream?.(payload));
  };

  const onToolResult = async (payload: ReplyPayload): Promise<void> => {
    if (!request.onToolResult) {
      return;
    }
    await safeInvoke("onToolResult", () => request.onToolResult?.(payload));
  };

  const onAgentEvent = async (event: AgentEventPayload): Promise<void> => {
    if (!request.onAgentEvent) {
      return;
    }
    await safeInvoke("onAgentEvent", () => request.onAgentEvent?.(event));
  };

  return {
    onAssistantMessageStart,
    onBlockReplyFlush,
    onReasoningStream,
    onToolResult,
    onAgentEvent,
  };
}
