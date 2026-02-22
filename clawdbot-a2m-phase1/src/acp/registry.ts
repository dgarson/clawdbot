/**
 * ACP Registry — Phase 1
 * 
 * Provides append-only JSONL storage for:
 * - handoffs/handoffs.jsonl
 * - messages/messages.jsonl
 * - decisions/decisions.jsonl
 * - artifacts/registry.jsonl
 * - roles/ledger.jsonl
 * 
 * Based on: /Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md §8
 */

import { mkdir, appendFile, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

export type RegistryType = "handoff" | "message" | "decision" | "artifact" | "role";

export type RegistryEntry = {
  id: string;
  type: RegistryType;
  timestamp: string;
  data: unknown;
  hash: string;
};

export type RegistryQuery = {
  type?: RegistryEntry["type"];
  since?: string; // ISO timestamp
  until?: string; // ISO timestamp
  limit?: number;
  filter?: (entry: RegistryEntry) => boolean;
};

export type RegistryConfig = {
  basePath: string;
  subdirs?: Partial<Record<RegistryType, string>>;
};

const DEFAULT_SUBDIRS: Record<RegistryType, string> = {
  handoff: "handoffs",
  message: "messages",
  decision: "decisions",
  artifact: "artifacts",
  role: "roles",
};

/**
 * ACP Registry - Append-only JSONL storage with integrity verification
 */
export class AcpRegistry {
  private basePath: string;
  private subdirs: Record<RegistryType, string>;

  constructor(config: RegistryConfig) {
    this.basePath = config.basePath;
    this.subdirs = { ...DEFAULT_SUBDIRS, ...config.subdirs };
  }

  /**
   * Initialize registry directories
   */
  async initialize(): Promise<void> {
    for (const subdir of Object.values(this.subdirs)) {
      const dir = join(this.basePath, subdir);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * Compute SHA-256 hash for integrity verification
   */
  private computeHash(data: unknown): string {
    const content = JSON.stringify(data);
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Append entry to JSONL file
   */
  async append(type: RegistryEntry["type"], data: unknown): Promise<RegistryEntry> {
    const timestamp = new Date().toISOString();
    const hash = this.computeHash(data);
    const entry: RegistryEntry = {
      id: `${type}-${Date.now()}-${hash.slice(0, 8)}`,
      type,
      timestamp,
      data,
      hash,
    };

    const subdir = this.subdirs[type];
    if (!subdir) {
      throw new Error(`Unknown registry type: ${type}`);
    }

    const filePath = join(this.basePath, subdir, `${type}s.jsonl`);
    await appendFile(filePath, JSON.stringify(entry) + "\n", "utf-8");

    return entry;
  }

  /**
   * Query entries from registry
   */
  async query(type: RegistryEntry["type"], query: RegistryQuery = {}): Promise<RegistryEntry[]> {
    const subdir = this.subdirs[type];
    if (!subdir) {
      throw new Error(`Unknown registry type: ${type}`);
    }

    const filePath = join(this.basePath, subdir, `${type}s.jsonl`);
    
    if (!existsSync(filePath)) {
      return [];
    }

    const content = await readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    const entries: RegistryEntry[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as RegistryEntry;

        // Apply filters
        if (query.since && entry.timestamp < query.since) continue;
        if (query.until && entry.timestamp > query.until) continue;
        if (query.filter && !query.filter(entry)) continue;

        entries.push(entry);
      } catch (error) {
        // Skip malformed entries
        console.error(`Failed to parse registry entry: ${line}`, error);
      }
    }

    // Apply limit (most recent first)
    if (query.limit) {
      return entries.slice(-query.limit);
    }

    return entries;
  }

  /**
   * Get latest entry for a specific type
   */
  async getLatest(type: RegistryEntry["type"]): Promise<RegistryEntry | null> {
    const entries = await this.query(type, { limit: 1 });
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }

  /**
   * Verify registry integrity by checking hashes
   */
  async verifyIntegrity(type: RegistryEntry["type"]): Promise<{
    valid: boolean;
    corrupted: string[];
  }> {
    const entries = await this.query(type);
    const corrupted: string[] = [];

    for (const entry of entries) {
      const computedHash = this.computeHash(entry.data);
      if (computedHash !== entry.hash) {
        corrupted.push(entry.id);
      }
    }

    return {
      valid: corrupted.length === 0,
      corrupted,
    };
  }

  /**
   * Get registry statistics
   */
  async getStats(type: RegistryEntry["type"]): Promise<{
    count: number;
    oldest?: string;
    newest?: string;
    sizeBytes?: number;
  }> {
    const entries = await this.query(type);
    const subdir = this.subdirs[type];
    const filePath = join(this.basePath, subdir, `${type}s.jsonl`);

    let sizeBytes: number | undefined;
    try {
      const stats = await stat(filePath);
      sizeBytes = stats.size;
    } catch {
      sizeBytes = undefined;
    }

    return {
      count: entries.length,
      oldest: entries.length > 0 ? entries[0].timestamp : undefined,
      newest: entries.length > 0 ? entries[entries.length - 1].timestamp : undefined,
      sizeBytes,
    };
  }

  /**
   * Export entries for a time range (for backup or replay)
   */
  async export(
    type: RegistryEntry["type"],
    since?: string,
    until?: string
  ): Promise<RegistryEntry[]> {
    return this.query(type, { since, until });
  }

  /**
   * Replay entries to reconstruct state
   */
  async replay(type: RegistryEntry["type"], handler: (entry: RegistryEntry) => Promise<void>): Promise<void> {
    const entries = await this.query(type);
    for (const entry of entries) {
      await handler(entry);
    }
  }
}

/**
 * Create default ACP registry instance
 */
export function createAcpRegistry(basePath: string): AcpRegistry {
  return new AcpRegistry({ basePath });
}
