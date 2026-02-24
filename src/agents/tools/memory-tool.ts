import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import type { MemoryCitationsMode } from "../../config/types.memory.js";
import { resolveMemoryBackendConfig } from "../../memory/backend-config.js";
import { estimateUtf8Bytes } from "../../memory/embedding-input-limits.js";
import { getMemorySearchManager } from "../../memory/index.js";
import type { MemorySearchResult } from "../../memory/types.js";
import { parseAgentSessionKey } from "../../routing/session-key.js";
import { estimateUsageCost, resolveModelCostConfig } from "../../utils/usage-format.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import { resolveMemorySearchConfig } from "../memory-search.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

const MemorySearchSchema = Type.Object({
  query: Type.String({
    description:
      "Semantic search query across memory files (MEMORY.md, memory/*.md, session transcripts).",
  }),
  maxResults: Type.Optional(
    Type.Number({ description: "Maximum results to return (default: 10)." }),
  ),
  minScore: Type.Optional(
    Type.Number({
      description:
        "Minimum similarity score (0-1; default: 0.3; higher = fewer but more relevant results).",
    }),
  ),
});

const MemoryGetSchema = Type.Object({
  path: Type.String({
    description: "File path in memory store (e.g. 'MEMORY.md' or 'memory/projects.md').",
  }),
  from: Type.Optional(
    Type.Number({ description: "Starting line number for file excerpt (1-indexed)." }),
  ),
  lines: Type.Optional(
    Type.Number({ description: "Number of lines to read from 'from' position." }),
  ),
});

const MEMORY_RELEVANCE_MIN_RESULT_COUNT = 1;
const MEMORY_SEARCH_LATENCY_BUDGET_MS = 1_000;
const MEMORY_SEARCH_COST_GUARD_USD = 0.001;

type MemorySearchEvaluation = {
  relevance: {
    enabled: true;
    passing: boolean;
    minScoreThreshold: number;
    minResultCount: number;
    resultCount: number;
    topScore: number;
    avgScore: number;
  };
  latency: {
    enabled: true;
    passing: boolean;
    measuredMs: number;
    maxMs: number;
  };
  cost: {
    enabled: true;
    passing: boolean;
    estimatedInputTokens: number;
    estimatedCostUsd?: number;
    maxCostUsd: number;
    provider?: string;
    model?: string;
    unavailable: boolean;
  };
};

function resolveMemoryToolContext(options: { config?: OpenClawConfig; agentSessionKey?: string }) {
  const cfg = options.config;
  if (!cfg) {
    return null;
  }
  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });
  if (!resolveMemorySearchConfig(cfg, agentId)) {
    return null;
  }
  return { cfg, agentId };
}

function estimateQueryInputTokens(query: string): number {
  return Math.max(1, Math.ceil(estimateUtf8Bytes(query) / 4));
}

function evaluateRelevanceGuardrail(
  rawResults: MemorySearchResult[],
  minScore: number,
): MemorySearchEvaluation["relevance"] {
  const resultCount = rawResults.length;
  if (resultCount === 0) {
    return {
      enabled: true,
      passing: false,
      minScoreThreshold: minScore,
      minResultCount: MEMORY_RELEVANCE_MIN_RESULT_COUNT,
      resultCount: 0,
      topScore: 0,
      avgScore: 0,
    };
  }

  const scores = rawResults.map((r) => r.score).filter((score) => Number.isFinite(score));

  if (scores.length === 0) {
    return {
      enabled: true,
      passing: false,
      minScoreThreshold: minScore,
      minResultCount: MEMORY_RELEVANCE_MIN_RESULT_COUNT,
      resultCount,
      topScore: 0,
      avgScore: 0,
    };
  }

  const topScore = Math.max(...scores);
  const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const passing = scores.length >= MEMORY_RELEVANCE_MIN_RESULT_COUNT && topScore >= minScore;

  return {
    enabled: true,
    passing,
    minScoreThreshold: minScore,
    minResultCount: MEMORY_RELEVANCE_MIN_RESULT_COUNT,
    resultCount,
    topScore: Number(topScore.toFixed(4)),
    avgScore: Number(avgScore.toFixed(4)),
  };
}

