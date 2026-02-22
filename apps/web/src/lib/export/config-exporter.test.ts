/**
 * Tests for configuration export functionality.
 */
import { describe, it, expect } from "vitest";
import { exportConfiguration, type ExportSection } from "./config-exporter";
import type { UserProfile, UserPreferences } from "@/hooks/queries/useUserSettings";
import type { UIState } from "@/stores/useUIStore";
import type { ClawdbrainConfig } from "@/lib/api/types";

describe("exportConfiguration", () => {
  const mockProfile: UserProfile = {
    name: "Test User",
    email: "test@example.com",
    avatar: "https://example.com/avatar.png",
    bio: "Test bio",
  };

  const mockPreferences: UserPreferences = {
    timezone: "America/Los_Angeles",
    language: "en",
    defaultAgentId: "agent-1",
    notifications: [
      { id: "agent-updates", label: "Agent Updates", description: "Test", enabled: true },
    ],
  };

  const mockUIState: UIState = {
    theme: "dark",
    sidebarCollapsed: false,
    powerUserMode: true,
    useLiveGateway: false,
    attentionSnoozeUntilMs: 0,
  };

  const mockGatewayConfig: ClawdbrainConfig = {
    auth: {
      anthropic: { apiKey: "sk-ant-secret-key" },
      openai: { apiKey: "sk-secret-key" },
    },
    agents: {
      default: "agent-1",
      "agent-1": { name: "Test Agent", model: "claude-3", systemPrompt: "You are helpful" },
    },
    channels: {
      telegram: { enabled: true, botToken: "123456:SECRET" },
      discord: { enabled: false, botToken: "secret.token.here" },
    },
  };

  describe("version and metadata", () => {
    it("includes version 1.0", () => {
      const result = exportConfiguration({ sections: [], profile: mockProfile });
      expect(result.version).toBe("1.0");
    });

    it("includes exportedAt timestamp", () => {
      const before = new Date().toISOString();
      const result = exportConfiguration({ sections: [], profile: mockProfile });
      const after = new Date().toISOString();

      expect(result.exportedAt).toBeDefined();
      expect(result.exportedAt >= before).toBe(true);
      expect(result.exportedAt <= after).toBe(true);
    });

    it("includes selected sections in output", () => {
      const sections: ExportSection[] = ["profile", "preferences"];
      const result = exportConfiguration({ sections, profile: mockProfile });
      expect(result.sections).toEqual(sections);
    });
  });

  describe("profile export", () => {
    it("exports profile data when selected", () => {
      const result = exportConfiguration({
        sections: ["profile"],
        profile: mockProfile,
      });

      expect(result.data.profile).toEqual({
        name: "Test User",
        email: "test@example.com",
        avatar: "https://example.com/avatar.png",
        bio: "Test bio",
      });
    });

    it("does not export profile when not selected", () => {
      const result = exportConfiguration({
        sections: ["preferences"],
        profile: mockProfile,
      });

      expect(result.data.profile).toBeUndefined();
    });

    it("does not export profile when data is missing", () => {
      const result = exportConfiguration({
        sections: ["profile"],
        profile: undefined,
      });

      expect(result.data.profile).toBeUndefined();
    });
  });

  describe("preferences export", () => {
    it("exports preferences data when selected", () => {
      const result = exportConfiguration({
        sections: ["preferences"],
        preferences: mockPreferences,
      });

      expect(result.data.preferences).toEqual({
        timezone: "America/Los_Angeles",
        language: "en",
        defaultAgentId: "agent-1",
        notifications: mockPreferences.notifications,
      });
    });

    it("does not export preferences when not selected", () => {
      const result = exportConfiguration({
        sections: ["profile"],
        preferences: mockPreferences,
      });

      expect(result.data.preferences).toBeUndefined();
    });
  });

  describe("UI settings export", () => {
    it("exports UI settings when selected", () => {
      const result = exportConfiguration({
        sections: ["uiSettings"],
        uiState: mockUIState,
      });

      expect(result.data.uiSettings).toEqual({
        theme: "dark",
        sidebarCollapsed: false,
        powerUserMode: true,
      });
    });

    it("does not export UI settings when not selected", () => {
      const result = exportConfiguration({
        sections: ["profile"],
        uiState: mockUIState,
      });

      expect(result.data.uiSettings).toBeUndefined();
    });
  });

  describe("gateway config export - security", () => {
    it("exports agents config without sensitive data", () => {
      const result = exportConfiguration({
        sections: ["gatewayConfig"],
        gatewayConfig: mockGatewayConfig,
      });

      expect(result.data.gatewayConfig?.agents).toBeDefined();
      expect(result.data.gatewayConfig?.agents?.default).toBe("agent-1");
      expect(result.data.gatewayConfig?.agents?.["agent-1"]).toEqual({
        name: "Test Agent",
        model: "claude-3",
        systemPrompt: "You are helpful",
      });
    });

    it("exports channels config with only enabled status", () => {
      const result = exportConfiguration({
        sections: ["gatewayConfig"],
        gatewayConfig: mockGatewayConfig,
      });

      expect(result.data.gatewayConfig?.channels).toBeDefined();
      expect(result.data.gatewayConfig?.channels?.telegram).toEqual({ enabled: true });
      expect(result.data.gatewayConfig?.channels?.discord).toEqual({ enabled: false });
    });

    it("NEVER exports API keys", () => {
      const result = exportConfiguration({
        sections: ["gatewayConfig"],
        gatewayConfig: mockGatewayConfig,
      });

      const jsonStr = JSON.stringify(result);

      // Check that no API keys are present
      expect(jsonStr).not.toContain("sk-ant-secret-key");
      expect(jsonStr).not.toContain("sk-secret-key");
      expect(jsonStr).not.toContain("apiKey");
    });

    it("NEVER exports bot tokens", () => {
      const result = exportConfiguration({
        sections: ["gatewayConfig"],
        gatewayConfig: mockGatewayConfig,
      });

      const jsonStr = JSON.stringify(result);

      // Check that no bot tokens are present
      expect(jsonStr).not.toContain("123456:SECRET");
      expect(jsonStr).not.toContain("secret.token.here");
      expect(jsonStr).not.toContain("botToken");
    });
  });

  describe("multiple sections", () => {
    it("exports all selected sections", () => {
      const result = exportConfiguration({
        sections: ["profile", "preferences", "uiSettings", "gatewayConfig"],
        profile: mockProfile,
        preferences: mockPreferences,
        uiState: mockUIState,
        gatewayConfig: mockGatewayConfig,
      });

      expect(result.data.profile).toBeDefined();
      expect(result.data.preferences).toBeDefined();
      expect(result.data.uiSettings).toBeDefined();
      expect(result.data.gatewayConfig).toBeDefined();
    });

    it("exports empty data object when no sections selected", () => {
      const result = exportConfiguration({
        sections: [],
        profile: mockProfile,
        preferences: mockPreferences,
      });

      expect(result.data).toEqual({});
    });
  });
});
