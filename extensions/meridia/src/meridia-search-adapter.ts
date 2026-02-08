import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { MeridiaDbBackend, RecordQueryResult } from "./meridia/db/backend.js";
import { isMeridiaUri, resolveKitUri } from "./meridia/kit/resolver.js";
import {
  probeEmbeddingProviderAvailability,
  probeVectorBackendAvailability,
  searchRecordsByVector,
} from "./meridia/vector/search.js";

// Types duck-typed to match core MemorySearchManager interface

type MemorySearchResult = {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: "memory";
  citation?: string;
};

type MemoryProviderStatus = {
  backend: "builtin" | "qmd";
  provider: string;
  custom?: Record<string, unknown>;
};

type MemoryEmbeddingProbeResult = { ok: boolean; error?: string };

function buildMeridiaSnippet(result: RecordQueryResult): string {
  const r = result.record;
  const parts: string[] = [];
  if (r.content?.topic) {
    parts.push(r.content.topic);
  }
  if (r.content?.summary) {
    parts.push(r.content.summary);
  }
  if (r.content?.context) {
    parts.push(r.content.context);
  }
  // Include phenomenology in snippet when available
  if (r.phenomenology?.emotionalSignature?.primary?.length) {
    parts.push(`[${r.phenomenology.emotionalSignature.primary.join(", ")}]`);
  }
  if (r.phenomenology?.engagementQuality) {
    parts.push(`(${r.phenomenology.engagementQuality})`);
  }
  if (parts.length === 0 && r.kind) {
    parts.push(`[${r.kind}]`);
  }
  return parts.join(" — ").slice(0, 700);
}

export class MeridiaSearchAdapter {
  constructor(
    private backend: MeridiaDbBackend,
    private config?: OpenClawConfig,
  ) {}

  async search(
    query: string,
    opts?: { maxResults?: number; minScore?: number; sessionKey?: string },
  ): Promise<MemorySearchResult[]> {
    const textResults = await this.backend.searchRecords(query, {
      limit: opts?.maxResults ?? 6,
      minScore: opts?.minScore,
      sessionKey: opts?.sessionKey,
    });

    const vectorResults = (
      await searchRecordsByVector({
        backend: this.backend,
        cfg: this.config,
        query,
        limit: opts?.maxResults ?? 6,
        minSimilarity: 0.3,
        minScore: opts?.minScore,
      })
    ).filter((entry) => (opts?.sessionKey ? entry.record.session?.key === opts.sessionKey : true));

    const byId = new Map<
      string,
      RecordQueryResult & {
        vectorSimilarity?: number;
      }
    >();

    for (const result of textResults) {
      byId.set(result.record.id, result);
    }
    for (const vectorResult of vectorResults) {
      const existing = byId.get(vectorResult.record.id);
      if (existing) {
        byId.set(vectorResult.record.id, {
          ...existing,
          vectorSimilarity: Math.max(existing.vectorSimilarity ?? 0, vectorResult.similarity),
        });
      } else {
        byId.set(vectorResult.record.id, {
          record: vectorResult.record,
          vectorSimilarity: vectorResult.similarity,
        });
      }
    }

    const ranked = Array.from(byId.values()).sort((a, b) => {
      const scoreA = Math.max(a.vectorSimilarity ?? 0, a.record.capture.score);
      const scoreB = Math.max(b.vectorSimilarity ?? 0, b.record.capture.score);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return b.record.ts.localeCompare(a.record.ts);
    });

    return ranked.map((r) => ({
      path: `meridia://${r.record.id}`,
      startLine: 0,
      endLine: 0,
      score: Math.max(r.vectorSimilarity ?? 0, r.rank ?? 0, r.record.capture.score ?? 0.5),
      snippet: buildMeridiaSnippet(r),
      source: "memory" as const,
      citation: `[meridia:${r.record.id}]`,
    }));
  }

  /**
   * Resolve meridia:// URIs to rendered experience kit text.
   * This makes stored experience kits inspectable via the virtual FS.
   */
  async readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<{ text: string; path: string }> {
    const { relPath } = params;

    // Check for meridia:// URI scheme
    if (isMeridiaUri(relPath)) {
      const result = await resolveKitUri(relPath, this.backend);
      if (result) {
        return result;
      }
    }

    // Also handle bare IDs (e.g. from search results that strip the scheme)
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidLike.test(relPath)) {
      const result = await resolveKitUri(`meridia://${relPath}`, this.backend);
      if (result) {
        return result;
      }
    }

    return { text: "", path: "" };
  }

  async status(): Promise<MemoryProviderStatus> {
    const stats = await this.backend.getStats();
    return {
      backend: "builtin",
      provider: "meridia",
      custom: {
        type: "meridia",
        recordCount: stats.recordCount,
        traceCount: stats.traceCount,
        sessionCount: stats.sessionCount,
      },
    };
  }

  async sync(): Promise<void> {
    // no-op
  }

  async probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult> {
    return probeEmbeddingProviderAvailability(this.config);
  }

  async probeVectorAvailability(): Promise<boolean> {
    return probeVectorBackendAvailability({
      backend: this.backend,
      cfg: this.config,
    });
  }

  async close(): Promise<void> {
    await this.backend.close();
  }
}
