/**
 * Claude SDK runner entry point.
 *
 * Implements the same contract as pi-embedded-runner (RunEmbeddedPiAgentParams -> EmbeddedPiRunResult)
 * but uses the Claude Agent SDK for execution instead of pi-agent/pi-ai.
 *
 * This module:
 * - Accepts RunEmbeddedPiAgentParams
 * - Creates tools via createOpenClawCodingTools (shared with pi-embedded)
 * - Executes via runClaudeSdkSession
 * - Builds payloads via buildEmbeddedRunPayloads (shared with pi-embedded)
 * - Writes session history for audit (write-only, not for resumption)
 * - Returns EmbeddedPiRunResult with full parity
 */

import type { RunEmbeddedPiAgentParams } from "../pi-embedded-runner/run/params.js";
import type { EmbeddedPiAgentMeta, EmbeddedPiRunResult } from "../pi-embedded-runner/types.js";
import { buildEmbeddedRunPayloads } from "../pi-embedded-runner/run/payloads.js";
import { createOpenClawCodingTools } from "../pi-tools.js";
import { resolveOpenClawAgentDir } from "../agent-paths.js";
import { resolveUserPath } from "../../utils.js";
import { isMarkdownCapableMessageChannel } from "../../utils/message-channel.js";
import { normalizeUsage, type UsageLike } from "../usage.js";
import { runClaudeSdkSession, type ClaudeSdkOptions } from "./session.js";
import {
  resolveAllClaudeSdkEnv,
  isValidClaudeSdkProvider,
  type ClaudeSdkProvider,
} from "./provider-config.js";
import { appendSdkSessionAuditLog } from "./audit-log.js";
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from "../defaults.js";
import { log } from "./logger.js";

/**
 * Map ReasoningLevel to SDK reasoning mode.
 * SDK expects: "off" | "on" | "stream"
 */
function mapReasoningLevel(level?: "off" | "on" | "stream"): "off" | "on" | "stream" {
  return level ?? "off";
}

/**
 * Run an agent session using the Claude Agent SDK.
 *
 * Accepts the same params as the pi-embedded runner and returns the same result type,
 * allowing this to be used as a drop-in replacement when SDK execution is preferred.
 */
