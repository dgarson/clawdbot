import crypto from "node:crypto";
import type { MemoryOpsLogger } from "./ops-log/index.js";
import type { QueryIntent } from "./query/index.js";
import type {
  MemorySearchManager,
  MemorySearchResult,
  MemoryProviderStatus,
  MemoryEmbeddingProbeResult,
  MemorySyncProgressUpdate,
} from "./types.js";
import { memLog } from "./memory-log.js";
import { SNIPPET_PREVIEW_LENGTH } from "./ops-log/index.js";

export type ComposableBackendEntry = {
  id: string;
  manager: MemorySearchManager;
  weight: number;
  condition?: (intent: QueryIntent) => boolean;
};

export type ComposableManagerConfig = {
  backends: ComposableBackendEntry[];
  intentParser?: (query: string) => QueryIntent;
  primary?: string; // id of primary backend for readFile/sync
  opsLog?: MemoryOpsLogger;
};

export type ComposableSearchMeta = {
  traceId: string;
  backendAttribution: Record<string, string[]>;
  intent?: QueryIntent;
};

export class ComposableMemoryManager implements MemorySearchManager {
  private readonly backends: ComposableBackendEntry[];
  private readonly intentParser?: (query: string) => QueryIntent;
  private readonly primaryId?: string;
  private readonly opsLog?: MemoryOpsLogger;
  private lastSearchMeta?: ComposableSearchMeta;

  constructor(config: ComposableManagerConfig) {
    this.backends = config.backends;
    this.intentParser = config.intentParser;
    this.primaryId = config.primary;
    this.opsLog = config.opsLog;
  }

  getLastSearchMeta(): ComposableSearchMeta | undefined {
    return this.lastSearchMeta;
  }

  async search(
    query: string,
    opts?: { maxResults?: number; minScore?: number; sessionKey?: string },
  ): Promise<MemorySearchResult[]> {
    const searchStart = Date.now();
    const traceId = crypto.randomUUID();
    const intent = this.intentParser?.(query);

    // Filter backends by routing condition
    const active = this.backends.filter((b) => !b.condition || (intent && b.condition(intent)));

    if (active.length === 0) {
      return [];
    }

    memLog.debug("composable search: fan-out", {
      query: query.slice(0, 80),
      backends: active.map((b) => b.id),
    });

    // Emit query.start
    this.opsLog?.log({
      action: "query.start",
      traceId,
      sessionKey: opts?.sessionKey,
      status: "success",
      detail: {
        query: query.slice(0, 200),
        maxResults: opts?.maxResults,
        minScore: opts?.minScore,
        intent: intent
          ? { entities: intent.entities, topics: intent.topics, timeHints: intent.timeHints }
          : undefined,
        activeBackends: active.map((b) => b.id),
      },
    });

    // Fan-out in parallel
    const settled = await Promise.allSettled(active.map((b) => b.manager.search(query, opts)));

    // Collect results with backend weights + attribution
    type WeightedResult = MemorySearchResult & { _backendWeight: number; _backendId: string };
    const allResults: WeightedResult[] = [];
    const backendAttribution: Record<string, string[]> = {};

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      const backendId = active[i].id;

      if (result.status === "fulfilled") {
        const paths: string[] = [];
        for (const r of result.value) {
          allResults.push({
            ...r,
            sourceBackend: backendId,
            _backendWeight: active[i].weight,
            _backendId: backendId,
          });
          paths.push(r.path);
        }
        backendAttribution[backendId] = paths;

        // Emit per-backend result
        this.opsLog?.log({
          action: "query.backend_result",
          traceId,
          backend: backendId,
          sessionKey: opts?.sessionKey,
          status: "success",
          detail: {
            backend: backendId,
            weight: active[i].weight,
            resultCount: result.value.length,
            results: result.value.map((r) => ({
              path: r.path,
              score: r.score,
              snippetPreview: (r.snippet ?? "").slice(0, SNIPPET_PREVIEW_LENGTH),
              startLine: r.startLine,
              endLine: r.endLine,
            })),
          },
        });
      } else {
        memLog.warn("composable search: backend failed", {
          backend: backendId,
          error: String(result.reason),
        });

        this.opsLog?.log({
          action: "query.backend_result",
          traceId,
          backend: backendId,
          sessionKey: opts?.sessionKey,
          status: "failure",
          detail: {
            backend: backendId,
            weight: active[i].weight,
            resultCount: 0,
            results: [],
            error: String(result.reason),
          },
        });
      }
    }

