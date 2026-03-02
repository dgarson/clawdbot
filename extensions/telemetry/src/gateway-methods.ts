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
 *   telemetry.session_trace — comprehensive chronological session trace
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
  countSessions,
  countErrors,
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

type SessionKeyRow = { session_key: string | null };
type CountRow = { cnt: number };

function findSessionKeyBySessionId(db: Indexer["db"], sessionId: string): string | undefined {
  const row = db
    .prepare<unknown[], SessionKeyRow>(
      `SELECT session_key
       FROM events
       WHERE session_id = ?
         AND session_key IS NOT NULL
         AND session_key != 'unknown'
       ORDER BY ts DESC
       LIMIT 1`,
    )
    .get(sessionId);
  return row?.session_key ?? undefined;
}

function sessionKeyExists(db: Indexer["db"], sessionKey: string): boolean {
  const runRow = db
    .prepare<unknown[], CountRow>("SELECT COUNT(*) as cnt FROM runs WHERE session_key = ?")
    .get(sessionKey);
  if ((runRow?.cnt ?? 0) > 0) {
    return true;
  }

  const eventRow = db
    .prepare<unknown[], CountRow>(
      `SELECT COUNT(*) as cnt
       FROM events
       WHERE session_key = ? AND session_key != 'unknown'`,
    )
    .get(sessionKey);
  return (eventRow?.cnt ?? 0) > 0;
}

function countTimelineEvents(db: Indexer["db"], sessionKey: string): number {
  const row = db
    .prepare<unknown[], CountRow>(
      `SELECT COUNT(*) as cnt
       FROM (
         SELECT id FROM events WHERE session_key = ?
         UNION
         SELECT id
         FROM events
         WHERE session_key IS NULL
           AND run_id IN (SELECT run_id FROM runs WHERE session_key = ?)
       )`,
    )
    .get(sessionKey, sessionKey);
  return row?.cnt ?? 0;
}

function listAllRunsForSession(db: Indexer["db"], sessionKey: string) {
  const pageSize = 500;
  let offset = 0;
  const rows: ReturnType<typeof listRuns> = [];
  while (true) {
    const chunk = listRuns(db, { sessionKey, limit: pageSize, offset });
    if (chunk.length === 0) {
      break;
    }
    rows.push(...chunk);
    if (chunk.length < pageSize) {
      break;
    }
    offset += pageSize;
  }
  return rows;
}

function listAllToolCallsForRun(db: Indexer["db"], runId: string) {
  const pageSize = 500;
  let offset = 0;
  const rows: ReturnType<typeof getToolCalls> = [];
  while (true) {
    const chunk = getToolCalls(db, { runId, limit: pageSize, offset });
    if (chunk.length === 0) {
      break;
    }
    rows.push(...chunk);
    if (chunk.length < pageSize) {
      break;
    }
    offset += pageSize;
  }
  return rows;
}

function listAllModelCallsForRun(db: Indexer["db"], runId: string) {
  const pageSize = 500;
  let offset = 0;
  const rows: ReturnType<typeof getModelCalls> = [];
  while (true) {
    const chunk = getModelCalls(db, { runId, limit: pageSize, offset });
    if (chunk.length === 0) {
      break;
    }
    rows.push(...chunk);
    if (chunk.length < pageSize) {
      break;
    }
    offset += pageSize;
  }
  return rows;
}

function listAllSubagentsForSession(db: Indexer["db"], sessionKey: string) {
  const pageSize = 500;
  let offset = 0;
  const rows: ReturnType<typeof listSubagents> = [];
  while (true) {
    const chunk = listSubagents(db, {
      parentSessionKey: sessionKey,
      limit: pageSize,
      offset,
    });
    if (chunk.length === 0) {
      break;
    }
    rows.push(...chunk);
    if (chunk.length < pageSize) {
      break;
    }
    offset += pageSize;
  }
  return rows;
}

function listAllMessagesForSession(db: Indexer["db"], sessionKey: string) {
  const pageSize = 500;
  let offset = 0;
  const rows: ReturnType<typeof listMessages> = [];
  while (true) {
    const chunk = listMessages(db, {
      sessionKey,
      limit: pageSize,
      offset,
    });
    if (chunk.length === 0) {
      break;
    }
    rows.push(...chunk);
    if (chunk.length < pageSize) {
      break;
    }
    offset += pageSize;
  }
  return rows;
}

