/**
 * Pi Agent runtime implementation.
 *
 * Wraps the existing runEmbeddedPiAgent function to conform to the AgentRuntime interface.
 * Uses both shared generalized fields and Pi-specific options from piOptions bag.
 */

import type { AgentRuntime, AgentRuntimeRunParams, AgentRuntimeResult } from "./agent-runtime.js";
import { runEmbeddedPiAgent } from "./pi-embedded.js";

/**
 * Create a Pi Agent runtime instance.
 *
 * The Pi Agent runtime is the default backend that uses the Pi AI SDK
 * for model execution with moltbot's tool system.
 */
export function createPiAgentRuntime(): AgentRuntime {
  return {
    kind: "pi",
    displayName: "Pi Agent",

    async run(params: AgentRuntimeRunParams): Promise<AgentRuntimeResult> {
      // Extract Pi-specific options from the options bag
      const piOpts = params.piOptions ?? {};

      // Spread shared params directly, then add Pi-specific options from the bag
      return runEmbeddedPiAgent({
        ...params,
        // Pi-specific options from piOptions bag
        enforceFinalTag: piOpts.enforceFinalTag,
        // Client tools (now at top level, applicable to both runtimes)
        clientTools: params.clientTools,
        // Shared params (execOverrides and bashElevated are now at top level)
        execOverrides: params.execOverrides,
        bashElevated: params.bashElevated,
      });
    },
  };
}
