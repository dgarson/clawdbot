/**
 * Watchdog / health-check CLI commands:
 *   orchestrator health — detect stale agents
 */

import type { Command } from "commander";
import type { OpenClawPluginCliContext } from "../../../../src/plugins/types.js";
import { detectStaleAgents } from "../orchestration/watchdog.js";
import { DEFAULT_ORCHESTRATOR_CONFIG } from "../types.js";
import { formatRelativeTime, readAllSessions, resolveStateDir } from "./shared.js";

export function registerWatchdogCommands(parent: Command, ctx: OpenClawPluginCliContext): void {
  parent
    .command("health")
    .description("Run watchdog health check — detect stale agents.")
    .option(
      "--threshold <ms>",
      "Stale threshold in milliseconds.",
      String(DEFAULT_ORCHESTRATOR_CONFIG.orchestration.staleThresholdMs),
    )
    .option("--json", "Output raw JSON.")
    .action((opts: { threshold: string; json?: boolean }) => {
      const stateDir = resolveStateDir(ctx);
      const sessions = readAllSessions(stateDir);
      const threshold = parseInt(opts.threshold, 10);

      if (isNaN(threshold) || threshold <= 0) {
        process.stderr.write(`Invalid threshold: ${opts.threshold}\n`);
        process.exitCode = 1;
        return;
      }

      const staleAgents = detectStaleAgents(sessions, threshold);

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(staleAgents, null, 2)}\n`);
        return;
      }

      if (staleAgents.length === 0) {
        process.stdout.write(`All agents healthy (threshold: ${threshold}ms).\n`);
        return;
      }

      process.stdout.write(
        `Found ${staleAgents.length} stale agent(s) (threshold: ${threshold}ms):\n\n`,
      );

      for (const agent of staleAgents) {
        const elapsed = formatRelativeTime(agent.elapsedMs);
        const parent = agent.parentSessionKey ? ` (parent: ${agent.parentSessionKey})` : "";
        process.stdout.write(
          `  ${agent.sessionKey} [${agent.role}] — last active ${elapsed}${parent}\n`,
        );
      }

      process.stdout.write(
        `\nUse 'openclaw orchestrator kill <session-key>' to mark stale agents.\n`,
      );
    });
}