function listAllErrorsForSession(db: Indexer["db"], sessionKey: string) {
  const pageSize = 500;
  let offset = 0;
  const rows: ReturnType<typeof listErrors> = [];
  while (true) {
    const chunk = listErrors(db, {
      sessionKey,
      limit: pageSize,
      offset,
    });
    if (chunk.length === 0) {
      break;
    }
    rows.push(...chunk);
    if (chunk.length < pageSize) {
      break;
    }
    offset += pageSize;
  }
  return rows;
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
    const costs = raw.map((c) => {
      const totalTok =
        c.inputTokens + c.outputTokens + (c.cacheReadTokens ?? 0) + (c.cacheWriteTokens ?? 0);
      const inputCost = totalTok > 0 ? (c.inputTokens / totalTok) * c.totalCostUsd : 0;
      const outputCost = totalTok > 0 ? (c.outputTokens / totalTok) * c.totalCostUsd : 0;
      const cacheTokens = (c.cacheReadTokens ?? 0) + (c.cacheWriteTokens ?? 0);
      const cacheCost = totalTok > 0 ? (cacheTokens / totalTok) * c.totalCostUsd : 0;
      return {
        label: c.groupKey,
        inputTokens: c.inputTokens,
        outputTokens: c.outputTokens,
        cacheTokens,
        inputCost,
        outputCost,
        cacheCost,
        totalCost: c.totalCostUsd,
      };
    });
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
  // Defaults to last 7 days when no `since` is provided.
  api.registerGatewayMethod("telemetry.usage", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }
    const p = params as Record<string, unknown>;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const filterOpts = {
      since: parseTs(p.since) ?? Date.now() - SEVEN_DAYS_MS,
      until: parseTs(p.until),
      sessionKey: parseStr(p.session),
      agentId: parseStr(p.agent),
    };
    const raw = getUsageSummary(indexer.db, filterOpts);
    // Use COUNT queries — O(index scan), no row materialisation
    const totalSessions = countSessions(indexer.db, {
      sessionKey: filterOpts.sessionKey,
      agentId: filterOpts.agentId,
      since: filterOpts.since,
      until: filterOpts.until,
    });
    const errorCount = countErrors(indexer.db, {
      since: filterOpts.since,
      sessionKey: filterOpts.sessionKey,
      agentId: filterOpts.agentId,
    });
    const usage = {
      totalSessions,
      totalRuns: raw.totalRuns,
      totalTokens: raw.totalTokens,
      estimatedCost: raw.estimatedCostUsd,
      errorCount,
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

  // telemetry.session_trace — full chronological session trace.
  //
  // Disclaimer: this method is intentionally verbose and can return very large
  // payloads for long-running sessions. Use targeted methods (`telemetry.timeline`,
  // `telemetry.run`, `telemetry.model-calls`) when you only need a subset.
  api.registerGatewayMethod("telemetry.session_trace", ({ params, respond }) => {
    const indexer = getIndexer();
    if (!indexer) {
      respond(false, INDEXER_UNAVAILABLE);
      return;
    }

    const p = params as Record<string, unknown>;
    const inputSessionKey = parseStr(p.sessionKey) ?? parseStr(p.key) ?? parseStr(p.session);
    const inputSessionId = parseStr(p.sessionId) ?? parseStr(p.id);
    if (!inputSessionKey && !inputSessionId) {
      respond(false, {
        error:
          "Missing required session identifier. Provide one of: sessionKey, key, session, sessionId, id",
      });
      return;
    }

    let resolvedSessionKey = inputSessionKey;
    let resolvedFrom: "sessionKey" | "sessionId" | "sessionValue" = "sessionKey";
    if (!resolvedSessionKey && inputSessionId) {
      resolvedSessionKey = findSessionKeyBySessionId(indexer.db, inputSessionId);
      resolvedFrom = "sessionId";
    }
    if (!resolvedSessionKey && inputSessionKey) {
      // Allow callers to pass either key or id via `session`.
      resolvedSessionKey = findSessionKeyBySessionId(indexer.db, inputSessionKey);
      resolvedFrom = "sessionValue";
    }

    if (!resolvedSessionKey) {
      respond(false, {
        error: `Unable to resolve session key from identifier: ${inputSessionId ?? inputSessionKey}`,
      });
      return;
    }
    if (!sessionKeyExists(indexer.db, resolvedSessionKey)) {
      respond(false, { error: `Session not found: ${resolvedSessionKey}` });
      return;
    }

    const timelineCount = countTimelineEvents(indexer.db, resolvedSessionKey);
    const timelineRows =
      timelineCount > 0
        ? getSessionTimeline(indexer.db, resolvedSessionKey, { limit: timelineCount })
        : [];
    const timeline = timelineRows.map((e) => ({
      id: e.id,
      ts: e.ts,
      timestamp: tsToIso(e.ts) ?? new Date(0).toISOString(),
      kind: e.kind,
      runId: e.runId ?? undefined,
      data: e.data as Record<string, unknown> | undefined,
    }));

    const runSummaries = listAllRunsForSession(indexer.db, resolvedSessionKey)
      .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
      .map((run) => ({
        ...run,
        startedAtIso: tsToIso(run.startedAt),
        endedAtIso: tsToIso(run.endedAt),
      }));
    const runs = runSummaries
      .map((run) => getRun(indexer.db, run.runId))
      .filter((run): run is NonNullable<typeof run> => !!run)
      .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
      .map((run) => {
        const toolCalls = listAllToolCallsForRun(indexer.db, run.runId);
        const modelCalls = listAllModelCallsForRun(indexer.db, run.runId);
        return {
          ...run,
          startedAtIso: tsToIso(run.startedAt),
          endedAtIso: tsToIso(run.endedAt),
          toolCalls: toolCalls
            .slice()
            .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
            .map((tool) => ({
              ...tool,
              startedAtIso: tsToIso(tool.startedAt),
              endedAtIso: tsToIso(tool.endedAt),
            })),
          modelCalls: modelCalls
            .slice()
            .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
            .map((call) => ({
              ...call,
              timestamp: tsToIso(call.ts),
            })),
        };
      });

    const sessionDetail = getSessionDetail(indexer.db, resolvedSessionKey);
    const subagents = listAllSubagentsForSession(indexer.db, resolvedSessionKey)
      .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
      .map((subagent) => ({
        ...subagent,
        startedAtIso: tsToIso(subagent.startedAt),
        endedAtIso: tsToIso(subagent.endedAt),
      }));
    const messages = listAllMessagesForSession(indexer.db, resolvedSessionKey)
      .sort((a, b) => a.ts - b.ts)
      .map((message) => ({
        ...message,
        timestamp: tsToIso(message.ts),
      }));
    const errors = listAllErrorsForSession(indexer.db, resolvedSessionKey)
      .sort((a, b) => a.ts - b.ts)
      .map((error) => ({
        ...error,
        timestamp: tsToIso(error.ts),
      }));

    const trace = {
      disclaimer:
        "This response is intentionally verbose and may be large for long sessions. Prefer targeted telemetry methods when possible.",
      session: {
        requested: {
          sessionKey: inputSessionKey,
          sessionId: inputSessionId,
        },
        resolvedSessionKey,
        resolvedFrom,
      },
      summary: sessionDetail
        ? {
            sessionKey: sessionDetail.sessionKey,
            agentId: sessionDetail.agentId,
            runCount: sessionDetail.runCount,
            firstRunAt: sessionDetail.firstRunAt,
            firstRunAtIso: tsToIso(sessionDetail.firstRunAt),
            lastActivityAt: sessionDetail.lastActivityAt,
            lastActivityAtIso: tsToIso(sessionDetail.lastActivityAt),
            totalTokens: sessionDetail.totalTokens,
            toolCallCount: sessionDetail.toolCallCount,
            totalDurationMs: sessionDetail.totalDurationMs,
            errorCount: sessionDetail.errorCount,
            totalCostUsd: sessionDetail.totalCostUsd,
          }
        : undefined,
      usage: getUsageSummary(indexer.db, { sessionKey: resolvedSessionKey }),
      costs: {
        byModel: getCostBreakdown(indexer.db, {
          groupBy: "model",
          sessionKey: resolvedSessionKey,
          limit: Number.MAX_SAFE_INTEGER,
        }),
        byProvider: getCostBreakdown(indexer.db, {
          groupBy: "provider",
          sessionKey: resolvedSessionKey,
          limit: Number.MAX_SAFE_INTEGER,
        }),
      },
      counts: {
        timeline: timeline.length,
        runs: runs.length,
        subagents: subagents.length,
        messages: messages.length,
        errors: errors.length,
      },
      timeline,
      runSummaries,
      runs,
      subagents,
      messages,
      errors,
    };

    respond(true, { trace });
  });
}