function evaluateLatencyGuardrail(measuredMs: number): MemorySearchEvaluation["latency"] {
  return {
    enabled: true,
    passing: measuredMs <= MEMORY_SEARCH_LATENCY_BUDGET_MS,
    measuredMs,
    maxMs: MEMORY_SEARCH_LATENCY_BUDGET_MS,
  };
}

function evaluateCostGuardrail(params: {
  query: string;
  provider?: string;
  model?: string;
  config?: OpenClawConfig;
}): MemorySearchEvaluation["cost"] {
  const provider = params.provider?.trim();
  const model = params.model?.trim();
  const estimatedInputTokens = estimateQueryInputTokens(params.query);
  const costConfig = resolveModelCostConfig({
    provider,
    model,
    config: params.config,
  });
  const estimatedCostUsd = estimateUsageCost({
    usage: {
      input: estimatedInputTokens,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    cost: costConfig,
  });

  const unavailable = estimatedCostUsd === undefined;
  const passing = unavailable ? true : estimatedCostUsd <= MEMORY_SEARCH_COST_GUARD_USD;

  return {
    enabled: true,
    passing,
    estimatedInputTokens,
    estimatedCostUsd,
    maxCostUsd: MEMORY_SEARCH_COST_GUARD_USD,
    provider,
    model,
    unavailable,
  };
}

export function createMemorySearchTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const ctx = resolveMemoryToolContext(options);
  if (!ctx) {
    return null;
  }
  const { cfg, agentId } = ctx;
  return {
    label: "Memory Search",
    name: "memory_search",
    description:
      "Mandatory recall step: semantically search MEMORY.md + memory/*.md (and optional session transcripts) before answering questions about prior work, decisions, dates, people, preferences, or todos; returns top snippets with path + lines. If response has disabled=true, memory retrieval is unavailable and should be surfaced to the user.",
    parameters: MemorySearchSchema,
    execute: async (_toolCallId, params) => {
      const startedAt = performance.now();
      const query = readStringParam(params, "query", { required: true });
      const maxResults = readNumberParam(params, "maxResults");
      const minScore = readNumberParam(params, "minScore");
      const { manager, error } = await getMemorySearchManager({
        cfg,
        agentId,
      });
      if (!manager) {
        return jsonResult(buildMemorySearchUnavailableResult(error));
      }
      try {
        const citationsMode = resolveMemoryCitationsMode(cfg);
        const includeCitations = shouldIncludeCitations({
          mode: citationsMode,
          sessionKey: options.agentSessionKey,
        });
        const rawResults = await manager.search(query, {
          maxResults,
          minScore,
          sessionKey: options.agentSessionKey,
        });
        const searchTimingMs = Math.max(0, Math.round(performance.now() - startedAt));
        const status = manager.status();

        const resolved = resolveMemorySearchConfig(cfg, agentId);
        const effectiveMinScore =
          typeof minScore === "number" ? minScore : (resolved?.query.minScore ?? 0);

        const decorated = decorateCitations(rawResults, includeCitations);
        const resolvedBackend = resolveMemoryBackendConfig({ cfg, agentId });
        const results =
          status.backend === "qmd"
            ? clampResultsByInjectedChars(decorated, resolvedBackend.qmd?.limits.maxInjectedChars)
            : decorated;

        const searchMode = (status.custom as { searchMode?: string } | undefined)?.searchMode;
        const evaluation: MemorySearchEvaluation = {
          relevance: evaluateRelevanceGuardrail(results, effectiveMinScore),
          latency: evaluateLatencyGuardrail(searchTimingMs),
          cost: evaluateCostGuardrail({
            query,
            provider: status.requestedProvider ?? status.provider,
            model: status.model,
            config: cfg,
          }),
        };

        return jsonResult({
          results,
          provider: status.provider,
          model: status.model,
          fallback: status.fallback,
          citations: citationsMode,
          mode: searchMode,
          evaluation,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult(buildMemorySearchUnavailableResult(message));
      }
    },
  };
}

export function createMemoryGetTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const ctx = resolveMemoryToolContext(options);
  if (!ctx) {
    return null;
  }
  const { cfg, agentId } = ctx;
  return {
    label: "Memory Get",
    name: "memory_get",
    description:
      "Safe snippet read from MEMORY.md or memory/*.md with optional from/lines; use after memory_search to pull only the needed lines and keep context small.",
    parameters: MemoryGetSchema,
    execute: async (_toolCallId, params) => {
      const relPath = readStringParam(params, "path", { required: true });
      const from = readNumberParam(params, "from", { integer: true });
      const lines = readNumberParam(params, "lines", { integer: true });
      const { manager, error } = await getMemorySearchManager({
        cfg,
        agentId,
      });
      if (!manager) {
        return jsonResult({ path: relPath, text: "", disabled: true, error });
      }
      try {
        const result = await manager.readFile({
          relPath,
          from: from ?? undefined,
          lines: lines ?? undefined,
        });
        return jsonResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ path: relPath, text: "", disabled: true, error: message });
      }
    },
  };
}

