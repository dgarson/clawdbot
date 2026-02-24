import type { ChannelPlugin } from "../../channels/plugins/types.js";
import type { OpenClawConfig } from "../../config/config.js";
import { listChannelPlugins } from "../../channels/plugins/index.js";
import {
  listDeliverableMessageChannels,
  type DeliverableMessageChannel,
  normalizeMessageChannel,
} from "../../utils/message-channel.js";

export type MessageChannelId = DeliverableMessageChannel;

const getMessageChannels = () => listDeliverableMessageChannels();

function isKnownChannel(value: string): boolean {
  return getMessageChannels().includes(value as MessageChannelId);
}

function formatChannelSelectionHint(): string {
  const known = getMessageChannels();
  const sample = known.slice(0, 6);
  return sample.length > 0 ? ` Use provider ids like: ${sample.join(", ")}.` : "";
}

function looksLikeDestinationHint(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return (
    /^[@#]/.test(trimmed) ||
    /^(channel|group|user|conversation|chat|thread):/i.test(trimmed) ||
    /^\+?\d{6,}$/.test(trimmed) ||
    trimmed.includes("@thread") ||
    trimmed.includes("-")
  );
}

function unknownChannelMessage(params: { input?: string | null; normalized: string }): string {
  const input = params.input?.trim() || params.normalized;
  const base = `Unknown channel provider: "${input}".`;
  const targetHint = looksLikeDestinationHint(input)
    ? " This looks like a destination name/ID. Put it in `target` (or `to`/`channelId` for legacy paths), and set `channel` to the provider id."
    : "";
  return `${base}${targetHint}${formatChannelSelectionHint()}`;
}

function isAccountEnabled(account: unknown): boolean {
  if (!account || typeof account !== "object") {
    return true;
  }
  const enabled = (account as { enabled?: boolean }).enabled;
  return enabled !== false;
}

async function isPluginConfigured(plugin: ChannelPlugin, cfg: OpenClawConfig): Promise<boolean> {
  const accountIds = plugin.config.listAccountIds(cfg);
  if (accountIds.length === 0) {
    return false;
  }

  for (const accountId of accountIds) {
    const account = plugin.config.resolveAccount(cfg, accountId);
    const enabled = plugin.config.isEnabled
      ? plugin.config.isEnabled(account, cfg)
      : isAccountEnabled(account);
    if (!enabled) {
      continue;
    }
    if (!plugin.config.isConfigured) {
      return true;
    }
    const configured = await plugin.config.isConfigured(account, cfg);
    if (configured) {
      return true;
    }
  }

  return false;
}

export async function listConfiguredMessageChannels(
  cfg: OpenClawConfig,
): Promise<MessageChannelId[]> {
  const channels: MessageChannelId[] = [];
  for (const plugin of listChannelPlugins()) {
    if (!isKnownChannel(plugin.id)) {
      continue;
    }
    if (await isPluginConfigured(plugin, cfg)) {
      channels.push(plugin.id);
    }
  }
  return channels;
}

export async function resolveMessageChannelSelection(params: {
  cfg: OpenClawConfig;
  channel?: string | null;
}): Promise<{ channel: MessageChannelId; configured: MessageChannelId[] }> {
  const channelInput = params.channel?.trim() ?? null;
  const normalized = normalizeMessageChannel(channelInput);
  if (normalized) {
    if (!isKnownChannel(normalized)) {
      throw new Error(
        unknownChannelMessage({ input: channelInput, normalized: String(normalized) }),
      );
    }
    return {
      channel: normalized as MessageChannelId,
      configured: await listConfiguredMessageChannels(params.cfg),
    };
  }

  const configured = await listConfiguredMessageChannels(params.cfg);
  if (configured.length === 1) {
    return { channel: configured[0], configured };
  }
  if (configured.length === 0) {
    throw new Error("Channel is required (no configured channels detected).");
  }
  throw new Error(
    `Channel is required when multiple channels are configured: ${configured.join(", ")}`,
  );
}
