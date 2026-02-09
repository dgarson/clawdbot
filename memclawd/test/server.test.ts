import pino from "pino";
import { describe, expect, it, beforeAll } from "vitest";
import { createServer } from "../src/api/server.js";
import { DEFAULT_CONFIG } from "../src/config/schema.js";

const logger = pino({ level: "silent" });
let app: ReturnType<typeof createServer>;

beforeAll(() => {
  app = createServer({ logger, config: DEFAULT_CONFIG });
});

async function fetchJson(path: string, opts?: RequestInit) {
  const res = await app.fetch(new Request(`http://localhost${path}`, opts));
  return { status: res.status, body: await res.json() };
}

describe("MemClawd API Server", () => {
  describe("health endpoints", () => {
    it("GET /v1/health returns ok", async () => {
      const { status, body } = await fetchJson("/v1/health");
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeDefined();
    });

    it("GET /v1/health/ready returns ready", async () => {
      const { status, body } = await fetchJson("/v1/health/ready");
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.ready).toBe(true);
    });

    it("GET /v1/health/models returns model config", async () => {
      const { status, body } = await fetchJson("/v1/health/models");
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.models).toBeDefined();
      expect(body.models.hotPath).toBeDefined();
      expect(body.models.throughputPath).toBeDefined();
    });
  });

  describe("ingest endpoints", () => {
    it("POST /v1/ingest accepts and queues events", async () => {
      const { status, body } = await fetchJson("/v1/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: { id: "test-1", type: "memory.capture", payload: {} },
        }),
      });
      expect(status).toBe(202);
      expect(body.runId).toBeDefined();
      expect(body.status).toBe("queued");
      expect(body.acceptedAt).toBeDefined();
    });

    it("POST /v1/ingest/sync processes synchronously", async () => {
      const { status, body } = await fetchJson("/v1/ingest/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: { id: "test-sync", type: "memory.capture", payload: {} },
        }),
      });
      expect(status).toBe(200);
      expect(body.runId).toBeDefined();
      expect(body.status).toBe("completed");
      expect(body.stages).toBeInstanceOf(Array);
      expect(body.stages.length).toBeGreaterThan(0);
    });

    it("GET /v1/ingest/:runId returns run status", async () => {
      const { status, body } = await fetchJson("/v1/ingest/run-123");
      expect(status).toBe(200);
      expect(body.runId).toBe("run-123");
      expect(body.status).toBe("running");
    });
  });

  describe("query endpoints", () => {
    it("POST /v1/query returns results", async () => {
      const { status, body } = await fetchJson("/v1/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "test query" }),
      });
      expect(status).toBe(200);
      expect(body.queryId).toBeDefined();
      expect(body.results).toBeInstanceOf(Array);
    });

    it("POST /v1/context-pack returns pack", async () => {
      const { status, body } = await fetchJson("/v1/context-pack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "context query" }),
      });
      expect(status).toBe(200);
      expect(body.packId).toBeDefined();
    });
  });

  describe("entity endpoints", () => {
    it("GET /v1/entities/:id returns entity", async () => {
      const { status, body } = await fetchJson("/v1/entities/entity-123");
      expect(status).toBe(200);
      expect(body.entity).toBeDefined();
      expect(body.entity.id).toBe("entity-123");
    });

    it("POST /v1/entities/search returns results", async () => {
      const { status, body } = await fetchJson("/v1/entities/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "test" }),
      });
      expect(status).toBe(200);
      expect(body.matches).toBeInstanceOf(Array);
    });
  });

  describe("graph endpoints", () => {
    it("POST /v1/graph/traverse returns graph data", async () => {
      const { status, body } = await fetchJson("/v1/graph/traverse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "test" }),
      });
      expect(status).toBe(200);
      expect(body.nodes).toBeInstanceOf(Array);
      expect(body.edges).toBeInstanceOf(Array);
    });

    it("GET /v1/graph/neighbors/:nodeId returns neighbors", async () => {
      const { status, body } = await fetchJson("/v1/graph/neighbors/node-1");
      expect(status).toBe(200);
      expect(body.nodeId).toBe("node-1");
    });
  });

  describe("experiential endpoints", () => {
    it("POST /v1/experiential/capture accepts captures", async () => {
      const { status, body } = await fetchJson("/v1/experiential/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: "test experience" }),
      });
      expect(status).toBe(200);
      expect(body.captureId).toBeDefined();
      expect(body.status).toBe("accepted");
    });

    it("POST /v1/experiential/reconstitute queues reconstitution", async () => {
      const { status, body } = await fetchJson("/v1/experiential/reconstitute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: "main" }),
      });
      expect(status).toBe(200);
      expect(body.reconstitutionId).toBeDefined();
      expect(body.status).toBe("queued");
    });

    it("GET /v1/experiential/recent returns empty records", async () => {
      const { status, body } = await fetchJson("/v1/experiential/recent");
      expect(status).toBe(200);
      expect(body.records).toBeInstanceOf(Array);
    });
  });

  describe("admin endpoints", () => {
    it("GET /v1/admin/stats returns stats", async () => {
      const { status, body } = await fetchJson("/v1/admin/stats");
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.stats).toBeDefined();
    });

    it("POST /v1/admin/reindex returns queued", async () => {
      const { status, body } = await fetchJson("/v1/admin/reindex", {
        method: "POST",
      });
      expect(status).toBe(202);
      expect(body.ok).toBe(true);
      expect(body.status).toBe("queued");
    });
  });

  describe("metrics endpoint", () => {
    it("GET /metrics returns prometheus text", async () => {
      const res = await app.fetch(new Request("http://localhost/metrics"));
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("memclawd_metrics_placeholder");
    });
  });
});
