import type { HeartbeatRunResult } from "../../infra/heartbeat-wake.js";
import type { CronJob, CronJobCreate, CronJobPatch, CronStoreFile } from "../types.js";

/** Job-scoped cron event (always has a jobId). */
export type CronJobEvent = {
  jobId: string;
  action: "added" | "updated" | "removed" | "started" | "finished";
  runAtMs?: number;
  durationMs?: number;
  status?: "ok" | "error" | "skipped";
  error?: string;
  summary?: string;
  nextRunAtMs?: number;
};

/** Service-level health event (no jobId). */
export type CronHealthEvent = {
  action: "unhealthy" | "healthy";
  error?: string;
  consecutiveFailures?: number;
};

/** Discriminated union of cron events — job events always carry `jobId`. */
export type CronEvent = CronJobEvent | CronHealthEvent;

export type Logger = {
  debug: (obj: unknown, msg?: string) => void;
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

export type CronServiceDeps = {
  nowMs?: () => number;
  log: Logger;
  storePath: string;
  cronEnabled: boolean;
  enqueueSystemEvent: (text: string, opts?: { agentId?: string }) => void;
  requestHeartbeatNow: (opts?: { reason?: string }) => void;
  runHeartbeatOnce?: (opts?: { reason?: string }) => Promise<HeartbeatRunResult>;
  runIsolatedAgentJob: (params: { job: CronJob; message: string }) => Promise<{
    status: "ok" | "error" | "skipped";
    summary?: string;
    /** Last non-empty agent text output (not truncated). */
    outputText?: string;
    error?: string;
  }>;
  onEvent?: (evt: CronEvent) => void;
};

export type CronServiceDepsInternal = Omit<CronServiceDeps, "nowMs"> & {
  nowMs: () => number;
};

export type CronServiceState = {
  deps: CronServiceDepsInternal;
  store: CronStoreFile | null;
  timer: NodeJS.Timeout | null;
  running: boolean;
  /** Timestamp (ms) when `running` was set to `true`. Used by the watchdog. */
  runningStartedAtMs: number | null;
  /** Watchdog interval that detects permanently stuck `running` state. */
  watchdogTimer: NodeJS.Timeout | null;
  op: Promise<unknown>;
  warnedDisabled: boolean;
  /** @internal Promise of the last onTimer run, for test synchronization. */
  _lastTimerRun?: Promise<void>;
  storeLoadedAtMs: number | null;
  storeFileMtimeMs: number | null;
  /** Set when `loadCronStore` returns a load error (corrupt file, etc.) */
  storeLoadError?: string;
  /** Number of consecutive load failures (for health probing). */
  consecutiveLoadFailures: number;
};

export function createCronServiceState(deps: CronServiceDeps): CronServiceState {
  return {
    deps: { ...deps, nowMs: deps.nowMs ?? (() => Date.now()) },
    store: null,
    timer: null,
    running: false,
    runningStartedAtMs: null,
    watchdogTimer: null,
    op: Promise.resolve(),
    warnedDisabled: false,
    storeLoadedAtMs: null,
    storeFileMtimeMs: null,
    consecutiveLoadFailures: 0,
  };
}

export type CronRunMode = "due" | "force";
export type CronWakeMode = "now" | "next-heartbeat";

export type CronStatusSummary = {
  enabled: boolean;
  storePath: string;
  jobs: number;
  nextWakeAtMs: number | null;
};

export type CronRunResult =
  | { ok: true; ran: true }
  | { ok: true; ran: false; reason: "not-due" }
  | { ok: false };

export type CronRemoveResult = { ok: true; removed: boolean } | { ok: false; removed: false };

export type CronAddResult = CronJob;
export type CronUpdateResult = CronJob;

export type CronListResult = CronJob[];
export type CronAddInput = CronJobCreate;
export type CronUpdateInput = CronJobPatch;
