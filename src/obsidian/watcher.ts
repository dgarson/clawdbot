import chokidar, { type FSWatcher } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter.js";

export type VaultFileEvent = {
  type: "created" | "modified" | "deleted" | "renamed";
  path: string;
  fullPath: string;
  content?: string;
  frontmatter?: Record<string, unknown>;
  size?: number;
  modifiedAt?: Date;
};

export type VaultWatcherOptions = {
  vaultPath: string;
  debounceMs?: number;
  extensions?: string[];
  excludePaths?: string[];
  maxFileSize?: number;
  onFileChanged: (event: VaultFileEvent) => Promise<void>;
  log?: (msg: string) => void;
};

export function createVaultWatcher(options: VaultWatcherOptions): {
  start: () => void;
  stop: () => void;
} {
  const {
    vaultPath,
    debounceMs = 500,
    extensions = [".md"],
    excludePaths = [".obsidian", ".trash", ".git", "node_modules"],
    maxFileSize = 1048576,
    onFileChanged,
    log,
  } = options;

  const ignored = excludePaths.map((exclude) => path.join(vaultPath, exclude));
  let watcher: FSWatcher | null = null;
  const debounceMap = new Map<string, NodeJS.Timeout>();

  function debounced(filePath: string, callback: () => void): void {
    const existing = debounceMap.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }
    debounceMap.set(
      filePath,
      setTimeout(() => {
        debounceMap.delete(filePath);
        callback();
      }, debounceMs),
    );
  }

  function shouldProcess(filePath: string): boolean {
    const ext = path.extname(filePath);
    if (!extensions.includes(ext)) {
      return false;
    }
    const relative = path.relative(vaultPath, filePath);
    return !excludePaths.some((exclude) => relative.startsWith(exclude));
  }

  async function handleChange(
    eventType: "created" | "modified" | "deleted",
    filePath: string,
  ): Promise<void> {
    if (!shouldProcess(filePath)) {
      return;
    }
    const relativePath = path.relative(vaultPath, filePath);

    let content: string | undefined;
    let frontmatter: Record<string, unknown> | undefined;
    let size: number | undefined;
    let modifiedAt: Date | undefined;

    if (eventType !== "deleted") {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size > maxFileSize) {
          log?.(`vault watcher: skipping large file ${relativePath} (${stats.size} bytes)`);
          return;
        }
        size = stats.size;
        modifiedAt = stats.mtime;
        const raw = await fs.readFile(filePath, "utf-8");
        const parsed = parseFrontmatter(raw);
        content = raw;
        frontmatter = parsed.frontmatter;
      } catch {
        return;
      }
    }

    const event: VaultFileEvent = {
      type: eventType,
      path: relativePath,
      fullPath: filePath,
      content,
      frontmatter,
      size,
      modifiedAt,
    };

    log?.(`vault watcher: ${eventType} ${relativePath}`);

    await onFileChanged(event).catch((err) => {
      log?.(`vault watcher: handler error: ${String(err)}`);
    });
  }

  return {
    start() {
      watcher = chokidar.watch(vaultPath, {
        ignored,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: debounceMs,
          pollInterval: 100,
        },
      });

      watcher
        .on("add", (fp) => debounced(fp, () => void handleChange("created", fp)))
        .on("change", (fp) => debounced(fp, () => void handleChange("modified", fp)))
        .on("unlink", (fp) => debounced(fp, () => void handleChange("deleted", fp)));

      log?.(`vault watcher: watching ${vaultPath}`);
    },

    stop() {
      if (watcher) {
        void watcher.close();
        watcher = null;
        debounceMap.clear();
        log?.("vault watcher: stopped");
      }
    },
  };
}
