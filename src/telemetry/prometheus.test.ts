/**
 * Tests for the Prometheus metrics endpoint.
 *
 * Verifies that `/metrics` returns Prometheus exposition format
 * containing the expected OpenClaw metric families.
 */

import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { getMetrics, resetMetricsCache } from "./metrics.js";
import {
  initPrometheusExporter,
  getMetricsRequestHandler,
  isPrometheusEnabled,
  shutdownPrometheus,
  isMetricsPath,
  DEFAULT_METRICS_ENDPOINT,
  DEFAULT_METRICS_PORT,
} from "./prometheus.js";

describe("prometheus exporter", () => {
  afterEach(async () => {
    resetMetricsCache();
    await shutdownPrometheus();
  });

  it("initializes without starting a server", () => {
    expect(isPrometheusEnabled()).toBe(false);
    initPrometheusExporter({ startServer: false });
    expect(isPrometheusEnabled()).toBe(true);
  });

  it("getMetricsRequestHandler throws if not initialized", async () => {
    await shutdownPrometheus();
    expect(() => getMetricsRequestHandler()).toThrow("not initialized");
  });

  it("isMetricsPath matches configured endpoint", () => {
    expect(isMetricsPath("/metrics")).toBe(true);
    expect(isMetricsPath("/metrics", "/metrics")).toBe(true);
    expect(isMetricsPath("/custom-metrics", "/custom-metrics")).toBe(true);
    expect(isMetricsPath("/other")).toBe(false);
  });

  it("default constants are correct", () => {
    expect(DEFAULT_METRICS_PORT).toBe(9464);
    expect(DEFAULT_METRICS_ENDPOINT).toBe("/metrics");
  });

  it("returns prometheus exposition format from /metrics handler", async () => {
    // Ensure clean state: previous test's shutdown may have left stale refs.
    resetMetricsCache();
    await shutdownPrometheus();

    initPrometheusExporter({ startServer: false });
    const handler = getMetricsRequestHandler();

    // Touch the metric instruments so they appear in output.
    const m = getMetrics();
    m.toolCalls.add(1, { tool: "exec", status: "success", agent: "main" });
    m.activeSessions.add(1, { agent: "main" });
    m.sessionTokens.add(100, {
      agent: "main",
      model: "claude-sonnet",
      provider: "anthropic",
      type: "input",
    });
    m.modelErrors.add(1, { model: "gpt-4", error_type: "timeout", agent: "main" });
    m.sessionDuration.record(12.5, { agent: "main", model: "claude-sonnet", kind: "chat" });
    m.sessionCost.record(0.05, { agent: "main", model: "claude-sonnet", provider: "anthropic" });

    // Create a mock HTTP server to invoke the handler.
    const { body, contentType, statusCode } = await new Promise<{
      body: string;
      contentType: string;
      statusCode: number;
    }>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        handler(req, res);
      });
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          reject(new Error("bad address"));
          return;
        }
        const req = http.get(`http://127.0.0.1:${addr.port}/metrics`, (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on("end", () => {
            server.close();
            resolve({
              body: data,
              contentType: res.headers["content-type"] ?? "",
              statusCode: res.statusCode ?? 0,
            });
          });
        });
        req.on("error", (err) => {
          server.close();
          reject(err);
        });
      });
    });

    expect(statusCode).toBe(200);
    // Prometheus exposition format uses text/plain
    expect(contentType).toMatch(/text\/plain/);

    // Verify all 6 metric families appear in the output.
    expect(body).toContain("openclaw_tool_calls_total");
    expect(body).toContain("openclaw_agent_active_sessions");
    expect(body).toContain("openclaw_session_tokens_total");
    expect(body).toContain("openclaw_model_errors_total");
    expect(body).toContain("openclaw_session_duration_seconds");
    expect(body).toContain("openclaw_session_cost_usd");

    // Verify labels are present.
    expect(body).toContain('tool="exec"');
    expect(body).toContain('agent="main"');
    expect(body).toContain('status="success"');
  });

  it("shuts down cleanly", async () => {
    initPrometheusExporter({ startServer: false });
    expect(isPrometheusEnabled()).toBe(true);
    await shutdownPrometheus();
    expect(isPrometheusEnabled()).toBe(false);
  });
});
