import type { Logger } from "pino";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { performance } from "node:perf_hooks";
import type { MemclawdConfig } from "../config/schema.js";
import type { MemoryEntity } from "../contracts/entities.js";
import type { MemClawdIngestEvent } from "../contracts/events.js";
import type { MemClawdIngestResponse, MemClawdIngestRun } from "../contracts/ingest.js";
import type { MemClawdQueryRequest, MemClawdQueryResult } from "../contracts/query.js";

export type ServerDependencies = {
  logger: Logger;
  config: MemclawdConfig;
};

export const createServer = ({ logger, config }: ServerDependencies): Hono => {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const requestId = nanoid();
    const start = performance.now();
    c.set("requestId", requestId);
    await next();
    const durationMs = performance.now() - start;
    logger.info({
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
    });
  });

  app.onError((error, c) => {
    const requestId = c.get("requestId");
    logger.error({ err: error, requestId }, "Unhandled MemClawd error");
    return c.json({ ok: false, requestId, error: error.message }, 500);
  });

  app.post("/v1/ingest", async (c) => {
    const body = (await c.req.json()) as { event: MemClawdIngestEvent };
    const runId = nanoid();
    const response: MemClawdIngestResponse = {
      runId,
      status: "queued",
      acceptedAt: new Date().toISOString(),
    };
    logger.info({ runId, eventType: body.event?.type }, "Ingest queued");
    return c.json(response, 202);
  });

  app.post("/v1/ingest/sync", async (c) => {
    const body = (await c.req.json()) as { event: MemClawdIngestEvent };
    const run: MemClawdIngestRun = {
      runId: nanoid(),
      eventId: body.event?.id ?? "unknown",
      status: "completed",
      stages: [
        "normalize",
        "extract",
        "classify",
        "enrich",
        "entity_extract",
        "embed",
        "graph_write",
        "vector_index",
        "audit",
      ],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    return c.json(run);
  });

  app.get("/v1/ingest/:runId", (c) => {
    const runId = c.req.param("runId");
    const run: MemClawdIngestRun = {
      runId,
      eventId: "unknown",
      status: "running",
      stages: [
        "normalize",
        "extract",
        "classify",
        "enrich",
        "entity_extract",
        "embed",
        "graph_write",
        "vector_index",
        "audit",
      ],
      startedAt: new Date().toISOString(),
    };
    return c.json(run);
  });

  app.post("/v1/query", async (c) => {
    const body = (await c.req.json()) as MemClawdQueryRequest;
    const result: MemClawdQueryResult = {
      queryId: nanoid(),
      results: [],
      contextPacks: [],
      graph: { nodes: [], edges: [] },
      latencyMs: 0,
    };
    logger.info({ query: body.query }, "Query request received");
    return c.json(result);
  });

  app.post("/v1/context-pack", async (c) => {
    const body = (await c.req.json()) as MemClawdQueryRequest;
    return c.json({
      packId: nanoid(),
      text: "",
      sources: body.contextPack?.includeSources ? [] : undefined,
    });
  });

  app.get("/v1/entities/:id", (c) => {
    const id = c.req.param("id");
    const entity: MemoryEntity = { id, type: "entity", label: "" };
    return c.json({ entity });
  });

  app.post("/v1/entities/search", async (c) => {
    const body = (await c.req.json()) as { query: string };
    return c.json({ query: body.query, matches: [] });
  });

  app.post("/v1/graph/traverse", async (c) => {
    await c.req.json();
    return c.json({ nodes: [], edges: [] });
  });

  app.get("/v1/graph/neighbors/:nodeId", (c) => {
    const nodeId = c.req.param("nodeId");
    return c.json({ nodeId, nodes: [], edges: [] });
  });

  app.post("/v1/experiential/capture", async (c) => {
    const payload = await c.req.json();
    return c.json({ captureId: nanoid(), status: "accepted", payload });
  });

  app.post("/v1/experiential/reconstitute", async (c) => {
    await c.req.json();
    return c.json({ reconstitutionId: nanoid(), status: "queued" });
  });

  app.get("/v1/experiential/recent", (c) => {
    return c.json({ records: [] });
  });

  app.get("/v1/health", () => {
    return c.json({ ok: true, status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/v1/health/ready", () => {
    return c.json({ ok: true, ready: true, timestamp: new Date().toISOString() });
  });

  app.get("/v1/health/models", () => {
    return c.json({ ok: true, models: config.models, timestamp: new Date().toISOString() });
  });

  app.get("/v1/admin/stats", () => {
    return c.json({ ok: true, stats: { ingestRuns: 0, queries: 0 } });
  });

  app.post("/v1/admin/reindex", async () => {
    return c.json({ ok: true, status: "queued" }, 202);
  });

  app.get("/metrics", () => {
    return c.text("# memclawd_metrics_placeholder\n", 200, {
      "content-type": "text/plain; version=0.0.4",
    });
  });

  return app;
};
