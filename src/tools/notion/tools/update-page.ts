import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../agents/tools/common.js";
import type { NotionToolOptions } from "./shared.js";
import { jsonResult, readStringParam } from "../../../agents/tools/common.js";
import { notionUpdatePage } from "../api.js";
import { toApiOpts, parseJsonParam } from "./shared.js";

const UpdatePageSchema = Type.Object({
  page_id: Type.String({
    description: "The ID of the page to update (UUID).",
  }),
  properties: Type.Optional(
    Type.Unknown({
      description:
        "Properties to update as a JSON object. Only include properties you want to change. " +
        'Example: {"Status": {"select": {"name": "Done"}}, "Priority": {"number": 1}}',
    }),
  ),
  archived: Type.Optional(
    Type.Boolean({
      description: "Set to true to archive (trash) the page, false to restore it.",
    }),
  ),
  icon: Type.Optional(
    Type.Unknown({
      description: 'Optional icon update. Example: {"emoji": "✅"}',
    }),
  ),
  cover: Type.Optional(
    Type.Unknown({
      description: 'Optional cover image update. Example: {"external": {"url": "https://..."}}',
    }),
  ),
});

export function createNotionUpdatePageTool(opts: NotionToolOptions): AnyAgentTool {
  return {
    label: "NotionUpdatePage",
    name: "notion_update_page",
    description:
      "Update a Notion page's properties, icon, cover, or archive status. " +
      "Only include the properties you want to change — others remain untouched.",
    parameters: UpdatePageSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const pageId = readStringParam(params, "page_id", { required: true });
      const properties = parseJsonParam(params.properties);
      const archived = params.archived;
      const icon = parseJsonParam(params.icon);
      const cover = parseJsonParam(params.cover);

      if (!pageId) {
        return jsonResult({ error: "page_id is required" });
      }

      const updateParams: Record<string, unknown> = {};
      if (properties && typeof properties === "object") {
        updateParams.properties = properties;
      }
      if (typeof archived === "boolean") {
        updateParams.archived = archived;
      }
      if (icon) {
        updateParams.icon = icon;
      }
      if (cover) {
        updateParams.cover = cover;
      }

      if (Object.keys(updateParams).length === 0) {
        return jsonResult({
          error: "At least one field to update is required (properties, archived, icon, cover)",
        });
      }

      try {
        const params = args as Record<string, unknown>;
        const pageId = readStringParam(params, "page_id", { required: true });
        const properties = parseJsonParam(params.properties);
        const archived = params.archived;
        const icon = parseJsonParam(params.icon);
        const cover = parseJsonParam(params.cover);

        if (!pageId) {
          return jsonResult({ error: "page_id is required" });
        }

        const updateParams: Record<string, unknown> = {};
        if (properties && typeof properties === "object") {
          updateParams.properties = properties;
        }
        if (typeof archived === "boolean") {
          updateParams.archived = archived;
        }
        if (icon) updateParams.icon = icon;
        if (cover) updateParams.cover = cover;

        if (Object.keys(updateParams).length === 0) {
          return jsonResult({
            error: "At least one field to update is required (properties, archived, icon, cover)",
          });
        }

        const result = await notionUpdatePage(toApiOpts(opts), pageId, updateParams);
        return jsonResult(result);
      } catch (error) {
        return jsonResult({
          error: `Failed to update page: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  };
}
