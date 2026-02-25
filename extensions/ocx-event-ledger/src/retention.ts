/**
 * TTL-based retention cleanup for the event ledger.
 *
 * Tier layout:
 *   Hot   — last N hours (default 24). Files are kept as-is for fast reads.
 *   Warm  — last N days (default 30). Files are kept on-disk as JSONL.
 *   Cold  — beyond warm, up to N days (default 365). Files remain on disk
 *           but could be compressed in a future phase.
 *   Purge — files older than cold retention are deleted.
 *
 * The retention service runs periodically (every hour) and removes day-files
 * that have aged out of the cold tier.
 */

import { readdir, unlink, rmdir } from "node:fs/promises";
import { join } from "node:path";
import type { EventLedgerConfig } from "./config.js";
import type { EventStorage } from "./storage.js";

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

/** How often the retention cleanup runs (ms). */
const RETENTION_INTERVAL_MS = 3_600_000; // 1 hour

export class RetentionService {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly storage: EventStorage,
    private readonly config: EventLedgerConfig,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (this.timer) return;
    // Run once at startup (deferred), then periodically
    const startupTimer = setTimeout(() => {
      void this.cleanup();
    }, 5_000);
    if (typeof startupTimer === "object" && "unref" in startupTimer) {
      startupTimer.unref();
    }

    this.timer = setInterval(() => {
      void this.cleanup();
    }, RETENTION_INTERVAL_MS);
    if (this.timer && typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Remove day-files older than the cold retention cutoff.
   */
  private async cleanup(): Promise<void> {
    const cutoffMs = this.config.coldRetentionDays * 86_400_000;
    const cutoffDate = new Date(Date.now() - cutoffMs);
    const cutoffDay = cutoffDate.toISOString().slice(0, 10);

    try {
      await this.cleanupEventFiles(cutoffDay);
      await this.cleanupSummaryFiles(cutoffDay);
    } catch (err) {
      this.logger.error(`[event-ledger] Retention cleanup error: ${String(err)}`);
    }
  }

  private async cleanupEventFiles(cutoffDay: string): Promise<void> {
    const baseDir = this.storage.baseDir;
    let entries: string[];
    try {
      const dirEntries = await readdir(baseDir, { withFileTypes: true });
      entries = dirEntries
        .filter((e) => e.isDirectory() && e.name !== "summaries")
        .map((e) => e.name);
    } catch {
      return; // Base dir may not exist yet
    }

    for (const agentId of entries) {
      const agentDir = join(baseDir, agentId);
      await this.purgeOldFiles(agentDir, cutoffDay);
      // Remove empty agent directories
      await this.removeEmptyDir(agentDir);
    }
  }

  private async cleanupSummaryFiles(cutoffDay: string): Promise<void> {
    const summaryDir = join(this.storage.baseDir, "summaries");
    await this.purgeOldFiles(summaryDir, cutoffDay);
  }

  /**
   * Delete any .jsonl files in dir whose name (YYYY-MM-DD.jsonl) is before cutoffDay.
   */
  private async purgeOldFiles(dir: string, cutoffDay: string): Promise<void> {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return;
    }

    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      const fileDay = file.replace(".jsonl", "");
      if (fileDay < cutoffDay) {
        try {
          await unlink(join(dir, file));
          this.logger.info(`[event-ledger] Purged ${dir}/${file}`);
        } catch (err) {
          this.logger.error(`[event-ledger] Failed to purge ${dir}/${file}: ${String(err)}`);
        }
      }
    }
  }

  private async removeEmptyDir(dir: string): Promise<void> {
    try {
      const remaining = await readdir(dir);
      if (remaining.length === 0) {
        await rmdir(dir);
      }
    } catch {
      // best-effort
    }
  }
}
