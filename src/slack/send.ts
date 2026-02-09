import { ErrorCode, type FilesUploadV2Arguments, type WebClient } from "@slack/web-api";
import type { OpenClawConfig } from "../config/config.js";
import type { SlackTokenSource } from "./accounts.js";
import type { SlackBlock } from "./blocks/types.js";
import {
  chunkMarkdownTextWithMode,
  resolveChunkMode,
  resolveTextChunkLimit,
} from "../auto-reply/chunk.js";
import { loadConfig } from "../config/config.js";
import { resolveMarkdownTableMode } from "../config/markdown-tables.js";
import { logVerbose } from "../globals.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { loadWebMedia } from "../web/media.js";
import { resolveSlackAccount } from "./accounts.js";
import { createSlackWebClient } from "./client.js";
import { markdownToSlackMrkdwnChunks } from "./format.js";
import { parseSlackTarget } from "./targets.js";
import { resolveSlackBotToken } from "./token.js";

const SLACK_TEXT_LIMIT = 4000;
const SLACK_RATE_LIMIT_RETRY_LIMIT = 3;
const SLACK_RATE_LIMIT_BASE_DELAY_MS = 1000;
const SLACK_RATE_LIMIT_MAX_DELAY_MS = 30000;
const log = createSubsystemLogger("slack/send");

function isReasoningLikeText(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed) {
    return false;
  }
  // Our internal reasoning formatting uses "Reasoning:" prefix and italicized lines.
  if (trimmed.startsWith("Reasoning:")) {
    return true;
  }
  // Tagged providers (defense-in-depth; should have been stripped upstream for channels).
  if (/<\s*(?:think(?:ing)?|thought|antthinking)\s*>/i.test(trimmed)) {
    return true;
  }
  return false;
}

function textPreview(text: string, max = 120): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) {
    return compact;
  }
  return `${compact.slice(0, max)}...`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRetryAfterSeconds(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  if ("retryAfter" in error && typeof error.retryAfter === "number") {
    return error.retryAfter;
  }
  const headers = (error as { headers?: Record<string, string> }).headers;
  const retryAfterHeader = headers?.["retry-after"];
  if (!retryAfterHeader) {
    return undefined;
  }
  const parsed = Number.parseInt(retryAfterHeader, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  if ("code" in error && error.code === ErrorCode.RateLimitedError) {
    return true;
  }
  const platformError = (error as { data?: { error?: string } }).data?.error;
  if (platformError === "ratelimited") {
    return true;
  }
  const statusCode = (error as { statusCode?: number }).statusCode;
  return statusCode === 429;
}

function resolveRateLimitDelayMs(error: unknown, attempt: number): number {
  const retryAfterSeconds = extractRetryAfterSeconds(error);
  if (typeof retryAfterSeconds === "number") {
    return Math.min(SLACK_RATE_LIMIT_MAX_DELAY_MS, Math.max(0, retryAfterSeconds * 1000));
  }
  const backoff = SLACK_RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt;
  return Math.min(SLACK_RATE_LIMIT_MAX_DELAY_MS, backoff);
}

async function withSlackRateLimitRetry<T>(params: {
  cfg: OpenClawConfig;
  action: string;
  run: () => Promise<T>;
  maxRetries?: number;
}): Promise<T> {
  const maxRetries = params.maxRetries ?? SLACK_RATE_LIMIT_RETRY_LIMIT;
  let attempt = 0;
  while (true) {
    try {
      return await params.run();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }
      const delayMs = resolveRateLimitDelayMs(error, attempt);
      logDebug("slack rate limit retry", params.cfg, {
        action: params.action,
        attempt: attempt + 1,
        delayMs,
        retryAfterSeconds: extractRetryAfterSeconds(error),
      });
      if (delayMs > 0) {
        await sleep(delayMs);
      }
      attempt += 1;
    }
  }
}

type SlackRecipient =
  | {
      kind: "user";
      id: string;
    }
  | {
      kind: "channel";
      id: string;
    };

type SlackSendOpts = {
  token?: string;
  accountId?: string;
  mediaUrl?: string;
  client?: WebClient;
  threadTs?: string;
  config?: OpenClawConfig;
  blocks?: SlackBlock[];
};

export type SlackSendResult = {
  messageId: string;
  channelId: string;
};

