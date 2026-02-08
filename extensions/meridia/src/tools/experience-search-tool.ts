import type { AnyAgentTool, OpenClawConfig } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import { jsonResult, readNumberParam, readStringParam } from "openclaw/plugin-sdk";
import type { RecordQueryResult } from "../meridia/db/backend.js";
import type { MeridiaExperienceRecord } from "../meridia/types.js";
import { createBackend } from "../meridia/db/index.js";
import { searchRecordsByVector } from "../meridia/vector/search.js";

const ExperienceSearchSchema = Type.Object({
  query: Type.Optional(
    Type.String({
      description:
        "Free-text search query. Searches across tool names, evaluation reasons, and record data using FTS5 when available.",
    }),
  ),
  session_key: Type.Optional(
    Type.String({
      description: "Filter results to a specific session key.",
    }),
  ),
  tool_name: Type.Optional(
    Type.String({
      description: "Filter results to a specific tool name.",
    }),
  ),
  min_score: Type.Optional(
    Type.Number({
      description: "Minimum significance score (0-1).",
    }),
  ),
  from: Type.Optional(
    Type.String({
      description: "Start date/time for date range filter (inclusive). ISO string.",
    }),
  ),
  to: Type.Optional(
    Type.String({
      description: "End date/time for date range filter (inclusive). ISO string.",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      description: "Maximum number of results to return. Default: 20. Max: 100.",
    }),
  ),
  recent: Type.Optional(
    Type.Boolean({
      description: "If true, return the most recent records regardless of search query.",
    }),
  ),
  tag: Type.Optional(
    Type.String({
      description: "Filter results to records containing an exact tag.",
    }),
  ),
});

function matchesRecordFilters(
  record: MeridiaExperienceRecord,
  filters: {
    sessionKey?: string;
    toolName?: string;
    minScore?: number;
    from?: string;
    to?: string;
    tag?: string;
  },
): boolean {
  if (filters.sessionKey && record.session?.key !== filters.sessionKey) {
    return false;
  }
  if (filters.toolName && record.tool?.name !== filters.toolName) {
    return false;
  }
  if (filters.minScore !== undefined && record.capture.score < filters.minScore) {
    return false;
  }
  if (filters.from && record.ts < filters.from) {
    return false;
  }
  if (filters.to && record.ts > filters.to) {
    return false;
  }
  if (filters.tag) {
    const tags = record.content?.tags ?? [];
    if (!tags.includes(filters.tag)) {
      return false;
    }
  }
  return true;
}

function mergeRankedResults(params: {
  textResults: RecordQueryResult[];
  vectorResults: Array<{ record: MeridiaExperienceRecord; similarity: number }>;
  limit: number;
}): Array<
  RecordQueryResult & {
    vectorSimilarity?: number;
  }
> {
  const byId = new Map<
    string,
    RecordQueryResult & {
      vectorSimilarity?: number;
    }
  >();

  for (const result of params.textResults) {
    byId.set(result.record.id, { ...result });
  }

  for (const vectorResult of params.vectorResults) {
    const existing = byId.get(vectorResult.record.id);
    if (existing) {
      byId.set(vectorResult.record.id, {
        ...existing,
        vectorSimilarity: Math.max(existing.vectorSimilarity ?? 0, vectorResult.similarity),
      });
      continue;
    }
    byId.set(vectorResult.record.id, {
      record: vectorResult.record,
      vectorSimilarity: vectorResult.similarity,
    });
  }

  const toTextScore = (rank: number | undefined): number => {
    if (rank === undefined || !Number.isFinite(rank)) {
      return 0;
    }
    return 1 / (1 + Math.max(0, rank));
  };

  return Array.from(byId.values())
    .sort((a, b) => {
      const scoreA = Math.max(a.vectorSimilarity ?? 0, toTextScore(a.rank), a.record.capture.score);
      const scoreB = Math.max(b.vectorSimilarity ?? 0, toTextScore(b.rank), b.record.capture.score);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return b.record.ts.localeCompare(a.record.ts);
    })
    .slice(0, params.limit);
}

