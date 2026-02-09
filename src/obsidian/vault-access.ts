export type VaultFileStats = {
  createdAt: Date;
  modifiedAt: Date;
  size: number;
};

export type VaultFile = {
  /** Relative path from vault root (e.g., "projects/openclaw.md") */
  path: string;
  /** File content (markdown). */
  content: string;
  /** Parsed YAML frontmatter. */
  frontmatter: Record<string, unknown>;
  /** Body content (without frontmatter). */
  body: string;
  /** File stats. */
  stats: VaultFileStats;
};

export type VaultSearchMatch = {
  line: number;
  text: string;
};

export type VaultSearchResult = {
  /** Relative path. */
  path: string;
  /** Matching line numbers. */
  matches: VaultSearchMatch[];
  /** Relevance score (0-1). */
  score: number;
};

export type VaultSearchOptions = {
  folder?: string;
  extensions?: string[];
  limit?: number;
};

export interface VaultAccessLayer {
  /** Read a file from the vault. */
  readFile(path: string): Promise<VaultFile | null>;
  /** Write a file to the vault (creates parent dirs if needed). */
  writeFile(path: string, content: string): Promise<void>;
  /** Append content to an existing file. */
  appendToFile(path: string, content: string): Promise<void>;
  /** Delete a file from the vault. */
  deleteFile(path: string): Promise<void>;
  /** Move/rename a file. */
  moveFile(oldPath: string, newPath: string): Promise<void>;
  /** List all files in the vault (or a subdirectory). */
  listFiles(directory?: string): Promise<string[]>;
  /** Full-text search across vault files. */
  search(query: string, options?: VaultSearchOptions): Promise<VaultSearchResult[]>;
  /** Check if a file exists. */
  exists(path: string): Promise<boolean>;
  /** Get vault root path. */
  getVaultPath(): string;
}
