import type { MemoryGraphitiConfig } from "../../../config/types.memory.js";
import type { DependencyHealthProbe, DependencyHealthStatus } from "../types.js";

const PROBE_INTERVAL_MS = 30_000;

/** Creates a Graphiti dependency health probe (active, periodic). */
export function createGraphitiProbe(graphitiCfg: MemoryGraphitiConfig): DependencyHealthProbe {
  let lastStatus: DependencyHealthStatus = buildStatus("unknown", null, 0);
  let timer: ReturnType<typeof setInterval> | null = null;

  function buildStatus(
    status: DependencyHealthStatus["status"],
    message: string | null,
    consecutiveFailures: number,
  ): DependencyHealthStatus {
    return {
      id: "graphiti",
      label: "Graphiti (Graph Memory)",
      tier: "core",
      probeMode: "active",
      enabled: true,
      status,
      message: message ?? undefined,
      lastProbeAt: status === "unknown" ? null : Date.now(),
      consecutiveFailures,
    };
  }

  async function runProbe(): Promise<DependencyHealthStatus> {
    try {
      const { GraphitiClient } = await import("../../../memory/graphiti/client.js");
      const client = new GraphitiClient({
        host: graphitiCfg.host,
        servicePort: graphitiCfg.servicePort,
        apiKey: graphitiCfg.apiKey,
        timeoutMs: graphitiCfg.timeoutMs ?? 10_000,
      });
      const result = await client.health();
      if (result.ok) {
        lastStatus = buildStatus("ok", result.message ?? null, 0);
      } else {
        lastStatus = buildStatus(
          "error",
          result.message ?? "health check failed",
          lastStatus.consecutiveFailures + 1,
        );
      }
    } catch (err) {
      lastStatus = buildStatus(
        "error",
        err instanceof Error ? err.message : String(err),
        lastStatus.consecutiveFailures + 1,
      );
    }
    return lastStatus;
  }

  return {
    id: "graphiti",
    label: "Graphiti (Graph Memory)",
    tier: "core",
    probeMode: "active",
    getStatus: () => lastStatus,
    refresh: runProbe,
    start() {
      if (timer) {
        return;
      }
      // Run initial probe immediately
      void runProbe();
      timer = setInterval(() => void runProbe(), PROBE_INTERVAL_MS);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
