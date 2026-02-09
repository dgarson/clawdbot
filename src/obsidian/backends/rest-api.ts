import type {
  VaultAccessLayer,
  VaultFile,
  VaultSearchOptions,
  VaultSearchResult,
} from "../vault-access.js";
import { parseFrontmatter } from "../frontmatter.js";

export class RestApiVaultAccess implements VaultAccessLayer {
  private baseUrl: string;
  private apiKey?: string;
  private vaultPath?: string;

  constructor(baseUrl: string, apiKey?: string, vaultPath?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.vaultPath = vaultPath;
  }

  getVaultPath(): string {
    return this.vaultPath ?? this.baseUrl;
  }

  private async request(endpoint: string, options?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/markdown",
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options?.headers },
    });
  }

  async readFile(relativePath: string): Promise<VaultFile | null> {
    const res = await this.request(`/vault/${encodeURIComponent(relativePath)}`);
    if (!res.ok) {
      return null;
    }
    const content = await res.text();
    const parsed = parseFrontmatter(content);

    return {
      path: relativePath,
      content,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      stats: {
        createdAt: new Date(0),
        modifiedAt: new Date(0),
        size: content.length,
      },
    };
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const res = await this.request(`/vault/${encodeURIComponent(relativePath)}`, {
      method: "PUT",
      body: content,
    });
    if (!res.ok) {
      throw new Error(`Failed to write ${relativePath}: ${res.status}`);
    }
  }

  async appendToFile(relativePath: string, content: string): Promise<void> {
    const res = await this.request(`/vault/${encodeURIComponent(relativePath)}`, {
      method: "PATCH",
      body: content,
    });
    if (!res.ok) {
      throw new Error(`Failed to append ${relativePath}: ${res.status}`);
    }
  }

  async deleteFile(relativePath: string): Promise<void> {
    const res = await this.request(`/vault/${encodeURIComponent(relativePath)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(`Failed to delete ${relativePath}: ${res.status}`);
    }
  }

  async moveFile(oldPath: string, newPath: string): Promise<void> {
    const existing = await this.readFile(oldPath);
    if (!existing) {
      return;
    }
    await this.writeFile(newPath, existing.content);
    await this.deleteFile(oldPath);
  }

  async listFiles(): Promise<string[]> {
    const res = await this.request("/vault/");
    if (!res.ok) {
      throw new Error(`Failed to list files: ${res.status}`);
    }
    const payload = (await res.json()) as { files?: string[] };
    return payload.files ?? [];
  }

  async search(query: string, options?: VaultSearchOptions): Promise<VaultSearchResult[]> {
    const payload = {
      query,
      folder: options?.folder,
    };
    const res = await this.request("/search/simple/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to search vault: ${res.status}`);
    }
    const data = (await res.json()) as {
      results?: Array<{ path: string; matches?: Array<{ line: number; text: string }> }>;
    };
    const results = data.results ?? [];
    return results.map((result) => ({
      path: result.path,
      matches: result.matches ?? [],
      score: Math.min(1, (result.matches?.length ?? 0) / 10),
    }));
  }

  async exists(relativePath: string): Promise<boolean> {
    const res = await this.request(`/vault/${encodeURIComponent(relativePath)}`);
    return res.ok;
  }
}
