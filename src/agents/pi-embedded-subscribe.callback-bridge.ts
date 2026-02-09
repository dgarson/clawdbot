import type { SubscribeEmbeddedPiSessionParams } from "./pi-embedded-subscribe.types.js";
import type { RawStreamEvent } from "./stream/index.js";

type CallbackBridgeLogger = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
};

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function toToolResultPayload(data: Record<string, unknown>): {
  text?: string;
  mediaUrls?: string[];
} {
  const text = typeof data.text === "string" ? data.text : undefined;
  const mediaUrls = Array.isArray(data.mediaUrls)
    ? data.mediaUrls.filter((value): value is string => typeof value === "string")
    : undefined;
  return {
    text,
    mediaUrls: mediaUrls && mediaUrls.length > 0 ? mediaUrls : undefined,
  };
}

export function createEmbeddedPiLegacyCallbackBridge(
  params: SubscribeEmbeddedPiSessionParams,
  log: CallbackBridgeLogger,
) {
  const safeInvoke = (label: string, fn: () => unknown) => {
    try {
      const result = fn();
      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch((err) => {
          log.debug(`${label} callback error: ${String(err)}`);
        });
      }
    } catch (err) {
      log.debug(`${label} callback error: ${String(err)}`);
    }
  };

  const emitRawStreamEvent = (event: RawStreamEvent) => {
    params.streamMiddleware?.push(event);

    switch (event.kind) {
      case "message_start":
        if (params.onAssistantMessageStart) {
          safeInvoke("onAssistantMessageStart", () => params.onAssistantMessageStart?.());
        }
        return;
      case "text_delta":
        if (params.onPartialReply) {
          safeInvoke("onPartialReply", () => params.onPartialReply?.({ text: event.text }));
        }
        return;
      case "thinking_delta":
        if (params.onReasoningStream) {
          safeInvoke("onReasoningStream", () => params.onReasoningStream?.({ text: event.text }));
        }
        return;
      case "block_reply":
        if (params.onBlockReply) {
          safeInvoke("onBlockReply", () =>
            params.onBlockReply?.({
              text: event.text,
              mediaUrls: event.mediaUrls?.length ? event.mediaUrls : undefined,
              audioAsVoice: event.audioAsVoice,
              replyToId: event.replyToId,
              replyToTag: event.replyToTag,
              replyToCurrent: event.replyToCurrent,
            }),
          );
        }
        return;
      case "block_reply_flush":
        if (params.onBlockReplyFlush) {
          safeInvoke("onBlockReplyFlush", () => params.onBlockReplyFlush?.());
        }
        return;
      case "agent_event":
        if (params.onAgentEvent) {
          safeInvoke("onAgentEvent", () =>
            params.onAgentEvent?.({
              stream: event.stream,
              data: event.data,
            }),
          );
        }
        if (
          params.onToolResult &&
          (event.stream === "tool_summary" || event.stream === "tool_output")
        ) {
          const payload = toToolResultPayload(event.data);
          if (payload.text || payload.mediaUrls?.length) {
            safeInvoke("onToolResult", () => params.onToolResult?.(payload));
          }
        }
        return;
      case "lifecycle":
        if (params.onAgentEvent) {
          safeInvoke("onAgentEvent", () =>
            params.onAgentEvent?.({
              stream: "lifecycle",
              data: event.data,
            }),
          );
        }
        return;
      default:
        return;
    }
  };

  return {
    emitRawStreamEvent,
  };
}
