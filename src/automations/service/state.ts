/**
 * Service state management for AutomationService.
 *
 * Provides state structure and factory functions for managing
 * the automation service's runtime state.
 */

import type { AutomationServiceDeps } from "../types.js";

/**
 * Internal service dependencies with nowMs guaranteed to be set.
 */
export type AutomationServiceDepsInternal = Omit<AutomationServiceDeps, "nowMs"> & {
  nowMs: () => number;
};

/**
 * Tracking for currently running automation runs.
 */
export type RunningRun = {
  /** Automation ID */
  automationId: string;
  /** Run ID */
  runId: string;
  /** When the run started */
  startedAt: number;
  /** Abort controller for cancellation */
  controller: AbortController;
};

/**
 * Runtime state of the AutomationService.
 */
export interface AutomationServiceState {
  /** Service dependencies */
  deps: AutomationServiceDepsInternal;
  /** Loaded store file (null until first load) */
  store: import("../types.js").AutomationStoreFile | null;
  /** Active timer for next scheduled run */
  timer: NodeJS.Timeout | null;
  /** Whether a timer tick is currently processing */
  running: boolean;
  /** Promise chain for serializing operations */
  op: Promise<unknown>;
  /** Whether we've warned that automations are disabled */
  warnedDisabled: boolean;
  /** Currently running runs (for cancellation) */
  runningRuns: Map<string, RunningRun>;
  /** @internal Promise of the last onTimer run, for test synchronization. */
  _lastTimerRun?: Promise<void>;
}

/**
 * Create a new AutomationServiceState instance.
 *
 * @param deps - Service dependencies
 * @returns New state instance
 */
export function createAutomationServiceState(deps: AutomationServiceDeps): AutomationServiceState {
  return {
    deps: {
      ...deps,
      nowMs: deps.nowMs ?? (() => Date.now()),
    },
    store: null,
    timer: null,
    running: false,
    op: Promise.resolve(),
    warnedDisabled: false,
    runningRuns: new Map(),
  };
}
