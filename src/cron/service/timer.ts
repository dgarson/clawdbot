import type { HeartbeatRunResult } from "../../infra/heartbeat-wake.js";
import type { CronJob } from "../types.js";
import type { CronServiceState } from "./state.js";
import { emit } from "./emit.js";
import {
  computeJobNextRunAtMs,
  nextWakeAtMs,
  recomputeNextRuns,
  resolveJobPayloadTextForMain,
} from "./jobs.js";
import { locked } from "./locked.js";
import { ensureLoaded, persist } from "./store.js";

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** Default job timeout when payload.timeoutSeconds is not set (10 min). */
const DEFAULT_JOB_TIMEOUT_S = 10 * 60;

/** Multiplier applied to the job timeout to derive the hard cron-level timeout. */
const HARD_TIMEOUT_MULTIPLIER = 2;

/** How often the watchdog checks for a stuck `running` state (60 s). */
const WATCHDOG_INTERVAL_MS = 60_000;

/** Fallback ceiling for the watchdog threshold (30 min). */
const WATCHDOG_MAX_STUCK_MS = 30 * 60_000;

/** Max delay when a store load error is present so the scheduler retries sooner. */
const LOAD_ERROR_RETRY_DELAY_MS = 30_000;

export function armTimer(state: CronServiceState) {
  if (state.timer) {
    clearTimeout(state.timer);
  }
  state.timer = null;
  if (!state.deps.cronEnabled) {
    return;
  }
  const nextAt = nextWakeAtMs(state);
  if (!nextAt && !state.storeLoadError) {
    return;
  }
  const delay = nextAt ? Math.max(nextAt - state.deps.nowMs(), 0) : LOAD_ERROR_RETRY_DELAY_MS;
  // Avoid TimeoutOverflowWarning when a job is far in the future.
  let clampedDelay = Math.min(delay, MAX_TIMEOUT_MS);
  // Retry sooner when the store failed to load so we recover faster.
  if (state.storeLoadError) {
    clampedDelay = Math.min(clampedDelay, LOAD_ERROR_RETRY_DELAY_MS);
  }
  state.timer = setTimeout(() => {
    const run = onTimer(state).catch((err) => {
      state.deps.log.error({ err: String(err) }, "cron: timer tick failed");
    });
    // Expose for test synchronization (CronService._waitForTimerRun).
    state._lastTimerRun = run;
  }, clampedDelay);
  state.timer.unref?.();

  // Fix 2: Ensure the watchdog is running whenever the timer is armed.
  if (!state.watchdogTimer) {
    startWatchdog(state);
  }
}

export async function onTimer(state: CronServiceState) {
  if (state.running) {
    const stuckMs = state.runningStartedAtMs ? state.deps.nowMs() - state.runningStartedAtMs : null;
    state.deps.log.warn(
      { runningForMs: stuckMs },
      "cron: onTimer skipped — previous run still in progress",
    );
    return;
  }
  state.running = true;
  state.runningStartedAtMs = state.deps.nowMs();
  try {
    // Phase 1 (locked): reload store, find due jobs, claim them, persist.
    // Persist is inside the lock so other services sharing the same store
    // see the runningAtMs markers before their own Phase 1 forceReload.
    const claimed = await locked(state, async () => {
      await ensureLoaded(state, { forceReload: true, skipRecompute: true });
      const jobs = claimDueJobs(state);
      if (jobs.length > 0) {
        await persist(state);
      }
      return jobs;
    });

    // Phase 2 (unlocked): execute each claimed job.
    const results: Array<{ job: CronJob; result: JobExecResult; nowMs: number }> = [];
    for (const job of claimed) {
      const nowMs = state.deps.nowMs();
      let result: JobExecResult;
      try {
        result = await executeJobPayload(state, job);
      } catch (err) {
        result = { status: "error", error: String(err) };
      }
      results.push({ job, result, nowMs });
    }

    // Phase 3 (locked): finalize all results, recompute next runs, persist.
    if (results.length > 0) {
      await locked(state, async () => {
        // Re-read store to see latest state (other ops may have mutated it).
        await ensureLoaded(state, { forceReload: true, skipRecompute: true });
        for (const { job, result, nowMs } of results) {
          finalizeJobRun(state, job, result, { forced: false, nowMs });
        }
        recomputeNextRuns(state);
        await persist(state);
      });
    } else {
      // No jobs were due, but still recompute + persist under lock in case
      // the store was stale or nextRunAtMs needs updating.
      await locked(state, async () => {
        recomputeNextRuns(state);
        await persist(state);
      });
    }
  } finally {
    state.running = false;
    state.runningStartedAtMs = null;
    // Always re-arm so transient errors (e.g. ENOSPC) don't kill the scheduler.
    armTimer(state);
  }
}

