/**
 * API response and request types for the Clawdbrain Gateway.
 *
 * These types map to the gateway RPC protocol defined in the main clawdbrain repo.
 */

// Config types
export interface ConfigSnapshot {
  exists: boolean;
  valid: boolean;
  raw?: string;
  config?: ClawdbrainConfig;
  hash?: string;
  errors?: string[];
}

export interface ClawdbrainConfig {
  auth?: AuthConfig;
  gateway?: GatewayConfigData;
  channels?: ChannelsConfig;
  agents?: AgentsConfig;
  [key: string]: unknown;
}

export interface AuthConfig {
  anthropic?: { apiKey?: string };
  openai?: { apiKey?: string };
  google?: { apiKey?: string };
  xai?: { apiKey?: string };
  openrouter?: { apiKey?: string };
  [key: string]: { apiKey?: string } | undefined;
}

export interface GatewayConfigData {
  port?: number;
  bind?: string;
  mode?: "local" | "loopback" | "network";
  token?: string;
  [key: string]: unknown;
}

export interface ChannelsConfig {
  telegram?: TelegramChannelConfig;
  discord?: DiscordChannelConfig;
  whatsapp?: WhatsAppChannelConfig;
  slack?: SlackChannelConfig;
  signal?: SignalChannelConfig;
  imessage?: iMessageChannelConfig;
  [key: string]: unknown;
}

export interface TelegramChannelConfig {
  enabled?: boolean;
  botToken?: string;
  [key: string]: unknown;
}

export interface DiscordChannelConfig {
  enabled?: boolean;
  botToken?: string;
  [key: string]: unknown;
}

export interface WhatsAppChannelConfig {
  enabled?: boolean;
  [key: string]: unknown;
}

export interface SlackChannelConfig {
  enabled?: boolean;
  workspaceId?: string;
  [key: string]: unknown;
}

export interface SignalChannelConfig {
  enabled?: boolean;
  phoneNumber?: string;
  [key: string]: unknown;
}

export interface iMessageChannelConfig {
  enabled?: boolean;
  [key: string]: unknown;
}

export interface AgentsConfig {
  default?: string;
  [key: string]: AgentConfigEntry | string | undefined;
}

export interface AgentConfigEntry {
  name?: string;
  model?: string;
  systemPrompt?: string;
  [key: string]: unknown;
}

// Channel status types
export interface ChannelStatusResponse {
  ts: number;
  channelOrder: string[];
  channelLabels: Record<string, string>;
  channelDetailLabels?: Record<string, string>;
  channelSystemImages?: Record<string, string>;
  channelMeta: Record<string, ChannelMetaEntry>;
  channels: Record<string, ChannelSummary>;
  channelAccounts: Record<string, ChannelAccountSnapshot[]>;
  channelDefaultAccountId: Record<string, string>;
}

export interface ChannelMetaEntry {
  id: string;
  label: string;
  blurb?: string;
  docsUrl?: string;
  localOnly?: boolean;
  requiresNativeHost?: boolean;
  advanced?: boolean;
}

export interface ChannelSummary {
  configured: boolean;
  connected?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface ChannelAccountSnapshot {
  accountId: string;
  enabled?: boolean;
  configured?: boolean;
  connected?: boolean;
  error?: string;
  statusMessage?: string;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  lastProbeAt?: number;
  [key: string]: unknown;
}

// Models types
export interface ModelsListResponse {
  models: ModelEntry[];
}

export interface ModelEntry {
  id: string;
  provider: string;
  name: string;
  description?: string;
  contextWindow?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  recommended?: boolean;
  [key: string]: unknown;
}

// Agents types
export interface AgentsListResponse {
  agents: GatewayAgent[];
  defaultAgentId: string;
}

export interface GatewayAgent {
  id: string;
  name: string;
  model?: string;
  systemPrompt?: string;
  isDefault?: boolean;
  [key: string]: unknown;
}

// Health/Status types
export interface HealthResponse {
  ts: number;
  ok: boolean;
  version?: string;
  uptime?: number;
  channels?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StatusResponse {
  gateway: {
    running: boolean;
    port?: number;
    version?: string;
  };
  channels: Record<string, { configured: boolean; connected: boolean }>;
  auth: {
    configured: boolean;
    providers: string[];
  };
  [key: string]: unknown;
}

// Config mutation types
export interface ConfigPatchParams {
  baseHash: string;
  raw: string;
  sessionKey?: string;
  note?: string;
  restartDelayMs?: number;
}

export interface ConfigPatchResponse {
  ok: boolean;
  path: string;
  config: ClawdbrainConfig;
  restart?: {
    scheduled: boolean;
    delayMs?: number;
  };
  sentinel?: {
    path: string | null;
    payload: unknown;
  };
}

// Provider verification types
export type ModelProviderId = "anthropic" | "openai" | "google" | "zai" | "openrouter";

export interface ProviderVerifyRequest {
  provider: ModelProviderId;
  apiKey: string;
}

export interface ProviderVerifyResponse {
  ok: boolean;
  provider: ModelProviderId;
  error?: string;
  models?: string[];
}
