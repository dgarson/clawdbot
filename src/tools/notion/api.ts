/**
 * Notion API client helper.
 *
 * Provides a thin wrapper around the Notion REST API (v2025-09-03).
 * Used by both the MCP tools and the webhook event router.
 */

export const NOTION_API_VERSION = "2025-09-03";
export const NOTION_BASE_URL = "https://api.notion.com/v1";

export interface NotionApiOptions {
  /** Notion API key (starts with `ntn_` or `secret_`). */
  apiKey: string;
  /** Optional custom fetch function (for testing/proxying). */
  fetchFn?: typeof fetch;
}

/**
 * Low-level Notion API request helper.
 * Handles auth headers, Notion-Version, and error responses.
 */
export async function notionRequest<T = unknown>(
  opts: NotionApiOptions,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const fetchFn = opts.fetchFn ?? fetch;
  const url = path.startsWith("http") ? path : `${NOTION_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
    "Notion-Version": NOTION_API_VERSION,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetchFn(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new NotionApiError(response.status, errorBody, path);
  }

  return (await response.json()) as T;
}

export class NotionApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly path: string,
  ) {
    super(`Notion API error ${status} at ${path}: ${body.slice(0, 200)}`);
    this.name = "NotionApiError";
  }
}

// ────────────────────────── High-level Helpers ──────────────────────────

/** Search Notion pages and data sources. */
export async function notionSearch(
  opts: NotionApiOptions,
  params: {
    query?: string;
    filter?: { value: string; property: string };
    sort?: { direction: "ascending" | "descending"; timestamp: "last_edited_time" };
    start_cursor?: string;
    page_size?: number;
  },
): Promise<unknown> {
  return notionRequest(opts, "POST", "/search", params);
}

/** Retrieve a page with its properties. */
export async function notionGetPage(opts: NotionApiOptions, pageId: string): Promise<unknown> {
  return notionRequest(opts, "GET", `/pages/${pageId}`);
}

/** Retrieve blocks (content) of a page or block. */
export async function notionGetBlocks(
  opts: NotionApiOptions,
  blockId: string,
  params?: { start_cursor?: string; page_size?: number },
): Promise<unknown> {
  const qs = new URLSearchParams();
  if (params?.start_cursor) {
    qs.set("start_cursor", params.start_cursor);
  }
  if (params?.page_size) {
    qs.set("page_size", String(params.page_size));
  }
  const query = qs.toString();
  return notionRequest(opts, "GET", `/blocks/${blockId}/children${query ? `?${query}` : ""}`);
}

/** Create a page in a database or under a parent page. */
export async function notionCreatePage(
  opts: NotionApiOptions,
  params: {
    parent: { database_id: string } | { data_source_id: string } | { page_id: string };
    properties: Record<string, unknown>;
    children?: unknown[];
    icon?: unknown;
    cover?: unknown;
  },
): Promise<unknown> {
  return notionRequest(opts, "POST", "/pages", params);
}

/** Update page properties. */
export async function notionUpdatePage(
  opts: NotionApiOptions,
  pageId: string,
  params: {
    properties?: Record<string, unknown>;
    archived?: boolean;
    icon?: unknown;
    cover?: unknown;
  },
): Promise<unknown> {
  return notionRequest(opts, "PATCH", `/pages/${pageId}`, params);
}

/** Append blocks to a page or block. */
export async function notionAppendBlocks(
  opts: NotionApiOptions,
  blockId: string,
  children: unknown[],
): Promise<unknown> {
  return notionRequest(opts, "PATCH", `/blocks/${blockId}/children`, { children });
}

/** Query a database or data source with optional filters and sorts. */
export async function notionQueryDatabase(
  opts: NotionApiOptions,
  id: string,
  params?: {
    filter?: unknown;
    sorts?: unknown[];
    start_cursor?: string;
    page_size?: number;
  },
  /** When true, routes to /data_sources/{id}/query instead of /databases/{id}/query. */
  useDataSourceEndpoint?: boolean,
): Promise<unknown> {
  // In 2025-09-03, databases have both database_id and data_source_id.
  // /databases/{database_id}/query and /data_sources/{data_source_id}/query are separate endpoints.
  // The caller must specify which ID type they have to route correctly.
  const basePath = useDataSourceEndpoint ? "/data_sources" : "/databases";
  return notionRequest(opts, "POST", `${basePath}/${id}/query`, params ?? {});
}

/** Options for controlling block fetching depth and pagination. */
export interface FetchContentOptions {
  /** Safety limit to prevent runaway pagination per block level. Default: 10 (1000 blocks). */
  maxPages?: number;
  /** Max recursion depth for nested blocks. Default: 3. */
  maxDepth?: number;
}

/**
 * Fetch page content as a simple text representation.
 * Used by the webhook event router to ingest page content into memory.
 *
 * - Paginates through all blocks (Notion returns max 100 per request)
 * - Recursively fetches child blocks (toggles, callouts, columns, etc.)
 */
export async function fetchPageContentAsText(
  opts: NotionApiOptions,
  pageId: string,
  maxPagesOrOpts: number | FetchContentOptions = 10,
): Promise<string> {
  const fetchOpts: FetchContentOptions =
    typeof maxPagesOrOpts === "number" ? { maxPages: maxPagesOrOpts } : maxPagesOrOpts;
  const maxPages = fetchOpts.maxPages ?? 10;
  const maxDepth = fetchOpts.maxDepth ?? 3;

  // Get page properties
  const page = (await notionGetPage(opts, pageId)) as {
    properties?: Record<string, unknown>;
    url?: string;
  };

  const parts: string[] = [];

  // Extract title from properties
  const title = extractPageTitle(page.properties);
  if (title) {
    parts.push(`# ${title}`);
  }

  // Recursively fetch and flatten all blocks
  const blockTexts = await fetchBlocksRecursive(opts, pageId, 0, maxDepth, maxPages);
  parts.push(...blockTexts);

  return parts.join("\n\n");
}

