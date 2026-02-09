import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import { jsonResult, readStringParam } from "openclaw/plugin-sdk";
import type { NotionToolOptions } from "./shared.js";
import { notionAppendBlocks } from "../api.js";
import { markdownToNotionBlocks } from "../markdown-to-blocks.js";
import { toApiOpts, parseJsonParam } from "./shared.js";

const AppendBlocksSchema = Type.Object({
  page_id: Type.String({
    description: "The ID of the page (or block) to append children to (UUID).",
  }),
  content: Type.Optional(
    Type.String({
      description:
        "Markdown content to append. Converted to Notion blocks automatically. " +
        "Supports headings, lists, code blocks, quotes, bold, italic, links, etc. " +
        "Use this OR children, not both.",
    }),
  ),
  children: Type.Optional(
    Type.Unknown({
      description:
        "Array of raw Notion block objects to append. " +
        "Use this for precise block control; otherwise prefer the simpler 'content' parameter. " +
        'Example: [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Hello world"}}]}}]',
    }),
  ),
});

export function createNotionAppendBlocksTool(opts: NotionToolOptions): AnyAgentTool {
  return {
    label: "NotionAppendBlocks",
    name: "notion_append_blocks",
    description:
      "Append block content to a Notion page. Adds new blocks at the end of the page. " +
      "Use 'content' to pass markdown (auto-converted to blocks) or 'children' for raw block JSON.",
    parameters: AppendBlocksSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const pageId = readStringParam(params, "page_id", { required: true });
      const rawChildren = parseJsonParam(params.children);
      const markdownContent = readStringParam(params, "content");

      if (!pageId) {
        return jsonResult({ error: "page_id is required" });
      }

      // Resolve blocks: prefer raw children, fall back to markdown conversion
      let resolvedChildren: unknown[];
      if (Array.isArray(rawChildren) && rawChildren.length > 0) {
        resolvedChildren = rawChildren;
      } else if (markdownContent) {
        resolvedChildren = markdownToNotionBlocks(markdownContent);
      } else {
        return jsonResult({
          error: "Either 'content' (markdown) or 'children' (block array) is required",
        });
      }

      try {
        const result = await notionAppendBlocks(toApiOpts(opts), pageId, resolvedChildren);
        return jsonResult(result);
      } catch (error) {
        return jsonResult({
          error: `Failed to append blocks: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  };
}
