/**
 * Automations CLI commands - simple list and history.
 */

import type { Command } from "commander";
import { danger } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import { addGatewayClientOptions, callGatewayFromCli } from "../gateway-rpc.js";
import {
  formatAutomationsHistory,
  formatAutomationsList,
  warnIfAutomationsDisabled,
} from "./shared.js";

export function registerAutomationsListCommand(automations: Command) {
  addGatewayClientOptions(
    automations
      .command("list")
      .alias("ls")
      .description("List all automations")
      .option("--json", "Output JSON", false)
      .action(async (opts) => {
        try {
          const res = await callGatewayFromCli("automations.list", opts, {});
          if (opts.json) {
            defaultRuntime.log(JSON.stringify(res, null, 2));
          } else if (res && typeof res === "object" && "automations" in res) {
            const automations = res.automations as Array<Record<string, unknown>>;
            defaultRuntime.log(
              await formatAutomationsList(
                automations as Parameters<typeof formatAutomationsList>[0],
              ),
            );
          } else {
            defaultRuntime.log(JSON.stringify(res, null, 2));
          }
          await warnIfAutomationsDisabled(opts);
        } catch (err) {
          defaultRuntime.error(danger(String(err)));
          defaultRuntime.exit(1);
        }
      }),
  );
}

export function registerAutomationsHistoryCommand(automations: Command) {
  addGatewayClientOptions(
    automations
      .command("history")
      .description("Show automation run history")
      .argument("<id>", "Automation id")
      .option("--limit <n>", "Max entries (default 50)", "50")
      .option("--json", "Output JSON", false)
      .action(async (id, opts) => {
        try {
          const limitRaw = Number.parseInt(String(opts.limit ?? "50"), 10);
          const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
          const res = await callGatewayFromCli("automations.history", opts, {
            id,
            limit,
          });
          if (opts.json) {
            defaultRuntime.log(JSON.stringify(res, null, 2));
          } else if (res && typeof res === "object" && "records" in res) {
            const records = res.records as Array<Record<string, unknown>>;
            defaultRuntime.log(
              await formatAutomationsHistory(
                records as Parameters<typeof formatAutomationsHistory>[0],
              ),
            );
          } else {
            defaultRuntime.log(JSON.stringify(res, null, 2));
          }
        } catch (err) {
          defaultRuntime.error(danger(String(err)));
          defaultRuntime.exit(1);
        }
      }),
  );
}