/**
 * Find due jobs and claim them (set runningAtMs + emit started).
 * Must be called under lock. Returns the claimed jobs for unlocked execution.
 */
export function claimDueJobs(state: CronServiceState): CronJob[] {
  if (!state.store) {
    return [];
  }
  const now = state.deps.nowMs();
  const due = state.store.jobs.filter((j) => {
    if (!j.enabled) {
      return false;
    }
    if (typeof j.state.runningAtMs === "number") {
      return false;
    }
    const next = j.state.nextRunAtMs;
    return typeof next === "number" && now >= next;
  });
  const claimed: CronJob[] = [];
  for (const job of due) {
    if (claimJobRun(state, job)) {
      claimed.push(job);
    }
  }
  return claimed;
}

// ---------------------------------------------------------------------------
// Claim / Execute / Finalize — split so the lock is only held briefly.
// ---------------------------------------------------------------------------

/** Result of the unlocked execution phase, consumed by finalizeJobRun. */
export type JobExecResult = {
  status: "ok" | "error" | "skipped";
  error?: string;
  summary?: string;
};

/**
 * Phase 1 (locked): mark the job as running, emit "started", persist.
 * Returns false if the job is already running (caller should skip).
 */
export function claimJobRun(state: CronServiceState, job: CronJob): boolean {
  if (typeof job.state.runningAtMs === "number") {
    return false;
  }
  const startedAt = state.deps.nowMs();
  job.state.runningAtMs = startedAt;
  job.state.lastError = undefined;
  emit(state, { jobId: job.id, action: "started", runAtMs: startedAt });
  return true;
}

/**
 * Phase 2 (unlocked): run the actual job payload. Returns the result
 * for finalizeJobRun to persist under lock.
 */
