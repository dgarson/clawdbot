import type { DependencyHealthProbe, DependencyHealthStatus } from "../types.js";
import { isGmailWatcherRunning } from "../../../hooks/gmail-watcher.js";

/** Creates a passive Gmail watcher health probe. */
export function createGmailProbe(): DependencyHealthProbe {
  function readStatus(): DependencyHealthStatus {
    const running = isGmailWatcherRunning();
    return {
      id: "gmail",
      label: "Gmail Watcher",
      tier: "integration",
      probeMode: "passive",
      enabled: true,
      status: running ? "ok" : "error",
      message: running ? undefined : "watcher process not running",
      lastProbeAt: Date.now(),
      consecutiveFailures: running ? 0 : 1,
    };
  }

  return {
    id: "gmail",
    label: "Gmail Watcher",
    tier: "integration",
    probeMode: "passive",
    getStatus: readStatus,
    async refresh() {
      return readStatus();
    },
  };
}
