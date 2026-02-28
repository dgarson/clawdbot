/**
 * E2E scenario tests for the inter-agent mail plugin.
 *
 * Each .scenario.json file in test/scenarios/ is loaded and run as an
 * independent Vitest test. The scenario runner executes steps in order,
 * applies assertions after each step, and cleans up its temp directory.
 *
 * To add a new scenario: drop a new .scenario.json file in test/scenarios/.
 * No code changes required.
 */

import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { runScenarioFile } from "../test/scenario-runner.js";

const SCENARIOS_DIR = path.resolve(import.meta.dirname, "../test/scenarios");

const scenarioFiles = readdirSync(SCENARIOS_DIR)
  .filter((f) => f.endsWith(".scenario.json"))
  .sort();

describe("inter-agent-mail e2e scenarios", () => {
  for (const file of scenarioFiles) {
    const filePath = path.join(SCENARIOS_DIR, file);
    const scenarioId = file.replace(".scenario.json", "");

    it(scenarioId, async () => {
      await runScenarioFile(filePath);
    });
  }
});
