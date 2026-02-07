import fs from "node:fs";
import path from "node:path";
import type { ToolJournalEntry } from "./types.js";
import { DEFAULT_LOG_DIR } from "../../logging/logger.js";

const JOURNAL_PREFIX = "journal";
const JOURNAL_SUFFIX = ".log";

let dirEnsured = false;
let currentPath: string | null = null;

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultJournalPath(): string {
  const today = formatLocalDate(new Date());
  return path.join(DEFAULT_LOG_DIR, `${JOURNAL_PREFIX}-${today}${JOURNAL_SUFFIX}`);
}

export function ensureJournalDir(dir: string): void {
  if (dirEnsured) {
    return;
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
    dirEnsured = true;
  } catch {
    // best-effort
  }
}

export function getJournalFilePath(): string | null {
  return currentPath;
}

export function initJournalPath(overridePath?: string): string {
  currentPath = overridePath ?? defaultJournalPath();
  ensureJournalDir(path.dirname(currentPath));
  return currentPath;
}

export function writeJournalEntry(entry: ToolJournalEntry): void {
  const filePath = currentPath;
  if (!filePath) {
    return;
  }
  try {
    const line = JSON.stringify(entry);
    fs.appendFileSync(filePath, `${line}\n`, { encoding: "utf8" });
  } catch {
    // never block on journal write failures
  }
}

export function pruneOldJournalFiles(dir: string, retentionHours: number): void {
  try {
    const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      if (!entry.name.startsWith(`${JOURNAL_PREFIX}-`) || !entry.name.endsWith(JOURNAL_SUFFIX)) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < cutoff) {
          fs.rmSync(fullPath, { force: true });
        }
      } catch {
        // ignore errors during pruning
      }
    }
  } catch {
    // ignore missing dir or read errors
  }
}

/** Reset module state (for tests). */
export function resetJournalWriter(): void {
  dirEnsured = false;
  currentPath = null;
}