export async function executeJobPayload(
  state: CronServiceState,
  job: CronJob,
): Promise<JobExecResult> {
  if (job.sessionTarget === "main") {
    const text = resolveJobPayloadTextForMain(job);
    if (!text) {
      const kind = job.payload.kind;
      return {
        status: "skipped",
        error:
          kind === "systemEvent"
            ? "main job requires non-empty systemEvent text"
            : 'main job requires payload.kind="systemEvent"',
      };
    }
    state.deps.enqueueSystemEvent(text, { agentId: job.agentId });
    if (job.wakeMode === "now" && state.deps.runHeartbeatOnce) {
      const reason = `cron:${job.id}`;
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
      const maxWaitMs = 2 * 60_000;
      const waitStartedAt = state.deps.nowMs();

      let heartbeatResult: HeartbeatRunResult;
      for (;;) {
        heartbeatResult = await state.deps.runHeartbeatOnce({ reason });
        if (
          heartbeatResult.status !== "skipped" ||
          heartbeatResult.reason !== "requests-in-flight"
        ) {
          break;
        }
        if (state.deps.nowMs() - waitStartedAt > maxWaitMs) {
          heartbeatResult = {
            status: "skipped",
            reason: "timeout waiting for main lane to become idle",
          };
          break;
        }
        await delay(250);
      }

      if (heartbeatResult.status === "ran") {
        return { status: "ok", summary: text };
      } else if (heartbeatResult.status === "skipped") {
        return { status: "skipped", error: heartbeatResult.reason, summary: text };
      } else {
        return { status: "error", error: heartbeatResult.reason, summary: text };
      }
    }
    // wakeMode is "next-heartbeat" or runHeartbeatOnce not available
    state.deps.requestHeartbeatNow({ reason: `cron:${job.id}` });
    return { status: "ok", summary: text };
  }

  if (job.payload.kind !== "agentTurn") {
    return { status: "skipped", error: "isolated job requires payload.kind=agentTurn" };
  }

  // Hard timeout wrapper around runIsolatedAgentJob.
  const jobTimeoutS = job.payload.timeoutSeconds ?? DEFAULT_JOB_TIMEOUT_S;
  const hardTimeoutMs = jobTimeoutS * 1000 * HARD_TIMEOUT_MULTIPLIER;
  const res = await promiseWithTimeout(
    state.deps.runIsolatedAgentJob({
      job,
      message: job.payload.message,
    }),
    hardTimeoutMs,
    `cron job ${job.id} (${job.name}) exceeded hard timeout of ${hardTimeoutMs / 1000}s`,
  );

  // Post a short summary back to the main session so the user sees
  // the cron result without opening the isolated session.
  const summaryText = res.summary?.trim();
  const deliveryMode = job.delivery?.mode ?? "announce";
  if (summaryText && deliveryMode !== "none") {
    const prefix = "\u{1f4cb} Cron";
    const label =
      res.status === "error" ? `${prefix} (error): ${summaryText}` : `${prefix}: ${summaryText}`;
    state.deps.enqueueSystemEvent(label, { agentId: job.agentId });
    if (job.wakeMode === "now") {
      state.deps.requestHeartbeatNow({ reason: `cron:${job.id}` });
    }
  }

  if (res.status === "ok") {
    return { status: "ok", summary: res.summary };
  } else if (res.status === "skipped") {
    return { status: "skipped", summary: res.summary };
  } else {
    return { status: "error", error: res.error ?? "cron job failed", summary: res.summary };
  }
}

/**
 * Phase 3 (locked): apply results to the job, emit "finished", persist.
 * If the job was removed during execution, this is a no-op (stale finalize).
 */
export function finalizeJobRun(
  state: CronServiceState,
  job: CronJob,
  result: JobExecResult,
  opts: { forced: boolean; nowMs: number },
): { deleted: boolean } {
  // Stale finalize: job was removed while we were executing.
  const liveJob = state.store?.jobs.find((j) => j.id === job.id);
  if (!liveJob) {
    emit(state, {
      jobId: job.id,
      action: "finished",
      status: result.status,
      error: result.error,
      summary: result.summary,
      runAtMs: job.state.runningAtMs ?? opts.nowMs,
      durationMs: 0,
    });
    return { deleted: false };
  }

  const startedAt = liveJob.state.runningAtMs ?? opts.nowMs;
  const endedAt = state.deps.nowMs();
  liveJob.state.runningAtMs = undefined;
  liveJob.state.lastRunAtMs = startedAt;
  liveJob.state.lastStatus = result.status;
  liveJob.state.lastDurationMs = Math.max(0, endedAt - startedAt);
  liveJob.state.lastError = result.error;

  let deleted = false;
  const shouldDelete =
    liveJob.schedule.kind === "at" && result.status === "ok" && liveJob.deleteAfterRun === true;

  if (!shouldDelete) {
    if (liveJob.schedule.kind === "at" && result.status === "ok") {
      // One-shot job completed successfully; disable it.
      liveJob.enabled = false;
      liveJob.state.nextRunAtMs = undefined;
    } else if (liveJob.enabled) {
      liveJob.state.nextRunAtMs = computeJobNextRunAtMs(liveJob, endedAt);
    } else {
      liveJob.state.nextRunAtMs = undefined;
    }
  }

  emit(state, {
    jobId: liveJob.id,
    action: "finished",
    status: result.status,
    error: result.error,
    summary: result.summary,
    runAtMs: startedAt,
    durationMs: liveJob.state.lastDurationMs,
    nextRunAtMs: liveJob.state.nextRunAtMs,
  });

  if (shouldDelete && state.store) {
    state.store.jobs = state.store.jobs.filter((j) => j.id !== liveJob.id);
    deleted = true;
    emit(state, { jobId: liveJob.id, action: "removed" });
  }

  liveJob.updatedAtMs = opts.nowMs;
  if (!opts.forced && liveJob.enabled && !deleted) {
    // Keep nextRunAtMs in sync in case the schedule advanced during a long run.
    liveJob.state.nextRunAtMs = computeJobNextRunAtMs(liveJob, endedAt);
  }

  return { deleted };
}

