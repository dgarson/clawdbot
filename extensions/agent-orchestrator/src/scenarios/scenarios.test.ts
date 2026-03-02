/**
 * Scenario-based integration tests for the agent-orchestrator plugin.
 *
 * Each scenario replays a scripted event sequence through the plugin's
 * actual hook chain, verifying spawn validation, tool boundary enforcement,
 * model overrides, context injection, and lifecycle transitions.
 */

import { describe, it, expect } from "vitest";
import { allScenarios } from "./all-scenarios.js";
import { runScenario } from "./runner.js";

describe("agent-orchestrator scenarios", () => {
  for (const scenario of allScenarios) {
    it(
      scenario.name,
      async () => {
        const { passed, results } = await runScenario(scenario);

        // Log failed steps for debugging
        const failed = results.filter((r) => !r.passed);
        if (failed.length > 0) {
          const details = failed.map((f) => `  Step ${f.step} (${f.type}): ${f.error}`).join("\n");
          expect.fail(`Scenario "${scenario.name}" failed:\n${details}`);
        }

        expect(passed).toBe(true);
      },
      30_000,
    );
  }
});
