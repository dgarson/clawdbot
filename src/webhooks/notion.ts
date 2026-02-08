/**
 * Notion Inbound Webhook Handler
 *
 * Receives webhook events from Notion when pages/databases/comments change.
 * Implements:
 * - Verification flow (initial subscription handshake)
 * - HMAC-SHA256 signature validation (X-Notion-Signature header)
 * - Self-authored event filtering (loop prevention)
 * - Event routing to memory ingest / session wake / system events
 *
 * @see https://developers.notion.com/reference/webhooks
 * @see https://developers.notion.com/reference/webhooks-events-delivery
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";

// ────────────────────────────── Types ──────────────────────────────

/** All Notion webhook event type strings (2025-09-03 API version). */
export type NotionWebhookEventType =
  // Page events
  | "page.created"
  | "page.content_updated"
  | "page.properties_updated"
  | "page.moved"
  | "page.deleted"
  | "page.undeleted"
  | "page.locked"
  | "page.unlocked"
  // Database events (some deprecated in 2025-09-03)
  | "database.created"
  | "database.content_updated"
  | "database.deleted"
  | "database.moved"
  | "database.undeleted"
  | "database.schema_updated"
  // Data source events (new in 2025-09-03)
  | "data_source.created"
  | "data_source.content_updated"
  | "data_source.deleted"
  | "data_source.moved"
  | "data_source.schema_updated"
  | "data_source.undeleted"
  // Comment events
  | "comment.created"
  | "comment.deleted"
  | "comment.updated";

export interface NotionWebhookAuthor {
  id: string;
  type: "person" | "bot" | "agent";
}

export interface NotionWebhookEntity {
  id: string;
  type: "page" | "block" | "database";
}

/** Normalized event envelope from a parsed Notion webhook payload. */
export interface NotionWebhookEvent {
  /** The raw HTTP body string (useful for re-verification). */
  rawBody: string;
  /** Parsed JSON body. */
  body: Record<string, unknown>;
  /** Unique event ID from Notion. */
  id?: string;
  /** Event type, e.g. "page.created". */
  type?: NotionWebhookEventType;
  /** ISO 8601 timestamp of the event. */
  timestamp?: string;
  /** Workspace where the event originated. */
  workspaceId?: string;
  /** Webhook subscription that generated this event. */
  subscriptionId?: string;
  /** Integration ID associated with the subscription. */
  integrationId?: string;
  /** The entity that triggered the event. */
  entity?: NotionWebhookEntity;
  /** Authors who performed the action. */
  authors?: NotionWebhookAuthor[];
  /** Additional event-specific data. */
  data?: Record<string, unknown>;
  /** Delivery attempt number (1-8). */
  attemptNumber?: number;
}

export interface NotionWebhookHandlerOptions {
  /** Webhook secret for HMAC-SHA256 validation (the verification_token received during setup). */
  secret?: string;
  /** Notion bot/user id — events authored by this id are silently dropped (loop prevention). */
  botId?: string;
  /** Callback invoked asynchronously after the 200 has been sent back to Notion. */
  onEvent?: (event: NotionWebhookEvent) => Promise<void>;
  /** Optional logger. */
  log?: (msg: string) => void;
}

// ────────────────────────── Request Handler ──────────────────────────

/**
 * Creates an HTTP request handler for the Notion webhook endpoint.
 *
 * The handler:
 * 1. Only accepts POST requests
 * 2. Responds to verification_token payloads (subscription handshake)
 * 3. Validates X-Notion-Signature HMAC-SHA256 when secret is configured
 * 4. Filters out self-authored events (loop prevention)
 * 5. Acks immediately, then calls onEvent asynchronously
 */
