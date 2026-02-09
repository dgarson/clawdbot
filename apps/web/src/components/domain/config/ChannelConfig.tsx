"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, errorMessages } from "@/components/composed/ErrorState";
import { startWebLogin, waitWebLogin } from "@/lib/api";
import {
  ChannelCard,
  TelegramConfigSheet,
  DiscordConfigSheet,
  WhatsAppConfigSheet,
  SlackConfigSheet,
  SignalConfigSheet,
  IMessageConfigSheet,
  GenericChannelConfigDialog,
  type ChannelConfig as ChannelConfigType,
  type ChannelId,
  type TelegramConfig,
  type DiscordConfig,
  type SlackConfig,
  type WhatsAppConfig,
  type SignalConfig,
  type iMessageConfig,
  type PlatformType,
  MAC_RELAY_PROVIDERS,
} from "./channels";
import { useChannelsStatus } from "@/hooks/queries/useChannels";
import { channelKeys } from "@/hooks/queries/useChannels";
import { useConfig } from "@/hooks/queries/useConfig";
import { usePatchConfig, useLogoutChannel } from "@/hooks/mutations/useConfigMutations";
import type { ChannelAccountSnapshot } from "@/lib/api";

interface ChannelConfigProps {
  className?: string;
  /** Current platform the gateway is running on */
  currentPlatform?: PlatformType;
}

const defaultChannels: ChannelConfigType[] = [
  // Messaging category
  {
    id: "telegram",
    name: "Telegram",
    description: "Bot token authentication",
    status: "not_configured",
    category: "messaging",
    platform: { supported: ["any"] },
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "QR code pairing",
    status: "not_configured",
    category: "messaging",
    platform: { supported: ["any"] },
  },
  {
    id: "discord",
    name: "Discord",
    description: "Bot token authentication",
    status: "not_configured",
    category: "messaging",
    platform: { supported: ["any"] },
  },
  {
    id: "signal",
    name: "Signal",
    description: "Secure messaging",
    status: "not_configured",
    isAdvanced: true,
    category: "messaging",
    platform: {
      supported: ["any"],
      requiresInstallation: true,
      installed: false,
      installationApp: "signal-cli",
      installationUrl: "https://docs.openclaw.ai/channels/signal",
    },
  },
  {
    id: "imessage",
    name: "iMessage",
    description: "macOS native messaging",
    status: "not_configured",
    localOnly: true,
    category: "messaging",
    platform: {
      supported: ["macos"],
      requiresInstallation: true,
      installed: false,
      installationApp: "imsg",
      installationUrl: "https://github.com/steipete/imsg",
      relayProviders: MAC_RELAY_PROVIDERS,
    },
  },
  {
    id: "bluebubbles",
    name: "BlueBubbles",
    description: "Enhanced iMessage bridge",
    status: "not_configured",
    category: "messaging",
    platform: {
      supported: ["any"],
      requiresMacServer: true,
      requiresInstallation: true,
      installed: false,
      installationApp: "BlueBubbles Server",
      installationUrl: "https://bluebubbles.app/",
    },
  },
  {
    id: "line",
    name: "LINE",
    description: "Popular in Asia",
    status: "not_configured",
    category: "messaging",
    platform: { supported: ["any"] },
  },
  // Enterprise category
  {
    id: "slack",
    name: "Slack",
    description: "Workspace connection",
    status: "not_configured",
    category: "enterprise",
    platform: { supported: ["any"] },
  },
  {
    id: "msteams",
    name: "Microsoft Teams",
    description: "Enterprise messaging",
    status: "not_configured",
    category: "enterprise",
    platform: { supported: ["any"] },
  },
  {
    id: "googlechat",
    name: "Google Chat",
    description: "Google Workspace",
    status: "not_configured",
    category: "enterprise",
    platform: { supported: ["any"] },
  },
  {
    id: "mattermost",
    name: "Mattermost",
    description: "Self-hosted team chat",
    status: "not_configured",
    category: "enterprise",
    platform: { supported: ["any"] },
  },
  // Decentralized category
  {
    id: "matrix",
    name: "Matrix",
    description: "Decentralized protocol",
    status: "not_configured",
    category: "decentralized",
    platform: { supported: ["any"] },
  },
  // Productivity category
  {
    id: "notion",
    name: "Notion",
    description: "Workspace integration",
    status: "not_configured",
    category: "productivity",
    platform: { supported: ["any"] },
  },
  {
    id: "obsidian",
    name: "Obsidian",
    description: "Local knowledge base",
    status: "not_configured",
    category: "productivity",
    platform: {
      supported: ["any"],
      requiresInstallation: true,
      installed: false,
      installationApp: "Obsidian Local REST API",
      installationUrl: "https://github.com/coddingtonbear/obsidian-local-rest-api",
    },
  },
];

