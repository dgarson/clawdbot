/**
 * WebSocket RPC gateway methods for telemetry queries.
 *
 * Methods registered:
 *   telemetry.sessions      — list sessions with aggregate stats
 *   telemetry.session       — get full session detail by key
 *   telemetry.runs          — list runs with filters
 *   telemetry.run           — get run detail by runId
 *   telemetry.tools         — list tool calls with filters
 *   telemetry.costs         — cost breakdown grouped by dimension
 *   telemetry.subagents     — list subagent spawns
 *   telemetry.tree          — recursive subagent hierarchy for a session
 *   telemetry.messages      — list messages with filters
 *   telemetry.errors        — list errors from runs and tool calls
 *   telemetry.top           — leaderboard for runs/tools/models/sessions
 *   telemetry.model-calls   — list model/LLM API calls
 *   telemetry.usage         — aggregated token/cost summary
 *   telemetry.events        — list raw telemetry events
 *   telemetry.timeline      — ordered event timeline for a session
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Indexer } from "./indexer.js";
import type { CostGroupBy, LeaderboardDimension, SubagentTreeNode } from "./queries.js";
import {
  listRuns,
  getRun,
  getToolCalls,
  getSessionTimeline,
  getUsageSummary,
  listEvents,
  listSessions,
  getSessionDetail,
  getCostBreakdown,
  listSubagents,
  getSubagentTree,
  listMessages,
  listErrors,
  getLeaderboard,
  getModelCalls,
} from "./queries.js";

// ---------------------------------------------------------------------------
// Param coercion helpers
// ---------------------------------------------------------------------------

/** Parse a value as epoch ms. Accepts number (epoch ms) or string (ISO date or numeric string). */
function parseTs(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
    const d = new Date(v).getTime();
    if (!Number.isNaN(d)) return d;
  }
  return undefined;
}

