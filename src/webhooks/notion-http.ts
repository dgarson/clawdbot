/**
 * Notion webhook HTTP route registry.
 *
 * Follows the same pattern as `src/slack/http/registry.ts`:
 * a module-level Map of registered handlers, checked by the gateway
 * HTTP server on every inbound request.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

export type NotionHttpRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void> | void;

type RegisterNotionHttpHandlerArgs = {
  path?: string | null;
  handler: NotionHttpRequestHandler;
  log?: (message: string) => void;
};

const notionHttpRoutes = new Map<string, NotionHttpRequestHandler>();

export const DEFAULT_NOTION_WEBHOOK_PATH = "/webhooks/notion";

function normalizeNotionWebhookPath(path?: string | null): string {
  const trimmed = path?.trim();
  if (!trimmed) {
    return DEFAULT_NOTION_WEBHOOK_PATH;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Register a Notion webhook HTTP handler at the given path.
 * Returns an unregister function.
 */
export function registerNotionHttpHandler(params: RegisterNotionHttpHandlerArgs): () => void {
  const normalizedPath = normalizeNotionWebhookPath(params.path);
  if (notionHttpRoutes.has(normalizedPath)) {
    params.log?.(`notion: webhook path ${normalizedPath} already registered`);
    return () => {};
  }
  notionHttpRoutes.set(normalizedPath, params.handler);
  params.log?.(`notion: registered webhook handler at ${normalizedPath}`);
  return () => {
    notionHttpRoutes.delete(normalizedPath);
  };
}

/**
 * Try to handle an inbound HTTP request as a Notion webhook.
 * Returns true if the request was handled, false if the path didn't match.
 *
 * Called from the gateway HTTP server request handler.
 */
export async function handleNotionHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const handler = notionHttpRoutes.get(url.pathname);
  if (!handler) {
    return false;
  }
  await handler(req, res);
  return true;
}
