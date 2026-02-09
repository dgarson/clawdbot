import type { MemoryGraphitiConfig } from "../../config/types.memory.js";
import { memLog } from "../memory-log.js";
import { GraphitiClient } from "./client.js";

// ───────────────────── Constants ─────────────────────

const FAILURE_THRESHOLD = 3;
const DEFAULT_INTERVAL_MINUTES = 5;
const HEALTH_TIMEOUT_MS = 5_000;

// ───────────────────── Module-level state ─────────────────────

let probeTimer: NodeJS.Timeout | null = null;
let probeClient: GraphitiClient | null = null;
let consecutiveFailures = 0;
let lastProbeResult: { ok: boolean; message?: string; timestamp: number } | null = null;

// ───────────────────── Internal ─────────────────────

const feature = "graphiti-health-probe";

async function runProbe(): Promise<void> {
  if (!probeClient) {
    return;
  }
  try {
    const result = await probeClient.health();
    const prevFailures = consecutiveFailures;
    if (result.ok) {
      if (prevFailures >= FAILURE_THRESHOLD) {
        memLog.info("graphiti health probe: recovered", {
          feature,
          previousFailures: prevFailures,
        });
      } else {
        memLog.debug("graphiti health probe: ok", { feature });
      }
      consecutiveFailures = 0;
      lastProbeResult = { ok: true, message: result.message, timestamp: Date.now() };
    } else {
      consecutiveFailures += 1;
      lastProbeResult = { ok: false, message: result.message, timestamp: Date.now() };
      if (consecutiveFailures >= FAILURE_THRESHOLD && prevFailures < FAILURE_THRESHOLD) {
        memLog.warn(
          `graphiti health probe: service marked unavailable after ${consecutiveFailures} consecutive failures`,
          { feature, message: result.message },
        );
      } else {
        memLog.debug("graphiti health probe: failed", {
          feature,
          consecutiveFailures,
          message: result.message,
        });
      }
    }
  } catch (err) {
    consecutiveFailures += 1;
    const message = err instanceof Error ? err.message : String(err);
    lastProbeResult = { ok: false, message, timestamp: Date.now() };
    if (consecutiveFailures >= FAILURE_THRESHOLD && consecutiveFailures - 1 < FAILURE_THRESHOLD) {
      memLog.warn(
        `graphiti health probe: service marked unavailable after ${consecutiveFailures} consecutive failures`,
        { feature, message },
      );
    } else {
      memLog.debug("graphiti health probe: error", { feature, consecutiveFailures, message });
    }
  }
}

// ───────────────────── Public API ─────────────────────

/**
 * Start the periodic Graphiti health probe.
 * Creates a dedicated GraphitiClient with a shorter timeout, runs an initial
 * probe (fire-and-forget), then starts a setInterval for recurring checks.
 */
export function startGraphitiHealthProbe(cfg?: MemoryGraphitiConfig): void {
  stopGraphitiHealthProbe();

  if (!cfg?.enabled) {
    return;
  }

  probeClient = new GraphitiClient({
    serverHost: cfg.serverHost,
    servicePort: cfg.servicePort,
    apiKey: cfg.apiKey,
    timeoutMs: HEALTH_TIMEOUT_MS,
  });

  // Fire-and-forget initial probe
  void runProbe();

  const intervalMinutes = cfg.healthProbeIntervalMinutes ?? DEFAULT_INTERVAL_MINUTES;
  const intervalMs = intervalMinutes * 60 * 1_000;
  probeTimer = setInterval(() => {
    void runProbe();
  }, intervalMs);
}

/**
 * Stop the periodic health probe and clear all state.
 */
export function stopGraphitiHealthProbe(): void {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
  probeClient = null;
  consecutiveFailures = 0;
  lastProbeResult = null;
}

/**
 * Returns `true` if Graphiti should be considered reachable.
 * Optimistic: returns `true` if no probe has run yet.
 * Returns `false` only after >= FAILURE_THRESHOLD consecutive probe failures.
 */
export function isGraphitiAvailable(): boolean {
  return consecutiveFailures < FAILURE_THRESHOLD;
}

/**
 * Returns a diagnostic snapshot of the health probe state, or `null` if
 * no probe has run yet.
 */
export function getGraphitiHealthStatus(): {
  ok: boolean;
  message?: string;
  timestamp: number;
  consecutiveFailures: number;
} | null {
  if (!lastProbeResult) {
    return null;
  }
  return { ...lastProbeResult, consecutiveFailures };
}
