import { createRequire } from "node:module";
import { resolveAgentConfig, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { resolveEffectiveMessagesConfig, resolveHumanDelayConfig } from "../../agents/identity.js";
import { createMemoryGetTool, createMemorySearchTool } from "../../agents/tools/memory-tool.js";
import { handleSlackAction } from "../../agents/tools/slack-actions.js";
import {
  chunkByNewline,
  chunkMarkdownText,
  chunkMarkdownTextWithMode,
  chunkText,
  chunkTextWithMode,
  resolveChunkMode,
  resolveTextChunkLimit,
} from "../../auto-reply/chunk.js";
import {
  hasControlCommand,
  isControlCommandMessage,
  shouldComputeCommandAuthorized,
} from "../../auto-reply/command-detection.js";
import { shouldHandleTextCommands } from "../../auto-reply/commands-registry.js";
import {
  formatAgentEnvelope,
  formatInboundEnvelope,
  resolveEnvelopeFormatOptions,
} from "../../auto-reply/envelope.js";
import {
  createInboundDebouncer,
  resolveInboundDebounceMs,
} from "../../auto-reply/inbound-debounce.js";
import { dispatchReplyFromConfig } from "../../auto-reply/reply/dispatch-from-config.js";
import { finalizeInboundContext } from "../../auto-reply/reply/inbound-context.js";
import {
  buildMentionRegexes,
  matchesMentionPatterns,
  matchesMentionWithExplicit,
} from "../../auto-reply/reply/mentions.js";
import { dispatchReplyWithBufferedBlockDispatcher } from "../../auto-reply/reply/provider-dispatcher.js";
import { createReplyDispatcherWithTyping } from "../../auto-reply/reply/reply-dispatcher.js";
import { removeAckReactionAfterReply, shouldAckReaction } from "../../channels/ack-reactions.js";
import { resolveCommandAuthorizedFromAuthorizers } from "../../channels/command-gating.js";
import { discordMessageActions } from "../../channels/plugins/actions/discord.js";
import { signalMessageActions } from "../../channels/plugins/actions/signal.js";
import { telegramMessageActions } from "../../channels/plugins/actions/telegram.js";
import { createWhatsAppLoginTool } from "../../channels/plugins/agent-tools/whatsapp-login.js";
import { recordInboundSession } from "../../channels/session.js";
import { registerMemoryCli } from "../../cli/memory-cli.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import {
  resolveChannelGroupPolicy,
  resolveChannelGroupRequireMention,
} from "../../config/group-policy.js";
import { resolveMarkdownTableMode } from "../../config/markdown-tables.js";
import { resolveStateDir } from "../../config/paths.js";
import {
  readSessionUpdatedAt,
  recordSessionMetaFromInbound,
  resolveStorePath,
  updateLastRoute,
} from "../../config/sessions.js";
import { auditDiscordChannelPermissions } from "../../discord/audit.js";
import {
  listDiscordDirectoryGroupsLive,
  listDiscordDirectoryPeersLive,
} from "../../discord/directory-live.js";
import { monitorDiscordProvider } from "../../discord/monitor.js";
import { probeDiscord } from "../../discord/probe.js";
import { resolveDiscordChannelAllowlist } from "../../discord/resolve-channels.js";
import { resolveDiscordUserAllowlist } from "../../discord/resolve-users.js";
import { sendMessageDiscord, sendPollDiscord } from "../../discord/send.js";
import { shouldLogVerbose } from "../../globals.js";
import { monitorIMessageProvider } from "../../imessage/monitor.js";
import { probeIMessage } from "../../imessage/probe.js";
import { sendMessageIMessage } from "../../imessage/send.js";
import { getChannelActivity, recordChannelActivity } from "../../infra/channel-activity.js";
import { emitDiagnosticEvent, onDiagnosticEvent } from "../../infra/diagnostic-events.js";
import { enqueueSystemEvent } from "../../infra/system-events.js";
import {
  listLineAccountIds,
  normalizeAccountId as normalizeLineAccountId,
  resolveDefaultLineAccountId,
  resolveLineAccount,
} from "../../line/accounts.js";
import { monitorLineProvider } from "../../line/monitor.js";
import { probeLineBot } from "../../line/probe.js";
import {
  createQuickReplyItems,
  pushMessageLine,
  pushMessagesLine,
  pushFlexMessage,
  pushTemplateMessage,
  pushLocationMessage,
  pushTextMessageWithQuickReplies,
  sendMessageLine,
} from "../../line/send.js";
import { buildTemplateMessageFromPayload } from "../../line/template-messages.js";
import { getChildLogger } from "../../logging.js";
import { normalizeLogLevel } from "../../logging/levels.js";
import { convertMarkdownTables } from "../../markdown/tables.js";
import { isVoiceCompatibleAudio } from "../../media/audio.js";
import { mediaKindFromMime } from "../../media/constants.js";
import { fetchRemoteMedia } from "../../media/fetch.js";
import { getImageMetadata, resizeToJpeg } from "../../media/image-ops.js";
import { detectMime } from "../../media/mime.js";
import { saveMediaBuffer } from "../../media/store.js";
import { buildPairingReply } from "../../pairing/pairing-messages.js";
import {
  readChannelAllowFromStore,
  upsertChannelPairingRequest,
} from "../../pairing/pairing-store.js";
import { runCommandWithTimeout } from "../../process/exec.js";
import { resolveAgentRoute } from "../../routing/resolve-route.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { monitorSignalProvider } from "../../signal/index.js";
import { probeSignal } from "../../signal/probe.js";
import { sendMessageSignal } from "../../signal/send.js";
import {
  listSlackDirectoryGroupsLive,
  listSlackDirectoryPeersLive,
} from "../../slack/directory-live.js";
import { monitorSlackProvider } from "../../slack/index.js";
import { probeSlack } from "../../slack/probe.js";
import { resolveSlackChannelAllowlist } from "../../slack/resolve-channels.js";
import { resolveSlackUserAllowlist } from "../../slack/resolve-users.js";
import { sendMessageSlack } from "../../slack/send.js";
import {
  auditTelegramGroupMembership,
  collectTelegramUnmentionedGroupIds,
} from "../../telegram/audit.js";
import { monitorTelegramProvider } from "../../telegram/monitor.js";
import { probeTelegram } from "../../telegram/probe.js";
import { sendMessageTelegram, sendPollTelegram } from "../../telegram/send.js";
import { resolveTelegramToken } from "../../telegram/token.js";
import { textToSpeechTelephony } from "../../tts/tts.js";
import { getActiveWebListener } from "../../web/active-listener.js";
import {
  getWebAuthAgeMs,
  logoutWeb,
  logWebSelfId,
  readWebSelfId,
  webAuthExists,
} from "../../web/auth-store.js";
import { loadWebMedia } from "../../web/media.js";
import { createPluginCronScheduler, shutdownAllCronJobs as _shutdownAllCronJobs } from "./cron.js";
import { createPluginKvStore } from "./kv.js";
import { formatNativeDependencyHint } from "./native-deps.js";
import { createRuntimeQuota } from "./quota.js";
import type { PluginAgentsNamespace } from "./types.agents.js";
import type {
  PluginGatewayDispatcher,
  PluginRuntime,
  PluginSessionEntry,
  PluginSessionUsageSummary,
} from "./types.js";

