import fs from "node:fs/promises";
import os from "node:os";

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type {
  AssistantMessage,
  ImageContent,
  Message,
  TextContent,
  ThinkingContent,
  ToolCall,
  Usage,
  UserMessage,
} from "@mariozechner/pi-ai";
import {
  unstable_v2_createSession,
  type SDKAssistantMessage,
  type SDKMessage,
  type SDKPartialAssistantMessage,
  type SDKResultMessage,
  type SDKStatusMessage,
} from "@anthropic-ai/claude-agent-sdk";

import { resolveHeartbeatPrompt } from "../../auto-reply/heartbeat.js";
import { listChannelSupportedActions, resolveChannelMessageToolHints } from "../channel-tools.js";
import { resolveChannelCapabilities } from "../../config/channel-capabilities.js";
import { getMachineDisplayName } from "../../infra/machine-name.js";
import { resolveTelegramInlineButtonsScope } from "../../telegram/inline-buttons.js";
import { resolveTelegramReactionLevel } from "../../telegram/reaction-level.js";
import { resolveSignalReactionLevel } from "../../signal/reaction-level.js";
import { normalizeMessageChannel } from "../../utils/message-channel.js";
import { isReasoningTagProvider } from "../../utils/provider-utils.js";
import { isSubagentSessionKey } from "../../routing/session-key.js";
import { resolveUserPath } from "../../utils.js";
import { resolveOpenClawAgentDir } from "../agent-paths.js";
import { resolveSessionAgentIds } from "../agent-scope.js";
import { makeBootstrapWarn, resolveBootstrapContextForRun } from "../bootstrap-files.js";
import { resolveOpenClawDocsPath } from "../docs-path.js";
import { resolveModelAuthMode } from "../model-auth.js";
import { subscribeEmbeddedPiSession } from "../pi-embedded-subscribe.js";
import { createOpenClawCodingTools } from "../pi-tools.js";
import { resolveSandboxContext } from "../sandbox.js";
import { buildEmbeddedSandboxInfo } from "../pi-embedded-runner/sandbox-info.js";
import {
  applySkillEnvOverrides,
  applySkillEnvOverridesFromSnapshot,
  loadWorkspaceSkillEntries,
  resolveSkillsPromptForRun,
} from "../skills.js";
import { DEFAULT_BOOTSTRAP_FILENAME } from "../workspace.js";
import { buildSystemPromptReport } from "../system-prompt-report.js";
import { resolveDefaultModelForAgent } from "../model-selection.js";
import { buildEmbeddedSystemPrompt } from "../pi-embedded-runner/system-prompt.js";
import { buildModelAliasLines } from "../pi-embedded-runner/model.js";
import { buildSystemPromptParams } from "../system-prompt-params.js";
import { resolveSandboxRuntimeStatus } from "../sandbox/runtime-status.js";
import { buildTtsSystemPromptHint } from "../../tts/tts.js";
import { isTimeoutError } from "../failover-error.js";
import { getGlobalHookRunner } from "../../plugins/hook-runner-global.js";
import { MAX_IMAGE_BYTES } from "../../media/constants.js";
import { normalizeUsage, type UsageLike } from "../usage.js";
import { isCloudCodeAssistFormatError, resolveBootstrapMaxChars } from "../pi-embedded-helpers.js";

import { isAbortError } from "../pi-embedded-runner/abort.js";
import { detectAndLoadPromptImages } from "../pi-embedded-runner/run/images.js";
import {
  clearActiveEmbeddedRun,
  setActiveEmbeddedRun,
  type EmbeddedPiQueueHandle,
} from "../pi-embedded-runner/runs.js";
import { log } from "../pi-embedded-runner/logger.js";
import type {
  EmbeddedRunAttemptParams,
  EmbeddedRunAttemptResult,
} from "../pi-embedded-runner/run/types.js";

import { createEmbeddedEventSink } from "./events.js";
import { createOpenClawSdkMcpServer } from "./tools.js";
import type { ClaudeSdkClientToolCall } from "./types.js";

const createEmptyUsage = (): Usage => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
});

