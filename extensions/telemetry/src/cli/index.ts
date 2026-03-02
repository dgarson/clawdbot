/**
 * Telemetry CLI subpackage entry point.
 *
 * Registers the parent `telemetry` command with --json and --agent options,
 * then delegates to existing and analytics command modules.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Indexer } from "../indexer.js";
import { registerAnalyticsCommands } from "./analytics-commands.js";
import { registerExistingCommands } from "./existing-commands.js";

/**
 * Register all `openclaw telemetry *` CLI sub-commands.
 */
export function registerTelemetryCli(
  api: OpenClawPluginApi,
  getIndexer: () => Indexer | null,
): void {
  api.registerCli(
    ({ program }) => {
      const tel = program
        .command("telemetry")
        .description("Telemetry query commands — inspect runs, tools, events, and usage")
        .option("--json", "Output machine-readable JSON", false)
        .option("--agent <id>", "Filter by agent ID");

      registerExistingCommands(tel, getIndexer);
      registerAnalyticsCommands(tel, getIndexer);
    },
    { commands: ["telemetry"] },
  );
}
