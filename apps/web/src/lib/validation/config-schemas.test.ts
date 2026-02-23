/**
 * Tests for config validation schemas.
 */
import { describe, it, expect } from "vitest";
import {
  anthropicApiKeySchema,
  openaiApiKeySchema,
  xaiApiKeySchema,
  openrouterApiKeySchema,
  portSchema,
  bindAddressSchema,
  telegramBotTokenSchema,
  discordBotTokenSchema,
  slackBotTokenSchema,
  getApiKeySchemaForProvider,
  getChannelCredentialSchema,
} from "./config-schemas";

describe("API Key Schemas", () => {
  describe("anthropicApiKeySchema", () => {
    it("accepts valid Anthropic API keys", () => {
      expect(anthropicApiKeySchema.safeParse("sk-ant-api03-abc123def456").success).toBe(true);
    });

    it("rejects keys without sk-ant- prefix", () => {
      const result = anthropicApiKeySchema.safeParse("sk-abc123");
      expect(result.success).toBe(false);
    });

    it("rejects empty strings", () => {
      const result = anthropicApiKeySchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("openaiApiKeySchema", () => {
    it("accepts valid OpenAI API keys", () => {
      expect(openaiApiKeySchema.safeParse("sk-abc123def456ghi789").success).toBe(true);
    });

    it("rejects keys without sk- prefix", () => {
      const result = openaiApiKeySchema.safeParse("api-key-123");
      expect(result.success).toBe(false);
    });
  });

  describe("xaiApiKeySchema", () => {
    it("accepts valid X.AI API keys", () => {
      expect(xaiApiKeySchema.safeParse("xai-abc123def456").success).toBe(true);
    });

    it("rejects keys without xai- prefix", () => {
      const result = xaiApiKeySchema.safeParse("sk-abc123");
      expect(result.success).toBe(false);
    });
  });

  describe("openrouterApiKeySchema", () => {
    it("accepts valid OpenRouter API keys", () => {
      expect(openrouterApiKeySchema.safeParse("sk-or-abc123def456").success).toBe(true);
    });

    it("rejects keys without sk-or- prefix", () => {
      const result = openrouterApiKeySchema.safeParse("sk-abc123");
      expect(result.success).toBe(false);
    });
  });

  describe("getApiKeySchemaForProvider", () => {
    it("returns the correct schema for each provider", () => {
      expect(getApiKeySchemaForProvider("anthropic")).toBe(anthropicApiKeySchema);
      expect(getApiKeySchemaForProvider("openai")).toBe(openaiApiKeySchema);
      expect(getApiKeySchemaForProvider("zai")).toBe(xaiApiKeySchema);
      expect(getApiKeySchemaForProvider("openrouter")).toBe(openrouterApiKeySchema);
    });
  });
});

describe("Gateway Configuration Schemas", () => {
  describe("portSchema", () => {
    it("accepts valid user ports", () => {
      expect(portSchema.safeParse(18789).success).toBe(true);
      expect(portSchema.safeParse(1024).success).toBe(true);
      expect(portSchema.safeParse(65535).success).toBe(true);
    });

    it("rejects reserved ports", () => {
      const result = portSchema.safeParse(80);
      expect(result.success).toBe(false);
    });

    it("rejects ports above 65535", () => {
      const result = portSchema.safeParse(70000);
      expect(result.success).toBe(false);
    });

    it("rejects non-integer values", () => {
      const result = portSchema.safeParse(1234.5);
      expect(result.success).toBe(false);
    });
  });

  describe("bindAddressSchema", () => {
    it("accepts valid IP addresses", () => {
      expect(bindAddressSchema.safeParse("0.0.0.0").success).toBe(true);
      expect(bindAddressSchema.safeParse("127.0.0.1").success).toBe(true);
      expect(bindAddressSchema.safeParse("192.168.1.1").success).toBe(true);
    });

    it("accepts localhost", () => {
      expect(bindAddressSchema.safeParse("localhost").success).toBe(true);
    });

    it("accepts valid hostnames", () => {
      expect(bindAddressSchema.safeParse("my-server.local").success).toBe(true);
    });

    it("rejects invalid formats", () => {
      // Values with special characters are not valid
      const result = bindAddressSchema.safeParse("host name with spaces");
      expect(result.success).toBe(false);
    });

    it("rejects empty strings", () => {
      const result = bindAddressSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });
});

describe("Channel Credential Schemas", () => {
  describe("telegramBotTokenSchema", () => {
    it("accepts valid Telegram bot tokens", () => {
      expect(telegramBotTokenSchema.safeParse("123456789:ABCdefGHIjklMNOpqrsTUVwxyz").success).toBe(true);
    });

    it("rejects tokens without proper format", () => {
      const result = telegramBotTokenSchema.safeParse("invalid-token");
      expect(result.success).toBe(false);
    });

    it("rejects tokens without colon separator", () => {
      const result = telegramBotTokenSchema.safeParse("123456789ABCdef");
      expect(result.success).toBe(false);
    });
  });

  describe("discordBotTokenSchema", () => {
    it("accepts valid Discord bot tokens", () => {
      expect(discordBotTokenSchema.safeParse("MTIzNDU2.XXXXXX.XXXXXXXXX").success).toBe(true);
    });

    it("rejects tokens without proper format", () => {
      const result = discordBotTokenSchema.safeParse("invalid-token");
      expect(result.success).toBe(false);
    });
  });

  describe("slackBotTokenSchema", () => {
    it("accepts valid Slack bot tokens", () => {
      expect(slackBotTokenSchema.safeParse("xoxb-123456789-abc").success).toBe(true);
    });

    it("accepts valid Slack user tokens", () => {
      expect(slackBotTokenSchema.safeParse("xoxp-123456789-abc").success).toBe(true);
    });

    it("rejects tokens without proper prefix", () => {
      const result = slackBotTokenSchema.safeParse("invalid-token");
      expect(result.success).toBe(false);
    });
  });

  describe("getChannelCredentialSchema", () => {
    it("returns the correct schema for each channel type", () => {
      expect(getChannelCredentialSchema("telegram")).toBe(telegramBotTokenSchema);
      expect(getChannelCredentialSchema("discord")).toBe(discordBotTokenSchema);
      expect(getChannelCredentialSchema("slack")).toBe(slackBotTokenSchema);
    });
  });
});
