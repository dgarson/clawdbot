// Async graph and vector fanout for Meridia records.
// Extracted from compaction handler to enable per-capture dispatch.

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import crypto from "node:crypto";
import {
  GraphitiClient,
  extractEntitiesFromEpisodes,
  writeEntitiesToGraph,
} from "openclaw/plugin-sdk";
import type { MeridiaDbBackend } from "./db/backend.js";
import type { MeridiaExperienceRecord } from "./types.js";
import { RetryQueue } from "./fanout/retry-queue.js";
import { sanitizeExperienceRecord } from "./sanitize/record.js";
import { indexRecordVector } from "./vector/search.js";

export type FanoutTarget = "graphiti" | "vector";

export type FanoutResult = {
  target: FanoutTarget;
  success: boolean;
  error?: string;
  durationMs: number;
};

export type EnqueueGraphFanoutResult = {
  enqueued: boolean;
  duplicate?: boolean;
  reason?: "missing_config" | "graphiti_disabled" | "queue_full";
};

type EpisodePayload = {
  id: string;
  text: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  timeRange?: { from: string; to: string };
  ts?: string;
};

type SingleGraphFanoutOptions = {
  groupId?: string;
  source?: string;
};

type GraphFanoutJob = {
  record: MeridiaExperienceRecord;
  cfg: OpenClawConfig;
  options?: SingleGraphFanoutOptions;
};

// ────────────────────────────────────────────────────────────────────────────
// Graph Fanout
// ────────────────────────────────────────────────────────────────────────────

function buildGraphitiClient(cfg: OpenClawConfig): GraphitiClient | null {
  if (!cfg.memory?.graphiti?.enabled) {
    return null;
  }
  return new GraphitiClient({
    host: cfg.memory.graphiti.host,
    servicePort: cfg.memory.graphiti.servicePort,
    apiKey: cfg.memory.graphiti.apiKey,
    timeoutMs: cfg.memory.graphiti.timeoutMs ?? 30_000,
  });
}

