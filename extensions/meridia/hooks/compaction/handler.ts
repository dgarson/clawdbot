import type { OpenClawConfig } from "openclaw/plugin-sdk";
import crypto from "node:crypto";
import path from "node:path";
import {
  GraphitiClient,
  extractEntitiesFromEpisodes,
  writeEntitiesToGraph,
} from "openclaw/plugin-sdk";
import type { MeridiaExperienceRecord, MeridiaTraceEvent } from "../../src/meridia/types.js";
import { resolveMeridiaPluginConfig } from "../../src/meridia/config.js";
import { createBackend } from "../../src/meridia/db/index.js";
import { resolveMeridiaDir, dateKeyUtc } from "../../src/meridia/paths.js";
import { appendJsonl, resolveTraceJsonlPath, writeJson } from "../../src/meridia/storage.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type HookEvent = {
  type: string;
  action: string;
  timestamp: Date;
  sessionKey?: string;
  context?: unknown;
};

type CompactionStrategy = "scheduled" | "on_demand" | "session_based";

type CompactionConfig = {
  enabled: boolean;
  strategy: CompactionStrategy;
  scheduleIntervalHours: number;
  minExperiencesForCompaction: number;
  similarityThreshold: number;
  maxExperiencesPerEpisode: number;
  archiveCompactedRecords: boolean;
  graphiti: {
    enabled: boolean;
    groupId: string;
  };
};

type ExperienceGroup = {
  key: string;
  records: MeridiaExperienceRecord[];
  topic: string;
  toolNames: string[];
  sessionKeys: string[];
  avgScore: number;
  timeRange: { from: string; to: string };
};

type SynthesizedEpisode = {
  id: string;
  ts: string;
  groupKey: string;
  topic: string;
  summary: string;
  sourceRecordIds: string[];
  sourceCount: number;
  toolsInvolved: string[];
  sessionsInvolved: string[];
  avgSignificance: number;
  timeRange: { from: string; to: string };
  tags: string[];
  metadata: Record<string, unknown>;
};