export { shutdownAllCronJobs } from "./cron.js";

let cachedVersion: string | null = null;

// Gateway dispatcher is set after the full handler map is assembled during gateway startup.
// Before that point, calls will throw a clear error rather than silently failing.
let gatewayDispatcher: PluginGatewayDispatcher | null = null;

/**
 * Inject the in-process gateway dispatcher after all handlers (core + plugin) are assembled.
 * Called once during gateway startup. Subsequent calls replace the dispatcher (e.g. for reload).
 */
export function setGatewayDispatcher(dispatcher: PluginGatewayDispatcher): void {
  gatewayDispatcher = dispatcher;
}

const pluginGatewayCall: PluginGatewayDispatcher = async (method, params, opts) => {
  if (!gatewayDispatcher) {
    throw new Error(
      `runtime.gateway.call("${method}") called before gateway startup completed. ` +
        `Register a service or use gateway hooks for post-startup dispatch.`,
    );
  }
  return gatewayDispatcher(method, params, opts);
};

function resolveVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../../../package.json") as { version?: string };
    cachedVersion = pkg.version ?? "unknown";
    return cachedVersion;
  } catch {
    cachedVersion = "unknown";
    return cachedVersion;
  }
}

const sendMessageWhatsAppLazy: PluginRuntime["channel"]["whatsapp"]["sendMessageWhatsApp"] = async (
  ...args
) => {
  const { sendMessageWhatsApp } = await loadWebOutbound();
  return sendMessageWhatsApp(...args);
};

