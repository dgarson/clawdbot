/**
 * OpenTelemetry SDK initialization for OpenClaw gateway.
 *
 * Configures trace + metric pipelines with OTLP/HTTP exporters (Jaeger-compatible).
 * Respects `diagnostics.otel.enabled` config flag — fully no-op when disabled.
 */

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import type { DiagnosticsOtelConfig } from "../config/types.base.js";

const DEFAULT_OTLP_ENDPOINT = "http://localhost:4318";
const DEFAULT_SERVICE_NAME = "openclaw-gateway";
/** Semantic conventions key — not yet in @opentelemetry/semantic-conventions stable export */
const ATTR_DEPLOYMENT_ENVIRONMENT = "deployment.environment";

let sdk: NodeSDK | undefined;
let enabled = false;

export type OtelInitConfig = {
  otel?: DiagnosticsOtelConfig;
  /** Service version — typically from package.json */
  serviceVersion?: string;
  /** Deployment environment label (e.g. "production", "development") */
  environment?: string;
};

/**
 * Initialize the OpenTelemetry SDK.
 *
 * Safe to call multiple times — subsequent calls are no-ops if already initialized.
 * When `otel.enabled` is falsy the function returns immediately (zero overhead).
 */
export function initOtel(config: OtelInitConfig): void {
  if (sdk) {
    return;
  } // already initialized
  if (!config.otel?.enabled) {
    return;
  } // disabled by config

  const otelCfg = config.otel;
  const endpoint =
    otelCfg.endpoint ?? process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? DEFAULT_OTLP_ENDPOINT;

  const serviceName = otelCfg.serviceName ?? DEFAULT_SERVICE_NAME;
  const sampleRate = otelCfg.sampleRate ?? 1.0;

  // Enable OTel internal diagnostics at WARN level
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion ?? "unknown",
    [ATTR_DEPLOYMENT_ENVIRONMENT]: config.environment ?? "development",
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers: otelCfg.headers,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${endpoint}/v1/metrics`,
    headers: otelCfg.headers,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 15_000,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    sampler: buildSampler(sampleRate),
  });

  sdk.start();
  enabled = true;
}

/**
 * Gracefully shut down the OTel SDK, flushing pending spans/metrics.
 */
export async function shutdownOtel(): Promise<void> {
  if (!sdk) {
    return;
  }
  try {
    await sdk.shutdown();
  } finally {
    sdk = undefined;
    enabled = false;
  }
}

/**
 * Whether OTel instrumentation is currently active.
 */
export function isOtelEnabled(): boolean {
  return enabled;
}

// ── internal helpers ──────────────────────────────────────────────────

function buildSampler(ratio: number) {
  // Use the built-in TraceIdRatioBasedSampler from @opentelemetry/sdk-trace-node.
  // Require at call-time so the module stays side-effect free when OTel is off.
  const { TraceIdRatioBasedSampler } = require("@opentelemetry/sdk-trace-node") as {
    TraceIdRatioBasedSampler: new (
      ratio: number,
    ) => import("@opentelemetry/sdk-trace-node").Sampler;
  };
  return new TraceIdRatioBasedSampler(Math.max(0, Math.min(1, ratio)));
}
