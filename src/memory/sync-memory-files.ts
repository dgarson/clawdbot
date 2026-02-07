import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs/promises";
import path from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  buildFileEntry,
  listMemoryFiles,
  parseDatedFilename,
  type MemoryFileEntry,
} from "./internal.js";
import { memLog } from "./memory-log.js";

const log = createSubsystemLogger("memory");

type ProgressState = {
  completed: number;
  total: number;
  label?: string;
  report: (update: { completed: number; total: number; label?: string }) => void;
};

export async function syncMemoryFiles(params: {
  workspaceDir: string;
  extraPaths?: string[];
  db: DatabaseSync;
  needsFullReindex: boolean;
  progress?: ProgressState;
  batchEnabled: boolean;
  concurrency: number;
  runWithConcurrency: <T>(tasks: Array<() => Promise<T>>, concurrency: number) => Promise<T[]>;
  indexFile: (entry: MemoryFileEntry) => Promise<void>;
  vectorTable: string;
  ftsTable: string;
  ftsEnabled: boolean;
  ftsAvailable: boolean;
  model: string;
}) {
  const files = await listMemoryFiles(params.workspaceDir, params.extraPaths);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Phase 1: stat all files, build lightweight info list
  const fileInfos = await Promise.all(
    files.map(async (absPath) => {
      const stat = await fs.stat(absPath);
      const relPath = path.relative(params.workspaceDir, absPath).replace(/\\/g, "/");
      return { absPath, stat, relPath };
    }),
  );

  log.debug("memory sync: indexing memory files", {
    files: fileInfos.length,
    needsFullReindex: params.needsFullReindex,
    batch: params.batchEnabled,
    concurrency: params.concurrency,
  });

  const activePaths = new Set(fileInfos.map((info) => info.relPath));
  if (params.progress) {
    params.progress.total += fileInfos.length;
    params.progress.report({
      completed: params.progress.completed,
      total: params.progress.total,
      label: params.batchEnabled ? "Indexing memory files (batch)..." : "Indexing memory files…",
    });
  }

  let datedSkipped = 0;
  const tasks = fileInfos.map((info) => async () => {
    // Dated fast-path: for YYYY-MM-DD.md files with date < today, check mtime+size
    if (!params.needsFullReindex) {
      const dateStr = parseDatedFilename(info.relPath);
      if (dateStr && dateStr < todayStr) {
        const record = params.db
          .prepare(`SELECT hash, mtime, size FROM files WHERE path = ? AND source = ?`)
          .get(info.relPath, "memory") as { hash: string; mtime: number; size: number } | undefined;
        if (
          record &&
          Math.floor(record.mtime) === Math.floor(info.stat.mtimeMs) &&
          record.size === info.stat.size
        ) {
          memLog.trace("syncMemoryFiles (standalone): dated-fastpath-skip", {
            path: info.relPath,
            date: dateStr,
          });
          datedSkipped += 1;
          if (params.progress) {
            params.progress.completed += 1;
            params.progress.report({
              completed: params.progress.completed,
              total: params.progress.total,
            });
          }
          return;
        }
      }
    }

    // Full path: read file, compute hash, compare
    const entry = await buildFileEntry(info.absPath, params.workspaceDir);
    const record = params.db
      .prepare(`SELECT hash FROM files WHERE path = ? AND source = ?`)
      .get(entry.path, "memory") as { hash: string } | undefined;
    if (!params.needsFullReindex && record?.hash === entry.hash) {
      memLog.trace("syncMemoryFiles (standalone): skip (unchanged)", { path: entry.path });
      if (params.progress) {
        params.progress.completed += 1;
        params.progress.report({
          completed: params.progress.completed,
          total: params.progress.total,
        });
      }
      return;
    }
    memLog.trace("syncMemoryFiles (standalone): indexing", {
      path: entry.path,
      reason: !record ? "new" : "hash-changed",
    });
    await params.indexFile(entry);
    if (params.progress) {
      params.progress.completed += 1;
      params.progress.report({
        completed: params.progress.completed,
        total: params.progress.total,
      });
    }
  });

  await params.runWithConcurrency(tasks, params.concurrency);

  const staleRows = params.db
    .prepare(`SELECT path FROM files WHERE source = ?`)
    .all("memory") as Array<{ path: string }>;
  for (const stale of staleRows) {
    if (activePaths.has(stale.path)) {
      continue;
    }
    params.db.prepare(`DELETE FROM files WHERE path = ? AND source = ?`).run(stale.path, "memory");
    try {
      params.db
        .prepare(
          `DELETE FROM ${params.vectorTable} WHERE id IN (SELECT id FROM chunks WHERE path = ? AND source = ?)`,
        )
        .run(stale.path, "memory");
    } catch (err) {
      log.debug(`Failed to delete from ${params.vectorTable}: ${String(err)}`);
    }
    params.db.prepare(`DELETE FROM chunks WHERE path = ? AND source = ?`).run(stale.path, "memory");
    if (params.ftsEnabled && params.ftsAvailable) {
      try {
        params.db
          .prepare(`DELETE FROM ${params.ftsTable} WHERE path = ? AND source = ? AND model = ?`)
          .run(stale.path, "memory", params.model);
      } catch (err) {
        log.debug(`Failed to delete from ${params.ftsTable}: ${String(err)}`);
      }
    }
  }
}
