import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../agents/tools/common.js";
import type { NotionToolOptions } from "./shared.js";
import { jsonResult, readStringParam } from "../../../agents/tools/common.js";
import { notionGetPage } from "../api.js";
import { toApiOpts } from "./shared.js";

const GetPageSchema = Type.Object({
  page_id: Type.String({
    description: "The ID of the page to retrieve (UUID, with or without dashes).",
  }),
});

export function createNotionGetPageTool(opts: NotionToolOptions): AnyAgentTool {
  return {
    label: "NotionGetPage",
    name: "notion_get_page",
    description:
      "Retrieve a Notion page with all its properties (title, status, dates, etc.). " +
      "Returns the page object with metadata and property values. " +
      "Use notion_get_page_content to get the actual block content of the page.",
    parameters: GetPageSchema,
    execute: async (_toolCallId, args) => {
      try {
        const params = args as Record<string, unknown>;
        const pageId = readStringParam(params, "page_id", { required: true });

        if (!pageId) {
          return jsonResult({ error: "page_id is required" });
        }

        const result = await notionGetPage(toApiOpts(opts), pageId);
        return jsonResult(result);
      } catch (error) {
        return jsonResult({
          error: `Failed to get page: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  };
}
