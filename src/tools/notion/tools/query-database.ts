import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../agents/tools/common.js";
import type { NotionToolOptions } from "./shared.js";
import { jsonResult, readStringParam, readNumberParam } from "../../../agents/tools/common.js";
import { notionQueryDatabase } from "../api.js";
import { toApiOpts, parseJsonParam } from "./shared.js";

const QueryDatabaseSchema = Type.Object({
  database_id: Type.Optional(
    Type.String({
      description:
        "The database ID to query (UUID). Uses /databases/{id}/query endpoint. " +
        "Provide either database_id or data_source_id, not both.",
    }),
  ),
  data_source_id: Type.Optional(
    Type.String({
      description:
        "The data source ID to query (UUID). Uses /data_sources/{id}/query endpoint (preferred for API v2025-09-03). " +
        "Provide either database_id or data_source_id, not both.",
    }),
  ),
  filter: Type.Optional(
    Type.Unknown({
      description:
        "Optional filter object. Supports compound filters (and/or) and property filters. " +
        'Example: {"property": "Status", "select": {"equals": "Active"}}',
    }),
  ),
  sorts: Type.Optional(
    Type.Unknown({
      description:
        "Optional array of sort objects. " +
        'Example: [{"property": "Date", "direction": "descending"}]',
    }),
  ),
  page_size: Type.Optional(
    Type.Number({
      description: "Number of results to return (1-100). Default: 100.",
    }),
  ),
  start_cursor: Type.Optional(
    Type.String({
      description: "Pagination cursor from a previous query result.",
    }),
  ),
});

export function createNotionQueryDatabaseTool(opts: NotionToolOptions): AnyAgentTool {
  return {
    label: "NotionQueryDatabase",
    name: "notion_query_database",
    description:
      "Query a Notion database with optional filters and sorts. Returns matching pages (rows) " +
      "with their properties. Accepts either a database_id (legacy) or data_source_id (preferred " +
      "for v2025-09-03). Use notion_search first to find the ID if you don't have it.",
    parameters: QueryDatabaseSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const databaseId = readStringParam(params, "database_id");
      const dataSourceId = readStringParam(params, "data_source_id");
      const filter = parseJsonParam(params.filter);
      const sorts = parseJsonParam(params.sorts);
      const pageSize = readNumberParam(params, "page_size", { integer: true });
      const startCursor = readStringParam(params, "start_cursor");

      if (!databaseId && !dataSourceId) {
        return jsonResult({ error: "Either database_id or data_source_id is required" });
      }

      // Prefer data_source_id; route to the matching endpoint
      const id = dataSourceId ?? databaseId!;
      const useDataSourceEndpoint = !!dataSourceId;

      try {
        const result = await notionQueryDatabase(
          toApiOpts(opts),
          id,
          {
            filter: filter ?? undefined,
            sorts: Array.isArray(sorts) ? sorts : undefined,
            page_size: Math.min(Math.max(pageSize ?? 100, 1), 100),
            start_cursor: startCursor || undefined,
          },
          useDataSourceEndpoint,
        );
        return jsonResult(result);
      } catch (error) {
        return jsonResult({
          error: `Failed to query database: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  };
}