const buildUsage = (usageLike?: UsageLike | null): Usage => {
  const normalized = normalizeUsage(usageLike ?? undefined);
  if (!normalized) {
    return createEmptyUsage();
  }
  const total =
    normalized.total ??
    (normalized.input ?? 0) +
      (normalized.output ?? 0) +
      (normalized.cacheRead ?? 0) +
      (normalized.cacheWrite ?? 0);
  return {
    input: normalized.input ?? 0,
    output: normalized.output ?? 0,
    cacheRead: normalized.cacheRead ?? 0,
    cacheWrite: normalized.cacheWrite ?? 0,
    totalTokens: total ?? 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
};

const extractSdkMessageText = (
  message: unknown,
): { text: string; thinking: string; toolCalls: ToolCall[] } => {
  if (!message || typeof message !== "object") {
    return { text: "", thinking: "", toolCalls: [] };
  }
  const record = message as Record<string, unknown>;
  const content = Array.isArray(record.content) ? record.content : [];
  const textParts: string[] = [];
  const thinkingParts: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const blockRecord = block as Record<string, unknown>;
    const type = typeof blockRecord.type === "string" ? blockRecord.type : "";
    if (type === "text" && typeof blockRecord.text === "string") {
      textParts.push(blockRecord.text);
      continue;
    }
    if (type === "thinking") {
      const thinking =
        typeof blockRecord.thinking === "string"
          ? blockRecord.thinking
          : typeof blockRecord.text === "string"
            ? blockRecord.text
            : "";
      if (thinking) {
        thinkingParts.push(thinking);
      }
      continue;
    }
    if (type === "tool_use") {
      const id = typeof blockRecord.id === "string" ? blockRecord.id : "";
      const name = typeof blockRecord.name === "string" ? blockRecord.name : "tool";
      const input =
        blockRecord.input && typeof blockRecord.input === "object" ? blockRecord.input : {};
      toolCalls.push({ type: "toolCall", id, name, arguments: input as Record<string, any> });
    }
  }

  return {
    text: textParts.join("\n").trim(),
    thinking: thinkingParts.join("\n").trim(),
    toolCalls,
  };
};

const mapStopReason = (raw?: unknown): AssistantMessage["stopReason"] => {
  const reason = typeof raw === "string" ? raw.toLowerCase() : "";
  if (reason === "tool_use") {
    return "toolUse";
  }
  if (reason === "max_tokens") {
    return "length";
  }
  if (reason === "error") {
    return "error";
  }
  return "stop";
};

const buildAssistantMessage = (params: {
  sdkMessage?: SDKAssistantMessage;
  usage?: UsageLike;
  provider: string;
  model: string;
  api: string;
  fallbackText?: string;
  errorMessage?: string;
}): AssistantMessage => {
  const textParts: TextContent[] = [];
  const thinkingParts: ThinkingContent[] = [];
  const toolCalls: ToolCall[] = [];

  if (params.sdkMessage) {
    const extracted = extractSdkMessageText(params.sdkMessage.message);
    if (extracted.text) {
      textParts.push({ type: "text", text: extracted.text });
    } else if (params.fallbackText) {
      textParts.push({ type: "text", text: params.fallbackText });
    }
    if (extracted.thinking) {
      thinkingParts.push({ type: "thinking", thinking: extracted.thinking });
    }
    toolCalls.push(...extracted.toolCalls);
  } else if (params.fallbackText) {
    textParts.push({ type: "text", text: params.fallbackText });
  }

  const usage = buildUsage(params.usage);
  const rawStopReason = params.sdkMessage
    ? (params.sdkMessage.message as { stop_reason?: unknown } | undefined)?.stop_reason
    : undefined;
  const stopReason = params.errorMessage ? "error" : mapStopReason(rawStopReason);

  return {
    role: "assistant",
    content: [...textParts, ...thinkingParts, ...toolCalls],
    api: params.api as any,
    provider: params.provider,
    model: params.model,
    usage,
    stopReason,
    errorMessage: params.errorMessage,
    timestamp: Date.now(),
  };
};