const sendPollWhatsAppLazy: PluginRuntime["channel"]["whatsapp"]["sendPollWhatsApp"] = async (
  ...args
) => {
  const { sendPollWhatsApp } = await loadWebOutbound();
  return sendPollWhatsApp(...args);
};

const loginWebLazy: PluginRuntime["channel"]["whatsapp"]["loginWeb"] = async (...args) => {
  const { loginWeb } = await loadWebLogin();
  return loginWeb(...args);
};

const startWebLoginWithQrLazy: PluginRuntime["channel"]["whatsapp"]["startWebLoginWithQr"] = async (
  ...args
) => {
  const { startWebLoginWithQr } = await loadWebLoginQr();
  return startWebLoginWithQr(...args);
};

const waitForWebLoginLazy: PluginRuntime["channel"]["whatsapp"]["waitForWebLogin"] = async (
  ...args
) => {
  const { waitForWebLogin } = await loadWebLoginQr();
  return waitForWebLogin(...args);
};

const monitorWebChannelLazy: PluginRuntime["channel"]["whatsapp"]["monitorWebChannel"] = async (
  ...args
) => {
  const { monitorWebChannel } = await loadWebChannel();
  return monitorWebChannel(...args);
};

const handleWhatsAppActionLazy: PluginRuntime["channel"]["whatsapp"]["handleWhatsAppAction"] =
  async (...args) => {
    const { handleWhatsAppAction } = await loadWhatsAppActions();
    return handleWhatsAppAction(...args);
  };

let webOutboundPromise: Promise<typeof import("../../web/outbound.js")> | null = null;
let webLoginPromise: Promise<typeof import("../../web/login.js")> | null = null;
let webLoginQrPromise: Promise<typeof import("../../web/login-qr.js")> | null = null;
let webChannelPromise: Promise<typeof import("../../channels/web/index.js")> | null = null;
let whatsappActionsPromise: Promise<
  typeof import("../../agents/tools/whatsapp-actions.js")
> | null = null;

function loadWebOutbound() {
  webOutboundPromise ??= import("../../web/outbound.js");
  return webOutboundPromise;
}

function loadWebLogin() {
  webLoginPromise ??= import("../../web/login.js");
  return webLoginPromise;
}

function loadWebLoginQr() {
  webLoginQrPromise ??= import("../../web/login-qr.js");
  return webLoginQrPromise;
}

function loadWebChannel() {
  webChannelPromise ??= import("../../channels/web/index.js");
  return webChannelPromise;
}

function loadWhatsAppActions() {
  whatsappActionsPromise ??= import("../../agents/tools/whatsapp-actions.js");
  return whatsappActionsPromise;
}

