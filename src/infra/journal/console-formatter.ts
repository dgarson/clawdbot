import type { JournalEntry } from "./types.js";

/**
 * Compact 1-line summary for info-level console output.
 * Example: `[journal] run completed agent=main model=claude-sonnet-4-6 8654ms`
 */
export function formatJournalSummary(entry: JournalEntry): string {
  const parts = ["[journal]"];
  if (entry.agentId) {
    parts.push(`[${entry.agentId}]`);
  }
  parts.push(entry.summary);
  return parts.join(" ");
}

/**
 * Multi-line expanded output for warn/error severity.
 * Includes the full data payload for debugging.
 */
export function formatJournalExpanded(entry: JournalEntry): string {
  const header = formatJournalSummary(entry);
  if (!entry.data || Object.keys(entry.data).length === 0) {
    return header;
  }
  const lines = [header];
  for (const [key, value] of Object.entries(entry.data)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === "object") {
      lines.push(`  ${key}: ${JSON.stringify(value)}`);
    } else if (typeof value === "string") {
      lines.push(`  ${key}: ${value}`);
    } else {
      lines.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }
  return lines.join("\n");
}

/**
 * Returns true if this entry should be shown on the console
 * when journal console summary mode is active.
 */
export function shouldShowOnConsole(entry: JournalEntry): boolean {
  switch (entry.severity) {
    case "trace":
    case "debug":
      return false;
    case "info":
    case "warn":
    case "error":
      return true;
    default:
      return false;
  }
}

/**
 * Returns true if this entry should be shown in expanded (multi-line) form.
 */
export function shouldExpandOnConsole(entry: JournalEntry): boolean {
  return entry.severity === "warn" || entry.severity === "error";
}
