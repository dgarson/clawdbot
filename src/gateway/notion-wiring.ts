import type { AnyAgentTool } from "openclaw/plugin-sdk";
/**
 * Notion Bidirectional Integration — Gateway Wiring
 *
 * Reads config + env vars and sets up:
 * 1. Inbound webhook handler (/webhooks/notion) on the gateway HTTP server
 * 2. Outbound Notion MCP tools for the agent
 *
 * Called during gateway startup to register routes and tools.
 */
import type { OpenClawConfig } from "../config/types.js";
import type { NotionWebhookEvent } from "../webhooks/notion.js";
import { fetchPageContentAsText } from "../tools/notion/api.js";
import { createNotionTools } from "../tools/notion/index.js";
import { createNotionEventRouter, registerNotionWebhookRoute } from "../webhooks/notion.js";

// ────────────────────────── Env Var Constants ──────────────────────────

export const NOTION_API_KEY_ENV = "NOTION_API_KEY";
export const NOTION_WEBHOOK_SECRET_ENV = "NOTION_WEBHOOK_SECRET";
export const NOTION_BOT_ID_ENV = "NOTION_BOT_ID";

// ────────────────────────── Config Resolution ──────────────────────────

export interface ResolvedNotionConfig {
  /** Notion API key for outbound API calls. */
  apiKey: string | undefined;
  /** Webhook secret for HMAC-SHA256 signature validation. */
  webhookSecret: string | undefined;
  /** Bot user ID for self-authored event filtering. */
  botId: string | undefined;
  /** Whether the webhook handler should be enabled. */
  webhookEnabled: boolean;
  /** Custom webhook path (default: /webhooks/notion). */
  webhookPath: string | undefined;
  /** Whether the Notion tools should be enabled. */
  toolsEnabled: boolean;
}

/**
 * Resolve Notion configuration from OpenClawConfig + environment variables.
 * Env vars serve as fallbacks when config values are not explicitly set.
 */
export function resolveNotionConfig(cfg?: OpenClawConfig): ResolvedNotionConfig {
  const notion = cfg?.notion;
  const apiKey = notion?.tools?.apiKey || process.env[NOTION_API_KEY_ENV] || undefined;
  const webhookSecret =
    notion?.webhook?.secret || process.env[NOTION_WEBHOOK_SECRET_ENV] || undefined;
  const botId = notion?.botId || process.env[NOTION_BOT_ID_ENV] || undefined;

  // Webhook: explicitly enabled, or auto-enabled when secret is available
  const webhookEnabled = notion?.webhook?.enabled ?? Boolean(webhookSecret);

  // Tools: explicitly enabled, or auto-enabled when API key is available
  const toolsEnabled = notion?.tools?.enabled ?? Boolean(apiKey);

  return {
    apiKey,
    webhookSecret,
    botId,
    webhookEnabled,
    webhookPath: notion?.webhook?.path,
    toolsEnabled,
  };
}

// ────────────────────────── Webhook Setup ──────────────────────────

export interface NotionWebhookSetupDeps {
  /** Plugin HTTP route registrar (from the gateway plugin registry). */
  registerHttpRoute: (opts: {
    path: string;
    handler: (
      req: import("node:http").IncomingMessage,
      res: import("node:http").ServerResponse,
    ) => Promise<void> | void;
    pluginId: string;
    source: string;
  }) => () => void;
  /** Memory ingest callback. */
  ingestMemory?: (params: {
    text: string;
    source: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  /** Session wake callback. */
  wakeSession?: (params: { text: string; mode: "now" | "next-heartbeat" }) => void;
  /** System log callback. */
  logSystem?: (msg: string) => void;
  /** General log callback. */
  log?: (msg: string) => void;
}

/**
 * Set up the Notion inbound webhook handler on the gateway.
 *
 * Returns an unregister function, or null if webhook is not enabled.
 */
export function setupNotionWebhook(
  resolved: ResolvedNotionConfig,
  deps: NotionWebhookSetupDeps,
): (() => void) | null {
  if (!resolved.webhookEnabled) {
    deps.log?.("notion: webhook disabled (no secret configured or explicitly disabled)");
    return null;
  }

  // Create the event router that dispatches to memory/wake/system
  const onEvent = createNotionEventRouter({
    ingestMemory: deps.ingestMemory,
    wakeSession: deps.wakeSession,
    logSystem: deps.logSystem,
    fetchPageContent: resolved.apiKey
      ? (pageId: string) => fetchPageContentAsText({ apiKey: resolved.apiKey! }, pageId)
      : undefined,
    log: deps.log,
  });

  // Register the HTTP route
  const unregister = registerNotionWebhookRoute({
    registerHttpRoute: deps.registerHttpRoute,
    secret: resolved.webhookSecret,
    botId: resolved.botId,
    onEvent,
    path: resolved.webhookPath,
    log: deps.log,
  });

  deps.log?.("notion: webhook handler registered");
  return unregister;
}

// ────────────────────────── Tools Setup ──────────────────────────

/**
 * Create Notion agent tools if enabled and API key is available.
 *
 * Returns an array of tools, or an empty array if not enabled.
 */
export function setupNotionTools(resolved: ResolvedNotionConfig): AnyAgentTool[] {
  if (!resolved.toolsEnabled || !resolved.apiKey) {
    return [];
  }

  return createNotionTools({ apiKey: resolved.apiKey });
}

// ────────────────────────── Combined Setup ──────────────────────────

export interface NotionSetupResult {
  /** Unregister function for the webhook route, or null. */
  unregisterWebhook: (() => void) | null;
  /** Array of Notion agent tools (empty if not enabled). */
  tools: AnyAgentTool[];
  /** Resolved config for diagnostics. */
  config: ResolvedNotionConfig;
}

/**
 * One-call setup for the entire Notion integration.
 * Call this during gateway startup.
 */
export function setupNotion(
  cfg: OpenClawConfig | undefined,
  deps: NotionWebhookSetupDeps,
): NotionSetupResult {
  const resolved = resolveNotionConfig(cfg);

  const unregisterWebhook = setupNotionWebhook(resolved, deps);
  const tools = setupNotionTools(resolved);

  if (tools.length > 0) {
    deps.log?.(`notion: ${tools.length} agent tools registered`);
  }

  return {
    unregisterWebhook,
    tools,
    config: resolved,
  };
}
