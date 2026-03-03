/**
 * runtime.quota namespace implementation (#5).
 * Aggregates token/cost usage across sessions matching a scope.
 *
 * Uses a TTL-based cache to avoid O(n) session discovery + disk I/O on every
 * call. The cache is keyed by a serialized scope and expires after CACHE_TTL_MS.
 */

import { discoverAllSessions, loadSessionCostSummary } from "../../infra/session-cost-usage.js";
import type {
  PluginBudgetCheckResult,
  PluginBudgetLimits,
  PluginQuotaNamespace,
  PluginQuotaScope,
  PluginQuotaUsage,
} from "./types.quota.js";

/** How long cached aggregation results remain valid (ms). */
const CACHE_TTL_MS = 30_000;

type CacheEntry = { usage: PluginQuotaUsage; ts: number };

function scopeCacheKey(scope?: PluginQuotaScope): string {
  if (!scope) {
    return "__all__";
  }
  // Deterministic key: sort groupIds for stability.
  const parts = [
    scope.agentId ?? "",
    scope.periodMs !== undefined ? String(scope.periodMs) : "",
    scope.groupIds?.length ? [...scope.groupIds].toSorted().join(",") : "",
  ];
  return parts.join("|");
}

async function aggregateUsage(scope?: PluginQuotaScope): Promise<PluginQuotaUsage> {
  const now = Date.now();
  const startMs = scope?.periodMs !== undefined ? now - scope.periodMs : undefined;

  // Discover sessions, optionally filtered by agentId.
  const sessions = await discoverAllSessions({
    agentId: scope?.agentId,
    startMs,
  });

  const groupIds = scope?.groupIds?.length ? new Set(scope.groupIds) : undefined;

  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalCostUsd = 0;
  let turnCount = 0;

  for (const session of sessions) {
    // Filter by groupIds if specified (group membership is modeled as agentId membership).
    if (groupIds && session.sessionId) {
      const agentPart = session.sessionId.split(":")[1];
      if (agentPart && !groupIds.has(agentPart)) {
        continue;
      }
    }

    const summary = await loadSessionCostSummary({
      sessionFile: session.sessionFile,
      startMs,
    });
    if (!summary) {
      continue;
    }

    totalTokens += summary.totalTokens;
    inputTokens += summary.input;
    outputTokens += summary.output;
    // totalCost is in USD
    totalCostUsd += summary.totalCost;
    turnCount += summary.messageCounts?.user ?? 0;
  }

  return { totalTokens, inputTokens, outputTokens, totalCostUsd, turnCount };
}

export function createRuntimeQuota(): PluginQuotaNamespace {
  const cache = new Map<string, CacheEntry>();

  async function getCachedUsage(scope?: PluginQuotaScope): Promise<PluginQuotaUsage> {
    const key = scopeCacheKey(scope);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      return cached.usage;
    }
    const usage = await aggregateUsage(scope);
    cache.set(key, { usage, ts: now });
    return usage;
  }

  return {
    async getUsage(scope?: PluginQuotaScope): Promise<PluginQuotaUsage> {
      return getCachedUsage(scope);
    },

    async checkBudget(
      scope: PluginQuotaScope,
      limits: PluginBudgetLimits,
    ): Promise<PluginBudgetCheckResult> {
      const usage = await getCachedUsage(scope);

      const tokenRemaining =
        limits.maxTokens !== undefined ? limits.maxTokens - usage.totalTokens : undefined;
      const costRemaining =
        limits.maxCostUsd !== undefined ? limits.maxCostUsd - usage.totalCostUsd : undefined;

      const exceeded =
        (tokenRemaining !== undefined && tokenRemaining < 0) ||
        (costRemaining !== undefined && costRemaining < 0);

      return {
        exceeded,
        usage,
        remaining: {
          tokens: tokenRemaining !== undefined ? Math.max(0, tokenRemaining) : undefined,
          costUsd: costRemaining !== undefined ? Math.max(0, costRemaining) : undefined,
        },
      };
    },
  };
}
