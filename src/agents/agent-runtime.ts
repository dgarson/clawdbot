/**
 * Agent runtime resolution.
 *
 * Resolves which runtime engine to use for agent execution:
 * - "pi": Uses @mariozechner/pi-coding-agent (default, uses Anthropic API key)
 * - "claude-sdk": Uses @anthropic-ai/claude-agent-sdk (uses Claude Code Max subscription)
 */

import type { OpenClawConfig } from "../config/config.js";
import type { ClaudeSdkOptionsParam } from "./pi-embedded-runner/run/params.js";
import { normalizeAgentId } from "../routing/session-key.js";

/** Supported agent runtime engines. */
export type AgentRuntime = "pi" | "claude-sdk";

/** Claude SDK provider type. */
type ClaudeSdkProvider = "anthropic" | "zai" | "openrouter" | "kimi";

/** Type guard for valid Claude SDK providers. */
function isValidProvider(provider: unknown): provider is ClaudeSdkProvider {
  return (
    provider === "anthropic" ||
    provider === "zai" ||
    provider === "openrouter" ||
    provider === "kimi"
  );
}

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

/**
 * Resolve Claude SDK options from agent config.
 *
 * Extracts claudeSdkOptions from the agent entry in agents.list[].
 * Returns undefined if no options are configured.
 */
export function resolveClaudeSdkOptions(
  cfg: OpenClawConfig,
  agentId: string,
): ClaudeSdkOptionsParam | undefined {
  const id = normalizeAgentId(agentId);
  const list = cfg.agents?.list;
  if (!Array.isArray(list)) {
    return undefined;
  }

  const entry = list.find((e) => e && typeof e === "object" && normalizeAgentId(e.id) === id) as
    | { claudeSdkOptions?: unknown }
    | undefined;

  const opts = entry?.claudeSdkOptions;
  if (!opts || typeof opts !== "object") {
    return undefined;
  }

  const raw = opts as Record<string, unknown>;
  const result: ClaudeSdkOptionsParam = {};

  // Validate and extract provider
  if (isValidProvider(raw.provider)) {
    result.provider = raw.provider;
  }

  // Validate and extract models
  if (raw.models && typeof raw.models === "object") {
    const models = raw.models as Record<string, unknown>;
    const modelResult: ClaudeSdkOptionsParam["models"] = {};
    if (typeof models.sonnet === "string") {
      modelResult.sonnet = models.sonnet;
    }
    if (typeof models.opus === "string") {
      modelResult.opus = models.opus;
    }
    if (typeof models.haiku === "string") {
      modelResult.haiku = models.haiku;
    }
    if (Object.keys(modelResult).length > 0) {
      result.models = modelResult;
    }
  }

  // Validate and extract thinkingBudgets
  if (raw.thinkingBudgets && typeof raw.thinkingBudgets === "object") {
    const budgets = raw.thinkingBudgets as Record<string, unknown>;
    const budgetResult: ClaudeSdkOptionsParam["thinkingBudgets"] = {};
    for (const level of ["minimal", "low", "medium", "high", "xhigh"] as const) {
      const value = budgets[level];
      if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        budgetResult[level] = value;
      }
    }
    if (Object.keys(budgetResult).length > 0) {
      result.thinkingBudgets = budgetResult;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
