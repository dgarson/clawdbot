import { Type } from "@sinclair/typebox";
import path from "node:path";
import type { AnyAgentTool } from "../../agents/tools/common.js";
import type { VaultToolsDeps } from "./types.js";
import { jsonResult, readStringParam } from "../../agents/tools/common.js";
import { composeNote, mergeFrontmatter } from "../frontmatter.js";
import { recordVaultToolCall } from "../metrics.js";
import { ensureMarkdownExtension, normalizeVaultPath } from "./utils.js";

const VaultCreateSchema = Type.Object({
  path: Type.String({ description: "Relative path for the new note" }),
  content: Type.String({ description: "Markdown content of the note" }),
  frontmatter: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  template: Type.Optional(Type.String({ description: "Template note path" })),
});

const VaultUpdateSchema = Type.Object({
  path: Type.String({ description: "Relative path to the note" }),
  content: Type.String({ description: "Markdown content to replace" }),
});

const VaultAppendSchema = Type.Object({
  path: Type.String({ description: "Relative path to the note" }),
  content: Type.String({ description: "Content to append" }),
  section: Type.Optional(Type.String({ description: "Optional heading to append under" })),
});

const VaultFrontmatterSchema = Type.Object({
  path: Type.String({ description: "Relative path to the note" }),
  fields: Type.Record(Type.String(), Type.Unknown()),
});

const VaultDeleteSchema = Type.Object({
  path: Type.String({ description: "Relative path to the note" }),
  permanent: Type.Optional(Type.Boolean({ description: "Delete permanently instead of trash" })),
});

const VaultMoveSchema = Type.Object({
  oldPath: Type.String({ description: "Current relative path" }),
  newPath: Type.String({ description: "New relative path" }),
});

function markSelfAuthored(deps: VaultToolsDeps, relativePath: string): void {
  deps.selfAuthoredFilter?.markAsOurs(relativePath);
}

function applySectionAppend(
  content: string,
  section: string | undefined,
  appendContent: string,
): string {
  if (!section) {
    return `${content}\n${appendContent}`.replace(/\n{3,}/g, "\n\n");
  }

  const lines = content.split("\n");
  const headingPattern = new RegExp(
    `^#{1,6}\\s+${section.replace(/[-/\\^$*+?.()|[\\]{}]/g, "\\$&")}$`,
    "i",
  );
  const index = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (index === -1) {
    return `${content}\n\n## ${section}\n${appendContent}`.replace(/\n{3,}/g, "\n\n");
  }

  const insertAt = index + 1;
  lines.splice(insertAt, 0, appendContent);
  return lines.join("\n");
}

export function createVaultCreateNoteTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Create Note",
    name: "vault_create_note",
    description: "Create a new note in the Obsidian vault.",
    parameters: VaultCreateSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const rawPath = readStringParam(input ?? {}, "path", { required: true, label: "path" });
      const content = readStringParam(input ?? {}, "content", { required: true, label: "content" });
      const templatePath = readStringParam(input ?? {}, "template");

      const relativePath = ensureMarkdownExtension(normalizeVaultPath(rawPath));
      let body = content;

      if (templatePath) {
        const templateNote = await deps.vault.readFile(normalizeVaultPath(templatePath));
        if (templateNote) {
          body = `${templateNote.body}\n${content}`;
        }
      }

      const frontmatter = {
        ...deps.config?.defaultFrontmatter,
        ...input?.frontmatter,
      };
      const composed = composeNote(body, frontmatter);

      markSelfAuthored(deps, relativePath);
      await deps.vault.writeFile(relativePath, composed);

      recordVaultToolCall("vault_create_note", Date.now() - start);
      return jsonResult({ ok: true, tool: "vault_create_note", path: relativePath });
    },
  };
}

export function createVaultUpdateNoteTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Update Note",
    name: "vault_update_note",
    description: "Replace the entire content of a note.",
    parameters: VaultUpdateSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const rawPath = readStringParam(input ?? {}, "path", { required: true, label: "path" });
      const content = readStringParam(input ?? {}, "content", { required: true, label: "content" });
      const relativePath = ensureMarkdownExtension(normalizeVaultPath(rawPath));

      markSelfAuthored(deps, relativePath);
      await deps.vault.writeFile(relativePath, content);

      recordVaultToolCall("vault_update_note", Date.now() - start);
      return jsonResult({ ok: true, tool: "vault_update_note", path: relativePath });
    },
  };
}

