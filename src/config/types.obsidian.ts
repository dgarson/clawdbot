export type ObsidianConfig = {
  /** Enable/disable the Obsidian integration. */
  enabled?: boolean;
  /** Absolute or ~ path to the Obsidian vault root directory. */
  vaultPath?: string;
  /** Integration mode: how OpenClaw accesses the vault. */
  syncMode?: "direct" | "rest-api" | "node-bridge";
  /** Obsidian Local REST API plugin settings (for rest-api mode). */
  restApi?: {
    url?: string;
    apiKey?: string;
  };
  /** Node bridge settings (for node-bridge mode). */
  nodeBridge?: {
    nodeId?: string;
    remoteVaultPath?: string;
  };
  /** File watcher settings. */
  watcher?: {
    enabled?: boolean;
    debounceMs?: number;
    extensions?: string[];
    excludePaths?: string[];
    maxFileSize?: number;
  };
  /** Memory ingest configuration. */
  memoryIngest?: {
    enabled?: boolean;
    includeFolders?: string[];
    excludeFolders?: string[];
    indexWikiLinks?: boolean;
    indexTags?: boolean;
    maxContentLength?: number;
  };
  /** Default frontmatter to include when creating new notes. */
  defaultFrontmatter?: Record<string, unknown>;
  /** Daily notes configuration. */
  dailyNotes?: {
    folder?: string;
    dateFormat?: string;
    template?: string;
  };
};
