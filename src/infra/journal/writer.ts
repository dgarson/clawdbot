import fs from "node:fs";
import path from "node:path";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  ensureJournalDirSync,
  listJournalFiles,
  parseDateFromJournalFile,
  resolveActivityBucketFile,
  resolveAgentJournalDir,
  resolveJournalFile,
} from "./paths.js";
import { type JournalConfig, type JournalEntry, resolveActivityBuckets } from "./types.js";

const log = createSubsystemLogger("journal");

const IDLE_CLOSE_MS = 60_000;
const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB default

type OpenHandle = {
  fd: number;
  filePath: string;
  idleTimer: NodeJS.Timeout;
  bytesWritten: number;
};

export class JournalWriter {
  private handles = new Map<string, OpenHandle>();
  private config: JournalConfig;
  private maxFileBytes: number;
  private stopped = false;

  constructor(config: JournalConfig) {
    this.config = config;
    this.maxFileBytes = (config.maxFileMb ?? 100) * 1024 * 1024 || MAX_FILE_BYTES;
  }

  write(entry: JournalEntry): void {
    if (this.stopped) {
      return;
    }
    const line = JSON.stringify(entry) + "\n";
    const lineBytes = Buffer.byteLength(line, "utf8");

    // Write to per-agent journal
    if (entry.agentId) {
      const agentDir = resolveAgentJournalDir(entry.agentId);
      const filePath = resolveJournalFile(agentDir, new Date(entry.ts));
      this.appendToFile(filePath, agentDir, line, lineBytes);
    }

    // Dual-write to activity buckets
    if (this.config.activityBuckets) {
      const buckets = resolveActivityBuckets(entry);
      for (const bucket of buckets) {
        const filePath = resolveActivityBucketFile(bucket, new Date(entry.ts));
        this.appendToFile(filePath, path.dirname(filePath), line, lineBytes);
      }
    }
  }

  /** Gracefully close all open file handles. */
  stop(): void {
    this.stopped = true;
    for (const [key, handle] of this.handles) {
      clearTimeout(handle.idleTimer);
      try {
        fs.closeSync(handle.fd);
      } catch {
        // ignore close errors during shutdown
      }
      this.handles.delete(key);
    }
  }

  /** Prune journal files older than retentionDays. */
  pruneOldFiles(dirs: string[]): void {
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    for (const dir of dirs) {
      const files = listJournalFiles(dir);
      for (const file of files) {
        const date = parseDateFromJournalFile(file);
        if (date && date.getTime() < cutoff) {
          try {
            fs.unlinkSync(file);
            log.debug(`pruned old journal file: ${file}`);
          } catch (err) {
            log.warn(`failed to prune journal file: ${file} error=${String(err)}`);
          }
        }
      }
    }
  }

  private appendToFile(filePath: string, dir: string, line: string, lineBytes: number): void {
    const handle = this.getOrOpenHandle(filePath, dir);
    if (!handle) {
      return;
    }

    // Check size cap
    if (handle.bytesWritten + lineBytes > this.maxFileBytes) {
      log.debug(`journal file size cap reached: ${filePath}`);
      return;
    }

    try {
      fs.writeSync(handle.fd, line);
      handle.bytesWritten += lineBytes;
      this.resetIdleTimer(filePath, handle);
    } catch (err) {
      log.warn(`journal write failed: ${filePath} error=${String(err)}`);
      this.closeHandle(filePath);
    }
  }

  private getOrOpenHandle(filePath: string, dir: string): OpenHandle | null {
    const existing = this.handles.get(filePath);
    if (existing) {
      return existing;
    }

    try {
      ensureJournalDirSync(dir);
      const fd = fs.openSync(filePath, "a");
      const stats = fs.fstatSync(fd);
      const handle: OpenHandle = {
        fd,
        filePath,
        idleTimer: setTimeout(() => this.closeHandle(filePath), IDLE_CLOSE_MS),
        bytesWritten: stats.size,
      };
      handle.idleTimer.unref?.();
      this.handles.set(filePath, handle);
      return handle;
    } catch (err) {
      log.warn(`journal open failed: ${filePath} error=${String(err)}`);
      return null;
    }
  }

  private resetIdleTimer(filePath: string, handle: OpenHandle): void {
    clearTimeout(handle.idleTimer);
    handle.idleTimer = setTimeout(() => this.closeHandle(filePath), IDLE_CLOSE_MS);
    handle.idleTimer.unref?.();
  }

  private closeHandle(filePath: string): void {
    const handle = this.handles.get(filePath);
    if (!handle) {
      return;
    }
    clearTimeout(handle.idleTimer);
    try {
      fs.closeSync(handle.fd);
    } catch {
      // ignore close errors
    }
    this.handles.delete(filePath);
  }
}
