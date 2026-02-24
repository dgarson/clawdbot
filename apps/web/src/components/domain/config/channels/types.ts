/**
 * Channel configuration types for messaging platform integrations.
 */

export type ChannelStatus = "connected" | "not_configured" | "error" | "connecting" | "unsupported";

export type ChannelId =
  | "telegram"
  | "whatsapp"
  | "discord"
  | "signal"
  | "slack"
  | "imessage"
  | "msteams"
  | "googlechat"
  | "line"
  | "matrix"
  | "bluebubbles"
  | "mattermost"
  | "notion"
  | "obsidian";

export type PlatformType = "macos" | "windows" | "linux" | "any";

export interface PlatformRequirements {
  /** Platforms where this channel is supported */
  supported: PlatformType[];
  /** Whether local app installation is required */
  requiresInstallation?: boolean;
  /** Whether the required installation is currently present */
  installed?: boolean;
  /** Name of the app/binary to install */
  installationApp?: string;
  /** URL to installation docs */
  installationUrl?: string;
  /** Whether a Mac server is required (even for non-Mac clients) */
  requiresMacServer?: boolean;
  /** External relay providers that can enable this on unsupported platforms */
  relayProviders?: RelayProvider[];
}

export interface RelayProvider {
  name: string;
  description: string;
  url: string;
  pricing?: string;
  features?: string[];
}

export interface ChannelConfig {
  id: ChannelId;
  name: string;
  description: string;
  status: ChannelStatus;
  statusMessage?: string;
  lastConnected?: string;
  activity?: ChannelActivityItem[];
  /** Legacy advanced flag */
  isAdvanced?: boolean;
  /** Legacy local only flag */
  localOnly?: boolean;
  /** Platform requirements and installation info */
  platform?: PlatformRequirements;
  /** Channel category for grouping */
  category?: "messaging" | "enterprise" | "decentralized" | "productivity";
}

export type ChannelActivityStatus = "active" | "idle" | "error";

export interface ChannelActivityItem {
  id: string;
  title: string;
  summary?: string;
  status: ChannelActivityStatus;
  agentId: string;
  agentName: string;
  sessionId?: string;
  timestamp: string;
}

// Channel-specific config types

export interface TelegramConfig {
  botToken: string;
  mode?: "polling" | "webhook";
  webhookUrl?: string;
  allowFrom?: string[];
  allowUnmentionedGroups?: boolean;
}

export interface DiscordConfig {
  botToken: string;
  applicationId?: string;
  allowFrom?: string[];
  dmPolicy?: "allow" | "mentions" | "disabled";
}

export interface SlackConfig {
  workspaceId?: string;
  workspaceName?: string;
  mode?: "oauth" | "token";
  botToken?: string;
  appToken?: string;
  signingSecret?: string;
  defaultChannel?: string;
  allowChannels?: string[];
}

export interface WhatsAppConfig {
  phoneNumber?: string;
  qrCode?: string;
  displayName?: string;
  reconnectPolicy?: "auto" | "manual";
}

export interface SignalConfig {
  phoneNumber?: string;
  baseUrl?: string;
  deviceName?: string;
}

export interface iMessageConfig {
  cliPath?: string;
  dbPath?: string;
}

export interface MicrosoftTeamsConfig {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  botId?: string;
}

export interface GoogleChatConfig {
  serviceAccountKey?: string;
  webhookUrl?: string;
  spaceId?: string;
  audienceType?: "space" | "member" | "domain";
  audience?: string;
}

export interface LineConfig {
  channelAccessToken?: string;
  channelSecret?: string;
}

export interface MatrixConfig {
  homeserverUrl?: string;
  accessToken?: string;
  userId?: string;
}

export interface BlueBubblesConfig {
  serverUrl?: string;
  password?: string;
}

export interface MattermostConfig {
  serverUrl?: string;
  botToken?: string;
  teamId?: string;
  defaultChannel?: string;
}

export interface NotionConfig {
  integrationToken?: string;
  workspaceId?: string;
  databaseIds?: string[];
}

export interface ObsidianConfig {
  vaultPath?: string;
  apiKey?: string;
  syncMode?: "read" | "read_write";
}

export type AnyChannelConfig =
  | TelegramConfig
  | DiscordConfig
  | SlackConfig
  | WhatsAppConfig
  | SignalConfig
  | iMessageConfig
  | MicrosoftTeamsConfig
  | GoogleChatConfig
  | LineConfig
  | MatrixConfig
  | BlueBubblesConfig
  | MattermostConfig
  | NotionConfig
  | ObsidianConfig;

// Relay provider definitions for Mac-only services
export const MAC_RELAY_PROVIDERS: RelayProvider[] = [
  {
    name: "BlueBubbles",
    description: "Open-source iMessage bridge requiring a Mac server",
    url: "https://bluebubbles.app/",
    pricing: "Free (requires your own Mac)",
    features: ["Full iMessage support", "Reactions/tapbacks", "Read receipts", "Group chats", "Self-hosted"],
  },
  {
    name: "AirMessage",
    description: "iMessage relay with simpler setup",
    url: "https://airmessage.org/",
    pricing: "Free (requires your own Mac)",
    features: ["iMessage on Android/Web", "Direct connection", "Easy setup"],
  },
  {
    name: "Beeper",
    description: "Commercial unified messaging with iMessage support",
    url: "https://beeper.com/",
    pricing: "Subscription-based",
    features: ["No Mac required (varies)", "Multiple chat networks", "Unified inbox"],
  },
];
