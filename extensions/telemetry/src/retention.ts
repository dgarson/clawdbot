import node_fs from "node:fs";
import node_path from "node:path";
import type { TelemetryConfig } from "./types.js";

const JSONL_PATTERN = /^events\.(\d{4}-\d{2}-\d{2}|\d{4}-W\d{2})\.jsonl$/;
const BLOB_EXTENSION = ".blob";

/**
 * Delete rotated JSONL files and blob files older than `retentionDays`.
 * The current `events.jsonl` (not yet rotated) is never deleted.
 *
 * Call this on plugin start and periodically (e.g., once per day).
 *
 * @param telemetryDir - the agent-scoped telemetry directory
 * @param config - plugin config; reads `retentionDays` (0 = keep forever)
 */
export function enforceRetention(telemetryDir: string, config: TelemetryConfig): void {
  const retentionDays = config.retentionDays ?? 30;
  if (retentionDays <= 0) {
    // 0 means keep forever
    return;
  }

  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  // --- Prune rotated JSONL files ---
  pruneJsonlFiles(telemetryDir, cutoffMs);

  // --- Prune blob files ---
  const blobsDir = node_path.join(telemetryDir, "blobs");
  pruneBlobFiles(blobsDir, cutoffMs);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function pruneJsonlFiles(dir: string, cutoffMs: number): void {
  let entries: node_fs.Dirent[];
  try {
    entries = node_fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    // Directory may not exist yet
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!JSONL_PATTERN.test(entry.name)) continue; // skip events.jsonl (no date suffix)

    const filePath = node_path.join(dir, entry.name);
    if (isOlderThanCutoff(filePath, cutoffMs)) {
      tryUnlink(filePath);
    }
  }
}

function pruneBlobFiles(blobsDir: string, cutoffMs: number): void {
  let entries: node_fs.Dirent[];
  try {
    entries = node_fs.readdirSync(blobsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(BLOB_EXTENSION)) continue;

    const filePath = node_path.join(blobsDir, entry.name);
    if (isOlderThanCutoff(filePath, cutoffMs)) {
      tryUnlink(filePath);
    }
  }
}

function isOlderThanCutoff(filePath: string, cutoffMs: number): boolean {
  try {
    const stat = node_fs.statSync(filePath);
    return stat.mtimeMs < cutoffMs;
  } catch {
    return false;
  }
}

function tryUnlink(filePath: string): void {
  try {
    node_fs.unlinkSync(filePath);
  } catch {
    // Best-effort: ignore errors (file may be locked, already deleted, etc.)
  }
}
