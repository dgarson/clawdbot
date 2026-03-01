/**
 * Telemetry HTTP API routes registered via api.registerHttpRoute().
 *
 * Routes:
 *   GET /telemetry/runs           → listRuns (query params: session, limit, since, until)
 *   GET /telemetry/runs/:runId    → getRun
 *   GET /telemetry/tools          → getToolCalls (query params: run, name, limit)
 *   GET /telemetry/timeline/:key  → getSessionTimeline (query params: limit, kinds)
 *   GET /telemetry/usage          → getUsageSummary (query params: since, until, session)
 *   GET /telemetry/events         → listEvents (query params: kind, limit, since, session)
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Indexer } from "./indexer.js";
import {
  listRuns,
  getRun,
  getToolCalls,
  getSessionTimeline,
  getUsageSummary,
  listEvents,
} from "./queries.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a query string into a plain object of string values.
 */
function parseQuery(url: string): Record<string, string> {
  const qIdx = url.indexOf("?");
  if (qIdx === -1) return {};
  const qs = url.slice(qIdx + 1);
  const result: Record<string, string> = {};
  for (const part of qs.split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      result[decodeURIComponent(part)] = "";
    } else {
      result[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1));
    }
  }
  return result;
}

/**
 * Parse an optional date/epoch parameter into epoch ms.
 */
function parseDate(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isNaN(n)) return n;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.getTime();
  return undefined;
}

/**
 * Send a JSON response.
 */
function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Extract a named path segment following a prefix.
 * e.g. extractPathParam("/telemetry/runs/abc123", "/telemetry/runs/") → "abc123"
 */
function extractPathParam(url: string, prefix: string): string | null {
  const path = url.split("?")[0];
  if (!path.startsWith(prefix)) return null;
  const param = path.slice(prefix.length);
  return param || null;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register all /telemetry/* HTTP routes.
 */
export function registerTelemetryRoutes(api: OpenClawPluginApi, getIndexer: () => Indexer | null): void {
  // GET /telemetry/runs
  api.registerHttpRoute({
    path: "/telemetry/runs",
    handler: (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== "GET") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      // Skip if this is /telemetry/runs/<id>
      const url = req.url ?? "";
      const path = url.split("?")[0];
      if (path !== "/telemetry/runs" && !path.startsWith("/telemetry/runs?")) {
        // Let the runs/:runId handler deal with it
        return;
      }
      const indexer = getIndexer();
      if (!indexer) {
        json(res, 503, { error: "Telemetry indexer not available" });
        return;
      }
      const q = parseQuery(url);
      const runs = listRuns(indexer.db, {
        sessionKey: q.session || undefined,
        limit: q.limit ? parseInt(q.limit, 10) : 50,
        offset: q.offset ? parseInt(q.offset, 10) : 0,
        since: parseDate(q.since),
        until: parseDate(q.until),
      });
      json(res, 200, { runs });
    },
  });

  // GET /telemetry/runs/:runId
  api.registerHttpRoute({
    path: "/telemetry/runs/:runId",
    handler: (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== "GET") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      const runId = extractPathParam(req.url ?? "", "/telemetry/runs/");
      if (!runId) {
        json(res, 400, { error: "Missing runId" });
        return;
      }
      const indexer = getIndexer();
      if (!indexer) {
        json(res, 503, { error: "Telemetry indexer not available" });
        return;
      }
      const run = getRun(indexer.db, runId);
      if (!run) {
        json(res, 404, { error: "Run not found" });
        return;
      }
      json(res, 200, { run });
    },
  });

  // GET /telemetry/tools
  api.registerHttpRoute({
    path: "/telemetry/tools",
    handler: (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== "GET") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      const indexer = getIndexer();
      if (!indexer) {
        json(res, 503, { error: "Telemetry indexer not available" });
        return;
      }
      const q = parseQuery(req.url ?? "");
      const tools = getToolCalls(indexer.db, {
        runId: q.run || undefined,
        toolName: q.name || undefined,
        limit: q.limit ? parseInt(q.limit, 10) : 100,
        offset: q.offset ? parseInt(q.offset, 10) : 0,
      });
      json(res, 200, { tools });
    },
  });

  // GET /telemetry/timeline/:key
  api.registerHttpRoute({
    path: "/telemetry/timeline/:key",
    handler: (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== "GET") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      const sessionKey = extractPathParam(req.url ?? "", "/telemetry/timeline/");
      if (!sessionKey) {
        json(res, 400, { error: "Missing session key" });
        return;
      }
      const indexer = getIndexer();
      if (!indexer) {
        json(res, 503, { error: "Telemetry indexer not available" });
        return;
      }
      const q = parseQuery(req.url ?? "");
      const kinds = q.kinds ? q.kinds.split(",").map((k) => k.trim()) : undefined;
      const events = getSessionTimeline(indexer.db, sessionKey, {
        limit: q.limit ? parseInt(q.limit, 10) : 500,
        kinds,
      });
      json(res, 200, { sessionKey, events });
    },
  });

  // GET /telemetry/usage
  api.registerHttpRoute({
    path: "/telemetry/usage",
    handler: (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== "GET") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      const indexer = getIndexer();
      if (!indexer) {
        json(res, 503, { error: "Telemetry indexer not available" });
        return;
      }
      const q = parseQuery(req.url ?? "");
      const summary = getUsageSummary(indexer.db, {
        since: parseDate(q.since),
        until: parseDate(q.until),
        sessionKey: q.session || undefined,
      });
      json(res, 200, { usage: summary });
    },
  });

  // GET /telemetry/events
  api.registerHttpRoute({
    path: "/telemetry/events",
    handler: (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== "GET") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      const indexer = getIndexer();
      if (!indexer) {
        json(res, 503, { error: "Telemetry indexer not available" });
        return;
      }
      const q = parseQuery(req.url ?? "");
      const events = listEvents(indexer.db, {
        kind: q.kind || undefined,
        limit: q.limit ? parseInt(q.limit, 10) : 100,
        offset: q.offset ? parseInt(q.offset, 10) : 0,
        since: parseDate(q.since),
        sessionKey: q.session || undefined,
      });
      json(res, 200, { events });
    },
  });
}
