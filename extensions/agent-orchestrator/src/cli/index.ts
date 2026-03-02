/**
 * Main CLI registrar for the agent-orchestrator plugin.
 *
 * Mounts all subcommands under `openclaw orchestrator` (alias: `orch`).
 * Called from the plugin's index.ts via:
 *   api.registerCli(registerOrchestratorCli, { commands: ["orchestrator"] });
 */

import type { OpenClawPluginCliContext } from "../../../../src/plugins/types.js";
import { registerAgentCommands } from "./agents.js";
import { registerHierarchyCommands } from "./hierarchy.js";
import { registerWatchdogCommands } from "./watchdog.js";

export async function registerOrchestratorCli(ctx: OpenClawPluginCliContext): Promise<void> {
  const { program } = ctx;

  const orchestrator = program
    .command("orchestrator")
    .alias("orch")
    .description("Agent orchestration fleet management commands.");

  registerAgentCommands(orchestrator, ctx);
  registerWatchdogCommands(orchestrator, ctx);
  registerHierarchyCommands(orchestrator, ctx);
}
