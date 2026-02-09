import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../agents/tools/common.js";
import type { NotionToolOptions } from "./shared.js";
import { jsonResult, readStringParam, readNumberParam } from "../../../agents/tools/common.js";
import { notionSearch } from "../api.js";
import { toApiOpts } from "./shared.js";

const SearchSchema = Type.Object({
  query: Type.Optional(
    Type.String({
      description: "Search query string. If empty, returns recent pages.",
    }),
  ),
  filter_type: Type.Optional(
    Type.String({
      description: 'Filter by object type: "page" or "database". Omit to search both.',
    }),
  ),
  sort_direction: Type.Optional(
    Type.String({
      description:
        'Sort direction: "ascending" or "descending" (by last_edited_time). Default: descending.',
    }),
  ),
  page_size: Type.Optional(
    Type.Number({
      description: "Number of results to return (1-100). Default: 10.",
    }),
  ),
  start_cursor: Type.Optional(
    Type.String({
      description: "Pagination cursor from a previous search result.",
    }),
  ),
});

export function createNotionSearchTool(opts: NotionToolOptions): AnyAgentTool {
  return {
    label: "NotionSearch",
    name: "notion_search",
    description:
      "Search Notion pages and data sources (databases). Returns matching pages with titles, IDs, and URLs. " +
      "Use filter_type to narrow to 'page' or 'database' only.",
    parameters: SearchSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const query = readStringParam(params, "query");
      const filterType = readStringParam(params, "filter_type");
      const sortDirection = readStringParam(params, "sort_direction");
      const pageSize = readNumberParam(params, "page_size", { integer: true });
      const startCursor = readStringParam(params, "start_cursor");

      try {
        const result = await notionSearch(toApiOpts(opts), {
          query: query || undefined,
          filter: filterType ? { value: filterType, property: "object" } : undefined,
          sort: {
            direction: sortDirection === "ascending" ? "ascending" : "descending",
            timestamp: "last_edited_time",
          },
          page_size: Math.min(Math.max(pageSize ?? 10, 1), 100),
          start_cursor: startCursor || undefined,
        });

        return jsonResult(result);
      } catch (error) {
        return jsonResult({
          error: `Notion search failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  };
}
