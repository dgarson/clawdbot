import crypto from "node:crypto";
import type { TypingMode } from "../../config/types.js";
import type { ExecutionRequest, ExecutionResult } from "../../execution/types.js";
import type { OriginatingChannelType } from "../templating.js";
import type { GetReplyOptions, ReplyPayload } from "../types.js";
import type { FollowupRun } from "./queue.js";
import type { TypingController } from "./typing.js";
import { resolveAgentModelFallbacksOverride } from "../../agents/agent-scope.js";
import { lookupContextTokens } from "../../agents/context.js";
import { DEFAULT_CONTEXT_TOKENS } from "../../agents/defaults.js";
import { resolveSessionRuntimeKind } from "../../agents/main-agent-runtime-factory.js";
import { runWithModelFallback } from "../../agents/model-fallback.js";
import { runEmbeddedPiAgent } from "../../agents/pi-embedded.js";
import { resolveAgentIdFromSessionKey, type SessionEntry } from "../../config/sessions.js";
import { createDefaultExecutionKernel } from "../../execution/kernel.js";
import { logVerbose } from "../../globals.js";
import { registerAgentRunContext } from "../../infra/agent-events.js";
import { defaultRuntime } from "../../runtime.js";
import { stripHeartbeatToken } from "../heartbeat.js";
import { isSilentReplyText, SILENT_REPLY_TOKEN } from "../tokens.js";
import {
  applyReplyThreading,
  filterMessagingToolDuplicates,
  shouldSuppressMessagingToolReplies,
} from "./reply-payloads.js";
import { resolveReplyToMode } from "./reply-threading.js";
import { isRoutableChannel, routeReply } from "./route-reply.js";
import { incrementCompactionCount } from "./session-updates.js";
import { persistSessionUsageUpdate } from "./session-usage.js";
import { createTypingSignaler } from "./typing-mode.js";

