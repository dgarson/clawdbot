// Unified Graphiti bridge – wraps the retry-queue fanout with batching support.

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { MeridiaExperienceRecord } from "./meridia/types.js";
import { enqueueGraphFanout } from "./meridia/fanout.js";

export interface GraphitiBridge {
  addRecord(record: MeridiaExperienceRecord): void;
}

let defaultBridge: GraphitiBridge | null = null;
let defaultBridgeCfg: OpenClawConfig | undefined;

/**
 * Return a shared bridge instance for the given config.
 * Returns `null` when Graphiti is not enabled, letting callers fall back
 * to direct fanout.
 */
export function getDefaultBridge(cfg?: OpenClawConfig): GraphitiBridge | null {
  if (!cfg?.memory?.graphiti?.enabled) {
    return null;
  }

  // Re-use existing bridge if the config reference hasn't changed.
  if (defaultBridge && defaultBridgeCfg === cfg) {
    return defaultBridge;
  }

  defaultBridgeCfg = cfg;
  defaultBridge = {
    addRecord(record: MeridiaExperienceRecord) {
      enqueueGraphFanout({
        record,
        cfg,
        options: { source: "meridia.bridge" },
      });
    },
  };

  return defaultBridge;
}
