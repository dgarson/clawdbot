/**
 * Configuration export utilities.
 *
 * Exports user settings, preferences, and gateway configuration.
 * API keys and auth credentials are explicitly excluded for security.
 */

import type { UserProfile, UserPreferences } from "@/hooks/queries/useUserSettings";
import type { UIState } from "@/stores/useUIStore";
import type { ClawdbrainConfig, AgentsConfig, ChannelsConfig } from "@/lib/api/types";
import type { ToolsetConfig } from "@/components/domain/tools";

export type ExportSection = "profile" | "preferences" | "uiSettings" | "gatewayConfig" | "toolsets";

export interface ConfigurationExport {
  version: "1.0";
  exportedAt: string;
  sections: ExportSection[];
  data: {
    profile?: Pick<UserProfile, "name" | "email" | "avatar" | "bio">;
    preferences?: Pick<UserPreferences, "timezone" | "language" | "defaultAgentId" | "notifications">;
    uiSettings?: Pick<UIState, "theme" | "sidebarCollapsed" | "powerUserMode">;
    gatewayConfig?: {
      agents?: SanitizedAgentsConfig;
      channels?: SanitizedChannelsConfig;
    };
    toolsets?: {
      configs: ToolsetConfig[];
      defaultToolsetId: string | null;
    };
  };
}

/**
 * Sanitized agents config without any sensitive data
 */
type SanitizedAgentsConfig = Omit<AgentsConfig, "auth">;

/**
 * Sanitized channels config - removes bot tokens and credentials
 */
type SanitizedChannelsConfig = {
  [K in keyof ChannelsConfig]?: {
    enabled?: boolean;
  };
};

export interface ExportConfigParams {
  sections: ExportSection[];
  profile?: UserProfile;
  preferences?: UserPreferences;
  uiState?: UIState;
  gatewayConfig?: ClawdbrainConfig;
  toolsets?: {
    configs: ToolsetConfig[];
    defaultToolsetId: string | null;
  };
}

/**
 * Sanitize agents config by removing any auth-related fields
 */
function sanitizeAgentsConfig(agents?: AgentsConfig): SanitizedAgentsConfig | undefined {
  if (!agents) {return undefined;}

  const sanitized: SanitizedAgentsConfig = { default: agents.default };

  for (const [key, value] of Object.entries(agents)) {
    if (key === "default" || typeof value === "string") {continue;}
    if (value && typeof value === "object") {
      // Only include non-sensitive agent config fields
      const { name, model, systemPrompt } = value;
      sanitized[key] = { name, model, systemPrompt };
    }
  }

  return sanitized;
}

/**
 * Sanitize channels config by removing tokens and credentials
 */
function sanitizeChannelsConfig(channels?: ChannelsConfig): SanitizedChannelsConfig | undefined {
  if (!channels) {return undefined;}

  const sanitized: SanitizedChannelsConfig = {};

  for (const [key, value] of Object.entries(channels)) {
    if (value && typeof value === "object" && "enabled" in value) {
      const enabled = (value as { enabled?: unknown }).enabled;
      if (typeof enabled !== "boolean") {continue;}
      // Only include enabled status, strip tokens/credentials
      sanitized[key as keyof ChannelsConfig] = { enabled };
    }
  }

  return sanitized;
}

/**
 * Export configuration data based on selected sections.
 *
 * Security: API keys and authentication credentials are NEVER exported.
 */
export function exportConfiguration({
  sections,
  profile,
  preferences,
  uiState,
  gatewayConfig,
  toolsets,
}: ExportConfigParams): ConfigurationExport {
  const exportData: ConfigurationExport = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    sections,
    data: {},
  };

  if (sections.includes("profile") && profile) {
    exportData.data.profile = {
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar,
      bio: profile.bio,
    };
  }

  if (sections.includes("preferences") && preferences) {
    exportData.data.preferences = {
      timezone: preferences.timezone,
      language: preferences.language,
      defaultAgentId: preferences.defaultAgentId,
      notifications: preferences.notifications,
    };
  }

  if (sections.includes("uiSettings") && uiState) {
    exportData.data.uiSettings = {
      theme: uiState.theme,
      sidebarCollapsed: uiState.sidebarCollapsed,
      powerUserMode: uiState.powerUserMode,
    };
  }

  if (sections.includes("gatewayConfig") && gatewayConfig) {
    exportData.data.gatewayConfig = {
      agents: sanitizeAgentsConfig(gatewayConfig.agents),
      channels: sanitizeChannelsConfig(gatewayConfig.channels),
    };
  }

  if (sections.includes("toolsets") && toolsets) {
    // Only export custom toolsets, not built-in ones
    exportData.data.toolsets = {
      configs: toolsets.configs.filter((t) => !t.isBuiltIn),
      defaultToolsetId: toolsets.defaultToolsetId,
    };
  }

  return exportData;
}