const defaultChannelMap = new Map<string, ChannelConfigType>(
  defaultChannels.map((channel) => [channel.id, channel]),
);

// Channel-specific field configs
const channelFieldConfigs: Record<string, {
  fields?: Array<{ name: string; label: string; placeholder: string; type?: "text" | "password" | "url"; helpText?: string; required?: boolean; multiline?: boolean; rows?: number }>;
  authModes?: Array<{ id: string; label: string; description: string; type: "oauth" | "api_key" | "token" | "service_account" | "webhook"; badge?: string; fields?: Array<{ name: string; label: string; placeholder: string; type?: "text" | "password" | "url"; helpText?: string; required?: boolean; multiline?: boolean; rows?: number }>; scopes?: string[]; ctaLabel?: string; ctaHint?: string }>;
  behaviorFields?: Array<{ name: string; label: string; placeholder: string; type?: "text" | "password" | "url"; helpText?: string; required?: boolean; multiline?: boolean; rows?: number }>;
  helpSteps: string[];
  docsUrl?: string;
}> = {
  msteams: {
    authModes: [
      {
        id: "msteams-credentials",
        label: "Azure Bot Credentials",
        description: "Use Azure AD app registration credentials.",
        type: "api_key",
        badge: "Recommended",
        fields: [
          { name: "tenantId", label: "Tenant ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", helpText: "Your Azure AD tenant ID" },
          { name: "clientId", label: "Client ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
          { name: "clientSecret", label: "Client Secret", placeholder: "Your client secret", type: "password" },
          { name: "botId", label: "Bot ID (optional)", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: false },
        ],
      },
    ],
    helpSteps: [
      "Go to Azure Portal and create a new App Registration",
      "Configure the Bot Channel Registration",
      "Add Microsoft Teams channel to your bot",
      "Copy the Tenant ID, Client ID, and create a Client Secret",
      "Paste the credentials above",
    ],
    docsUrl: "https://docs.microsoft.com/en-us/microsoftteams/platform/bots/how-to/create-a-bot-for-teams",
  },
  googlechat: {
    authModes: [
      {
        id: "googlechat-service-account",
        label: "Service Account",
        description: "Use a Google Cloud service account JSON key.",
        type: "service_account",
        badge: "Recommended",
        fields: [
          { name: "serviceAccountKey", label: "Service Account Key", placeholder: "Paste JSON key content", helpText: "Full JSON key from Google Cloud Console", multiline: true, rows: 4 },
        ],
      },
      {
        id: "googlechat-webhook",
        label: "Incoming Webhook",
        description: "Use a webhook URL for a single space.",
        type: "webhook",
        fields: [
          { name: "webhookUrl", label: "Webhook URL", placeholder: "https://chat.googleapis.com/v1/spaces/...", type: "url" },
          { name: "spaceId", label: "Space ID (optional)", placeholder: "spaces/AAA..." , required: false},
        ],
      },
    ],
    behaviorFields: [
      { name: "audienceType", label: "Audience Type", placeholder: "space | member | domain", helpText: "Scopes delivery for Chat events", required: false },
      { name: "audience", label: "Audience (optional)", placeholder: "users/123 or domains/example.com", required: false },
    ],
    helpSteps: [
      "Go to Google Cloud Console",
      "Create a new project or select existing",
      "Enable the Google Chat API",
      "Create a Service Account with Chat permissions",
      "Download the JSON key and paste it above",
    ],
    docsUrl: "https://developers.google.com/chat/api/guides/auth/service-accounts",
  },
  line: {
    fields: [
      { name: "channelAccessToken", label: "Channel Access Token", placeholder: "Your LINE channel access token", type: "password" },
      { name: "channelSecret", label: "Channel Secret", placeholder: "Your LINE channel secret", type: "password" },
    ],
    helpSteps: [
      "Go to LINE Developers Console",
      "Create a new Messaging API channel",
      "Navigate to the Messaging API tab",
      "Copy the Channel Access Token and Channel Secret",
      "Paste the credentials above",
    ],
    docsUrl: "https://developers.line.biz/en/docs/messaging-api/getting-started/",
  },
  matrix: {
    fields: [
      { name: "homeserverUrl", label: "Homeserver URL", placeholder: "https://matrix.org", type: "url" },
      { name: "accessToken", label: "Access Token", placeholder: "Your Matrix access token", type: "password" },
      { name: "userId", label: "User ID", placeholder: "@bot:matrix.org" },
    ],
    behaviorFields: [
      { name: "allowFrom", label: "Allowed rooms/users (optional)", placeholder: "!roomId:matrix.org\\n@user:matrix.org", multiline: true, rows: 3, required: false },
    ],
    helpSteps: [
      "Create a Matrix account on any homeserver (e.g., matrix.org)",
      "Log in using the Element web client or CLI",
      "Get your access token from Settings → Help & About → Advanced",
      "Paste the homeserver URL, token, and user ID above",
    ],
    docsUrl: "https://matrix.org/docs/guides/client-server-api/",
  },
  bluebubbles: {
    fields: [
      { name: "serverUrl", label: "Server URL", placeholder: "http://localhost:1234", type: "url", helpText: "URL of your BlueBubbles Mac server" },
      { name: "password", label: "Server Password", placeholder: "Your BlueBubbles password", type: "password" },
    ],
    behaviorFields: [
      { name: "autoReconnect", label: "Auto reconnect (optional)", placeholder: "true/false", required: false },
    ],
    helpSteps: [
      "Install BlueBubbles Server on a Mac with iMessage configured",
      "Set up the server and note the URL (use Ngrok for remote access)",
      "Copy the server password from BlueBubbles settings",
      "Enter the URL and password above",
    ],
    docsUrl: "https://bluebubbles.app/install/",
  },
  mattermost: {
    fields: [
      { name: "serverUrl", label: "Server URL", placeholder: "https://your-mattermost.example.com", type: "url" },
      { name: "botToken", label: "Bot Token", placeholder: "Your Mattermost bot token", type: "password" },
    ],
    behaviorFields: [
      { name: "teamId", label: "Default Team ID (optional)", placeholder: "team-id", required: false },
      { name: "defaultChannel", label: "Default Channel (optional)", placeholder: "town-square", required: false },
    ],
    helpSteps: [
      "Log in to your Mattermost server as an admin",
      "Go to Integrations → Bot Accounts → Add Bot Account",
      "Create a bot and copy the access token",
      "Enter the server URL and token above",
    ],
    docsUrl: "https://docs.mattermost.com/integrations/cloud-bot-accounts.html",
  },
  notion: {
    authModes: [
      {
        id: "notion-oauth",
        label: "Notion OAuth",
        description: "Authorize with Notion and choose pages/databases.",
        type: "oauth",
        badge: "Recommended",
        ctaLabel: "Continue with Notion",
      },
      {
        id: "notion-token",
        label: "Integration Token",
        description: "Use an internal integration token.",
        type: "api_key",
        fields: [
          { name: "integrationToken", label: "Integration Token", placeholder: "secret_xxxxx", type: "password", helpText: "Internal integration token from Notion" },
          { name: "workspaceId", label: "Workspace ID (optional)", placeholder: "workspace-id", required: false },
        ],
      },
    ],
    behaviorFields: [
      { name: "databaseIds", label: "Database IDs (optional)", placeholder: "database-id-1\\ndatabase-id-2", multiline: true, rows: 3, required: false },
    ],
    helpSteps: [
      "Go to Notion Integrations page (notion.so/my-integrations)",
      "Create a new integration",
      "Copy the Internal Integration Token",
      "Share the pages/databases you want to access with your integration",
      "Paste the token above",
    ],
    docsUrl: "https://developers.notion.com/docs/getting-started",
  },
  obsidian: {
    authModes: [
      {
        id: "obsidian-rest",
        label: "Local REST API",
        description: "Connect via the Obsidian Local REST API plugin.",
        type: "api_key",
        fields: [
          { name: "vaultPath", label: "Vault Path", placeholder: "/path/to/your/vault" },
          { name: "apiKey", label: "API Key", placeholder: "Your API key", type: "password" },
        ],
      },
      {
        id: "obsidian-filesystem",
        label: "Filesystem only",
        description: "Read files directly without the REST API.",
        type: "token",
        fields: [
          { name: "vaultPath", label: "Vault Path", placeholder: "/path/to/your/vault" },
        ],
      },
    ],
    behaviorFields: [
      { name: "syncMode", label: "Sync Mode", placeholder: "read | read_write", required: false },
    ],
    helpSteps: [
      "Install the Obsidian Local REST API plugin",
      "Enable the plugin in Obsidian settings",
      "Copy the API key from the plugin settings",
      "Enter your vault path and API key above",
    ],
    docsUrl: "https://github.com/coddingtonbear/obsidian-local-rest-api",
  },
};

export function ChannelConfig({ className, currentPlatform = "macos" }: ChannelConfigProps) {
  const [activeSheet, setActiveSheet] = React.useState<ChannelId | null>(null);
  const [gettingStartedOpen, setGettingStartedOpen] = React.useState(true);
  const [installOverrides, setInstallOverrides] = React.useState<Record<ChannelId, boolean>>({} as Record<ChannelId, boolean>);
  const [whatsappQrCode, setWhatsappQrCode] = React.useState<string | undefined>();
  const [isWhatsAppBusy, setIsWhatsAppBusy] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const queryClient = useQueryClient();
  const {
    data: channelsData,
    isLoading: isChannelsLoading,
    error: channelsError,
    refetch: refetchChannels,
    isFetching: isChannelsFetching,
  } = useChannelsStatus({ probe: false });
  const { data: configSnapshot } = useConfig();
  const patchConfig = usePatchConfig();
  const logoutChannel = useLogoutChannel();

  const refreshChannels = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: channelKeys.all });
  }, [queryClient]);

  const handleRetry = React.useCallback(async () => {
    setIsRetrying(true);
    try {
      await refetchChannels();
      toast.success("Channel status loaded successfully");
    } catch {
      // Error will be shown by ErrorState
    } finally {
      setIsRetrying(false);
    }
  }, [refetchChannels]);

  /**
   * Map API channel status to UI channel status
   */
  const mapChannelStatus = (snapshot: ChannelAccountSnapshot | undefined): ChannelConfigType["status"] => {
    if (!snapshot) {return "not_configured";}
    if (snapshot.error) {return "error";}
    if (snapshot.connected) {return "connected";}
    if (snapshot.configured) {return "not_configured";}
    return "not_configured";
  };

  const channels = React.useMemo(() => {
    if (!channelsData) {
      return defaultChannels.map((channel) => ({
        ...channel,
        platform: channel.platform
          ? { ...channel.platform, installed: installOverrides[channel.id] ?? channel.platform.installed }
          : channel.platform,
      }));
    }

    const accounts = channelsData.channelAccounts ?? {};
    const meta = channelsData.channelMeta ?? {};
    const labels = channelsData.channelLabels ?? {};
    const defaultAccountIds = channelsData.channelDefaultAccountId ?? {};

    const orderedChannelIds = (() => {
      const order = channelsData.channelOrder?.length
        ? channelsData.channelOrder
        : defaultChannels.map((channel) => channel.id);
      const combined = [...order, ...defaultChannels.map((channel) => channel.id)];
      const seen = new Set<string>();
      return combined.filter((channelId) => {
        if (seen.has(channelId)) {return false;}
        seen.add(channelId);
        return true;
      });
    })();

    return orderedChannelIds.map((channelId) => {
      const baseChannel = defaultChannelMap.get(channelId);
      const channelMeta = meta[channelId];
      const channelAccounts = accounts[channelId] ?? [];
      const defaultAccountId = defaultAccountIds[channelId];
      const defaultAccount = channelAccounts.find((a) => a.accountId === defaultAccountId) ?? channelAccounts[0];
      const localOnly = channelMeta?.localOnly ?? channelMeta?.requiresNativeHost ?? baseChannel?.localOnly;

      const fallbackChannel: ChannelConfigType = baseChannel ?? {
        id: channelId,
        name: labels[channelId] ?? channelMeta?.label ?? channelId,
        description: channelMeta?.blurb ?? "",
        status: "not_configured",
        category: "messaging",
      };

      return {
        ...fallbackChannel,
        name: labels[channelId] ?? channelMeta?.label ?? fallbackChannel.name,
        description: channelMeta?.blurb ?? fallbackChannel.description,
        status: mapChannelStatus(defaultAccount),
        statusMessage: defaultAccount?.statusMessage ?? defaultAccount?.error,
        lastConnected: defaultAccount?.lastInboundAt
          ? new Date(defaultAccount.lastInboundAt).toLocaleString()
          : undefined,
        isAdvanced: channelMeta?.advanced ?? fallbackChannel.isAdvanced,
        localOnly,
        platform: fallbackChannel.platform
          ? { ...fallbackChannel.platform, installed: installOverrides[channelId] ?? fallbackChannel.platform.installed }
          : fallbackChannel.platform,
      };
    });
  }, [channelsData, installOverrides]);

  const getChannelStatus = (channelId: ChannelId) => {
    return channels.find((ch) => ch.id === channelId)?.status;
  };

  const getChannel = (channelId: ChannelId) => {
    return channels.find((ch) => ch.id === channelId);
  };

  // Check if a channel is supported on current platform
  const isChannelSupported = (channel: ChannelConfigType) => {
    if (!channel.platform) {return true;}
    return channel.platform.supported.includes("any") || channel.platform.supported.includes(currentPlatform);
  };

  const telegramConfig = React.useMemo((): TelegramConfig | undefined => {
    const cfg = configSnapshot?.config?.channels?.telegram;
    if (cfg?.botToken) {
      return {
        botToken: cfg.botToken as string,
        mode: cfg.mode as "polling" | "webhook" | undefined,
        webhookUrl: cfg.webhookUrl as string | undefined,
        allowFrom: cfg.allowFrom as string[] | undefined,
        allowUnmentionedGroups: cfg.allowUnmentionedGroups as boolean | undefined,
      };
    }
    return undefined;
  }, [configSnapshot]);

  const discordConfig = React.useMemo((): DiscordConfig | undefined => {
    const cfg = configSnapshot?.config?.channels?.discord;
    if (cfg?.botToken) {
      return {
        botToken: cfg.botToken as string,
        applicationId: cfg.applicationId as string | undefined,
        allowFrom: cfg.allowFrom as string[] | undefined,
        dmPolicy: cfg.dmPolicy as "disabled" | "allow" | "mentions" | undefined,
      };
    }
    return undefined;
  }, [configSnapshot]);

  const slackConfig = React.useMemo((): SlackConfig | undefined => {
    const cfg = configSnapshot?.config?.channels?.slack;
    if (cfg?.workspaceId) {
      return {
        workspaceId: cfg.workspaceId as string,
        workspaceName: cfg.workspaceName as string | undefined,
        mode: cfg.mode as "token" | "oauth" | undefined,
        defaultChannel: cfg.defaultChannel as string | undefined,
        allowChannels: cfg.allowChannels as string[] | undefined,
      };
    }
    if (cfg?.botToken) {
      return {
        mode: "token" as const,
        botToken: cfg.botToken as string,
        appToken: cfg.appToken as string | undefined,
        signingSecret: cfg.signingSecret as string | undefined,
        defaultChannel: cfg.defaultChannel as string | undefined,
        allowChannels: cfg.allowChannels as string[] | undefined,
      };
    }
    return undefined;
  }, [configSnapshot]);

  const whatsappConfig = React.useMemo((): WhatsAppConfig | undefined => {
    const accounts = channelsData?.channelAccounts?.whatsapp;
    const defaultAccount = accounts?.[0];
    const displayLabel = channelsData?.channelDetailLabels?.whatsapp;
    if (defaultAccount?.configured || whatsappQrCode) {
      return {
        phoneNumber: displayLabel,
        displayName: displayLabel,
        qrCode: whatsappQrCode,
      };
    }
    return whatsappQrCode ? { qrCode: whatsappQrCode } : undefined;
  }, [channelsData, whatsappQrCode]);

  const signalConfig = React.useMemo((): SignalConfig | undefined => {
    const cfg = configSnapshot?.config?.channels?.signal;
    if (cfg?.phoneNumber) {
      return {
        phoneNumber: cfg.phoneNumber as string,
        baseUrl: cfg.baseUrl as string | undefined,
        deviceName: cfg.deviceName as string | undefined,
      };
    }
    return undefined;
  }, [configSnapshot]);

  const imessageConfig = React.useMemo((): iMessageConfig | undefined => {
    const cfg = configSnapshot?.config?.channels?.imessage;
    if (cfg?.cliPath || cfg?.dbPath) {
      return {
        cliPath: cfg.cliPath as string | undefined,
        dbPath: cfg.dbPath as string | undefined,
      };
    }
    return undefined;
  }, [configSnapshot]);

  // Telegram handlers
  const handleTelegramSave = async (config: TelegramConfig) => {
    if (!configSnapshot?.hash) {return;}
    await patchConfig.mutateAsync({
      baseHash: configSnapshot.hash,
      raw: JSON.stringify({
        channels: {
          telegram: {
            botToken: config.botToken,
            mode: config.mode,
            webhookUrl: config.webhookUrl,
            allowFrom: config.allowFrom,
            allowUnmentionedGroups: config.allowUnmentionedGroups,
            enabled: true,
          },
        },
      }),
      note: "Configure Telegram",
    });
    refreshChannels();
  };

  const handleTelegramDisconnect = async () => {
    await logoutChannel.mutateAsync({ channel: "telegram" });
    refreshChannels();
  };

  // Discord handlers
  const handleDiscordSave = async (config: DiscordConfig) => {
    if (!configSnapshot?.hash) {return;}
    await patchConfig.mutateAsync({
      baseHash: configSnapshot.hash,
      raw: JSON.stringify({
        channels: {
          discord: {
            botToken: config.botToken,
            applicationId: config.applicationId,
            allowFrom: config.allowFrom,
            dmPolicy: config.dmPolicy,
            enabled: true,
          },
        },
      }),
      note: "Configure Discord",
    });
    refreshChannels();
  };

  const handleDiscordDisconnect = async () => {
    await logoutChannel.mutateAsync({ channel: "discord" });
    refreshChannels();
  };

  // WhatsApp handlers
  const handleWhatsAppPairing = async () => {
    if (isWhatsAppBusy) {return;}
    setIsWhatsAppBusy(true);
    try {
      const startResponse = await startWebLogin({ force: true, timeoutMs: 30000 });
      setWhatsappQrCode(startResponse.qrDataUrl);

      const waitResponse = await waitWebLogin({ timeoutMs: 120000 });
      if (waitResponse.connected) {
        setWhatsappQrCode(undefined);
        refreshChannels();
        toast.success("WhatsApp connected successfully");
      }
    } catch (error) {
      toast.error(
        `WhatsApp login failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsWhatsAppBusy(false);
    }
  };

  const handleWhatsAppDisconnect = async () => {
    await logoutChannel.mutateAsync({ channel: "whatsapp" });
    setWhatsappQrCode(undefined);
    refreshChannels();
  };

  // Slack handlers
  const handleSlackConnect = async () => {
    toast.info("Slack OAuth flow not yet implemented in web UI");
  };

  const handleSlackTokenSave = async (config: SlackConfig) => {
    if (!configSnapshot?.hash) {return;}
    await patchConfig.mutateAsync({
      baseHash: configSnapshot.hash,
      raw: JSON.stringify({
        channels: {
          slack: {
            mode: "token",
            botToken: config.botToken,
            appToken: config.appToken,
            signingSecret: config.signingSecret,
            defaultChannel: config.defaultChannel,
            allowChannels: config.allowChannels,
            enabled: true,
          },
        },
      }),
      note: "Configure Slack tokens",
    });
    refreshChannels();
  };

  const handleSlackDisconnect = async () => {
    await logoutChannel.mutateAsync({ channel: "slack" });
    refreshChannels();
  };

  // Signal handlers
  const handleSignalSave = async (config: SignalConfig) => {
    if (!configSnapshot?.hash) {return;}
    await patchConfig.mutateAsync({
      baseHash: configSnapshot.hash,
      raw: JSON.stringify({
        channels: {
          signal: {
            phoneNumber: config.phoneNumber,
            baseUrl: config.baseUrl,
            deviceName: config.deviceName,
            enabled: true,
          },
        },
      }),
      note: "Configure Signal",
    });
    refreshChannels();
  };

  const handleSignalDisconnect = async () => {
    await logoutChannel.mutateAsync({ channel: "signal" });
    refreshChannels();
  };

  const handleIMessageSave = async (config: iMessageConfig) => {
    if (!configSnapshot?.hash) {return;}
    await patchConfig.mutateAsync({
      baseHash: configSnapshot.hash,
      raw: JSON.stringify({
        channels: {
          imessage: {
            cliPath: config.cliPath,
            dbPath: config.dbPath,
            enabled: true,
          },
        },
      }),
      note: "Configure iMessage",
    });
    refreshChannels();
  };

  // Generic handler for new channels
  const handleGenericSave = async (channelId: ChannelId, values: Record<string, string>) => {
    if (!configSnapshot?.hash) {return;}
    await patchConfig.mutateAsync({
      baseHash: configSnapshot.hash,
      raw: JSON.stringify({
        channels: {
          [channelId]: {
            ...values,
            enabled: true,
          },
        },
      }),
      note: `Configure ${getChannel(channelId)?.name ?? channelId}`,
    });
    refreshChannels();
  };

  const handleGenericDisconnect = async (channelId: ChannelId) => {
    await logoutChannel.mutateAsync({ channel: channelId });
    refreshChannels();
  };

  const openSheet = (channelId: ChannelId) => {
    setActiveSheet(channelId);
  };

  const closeSheet = () => {
    setActiveSheet(null);
  };

  // Group channels by category
  const channelsByCategory = React.useMemo(() => {
    const grouped: Record<string, ChannelConfigType[]> = {
      messaging: [],
      enterprise: [],
      decentralized: [],
      productivity: [],
    };
    channels.forEach((ch) => {
      const category = ch.category || "messaging";
      if (!grouped[category]) {grouped[category] = [];}
      grouped[category].push(ch);
    });
    return grouped;
  }, [channels]);

  const categoryLabels: Record<string, string> = {
    messaging: "Messaging",
    enterprise: "Enterprise",
    decentralized: "Decentralized",
    productivity: "Productivity",
  };

  const gettingStartedSteps: Array<{
    id: ChannelId;
    title: string;
    description: string;
  }> = [
    {
      id: "telegram",
      title: "Telegram",
      description: "Create a bot via @BotFather and paste the token.",
    },
    {
      id: "discord",
      title: "Discord",
      description: "Create a bot in the Discord Developer Portal.",
    },
    {
      id: "whatsapp",
      title: "WhatsApp",
      description: "Scan the QR code with your WhatsApp app.",
    },
    {
      id: "slack",
      title: "Slack",
      description: "Install the Clawdbrain app in your workspace.",
    },
  ];

  const pendingGettingStarted = gettingStartedSteps.filter((step) => {
    const status = getChannelStatus(step.id);
    return status === "not_configured" || status === "error";
  });

  const handleUninstall = async (channelId: ChannelId) => {
    setInstallOverrides((prev) => ({ ...prev, [channelId]: false }));
    toast.success(`${getChannel(channelId)?.name} uninstalled`);
  };

  // Render generic dialogs for new channels
  const renderGenericDialogs = () => {
    const specializedChannelIds = new Set<string>([
      "telegram",
      "whatsapp",
      "discord",
      "signal",
      "slack",
      "imessage",
    ]);
    const genericChannels = channels.filter((channel) => !specializedChannelIds.has(channel.id));

    return genericChannels.map((channel) => {
      const channelId = channel.id;
      const config = channelFieldConfigs[channelId];
      const docsUrl = config?.docsUrl ?? channelsData?.channelMeta?.[channelId]?.docsUrl;
      const isSupported = isChannelSupported(channel);

      return (
        <GenericChannelConfigDialog
          key={channelId}
          open={activeSheet === channelId}
          onOpenChange={(open) => !open && closeSheet()}
          channel={channel}
          fields={config?.fields}
          authModes={config?.authModes}
          behaviorFields={config?.behaviorFields}
          helpSteps={config?.helpSteps}
          docsUrl={docsUrl}
          isConnected={getChannelStatus(channelId) === "connected"}
          isUnsupported={!isSupported}
          relayProviders={channel.platform?.relayProviders}
          onSave={(values) => handleGenericSave(channelId, values)}
          onDisconnect={() => handleGenericDisconnect(channelId)}
        />
      );
    });
  };

  if (isChannelsLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (channelsError) {
    return (
      <div className={cn("space-y-4", className)}>
        <ErrorState
          variant="card"
          title={errorMessages.channels.title}
          description={errorMessages.channels.description}
          onRetry={handleRetry}
          isRetrying={isRetrying || isChannelsFetching}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-8", className)}>
      <Collapsible.Root open={gettingStartedOpen} onOpenChange={setGettingStartedOpen}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Getting Started</h3>
            <p className="text-sm text-muted-foreground">
              Recommendations update as channels are configured.
            </p>
          </div>
          <Collapsible.Trigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  gettingStartedOpen && "rotate-180"
                )}
              />
              {gettingStartedOpen ? "Collapse" : "Expand"}
            </Button>
          </Collapsible.Trigger>
        </div>
        <Collapsible.Content className="pt-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            {pendingGettingStarted.length > 0 ? (
              <div className="space-y-3 text-sm">
                {pendingGettingStarted.map((step) => (
                  <div key={step.id} className="flex flex-wrap items-start gap-2">
                    <span className="font-medium text-foreground">{step.title}</span>
                    <span className="text-muted-foreground">{step.description}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                All core channels are configured. Add more channels below when you are ready.
              </p>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {/* Channels by category */}
      {Object.entries(channelsByCategory).map(([category, categoryChannels]) => (
        categoryChannels.length > 0 && (
          <Collapsible.Root key={category} defaultOpen={category === "messaging"}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {categoryLabels[category]}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {categoryChannels.length} channel{categoryChannels.length === 1 ? "" : "s"}
                </p>
              </div>
              <Collapsible.Trigger asChild>
                <Button variant="ghost" size="sm" className="group gap-2">
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  Toggle
                </Button>
              </Collapsible.Trigger>
            </div>
            <Collapsible.Content className="pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {categoryChannels.map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    currentPlatform={currentPlatform}
                    onConfigure={() => openSheet(channel.id)}
                    onUninstall={() => handleUninstall(channel.id)}
                  />
                ))}
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        )
      ))}

      {/* Existing Configuration Dialogs */}
      <TelegramConfigSheet
        open={activeSheet === "telegram"}
        onOpenChange={(open) => !open && closeSheet()}
        config={telegramConfig}
        onSave={handleTelegramSave}
        onDisconnect={handleTelegramDisconnect}
        isConnected={getChannelStatus("telegram") === "connected"}
      />

      <DiscordConfigSheet
        open={activeSheet === "discord"}
        onOpenChange={(open) => !open && closeSheet()}
        config={discordConfig}
        onSave={handleDiscordSave}
        onDisconnect={handleDiscordDisconnect}
        isConnected={getChannelStatus("discord") === "connected"}
      />

      <WhatsAppConfigSheet
        open={activeSheet === "whatsapp"}
        onOpenChange={(open) => !open && closeSheet()}
        config={whatsappConfig}
        onStartPairing={handleWhatsAppPairing}
        onDisconnect={handleWhatsAppDisconnect}
        isConnected={getChannelStatus("whatsapp") === "connected"}
      />

      <SlackConfigSheet
        open={activeSheet === "slack"}
        onOpenChange={(open) => !open && closeSheet()}
        config={slackConfig}
        onConnect={handleSlackConnect}
        onSaveTokenConfig={handleSlackTokenSave}
        onDisconnect={handleSlackDisconnect}
        isConnected={getChannelStatus("slack") === "connected"}
      />

      <SignalConfigSheet
        open={activeSheet === "signal"}
        onOpenChange={(open) => !open && closeSheet()}
        config={signalConfig}
        onSave={handleSignalSave}
        onDisconnect={handleSignalDisconnect}
        isConnected={getChannelStatus("signal") === "connected"}
      />

      <IMessageConfigSheet
        open={activeSheet === "imessage"}
        onOpenChange={(open) => !open && closeSheet()}
        isConnected={getChannelStatus("imessage") === "connected"}
        isMacOS={currentPlatform === "macos"}
        config={imessageConfig}
        onSave={handleIMessageSave}
      />

      {/* Generic dialogs for new channels */}
      {renderGenericDialogs()}
    </div>
  );
}

export default ChannelConfig;
