/**
 * Agent run state restoration for gateway restarts.
 *
 * This module handles restoring in-flight chat run state from disk after a
 * gateway restart. It recreates the necessary runtime state (minus AbortControllers
 * which cannot be serialized) so that conversations can continue.
 *
 * Key limitations:
 * - AbortController objects are recreated but the original abort signal is lost
 * - If a tool was mid-execution, it will not resume (the run may error)
 * - Clients need to reconnect to receive further updates
 */

import type { ChatRunEntry, ChatRunRegistry } from "./server-chat.js";
import { resolveChatRunExpiresAtMs, type ChatAbortControllerEntry } from "./chat-abort.js";
import {
  clearPersistedChatRunState,
  loadPersistedChatRunState,
  type PersistedChatRun,
} from "./server-persist.js";

/**
 * Target state containers for restoration.
 */
export type ChatRunStateTarget = {
  /** Chat run registry for adding entries */
  chatRunRegistry: ChatRunRegistry;
  /** Chat abort controllers map */
  chatAbortControllers: Map<string, ChatAbortControllerEntry>;
  /** Text buffers map */
  chatRunBuffers: Map<string, string>;
  /** Delta sent timestamps map */
  chatDeltaSentAt: Map<string, number>;
  /** Agent run sequence numbers map */
  agentRunSeq: Map<string, number>;
  /** Register agent run context */
  registerAgentRunContext: (
    runId: string,
    context: {
      sessionKey?: string;
      verboseLevel?: import("../auto-reply/thinking.js").VerboseLevel;
      isHeartbeat?: boolean;
    },
  ) => void;
};

/**
 * Result of state restoration.
 */
export type RestoreResult = {
  /** Number of runs successfully restored */
  restoredCount: number;
  /** Number of runs skipped (stale, invalid, etc.) */
  skippedCount: number;
  /** Session keys that have restored runs (for potential client notification) */
  affectedSessionKeys: string[];
};

/**
 * Restore a single persisted chat run into runtime state.
 */
function restoreRun(run: PersistedChatRun, target: ChatRunStateTarget): boolean {
  const now = Date.now();

  // Validate required fields
  if (!run.sessionId || !run.clientRunId || !run.sessionKey) {
    return false;
  }

  // Skip if already expired
  if (run.expiresAtMs && now > run.expiresAtMs) {
    return false;
  }

  // Add to chat run registry
  const chatEntry: ChatRunEntry = {
    sessionKey: run.sessionKey,
    clientRunId: run.clientRunId,
  };
  target.chatRunRegistry.add(run.sessionId, chatEntry);

  // Create new AbortController (the original is lost)
  const controller = new AbortController();
  const abortEntry: ChatAbortControllerEntry = {
    controller,
    sessionId: run.sessionId,
    sessionKey: run.sessionKey,
    startedAtMs: run.startedAtMs || now,
    expiresAtMs:
      run.expiresAtMs ||
      resolveChatRunExpiresAtMs({
        now,
        timeoutMs: 5 * 60 * 1000, // 5 minute default
      }),
  };
  target.chatAbortControllers.set(run.clientRunId, abortEntry);

  // Restore text buffer if present
  if (run.textBuffer) {
    target.chatRunBuffers.set(run.clientRunId, run.textBuffer);
  }

  // Restore delta sent timestamp
  if (run.lastDeltaSentAtMs) {
    target.chatDeltaSentAt.set(run.clientRunId, run.lastDeltaSentAtMs);
  }

  // Restore agent run sequence
  if (run.lastSeq > 0) {
    target.agentRunSeq.set(run.sessionId, run.lastSeq);
  }

  // Restore agent run context
  if (run.agentContext) {
    target.registerAgentRunContext(run.sessionId, run.agentContext);
  }

  return true;
}

/**
 * Restore persisted chat run state into runtime state containers.
 *
 * This should be called early in gateway startup, after the state containers
 * are created but before accepting new connections.
 */
export async function restoreChatRunState(
  target: ChatRunStateTarget,
  log: { info: (msg: string) => void; warn: (msg: string) => void; debug: (msg: string) => void },
): Promise<RestoreResult> {
  const result: RestoreResult = {
    restoredCount: 0,
    skippedCount: 0,
    affectedSessionKeys: [],
  };

  try {
    const persistedRuns = await loadPersistedChatRunState();

    if (persistedRuns.length === 0) {
      log.debug("no persisted chat runs to restore");
      return result;
    }

    log.info(`restoring ${persistedRuns.length} persisted chat run(s)...`);

    const sessionKeys = new Set<string>();

    for (const run of persistedRuns) {
      const restored = restoreRun(run, target);
      if (restored) {
        result.restoredCount++;
        sessionKeys.add(run.sessionKey);
      } else {
        result.skippedCount++;
      }
    }

    result.affectedSessionKeys = Array.from(sessionKeys);

    if (result.restoredCount > 0) {
      log.info(
        `restored ${result.restoredCount} chat run(s) across ${result.affectedSessionKeys.length} session(s)`,
      );
    }

    if (result.skippedCount > 0) {
      log.debug(`skipped ${result.skippedCount} stale/invalid run(s)`);
    }

    // Clear the persisted state after successful restore
    await clearPersistedChatRunState();
  } catch (err) {
    log.warn(`failed to restore chat run state: ${String(err)}`);
  }

  return result;
}

/**
 * Broadcast recovery events to notify clients about restored runs.
 *
 * This can be called after WebSocket clients reconnect to let them know
 * which runs are still active.
 */
export function broadcastRecoveryEvents(params: {
  affectedSessionKeys: string[];
  broadcast: (event: string, payload: unknown) => void;
  nodeSendToSession: (sessionKey: string, event: string, payload: unknown) => void;
}): void {
  if (params.affectedSessionKeys.length === 0) {
    return;
  }

  const payload = {
    event: "gateway.recovered",
    sessionKeys: params.affectedSessionKeys,
    ts: Date.now(),
  };

  // Broadcast to all connected clients
  params.broadcast("system", payload);

  // Also send to specific sessions via node protocol
  for (const sessionKey of params.affectedSessionKeys) {
    params.nodeSendToSession(sessionKey, "system", payload);
  }
}