/**
 * Recursively fetch blocks and their children, returning flattened text.
 * Child blocks are indented with 2 spaces per depth level.
 */
async function fetchBlocksRecursive(
  opts: NotionApiOptions,
  blockId: string,
  depth: number,
  maxDepth: number,
  maxPages: number,
): Promise<string[]> {
  const parts: string[] = [];
  const indent = "  ".repeat(depth);

  let cursor: string | undefined;
  let pageCount = 0;
  do {
    const response = (await notionGetBlocks(opts, blockId, {
      page_size: 100,
      start_cursor: cursor,
    })) as {
      results?: Array<Record<string, unknown>>;
      has_more?: boolean;
      next_cursor?: string | null;
    };

    if (response.results) {
      for (const block of response.results) {
        const text = extractBlockText(block);
        if (text) {
          parts.push(depth > 0 ? `${indent}${text}` : text);
        }

        // Recurse into child blocks if present and within depth limit
        const hasChildren = (block as { has_children?: boolean }).has_children;
        const childBlockId = (block as { id?: string }).id;
        if (hasChildren && childBlockId && depth < maxDepth) {
          const childTexts = await fetchBlocksRecursive(
            opts,
            childBlockId,
            depth + 1,
            maxDepth,
            maxPages,
          );
          parts.push(...childTexts);
        }
      }
    }

    cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    pageCount++;
  } while (cursor && pageCount < maxPages);

  return parts;
}

/** Extract the title from page properties. */
function extractPageTitle(properties: Record<string, unknown> | undefined): string | null {
  if (!properties) {
    return null;
  }
  for (const value of Object.values(properties)) {
    const prop = value as { type?: string; title?: Array<{ plain_text?: string }> };
    if (prop.type === "title" && Array.isArray(prop.title)) {
      return prop.title.map((t) => t.plain_text ?? "").join("");
    }
  }
  return null;
}

/** Extract text content from a block. */
function extractBlockText(block: Record<string, unknown>): string | null {
  const type = block.type as string | undefined;
  if (!type) {
    return null;
  }

  // Handle block types that don't use rich_text first
  switch (type) {
    case "divider":
      return "---";
    case "image": {
      const img = block.image as
        | {
            type?: string;
            external?: { url?: string };
            file?: { url?: string };
            caption?: Array<{ plain_text?: string }>;
          }
        | undefined;
      const url = img?.type === "external" ? img.external?.url : img?.file?.url;
      const caption = img?.caption?.map((t) => t.plain_text ?? "").join("") ?? "";
      return url ? `![${caption}](${url})` : caption || null;
    }
    case "bookmark": {
      const bm = block.bookmark as
        | { url?: string; caption?: Array<{ plain_text?: string }> }
        | undefined;
      const caption = bm?.caption?.map((t) => t.plain_text ?? "").join("") ?? "";
      return bm?.url ? `[${caption || bm.url}](${bm.url})` : null;
    }
    case "child_page": {
      const cp = block.child_page as { title?: string } | undefined;
      return cp?.title ? `📄 ${cp.title}` : null;
    }
    case "child_database": {
      const cd = block.child_database as { title?: string } | undefined;
      return cd?.title ? `🗄️ ${cd.title}` : null;
    }
    case "embed": {
      const em = block.embed as { url?: string } | undefined;
      return em?.url ? `[Embed](${em.url})` : null;
    }
    case "equation": {
      const eq = block.equation as { expression?: string } | undefined;
      return eq?.expression ? `$$${eq.expression}$$` : null;
    }
  }

  // Handle block types that use rich_text
  const content = block[type] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
  if (!content?.rich_text) {
    return null;
  }

  const text = content.rich_text.map((t) => t.plain_text ?? "").join("");

  switch (type) {
    case "heading_1":
      return `# ${text}`;
    case "heading_2":
      return `## ${text}`;
    case "heading_3":
      return `### ${text}`;
    case "bulleted_list_item":
      return `- ${text}`;
    case "numbered_list_item":
      return `1. ${text}`;
    case "to_do": {
      const checked = (block[type] as { checked?: boolean }).checked;
      return `${checked ? "[x]" : "[ ]"} ${text}`;
    }
    case "toggle":
      return `▸ ${text}`;
    case "quote":
      return `> ${text}`;
    case "callout":
      return `💡 ${text}`;
    case "code": {
      const lang = (block[type] as { language?: string }).language ?? "";
      return `\`\`\`${lang}\n${text}\n\`\`\``;
    }
    default:
      return text || null;
  }
}