function resolveMemoryCitationsMode(cfg: OpenClawConfig): MemoryCitationsMode {
  const mode = cfg.memory?.citations;
  if (mode === "on" || mode === "off" || mode === "auto") {
    return mode;
  }
  return "auto";
}

function decorateCitations(results: MemorySearchResult[], include: boolean): MemorySearchResult[] {
  if (!include) {
    return results.map((entry) => ({ ...entry, citation: undefined }));
  }
  return results.map((entry) => {
    const citation = formatCitation(entry);
    const snippet = `${entry.snippet.trim()}\n\nSource: ${citation}`;
    return { ...entry, citation, snippet };
  });
}

function formatCitation(entry: MemorySearchResult): string {
  const lineRange =
    entry.startLine === entry.endLine
      ? `#L${entry.startLine}`
      : `#L${entry.startLine}-L${entry.endLine}`;
  return `${entry.path}${lineRange}`;
}

function clampResultsByInjectedChars(
  results: MemorySearchResult[],
  budget?: number,
): MemorySearchResult[] {
  if (!budget || budget <= 0) {
    return results;
  }
  let remaining = budget;
  const clamped: MemorySearchResult[] = [];
  for (const entry of results) {
    if (remaining <= 0) {
      break;
    }
    const snippet = entry.snippet ?? "";
    if (snippet.length <= remaining) {
      clamped.push(entry);
      remaining -= snippet.length;
    } else {
      const trimmed = snippet.slice(0, Math.max(0, remaining));
      clamped.push({ ...entry, snippet: trimmed });
      break;
    }
  }
  return clamped;
}

function buildMemorySearchUnavailableResult(error: string | undefined) {
  const reason = (error ?? "memory search unavailable").trim() || "memory search unavailable";
  const isQuotaError = /insufficient_quota|quota|429/.test(reason.toLowerCase());
  const warning = isQuotaError
    ? "Memory search is unavailable because the embedding provider quota is exhausted."
    : "Memory search is unavailable due to an embedding/provider error.";
  const action = isQuotaError
    ? "Top up or switch embedding provider, then retry memory_search."
    : "Check embedding provider configuration and retry memory_search.";
  return {
    results: [],
    disabled: true,
    unavailable: true,
    error: reason,
    warning,
    action,
  };
}

function shouldIncludeCitations(params: {
  mode: MemoryCitationsMode;
  sessionKey?: string;
}): boolean {
  if (params.mode === "on") {
    return true;
  }
  if (params.mode === "off") {
    return false;
  }
  // auto: show citations in direct chats; suppress in groups/channels by default.
  const chatType = deriveChatTypeFromSessionKey(params.sessionKey);
  return chatType === "direct";
}

function deriveChatTypeFromSessionKey(sessionKey?: string): "direct" | "group" | "channel" {
  const parsed = parseAgentSessionKey(sessionKey);
  if (!parsed?.rest) {
    return "direct";
  }
  const tokens = new Set(parsed.rest.toLowerCase().split(":").filter(Boolean));
  if (tokens.has("channel")) {
    return "channel";
  }
  if (tokens.has("group")) {
    return "group";
  }
  return "direct";
}
