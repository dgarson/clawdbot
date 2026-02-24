import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LOG_DIR } from "./logger.js";

export const TOOL_FAILURE_JOURNAL_FILE = path.join(DEFAULT_LOG_DIR, "tool-failures.jsonl");

/**
 * Tools excluded from journal recording.
 * exec/bash: excluded by request (too noisy / handled separately).
 * read/view/write/edit: excluded as non-actionable file I/O operations.
 */
const JOURNAL_SKIP_TOOLS = new Set(["exec", "bash", "read", "view", "write", "edit"]);

const SENSITIVE_KEY_RE = /token|secret|password|auth|credential|api_?key|private/i;
const VERBOSE_KEYS = new Set([
  "content",
  "message",
  "text",
  "body",
  "prompt",
  "description",
  "markdown",
  "html",
  "data",
  "payload",
  "output",
  "input",
]);

/**
 * Build a compact one-liner of tool params for log messages.
 * Skips verbose content fields and redacts sensitive keys.
 * Returns empty string if nothing interesting remains.
 */
export function summarizeToolParams(params: unknown, maxLen = 180): string {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return "";
  }
  const record = params as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(record)) {
    if (VERBOSE_KEYS.has(k)) {
      continue;
    }
    if (SENSITIVE_KEY_RE.test(k)) {
      continue;
    }
    const str =
      typeof v === "string"
        ? v.length > 80
          ? `${v.slice(0, 77)}…`
          : v
        : typeof v === "object" && v !== null
          ? "[obj]"
          : String(v);
    parts.push(`${k}=${str}`);
    if (parts.join(" ").length > maxLen) {
      break;
    }
  }
  return parts.join(" ");
}

function sanitizeJournalParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (VERBOSE_KEYS.has(k)) {
      continue;
    }
    if (SENSITIVE_KEY_RE.test(k)) {
      continue;
    }
    if (typeof v === "string") {
      out[k] = v.length > 200 ? `${v.slice(0, 197)}…` : v;
    } else if (typeof v === "object" && v !== null) {
      out[k] = "[object]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

export type ToolFailureJournalEntry = {
  agentId?: string;
  sessionKey?: string;
  toolName: string;
  params?: Record<string, unknown>;
  error: string;
  durationMs?: number;
};

/**
 * Append a tool failure to the JSONL journal file.
 * Skips exec/bash/read/view/write/edit tools. Never throws.
 */
export function recordToolFailureJournal(entry: ToolFailureJournalEntry): void {
  const normalized = entry.toolName.trim().toLowerCase();
  if (JOURNAL_SKIP_TOOLS.has(normalized)) {
    return;
  }
  try {
    const sanitizedParams =
      entry.params && typeof entry.params === "object"
        ? sanitizeJournalParams(entry.params)
        : undefined;
    const record: Record<string, unknown> = {
      time: new Date().toISOString(),
      agentId: entry.agentId ?? "unknown",
      toolName: entry.toolName,
      error: entry.error,
    };
    if (sanitizedParams && Object.keys(sanitizedParams).length > 0) {
      record.params = sanitizedParams;
    }
    if (entry.sessionKey) {
      record.sessionKey = entry.sessionKey;
    }
    if (entry.durationMs != null) {
      record.durationMs = entry.durationMs;
    }
    fs.appendFileSync(TOOL_FAILURE_JOURNAL_FILE, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
    });
  } catch {
    // Never block on journal failures.
  }
}