type CompactionResult = {
  success: boolean;
  episodesCreated: number;
  recordsCompacted: number;
  recordsArchived: number;
  graphitiPushed: boolean;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function resolveHookConfig(
  cfg: OpenClawConfig | undefined,
  hookKey: string,
): Record<string, unknown> | undefined {
  const entry = cfg?.hooks?.internal?.entries?.[hookKey] as Record<string, unknown> | undefined;
  return entry && typeof entry === "object" ? entry : undefined;
}

function readNumber(
  hookCfg: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  if (!hookCfg) return fallback;
  const val = hookCfg[key];
  if (typeof val === "number" && Number.isFinite(val) && val > 0) {
    return val;
  }
  if (typeof val === "string") {
    const parsed = Number(val.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

function readString(
  hookCfg: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  if (!hookCfg) return fallback;
  const val = hookCfg[key];
  if (typeof val === "string" && val.trim()) {
    return val.trim();
  }
  return fallback;
}

function readBoolean(
  hookCfg: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean,
): boolean {
  if (!hookCfg) return fallback;
  const val = hookCfg[key];
  if (typeof val === "boolean") {
    return val;
  }
  return fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolveCompactionConfig(hookCfg: Record<string, unknown> | undefined): CompactionConfig {
  const graphitiCfg = asObject(hookCfg?.graphiti) ?? {};
  return {
    enabled: readBoolean(hookCfg, "enabled", false),
    strategy: readString(hookCfg, "strategy", "scheduled") as CompactionStrategy,
    scheduleIntervalHours: readNumber(hookCfg, "scheduleIntervalHours", 4),
    minExperiencesForCompaction: readNumber(hookCfg, "minExperiencesForCompaction", 5),
    similarityThreshold: readNumber(hookCfg, "similarityThreshold", 0.7),
    maxExperiencesPerEpisode: readNumber(hookCfg, "maxExperiencesPerEpisode", 20),
    archiveCompactedRecords: readBoolean(hookCfg, "archiveCompactedRecords", true),
    graphiti: {
      enabled: readBoolean(graphitiCfg, "enabled", true),
      groupId: readString(graphitiCfg, "groupId", "meridia-experiences"),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Experience Grouping
// ─────────────────────────────────────────────────────────────────────────────

function extractTopic(record: MeridiaExperienceRecord): string {
  if (record.content?.topic) return record.content.topic;
  if (record.content?.summary) {
    // Extract first meaningful phrase as topic
    const summary = record.content.summary;
    const firstSentence = summary.split(/[.!?]/)[0]?.trim();
    return firstSentence && firstSentence.length < 100 ? firstSentence : summary.slice(0, 80);
  }
  if (record.tool?.name) return `Tool: ${record.tool.name}`;
  return record.kind;
}

function computeGroupKey(record: MeridiaExperienceRecord): string {
  // Group by primary tool or topic
  const tool = record.tool?.name ?? "unknown";
  const kindPrefix = record.kind === "tool_result" ? "tool" : record.kind;
  return `${kindPrefix}:${tool}`;
}

function groupExperiences(
  records: MeridiaExperienceRecord[],
  maxPerGroup: number,
): ExperienceGroup[] {
  const groups = new Map<string, MeridiaExperienceRecord[]>();

  for (const record of records) {
    const key = computeGroupKey(record);
    const existing = groups.get(key) ?? [];
    if (existing.length < maxPerGroup) {
      existing.push(record);
      groups.set(key, existing);
    }
  }

  const result: ExperienceGroup[] = [];

  for (const [key, recs] of groups) {
    if (recs.length === 0) continue;

    const toolNames = [...new Set(recs.map((r) => r.tool?.name).filter(Boolean) as string[])];
    const sessionKeys = [...new Set(recs.map((r) => r.session?.key).filter(Boolean) as string[])];
    const scores = recs.map((r) => r.capture.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const timestamps = recs.map((r) => r.ts).sort();
    const topics = recs.map(extractTopic);
    const mostCommonTopic =
      topics.sort(
        (a, b) => topics.filter((t) => t === b).length - topics.filter((t) => t === a).length,
      )[0] ?? key;

    result.push({
      key,
      records: recs,
      topic: mostCommonTopic,
      toolNames,
      sessionKeys,
      avgScore,
      timeRange: {
        from: timestamps[0] ?? nowIso(),
        to: timestamps[timestamps.length - 1] ?? nowIso(),
      },
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Episode Synthesis
// ─────────────────────────────────────────────────────────────────────────────

function synthesizeEpisode(group: ExperienceGroup): SynthesizedEpisode {
  const id = crypto.randomUUID();
  const ts = nowIso();

  // Build comprehensive summary
  const summaryParts: string[] = [];
  const uniqueTopics = [...new Set(group.records.map(extractTopic))];

  if (uniqueTopics.length === 1) {
    summaryParts.push(uniqueTopics[0]);
  } else if (uniqueTopics.length <= 3) {
    summaryParts.push(`Topics: ${uniqueTopics.join(", ")}`);
  } else {
    summaryParts.push(`${uniqueTopics.length} related topics around "${group.topic}"`);
  }

  if (group.toolNames.length > 0) {
    summaryParts.push(`Tools: ${group.toolNames.join(", ")}`);
  }

  summaryParts.push(`${group.records.length} experiences consolidated`);
  summaryParts.push(`Avg significance: ${group.avgScore.toFixed(2)}`);

  // Collect tags from all records
  const allTags = new Set<string>();
  for (const record of group.records) {
    for (const tag of record.content?.tags ?? []) {
      allTags.add(tag);
    }
  }

  // Collect anchors and facets
  const anchors: string[] = [];
  const emotions: string[] = [];
  const consequences: string[] = [];

  for (const record of group.records) {
    if (record.content?.anchors) {
      anchors.push(...record.content.anchors);
    }
    if (record.content?.facets?.emotions) {
      emotions.push(...record.content.facets.emotions);
    }
    if (record.content?.facets?.consequences) {
      consequences.push(...record.content.facets.consequences);
    }
  }

  return {
    id,
    ts,
    groupKey: group.key,
    topic: group.topic,
    summary: summaryParts.join(". "),
    sourceRecordIds: group.records.map((r) => r.id),
    sourceCount: group.records.length,
    toolsInvolved: group.toolNames,
    sessionsInvolved: group.sessionKeys,
    avgSignificance: group.avgScore,
    timeRange: group.timeRange,
    tags: [...allTags],
    metadata: {
      anchors: [...new Set(anchors)].slice(0, 10),
      emotions: [...new Set(emotions)].slice(0, 5),
      consequences: [...new Set(consequences)].slice(0, 5),
      compactedAt: ts,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Graphiti Integration
// ─────────────────────────────────────────────────────────────────────────────

async function pushToGraphiti(
  episodes: SynthesizedEpisode[],
  cfg: OpenClawConfig | undefined,
  groupId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!cfg?.memory?.graphiti?.enabled) {
    return { success: false, error: "Graphiti not enabled in config" };
  }

  try {
    const client = new GraphitiClient({
      serverHost: cfg.memory.graphiti.serverHost,
      servicePort: cfg.memory.graphiti.servicePort,
      apiKey: cfg.memory.graphiti.apiKey,
      timeoutMs: cfg.memory.graphiti.timeoutMs ?? 30_000,
    });

    // Convert synthesized episodes to Graphiti content format
    const contentObjects = episodes.map((ep) => ({
      id: ep.id,
      kind: "episode" as const,
      text: `${ep.topic}\n\n${ep.summary}`,
      tags: ep.tags,
      provenance: {
        source: "meridia-compaction",
        temporal: {
          observedAt: ep.timeRange.from,
          updatedAt: ep.ts,
        },
      },
      metadata: {
        groupId,
        sourceCount: ep.sourceCount,
        sourceRecordIds: ep.sourceRecordIds,
        toolsInvolved: ep.toolsInvolved,
        sessionsInvolved: ep.sessionsInvolved,
        avgSignificance: ep.avgSignificance,
        ...ep.metadata,
      },
    }));

    const result = await client.ingestEpisodes({
      episodes: contentObjects,
      traceId: `compaction-${crypto.randomUUID().slice(0, 8)}`,
    });

    if (!result.ok) {
      return { success: false, error: result.error ?? "Unknown Graphiti error" };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compaction Core
// ─────────────────────────────────────────────────────────────────────────────

async function runCompaction(
  cfg: OpenClawConfig | undefined,
  compactionCfg: CompactionConfig,
  meridiaDir: string,
): Promise<CompactionResult> {
  const backend = createBackend({ cfg, hookKey: "compaction" });

  // Get candidates for compaction (experiences from > 1 hour ago, not yet compacted)
  const lookbackHours = compactionCfg.scheduleIntervalHours;
  const now = new Date();
  const cutoff = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const oldRecords = await backend.getRecordsByDateRange(
    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days back
    cutoff.toISOString(),
    { minScore: 0.5, limit: 500 },
  );

  const candidates = oldRecords.map((r) => r.record);

  if (candidates.length < compactionCfg.minExperiencesForCompaction) {
    return {
      success: true,
      episodesCreated: 0,
      recordsCompacted: 0,
      recordsArchived: 0,
      graphitiPushed: false,
    };
  }

  // Group experiences by similarity
  const groups = groupExperiences(candidates, compactionCfg.maxExperiencesPerEpisode);

  // Filter groups that meet minimum size
  const viableGroups = groups.filter(
    (g) => g.records.length >= Math.min(2, compactionCfg.minExperiencesForCompaction),
  );

  if (viableGroups.length === 0) {
    return {
      success: true,
      episodesCreated: 0,
      recordsCompacted: 0,
      recordsArchived: 0,
      graphitiPushed: false,
    };
  }

  // Synthesize episodes
  const episodes = viableGroups.map(synthesizeEpisode);

  // Push to Graphiti if enabled
  let graphitiPushed = false;
  if (compactionCfg.graphiti.enabled) {
    const graphitiResult = await pushToGraphiti(episodes, cfg, compactionCfg.graphiti.groupId);
    graphitiPushed = graphitiResult.success;
    if (!graphitiResult.success) {
      // eslint-disable-next-line no-console
      console.warn(`[compaction] Graphiti push failed: ${graphitiResult.error}`);
    }

    // Entity extraction on compacted episodes — extract entities from summaries
    // and write to Graphiti graph for knowledge graph enrichment
    if (graphitiPushed && cfg?.memory?.entityExtraction?.enabled !== false) {
      try {
        const contentObjects = episodes.map((ep) => ({
          id: ep.id,
          kind: "episode" as const,
          text: `${ep.topic}\n\n${ep.summary}`,
        }));

        const entityCfg = cfg?.memory?.entityExtraction;
        const extraction = extractEntitiesFromEpisodes(contentObjects, {
          enabled: entityCfg?.enabled,
          minTextLength: entityCfg?.minTextLength,
          maxEntitiesPerEpisode: entityCfg?.maxEntitiesPerEpisode,
        });

        if (extraction.entities.length > 0) {
          const client = new GraphitiClient({
            serverHost: cfg?.memory?.graphiti?.serverHost,
            servicePort: cfg?.memory?.graphiti?.servicePort,
            apiKey: cfg?.memory?.graphiti?.apiKey,
            timeoutMs: cfg?.memory?.graphiti?.timeoutMs ?? 30_000,
          });

          const writeResult = await writeEntitiesToGraph({
            entities: extraction.entities,
            relations: extraction.relations,
            client,
          });

          if (writeResult.warnings.length > 0) {
            // eslint-disable-next-line no-console
            console.warn(
              `[compaction] Entity extraction warnings: ${writeResult.warnings.map((w: { message: string }) => w.message).join("; ")}`,
            );
          }
        }
      } catch (err) {
        // Entity extraction errors should not block compaction
        // eslint-disable-next-line no-console
        console.warn(
          `[compaction] Entity extraction failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // Archive or mark compacted records
  const compactedRecordIds = episodes.flatMap((e) => e.sourceRecordIds);
  let recordsArchived = 0;

  if (compactionCfg.archiveCompactedRecords) {
    // Store compaction metadata for audit trail
    const dateKey = dateKeyUtc(now);
    const archivePath = path.join(
      meridiaDir,
      "compaction-archive",
      dateKey,
      `${nowIso().replaceAll(":", "-")}.json`,
    );
    await writeJson(archivePath, {
      ts: nowIso(),
      episodes,
      compactedRecordIds,
      graphitiPushed,
    });
    recordsArchived = compactedRecordIds.length;
  }

  // Store compacted episodes as Meridia records for local continuity
  for (const episode of episodes) {
    const record: MeridiaExperienceRecord = {
      id: episode.id,
      ts: episode.ts,
      kind: "precompact", // Using precompact as synthesized episode marker
      session: undefined,
      tool: {
        name: "compaction",
        callId: `compact-${episode.id.slice(0, 8)}`,
        isError: false,
      },
      capture: {
        score: episode.avgSignificance,
        evaluation: {
          kind: "heuristic",
          score: episode.avgSignificance,
          reason: `Synthesized from ${episode.sourceCount} experiences`,
        },
      },
      content: {
        topic: episode.topic,
        summary: episode.summary,
        tags: episode.tags,
      },
      data: {
        summary: episode,
      },
    };

    try {
      backend.insertExperienceRecord(record);
    } catch {
      // ignore
    }
  }

  return {
    success: true,
    episodesCreated: episodes.length,
    recordsCompacted: compactedRecordIds.length,
    recordsArchived,
    graphitiPushed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-compaction Snapshot (Original Behavior)
// ─────────────────────────────────────────────────────────────────────────────

async function handlePrecompact(
  event: HookEvent,
  context: Record<string, unknown>,
  cfg: OpenClawConfig | undefined,
  meridiaDir: string,
): Promise<void> {
  const sessionId = typeof context.sessionId === "string" ? context.sessionId : undefined;
  const sessionKey = typeof context.sessionKey === "string" ? context.sessionKey : event.sessionKey;
  const runId = typeof context.runId === "string" ? context.runId : undefined;

  const tracePath = resolveTraceJsonlPath({ meridiaDir, date: event.timestamp });
  const ts = nowIso();
  const writeTraceJsonl = resolveMeridiaPluginConfig(cfg).debug.writeTraceJsonl;

  const dateKey = dateKeyUtc(event.timestamp);
  const snapshotDir = path.join(meridiaDir, "snapshots", dateKey);
  const snapshotPath = path.join(
    snapshotDir,
    `${ts.replaceAll(":", "-")}-${sessionId ?? "unknown"}.json`,
  );

  const snapshot = {
    ts,
    sessionId,
    sessionKey,
    runId,
    assistantTextCount: context.assistantTextCount,
    assistantTextsTail: context.assistantTextsTail,
    toolMetaCount: context.toolMetaCount,
    toolMetasTail: context.toolMetasTail,
    lastToolError: context.lastToolError,
  };
  await writeJson(snapshotPath, snapshot);

  const recordId = crypto.randomUUID();
  const record: MeridiaExperienceRecord = {
    id: recordId,
    ts,
    kind: "precompact",
    session: { id: sessionId, key: sessionKey, runId },
    tool: { name: "precompact", callId: `precompact-${recordId.slice(0, 8)}`, isError: false },
    capture: {
      score: 1,
      evaluation: {
        kind: "heuristic",
        score: 1,
        reason: "precompact_snapshot",
      },
    },
    content: {
      summary: "Pre-compaction snapshot",
    },
    data: { snapshot },
  };

  const traceEvent: MeridiaTraceEvent = {
    id: crypto.randomUUID(),
    ts,
    kind: "precompact_snapshot",
    session: { id: sessionId, key: sessionKey, runId },
    paths: { snapshotPath },
    decision: { decision: "capture", recordId },
  };

  try {
    const backend = createBackend({ cfg, hookKey: "compaction" });
    backend.insertExperienceRecord(record);
    backend.insertTraceEvent(traceEvent);
  } catch {
    // ignore
  }

  if (writeTraceJsonl) {
    await appendJsonl(tracePath, traceEvent);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

const handler = async (event: HookEvent): Promise<void> => {
  if (event.type !== "agent") {
    return;
  }

  const validActions = [
    "precompact",
    "compaction:end",
    "compaction:scheduled",
    "compaction:manual",
  ];
  if (!validActions.includes(event.action)) {
    return;
  }

  const context = asObject(event.context) ?? {};
  const cfg = (context.cfg as OpenClawConfig | undefined) ?? undefined;
  const hookCfg = resolveHookConfig(cfg, "compaction");
  if (hookCfg?.enabled !== true) {
    return;
  }

  const compactionCfg = resolveCompactionConfig(hookCfg);
  const meridiaDir = resolveMeridiaDir(cfg, "compaction");
  const tracePath = resolveTraceJsonlPath({ meridiaDir, date: event.timestamp });
  const ts = nowIso();
  const writeTraceJsonl = resolveMeridiaPluginConfig(cfg).debug.writeTraceJsonl;

  const sessionId = typeof context.sessionId === "string" ? context.sessionId : undefined;
  const sessionKey = typeof context.sessionKey === "string" ? context.sessionKey : event.sessionKey;
  const runId = typeof context.runId === "string" ? context.runId : undefined;

  // Handle pre-compaction snapshot
  if (event.action === "precompact") {
    await handlePrecompact(event, context, cfg, meridiaDir);
    return;
  }

  // Handle compaction triggers
  if (
    event.action === "compaction:end" ||
    event.action === "compaction:scheduled" ||
    event.action === "compaction:manual"
  ) {
    const result = await runCompaction(cfg, compactionCfg, meridiaDir);

    const traceEvent: MeridiaTraceEvent = {
      id: crypto.randomUUID(),
      ts,
      kind: "compaction_end",
      session: { id: sessionId, key: sessionKey, runId },
      decision: {
        decision: result.success ? "capture" : "error",
        ...(result.error ? { error: result.error } : {}),
      },
    };

    try {
      const backend = createBackend({ cfg, hookKey: "compaction" });
      backend.insertTraceEvent(traceEvent);
    } catch {
      // ignore
    }

    if (writeTraceJsonl) {
      await appendJsonl(tracePath, {
        ...traceEvent,
        compactionResult: result,
      });
    }

    // Log result summary
    if (result.episodesCreated > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[compaction] Created ${result.episodesCreated} episodes from ${result.recordsCompacted} records` +
          (result.graphitiPushed ? " (pushed to Graphiti)" : ""),
      );
    }
  }
};

export default handler;