export function createPluginRuntime(params?: {
  /** Plugin identifier used to namespace the kv store and cron scheduler. */
  pluginId?: string;
  /** State directory for the kv store (defaults to resolved stateDir). */
  stateDir?: string;
}): PluginRuntime {
  const pluginId = params?.pluginId ?? "__global__";
  const stateDir = params?.stateDir ?? resolveStateDir();
  return {
    version: resolveVersion(),
    gateway: { call: pluginGatewayCall },
    config: createRuntimeConfig(),
    system: createRuntimeSystem(),
    media: createRuntimeMedia(),
    tts: { textToSpeechTelephony },
    tools: createRuntimeTools(),
    channel: createRuntimeChannel(),
    logging: createRuntimeLogging(),
    state: { resolveStateDir },
    sessions: createRuntimeSessions(),
    diagnostics: createRuntimeDiagnostics(),
    kv: createPluginKvStore(stateDir, pluginId),
    quota: createRuntimeQuota(),
    agents: createRuntimeAgents(),
    cron: createPluginCronScheduler(pluginId),
  };
}

function createRuntimeAgents(): PluginAgentsNamespace {
  return {
    async list() {
      const cfg = loadConfig();
      const defaultAgentId = resolveDefaultAgentId(cfg);
      const agentIds: string[] = [];

      // Collect IDs from agents.list and agents.named sections.
      if (Array.isArray(cfg?.agents?.list)) {
        for (const entry of cfg.agents.list) {
          if (entry?.id) {
            agentIds.push(normalizeAgentId(String(entry.id)));
          }
        }
      }
      const named = (cfg?.agents as Record<string, unknown>)?.named;
      if (named && typeof named === "object" && !Array.isArray(named)) {
        for (const key of Object.keys(named)) {
          const normalized = normalizeAgentId(key);
          if (!agentIds.includes(normalized)) {
            agentIds.push(normalized);
          }
        }
      }
      if (agentIds.length === 0) {
        agentIds.push(normalizeAgentId(defaultAgentId));
      }

      return agentIds.map((id) => {
        const agentCfg = resolveAgentConfig(cfg, id);
        return {
          id,
          // ResolvedAgentConfig uses "name" for display label.
          label: typeof agentCfg?.name === "string" ? agentCfg.name : undefined,
          metadata: agentCfg?.metadata,
          isDefault: id === normalizeAgentId(defaultAgentId),
        };
      });
    },

    async resolve(agentId: string) {
      const cfg = loadConfig();
      const normalized = normalizeAgentId(agentId);
      const agentCfg = resolveAgentConfig(cfg, normalized);
      if (!agentCfg && normalized !== normalizeAgentId(resolveDefaultAgentId(cfg))) {
        return null;
      }
      return {
        id: normalized,
        label: typeof agentCfg?.name === "string" ? agentCfg.name : undefined,
        metadata: agentCfg?.metadata,
        isDefault: normalized === normalizeAgentId(resolveDefaultAgentId(cfg)),
      };
    },
  };
}

function createRuntimeDiagnostics(): PluginRuntime["diagnostics"] {
  return {
    emit(event, opts) {
      emitDiagnosticEvent({
        type: "plugin.event",
        pluginId: opts?.pluginId,
        eventType: event.type,
        data: event.data,
      });
    },

    subscribe(typeFilter, handler) {
      return onDiagnosticEvent((evt) => {
        // Match "plugin.event" events by eventType, and native events by type.
        let matchType: string;
        let matchData: Record<string, unknown>;
        let matchPluginId: string | undefined;

        if (evt.type === "plugin.event") {
          matchType = evt.eventType;
          matchData = evt.data;
          matchPluginId = evt.pluginId;
        } else {
          // For native events, expose the whole event as data.
          matchType = evt.type;
          matchData = evt as unknown as Record<string, unknown>;
          matchPluginId = undefined;
        }

        if (typeFilter !== "*" && !matchType.startsWith(typeFilter)) {
          return;
        }

        handler({
          type: matchType,
          ts: evt.ts,
          seq: evt.seq,
          data: matchData,
          pluginId: matchPluginId,
        });
      });
    },
  };
}

function createRuntimeConfig(): PluginRuntime["config"] {
  return {
    loadConfig,
    writeConfigFile,
  };
}

function createRuntimeSystem(): PluginRuntime["system"] {
  return {
    enqueueSystemEvent,
    runCommandWithTimeout,
    formatNativeDependencyHint,
  };
}

