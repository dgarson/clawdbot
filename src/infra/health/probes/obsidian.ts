import type { ObsidianConfig } from "../../../config/types.obsidian.js";
import type { DependencyHealthProbe, DependencyHealthStatus } from "../types.js";
import { getObsidianHealthSnapshot } from "../../../obsidian/health.js";
import { getObsidianRuntime } from "../../../obsidian/startup.js";

/** Creates a passive Obsidian vault health probe. */
export function createObsidianProbe(obsidianCfg: ObsidianConfig): DependencyHealthProbe {
  function readStatus(): DependencyHealthStatus {
    const runtime = getObsidianRuntime();
    const snapshot = getObsidianHealthSnapshot({
      config: obsidianCfg,
      vault: runtime?.vault,
      linkIndex: runtime?.linkIndex,
      healthState: runtime?.health ?? { watcherActive: false, lastChangeAt: null },
    });

    if (!snapshot || !snapshot.enabled) {
      return {
        id: "obsidian",
        label: "Obsidian Vault",
        tier: "integration",
        probeMode: "passive",
        enabled: false,
        status: "disabled",
        lastProbeAt: Date.now(),
        consecutiveFailures: 0,
      };
    }

    return {
      id: "obsidian",
      label: "Obsidian Vault",
      tier: "integration",
      probeMode: "passive",
      enabled: true,
      status: snapshot.watcherActive ? "ok" : "degraded",
      message: snapshot.watcherActive ? undefined : "watcher not active",
      lastProbeAt: Date.now(),
      consecutiveFailures: 0,
      details: {
        syncMode: snapshot.syncMode,
        vaultPath: snapshot.vaultPath,
        filesIndexed: snapshot.filesIndexed,
        linksIndexed: snapshot.linksIndexed,
        tagsIndexed: snapshot.tagsIndexed,
        lastChangeAt: snapshot.lastChangeAt,
      },
    };
  }

  return {
    id: "obsidian",
    label: "Obsidian Vault",
    tier: "integration",
    probeMode: "passive",
    getStatus: readStatus,
    async refresh() {
      return readStatus();
    },
  };
}
