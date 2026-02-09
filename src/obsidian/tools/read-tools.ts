import { Type } from "@sinclair/typebox";
import path from "node:path";
import type { AnyAgentTool } from "../../agents/tools/common.js";
import type { VaultToolsDeps } from "./types.js";
import {
  jsonResult,
  readNumberParam,
  readStringArrayParam,
  readStringParam,
} from "../../agents/tools/common.js";
import { recordVaultToolCall } from "../metrics.js";
import { parseObsidianNote } from "../parser.js";
import { getNoteNameFromPath, normalizeVaultPath } from "./utils.js";

const VaultSearchSchema = Type.Object({
  query: Type.String({ description: "Search query (full-text)" }),
  folder: Type.Optional(Type.String({ description: "Restrict search to this folder" })),
  limit: Type.Optional(Type.Number({ description: "Max results (default: 20)" })),
  tags: Type.Optional(Type.Array(Type.String({ description: "Filter by tags" }))),
});

const VaultReadSchema = Type.Object({
  path: Type.String({ description: "Relative path to the note" }),
});

const VaultListSchema = Type.Object({
  folder: Type.Optional(Type.String({ description: "Restrict listing to this folder" })),
  recursive: Type.Optional(Type.Boolean({ description: "List recursively (default: true)" })),
  pattern: Type.Optional(Type.String({ description: "Glob pattern to filter results" })),
});

const VaultFrontmatterSchema = Type.Object({
  path: Type.String({ description: "Relative path to the note" }),
});

const VaultLinksSchema = Type.Object({
  path: Type.String({ description: "Relative path to the note" }),
});

const VaultBacklinksSchema = Type.Object({
  noteName: Type.String({ description: "Note name without extension" }),
});

const VaultTagsSchema = Type.Object({
  path: Type.Optional(Type.String({ description: "Optional note path to scope tags" })),
});

export function createVaultSearchTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Search",
    name: "vault_search",
    description:
      "Search for content across notes in the Obsidian vault. Returns matching notes with excerpts.",
    parameters: VaultSearchSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const query = readStringParam(input ?? {}, "query", { required: true, label: "query" });
      const folder = readStringParam(input ?? {}, "folder");
      const limit = readNumberParam(input ?? {}, "limit", { integer: true });
      const tags = readStringArrayParam(input ?? {}, "tags");

      const results = await deps.vault.search(query, {
        folder: folder ? normalizeVaultPath(folder) : undefined,
        limit: limit ?? 20,
      });

      const filtered = tags?.length
        ? (
            await Promise.all(
              results.map(async (result) => {
                const note = await deps.vault.readFile(result.path);
                if (!note) {
                  return null;
                }
                const parsed = parseObsidianNote(note.content);
                const hasAll = tags.every((tag) => parsed.tags.includes(tag));
                return hasAll ? result : null;
              }),
            )
          ).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        : results;

      recordVaultToolCall("vault_search", Date.now() - start);
      return jsonResult({
        ok: true,
        tool: "vault_search",
        query,
        results: filtered,
      });
    },
  };
}

export function createVaultReadNoteTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Read Note",
    name: "vault_read_note",
    description: "Read a note's content (markdown + frontmatter).",
    parameters: VaultReadSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const rawPath = readStringParam(input ?? {}, "path", { required: true, label: "path" });
      const note = await deps.vault.readFile(normalizeVaultPath(rawPath));
      recordVaultToolCall("vault_read_note", Date.now() - start);
      return jsonResult({
        ok: Boolean(note),
        tool: "vault_read_note",
        note,
      });
    },
  };
}

export function createVaultListNotesTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault List Notes",
    name: "vault_list_notes",
    description: "List notes in a folder or the entire vault.",
    parameters: VaultListSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const folder = readStringParam(input ?? {}, "folder");
      const recursive = typeof input?.recursive === "boolean" ? input?.recursive : true;
      const pattern = readStringParam(input ?? {}, "pattern");

      const normalizedFolder = folder ? normalizeVaultPath(folder) : undefined;
      let files = await deps.vault.listFiles(normalizedFolder);
      if (!recursive) {
        files = files.filter((file) => {
          if (!normalizedFolder) {
            return !file.replace(/^\//, "").includes("/");
          }
          const relative = path.relative(normalizedFolder, file);
          return !relative.includes(path.sep);
        });
      }
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        files = files.filter((file) => regex.test(file));
      }
      recordVaultToolCall("vault_list_notes", Date.now() - start);
      return jsonResult({
        ok: true,
        tool: "vault_list_notes",
        files,
      });
    },
  };
}

export function createVaultGetFrontmatterTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Get Frontmatter",
    name: "vault_get_frontmatter",
    description: "Get YAML frontmatter for a note.",
    parameters: VaultFrontmatterSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const rawPath = readStringParam(input ?? {}, "path", { required: true, label: "path" });
      const note = await deps.vault.readFile(normalizeVaultPath(rawPath));
      recordVaultToolCall("vault_get_frontmatter", Date.now() - start);
      return jsonResult({
        ok: Boolean(note),
        tool: "vault_get_frontmatter",
        frontmatter: note?.frontmatter ?? null,
      });
    },
  };
}

export function createVaultGetLinksTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Get Links",
    name: "vault_get_links",
    description: "Get all outgoing wiki-links from a note.",
    parameters: VaultLinksSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const rawPath = readStringParam(input ?? {}, "path", { required: true, label: "path" });
      const note = await deps.vault.readFile(normalizeVaultPath(rawPath));
      const links = note ? parseObsidianNote(note.content).wikiLinks : [];
      recordVaultToolCall("vault_get_links", Date.now() - start);
      return jsonResult({
        ok: Boolean(note),
        tool: "vault_get_links",
        links,
      });
    },
  };
}

export function createVaultGetBacklinksTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Get Backlinks",
    name: "vault_get_backlinks",
    description: "Find all notes that link to the specified note.",
    parameters: VaultBacklinksSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const noteName = readStringParam(input ?? {}, "noteName", {
        required: true,
        label: "noteName",
      });
      const normalized = noteName.trim();

      if (deps.linkIndex) {
        const backlinks = Array.from(deps.linkIndex.backward.get(normalized) ?? []);
        recordVaultToolCall("vault_get_backlinks", Date.now() - start);
        return jsonResult({
          ok: true,
          tool: "vault_get_backlinks",
          noteName: normalized,
          backlinks,
        });
      }

      const files = await deps.vault.listFiles();
      const backlinks: string[] = [];
      for (const file of files) {
        if (!file.endsWith(".md")) {
          continue;
        }
        const note = await deps.vault.readFile(file);
        if (!note) {
          continue;
        }
        const parsed = parseObsidianNote(note.content);
        if (parsed.wikiLinks.some((link) => link.target === normalized)) {
          backlinks.push(getNoteNameFromPath(file));
        }
      }

      recordVaultToolCall("vault_get_backlinks", Date.now() - start);
      return jsonResult({
        ok: true,
        tool: "vault_get_backlinks",
        noteName: normalized,
        backlinks,
      });
    },
  };
}

export function createVaultGetTagsTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Get Tags",
    name: "vault_get_tags",
    description: "Get tags used in a note or across the vault.",
    parameters: VaultTagsSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const rawPath = readStringParam(input ?? {}, "path");

      if (rawPath) {
        const note = await deps.vault.readFile(normalizeVaultPath(rawPath));
        const tags = note ? parseObsidianNote(note.content).tags : [];
        recordVaultToolCall("vault_get_tags", Date.now() - start);
        return jsonResult({ ok: Boolean(note), tool: "vault_get_tags", tags });
      }

      if (deps.linkIndex?.tags) {
        recordVaultToolCall("vault_get_tags", Date.now() - start);
        return jsonResult({
          ok: true,
          tool: "vault_get_tags",
          tags: Array.from(deps.linkIndex.tags.keys()),
        });
      }

      const files = await deps.vault.listFiles();
      const tags = new Set<string>();
      for (const file of files) {
        if (!file.endsWith(".md")) {
          continue;
        }
        const note = await deps.vault.readFile(file);
        if (!note) {
          continue;
        }
        const parsed = parseObsidianNote(note.content);
        parsed.tags.forEach((tag) => tags.add(tag));
      }

      recordVaultToolCall("vault_get_tags", Date.now() - start);
      return jsonResult({
        ok: true,
        tool: "vault_get_tags",
        tags: Array.from(tags),
      });
    },
  };
}
