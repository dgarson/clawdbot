/**
 * Graceful agent drain helper for gateway restarts.
 *
 * This module provides functionality to wait for running agents to complete
 * before a gateway restart, with a configurable timeout.
 */

export type AgentDrainResult = {
  /** Whether all agents completed before timeout */
  drained: boolean;
  /** Number of agents still running (0 if drained) */
  runningAgents: number;
  /** Time spent waiting in milliseconds */
  waitedMs: number;
};

export type AgentDrainOptions = {
  /** Map of running agent sessions (runId -> seq) */
  agentRunSeq: Map<string, number>;
  /** Maximum time to wait in milliseconds */
  timeoutMs: number;
  /** Optional logger */
  log?: { info: (msg: string) => void; debug: (msg: string) => void };
  /** Poll interval in milliseconds (default: 100ms) */
  pollIntervalMs?: number;
  /** Optional callback on each poll (for progress reporting) */
  onPoll?: (runningCount: number, elapsedMs: number) => void;
};

/**
 * Wait for all running agents to complete, with timeout.
 *
 * This function polls the agentRunSeq map until it's empty or the timeout
 * is reached. It's used during graceful restarts to allow in-flight agent
 * conversations to complete before shutting down.
 *
 * Note: This only waits for agents to finish naturally. If you need to
 * forcefully abort agents, use the abort controller mechanism separately.
 */
export async function waitForAgentDrain(opts: AgentDrainOptions): Promise<AgentDrainResult> {
  const { agentRunSeq, timeoutMs, pollIntervalMs = 100, onPoll, log } = opts;
  const startMs = Date.now();

  // Quick check: if already empty, return immediately
  if (agentRunSeq.size === 0) {
    log?.debug("no agents running, drain complete");
    return { drained: true, runningAgents: 0, waitedMs: 0 };
  }

  log?.info(`waiting for ${agentRunSeq.size} agent(s) to complete (timeout: ${timeoutMs}ms)...`);

  while (agentRunSeq.size > 0) {
    const elapsedMs = Date.now() - startMs;

    // Check timeout
    if (elapsedMs >= timeoutMs) {
      const remaining = agentRunSeq.size;
      log?.info(`drain timeout reached with ${remaining} agent(s) still running`);
      return {
        drained: false,
        runningAgents: remaining,
        waitedMs: elapsedMs,
      };
    }

    // Report progress
    onPoll?.(agentRunSeq.size, elapsedMs);

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const waitedMs = Date.now() - startMs;
  log?.info(`all agents drained in ${waitedMs}ms`);

  return {
    drained: true,
    runningAgents: 0,
    waitedMs,
  };
}

/**
 * Check if graceful drain should be attempted based on config and options.
 */
export function shouldAttemptGracefulDrain(params: {
  /** Explicit graceful flag from RPC params */
  requestGraceful?: boolean;
  /** Config default for graceful restart */
  configGraceful?: boolean;
  /** Number of currently running agents */
  runningAgentCount: number;
}): boolean {
  // If explicitly disabled, skip drain
  if (params.requestGraceful === false) {
    return false;
  }

  // If explicitly enabled or config default is true, and there are running agents
  const gracefulEnabled = params.requestGraceful === true || params.configGraceful === true;

  return gracefulEnabled && params.runningAgentCount > 0;
}

/**
 * Default graceful drain timeout in milliseconds (30 seconds).
 */
export const DEFAULT_GRACEFUL_TIMEOUT_MS = 30_000;

/**
 * Maximum graceful drain timeout in milliseconds (5 minutes).
 */
export const MAX_GRACEFUL_TIMEOUT_MS = 5 * 60_000;

/**
 * Resolve the effective graceful timeout, bounded by min/max.
 */
export function resolveGracefulTimeoutMs(params: {
  /** Explicit timeout from RPC params */
  requestTimeoutMs?: number;
  /** Config default timeout */
  configTimeoutMs?: number;
}): number {
  const explicit = params.requestTimeoutMs;
  const config = params.configTimeoutMs;

  // Use explicit if provided, otherwise config, otherwise default
  const raw =
    typeof explicit === "number"
      ? explicit
      : typeof config === "number"
        ? config
        : DEFAULT_GRACEFUL_TIMEOUT_MS;

  // Bound to valid range
  return Math.max(0, Math.min(MAX_GRACEFUL_TIMEOUT_MS, raw));
}