export function createFollowupRunner(params: {
  opts?: GetReplyOptions;
  typing: TypingController;
  typingMode: TypingMode;
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
  sessionKey?: string;
  storePath?: string;
  defaultModel: string;
  agentCfgContextTokens?: number;
}): (queued: FollowupRun) => Promise<void> {
  const {
    opts,
    typing,
    typingMode,
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    defaultModel,
    agentCfgContextTokens,
  } = params;
  const typingSignals = createTypingSignaler({
    typing,
    mode: typingMode,
    isHeartbeat: opts?.isHeartbeat === true,
  });

  /**
   * Sends followup payloads, routing to the originating channel if set.
   *
   * When originatingChannel/originatingTo are set on the queued run,
   * replies are routed directly to that provider instead of using the
   * session's current dispatcher. This ensures replies go back to
   * where the message originated.
   */
  const sendFollowupPayloads = async (payloads: ReplyPayload[], queued: FollowupRun) => {
    // Check if we should route to originating channel.
    const { originatingChannel, originatingTo } = queued;
    const shouldRouteToOriginating = isRoutableChannel(originatingChannel) && originatingTo;

    if (!shouldRouteToOriginating && !opts?.onBlockReply) {
      logVerbose("followup queue: no onBlockReply handler; dropping payloads");
      return;
    }

    for (const payload of payloads) {
      if (!payload?.text && !payload?.mediaUrl && !payload?.mediaUrls?.length) {
        continue;
      }
      if (
        isSilentReplyText(payload.text, SILENT_REPLY_TOKEN) &&
        !payload.mediaUrl &&
        !payload.mediaUrls?.length
      ) {
        continue;
      }
      await typingSignals.signalTextDelta(payload.text);

      // Route to originating channel if set, otherwise fall back to dispatcher.
      if (shouldRouteToOriginating) {
        const result = await routeReply({
          payload,
          channel: originatingChannel,
          to: originatingTo,
          sessionKey: queued.run.sessionKey,
          accountId: queued.originatingAccountId,
          threadId: queued.originatingThreadId,
          cfg: queued.run.config,
        });
        if (!result.ok) {
          // Log error and fall back to dispatcher if available.
          const errorMsg = result.error ?? "unknown error";
          logVerbose(`followup queue: route-reply failed: ${errorMsg}`);
          // Fallback: try the dispatcher if routing failed.
          if (opts?.onBlockReply) {
            await opts.onBlockReply(payload);
          }
        }
      } else if (opts?.onBlockReply) {
        await opts.onBlockReply(payload);
      }
    }
  };

  return async (queued: FollowupRun) => {
    try {
      const runId = crypto.randomUUID();
      if (queued.run.sessionKey) {
        registerAgentRunContext(runId, {
          sessionKey: queued.run.sessionKey,
          verboseLevel: queued.run.verboseLevel,
        });
      }
      let autoCompactionCompleted = false;
      let runResult: Awaited<ReturnType<typeof runEmbeddedPiAgent>>;
      let fallbackProvider = queued.run.provider;
      let fallbackModel = queued.run.model;
      // Resolve runtime kind for the followup to use the same runtime as the parent session.
      const agentId = resolveAgentIdFromSessionKey(queued.run.sessionKey);
      const runtimeKind = resolveSessionRuntimeKind(
        queued.run.config,
        agentId,
        queued.run.sessionKey,
      );
      const onCompactionEvent = (evt: { stream: string; data: Record<string, unknown> }) => {
        if (evt.stream !== "compaction") {
          return;
        }
        const phase = typeof evt.data.phase === "string" ? evt.data.phase : "";
        const willRetry = Boolean(evt.data.willRetry);
        if (phase === "end" && !willRetry) {
          autoCompactionCompleted = true;
        }
      };

      try {
        const kernelResult = await runFollowupWithKernel({
          queued,
          runId,
          agentId,
          runtimeKind,
          onCompactionEvent,
        });
        runResult = kernelResult.runResult;
        fallbackProvider = kernelResult.fallbackProvider;
        fallbackModel = kernelResult.fallbackModel;
        autoCompactionCompleted = kernelResult.autoCompactionCompleted;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        defaultRuntime.error?.(`Followup agent failed before reply: ${message}`);
        return;
      }

      if (storePath && sessionKey) {
        const usage = runResult.meta.agentMeta?.usage;
        const modelUsed = runResult.meta.agentMeta?.model ?? fallbackModel ?? defaultModel;
        const contextTokensUsed =
          agentCfgContextTokens ??
          lookupContextTokens(modelUsed) ??
          sessionEntry?.contextTokens ??
          DEFAULT_CONTEXT_TOKENS;

        // Extract Claude SDK session ID for native session resume (SDK runtime only)
        const claudeSdkSessionId = runResult.meta.agentMeta?.claudeSessionId?.trim() || undefined;

        await persistSessionUsageUpdate({
          storePath,
          sessionKey,
          usage,
          modelUsed,
          providerUsed: fallbackProvider,
          contextTokensUsed,
          claudeSdkSessionId,
          logLabel: "followup",
        });
      }

      const payloadArray = runResult.payloads ?? [];
      if (payloadArray.length === 0) {
        return;
      }
      const sanitizedPayloads = payloadArray.flatMap((payload) => {
        const text = payload.text;
        if (!text || !text.includes("HEARTBEAT_OK")) {
          return [payload];
        }
        const stripped = stripHeartbeatToken(text, { mode: "message" });
        const hasMedia = Boolean(payload.mediaUrl) || (payload.mediaUrls?.length ?? 0) > 0;
        if (stripped.shouldSkip && !hasMedia) {
          return [];
        }
        return [{ ...payload, text: stripped.text }];
      });
      const replyToChannel =
        queued.originatingChannel ??
        (queued.run.messageProvider?.toLowerCase() as OriginatingChannelType | undefined);
      const replyToMode = resolveReplyToMode(
        queued.run.config,
        replyToChannel,
        queued.originatingAccountId,
        queued.originatingChatType,
      );

      const replyTaggedPayloads: ReplyPayload[] = applyReplyThreading({
        payloads: sanitizedPayloads,
        replyToMode,
        replyToChannel,
      });

      const dedupedPayloads = filterMessagingToolDuplicates({
        payloads: replyTaggedPayloads,
        sentTexts: runResult.messagingToolSentTexts ?? [],
      });
      const suppressMessagingToolReplies = shouldSuppressMessagingToolReplies({
        messageProvider: queued.run.messageProvider,
        messagingToolSentTargets: runResult.messagingToolSentTargets,
        originatingTo: queued.originatingTo,
        accountId: queued.run.agentAccountId,
      });
      const finalPayloads = suppressMessagingToolReplies ? [] : dedupedPayloads;

      if (finalPayloads.length === 0) {
        return;
      }

      if (autoCompactionCompleted) {
        await incrementCompactionCount({
          sessionEntry,
          sessionStore,
          sessionKey,
          storePath,
        });
        // Compaction events are internal-only and sent via event broadcast
        // to session-specific handlers. No user-facing message needed.
      }

      await sendFollowupPayloads(finalPayloads, queued);
    } finally {
      typing.markRunComplete();
    }
  };
}

// ---------------------------------------------------------------------------
// Kernel-based execution path (Phase 8.1)
// ---------------------------------------------------------------------------

type FollowupKernelResult = {
  runResult: Awaited<ReturnType<typeof runEmbeddedPiAgent>>;
  fallbackProvider: string;
  fallbackModel: string;
  autoCompactionCompleted: boolean;
};

/**
 * Execute a followup turn via the ExecutionKernel.
 *
 * Wraps kernel.execute() inside runWithModelFallback. The kernel handles
 * runtime selection, execution, and state persistence. Post-processing
 * (payload routing, session usage, compaction) stays in the caller.
 */
