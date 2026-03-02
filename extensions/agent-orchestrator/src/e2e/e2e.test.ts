/**
 * E2E scenario tests for agent-orchestrator multi-agent workflows.
 *
 * Each scenario simulates a realistic multi-agent project with mail delivery,
 * tool boundary enforcement, role-based model overrides, and fleet lifecycle.
 */

import { describe, it, expect } from "vitest";
import { runE2EScenario } from "./runner.js";
import { allE2EScenarios } from "./scenarios.js";

describe("agent-orchestrator e2e scenarios", () => {
  for (const scenario of allE2EScenarios) {
    it(
      scenario.id,
      async () => {
        const { passed, results } = await runE2EScenario(scenario);
        const failed = results.filter((r) => !r.passed);
        if (failed.length > 0) {
          const details = failed
            .map((f) => `  Step ${f.step} (${f.action}): ${f.error}`)
            .join("\n");
          expect.fail(`E2E scenario "${scenario.id}" failed:\n${details}`);
        }
        expect(passed).toBe(true);
      },
      30_000,
    );
  }
});
