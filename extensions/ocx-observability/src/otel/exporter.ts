/**
 * OTLP HTTP exporter setup, lifecycle, and flush.
 *
 * Creates OTEL SDK, metric reader, logger provider, and exposes the
 * Tracer, Meter, and Logger for use by span-builder, metric-emitter,
 * and log-emitter respectively.
 */

import { metrics, trace } from "@opentelemetry/api";
import type { Logger as OtelLogger } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import type { ObservabilityConfig } from "../config.js";

type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };

// =============================================================================
// Exporter State
// =============================================================================

export type ExporterState = {
  sdk: NodeSDK;
  logProvider: LoggerProvider;
  tracer: ReturnType<typeof trace.getTracer>;
  meter: ReturnType<typeof metrics.getMeter>;
  otelLogger: OtelLogger;
};

// =============================================================================
// Setup
// =============================================================================

/**
 * Initialize the OTEL exporter stack based on plugin config.
 * Returns the tracer, meter, and logger for use by the bridge components.
 */
export function createExporter(config: ObservabilityConfig, logger: Logger): ExporterState {
  const endpoint = normalizeEndpoint(config.otlpEndpoint);

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
  });

  // Trace exporter
  const traceUrl = resolveUrl(endpoint, "v1/traces");
  const traceExporter = new OTLPTraceExporter({
    ...(traceUrl ? { url: traceUrl } : {}),
  });

  // Metric exporter
  const metricUrl = resolveUrl(endpoint, "v1/metrics");
  const metricExporter = new OTLPMetricExporter({
    ...(metricUrl ? { url: metricUrl } : {}),
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 30_000,
  });

  // Log exporter
  const logUrl = resolveUrl(endpoint, "v1/logs");
  const logExporter = new OTLPLogExporter({
    ...(logUrl ? { url: logUrl } : {}),
  });

  const logProcessor = new BatchLogRecordProcessor(logExporter);
  const logProvider = new LoggerProvider({
    resource,
    processors: [logProcessor],
  });

  // SDK (traces + metrics)
  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
  });

  try {
    sdk.start();
  } catch (err) {
    logger.error(`observability: failed to start OTEL SDK: ${String(err)}`);
    throw err;
  }

  const tracer = trace.getTracer("openclaw-observability");
  const meter = metrics.getMeter("openclaw-observability");
  const otelLogger = logProvider.getLogger("openclaw-observability");

  logger.info(
    `observability: OTEL exporter started (endpoint=${endpoint}, service=${config.serviceName})`,
  );

  return { sdk, logProvider, tracer, meter, otelLogger };
}

// =============================================================================
// Shutdown
// =============================================================================

/** Flush and shut down all OTEL components. */
export async function shutdownExporter(state: ExporterState, logger: Logger): Promise<void> {
  try {
    await state.logProvider.shutdown();
  } catch (err) {
    logger.warn(`observability: log provider shutdown error: ${String(err)}`);
  }

  try {
    await state.sdk.shutdown();
  } catch (err) {
    logger.warn(`observability: SDK shutdown error: ${String(err)}`);
  }

  logger.info("observability: OTEL exporter shut down");
}

// =============================================================================
// Helpers
// =============================================================================

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, "");
}

function resolveUrl(endpoint: string, path: string): string {
  const clean = endpoint.split(/[?#]/, 1)[0] ?? endpoint;
  if (/\/v1\/(?:traces|metrics|logs)$/i.test(clean)) {
    return endpoint;
  }
  return `${endpoint}/${path}`;
}