async function runFollowupWithKernel(params: {
  queued: FollowupRun;
  runId: string;
  agentId: string | undefined;
  runtimeKind: string;
  onCompactionEvent: (evt: { stream: string; data: Record<string, unknown> }) => void;
}): Promise<FollowupKernelResult> {
  const { queued, runId, agentId, onCompactionEvent } = params;
  let autoCompactionCompleted = false;

  const kernel = createDefaultExecutionKernel();

  const fallbackResult = await runWithModelFallback({
    cfg: queued.run.config,
    provider: queued.run.provider,
    model: queued.run.model,
    agentDir: queued.run.agentDir,
    fallbacksOverride: agentId
      ? resolveAgentModelFallbacksOverride(queued.run.config, agentId)
      : undefined,
    runtimeKind: params.runtimeKind as "pi" | "claude" | undefined,
    run: async (provider, model) => {
      const authProfileId = provider === queued.run.provider ? queued.run.authProfileId : undefined;

      const request: ExecutionRequest = {
        agentId: agentId ?? "main",
        sessionId: queued.run.sessionId,
        sessionKey: queued.run.sessionKey,
        runId,
        workspaceDir: queued.run.workspaceDir,
        agentDir: queued.run.agentDir,
        config: queued.run.config,
        prompt: queued.prompt,
        extraSystemPrompt: queued.run.extraSystemPrompt,
        timeoutMs: queued.run.timeoutMs,
        sessionFile: queued.run.sessionFile,
        providerOverride: provider,
        modelOverride: model,
        blockReplyBreak: queued.run.blockReplyBreak,
        messageContext: {
          provider: queued.run.messageProvider,
          senderId: queued.run.senderId,
          senderName: queued.run.senderName,
          senderUsername: queued.run.senderUsername,
          senderE164: queued.run.senderE164,
          groupId: queued.run.groupId,
          groupChannel: queued.run.groupChannel,
          groupSpace: queued.run.groupSpace,
          threadId: queued.originatingThreadId,
          accountId: queued.run.agentAccountId,
        },
        runtimeHints: {
          thinkLevel: queued.run.thinkLevel,
          verboseLevel: queued.run.verboseLevel,
          reasoningLevel: queued.run.reasoningLevel,
          authProfileId,
          authProfileIdSource: authProfileId ? queued.run.authProfileIdSource : undefined,
          enforceFinalTag: queued.run.enforceFinalTag,
          ownerNumbers: queued.run.ownerNumbers,
          skillsSnapshot: queued.run.skillsSnapshot,
          execOverrides: queued.run.execOverrides,
          bashElevated: queued.run.bashElevated,
          agentAccountId: queued.run.agentAccountId,
          messageTo: queued.originatingTo,
          messageProvider: queued.run.messageProvider,
        },
        onAgentEvent: (evt) => {
          onCompactionEvent(evt);
          // Track auto-compaction in the kernel path too
          if (
            evt.stream === "compaction" &&
            typeof evt.data.phase === "string" &&
            evt.data.phase === "end" &&
            !evt.data.willRetry
          ) {
            autoCompactionCompleted = true;
          }
        },
      };

      const result = await kernel.execute(request);
      return mapFollowupExecutionResultToLegacy(result);
    },
  });

  return {
    runResult: fallbackResult.result,
    fallbackProvider: fallbackResult.provider,
    fallbackModel: fallbackResult.model,
    autoCompactionCompleted,
  };
}

/**
 * Map ExecutionResult to the legacy EmbeddedPiRunResult format used by followup post-processing.
 */
function mapFollowupExecutionResultToLegacy(
  result: ExecutionResult,
): Awaited<ReturnType<typeof runEmbeddedPiAgent>> {
  return {
    payloads: result.payloads.map((p) => ({
      text: p.text,
      mediaUrl: p.mediaUrl,
      mediaUrls: p.mediaUrls,
      replyToId: p.replyToId,
      isError: p.isError,
    })),
    meta: {
      durationMs: result.usage.durationMs,
      aborted: result.aborted,
      agentMeta: {
        sessionId: "",
        provider: result.runtime.provider ?? "",
        model: result.runtime.model ?? "",
        claudeSessionId: result.claudeSdkSessionId,
        usage: {
          input: result.usage.inputTokens,
          output: result.usage.outputTokens,
          cacheRead: result.usage.cacheReadTokens,
          cacheWrite: result.usage.cacheWriteTokens,
          total: result.usage.inputTokens + result.usage.outputTokens,
        },
      },
      systemPromptReport: result.systemPromptReport as Awaited<
        ReturnType<typeof runEmbeddedPiAgent>
      >["meta"]["systemPromptReport"],
      error: result.embeddedError
        ? {
            kind: result.embeddedError.kind as
              | "context_overflow"
              | "compaction_failure"
              | "role_ordering"
              | "image_size",
            message: result.embeddedError.message,
          }
        : undefined,
    },
    didSendViaMessagingTool: result.didSendViaMessagingTool,
    messagingToolSentTexts: result.messagingToolSentTexts,
    messagingToolSentTargets: result.messagingToolSentTargets as Awaited<
      ReturnType<typeof runEmbeddedPiAgent>
    >["messagingToolSentTargets"],
  };
}
