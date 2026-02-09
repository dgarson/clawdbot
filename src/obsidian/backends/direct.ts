import fs from "node:fs/promises";
import path from "node:path";
import type {
  VaultAccessLayer,
  VaultFile,
  VaultSearchOptions,
  VaultSearchResult,
} from "../vault-access.js";
import { parseFrontmatter } from "../frontmatter.js";

const DEFAULT_EXTENSIONS = [".md"];

function ensureWithinVault(vaultRoot: string, targetPath: string): string {
  const resolvedRoot = path.resolve(vaultRoot);
  const resolvedTarget = path.resolve(vaultRoot, targetPath);
  if (!resolvedTarget.startsWith(resolvedRoot + path.sep) && resolvedTarget !== resolvedRoot) {
    throw new Error(`Path escapes vault root: ${targetPath}`);
  }
  return resolvedTarget;
}

async function listFilesRecursive(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFilesRecursive(fullPath);
      files.push(...nested);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

export class DirectVaultAccess implements VaultAccessLayer {
  private vaultRoot: string;

  constructor(vaultPath: string) {
    this.vaultRoot = path.resolve(vaultPath);
  }

  getVaultPath(): string {
    return this.vaultRoot;
  }

  async readFile(relativePath: string): Promise<VaultFile | null> {
    const fullPath = ensureWithinVault(this.vaultRoot, relativePath);
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const stats = await fs.stat(fullPath);
      const parsed = parseFrontmatter(content);

      return {
        path: path.relative(this.vaultRoot, fullPath),
        content,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        stats: {
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          size: stats.size,
        },
      };
    } catch {
      return null;
    }
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = ensureWithinVault(this.vaultRoot, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
  }

  async appendToFile(relativePath: string, content: string): Promise<void> {
    const fullPath = ensureWithinVault(this.vaultRoot, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.appendFile(fullPath, content, "utf-8");
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = ensureWithinVault(this.vaultRoot, relativePath);
    await fs.rm(fullPath, { force: true });
  }

  async moveFile(oldPath: string, newPath: string): Promise<void> {
    const fullOldPath = ensureWithinVault(this.vaultRoot, oldPath);
    const fullNewPath = ensureWithinVault(this.vaultRoot, newPath);
    await fs.mkdir(path.dirname(fullNewPath), { recursive: true });
    await fs.rename(fullOldPath, fullNewPath);
  }

  async listFiles(directory?: string): Promise<string[]> {
    const targetDir = directory ? ensureWithinVault(this.vaultRoot, directory) : this.vaultRoot;
    const entries = await listFilesRecursive(targetDir);
    return entries.map((entry) => path.relative(this.vaultRoot, entry));
  }

  async search(query: string, options?: VaultSearchOptions): Promise<VaultSearchResult[]> {
    const folder = options?.folder
      ? ensureWithinVault(this.vaultRoot, options.folder)
      : this.vaultRoot;
    const extensions = options?.extensions?.length ? options.extensions : DEFAULT_EXTENSIONS;
    const entries = await listFilesRecursive(folder);
    const matches: VaultSearchResult[] = [];

    for (const entry of entries) {
      if (!extensions.includes(path.extname(entry))) {
        continue;
      }
      const content = await fs.readFile(entry, "utf-8").catch(() => null);
      if (!content) {
        continue;
      }

      const lines = content.split("\n");
      const lineMatches = lines
        .map((text, index) => ({ text, line: index + 1 }))
        .filter((line) => line.text.includes(query));

      if (lineMatches.length === 0) {
        continue;
      }

      matches.push({
        path: path.relative(this.vaultRoot, entry),
        matches: lineMatches,
        score: Math.min(1, lineMatches.length / 10),
      });

      if (options?.limit && matches.length >= options.limit) {
        break;
      }
    }

    return matches;
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = ensureWithinVault(this.vaultRoot, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
