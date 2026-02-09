import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../agents/tools/common.js";
import type { VaultToolsDeps } from "./types.js";
import { jsonResult, readNumberParam } from "../../agents/tools/common.js";
import { recordVaultToolCall } from "../metrics.js";
import { parseObsidianNote } from "../parser.js";
import { getNoteNameFromPath, normalizeVaultPath } from "./utils.js";

const VaultQuerySchema = Type.Object({
  filter: Type.Object({
    folder: Type.Optional(Type.String({ description: "Restrict to folder" })),
    tags: Type.Optional(Type.Array(Type.String({ description: "Require all tags" }))),
    tagsAny: Type.Optional(Type.Array(Type.String({ description: "Require any tag" }))),
    linksTo: Type.Optional(Type.String({ description: "Notes linking to this note" })),
    linkedFrom: Type.Optional(Type.String({ description: "Notes linked from this note" })),
    frontmatter: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    modifiedAfter: Type.Optional(Type.String({ description: "ISO date" })),
    modifiedBefore: Type.Optional(Type.String({ description: "ISO date" })),
    namePattern: Type.Optional(Type.String({ description: "Glob-like pattern" })),
  }),
  fields: Type.Optional(Type.Array(Type.String({ description: "Frontmatter fields to return" }))),
  limit: Type.Optional(Type.Number({ description: "Max results (default: 50)" })),
});

function matchesFrontmatter(
  frontmatter: Record<string, unknown>,
  filter?: Record<string, unknown>,
): boolean {
  if (!filter) {
    return true;
  }
  return Object.entries(filter).every(([key, value]) => frontmatter[key] === value);
}

function matchesPattern(name: string, pattern?: string): boolean {
  if (!pattern) {
    return true;
  }
  const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`, "i");
  return regex.test(name);
}

export function createVaultQueryTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Query",
    name: "vault_query",
    description: "Advanced query to find notes by tags, links, or frontmatter.",
    parameters: VaultQuerySchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const filter = (input?.filter ?? {}) as Record<string, unknown>;
      const folder =
        typeof filter.folder === "string" ? normalizeVaultPath(filter.folder) : undefined;
      const tags = Array.isArray(filter.tags)
        ? filter.tags.filter((tag) => typeof tag === "string")
        : [];
      const tagsAny = Array.isArray(filter.tagsAny)
        ? filter.tagsAny.filter((tag) => typeof tag === "string")
        : [];
      const linksTo = typeof filter.linksTo === "string" ? filter.linksTo : undefined;
      const linkedFrom = typeof filter.linkedFrom === "string" ? filter.linkedFrom : undefined;
      const frontmatterFilter =
        filter.frontmatter &&
        typeof filter.frontmatter === "object" &&
        !Array.isArray(filter.frontmatter)
          ? (filter.frontmatter as Record<string, unknown>)
          : undefined;
      const modifiedAfter =
        typeof filter.modifiedAfter === "string" ? new Date(filter.modifiedAfter) : undefined;
      const modifiedBefore =
        typeof filter.modifiedBefore === "string" ? new Date(filter.modifiedBefore) : undefined;
      const namePattern = typeof filter.namePattern === "string" ? filter.namePattern : undefined;
      const limit = readNumberParam(input ?? {}, "limit", { integer: true }) ?? 50;

      let files = await deps.vault.listFiles(folder);
      files = files.filter((file) => file.endsWith(".md"));

      if (linksTo && deps.linkIndex?.backward) {
        const backLinks = deps.linkIndex.backward.get(linksTo);
        if (backLinks) {
          files = files.filter((file) => backLinks.has(getNoteNameFromPath(file)));
        }
      }

      if (linkedFrom && deps.linkIndex?.forward) {
        const forward = deps.linkIndex.forward.get(linkedFrom);
        if (forward) {
          files = files.filter((file) => forward.has(getNoteNameFromPath(file)));
        }
      }

      const results: Array<{ path: string; frontmatter?: Record<string, unknown> }> = [];

      for (const file of files) {
        const note = await deps.vault.readFile(file);
        if (!note) {
          continue;
        }
        const noteName = getNoteNameFromPath(file);
        if (!matchesPattern(noteName, namePattern)) {
          continue;
        }
        if (modifiedAfter && note.stats.modifiedAt < modifiedAfter) {
          continue;
        }
        if (modifiedBefore && note.stats.modifiedAt > modifiedBefore) {
          continue;
        }
        if (!matchesFrontmatter(note.frontmatter, frontmatterFilter)) {
          continue;
        }

        const parsed = parseObsidianNote(note.content);
        if (tags.length > 0 && !tags.every((tag) => parsed.tags.includes(tag))) {
          continue;
        }
        if (tagsAny.length > 0 && !tagsAny.some((tag) => parsed.tags.includes(tag))) {
          continue;
        }

        results.push({
          path: file,
          frontmatter: note.frontmatter,
        });

        if (results.length >= limit) {
          break;
        }
      }

      const fields = Array.isArray(input?.fields) ? input.fields : undefined;
      const filteredResults = fields
        ? results.map((result) => ({
            path: result.path,
            frontmatter: Object.fromEntries(
              fields.map((field: string) => [field, result.frontmatter?.[field]]),
            ),
          }))
        : results;

      recordVaultToolCall("vault_query", Date.now() - start);
      return jsonResult({
        ok: true,
        tool: "vault_query",
        results: filteredResults,
      });
    },
  };
}