export function createNotionWebhookHandler(options: NotionWebhookHandlerOptions) {
  const { secret, botId, onEvent, log } = options;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      // Only POST allowed
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Allow", "POST");
        res.end();
        return;
      }

      const rawBody = await readRequestBody(req);
      const parsed = safeJsonParse(rawBody);

      if (!parsed || typeof parsed !== "object") {
        sendJson(res, 400, { error: "Invalid JSON" });
        return;
      }

      const body = parsed as Record<string, unknown>;

      // ── Verification flow ──
      // Notion sends { verification_token: "..." } once during subscription creation.
      // We must echo it back to prove the endpoint is ours.
      if (typeof body.verification_token === "string") {
        log?.(`notion webhook: verification request received`);
        sendJson(res, 200, { verification_token: body.verification_token });
        return;
      }

      // ── Signature validation ──
      if (secret) {
        const signatureHeader = req.headers["x-notion-signature"];
        const signature = typeof signatureHeader === "string" ? signatureHeader : undefined;

        if (!signature) {
          sendJson(res, 400, { error: "Missing X-Notion-Signature header" });
          return;
        }
        if (!validateNotionSignature(rawBody, signature, secret)) {
          sendJson(res, 401, { error: "Invalid signature" });
          return;
        }
      }

      // ── Parse event envelope ──
      const event = parseNotionEvent(rawBody, body);

      // ── Quick ack — Notion expects a fast 200 ──
      sendJson(res, 200, { status: "ok" });

      // ── Loop prevention ──
      if (botId && event.authors?.some((a) => a.id === botId)) {
        log?.(`notion webhook: skipping self-authored event (type=${event.type ?? "unknown"})`);
        return;
      }

      log?.(
        `notion webhook: received ${event.type ?? "unknown"} for ${event.entity?.type ?? "?"}:${event.entity?.id ?? "?"}`,
      );

      // ── Dispatch ──
      if (onEvent) {
        await onEvent(event).catch((err) => {
          log?.(`notion webhook: onEvent failed: ${String(err)}`);
        });
      }
    } catch (err) {
      log?.(`notion webhook: error: ${String(err)}`);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error" });
      }
    }
  };
}

// ────────────────────────── Event Parsing ──────────────────────────

function parseNotionEvent(rawBody: string, body: Record<string, unknown>): NotionWebhookEvent {
  const entity = body.entity as { id?: string; type?: string } | undefined;
  const authors = body.authors as Array<{ id?: string; type?: string }> | undefined;

  return {
    rawBody,
    body,
    id: typeof body.id === "string" ? body.id : undefined,
    type: typeof body.type === "string" ? (body.type as NotionWebhookEventType) : undefined,
    timestamp: typeof body.timestamp === "string" ? body.timestamp : undefined,
    workspaceId: typeof body.workspace_id === "string" ? body.workspace_id : undefined,
    subscriptionId: typeof body.subscription_id === "string" ? body.subscription_id : undefined,
    integrationId: typeof body.integration_id === "string" ? body.integration_id : undefined,
    entity:
      entity && typeof entity.id === "string" && typeof entity.type === "string"
        ? (entity as NotionWebhookEntity)
        : undefined,
    authors: Array.isArray(authors)
      ? authors.filter(
          (a): a is NotionWebhookAuthor => typeof a?.id === "string" && typeof a?.type === "string",
        )
      : undefined,
    data:
      typeof body.data === "object" && body.data !== null
        ? (body.data as Record<string, unknown>)
        : undefined,
    attemptNumber: typeof body.attempt_number === "number" ? body.attempt_number : undefined,
  };
}

// ────────────────────────── Signature ──────────────────────────

/**
 * Validates the HMAC-SHA256 signature from the `X-Notion-Signature` header.
 * Format: `sha256=<hex>`
 */
export function validateNotionSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature.startsWith("sha256=")) {
    return false;
  }
  const theirHex = signature.slice("sha256=".length);
  if (!/^[0-9a-f]+$/i.test(theirHex)) {
    return false;
  }
  const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const ourSig = `sha256=${computed}`;
  // timingSafeEqual requires equal-length buffers
  const a = Buffer.from(ourSig);
  const b = Buffer.from(signature);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

// ────────────────────────── Event Router ──────────────────────────

/** Categories for routing webhook events to different processing pipelines. */
export type NotionEventCategory = "memory" | "wake" | "system" | "ignore";

/**
 * Categorise a Notion webhook event to determine how it should be routed.
 *
 * - "memory": Content changes → ingest into the memory pipeline
 * - "wake": Important structural changes → wake the agent session
 * - "system": Administrative events → log as system events
 * - "ignore": No action needed (e.g. lock/unlock)
 */