export function wake(
  state: CronServiceState,
  opts: { mode: "now" | "next-heartbeat"; text: string },
) {
  const text = opts.text.trim();
  if (!text) {
    return { ok: false } as const;
  }
  state.deps.enqueueSystemEvent(text);
  if (opts.mode === "now") {
    state.deps.requestHeartbeatNow({ reason: "wake" });
  }
  return { ok: true } as const;
}

export function stopTimer(state: CronServiceState) {
  if (state.timer) {
    clearTimeout(state.timer);
  }
  state.timer = null;
  stopWatchdog(state);
}

// ---------------------------------------------------------------------------
// Fix 1 helper: Promise.race with a timeout
// ---------------------------------------------------------------------------

class CronHardTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CronHardTimeoutError";
  }
}

function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new CronHardTimeoutError(message)), timeoutMs);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// ---------------------------------------------------------------------------
// Fix 2: Watchdog — detects permanently stuck `state.running`
// ---------------------------------------------------------------------------

/**
 * Compute the watchdog threshold: 2× the longest job timeout among all enabled
 * jobs, clamped to a minimum of 2× DEFAULT_JOB_TIMEOUT_S and a maximum of
 * WATCHDOG_MAX_STUCK_MS.
 */
function computeWatchdogThresholdMs(state: CronServiceState): number {
  let maxTimeoutS = DEFAULT_JOB_TIMEOUT_S;
  for (const job of state.store?.jobs ?? []) {
    if (!job.enabled) continue;
    if (job.payload.kind === "agentTurn" && typeof job.payload.timeoutSeconds === "number") {
      maxTimeoutS = Math.max(maxTimeoutS, job.payload.timeoutSeconds);
    }
  }
  const thresholdMs = maxTimeoutS * 1000 * HARD_TIMEOUT_MULTIPLIER;
  return Math.min(thresholdMs, WATCHDOG_MAX_STUCK_MS);
}

/**
 * Start the watchdog interval. Safe to call multiple times — restarts if already
 * running. Called from `armTimer`.
 */
export function startWatchdog(state: CronServiceState) {
  stopWatchdog(state);
  state.watchdogTimer = setInterval(() => {
    checkWatchdog(state);
  }, WATCHDOG_INTERVAL_MS);
  state.watchdogTimer.unref?.();
}

function stopWatchdog(state: CronServiceState) {
  if (state.watchdogTimer) {
    clearInterval(state.watchdogTimer);
  }
  state.watchdogTimer = null;
}

function checkWatchdog(state: CronServiceState) {
  if (!state.running || state.runningStartedAtMs === null) {
    return;
  }
  const runningForMs = state.deps.nowMs() - state.runningStartedAtMs;
  const thresholdMs = computeWatchdogThresholdMs(state);
  if (runningForMs <= thresholdMs) {
    return;
  }
  state.deps.log.error(
    { runningForMs, thresholdMs },
    "cron: watchdog — state.running stuck, forcibly resetting and re-arming timer",
  );
  state.running = false;
  state.runningStartedAtMs = null;
  armTimer(state);
}

// Re-export emit from its extracted module for backwards compatibility.
export { emit } from "./emit.js";
