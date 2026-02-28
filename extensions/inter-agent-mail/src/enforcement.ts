/**
 * before_tool_call enforcement hook — gates agent tool calls until the agent
 * has checked its inbox (and optionally acked pending messages).
 *
 * Enforcement levels:
 *   "none"   — no gating; purely advisory (default)
 *   "soft"   — blocks "acting" tools (write/edit/exec/send) until inbox checked;
 *              "thinking" tools (read/search/glob/grep) are always allowed
 *   "strict" — blocks ALL non-mail tools until inbox checked, AND blocks
 *              terminal/output tools until pending acks are cleared
 *
 * Per-run state is tracked in memory keyed by `${agentId}:${sessionKey}`.
 * State auto-prunes after 30 minutes of inactivity.
 */

import type {
  PluginHookBeforeToolCallEvent,
  PluginHookBeforeToolCallResult,
  PluginHookToolContext,
} from "../../../src/plugins/types.js";
import { type EnforcementLevel, type ResolvedInterAgentMailConfig } from "./config.js";
import { countUnread, mailboxPath } from "./store.js";

// ============================================================================
// Per-run enforcement state
// ============================================================================

type RunState = {
  mailChecked: boolean;
  pendingAckCount: number;
  lastActivity: number;
  lastUnreadCheckAt: number;
  consecutiveBlocks: number;
};

const STATE_TTL_MS = 30 * 60 * 1_000; // 30 minutes
const MAX_ENTRIES = 2_000;

const runStates = new Map<string, RunState>();

function runStateKey(agentId: string, sessionKey: string): string {
  return `${agentId}:${sessionKey}`;
}

function getOrCreateRunState(key: string): RunState {
  let state = runStates.get(key);
  if (!state) {
    state = {
      mailChecked: false,
      pendingAckCount: 0,
      lastActivity: Date.now(),
      lastUnreadCheckAt: 0,
      consecutiveBlocks: 0,
    };
    runStates.set(key, state);
  }
  state.lastActivity = Date.now();
  return state;
}

function pruneStaleEntries(): void {
  if (runStates.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, state] of runStates) {
    if (now - state.lastActivity > STATE_TTL_MS) {
      runStates.delete(key);
    }
  }
}

// ============================================================================
// Tool classification
// ============================================================================

/**
 * "Thinking" tools — reading, searching, exploring. Never blocked by soft
 * enforcement because the agent may need to read files to understand mail.
 */
const THINKING_TOOLS = new Set([
  // Core read/search
  "read",
  "glob",
  "grep",
  "search",
  // Common agent tool names (provider-dependent)
  "web_search",
  "web_fetch",
  "memory_search",
  "memory_get",
  "sessions_list",
  "sessions_history",
]);

/** Mail-related tools — always passthrough (the agent IS checking mail). */
const MAIL_TOOLS = new Set(["mail", "bounce_mail"]);

/**
 * "Terminal" tools — producing output visible to users or other agents.
 * In strict mode, these are also gated on pending acks being cleared.
 */
const TERMINAL_TOOLS = new Set(["send_message", "sessions_send", "sessions_spawn", "reply"]);

// ============================================================================
// Hook factory
// ============================================================================

/** Threshold: if an agent is blocked this many consecutive times, assume
 * the mail tool is not available and fail-open. */
const DEADLOCK_THRESHOLD = 3;

/** Interval (ms) between periodic unread re-checks after initial check. */
const RECHECK_INTERVAL_MS = 60_000;

type EnforcementHookDeps = {
  stateDir: string;
  config: ResolvedInterAgentMailConfig;
};

export function createBeforeToolCallEnforcementHook(deps: EnforcementHookDeps) {
  return async (
    event: PluginHookBeforeToolCallEvent,
    ctx: PluginHookToolContext,
  ): Promise<PluginHookBeforeToolCallResult | void> => {
    const agentId = ctx.agentId?.trim();
    const sessionKey = ctx.sessionKey?.trim();
    if (!agentId || !sessionKey) return;

    const enforcement = deps.config.defaultEnforcement;
    if (enforcement === "none") return;

    const toolName = event.toolName.toLowerCase();

    // Mail tools always pass through — agent is doing what we want
    if (MAIL_TOOLS.has(toolName)) {
      const key = runStateKey(agentId, sessionKey);
      const state = getOrCreateRunState(key);
      state.consecutiveBlocks = 0;
      return handleMailToolCall(agentId, sessionKey, event);
    }

    // Periodic state cleanup
    pruneStaleEntries();

    const key = runStateKey(agentId, sessionKey);
    const state = getOrCreateRunState(key);

    // If already checked mail this run, periodically re-check for new mail
    if (state.mailChecked) {
      const now = Date.now();
      if (now - state.lastUnreadCheckAt > RECHECK_INTERVAL_MS) {
        state.lastUnreadCheckAt = now;
        const filePath = mailboxPath(deps.stateDir, agentId);
        const summary = await countUnread(filePath, now);
        if (summary.urgent > 0) {
          // Urgent mail arrived mid-run — re-trigger enforcement immediately
          state.mailChecked = false;
        } else {
          // Non-urgent mail deferred to before_session_end continuation
          state.consecutiveBlocks = 0;
          return checkAckEnforcement(enforcement, toolName, state);
        }
      } else {
        state.consecutiveBlocks = 0;
        return checkAckEnforcement(enforcement, toolName, state);
      }
    }

    // Agent hasn't checked mail yet — check if there's unread mail
    if (!state.mailChecked) {
      const now = Date.now();
      const filePath = mailboxPath(deps.stateDir, agentId);
      const summary = await countUnread(filePath, now);
      state.lastUnreadCheckAt = now;

      // No unread mail — mark as checked, no enforcement needed
      if (summary.total === 0) {
        state.mailChecked = true;
        state.consecutiveBlocks = 0;
        return;
      }

      // Deadlock detection: if agent has been blocked too many times in a row,
      // the mail tool is likely not available — fail-open
      if (state.consecutiveBlocks >= DEADLOCK_THRESHOLD) {
        state.mailChecked = true;
        state.consecutiveBlocks = 0;
        return;
      }

      // There IS unread mail — apply enforcement
      const blockResult = applyEnforcementBlock(enforcement, toolName, summary);
      if (blockResult?.block) {
        state.consecutiveBlocks++;
        return blockResult;
      }
      state.consecutiveBlocks = 0;
      return blockResult;
    }
  };
}