function createRuntimeMedia(): PluginRuntime["media"] {
  return {
    loadWebMedia,
    detectMime,
    mediaKindFromMime,
    isVoiceCompatibleAudio,
    getImageMetadata,
    resizeToJpeg,
  };
}

function createRuntimeTools(): PluginRuntime["tools"] {
  return {
    createMemoryGetTool,
    createMemorySearchTool,
    registerMemoryCli,
  };
}

function createRuntimeChannel(): PluginRuntime["channel"] {
  return {
    text: {
      chunkByNewline,
      chunkMarkdownText,
      chunkMarkdownTextWithMode,
      chunkText,
      chunkTextWithMode,
      resolveChunkMode,
      resolveTextChunkLimit,
      hasControlCommand,
      resolveMarkdownTableMode,
      convertMarkdownTables,
    },
    reply: {
      dispatchReplyWithBufferedBlockDispatcher,
      createReplyDispatcherWithTyping,
      resolveEffectiveMessagesConfig,
      resolveHumanDelayConfig,
      dispatchReplyFromConfig,
      finalizeInboundContext,
      formatAgentEnvelope,
      /** @deprecated Prefer `BodyForAgent` + structured user-context blocks (do not build plaintext envelopes for prompts). */
      formatInboundEnvelope,
      resolveEnvelopeFormatOptions,
    },
    routing: {
      resolveAgentRoute,
    },
    pairing: {
      buildPairingReply,
      readAllowFromStore: readChannelAllowFromStore,
      upsertPairingRequest: upsertChannelPairingRequest,
    },
    media: {
      fetchRemoteMedia,
      saveMediaBuffer,
    },
    activity: {
      record: recordChannelActivity,
      get: getChannelActivity,
    },
    session: {
      resolveStorePath,
      readSessionUpdatedAt,
      recordSessionMetaFromInbound,
      recordInboundSession,
      updateLastRoute,
    },
    mentions: {
      buildMentionRegexes,
      matchesMentionPatterns,
      matchesMentionWithExplicit,
    },
    reactions: {
      shouldAckReaction,
      removeAckReactionAfterReply,
    },
    groups: {
      resolveGroupPolicy: resolveChannelGroupPolicy,
      resolveRequireMention: resolveChannelGroupRequireMention,
    },
    debounce: {
      createInboundDebouncer,
      resolveInboundDebounceMs,
    },
    commands: {
      resolveCommandAuthorizedFromAuthorizers,
      isControlCommandMessage,
      shouldComputeCommandAuthorized,
      shouldHandleTextCommands,
    },
    discord: {
      messageActions: discordMessageActions,
      auditChannelPermissions: auditDiscordChannelPermissions,
      listDirectoryGroupsLive: listDiscordDirectoryGroupsLive,
      listDirectoryPeersLive: listDiscordDirectoryPeersLive,
      probeDiscord,
      resolveChannelAllowlist: resolveDiscordChannelAllowlist,
      resolveUserAllowlist: resolveDiscordUserAllowlist,
      sendMessageDiscord,
      sendPollDiscord,
      monitorDiscordProvider,
    },
    slack: {
      listDirectoryGroupsLive: listSlackDirectoryGroupsLive,
      listDirectoryPeersLive: listSlackDirectoryPeersLive,
      probeSlack,
      resolveChannelAllowlist: resolveSlackChannelAllowlist,
      resolveUserAllowlist: resolveSlackUserAllowlist,
      sendMessageSlack,
      monitorSlackProvider,
      handleSlackAction,
    },
    telegram: {
      auditGroupMembership: auditTelegramGroupMembership,
      collectUnmentionedGroupIds: collectTelegramUnmentionedGroupIds,
      probeTelegram,
      resolveTelegramToken,
      sendMessageTelegram,
      sendPollTelegram,
      monitorTelegramProvider,
      messageActions: telegramMessageActions,
    },
    signal: {
      probeSignal,
      sendMessageSignal,
      monitorSignalProvider,
      messageActions: signalMessageActions,
    },
    imessage: {
      monitorIMessageProvider,
      probeIMessage,
      sendMessageIMessage,
    },
    whatsapp: {
      getActiveWebListener,
      getWebAuthAgeMs,
      logoutWeb,
      logWebSelfId,
      readWebSelfId,
      webAuthExists,
      sendMessageWhatsApp: sendMessageWhatsAppLazy,
      sendPollWhatsApp: sendPollWhatsAppLazy,
      loginWeb: loginWebLazy,
      startWebLoginWithQr: startWebLoginWithQrLazy,
      waitForWebLogin: waitForWebLoginLazy,
      monitorWebChannel: monitorWebChannelLazy,
      handleWhatsAppAction: handleWhatsAppActionLazy,
      createLoginTool: createWhatsAppLoginTool,
    },
    line: {
      listLineAccountIds,
      resolveDefaultLineAccountId,
      resolveLineAccount,
      normalizeAccountId: normalizeLineAccountId,
      probeLineBot,
      sendMessageLine,
      pushMessageLine,
      pushMessagesLine,
      pushFlexMessage,
      pushTemplateMessage,
      pushLocationMessage,
      pushTextMessageWithQuickReplies,
      createQuickReplyItems,
      buildTemplateMessageFromPayload,
      monitorLineProvider,
    },
  };
}

