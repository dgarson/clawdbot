import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { OpenClawConfig } from "../config/types.js";
import {
  resolveNotionConfig,
  setupNotionWebhook,
  setupNotionTools,
  setupNotion,
  NOTION_API_KEY_ENV,
  NOTION_WEBHOOK_SECRET_ENV,
  NOTION_BOT_ID_ENV,
} from "./notion-wiring.js";

// ────────────────────── Config Resolution ──────────────────────

describe("resolveNotionConfig", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    delete process.env[NOTION_API_KEY_ENV];
    delete process.env[NOTION_WEBHOOK_SECRET_ENV];
    delete process.env[NOTION_BOT_ID_ENV];
  });

  it("returns defaults when no config or env vars", () => {
    const result = resolveNotionConfig(undefined);
    expect(result.apiKey).toBeUndefined();
    expect(result.webhookSecret).toBeUndefined();
    expect(result.botId).toBeUndefined();
    expect(result.webhookEnabled).toBe(false);
    expect(result.toolsEnabled).toBe(false);
  });

  it("reads from config object", () => {
    const cfg: OpenClawConfig = {
      notion: {
        botId: "bot-123",
        webhook: {
          enabled: true,
          secret: "my-secret",
          path: "/custom/notion",
        },
        tools: {
          enabled: true,
          apiKey: "ntn_test_key",
        },
      },
    };
    const result = resolveNotionConfig(cfg);
    expect(result.apiKey).toBe("ntn_test_key");
    expect(result.webhookSecret).toBe("my-secret");
    expect(result.botId).toBe("bot-123");
    expect(result.webhookEnabled).toBe(true);
    expect(result.toolsEnabled).toBe(true);
    expect(result.webhookPath).toBe("/custom/notion");
  });

  it("falls back to env vars", () => {
    process.env[NOTION_API_KEY_ENV] = "ntn_from_env";
    process.env[NOTION_WEBHOOK_SECRET_ENV] = "secret_from_env";
    process.env[NOTION_BOT_ID_ENV] = "bot_from_env";

    const result = resolveNotionConfig({});
    expect(result.apiKey).toBe("ntn_from_env");
    expect(result.webhookSecret).toBe("secret_from_env");
    expect(result.botId).toBe("bot_from_env");
    expect(result.webhookEnabled).toBe(true); // auto-enabled because secret exists
    expect(result.toolsEnabled).toBe(true); // auto-enabled because apiKey exists
  });

  it("config values take precedence over env vars", () => {
    process.env[NOTION_API_KEY_ENV] = "ntn_from_env";
    const cfg: OpenClawConfig = {
      notion: { tools: { apiKey: "ntn_from_config" } },
    };
    const result = resolveNotionConfig(cfg);
    expect(result.apiKey).toBe("ntn_from_config");
  });

  it("auto-enables webhook when secret is available", () => {
    process.env[NOTION_WEBHOOK_SECRET_ENV] = "s";
    const result = resolveNotionConfig({});
    expect(result.webhookEnabled).toBe(true);
  });

  it("respects explicit webhook disabled even with secret", () => {
    process.env[NOTION_WEBHOOK_SECRET_ENV] = "s";
    const cfg: OpenClawConfig = {
      notion: { webhook: { enabled: false } },
    };
    const result = resolveNotionConfig(cfg);
    expect(result.webhookEnabled).toBe(false);
  });

  it("respects explicit tools disabled even with apiKey", () => {
    process.env[NOTION_API_KEY_ENV] = "ntn_key";
    const cfg: OpenClawConfig = {
      notion: { tools: { enabled: false } },
    };
    const result = resolveNotionConfig(cfg);
    expect(result.toolsEnabled).toBe(false);
  });
});

// ────────────────────── Webhook Setup ──────────────────────

