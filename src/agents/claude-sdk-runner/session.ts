/**
 * SDK session runner: creates and manages a Claude Agent SDK session with streaming.
 *
 * This module handles:
 * - Creating SDK queries with MCP tools
 * - Sending user prompts
 * - Streaming and processing messages via createSdkEventHandler()
 * - Abort/timeout handling with proper cleanup
 * - Returning results compatible with the pi-embedded system
 */

import {
  query,
  type Query,
  type SDKResultMessage,
  type NonNullableUsage,
} from "@anthropic-ai/claude-agent-sdk/sdk.mjs";

import { emitAgentEvent } from "../../infra/agent-events.js";
import { createOpenClawMcpServer } from "./tools.js";
import { createSdkEventHandler, type SdkMessage } from "./events.js";
import type { ClaudeSdkRunState, ClaudeSdkSessionResult, ClaudeSdkUsage } from "./types.js";
import type { AnyAgentTool } from "../pi-tools.types.js";
import type { MessagingToolSend } from "../pi-embedded-messaging.js";
import { log } from "./logger.js";

/** Parameters for running a Claude SDK session. */
export type RunClaudeSdkSessionParams = {
  prompt: string;
  tools: AnyAgentTool[];
  model: string;
  provider: string;
  runId: string;
  sessionId: string;
  timeoutMs: number;
  abortSignal?: AbortSignal;
  reasoningMode?: "off" | "on" | "stream";
  // Callbacks (for event handling parity with pi-embedded)
  onPartialReply?: (payload: { text?: string; mediaUrls?: string[] }) => void;
  onAssistantMessageStart?: () => void;
  /** Block reply callback. Note: replyToTag is string here for session layer, boolean internally. */
  onBlockReply?: (payload: {
    text?: string;
    mediaUrls?: string[];
    audioAsVoice?: boolean;
    replyToId?: string;
    replyToTag?: string;
    replyToCurrent?: boolean;
  }) => void;
  onBlockReplyFlush?: () => void;
  onReasoningStream?: (payload: { text?: string }) => void;
  onAgentEvent?: (evt: { stream: string; data: Record<string, unknown> }) => void;
};

/**
 * Extract usage information from SDK result message.
 */
function extractUsage(msg: SDKResultMessage): ClaudeSdkUsage | undefined {
  if (msg.type !== "result") {
    return undefined;
  }
  const usage = msg.usage as NonNullableUsage | undefined;
  if (!usage) {
    return undefined;
  }
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens,
    cacheWriteTokens: usage.cache_creation_input_tokens,
  };
}

/**
 * Extract stop reason from SDK result message.
 */
function extractStopReason(msg: SDKResultMessage): string | undefined {
  if (msg.subtype === "success") {
    return "end_turn";
  }
  // Map error subtypes to stop reasons
  if (msg.subtype === "error_max_turns") {
    return "max_turns";
  }
  if (msg.subtype === "error_max_budget_usd") {
    return "max_budget";
  }
  return "error";
}

/**
 * Run a Claude SDK session with the given parameters.
 *
 * Creates an MCP server with OpenClaw tools, sends the user prompt,
 * streams and processes messages via the SDK event handler, and returns
 * a result compatible with the pi-embedded system.
 */