export function categoriseNotionEvent(
  type: NotionWebhookEventType | undefined,
): NotionEventCategory {
  if (!type) return "ignore";

  // Content changes → memory ingest
  if (
    type === "page.created" ||
    type === "page.content_updated" ||
    type === "page.properties_updated" ||
    type === "database.content_updated" ||
    type === "data_source.content_updated" ||
    type === "comment.created" ||
    type === "comment.updated"
  ) {
    return "memory";
  }

  // Structural changes → session wake
  if (
    type === "page.moved" ||
    type === "page.deleted" ||
    type === "page.undeleted" ||
    type === "database.created" ||
    type === "database.deleted" ||
    type === "database.moved" ||
    type === "database.undeleted" ||
    type === "database.schema_updated" ||
    type === "data_source.created" ||
    type === "data_source.deleted" ||
    type === "data_source.moved" ||
    type === "data_source.schema_updated" ||
    type === "data_source.undeleted"
  ) {
    return "wake";
  }

  // Lock/unlock, comment deletion → system log
  if (type === "page.locked" || type === "page.unlocked" || type === "comment.deleted") {
    return "system";
  }

  return "ignore";
}

/**
 * Creates a default `onEvent` handler that routes events based on their category.
 * This ties the webhook into the OpenClaw runtime:
 * - Memory events → memory ingest pipeline
 * - Wake events → session wake
 * - System events → structured log
 */
export function createNotionEventRouter(deps: {
  /** Ingest content into memory. Called with a text summary and optional metadata. */
  ingestMemory?: (params: {
    text: string;
    source: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  /** Wake the agent session with a text payload. */
  wakeSession?: (params: { text: string; mode: "now" | "next-heartbeat" }) => void;
  /** Log a system event. */
  logSystem?: (msg: string) => void;
  /** Fetch page content from Notion API for memory ingest. */
  fetchPageContent?: (pageId: string) => Promise<string | null>;
  log?: (msg: string) => void;
}): (event: NotionWebhookEvent) => Promise<void> {
  return async (event: NotionWebhookEvent) => {
    const category = categoriseNotionEvent(event.type);
    const entityDesc = `${event.entity?.type ?? "unknown"}:${event.entity?.id ?? "?"}`;

    switch (category) {
      case "memory": {
        let content: string | null = null;

        // For page content events, try to fetch the actual content
        if (event.entity?.type === "page" && event.entity?.id && deps.fetchPageContent) {
          try {
            content = await deps.fetchPageContent(event.entity.id);
          } catch (err) {
            deps.log?.(
              `notion webhook: failed to fetch page content for ${event.entity.id}: ${String(err)}`,
            );
          }
        }

        const summary = content
          ? `Notion ${event.type}: ${entityDesc}\n\n${content}`
          : `Notion ${event.type}: ${entityDesc}`;

        if (deps.ingestMemory) {
          await deps.ingestMemory({
            text: summary,
            source: "notion-webhook",
            metadata: {
              notionEventType: event.type,
              notionEntityId: event.entity?.id,
              notionEntityType: event.entity?.type,
              notionTimestamp: event.timestamp,
              notionWorkspaceId: event.workspaceId,
            },
          });
        }
        break;
      }

      case "wake": {
        const message = `Notion structural change: ${event.type} on ${entityDesc}`;
        deps.wakeSession?.({ text: message, mode: "next-heartbeat" });
        deps.logSystem?.(`[notion-webhook] ${message}`);
        break;
      }

      case "system": {
        deps.logSystem?.(`[notion-webhook] ${event.type}: ${entityDesc}`);
        break;
      }

      case "ignore":
      default:
        break;
    }
  };
}

// ────────────────────────── Route Registration ──────────────────────────

/** Default webhook path for Notion. */
export const NOTION_WEBHOOK_PATH = "/webhooks/notion";

/**
 * Register the Notion webhook handler with the plugin HTTP route registry.
 *
 * Call this during gateway startup to mount `/webhooks/notion` in the
 * gateway HTTP server (plugs into the same pipeline as other plugin routes).
 */
export function registerNotionWebhookRoute(params: {
  registerHttpRoute: (opts: {
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;
    pluginId: string;
    source: string;
  }) => () => void;
  secret?: string;
  botId?: string;
  onEvent?: (event: NotionWebhookEvent) => Promise<void>;
  path?: string;
  log?: (msg: string) => void;
}): () => void {
  const handler = createNotionWebhookHandler({
    secret: params.secret,
    botId: params.botId,
    onEvent: params.onEvent,
    log: params.log,
  });

  const path = params.path ?? NOTION_WEBHOOK_PATH;
  params.log?.(`notion webhook: registering route at ${path}`);

  return params.registerHttpRoute({
    path,
    handler,
    pluginId: "notion-webhook",
    source: "notion-webhook",
  });
}

// ────────────────────────── Helpers ──────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}
