import type { OpenClawConfig } from "../../config/config.js";
import { createChannelProbes } from "./probes/channels.js";
import { createGmailProbe } from "./probes/gmail.js";
import { createGraphitiProbe } from "./probes/graphiti.js";
import { createObsidianProbe } from "./probes/obsidian.js";
import { registerDependencyProbe, startDependencyHealthProbes } from "./registry.js";

/** Wire all dependency health probes based on config and start periodic probing. */
export function initDependencyHealthProbes(cfg: OpenClawConfig): void {
  // Graphiti (active probe with periodic health checks)
  if (cfg.memory?.graphiti?.enabled) {
    registerDependencyProbe(createGraphitiProbe(cfg.memory.graphiti));
  }

  // Obsidian vault (passive, reads runtime state)
  if (cfg.obsidian?.enabled) {
    registerDependencyProbe(createObsidianProbe(cfg.obsidian));
  }

  // Gmail watcher (passive, reads process state)
  if (cfg.hooks?.enabled && cfg.hooks?.gmail?.account) {
    registerDependencyProbe(createGmailProbe());
  }

  // Channel probes (one per enabled channel: Slack, Discord, etc.)
  for (const probe of createChannelProbes(cfg)) {
    registerDependencyProbe(probe);
  }

  startDependencyHealthProbes();
}
