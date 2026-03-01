import fs from "node:fs";
import path from "node:path";
import { resolveConfigDir } from "../../utils.js";
import type { ActivityBucket } from "./types.js";

/** Base directory for all journal files: `~/.openclaw/journals/` */
export function resolveJournalDir(): string {
  const configDir = resolveConfigDir();
  return path.join(configDir, "journals");
}

/** Per-agent journal directory: `~/.openclaw/journals/agents/<agentId>/` */
export function resolveAgentJournalDir(agentId: string): string {
  return path.join(resolveJournalDir(), "agents", agentId);
}

/** Cross-agent activity directory: `~/.openclaw/journals/activity/` */
export function resolveActivityDir(): string {
  return path.join(resolveJournalDir(), "activity");
}

/** Build a dated journal filename: `<prefix>-YYYY-MM-DD.jsonl` */
export function resolveJournalFile(dir: string, date: Date, prefix = "journal"): string {
  const dateStr = formatDateForFile(date);
  return path.join(dir, `${prefix}-${dateStr}.jsonl`);
}

/** Build activity bucket file: `<bucket>-YYYY-MM-DD.jsonl` */
export function resolveActivityBucketFile(bucket: ActivityBucket, date: Date): string {
  return resolveJournalFile(resolveActivityDir(), date, bucket);
}

function formatDateForFile(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Ensure a directory exists (sync, for startup). */
export function ensureJournalDirSync(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** List journal files in a directory, sorted by date (newest first). */
export function listJournalFiles(dir: string, prefix = "journal"): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const pattern = new RegExp(`^${prefix}-\\d{4}-\\d{2}-\\d{2}\\.jsonl$`);
  return fs
    .readdirSync(dir)
    .filter((f: string) => pattern.test(f))
    .toSorted()
    .toReversed()
    .map((f: string) => path.join(dir, f));
}

/** Parse the date from a journal filename. Returns null if not parseable. */
export function parseDateFromJournalFile(filePath: string): Date | null {
  const base = path.basename(filePath);
  const match = base.match(/(\d{4}-\d{2}-\d{2})\.jsonl$/);
  if (!match) {
    return null;
  }
  const date = new Date(`${match[1]}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