export function createVaultAppendToNoteTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Append Note",
    name: "vault_append_to_note",
    description: "Append content to the end of a note.",
    parameters: VaultAppendSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const rawPath = readStringParam(input ?? {}, "path", { required: true, label: "path" });
      const content = readStringParam(input ?? {}, "content", { required: true, label: "content" });
      const section = readStringParam(input ?? {}, "section");
      const relativePath = ensureMarkdownExtension(normalizeVaultPath(rawPath));

      const existing = await deps.vault.readFile(relativePath);
      if (!existing) {
        markSelfAuthored(deps, relativePath);
        await deps.vault.writeFile(relativePath, content);
        recordVaultToolCall("vault_append_to_note", Date.now() - start);
        return jsonResult({ ok: true, tool: "vault_append_to_note", path: relativePath });
      }

      const nextContent = applySectionAppend(existing.content, section, content);
      markSelfAuthored(deps, relativePath);
      await deps.vault.writeFile(relativePath, nextContent);

      recordVaultToolCall("vault_append_to_note", Date.now() - start);
      return jsonResult({ ok: true, tool: "vault_append_to_note", path: relativePath });
    },
  };
}

export function createVaultSetFrontmatterTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Set Frontmatter",
    name: "vault_set_frontmatter",
    description: "Update YAML frontmatter fields (merge, not replace).",
    parameters: VaultFrontmatterSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const rawPath = readStringParam(input ?? {}, "path", { required: true, label: "path" });
      const relativePath = ensureMarkdownExtension(normalizeVaultPath(rawPath));
      const fields = (input?.fields ?? {}) as Record<string, unknown>;

      const note = await deps.vault.readFile(relativePath);
      if (!note) {
        recordVaultToolCall("vault_set_frontmatter", Date.now() - start);
        return jsonResult({ ok: false, tool: "vault_set_frontmatter", error: "note_not_found" });
      }

      const merged = mergeFrontmatter(note.frontmatter, fields);
      const composed = composeNote(note.body, merged);

      markSelfAuthored(deps, relativePath);
      await deps.vault.writeFile(relativePath, composed);

      recordVaultToolCall("vault_set_frontmatter", Date.now() - start);
      return jsonResult({ ok: true, tool: "vault_set_frontmatter", path: relativePath });
    },
  };
}

export function createVaultDeleteNoteTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Delete Note",
    name: "vault_delete_note",
    description: "Delete a note (trash by default).",
    parameters: VaultDeleteSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const rawPath = readStringParam(input ?? {}, "path", { required: true, label: "path" });
      const relativePath = ensureMarkdownExtension(normalizeVaultPath(rawPath));
      const permanent = typeof input?.permanent === "boolean" ? input.permanent : false;

      if (permanent) {
        markSelfAuthored(deps, relativePath);
        await deps.vault.deleteFile(relativePath);
        recordVaultToolCall("vault_delete_note", Date.now() - start);
        return jsonResult({ ok: true, tool: "vault_delete_note", path: relativePath, permanent });
      }

      const trashPath = path.join(".trash", path.basename(relativePath));
      markSelfAuthored(deps, relativePath);
      await deps.vault.moveFile(relativePath, trashPath);

      recordVaultToolCall("vault_delete_note", Date.now() - start);
      return jsonResult({
        ok: true,
        tool: "vault_delete_note",
        path: relativePath,
        trashedPath: trashPath,
      });
    },
  };
}

export function createVaultMoveNoteTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Move Note",
    name: "vault_move_note",
    description: "Move/rename a note.",
    parameters: VaultMoveSchema,
    execute: async (_ctx, input) => {
      const start = Date.now();
      const rawOldPath = readStringParam(input ?? {}, "oldPath", {
        required: true,
        label: "oldPath",
      });
      const rawNewPath = readStringParam(input ?? {}, "newPath", {
        required: true,
        label: "newPath",
      });
      const oldPath = ensureMarkdownExtension(normalizeVaultPath(rawOldPath));
      const newPath = ensureMarkdownExtension(normalizeVaultPath(rawNewPath));

      markSelfAuthored(deps, oldPath);
      markSelfAuthored(deps, newPath);
      await deps.vault.moveFile(oldPath, newPath);

      recordVaultToolCall("vault_move_note", Date.now() - start);
      return jsonResult({ ok: true, tool: "vault_move_note", oldPath, newPath });
    },
  };
}