export async function runClaudeSdkAgent(
  params: RunEmbeddedPiAgentParams,
): Promise<EmbeddedPiRunResult> {
  const started = Date.now();

  log.debug(
    `run start: runId=${params.runId} sessionId=${params.sessionId} model=${params.model ?? DEFAULT_MODEL} provider=${params.provider ?? DEFAULT_PROVIDER}`,
  );

  // Resolve paths and defaults
  const resolvedWorkspace = resolveUserPath(params.workspaceDir);
  const agentDir = params.agentDir ?? resolveOpenClawAgentDir();
  const provider = (params.provider ?? DEFAULT_PROVIDER).trim() || DEFAULT_PROVIDER;
  const modelId = (params.model ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  // Resolve tool result format based on channel capabilities
  const channelHint = params.messageChannel ?? params.messageProvider;
  const resolvedToolResultFormat =
    params.toolResultFormat ??
    (channelHint
      ? isMarkdownCapableMessageChannel(channelHint)
        ? "markdown"
        : "plain"
      : "markdown");

  // Create OpenClaw coding tools (same tool creation as pi-embedded)
  // The SDK runner uses these tools via MCP bridge
  const toolsDisabled = params.disableTools;
  const tools = toolsDisabled
    ? []
    : createOpenClawCodingTools({
        exec: { ...params.execOverrides, elevated: params.bashElevated },
        messageProvider: params.messageChannel ?? params.messageProvider,
        agentAccountId: params.agentAccountId,
        messageTo: params.messageTo,
        messageThreadId: params.messageThreadId,
        groupId: params.groupId,
        groupChannel: params.groupChannel,
        groupSpace: params.groupSpace,
        spawnedBy: params.spawnedBy,
        senderId: params.senderId,
        senderName: params.senderName,
        senderUsername: params.senderUsername,
        senderE164: params.senderE164,
        sessionKey: params.sessionKey ?? params.sessionId,
        agentDir,
        workspaceDir: resolvedWorkspace,
        config: params.config,
        modelProvider: provider,
        modelId,
        // Slack auto-threading context
        currentChannelId: params.currentChannelId,
        currentThreadTs: params.currentThreadTs,
        replyToMode: params.replyToMode,
        hasRepliedRef: params.hasRepliedRef,
      });

  log.debug(`tools created: count=${tools.length} disabled=${toolsDisabled}`);

  // Resolve Claude SDK options and environment overrides
  const claudeSdkOptions = params.claudeSdkOptions as ClaudeSdkOptions | undefined;
  const sdkProvider: ClaudeSdkProvider = isValidClaudeSdkProvider(
    claudeSdkOptions?.provider ?? "anthropic",
  )
    ? (claudeSdkOptions?.provider ?? "anthropic")
    : "anthropic";

  // Resolve env overrides for non-Anthropic providers and custom model mappings
  const envOverrides = await resolveAllClaudeSdkEnv({
    provider: sdkProvider,
    cfg: params.config,
    agentDir,
    claudeSdkOptions,
  });

  log.debug(
    `SDK config: provider=${sdkProvider} hasEnvOverrides=${Boolean(envOverrides)} hasModelMappings=${Boolean(claudeSdkOptions?.models)} thinkLevel=${params.thinkLevel ?? "default"}`,
  );

  // Create callback adapters to bridge type differences between params and session
  // The session uses slightly different callback signatures; we adapt here for compatibility
  const onBlockReplyAdapter = params.onBlockReply
    ? (payload: {
        text?: string;
        mediaUrls?: string[];
        audioAsVoice?: boolean;
        replyToId?: string;
        replyToTag?: string;
        replyToCurrent?: boolean;
      }) => {
        // Convert string replyToTag to boolean for pi-embedded callback compatibility
        void params.onBlockReply?.({
          text: payload.text,
          mediaUrls: payload.mediaUrls,
          audioAsVoice: payload.audioAsVoice,
          replyToId: payload.replyToId,
          replyToTag: Boolean(payload.replyToTag),
          replyToCurrent: payload.replyToCurrent,
        });
      }
    : undefined;

  const onReasoningStreamAdapter = params.onReasoningStream
    ? (payload: { text?: string }) => {
        // Add empty mediaUrls for pi-embedded callback compatibility
        void params.onReasoningStream?.({
          text: payload.text,
          mediaUrls: undefined,
        });
      }
    : undefined;

  // Run the SDK session
  const result = await runClaudeSdkSession({
    prompt: params.prompt,
    tools,
    model: modelId,
    provider,
    runId: params.runId,
    sessionId: params.sessionId,
    timeoutMs: params.timeoutMs,
    abortSignal: params.abortSignal,
    reasoningMode: mapReasoningLevel(params.reasoningLevel),
    // Thinking and provider configuration
    thinkLevel: params.thinkLevel,
    claudeSdkOptions,
    envOverrides,
    // Pass through callbacks for streaming parity (with adapters where needed)
    onPartialReply: params.onPartialReply,
    onAssistantMessageStart: params.onAssistantMessageStart,
    onBlockReply: onBlockReplyAdapter,
    onBlockReplyFlush: params.onBlockReplyFlush,
    onReasoningStream: onReasoningStreamAdapter,
    onAgentEvent: params.onAgentEvent,
  });

  // Build payloads using the same logic as pi-embedded
  // This ensures output formatting parity
  log.trace(
    `building payloads: assistantTexts=${result.assistantTexts.length} toolMetas=${result.toolMetas.length}`,
  );
  const payloads = buildEmbeddedRunPayloads({
    assistantTexts: result.assistantTexts,
    toolMetas: result.toolMetas,
    // SDK runner doesn't have full AssistantMessage from pi-ai, pass undefined
    // Payload builder handles this gracefully
    lastAssistant: undefined,
    lastToolError: result.lastToolError,
    config: params.config,
    sessionKey: params.sessionKey ?? params.sessionId,
    verboseLevel: params.verboseLevel,
    reasoningLevel: params.reasoningLevel,
    toolResultFormat: resolvedToolResultFormat,
    inlineToolResultsAllowed: false,
  });

  log.trace(
    `payloads built: count=${payloads.length} from assistantTexts=${result.assistantTexts.length}`,
  );

  // Normalize usage from SDK format to pi-embedded format
  const usage = result.usage
    ? normalizeUsage({
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheRead: result.usage.cacheReadTokens,
        cacheWrite: result.usage.cacheWriteTokens,
      } as UsageLike)
    : undefined;

  // Build agent meta (same structure as pi-embedded)
  const agentMeta: EmbeddedPiAgentMeta = {
    sessionId: result.sessionId,
    provider: result.provider,
    model: result.model,
    usage,
  };

  // Determine error info if present
  const errorInfo = result.errorMessage
    ? {
        // Default to context_overflow for SDK errors; could be refined based on error message parsing
        kind: "context_overflow" as const,
        message: result.errorMessage,
      }
    : undefined;

  // Optionally prepend thinking to first payload text
  let finalPayloads = payloads;
  if (params.includeThinkingInText && result.accumulatedThinking && payloads.length > 0) {
    const thinkingBlock = `<thinking>\n${result.accumulatedThinking}\n</thinking>\n\n`;
    finalPayloads = [
      {
        ...payloads[0],
        text: payloads[0].text ? thinkingBlock + payloads[0].text : thinkingBlock,
      },
      ...payloads.slice(1),
    ];
  }

  // Write session audit log (write-only, SDK manages context via session_id)
  if (params.sessionFile) {
    void appendSdkSessionAuditLog({
      sessionFile: params.sessionFile,
      sessionId: params.sessionId,
      prompt: params.prompt,
      assistantTexts: result.assistantTexts,
      model: modelId,
      provider,
      usage,
    });
  }

  const durationMs = Date.now() - started;
  log.debug(
    `run complete: runId=${params.runId} durationMs=${durationMs} aborted=${result.aborted} stopReason=${result.stopReason ?? "none"} payloads=${finalPayloads.length}`,
  );

  return {
    payloads: finalPayloads.length ? finalPayloads : undefined,
    meta: {
      durationMs,
      agentMeta,
      aborted: result.aborted,
      // Note: systemPromptReport is not available from SDK runner
      // The SDK manages system prompts internally
      error: errorInfo,
      stopReason: result.stopReason,
      // SDK runner doesn't support client tool calls (OpenResponses hosted tools) yet
      pendingToolCalls: undefined,
    },
    didSendViaMessagingTool: result.didSendViaMessagingTool,
    messagingToolSentTexts: result.messagingToolSentTexts,
    messagingToolSentTargets: result.messagingToolSentTargets,
  };
}

// Export as default for runtime selection
export { runClaudeSdkAgent as default };

// Re-export types for consumers
export type { RunEmbeddedPiAgentParams } from "../pi-embedded-runner/run/params.js";
export type { EmbeddedPiRunResult, EmbeddedPiAgentMeta } from "../pi-embedded-runner/types.js";
