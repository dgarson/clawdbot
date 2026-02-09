import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../agents/tools/common.js";
import type { NotionToolOptions } from "./shared.js";
import { jsonResult, readStringParam, readNumberParam } from "../../../agents/tools/common.js";
import { notionGetBlocks } from "../api.js";
import { toApiOpts } from "./shared.js";

const GetPageContentSchema = Type.Object({
  page_id: Type.String({
    description:
      "The ID of the page (or block) whose children to retrieve. UUID with or without dashes.",
  }),
  start_cursor: Type.Optional(
    Type.String({
      description: "Pagination cursor from a previous result.",
    }),
  ),
  page_size: Type.Optional(
    Type.Number({
      description: "Number of blocks to return (1-100). Default: 100.",
    }),
  ),
});

export function createNotionGetPageContentTool(opts: NotionToolOptions): AnyAgentTool {
  return {
    label: "NotionGetPageContent",
    name: "notion_get_page_content",
    description:
      "Get the block content (body) of a Notion page. Returns the child blocks " +
      "(paragraphs, headings, lists, code blocks, etc.). Use notion_get_page to get properties/metadata.",
    parameters: GetPageContentSchema,
    execute: async (_toolCallId, args) => {
      try {
        const params = args as Record<string, unknown>;
        const pageId = readStringParam(params, "page_id", { required: true });
        const startCursor = readStringParam(params, "start_cursor");
        const pageSize = readNumberParam(params, "page_size", { integer: true });

        if (!pageId) {
          return jsonResult({ error: "page_id is required" });
        }

        const result = await notionGetBlocks(toApiOpts(opts), pageId, {
          start_cursor: startCursor || undefined,
          page_size: Math.min(Math.max(pageSize ?? 100, 1), 100),
        });
        return jsonResult(result);
      } catch (error) {
        return jsonResult({
          error: `Failed to get page content: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  };
}
