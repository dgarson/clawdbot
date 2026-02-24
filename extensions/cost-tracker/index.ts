/**
 * Cost Tracker Extension
 *
 * Per-agent cost tracking aggregation layer that reads from telemetry JSONL
 * and provides daily cost summaries with budget alerts.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { z } from "zod";
import {
  computeDailyCostSummary,
  checkBudgetAlerts,
  writeCostSummaryJsonl,
} from "./src/cost-aggregator.js";

const CONFIG_SCHEMA = z.object({
  telemetryPath: z.string().describe("Path to telemetry JSONL directory"),
  outputPath: z.string().optional().describe("Path for daily cost summary JSONL output"),
  budget: z
    .object({
      dailyLimit: z.number().positive(),
      weeklyLimit: z.number().positive().optional(),
      agentDailyLimit: z.number().positive().optional(),
      enabled: z.boolean().default(true),
    })
    .optional()
    .describe("Budget alert thresholds"),
  slackWebhookUrl: z.string().url().optional().describe("Slack webhook for budget alerts"),
});

type Config = z.infer<typeof CONFIG_SCHEMA>;

const plugin = {
  id: "cost-tracker",
  name: "Cost Tracker",
  description: "Per-agent cost tracking aggregation layer",
  configSchema: CONFIG_SCHEMA,
  register(api: OpenClawPluginApi) {
    const cfg = CONFIG_SCHEMA.parse(api.pluginConfig) as Config;
    const log = api.logger;

    if (!cfg?.telemetryPath) {
      log.debug?.("cost-tracker: no telemetryPath configured, skipping");
      return;
    }

    log.info(`cost-tracker: configured with telemetryPath=${cfg.telemetryPath}`);

    // Schedule daily cost summary generation
    const checkAndGenerateSummary = async () => {
      try {
        const summary = await computeDailyCostSummary(cfg.telemetryPath, new Date());

        // Write to output if configured
        if (cfg.outputPath) {
          await writeCostSummaryJsonl(summary, cfg.outputPath);
          log.debug?.(`cost-tracker: wrote summary to ${cfg.outputPath}`);
        }

        // Check budget alerts
        if (cfg.budget) {
          const alerts = checkBudgetAlerts(summary, cfg.budget);
          for (const alert of alerts) {
            log.warn(
              `cost-tracker: BUDGET ALERT - ${alert.type}: $${alert.currentSpend.toFixed(2)} / $${alert.threshold} (${alert.percentage.toFixed(1)}%)` +
                (alert.agentId ? ` [agent: ${alert.agentId}]` : ""),
            );
          }
        }

        log.info(
          `cost-tracker: daily summary - $${summary.totalCost.toFixed(2)} (${summary.totalRuns} runs, ${summary.totalTokens.toLocaleString()} tokens)`,
        );
      } catch (err) {
        log.error(`cost-tracker: failed to generate summary: ${err}`);
      }
    };

    // Run immediately on start, then every hour
    void checkAndGenerateSummary();
    const interval = setInterval(
      () => {
        void checkAndGenerateSummary();
      },
      60 * 60 * 1000,
    );

    api.registerService({
      id: "cost-tracker",
      start() {
        log.info("cost-tracker: service started");
      },
      stop() {
        clearInterval(interval);
        log.info("cost-tracker: service stopped");
      },
    });
  },
};

export default plugin;
