/** Shared defaults for work-queue worker loops (classic + workflow adapter). */

/** How often an idle worker polls the queue for new items (ms). */
export const DEFAULT_POLL_INTERVAL_MS = 300_000;

/** Per-item agent session timeout (seconds). */
export const DEFAULT_SESSION_TIMEOUT_S = 1200;

/** Consecutive loop errors before exponential backoff kicks in. */
export const MAX_CONSECUTIVE_ERRORS = 5;

/** Base delay for exponential backoff after repeated errors (ms). */
export const BACKOFF_BASE_MS = 20_000;
