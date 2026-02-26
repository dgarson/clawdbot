/**
 * Deterministic clock helpers for replay sessions and tests.
 */

export type ReplayClock = () => string;

export interface DeterministicClockOptions {
  start?: string;
  stepMs?: number;
}

export function createDeterministicClock(options: DeterministicClockOptions = {}): ReplayClock {
  const start = options.start ?? new Date(0).toISOString();
  const parsedStart = Date.parse(start);
  if (Number.isNaN(parsedStart)) {
    throw new Error(`Invalid deterministic clock start timestamp: ${start}`);
  }

  let cursor = parsedStart;
  const stepMs = Math.max(0, options.stepMs ?? 0);

  return () => {
    const now = new Date(cursor).toISOString();
    cursor += stepMs;
    return now;
  };
}

export function createRealtimeClock(): ReplayClock {
  return () => new Date().toISOString();
}
