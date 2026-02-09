import type {
  VaultAccessLayer,
  VaultFile,
  VaultSearchOptions,
  VaultSearchResult,
} from "../vault-access.js";
import { parseFrontmatter } from "../frontmatter.js";

export type NodeBridgeInvoke = (
  nodeId: string,
  command: string,
  params: Record<string, unknown>,
) => Promise<unknown>;

export class NodeBridgeVaultAccess implements VaultAccessLayer {
  private nodeId: string;
  private remoteVaultPath: string;
  private invokeCommand: NodeBridgeInvoke;

  constructor(nodeId: string, remoteVaultPath: string, invokeCommand: NodeBridgeInvoke) {
    this.nodeId = nodeId;
    this.remoteVaultPath = remoteVaultPath.replace(/\/$/, "");
    this.invokeCommand = invokeCommand;
  }

  getVaultPath(): string {
    return this.remoteVaultPath;
  }

  private buildRemotePath(relativePath: string): string {
    return `${this.remoteVaultPath}/${relativePath}`;
  }

  async readFile(relativePath: string): Promise<VaultFile | null> {
    const result = (await this.invokeCommand(this.nodeId, "vault.read", {
      path: this.buildRemotePath(relativePath),
    })) as { content?: string | null } | null;

    if (!result?.content) {
      return null;
    }
    const parsed = parseFrontmatter(result.content);
    return {
      path: relativePath,
      content: result.content,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      stats: {
        createdAt: new Date(0),
        modifiedAt: new Date(0),
        size: result.content.length,
      },
    };
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    await this.invokeCommand(this.nodeId, "vault.write", {
      path: this.buildRemotePath(relativePath),
      content,
    });
  }

  async appendToFile(relativePath: string, content: string): Promise<void> {
    await this.invokeCommand(this.nodeId, "vault.append", {
      path: this.buildRemotePath(relativePath),
      content,
    });
  }

  async deleteFile(relativePath: string): Promise<void> {
    await this.invokeCommand(this.nodeId, "vault.delete", {
      path: this.buildRemotePath(relativePath),
    });
  }

  async moveFile(oldPath: string, newPath: string): Promise<void> {
    await this.invokeCommand(this.nodeId, "vault.move", {
      oldPath: this.buildRemotePath(oldPath),
      newPath: this.buildRemotePath(newPath),
    });
  }

  async listFiles(directory?: string): Promise<string[]> {
    const result = (await this.invokeCommand(this.nodeId, "vault.list", {
      path: directory ? this.buildRemotePath(directory) : this.remoteVaultPath,
    })) as { files?: string[] } | null;
    return result?.files ?? [];
  }

  async search(query: string, options?: VaultSearchOptions): Promise<VaultSearchResult[]> {
    const result = (await this.invokeCommand(this.nodeId, "vault.search", {
      query,
      folder: options?.folder ? this.buildRemotePath(options.folder) : undefined,
      extensions: options?.extensions,
      limit: options?.limit,
    })) as { results?: VaultSearchResult[] } | null;
    return result?.results ?? [];
  }

  async exists(relativePath: string): Promise<boolean> {
    const result = (await this.invokeCommand(this.nodeId, "vault.exists", {
      path: this.buildRemotePath(relativePath),
    })) as { exists?: boolean } | null;
    return result?.exists ?? false;
  }
}
