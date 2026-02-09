import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../agents/tools/common.js";
import type { NotionToolOptions } from "./shared.js";
import { jsonResult, readStringParam } from "../../../agents/tools/common.js";
import { notionCreatePage } from "../api.js";
import { markdownToNotionBlocks } from "../markdown-to-blocks.js";
import { toApiOpts, parseJsonParam } from "./shared.js";

const CreatePageSchema = Type.Object({
  parent_type: Type.String({
    description:
      'Parent type: "database" to create a row in a database, "data_source" to create a row using a ' +
      'data source ID (preferred for v2025-09-03), or "page" to create a sub-page.',
  }),
  parent_id: Type.String({
    description: "The ID of the parent database, data source, or page (UUID).",
  }),
  properties: Type.Unknown({
    description:
      "Page properties as a JSON object. For database pages, must match the database schema. " +
      'Example: {"Name": {"title": [{"text": {"content": "My Page"}}]}, "Status": {"select": {"name": "Todo"}}}',
  }),
  content: Type.Optional(
    Type.String({
      description:
        "Optional markdown content for the page body. Converted to Notion blocks automatically. " +
        "Supports headings, lists, code blocks, quotes, bold, italic, links, etc. " +
        "Use this OR children, not both.",
    }),
  ),
  children: Type.Optional(
    Type.Unknown({
      description:
        "Optional array of raw Notion block objects to add as page content. " +
        "Use this for precise block control; otherwise prefer the simpler 'content' parameter. " +
        'Example: [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Hello"}}]}}]',
    }),
  ),
  icon: Type.Optional(
    Type.Unknown({
      description:
        'Optional icon object. Example: {"emoji": "🚀"} or {"external": {"url": "https://..."}}',
    }),
  ),
  cover: Type.Optional(
    Type.Unknown({
      description: 'Optional cover image. Example: {"external": {"url": "https://..."}}',
    }),
  ),
});

export function createNotionCreatePageTool(opts: NotionToolOptions): AnyAgentTool {
  return {
    label: "NotionCreatePage",
    name: "notion_create_page",
    description:
      "Create a new Notion page. Can create a page inside a database (as a new row) " +
      "or as a child of another page. Provide properties matching the parent's schema. " +
      "Use 'content' to pass markdown that is auto-converted to Notion blocks.",
    parameters: CreatePageSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const parentType = readStringParam(params, "parent_type", { required: true });
      const parentId = readStringParam(params, "parent_id", { required: true });
      const properties = parseJsonParam(params.properties);
      const children = parseJsonParam(params.children);
      const markdownContent = readStringParam(params, "content");
      const icon = parseJsonParam(params.icon);
      const cover = parseJsonParam(params.cover);

      if (!parentType || !parentId) {
        return jsonResult({ error: "parent_type and parent_id are required" });
      }

      if (!properties || typeof properties !== "object") {
        return jsonResult({ error: "properties must be a valid JSON object" });
      }

      let parent: { data_source_id: string } | { database_id: string } | { page_id: string };
      if (parentType === "data_source") {
        parent = { data_source_id: parentId };
      } else if (parentType === "database") {
        parent = { database_id: parentId };
      } else {
        parent = { page_id: parentId };
      }

      // Resolve children: prefer raw children, fall back to markdown conversion
      let resolvedChildren: unknown[] | undefined;
      if (Array.isArray(children)) {
        resolvedChildren = children;
      } else if (markdownContent) {
        resolvedChildren = markdownToNotionBlocks(markdownContent);
      }

      try {
        const params = args as Record<string, unknown>;
        const parentType = readStringParam(params, "parent_type", { required: true });
        const parentId = readStringParam(params, "parent_id", { required: true });
        const properties = parseJsonParam(params.properties);
        const children = parseJsonParam(params.children);
        const icon = parseJsonParam(params.icon);
        const cover = parseJsonParam(params.cover);

        if (!parentType || !parentId) {
          return jsonResult({ error: "parent_type and parent_id are required" });
        }

        if (!properties || typeof properties !== "object") {
          return jsonResult({ error: "properties must be a valid JSON object" });
        }

        const parent =
          parentType === "database" ? { database_id: parentId } : { page_id: parentId };

        const result = await notionCreatePage(toApiOpts(opts), {
          parent,
          properties: properties as Record<string, unknown>,
          children: resolvedChildren,
          icon: icon ?? undefined,
          cover: cover ?? undefined,
        });
        return jsonResult(result);
      } catch (error) {
        return jsonResult({
          error: `Failed to create page: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  };
}