function resolveToken(params: {
  explicit?: string;
  accountId: string;
  fallbackToken?: string;
  fallbackSource?: SlackTokenSource;
}) {
  const explicit = resolveSlackBotToken(params.explicit);
  if (explicit) {
    return explicit;
  }
  const fallback = resolveSlackBotToken(params.fallbackToken);
  if (!fallback) {
    logVerbose(
      `slack send: missing bot token for account=${params.accountId} explicit=${Boolean(
        params.explicit,
      )} source=${params.fallbackSource ?? "unknown"}`,
    );
    throw new Error(
      `Slack bot token missing for account "${params.accountId}" (set channels.slack.accounts.${params.accountId}.botToken or SLACK_BOT_TOKEN for default).`,
    );
  }
  return fallback;
}

function parseRecipient(raw: string): SlackRecipient {
  const target = parseSlackTarget(raw);
  if (!target) {
    throw new Error("Recipient is required for Slack sends");
  }
  return { kind: target.kind, id: target.id };
}

async function resolveChannelId(
  client: WebClient,
  recipient: SlackRecipient,
  cfg: OpenClawConfig,
): Promise<{ channelId: string; isDm?: boolean }> {
  if (recipient.kind === "channel") {
    return { channelId: recipient.id };
  }
  const response = await withSlackRateLimitRetry({
    cfg,
    action: "conversations.open",
    run: () => client.conversations.open({ users: recipient.id }),
  });
  const channelId = response.channel?.id;
  if (!channelId) {
    throw new Error("Failed to open Slack DM channel");
  }
  return { channelId, isDm: true };
}

function logTrace(msg: string, _config: OpenClawConfig, obj: Record<string, unknown>) {
  log.trace(msg, { ...obj, channel: "slack" });
}

function logDebug(msg: string, _config: OpenClawConfig, obj: Record<string, unknown>) {
  log.debug(msg, { ...obj, channel: "slack" });
}

async function uploadSlackFile(params: {
  client: WebClient;
  channelId: string;
  mediaUrl: string;
  caption?: string;
  threadTs?: string;
  maxBytes?: number;
  cfg: OpenClawConfig;
}): Promise<string> {
  const {
    buffer,
    contentType: _contentType,
    fileName,
  } = await loadWebMedia(params.mediaUrl, params.maxBytes);
  const basePayload = {
    channel_id: params.channelId,
    file: buffer,
    filename: fileName,
    ...(params.caption ? { initial_comment: params.caption } : {}),
    // Note: filetype is deprecated in files.uploadV2, Slack auto-detects from file content
  };
  const payload: FilesUploadV2Arguments = params.threadTs
    ? { ...basePayload, thread_ts: params.threadTs }
    : basePayload;
  const response = await withSlackRateLimitRetry({
    cfg: params.cfg,
    action: "files.uploadV2",
    run: () => params.client.files.uploadV2(payload),
  });
  const parsed = response as {
    files?: Array<{ id?: string; name?: string }>;
    file?: { id?: string; name?: string };
  };
  const fileId =
    parsed.files?.[0]?.id ??
    parsed.file?.id ??
    parsed.files?.[0]?.name ??
    parsed.file?.name ??
    "unknown";
  return fileId;
}