/** Push a single record to the knowledge graph. */
export async function fanoutToGraph(
  record: MeridiaExperienceRecord,
  cfg: OpenClawConfig | undefined,
  options?: SingleGraphFanoutOptions,
): Promise<FanoutResult> {
  const start = performance.now();
  if (!cfg) {
    return { target: "graphiti", success: false, error: "No config", durationMs: 0 };
  }

  const client = buildGraphitiClient(cfg);
  if (!client) {
    return {
      target: "graphiti",
      success: false,
      error: "Graphiti not enabled",
      durationMs: performance.now() - start,
    };
  }

  try {
    const sanitizedRecord = sanitizeExperienceRecord(record);
    const source = options?.source ?? "meridia-capture";
    const groupId = options?.groupId;
    const text = [
      sanitizedRecord.content?.topic,
      sanitizedRecord.content?.summary,
      sanitizedRecord.content?.context,
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!text.trim()) {
      return {
        target: "graphiti",
        success: false,
        error: "No text content to push",
        durationMs: performance.now() - start,
      };
    }

    const result = await client.ingestEpisodes({
      episodes: [
        {
          id: sanitizedRecord.id,
          kind: "episode" as const,
          text,
          tags: sanitizedRecord.content?.tags ?? [],
          provenance: {
            source,
            temporal: { observedAt: sanitizedRecord.ts, updatedAt: sanitizedRecord.ts },
          },
          metadata: {
            toolName: sanitizedRecord.tool?.name,
            sessionKey: sanitizedRecord.session?.key,
            score: sanitizedRecord.capture.score,
            ...(groupId ? { groupId } : {}),
          },
        },
      ],
      traceId: `capture-${sanitizedRecord.id.slice(0, 8)}`,
    });

    if (result.ok !== false && cfg.memory?.entityExtraction?.enabled !== false) {
      try {
        const extraction = extractEntitiesFromEpisodes(
          [
            {
              id: sanitizedRecord.id,
              kind: "episode",
              text,
            },
          ],
          {
            enabled: cfg.memory?.entityExtraction?.enabled,
            minTextLength: cfg.memory?.entityExtraction?.minTextLength,
            maxEntitiesPerEpisode: cfg.memory?.entityExtraction?.maxEntitiesPerEpisode,
          },
        );

        if (extraction.entities.length > 0) {
          const writeResult = await writeEntitiesToGraph({
            entities: extraction.entities,
            relations: extraction.relations,
            client,
          });
          if (writeResult.warnings.length > 0) {
            // eslint-disable-next-line no-console
            console.warn(
              `[fanout] Entity extraction warnings: ${writeResult.warnings.map((w: { message: string }) => w.message).join("; ")}`,
            );
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[fanout] Entity extraction failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      target: "graphiti",
      success: result.ok !== false,
      error: result.ok === false ? (result.error ?? "Unknown error") : undefined,
      durationMs: performance.now() - start,
    };
  } catch (err) {
    return {
      target: "graphiti",
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: performance.now() - start,
    };
  }
}

const graphFanoutQueue = new RetryQueue<GraphFanoutJob>(
  async (job) => {
    const result = await fanoutToGraph(job.record, job.cfg, job.options);
    const nonRetryableErrors = new Set([
      "No config",
      "Graphiti not enabled",
      "No text content to push",
    ]);
    return {
      success: result.success,
      retryable: result.error ? !nonRetryableErrors.has(result.error) : true,
      error: result.error,
    };
  },
  {
    concurrency: 2,
    maxQueueSize: 256,
    maxAttempts: 4,
    baseBackoffMs: 300,
    maxBackoffMs: 5_000,
    jitterFactor: 0.2,
  },
);

/**
 * Queue an individual captured record for async Graphiti linking.
 * Deduplicates by record ID and retries transient failures with backoff.
 */
export function enqueueGraphFanout(params: {
  record: MeridiaExperienceRecord;
  cfg?: OpenClawConfig;
  options?: SingleGraphFanoutOptions;
}): EnqueueGraphFanoutResult {
  if (!params.cfg) {
    return { enqueued: false, reason: "missing_config" };
  }
  if (!params.cfg.memory?.graphiti?.enabled) {
    return { enqueued: false, reason: "graphiti_disabled" };
  }

  const queued = graphFanoutQueue.enqueue(params.record.id, {
    record: params.record,
    cfg: params.cfg,
    options: params.options,
  });
  if (!queued.enqueued) {
    return { enqueued: false, reason: "queue_full" };
  }
  return { enqueued: true, duplicate: queued.duplicate };
}

/** Push a batch of episodes to the knowledge graph (used by compaction). */
export async function fanoutBatchToGraph(
  episodes: EpisodePayload[],
  cfg: OpenClawConfig | undefined,
  groupId: string = "meridia-experiences",
): Promise<FanoutResult> {
  const start = performance.now();
  if (!cfg) {
    return { target: "graphiti", success: false, error: "No config", durationMs: 0 };
  }

  const client = buildGraphitiClient(cfg);
  if (!client) {
    return {
      target: "graphiti",
      success: false,
      error: "Graphiti not enabled",
      durationMs: performance.now() - start,
    };
  }

  try {
    const contentObjects = episodes.map((ep) => ({
      id: ep.id,
      kind: "episode" as const,
      text: ep.text,
      tags: ep.tags ?? [],
      provenance: {
        source: "meridia-compaction",
        temporal: {
          observedAt: ep.timeRange?.from ?? ep.ts,
          updatedAt: ep.ts,
        },
      },
      metadata: { groupId, ...ep.metadata },
    }));

    const result = await client.ingestEpisodes({
      episodes: contentObjects,
      traceId: `compaction-${crypto.randomUUID().slice(0, 8)}`,
    });

    if (!result.ok) {
      return {
        target: "graphiti",
        success: false,
        error: result.error ?? "Unknown Graphiti error",
        durationMs: performance.now() - start,
      };
    }

    // Entity extraction (best-effort)
    if (cfg.memory?.entityExtraction?.enabled !== false) {
      try {
        const entityContent = contentObjects.map((c) => ({
          id: c.id,
          kind: c.kind,
          text: c.text,
        }));
        const entityCfg = cfg.memory?.entityExtraction;
        const extraction = extractEntitiesFromEpisodes(entityContent, {
          enabled: entityCfg?.enabled,
          minTextLength: entityCfg?.minTextLength,
          maxEntitiesPerEpisode: entityCfg?.maxEntitiesPerEpisode,
        });

        if (extraction.entities.length > 0) {
          const writeResult = await writeEntitiesToGraph({
            entities: extraction.entities,
            relations: extraction.relations,
            client,
          });
          if (writeResult.warnings.length > 0) {
            // eslint-disable-next-line no-console
            console.warn(
              `[fanout] Entity extraction warnings: ${writeResult.warnings.map((w: { message: string }) => w.message).join("; ")}`,
            );
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[fanout] Entity extraction failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { target: "graphiti", success: true, durationMs: performance.now() - start };
  } catch (err) {
    return {
      target: "graphiti",
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: performance.now() - start,
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Vector Fanout
// ────────────────────────────────────────────────────────────────────────────

/** Dispatch a record for embedding + vector indexing. */
export async function fanoutToVector(
  record: MeridiaExperienceRecord,
  cfg: OpenClawConfig | undefined,
  backend: MeridiaDbBackend,
): Promise<FanoutResult> {
  const start = performance.now();
  const sanitizedRecord = sanitizeExperienceRecord(record);
  const result = await indexRecordVector({
    backend,
    cfg,
    record: sanitizedRecord,
  });
  return {
    target: "vector",
    success: result.indexed,
    error: result.error,
    durationMs: performance.now() - start,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Fire-and-Forget Dispatch
// ────────────────────────────────────────────────────────────────────────────

/** Fire-and-forget wrapper: logs errors, never throws. */
export function dispatchFanout(fn: () => Promise<FanoutResult>, label: string): void {
  fn().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn(
      `[fanout:${label}] dispatch error: ${err instanceof Error ? err.message : String(err)}`,
    );
  });
}