/** Build a block result based on enforcement level and tool classification. */
function applyEnforcementBlock(
  enforcement: EnforcementLevel,
  toolName: string,
  summary: { total: number; urgent: number },
): PluginHookBeforeToolCallResult | void {
  if (enforcement === "soft") {
    // Soft: only block acting tools; thinking tools pass through
    if (THINKING_TOOLS.has(toolName)) return;
    return {
      block: true,
      blockReason:
        `[inter-agent-mail] You have ${summary.total} unread message${summary.total !== 1 ? "s" : ""}` +
        `${summary.urgent > 0 ? ` (${summary.urgent} urgent)` : ""}. ` +
        `Call mail(action='inbox') to claim and read them before using other tools.`,
    };
  }

  // Strict: block ALL non-mail tools
  return {
    block: true,
    blockReason:
      `[inter-agent-mail] You have ${summary.total} unread message${summary.total !== 1 ? "s" : ""}` +
      `${summary.urgent > 0 ? ` (${summary.urgent} urgent)` : ""}. ` +
      `You must call mail(action='inbox') before using any other tools.`,
  };
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * When the agent calls a mail tool, update the run state accordingly.
 * - inbox call → mark mailChecked, record claimed count
 * - ack call → decrement pending ack count
 */
function handleMailToolCall(
  agentId: string,
  sessionKey: string,
  event: PluginHookBeforeToolCallEvent,
): void {
  const key = runStateKey(agentId, sessionKey);
  const state = getOrCreateRunState(key);
  const params = event.params ?? {};
  const action = typeof params.action === "string" ? params.action : "";

  if (action === "inbox") {
    state.mailChecked = true;
    state.lastUnreadCheckAt = Date.now();
  }
  // Note: we can't know the exact count of messages that will be claimed or
  // acked at this point (before the tool executes). The after_tool_call hook
  // would be ideal for tracking this, but for simplicity we track the intent:
  // once the agent calls ack, we trust it is clearing its pending messages.
  if (action === "ack") {
    state.pendingAckCount = 0;
  }
}

/**
 * After the agent has checked mail, optionally enforce ack completion
 * before terminal tools (strict mode only).
 */
function checkAckEnforcement(
  enforcement: EnforcementLevel,
  toolName: string,
  state: RunState,
): PluginHookBeforeToolCallResult | void {
  if (enforcement !== "strict") return;
  if (state.pendingAckCount <= 0) return;
  if (!TERMINAL_TOOLS.has(toolName)) return;

  return {
    block: true,
    blockReason:
      `[inter-agent-mail] You have ${state.pendingAckCount} claimed message${state.pendingAckCount !== 1 ? "s" : ""} ` +
      `pending acknowledgment. Call mail(action='ack', message_ids=[...]) before responding.`,
  };
}

// ============================================================================
// After-tool-call tracking (update pending ack count from inbox results)
// ============================================================================

/**
 * Call this from an after_tool_call hook to update the pending ack count
 * when an inbox call returns claimed messages.
 */
export function trackInboxResult(agentId: string, sessionKey: string, claimedCount: number): void {
  const key = runStateKey(agentId, sessionKey);
  const state = getOrCreateRunState(key);
  state.pendingAckCount += claimedCount;
}

// ============================================================================
// Side-channel inbox claimed count (avoids fragile regex on tool result text)
// ============================================================================

const lastInboxClaimedCounts = new Map<string, number>();

/** Record the claimed count from an inbox tool call (called from tools.ts). */
export function setLastInboxClaimedCount(agentId: string, sessionKey: string, count: number): void {
  lastInboxClaimedCounts.set(runStateKey(agentId, sessionKey), count);
}

/** Consume and clear the last inbox claimed count (called from index.ts after_tool_call). */
export function consumeLastInboxClaimedCount(agentId: string, sessionKey: string): number {
  const key = runStateKey(agentId, sessionKey);
  const count = lastInboxClaimedCounts.get(key) ?? 0;
  lastInboxClaimedCounts.delete(key);
  return count;
}

// ============================================================================
// Test helpers
// ============================================================================

/** Reset all enforcement state. For testing only. */
export function _resetEnforcementState(): void {
  runStates.clear();
  lastInboxClaimedCounts.clear();
}

/** Peek at run state for a given agent+session. For testing only. */
export function _getRunState(agentId: string, sessionKey: string): RunState | undefined {
  return runStates.get(runStateKey(agentId, sessionKey));
}
