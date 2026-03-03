/**
 * Tests for import validation schemas.
 */
import { describe, it, expect } from "vitest";
import {
  configurationExportSchema,
  conversationExportSchema,
  validateConfigurationImport,
  validateConversationImport,
  detectExportType,
  MAX_IMPORT_FILE_SIZE,
  CURRENT_EXPORT_VERSION,
} from "./import-schemas";

describe("Configuration Import Schema", () => {
  const validConfigExport = {
    version: "1.0" as const,
    exportedAt: "2024-01-15T10:00:00.000Z",
    sections: ["profile", "preferences"] as const,
    data: {
      profile: {
        name: "Test User",
        email: "test@example.com",
      },
      preferences: {
        timezone: "America/Los_Angeles",
        language: "en",
      },
    },
  };

  describe("configurationExportSchema", () => {
    it("accepts valid configuration export", () => {
      const result = configurationExportSchema.safeParse(validConfigExport);
      expect(result.success).toBe(true);
    });

    it("requires version 1.0", () => {
      const invalid = { ...validConfigExport, version: "2.0" };
      const result = configurationExportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("requires valid datetime for exportedAt", () => {
      const invalid = { ...validConfigExport, exportedAt: "not-a-date" };
      const result = configurationExportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("accepts all valid section types", () => {
      const allSections = {
        ...validConfigExport,
        sections: ["profile", "preferences", "uiSettings", "gatewayConfig"],
      };
      const result = configurationExportSchema.safeParse(allSections);
      expect(result.success).toBe(true);
    });

    it("rejects invalid section types", () => {
      const invalid = { ...validConfigExport, sections: ["profile", "invalidSection"] };
      const result = configurationExportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("accepts empty sections array", () => {
      const emptySections = { ...validConfigExport, sections: [] };
      const result = configurationExportSchema.safeParse(emptySections);
      expect(result.success).toBe(true);
    });

    it("validates profile data structure", () => {
      const withInvalidProfile = {
        ...validConfigExport,
        data: {
          profile: {
            name: "Test",
            email: "not-an-email", // Invalid email format
          },
        },
      };
      const result = configurationExportSchema.safeParse(withInvalidProfile);
      expect(result.success).toBe(false);
    });

    it("accepts valid avatar URL", () => {
      const withAvatar = {
        ...validConfigExport,
        data: {
          profile: {
            name: "Test",
            email: "test@example.com",
            avatar: "https://example.com/avatar.png",
          },
        },
      };
      const result = configurationExportSchema.safeParse(withAvatar);
      expect(result.success).toBe(true);
    });

    it("validates UI settings theme enum", () => {
      const validThemes = ["light", "dark", "system"];
      for (const theme of validThemes) {
        const withTheme = {
          ...validConfigExport,
          data: { uiSettings: { theme } },
        };
        const result = configurationExportSchema.safeParse(withTheme);
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid theme values", () => {
      const invalid = {
        ...validConfigExport,
        data: { uiSettings: { theme: "invalid-theme" } },
      };
      const result = configurationExportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("validates notification preferences structure", () => {
      const withNotifications = {
        ...validConfigExport,
        data: {
          preferences: {
            timezone: "UTC",
            notifications: [
              { id: "test", label: "Test", description: "Desc", enabled: true },
            ],
          },
        },
      };
      const result = configurationExportSchema.safeParse(withNotifications);
      expect(result.success).toBe(true);
    });
  });

  describe("validateConfigurationImport", () => {
    it("returns success for valid data", () => {
      const result = validateConfigurationImport(validConfigExport);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it("returns errors for invalid data", () => {
      const result = validateConfigurationImport({ version: "invalid" });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it("includes field paths in error messages", () => {
      const invalid = {
        ...validConfigExport,
        data: { profile: { email: "invalid" } },
      };
      const result = validateConfigurationImport(invalid);
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes("email"))).toBe(true);
    });
  });
});

describe("Conversation Import Schema", () => {
  const validConversationExport = {
    version: "1.0" as const,
    exportedAt: "2024-01-15T10:00:00.000Z",
    conversations: [
      {
        id: "conv-1",
        title: "Test Conversation",
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T11:00:00.000Z",
        messages: [
          {
            role: "user" as const,
            content: "Hello",
            timestamp: "2024-01-15T10:00:00.000Z",
          },
          {
            role: "assistant" as const,
            content: "Hi there!",
            timestamp: "2024-01-15T10:01:00.000Z",
          },
        ],
      },
    ],
  };

  describe("conversationExportSchema", () => {
    it("accepts valid conversation export", () => {
      const result = conversationExportSchema.safeParse(validConversationExport);
      expect(result.success).toBe(true);
    });

    it("requires version 1.0", () => {
      const invalid = { ...validConversationExport, version: "2.0" };
      const result = conversationExportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("validates message role enum", () => {
      const validRoles = ["user", "assistant", "system"];
      for (const role of validRoles) {
        const withRole = {
          ...validConversationExport,
          conversations: [
            {
              ...validConversationExport.conversations[0],
              messages: [{ role, content: "test", timestamp: "2024-01-15T10:00:00.000Z" }],
            },
          ],
        };
        const result = conversationExportSchema.safeParse(withRole);
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid message role", () => {
      const invalid = {
        ...validConversationExport,
        conversations: [
          {
            ...validConversationExport.conversations[0],
            messages: [{ role: "invalid", content: "test", timestamp: "2024-01-15T10:00:00.000Z" }],
          },
        ],
      };
      const result = conversationExportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("accepts empty conversations array", () => {
      const empty = { ...validConversationExport, conversations: [] };
      const result = conversationExportSchema.safeParse(empty);
      expect(result.success).toBe(true);
    });

    it("accepts conversations with optional agentId and agentName", () => {
      const withAgent = {
        ...validConversationExport,
        conversations: [
          {
            ...validConversationExport.conversations[0],
            agentId: "agent-1",
            agentName: "Test Agent",
          },
        ],
      };
      const result = conversationExportSchema.safeParse(withAgent);
      expect(result.success).toBe(true);
    });
  });

  describe("validateConversationImport", () => {
    it("returns success for valid data", () => {
      const result = validateConversationImport(validConversationExport);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("returns errors for invalid data", () => {
      const result = validateConversationImport({ conversations: "not-an-array" });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});

describe("detectExportType", () => {
  it("detects configuration export by sections field", () => {
    const configExport = {
      version: "1.0",
      sections: ["profile"],
      data: {},
    };
    expect(detectExportType(configExport)).toBe("configuration");
  });

  it("detects conversation export by conversations field", () => {
    const convExport = {
      version: "1.0",
      conversations: [],
    };
    expect(detectExportType(convExport)).toBe("conversation");
  });

  it("returns unknown for invalid data", () => {
    expect(detectExportType(null)).toBe("unknown");
    expect(detectExportType(undefined)).toBe("unknown");
    expect(detectExportType({})).toBe("unknown");
    expect(detectExportType({ randomField: true })).toBe("unknown");
  });

  it("returns unknown for non-object data", () => {
    expect(detectExportType("string")).toBe("unknown");
    expect(detectExportType(123)).toBe("unknown");
    expect(detectExportType([])).toBe("unknown");
  });
});

describe("Constants", () => {
  it("MAX_IMPORT_FILE_SIZE is 10MB", () => {
    expect(MAX_IMPORT_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  it("CURRENT_EXPORT_VERSION is 1.0", () => {
    expect(CURRENT_EXPORT_VERSION).toBe("1.0");
  });
});
