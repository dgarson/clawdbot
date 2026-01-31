/**
 * Agent runtime resolution.
 *
 * Resolves which runtime engine to use for agent execution:
 * - "pi": Uses @mariozechner/pi-coding-agent (default, uses Anthropic API key)
 * - "claude-sdk": Uses @anthropic-ai/claude-agent-sdk (uses Claude Code Max subscription)
 */

import type { OpenClawConfig } from "../config/config.js";
import { normalizeAgentId } from "../routing/session-key.js";

/** Supported agent runtime engines. */
export type AgentRuntime = "pi" | "claude-sdk";

/**
 * Resolve the runtime from a per-agent entry.
 */
function resolveAgentEntryRuntime(cfg: OpenClawConfig, agentId: string): AgentRuntime | undefined {
  const id = normalizeAgentId(agentId);
  const list = cfg.agents?.list;
  if (!Array.isArray(list)) {
    return undefined;
  }
  const entry = list.find((e) => e && typeof e === "object" && normalizeAgentId(e.id) === id) as
    | { runtime?: string }
    | undefined;
  const runtime = entry?.runtime;
  if (runtime === "pi" || runtime === "claude-sdk") {
    return runtime;
  }
  return undefined;
}

/**
 * Resolve the agent runtime engine.
 *
 * Priority (first match wins):
 * 1. Per-agent entry runtime (agents.list[].runtime)
 * 2. Global defaults runtime (agents.defaults.runtime)
 * 3. OPENCLAW_AGENT_RUNTIME env var
 * 4. Default: "pi"
 */
export function resolveAgentRuntime(cfg: OpenClawConfig, agentId: string): AgentRuntime {
  // 1. Per-agent entry
  const agentRuntime = resolveAgentEntryRuntime(cfg, agentId);
  if (agentRuntime) {
    return agentRuntime;
  }
  // 2. Global defaults
  const defaultsRuntime = (cfg.agents?.defaults as { runtime?: string } | undefined)?.runtime;
  if (defaultsRuntime === "pi" || defaultsRuntime === "claude-sdk") {
    return defaultsRuntime;
  }
  // 3. Env var fallback
  const envRuntime = process.env.OPENCLAW_AGENT_RUNTIME;
  if (envRuntime === "pi" || envRuntime === "claude-sdk") {
    return envRuntime;
  }
  // 4. Default
  return "pi";
}