const buildUserMessage = (text: string, images: ImageContent[]): UserMessage => {
  const content: Message["content"] = images.length
    ? ([{ type: "text", text }, ...images] as Message["content"])
    : text;
  return {
    role: "user",
    content,
    timestamp: Date.now(),
  } as UserMessage;
};

const buildSdkUserMessage = (text: string, images: ImageContent[]) => {
  if (images.length === 0) {
    return text;
  }
  return {
    type: "user",
    session_id: "",
    parent_tool_use_id: null,
    message: {
      role: "user",
      content: [
        { type: "text", text },
        ...images.map((img) => ({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mimeType,
            data: img.data,
          },
        })),
      ],
    },
  };
};

export async function runClaudeSdkAttempt(
  params: EmbeddedRunAttemptParams,
): Promise<EmbeddedRunAttemptResult> {
  const resolvedWorkspace = resolveUserPath(params.workspaceDir);
  const prevCwd = process.cwd();
  const runAbortController = new AbortController();

  log.debug(
    `claude sdk run start: runId=${params.runId} sessionId=${params.sessionId} provider=${params.provider} model=${params.modelId} thinking=${params.thinkLevel}`,
  );

  await fs.mkdir(resolvedWorkspace, { recursive: true });

  const sandboxSessionKey = params.sessionKey?.trim() || params.sessionId;
  const sandbox = await resolveSandboxContext({
    config: params.config,
    sessionKey: sandboxSessionKey,
    workspaceDir: resolvedWorkspace,
  });
  const effectiveWorkspace = sandbox?.enabled
    ? sandbox.workspaceAccess === "rw"
      ? resolvedWorkspace
      : sandbox.workspaceDir
    : resolvedWorkspace;
  await fs.mkdir(effectiveWorkspace, { recursive: true });

  let restoreSkillEnv: (() => void) | undefined;
  let promptError: unknown = null;
  let messagesSnapshot: AgentMessage[] = [];
  let lastAssistant: AssistantMessage | undefined;
  let usageFromResult: UsageLike | undefined;
  let clientToolCall: ClaudeSdkClientToolCall | undefined;

  let aborted = Boolean(params.abortSignal?.aborted);
  let timedOut = false;

  const getAbortReason = (signal: AbortSignal): unknown =>
    "reason" in signal ? (signal as { reason?: unknown }).reason : undefined;
  const makeAbortError = (signal: AbortSignal): Error => {
    const reason = getAbortReason(signal);
    const err = reason ? new Error("aborted", { cause: reason }) : new Error("aborted");
    err.name = "AbortError";
    return err;
  };

  let abortWarnTimer: NodeJS.Timeout | undefined;
  let activeSession: ReturnType<typeof unstable_v2_createSession> | undefined;
  let sessionIdUsed = params.sessionId;
  let isStreaming = false;
  let messageStarted = false;

  const abortRun = (isTimeout = false, reason?: unknown) => {
    aborted = true;
    if (isTimeout) {
      timedOut = true;
    }
    runAbortController.abort(reason);
    if (activeSession) {
      activeSession.close();
    }
  };

  const onAbort = () => {
    const reason = params.abortSignal ? getAbortReason(params.abortSignal) : undefined;
    const timeout = reason ? isTimeoutError(reason) : false;
    abortRun(timeout, reason);
  };

  if (params.abortSignal) {
    if (params.abortSignal.aborted) {
      onAbort();
    } else {
      params.abortSignal.addEventListener("abort", onAbort, { once: true });
    }
  }

  const abortTimer = setTimeout(
    () => {
      log.warn(
        `claude sdk run timeout: runId=${params.runId} sessionId=${params.sessionId} timeoutMs=${params.timeoutMs}`,
      );
      abortRun(true, new Error("request timed out"));
      if (!abortWarnTimer) {
        abortWarnTimer = setTimeout(() => {
          if (!isStreaming) {
            return;
          }
          log.warn(
            `claude sdk abort still streaming: runId=${params.runId} sessionId=${params.sessionId}`,
          );
        }, 10_000);
      }
    },
    Math.max(1, params.timeoutMs),
  );

  try {
    const shouldLoadSkillEntries = !params.skillsSnapshot || !params.skillsSnapshot.resolvedSkills;
    const skillEntries = shouldLoadSkillEntries
      ? loadWorkspaceSkillEntries(effectiveWorkspace)
      : [];
    restoreSkillEnv = params.skillsSnapshot
      ? applySkillEnvOverridesFromSnapshot({
          snapshot: params.skillsSnapshot,
          config: params.config,
        })
      : applySkillEnvOverrides({
          skills: skillEntries ?? [],
          config: params.config,
        });

    const skillsPrompt = resolveSkillsPromptForRun({
      skillsSnapshot: params.skillsSnapshot,
      entries: shouldLoadSkillEntries ? skillEntries : undefined,
      config: params.config,
      workspaceDir: effectiveWorkspace,
    });

    const sessionLabel = params.sessionKey ?? params.sessionId;
    const { bootstrapFiles: hookAdjustedBootstrapFiles, contextFiles } =
      await resolveBootstrapContextForRun({
        workspaceDir: effectiveWorkspace,
        config: params.config,
        sessionKey: params.sessionKey,
        sessionId: params.sessionId,
        warn: makeBootstrapWarn({ sessionLabel, warn: (message) => log.warn(message) }),
      });
    const workspaceNotes = hookAdjustedBootstrapFiles.some(
      (file) => file.name === DEFAULT_BOOTSTRAP_FILENAME && !file.missing,
    )
      ? ["Reminder: commit your changes in this workspace after edits."]
      : undefined;

    const agentDir = params.agentDir ?? resolveOpenClawAgentDir();

    const modelHasVision = params.model.input?.includes("image") ?? false;
    const toolsRaw = params.disableTools
      ? []
      : createOpenClawCodingTools({
          exec: {
            ...params.execOverrides,
            elevated: params.bashElevated,
          },
          sandbox,
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
          workspaceDir: effectiveWorkspace,
          config: params.config,
          abortSignal: runAbortController.signal,
          modelProvider: params.model.provider,
          modelId: params.modelId,
          modelAuthMode: resolveModelAuthMode(params.model.provider, params.config),
          currentChannelId: params.currentChannelId,
          currentThreadTs: params.currentThreadTs,
          replyToMode: params.replyToMode,
          hasRepliedRef: params.hasRepliedRef,
          modelHasVision,
        });

    const machineName = await getMachineDisplayName();
    const runtimeChannel = normalizeMessageChannel(params.messageChannel ?? params.messageProvider);
    let runtimeCapabilities = runtimeChannel
      ? (resolveChannelCapabilities({
          cfg: params.config,
          channel: runtimeChannel,
          accountId: params.agentAccountId,
        }) ?? [])
      : undefined;
    if (runtimeChannel === "telegram" && params.config) {
      const inlineButtonsScope = resolveTelegramInlineButtonsScope({
        cfg: params.config,
        accountId: params.agentAccountId ?? undefined,
      });
      if (inlineButtonsScope !== "off") {
        if (!runtimeCapabilities) {
          runtimeCapabilities = [];
        }
        if (
          !runtimeCapabilities.some((cap) => String(cap).trim().toLowerCase() === "inlinebuttons")
        ) {
          runtimeCapabilities.push("inlineButtons");
        }
      }
    }

    const reactionGuidance = runtimeChannel
      ? (() => {
          if (runtimeChannel === "telegram") {
            const level = resolveTelegramReactionLevel(params.config);
            return level === "off"
              ? undefined
              : { level: level === "high" ? "extensive" : "minimal", channel: "telegram" };
          }
          if (runtimeChannel === "signal") {
            const level = resolveSignalReactionLevel(params.config);
            return level === "off"
              ? undefined
              : { level: level === "high" ? "extensive" : "minimal", channel: "signal" };
          }
          return undefined;
        })()
      : undefined;

    const reasoningTagHint = isReasoningTagProvider(params.provider);
    const channelActions = runtimeChannel
      ? listChannelSupportedActions({
          cfg: params.config,
          channel: runtimeChannel,
        })
      : undefined;
    const messageToolHints = runtimeChannel
      ? resolveChannelMessageToolHints({
          cfg: params.config,
          channel: runtimeChannel,
          accountId: params.agentAccountId,
        })
      : undefined;

    const { defaultAgentId, sessionAgentId } = resolveSessionAgentIds({
      sessionKey: params.sessionKey,
      config: params.config,
    });
    const defaultModelRef = resolveDefaultModelForAgent({
      cfg: params.config ?? {},
      agentId: sessionAgentId,
    });
    const defaultModelLabel = `${defaultModelRef.provider}/${defaultModelRef.model}`;
    const { runtimeInfo, userTimezone, userTime, userTimeFormat } = buildSystemPromptParams({
      config: params.config,
      agentId: sessionAgentId,
      workspaceDir: effectiveWorkspace,
      cwd: process.cwd(),
      runtime: {
        host: machineName,
        os: `${os.type()} ${os.release()}`,
        arch: os.arch(),
        node: process.version,
        model: `${params.provider}/${params.modelId}`,
        defaultModel: defaultModelLabel,
        channel: runtimeChannel,
        capabilities: runtimeCapabilities,
        channelActions,
      },
    });

    const isDefaultAgent = sessionAgentId === defaultAgentId;
    const promptMode = isSubagentSessionKey(params.sessionKey) ? "minimal" : "full";
    const docsPath = await resolveOpenClawDocsPath({
      workspaceDir: effectiveWorkspace,
      argv1: process.argv[1],
      cwd: process.cwd(),
      moduleUrl: import.meta.url,
    });
    const ttsHint = params.config ? buildTtsSystemPromptHint(params.config) : undefined;

    const sandboxInfo = buildEmbeddedSandboxInfo({
      sandbox,
      workspaceDir: effectiveWorkspace,
      agentWorkspaceMount: sandbox?.agentWorkspaceMount,
      browserBridgeUrl: sandbox?.browserBridgeUrl,
      browserNoVncUrl: sandbox?.browserNoVncUrl,
    });

    const appendPrompt = buildEmbeddedSystemPrompt({
      workspaceDir: effectiveWorkspace,
      defaultThinkLevel: params.thinkLevel,
      reasoningLevel: params.reasoningLevel ?? "off",
      extraSystemPrompt: params.extraSystemPrompt,
      ownerNumbers: params.ownerNumbers,
      reasoningTagHint,
      heartbeatPrompt: isDefaultAgent
        ? resolveHeartbeatPrompt(params.config?.agents?.defaults?.heartbeat?.prompt)
        : undefined,
      skillsPrompt,
      docsPath: docsPath ?? undefined,
      ttsHint,
      workspaceNotes,
      reactionGuidance,
      promptMode,
      runtimeInfo,
      messageToolHints,
      sandboxInfo,
      tools: toolsRaw,
      modelAliasLines: buildModelAliasLines(params.config),
      userTimezone,
      userTime,
      userTimeFormat,
      contextFiles,
    });

    const systemPromptReport = buildSystemPromptReport({
      source: "run",
      generatedAt: Date.now(),
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      provider: params.provider,
      model: params.modelId,
      workspaceDir: effectiveWorkspace,
      bootstrapMaxChars: resolveBootstrapMaxChars(params.config),
      sandbox: (() => {
        const runtime = resolveSandboxRuntimeStatus({
          cfg: params.config,
          sessionKey: params.sessionKey ?? params.sessionId,
        });
        return { mode: runtime.mode, sandboxed: runtime.sandboxed };
      })(),
      systemPrompt: appendPrompt,
      bootstrapFiles: hookAdjustedBootstrapFiles,
      injectedFiles: contextFiles,
      skillsPrompt,
      tools: toolsRaw,
    });

    const { session: sinkSession, emit } = createEmbeddedEventSink(params.sessionId);
    const subscription = subscribeEmbeddedPiSession({
      session: sinkSession,
      runId: params.runId,
      verboseLevel: params.verboseLevel,
      reasoningMode: params.reasoningLevel ?? "off",
      toolResultFormat: params.toolResultFormat,
      shouldEmitToolResult: params.shouldEmitToolResult,
      shouldEmitToolOutput: params.shouldEmitToolOutput,
      onToolResult: params.onToolResult,
      onReasoningStream: params.onReasoningStream,
      onBlockReply: params.onBlockReply,
      onBlockReplyFlush: params.onBlockReplyFlush,
      blockReplyBreak: params.blockReplyBreak,
      blockReplyChunking: params.blockReplyChunking,
      onPartialReply: params.onPartialReply,
      onAssistantMessageStart: params.onAssistantMessageStart,
      onAgentEvent: params.onAgentEvent,
      enforceFinalTag: params.enforceFinalTag,
    });

    const {
      assistantTexts,
      toolMetas,
      unsubscribe,
      waitForCompactionRetry,
      getMessagingToolSentTexts,
      getMessagingToolSentTargets,
      didSendViaMessagingTool,
      getLastToolError,
    } = subscription;

    const mcpServer = createOpenClawSdkMcpServer({
      tools: toolsRaw,
      clientTools: params.clientTools,
      options: {
        emit,
        abortSignal: runAbortController.signal,
        onToolResultMessage: (message) => messagesSnapshot.push(message),
        onClientToolCall: (toolName, toolParams) => {
          if (!clientToolCall) {
            clientToolCall = { name: toolName, params: toolParams };
          }
        },
      },
    });

    const queueHandle: EmbeddedPiQueueHandle = {
      queueMessage: async (text: string) => {
        if (activeSession) {
          await activeSession.send(text);
        }
      },
      isStreaming: () => isStreaming,
      isCompacting: () => subscription.isCompacting(),
      abort: abortRun,
    };
    setActiveEmbeddedRun(params.sessionId, queueHandle);

    const hookRunner = getGlobalHookRunner();

    let effectivePrompt = params.prompt;
    if (hookRunner?.hasHooks("before_agent_start")) {
      try {
        const hookResult = await hookRunner.runBeforeAgentStart(
          {
            prompt: params.prompt,
            messages: [],
          },
          {
            agentId: params.sessionKey?.split(":")[0] ?? "main",
            sessionKey: params.sessionKey,
            workspaceDir: params.workspaceDir,
            messageProvider: params.messageProvider ?? undefined,
          },
        );
        if (hookResult?.prependContext) {
          effectivePrompt = `${hookResult.prependContext}\n\n${params.prompt}`;
          log.debug(
            `hooks: prepended context to prompt (${hookResult.prependContext.length} chars)`,
          );
        }
      } catch (hookErr) {
        log.warn(`before_agent_start hook failed: ${String(hookErr)}`);
      }
    }

    const messageStart = () => {
      if (messageStarted) {
        return;
      }
      messageStarted = true;
      emit({
        type: "message_start",
        message: buildAssistantMessage({
          provider: params.provider,
          model: params.modelId,
          api: params.model.api,
        }),
      });
    };

    const messageUpdate = (evt: { type: string; delta?: string; content?: string }) => {
      messageStart();
      emit({
        type: "message_update",
        message: buildAssistantMessage({
          provider: params.provider,
          model: params.modelId,
          api: params.model.api,
        }),
        assistantMessageEvent: {
          type: evt.type,
          delta: evt.delta ?? "",
          content: evt.content ?? "",
        },
      } as any);
    };

    const messageEnd = (assistantMessage: AssistantMessage) => {
      messageStarted = false;
      emit({ type: "message_end", message: assistantMessage });
    };

    const blockTypes = new Map<number, string>();
    const textBlocks = new Map<number, string>();
    let thinkingOpen = false;

    const handleThinkingDelta = (delta: string) => {
      if (!thinkingOpen) {
        thinkingOpen = true;
        messageUpdate({ type: "text_delta", delta: "<think>" });
      }
      if (delta) {
        messageUpdate({ type: "text_delta", delta });
      }
    };

    const handleThinkingEnd = () => {
      if (!thinkingOpen) {
        return;
      }
      thinkingOpen = false;
      messageUpdate({ type: "text_delta", delta: "</think>" });
    };

    const handleStreamEvent = (event: Record<string, unknown>) => {
      const eventType = typeof event.type === "string" ? event.type : "";
      const index = typeof event.index === "number" ? event.index : undefined;
      if (eventType === "content_block_start") {
        const block = event.content_block as Record<string, unknown> | undefined;
        const blockType = typeof block?.type === "string" ? block.type : "";
        if (index !== undefined && blockType) {
          blockTypes.set(index, blockType);
        }
        if (blockType === "text") {
          const initial = typeof block?.text === "string" ? block.text : "";
          if (index !== undefined) {
            textBlocks.set(index, initial);
          }
          messageUpdate({ type: "text_start", delta: initial });
        }
        if (blockType === "thinking") {
          const initial = typeof block?.thinking === "string" ? block.thinking : "";
          handleThinkingDelta(initial);
        }
        return;
      }
      if (eventType === "content_block_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        const deltaType = typeof delta?.type === "string" ? delta.type : "";
        if (deltaType === "text_delta") {
          const textDelta = typeof delta?.text === "string" ? delta.text : "";
          if (index !== undefined) {
            textBlocks.set(index, `${textBlocks.get(index) ?? ""}${textDelta}`);
          }
          if (textDelta) {
            messageUpdate({ type: "text_delta", delta: textDelta });
          }
        }
        if (deltaType === "thinking_delta") {
          const thinkingDelta = typeof delta?.text === "string" ? delta.text : "";
          handleThinkingDelta(thinkingDelta);
        }
        return;
      }
      if (eventType === "content_block_stop") {
        const blockType = index !== undefined ? blockTypes.get(index) : undefined;
        if (blockType === "text") {
          const content = index !== undefined ? (textBlocks.get(index) ?? "") : "";
          messageUpdate({ type: "text_end", content });
        }
        if (blockType === "thinking") {
          handleThinkingEnd();
        }
      }
    };

    const handleSdkMessage = (msg: SDKMessage) => {
      if (msg && typeof (msg as { session_id?: unknown }).session_id === "string") {
        sessionIdUsed = (msg as { session_id: string }).session_id;
      }
      if (msg.type === "system" && msg.subtype === "status") {
        const statusMsg = msg as SDKStatusMessage;
        if (statusMsg.status === "compacting") {
          emit({ type: "auto_compaction_start" });
        } else {
          emit({ type: "auto_compaction_end" } as any);
        }
        return;
      }
      if (msg.type === "stream_event") {
        const partial = msg as SDKPartialAssistantMessage;
        if (partial.event && typeof partial.event === "object") {
          handleStreamEvent(partial.event as Record<string, unknown>);
        }
        return;
      }
      if (msg.type === "assistant") {
        const assistant = msg as SDKAssistantMessage;
        lastAssistant = buildAssistantMessage({
          sdkMessage: assistant,
          usage: usageFromResult,
          provider: params.provider,
          model: params.modelId,
          api: params.model.api,
          errorMessage: assistant.error,
        });
        if (!messageStarted) {
          emit({ type: "message_start", message: lastAssistant });
        }
        messageEnd(lastAssistant);
        messagesSnapshot.push(lastAssistant);
        return;
      }
      if (msg.type === "result") {
        const result = msg as SDKResultMessage;
        if ("usage" in result) {
          usageFromResult = result.usage as UsageLike;
        }
        if (result.subtype && result.subtype.startsWith("error")) {
          promptError = new Error(result.errors?.[0] ?? "Claude SDK error");
        }
        return;
      }
    };

    const promptStartedAt = Date.now();
    try {
      const imageResult = await detectAndLoadPromptImages({
        prompt: effectivePrompt,
        workspaceDir: effectiveWorkspace,
        model: params.model,
        existingImages: params.images,
        historyMessages: [],
        maxBytes: MAX_IMAGE_BYTES,
        sandboxRoot: sandbox?.enabled ? sandbox.workspaceDir : undefined,
      });

      const userMessage = buildUserMessage(effectivePrompt, imageResult.images);
      messagesSnapshot.push(userMessage);

      const sdkMessage = buildSdkUserMessage(effectivePrompt, imageResult.images);

      const sdkOptions = {
        model: params.modelId,
        cwd: effectiveWorkspace,
        includePartialMessages: true,
        tools: [],
        mcpServers: mcpServer ? { openclaw: mcpServer } : undefined,
        systemPrompt: appendPrompt,
        settingSources: [],
        persistSession: false,
      } as const;

      activeSession = unstable_v2_createSession(sdkOptions as any);

      emit({ type: "agent_start" });

      isStreaming = true;
      const stream = activeSession.stream();
      const streamTask = (async () => {
        for await (const message of stream) {
          handleSdkMessage(message);
        }
      })();

      await activeSession.send(sdkMessage as any);
      await streamTask;
    } catch (err) {
      if (runAbortController.signal.aborted) {
        promptError = promptError ?? makeAbortError(runAbortController.signal);
      } else {
        promptError = err;
      }
    } finally {
      isStreaming = false;
      if (messageStarted && !lastAssistant) {
        const fallback = buildAssistantMessage({
          provider: params.provider,
          model: params.modelId,
          api: params.model.api,
          usage: usageFromResult,
          fallbackText: "",
          errorMessage: promptError ? String(promptError) : undefined,
        });
        lastAssistant = fallback;
        messageEnd(fallback);
        messagesSnapshot.push(fallback);
      }
      emit({ type: "agent_end" });
      activeSession?.close();

      try {
        await waitForCompactionRetry();
      } catch (err) {
        if (isAbortError(err)) {
          if (!promptError) {
            promptError = err;
          }
        } else {
          throw err;
        }
      }

      if (hookRunner?.hasHooks("agent_end")) {
        hookRunner
          .runAgentEnd(
            {
              messages: messagesSnapshot,
              success: !aborted && !promptError,
              error: promptError ? String(promptError) : undefined,
              durationMs: Date.now() - promptStartedAt,
            },
            {
              agentId: params.sessionKey?.split(":")[0] ?? "main",
              sessionKey: params.sessionKey,
              workspaceDir: params.workspaceDir,
              messageProvider: params.messageProvider ?? undefined,
            },
          )
          .catch((err) => {
            log.warn(`agent_end hook failed: ${err}`);
          });
      }

      unsubscribe();
      clearActiveEmbeddedRun(params.sessionId, queueHandle);
      params.abortSignal?.removeEventListener?.("abort", onAbort);
    }

    const toolMetasNormalized = toolMetas
      .filter(
        (entry): entry is { toolName: string; meta?: string } =>
          typeof entry.toolName === "string" && entry.toolName.trim().length > 0,
      )
      .map((entry) => ({ toolName: entry.toolName, meta: entry.meta }));

    const fallbackAssistant =
      !lastAssistant &&
      buildAssistantMessage({
        provider: params.provider,
        model: params.modelId,
        api: params.model.api,
        usage: usageFromResult,
        fallbackText: "",
        errorMessage: promptError ? String(promptError) : undefined,
      });

    return {
      aborted,
      timedOut,
      promptError,
      sessionIdUsed,
      systemPromptReport,
      messagesSnapshot,
      assistantTexts,
      toolMetas: toolMetasNormalized,
      lastAssistant: lastAssistant ?? fallbackAssistant,
      lastToolError: getLastToolError?.(),
      didSendViaMessagingTool: didSendViaMessagingTool(),
      messagingToolSentTexts: getMessagingToolSentTexts(),
      messagingToolSentTargets: getMessagingToolSentTargets(),
      cloudCodeAssistFormatError: Boolean(
        lastAssistant?.errorMessage && isCloudCodeAssistFormatError(lastAssistant.errorMessage),
      ),
      clientToolCall: clientToolCall ?? undefined,
    };
  } finally {
    if (abortTimer) {
      clearTimeout(abortTimer);
    }
    if (abortWarnTimer) {
      clearTimeout(abortWarnTimer);
    }
    if (restoreSkillEnv) {
      restoreSkillEnv();
    }
    process.chdir(prevCwd);
  }
}
