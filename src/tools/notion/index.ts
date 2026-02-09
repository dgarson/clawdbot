/**
 * Notion MCP Tools
 *
 * Provides agent tools for interacting with the Notion API.
 * All tools use Notion API v2025-09-03.
 *
 * Tools:
 * - notion_search — Search pages and data sources
 * - notion_get_page — Get page with properties
 * - notion_get_page_content — Get page block content
 * - notion_create_page — Create page in database or under parent page
 * - notion_update_page — Update page properties
 * - notion_append_blocks — Add blocks to a page
 * - notion_query_database — Query a database with filters/sorts
 */

export { createNotionSearchTool } from "./tools/search.js";
export { createNotionGetPageTool } from "./tools/get-page.js";
export { createNotionGetPageContentTool } from "./tools/get-page-content.js";
export { createNotionCreatePageTool } from "./tools/create-page.js";
export { createNotionUpdatePageTool } from "./tools/update-page.js";
export { createNotionAppendBlocksTool } from "./tools/append-blocks.js";
export { createNotionQueryDatabaseTool } from "./tools/query-database.js";

export type { NotionToolOptions } from "./tools/shared.js";

import type { AnyAgentTool } from "../../agents/tools/common.js";
import type { NotionToolOptions } from "./tools/shared.js";
import { createNotionAppendBlocksTool } from "./tools/append-blocks.js";
import { createNotionCreatePageTool } from "./tools/create-page.js";
import { createNotionGetPageContentTool } from "./tools/get-page-content.js";
import { createNotionGetPageTool } from "./tools/get-page.js";
import { createNotionQueryDatabaseTool } from "./tools/query-database.js";
import { createNotionSearchTool } from "./tools/search.js";
import { createNotionUpdatePageTool } from "./tools/update-page.js";

/**
 * Create all Notion agent tools.
 *
 * @param opts - Options including the API key
 * @returns Array of all Notion agent tools
 */
export function createNotionTools(opts: NotionToolOptions): AnyAgentTool[] {
  return [
    createNotionSearchTool(opts),
    createNotionGetPageTool(opts),
    createNotionGetPageContentTool(opts),
    createNotionCreatePageTool(opts),
    createNotionUpdatePageTool(opts),
    createNotionAppendBlocksTool(opts),
    createNotionQueryDatabaseTool(opts),
  ];
}