function createRuntimeLogging(): PluginRuntime["logging"] {
  return {
    shouldLogVerbose,
    getChildLogger: (bindings, opts) => {
      const logger = getChildLogger(bindings, {
        level: opts?.level ? normalizeLogLevel(opts.level) : undefined,
      });
      return {
        debug: (message) => logger.debug?.(message),
        info: (message) => logger.info(message),
        warn: (message) => logger.warn(message),
        error: (message) => logger.error(message),
      };
    },
  };
}

function createRuntimeSessions(): PluginRuntime["sessions"] {
  return {
    async list(opts) {
      const { discoverAllSessions } = await import("../../infra/session-cost-usage.js");
      const discovered = await discoverAllSessions({
        agentId: opts?.agentId,
        startMs: opts?.startMs,
        endMs: opts?.endMs,
      });
      return discovered.map(
        (s): PluginSessionEntry => ({
          sessionId: s.sessionId,
          agentId: opts?.agentId,
          filePath: s.sessionFile,
          firstUserMessage: s.firstUserMessage,
          mtimeMs: s.mtime,
        }),
      );
    },

    async readTranscript(opts) {
      const { resolveSessionFilePath } = await import("../../config/sessions/paths.js");
      const filePath = resolveSessionFilePath(opts.sessionId, undefined, { agentId: opts.agentId });
      if (!filePath) {
        return [];
      }
      const nodeFs = await import("node:fs/promises");
      let raw: string;
      try {
        raw = await nodeFs.readFile(filePath, "utf-8");
      } catch {
        return [];
      }
      const records: Record<string, unknown>[] = [];
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (parsed && typeof parsed === "object") {
            records.push(parsed as Record<string, unknown>);
          }
        } catch {
          // Skip malformed lines
        }
      }
      return records;
    },

    async getUsageSummary(opts) {
      const { loadSessionCostSummary } = await import("../../infra/session-cost-usage.js");
      const summary = await loadSessionCostSummary({
        sessionId: opts.sessionId,
        agentId: opts.agentId,
        startMs: opts.startMs,
        endMs: opts.endMs,
      });
      if (!summary) {
        return null;
      }
      return {
        totalTokens: summary.totalTokens,
        totalCostUsd: summary.totalCost,
        inputTokens: summary.input,
        outputTokens: summary.output,
        cacheReadTokens: summary.cacheRead,
        cacheWriteTokens: summary.cacheWrite,
        firstActivityMs: summary.firstActivity,
        lastActivityMs: summary.lastActivity,
        turnCount: summary.messageCounts?.assistant,
        toolCallCount: summary.messageCounts?.toolCalls,
      } satisfies PluginSessionUsageSummary;
    },
  };
}

export type { PluginRuntime } from "./types.js";
