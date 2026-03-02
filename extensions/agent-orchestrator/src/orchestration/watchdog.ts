import type { OrchestratorSessionState } from "../types.js";

export type StaleAgent = {
  sessionKey: string;
  role: string;
  elapsedMs: number;
  parentSessionKey?: string;
};

export function detectStaleAgents(
  sessions: Map<string, OrchestratorSessionState>,
  staleThresholdMs: number,
  now: number = Date.now(),
): StaleAgent[] {
  const stale: StaleAgent[] = [];

  for (const [key, state] of sessions) {
    if (state.status === "completed" || state.status === "stale") continue;
    if (!state.lastActivity) continue;

    const elapsed = now - state.lastActivity;
    if (elapsed > staleThresholdMs) {
      stale.push({
        sessionKey: key,
        role: state.role ?? "unknown",
        elapsedMs: elapsed,
        parentSessionKey: state.parentSessionKey,
      });
    }
  }

  return stale;
}