export async function runClaudeSdkSession(
  params: RunClaudeSdkSessionParams,
): Promise<ClaudeSdkSessionResult> {
  const started = Date.now();
  const runAbortController = new AbortController();

  log.debug(
    `session start: runId=${params.runId} sessionId=${params.sessionId} model=${params.model} reasoningMode=${params.reasoningMode ?? "off"} timeoutMs=${params.timeoutMs}`,
  );

  // Initialize run state
  const state: ClaudeSdkRunState = {
    assistantTexts: [],
    toolMetas: [],
    toolMetaById: new Map(),
    lastToolError: undefined,
    messagingToolSentTexts: [],
    messagingToolSentTextsNormalized: [],
    messagingToolSentTargets: [] as MessagingToolSend[],
    pendingMessagingTexts: new Map(),
    pendingMessagingTargets: new Map(),
    // Per-block tracking (used by event handler)
    contentBlocks: new Map(),
    currentTextBlockIndex: null,
    // Separate buffers for text and thinking
    deltaBuffer: "",
    thinkingBuffer: "",
    accumulatedThinking: "",
    lastStreamedAssistant: undefined,
    aborted: false,
    timedOut: false,
  };

  // Create SDK event handler to bridge SDK messages to pi-embedded callbacks
  // Adapts boolean replyToTag from events.ts to string for session callback
  const eventHandler = createSdkEventHandler({
    runId: params.runId,
    sessionId: params.sessionId,
    state,
    reasoningMode: params.reasoningMode ?? "off",
    shouldEmitPartialReplies: true,
    onPartialReply: params.onPartialReply,
    onAssistantMessageStart: params.onAssistantMessageStart,
    onBlockReply: params.onBlockReply
      ? (payload) => {
          // Adapt boolean replyToTag to string for session callback
          params.onBlockReply?.({
            ...payload,
            replyToTag: payload.replyToTag ? "true" : undefined,
          });
        }
      : undefined,
    onBlockReplyFlush: params.onBlockReplyFlush,
    onReasoningStream: params.onReasoningStream,
    onAgentEvent: params.onAgentEvent,
  });

  // Create MCP server with OpenClaw tools
  const mcpServer = createOpenClawMcpServer({
    tools: params.tools,
    runId: params.runId,
    state,
    abortSignal: runAbortController.signal,
  });

  let queryInstance: Query | undefined;
  let abortTimer: ReturnType<typeof setTimeout> | undefined;
  let usage: ClaudeSdkUsage | undefined;
  let errorMessage: string | undefined;
  let stopReason: string | undefined;
  let sdkSessionId: string | undefined;
  let messageCount = 0;

  // External abort handler (defined outside try so it can be cleaned up in finally)
  const onExternalAbort = () => {
    log.debug(`external abort triggered: runId=${params.runId}`);
    state.aborted = true;
    runAbortController.abort();
  };

  try {
    // Set up timeout
    abortTimer = setTimeout(
      () => {
        log.debug(`session timeout: runId=${params.runId} timeoutMs=${params.timeoutMs}`);
        state.timedOut = true;
        state.aborted = true;
        runAbortController.abort(new Error("request timed out"));
      },
      Math.max(1, params.timeoutMs),
    );

    // Handle external abort signal
    if (params.abortSignal?.aborted) {
      onExternalAbort();
    } else {
      params.abortSignal?.addEventListener("abort", onExternalAbort, { once: true });
    }

    // Emit lifecycle start event
    emitAgentEvent({
      runId: params.runId,
      stream: "lifecycle",
      data: { phase: "start", startedAt: started },
    });
    params.onAgentEvent?.({ stream: "lifecycle", data: { phase: "start", startedAt: started } });

    // Create SDK query with MCP tools
    log.debug(`SDK query creating: runId=${params.runId} promptLength=${params.prompt.length}`);
    queryInstance = query({
      prompt: params.prompt,
      options: {
        model: params.model,
        permissionMode: "bypassPermissions",
        allowedTools: params.tools.map((t) => t.name),
        mcpServers: {
          "openclaw-tools": mcpServer,
        },
        abortController: runAbortController,
        includePartialMessages: true,
      },
    });

    // Stream and process messages via event handler
    for await (const msg of queryInstance) {
      messageCount++;
      // Log progress every 50 messages
      if (messageCount % 50 === 0) {
        log.debug(`SDK message progress: runId=${params.runId} messagesProcessed=${messageCount}`);
      }

      // Check for abort
      if (runAbortController.signal.aborted) {
        break;
      }

      // Capture session ID from first message
      if (!sdkSessionId && "session_id" in msg) {
        sdkSessionId = msg.session_id;
        log.debug(`SDK session ID captured: ${sdkSessionId}`);
      }

      // Let event handler process all message types
      eventHandler.handleMessage(msg as SdkMessage);

      // Extract usage and stop reason from result messages (handler doesn't track this)
      if (msg.type === "result") {
        usage = extractUsage(msg);
        stopReason = extractStopReason(msg);
        log.debug(
          `SDK result received: stopReason=${stopReason} inputTokens=${usage?.inputTokens ?? 0} outputTokens=${usage?.outputTokens ?? 0}`,
        );
        if (msg.subtype !== "success") {
          const errMsg = msg as { errors?: string[] };
          errorMessage = errMsg.errors?.join("; ");
        }
        // Flush any remaining block reply
        params.onBlockReplyFlush?.();
      }
    }
  } catch (err) {
    if (!state.aborted) {
      errorMessage = String(err);
      log.debug(`session error: runId=${params.runId} error=${errorMessage}`);
    }
  } finally {
    // Cleanup
    if (abortTimer) {
      clearTimeout(abortTimer);
    }
    queryInstance?.close();
    params.abortSignal?.removeEventListener?.("abort", onExternalAbort);

    // Emit lifecycle end event
    const endData = { phase: "end", endedAt: Date.now(), durationMs: Date.now() - started };
    emitAgentEvent({
      runId: params.runId,
      stream: "lifecycle",
      data: endData,
    });
    params.onAgentEvent?.({ stream: "lifecycle", data: endData });
  }

  log.debug(
    `session complete: runId=${params.runId} durationMs=${Date.now() - started} aborted=${state.aborted} timedOut=${state.timedOut} messagesProcessed=${messageCount} assistantTexts=${state.assistantTexts.length} toolMetas=${state.toolMetas.length}`,
  );

  return {
    assistantTexts: state.assistantTexts,
    toolMetas: state.toolMetas,
    lastToolError: state.lastToolError,
    usage,
    sessionId: sdkSessionId ?? params.sessionId,
    model: params.model,
    provider: params.provider,
    aborted: state.aborted,
    timedOut: state.timedOut,
    messagingToolSentTexts: state.messagingToolSentTexts,
    messagingToolSentTargets: state.messagingToolSentTargets,
    didSendViaMessagingTool: state.messagingToolSentTexts.length > 0,
    stopReason,
    errorMessage,
    // Include accumulated thinking for reasoningMode="on" (non-streaming)
    accumulatedThinking: state.accumulatedThinking || undefined,
  };
}
