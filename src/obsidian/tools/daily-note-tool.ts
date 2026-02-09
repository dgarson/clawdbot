import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../agents/tools/common.js";
import type { VaultToolsDeps } from "./types.js";
import { jsonResult } from "../../agents/tools/common.js";
import { recordVaultToolCall } from "../metrics.js";
import { ensureMarkdownExtension, normalizeVaultPath } from "./utils.js";

const VaultDailyNoteSchema = Type.Object({});

function formatDate(date: Date, pattern = "YYYY-MM-DD"): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return pattern.replace(/YYYY/g, yyyy).replace(/MM/g, mm).replace(/DD/g, dd);
}

function getDailyNotePath(date: Date, folder?: string, pattern?: string): string {
  const base = folder?.trim() ? normalizeVaultPath(folder) : "daily";
  return `${base}/${formatDate(date, pattern)}.md`;
}

export function createVaultDailyNoteTool(deps: VaultToolsDeps): AnyAgentTool {
  return {
    label: "Vault Daily Note",
    name: "vault_daily_note",
    description: "Get or create today's daily note.",
    parameters: VaultDailyNoteSchema,
    execute: async () => {
      const start = Date.now();
      const folder = deps.config?.dailyNotes?.folder ?? "daily";
      const dateFormat = deps.config?.dailyNotes?.dateFormat ?? "YYYY-MM-DD";
      const templatePath = deps.config?.dailyNotes?.template;
      const notePath = getDailyNotePath(new Date(), folder, dateFormat);

      const existing = await deps.vault.readFile(notePath);
      if (existing) {
        recordVaultToolCall("vault_daily_note", Date.now() - start);
        return jsonResult({ ok: true, tool: "vault_daily_note", note: existing });
      }

      let content = `# ${formatDate(new Date(), dateFormat)}\n\n`;
      if (templatePath) {
        const template = await deps.vault.readFile(normalizeVaultPath(templatePath));
        if (template) {
          const formattedDate = formatDate(new Date(), dateFormat);
          content = template.body
            .replace(/{{date}}/g, formattedDate)
            .replace(/{{title}}/g, formattedDate);
        }
      }

      const normalized = ensureMarkdownExtension(notePath);
      deps.selfAuthoredFilter?.markAsOurs(normalized);
      await deps.vault.writeFile(normalized, content);

      const created = await deps.vault.readFile(normalized);
      recordVaultToolCall("vault_daily_note", Date.now() - start);
      return jsonResult({ ok: true, tool: "vault_daily_note", note: created });
    },
  };
}