export async function sendMessageSlack(
  to: string,
  message: string,
  opts: SlackSendOpts = {},
): Promise<SlackSendResult> {
  const trimmedMessage = message?.trim() ?? "";
  if (!trimmedMessage && !opts.mediaUrl) {
    throw new Error("Slack send requires text or media");
  }
  const cfg = opts.config ?? loadConfig();
  const account = resolveSlackAccount({
    cfg,
    accountId: opts.accountId,
  });
  const token = resolveToken({
    explicit: opts.token,
    accountId: account.accountId,
    fallbackToken: account.botToken,
    fallbackSource: account.botTokenSource,
  });
  const client = opts.client ?? createSlackWebClient(token);
  const recipient = parseRecipient(to);
  let channelId: string;
  try {
    const result = await resolveChannelId(client, recipient, cfg);
    channelId = result.channelId;
  } catch (error) {
    log.error("Slack channel resolution failed", {
      to,
      recipientKind: recipient.kind,
      recipientId: recipient.id,
      accountId: account.accountId,
      error: error instanceof Error ? error.message : String(error),
      errorData: error && typeof error === "object" ? JSON.stringify(error, null, 2) : undefined,
    });
    throw error;
  }
  const textLimit = resolveTextChunkLimit(cfg, "slack", account.accountId);
  const chunkLimit = Math.min(textLimit, SLACK_TEXT_LIMIT);
  const tableMode = resolveMarkdownTableMode({
    cfg,
    channel: "slack",
    accountId: account.accountId,
  });
  const chunkMode = resolveChunkMode(cfg, "slack", account.accountId);
  const markdownChunks =
    chunkMode === "newline"
      ? chunkMarkdownTextWithMode(trimmedMessage, chunkLimit, chunkMode)
      : [trimmedMessage];
  const chunks = markdownChunks.flatMap((markdown) =>
    markdownToSlackMrkdwnChunks(markdown, chunkLimit, { tableMode }),
  );
  if (!chunks.length && trimmedMessage) {
    chunks.push(trimmedMessage);
  }

  logTrace("slack send prepared", cfg, {
    to,
    accountId: account.accountId,
    recipientKind: recipient.kind,
    channelId,
    threadTs: opts.threadTs ?? undefined,
    textLen: trimmedMessage.length,
    chunkMode,
    chunkLimit,
    chunkCount: chunks.length,
    hasMedia: Boolean(opts.mediaUrl),
    hasBlocks: Boolean(opts.blocks),
    reasoningLike: isReasoningLikeText(trimmedMessage),
    preview: trimmedMessage ? textPreview(trimmedMessage) : undefined,
  });
  const mediaMaxBytes =
    typeof account.config.mediaMaxMb === "number"
      ? account.config.mediaMaxMb * 1024 * 1024
      : undefined;

  let lastMessageId = "";
  try {
    if (opts.mediaUrl) {
      const [firstChunk, ...rest] = chunks;
      logTrace("slack send media upload", cfg, {
        to,
        channelId,
        threadTs: opts.threadTs ?? undefined,
        captionLen: (firstChunk ?? "").length,
        mediaUrl: opts.mediaUrl,
      });
      lastMessageId = await uploadSlackFile({
        client,
        channelId,
        mediaUrl: opts.mediaUrl,
        caption: firstChunk,
        threadTs: opts.threadTs,
        maxBytes: mediaMaxBytes,
        cfg,
      });
      for (const chunk of rest) {
        logTrace("slack chunk send", cfg, {
          to,
          channelId,
          threadTs: opts.threadTs ?? undefined,
          chunkLen: chunk.length,
          reasoningLike: isReasoningLikeText(chunk),
        });
        const response = await withSlackRateLimitRetry({
          cfg,
          action: "chat.postMessage",
          run: () =>
            client.chat.postMessage({
              channel: channelId,
              text: chunk,
              thread_ts: opts.threadTs,
              ...(opts.blocks ? { blocks: opts.blocks } : {}),
            }),
        });
        lastMessageId = response.ts ?? lastMessageId;
      }
    } else if (opts.blocks) {
      // When blocks are provided, send them with text as fallback
      const text = chunks[0] || trimmedMessage || "Message";
      logTrace("slack send blocks", cfg, {
        to,
        channelId,
        threadTs: opts.threadTs ?? undefined,
        textLen: text.length,
        reasoningLike: isReasoningLikeText(text),
        preview: textPreview(text),
      });
      const response = await withSlackRateLimitRetry({
        cfg,
        action: "chat.postMessage",
        run: () =>
          client.chat.postMessage({
            channel: channelId,
            text,
            blocks: opts.blocks,
            thread_ts: opts.threadTs,
          }),
      });
      lastMessageId = response.ts ?? "unknown";
    } else {
      for (const chunk of chunks.length ? chunks : [""]) {
        logTrace("slack send chunk", cfg, {
          to,
          channelId,
          threadTs: opts.threadTs ?? undefined,
          chunkLen: chunk.length,
          reasoningLike: isReasoningLikeText(chunk),
        });
        const response = await withSlackRateLimitRetry({
          cfg,
          action: "chat.postMessage",
          run: () =>
            client.chat.postMessage({
              channel: channelId,
              text: chunk,
              thread_ts: opts.threadTs,
            }),
        });
        lastMessageId = response.ts ?? lastMessageId;
      }
    }
  } catch (error) {
    log.error("Slack message send failed", {
      to,
      channelId,
      recipientKind: recipient.kind,
      recipientId: recipient.id,
      accountId: account.accountId,
      threadTs: opts.threadTs,
      hasMedia: Boolean(opts.mediaUrl),
      hasBlocks: Boolean(opts.blocks),
      chunkCount: chunks.length,
      error: error instanceof Error ? error.message : String(error),
      errorCode: error && typeof error === "object" && "code" in error ? error.code : undefined,
      errorData: error && typeof error === "object" ? JSON.stringify(error, null, 2) : undefined,
    });
    throw error;
  }

  return {
    messageId: lastMessageId || "unknown",
    channelId,
  };
}
