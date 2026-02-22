/**
 * Local Sandbox Runtime - State Machine Types
 *
 * State transitions:
 * idle -> starting -> ready -> busy -> (ready | terminating)
 *                                   ↘
 *                                    failed -> ready_retry | terminal
 */

export type RuntimeState = "idle" | "starting" | "ready" | "busy" | "terminating" | "failed";

export type RuntimeStateTerminal = "idle" | "terminal";

/**
 * Valid state transitions
 */
export const RUNTIME_STATE_TRANSITIONS: Record<RuntimeState, RuntimeState[]> = {
  idle: ["starting"],
  starting: ["ready", "failed"],
  ready: ["busy", "terminating"],
  busy: ["ready", "terminating", "failed"],
  terminating: ["idle", "failed"],
  failed: ["ready", "terminal", "starting"],
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(from: RuntimeState, to: RuntimeState): boolean {
  return RUNTIME_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get human-readable description of state
 */
export function getStateDescription(state: RuntimeState): string {
  switch (state) {
    case "idle":
      return "No sandbox process running";
    case "starting":
      return "Launching sandbox process...";
    case "ready":
      return "Sandbox ready to accept requests";
    case "busy":
      return "Sandbox executing a request";
    case "terminating":
      return "Shutting down sandbox...";
    case "failed":
      return "Sandbox encountered an error";
    default:
      return "Unknown state";
  }
}
