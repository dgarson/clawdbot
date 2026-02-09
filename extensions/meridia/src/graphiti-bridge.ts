// Meridia → Graphiti MCP bridge.
//
// Goal: Ingest Meridia experiences into Graphiti as episodes, supporting both:
//  - Direct GraphitiClient.ingestEpisodes (existing path)
//  - Graphiti MCP tool add_memory (new path)
//
// This module provides:
//  - Transformer: MeridiaExperienceRecord -> Graphiti episode payload + MCP add_memory args
//  - Batching/throttling: buffer records into periodic flushes
//  - Integration: addToGraphMemory() chooses MCP vs direct based on config

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { GraphitiClient } from "openclaw/plugin-sdk";
import type { MeridiaExperienceRecord } from "./meridia/types.js";
import { sanitizeExperienceRecord } from "./meridia/sanitize/record.js";

type GraphitiEpisode = {
  id: string;
  kind: "episode";
  text: string;
  tags?: string[];
  provenance?: {
    source?: string;
    temporal?: { observedAt?: string; updatedAt?: string };
  };
  metadata?: Record<string, unknown>;
};

export type AddMemoryArgs = {
  name: string;
  episode_body: string;
  group_id?: string | null;
  source?: "text" | "json" | "message";
  source_description?: string;
  uuid?: string | null;
};

export type GraphitiBridgeConfig = {
  /** Use MCP tool add_memory rather than direct GraphitiClient. Default: false (direct). */
  mcpEnabled: boolean;
  /** Episodes per batch flush. Default: 10. */
  batchSize: number;
  /** Flush interval (ms). Default: 5000. */
  batchIntervalMs: number;
};

function getBridgeConfig(cfg: OpenClawConfig | undefined): GraphitiBridgeConfig {
  const graphitiCfg = cfg?.memory?.graphiti;

  // Support both requested config keys and existing schema.
  // Requested:
  //  - graphiti.mcp.enabled
  //  - graphiti.batch.size
  //  - graphiti.batch.intervalMs
  // In OpenClaw config tree this maps to `memory.graphiti.*`.
  const mcpEnabled = Boolean((graphitiCfg as any)?.mcp?.enabled);
  const batchSizeRaw = (graphitiCfg as any)?.batch?.size;
  const intervalRaw = (graphitiCfg as any)?.batch?.intervalMs;

  const batchSize =
    typeof batchSizeRaw === "number" && Number.isFinite(batchSizeRaw) && batchSizeRaw > 0
      ? Math.floor(batchSizeRaw)
      : 10;

  const batchIntervalMs =
    typeof intervalRaw === "number" && Number.isFinite(intervalRaw) && intervalRaw > 0
      ? Math.floor(intervalRaw)
      : 5_000;

  return { mcpEnabled, batchSize, batchIntervalMs };
}

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

function buildEpisodeText(record: MeridiaExperienceRecord): string {
  const parts = [record.content?.topic, record.content?.summary, record.content?.context]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0);
  return parts.join("\n\n");
}

export function meridiaRecordToGraphitiEpisode(params: {
  record: MeridiaExperienceRecord;
  source: string;
  groupId?: string;
}): { episode: GraphitiEpisode; traceId: string } {
  const sanitizedRecord = sanitizeExperienceRecord(params.record);
  const text = buildEpisodeText(sanitizedRecord);

  const episode: GraphitiEpisode = {
    id: sanitizedRecord.id,
    kind: "episode",
    text,
    tags: sanitizedRecord.content?.tags ?? [],
    provenance: {
      source: params.source,
      temporal: {
        observedAt: sanitizedRecord.ts,
        updatedAt: sanitizedRecord.ts,
      },
    },
    metadata: {
      toolName: sanitizedRecord.tool?.name,
      sessionKey: sanitizedRecord.session?.key,
      score: sanitizedRecord.capture.score,
      ...(params.groupId ? { groupId: params.groupId } : {}),
    },
  };

  return { episode, traceId: `meridia-${sanitizedRecord.id.slice(0, 8)}` };
}

