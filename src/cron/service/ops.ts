import type { CronJobCreate, CronJobPatch } from "../types.js";
import type { CronServiceState } from "./state.js";
import {
  applyJobPatch,
  computeJobNextRunAtMs,
  createJob,
  findJobOrThrow,
  isJobDue,
  nextWakeAtMs,
  recomputeNextRuns,
} from "./jobs.js";
import { locked } from "./locked.js";
import { ensureLoaded, migrateJob, persist, warnIfDisabled } from "./store.js";
import {
  armTimer,
  claimJobRun,
  emit,
  executeJobPayload,
  finalizeJobRun,
  runMissedJobs,
  stopTimer,
  wake,
} from "./timer.js";

export async function start(state: CronServiceState) {
  await locked(state, async () => {
    if (!state.deps.cronEnabled) {
      state.deps.log.info({ enabled: false }, "cron: disabled");
      return;
    }
    await ensureLoaded(state, { skipRecompute: true });
    const jobs = state.store?.jobs ?? [];
    for (const job of jobs) {
      if (typeof job.state.runningAtMs === "number") {
        state.deps.log.warn(
          { jobId: job.id, runningAtMs: job.state.runningAtMs },
          "cron: clearing stale running marker on startup",
        );
        job.state.runningAtMs = undefined;
      }
    }
    await runMissedJobs(state);
    recomputeNextRuns(state);
    await persist(state);
    armTimer(state);
    state.deps.log.info(
      {
        enabled: true,
        jobs: state.store?.jobs.length ?? 0,
        nextWakeAtMs: nextWakeAtMs(state) ?? null,
      },
      "cron: started",
    );
  });
}

export function stop(state: CronServiceState) {
  stopTimer(state);
}

export async function status(state: CronServiceState) {
  return await locked(state, async () => {
    await ensureLoaded(state, { skipRecompute: true });
    if (state.store) {
      const changed = recomputeNextRuns(state);
      if (changed) {
        await persist(state);
      }
    }
    return {
      enabled: state.deps.cronEnabled,
      storePath: state.deps.storePath,
      jobs: state.store?.jobs.length ?? 0,
      nextWakeAtMs: state.deps.cronEnabled ? (nextWakeAtMs(state) ?? null) : null,
      storeLoadError: state.storeLoadError,
      consecutiveLoadFailures: state.consecutiveLoadFailures,
    };
  });
}

export async function list(state: CronServiceState, opts?: { includeDisabled?: boolean }) {
  return await locked(state, async () => {
    await ensureLoaded(state, { skipRecompute: true });
    if (state.store) {
      const changed = recomputeNextRuns(state);
      if (changed) {
        await persist(state);
      }
    }
    const includeDisabled = opts?.includeDisabled === true;
    const jobs = (state.store?.jobs ?? []).filter((j) => includeDisabled || j.enabled);
    return jobs.toSorted((a, b) => (a.state.nextRunAtMs ?? 0) - (b.state.nextRunAtMs ?? 0));
  });
}

export async function add(state: CronServiceState, input: CronJobCreate) {
  return await locked(state, async () => {
    warnIfDisabled(state, "add");
    await ensureLoaded(state);
    const job = createJob(state, input);
    state.store?.jobs.push(job);

    // Defensive: recompute all next-run times to ensure consistency
    recomputeNextRuns(state);

    await persist(state);
    armTimer(state);

    state.deps.log.info(
      {
        jobId: job.id,
        jobName: job.name,
        nextRunAtMs: job.state.nextRunAtMs,
        schedulerNextWakeAtMs: nextWakeAtMs(state) ?? null,
        timerArmed: state.timer !== null,
        cronEnabled: state.deps.cronEnabled,
      },
      "cron: job added",
    );

    emit(state, {
      jobId: job.id,
      action: "added",
      nextRunAtMs: job.state.nextRunAtMs,
    });
    return job;
  });
}

