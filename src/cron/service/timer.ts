import type { CronJob } from "../types.js";
import type { CronServiceState } from "./state.js";
import { resolveCronDeliveryPlan } from "../delivery.js";
import { emit } from "./emit.js";
import {
  computeJobNextRunAtMs,
  nextWakeAtMs,
  recomputeNextRuns,
  resolveJobPayloadTextForMain,
} from "./jobs.js";
import { locked } from "./locked.js";
import { ensureLoaded, persist } from "./store.js";

const MAX_TIMER_DELAY_MS = 60_000;

/**
 * Maximum wall-clock time for a single job execution. Acts as a safety net
 * on top of the per-provider / per-agent timeouts to prevent one stuck job
 * from wedging the entire cron lane.
 */
const _DEFAULT_JOB_TIMEOUT_MS = 10 * 60_000; // 10 minutes

/**
 * Exponential backoff delays (in ms) indexed by consecutive error count.
 * After the last entry the delay stays constant.
 */
const ERROR_BACKOFF_SCHEDULE_MS = [
  30_000, // 1st error  →  30 s
  60_000, // 2nd error  →   1 min
  5 * 60_000, // 3rd error  →   5 min
  15 * 60_000, // 4th error  →  15 min
  60 * 60_000, // 5th+ error →  60 min
];