export function meridiaRecordToAddMemoryArgs(params: {
  record: MeridiaExperienceRecord;
  groupId?: string;
  sourceDescription?: string;
}): AddMemoryArgs {
  const sanitizedRecord = sanitizeExperienceRecord(params.record);

  // Prefer full JSON for Graphiti episode building so relationships can be extracted.
  // Graphiti MCP add_memory expects JSON *string* when source='json'.
  const episodeBodyObject = {
    ...sanitizedRecord,
    // Ensure any consumers have a stable root key if desired.
    _kind: "meridia_experience_record",
  };

  const toolName = sanitizedRecord.tool?.name ?? "unknown";
  const sessionKey = sanitizedRecord.session?.key;

  const source_description =
    params.sourceDescription ??
    [
      "Meridia experience capture",
      toolName ? `tool=${toolName}` : undefined,
      sessionKey ? `session=${sessionKey}` : undefined,
    ]
      .filter(Boolean)
      .join(" | ");

  return {
    name: sanitizedRecord.content?.topic ?? `Meridia: ${toolName}`,
    episode_body: JSON.stringify(episodeBodyObject),
    group_id: params.groupId ?? null,
    source: "json",
    source_description,
    uuid: sanitizedRecord.id,
  };
}

async function ingestEpisodesDirect(params: {
  episodes: GraphitiEpisode[];
  cfg: OpenClawConfig;
  traceId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const client = buildGraphitiClient(params.cfg);
  if (!client) {
    return { ok: false, error: "Graphiti not enabled" };
  }

  const result = await client.ingestEpisodes({
    episodes: params.episodes,
    traceId: params.traceId,
  });
  return { ok: result.ok !== false, error: result.ok === false ? result.error : undefined };
}

async function ingestEpisodesViaMcp(_params: {
  records: MeridiaExperienceRecord[];
  cfg: OpenClawConfig;
  sourceDescription?: string;
  groupId?: string;
}): Promise<{ ok: boolean; error?: string; partialFailures?: string[] }> {
  // NOTE: This runs inside the OpenClaw runtime where MCP tools are available.
  // We intentionally do a dynamic lookup to avoid hard dependencies.
  const anyGlobal = globalThis as any;
  const mcpAddMemory = anyGlobal?.mcp__graphiti__add_memory;

  if (typeof mcpAddMemory !== "function") {
    return { ok: false, error: "Graphiti MCP tool add_memory is not available in this runtime" };
  }

  const failures: string[] = [];

  // MCP tool is one-episode-per-call; batching happens at the bridge buffer level.
  await Promise.all(
    _params.records.map(async (r) => {
      const args = meridiaRecordToAddMemoryArgs({
        record: r,
        groupId: _params.groupId,
        sourceDescription: _params.sourceDescription,
      });

      try {
        await mcpAddMemory({
          name: args.name,
          episode_body: args.episode_body,
          group_id: args.group_id,
          source: args.source,
          source_description: args.source_description,
          uuid: args.uuid,
        });
      } catch (err) {
        failures.push(`${r.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),
  );

  if (failures.length > 0) {
    return { ok: false, error: "Partial failures ingesting via MCP", partialFailures: failures };
  }

  return { ok: true };
}

export type AddToGraphMemoryResult =
  | {
      ok: true;
      mode: "direct" | "mcp";
      ingested: number;
    }
  | {
      ok: false;
      mode: "direct" | "mcp";
      ingested: number;
      error: string;
      partialFailures?: string[];
    };

export async function addToGraphMemory(params: {
  records: MeridiaExperienceRecord[];
  cfg: OpenClawConfig | undefined;
  source?: string;
  groupId?: string;
  sourceDescription?: string;
}): Promise<AddToGraphMemoryResult> {
  const cfg = params.cfg;
  if (!cfg) {
    return { ok: false, mode: "direct", ingested: 0, error: "No config" };
  }
  if (!cfg.memory?.graphiti?.enabled) {
    return { ok: false, mode: "direct", ingested: 0, error: "Graphiti not enabled" };
  }

  const bridgeCfg = getBridgeConfig(cfg);
  const source = params.source ?? "meridia.graphiti-bridge";

  // Filter out records without content.
  const usable = params.records
    .map((r) => sanitizeExperienceRecord(r))
    .filter((r) => buildEpisodeText(r).trim().length > 0);

  if (usable.length === 0) {
    return {
      ok: false,
      mode: bridgeCfg.mcpEnabled ? "mcp" : "direct",
      ingested: 0,
      error: "No text content",
    };
  }

  if (bridgeCfg.mcpEnabled) {
    const result = await ingestEpisodesViaMcp({
      records: usable,
      cfg,
      sourceDescription: params.sourceDescription,
      groupId: params.groupId,
    });
    if (!result.ok) {
      return {
        ok: false,
        mode: "mcp",
        ingested: usable.length - (result.partialFailures?.length ?? usable.length),
        error: result.error ?? "Unknown MCP ingest error",
        partialFailures: result.partialFailures,
      };
    }
    return { ok: true, mode: "mcp", ingested: usable.length };
  }

  const episodes = usable.map(
    (r) => meridiaRecordToGraphitiEpisode({ record: r, source, groupId: params.groupId }).episode,
  );
  const traceId = `meridia-batch-${usable[0]?.id?.slice(0, 8) ?? "unknown"}`;
  const direct = await ingestEpisodesDirect({ episodes, cfg, traceId });
  if (!direct.ok) {
    return {
      ok: false,
      mode: "direct",
      ingested: 0,
      error: direct.error ?? "Unknown Graphiti error",
    };
  }
  return { ok: true, mode: "direct", ingested: episodes.length };
}

// ────────────────────────────────────────────────────────────────────────────
// Batching / throttling
// ────────────────────────────────────────────────────────────────────────────

export type GraphitiBridge = {
  addRecord(record: MeridiaExperienceRecord): void;
  flush(): Promise<AddToGraphMemoryResult | null>;
  stop(): void;
};

export function createGraphitiBridge(params: {
  cfg: OpenClawConfig | undefined;
  source?: string;
  groupId?: string;
  sourceDescription?: string;
}): GraphitiBridge {
  const pending: MeridiaExperienceRecord[] = [];
  const cfg = params.cfg;
  const bridgeCfg = getBridgeConfig(cfg);

  let timer: NodeJS.Timeout | null = null;
  let flushing = false;

  async function flushInternal(): Promise<AddToGraphMemoryResult | null> {
    if (!cfg) {
      pending.length = 0;
      return {
        ok: false,
        mode: bridgeCfg.mcpEnabled ? "mcp" : "direct",
        ingested: 0,
        error: "No config",
      };
    }
    if (pending.length === 0) {
      return null;
    }
    if (flushing) {
      return null;
    }

    flushing = true;
    try {
      const batch = pending.splice(0, bridgeCfg.batchSize);
      return await addToGraphMemory({
        records: batch,
        cfg,
        source: params.source,
        groupId: params.groupId,
        sourceDescription: params.sourceDescription,
      });
    } finally {
      flushing = false;
    }
  }

  function ensureTimer() {
    if (timer) return;
    timer = setInterval(() => {
      void flushInternal().then((res) => {
        if (res && !res.ok) {
          // eslint-disable-next-line no-console
          console.warn(`[graphiti-bridge] flush failed: ${res.error}`);
        }
      });
    }, bridgeCfg.batchIntervalMs);
  }

  return {
    addRecord(record: MeridiaExperienceRecord) {
      if (!record?.id) return;
      pending.push(record);
      ensureTimer();

      // If we reach batch size, flush soon (async, non-blocking).
      if (pending.length >= bridgeCfg.batchSize) {
        void flushInternal().then((res) => {
          if (res && !res.ok) {
            // eslint-disable-next-line no-console
            console.warn(`[graphiti-bridge] flush failed: ${res.error}`);
          }
        });
      }
    },
    async flush() {
      return await flushInternal();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