export async function update(state: CronServiceState, id: string, patch: CronJobPatch) {
  return await locked(state, async () => {
    warnIfDisabled(state, "update");
    await ensureLoaded(state);
    const job = findJobOrThrow(state, id);
    const now = state.deps.nowMs();
    applyJobPatch(job, patch);
    if (job.schedule.kind === "every") {
      const anchor = job.schedule.anchorMs;
      if (typeof anchor !== "number" || !Number.isFinite(anchor)) {
        const patchSchedule = patch.schedule;
        const fallbackAnchorMs =
          patchSchedule?.kind === "every"
            ? now
            : typeof job.createdAtMs === "number" && Number.isFinite(job.createdAtMs)
              ? job.createdAtMs
              : now;
        job.schedule = {
          ...job.schedule,
          anchorMs: Math.max(0, Math.floor(fallbackAnchorMs)),
        };
      }
    }
    const scheduleChanged = patch.schedule !== undefined;
    const enabledChanged = patch.enabled !== undefined;

    job.updatedAtMs = now;

    // If the job had a migration error, try re-migrating after the patch
    if (job.state.migrationError) {
      try {
        migrateJob(job as unknown as Record<string, unknown>, state.deps.log);
        job.state.migrationError = undefined;
      } catch (err) {
        job.state.migrationError = String(err);
        job.enabled = false;
      }
    }

    if (scheduleChanged || enabledChanged) {
      if (job.enabled) {
        job.state.nextRunAtMs = computeJobNextRunAtMs(job, now);
      } else {
        job.state.nextRunAtMs = undefined;
        job.state.runningAtMs = undefined;
      }
    }

    await persist(state);
    armTimer(state);
    emit(state, {
      jobId: id,
      action: "updated",
      nextRunAtMs: job.state.nextRunAtMs,
    });
    return job;
  });
}

export async function remove(state: CronServiceState, id: string) {
  return await locked(state, async () => {
    warnIfDisabled(state, "remove");
    await ensureLoaded(state);
    const before = state.store?.jobs.length ?? 0;
    if (!state.store) {
      return { ok: false, removed: false } as const;
    }
    state.store.jobs = state.store.jobs.filter((j) => j.id !== id);
    const removed = (state.store.jobs.length ?? 0) !== before;
    await persist(state);
    armTimer(state);
    if (removed) {
      emit(state, { jobId: id, action: "removed" });
    }
    return { ok: true, removed } as const;
  });
}

export async function run(state: CronServiceState, id: string, mode?: "due" | "force") {
  const forced = mode === "force";

  // Phase 1 (locked): validate and claim the job.
  const claimed = await locked(state, async () => {
    warnIfDisabled(state, "run");
    await ensureLoaded(state, { skipRecompute: true });
    const job = findJobOrThrow(state, id);
    if (typeof job.state.runningAtMs === "number") {
      return { ok: true, ran: false, reason: "already-running" as const };
    }
    const now = state.deps.nowMs();
    const due = isJobDue(job, now, { forced });
    if (!due) {
      return { ok: true, ran: false, reason: "not-due" as const };
    }
    if (!claimJobRun(state, job)) {
      return { ok: true, ran: false, reason: "already-running" as const };
    }
    return job;
  });

  if ("ok" in claimed) {
    return claimed;
  }

  // Phase 2 (unlocked): execute the job payload.
  let result;
  let endedAtMs = state.deps.nowMs();
  try {
    result = await executeJobPayload(state, claimed);
  } catch (err) {
    result = { status: "error" as const, error: String(err) };
  }
  endedAtMs = state.deps.nowMs();

  // Phase 3 (locked): finalize, persist, and re-arm.
  await locked(state, async () => {
    const runAtMs = claimed.state.runningAtMs;
    finalizeJobRun(state, claimed, result, {
      forced,
      nowMs: runAtMs ?? endedAtMs,
      runAtMs,
      endedAtMs,
    });
    await persist(state);
    armTimer(state);
  });

  return { ok: true, ran: true } as const;
}

export function wakeNow(
  state: CronServiceState,
  opts: { mode: "now" | "next-heartbeat"; text: string },
) {
  return wake(state, opts);
}