function errorBackoffMs(consecutiveErrors: number): number {
  const idx = Math.min(consecutiveErrors - 1, ERROR_BACKOFF_SCHEDULE_MS.length - 1);
  return ERROR_BACKOFF_SCHEDULE_MS[Math.max(0, idx)];
}

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
    state.deps.log.debug({}, "cron: armTimer skipped - scheduler disabled");
    return;
  }
  const nextAt = nextWakeAtMs(state);
  if (!nextAt && !state.storeLoadError) {
    const jobCount = state.store?.jobs.length ?? 0;
    const enabledCount = state.store?.jobs.filter((j) => j.enabled).length ?? 0;
    const withNextRun =
      state.store?.jobs.filter((j) => j.enabled && typeof j.state.nextRunAtMs === "number")
        .length ?? 0;
    state.deps.log.debug(
      { jobCount, enabledCount, withNextRun },
      "cron: armTimer skipped - no jobs with nextRunAtMs",
    );
    return;
  }
  const delay = nextAt ? Math.max(nextAt - state.deps.nowMs(), 0) : LOAD_ERROR_RETRY_DELAY_MS;
  // Wake at least once a minute to avoid schedule drift and recover quickly
  // when the process was paused or wall-clock time jumps.
  let clampedDelay = Math.min(delay, MAX_TIMER_DELAY_MS);
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

  state.deps.log.debug(
    { nextAt, delayMs: clampedDelay, clamped: delay > MAX_TIMER_DELAY_MS },
    "cron: timer armed",
  );

  // Ensure the watchdog is running whenever the timer is armed.
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

    // Phase 2+3 (mixed lock/unlocked): execute and finalize each claimed job
    // individually so runAt/duration reflect actual execution windows.
    if (claimed.length > 0) {
      const claimedJobIds = new Set(claimed.map((job) => job.id));
      for (const job of claimed) {
        const startedAtMs = await locked(state, async () => {
          // Re-read store to avoid clobbering concurrent mutations.
          await ensureLoaded(state, { forceReload: true, skipRecompute: true });
          const liveJob = state.store?.jobs.find((j) => j.id === job.id);
          if (!liveJob) {
            return null;
          }
          const startedAt = state.deps.nowMs();
          liveJob.state.runningAtMs = startedAt;
          liveJob.state.lastError = undefined;
          emit(state, { jobId: liveJob.id, action: "started", runAtMs: startedAt });
          await persist(state);
          return startedAt;
        });
        if (startedAtMs === null) {
          continue;
        }

        let result: JobExecResult;
        try {
          result = await executeJobPayload(state, job);
        } catch (err) {
          result = { status: "error", error: String(err) };
        }
        const endedAtMs = state.deps.nowMs();

        await locked(state, async () => {
          // Re-read store to see latest state (other ops may have mutated it).
          await ensureLoaded(state, { forceReload: true, skipRecompute: true });
          finalizeJobRun(state, job, result, {
            forced: false,
            nowMs: startedAtMs,
            startedAtMs,
            endedAtMs,
          });
          recomputeNextRuns(state, { preserveRunningForJobIds: claimedJobIds });
          await persist(state);
        });
      }
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
 * Find due jobs and claim them (set runningAtMs for lock ownership).
 * Must be called under lock. Returns the claimed jobs for unlocked execution.
 */
export function claimDueJobs(state: CronServiceState): CronJob[] {
  if (!state.store) {
    return [];
  }
  const now = state.deps.nowMs();
  const due = state.store.jobs.filter((j) => {
    if (!j.state) {
      j.state = {};
    }
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
    if (claimJobRun(state, job, { emitStarted: false })) {
      claimed.push(job);
    }
  }
  return claimed;
}

export async function runMissedJobs(state: CronServiceState) {
  if (!state.store) {
    return;
  }
  const now = state.deps.nowMs();
  const missed = state.store.jobs.filter((j) => {
    if (!j.state) {
      j.state = {};
    }
    if (!j.enabled) {
      return false;
    }
    if (typeof j.state.runningAtMs === "number") {
      return false;
    }
    const next = j.state.nextRunAtMs;
    if (j.schedule.kind === "at" && j.state.lastStatus === "ok") {
      return false;
    }
    return typeof next === "number" && now >= next;
  });

  if (missed.length > 0) {
    state.deps.log.info(
      { count: missed.length, jobIds: missed.map((j) => j.id) },
      "cron: running missed jobs after restart",
    );
    for (const job of missed) {
      const startedAt = state.deps.nowMs();
      job.state.runningAtMs = startedAt;
      job.state.lastError = undefined;
      emit(state, { jobId: job.id, action: "started", runAtMs: startedAt });

      let result: JobExecResult;
      try {
        result = await executeJobPayload(state, job);
      } catch (err) {
        result = { status: "error", error: String(err) };
      }
      finalizeJobRun(state, job, result, { forced: false, nowMs: state.deps.nowMs() });
    }
  }
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
export function claimJobRun(
  state: CronServiceState,
  job: CronJob,
  opts?: { emitStarted?: boolean; startedAtMs?: number },
): boolean {
  if (typeof job.state.runningAtMs === "number") {
    return false;
  }
  const startedAt = opts?.startedAtMs ?? state.deps.nowMs();
  job.state.runningAtMs = startedAt;
  job.state.lastError = undefined;
  if (opts?.emitStarted !== false) {
    emit(state, { jobId: job.id, action: "started", runAtMs: startedAt });
  }
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

      for (;;) {
        const heartbeatResult = await state.deps.runHeartbeatOnce({ reason });
        if (heartbeatResult.status === "ran") {
          return { status: "ok", summary: text };
        }
        if (heartbeatResult.status === "failed") {
          return { status: "error", error: heartbeatResult.reason, summary: text };
        }
        if (heartbeatResult.reason !== "requests-in-flight") {
          return { status: "skipped", error: heartbeatResult.reason, summary: text };
        }
        if (state.deps.nowMs() - waitStartedAt > maxWaitMs) {
          state.deps.requestHeartbeatNow({ reason });
          return { status: "ok", summary: text };
        }
        await delay(250);
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
  const deliveryPlan = resolveCronDeliveryPlan(job, state.deps.defaultDelivery);
  if (summaryText && deliveryPlan.requested) {
    const prefix = "Cron";
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
  opts: { forced: boolean; nowMs: number; startedAtMs?: number; endedAtMs?: number },
): { deleted: boolean } {
  const startedAtFallback = opts.startedAtMs ?? opts.nowMs;
  // Stale finalize: job was removed while we were executing.
  const liveJob = state.store?.jobs.find((j) => j.id === job.id);
  if (!liveJob) {
    emit(state, {
      jobId: job.id,
      action: "finished",
      status: result.status,
      error: result.error,
      summary: result.summary,
      runAtMs: job.state.runningAtMs ?? startedAtFallback,
      durationMs: 0,
    });
    return { deleted: false };
  }

  const startedAt = opts.startedAtMs ?? liveJob.state.runningAtMs ?? opts.nowMs;
  const endedAt = opts.endedAtMs ?? state.deps.nowMs();
  liveJob.state.runningAtMs = undefined;
  liveJob.state.lastRunAtMs = startedAt;
  liveJob.state.lastStatus = result.status;
  liveJob.state.lastDurationMs = Math.max(0, endedAt - startedAt);
  liveJob.state.lastError = result.error;
  liveJob.updatedAtMs = endedAt;

  // Track consecutive errors for backoff / auto-disable.
  if (result.status === "error") {
    liveJob.state.consecutiveErrors = (liveJob.state.consecutiveErrors ?? 0) + 1;
  } else {
    liveJob.state.consecutiveErrors = 0;
  }

  let deleted = false;
  const shouldDelete =
    liveJob.schedule.kind === "at" && result.status === "ok" && liveJob.deleteAfterRun === true;

  if (!shouldDelete) {
    if (liveJob.schedule.kind === "at") {
      // One-shot jobs are always disabled after ANY terminal status
      // (ok, error, or skipped). This prevents tight-loop rescheduling
      // when computeJobNextRunAtMs returns the past atMs value.
      liveJob.enabled = false;
      liveJob.state.nextRunAtMs = undefined;
      if (result.status === "error") {
        state.deps.log.warn(
          {
            jobId: liveJob.id,
            jobName: liveJob.name,
            consecutiveErrors: liveJob.state.consecutiveErrors,
            error: result.error,
          },
          "cron: disabling one-shot job after error",
        );
      }
    } else if (result.status === "error" && liveJob.enabled) {
      // Apply exponential backoff for errored jobs to prevent retry storms.
      const backoff = errorBackoffMs(liveJob.state.consecutiveErrors ?? 1);
      const normalNext = computeJobNextRunAtMs(liveJob, endedAt);
      const backoffNext = endedAt + backoff;
      // Use whichever is later: the natural next run or the backoff delay.
      liveJob.state.nextRunAtMs =
        normalNext !== undefined ? Math.max(normalNext, backoffNext) : backoffNext;
      state.deps.log.info(
        {
          jobId: liveJob.id,
          consecutiveErrors: liveJob.state.consecutiveErrors,
          backoffMs: backoff,
          nextRunAtMs: liveJob.state.nextRunAtMs,
        },
        "cron: applying error backoff",
      );
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
// Promise.race with a timeout
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
    if (timer) {
      clearTimeout(timer);
    }
  });
}

// ---------------------------------------------------------------------------
// Watchdog — detects permanently stuck `state.running`
// ---------------------------------------------------------------------------

/**
 * Compute the watchdog threshold: 2x the longest job timeout among all enabled
 * jobs, clamped to a minimum of 2x DEFAULT_JOB_TIMEOUT_S and a maximum of
 * WATCHDOG_MAX_STUCK_MS.
 */
function computeWatchdogThresholdMs(state: CronServiceState): number {
  let maxTimeoutS = DEFAULT_JOB_TIMEOUT_S;
  for (const job of state.store?.jobs ?? []) {
    if (!job.enabled) {
      continue;
    }
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
