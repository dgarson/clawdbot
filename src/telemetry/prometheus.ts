/**
 * Prometheus metrics exporter for OpenClaw gateway.
 *
 * Uses `@opentelemetry/exporter-prometheus` with `preventServerStart: true`
 * so the `/metrics` endpoint is served by the existing gateway HTTP server
 * rather than spinning up a separate listener.
 *
 * When the gateway does not have an HTTP server (e.g. standalone mode),
 * the exporter can optionally start its own server on a configurable port.
 *
 * @see OBS_STACK_SPEC.md §Phase 2
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { MeterProvider } from "@opentelemetry/sdk-metrics";

/** Default Prometheus metrics port (OTel convention). */
export const DEFAULT_METRICS_PORT = 9464;

/** Default metrics endpoint path. */
export const DEFAULT_METRICS_ENDPOINT = "/metrics";

export type PrometheusMetricsConfig = {
  /** Port for standalone metrics server (only used with Option B). Default: 9464. */
  port?: number;
  /** HTTP path for the metrics endpoint. Default: "/metrics". */
  endpoint?: string;
  /** Whether to start a standalone server (false when attaching to gateway). */
  startServer?: boolean;
};

let prometheusExporter: PrometheusExporter | undefined;
let meterProvider: MeterProvider | undefined;

/**
 * Initialize the Prometheus exporter with its own MeterProvider.
 *
 * The exporter is created with `preventServerStart: true` so it does not open
 * its own port. Use `getMetricsRequestHandler()` to wire it into the gateway
 * HTTP server, or pass `startServer: true` to let it bind its own port.
 *
 * The MeterProvider is exposed via `getPrometheusMeterProvider()` so that
 * metric instruments can be created directly on it — this avoids conflicts
 * with the OTel global MeterProvider (which only allows a single set).
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initPrometheusExporter(config?: PrometheusMetricsConfig): PrometheusExporter {
  if (prometheusExporter) {
    return prometheusExporter;
  }

  const endpoint = config?.endpoint ?? DEFAULT_METRICS_ENDPOINT;
  const port = config?.port ?? DEFAULT_METRICS_PORT;
  const preventServerStart = !(config?.startServer ?? false);

  prometheusExporter = new PrometheusExporter(
    {
      port,
      endpoint,
      preventServerStart,
    },
    () => {
      // Callback fires only when preventServerStart is false.
    },
  );

  // Create a dedicated MeterProvider with the Prometheus reader.
  // We intentionally do NOT set this as the OTel global to avoid conflicts
  // with the OTLP push exporter in otel.ts. Instead, metric instruments
  // should be created via getPrometheusMeterProvider().getMeter().
  meterProvider = new MeterProvider({
    readers: [prometheusExporter],
  });

  return prometheusExporter;
}

/**
 * Return the MeterProvider backing the Prometheus exporter.
 *
 * Use this to create metric instruments that will appear in `/metrics` output.
 * Returns `undefined` when the exporter has not been initialized.
 */
export function getPrometheusMeterProvider(): MeterProvider | undefined {
  return meterProvider;
}

/**
 * Return the native Node.js HTTP request handler for the `/metrics` endpoint.
 *
 * This handler returns Prometheus exposition format (text/plain) containing
 * all registered OTel metric families.
 *
 * @throws if `initPrometheusExporter()` has not been called.
 */
export function getMetricsRequestHandler(): (req: IncomingMessage, res: ServerResponse) => void {
  if (!prometheusExporter) {
    throw new Error("Prometheus exporter not initialized. Call initPrometheusExporter() first.");
  }
  return prometheusExporter.getMetricsRequestHandler.bind(prometheusExporter);
}

/**
 * Check whether a request path matches the configured metrics endpoint.
 */
export function isMetricsPath(pathname: string, configuredEndpoint?: string): boolean {
  const endpoint = configuredEndpoint ?? DEFAULT_METRICS_ENDPOINT;
  return pathname === endpoint;
}

/**
 * Gracefully shut down the Prometheus exporter and MeterProvider.
 */
export async function shutdownPrometheus(): Promise<void> {
  if (meterProvider) {
    try {
      await meterProvider.shutdown();
    } finally {
      meterProvider = undefined;
      prometheusExporter = undefined;
    }
  }
}

/**
 * Whether the Prometheus exporter is currently active.
 */
export function isPrometheusEnabled(): boolean {
  return prometheusExporter !== undefined;
}