describe("setupNotionWebhook", () => {
  it("returns null when webhook is disabled", () => {
    const resolved = resolveNotionConfig(undefined);
    const result = setupNotionWebhook(resolved, {
      registerHttpRoute: vi.fn(() => () => {}),
    });
    expect(result).toBeNull();
  });

  it("registers route when webhook is enabled", () => {
    const unregister = vi.fn();
    const registerHttpRoute = vi.fn(() => unregister);
    const resolved = {
      apiKey: "ntn_key",
      webhookSecret: "secret",
      botId: "bot-1",
      webhookEnabled: true,
      webhookPath: undefined,
      toolsEnabled: false,
    };

    const result = setupNotionWebhook(resolved, { registerHttpRoute });
    expect(result).not.toBeNull();
    expect(registerHttpRoute).toHaveBeenCalledTimes(1);
    expect(registerHttpRoute.mock.calls[0]![0]!.path).toBe("/webhooks/notion");
    expect(registerHttpRoute.mock.calls[0]![0]!.pluginId).toBe("notion-webhook");

    // Verify unregister works
    result!();
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it("uses custom webhook path", () => {
    const registerHttpRoute = vi.fn(() => () => {});
    const resolved = {
      apiKey: undefined,
      webhookSecret: "s",
      botId: undefined,
      webhookEnabled: true,
      webhookPath: "/custom/notion-hook",
      toolsEnabled: false,
    };

    setupNotionWebhook(resolved, { registerHttpRoute });
    expect(registerHttpRoute.mock.calls[0]![0]!.path).toBe("/custom/notion-hook");
  });
});

// ────────────────────── Tools Setup ──────────────────────

describe("setupNotionTools", () => {
  it("returns empty array when tools are disabled", () => {
    const resolved = resolveNotionConfig(undefined);
    const tools = setupNotionTools(resolved);
    expect(tools).toEqual([]);
  });

  it("returns 7 tools when enabled with API key", () => {
    const resolved = {
      apiKey: "ntn_test",
      webhookSecret: undefined,
      botId: undefined,
      webhookEnabled: false,
      webhookPath: undefined,
      toolsEnabled: true,
    };
    const tools = setupNotionTools(resolved);
    expect(tools).toHaveLength(7);
    const names = tools.map((t) => t.name);
    expect(names).toContain("notion_search");
    expect(names).toContain("notion_get_page");
    expect(names).toContain("notion_get_page_content");
    expect(names).toContain("notion_create_page");
    expect(names).toContain("notion_update_page");
    expect(names).toContain("notion_append_blocks");
    expect(names).toContain("notion_query_database");
  });

  it("returns empty when toolsEnabled but no apiKey", () => {
    const resolved = {
      apiKey: undefined,
      webhookSecret: undefined,
      botId: undefined,
      webhookEnabled: false,
      webhookPath: undefined,
      toolsEnabled: true, // enabled but no key
    };
    const tools = setupNotionTools(resolved);
    expect(tools).toEqual([]);
  });
});

// ────────────────────── Combined Setup ──────────────────────

describe("setupNotion", () => {
  afterEach(() => {
    delete process.env[NOTION_API_KEY_ENV];
    delete process.env[NOTION_WEBHOOK_SECRET_ENV];
    delete process.env[NOTION_BOT_ID_ENV];
  });

  it("sets up both webhook and tools when fully configured", () => {
    const registerHttpRoute = vi.fn(() => () => {});
    const log = vi.fn();

    const cfg: OpenClawConfig = {
      notion: {
        botId: "bot-1",
        webhook: { secret: "s" },
        tools: { apiKey: "ntn_key" },
      },
    };

    const result = setupNotion(cfg, { registerHttpRoute, log });
    expect(result.unregisterWebhook).not.toBeNull();
    expect(result.tools).toHaveLength(7);
    expect(result.config.webhookEnabled).toBe(true);
    expect(result.config.toolsEnabled).toBe(true);
    expect(registerHttpRoute).toHaveBeenCalledTimes(1);
  });

  it("returns nothing when not configured", () => {
    const registerHttpRoute = vi.fn(() => () => {});
    const result = setupNotion(undefined, { registerHttpRoute });
    expect(result.unregisterWebhook).toBeNull();
    expect(result.tools).toHaveLength(0);
    expect(registerHttpRoute).not.toHaveBeenCalled();
  });

  it("sets up only tools when no webhook secret", () => {
    process.env[NOTION_API_KEY_ENV] = "ntn_key";
    const registerHttpRoute = vi.fn(() => () => {});

    const result = setupNotion({}, { registerHttpRoute });
    expect(result.unregisterWebhook).toBeNull();
    expect(result.tools).toHaveLength(7);
    expect(registerHttpRoute).not.toHaveBeenCalled();
  });

  it("sets up only webhook when no API key", () => {
    process.env[NOTION_WEBHOOK_SECRET_ENV] = "secret";
    const registerHttpRoute = vi.fn(() => () => {});

    const result = setupNotion({}, { registerHttpRoute });
    expect(result.unregisterWebhook).not.toBeNull();
    expect(result.tools).toHaveLength(0);
    expect(registerHttpRoute).toHaveBeenCalledTimes(1);
  });
});