    // Deduplicate by path+startLine+endLine, keep highest weighted score
    const totalBeforeDedup = allResults.length;
    const deduped = deduplicateResults(allResults);

    // Sort by weighted score, apply maxResults
    const maxResults = opts?.maxResults ?? 6;
    const finalResults = deduped.toSorted((a, b) => b.score - a.score).slice(0, maxResults);

    // Compute per-backend dedup counts
    const byBackend: Record<string, number> = {};
    for (const r of allResults) {
      byBackend[r._backendId] = (byBackend[r._backendId] ?? 0) + 1;
    }

    // Emit query.merged
    this.opsLog?.log({
      action: "query.merged",
      traceId,
      sessionKey: opts?.sessionKey,
      status: "success",
      durationMs: Date.now() - searchStart,
      detail: {
        totalBeforeDedup,
        totalAfterDedup: deduped.length,
        dedupStats: {
          duplicatesRemoved: totalBeforeDedup - deduped.length,
          byBackend,
        },
        finalResults: finalResults.map((r) => ({
          path: r.path,
          score: r.score,
          snippetPreview: (r.snippet ?? "").slice(0, SNIPPET_PREVIEW_LENGTH),
        })),
        backendAttribution,
      },
    });

    this.lastSearchMeta = { traceId, backendAttribution, intent };

    return finalResults;
  }

  async readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<{ text: string; path: string }> {
    const primary = this.getPrimary();
    if (primary) {
      return primary.readFile(params);
    }
    // Try each backend until one succeeds
    for (const b of this.backends) {
      try {
        const result = await b.manager.readFile(params);
        if (result.text) {
          return result;
        }
      } catch {
        // try next
      }
    }
    return { text: "", path: params.relPath };
  }

  status(): MemoryProviderStatus {
    const primary = this.getPrimary();
    const primaryStatus = primary?.status();
    const backendIds = this.backends.map((b) => b.id);
    return {
      backend: primaryStatus?.backend ?? "builtin",
      provider: "composable",
      custom: {
        composable: true,
        backends: backendIds,
        primary: this.primaryId ?? backendIds[0],
        ...primaryStatus?.custom,
      },
    };
  }

  async sync(params?: {
    reason?: string;
    force?: boolean;
    progress?: (update: MemorySyncProgressUpdate) => void;
  }): Promise<void> {
    await Promise.allSettled(this.backends.map((b) => b.manager.sync?.(params)));
  }

  async probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult> {
    const results = await Promise.allSettled(
      this.backends.map((b) => b.manager.probeEmbeddingAvailability()),
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) {
        return { ok: true };
      }
    }
    return { ok: false, error: "no backends have embeddings available" };
  }

  async probeVectorAvailability(): Promise<boolean> {
    const results = await Promise.allSettled(
      this.backends.map((b) => b.manager.probeVectorAvailability()),
    );
    return results.some((r) => r.status === "fulfilled" && r.value);
  }

  async close(): Promise<void> {
    await Promise.allSettled(this.backends.map((b) => b.manager.close?.()));
  }

  private getPrimary(): MemorySearchManager | undefined {
    if (this.primaryId) {
      const found = this.backends.find((b) => b.id === this.primaryId);
      if (found) {
        return found.manager;
      }
    }
    return this.backends[0]?.manager;
  }
}

function deduplicateResults(
  results: Array<MemorySearchResult & { _backendWeight: number; _backendId: string }>,
): MemorySearchResult[] {
  const byKey = new Map<string, MemorySearchResult>();

  for (const r of results) {
    const key = `${r.path}:${r.startLine}:${r.endLine}`;
    const weightedScore = r.score * r._backendWeight;
    const existing = byKey.get(key);

    if (!existing || weightedScore > existing.score) {
      const { _backendWeight: _, _backendId: _bid, ...rest } = r;
      byKey.set(key, { ...rest, score: weightedScore });
    }
  }

  return Array.from(byKey.values());
}
