/**
 * Main agent runtime factory.
 *
 * Resolves and creates the appropriate agent runtime based on configuration.
 */

import type { MoltbotConfig } from "../config/config.js";
import type { AgentRuntimeKind } from "../config/types.agent-defaults.js";
import type { AgentRuntime } from "./agent-runtime.js";
import { resolveAgentConfig } from "./agent-scope.js";
import { createPiAgentRuntime } from "./pi-agent-runtime.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("agents/runtime-factory");

/** Default runtime when none is configured. */
const DEFAULT_RUNTIME: AgentRuntimeKind = "pi";

/**
 * Resolve the runtime kind for an agent.
 *
 * Resolution order:
 * 1. Per-agent runtime (agents.list[].runtime)
 * 2. Default runtime (agents.defaults.runtime)
 * 3. Fallback to "pi"
 */
export function resolveAgentRuntimeKind(config: MoltbotConfig, agentId: string): AgentRuntimeKind {
  // Check per-agent config first
  const agentConfig = resolveAgentConfig(config, agentId);
  if (agentConfig?.runtime === "pi" || agentConfig?.runtime === "ccsdk") {
    return agentConfig.runtime;
  }

  // Fall back to defaults
  const defaultRuntime = config.agents?.defaults?.runtime;
  if (defaultRuntime === "pi" || defaultRuntime === "ccsdk") {
    return defaultRuntime;
  }

  return DEFAULT_RUNTIME;
}

/**
 * Create an agent runtime for the specified agent.
 *
 * @param config - Moltbot configuration
 * @param agentId - Agent identifier
 * @param forceKind - Optional runtime kind to force (overrides config resolution)
 * @returns The appropriate AgentRuntime instance
 */
export async function createAgentRuntime(
  config: MoltbotConfig,
  agentId: string,
  forceKind?: AgentRuntimeKind,
): Promise<AgentRuntime> {
  const runtimeKind = forceKind ?? resolveAgentRuntimeKind(config, agentId);

  if (runtimeKind === "ccsdk") {
    // Dynamically import to avoid loading SDK when not needed
    try {
      const { createCcSdkAgentRuntime, isSdkAvailable } =
        await import("./claude-agent-sdk/index.js");

      if (!isSdkAvailable()) {
        log.warn("CCSDK runtime requested but SDK not available, falling back to Pi runtime", {
          agentId,
        });
        return createPiAgentRuntime();
      }

      // Get CCSDK-specific config from the agent entry
      const agentConfig = resolveAgentConfig(config, agentId);

      return createCcSdkAgentRuntime({
        config,
        ccsdkConfig: agentConfig?.ccsdk,
      });
    } catch {
      // CCSDK module not available, fall back to Pi runtime
      log.warn("CCSDK module not available, falling back to Pi runtime", { agentId });
      return createPiAgentRuntime();
    }
  }

  // Default to Pi runtime
  return createPiAgentRuntime();
}

/**
 * Check if the Claude Code SDK runtime is available.
 *
 * This can be used to conditionally show CCSDK-related options in the UI.
 */
export async function isCcSdkRuntimeAvailable(): Promise<boolean> {
  try {
    const { isSdkAvailable } = await import("./claude-agent-sdk/index.js");
    return isSdkAvailable();
  } catch {
    return false;
  }
}
