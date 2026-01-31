/**
 * Claude Agent SDK runtime stub.
 *
 * This module provides placeholder exports for the Claude Code SDK runtime.
 * The actual implementation will be added in a future PR.
 *
 * @module agents/claude-agent-sdk
 */

import type { MoltbotConfig } from "../../config/config.js";
import type { AgentCcSdkConfig } from "../../config/types.agents.js";
import type { AgentRuntime } from "../agent-runtime.js";

/**
 * Check if the Claude Code SDK is available.
 *
 * Currently always returns false as the SDK is not yet implemented.
 */
export function isSdkAvailable(): boolean {
  return false;
}

/**
 * Create a Claude Code SDK agent runtime.
 *
 * This is a placeholder that throws an error until the SDK is implemented.
 */
export function createCcSdkAgentRuntime(_params: {
  config: MoltbotConfig;
  ccsdkConfig?: AgentCcSdkConfig;
}): AgentRuntime {
  throw new Error("Claude Code SDK runtime is not yet implemented");
}
