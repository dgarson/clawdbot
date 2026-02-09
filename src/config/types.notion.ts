/**
 * Configuration types for the Notion integration.
 *
 * The Notion integration has two axes:
 *   1. **Outbound (MCP tools):** Agent → Notion API (search, create, update, query)
 *   2. **Inbound (webhooks):** Notion → OpenClaw (page/db/comment change events)
 */

/** How a webhook event should be routed. */
export type NotionWebhookRoutingConfig = {
  /** Route content-change events to the memory ingest pipeline. Default: true. */
  memoryIngest?: boolean;
  /** Route structural-change events to session wake. Default: true. */
  sessionWake?: boolean;
  /** Inject events as system events in active sessions. Default: false. */
  systemEvent?: boolean;
  /** Minimum interval (ms) between processing events for the same entity+type. Default: 30000. */
  deduplicationWindowMs?: number;
};

/** Settings for fetching full page content when enriching webhook events. */
export type NotionContentFetchConfig = {
  /** Whether to fetch full page content on page events. Default: true. */
  enabled?: boolean;
  /** Max block recursion depth for nested blocks. Default: 3. */
  maxDepth?: number;
  /** Max pages of blocks to fetch (100 blocks/page). Default: 10. */
  maxPages?: number;
  /** Timeout for content fetch calls (ms). Default: 10000. */
  timeoutMs?: number;
};

/** Webhook receiver configuration. */
export type NotionWebhookConfig = {
  /** Path to mount the webhook handler. Default: "/webhooks/notion". */
  path?: string;
  /** HMAC verification secret (the verification_token from Notion webhook setup). */
  secret?: string;
  /** Bot user ID for self-authored event filtering (loop prevention). */
  botId?: string;
  /** Enable/disable webhook processing. Default: true. */
  enabled?: boolean;
  /** Event routing configuration. */
  routing?: NotionWebhookRoutingConfig;
  /** Content fetch settings for enriching signal-based events. */
  contentFetch?: NotionContentFetchConfig;
};

/** A designated target database for automated workflows. */
export type NotionTargetDatabase = {
  /** Database UUID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Purpose tag (e.g. "daily-journal", "task-tracker"). */
  purpose: string;
  /** Corresponding data_source_id for query operations. */
  dataSourceId?: string;
};

/** Top-level Notion integration configuration. */
export type NotionConfig = {
  /** Notion Internal Integration Token (ntn_...) or OAuth access token. */
  apiKey?: string;
  /** Path to file containing the API key (for secret managers). */
  apiKeyFile?: string;
  /** API version header. Default: "2025-09-03". */
  apiVersion?: string;
  /** Notion API base URL. Default: "https://api.notion.com". */
  baseUrl?: string;
  /** Rate limit in requests per minute. Default: 180 (Notion allows ~3/sec avg). */
  rateLimitRpm?: number;
  /** Webhook receiver configuration. */
  webhook?: NotionWebhookConfig;
  /** Target databases for automated workflows. */
  targetDatabases?: NotionTargetDatabase[];
};