/** Parse a value as a string, returning undefined for non-strings or empty strings. */
function parseStr(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Parse a value as a number, returning the fallback if not a valid number. */
function parseNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

/** Convert epoch ms to ISO 8601 string, returning undefined for null/undefined. */
function tsToIso(ms: number | null | undefined): string | undefined {
  if (ms == null) return undefined;
  return new Date(ms).toISOString();
}

// ---------------------------------------------------------------------------
// Tree construction
// ---------------------------------------------------------------------------

type UiSubagentNode = {
  agentId: string;
  sessionKey?: string;
  parentAgentId?: string;
  children: UiSubagentNode[];
};

/**
 * Convert a flat depth-ordered SubagentTreeNode[] into a nested TelemetrySubagentNode tree.
 * Uses a stack to track parent nodes at each depth level.
 */
function buildSubagentTree(flat: SubagentTreeNode[]): UiSubagentNode[] {
  const roots: UiSubagentNode[] = [];
  // Stack: stack[depth] = last node inserted at that depth
  const stack: UiSubagentNode[] = [];

  for (const node of flat) {
    const uiNode: UiSubagentNode = {
      agentId: node.agentId ?? "unknown",
      sessionKey: node.childSessionKey ?? undefined,
      parentAgentId: undefined,
      children: [],
    };

    if (node.depth === 0) {
      roots.push(uiNode);
    } else {
      // Parent is the node at depth-1 in the stack
      const parent = stack[node.depth - 1];
      if (parent) {
        uiNode.parentAgentId = parent.agentId;
        parent.children.push(uiNode);
      } else {
        // Fallback: orphan nodes go to root
        roots.push(uiNode);
      }
    }

    stack[node.depth] = uiNode;
    // Trim stack entries deeper than current (they're no longer valid parents)
    stack.length = node.depth + 1;
  }

  return roots;
}

// ---------------------------------------------------------------------------
// Gateway method registration
// ---------------------------------------------------------------------------

const INDEXER_UNAVAILABLE = { error: "Telemetry indexer not available" };

/**
 * Register all telemetry WebSocket RPC gateway methods.
 *
 * @param api        - OpenClaw plugin API instance.
 * @param getIndexer - Lazy accessor returning the current Indexer (or null if unavailable).
 */
export function registerTelemetryGatewayMethods(
  api: OpenClawPluginApi,
  getIndexer: () => Indexer | null,
): void {
  // telemetry.sessions — list sessions with aggregate stats
  // Maps SessionSummary → TelemetrySessionSummary
  api.registerGatewayMethod("telemetry.sessions", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const raw = listSessions(indexer.db, {
      agentId: parseStr(p.agent),
      since: parseTs(p.since),
      until: parseTs(p.until),
      limit: parseNum(p.limit, 50),
    });
    const sessions = raw.map((s) => ({
      key: s.sessionKey,
      agentId: s.agentId ?? undefined,
      runCount: s.runCount,
      lastActivity: tsToIso(s.lastActivityAt),
      totalTokens: s.totalTokens,
      totalCost: s.totalCostUsd,
      errorCount: s.errorCount,
      startedAt: tsToIso(s.firstRunAt),
      endedAt: null as string | null,
    }));
    respond(true, { sessions });
  });

  // telemetry.session — get full session detail by key
  // Maps SessionDetail → TelemetrySessionSummary-shaped fields + detail data
  api.registerGatewayMethod("telemetry.session", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const key = parseStr(p.key);
    if (!key) {
      respond(false, { error: "Missing required param: key" });
      return;
    }
    const detail = getSessionDetail(indexer.db, key);
    if (!detail) {
      respond(false, { error: `Session not found: ${key}` });
      return;
    }
    const session = {
      key: detail.sessionKey,
      agentId: detail.agentId ?? undefined,
      runCount: detail.runCount,
      lastActivity: tsToIso(detail.lastActivityAt),
      totalTokens: detail.totalTokens,
      totalCost: detail.totalCostUsd,
      errorCount: detail.errorCount,
      startedAt: tsToIso(detail.firstRunAt),
      endedAt: null as string | null,
      runs: detail.runs,
      subagents: detail.subagents,
      messages: detail.messages,
      modelCostBreakdown: detail.modelCostBreakdown,
    };
    respond(true, { session });
  });

  // telemetry.runs — list runs with filters
  api.registerGatewayMethod("telemetry.runs", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const runs = listRuns(indexer.db, {
      sessionKey: parseStr(p.session),
      agentId: parseStr(p.agent),
      model: parseStr(p.model),
      limit: parseNum(p.limit, 50),
      since: parseTs(p.since),
      until: parseTs(p.until),
    });
    respond(true, { runs });
  });

  // telemetry.run — get run detail by runId
  api.registerGatewayMethod("telemetry.run", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const runId = parseStr(p.runId);
    if (!runId) {
      respond(false, { error: "Missing required param: runId" });
      return;
    }
    const run = getRun(indexer.db, runId);
    if (!run) {
      respond(false, { error: `Run not found: ${runId}` });
      return;
    }
    respond(true, { run });
  });

  // telemetry.tools — list tool calls with filters
  api.registerGatewayMethod("telemetry.tools", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const tools = getToolCalls(indexer.db, {
      runId: parseStr(p.run),
      toolName: parseStr(p.name),
      agentId: parseStr(p.agent),
      sessionKey: parseStr(p.session),
      errorsOnly: p.errorsOnly === true || p.errorsOnly === "true",
      limit: parseNum(p.limit, 50),
    });
    respond(true, { tools });
  });

  // telemetry.costs — cost breakdown grouped by dimension
  // Maps CostBreakdown → TelemetryCostBreakdown
  api.registerGatewayMethod("telemetry.costs", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const raw = getCostBreakdown(indexer.db, {
      groupBy: (parseStr(p.groupBy) ?? "model") as CostGroupBy,
      since: parseTs(p.since),
      until: parseTs(p.until),
      agentId: parseStr(p.agent),
      sessionKey: parseStr(p.session),
      limit: parseNum(p.limit, 50),
    });
    const costs = raw.map((c) => ({
      label: c.groupKey,
      inputTokens: c.inputTokens,
      outputTokens: c.outputTokens,
      cacheTokens: 0,
      inputCost: 0,
      outputCost: 0,
      cacheCost: 0,
      totalCost: c.totalCostUsd,
    }));
    respond(true, { costs });
  });

  // telemetry.subagents — list subagent spawns
  api.registerGatewayMethod("telemetry.subagents", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const subagents = listSubagents(indexer.db, {
      parentSessionKey: parseStr(p.session),
      runId: parseStr(p.run),
      agentId: parseStr(p.agent),
      limit: parseNum(p.limit, 50),
    });
    respond(true, { subagents });
  });

  // telemetry.tree — recursive subagent hierarchy for a session
  // Converts flat SubagentTreeNode[] (with depth) → nested TelemetrySubagentNode[]
  api.registerGatewayMethod("telemetry.tree", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const sessionKey = parseStr(p.sessionKey);
    if (!sessionKey) {
      respond(false, { error: "Missing required param: sessionKey" });
      return;
    }
    const flat = getSubagentTree(indexer.db, sessionKey);
    const tree = buildSubagentTree(flat);
    respond(true, { sessionKey, tree });
  });

  // telemetry.messages — list messages with filters
  api.registerGatewayMethod("telemetry.messages", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const directionRaw = parseStr(p.direction);
    const messages = listMessages(indexer.db, {
      sessionKey: parseStr(p.session),
      direction:
        directionRaw === "inbound" || directionRaw === "outbound" ? directionRaw : undefined,
      channel: parseStr(p.channel),
      agentId: parseStr(p.agent),
      limit: parseNum(p.limit, 50),
    });
    respond(true, { messages });
  });

  // telemetry.errors — list errors from runs and tool calls
  // Maps ErrorEntry → TelemetryErrorEntry
  api.registerGatewayMethod("telemetry.errors", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const raw = listErrors(indexer.db, {
      since: parseTs(p.since),
      sessionKey: parseStr(p.session),
      runId: parseStr(p.run),
      agentId: parseStr(p.agent),
      limit: parseNum(p.limit, 50),
    });
    const errors = raw.map((e) => ({
      timestamp: tsToIso(e.ts) ?? new Date(0).toISOString(),
      source: e.source,
      message: e.errorText,
      runId: e.contextId ?? undefined,
      sessionKey: e.sessionKey ?? undefined,
    }));
    respond(true, { errors });
  });

  // telemetry.top — leaderboard for runs/tools/models/sessions
  // Maps LeaderboardEntry → TelemetryLeaderboardEntry (value is contextual per dimension)
  api.registerGatewayMethod("telemetry.top", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const dimension = parseStr(p.dimension);
    const validDimensions: LeaderboardDimension[] = ["runs", "tools", "models", "sessions"];
    if (!dimension || !validDimensions.includes(dimension as LeaderboardDimension)) {
      respond(false, {
        error: `Invalid or missing dimension. Expected one of: ${validDimensions.join(", ")}`,
      });
      return;
    }
    const dim = dimension as LeaderboardDimension;
    const raw = getLeaderboard(indexer.db, dim, {
      since: parseTs(p.since),
      agentId: parseStr(p.agent),
      limit: parseNum(p.limit, 10),
    });
    // value is contextual: models → totalCostUsd, tools/sessions → count, runs → totalTokens
    const leaderboard = raw.map((entry) => {
      let value: number;
      switch (dim) {
        case "models":
          value = entry.totalCostUsd;
          break;
        case "tools":
          value = entry.count;
          break;
        case "sessions":
          value = entry.count;
          break;
        case "runs":
          value = entry.totalTokens;
          break;
      }
      return {
        label: entry.key,
        value,
        count: entry.count,
      };
    });
    respond(true, { dimension, leaderboard });
  });

  // telemetry.model-calls — list model/LLM API calls
  api.registerGatewayMethod("telemetry.model-calls", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const calls = getModelCalls(indexer.db, {
      runId: parseStr(p.run),
      sessionKey: parseStr(p.session),
      model: parseStr(p.model),
      agentId: parseStr(p.agent),
      limit: parseNum(p.limit, 50),
    });
    respond(true, { calls });
  });

  // telemetry.usage — aggregated token/cost summary
  // Maps UsageSummary + session count + error count → TelemetryUsageSummary
  api.registerGatewayMethod("telemetry.usage", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const filterOpts = {
      since: parseTs(p.since),
      until: parseTs(p.until),
      sessionKey: parseStr(p.session),
      agentId: parseStr(p.agent),
    };
    const raw = getUsageSummary(indexer.db, filterOpts);
    // totalSessions: count distinct sessions from listSessions with same filters
    const sessions = listSessions(indexer.db, {
      agentId: filterOpts.agentId,
      since: filterOpts.since,
      until: filterOpts.until,
      limit: 100_000, // count all
    });
    // errorCount: count errors with same filters
    const errors = listErrors(indexer.db, {
      since: filterOpts.since,
      sessionKey: filterOpts.sessionKey,
      agentId: filterOpts.agentId,
      limit: 100_000, // count all
    });
    const usage = {
      totalSessions: sessions.length,
      totalRuns: raw.totalRuns,
      totalTokens: raw.totalTokens,
      estimatedCost: raw.estimatedCostUsd,
      errorCount: errors.length,
    };
    respond(true, { usage });
  });

  // telemetry.events — list raw telemetry events
  api.registerGatewayMethod("telemetry.events", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const events = listEvents(indexer.db, {
      kind: parseStr(p.kind),
      limit: parseNum(p.limit, 100),
      since: parseTs(p.since),
      until: parseTs(p.until),
      sessionKey: parseStr(p.session),
      agentId: parseStr(p.agent),
      runId: parseStr(p.run),
    });
    respond(true, { events });
  });

  // telemetry.timeline — ordered event timeline for a session
  // Maps timeline events → TelemetryTimelineEvent
  api.registerGatewayMethod("telemetry.timeline", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const sessionKey = parseStr(p.sessionKey);
    if (!sessionKey) {
      respond(false, { error: "Missing required param: sessionKey" });
      return;
    }
    // kinds may be an array of strings or a comma-separated string
    let kinds: string[] | undefined;
    if (Array.isArray(p.kinds)) {
      kinds = p.kinds.filter((k): k is string => typeof k === "string");
    } else if (typeof p.kinds === "string" && p.kinds.length > 0) {
      kinds = p.kinds
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    }
    const raw = getSessionTimeline(indexer.db, sessionKey, {
      limit: parseNum(p.limit, 500),
      kinds,
    });
    const events = raw.map((e) => ({
      id: e.id,
      timestamp: tsToIso(e.ts) ?? new Date(0).toISOString(),
      kind: e.kind,
      data: e.data as Record<string, unknown> | undefined,
    }));
    respond(true, { sessionKey, events });
  });
}