export function createExperienceSearchTool(opts?: { config?: OpenClawConfig }): AnyAgentTool {
  return {
    label: "ExperienceSearch",
    name: "experience_search",
    description:
      "Search past experiential records from the Meridia continuity engine. " +
      "Query by free text (FTS5), date range, tool name, session, tag, or significance score.",
    parameters: ExperienceSearchSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const query = readStringParam(params, "query");
      const sessionKey = readStringParam(params, "session_key");
      const toolName = readStringParam(params, "tool_name");
      const minScore = readNumberParam(params, "min_score");
      const from = readStringParam(params, "from");
      const to = readStringParam(params, "to");
      const rawLimit = readNumberParam(params, "limit", { integer: true });
      const recent = params.recent === true;
      const tag = readStringParam(params, "tag");
      const limit = Math.min(Math.max(rawLimit ?? 20, 1), 100);

      if (!query && !sessionKey && !toolName && !from && !to && !recent && !tag) {
        return jsonResult({
          error:
            "At least one search criterion is required: query, session_key, tool_name, from/to, tag, or recent=true.",
        });
      }

      try {
        const backend = createBackend({ cfg: opts?.config });

        const filters = {
          sessionKey,
          toolName,
          minScore,
          from: from ?? undefined,
          to: to ?? undefined,
          limit,
          tag,
        };

        let results =
          recent && !query && !from && !to
            ? await backend.getRecentRecords(limit, { sessionKey, toolName, minScore, tag })
            : query
              ? await backend.searchRecords(query, filters)
              : from || to
                ? await backend.getRecordsByDateRange(
                    from ?? "1970-01-01",
                    to ?? new Date().toISOString(),
                    {
                      ...filters,
                      limit,
                    },
                  )
                : sessionKey
                  ? await backend.getRecordsBySession(sessionKey, { limit })
                  : toolName
                    ? await backend.getRecordsByTool(toolName, { limit })
                    : await backend.getRecentRecords(limit, {
                        sessionKey,
                        toolName,
                        minScore,
                        tag,
                      });

        if (query) {
          const vectorResults = (
            await searchRecordsByVector({
              backend,
              cfg: opts?.config,
              query,
              limit,
              minSimilarity: 0.3,
              minScore,
            })
          ).filter((entry) => matchesRecordFilters(entry.record, filters));

          results = mergeRankedResults({
            textResults: results,
            vectorResults,
            limit,
          });
        }

        const stats = await backend.getStats();

        const formatted = results.map((r) => ({
          id: r.record.id,
          timestamp: r.record.ts,
          kind: r.record.kind,
          sessionKey: r.record.session?.key ?? null,
          tool: r.record.tool?.name ?? null,
          isError: r.record.tool?.isError ?? false,
          score: r.record.capture.score,
          threshold: r.record.capture.threshold ?? null,
          evalKind: r.record.capture.evaluation.kind,
          reason: r.record.capture.evaluation.reason ?? null,
          tags: r.record.content?.tags ?? null,
          ...(r.rank !== undefined ? { ftsRank: r.rank } : {}),
          ...("vectorSimilarity" in r
            ? { vectorSimilarity: (r as { vectorSimilarity?: number }).vectorSimilarity ?? null }
            : {}),
          preview:
            r.record.content?.topic ??
            r.record.content?.summary ??
            r.record.capture.evaluation.reason ??
            null,
        }));

        return jsonResult({
          matchCount: formatted.length,
          totalRecords: stats.recordCount,
          dbRange: {
            oldest: stats.oldestRecord,
            newest: stats.newestRecord,
          },
          results: formatted,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResult({
          error: `Experience search failed: ${message}`,
        });
      }
    },
  };
}
