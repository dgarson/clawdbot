/**
 * Tool Sequence Enforcer (Approach B — Orchestration-Level Enforcement)
 *
 * Tracks per-session tool call history and blocks tool calls whose declared prerequisites
 * have not yet been called within the current session. Integrates with the existing
 * `runBeforeToolCallHook` pipeline via a module-level interceptor registry.
 *
 * Usage:
 *   import { registerToolPrerequisites } from "./tool-sequence-enforcer.js";
 *   registerToolPrerequisites([
 *     {
 *       toolName: "write",
 *       requiredPrior: ["read"],
 *       blockMessage: "You must call `read` to inspect the file before writing it.",
 *     },
 *   ]);
 *
 * Then ensure checkToolSequence() is called from your runBeforeToolCallHook integration.
 * The enforcer is session-scoped: history is independent per sessionKey.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("tool-sequence-enforcer");

// =============================================================================
// Types
// =============================================================================

/** A single prerequisite rule guarding a tool. */
export type ToolPrerequisite = {
  /** The tool to gate (exact name, case-sensitive). */
  toolName: string;
  /**
   * Tool names that must have been called at least once before `toolName` is allowed.
   * All must be present (AND logic).
   */
  requiredPrior: string[];
  /**
   * Error message returned to the agent when prerequisites are not satisfied.
   * Should explain which tool(s) to call first.
   */
  blockMessage: string;
};

export type ToolSequenceCheckResult = { blocked: false } | { blocked: true; reason: string };

// =============================================================================
// In-process state
// =============================================================================

/** Per-session tool call history: sessionKey → set of tool names called. */
const sessionToolHistory = new Map<string, Set<string>>();

/** Active prerequisite rules contributed by callers. */
const activeRules: ToolPrerequisite[] = [];

// =============================================================================
// Public API
// =============================================================================

/**
 * Register prerequisite rules. Rules accumulate across calls.
 * Call this at gateway startup or plugin activation time.
 *
 * @returns A dispose function that removes the registered rules.
 */
export function registerToolPrerequisites(rules: ToolPrerequisite[]): () => void {
  if (rules.length === 0) {
    return () => {};
  }
  activeRules.push(...rules);
  log.info(
    `Tool sequence enforcer: registered ${rules.length} rule(s): ${rules.map((r) => r.toolName).join(", ")}`,
  );
  return () => {
    for (const rule of rules) {
      const idx = activeRules.indexOf(rule);
      if (idx !== -1) {
        activeRules.splice(idx, 1);
      }
    }
  };
}

/**
 * Check whether a tool call is allowed given current session history.
 *
 * Should be called from runBeforeToolCallHook before plugin hooks fire.
 * Records the tool call in history if it passes.
 *
 * @param toolName - The tool being called.
 * @param sessionKey - The current session key.
 * @returns { blocked: false } if allowed, or { blocked: true, reason } if not.
 */
export function checkToolSequence(
  toolName: string,
  sessionKey: string | undefined,
): ToolSequenceCheckResult {
  if (activeRules.length === 0 || !sessionKey) {
    if (sessionKey) {
      recordToolCall(sessionKey, toolName);
    }
    return { blocked: false };
  }

  const rule = activeRules.find((r) => r.toolName === toolName);
  if (!rule || rule.requiredPrior.length === 0) {
    recordToolCall(sessionKey, toolName);
    return { blocked: false };
  }

  const history = sessionToolHistory.get(sessionKey) ?? new Set<string>();
  const missing = rule.requiredPrior.filter((req) => !history.has(req));

  if (missing.length > 0) {
    log.warn(
      `Blocking ${toolName} for session ${sessionKey}: missing prerequisites [${missing.join(", ")}]`,
    );
    return { blocked: true, reason: rule.blockMessage };
  }

  recordToolCall(sessionKey, toolName);
  return { blocked: false };
}

/**
 * Record that a tool was called for a session (idempotent).
 * Called automatically by checkToolSequence(); exposed for external integrations.
 */
export function recordToolCall(sessionKey: string, toolName: string): void {
  let history = sessionToolHistory.get(sessionKey);
  if (!history) {
    history = new Set();
    sessionToolHistory.set(sessionKey, history);
  }
  history.add(toolName);
}

/**
 * Clear the tool call history for a session.
 * Call this when a session resets (/new, /reset) so gates apply fresh.
 */
export function clearToolSequenceHistory(sessionKey: string): void {
  sessionToolHistory.delete(sessionKey);
}

/** Clear all session histories. For testing only. */
export function resetAllToolSequenceHistory(): void {
  sessionToolHistory.clear();
  activeRules.length = 0;
}

/** Get a snapshot of the active rules (for diagnostics). */
export function getActiveToolPrerequisites(): ReadonlyArray<Readonly<ToolPrerequisite>> {
  return activeRules;
}
